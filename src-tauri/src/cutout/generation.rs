//! One canonical cutout context and an explicitly manifest-owned PNG generation.
use std::{collections::HashSet, fs, path::Path, sync::OnceLock};

use image::RgbaImage;
use serde::{Deserialize, Serialize};

use super::{model::*, repository::*};
use crate::storage::{StorageError, VaultRoot};
use crate::workspace::{
    data_folder::{
        manifest::{self, Manifest, Omitted, Part, Point, Rect, Source},
        read_bounded,
    },
    validate_workspace_relative, ManagedFileDelete, WorkspaceFault, WorkspaceWriter,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationTarget {
    pub directory: String,
    pub alternative: bool,
    pub existing: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerateRequest {
    pub project_path: String,
    pub expected_revision: u64,
    pub expected_sha256: String,
    pub directory: String,
    pub padding: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedCutout {
    pub loaded: LoadedCutout,
    pub directory: String,
    pub manifest_sha256: String,
    pub generation_id: String,
    pub complete: bool,
    pub part_count: usize,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Location {
    schema_version: u32,
    id: String,
    project_path: String,
    source_hash: String,
}

pub fn follow_location(
    root: &VaultRoot,
    recovery: &str,
    id: &str,
) -> Result<Option<LoadedCutout>, StorageError> {
    let path = format!("{recovery}/location.json");
    if !exists(root, &path)? {
        return Ok(None);
    }
    let bytes = read_bounded(root, &path, 4096)?;
    let location: Location = serde_json::from_slice(&bytes).map_err(|e| invalid(&e.to_string()))?;
    if location.schema_version != 1
        || location.id != id
        || location.project_path.starts_with(".PixelStudio/")
        || exists(root, &format!("{recovery}/cutout.project.json"))?
    {
        return Err(invalid(
            "Ungültiger oder konkurrierender Schnittprojekt-Verweis.",
        ));
    }
    let loaded = load_project(root, &location.project_path)?;
    if loaded.project.id != id || loaded.project.source.sha256 != location.source_hash {
        return Err(StorageError::WriteConflict);
    }
    if read_bounded(root, &path, 4096)? != bytes {
        return Err(StorageError::WriteConflict);
    }
    Ok(Some(loaded))
}

fn exists(root: &VaultRoot, path: &str) -> Result<bool, StorageError> {
    let resolved = root.resolve(Path::new(path))?;
    match fs::symlink_metadata(resolved.as_path()) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(StorageError::io(
            "inspect generation target",
            Path::new(path),
            e,
        )),
    }
}

fn available_directory(root: &VaultRoot, directory: &str) -> Result<bool, StorageError> {
    validate_workspace_relative(Path::new(directory))?;
    let path = root.resolve(Path::new(directory))?;
    let parent = path.as_path().parent().ok_or(StorageError::WriteConflict)?;
    let name = Path::new(directory)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(StorageError::WriteConflict)?;
    // Protect case aliases on all platforms, including case-sensitive Linux.
    for entry in fs::read_dir(parent)
        .map_err(|e| StorageError::io("inspect output siblings", Path::new(directory), e))?
    {
        let entry =
            entry.map_err(|e| StorageError::io("inspect output name", Path::new(directory), e))?;
        if entry.file_name().to_string_lossy().to_lowercase() == name.to_lowercase() {
            return Ok(false);
        }
    }
    Ok(true)
}

pub fn target(
    root: &VaultRoot,
    project_path: &str,
    expected_sha256: &str,
) -> Result<GenerationTarget, StorageError> {
    let loaded = load_project(root, project_path)?;
    if loaded.sha256 != expected_sha256 {
        return Err(StorageError::WriteConflict);
    }
    target_for(root, &loaded)
}

fn target_for(root: &VaultRoot, loaded: &LoadedCutout) -> Result<GenerationTarget, StorageError> {
    let directory = project_directory(&loaded.project_path)?;
    if !directory.starts_with(".PixelStudio/") {
        // Ownership is checked again against the full manifest before writing.
        return Ok(GenerationTarget {
            directory,
            alternative: false,
            existing: true,
        });
    }
    let original = loaded
        .project
        .source
        .original_path
        .as_deref()
        .unwrap_or(&loaded.project.id);
    let original = Path::new(original);
    let stem = original
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or(StorageError::WriteConflict)?;
    let parent = original.parent().unwrap_or(Path::new(""));
    let candidate = parent.join(stem).to_string_lossy().replace('\\', "/");
    if available_directory(root, &candidate)? {
        return Ok(GenerationTarget {
            directory: candidate,
            alternative: false,
            existing: false,
        });
    }
    let mut short = String::new();
    for ch in stem.chars() {
        if short.len() + ch.len_utf8() > 120 {
            break;
        }
        short.push(ch);
    }
    let suffix = &digest(loaded.project.id.as_bytes())[..8];
    for attempt in 0..100 {
        let name = if attempt == 0 {
            format!("{short}-cutout-{suffix}")
        } else {
            format!("{short}-cutout-{suffix}-{attempt}")
        };
        let candidate = parent.join(name).to_string_lossy().replace('\\', "/");
        if available_directory(root, &candidate)? {
            return Ok(GenerationTarget {
                directory: candidate,
                alternative: true,
                existing: false,
            });
        }
    }
    Err(invalid(
        "Kein freier Teileordner gefunden. Bitte vorhandene Namenskonflikte prüfen.",
    ))
}

fn ready(loaded: &LoadedCutout) -> Result<(), StorageError> {
    let mut confirmed = 0;
    for part in &loaded.project.parts {
        let definition = catalog()
            .iter()
            .find(|entry| entry.part_id == part.part_id)
            .ok_or(StorageError::WriteConflict)?;
        match part.status {
            PartStatus::Confirmed => confirmed += 1,
            PartStatus::NotPresent => {},
            PartStatus::Disabled | PartStatus::Unmarked if !definition.required => {},
            _ => return Err(invalid(&format!("Teil {} ist noch nicht bestätigt. Pflichtteile bestätigen oder mit Begründung als nicht vorhanden markieren; Extras bestätigen oder deaktivieren.", part.part_id))),
        }
    }
    if confirmed == 0 {
        return Err(invalid("Mindestens ein sichtbarer Teil muss bestätigt sein; leere Platzhalter werden nicht erzeugt."));
    }
    Ok(())
}

pub fn default_z(id: &str) -> i64 {
    static ORDER: OnceLock<Vec<String>> = OnceLock::new();
    ORDER
        .get_or_init(|| {
            serde_json::from_str(include_str!(
                "../../../frontend/src/shared/image/sprite-default-z.json"
            ))
            .expect("tested built-in draw order")
        })
        .iter()
        .position(|part| part == id)
        .expect("catalog part has a draw order") as i64
}

/// The bounding box uses half-open SOURCE pixel coordinates. Padding never
/// invents pixels beyond the source. Overlaps are deliberately independent.
pub(crate) fn crop(
    image: &RgbaImage,
    runs: &Runs,
    padding: u32,
) -> Result<(RgbaImage, Rect), StorageError> {
    if runs.is_empty() || !visible_mask(runs, image) {
        return Err(invalid("Bestätigte Maske ist leer oder unsichtbar."));
    }
    let (mut left, mut top, mut right, mut bottom) = (image.width(), image.height(), 0, 0);
    for &[start, length] in runs {
        for index in start..start + length {
            let (x, y) = (index % image.width(), index / image.width());
            left = left.min(x);
            top = top.min(y);
            right = right.max(x + 1);
            bottom = bottom.max(y + 1);
        }
    }
    left = left.saturating_sub(padding);
    top = top.saturating_sub(padding);
    right = right.saturating_add(padding).min(image.width());
    bottom = bottom.saturating_add(padding).min(image.height());
    let rect = Rect {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
    let mut output = RgbaImage::new(rect.width, rect.height);
    for &[start, length] in runs {
        for index in start..start + length {
            let (x, y) = (index % image.width(), index / image.width());
            output.put_pixel(x - left, y - top, *image.get_pixel(x, y));
        }
    }
    Ok((output, rect))
}

pub fn generate(
    root: &VaultRoot,
    request: GenerateRequest,
) -> Result<GeneratedCutout, StorageError> {
    generate_with_writer(root, request, &WorkspaceWriter::new(root.clone()))
}

pub(crate) fn generate_with_writer<F: WorkspaceFault>(
    root: &VaultRoot,
    request: GenerateRequest,
    writer: &WorkspaceWriter<F>,
) -> Result<GeneratedCutout, StorageError> {
    if request.padding > 64 {
        return Err(invalid(
            "Padding muss zwischen 0 und 64 Quellpixeln liegen.",
        ));
    }
    let loaded = load_project(root, &request.project_path)?;
    if loaded.sha256 != request.expected_sha256
        || loaded.project.revision != request.expected_revision
    {
        return Err(StorageError::WriteConflict);
    }
    ready(&loaded)?;
    let target = target_for(root, &loaded)?;
    if target.directory != request.directory {
        return Err(invalid(
            "Der Ausgabeordner hat sich geändert. Bitte Ziel erneut prüfen und bestätigen.",
        ));
    }
    let directory = target.directory;
    let manifest_path = format!("{directory}/sprite.parts.json");
    let old_manifest = if target.existing {
        manifest::read_set(root, &directory, &manifest_path)?;
        let bytes = read_bounded(root, &manifest_path, 1024 * 1024)?;
        let old: Manifest = serde_json::from_slice(&bytes).map_err(|e| invalid(&e.to_string()))?;
        manifest::validate_manifest(&old)?;
        if old.set_id != loaded.project.id
            || old.source.sha256 != loaded.project.source.sha256
            || old.source.width != loaded.project.source.width
            || old.source.height != loaded.project.source.height
        {
            return Err(invalid(
                "Dieser Teileordner gehört nicht zum geöffneten Schnittprojekt.",
            ));
        }
        Some((old, digest(&bytes)))
    } else {
        None
    };
    if let (Some(path), Some(hash)) = (
        &loaded.project.source.original_path,
        &loaded.project.source.original_sha256,
    ) {
        verify_original(root, path, hash)?;
    }
    let image = snapshot_image(root, &loaded)?;
    let mut parts = Vec::new();
    let mut writes = Vec::new();
    let mut deletes = Vec::new();
    let mut total_bytes = 0;
    let mut total_pixels = 0_u64;
    for entry in &loaded.project.parts {
        if entry.status != PartStatus::Confirmed {
            continue;
        }
        let definition = catalog()
            .iter()
            .find(|part| part.part_id == entry.part_id)
            .ok_or(StorageError::WriteConflict)?;
        let (image, rect) = crop(
            &image,
            &loaded.masks[&entry.part_id].confirmed,
            request.padding,
        )?;
        let png = encode_png(&image)?;
        total_bytes += png.len();
        total_pixels += u64::from(rect.width) * u64::from(rect.height);
        if total_bytes > 64 * 1024 * 1024 || total_pixels > 32 * 1024 * 1024 {
            return Err(invalid("Teile-Set überschreitet 64 MiB PNGs oder 32 Megapixel. Masken/Padding verkleinern."));
        }
        let pivot = Point {
            x: f64::from(rect.width / 2),
            y: f64::from(rect.height / 2),
        };
        let part = Part {
            part_id: entry.part_id.clone(),
            file: definition.file.clone(),
            sha256: digest(&png),
            default_position: Point {
                x: f64::from(rect.x) + pivot.x,
                y: f64::from(rect.y) + pivot.y,
            },
            pivot,
            source_rect: rect,
            default_z: default_z(&entry.part_id),
            parent_id: definition.parent_id.clone(),
        };
        let before = old_manifest
            .as_ref()
            .and_then(|(old, _)| old.parts.iter().find(|old| old.part_id == part.part_id))
            .map(|old| old.sha256.clone());
        writes.push(managed(format!("{directory}/{}", part.file), png, before));
        parts.push(part);
    }
    let included: HashSet<_> = parts.iter().map(|part| part.part_id.as_str()).collect();
    if let Some((old, _)) = &old_manifest {
        for part in &old.parts {
            if !included.contains(part.part_id.as_str()) {
                deletes.push(ManagedFileDelete {
                    relative_path: format!("{directory}/{}", part.file).into(),
                    expected_sha256: part.sha256.clone(),
                });
            }
        }
    }
    let old_directory = project_directory(&loaded.project_path)?;
    let moving = old_directory != directory;
    let mut project = loaded.project.clone();
    project.revision += 1;
    project.updated_at = timestamp();
    project.validate()?;
    let mut context_files = vec![(
        project.source.snapshot_path.clone(),
        read_bounded(
            root,
            &format!("{old_directory}/{}", project.source.snapshot_path),
            MAX_IMAGE_BYTES,
        )?,
        project.source.sha256.clone(),
    )];
    for part in &project.parts {
        if let Some((path, hash)) = part.mask_path.as_ref().zip(part.mask_sha256.as_ref()) {
            context_files.push((
                path.clone(),
                read_bounded(root, &format!("{old_directory}/{path}"), MAX_IMAGE_BYTES)?,
                hash.clone(),
            ));
        }
    }
    for (path, bytes, hash) in context_files {
        if digest(&bytes) != hash {
            return Err(StorageError::WriteConflict);
        }
        if moving {
            deletes.push(ManagedFileDelete {
                relative_path: format!("{old_directory}/{path}").into(),
                expected_sha256: hash.clone(),
            });
        }
        writes.push(managed(
            format!("{directory}/{path}"),
            bytes,
            (!moving).then_some(hash),
        ));
    }
    let canonical = format!("{directory}/cutout.project.json");
    if moving {
        deletes.push(ManagedFileDelete {
            relative_path: loaded.project_path.clone().into(),
            expected_sha256: loaded.sha256.clone(),
        });
        writes.push(managed(
            format!("{old_directory}/location.json"),
            json_bytes(&Location {
                schema_version: 1,
                id: project.id.clone(),
                project_path: canonical.clone(),
                source_hash: project.source.sha256.clone(),
            })?,
            None,
        ));
    }
    writes.push(managed(
        canonical.clone(),
        json_bytes(&project)?,
        (!moving).then_some(loaded.sha256.clone()),
    ));
    let omitted_parts: Vec<_> = project
        .parts
        .iter()
        .filter(|part| {
            part.status == PartStatus::NotPresent
                && catalog()
                    .iter()
                    .any(|definition| definition.part_id == part.part_id && definition.required)
        })
        .map(|part| Omitted {
            part_id: part.part_id.clone(),
            reason: part.reason.clone().unwrap_or_default(),
        })
        .collect();
    let source = &project.source;
    let manifest = Manifest {
        schema_version: 1,
        kind: "spriteParts".to_owned(),
        set_id: project.id.clone(),
        generation_id: format!("gen-{}", uuid::Uuid::new_v4()),
        cutout_revision: project.revision,
        source: Source {
            original_path: source.original_path.clone(),
            original_sha256: source.original_sha256.clone(),
            snapshot_path: source.snapshot_path.clone(),
            sha256: source.sha256.clone(),
            width: source.width,
            height: source.height,
        },
        complete: omitted_parts.is_empty(),
        parts,
        omitted_parts,
        created_at: timestamp(),
    };
    manifest::validate_manifest(&manifest)?;
    let manifest_bytes = json_bytes(&manifest)?;
    let manifest_sha256 = digest(&manifest_bytes);
    writes.push(managed(
        manifest_path.clone(),
        manifest_bytes,
        old_manifest.map(|(_, hash)| hash),
    ));
    // Check the source and project AGAIN after expensive encoding, immediately
    // before CAS preflight. Never touch sprite.scene.json or unknown siblings.
    if let (Some(path), Some(hash)) = (&source.original_path, &source.original_sha256) {
        verify_original(root, path, hash)?;
    }
    if digest(&read_bounded(root, &loaded.project_path, 1024 * 1024)?) != loaded.sha256 {
        return Err(StorageError::WriteConflict);
    }
    if !target.existing && !available_directory(root, &directory)? {
        return Err(StorageError::WriteConflict);
    }
    writer.publish_file_changes(&writes, &deletes)?;
    manifest::read_set(root, &directory, &manifest_path)?;
    let reopened = load_project(root, &canonical)?;
    if reopened.project != project {
        return Err(StorageError::WriteConflict);
    }
    Ok(GeneratedCutout {
        loaded: reopened,
        directory,
        manifest_sha256,
        generation_id: manifest.generation_id,
        complete: manifest.complete,
        part_count: manifest.parts.len(),
    })
}

pub fn open_set_project(
    root: &VaultRoot,
    directory: &str,
    expected_manifest_sha256: &str,
) -> Result<LoadedCutout, StorageError> {
    let path = format!("{directory}/sprite.parts.json");
    manifest::read_set(root, directory, &path)?;
    let bytes = read_bounded(root, &path, 1024 * 1024)?;
    if digest(&bytes) != expected_manifest_sha256 {
        return Err(StorageError::WriteConflict);
    }
    let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|e| invalid(&e.to_string()))?;
    let loaded = load_project(root, &format!("{directory}/cutout.project.json"))?;
    if loaded.project.id != manifest.set_id
        || loaded.project.source.sha256 != manifest.source.sha256
        || loaded.project.source.width != manifest.source.width
        || loaded.project.source.height != manifest.source.height
    {
        return Err(StorageError::WriteConflict);
    }
    Ok(loaded)
}
