use super::*;
use crate::{
    cutout::{digest, invalid, json_bytes, managed, timestamp},
    storage::{StorageError, VaultRoot},
    workspace::{
        data_folder::{
            manifest::{self, Manifest},
            read_bounded,
        },
        ManagedFileWrite, WorkspaceWriter, WriteExpectation,
    },
};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

/// Versioned geometry receipt, stored beside the scene in the vault. It is not
/// another active manifest and never determines which PNGs are loaded.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SceneBasis {
    schema_version: u32,
    kind: String,
    revision: u64,
    scene_id: String,
    scene_sha256: String,
    set_id: String,
    generation_id: String,
    document_sha256: String,
    manifest: Option<Manifest>,
    assets: Vec<SpriteAsset>,
}

impl SceneBasis {
    pub(super) fn belongs_to(&self, scene: &SpriteScene) -> bool {
        self.scene_id == scene.id && self.set_id == scene.set_id
    }
    pub(super) fn document_changed(&self, scene_hash: &str, document_hash: &str) -> bool {
        self.scene_sha256 == scene_hash && self.document_sha256 != document_hash
    }
}

pub(super) fn read_basis(
    root: &VaultRoot,
    directory: &str,
) -> Result<(Option<SceneBasis>, Option<String>), StorageError> {
    let relative = format!("{directory}/.scene/basis.json");
    match fs::symlink_metadata(root.resolve(Path::new(&relative))?.as_path()) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok((None, None)),
        Err(error) => {
            return Err(StorageError::io(
                "inspect scene basis",
                Path::new(&relative),
                error,
            ))
        }
        Ok(_) => (),
    }
    let bytes = read_bounded(root, &relative, 1024 * 1024)?;
    let basis: SceneBasis = serde_json::from_slice(&bytes)
        .map_err(|error| invalid(&format!("Ungültiger Szenen-Geometriebeleg: {error}")))?;
    if basis.schema_version != 1
        || basis.kind != "spriteSceneBasis"
        || basis.revision == 0
        || basis.revision > 9_007_199_254_740_991
    {
        return Err(invalid(
            "Unbekannter Szenen-Geometriebeleg; Datei bleibt erhalten.",
        ));
    }
    for id in [&basis.scene_id, &basis.set_id, &basis.generation_id] {
        crate::workspace::validate_portable_id(id)?;
    }
    for hash in [&basis.scene_sha256, &basis.document_sha256] {
        if hash.len() != 64
            || !hash
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(invalid("Ungültiger Beleg-Hash."));
        }
    }
    let defaults = defaults(
        directory,
        &basis.document_sha256,
        basis.manifest.as_ref(),
        &basis.assets,
    );
    defaults.validate()?;
    if defaults.set_id != basis.set_id
        || defaults.generation_id != basis.generation_id
        || basis.assets.iter().any(|asset| {
            !crate::cutout::catalog()
                .iter()
                .any(|part| part.part_id == asset.part_id && part.file == asset.file)
                || asset.width == 0
                || asset.height == 0
                || asset.width > 8192
                || asset.height > 8192
                || u64::from(asset.width) * u64::from(asset.height) > 16 * 1024 * 1024
        })
    {
        return Err(invalid("Ungültige Geometriebeziehungen."));
    }
    if let Some(manifest) = &basis.manifest {
        manifest::validate_manifest(manifest)?;
        if manifest.parts.len() != basis.assets.len()
            || manifest.parts.iter().any(|part| {
                !basis.assets.iter().any(|asset| {
                    asset.part_id == part.part_id
                        && asset.file == part.file
                        && asset.sha256 == part.sha256
                        && asset.width == part.source_rect.width
                        && asset.height == part.source_rect.height
                })
            })
        {
            return Err(invalid("Geometriebeleg und Teilgrößen widersprechen sich."));
        }
    }
    Ok((Some(basis), Some(digest(&bytes))))
}

pub(super) fn reconcile(
    saved: &SpriteScene,
    saved_hash: &str,
    basis: Option<&SceneBasis>,
    defaults: &SpriteScene,
    manifest: Option<&Manifest>,
    assets: &[SpriteAsset],
) -> Result<(SpriteScene, SpriteReconciliation), StorageError> {
    if basis.is_some_and(|basis| basis.scene_id != saved.id || basis.set_id != saved.set_id) {
        return Err(invalid("Geometriebeleg gehört zu einer anderen Szene."));
    }
    let basis = basis.filter(|basis| {
        basis.scene_sha256 == saved_hash && basis.generation_id == saved.generation_id
    });
    let previous = basis.and_then(|basis| basis.manifest.as_ref());
    let same_source = previous.zip(manifest).is_some_and(|(old, new)| {
        old.source.sha256 == new.source.sha256
            && old.source.width == new.source.width
            && old.source.height == new.source.height
    });
    let mut change = SpriteReconciliation {
        previous_generation_id: saved.generation_id.clone(),
        added_parts: Vec::new(),
        removed_parts: saved
            .layers
            .iter()
            .filter(|layer| !assets.iter().any(|asset| asset.part_id == layer.part_id))
            .map(|layer| layer.part_id.clone())
            .collect(),
        geometry_changed_parts: Vec::new(),
        source_changed: previous.zip(manifest).is_some() && !same_source,
        geometry_unknown: basis.is_none(),
    };
    let mut scene = saved.clone();
    scene.generation_id = defaults.generation_id.clone();
    scene.layers = defaults
        .layers
        .iter()
        .map(|default| {
            let Some(old) = saved
                .layers
                .iter()
                .find(|layer| layer.part_id == default.part_id)
            else {
                change.added_parts.push(default.part_id.clone());
                return default.clone();
            };
            let mut layer = old.clone();
            let old_part = previous.and_then(|manifest| {
                manifest
                    .parts
                    .iter()
                    .find(|part| part.part_id == layer.part_id)
            });
            let new_part = manifest.and_then(|manifest| {
                manifest
                    .parts
                    .iter()
                    .find(|part| part.part_id == layer.part_id)
            });
            if let Some((old_part, new_part)) = old_part.zip(new_part) {
                if old_part.source_rect != new_part.source_rect
                    || old_part.pivot != new_part.pivot
                    || !same_source
                {
                    change.geometry_changed_parts.push(layer.part_id.clone());
                }
                if same_source {
                    // Preserve the world location of the same source pixel, even
                    // with rotation/scaling and a crop origin changed by padding.
                    layer.pivot.x +=
                        f64::from(old_part.source_rect.x) - f64::from(new_part.source_rect.x);
                    layer.pivot.y +=
                        f64::from(old_part.source_rect.y) - f64::from(new_part.source_rect.y);
                }
            } else {
                let old_asset = basis.and_then(|basis| {
                    basis
                        .assets
                        .iter()
                        .find(|asset| asset.part_id == layer.part_id)
                });
                let new_asset = assets.iter().find(|asset| asset.part_id == layer.part_id);
                if old_asset
                    .zip(new_asset)
                    .is_none_or(|(old, new)| old.width != new.width || old.height != new.height)
                {
                    change.geometry_changed_parts.push(layer.part_id.clone());
                }
            }
            layer
        })
        .collect();
    scene.validate()?;
    Ok((scene, change))
}

pub fn save_scene(
    root: &VaultRoot,
    request: SaveSpriteRequest,
) -> Result<LoadedSprite, StorageError> {
    save_with_writer(root, request, &WorkspaceWriter::new(root.clone()))
}
pub(super) fn save_with_writer<F: crate::workspace::WorkspaceFault>(
    root: &VaultRoot,
    request: SaveSpriteRequest,
    writer: &WorkspaceWriter<F>,
) -> Result<LoadedSprite, StorageError> {
    request.scene.validate()?;
    let current = load(
        root,
        &request.directory,
        request.source_kind,
        &request.expected_document_sha256,
    )?;
    if current.scene_sha256 != request.expected_scene_sha256
        || current.basis_sha256 != request.expected_basis_sha256
        || request.expected_revision
            != current
                .scene_sha256
                .as_ref()
                .map(|_| current.scene.revision)
        || request.scene.revision != current.scene.revision
        || request.scene.id != current.scene.id
        || request.scene.set_id != current.scene.set_id
        || request.scene.generation_id != current.scene.generation_id
        || current.assets.len() != request.scene.layers.len()
        || request.scene.layers.iter().any(|layer| {
            !current
                .assets
                .iter()
                .any(|asset| asset.part_id == layer.part_id)
        })
    {
        return Err(StorageError::WriteConflict);
    }
    if current.reconciliation.is_some() && !request.accept_generation {
        return Err(invalid(
            "Die neue Teilegeneration muss ausdrücklich abgeglichen werden.",
        ));
    }
    let (previous_basis, basis_hash) = read_basis(root, &request.directory)?;
    if basis_hash != current.basis_sha256 {
        return Err(StorageError::WriteConflict);
    }
    if previous_basis
        .as_ref()
        .is_some_and(|basis| basis.revision >= 9_007_199_254_740_991)
    {
        return Err(invalid("Geometriebeleg-Revision ist ausgeschöpft."));
    }
    let mut scene = request.scene;
    scene.revision = request.expected_revision.map_or(1, |revision| revision + 1);
    scene.created_at = current.scene.created_at;
    scene.updated_at = timestamp();
    scene.validate()?;
    let bytes = json_bytes(&scene)?;
    let basis = SceneBasis {
        schema_version: 1,
        kind: "spriteSceneBasis".into(),
        revision: previous_basis.map_or(1, |basis| basis.revision + 1),
        scene_id: scene.id.clone(),
        scene_sha256: digest(&bytes),
        set_id: scene.set_id.clone(),
        generation_id: scene.generation_id.clone(),
        document_sha256: current.document_sha256.clone(),
        manifest: current.manifest,
        assets: current.assets,
    };
    let writes = [
        managed(
            format!("{}/.scene/basis.json", request.directory),
            json_bytes(&basis)?,
            current.basis_sha256,
        ),
        ManagedFileWrite {
            relative_path: format!("{}/sprite.scene.json", request.directory).into(),
            bytes,
            expectation: WriteExpectation {
                expected_revision: request.expected_revision,
                expected_sha256: current.scene_sha256,
                create_only: request.expected_revision.is_none(),
            },
        },
    ];
    writer.publish_file_set(&writes)?;
    let saved = load(
        root,
        &request.directory,
        request.source_kind,
        &request.expected_document_sha256,
    )?;
    if saved.scene_sha256.as_deref() != Some(&basis.scene_sha256) || saved.reconciliation.is_some()
    {
        return Err(StorageError::WriteConflict);
    }
    Ok(saved)
}
