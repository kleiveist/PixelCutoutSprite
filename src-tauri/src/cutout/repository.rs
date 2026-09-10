use std::collections::BTreeMap;
use std::io::Cursor;
use std::path::Path;

use image::{DynamicImage, ImageFormat, RgbaImage};

use super::model::*;
use crate::storage::{StorageError, VaultRoot};
use crate::workspace::data_folder::{decode_image, image_format, read_bounded, technical};
use crate::workspace::{
    validate_workspace_relative, ManagedFileWrite, WorkspaceWriter, WriteExpectation,
};

pub fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, StorageError> {
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image.clone())
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|error| invalid(&format!("PNG kann nicht erstellt werden: {error}")))?;
    let bytes = bytes.into_inner();
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(invalid(
            "Das normalisierte PNG überschreitet die sichere Dateigrenze von 16 MiB.",
        ));
    }
    Ok(bytes)
}

pub fn original_image(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
) -> Result<RgbaImage, StorageError> {
    if technical(relative) || !valid_hash(expected) {
        return Err(invalid(
            "Nur ein geprüftes Originalbild im Vault kann geöffnet werden.",
        ));
    }
    let format =
        image_format(relative).ok_or_else(|| invalid("Erwartet wird PNG, JPEG oder WebP."))?;
    let bytes = read_bounded(root, relative, MAX_IMAGE_BYTES)?;
    if digest(&bytes) != expected {
        return Err(invalid("SOURCE_CHANGED: Das Originalbild wurde geändert. Bitte die Dateiauswahl aktualisieren; bestehende Masken bleiben erhalten."));
    }
    let image = decode_image(&bytes, format)?.to_rgba8();
    verify_original(root, relative, expected)?;
    Ok(image)
}

pub(crate) fn verify_original(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
) -> Result<(), StorageError> {
    if digest(&read_bounded(root, relative, MAX_IMAGE_BYTES)?) != expected {
        return Err(invalid(
            "SOURCE_CHANGED: Das Originalbild wurde während der Bearbeitung geändert.",
        ));
    }
    Ok(())
}

pub fn project_directory(relative: &str) -> Result<String, StorageError> {
    validate_workspace_relative(Path::new(relative))?;
    let segments: Vec<_> = relative.split('/').collect();
    if segments.last() != Some(&"cutout.project.json") || segments.len() < 2 {
        return Err(invalid("Ungültiger Cutout-Projektpfad."));
    }
    if segments[0] == ".PixelStudio" {
        if segments.len() != 5 || segments[..3] != [".PixelStudio", "recovery", "cutout"] {
            return Err(invalid("Ungültiger Cutout-Recovery-Projektpfad."));
        }
        crate::workspace::validate_portable_id(segments[3])?;
    } else if technical(relative) {
        return Err(invalid(
            "Schnittprojekte gehören in einen sichtbaren Teileordner.",
        ));
    }
    Ok(segments[..segments.len() - 1].join("/"))
}

pub fn open_source(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
    writable: bool,
) -> Result<LoadedCutout, StorageError> {
    crate::workspace::require_settled_file_sets(root)?;
    let image = original_image(root, relative, expected)?;
    let id = format!(
        "cutout-{}",
        &digest(format!("{relative}\n{expected}").as_bytes())[..32]
    );
    let directory = format!(".PixelStudio/recovery/cutout/{id}");
    let project_path = format!("{directory}/cutout.project.json");
    if let Some(loaded) = super::generation::follow_location(root, &directory, &id)? {
        verify_source_association(&loaded, relative, expected, &image)?;
        return Ok(loaded);
    }
    if root
        .resolve(Path::new(&project_path))?
        .as_path()
        .try_exists()
        .map_err(|e| StorageError::io("inspect cutout project", Path::new(&project_path), e))?
    {
        let loaded = load_project(root, &project_path)?;
        if loaded.project.id != id {
            return Err(StorageError::WriteConflict);
        }
        verify_source_association(&loaded, relative, expected, &image)?;
        return Ok(loaded);
    }
    let png = encode_png(&image)?;
    let now = timestamp();
    let project = CutoutProject {
        schema_version: 1,
        kind: "cutoutProject".to_owned(),
        id,
        revision: 1,
        source: SourceImage {
            original_path: Some(relative.to_owned()),
            original_sha256: Some(expected.to_owned()),
            snapshot_path: ".source/original.png".to_owned(),
            sha256: digest(&png),
            width: image.width(),
            height: image.height(),
        },
        active_part_id: "head".to_owned(),
        parts: catalog()
            .iter()
            .filter(|part| part.part_id != "sword")
            .map(|part| CutoutPart {
                part_id: part.part_id.clone(),
                status: if part.required {
                    PartStatus::Unmarked
                } else {
                    PartStatus::Disabled
                },
                mask_revision: 0,
                mask_path: None,
                mask_sha256: None,
                protected_overlap_mask_path: None,
                selection_parameters: BTreeMap::new(),
                reason: None,
            })
            .collect(),
        created_at: now.clone(),
        updated_at: now,
    };
    project.validate()?;
    let bytes = json_bytes(&project)?;
    if writable {
        verify_original(root, relative, expected)?;
        WorkspaceWriter::new(root.clone()).publish_file_set(&[
            managed(format!("{directory}/.source/original.png"), png, None),
            managed(project_path.clone(), bytes.clone(), None),
        ])?;
    }
    let masks = project
        .parts
        .iter()
        .map(|part| (part.part_id.clone(), Mask::default()))
        .collect();
    Ok(LoadedCutout {
        project_path,
        project,
        sha256: digest(&bytes),
        masks,
        persisted: writable,
    })
}

fn verify_source_association(
    loaded: &LoadedCutout,
    relative: &str,
    expected: &str,
    image: &RgbaImage,
) -> Result<(), StorageError> {
    let source = &loaded.project.source;
    // Opening the exact former source may still locate a detached project,
    // but must never silently reattach it or apply its masks to new pixels.
    let matches = if source.original_path.is_none() && source.original_sha256.is_none() {
        source.sha256 == digest(&encode_png(image)?)
    } else {
        source.original_path.as_deref() == Some(relative)
            && source.original_sha256.as_deref() == Some(expected)
    };
    if matches {
        Ok(())
    } else {
        Err(StorageError::WriteConflict)
    }
}

pub fn load_project(root: &VaultRoot, project_path: &str) -> Result<LoadedCutout, StorageError> {
    crate::workspace::require_settled_file_sets(root)?;
    let directory = project_directory(project_path)?;
    let bytes = read_bounded(root, project_path, 1024 * 1024)?;
    let project: CutoutProject = serde_json::from_slice(&bytes)
        .map_err(|e| invalid(&format!("Cutout-Projekt nicht lesbar: {e}")))?;
    project.validate()?;
    let pixels = project.source.width * project.source.height;
    let mut masks = BTreeMap::new();
    let mut run_count = 0;
    for part in &project.parts {
        let mask = if let Some(path) = &part.mask_path {
            let data = read_bounded(root, &format!("{directory}/{path}"), MAX_IMAGE_BYTES)?;
            if Some(digest(&data)) != part.mask_sha256 {
                return Err(invalid(
                    "MASK_CHANGED: Eine gespeicherte Maske wurde verändert oder ist unvollständig.",
                ));
            }
            serde_json::from_slice::<Mask>(&data)
                .map_err(|e| invalid(&format!("Maske nicht lesbar: {e}")))?
        } else {
            Mask::default()
        };
        mask.validate(pixels)?;
        run_count += [
            &mask.draft,
            &mask.confirmed,
            &mask.roi,
            &mask.positive,
            &mask.negative,
            &mask.protected,
        ]
        .iter()
        .map(|runs| runs.len())
        .sum::<usize>();
        if run_count > MAX_MASK_RUNS * 2 {
            return Err(invalid(
                "Das Projekt überschreitet das Masken-Speicherbudget von einer Million Läufen.",
            ));
        }
        if part.status == PartStatus::Confirmed && mask.confirmed.is_empty() {
            return Err(invalid("Eine bestätigte Maske darf nicht leer sein."));
        }
        masks.insert(part.part_id.clone(), mask);
    }
    let snapshot = read_bounded(
        root,
        &format!("{directory}/{}", project.source.snapshot_path),
        MAX_IMAGE_BYTES,
    )?;
    if digest(&snapshot) != project.source.sha256 {
        return Err(invalid(
            "SOURCE_CHANGED: Der Quell-Snapshot wurde verändert.",
        ));
    }
    let image = decode_image(&snapshot, ImageFormat::Png)?.to_rgba8();
    if image.dimensions() != (project.source.width, project.source.height) {
        return Err(invalid("Quellbildmaße und Projekt passen nicht zusammen."));
    }
    for part in &project.parts {
        if part.status == PartStatus::Confirmed
            && !visible_mask(&masks[&part.part_id].confirmed, &image)
        {
            return Err(invalid(
                "Bestätigte Maske enthält keinen sichtbaren Quellpixel.",
            ));
        }
    }
    if read_bounded(root, project_path, 1024 * 1024)? != bytes {
        return Err(StorageError::WriteConflict);
    }
    crate::workspace::require_settled_file_sets(root)?;
    Ok(LoadedCutout {
        project_path: project_path.to_owned(),
        project,
        sha256: digest(&bytes),
        masks,
        persisted: true,
    })
}

pub fn read_pixels(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
    project_path: Option<&str>,
) -> Result<Vec<u8>, StorageError> {
    if let Some(project_path) = project_path {
        let loaded = load_project(root, project_path)?;
        if loaded.project.source.sha256 != expected
            || relative != loaded.project.source.snapshot_path
        {
            return Err(StorageError::WriteConflict);
        }
        return Ok(snapshot_image(root, &loaded)?.into_raw());
    }
    Ok(original_image(root, relative, expected)?.into_raw())
}

pub fn snapshot_image(root: &VaultRoot, loaded: &LoadedCutout) -> Result<RgbaImage, StorageError> {
    let directory = project_directory(&loaded.project_path)?;
    let bytes = read_bounded(
        root,
        &format!("{directory}/{}", loaded.project.source.snapshot_path),
        MAX_IMAGE_BYTES,
    )?;
    if digest(&bytes) != loaded.project.source.sha256 {
        return Err(StorageError::WriteConflict);
    }
    Ok(decode_image(&bytes, ImageFormat::Png)?.to_rgba8())
}

pub fn save_project(
    root: &VaultRoot,
    request: SaveCutoutRequest,
) -> Result<LoadedCutout, StorageError> {
    validate_parts(
        request.parts.iter().map(|part| part.part_id.as_str()),
        &request.active_part_id,
    )?;
    let mut loaded = load_project(root, &request.project_path)?;
    if request.expected_revision != loaded.project.revision
        || request.expected_sha256 != loaded.sha256
    {
        return Err(StorageError::WriteConflict);
    }
    if request.detach_original {
        loaded.project.source.original_path = None;
        loaded.project.source.original_sha256 = None;
    }
    if let (Some(path), Some(hash)) = (
        &loaded.project.source.original_path,
        &loaded.project.source.original_sha256,
    ) {
        verify_original(root, path, hash)?;
    }
    let image = snapshot_image(root, &loaded)?;
    let directory = project_directory(&request.project_path)?;
    let mut writes = Vec::new();
    let mut parts = Vec::new();
    let mut masks = BTreeMap::new();
    let mut runs = 0;
    for edit in request.parts {
        validate_status(&edit.part_id, edit.status, edit.reason.as_deref())?;
        edit.mask.validate(image.width() * image.height())?;
        runs += [
            &edit.mask.draft,
            &edit.mask.confirmed,
            &edit.mask.roi,
            &edit.mask.positive,
            &edit.mask.negative,
            &edit.mask.protected,
        ]
        .iter()
        .map(|mask| mask.len())
        .sum::<usize>();
        if runs > MAX_MASK_RUNS * 2 {
            return Err(invalid(
                "Das Projekt überschreitet das Masken-Speicherbudget von einer Million Läufen.",
            ));
        }
        if edit.status == PartStatus::Confirmed
            && (!visible_mask(&edit.mask.confirmed, &image)
                || edit.mask.draft != edit.mask.confirmed)
        {
            return Err(invalid("Eine bestätigte Maske muss dem Entwurf entsprechen und sichtbare Quellpixel enthalten."));
        }
        let old = loaded
            .project
            .parts
            .iter()
            .find(|part| part.part_id == edit.part_id);
        let path = format!(".masks/{}.json", edit.part_id);
        let bytes = json_bytes(&edit.mask)?;
        let sha256 = digest(&bytes);
        if old.and_then(|part| part.mask_sha256.as_ref()) != Some(&sha256) {
            writes.push(managed(
                format!("{directory}/{path}"),
                bytes,
                old.and_then(|part| part.mask_sha256.clone()),
            ));
        }
        let revision = old.map_or(1, |part| {
            part.mask_revision + u64::from(part.mask_sha256.as_ref() != Some(&sha256))
        });
        let selection_parameters = if let Some(parameters) = edit.selection_parameters {
            parameters.validate()?;
            BTreeMap::from([
                (
                    "alphaThreshold".to_owned(),
                    serde_json::json!(parameters.alpha_threshold),
                ),
                (
                    "tolerance".to_owned(),
                    serde_json::json!(parameters.tolerance),
                ),
                (
                    "edgeWeight".to_owned(),
                    serde_json::json!(parameters.edge_weight),
                ),
            ])
        } else {
            old.map(|part| part.selection_parameters.clone())
                .unwrap_or_default()
        };
        parts.push(CutoutPart {
            part_id: edit.part_id.clone(),
            status: edit.status,
            mask_revision: revision,
            mask_path: Some(path.clone()),
            mask_sha256: Some(sha256),
            protected_overlap_mask_path: (!edit.mask.protected.is_empty()).then_some(path),
            selection_parameters,
            reason: edit.reason,
        });
        masks.insert(edit.part_id, edit.mask);
    }
    let deletes: Vec<_> = loaded
        .project
        .parts
        .iter()
        .filter(|old| !parts.iter().any(|part| part.part_id == old.part_id))
        .filter_map(|old| old.mask_path.as_ref().zip(old.mask_sha256.as_ref()))
        .map(|(path, hash)| crate::workspace::ManagedFileDelete {
            relative_path: format!("{directory}/{path}").into(),
            expected_sha256: hash.clone(),
        })
        .collect();
    loaded.project.parts = parts;
    loaded.project.active_part_id = request.active_part_id;
    loaded.project.revision += 1;
    loaded.project.updated_at = timestamp();
    loaded.project.validate()?;
    let bytes = json_bytes(&loaded.project)?;
    writes.push(ManagedFileWrite {
        relative_path: request.project_path.into(),
        bytes: bytes.clone(),
        expectation: WriteExpectation {
            expected_revision: Some(request.expected_revision),
            expected_sha256: Some(request.expected_sha256),
            create_only: false,
        },
    });
    WorkspaceWriter::new(root.clone()).publish_file_changes(&writes, &deletes)?;
    loaded.sha256 = digest(&bytes);
    loaded.masks = masks;
    Ok(loaded)
}

pub fn visible_mask(runs: &Runs, image: &RgbaImage) -> bool {
    runs.iter().any(|&[start, length]| {
        (start..start + length).any(|index| image.as_raw()[index as usize * 4 + 3] > 0)
    })
}
pub fn managed(path: String, bytes: Vec<u8>, before: Option<String>) -> ManagedFileWrite {
    ManagedFileWrite {
        relative_path: path.into(),
        bytes,
        expectation: WriteExpectation {
            create_only: before.is_none(),
            expected_sha256: before,
            expected_revision: None,
        },
    }
}
pub fn json_bytes(value: &impl serde::Serialize) -> Result<Vec<u8>, StorageError> {
    serde_json::to_vec(value).map_err(|e| invalid(&e.to_string()))
}
