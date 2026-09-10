use super::*;
use crate::{
    cutout::{digest, generation::default_z, invalid, timestamp},
    storage::{StorageError, VaultRoot},
    workspace::{
        data_folder::{
            decode_image,
            manifest::{self, Manifest, Point},
            read_bounded, technical, MAX_IMAGE_BYTES,
        },
        require_settled_file_sets, validate_workspace_relative,
    },
};
use image::ImageFormat;
use std::{fs, path::Path};

fn read_manifest(
    root: &VaultRoot,
    directory: &str,
    expected: &str,
) -> Result<Manifest, StorageError> {
    require_settled_file_sets(root)?;
    validate_workspace_relative(Path::new(directory))?;
    if technical(directory) {
        return Err(invalid("Technische Ordner sind keine Sprite-Teilesets."));
    }
    let bytes = read_bounded(root, &format!("{directory}/sprite.parts.json"), 1024 * 1024)?;
    if digest(&bytes) != expected {
        return Err(StorageError::WriteConflict);
    }
    let manifest: Manifest = serde_json::from_slice(&bytes)
        .map_err(|error| invalid(&format!("Ungültiges Teilemanifest: {error}")))?;
    manifest::validate_manifest(&manifest)?;
    Ok(manifest)
}

fn no_manifest(root: &VaultRoot, directory: &str) -> Result<(), StorageError> {
    match fs::symlink_metadata(
        root.resolve(Path::new(&format!("{directory}/sprite.parts.json")))?
            .as_path(),
    ) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StorageError::io(
            "inspect manifest",
            Path::new(directory),
            error,
        )),
        Ok(_) => Err(invalid(
            "Ein Manifest ist vorhanden; kein Ausweichen auf ungeprüfte Legacy-Dateien.",
        )),
    }
}

pub fn load(
    root: &VaultRoot,
    directory: &str,
    kind: SpriteSourceKind,
    expected: &str,
) -> Result<LoadedSprite, StorageError> {
    require_settled_file_sets(root)?;
    let (manifest, assets) = match kind {
        SpriteSourceKind::Manifest => {
            manifest::read_set(root, directory, &format!("{directory}/sprite.parts.json"))?;
            let manifest = read_manifest(root, directory, expected)?;
            let assets = manifest
                .parts
                .iter()
                .map(|part| SpriteAsset {
                    part_id: part.part_id.clone(),
                    file: part.file.clone(),
                    sha256: part.sha256.clone(),
                    width: part.source_rect.width,
                    height: part.source_rect.height,
                })
                .collect();
            (Some(manifest), assets)
        }
        SpriteSourceKind::Legacy => {
            no_manifest(root, directory)?;
            let assets = legacy::assets(root, directory)?;
            if assets.is_empty() || legacy::document_hash(&assets)? != expected {
                return Err(StorageError::WriteConflict);
            }
            (None, assets)
        }
    };
    let mut scene = defaults(directory, expected, manifest.as_ref(), &assets);
    let (basis, basis_sha256) = super::scene::read_basis(root, directory)?;
    let mut reconciliation = None;
    let scene_path = format!("{directory}/sprite.scene.json");
    let path = root.resolve(Path::new(&scene_path))?;
    let scene_sha256 = match fs::symlink_metadata(path.as_path()) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return Err(StorageError::io(
                "inspect sprite scene",
                Path::new(&scene_path),
                error,
            ))
        }
        Ok(_) => {
            let bytes = read_bounded(root, &scene_path, 1024 * 1024)?;
            let saved: SpriteScene = serde_json::from_slice(&bytes).map_err(|error| {
                invalid(&format!(
                    "Vorhandene Szene ist ungültig und bleibt unverändert: {error}"
                ))
            })?;
            saved.validate()?;
            if basis
                .as_ref()
                .is_some_and(|basis| !basis.belongs_to(&saved))
            {
                return Err(invalid(
                    "Geometriebeleg gehört zu einer anderen Szene; Datei bleibt unverändert.",
                ));
            }
            if saved.set_id != scene.set_id {
                return Err(invalid(
                    "Vorhandene Szene gehört zu einem anderen Teile-Set und bleibt unverändert.",
                ));
            }
            let changed_generation = saved.generation_id != scene.generation_id
                || basis
                    .as_ref()
                    .is_some_and(|basis| basis.document_changed(&digest(&bytes), expected));
            if !changed_generation
                && (saved.layers.len() != assets.len()
                    || saved
                        .layers
                        .iter()
                        .any(|layer| !assets.iter().any(|asset| asset.part_id == layer.part_id)))
            {
                return Err(invalid(
                    "Szenenebenen passen nicht zu den vorhandenen Teilen.",
                ));
            }
            if read_bounded(root, &scene_path, 1024 * 1024)? != bytes {
                return Err(StorageError::WriteConflict);
            }
            if changed_generation {
                let (candidate, change) = super::scene::reconcile(
                    &saved,
                    &digest(&bytes),
                    basis.as_ref(),
                    &scene,
                    manifest.as_ref(),
                    &assets,
                )?;
                scene = candidate;
                reconciliation = Some(change);
            } else {
                scene = saved;
            }
            Some(digest(&bytes))
        }
    };
    if basis.is_some() && scene_sha256.is_none() {
        return Err(invalid(
            "Ein Geometriebeleg ohne Szene bleibt unverändert; bitte Dateien wiederherstellen.",
        ));
    }
    scene.validate()?;
    let warnings = if let Some(manifest) = &manifest {
        manifest
            .omitted_parts
            .iter()
            .map(|part| format!("{} bewusst nicht vorhanden: {}", part.part_id, part.reason))
            .collect()
    } else {
        vec!["Legacy-Set ohne Positionsmetadaten: manuell ausrichten. Die überlagerten Startpositionen sind KEINE rekonstruierte Originalanordnung, auch nicht bei gleich großen PNGs.".into()]
    };
    match kind {
        SpriteSourceKind::Manifest => {
            read_manifest(root, directory, expected)?;
        }
        SpriteSourceKind::Legacy => no_manifest(root, directory)?,
    }
    require_settled_file_sets(root)?;
    Ok(LoadedSprite {
        directory: directory.into(),
        source_kind: kind,
        document_sha256: expected.into(),
        manual_alignment: manifest.is_none(),
        manifest,
        assets,
        scene,
        scene_sha256,
        basis_sha256,
        reconciliation,
        warnings,
    })
}

pub fn load_current(
    root: &VaultRoot,
    directory: &str,
    kind: SpriteSourceKind,
) -> Result<LoadedSprite, StorageError> {
    let hash = match kind {
        SpriteSourceKind::Manifest => digest(&read_bounded(
            root,
            &format!("{directory}/sprite.parts.json"),
            1024 * 1024,
        )?),
        SpriteSourceKind::Legacy => legacy::document_hash(&legacy::assets(root, directory)?)?,
    };
    load(root, directory, kind, &hash)
}

pub fn defaults(
    directory: &str,
    document_hash: &str,
    manifest: Option<&Manifest>,
    assets: &[SpriteAsset],
) -> SpriteScene {
    let (set_id, generation_id) = manifest
        .map(|manifest| (manifest.set_id.clone(), manifest.generation_id.clone()))
        .unwrap_or_else(|| {
            (
                format!("legacy-{}", &digest(directory.as_bytes())[..32]),
                format!("legacy-{}", &document_hash[..32]),
            )
        });
    let layers = assets
        .iter()
        .map(|asset| {
            let part = manifest.and_then(|manifest| {
                manifest
                    .parts
                    .iter()
                    .find(|part| part.part_id == asset.part_id)
            });
            let pivot = part.map(|part| part.pivot.clone()).unwrap_or(Point {
                x: f64::from(asset.width / 2),
                y: f64::from(asset.height / 2),
            });
            let position = part
                .map(|part| part.default_position.clone())
                .unwrap_or(pivot.clone());
            SpriteLayer {
                part_id: asset.part_id.clone(),
                position,
                pivot,
                rotation_deg: 0.0,
                scale: Point { x: 1.0, y: 1.0 },
                z_index: part
                    .map(|part| part.default_z)
                    .unwrap_or_else(|| default_z(&asset.part_id)),
                visible: true,
                locked: false,
            }
        })
        .collect();
    let now = timestamp();
    SpriteScene {
        schema_version: 1,
        kind: "spriteScene".into(),
        id: format!("scene-{}", &digest(set_id.as_bytes())[..32]),
        revision: 1,
        set_id,
        generation_id,
        blend_mode: "source-over".into(),
        pixel_snap: true,
        layers,
        created_at: now.clone(),
        updated_at: now,
    }
}

pub fn pixels(
    root: &VaultRoot,
    directory: &str,
    kind: SpriteSourceKind,
    expected: &str,
    part_id: &str,
) -> Result<Vec<u8>, StorageError> {
    let asset = match kind {
        SpriteSourceKind::Manifest => {
            let manifest = read_manifest(root, directory, expected)?;
            let part = manifest
                .parts
                .into_iter()
                .find(|part| part.part_id == part_id)
                .ok_or_else(|| invalid("Teil steht nicht im Manifest."))?;
            SpriteAsset {
                part_id: part.part_id,
                file: part.file,
                sha256: part.sha256,
                width: part.source_rect.width,
                height: part.source_rect.height,
            }
        }
        SpriteSourceKind::Legacy => {
            no_manifest(root, directory)?;
            let assets = legacy::assets(root, directory)?;
            if legacy::document_hash(&assets)? != expected {
                return Err(StorageError::WriteConflict);
            }
            assets
                .into_iter()
                .find(|asset| asset.part_id == part_id)
                .ok_or_else(|| invalid("Unbekannter Legacy-Teil."))?
        }
    };
    let path = format!("{directory}/{}", asset.file);
    let bytes = read_bounded(root, &path, MAX_IMAGE_BYTES)?;
    if digest(&bytes) != asset.sha256 {
        return Err(StorageError::WriteConflict);
    }
    let image = decode_image(&bytes, ImageFormat::Png)?.to_rgba8();
    if image.dimensions() != (asset.width, asset.height) {
        return Err(invalid("PNG-Größe passt nicht zum Teilemanifest."));
    }
    if digest(&read_bounded(root, &path, MAX_IMAGE_BYTES)?) != asset.sha256 {
        return Err(StorageError::WriteConflict);
    }
    match kind {
        SpriteSourceKind::Manifest => {
            read_manifest(root, directory, expected)?;
        }
        SpriteSourceKind::Legacy => no_manifest(root, directory)?,
    }
    require_settled_file_sets(root)?;
    Ok(image.into_raw())
}
