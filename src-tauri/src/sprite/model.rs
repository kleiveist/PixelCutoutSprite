use crate::{
    cutout::invalid,
    storage::StorageError,
    workspace::{
        data_folder::manifest::{Manifest, Point},
        validate_portable_id,
    },
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SpriteSourceKind {
    Manifest,
    Legacy,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpriteAsset {
    pub part_id: String,
    pub file: String,
    pub sha256: String,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpriteLayer {
    pub part_id: String,
    pub position: Point,
    pub pivot: Point,
    pub rotation_deg: f64,
    pub scale: Point,
    pub z_index: i64,
    pub visible: bool,
    pub locked: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpriteScene {
    pub schema_version: u32,
    pub kind: String,
    pub id: String,
    pub revision: u64,
    pub set_id: String,
    pub generation_id: String,
    pub blend_mode: String,
    pub pixel_snap: bool,
    pub layers: Vec<SpriteLayer>,
    pub created_at: String,
    pub updated_at: String,
}
impl SpriteScene {
    pub fn validate(&self) -> Result<(), StorageError> {
        if self.schema_version != 1
            || self.kind != "spriteScene"
            || self.blend_mode != "source-over"
            || self.revision == 0
            || self.revision > 9_007_199_254_740_991
            || !(1..=18).contains(&self.layers.len())
        {
            return Err(invalid("Unbekannte oder ungültige Sprite-Szene."));
        }
        for id in [&self.id, &self.set_id, &self.generation_id] {
            validate_portable_id(id)?;
        }
        for date in [&self.created_at, &self.updated_at] {
            chrono::DateTime::parse_from_rfc3339(date)
                .map_err(|_| invalid("Ungültiger Szenenzeitstempel."))?;
        }
        let mut ids = HashSet::new();
        for layer in &self.layers {
            if !ids.insert(layer.part_id.as_str())
                || !crate::cutout::catalog()
                    .iter()
                    .any(|part| part.part_id == layer.part_id)
                || ![
                    layer.position.x,
                    layer.position.y,
                    layer.pivot.x,
                    layer.pivot.y,
                    layer.rotation_deg,
                    layer.scale.x,
                    layer.scale.y,
                ]
                .iter()
                .all(|value| value.is_finite())
                || [
                    layer.position.x,
                    layer.position.y,
                    layer.pivot.x,
                    layer.pivot.y,
                ]
                .iter()
                .any(|value| value.abs() > 10_000_000.0)
                || layer.rotation_deg.abs() > 360_000.0
                || !(0.01..=100.0).contains(&layer.scale.x)
                || !(0.01..=100.0).contains(&layer.scale.y)
                || layer.z_index.unsigned_abs() > 9_007_199_254_740_991
            {
                return Err(invalid(
                    "Ungültige Szenenebene oder unbeschränkte Transformation.",
                ));
            }
        }
        if ids.contains("sword") && ids.contains("belt_accessory") {
            return Err(invalid("Zubehörslot ist doppelt belegt."));
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedSprite {
    pub directory: String,
    pub source_kind: SpriteSourceKind,
    pub document_sha256: String,
    pub manifest: Option<Manifest>,
    pub assets: Vec<SpriteAsset>,
    pub scene: SpriteScene,
    pub scene_sha256: Option<String>,
    pub basis_sha256: Option<String>,
    pub reconciliation: Option<SpriteReconciliation>,
    pub manual_alignment: bool,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpriteReconciliation {
    pub previous_generation_id: String,
    pub added_parts: Vec<String>,
    pub removed_parts: Vec<String>,
    pub geometry_changed_parts: Vec<String>,
    pub source_changed: bool,
    pub geometry_unknown: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveSpriteRequest {
    pub directory: String,
    pub source_kind: SpriteSourceKind,
    pub expected_document_sha256: String,
    pub expected_scene_sha256: Option<String>,
    pub expected_basis_sha256: Option<String>,
    pub expected_revision: Option<u64>,
    pub accept_generation: bool,
    pub scene: SpriteScene,
}
