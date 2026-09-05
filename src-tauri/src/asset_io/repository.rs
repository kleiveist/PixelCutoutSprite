use std::fs;
use std::path::Path;

use chrono::Utc;
use image::{imageops::FilterType, DynamicImage, GenericImage, ImageFormat, RgbaImage};
use sha2::{Digest, Sha256};

use crate::domain::{
    Asset, AssetRevision, DocumentKind, DomainCatalog, DomainDocument, ObjectId, PixelPoint,
    PixelSize, ProfileRevision, RelativePath, Sha256Digest, SlotId, UtcTimestamp, SCHEMA_VERSION,
};
use crate::storage::{object_folder, JsonStore, StorageError, VaultRoot};

use super::{
    resolve_assignment, AssetImportError, ImportAssignment, ImportDecision, InspectedEntry,
    InspectedPackage, PackageEntry, SheetRect, SizeHandling,
};

#[derive(Debug, Clone)]
struct ResolvedImport {
    entry_index: usize,
    slot_id: SlotId,
    direction: crate::domain::Direction,
    size_handling: SizeHandling,
    target_size: Option<PixelSize>,
    target_pivot: Option<PixelPoint>,
}

#[derive(Debug, Clone, Copy)]
struct ImageWriteOptions {
    handling: SizeHandling,
    target_size: Option<PixelSize>,
    target_pivot: Option<PixelPoint>,
}

#[derive(Debug)]
pub struct ImportedAsset {
    pub asset: Asset,
    pub revision: AssetRevision,
}

#[derive(Debug, thiserror::Error)]
pub enum AssetRepositoryError {
    #[error(transparent)]
    Import(#[from] AssetImportError),
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error("cannot write imported PNG `{path}`: {message}")]
    Image { path: String, message: String },
    #[error("asset manifest does not contain the expected asset")]
    UnexpectedManifest,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct AssetRepository;

impl AssetRepository {
    pub fn import_package(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
        inspected: &InspectedPackage,
        assignments: &[ImportAssignment],
    ) -> Result<Vec<ImportedAsset>, AssetRepositoryError> {
        let resolved = inspected
            .entries
            .iter()
            .map(|source| {
                let (slot_id, direction) =
                    resolve_assignment(inspected, source.entry_index, assignments)?;
                Ok(ResolvedImport {
                    entry_index: source.entry_index,
                    slot_id,
                    direction,
                    size_handling: SizeHandling::KeepOriginal,
                    target_size: None,
                    target_pivot: None,
                })
            })
            .collect::<Result<Vec<_>, AssetImportError>>()?;
        self.import_resolved(vault, area_path, area_id, inspected, &resolved)
    }

    pub fn import_configured_package(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
        inspected: &InspectedPackage,
        decisions: &[ImportDecision],
        profile: &ProfileRevision,
    ) -> Result<Vec<ImportedAsset>, AssetRepositoryError> {
        if inspected.package.profile_ref != profile.reference() || profile.area_id != area_id {
            return Err(AssetRepositoryError::Import(
                AssetImportError::InvalidPackage(
                    "package profile does not match the selected area profile".to_owned(),
                ),
            ));
        }
        let mut resolved = Vec::with_capacity(inspected.entries.len());
        for source in &inspected.entries {
            let decision = decisions
                .iter()
                .find(|candidate| candidate.entry_index == source.entry_index);
            let (slot_id, direction) = match decision {
                Some(value) => (value.slot_id.clone(), value.direction),
                None => resolve_assignment(inspected, source.entry_index, &[])?,
            };
            let slot = profile
                .slots
                .iter()
                .find(|candidate| candidate.id == slot_id)
                .ok_or_else(|| {
                    AssetRepositoryError::Import(AssetImportError::InvalidEntry {
                        entry: source.entry_index,
                        message: "slot does not exist in the selected profile".to_owned(),
                    })
                })?;
            resolved.push(ResolvedImport {
                entry_index: source.entry_index,
                slot_id,
                direction,
                size_handling: decision
                    .map(|value| value.size_handling)
                    .unwrap_or_default(),
                target_size: Some(slot.size_px),
                target_pivot: Some(slot.pivot_px),
            });
        }
        self.import_resolved(vault, area_path, area_id, inspected, &resolved)
    }

    fn import_resolved(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
        inspected: &InspectedPackage,
        resolved: &[ResolvedImport],
    ) -> Result<Vec<ImportedAsset>, AssetRepositoryError> {
        let timestamp =
            UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
                .map_err(StorageError::InvalidDocument)?;
        let mut imported = Vec::with_capacity(inspected.entries.len());
        for source in &inspected.entries {
            let entry = &inspected.package.entries[source.entry_index];
            let selection = resolved
                .iter()
                .find(|candidate| candidate.entry_index == source.entry_index)
                .ok_or(AssetRepositoryError::UnexpectedManifest)?;
            let asset_id = ObjectId::new();
            let folder = object_folder(&entry.name, asset_id)?;
            let relative_base = area_path.join(".area/assets").join(folder);
            let revision_dir = relative_base.join("r0001");
            let (source_file, image_size_px, pivot_px, effective_hash) = write_revision_images(
                vault,
                &revision_dir,
                relative_base.file_name().expect("asset folder is present"),
                "r0001",
                source,
                entry,
                ImageWriteOptions {
                    handling: selection.size_handling,
                    target_size: selection.target_size,
                    target_pivot: selection.target_pivot,
                },
            )?;
            let asset = Asset {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Asset,
                id: asset_id,
                revision: 1,
                area_id,
                name: entry.name.clone(),
                original_name: Path::new(&entry.source)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("source.png")
                    .to_owned(),
                asset_kind: entry.asset_kind,
                label_ids: Vec::new(),
                released_revisions: vec![1],
                origin_note: entry.origin_note.clone(),
                license_note: entry.license_note.clone(),
                archived: false,
                created_at: timestamp,
                updated_at: timestamp,
            };
            let revision = AssetRevision {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::AssetRevision,
                asset_id,
                revision: 1,
                profile_ref: inspected.package.profile_ref,
                slot_id: selection.slot_id.clone(),
                direction: selection.direction,
                variant: entry.variant.clone(),
                source_file,
                image_size_px,
                pivot_px,
                content_hash: effective_hash,
                sprite_mirroring_allowed: entry.sprite_mirroring_allowed,
                published_at: timestamp,
            };
            asset.validate().map_err(StorageError::InvalidDocument)?;
            revision.validate().map_err(StorageError::InvalidDocument)?;
            let manifest = vault.resolve(&relative_base.join("asset.json"))?;
            let revision_manifest = vault.resolve(&revision_dir.join("revision.json"))?;
            JsonStore::default().create(&manifest, &DomainDocument::Asset(asset.clone()))?;
            JsonStore::default().create(
                &revision_manifest,
                &DomainDocument::AssetRevision(revision.clone()),
            )?;
            imported.push(ImportedAsset { asset, revision });
        }
        Ok(imported)
    }

    pub fn add_revision(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        asset_folder: &Path,
        inspected: &InspectedPackage,
        entry_index: usize,
        assignments: &[ImportAssignment],
    ) -> Result<ImportedAsset, AssetRepositoryError> {
        let relative_base = area_path.join(".area/assets").join(asset_folder);
        let manifest = vault.resolve(&relative_base.join("asset.json"))?;
        let store = JsonStore::default();
        let loaded = store.load(&manifest)?;
        let DomainDocument::Asset(mut asset) = loaded.value else {
            return Err(AssetRepositoryError::UnexpectedManifest);
        };
        let source = inspected
            .entries
            .iter()
            .find(|candidate| candidate.entry_index == entry_index)
            .ok_or(AssetRepositoryError::UnexpectedManifest)?;
        let entry = &inspected.package.entries[entry_index];
        let (slot_id, direction) = resolve_assignment(inspected, entry_index, assignments)?;
        let revision_number = asset
            .released_revisions
            .iter()
            .copied()
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or(AssetRepositoryError::UnexpectedManifest)?;
        let revision_name = format!("r{revision_number:04}");
        let revision_dir = relative_base.join(&revision_name);
        let (source_file, image_size_px, pivot_px, content_hash) = write_revision_images(
            vault,
            &revision_dir,
            asset_folder.as_os_str(),
            &revision_name,
            source,
            entry,
            ImageWriteOptions {
                handling: SizeHandling::KeepOriginal,
                target_size: None,
                target_pivot: None,
            },
        )?;
        let timestamp =
            UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
                .map_err(StorageError::InvalidDocument)?;
        let revision = AssetRevision {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::AssetRevision,
            asset_id: asset.id,
            revision: revision_number,
            profile_ref: inspected.package.profile_ref,
            slot_id,
            direction,
            variant: entry.variant.clone(),
            source_file,
            image_size_px,
            pivot_px,
            content_hash,
            sprite_mirroring_allowed: entry.sprite_mirroring_allowed,
            published_at: timestamp,
        };
        revision.validate().map_err(StorageError::InvalidDocument)?;
        let revision_manifest = vault.resolve(&revision_dir.join("revision.json"))?;
        store.create(
            &revision_manifest,
            &DomainDocument::AssetRevision(revision.clone()),
        )?;
        asset.revision = asset.revision.saturating_add(1);
        asset.released_revisions.push(revision_number);
        asset.updated_at = timestamp;
        asset.validate().map_err(StorageError::InvalidDocument)?;
        store.compare_and_swap(
            &manifest,
            &loaded.stamp,
            &DomainDocument::Asset(asset.clone()),
        )?;
        Ok(ImportedAsset { asset, revision })
    }
}

pub fn asset_usage_count(catalog: &DomainCatalog, asset_id: ObjectId) -> usize {
    let appearance_uses = catalog
        .appearances
        .iter()
        .flat_map(|appearance| {
            appearance
                .slots
                .iter()
                .map(|slot| slot.asset.asset_id)
                .chain(appearance.equipment.iter().map(|item| item.asset.asset_id))
        })
        .filter(|candidate| *candidate == asset_id)
        .count();
    let draft_uses = catalog
        .outfit_drafts
        .iter()
        .flat_map(|draft| draft.selected_assets.iter().map(|asset| asset.asset_id))
        .filter(|candidate| *candidate == asset_id)
        .count();
    appearance_uses + draft_uses
}

fn copy_image(source: &Path, destination: &Path) -> Result<(), AssetRepositoryError> {
    fs::copy(source, destination).map_err(|error| AssetRepositoryError::Image {
        path: destination.display().to_string(),
        message: error.to_string(),
    })?;
    Ok(())
}

fn write_revision_images(
    vault: &VaultRoot,
    revision_dir: &Path,
    asset_folder: &std::ffi::OsStr,
    revision_name: &str,
    source: &InspectedEntry,
    entry: &PackageEntry,
    options: ImageWriteOptions,
) -> Result<(RelativePath, PixelSize, PixelPoint, Sha256Digest), AssetRepositoryError> {
    vault.ensure_directory(revision_dir)?;
    let original = vault.resolve(&revision_dir.join("original.png"))?;
    copy_image(&source.source_path, original.as_path())?;
    let rendered = vault.resolve(&revision_dir.join("source.png"))?;
    let cropped = cropped_source(source, entry);
    let original_size = PixelSize(cropped.width() as u16, cropped.height() as u16);
    let (image_size_px, pivot_px) = match options.handling {
        SizeHandling::KeepOriginal if entry.sheet_rect_px.is_none() => {
            copy_image(&source.source_path, rendered.as_path())?;
            (original_size, entry.pivot_px)
        }
        SizeHandling::KeepOriginal => {
            save_png(&cropped, rendered.as_path())?;
            (original_size, entry.pivot_px)
        }
        SizeHandling::PadTransparent => {
            let size = require_target_size(options.target_size, source.entry_index)?;
            let pivot = options
                .target_pivot
                .ok_or_else(|| missing_size_target(source.entry_index))?;
            let padded = pad_to_slot(&cropped, entry.pivot_px, size, pivot, source.entry_index)?;
            save_png(&DynamicImage::ImageRgba8(padded), rendered.as_path())?;
            (size, pivot)
        }
        SizeHandling::RescaleNearest => {
            let size = require_target_size(options.target_size, source.entry_index)?;
            let resized =
                cropped.resize_exact(u32::from(size.0), u32::from(size.1), FilterType::Nearest);
            save_png(&resized, rendered.as_path())?;
            (size, scaled_pivot(entry.pivot_px, original_size, size))
        }
    };
    let rendered_bytes =
        fs::read(rendered.as_path()).map_err(|error| AssetRepositoryError::Image {
            path: rendered.as_path().display().to_string(),
            message: error.to_string(),
        })?;
    let effective_hash = Sha256Digest::parse(format!("{:x}", Sha256::digest(&rendered_bytes)))
        .expect("SHA-256 formatter is valid");
    let source_file = RelativePath::parse(
        Path::new(".area/assets")
            .join(asset_folder)
            .join(revision_name)
            .join("source.png")
            .to_string_lossy()
            .replace('\\', "/"),
    )
    .map_err(StorageError::InvalidDocument)?;
    Ok((source_file, image_size_px, pivot_px, effective_hash))
}

fn cropped_source(source: &InspectedEntry, entry: &PackageEntry) -> DynamicImage {
    match entry.sheet_rect_px {
        Some(SheetRect(x, y, width, height)) => source.decoded.crop_imm(x, y, width, height),
        None => source.decoded.clone(),
    }
}

fn save_png(image: &DynamicImage, destination: &Path) -> Result<(), AssetRepositoryError> {
    image
        .save_with_format(destination, ImageFormat::Png)
        .map_err(|error| AssetRepositoryError::Image {
            path: destination.display().to_string(),
            message: error.to_string(),
        })
}

fn require_target_size(
    size: Option<PixelSize>,
    entry: usize,
) -> Result<PixelSize, AssetRepositoryError> {
    size.ok_or_else(|| missing_size_target(entry))
}

fn missing_size_target(entry: usize) -> AssetRepositoryError {
    AssetRepositoryError::Import(AssetImportError::InvalidEntry {
        entry,
        message: "size handling needs a selected profile slot".to_owned(),
    })
}

fn pad_to_slot(
    source: &DynamicImage,
    source_pivot: PixelPoint,
    target_size: PixelSize,
    target_pivot: PixelPoint,
    entry: usize,
) -> Result<RgbaImage, AssetRepositoryError> {
    let offset_x = i32::from(target_pivot.0) - i32::from(source_pivot.0);
    let offset_y = i32::from(target_pivot.1) - i32::from(source_pivot.1);
    if offset_x < 0
        || offset_y < 0
        || offset_x + source.width() as i32 > i32::from(target_size.0)
        || offset_y + source.height() as i32 > i32::from(target_size.1)
    {
        return Err(AssetRepositoryError::Import(
            AssetImportError::InvalidEntry {
                entry,
                message: "transparent padding would crop pixels; keep the original, choose another variant, or explicitly rescale".to_owned(),
            },
        ));
    }
    let mut target = RgbaImage::new(u32::from(target_size.0), u32::from(target_size.1));
    let source = source.to_rgba8();
    target
        .copy_from(&source, offset_x as u32, offset_y as u32)
        .map_err(|error| AssetRepositoryError::Image {
            path: "derived transparent padding".to_owned(),
            message: error.to_string(),
        })?;
    Ok(target)
}

fn scaled_pivot(source: PixelPoint, old_size: PixelSize, new_size: PixelSize) -> PixelPoint {
    PixelPoint(
        scale_coordinate(source.0, old_size.0, new_size.0),
        scale_coordinate(source.1, old_size.1, new_size.1),
    )
}

fn scale_coordinate(value: i16, old_axis: u16, new_axis: u16) -> i16 {
    let numerator = i64::from(value) * i64::from(new_axis);
    let denominator = i64::from(old_axis);
    let rounded = if numerator >= 0 {
        (numerator + denominator / 2) / denominator
    } else {
        (numerator - denominator / 2) / denominator
    };
    rounded.clamp(i64::from(i16::MIN), i64::from(i16::MAX)) as i16
}
