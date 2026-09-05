use serde::{Deserialize, Serialize};

use crate::domain::{AssetKind, Direction, PixelPoint, PixelSize, RevisionRef};

pub const ASSET_PACKAGE_FORMAT: &str = "pixel-cutout-asset-package";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssetPackage {
    pub format: String,
    pub format_version: u16,
    pub profile_ref: RevisionRef,
    pub entries: Vec<PackageEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PackageEntry {
    pub name: String,
    pub source: String,
    pub asset_kind: AssetKind,
    pub slot_id: Option<String>,
    pub direction: Option<Direction>,
    pub variant: String,
    pub image_size_px: PixelSize,
    pub pivot_px: PixelPoint,
    pub sheet_rect_px: Option<SheetRect>,
    pub sprite_mirroring_allowed: bool,
    pub origin_note: String,
    pub license_note: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SheetRect(pub u32, pub u32, pub u32, pub u32);
