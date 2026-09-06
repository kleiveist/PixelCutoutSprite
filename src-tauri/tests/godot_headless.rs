mod support;

use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use pixel_cutout_sprite_studio_lib::application::ExampleVaultService;
use pixel_cutout_sprite_studio_lib::domain::{
    EffectiveSourceKind, LoopMode, PixelPoint, PixelSize,
};
use pixel_cutout_sprite_studio_lib::exports::{
    motion_semantic_sha256, ExportService, GodotExportOptions, GodotExporter, NeverCancel,
    TESTED_GODOT_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::VaultRoot;
use tempfile::tempdir_in;

use support::{request, FixtureSource, OUTPUT_DIRECTORY};

#[test]
#[ignore = "requires the explicitly tested Godot 4.7.2 editor binary"]
fn godot_4_7_2_imports_and_loads_the_package_before_and_after_relocation() {
    // Keep the disposable fixture below the checkout so a host runner launched from a sandbox
    // sees exactly the same path (sandbox-private `/tmp` is intentionally not assumed shared).
    let temporary = tempdir_in(env::current_dir().unwrap()).unwrap();
    let godot = GodotRunner::from_environment(temporary.path());
    assert_tested_version(&godot);
    let project = temporary.path().join("fresh Godot project ü");
    fs::create_dir(&project).unwrap();
    write_test_project(&project);

    let example_vault = temporary.path().join("Lichterhain production vault");
    let example = ExampleVaultService::generate(&example_vault).unwrap();
    let mira = example.npcs.iter().find(|npc| npc.name == "Mira").unwrap();
    let example_package = example_vault.join(&mira.godot_package);
    let example_manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(example_package.join("animation.json")).unwrap()).unwrap();
    assert_eq!(example_manifest["actions"].as_array().unwrap().len(), 3);
    assert_eq!(example_manifest["frames"].as_array().unwrap().len(), 256);
    copy_directory(
        &example_package,
        &project.join("vollständiger Produktionspfad/Mira ü"),
    );

    let generic_build = create_generic_build(temporary.path());
    let standalone_root = temporary.path().join("standalone package output ä");
    fs::create_dir(&standalone_root).unwrap();
    let exporter = GodotExporter::new(VaultRoot::open(&standalone_root).unwrap());
    exporter
        .export(
            &generic_build,
            Path::new("merchant"),
            GodotExportOptions::default(),
        )
        .unwrap();
    exporter
        .export(
            &generic_build,
            Path::new("merchant-resources"),
            GodotExportOptions {
                include_scene: false,
            },
        )
        .unwrap();
    copy_directory(
        &standalone_root.join("merchant"),
        &project.join("erste Ablage/NPC Händler"),
    );
    copy_directory(
        &standalone_root.join("merchant-resources"),
        &project.join("ohne Szene/Ressourcen Händler"),
    );
    fs::remove_dir_all(temporary.path().join(OUTPUT_DIRECTORY)).unwrap();
    fs::remove_dir_all(&standalone_root).unwrap();
    fs::remove_dir_all(&example_vault).unwrap();
    assert!(
        !generic_build.exists(),
        "the generic vault build must be unavailable"
    );
    assert!(
        !example_package.exists(),
        "the production vault must be unavailable before import"
    );
    assert!(
        !project.join(".godot").exists(),
        "project must begin without an import cache"
    );

    import_and_verify(
        &godot,
        &project,
        "vollständiger Produktionspfad/Mira ü",
        true,
    );
    import_and_verify(&godot, &project, "erste Ablage/NPC Händler", true);
    import_and_verify(&godot, &project, "ohne Szene/Ressourcen Händler", false);
    let relocated = project.join("anderer Ordner/umbenannter Händler");
    fs::create_dir(relocated.parent().unwrap()).unwrap();
    fs::rename(project.join("erste Ablage/NPC Händler"), &relocated).unwrap();
    let relocated_example = project.join("anderer Ordner/Lichterhain Mira ü");
    fs::rename(
        project.join("vollständiger Produktionspfad/Mira ü"),
        &relocated_example,
    )
    .unwrap();
    clear_import_state(&project);
    assert!(
        !project.join(".godot").exists(),
        "relocation must be tested cache-free"
    );
    import_and_verify(&godot, &project, "anderer Ordner/umbenannter Händler", true);
    import_and_verify(&godot, &project, "anderer Ordner/Lichterhain Mira ü", true);
}

struct GodotRunner {
    launcher: Option<(OsString, Vec<OsString>)>,
    binary: OsString,
    home: PathBuf,
    xdg_config: PathBuf,
    xdg_cache: PathBuf,
    xdg_data: PathBuf,
}

impl GodotRunner {
    fn from_environment(root: &Path) -> Self {
        let environment = root.join("isolated engine environment");
        let home = environment.join("home");
        let xdg_config = environment.join("config");
        let xdg_cache = environment.join("cache");
        let xdg_data = environment.join("data");
        for directory in [&home, &xdg_config, &xdg_cache, &xdg_data] {
            fs::create_dir_all(directory).unwrap();
        }
        let launcher = env::var_os("PIXELCUTOUT_GODOT_RUNNER").map(|program| {
            let arguments = env::var_os("PIXELCUTOUT_GODOT_RUNNER_ARGS")
                .map(|arguments| {
                    arguments
                        .to_string_lossy()
                        .split_whitespace()
                        .map(OsString::from)
                        .collect()
                })
                .unwrap_or_default();
            (program, arguments)
        });
        Self {
            launcher,
            binary: env::var_os("PIXELCUTOUT_GODOT_BIN").unwrap_or_else(|| OsString::from("godot")),
            home,
            xdg_config,
            xdg_cache,
            xdg_data,
        }
    }

    fn command(&self) -> Command {
        let mut command = if let Some((launcher, arguments)) = &self.launcher {
            let mut command = Command::new(launcher);
            command.args(arguments);
            if Path::new(launcher)
                .file_name()
                .is_some_and(|name| name == "flatpak-spawn")
            {
                for (name, value) in self.environment() {
                    command.arg(format!("--env={name}={}", value.to_string_lossy()));
                }
            }
            command.arg(&self.binary);
            command
        } else {
            Command::new(&self.binary)
        };
        for (name, value) in self.environment() {
            command.env(name, value);
        }
        command
    }

    fn environment(&self) -> [(&'static str, &Path); 4] {
        [
            ("HOME", self.home.as_path()),
            ("XDG_CONFIG_HOME", self.xdg_config.as_path()),
            ("XDG_CACHE_HOME", self.xdg_cache.as_path()),
            ("XDG_DATA_HOME", self.xdg_data.as_path()),
        ]
    }
}

fn copy_directory(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_directory(&source_path, &destination_path);
        } else {
            assert!(entry.file_type().unwrap().is_file());
            fs::copy(source_path, destination_path).unwrap();
        }
    }
}

fn assert_tested_version(godot: &GodotRunner) {
    let output = godot.command().arg("--version").output().unwrap();
    assert_command_succeeded("query Godot version", &output);
    let version = String::from_utf8_lossy(&output.stdout);
    assert!(
        version.starts_with(&format!("{TESTED_GODOT_VERSION}.stable")),
        "expected Godot {TESTED_GODOT_VERSION}, got {version}"
    );
}

fn import_and_verify(godot: &GodotRunner, project: &Path, package: &str, expect_scene: bool) {
    let imported = godot
        .command()
        .arg("--headless")
        .arg("--path")
        .arg(project)
        .args(["--editor", "--recovery-mode", "--import"])
        .output()
        .unwrap();
    assert_command_succeeded("import fresh Godot project", &imported);
    assert!(project.join(".godot").is_dir());

    let verified = godot
        .command()
        .arg("--headless")
        .arg("--path")
        .arg(project)
        .args(["--script", "res://verify_package.gd", "--"])
        .arg(package)
        .arg(if expect_scene { "scene" } else { "resources" })
        .output()
        .unwrap();
    assert_command_succeeded("load generated Godot resources", &verified);
    assert!(String::from_utf8_lossy(&verified.stdout).contains("P17_GODOT_IMPORT_OK"));
}

fn assert_command_succeeded(operation: &str, output: &Output) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "{operation} failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        stderr
    );
    assert!(
        !stderr.contains("SCRIPT ERROR:") && !stderr.contains("ERROR:"),
        "{operation} emitted an engine error despite a successful exit:\n{stderr}"
    );
}

fn clear_import_state(project: &Path) {
    let cache = project.join(".godot");
    if cache.exists() {
        fs::remove_dir_all(cache).unwrap();
    }
    let mut pending = vec![project.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                pending.push(path);
            } else if path
                .extension()
                .is_some_and(|extension| extension == "import")
            {
                fs::remove_file(path).unwrap();
            }
        }
    }
}

fn create_generic_build(root: &Path) -> PathBuf {
    let service = ExportService::new(VaultRoot::open(root).unwrap(), "0.1.0");
    let mut export_request = request(&[
        ("walk", PixelSize(2, 2), PixelPoint(1, 1)),
        ("sprint", PixelSize(2, 2), PixelPoint(1, 1)),
    ]);
    let sprint = export_request
        .actions
        .iter_mut()
        .find(|action| action.action_key.as_str() == "sprint")
        .unwrap();
    sprint.motion.loop_mode = LoopMode::Once;
    let sprint_reference = sprint.motion.reference();
    let sprint_hash = motion_semantic_sha256(&sprint.motion).unwrap();
    export_request
        .effective_sources
        .iter_mut()
        .find(|source| {
            source.kind == EffectiveSourceKind::Motion && source.reference == sprint_reference
        })
        .unwrap()
        .content_sha256 = sprint_hash;
    let outcome = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &export_request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    root.join(OUTPUT_DIRECTORY).join(outcome.build.as_str())
}

fn write_test_project(project: &Path) {
    fs::write(
        project.join("project.godot"),
        r#"; Controlled P17 import fixture.
config_version=5

[application]
config/name="PixelCutoutSprite P17 Import"

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
"#,
    )
    .unwrap();
    fs::write(project.join("verify_package.gd"), VERIFY_SCRIPT).unwrap();
}

const VERIFY_SCRIPT: &str = r#"extends SceneTree

var failed := false

func require_value(condition: bool, message: String) -> bool:
    if condition:
        return true
    push_error(message)
    failed = true
    return false

func _init() -> void:
    var args := OS.get_cmdline_user_args()
    if not require_value(args.size() == 2, "expected package path and scene mode"):
        quit(1)
        return
    var package: String = args[0]
    var expect_scene: bool = args[1] == "scene"
    var root := "res://" + package
    var manifest_text := FileAccess.get_file_as_string(root + "/animation.json")
    var manifest = JSON.parse_string(manifest_text)
    if not require_value(manifest is Dictionary, "animation.json did not parse"):
        quit(1)
        return
    var sprite_frames = ResourceLoader.load(
        root + "/sprite_frames.tres",
        "SpriteFrames",
        ResourceLoader.CACHE_MODE_IGNORE_DEEP,
    )
    if not require_value(sprite_frames is SpriteFrames, "SpriteFrames did not load"):
        quit(1)
        return
    verify_animations(root, sprite_frames, manifest)
    if expect_scene:
        verify_scene(root, sprite_frames, manifest)
    else:
        require_value(
            not FileAccess.file_exists(root + "/character.tscn"),
            "resources-only package unexpectedly contains a scene",
        )
    if failed:
        quit(1)
        return
    print("P17_GODOT_IMPORT_OK:", package)
    quit(0)

func verify_animations(root: String, sprite_frames: SpriteFrames, manifest: Dictionary) -> void:
    var pages := {}
    for page in manifest["pages"]:
        pages[page["id"]] = page
    var expected_names: Array[String] = []
    var found_one_shot := false
    for action in manifest["actions"]:
        if action["loop_mode"] == "once":
            found_one_shot = true
        for direction in action["directions"]:
            var animation_name: String = action["action_key"] + "_" + direction
            expected_names.push_back(animation_name)
            verify_animation(root, sprite_frames, manifest, pages, action, direction, animation_name)
    expected_names.sort()
    var actual_names: Array[String] = []
    for animation_name in sprite_frames.get_animation_names():
        actual_names.push_back(String(animation_name))
    actual_names.sort()
    require_value(actual_names == expected_names, "animation names differ from the manifest")
    require_value(found_one_shot, "fixture must exercise a one-shot animation")

func verify_animation(
    root: String,
    sprite_frames: SpriteFrames,
    manifest: Dictionary,
    pages: Dictionary,
    action: Dictionary,
    direction: String,
    animation_name: String,
) -> void:
    var key := StringName(animation_name)
    if not require_value(sprite_frames.has_animation(key), "missing " + animation_name):
        return
    require_value(
        sprite_frames.get_frame_count(key) == int(action["frame_count"]),
        "wrong frame count for " + animation_name,
    )
    require_value(
        is_equal_approx(sprite_frames.get_animation_speed(key), float(action["fps"])),
        "wrong FPS for " + animation_name,
    )
    var expected_loop := 1 if action["loop_mode"] == "loop" else 0
    require_value(
        int(sprite_frames.get_animation_loop_mode(key)) == expected_loop,
        "wrong loop mode for " + animation_name,
    )
    for sample_index in range(int(action["frame_count"])):
        var frame: Dictionary = find_frame(manifest, action["action_key"], direction, sample_index)
        verify_frame(root, sprite_frames, pages, key, sample_index, frame)

func find_frame(manifest: Dictionary, action: String, direction: String, sample_index: int):
    for frame in manifest["frames"]:
        if (
            frame["action_key"] == action
            and frame["direction"] == direction
            and int(frame["sample_index"]) == sample_index
        ):
            return frame
    require_value(false, "missing generic frame " + action + "_" + direction)
    return {}

func verify_frame(
    root: String,
    sprite_frames: SpriteFrames,
    pages: Dictionary,
    animation: StringName,
    sample_index: int,
    frame: Dictionary,
) -> void:
    if frame.is_empty():
        return
    var texture = sprite_frames.get_frame_texture(animation, sample_index)
    if not require_value(texture is AtlasTexture, "frame is not an AtlasTexture"):
        return
    var rect: Array = frame["rect_px"]
    require_value(
        texture.region == Rect2(rect[0], rect[1], rect[2], rect[3]),
        "AtlasTexture rectangle differs from the manifest",
    )
    require_value(texture.filter_clip, "AtlasTexture filter clipping is disabled")
    var page: Dictionary = pages[frame["page_id"]]
    require_value(
        texture.atlas.resource_path == root.path_join(page["file"]),
        "atlas texture does not resolve to its package PNG",
    )
    require_value(not (texture.atlas is ImageTexture), "atlas PNG was embedded as ImageTexture")
    require_value(
        is_equal_approx(sprite_frames.get_frame_duration(animation, sample_index), 1.0),
        "frame duration differs from one manifest tick",
    )

func verify_scene(root: String, sprite_frames: SpriteFrames, manifest: Dictionary) -> void:
    var packed = ResourceLoader.load(
        root + "/character.tscn",
        "PackedScene",
        ResourceLoader.CACHE_MODE_IGNORE_DEEP,
    )
    if not require_value(packed is PackedScene, "character scene did not load"):
        return
    var instance = packed.instantiate()
    if not require_value(instance is Node2D, "scene root is not Node2D"):
        return
    require_value(instance.name == "PixelCutoutCharacter", "scene root name is not stable")
    require_value(instance.transform == Transform2D.IDENTITY, "scene root transform is not identity")
    require_value(instance.get_child_count() == 1, "scene must contain exactly one child")
    require_value(
        instance.get_meta("_pixel_cutout_manifest") == "animation.json",
        "scene manifest metadata is wrong",
    )
    var frame_size: Array = manifest["actions"][0]["frame_size_px"]
    require_value(
        instance.get_meta("_pixel_cutout_frame_size") == Vector2i(frame_size[0], frame_size[1]),
        "scene frame-size metadata is wrong",
    )
    verify_safe_tree(instance)
    var sprite = instance.get_node_or_null("AnimatedSprite2D")
    if not require_value(sprite is AnimatedSprite2D, "scene has no AnimatedSprite2D"):
        instance.free()
        return
    require_value(sprite.name == "AnimatedSprite2D", "sprite node name is not stable")
    require_value(sprite.transform == Transform2D.IDENTITY, "sprite transform is not identity")
    var ground: Array = manifest["actions"][0]["ground_origin_px"]
    require_value(not sprite.centered, "sprite must not center atlas regions")
    require_value(sprite.offset == Vector2(-ground[0], -ground[1]), "ground offset is wrong")
    require_value(sprite.texture_filter == CanvasItem.TEXTURE_FILTER_NEAREST, "filter is not Nearest")
    require_value(
        sprite.sprite_frames.resource_path == root + "/sprite_frames.tres",
        "scene uses a different SpriteFrames resource",
    )
    require_value(not sprite.is_playing(), "scene must not force animation playback")
    require_value(sprite.autoplay.is_empty(), "scene must not define autoplay")
    var first_action: Dictionary = manifest["actions"][0]
    var expected_initial := StringName(
        first_action["action_key"] + "_" + first_action["directions"][0]
    )
    require_value(sprite.animation == expected_initial, "initial animation is not deterministic")
    instance.free()

func verify_safe_tree(node: Node) -> void:
    require_value(node.get_script() == null, "generated scene contains a script")
    require_value(not (node is CollisionObject2D), "generated scene contains collision")
    require_value(not (node is CollisionShape2D), "generated scene contains a collision shape")
    require_value(not (node is Bone2D), "generated scene contains a bone")
    require_value(not (node is MeshInstance2D), "generated scene contains a mesh")
    require_value(not (node is Polygon2D), "generated scene contains a polygon rig")
    require_value(not (node is Skeleton2D), "generated scene contains a skeleton")
    for child in node.get_children():
        verify_safe_tree(child)
"#;
