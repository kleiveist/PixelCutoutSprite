mod budget;
mod inventory;
mod jobs;

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::asset_io::{
    AssetImportError, AssetRepository, AssetRepositoryError, ImportDecision, InspectedPackage,
    PngImporter, SheetRect, SizeHandling,
};
use crate::domain::{
    canonical_json_bytes, Area, Asset, AssetKind, AssetRevision, Direction, DomainDocument,
    ObjectId, PixelPoint, PixelSize, ProfileRevision, RevisionRef, Sha256Digest, SlotId,
    UtcTimestamp,
};
use crate::exports::{CancellationFlag, CancellationToken};
use crate::storage::{
    JsonStore, StorageError, TransactionFault, TransactionService, VaultLayout, VaultRoot,
    AREA_ADMIN_DIR,
};

use super::project_service::{require_writable, scan_projects};
use super::{VaultOpenMode, VaultService, VaultSessionContext};

pub use inventory::{
    AssetInventory, AssetInventoryFacets, AssetInventoryItem, AssetInventoryPage,
    AssetInventoryQuery, AssetInventorySort, AssetInventoryUsageFilter, AssetThumbnail, AssetUsage,
    InventoryLabel,
};
pub use jobs::{
    AssetImportJobError, AssetImportJobProgress, AssetImportJobRegistry, AssetImportJobResult,
    AssetImportJobStage, AssetImportJobStatus, AssetImportJobView, AssetInspectionRegistry,
    AssetInspectionRegistryError,
};

#[derive(Debug, thiserror::Error)]
pub enum AssetServiceError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Import(#[from] AssetImportError),
    #[error(transparent)]
    Repository(#[from] AssetRepositoryError),
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
    pub inspection_fingerprint: Sha256Digest,
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
    pub inspection_fingerprint: Sha256Digest,
    pub source: AssetImportSource,
    pub decisions: Vec<ImportDecision>,
}

#[derive(Debug)]
pub(super) struct AreaAssetContext {
    pub(super) folder: PathBuf,
    pub(super) area: Area,
    pub(super) profile: ProfileRevision,
}

#[derive(Debug, Clone)]
pub(super) struct StoredAsset {
    pub(super) folder: PathBuf,
    pub(super) asset: Asset,
    pub(super) revision: AssetRevision,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AssetService;

impl AssetService {
    /// Compatibility helper for in-process callers that need the complete metadata inventory.
    /// Desktop list views use [`Self::inventory_page`] so response size remains bounded.
    pub fn inventory(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
    ) -> Result<AssetInventory, AssetServiceError> {
        let session = vaults.context(session_id)?;
        let area = find_area_context(&session, area_id)?;
        inventory::build_inventory(&session, &area)
    }

    pub fn inventory_page(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
        cursor: Option<&str>,
        limit: Option<usize>,
    ) -> Result<AssetInventoryPage, AssetServiceError> {
        Self::inventory_page_query(
            vaults,
            session_id,
            area_id,
            &AssetInventoryQuery::default(),
            cursor,
            limit,
        )
    }

    pub fn inventory_page_query(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
        query: &AssetInventoryQuery,
        cursor: Option<&str>,
        limit: Option<usize>,
    ) -> Result<AssetInventoryPage, AssetServiceError> {
        let session = vaults.context(session_id)?;
        let area = find_area_context(&session, area_id)?;
        inventory::build_inventory_page(&session, &area, query, cursor, limit)
    }

    pub(crate) fn inventory_page_in_context(
        session: &VaultSessionContext,
        area_id: ObjectId,
        query: &AssetInventoryQuery,
        cursor: Option<&str>,
        limit: Option<usize>,
    ) -> Result<AssetInventoryPage, AssetServiceError> {
        let area = find_area_context(session, area_id)?;
        inventory::build_inventory_page(session, &area, query, cursor, limit)
    }

    pub fn thumbnail(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
        asset_id: ObjectId,
        revision: u32,
        max_edge: Option<u16>,
    ) -> Result<AssetThumbnail, AssetServiceError> {
        let session = vaults.context(session_id)?;
        let area = find_area_context(&session, area_id)?;
        inventory::build_thumbnail(&session.root, &area, asset_id, revision, max_edge)
    }

    pub(crate) fn thumbnail_in_context(
        session: &VaultSessionContext,
        area_id: ObjectId,
        asset_id: ObjectId,
        revision: u32,
        max_edge: Option<u16>,
    ) -> Result<AssetThumbnail, AssetServiceError> {
        let area = find_area_context(session, area_id)?;
        inventory::build_thumbnail(&session.root, &area, asset_id, revision, max_edge)
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
        budget::validate_import_budget(&source)?;
        let inspected = inspect_source(&source, &area)?;
        preview_inspection(&session.root, &area, source, &inspected)
    }

    pub(crate) fn inspect_sources_in_context_controlled<C>(
        session: &VaultSessionContext,
        area_id: ObjectId,
        paths: Vec<String>,
        is_cancelled: &C,
    ) -> Result<AssetImportInspection, AssetServiceError>
    where
        C: Fn() -> bool,
    {
        let area = find_area_context(session, area_id)?;
        let source = classify_source(paths)?;
        let mut budget_progress = |_: usize, _: usize| {};
        budget::validate_import_budget_controlled(&source, is_cancelled, &mut budget_progress)?;
        let mut inspect_progress = |_: usize, _: usize| {};
        let inspected =
            inspect_source_controlled(&source, &area, is_cancelled, &mut inspect_progress)?;
        if is_cancelled() {
            return Err(AssetImportError::Cancelled.into());
        }
        preview_inspection(&session.root, &area, source, &inspected)
    }

    pub fn import(
        vaults: &mut VaultService,
        session_id: ObjectId,
        request: ConfirmAssetImportRequest,
    ) -> Result<AssetInventory, AssetServiceError> {
        let transactions = TransactionService::default();
        Self::import_with_transactions(vaults, session_id, request, &transactions)
    }

    /// Test seam for interrupting the configured import path used by the desktop command.
    /// Normal application callers use [`Self::import`].
    #[doc(hidden)]
    pub fn import_with_transactions<F: TransactionFault>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        request: ConfirmAssetImportRequest,
        transactions: &TransactionService<F>,
    ) -> Result<AssetInventory, AssetServiceError> {
        let session = require_writable(vaults, session_id)?;
        let area = find_area_context(&session, request.area_id)?;
        budget::validate_import_budget(&request.source)?;
        let inspected = inspect_source(&request.source, &area)?;
        require_matching_inspection(&area, &request, &inspected)?;
        validate_decisions(&inspected, &request.decisions)?;
        AssetRepository.import_configured_package_with_transactions(
            &session.root,
            &area.folder,
            area.area.id,
            &inspected,
            (&request.decisions, &area.profile),
            transactions,
        )?;
        vaults.refresh_index(session_id)?;
        let refreshed = vaults.context(session_id)?;
        inventory::build_inventory(&refreshed, &area)
    }

    #[doc(hidden)]
    pub fn execute_import_job<P>(
        root: &VaultRoot,
        request: ConfirmAssetImportRequest,
        cancellation: &CancellationFlag,
        report: &mut P,
    ) -> Result<Vec<AssetInventoryItem>, AssetServiceError>
    where
        P: FnMut(AssetImportJobProgress),
    {
        let session = VaultSessionContext {
            root: root.clone(),
            mode: VaultOpenMode::ReadWrite,
        };
        let area = find_area_context(&session, request.area_id)?;
        let is_cancelled = || cancellation.is_cancelled();
        let mut preflight_progress = |completed: usize, total: usize| {
            report(AssetImportJobProgress {
                stage: AssetImportJobStage::Preflight,
                completed,
                total,
                message: format!("Validated {completed} of {total} source images"),
            });
        };
        let budget = budget::validate_import_budget_controlled(
            &request.source,
            &is_cancelled,
            &mut preflight_progress,
        )?;
        report(AssetImportJobProgress {
            stage: AssetImportJobStage::Decoding,
            completed: 0,
            total: budget.entries,
            message: "Decoding bounded PNG sources".to_owned(),
        });
        let mut decode_progress = |completed: usize, total: usize| {
            report(AssetImportJobProgress {
                stage: AssetImportJobStage::Decoding,
                completed,
                total,
                message: format!("Decoded {completed} of {total} PNG sources"),
            });
        };
        let inspected =
            inspect_source_controlled(&request.source, &area, &is_cancelled, &mut decode_progress)?;
        require_matching_inspection(&area, &request, &inspected)?;
        validate_decisions(&inspected, &request.decisions)?;
        report(AssetImportJobProgress {
            stage: AssetImportJobStage::Staging,
            completed: 0,
            total: budget.entries,
            message: "Staging imported assets".to_owned(),
        });
        let mut stage_progress = |completed: usize, total: usize| {
            report(AssetImportJobProgress {
                stage: if completed == total {
                    AssetImportJobStage::Committing
                } else {
                    AssetImportJobStage::Staging
                },
                completed: if completed == total { 0 } else { completed },
                total: if completed == total { 1 } else { total },
                message: if completed == total {
                    "Committing the import transaction".to_owned()
                } else {
                    format!("Staged {completed} of {total} assets")
                },
            });
        };
        let imported = AssetRepository.import_configured_package_controlled(
            root,
            &area.folder,
            area.area.id,
            &inspected,
            (&request.decisions, &area.profile),
            (&is_cancelled, &mut stage_progress),
        )?;
        report(AssetImportJobProgress {
            stage: AssetImportJobStage::Committing,
            completed: 1,
            total: 1,
            message: "Import transaction committed".to_owned(),
        });
        Ok(imported.into_iter().map(inventory::imported_item).collect())
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
        inventory::build_inventory(&refreshed, &area)
    }
}

fn classify_source(paths: Vec<String>) -> Result<AssetImportSource, AssetServiceError> {
    if paths.is_empty() || paths.len() > budget::MAXIMUM_IMPORT_ENTRIES {
        return Err(AssetImportError::InvalidPackage(format!(
            "select between 1 and {} PNG files or one package JSON",
            budget::MAXIMUM_IMPORT_ENTRIES
        ))
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

pub(super) fn validate_selected_file(path: &Path, kind: &str) -> Result<(), AssetServiceError> {
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
    inspect_source_controlled(source, area, &|| false, &mut |_, _| {})
}

fn inspect_source_controlled<C, P>(
    source: &AssetImportSource,
    area: &AreaAssetContext,
    is_cancelled: &C,
    progress: &mut P,
) -> Result<InspectedPackage, AssetServiceError>
where
    C: Fn() -> bool,
    P: FnMut(usize, usize),
{
    let allowed_slots = area
        .profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    // Repeat the service's entry bound in the final, actually decoded snapshot. The package
    // path is mutable external input and may have changed since the budget preflight.
    let importer = PngImporter::default().with_maximum_entries(budget::MAXIMUM_IMPORT_ENTRIES);
    let inspected = match source {
        AssetImportSource::Package { path } => {
            validate_selected_file(Path::new(path), "package JSON")?;
            importer.inspect_package_controlled(
                Path::new(path),
                &allowed_slots,
                is_cancelled,
                progress,
            )?
        }
        AssetImportSource::LoosePngs { paths } => {
            let paths = paths.iter().map(PathBuf::from).collect::<Vec<_>>();
            importer.inspect_loose_pngs_controlled(
                &paths,
                area.profile.reference(),
                &allowed_slots,
                is_cancelled,
                progress,
            )?
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

fn require_matching_inspection(
    area: &AreaAssetContext,
    request: &ConfirmAssetImportRequest,
    inspected: &InspectedPackage,
) -> Result<(), AssetServiceError> {
    let actual = inspection_fingerprint(area, &request.source, inspected)?;
    if actual != request.inspection_fingerprint {
        return Err(AssetImportError::InvalidPackage(
            "asset sources changed after review; inspect them again before importing".to_owned(),
        )
        .into());
    }
    Ok(())
}

fn inspection_fingerprint(
    area: &AreaAssetContext,
    source: &AssetImportSource,
    inspected: &InspectedPackage,
) -> Result<Sha256Digest, AssetServiceError> {
    let entries = inspected
        .entries
        .iter()
        .map(|entry| {
            serde_json::json!({
                "entry_index": entry.entry_index,
                "source_path": entry.source_path.to_string_lossy(),
                "content_hash": entry.content_hash,
            })
        })
        .collect::<Vec<_>>();
    let payload = serde_json::json!({
        "format": "pixel-cutout-sprite-asset-inspection-v1",
        "area_id": area.area.id,
        "profile_ref": area.profile.reference(),
        "source": source,
        "package_content_hash": inspected.package_content_hash,
        "package": inspected.package,
        "entries": entries,
    });
    let bytes = canonical_json_bytes(&payload).map_err(StorageError::InvalidDocument)?;
    Ok(Sha256Digest::parse(format!("{:x}", Sha256::digest(bytes)))
        .expect("SHA-256 formatter is valid"))
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
    let inspection_fingerprint = inspection_fingerprint(area, &source, inspected)?;
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
        inspection_fingerprint,
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

pub(super) fn scan_assets(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<Vec<StoredAsset>, AssetServiceError> {
    scan_asset_folders(root, area_folder)?
        .into_iter()
        .map(|folder| load_stored_asset(root, folder))
        .collect()
}

pub(super) fn scan_asset_folders(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<Vec<PathBuf>, AssetServiceError> {
    let directory = root.resolve(&area_folder.join(AREA_ADMIN_DIR).join("assets"))?;
    if !directory.as_path().exists() {
        return Ok(Vec::new());
    }
    let mut folders = Vec::new();
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
        folders.push(directory.relative().join(entry.file_name()));
    }
    folders.sort_by(|left, right| {
        left.file_name()
            .map(|name| name.to_string_lossy())
            .cmp(&right.file_name().map(|name| name.to_string_lossy()))
    });
    Ok(folders)
}

pub(super) fn load_stored_asset(
    root: &VaultRoot,
    folder: PathBuf,
) -> Result<StoredAsset, AssetServiceError> {
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
    Ok(StoredAsset {
        folder,
        asset,
        revision,
    })
}

fn now() -> Result<UtcTimestamp, StorageError> {
    UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .map_err(StorageError::InvalidDocument)
}
