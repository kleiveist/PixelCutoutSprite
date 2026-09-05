use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::asset_io::{
    AssetImportError, AssetRepository, AssetRepositoryError, ImportDecision, InspectedPackage,
    PngImporter, SheetRect, SizeHandling,
};
use crate::domain::{
    parse_document, Area, Asset, AssetKind, AssetRevision, Direction, DomainDocument, ObjectId,
    PixelPoint, PixelSize, ProfileRevision, RevisionRef, Sha256Digest, SlotId, UtcTimestamp,
};
use crate::storage::{JsonStore, StorageError, VaultLayout, VaultRoot, AREA_ADMIN_DIR};

use super::project_service::{load_project_labels, require_writable, scan_projects};
use super::{VaultOpenMode, VaultService, VaultSessionContext};

#[derive(Debug, thiserror::Error)]
pub enum AssetServiceError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Import(#[from] AssetImportError),
    #[error(transparent)]
    Repository(#[from] AssetRepositoryError),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetInventory {
    pub area_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub writable: bool,
    pub labels: Vec<InventoryLabel>,
    pub items: Vec<AssetInventoryItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InventoryLabel {
    pub id: ObjectId,
    pub name: String,
    pub color: String,
}

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
    pub thumbnail_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetUsage {
    pub kind: String,
    pub id: ObjectId,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AssetImportSource {
    Package { path: String },
    LoosePngs { paths: Vec<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetImportInspection {
    pub area_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub source: AssetImportSource,
    pub slots: Vec<ImportSlotOption>,
    pub entries: Vec<AssetImportPreviewEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ImportSlotOption {
    pub id: SlotId,
    pub size_px: PixelSize,
    pub pivot_px: PixelPoint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetImportPreviewEntry {
    pub entry_index: usize,
    pub name: String,
    pub source_name: String,
    pub asset_kind: AssetKind,
    pub declared_slot_id: Option<SlotId>,
    pub declared_direction: Option<Direction>,
    pub suggested_slot_id: Option<SlotId>,
    pub suggested_direction: Option<Direction>,
    pub variant: String,
    pub image_size_px: PixelSize,
    pub effective_size_px: PixelSize,
    pub pivot_px: PixelPoint,
    pub content_hash: Sha256Digest,
    pub size_warning: Option<String>,
    pub size_options: Vec<SizeHandling>,
    pub duplicate_asset_id: Option<ObjectId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConfirmAssetImportRequest {
    pub area_id: ObjectId,
    pub source: AssetImportSource,
    pub decisions: Vec<ImportDecision>,
}

#[derive(Debug)]
struct AreaAssetContext {
    folder: PathBuf,
    area: Area,
    profile: ProfileRevision,
}

#[derive(Debug, Clone)]
struct StoredAsset {
    folder: PathBuf,
    asset: Asset,
    revision: AssetRevision,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AssetService;

impl AssetService {
    pub fn inventory(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
    ) -> Result<AssetInventory, AssetServiceError> {
        let session = vaults.context(session_id)?;
        let area = find_area_context(&session, area_id)?;
        build_inventory(&session, &area)
    }

    pub fn inspect_sources(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
        paths: Vec<String>,
    ) -> Result<AssetImportInspection, AssetServiceError> {
        let session = vaults.context(session_id)?;
        let area = find_area_context(&session, area_id)?;
        let source = classify_source(paths)?;
        let inspected = inspect_source(&source, &area)?;
        preview_inspection(&session.root, &area, source, &inspected)
    }

    pub fn import(
        vaults: &mut VaultService,
        session_id: ObjectId,
        request: ConfirmAssetImportRequest,
    ) -> Result<AssetInventory, AssetServiceError> {
        let session = require_writable(vaults, session_id)?;
        let area = find_area_context(&session, request.area_id)?;
        let inspected = inspect_source(&request.source, &area)?;
        validate_decisions(&inspected, &request.decisions)?;
        AssetRepository.import_configured_package(
            &session.root,
            &area.folder,
            area.area.id,
            &inspected,
            &request.decisions,
            &area.profile,
        )?;
        vaults.refresh_index(session_id)?;
        let refreshed = vaults.context(session_id)?;
        build_inventory(&refreshed, &area)
    }

    pub fn archive(
        vaults: &mut VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
        asset_id: ObjectId,
        expected_revision: u32,
    ) -> Result<AssetInventory, AssetServiceError> {
        let session = require_writable(vaults, session_id)?;
        let area = find_area_context(&session, area_id)?;
        let stored = scan_assets(&session.root, &area.folder)?
            .into_iter()
            .find(|candidate| candidate.asset.id == asset_id)
            .ok_or_else(|| StorageError::InvalidVault("asset does not exist".to_owned()))?;
        let manifest = session.root.resolve(&stored.folder.join("asset.json"))?;
        let store = JsonStore::default();
        let loaded = store.load(&manifest)?;
        let DomainDocument::Asset(mut asset) = loaded.value else {
            return Err(StorageError::InvalidVault(
                "asset manifest has the wrong document kind".to_owned(),
            )
            .into());
        };
        if asset.revision != expected_revision {
            return Err(StorageError::WriteConflict.into());
        }
        asset.archived = true;
        asset.revision = asset
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::InvalidVault("asset revision overflow".to_owned()))?;
        asset.updated_at = now()?;
        asset.validate().map_err(StorageError::InvalidDocument)?;
        store.compare_and_swap(&manifest, &loaded.stamp, &DomainDocument::Asset(asset))?;
        vaults.refresh_index(session_id)?;
        let refreshed = vaults.context(session_id)?;
        build_inventory(&refreshed, &area)
    }
}

fn classify_source(paths: Vec<String>) -> Result<AssetImportSource, AssetServiceError> {
    if paths.is_empty() || paths.len() > 512 {
        return Err(AssetImportError::InvalidPackage(
            "select between 1 and 512 PNG files or one package JSON".to_owned(),
        )
        .into());
    }
    let json = paths
        .iter()
        .filter(|path| extension(path) == Some("json"))
        .count();
    let png = paths
        .iter()
        .filter(|path| extension(path) == Some("png"))
        .count();
    if json == 1 && paths.len() == 1 {
        validate_selected_file(Path::new(&paths[0]), "package JSON")?;
        return Ok(AssetImportSource::Package {
            path: paths[0].clone(),
        });
    }
    if png == paths.len() {
        for path in &paths {
            validate_selected_file(Path::new(path), "PNG")?;
        }
        return Ok(AssetImportSource::LoosePngs { paths });
    }
    Err(AssetImportError::InvalidPackage(
        "choose either one .json asset package or only .png files".to_owned(),
    )
    .into())
}

fn extension(path: &str) -> Option<&str> {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| {
            if value.eq_ignore_ascii_case("json") {
                "json"
            } else {
                value
            }
        })
        .map(|value| {
            if value.eq_ignore_ascii_case("png") {
                "png"
            } else {
                value
            }
        })
}

fn validate_selected_file(path: &Path, kind: &str) -> Result<(), AssetServiceError> {
    if !path.is_absolute() {
        return Err(AssetImportError::InvalidPackage(format!(
            "selected {kind} path must be absolute"
        ))
        .into());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect selected import", path, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AssetImportError::InvalidPackage(format!(
            "selected {kind} must be a real file, not a symbolic link"
        ))
        .into());
    }
    Ok(())
}

fn inspect_source(
    source: &AssetImportSource,
    area: &AreaAssetContext,
) -> Result<InspectedPackage, AssetServiceError> {
    let allowed_slots = area
        .profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    let importer = PngImporter::default();
    let inspected = match source {
        AssetImportSource::Package { path } => {
            validate_selected_file(Path::new(path), "package JSON")?;
            importer.inspect_package(Path::new(path), &allowed_slots)?
        }
        AssetImportSource::LoosePngs { paths } => {
            let paths = paths.iter().map(PathBuf::from).collect::<Vec<_>>();
            importer.inspect_loose_pngs(&paths, area.profile.reference(), &allowed_slots)?
        }
    };
    if inspected.package.profile_ref != area.profile.reference() {
        return Err(AssetImportError::InvalidPackage(
            "package profile revision does not match the selected area".to_owned(),
        )
        .into());
    }
    Ok(inspected)
}

fn validate_decisions(
    inspected: &InspectedPackage,
    decisions: &[ImportDecision],
) -> Result<(), AssetServiceError> {
    let mut indices = HashSet::new();
    if decisions
        .iter()
        .any(|value| !indices.insert(value.entry_index))
    {
        return Err(AssetImportError::InvalidPackage(
            "import decisions contain a duplicate entry index".to_owned(),
        )
        .into());
    }
    for source in &inspected.entries {
        let entry = &inspected.package.entries[source.entry_index];
        let decision = decisions
            .iter()
            .find(|value| value.entry_index == source.entry_index);
        match (&entry.slot_id, entry.direction, decision) {
            (Some(slot), Some(direction), Some(choice))
                if slot != choice.slot_id.as_str() || direction != choice.direction =>
            {
                return Err(AssetImportError::InvalidEntry {
                    entry: source.entry_index,
                    message: "confirmed assignment differs from package metadata".to_owned(),
                }
                .into());
            }
            (Some(_), Some(_), _) => {}
            (None, None, Some(_)) => {}
            (None, None, None) => {
                return Err(AssetImportError::AssignmentRequired {
                    entry: source.entry_index,
                }
                .into())
            }
            _ => unreachable!("entry pair validation ran during inspection"),
        }
    }
    if decisions
        .iter()
        .any(|value| value.entry_index >= inspected.entries.len())
    {
        return Err(AssetImportError::InvalidPackage(
            "import decision index is out of range".to_owned(),
        )
        .into());
    }
    Ok(())
}

fn preview_inspection(
    root: &VaultRoot,
    area: &AreaAssetContext,
    source: AssetImportSource,
    inspected: &InspectedPackage,
) -> Result<AssetImportInspection, AssetServiceError> {
    let hashes = scan_assets(root, &area.folder)?
        .into_iter()
        .map(|asset| (asset.revision.content_hash, asset.asset.id))
        .collect::<HashMap<_, _>>();
    let entries = inspected
        .entries
        .iter()
        .map(|item| {
            let entry = &inspected.package.entries[item.entry_index];
            let effective_size = effective_size(entry);
            let declared_slot = entry
                .slot_id
                .as_ref()
                .map(|value| SlotId::parse(value.clone()))
                .transpose()
                .map_err(StorageError::InvalidDocument)?;
            let suggested_slot = item.suggestion.as_ref().map(|value| value.slot_id.clone());
            let target_slot = declared_slot.as_ref().or(suggested_slot.as_ref());
            let target_size = target_slot.and_then(|id| {
                area.profile
                    .slots
                    .iter()
                    .find(|slot| &slot.id == id)
                    .map(|slot| slot.size_px)
            });
            let size_warning = target_size.filter(|size| *size != effective_size).map(|size| {
                format!(
                    "Source is {}×{} px; profile slot is {}×{} px. Keep unchanged, pad transparently, deliberately rescale with nearest-neighbour, or cancel and choose another variant.",
                    effective_size.0, effective_size.1, size.0, size.1
                )
            });
            let duplicate_asset_id = entry
                .sheet_rect_px
                .is_none()
                .then(|| hashes.get(&item.content_hash).copied())
                .flatten();
            Ok(AssetImportPreviewEntry {
                entry_index: item.entry_index,
                name: entry.name.clone(),
                source_name: Path::new(&entry.source)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("source.png")
                    .to_owned(),
                asset_kind: entry.asset_kind,
                declared_slot_id: declared_slot,
                declared_direction: entry.direction,
                suggested_slot_id: suggested_slot,
                suggested_direction: item.suggestion.as_ref().map(|value| value.direction),
                variant: entry.variant.clone(),
                image_size_px: entry.image_size_px,
                effective_size_px: effective_size,
                pivot_px: entry.pivot_px,
                content_hash: item.content_hash.clone(),
                size_warning,
                size_options: vec![
                    SizeHandling::KeepOriginal,
                    SizeHandling::PadTransparent,
                    SizeHandling::RescaleNearest,
                ],
                duplicate_asset_id,
            })
        })
        .collect::<Result<Vec<_>, AssetServiceError>>()?;
    Ok(AssetImportInspection {
        area_id: area.area.id,
        profile_ref: area.profile.reference(),
        source,
        slots: area
            .profile
            .slots
            .iter()
            .map(|slot| ImportSlotOption {
                id: slot.id.clone(),
                size_px: slot.size_px,
                pivot_px: slot.pivot_px,
            })
            .collect(),
        entries,
    })
}

fn effective_size(entry: &crate::asset_io::PackageEntry) -> PixelSize {
    entry
        .sheet_rect_px
        .map_or(entry.image_size_px, |SheetRect(_, _, width, height)| {
            PixelSize(width as u16, height as u16)
        })
}

fn build_inventory(
    session: &VaultSessionContext,
    area: &AreaAssetContext,
) -> Result<AssetInventory, AssetServiceError> {
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
    let documents = collect_area_documents(&session.root, &area.folder)?;
    let mut items = scan_assets(&session.root, &area.folder)?
        .into_iter()
        .map(|stored| inventory_item(&session.root, &area.folder, stored, &documents))
        .collect::<Result<Vec<_>, AssetServiceError>>()?;
    items.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.id.to_string().cmp(&right.id.to_string()))
    });
    Ok(AssetInventory {
        area_id: area.area.id,
        profile_ref: area.profile.reference(),
        writable: session.mode == VaultOpenMode::ReadWrite,
        labels,
        items,
    })
}

fn inventory_item(
    root: &VaultRoot,
    area_folder: &Path,
    stored: StoredAsset,
    documents: &[DomainDocument],
) -> Result<AssetInventoryItem, AssetServiceError> {
    let image = root.resolve(&area_folder.join(stored.revision.source_file.as_str()))?;
    let bytes = fs::read(image.as_path())
        .map_err(|error| StorageError::io("read inventory thumbnail", image.relative(), error))?;
    let usage = asset_usage(documents, stored.asset.id);
    Ok(AssetInventoryItem {
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
        usage,
        thumbnail_url: format!("data:image/png;base64,{}", BASE64.encode(bytes)),
    })
}

fn asset_usage(documents: &[DomainDocument], asset_id: ObjectId) -> Vec<AssetUsage> {
    let mut usage = Vec::new();
    for document in documents {
        match document {
            DomainDocument::Appearance(appearance) => {
                for slot in appearance.slots.iter().filter(|slot| {
                    slot.asset.asset_id == asset_id
                        || slot.fit_by_direction.iter().any(|fit| {
                            fit.asset
                                .as_ref()
                                .is_some_and(|asset| asset.asset_id == asset_id)
                                || fit
                                    .variant_fittings
                                    .iter()
                                    .any(|variant| variant.asset.asset_id == asset_id)
                        })
                }) {
                    usage.push(AssetUsage {
                        kind: "appearance_slot".to_owned(),
                        id: appearance.id,
                        description: format!("{} · slot {}", appearance.name, slot.slot_id),
                    });
                }
                for equipment in appearance.equipment.iter().filter(|item| {
                    item.asset.asset_id == asset_id
                        || item.fit_by_direction.iter().any(|fit| {
                            fit.asset
                                .as_ref()
                                .is_some_and(|asset| asset.asset_id == asset_id)
                                || fit
                                    .variant_fittings
                                    .iter()
                                    .any(|variant| variant.asset.asset_id == asset_id)
                        })
                }) {
                    usage.push(AssetUsage {
                        kind: "appearance_equipment".to_owned(),
                        id: appearance.id,
                        description: format!("{} · equipment {}", appearance.name, equipment.name),
                    });
                }
            }
            DomainDocument::OutfitDraft(draft) => {
                let mut used_slots = draft
                    .selected_assets
                    .iter()
                    .filter(|slot| slot.asset_id == asset_id)
                    .map(|slot| slot.slot_id.clone())
                    .collect::<HashSet<_>>();
                for fitting in &draft.fittings {
                    if fitting.asset.asset_id == asset_id
                        || fitting
                            .variant_fittings
                            .iter()
                            .any(|variant| variant.asset.asset_id == asset_id)
                    {
                        used_slots.insert(fitting.slot_id.clone());
                    }
                }
                let mut used_slots = used_slots.into_iter().collect::<Vec<_>>();
                used_slots.sort_by_key(ToString::to_string);
                for slot_id in used_slots {
                    usage.push(AssetUsage {
                        kind: "outfit_draft".to_owned(),
                        id: draft.id,
                        description: format!("Outfit draft · slot {slot_id}"),
                    });
                }
            }
            _ => {}
        }
    }
    usage
}

fn find_area_context(
    session: &VaultSessionContext,
    area_id: ObjectId,
) -> Result<AreaAssetContext, AssetServiceError> {
    let projects = scan_projects(session)?;
    for project in &projects {
        let project_path = session.root.resolve(&project.folder)?;
        for entry in fs::read_dir(project_path.as_path()).map_err(|error| {
            StorageError::io(
                "scan project areas for inventory",
                project_path.relative(),
                error,
            )
        })? {
            let entry = entry.map_err(|error| {
                StorageError::io(
                    "scan area entry for inventory",
                    project_path.relative(),
                    error,
                )
            })?;
            let file_type = entry.file_type().map_err(|error| {
                StorageError::io("inspect area entry for inventory", &entry.path(), error)
            })?;
            if file_type.is_symlink() || !file_type.is_dir() {
                continue;
            }
            let folder = project.folder.join(entry.file_name());
            let manifest = session
                .root
                .resolve(&folder.join(AREA_ADMIN_DIR).join("area.json"))?;
            if !manifest.as_path().is_file() {
                continue;
            }
            let loaded = JsonStore::default().load(&manifest)?;
            let DomainDocument::Area(area) = loaded.value else {
                continue;
            };
            if area.id != area_id {
                continue;
            }
            let profile_path = VaultLayout::new(session.root.clone()).profile_revision(
                &folder,
                area.profile_ref.id,
                area.profile_ref.revision,
            )?;
            let loaded = JsonStore::default().load(&profile_path)?;
            let DomainDocument::ProfileRevision(profile) = loaded.value else {
                return Err(StorageError::InvalidVault(
                    "area profile has the wrong document kind".to_owned(),
                )
                .into());
            };
            if profile.reference() != area.profile_ref || profile.area_id != area.id {
                return Err(StorageError::InvalidVault(
                    "area and active profile revision do not agree".to_owned(),
                )
                .into());
            }
            return Ok(AreaAssetContext {
                folder,
                area,
                profile,
            });
        }
    }
    Err(StorageError::InvalidVault(format!("area {area_id} does not exist")).into())
}

fn scan_assets(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<Vec<StoredAsset>, AssetServiceError> {
    let directory = root.resolve(&area_folder.join(AREA_ADMIN_DIR).join("assets"))?;
    if !directory.as_path().exists() {
        return Ok(Vec::new());
    }
    let mut assets = Vec::new();
    for entry in fs::read_dir(directory.as_path())
        .map_err(|error| StorageError::io("scan area assets", directory.relative(), error))?
    {
        let entry = entry
            .map_err(|error| StorageError::io("scan asset entry", directory.relative(), error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect asset entry", &entry.path(), error))?;
        if file_type.is_symlink() || !file_type.is_dir() {
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
        let revision_number = asset
            .released_revisions
            .iter()
            .copied()
            .max()
            .ok_or_else(|| StorageError::InvalidVault("asset has no release".to_owned()))?;
        let revision_path = folder
            .join(format!("r{revision_number:04}"))
            .join("revision.json");
        let loaded = JsonStore::default().load(&root.resolve(&revision_path)?)?;
        let DomainDocument::AssetRevision(revision) = loaded.value else {
            return Err(StorageError::InvalidVault(
                "asset revision has the wrong document kind".to_owned(),
            )
            .into());
        };
        if asset.id != revision.asset_id {
            return Err(StorageError::InvalidVault(
                "asset and latest revision identities do not agree".to_owned(),
            )
            .into());
        }
        assets.push(StoredAsset {
            folder,
            asset,
            revision,
        });
    }
    Ok(assets)
}

fn collect_area_documents(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<Vec<DomainDocument>, AssetServiceError> {
    let directory = root.resolve(area_folder)?;
    let mut paths = Vec::new();
    collect_json_paths(directory.as_path(), 0, &mut paths)?;
    let mut documents = Vec::new();
    for path in paths {
        let bytes = fs::read(&path)
            .map_err(|error| StorageError::io("read area document for usage", &path, error))?;
        if let Ok(document) = parse_document(&bytes) {
            documents.push(document);
        }
    }
    Ok(documents)
}

fn collect_json_paths(
    directory: &Path,
    depth: u8,
    output: &mut Vec<PathBuf>,
) -> Result<(), AssetServiceError> {
    if depth > 16 {
        return Err(StorageError::InvalidVault(
            "area nesting exceeds the supported inventory depth".to_owned(),
        )
        .into());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| StorageError::io("scan area usage", directory, error))?
    {
        let entry =
            entry.map_err(|error| StorageError::io("scan area usage entry", directory, error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect area usage entry", &entry.path(), error))?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_json_paths(&entry.path(), depth + 1, output)?;
        } else if file_type.is_file() && entry.path().extension().is_some_and(|ext| ext == "json") {
            output.push(entry.path());
        }
    }
    Ok(())
}

fn now() -> Result<UtcTimestamp, StorageError> {
    UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .map_err(StorageError::InvalidDocument)
}
