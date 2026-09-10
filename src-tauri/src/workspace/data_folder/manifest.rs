use super::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub(super) const PART_IDS: [&str; 19] = [
    "head",
    "torso",
    "pelvis",
    "upper_arm_l",
    "forearm_l",
    "hand_l",
    "upper_arm_r",
    "forearm_r",
    "hand_r",
    "thigh_r",
    "shin_r",
    "foot_r",
    "thigh_l",
    "shin_l",
    "foot_l",
    "cape",
    "belt_accessory",
    "sword",
    "hair",
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub schema_version: u32,
    pub kind: String,
    pub set_id: String,
    pub generation_id: String,
    pub cutout_revision: u64,
    pub source: Source,
    pub complete: bool,
    pub parts: Vec<Part>,
    pub omitted_parts: Vec<Omitted>,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_sha256: Option<String>,
    pub snapshot_path: String,
    pub sha256: String,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Part {
    pub part_id: String,
    pub file: String,
    pub sha256: String,
    pub source_rect: Rect,
    pub pivot: Point,
    pub default_position: Point,
    pub default_z: i64,
    pub parent_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Rect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Omitted {
    pub part_id: String,
    pub reason: String,
}

pub(super) fn inspect(
    root: &VaultRoot,
    directory: &str,
) -> Result<WorkspaceSelection, StorageError> {
    let relative = join(directory, "sprite.parts.json");
    let path = checked_path(root, directory, true)?.join("sprite.parts.json");
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            match crate::sprite::legacy::inspect(root, directory) {
                Ok(Some(selection)) => return Ok(selection),
                Ok(None) => {}
                Err(error) => {
                    return Ok(WorkspaceSelection::Directory {
                        relative_path: directory.to_owned(),
                        status: "invalid".to_owned(),
                        message: Some(format!("Legacy-Teileordner nicht ladbar: {error}")),
                    })
                }
            }
            return Ok(WorkspaceSelection::Directory {
                relative_path: directory.to_owned(),
                status: "ordinary".to_owned(),
                message: None,
            });
        }
        Err(error) => return Err(io(&relative, error)),
        Ok(_) => {}
    }
    match read_set(root, directory, &relative) {
        Ok(selection) => Ok(selection),
        Err(reason) => {
            let pending = matches!(&reason, StorageError::WriteConflict)
                || matches!(&reason, StorageError::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound);
            Ok(WorkspaceSelection::Directory {
                relative_path: directory.to_owned(),
                status: if pending { "in_progress" } else { "invalid" }.to_owned(),
                message: Some(format!(
                    "Teile-Set {}: {reason}",
                    if pending {
                        "noch nicht konsistent"
                    } else {
                        "ungültig"
                    }
                )),
            })
        }
    }
}

pub(crate) fn read_set(
    root: &VaultRoot,
    directory: &str,
    relative: &str,
) -> Result<WorkspaceSelection, StorageError> {
    crate::workspace::require_settled_file_sets(root)?;
    let bytes = read_bounded(root, relative, 1024 * 1024)?;
    let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|error| {
        invalid(&format!(
            "Manifest entspricht nicht dem Sprite-Teileschema: {error}"
        ))
    })?;
    validate_manifest(&manifest)?;
    let mut total_bytes = 0;
    let mut total_pixels = 0_u64;
    let mut receipts = Vec::new();
    for part in &manifest.parts {
        let path = join(directory, &part.file);
        let metadata =
            fs::symlink_metadata(checked_path(root, &path, false)?).map_err(|e| io(&path, e))?;
        let expected = fingerprint(&path, &metadata);
        let content = read_bounded(root, &path, MAX_IMAGE_BYTES)?;
        total_bytes += content.len();
        total_pixels += u64::from(part.source_rect.width) * u64::from(part.source_rect.height);
        if total_bytes > 64 * 1024 * 1024 || total_pixels > 32 * 1024 * 1024 {
            return Err(invalid("Teile-Set überschreitet das Lese-/Dekodierbudget."));
        }
        if digest(&content) != part.sha256 {
            return Err(StorageError::WriteConflict);
        }
        let decoded = decode_png(&content)?;
        if decoded.width() != part.source_rect.width || decoded.height() != part.source_rect.height
        {
            return Err(invalid(
                "PNG-Abmessungen passen nicht zum Manifest-Ausschnitt.",
            ));
        }
        receipts.push((path, expected));
    }
    for (path, expected) in receipts {
        verify_fingerprint(root, &path, &expected)?;
    }
    if read_bounded(root, relative, 1024 * 1024)? != bytes {
        return Err(StorageError::WriteConflict);
    }
    crate::workspace::require_settled_file_sets(root)?;
    Ok(WorkspaceSelection::SpriteSet {
        relative_path: directory.to_owned(),
        manifest_path: relative.to_owned(),
        manifest_sha256: digest(&bytes),
        set_id: manifest.set_id,
        generation_id: manifest.generation_id,
        complete: manifest.complete,
        part_count: manifest.parts.len(),
    })
}

pub(crate) fn validate_manifest(value: &Manifest) -> Result<(), StorageError> {
    if value.schema_version != 1
        || value.kind != "spriteParts"
        || value.cutout_revision == 0
        || value.cutout_revision > 9_007_199_254_740_991
        || !(1..=18).contains(&value.parts.len())
        || value.omitted_parts.len() > 15
        || !id(&value.set_id)
        || !id(&value.generation_id)
        || chrono::DateTime::parse_from_rfc3339(&value.created_at).is_err()
        || !(1..=8192).contains(&value.source.width)
        || !(1..=8192).contains(&value.source.height)
        || u64::from(value.source.width) * u64::from(value.source.height) > 16 * 1024 * 1024
        || value.source.original_path.is_some() != value.source.original_sha256.is_some()
        || value.complete != value.omitted_parts.is_empty()
    {
        return Err(invalid("Unbekanntes oder ungültiges Teilemanifest."));
    }
    validate_path(&value.source.snapshot_path, false)?;
    valid_hash(&value.source.sha256)?;
    if let Some(path) = &value.source.original_path {
        validate_path(path, false)?;
    }
    if let Some(hash) = &value.source.original_sha256 {
        valid_hash(hash)?;
    }
    let mut included = HashSet::new();
    for part in &value.parts {
        let Some(definition) = crate::cutout::catalog()
            .iter()
            .find(|entry| entry.part_id == part.part_id)
        else {
            return Err(invalid("Unbekannte Teil-ID."));
        };
        if !included.insert(part.part_id.as_str()) || part.file != definition.file {
            return Err(invalid(
                "Doppelte Teil-ID oder falscher normierter PNG-Dateiname.",
            ));
        }
        valid_hash(&part.sha256)?;
        let rect = &part.source_rect;
        if rect.width == 0
            || rect.height == 0
            || u64::from(rect.x) + u64::from(rect.width) > u64::from(value.source.width)
            || u64::from(rect.y) + u64::from(rect.height) > u64::from(value.source.height)
            || ![
                part.pivot.x,
                part.pivot.y,
                part.default_position.x,
                part.default_position.y,
            ]
            .iter()
            .all(|n| n.is_finite())
            || part.default_position.x != f64::from(rect.x) + part.pivot.x
            || part.default_position.y != f64::from(rect.y) + part.pivot.y
            || part.default_z.unsigned_abs() > 9_007_199_254_740_991
        {
            return Err(invalid(
                "Ungültige Quellkoordinaten oder Ebenenwerte im Manifest.",
            ));
        }
        if let Some(parent) = &part.parent_id {
            if !PART_IDS.contains(&parent.as_str()) || parent == &part.part_id {
                return Err(invalid("Ungültiger Teil-Elternverweis."));
            }
        }
    }
    if included.contains("belt_accessory") && included.contains("sword") {
        return Err(invalid("Der Zubehör-Slot darf nicht doppelt belegt sein."));
    }
    let mut omitted = HashSet::new();
    for part in &value.omitted_parts {
        if !PART_IDS[..15].contains(&part.part_id.as_str())
            || !omitted.insert(part.part_id.as_str())
            || included.contains(part.part_id.as_str())
            || part.reason.trim().is_empty()
            || part.reason.chars().count() > 500
        {
            return Err(invalid(
                "Ausgelassene Pflichtteile benötigen eindeutige IDs und Gründe.",
            ));
        }
    }
    for id in &PART_IDS[..15] {
        if !included.contains(id) && (value.complete || !omitted.contains(id)) {
            return Err(invalid(
                "Ein Pflichtteil fehlt ohne ausdrückliche Auslassung.",
            ));
        }
    }
    for part in &value.parts {
        let mut chain = HashSet::new();
        let mut cursor = Some(part.part_id.as_str());
        while let Some(id) = cursor {
            if !chain.insert(id) {
                return Err(invalid("Zyklischer Teil-Elternverweis."));
            }
            cursor = value
                .parts
                .iter()
                .find(|part| part.part_id == id)
                .and_then(|part| part.parent_id.as_deref());
        }
    }
    Ok(())
}
fn id(value: &str) -> bool {
    (3..=128).contains(&value.len())
        && value.bytes().enumerate().all(|(i, b)| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || (i > 0 && matches!(b, b'_' | b'-'))
        })
}
fn valid_hash(value: &str) -> Result<(), StorageError> {
    if value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        Ok(())
    } else {
        Err(invalid("Ungültige SHA-256-Prüfsumme."))
    }
}
