use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{
    Direction, ExportAction, ExportFrame, ExportManifest, LoopMode, PixelPoint, PixelSize,
    RelativePath, Sha256Digest,
};
use crate::storage::VaultRoot;

use super::artifact::{safe_existing_child, validate_build, write_bytes};
use super::{
    CancellationToken, ExportError, ExportProgress, ExportStage, NeverCancel, ProgressReporter,
};

pub const TESTED_GODOT_VERSION: &str = "4.7.2";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GodotExportOptions {
    pub include_scene: bool,
}

impl Default for GodotExportOptions {
    fn default() -> Self {
        Self {
            include_scene: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GodotPackageOutcome {
    pub package_directory: PathBuf,
    pub source_fingerprint: Sha256Digest,
    pub animation_names: Vec<String>,
    pub scene: Option<RelativePath>,
    pub reused_existing_package: bool,
}

#[derive(Debug, Clone)]
pub struct GodotExporter {
    output_root: VaultRoot,
}

impl GodotExporter {
    pub fn new(output_root: VaultRoot) -> Self {
        Self { output_root }
    }

    pub fn export(
        &self,
        generic_build: &Path,
        package_directory: &Path,
        options: GodotExportOptions,
    ) -> Result<GodotPackageOutcome, ExportError> {
        self.export_with_control(
            generic_build,
            package_directory,
            options,
            &NeverCancel,
            &mut |_| {},
        )
    }

    pub fn export_with_control<C, P>(
        &self,
        generic_build: &Path,
        package_directory: &Path,
        options: GodotExportOptions,
        cancellation: &C,
        progress: &mut P,
    ) -> Result<GodotPackageOutcome, ExportError>
    where
        C: CancellationToken,
        P: ProgressReporter,
    {
        report_godot(progress, 0, 5, "Starting Godot package generation");
        ensure_not_cancelled(cancellation)?;
        let manifest = validate_build(generic_build)?;
        if !manifest.complete {
            return Err(ExportError::InvalidGodotPackage(
                "engine packages require a complete generic export".to_owned(),
            ));
        }
        let animations = collect_animations(&manifest)?;
        let expected = expected_package_files(&manifest, options)?;
        report_godot(progress, 1, 5, "Validated the complete generic export");
        ensure_not_cancelled(cancellation)?;
        let destination = self
            .output_root
            .resolve(package_directory)
            .map_err(|error| ExportError::InvalidGodotPackage(error.to_string()))?;
        match fs::symlink_metadata(destination.as_path()) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || !metadata.is_dir() {
                    return Err(ExportError::InvalidGodotPackage(
                        "managed Godot package targets must be real directories".to_owned(),
                    ));
                }
                validate_package(destination.as_path(), generic_build, options, &expected)?;
                ensure_not_cancelled(cancellation)?;
                report_godot(progress, 5, 5, "Reused the validated Godot package");
                return package_outcome(package_directory, &manifest, &animations, options, true);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(ExportError::io(
                    "inspect managed Godot package",
                    destination.as_path(),
                    error,
                ));
            }
        }
        let parent = ensure_package_parent(&self.output_root, package_directory)?;
        let stage_path = parent.join(format!(
            ".godot-package-{}.staging",
            Uuid::new_v4().hyphenated()
        ));
        fs::create_dir(&stage_path)
            .map_err(|error| ExportError::io("create Godot package stage", &stage_path, error))?;
        let mut stage = PackageStage::new(stage_path);
        copy_generic_artifacts(generic_build, stage.path(), &manifest, cancellation)?;
        report_godot(progress, 2, 5, "Copied validated PNG and JSON artifacts");
        ensure_not_cancelled(cancellation)?;
        write_engine_artifacts(stage.path(), &manifest, &animations, options)?;
        report_godot(progress, 3, 5, "Generated portable Godot resources");
        ensure_not_cancelled(cancellation)?;
        validate_package(stage.path(), generic_build, options, &expected)?;
        report_godot(progress, 4, 5, "Validated the staged Godot package");
        ensure_not_cancelled(cancellation)?;
        fs::rename(stage.path(), destination.as_path()).map_err(|error| {
            ExportError::io(
                "publish validated Godot package",
                destination.as_path(),
                error,
            )
        })?;
        stage.disarm();
        report_godot(progress, 5, 5, "Published the Godot package");
        package_outcome(package_directory, &manifest, &animations, options, false)
    }
}

fn package_outcome(
    package_directory: &Path,
    manifest: &ExportManifest,
    animations: &[GodotAnimation<'_>],
    options: GodotExportOptions,
    reused_existing_package: bool,
) -> Result<GodotPackageOutcome, ExportError> {
    Ok(GodotPackageOutcome {
        package_directory: package_directory.to_path_buf(),
        source_fingerprint: manifest.source_fingerprint.clone(),
        animation_names: animations
            .iter()
            .map(|animation| animation.name.clone())
            .collect(),
        scene: options
            .include_scene
            .then(|| RelativePath::parse("character.tscn"))
            .transpose()?,
        reused_existing_package,
    })
}

#[derive(Debug)]
struct GodotAnimation<'a> {
    name: String,
    action: &'a ExportAction,
    frames: Vec<&'a ExportFrame>,
}

fn collect_animations(manifest: &ExportManifest) -> Result<Vec<GodotAnimation<'_>>, ExportError> {
    let mut actions = manifest.actions.iter().collect::<Vec<_>>();
    actions.sort_by(|left, right| left.action_key.as_str().cmp(right.action_key.as_str()));
    let mut animations = Vec::new();
    for action in actions {
        for &direction in &action.directions {
            let mut frames = manifest
                .frames
                .iter()
                .filter(|frame| {
                    frame.action_key == action.action_key && frame.direction == direction
                })
                .collect::<Vec<_>>();
            frames.sort_by_key(|frame| frame.sample_index);
            let expected = usize::from(action.frame_count);
            if frames.len() != expected
                || frames
                    .iter()
                    .enumerate()
                    .any(|(index, frame)| usize::from(frame.sample_index) != index)
            {
                return Err(ExportError::InvalidGodotPackage(format!(
                    "animation {}_{} does not contain every sample exactly once",
                    action.action_key,
                    direction_name(direction)
                )));
            }
            animations.push(GodotAnimation {
                name: format!("{}_{}", action.action_key, direction_name(direction)),
                action,
                frames,
            });
        }
    }
    Ok(animations)
}

fn ensure_package_parent(
    root: &VaultRoot,
    package_directory: &Path,
) -> Result<PathBuf, ExportError> {
    let Some(parent) = package_directory.parent() else {
        return Ok(root.path().to_path_buf());
    };
    if parent.as_os_str().is_empty() {
        return Ok(root.path().to_path_buf());
    }
    Ok(root
        .ensure_directory(parent)
        .map_err(|error| ExportError::InvalidGodotPackage(error.to_string()))?
        .as_path()
        .to_path_buf())
}

fn generic_artifact_paths(manifest: &ExportManifest) -> Result<HashSet<PathBuf>, ExportError> {
    let mut relative_paths = HashSet::from([PathBuf::from("animation.json")]);
    for page in &manifest.pages {
        validate_godot_asset_path(&page.file)?;
        relative_paths.insert(PathBuf::from(page.file.as_str()));
    }
    for frame in &manifest.frames {
        if let Some(path) = &frame.individual_file {
            validate_godot_asset_path(path)?;
            relative_paths.insert(PathBuf::from(path.as_str()));
        }
    }
    Ok(relative_paths)
}

fn expected_package_files(
    manifest: &ExportManifest,
    options: GodotExportOptions,
) -> Result<HashSet<PathBuf>, ExportError> {
    let mut expected = generic_artifact_paths(manifest)?;
    expected.insert(PathBuf::from("sprite_frames.tres"));
    expected.insert(PathBuf::from("GODOT_IMPORT.md"));
    if options.include_scene {
        expected.insert(PathBuf::from("character.tscn"));
    }
    Ok(expected)
}

fn copy_generic_artifacts<C: CancellationToken>(
    source: &Path,
    destination: &Path,
    manifest: &ExportManifest,
    cancellation: &C,
) -> Result<(), ExportError> {
    let relative_paths = generic_artifact_paths(manifest)?;
    for relative in &relative_paths {
        ensure_not_cancelled(cancellation)?;
        let source_file = safe_existing_child(source, relative)?;
        copy_regular_file(&source_file, &destination.join(relative), cancellation)?;
    }
    Ok(())
}

fn copy_regular_file<C: CancellationToken>(
    source: &Path,
    destination: &Path,
    cancellation: &C,
) -> Result<(), ExportError> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            ExportError::io("create Godot package artifact directory", parent, error)
        })?;
    }
    let mut input = File::open(source)
        .map_err(|error| ExportError::io("open generic export artifact", source, error))?;
    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .map_err(|error| ExportError::io("create Godot package artifact", destination, error))?;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        ensure_not_cancelled(cancellation)?;
        let count = input
            .read(&mut buffer)
            .map_err(|error| ExportError::io("read generic export artifact", source, error))?;
        if count == 0 {
            break;
        }
        output
            .write_all(&buffer[..count])
            .map_err(|error| ExportError::io("copy generic export artifact", destination, error))?;
    }
    output
        .sync_all()
        .map_err(|error| ExportError::io("sync Godot package artifact", destination, error))
}

fn write_engine_artifacts(
    stage: &Path,
    manifest: &ExportManifest,
    animations: &[GodotAnimation<'_>],
    options: GodotExportOptions,
) -> Result<(), ExportError> {
    let sprite_frames = sprite_frames_text(manifest, animations)?;
    write_bytes(&stage.join("sprite_frames.tres"), sprite_frames.as_bytes())?;
    if options.include_scene {
        let scene = character_scene_text(manifest, animations)?;
        write_bytes(&stage.join("character.tscn"), scene.as_bytes())?;
    }
    let guide = integration_guide(manifest, animations, options);
    write_bytes(&stage.join("GODOT_IMPORT.md"), guide.as_bytes())?;
    Ok(())
}

fn sprite_frames_text(
    manifest: &ExportManifest,
    animations: &[GodotAnimation<'_>],
) -> Result<String, ExportError> {
    let mut pages = manifest.pages.iter().collect::<Vec<_>>();
    pages.sort_by(|left, right| left.id.cmp(&right.id));
    let page_ids = pages
        .iter()
        .enumerate()
        .map(|(index, page)| (page.id.as_str(), format!("{}_page", index + 1)))
        .collect::<HashMap<_, _>>();
    let frame_count = animations
        .iter()
        .try_fold(0_usize, |total, animation| {
            total.checked_add(animation.frames.len())
        })
        .ok_or_else(|| ExportError::InvalidGodotPackage("frame count overflow".to_owned()))?;
    let mut output = format!(
        "[gd_resource type=\"SpriteFrames\" load_steps={} format=3]\n\n",
        pages.len() + frame_count + 1
    );
    append_external_pages(&mut output, &pages)?;
    let subresources = append_atlas_subresources(&mut output, animations, &page_ids)?;
    append_animation_resource(&mut output, animations, &subresources)?;
    Ok(output)
}

fn append_external_pages(
    output: &mut String,
    pages: &[&crate::domain::AtlasPage],
) -> Result<(), ExportError> {
    for (index, page) in pages.iter().enumerate() {
        writeln!(
            output,
            "[ext_resource type=\"Texture2D\" path={} id=\"{}_page\"]",
            godot_quote(page.file.as_str())?,
            index + 1
        )
        .expect("writing to a string cannot fail");
    }
    output.push('\n');
    Ok(())
}

fn append_atlas_subresources(
    output: &mut String,
    animations: &[GodotAnimation<'_>],
    page_ids: &HashMap<&str, String>,
) -> Result<Vec<Vec<String>>, ExportError> {
    let mut resource_ids = Vec::with_capacity(animations.len());
    let mut frame_index = 0_usize;
    for animation in animations {
        let mut animation_ids = Vec::with_capacity(animation.frames.len());
        for frame in &animation.frames {
            let id = format!("AtlasTexture_{frame_index:06}");
            let page_id = page_ids.get(frame.page_id.as_str()).ok_or_else(|| {
                ExportError::InvalidGodotPackage(format!(
                    "frame refers to unknown page {}",
                    frame.page_id
                ))
            })?;
            let crate::domain::PixelRect(x, y, width, height) = frame.rect_px;
            writeln!(output, "[sub_resource type=\"AtlasTexture\" id=\"{id}\"]")
                .expect("writing to a string cannot fail");
            writeln!(output, "atlas = ExtResource(\"{page_id}\")")
                .expect("writing to a string cannot fail");
            writeln!(output, "region = Rect2({x}, {y}, {width}, {height})")
                .expect("writing to a string cannot fail");
            output.push_str("filter_clip = true\n\n");
            animation_ids.push(id);
            frame_index += 1;
        }
        resource_ids.push(animation_ids);
    }
    Ok(resource_ids)
}

fn append_animation_resource(
    output: &mut String,
    animations: &[GodotAnimation<'_>],
    subresources: &[Vec<String>],
) -> Result<(), ExportError> {
    output.push_str("[resource]\nanimations = [");
    for (animation_index, animation) in animations.iter().enumerate() {
        if animation_index > 0 {
            output.push_str(", ");
        }
        output.push_str("{\n\"frames\": [");
        for (frame_index, (frame, resource_id)) in animation
            .frames
            .iter()
            .zip(&subresources[animation_index])
            .enumerate()
        {
            if frame_index > 0 {
                output.push_str(", ");
            }
            write!(
                output,
                "{{\n\"duration\": {}.0,\n\"texture\": SubResource(\"{}\")\n}}",
                frame.duration_ticks, resource_id
            )
            .expect("writing to a string cannot fail");
        }
        write!(
            output,
            "],\n\"loop\": {},\n\"name\": &{},\n\"speed\": {}.0\n}}",
            if animation.action.loop_mode == LoopMode::Loop {
                1
            } else {
                0
            },
            godot_quote(&animation.name)?,
            animation.action.fps
        )
        .expect("writing to a string cannot fail");
    }
    output.push_str("]\n");
    Ok(())
}

fn character_scene_text(
    manifest: &ExportManifest,
    animations: &[GodotAnimation<'_>],
) -> Result<String, ExportError> {
    let Some(first) = animations.first() else {
        return Err(ExportError::InvalidGodotPackage(
            "SpriteFrames needs at least one animation".to_owned(),
        ));
    };
    let (size, ground) = common_scene_geometry(manifest)?;
    let offset_x = -i32::from(ground.0);
    let offset_y = -i32::from(ground.1);
    Ok(format!(
        "[gd_scene load_steps=2 format=3]\n\n\
         [ext_resource type=\"SpriteFrames\" path=\"sprite_frames.tres\" id=\"1_frames\"]\n\n\
         [node name=\"PixelCutoutCharacter\" type=\"Node2D\"]\n\
         metadata/_pixel_cutout_manifest = \"animation.json\"\n\
         metadata/_pixel_cutout_frame_size = Vector2i({}, {})\n\n\
         [node name=\"AnimatedSprite2D\" type=\"AnimatedSprite2D\" parent=\".\"]\n\
         texture_filter = 1\n\
         sprite_frames = ExtResource(\"1_frames\")\n\
         animation = &{}\n\
         centered = false\n\
         offset = Vector2({}, {})\n",
        size.0,
        size.1,
        godot_quote(&first.name)?,
        offset_x,
        offset_y
    ))
}

fn common_scene_geometry(
    manifest: &ExportManifest,
) -> Result<(PixelSize, PixelPoint), ExportError> {
    let Some(first) = manifest.actions.first() else {
        return Err(ExportError::InvalidGodotPackage(
            "scene requires at least one action".to_owned(),
        ));
    };
    if manifest.actions.iter().any(|action| {
        action.frame_size_px != first.frame_size_px
            || action.ground_origin_px != first.ground_origin_px
    }) {
        return Err(ExportError::InvalidGodotPackage(
            "scene requires the common frame size and ground origin produced by normalized export"
                .to_owned(),
        ));
    }
    Ok((first.frame_size_px, first.ground_origin_px))
}

fn integration_guide(
    manifest: &ExportManifest,
    animations: &[GodotAnimation<'_>],
    options: GodotExportOptions,
) -> String {
    let mut output = format!(
        "# PixelCutoutSprite Godot package\n\n\
         This derived package targets the tested Godot {TESTED_GODOT_VERSION} contract. Keep \
         `sprite_frames.tres`, `animation.json`, and the referenced PNG sheets together; all \
         engine-resource links are relative so the package directory can be moved below `res://`.\n\n\
         Load `sprite_frames.tres` into an `AnimatedSprite2D` and select animations by \
         `action_direction`. The generic `animation.json` remains the authority for sources, \
         atlas rectangles, FPS, loop behavior, ground origin, root motion, and jump mode.\n\n"
    );
    if options.include_scene {
        output.push_str(
            "`character.tscn` is an optional convenience scene. Its node origin is the exported \
             ground point, texture filtering is Nearest, and it deliberately contains no script, \
             controls, collision, or skeleton.\n\n",
        );
    }
    output.push_str(
        "When an action has `jump_mode: baked`, do not apply the same vertical arc again in the \
         game. With `jump_mode: external`, the game supplies that height. Treat `root_motion_mode` \
         the same way for horizontal/world motion.\n\n## Animations\n\n",
    );
    for animation in animations {
        writeln!(
            output,
            "- `{}` — {} FPS, {}, jump `{:?}`, root motion `{:?}`",
            animation.name,
            animation.action.fps,
            if animation.action.loop_mode == LoopMode::Loop {
                "looping"
            } else {
                "one-shot"
            },
            animation.action.jump_mode,
            animation.action.root_motion_mode
        )
        .expect("writing to a string cannot fail");
    }
    output.push_str(&format!(
        "\nSource fingerprint: `{}`.\n",
        manifest.source_fingerprint.as_str()
    ));
    output
}

fn validate_package(
    stage: &Path,
    source: &Path,
    options: GodotExportOptions,
    expected: &HashSet<PathBuf>,
) -> Result<(), ExportError> {
    // Enumerate and reject links, devices, sockets, and FIFOs before opening any package file.
    let actual = collect_package_files(stage)?;
    if actual != *expected {
        return Err(ExportError::InvalidGodotPackage(
            "package contains an unexpected or missing file".to_owned(),
        ));
    }
    let source_manifest = validate_build(source)?;
    let package_manifest = validate_build(stage)?;
    if package_manifest.source_fingerprint != source_manifest.source_fingerprint {
        return Err(ExportError::InvalidGodotPackage(
            "existing package belongs to a different source fingerprint".to_owned(),
        ));
    }
    let source_json = fs::read(safe_existing_child(source, Path::new("animation.json"))?)
        .map_err(|error| ExportError::io("read generic manifest", source, error))?;
    let package_json = fs::read(safe_existing_child(stage, Path::new("animation.json"))?)
        .map_err(|error| ExportError::io("read packaged manifest", stage, error))?;
    if package_json != source_json {
        return Err(ExportError::InvalidGodotPackage(
            "package manifest differs from the validated generic build".to_owned(),
        ));
    }
    let animations = collect_animations(&source_manifest)?;
    let expected_sprite_frames = sprite_frames_text(&source_manifest, &animations)?;
    let sprite_frames_path = safe_existing_child(stage, Path::new("sprite_frames.tres"))?;
    let sprite_frames = fs::read_to_string(&sprite_frames_path).map_err(|error| {
        ExportError::io("read generated SpriteFrames", &sprite_frames_path, error)
    })?;
    if sprite_frames != expected_sprite_frames {
        return Err(ExportError::InvalidGodotPackage(
            "SpriteFrames resource differs from the deterministic package content".to_owned(),
        ));
    }
    validate_controlled_resource(&sprite_frames, source, "SpriteFrames")?;
    if options.include_scene {
        let expected_scene = character_scene_text(&source_manifest, &animations)?;
        let scene_path = safe_existing_child(stage, Path::new("character.tscn"))?;
        let scene = fs::read_to_string(&scene_path).map_err(|error| {
            ExportError::io("read generated character scene", &scene_path, error)
        })?;
        if scene != expected_scene {
            return Err(ExportError::InvalidGodotPackage(
                "character scene differs from the deterministic package content".to_owned(),
            ));
        }
        validate_controlled_resource(&scene, source, "character scene")?;
    }
    let guide_path = safe_existing_child(stage, Path::new("GODOT_IMPORT.md"))?;
    let guide = fs::read_to_string(&guide_path).map_err(|error| {
        ExportError::io("read generated Godot integration guide", &guide_path, error)
    })?;
    if guide != integration_guide(&source_manifest, &animations, options) {
        return Err(ExportError::InvalidGodotPackage(
            "integration guide differs from the deterministic package content".to_owned(),
        ));
    }
    Ok(())
}

fn ensure_not_cancelled(cancellation: &impl CancellationToken) -> Result<(), ExportError> {
    if cancellation.is_cancelled() {
        Err(ExportError::Cancelled)
    } else {
        Ok(())
    }
}

fn report_godot(
    progress: &mut impl ProgressReporter,
    completed: usize,
    total: usize,
    message: impl Into<String>,
) {
    progress.report(ExportProgress {
        stage: ExportStage::GodotPackaging,
        completed,
        total,
        message: message.into(),
    });
}

fn validate_controlled_resource(
    source: &str,
    generic_build: &Path,
    label: &str,
) -> Result<(), ExportError> {
    let forbidden = [
        "ImageTexture",
        "PackedByteArray",
        "script =",
        "uid://",
        "data =",
        "path=\"res://",
        "path=\"/",
        "path=\"\\\\",
    ];
    if forbidden.iter().any(|needle| source.contains(needle))
        || source.contains(generic_build.to_string_lossy().as_ref())
    {
        return Err(ExportError::InvalidGodotPackage(format!(
            "generated {label} contains a forbidden embedded image, script, or non-portable path"
        )));
    }
    Ok(())
}

fn collect_package_files(root: &Path) -> Result<HashSet<PathBuf>, ExportError> {
    let mut files = HashSet::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory)
            .map_err(|error| ExportError::io("inspect Godot package", &directory, error))?
        {
            let entry = entry.map_err(|error| {
                ExportError::io("inspect Godot package entry", &directory, error)
            })?;
            let path = entry.path();
            let kind = entry.file_type().map_err(|error| {
                ExportError::io("inspect Godot package entry type", &path, error)
            })?;
            if kind.is_symlink() {
                return Err(ExportError::InvalidGodotPackage(
                    "package must not contain symbolic links".to_owned(),
                ));
            }
            if kind.is_dir() {
                pending.push(path);
            } else if kind.is_file() {
                files.insert(
                    path.strip_prefix(root)
                        .map_err(|_| {
                            ExportError::InvalidGodotPackage(
                                "package file escaped its root".to_owned(),
                            )
                        })?
                        .to_path_buf(),
                );
            } else {
                return Err(ExportError::InvalidGodotPackage(
                    "package entries must be regular files or directories".to_owned(),
                ));
            }
        }
    }
    Ok(files)
}

fn validate_godot_asset_path(path: &RelativePath) -> Result<(), ExportError> {
    let valid = path
        .as_str()
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'.'))
        && Path::new(path.as_str())
            .extension()
            .is_some_and(|extension| extension == "png");
    if valid {
        Ok(())
    } else {
        Err(ExportError::InvalidGodotPackage(format!(
            "asset path `{path}` is not portable to the controlled Godot text format"
        )))
    }
}

fn godot_quote(value: &str) -> Result<String, ExportError> {
    if value.chars().any(char::is_control) {
        return Err(ExportError::InvalidGodotPackage(
            "resource strings must not contain control characters".to_owned(),
        ));
    }
    Ok(format!(
        "\"{}\"",
        value.replace('\\', "\\\\").replace('"', "\\\"")
    ))
}

fn direction_name(direction: Direction) -> &'static str {
    match direction {
        Direction::N => "n",
        Direction::Ne => "ne",
        Direction::E => "e",
        Direction::Se => "se",
        Direction::S => "s",
        Direction::Sw => "sw",
        Direction::W => "w",
        Direction::Nw => "nw",
    }
}

struct PackageStage {
    path: PathBuf,
    armed: bool,
}

impl PackageStage {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for PackageStage {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn godot_strings_are_escaped_and_control_characters_are_rejected() {
        assert_eq!(
            godot_quote("quoted \\\"value").unwrap(),
            "\"quoted \\\\\\\"value\""
        );
        assert!(godot_quote("line\nbreak").is_err());
    }

    #[test]
    fn engine_asset_paths_use_the_controlled_portable_subset() {
        assert!(
            validate_godot_asset_path(&RelativePath::parse("atlas/sheet-0.png").unwrap()).is_ok()
        );
        assert!(
            validate_godot_asset_path(&RelativePath::parse("atlas/sheet ä.png").unwrap()).is_err()
        );
        assert!(
            validate_godot_asset_path(&RelativePath::parse("atlas/untrusted.gd").unwrap()).is_err()
        );
    }
}
