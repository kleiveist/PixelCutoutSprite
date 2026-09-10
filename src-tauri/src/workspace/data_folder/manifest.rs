use super::*;
use serde::Deserialize;
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    schema_version: u32,
    kind: String,
    set_id: String,
    generation_id: String,
    cutout_revision: u64,
    source: Source,
    complete: bool,
    parts: Vec<Part>,
    omitted_parts: Vec<Omitted>,
    created_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Source {
    original_path: Option<String>,
    original_sha256: Option<String>,
    snapshot_path: String,
    sha256: String,
    width: u32,
    height: u32,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Part {
    part_id: String,
    file: String,
    sha256: String,
    source_rect: Rect,
    pivot: Point,
    default_position: Point,
    default_z: i64,
    parent_id: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Rect {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Point {
    x: f64,
    y: f64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Omitted {
    part_id: String,
    reason: String,
}

pub(super) fn inspect(
    root: &VaultRoot,
    directory: &str,
) -> Result<WorkspaceSelection, StorageError> {
    let relative = join(directory, "sprite.parts.json");
    let path = checked_path(root, directory, true)?.join("sprite.parts.json");
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(WorkspaceSelection::Directory {
                relative_path: directory.to_owned(),
                status: "ordinary".to_owned(),
                message: None,
            })
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

fn read_set(
    root: &VaultRoot,
    directory: &str,
    relative: &str,
) -> Result<WorkspaceSelection, StorageError> {
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

fn validate_manifest(value: &Manifest) -> Result<(), StorageError> {
    if value.schema_version != 1
        || value.kind != "spriteParts"
        || value.cutout_revision == 0
        || !(1..=18).contains(&value.parts.len())
        || value.omitted_parts.len() > 15
        || !id(&value.set_id)
        || !id(&value.generation_id)
        || chrono::DateTime::parse_from_rfc3339(&value.created_at).is_err()
        || !(1..=8192).contains(&value.source.width)
        || !(1..=8192).contains(&value.source.height)
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
        let Some(position) = PART_IDS.iter().position(|id| *id == part.part_id) else {
            return Err(invalid("Unbekannte Teil-ID."));
        };
        let number = if position >= 17 {
            position
        } else {
            position + 1
        };
        if !included.insert(part.part_id.as_str())
            || part.file != format!("{number:02}_{}.png", part.part_id)
        {
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
        if !PART_IDS.contains(&part.part_id.as_str())
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
