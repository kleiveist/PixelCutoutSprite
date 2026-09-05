use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder, RgbaImage};
use sha2::{Digest, Sha256};

use crate::domain::{parse_document, DomainDocument, ExportManifest, PixelRect, Sha256Digest};

use super::ExportError;

pub(crate) fn rgba_digest(image: &RgbaImage) -> Sha256Digest {
    let mut hash = Sha256::new();
    hash.update(b"pixel-cutout-sprite-rgba8-v1\0");
    hash.update(image.width().to_be_bytes());
    hash.update(image.height().to_be_bytes());
    hash.update(image.as_raw());
    Sha256Digest::parse(format!("{:x}", hash.finalize())).expect("SHA-256 is valid lowercase hex")
}

pub(crate) fn write_png(path: &Path, image: &RgbaImage) -> Result<(), ExportError> {
    let file = create_file(path, "create PNG")?;
    PngEncoder::new(&file).write_image(
        image.as_raw(),
        image.width(),
        image.height(),
        ColorType::Rgba8.into(),
    )?;
    file.sync_all()
        .map_err(|error| ExportError::io("sync PNG", path, error))
}

pub(crate) fn read_png(path: &Path) -> Result<RgbaImage, ExportError> {
    Ok(image::open(path)?.into_rgba8())
}

pub(crate) fn write_bytes(path: &Path, bytes: &[u8]) -> Result<(), ExportError> {
    let mut file = create_file(path, "create export file")?;
    file.write_all(bytes)
        .map_err(|error| ExportError::io("write export file", path, error))?;
    file.sync_all()
        .map_err(|error| ExportError::io("sync export file", path, error))
}

pub(crate) fn validate_build(build_dir: &Path) -> Result<ExportManifest, ExportError> {
    let manifest_path = safe_existing_child(build_dir, Path::new("animation.json"))?;
    let bytes = fs::read(&manifest_path)
        .map_err(|error| ExportError::io("read export manifest", &manifest_path, error))?;
    let manifest = match parse_document(&bytes)? {
        DomainDocument::ExportManifest(manifest) => *manifest,
        _ => {
            return Err(ExportError::InvalidBuild(
                "animation.json is not an export manifest".to_owned(),
            ));
        }
    };
    for page in &manifest.pages {
        let page_path = safe_existing_child(build_dir, Path::new(page.file.as_str()))?;
        let image = read_png(&page_path)?;
        if image.dimensions() != (u32::from(page.size_px.0), u32::from(page.size_px.1)) {
            return Err(ExportError::InvalidBuild(format!(
                "{} has dimensions that differ from the manifest",
                page.file
            )));
        }
        if rgba_digest(&image) != page.rgba_sha256 {
            return Err(ExportError::InvalidBuild(format!(
                "{} has a decoded-pixel hash mismatch",
                page.file
            )));
        }
        for frame in manifest
            .frames
            .iter()
            .filter(|frame| frame.page_id == page.id)
        {
            let extracted = extract_rect(&image, frame.rect_px);
            if rgba_digest(&extracted) != frame.rgba_sha256 {
                return Err(ExportError::InvalidBuild(format!(
                    "atlas pixels differ for {}/{:?}/{}",
                    frame.action_key, frame.direction, frame.sample_index
                )));
            }
            if let Some(path) = &frame.individual_file {
                let frame_path = safe_existing_child(build_dir, Path::new(path.as_str()))?;
                let individual = read_png(&frame_path)?;
                if individual.dimensions() != extracted.dimensions()
                    || rgba_digest(&individual) != frame.rgba_sha256
                {
                    return Err(ExportError::InvalidBuild(format!(
                        "individual frame {} differs from its atlas rectangle",
                        path
                    )));
                }
            }
        }
    }
    Ok(manifest)
}

fn extract_rect(image: &RgbaImage, rect: PixelRect) -> RgbaImage {
    let PixelRect(x, y, width, height) = rect;
    RgbaImage::from_fn(u32::from(width), u32::from(height), |offset_x, offset_y| {
        *image.get_pixel(u32::from(x) + offset_x, u32::from(y) + offset_y)
    })
}

fn create_file(path: &Path, operation: &'static str) -> Result<File, ExportError> {
    OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|error| ExportError::io(operation, path, error))
}

pub(crate) fn safe_existing_child(root: &Path, relative: &Path) -> Result<PathBuf, ExportError> {
    let root = root
        .canonicalize()
        .map_err(|error| ExportError::io("canonicalize build", root, error))?;
    let candidate = root.join(relative);
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|error| ExportError::io("inspect build artifact", &candidate, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(ExportError::InvalidBuild(
            "build artifacts must be regular files, not symbolic links".to_owned(),
        ));
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|error| ExportError::io("canonicalize build artifact", &candidate, error))?;
    if !canonical.starts_with(&root) {
        return Err(ExportError::InvalidBuild(
            "build artifact resolves outside the build directory".to_owned(),
        ));
    }
    Ok(canonical)
}
