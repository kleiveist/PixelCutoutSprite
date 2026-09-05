use serde::{Deserialize, Serialize};
use std::fmt;

use super::{DomainError, ObjectId, SlotId};

pub const SCHEMA_VERSION: u32 = 1;
pub const VAULT_FORMAT: &str = "pixel-cutout-sprite-vault";
pub const RESERVED_ADMIN_DIRECTORY: &str = ".pixelforge-studio";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    N,
    Ne,
    E,
    Se,
    S,
    Sw,
    W,
    Nw,
}

impl Direction {
    pub const ALL: [Self; 8] = [
        Self::N,
        Self::Ne,
        Self::E,
        Self::Se,
        Self::S,
        Self::Sw,
        Self::W,
        Self::Nw,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PixelSize(pub u16, pub u16);

impl PixelSize {
    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        if self.0 == 0 || self.1 == 0 || self.0 > 1024 || self.1 > 1024 {
            return Err(DomainError::invalid(
                path,
                "each axis must be within 1..=1024 pixels",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PixelPoint(pub i16, pub i16);

impl PixelPoint {
    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        if !(-2048..=2048).contains(&self.0) || !(-2048..=2048).contains(&self.1) {
            return Err(DomainError::invalid(
                path,
                "coordinates must be within -2048..=2048",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Transform2D {
    pub offset_px: PixelPoint,
    pub rotation_deg: f32,
}

impl Transform2D {
    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        self.offset_px.validate(path)?;
        if !self.rotation_deg.is_finite() || !(-3600.0..=3600.0).contains(&self.rotation_deg) {
            return Err(DomainError::invalid(
                path,
                "rotation must be finite and within -3600..=3600 degrees",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RevisionRef {
    pub id: ObjectId,
    pub revision: u32,
}

impl RevisionRef {
    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        if self.revision == 0 {
            return Err(DomainError::invalid(path, "revision must be positive"));
        }
        Ok(())
    }
}

impl fmt::Display for RevisionRef {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}:r{}", self.id, self.revision)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SlotRef {
    pub asset_id: ObjectId,
    pub revision: u32,
    pub slot_id: SlotId,
}

impl SlotRef {
    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        if self.revision == 0 {
            return Err(DomainError::invalid(
                path,
                "asset revision must be positive",
            ));
        }
        Ok(())
    }
}

pub fn validate_schema(schema_version: u32) -> Result<(), DomainError> {
    if schema_version != SCHEMA_VERSION {
        return Err(DomainError::UnsupportedSchemaVersion {
            found: u64::from(schema_version),
            supported: SCHEMA_VERSION,
        });
    }
    Ok(())
}

pub fn validate_name(path: &str, name: &str) -> Result<(), DomainError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 120 || trimmed != name {
        return Err(DomainError::invalid(
            path,
            "must contain 1–120 characters without surrounding whitespace",
        ));
    }
    if name.chars().any(char::is_control) {
        return Err(DomainError::invalid(
            path,
            "must not contain control characters",
        ));
    }
    Ok(())
}
