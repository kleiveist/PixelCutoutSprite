use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};

use image::{codecs::png::PngDecoder, ColorType, ImageDecoder};

use crate::asset_io::{AssetImportError, AssetPackage};
use crate::domain::RelativePath;
use crate::storage::StorageError;

use super::{validate_selected_file, AssetImportSource, AssetServiceError};

pub(super) const MAXIMUM_IMPORT_ENTRIES: usize = 64;
const MAXIMUM_IMPORT_FILE_BYTES: u64 = 32 * 1024 * 1024;
const MAXIMUM_IMPORT_DECODED_BYTES: u64 = 64 * 1024 * 1024;
const MAXIMUM_AGGREGATE_ENCODED_BYTES: u64 = 128 * 1024 * 1024;
const MAXIMUM_AGGREGATE_DECODED_BYTES: u64 = 256 * 1024 * 1024;
const MAXIMUM_IMPORT_AXIS_PX: u32 = 4096;
const MAXIMUM_IMPORT_PIXELS: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone, Copy)]
pub(super) struct ImportBudget {
    pub(super) entries: usize,
}

pub(super) fn validate_import_budget(
    source: &AssetImportSource,
) -> Result<ImportBudget, AssetServiceError> {
    validate_import_budget_controlled(source, &|| false, &mut |_, _| {})
}

pub(super) fn validate_import_budget_controlled<C, P>(
    source: &AssetImportSource,
    is_cancelled: &C,
    progress: &mut P,
) -> Result<ImportBudget, AssetServiceError>
where
    C: Fn() -> bool,
    P: FnMut(usize, usize),
{
    if is_cancelled() {
        return Err(AssetImportError::Cancelled.into());
    }
    let image_paths = match source {
        AssetImportSource::LoosePngs { paths } => paths.iter().map(PathBuf::from).collect(),
        AssetImportSource::Package { path } => package_image_paths(Path::new(path), is_cancelled)?,
    };
    if image_paths.is_empty() || image_paths.len() > MAXIMUM_IMPORT_ENTRIES {
        return Err(AssetImportError::InvalidPackage(format!(
            "an import job must contain between 1 and {MAXIMUM_IMPORT_ENTRIES} entries so decoded images remain bounded"
        ))
        .into());
    }
    let mut encoded_total = 0_u64;
    let mut decoded_total = 0_u64;
    for (index, path) in image_paths.iter().enumerate() {
        if is_cancelled() {
            return Err(AssetImportError::Cancelled.into());
        }
        validate_budget_image_path(path, index)?;
        let metadata = fs::metadata(path)
            .map_err(|error| StorageError::io("inspect import source budget", path, error))?;
        if metadata.len() > MAXIMUM_IMPORT_FILE_BYTES {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "PNG exceeds the 32 MiB encoded file-size limit".to_owned(),
            }
            .into());
        }
        encoded_total = encoded_total.checked_add(metadata.len()).ok_or_else(|| {
            AssetImportError::InvalidPackage("aggregate encoded size overflow".to_owned())
        })?;
        if encoded_total > MAXIMUM_AGGREGATE_ENCODED_BYTES {
            return Err(AssetImportError::InvalidPackage(
                "import exceeds the 128 MiB aggregate encoded-data budget".to_owned(),
            )
            .into());
        }
        let file = File::open(path)
            .map_err(|error| StorageError::io("open import source for budget", path, error))?;
        let decoder = PngDecoder::new(BufReader::new(file)).map_err(|error| {
            AssetImportError::InvalidEntry {
                entry: index,
                message: format!("cannot read PNG header: {error}"),
            }
        })?;
        let (width, height) = decoder.dimensions();
        let pixels = u64::from(width)
            .checked_mul(u64::from(height))
            .ok_or_else(|| AssetImportError::InvalidEntry {
                entry: index,
                message: "decoded image size overflow".to_owned(),
            })?;
        if width > MAXIMUM_IMPORT_AXIS_PX
            || height > MAXIMUM_IMPORT_AXIS_PX
            || pixels > MAXIMUM_IMPORT_PIXELS
        {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "decoded PNG dimensions exceed the configured limit".to_owned(),
            }
            .into());
        }
        if decoder.color_type() != ColorType::Rgba8 {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "PNG must use 8-bit RGBA pixels".to_owned(),
            }
            .into());
        }
        let expected = pixels
            .checked_mul(4)
            .ok_or_else(|| AssetImportError::InvalidEntry {
                entry: index,
                message: "decoded image size overflow".to_owned(),
            })?;
        let decoded = decoder.total_bytes();
        if decoded != expected {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "decoded PNG byte size is inconsistent with RGBA8 dimensions".to_owned(),
            }
            .into());
        }
        if decoded > MAXIMUM_IMPORT_DECODED_BYTES {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "PNG exceeds the 64 MiB decoded RGBA limit".to_owned(),
            }
            .into());
        }
        decoded_total = decoded_total.checked_add(decoded).ok_or_else(|| {
            AssetImportError::InvalidPackage("aggregate decoded size overflow".to_owned())
        })?;
        if decoded_total > MAXIMUM_AGGREGATE_DECODED_BYTES {
            return Err(AssetImportError::InvalidPackage(
                "import exceeds the 256 MiB aggregate decoded-data budget".to_owned(),
            )
            .into());
        }
        progress(index + 1, image_paths.len());
    }
    Ok(ImportBudget {
        entries: image_paths.len(),
    })
}

fn package_image_paths<C>(
    package_path: &Path,
    is_cancelled: &C,
) -> Result<Vec<PathBuf>, AssetServiceError>
where
    C: Fn() -> bool,
{
    validate_selected_file(package_path, "package JSON")?;
    let metadata = fs::metadata(package_path)
        .map_err(|error| StorageError::io("inspect asset package budget", package_path, error))?;
    if metadata.len() > MAXIMUM_IMPORT_FILE_BYTES {
        return Err(AssetImportError::InvalidPackage(
            "package JSON exceeds the 32 MiB file-size limit".to_owned(),
        )
        .into());
    }
    let bytes = fs::read(package_path)
        .map_err(|error| StorageError::io("read asset package budget", package_path, error))?;
    if bytes.len() as u64 > MAXIMUM_IMPORT_FILE_BYTES {
        return Err(AssetImportError::InvalidPackage(
            "package JSON exceeds the 32 MiB file-size limit".to_owned(),
        )
        .into());
    }
    let package: AssetPackage = serde_json::from_slice(&bytes)
        .map_err(|error| AssetImportError::InvalidPackage(error.to_string()))?;
    if package.entries.is_empty() || package.entries.len() > MAXIMUM_IMPORT_ENTRIES {
        return Err(AssetImportError::InvalidPackage(format!(
            "package entries must contain 1..={MAXIMUM_IMPORT_ENTRIES} items for one bounded import job"
        ))
        .into());
    }
    let root = package_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .canonicalize()
        .map_err(|error| StorageError::io("resolve asset package root", package_path, error))?;
    let mut paths = Vec::with_capacity(package.entries.len());
    for (index, entry) in package.entries.iter().enumerate() {
        if is_cancelled() {
            return Err(AssetImportError::Cancelled.into());
        }
        let relative = RelativePath::parse(entry.source.clone()).map_err(|error| {
            AssetImportError::InvalidEntry {
                entry: index,
                message: error.to_string(),
            }
        })?;
        let path = root.join(relative.as_str());
        reject_package_symlink_or_escape(&root, &path, index)?;
        paths.push(path);
    }
    Ok(paths)
}

fn validate_budget_image_path(path: &Path, index: usize) -> Result<(), AssetServiceError> {
    if !path.is_absolute() {
        return Err(AssetImportError::InvalidEntry {
            entry: index,
            message: "selected PNG path must be absolute".to_owned(),
        }
        .into());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect selected import source", path, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AssetImportError::InvalidEntry {
            entry: index,
            message: "selected PNG must be a real file, not a symbolic link".to_owned(),
        }
        .into());
    }
    Ok(())
}

fn reject_package_symlink_or_escape(
    root: &Path,
    path: &Path,
    index: usize,
) -> Result<(), AssetServiceError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| AssetImportError::InvalidEntry {
            entry: index,
            message: "source leaves the package directory".to_owned(),
        })?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| StorageError::io("inspect package source path", &current, error))?;
        if metadata.file_type().is_symlink() {
            return Err(AssetImportError::InvalidEntry {
                entry: index,
                message: "source path contains a symbolic link".to_owned(),
            }
            .into());
        }
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| StorageError::io("resolve package source path", path, error))?;
    if !canonical.starts_with(root) {
        return Err(AssetImportError::InvalidEntry {
            entry: index,
            message: "source resolves outside the package directory".to_owned(),
        }
        .into());
    }
    Ok(())
}
