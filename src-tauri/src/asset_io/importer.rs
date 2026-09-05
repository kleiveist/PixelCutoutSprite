use std::collections::HashSet;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use image::{codecs::png::PngDecoder, ColorType, DynamicImage, ImageDecoder, RgbaImage};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::domain::{
    AssetKind, Direction, PixelPoint, PixelSize, RelativePath, RevisionRef, Sha256Digest, SlotId,
};
use serde::{Deserialize, Serialize};

use super::{AssetPackage, PackageEntry, SheetRect, ASSET_PACKAGE_FORMAT};

const DEFAULT_MAXIMUM_ENTRIES: usize = 512;
const DEFAULT_MAXIMUM_AGGREGATE_ENCODED_BYTES: u64 = 128 * 1024 * 1024;
const DEFAULT_MAXIMUM_AGGREGATE_DECODED_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum AssetImportError {
    #[error("cannot read `{path}`: {message}")]
    Io { path: PathBuf, message: String },
    #[error("invalid package JSON: {0}")]
    InvalidPackage(String),
    #[error("package entry {entry}: {message}")]
    InvalidEntry { entry: usize, message: String },
    #[error("package entry {entry} is not assigned to a slot and direction")]
    AssignmentRequired { entry: usize },
    #[error("asset source inspection was cancelled")]
    Cancelled,
}

#[derive(Debug, Clone, Copy)]
pub struct ImportLimits {
    pub maximum_file_bytes: u64,
    pub maximum_axis_px: u32,
    pub maximum_decoded_pixels: u64,
}

impl Default for ImportLimits {
    fn default() -> Self {
        Self {
            maximum_file_bytes: 32 * 1024 * 1024,
            maximum_axis_px: 4096,
            maximum_decoded_pixels: 16 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilenameSuggestion {
    pub slot_id: SlotId,
    pub direction: Direction,
    pub variant: String,
}

#[derive(Debug)]
pub struct InspectedEntry {
    pub entry_index: usize,
    pub source_path: PathBuf,
    pub content_hash: Sha256Digest,
    pub decoded: DynamicImage,
    pub suggestion: Option<FilenameSuggestion>,
}

#[derive(Debug)]
pub struct InspectedPackage {
    pub package_path: PathBuf,
    pub package_content_hash: Option<Sha256Digest>,
    pub package: AssetPackage,
    pub entries: Vec<InspectedEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportAssignment {
    pub entry_index: usize,
    pub slot_id: SlotId,
    pub direction: Direction,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SizeHandling {
    #[default]
    KeepOriginal,
    PadTransparent,
    RescaleNearest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportDecision {
    pub entry_index: usize,
    pub slot_id: SlotId,
    pub direction: Direction,
    #[serde(default)]
    pub size_handling: SizeHandling,
}

#[derive(Debug, Clone, Copy)]
pub struct PngImporter {
    limits: ImportLimits,
    maximum_entries: usize,
    maximum_aggregate_encoded_bytes: u64,
    maximum_aggregate_decoded_bytes: u64,
}

impl Default for PngImporter {
    fn default() -> Self {
        Self {
            limits: ImportLimits::default(),
            maximum_entries: DEFAULT_MAXIMUM_ENTRIES,
            maximum_aggregate_encoded_bytes: DEFAULT_MAXIMUM_AGGREGATE_ENCODED_BYTES,
            maximum_aggregate_decoded_bytes: DEFAULT_MAXIMUM_AGGREGATE_DECODED_BYTES,
        }
    }
}

impl PngImporter {
    pub fn with_limits(limits: ImportLimits) -> Self {
        Self {
            limits,
            ..Self::default()
        }
    }

    pub fn with_maximum_entries(mut self, maximum_entries: usize) -> Self {
        self.maximum_entries = maximum_entries.clamp(1, DEFAULT_MAXIMUM_ENTRIES);
        self
    }

    #[doc(hidden)]
    pub fn with_aggregate_limits(
        mut self,
        maximum_encoded_bytes: u64,
        maximum_decoded_bytes: u64,
    ) -> Self {
        self.maximum_aggregate_encoded_bytes = maximum_encoded_bytes;
        self.maximum_aggregate_decoded_bytes = maximum_decoded_bytes;
        self
    }

    pub fn inspect_package(
        &self,
        package_path: &Path,
        allowed_slots: &HashSet<SlotId>,
    ) -> Result<InspectedPackage, AssetImportError> {
        self.inspect_package_controlled(package_path, allowed_slots, &|| false, &mut |_, _| {})
    }

    pub fn inspect_package_controlled<C, P>(
        &self,
        package_path: &Path,
        allowed_slots: &HashSet<SlotId>,
        is_cancelled: &C,
        progress: &mut P,
    ) -> Result<InspectedPackage, AssetImportError>
    where
        C: Fn() -> bool,
        P: FnMut(usize, usize),
    {
        if is_cancelled() {
            return Err(AssetImportError::Cancelled);
        }
        let bytes = fs::read(package_path).map_err(|error| io(package_path, error))?;
        if bytes.len() as u64 > self.limits.maximum_file_bytes {
            return Err(AssetImportError::InvalidPackage(
                "package JSON exceeds the file-size limit".to_owned(),
            ));
        }
        let package: AssetPackage = serde_json::from_slice(&bytes)
            .map_err(|error| AssetImportError::InvalidPackage(error.to_string()))?;
        validate_package_header(&package, self.maximum_entries)?;
        let source_root = package_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .canonicalize()
            .map_err(|error| io(package_path, error))?;
        let mut entries = Vec::with_capacity(package.entries.len());
        let mut aggregate_encoded_bytes = 0_u64;
        let mut aggregate_decoded_bytes = 0_u64;
        for (entry_index, entry) in package.entries.iter().enumerate() {
            if is_cancelled() {
                return Err(AssetImportError::Cancelled);
            }
            validate_entry_contract(entry, entry_index, allowed_slots)?;
            let relative = RelativePath::parse(entry.source.clone()).map_err(|error| {
                AssetImportError::InvalidEntry {
                    entry: entry_index,
                    message: error.to_string(),
                }
            })?;
            let source_path = source_root.join(relative.as_str());
            reject_symlink_or_escape(&source_root, &source_path, entry_index)?;
            let encoded = fs::read(&source_path).map_err(|error| io(&source_path, error))?;
            if encoded.len() as u64 > self.limits.maximum_file_bytes {
                return invalid(entry_index, "PNG exceeds the encoded file-size limit");
            }
            add_to_aggregate(
                &mut aggregate_encoded_bytes,
                encoded.len() as u64,
                self.maximum_aggregate_encoded_bytes,
                "encoded PNG data",
            )?;
            let decoded = decode_png(
                &source_path,
                &encoded,
                self.limits,
                entry_index,
                &mut aggregate_decoded_bytes,
                self.maximum_aggregate_decoded_bytes,
            )?;
            if decoded.width() > 1024 || decoded.height() > 1024 {
                return invalid(
                    entry_index,
                    "a loose PNG exceeds the 1024 px asset limit; describe sheet cells in a package",
                );
            }
            if decoded.width() != u32::from(entry.image_size_px.0)
                || decoded.height() != u32::from(entry.image_size_px.1)
            {
                return invalid(
                    entry_index,
                    "declared image dimensions do not match the PNG",
                );
            }
            validate_rect(
                entry.sheet_rect_px,
                decoded.width(),
                decoded.height(),
                entry_index,
            )?;
            let hash = Sha256Digest::parse(format!("{:x}", Sha256::digest(&encoded)))
                .expect("SHA-256 formatter is valid");
            entries.push(InspectedEntry {
                entry_index,
                source_path,
                content_hash: hash,
                decoded,
                suggestion: filename_suggestion(&entry.source, allowed_slots),
            });
            progress(entry_index + 1, package.entries.len());
        }
        Ok(InspectedPackage {
            package_path: package_path.to_path_buf(),
            package_content_hash: Some(
                Sha256Digest::parse(format!("{:x}", Sha256::digest(&bytes)))
                    .expect("SHA-256 formatter is valid"),
            ),
            package,
            entries,
        })
    }

    pub fn inspect_loose_pngs(
        &self,
        paths: &[PathBuf],
        profile_ref: RevisionRef,
        allowed_slots: &HashSet<SlotId>,
    ) -> Result<InspectedPackage, AssetImportError> {
        self.inspect_loose_pngs_controlled(
            paths,
            profile_ref,
            allowed_slots,
            &|| false,
            &mut |_, _| {},
        )
    }

    pub fn inspect_loose_pngs_controlled<C, P>(
        &self,
        paths: &[PathBuf],
        profile_ref: RevisionRef,
        allowed_slots: &HashSet<SlotId>,
        is_cancelled: &C,
        progress: &mut P,
    ) -> Result<InspectedPackage, AssetImportError>
    where
        C: Fn() -> bool,
        P: FnMut(usize, usize),
    {
        if paths.is_empty() || paths.len() > self.maximum_entries {
            return Err(AssetImportError::InvalidPackage(format!(
                "select between 1 and {} PNG files",
                self.maximum_entries
            )));
        }
        let mut package_entries = Vec::with_capacity(paths.len());
        let mut inspected_entries = Vec::with_capacity(paths.len());
        let mut aggregate_encoded_bytes = 0_u64;
        let mut aggregate_decoded_bytes = 0_u64;
        for (entry_index, selected_path) in paths.iter().enumerate() {
            if is_cancelled() {
                return Err(AssetImportError::Cancelled);
            }
            reject_selected_symlink(selected_path, entry_index)?;
            let source_path = selected_path
                .canonicalize()
                .map_err(|error| io(selected_path, error))?;
            let encoded = fs::read(&source_path).map_err(|error| io(&source_path, error))?;
            if encoded.len() as u64 > self.limits.maximum_file_bytes {
                return invalid(entry_index, "PNG exceeds the encoded file-size limit");
            }
            add_to_aggregate(
                &mut aggregate_encoded_bytes,
                encoded.len() as u64,
                self.maximum_aggregate_encoded_bytes,
                "encoded PNG data",
            )?;
            let decoded = decode_png(
                &source_path,
                &encoded,
                self.limits,
                entry_index,
                &mut aggregate_decoded_bytes,
                self.maximum_aggregate_decoded_bytes,
            )?;
            let width =
                u16::try_from(decoded.width()).map_err(|_| AssetImportError::InvalidEntry {
                    entry: entry_index,
                    message: "PNG width exceeds the asset contract".to_owned(),
                })?;
            let height =
                u16::try_from(decoded.height()).map_err(|_| AssetImportError::InvalidEntry {
                    entry: entry_index,
                    message: "PNG height exceeds the asset contract".to_owned(),
                })?;
            let file_name = source_path
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| AssetImportError::InvalidEntry {
                    entry: entry_index,
                    message: "PNG file name is not valid UTF-8".to_owned(),
                })?;
            let stem = source_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Imported PNG")
                .replace("__", " ")
                .replace('_', " ");
            crate::domain::validate_name("asset_package.entry.name", &stem).map_err(|error| {
                AssetImportError::InvalidEntry {
                    entry: entry_index,
                    message: error.to_string(),
                }
            })?;
            let suggestion = filename_suggestion(file_name, allowed_slots);
            let variant = suggestion
                .as_ref()
                .map(|value| value.variant.clone())
                .unwrap_or_else(|| "base".to_owned());
            package_entries.push(PackageEntry {
                name: stem,
                source: file_name.to_owned(),
                asset_kind: AssetKind::Body,
                slot_id: None,
                direction: None,
                variant,
                image_size_px: PixelSize(width, height),
                pivot_px: PixelPoint((width / 2) as i16, height as i16),
                sheet_rect_px: None,
                sprite_mirroring_allowed: false,
                origin_note: "Imported as a loose PNG".to_owned(),
                license_note: "Unspecified".to_owned(),
            });
            let content_hash = Sha256Digest::parse(format!("{:x}", Sha256::digest(&encoded)))
                .expect("SHA-256 formatter is valid");
            inspected_entries.push(InspectedEntry {
                entry_index,
                source_path,
                content_hash,
                decoded,
                suggestion,
            });
            progress(entry_index + 1, paths.len());
        }
        Ok(InspectedPackage {
            package_path: PathBuf::new(),
            package_content_hash: None,
            package: AssetPackage {
                format: ASSET_PACKAGE_FORMAT.to_owned(),
                format_version: 1,
                profile_ref,
                entries: package_entries,
            },
            entries: inspected_entries,
        })
    }
}

pub fn filename_suggestion(
    file_name: &str,
    allowed_slots: &HashSet<SlotId>,
) -> Option<FilenameSuggestion> {
    let stem = Path::new(file_name).file_stem()?.to_str()?;
    let mut parts = stem.split("__");
    let slot_id = SlotId::parse(parts.next()?).ok()?;
    let direction = match parts.next()? {
        "n" => Direction::N,
        "ne" => Direction::Ne,
        "e" => Direction::E,
        "se" => Direction::Se,
        "s" => Direction::S,
        "sw" => Direction::Sw,
        "w" => Direction::W,
        "nw" => Direction::Nw,
        _ => return None,
    };
    let variant = parts.next()?.to_owned();
    if parts.next().is_some() || variant.is_empty() || !allowed_slots.contains(&slot_id) {
        return None;
    }
    Some(FilenameSuggestion {
        slot_id,
        direction,
        variant,
    })
}

pub fn resolve_assignment(
    inspected: &InspectedPackage,
    entry_index: usize,
    assignments: &[ImportAssignment],
) -> Result<(SlotId, Direction), AssetImportError> {
    let entry = inspected.package.entries.get(entry_index).ok_or_else(|| {
        AssetImportError::InvalidPackage("entry index is out of range".to_owned())
    })?;
    if let (Some(slot), Some(direction)) = (&entry.slot_id, entry.direction) {
        return Ok((
            SlotId::parse(slot.clone()).map_err(|error| AssetImportError::InvalidEntry {
                entry: entry_index,
                message: error.to_string(),
            })?,
            direction,
        ));
    }
    assignments
        .iter()
        .find(|assignment| assignment.entry_index == entry_index)
        .map(|assignment| (assignment.slot_id.clone(), assignment.direction))
        .ok_or(AssetImportError::AssignmentRequired { entry: entry_index })
}

fn validate_package_header(
    package: &AssetPackage,
    maximum_entries: usize,
) -> Result<(), AssetImportError> {
    if package.format != ASSET_PACKAGE_FORMAT || package.format_version != 1 {
        return Err(AssetImportError::InvalidPackage(format!(
            "format must be `{ASSET_PACKAGE_FORMAT}` version 1"
        )));
    }
    package
        .profile_ref
        .validate("asset_package.profile_ref")
        .map_err(|error| AssetImportError::InvalidPackage(error.to_string()))?;
    if package.entries.is_empty() || package.entries.len() > maximum_entries {
        return Err(AssetImportError::InvalidPackage(format!(
            "entries must contain 1..={maximum_entries} items"
        )));
    }
    Ok(())
}

fn add_to_aggregate(
    aggregate: &mut u64,
    amount: u64,
    maximum: u64,
    description: &str,
) -> Result<(), AssetImportError> {
    *aggregate = aggregate.checked_add(amount).ok_or_else(|| {
        AssetImportError::InvalidPackage(format!("aggregate {description} size overflow"))
    })?;
    if *aggregate > maximum {
        return Err(AssetImportError::InvalidPackage(format!(
            "import exceeds the aggregate {description} budget"
        )));
    }
    Ok(())
}

fn validate_entry_contract(
    entry: &PackageEntry,
    index: usize,
    allowed_slots: &HashSet<SlotId>,
) -> Result<(), AssetImportError> {
    crate::domain::validate_name("asset_package.entry.name", &entry.name).map_err(|error| {
        AssetImportError::InvalidEntry {
            entry: index,
            message: error.to_string(),
        }
    })?;
    if entry.image_size_px.0 == 0 || entry.image_size_px.1 == 0 {
        return invalid(index, "declared image dimensions must be positive");
    }
    if entry.sheet_rect_px.is_none() {
        entry
            .image_size_px
            .validate("asset_package.entry.image_size_px")
            .map_err(|error| AssetImportError::InvalidEntry {
                entry: index,
                message: error.to_string(),
            })?;
    }
    if entry.slot_id.is_some() != entry.direction.is_some() {
        return invalid(
            index,
            "slot and direction must either both be declared or both remain unassigned",
        );
    }
    entry
        .pivot_px
        .validate("asset_package.entry.pivot_px")
        .map_err(|error| AssetImportError::InvalidEntry {
            entry: index,
            message: error.to_string(),
        })?;
    if let Some(slot) = &entry.slot_id {
        let slot = SlotId::parse(slot.clone()).map_err(|error| AssetImportError::InvalidEntry {
            entry: index,
            message: error.to_string(),
        })?;
        if !allowed_slots.contains(&slot) {
            return invalid(index, "slot does not exist in the selected profile");
        }
    }
    let portable_variant = !entry.variant.is_empty()
        && entry.variant.len() <= 64
        && entry
            .variant
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-');
    if !portable_variant {
        return invalid(index, "variant is not a portable identifier");
    }
    Ok(())
}

fn reject_selected_symlink(path: &Path, entry: usize) -> Result<(), AssetImportError> {
    if !path.is_absolute() {
        return invalid(entry, "selected PNG path must be absolute");
    }
    let metadata = fs::symlink_metadata(path).map_err(|error| io(path, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return invalid(
            entry,
            "selected PNG must be a real file, not a symbolic link",
        );
    }
    Ok(())
}

fn reject_symlink_or_escape(
    source_root: &Path,
    path: &Path,
    entry: usize,
) -> Result<(), AssetImportError> {
    let mut current = source_root.to_path_buf();
    let relative = path
        .strip_prefix(source_root)
        .map_err(|_| AssetImportError::InvalidEntry {
            entry,
            message: "source leaves the package directory".to_owned(),
        })?;
    for component in relative.components() {
        current.push(component);
        let metadata = fs::symlink_metadata(&current).map_err(|error| io(&current, error))?;
        if metadata.file_type().is_symlink() {
            return invalid(entry, "source path contains a symbolic link");
        }
    }
    let canonical = path.canonicalize().map_err(|error| io(path, error))?;
    if !canonical.starts_with(source_root) {
        return invalid(entry, "source resolves outside the package directory");
    }
    Ok(())
}

fn decode_png(
    _path: &Path,
    encoded: &[u8],
    limits: ImportLimits,
    entry: usize,
    aggregate_decoded_bytes: &mut u64,
    maximum_aggregate_decoded_bytes: u64,
) -> Result<DynamicImage, AssetImportError> {
    let decoder =
        PngDecoder::new(Cursor::new(encoded)).map_err(|error| AssetImportError::InvalidEntry {
            entry,
            message: format!("PNG decode failed: {error}"),
        })?;
    let (width, height) = decoder.dimensions();
    let pixels = u64::from(width) * u64::from(height);
    if width > limits.maximum_axis_px
        || height > limits.maximum_axis_px
        || pixels > limits.maximum_decoded_pixels
    {
        return invalid(entry, "decoded PNG dimensions exceed the configured limit");
    }
    if decoder.color_type() != ColorType::Rgba8 {
        return invalid(entry, "PNG must use 8-bit RGBA pixels");
    }
    let expected_bytes = pixels
        .checked_mul(4)
        .ok_or_else(|| AssetImportError::InvalidEntry {
            entry,
            message: "decoded PNG byte size overflow".to_owned(),
        })?;
    if decoder.total_bytes() != expected_bytes {
        return invalid(
            entry,
            "decoded PNG byte size is inconsistent with RGBA8 dimensions",
        );
    }
    add_to_aggregate(
        aggregate_decoded_bytes,
        decoder.total_bytes(),
        maximum_aggregate_decoded_bytes,
        "decoded RGBA data",
    )?;
    let mut rgba = RgbaImage::new(width, height);
    decoder
        .read_image(rgba.as_mut())
        .map_err(|error| AssetImportError::InvalidEntry {
            entry,
            message: format!("PNG decode failed: {error}"),
        })?;
    Ok(DynamicImage::ImageRgba8(rgba))
}

fn validate_rect(
    rect: Option<SheetRect>,
    width: u32,
    height: u32,
    entry: usize,
) -> Result<(), AssetImportError> {
    let Some(SheetRect(x, y, rect_width, rect_height)) = rect else {
        return Ok(());
    };
    if rect_width == 0
        || rect_height == 0
        || rect_width > 1024
        || rect_height > 1024
        || x.checked_add(rect_width).is_none_or(|right| right > width)
        || y.checked_add(rect_height)
            .is_none_or(|bottom| bottom > height)
    {
        return invalid(entry, "sheet rectangle must be positive and inside the PNG");
    }
    Ok(())
}

fn invalid<T>(entry: usize, message: &str) -> Result<T, AssetImportError> {
    Err(AssetImportError::InvalidEntry {
        entry,
        message: message.to_owned(),
    })
}

fn io(path: &Path, error: impl std::fmt::Display) -> AssetImportError {
    AssetImportError::Io {
        path: path.to_path_buf(),
        message: error.to_string(),
    }
}
