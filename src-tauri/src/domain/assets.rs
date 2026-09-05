use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::{
    validate_kind_revision, validate_name, validate_schema, Direction, DocumentKind, DomainError,
    ObjectId, PixelPoint, PixelSize, RelativePath, RevisionRef, Sha256Digest, SlotId, SlotRef,
    UtcTimestamp,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    Body,
    Clothing,
    Armour,
    Accessory,
    Equipment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssetRevision {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub asset_id: ObjectId,
    pub revision: u32,
    pub profile_ref: RevisionRef,
    pub slot_id: SlotId,
    pub direction: Direction,
    pub variant: String,
    pub source_file: RelativePath,
    pub image_size_px: PixelSize,
    pub pivot_px: PixelPoint,
    pub content_hash: Sha256Digest,
    pub sprite_mirroring_allowed: bool,
    pub published_at: UtcTimestamp,
}

impl AssetRevision {
    pub fn reference(&self) -> RevisionRef {
        RevisionRef {
            id: self.asset_id,
            revision: self.revision,
        }
    }

    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::AssetRevision,
            self.revision,
            "asset_revision",
        )?;
        let path = "asset_revision";
        self.profile_ref.validate("asset_revision.profile_ref")?;
        SlotId::parse(self.slot_id.as_str())?;
        validate_variant(&format!("{path}.variant"), &self.variant)?;
        RelativePath::parse(self.source_file.as_str())?;
        self.image_size_px
            .validate(&format!("{path}.image_size_px"))?;
        self.pivot_px.validate(&format!("{path}.pivot_px"))?;
        Sha256Digest::parse(self.content_hash.as_str())?;
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Asset {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub name: String,
    pub original_name: String,
    pub asset_kind: AssetKind,
    pub label_ids: Vec<ObjectId>,
    pub released_revisions: Vec<u32>,
    pub origin_note: String,
    pub license_note: String,
    pub archived: bool,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Asset {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(self.kind, DocumentKind::Asset, self.revision, "asset")?;
        validate_name("asset.name", &self.name)?;
        validate_name("asset.original_name", &self.original_name)?;
        if self.released_revisions.is_empty() {
            return Err(DomainError::invalid(
                "asset.released_revisions",
                "must contain at least one immutable image revision",
            ));
        }
        let mut revisions = HashSet::new();
        for revision in &self.released_revisions {
            if *revision == 0 || !revisions.insert(*revision) {
                return Err(DomainError::DuplicateId(format!(
                    "asset:{}:revision:{}",
                    self.id, revision
                )));
            }
        }
        super::ensure_unique_ids("asset.label_ids", &self.label_ids)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutfitDraftStatus {
    InProgress,
    Assigned,
}

impl OutfitDraftStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        self == next || matches!((self, next), (Self::InProgress, Self::Assigned))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OutfitDraft {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub template_ref: RevisionRef,
    pub profile_ref: RevisionRef,
    pub character_id: Option<ObjectId>,
    pub appearance_id: Option<ObjectId>,
    pub status: OutfitDraftStatus,
    pub selected_assets: Vec<SlotRef>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl OutfitDraft {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::OutfitDraft,
            self.revision,
            "outfit_draft",
        )?;
        self.template_ref.validate("outfit_draft.template_ref")?;
        self.profile_ref.validate("outfit_draft.profile_ref")?;
        if self.status == OutfitDraftStatus::Assigned
            && (self.character_id.is_none() || self.appearance_id.is_none())
        {
            return Err(DomainError::invalid(
                "outfit_draft.status",
                "assigned drafts require character_id and appearance_id",
            ));
        }
        let mut slots = HashSet::new();
        for (index, asset) in self.selected_assets.iter().enumerate() {
            asset.validate(&format!("outfit_draft.selected_assets[{index}]"))?;
            if !slots.insert(asset.slot_id.clone()) {
                return Err(DomainError::DuplicateId(format!(
                    "outfit_draft.slot:{}",
                    asset.slot_id
                )));
            }
        }
        Ok(())
    }
}

fn validate_variant(path: &str, value: &str) -> Result<(), DomainError> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-');
    if valid {
        Ok(())
    } else {
        Err(DomainError::invalid(
            path,
            "must contain 1–64 portable letters, digits, underscores, or hyphens",
        ))
    }
}
