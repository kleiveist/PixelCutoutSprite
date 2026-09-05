use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::{
    codecs::png::PngDecoder, imageops::FilterType, ColorType, DynamicImage, ImageDecoder,
    ImageFormat, RgbaImage,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::asset_io::ImportedAsset;
use crate::domain::{
    parse_document, portable_name_key, Appearance, AssetKind, Direction, DomainDocument, Equipment,
    ObjectId, OutfitDraft, PixelPoint, PixelSize, RevisionRef, Sha256Digest, SlotId, SlotRef,
};
use crate::storage::{JsonStore, StorageError, VaultLayout, VaultRoot, AREA_ADMIN_DIR};

use super::{scan_assets, AreaAssetContext, AssetServiceError, StoredAsset};
use crate::application::project_service::{load_project_labels, scan_projects};
use crate::application::{VaultOpenMode, VaultSessionContext};

const DEFAULT_PAGE_SIZE: usize = 50;
const MAXIMUM_PAGE_SIZE: usize = 100;
const DEFAULT_THUMBNAIL_EDGE: u16 = 48;
const MAXIMUM_THUMBNAIL_EDGE: u16 = 48;
const MAXIMUM_SOURCE_BYTES: u64 = 32 * 1024 * 1024;
const MAXIMUM_THUMBNAIL_SOURCE_AXIS: u32 = 4096;
const MAXIMUM_THUMBNAIL_SOURCE_PIXELS: u64 = 16 * 1024 * 1024;
const MAXIMUM_THUMBNAIL_DECODED_BYTES: u64 = 64 * 1024 * 1024;

type UsageIndex = HashMap<ObjectId, Vec<AssetUsage>>;
type InventoryContext = (Vec<InventoryLabel>, UsageIndex);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetInventory {
    pub area_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub writable: bool,
    pub labels: Vec<InventoryLabel>,
    pub items: Vec<AssetInventoryItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetInventoryPage {
    pub area_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub writable: bool,
    pub labels: Vec<InventoryLabel>,
    pub facets: AssetInventoryFacets,
    pub items: Vec<AssetInventoryItem>,
    pub total_items: usize,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct AssetInventoryQuery {
    pub search: String,
    pub slot_id: Option<SlotId>,
    pub direction: Option<Direction>,
    pub asset_kind: Option<AssetKind>,
    pub profile_ref: Option<RevisionRef>,
    pub label_id: Option<ObjectId>,
    pub usage: AssetInventoryUsageFilter,
    pub sort: AssetInventorySort,
}

impl Default for AssetInventoryQuery {
    fn default() -> Self {
        Self {
            search: String::new(),
            slot_id: None,
            direction: None,
            asset_kind: None,
            profile_ref: None,
            label_id: None,
            usage: AssetInventoryUsageFilter::Any,
            sort: AssetInventorySort::NameAsc,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetInventoryUsageFilter {
    #[default]
    Any,
    Used,
    Unused,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetInventorySort {
    #[default]
    NameAsc,
    NameDesc,
    UpdatedNewest,
    UpdatedOldest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetInventoryFacets {
    pub slot_ids: Vec<SlotId>,
    pub directions: Vec<Direction>,
    pub asset_kinds: Vec<AssetKind>,
    pub profile_refs: Vec<RevisionRef>,
    pub label_ids: Vec<ObjectId>,
    pub has_used: bool,
    pub has_unused: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InventoryLabel {
    pub id: ObjectId,
    pub name: String,
    pub color: String,
}

/// Metadata-only inventory row. Image bytes are deliberately served by `get_asset_thumbnail`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetInventoryItem {
    pub id: ObjectId,
    pub revision: u32,
    pub name: String,
    pub original_name: String,
    pub asset_kind: AssetKind,
    pub label_ids: Vec<ObjectId>,
    pub released_revision: u32,
    pub profile_ref: RevisionRef,
    pub slot_id: SlotId,
    pub direction: Direction,
    pub variant: String,
    pub image_size_px: PixelSize,
    pub pivot_px: PixelPoint,
    pub content_hash: Sha256Digest,
    pub archived: bool,
    pub usage: Vec<AssetUsage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetUsage {
    pub kind: String,
    pub id: ObjectId,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetThumbnail {
    pub asset_id: ObjectId,
    pub revision: u32,
    pub width_px: u16,
    pub height_px: u16,
    pub data_url: String,
}

pub(super) fn build_inventory(
    session: &VaultSessionContext,
    area: &AreaAssetContext,
) -> Result<AssetInventory, AssetServiceError> {
    let (labels, usage) = inventory_context(session, area)?;
    let mut stored = scan_assets(&session.root, &area.folder)?;
    sort_assets(&mut stored);
    let items = stored
        .into_iter()
        .map(|asset| inventory_item(asset, &usage))
        .collect();
    Ok(AssetInventory {
        area_id: area.area.id,
        profile_ref: area.profile.reference(),
        writable: session.mode == VaultOpenMode::ReadWrite,
        labels,
        items,
    })
}

pub(super) fn build_inventory_page(
    session: &VaultSessionContext,
    area: &AreaAssetContext,
    query: &AssetInventoryQuery,
    cursor: Option<&str>,
    limit: Option<usize>,
) -> Result<AssetInventoryPage, AssetServiceError> {
    let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE);
    if !(1..=MAXIMUM_PAGE_SIZE).contains(&limit) {
        return Err(StorageError::InvalidVault(format!(
            "inventory page limit must be within 1..={MAXIMUM_PAGE_SIZE}"
        ))
        .into());
    }
    let normalized_search = query.search.trim().to_lowercase();
    if normalized_search.chars().count() > 200 {
        return Err(StorageError::InvalidVault(
            "inventory search must contain at most 200 characters".to_owned(),
        )
        .into());
    }
    let (labels, usage) = inventory_context(session, area)?;
    let mut all_assets = scan_assets(&session.root, &area.folder)?;
    let facets = inventory_facets(&all_assets, &usage);
    all_assets.retain(|stored| matches_query(stored, &usage, query, &normalized_search));
    sort_assets_for_query(&mut all_assets, query.sort);
    let total_items = all_assets.len();
    let scope = inventory_cursor_scope(area, query, &all_assets)?;
    let start = cursor
        .map(|value| decode_inventory_cursor(value, &scope, total_items))
        .transpose()?
        .unwrap_or(0);
    let end = start.saturating_add(limit).min(total_items);
    let next_cursor = (end < total_items).then(|| format!("v1:{}:{end}", scope.as_str()));
    let items = all_assets[start..end]
        .iter()
        .cloned()
        .map(|asset| inventory_item(asset, &usage))
        .collect();
    Ok(AssetInventoryPage {
        area_id: area.area.id,
        profile_ref: area.profile.reference(),
        writable: session.mode == VaultOpenMode::ReadWrite,
        labels,
        facets,
        items,
        total_items,
        next_cursor,
    })
}

fn matches_query(
    stored: &StoredAsset,
    usage: &UsageIndex,
    query: &AssetInventoryQuery,
    normalized_search: &str,
) -> bool {
    let matches_text = normalized_search.is_empty()
        || stored.asset.name.to_lowercase().contains(normalized_search)
        || stored
            .asset
            .original_name
            .to_lowercase()
            .contains(normalized_search)
        || stored
            .revision
            .variant
            .to_lowercase()
            .contains(normalized_search);
    let use_count = usage.get(&stored.asset.id).map_or(0, Vec::len);
    matches_text
        && query
            .slot_id
            .as_ref()
            .is_none_or(|value| value == &stored.revision.slot_id)
        && query
            .direction
            .is_none_or(|value| value == stored.revision.direction)
        && query
            .asset_kind
            .is_none_or(|value| value == stored.asset.asset_kind)
        && query
            .profile_ref
            .is_none_or(|value| value == stored.revision.profile_ref)
        && query
            .label_id
            .is_none_or(|value| stored.asset.label_ids.contains(&value))
        && match query.usage {
            AssetInventoryUsageFilter::Any => true,
            AssetInventoryUsageFilter::Used => use_count > 0,
            AssetInventoryUsageFilter::Unused => use_count == 0,
        }
}

fn sort_assets_for_query(assets: &mut [StoredAsset], sort: AssetInventorySort) {
    assets.sort_by(|left, right| {
        let order = match sort {
            AssetInventorySort::NameAsc => {
                portable_name_key(&left.asset.name).cmp(&portable_name_key(&right.asset.name))
            }
            AssetInventorySort::NameDesc => {
                portable_name_key(&right.asset.name).cmp(&portable_name_key(&left.asset.name))
            }
            AssetInventorySort::UpdatedNewest => right.asset.updated_at.cmp(&left.asset.updated_at),
            AssetInventorySort::UpdatedOldest => left.asset.updated_at.cmp(&right.asset.updated_at),
        };
        order.then_with(|| left.asset.id.cmp(&right.asset.id))
    });
}

fn inventory_facets(assets: &[StoredAsset], usage: &UsageIndex) -> AssetInventoryFacets {
    let mut slot_ids = Vec::new();
    let mut present_directions = Vec::new();
    let mut present_kinds = Vec::new();
    let mut profile_refs = Vec::new();
    let mut label_ids = Vec::new();
    let mut has_used = false;
    let mut has_unused = false;
    for stored in assets {
        if !slot_ids.contains(&stored.revision.slot_id) {
            slot_ids.push(stored.revision.slot_id.clone());
        }
        if !present_directions.contains(&stored.revision.direction) {
            present_directions.push(stored.revision.direction);
        }
        if !present_kinds.contains(&stored.asset.asset_kind) {
            present_kinds.push(stored.asset.asset_kind);
        }
        if !profile_refs.contains(&stored.revision.profile_ref) {
            profile_refs.push(stored.revision.profile_ref);
        }
        for label_id in &stored.asset.label_ids {
            if !label_ids.contains(label_id) {
                label_ids.push(*label_id);
            }
        }
        if usage
            .get(&stored.asset.id)
            .is_some_and(|items| !items.is_empty())
        {
            has_used = true;
        } else {
            has_unused = true;
        }
    }
    slot_ids.sort_by(|left, right| left.as_str().cmp(right.as_str()));
    present_directions.sort_by_key(|value| {
        Direction::ALL
            .iter()
            .position(|candidate| candidate == value)
            .unwrap_or(usize::MAX)
    });
    present_kinds.sort_by_key(|value| match value {
        AssetKind::Body => 0,
        AssetKind::Clothing => 1,
        AssetKind::Armour => 2,
        AssetKind::Accessory => 3,
        AssetKind::Equipment => 4,
    });
    profile_refs.sort_by(|left, right| {
        left.id
            .cmp(&right.id)
            .then_with(|| left.revision.cmp(&right.revision))
    });
    label_ids.sort();
    AssetInventoryFacets {
        slot_ids,
        directions: present_directions,
        asset_kinds: present_kinds,
        profile_refs,
        label_ids,
        has_used,
        has_unused,
    }
}

fn inventory_cursor_scope(
    area: &AreaAssetContext,
    query: &AssetInventoryQuery,
    assets: &[StoredAsset],
) -> Result<Sha256Digest, AssetServiceError> {
    let ordered_assets = assets
        .iter()
        .map(|asset| {
            (
                asset.asset.id,
                asset.asset.revision,
                asset.revision.revision,
            )
        })
        .collect::<Vec<_>>();
    let payload = serde_json::json!({
        "format": "pixel-cutout-sprite-inventory-cursor-v1",
        "area_id": area.area.id,
        "profile_ref": area.profile.reference(),
        "query": query,
        "ordered_assets": ordered_assets,
    });
    let bytes =
        crate::domain::canonical_json_bytes(&payload).map_err(StorageError::InvalidDocument)?;
    Ok(Sha256Digest::parse(format!("{:x}", Sha256::digest(bytes)))
        .expect("SHA-256 formatter is valid"))
}

fn decode_inventory_cursor(
    cursor: &str,
    expected_scope: &Sha256Digest,
    total_items: usize,
) -> Result<usize, AssetServiceError> {
    let mut parts = cursor.split(':');
    let (Some("v1"), Some(scope), Some(offset), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(StorageError::InvalidVault("inventory cursor is invalid".to_owned()).into());
    };
    if scope != expected_scope.as_str() {
        return Err(StorageError::InvalidVault(
            "inventory cursor is stale or belongs to different filters or sorting".to_owned(),
        )
        .into());
    }
    let offset = offset
        .parse::<usize>()
        .map_err(|_| StorageError::InvalidVault("inventory cursor is invalid".to_owned()))?;
    if offset == 0 || offset > total_items {
        return Err(StorageError::InvalidVault(
            "inventory cursor offset is out of range".to_owned(),
        )
        .into());
    }
    Ok(offset)
}

pub(super) fn build_thumbnail(
    root: &VaultRoot,
    area: &AreaAssetContext,
    asset_id: ObjectId,
    revision_number: u32,
    max_edge: Option<u16>,
) -> Result<AssetThumbnail, AssetServiceError> {
    let max_edge = max_edge.unwrap_or(DEFAULT_THUMBNAIL_EDGE);
    if !(1..=MAXIMUM_THUMBNAIL_EDGE).contains(&max_edge) {
        return Err(StorageError::InvalidVault(format!(
            "thumbnail max_edge must be within 1..={MAXIMUM_THUMBNAIL_EDGE}"
        ))
        .into());
    }
    if revision_number == 0 {
        return Err(
            StorageError::InvalidVault("thumbnail revision must be positive".to_owned()).into(),
        );
    }
    let (asset_folder, asset) = find_asset(root, &area.folder, asset_id)?;
    if asset.area_id != area.area.id || !asset.released_revisions.contains(&revision_number) {
        return Err(StorageError::InvalidVault(
            "thumbnail revision is not released for this area asset".to_owned(),
        )
        .into());
    }
    let revision_path = asset_folder
        .join(format!("r{revision_number:04}"))
        .join("revision.json");
    let loaded = JsonStore::default().load(&root.resolve(&revision_path)?)?;
    let DomainDocument::AssetRevision(revision) = loaded.value else {
        return Err(StorageError::InvalidVault(
            "thumbnail revision has the wrong document kind".to_owned(),
        )
        .into());
    };
    if revision.asset_id != asset_id || revision.revision != revision_number {
        return Err(StorageError::InvalidVault(
            "thumbnail revision identity does not match the requested asset".to_owned(),
        )
        .into());
    }
    let image_path = root.resolve(&area.folder.join(revision.source_file.as_str()))?;
    let metadata = fs::metadata(image_path.as_path()).map_err(|error| {
        StorageError::io("inspect thumbnail source", image_path.relative(), error)
    })?;
    if metadata.len() > MAXIMUM_SOURCE_BYTES {
        return Err(StorageError::InvalidVault(
            "thumbnail source exceeds the encoded PNG limit".to_owned(),
        )
        .into());
    }
    let bytes = fs::read(image_path.as_path())
        .map_err(|error| StorageError::io("read thumbnail source", image_path.relative(), error))?;
    if bytes.len() as u64 > MAXIMUM_SOURCE_BYTES {
        return Err(StorageError::InvalidVault(
            "thumbnail source exceeds the encoded PNG limit".to_owned(),
        )
        .into());
    }
    let digest = Sha256Digest::parse(format!("{:x}", Sha256::digest(&bytes)))
        .expect("SHA-256 formatter is valid");
    if digest != revision.content_hash {
        return Err(StorageError::InvalidVault(
            "thumbnail source content hash does not match its revision".to_owned(),
        )
        .into());
    }
    let decoder = PngDecoder::new(Cursor::new(bytes.as_slice())).map_err(|error| {
        StorageError::InvalidVault(format!("thumbnail PNG header is invalid: {error}"))
    })?;
    let (source_width, source_height) = decoder.dimensions();
    let pixels = u64::from(source_width)
        .checked_mul(u64::from(source_height))
        .ok_or_else(|| StorageError::InvalidVault("thumbnail dimensions overflow".to_owned()))?;
    if source_width > MAXIMUM_THUMBNAIL_SOURCE_AXIS
        || source_height > MAXIMUM_THUMBNAIL_SOURCE_AXIS
        || pixels > MAXIMUM_THUMBNAIL_SOURCE_PIXELS
    {
        return Err(StorageError::InvalidVault(
            "thumbnail source dimensions exceed the decode limit".to_owned(),
        )
        .into());
    }
    if source_width != u32::from(revision.image_size_px.0)
        || source_height != u32::from(revision.image_size_px.1)
    {
        return Err(StorageError::InvalidVault(
            "thumbnail source dimensions do not match its revision".to_owned(),
        )
        .into());
    }
    if decoder.color_type() != ColorType::Rgba8 {
        return Err(StorageError::InvalidVault(
            "thumbnail source must use 8-bit RGBA pixels".to_owned(),
        )
        .into());
    }
    let expected_bytes = pixels
        .checked_mul(4)
        .ok_or_else(|| StorageError::InvalidVault("thumbnail decode size overflow".to_owned()))?;
    if decoder.total_bytes() != expected_bytes || expected_bytes > MAXIMUM_THUMBNAIL_DECODED_BYTES {
        return Err(StorageError::InvalidVault(
            "thumbnail source exceeds the decoded RGBA limit".to_owned(),
        )
        .into());
    }
    let mut rgba = RgbaImage::new(source_width, source_height);
    decoder.read_image(rgba.as_mut()).map_err(|error| {
        StorageError::InvalidVault(format!("thumbnail PNG decode failed: {error}"))
    })?;
    let decoded = DynamicImage::ImageRgba8(rgba);
    let longest = decoded.width().max(decoded.height());
    let scale = u32::from(max_edge);
    let width = decoded
        .width()
        .saturating_mul(scale)
        .div_ceil(longest)
        .max(1);
    let height = decoded
        .height()
        .saturating_mul(scale)
        .div_ceil(longest)
        .max(1);
    let thumbnail = if longest > scale {
        decoded.resize_exact(width, height, FilterType::Nearest)
    } else {
        decoded
    };
    let width_px = u16::try_from(thumbnail.width()).expect("thumbnail edge is bounded");
    let height_px = u16::try_from(thumbnail.height()).expect("thumbnail edge is bounded");
    let mut encoded = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut encoded, ImageFormat::Png)
        .map_err(|error| StorageError::InvalidVault(format!("thumbnail encode failed: {error}")))?;
    Ok(AssetThumbnail {
        asset_id,
        revision: revision_number,
        width_px,
        height_px,
        data_url: format!(
            "data:image/png;base64,{}",
            BASE64.encode(encoded.into_inner())
        ),
    })
}

fn inventory_context(
    session: &VaultSessionContext,
    area: &AreaAssetContext,
) -> Result<InventoryContext, AssetServiceError> {
    let projects = scan_projects(session)?;
    let project = projects
        .iter()
        .find(|project| project.project.id == area.area.project_id)
        .ok_or_else(|| {
            StorageError::InvalidVault(
                "area project disappeared while loading inventory".to_owned(),
            )
        })?;
    let labels = load_project_labels(&VaultLayout::new(session.root.clone()), project)?
        .labels
        .into_iter()
        .map(|label| InventoryLabel {
            id: label.id,
            name: label.name,
            color: label.color,
        })
        .collect();
    let usage = build_usage_index(&session.root, &area.folder)?;
    Ok((labels, usage))
}

fn sort_assets(assets: &mut [StoredAsset]) {
    assets.sort_by(|left, right| {
        portable_name_key(&left.asset.name)
            .cmp(&portable_name_key(&right.asset.name))
            .then_with(|| left.asset.id.to_string().cmp(&right.asset.id.to_string()))
    });
}

fn inventory_item(
    stored: StoredAsset,
    usage: &HashMap<ObjectId, Vec<AssetUsage>>,
) -> AssetInventoryItem {
    AssetInventoryItem {
        id: stored.asset.id,
        revision: stored.asset.revision,
        name: stored.asset.name,
        original_name: stored.asset.original_name,
        asset_kind: stored.asset.asset_kind,
        label_ids: stored.asset.label_ids,
        released_revision: stored.revision.revision,
        profile_ref: stored.revision.profile_ref,
        slot_id: stored.revision.slot_id,
        direction: stored.revision.direction,
        variant: stored.revision.variant,
        image_size_px: stored.revision.image_size_px,
        pivot_px: stored.revision.pivot_px,
        content_hash: stored.revision.content_hash,
        archived: stored.asset.archived,
        usage: usage.get(&stored.asset.id).cloned().unwrap_or_default(),
    }
}

pub(super) fn imported_item(imported: ImportedAsset) -> AssetInventoryItem {
    AssetInventoryItem {
        id: imported.asset.id,
        revision: imported.asset.revision,
        name: imported.asset.name,
        original_name: imported.asset.original_name,
        asset_kind: imported.asset.asset_kind,
        label_ids: imported.asset.label_ids,
        released_revision: imported.revision.revision,
        profile_ref: imported.revision.profile_ref,
        slot_id: imported.revision.slot_id,
        direction: imported.revision.direction,
        variant: imported.revision.variant,
        image_size_px: imported.revision.image_size_px,
        pivot_px: imported.revision.pivot_px,
        content_hash: imported.revision.content_hash,
        archived: imported.asset.archived,
        usage: Vec::new(),
    }
}

fn find_asset(
    root: &VaultRoot,
    area_folder: &Path,
    asset_id: ObjectId,
) -> Result<(PathBuf, crate::domain::Asset), AssetServiceError> {
    let directory = root.resolve(&area_folder.join(AREA_ADMIN_DIR).join("assets"))?;
    let suffix = format!(
        "--{}",
        asset_id.to_string().chars().take(8).collect::<String>()
    );
    for entry in fs::read_dir(directory.as_path())
        .map_err(|error| StorageError::io("scan thumbnail asset", directory.relative(), error))?
    {
        let entry = entry.map_err(|error| {
            StorageError::io("scan thumbnail asset entry", directory.relative(), error)
        })?;
        let file_type = entry.file_type().map_err(|error| {
            StorageError::io("inspect thumbnail asset entry", &entry.path(), error)
        })?;
        if file_type.is_symlink()
            || !file_type.is_dir()
            || !entry.file_name().to_string_lossy().ends_with(&suffix)
        {
            continue;
        }
        let folder = directory.relative().join(entry.file_name());
        let loaded = JsonStore::default().load(&root.resolve(&folder.join("asset.json"))?)?;
        let DomainDocument::Asset(asset) = loaded.value else {
            return Err(StorageError::InvalidVault(
                "asset manifest has the wrong document kind".to_owned(),
            )
            .into());
        };
        if asset.id == asset_id {
            return Ok((folder, asset));
        }
    }
    Err(StorageError::InvalidVault("asset does not exist in this area".to_owned()).into())
}

/// Reads each usage-bearing document once, then associates all referenced assets in one pass.
fn build_usage_index(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<HashMap<ObjectId, Vec<AssetUsage>>, AssetServiceError> {
    let mut paths = Vec::new();
    let drafts = root.resolve(&area_folder.join(AREA_ADMIN_DIR).join("drafts"))?;
    if drafts.as_path().is_dir() {
        collect_json_paths(drafts.as_path(), 0, 4, &mut paths)?;
    }
    let area = root.resolve(area_folder)?;
    for entry in fs::read_dir(area.as_path())
        .map_err(|error| StorageError::io("scan area consumers", area.relative(), error))?
    {
        let entry = entry.map_err(|error| {
            StorageError::io("scan area consumer entry", area.relative(), error)
        })?;
        let file_type = entry.file_type().map_err(|error| {
            StorageError::io("inspect area consumer entry", &entry.path(), error)
        })?;
        if file_type.is_symlink() || !file_type.is_dir() || entry.file_name() == AREA_ADMIN_DIR {
            continue;
        }
        let appearances = entry.path().join("appearances");
        if appearances.is_dir() {
            collect_json_paths(&appearances, 0, 4, &mut paths)?;
        }
    }
    paths.sort();
    let mut index = HashMap::<ObjectId, Vec<AssetUsage>>::new();
    for path in paths {
        let bytes = fs::read(&path)
            .map_err(|error| StorageError::io("read area usage document", &path, error))?;
        match parse_document(&bytes) {
            Ok(DomainDocument::Appearance(value)) => index_appearance(&mut index, &value),
            Ok(DomainDocument::OutfitDraft(value)) => index_draft(&mut index, &value),
            Ok(_) => {}
            Err(error) => return Err(StorageError::InvalidDocument(error).into()),
        }
    }
    for usage in index.values_mut() {
        usage.sort_by(|left, right| {
            left.kind
                .cmp(&right.kind)
                .then_with(|| left.id.to_string().cmp(&right.id.to_string()))
                .then_with(|| left.description.cmp(&right.description))
        });
        usage.dedup();
    }
    Ok(index)
}

fn index_appearance(index: &mut HashMap<ObjectId, Vec<AssetUsage>>, appearance: &Appearance) {
    for slot in &appearance.slots {
        let mut ids = HashSet::new();
        collect_piece_ids(&mut ids, &slot.asset, &slot.fit_by_direction);
        add_usage(
            index,
            ids,
            AssetUsage {
                kind: "appearance_slot".to_owned(),
                id: appearance.id,
                description: format!("{} · slot {}", appearance.name, slot.slot_id),
            },
        );
    }
    for equipment in &appearance.equipment {
        index_equipment(
            index,
            equipment,
            "appearance_equipment",
            appearance.id,
            &format!("{} · equipment {}", appearance.name, equipment.name),
        );
    }
}

fn index_draft(index: &mut HashMap<ObjectId, Vec<AssetUsage>>, draft: &OutfitDraft) {
    let mut slots = HashMap::<SlotId, HashSet<ObjectId>>::new();
    for selected in &draft.selected_assets {
        slots
            .entry(selected.slot_id.clone())
            .or_default()
            .insert(selected.asset_id);
    }
    for fitting in &draft.fittings {
        let ids = slots.entry(fitting.slot_id.clone()).or_default();
        ids.insert(fitting.asset.asset_id);
        ids.extend(
            fitting
                .variant_fittings
                .iter()
                .map(|variant| variant.asset.asset_id),
        );
    }
    for (slot, ids) in slots {
        add_usage(
            index,
            ids,
            AssetUsage {
                kind: "outfit_draft".to_owned(),
                id: draft.id,
                description: format!("Outfit draft · slot {slot}"),
            },
        );
    }
    for equipment in &draft.equipment {
        index_equipment(
            index,
            equipment,
            "outfit_equipment",
            draft.id,
            &format!("Outfit draft · equipment {}", equipment.name),
        );
    }
}

fn index_equipment(
    index: &mut HashMap<ObjectId, Vec<AssetUsage>>,
    equipment: &Equipment,
    kind: &str,
    owner: ObjectId,
    description: &str,
) {
    let mut ids = HashSet::new();
    collect_piece_ids(&mut ids, &equipment.asset, &equipment.fit_by_direction);
    for part in &equipment.additional_parts {
        collect_piece_ids(&mut ids, &part.asset, &part.fit_by_direction);
    }
    add_usage(
        index,
        ids,
        AssetUsage {
            kind: kind.to_owned(),
            id: owner,
            description: description.to_owned(),
        },
    );
}

fn collect_piece_ids(
    ids: &mut HashSet<ObjectId>,
    base: &SlotRef,
    fits: &[crate::domain::DirectionFit],
) {
    ids.insert(base.asset_id);
    for fit in fits {
        ids.extend(fit.asset.iter().map(|asset| asset.asset_id));
        ids.extend(
            fit.variant_fittings
                .iter()
                .map(|variant| variant.asset.asset_id),
        );
    }
}

fn add_usage(
    index: &mut HashMap<ObjectId, Vec<AssetUsage>>,
    asset_ids: HashSet<ObjectId>,
    usage: AssetUsage,
) {
    for asset_id in asset_ids {
        index.entry(asset_id).or_default().push(usage.clone());
    }
}

fn collect_json_paths(
    directory: &Path,
    depth: u8,
    maximum_depth: u8,
    output: &mut Vec<PathBuf>,
) -> Result<(), AssetServiceError> {
    if depth > maximum_depth {
        return Err(StorageError::InvalidVault(
            "usage document nesting exceeds the supported depth".to_owned(),
        )
        .into());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| StorageError::io("scan usage documents", directory, error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| StorageError::io("scan usage document entry", directory, error))?;
    entries.sort_by_key(fs::DirEntry::file_name);
    for entry in entries {
        let file_type = entry.file_type().map_err(|error| {
            StorageError::io("inspect usage document entry", &entry.path(), error)
        })?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_json_paths(&entry.path(), depth + 1, maximum_depth, output)?;
        } else if file_type.is_file()
            && entry
                .path()
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
        {
            output.push(entry.path());
        }
    }
    Ok(())
}
