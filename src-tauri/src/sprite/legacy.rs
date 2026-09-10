use super::SpriteAsset;
use crate::{
    cutout::{catalog, digest, invalid},
    storage::{StorageError, VaultRoot},
    workspace::{
        data_folder::{decode_image, read_bounded, technical, WorkspaceSelection, MAX_IMAGE_BYTES},
        require_settled_file_sets,
    },
};
use std::path::Path;

/// Exact known names only. No globbing, offsets, source size or fake manifest.
pub fn assets(root: &VaultRoot, directory: &str) -> Result<Vec<SpriteAsset>, StorageError> {
    require_settled_file_sets(root)?;
    crate::workspace::validate_workspace_relative(Path::new(directory))?;
    if technical(directory) {
        return Err(invalid("Technische Ordner sind keine Sprite-Teilesets."));
    }
    let mut assets = Vec::new();
    let mut total_bytes = 0;
    let mut total_pixels = 0_u64;
    for definition in catalog() {
        let relative = format!("{directory}/{}", definition.file);
        let resolved = root.resolve(Path::new(&relative))?;
        match std::fs::symlink_metadata(resolved.as_path()) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(StorageError::io(
                    "inspect legacy part",
                    Path::new(&relative),
                    error,
                ))
            }
            Ok(_) => {}
        }
        let bytes = read_bounded(root, &relative, MAX_IMAGE_BYTES)?;
        let image = decode_image(&bytes, image::ImageFormat::Png)?;
        total_bytes += bytes.len();
        total_pixels += u64::from(image.width()) * u64::from(image.height());
        if total_bytes > 64 * 1024 * 1024 || total_pixels > 32 * 1024 * 1024 {
            return Err(invalid("Legacy-Set überschreitet das Bildbudget."));
        }
        assets.push(SpriteAsset {
            part_id: definition.part_id.clone(),
            file: definition.file.clone(),
            sha256: digest(&bytes),
            width: image.width(),
            height: image.height(),
        });
    }
    if assets.len() > 18
        || (assets.iter().any(|part| part.part_id == "sword")
            && assets.iter().any(|part| part.part_id == "belt_accessory"))
    {
        return Err(invalid("Legacy-Zubehörslot enthält beide Varianten."));
    }
    for part in &assets {
        if digest(&read_bounded(
            root,
            &format!("{directory}/{}", part.file),
            MAX_IMAGE_BYTES,
        )?) != part.sha256
        {
            return Err(StorageError::WriteConflict);
        }
    }
    require_settled_file_sets(root)?;
    Ok(assets)
}
pub fn document_hash(assets: &[SpriteAsset]) -> Result<String, StorageError> {
    Ok(digest(
        &serde_json::to_vec(assets).map_err(|error| invalid(&error.to_string()))?,
    ))
}
pub fn inspect(
    root: &VaultRoot,
    directory: &str,
) -> Result<Option<WorkspaceSelection>, StorageError> {
    let assets = assets(root, directory)?;
    if assets.is_empty() {
        return Ok(None);
    }
    Ok(Some(WorkspaceSelection::LegacySet {
        relative_path: directory.to_owned(),
        document_sha256: document_hash(&assets)?,
        part_count: assets.len(),
    }))
}
