//! Read-only, bounded navigation of ordinary vault folders. No Project/Area model.
use std::fs::{self, File, Metadata};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::validate_workspace_relative;
use crate::storage::{StorageError, VaultRoot};

pub(crate) mod manifest;
#[cfg(test)]
mod tests;

pub const MAX_DIRECTORY_ENTRIES: usize = 20_000;
pub const MAX_PAGE_SIZE: usize = 100;
pub const MAX_IMAGE_BYTES: usize = 16 * 1024 * 1024;
const MAX_PIXELS: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryFilter {
    #[default]
    All,
    Images,
    Folders,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectoryQuery {
    pub relative_path: String,
    pub search: String,
    pub filter: EntryFilter,
    pub show_technical: bool,
    pub limit: usize,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    Directory,
    Image,
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub name: String,
    pub relative_path: String,
    pub kind: EntryKind,
    pub technical: bool,
    pub set_candidate: bool,
    pub fingerprint: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryPage {
    pub relative_path: String,
    pub entries: Vec<WorkspaceEntry>,
    pub next_cursor: Option<String>,
    pub total_matches: usize,
    pub skipped_entries: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PageCursor {
    scope: String,
    snapshot: String,
    offset: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum WorkspaceSelection {
    Image {
        relative_path: String,
        sha256: String,
        width: u32,
        height: u32,
    },
    SpriteSet {
        relative_path: String,
        manifest_path: String,
        manifest_sha256: String,
        set_id: String,
        generation_id: String,
        complete: bool,
        part_count: usize,
    },
    LegacySet {
        relative_path: String,
        document_sha256: String,
        part_count: usize,
    },
    Directory {
        relative_path: String,
        status: String,
        message: Option<String>,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceThumbnail {
    pub data_url: String,
    pub sha256: String,
}

pub fn list_entries(
    root: &VaultRoot,
    query: &DirectoryQuery,
) -> Result<DirectoryPage, StorageError> {
    if !(1..=MAX_PAGE_SIZE).contains(&query.limit) || query.search.chars().count() > 120 {
        return Err(invalid("Ungültiges Seitenlimit oder zu lange Suche."));
    }
    let directory = checked_path(root, &query.relative_path, true)?;
    if !query.show_technical && technical(&query.relative_path) {
        return Err(invalid("Technische Ordner sind ausgeblendet."));
    }
    if !fs::symlink_metadata(&directory)
        .map_err(|e| io(&query.relative_path, e))?
        .is_dir()
    {
        return Err(invalid("Das ausgewählte Verzeichnis existiert nicht mehr."));
    }
    let scope = digest(
        format!(
            "{}\0{}\0{:?}\0{}\0{}",
            query.relative_path, query.search, query.filter, query.show_technical, query.limit
        )
        .as_bytes(),
    );
    let cursor: Option<PageCursor> = query
        .cursor
        .as_ref()
        .map(|value| {
            if value.len() > 512 {
                return Err(invalid("Ungültiger Verzeichniscursor."));
            }
            serde_json::from_str(value).map_err(|_| invalid("Ungültiger Verzeichniscursor."))
        })
        .transpose()?;
    let mut entries = Vec::new();
    let mut skipped = 0;
    let search = query.search.to_lowercase();
    for (position, entry) in fs::read_dir(&directory)
        .map_err(|e| io(&query.relative_path, e))?
        .enumerate()
    {
        if position >= MAX_DIRECTORY_ENTRIES {
            return Err(invalid("Mehr als 20.000 Einträge in einem Ordner. Bitte in Unterordner aufteilen; es wurde kein unvollständiges Listing angezeigt."));
        }
        let entry = entry.map_err(|e| io(&query.relative_path, e))?;
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            skipped += 1;
            continue;
        };
        let relative = join(&query.relative_path, &name);
        if validate_path(&relative, false).is_err() {
            skipped += 1;
            continue;
        }
        let metadata = match fs::symlink_metadata(entry.path()) {
            Ok(value) => value,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        if is_link(&metadata) || !(metadata.is_file() || metadata.is_dir()) {
            skipped += 1;
            continue;
        }
        let is_technical = technical(&relative);
        let kind = if metadata.is_dir() {
            EntryKind::Directory
        } else if image_format(&name).is_some() {
            EntryKind::Image
        } else {
            EntryKind::Unsupported
        };
        if (!query.show_technical && is_technical)
            || !name.to_lowercase().contains(&search)
            || (query.filter == EntryFilter::Folders && kind != EntryKind::Directory)
            || (query.filter == EntryFilter::Images && kind == EntryKind::Unsupported)
        {
            continue;
        }
        entries.push(WorkspaceEntry {
            name,
            relative_path: relative.clone(),
            kind,
            technical: is_technical,
            set_candidate: false,
            fingerprint: fingerprint(&relative, &metadata),
        });
    }
    // Deterministic byte ordering, directories first; no locale-dependent OS ordering.
    entries.sort_by(|a, b| {
        (
            a.kind != EntryKind::Directory,
            a.name.to_lowercase(),
            &a.name,
        )
            .cmp(&(
                b.kind != EntryKind::Directory,
                b.name.to_lowercase(),
                &b.name,
            ))
    });
    let snapshot = digest(
        entries
            .iter()
            .map(|entry| format!("{}:{};", entry.relative_path, entry.fingerprint))
            .collect::<String>()
            .as_bytes(),
    );
    let offset = if let Some(cursor) = cursor {
        if cursor.scope != scope || cursor.snapshot != snapshot || cursor.offset > entries.len() {
            return Err(invalid("Das Verzeichnis wurde verändert oder der Cursor gehört zu einer anderen Suche. Bitte aktualisieren."));
        }
        cursor.offset
    } else {
        0
    };
    let total_matches = entries.len();
    let end = offset.saturating_add(query.limit).min(total_matches);
    let next_cursor = (end < total_matches).then(|| {
        serde_json::to_string(&PageCursor {
            scope,
            snapshot,
            offset: end,
        })
        .unwrap()
    });
    let mut page: Vec<_> = entries.into_iter().skip(offset).take(query.limit).collect();
    // At most one metadata probe per returned directory; no manifest/image full scan.
    for entry in &mut page {
        if entry.kind == EntryKind::Directory && !entry.technical {
            let path = checked_path(root, &entry.relative_path, false)?;
            entry.set_candidate = fs::symlink_metadata(path.join("sprite.parts.json")).is_ok();
        }
    }
    checked_path(root, &query.relative_path, true)?;
    Ok(DirectoryPage {
        relative_path: query.relative_path.clone(),
        entries: page,
        next_cursor,
        total_matches,
        skipped_entries: skipped,
    })
}

pub fn select_entry(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
) -> Result<WorkspaceSelection, StorageError> {
    let path = checked_path(root, relative, false)?;
    let metadata = fs::symlink_metadata(path).map_err(|e| io(relative, e))?;
    if technical(relative) {
        return Err(invalid(
            "Technische Dateien sind keine Originalbildquellen oder Sprite-Sets.",
        ));
    }
    if fingerprint(relative, &metadata) != expected {
        return Err(StorageError::WriteConflict);
    }
    if metadata.is_dir() {
        return manifest::inspect(root, relative);
    }
    let format = image_format(relative).ok_or_else(|| invalid("Dieser Dateityp wird nicht geöffnet. Unterstützt werden PNG, JPEG, WebP und geprüfte Teileordner."))?;
    let bytes = read_bounded(root, relative, MAX_IMAGE_BYTES)?;
    let image = decode_image(&bytes, format)?;
    verify_fingerprint(root, relative, expected)?;
    Ok(WorkspaceSelection::Image {
        relative_path: relative.to_owned(),
        sha256: digest(&bytes),
        width: image.width(),
        height: image.height(),
    })
}

pub fn thumbnail(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
) -> Result<WorkspaceThumbnail, StorageError> {
    if technical(relative) || image_format(relative).is_none() {
        return Err(invalid("Keine Vorschau für diesen Dateityp."));
    }
    verify_fingerprint(root, relative, expected)?;
    let bytes = read_bounded(root, relative, MAX_IMAGE_BYTES)?;
    let image = decode_image(&bytes, image_format(relative).unwrap())?;
    let edge = image.width().max(image.height()).max(1);
    let preview = image.resize_exact(
        (image.width() * 96 / edge).max(1),
        (image.height() * 96 / edge).max(1),
        image::imageops::FilterType::Nearest,
    );
    let mut output = Cursor::new(Vec::new());
    preview
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|e| invalid(&format!("PNG-Vorschau nicht lesbar: {e}")))?;
    verify_fingerprint(root, relative, expected)?;
    Ok(WorkspaceThumbnail {
        data_url: format!(
            "data:image/png;base64,{}",
            STANDARD.encode(output.into_inner())
        ),
        sha256: digest(&bytes),
    })
}

fn decode_png(bytes: &[u8]) -> Result<DynamicImage, StorageError> {
    decode_image(bytes, ImageFormat::Png)
}

pub(crate) fn decode_image(
    bytes: &[u8],
    expected: ImageFormat,
) -> Result<DynamicImage, StorageError> {
    if image::guess_format(bytes).ok() != Some(expected) {
        return Err(invalid("Bildinhalt und Dateityp stimmen nicht überein."));
    }
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(128 * 1024 * 1024);
    let animated = match expected {
        ImageFormat::Png => {
            image::codecs::png::PngDecoder::with_limits(Cursor::new(bytes), limits.clone())
                .and_then(|decoder| decoder.is_apng())
        }
        ImageFormat::WebP => image::codecs::webp::WebPDecoder::new(Cursor::new(bytes))
            .map(|decoder| decoder.has_animation()),
        _ => Ok(false),
    }
    .map_err(|e| invalid(&format!("Ungültiger Bildheader: {e}")))?;
    if animated {
        return Err(invalid(
            "Animierte PNG-/WebP-Dateien werden nicht unterstützt. Bitte ein Einzelbild verwenden.",
        ));
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), expected);
    reader.limits(limits);
    let mut decoder = reader
        .into_decoder()
        .map_err(|e| invalid(&format!("Ungültiger oder zu großer Bildheader: {e}")))?;
    let (width, height) = decoder.dimensions();
    if width == 0
        || height == 0
        || u64::from(width) * u64::from(height) > MAX_PIXELS
        || decoder.total_bytes() > 64 * 1024 * 1024
    {
        return Err(invalid("Bild überschreitet die Grenze von 8192 px je Achse / 16 Megapixeln / 64 MiB dekodiert."));
    }
    let orientation = decoder
        .orientation()
        .map_err(|e| invalid(&format!("Ungültige Bildorientierung: {e}")))?;
    let mut image = DynamicImage::from_decoder(decoder)
        .map_err(|e| invalid(&format!("Bild kann nicht dekodiert werden: {e}")))?;
    image.apply_orientation(orientation);
    Ok(image)
}

fn verify_fingerprint(
    root: &VaultRoot,
    relative: &str,
    expected: &str,
) -> Result<(), StorageError> {
    let path = checked_path(root, relative, false)?;
    let metadata = fs::symlink_metadata(path).map_err(|e| io(relative, e))?;
    if fingerprint(relative, &metadata) != expected {
        return Err(StorageError::WriteConflict);
    }
    Ok(())
}

fn validate_path(relative: &str, allow_root: bool) -> Result<(), StorageError> {
    if allow_root && relative.is_empty() {
        return Ok(());
    }
    if relative.len() > 1024
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        || relative
            .chars()
            .any(|ch| ch.is_control() || "<>\"|?*".contains(ch))
    {
        return Err(invalid("Erwartet wird ein portabler relativer Vault-Pfad."));
    }
    validate_workspace_relative(Path::new(relative))
}

fn checked_path(
    root: &VaultRoot,
    relative: &str,
    allow_root: bool,
) -> Result<PathBuf, StorageError> {
    validate_path(relative, allow_root)?;
    if is_link(&fs::symlink_metadata(root.path()).map_err(|e| io(relative, e))?) {
        return Err(invalid("Verknüpfungen werden nicht verfolgt."));
    }
    let root = VaultRoot::open(root.path())?;
    // Also reject Windows junctions/reparse points, not just Unix symlinks.
    let mut path = root.path().to_path_buf();
    if is_link(&fs::symlink_metadata(&path).map_err(|e| io(relative, e))?) {
        return Err(invalid("Verknüpfungen werden nicht verfolgt."));
    }
    for part in relative.split('/').filter(|part| !part.is_empty()) {
        path.push(part);
        let metadata = fs::symlink_metadata(&path).map_err(|e| io(relative, e))?;
        if is_link(&metadata) {
            return Err(invalid("Verknüpfungen werden nicht verfolgt."));
        }
    }
    if !relative.is_empty() {
        root.resolve(Path::new(relative))?;
    }
    Ok(path)
}

pub(crate) fn read_bounded(
    root: &VaultRoot,
    relative: &str,
    limit: usize,
) -> Result<Vec<u8>, StorageError> {
    let path = checked_path(root, relative, false)?;
    let before = fs::symlink_metadata(&path).map_err(|e| io(relative, e))?;
    if !before.is_file() || before.len() > limit as u64 {
        return Err(invalid("Keine reguläre Datei innerhalb der Lesegrenze."));
    }
    let mut file = File::open(&path).map_err(|e| io(relative, e))?;
    let opened = file.metadata().map_err(|e| io(relative, e))?;
    if !same_file(&before, &opened) {
        return Err(StorageError::WriteConflict);
    }
    let mut bytes = Vec::new();
    (&mut file)
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| io(relative, e))?;
    if bytes.len() > limit {
        return Err(invalid("Datei überschreitet die Lesegrenze."));
    }
    checked_path(root, relative, false)?;
    let after = fs::symlink_metadata(path).map_err(|e| io(relative, e))?;
    if !same_file(&opened, &after) {
        return Err(StorageError::WriteConflict);
    }
    Ok(bytes)
}

fn same_file(a: &Metadata, b: &Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if a.dev() != b.dev() || a.ino() != b.ino() {
            return false;
        }
    }
    a.len() == b.len() && a.modified().ok() == b.modified().ok() && !is_link(b) && b.is_file()
}
fn is_link(metadata: &Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}
pub(crate) fn technical(relative: &str) -> bool {
    relative.split('/').any(|part| {
        (part.starts_with('.') && part != ".PixelPrompt")
            || matches!(part, "node_modules" | "target")
    })
}
fn fingerprint(relative: &str, metadata: &Metadata) -> String {
    #[cfg(unix)]
    let file_identity = {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}", metadata.dev(), metadata.ino())
    };
    #[cfg(not(unix))]
    let file_identity = format!("{:?}", metadata.created().ok());
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|time| time.as_nanos())
        .unwrap_or(0);
    digest(
        format!(
            "{relative}:{}:{modified}:{}:{file_identity}",
            metadata.len(),
            metadata.is_dir()
        )
        .as_bytes(),
    )
}
pub(crate) fn image_format(name: &str) -> Option<ImageFormat> {
    match name.rsplit('.').next()?.to_ascii_lowercase().as_str() {
        "png" => Some(ImageFormat::Png),
        "jpg" | "jpeg" => Some(ImageFormat::Jpeg),
        "webp" => Some(ImageFormat::WebP),
        _ => None,
    }
}
fn join(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_owned()
    } else {
        format!("{parent}/{name}")
    }
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn invalid(message: &str) -> StorageError {
    StorageError::InvalidVault(message.to_owned())
}
fn io(relative: &str, error: std::io::Error) -> StorageError {
    StorageError::io("Dateinavigation", Path::new(relative), error)
}
