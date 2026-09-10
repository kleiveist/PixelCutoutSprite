use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::storage::StorageError;
use crate::workspace::{validate_portable_id, validate_workspace_relative};

pub type Runs = Vec<[u32; 2]>;
pub const MAX_PIXELS: u64 = 16 * 1024 * 1024;
pub const MAX_MASK_RUNS: usize = 500_000;
pub const MAX_IMAGE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPart {
    pub part_id: String,
    pub file: String,
    pub required: bool,
    pub parent_id: Option<String>,
}
pub fn catalog() -> &'static [CatalogPart] {
    static CATALOG: OnceLock<Vec<CatalogPart>> = OnceLock::new();
    CATALOG.get_or_init(|| {
        #[derive(Deserialize)]
        struct Catalog {
            parts: Vec<CatalogPart>,
        }
        serde_json::from_str::<Catalog>(include_str!(
            "../../../frontend/src/shared/image/sprite-parts.catalog.json"
        ))
        .expect("the built-in, tested sprite catalog is valid")
        .parts
    })
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceImage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_sha256: Option<String>,
    pub snapshot_path: String,
    pub sha256: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Mask {
    pub schema_version: u32,
    pub kind: String,
    pub draft: Runs,
    pub confirmed: Runs,
    pub roi: Runs,
    pub positive: Runs,
    pub negative: Runs,
    pub protected: Runs,
}
impl Default for Mask {
    fn default() -> Self {
        Self {
            schema_version: 1,
            kind: "cutoutMask".to_owned(),
            draft: vec![],
            confirmed: vec![],
            roi: vec![],
            positive: vec![],
            negative: vec![],
            protected: vec![],
        }
    }
}
impl Mask {
    pub fn validate(&self, pixels: u32) -> Result<(), StorageError> {
        if self.schema_version != 1 || self.kind != "cutoutMask" {
            return Err(invalid("Unbekannte Maskenversion."));
        }
        let channels = [
            &self.draft,
            &self.confirmed,
            &self.roi,
            &self.positive,
            &self.negative,
            &self.protected,
        ];
        if channels.iter().map(|runs| runs.len()).sum::<usize>() > MAX_MASK_RUNS {
            return Err(invalid("Maske überschreitet das Limit von 500.000 Läufen."));
        }
        for runs in channels {
            let mut end = None;
            for &[start, length] in runs {
                let next = start
                    .checked_add(length)
                    .ok_or_else(|| invalid("Maskenbereich übergelaufen."))?;
                if length == 0 || next > pixels || end.is_some_and(|end| start <= end) {
                    return Err(invalid(
                        "Maskenläufe müssen sortiert, getrennt und innerhalb des Quellbildes sein.",
                    ));
                }
                end = Some(next);
            }
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PartStatus {
    Unmarked,
    Editing,
    Confirmed,
    NotPresent,
    Disabled,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CutoutPart {
    pub part_id: String,
    pub status: PartStatus,
    pub mask_revision: u64,
    pub mask_path: Option<String>,
    pub mask_sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protected_overlap_mask_path: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub selection_parameters: BTreeMap<String, serde_json::Value>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CutoutProject {
    pub schema_version: u32,
    pub kind: String,
    pub id: String,
    pub revision: u64,
    pub source: SourceImage,
    pub active_part_id: String,
    pub parts: Vec<CutoutPart>,
    pub created_at: String,
    pub updated_at: String,
}
impl CutoutProject {
    pub fn validate(&self) -> Result<(), StorageError> {
        if self.schema_version != 1
            || self.kind != "cutoutProject"
            || self.revision == 0
            || self.revision > 9_007_199_254_740_991
        {
            return Err(invalid("Unbekannte oder ungültige Cutout-Projektversion."));
        }
        validate_portable_id(&self.id)?;
        for timestamp in [&self.created_at, &self.updated_at] {
            chrono::DateTime::parse_from_rfc3339(timestamp)
                .map_err(|_| invalid("Ungültiger Projektzeitstempel."))?;
        }
        let source = &self.source;
        if source.width == 0
            || source.height == 0
            || source.width > 8192
            || source.height > 8192
            || u64::from(source.width) * u64::from(source.height) > MAX_PIXELS
            || source.snapshot_path != ".source/original.png"
            || !valid_hash(&source.sha256)
        {
            return Err(invalid("Ungültiger Quellbildvertrag."));
        }
        if let Some(path) = &source.original_path {
            validate_workspace_relative(std::path::Path::new(path))?;
        }
        if source.original_path.is_some() != source.original_sha256.is_some()
            || source
                .original_sha256
                .as_ref()
                .is_some_and(|hash| !valid_hash(hash))
        {
            return Err(invalid(
                "Quellpfad und ursprünglicher Hash müssen zusammen vorliegen.",
            ));
        }
        validate_parts(
            self.parts.iter().map(|part| part.part_id.as_str()),
            &self.active_part_id,
        )?;
        for part in &self.parts {
            validate_status(&part.part_id, part.status, part.reason.as_deref())?;
            let expected_path = format!(".masks/{}.json", part.part_id);
            if part
                .mask_path
                .as_ref()
                .is_some_and(|path| path != &expected_path)
                || part.mask_path.is_some() != part.mask_sha256.is_some()
                || part
                    .mask_sha256
                    .as_ref()
                    .is_some_and(|hash| !valid_hash(hash))
                || part
                    .protected_overlap_mask_path
                    .as_ref()
                    .is_some_and(|path| path != &expected_path)
                || part.mask_revision > 9_007_199_254_740_991
                || (part.status == PartStatus::Confirmed && part.mask_path.is_none())
            {
                return Err(invalid("Ungültiger Maskenpfad, Status oder Hash."));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedCutout {
    pub project_path: String,
    pub project: CutoutProject,
    pub sha256: String,
    pub masks: BTreeMap<String, Mask>,
    pub persisted: bool,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PartEdit {
    pub part_id: String,
    pub status: PartStatus,
    pub reason: Option<String>,
    pub mask: Mask,
    pub selection_parameters: Option<super::segmentation::SelectionParameters>,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveCutoutRequest {
    pub project_path: String,
    pub expected_revision: u64,
    pub expected_sha256: String,
    pub active_part_id: String,
    /// Explicit user consent to continue with the verified snapshot only.
    #[serde(default)]
    pub detach_original: bool,
    pub parts: Vec<PartEdit>,
}

pub fn validate_parts<'a>(
    ids: impl Iterator<Item = &'a str>,
    active: &str,
) -> Result<(), StorageError> {
    let mut seen = HashSet::new();
    for id in ids {
        if !seen.insert(id) || !catalog().iter().any(|part| part.part_id == id) {
            return Err(invalid("Unbekannter oder doppelter Körperteil."));
        }
    }
    if seen.len() < 15
        || seen.len() > 18
        || !seen.contains(active)
        || (seen.contains("sword") && seen.contains("belt_accessory"))
        || catalog()
            .iter()
            .filter(|part| part.required)
            .any(|part| !seen.contains(part.part_id.as_str()))
    {
        return Err(invalid(
            "Der feste Körperteilkatalog oder der aktive Teil ist unvollständig.",
        ));
    }
    Ok(())
}
pub fn validate_status(
    id: &str,
    status: PartStatus,
    reason: Option<&str>,
) -> Result<(), StorageError> {
    let required = catalog()
        .iter()
        .find(|part| part.part_id == id)
        .ok_or_else(|| invalid("Unbekannter Körperteil."))?
        .required;
    if (required && status == PartStatus::Disabled)
        || (!required && status == PartStatus::NotPresent)
        || reason.is_some_and(|value| value.chars().count() > 500)
        || (status == PartStatus::NotPresent && reason.is_none_or(|value| value.trim().is_empty()))
    {
        return Err(invalid("Pflichtteile benötigen eine Maske oder eine begründete Nicht-vorhanden-Angabe; Extras können deaktiviert werden."));
    }
    Ok(())
}
pub fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn invalid(message: &str) -> StorageError {
    StorageError::InvalidVault(message.to_owned())
}
pub fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
