use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::{
    validate_kind_revision, validate_name, validate_schema, Direction, DocumentKind, DomainError,
    Equipment, ObjectId, PixelPoint, PixelSize, RelativePath, RevisionRef, Sha256Digest, SlotId,
    SlotRef, Transform2D, UtcTimestamp,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SpriteVariantFitting {
    pub variant: String,
    pub asset: SlotRef,
    pub pivot_px: PixelPoint,
}

impl SpriteVariantFitting {
    pub(super) fn validate(&self, path: &str) -> Result<(), DomainError> {
        validate_variant(&format!("{path}.variant"), &self.variant)?;
        self.asset.validate(&format!("{path}.asset"))?;
        self.pivot_px.validate(&format!("{path}.pivot_px"))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OutfitFitting {
    pub slot_id: SlotId,
    pub direction: Direction,
    pub asset: SlotRef,
    pub pivot_px: PixelPoint,
    #[serde(default)]
    pub variant_fittings: Vec<SpriteVariantFitting>,
    pub transform: Transform2D,
    pub visible: bool,
    pub layer_delta: i16,
}

impl OutfitFitting {
    fn validate(&self, path: &str) -> Result<(), DomainError> {
        SlotId::parse(self.slot_id.as_str())?;
        self.asset.validate(&format!("{path}.asset"))?;
        if self.asset.slot_id != self.slot_id {
            return Err(DomainError::invalid(
                format!("{path}.asset.slot_id"),
                "must match the fitted slot",
            ));
        }
        self.pivot_px.validate(&format!("{path}.pivot_px"))?;
        let mut variants = HashSet::new();
        for (index, variant) in self.variant_fittings.iter().enumerate() {
            variant.validate(&format!("{path}.variant_fittings[{index}]"))?;
            if variant.asset.slot_id != self.slot_id {
                return Err(DomainError::invalid(
                    format!("{path}.variant_fittings[{index}].asset.slot_id"),
                    "must match the fitted slot",
                ));
            }
            if !variants.insert(variant.variant.clone()) {
                return Err(DomainError::DuplicateId(format!(
                    "{path}.variant:{}",
                    variant.variant
                )));
            }
        }
        self.transform.validate(&format!("{path}.transform"))?;
        if !(-64..=64).contains(&self.layer_delta) {
            return Err(DomainError::invalid(
                format!("{path}.layer_delta"),
                "must be within -64..=64",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OutfitLocalOverride {
    pub slot_id: SlotId,
    pub direction: Direction,
    pub transform: Transform2D,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssetFallbackApproval {
    pub slot_id: SlotId,
    pub target_direction: Direction,
    pub source_direction: Direction,
    pub variant: String,
}

impl AssetFallbackApproval {
    pub(super) fn validate(&self, path: &str) -> Result<(), DomainError> {
        SlotId::parse(self.slot_id.as_str())?;
        validate_variant(&format!("{path}.variant"), &self.variant)?;
        if self.target_direction == self.source_direction
            || horizontal_mirror(self.target_direction) != self.source_direction
        {
            return Err(DomainError::invalid(
                path,
                "asset fallback must name the horizontal mirror source",
            ));
        }
        Ok(())
    }
}

impl OutfitLocalOverride {
    fn validate(&self, path: &str) -> Result<(), DomainError> {
        SlotId::parse(self.slot_id.as_str())?;
        self.transform.validate(&format!("{path}.transform"))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
    #[serde(default)]
    pub base_character_revision: Option<u32>,
    #[serde(default)]
    pub base_character_sha256: Option<Sha256Digest>,
    #[serde(default)]
    pub base_appearance_revision: Option<u32>,
    #[serde(default)]
    pub base_appearance_sha256: Option<Sha256Digest>,
    #[serde(default)]
    pub base_binding_ref: Option<RevisionRef>,
    #[serde(default)]
    pub base_binding_sha256: Option<Sha256Digest>,
    pub status: OutfitDraftStatus,
    pub selected_assets: Vec<SlotRef>,
    #[serde(default)]
    pub asset_fallback_approvals: Vec<AssetFallbackApproval>,
    #[serde(default)]
    pub fittings: Vec<OutfitFitting>,
    #[serde(default)]
    pub local_overrides: Vec<OutfitLocalOverride>,
    #[serde(default)]
    pub equipment: Vec<Equipment>,
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
        if self.base_character_revision == Some(0) || self.base_appearance_revision == Some(0) {
            return Err(DomainError::invalid(
                "outfit_draft.base_revision",
                "base revisions must be positive",
            ));
        }
        if let Some(reference) = self.base_binding_ref {
            reference.validate("outfit_draft.base_binding_ref")?;
        }
        for digest in [
            self.base_character_sha256.as_ref(),
            self.base_appearance_sha256.as_ref(),
            self.base_binding_sha256.as_ref(),
        ]
        .into_iter()
        .flatten()
        {
            Sha256Digest::parse(digest.as_str())?;
        }
        if self.character_id.is_none()
            && (self.base_character_revision.is_some()
                || self.base_character_sha256.is_some()
                || self.base_appearance_revision.is_some()
                || self.base_appearance_sha256.is_some()
                || self.base_binding_ref.is_some()
                || self.base_binding_sha256.is_some())
        {
            return Err(DomainError::invalid(
                "outfit_draft.base_revision",
                "new-NPC drafts cannot pin existing document revisions",
            ));
        }
        if self.character_id.is_some() != self.appearance_id.is_some() {
            return Err(DomainError::invalid(
                "outfit_draft.character_id",
                "character and appearance identities must be set or unset together",
            ));
        }
        if self.status == OutfitDraftStatus::InProgress
            && self.character_id.is_some()
            && (self.appearance_id.is_none()
                || self.base_character_revision.is_none()
                || self.base_character_sha256.is_none()
                || self.base_appearance_revision.is_none()
                || self.base_appearance_sha256.is_none())
        {
            return Err(DomainError::invalid(
                "outfit_draft.base_revision",
                "existing-NPC drafts must pin character and appearance revisions",
            ));
        }
        if self.base_binding_ref.is_some() != self.base_binding_sha256.is_some() {
            return Err(DomainError::invalid(
                "outfit_draft.base_binding_ref",
                "binding identity and content digest must be pinned together",
            ));
        }
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
        let mut fittings = HashSet::new();
        for (index, fitting) in self.fittings.iter().enumerate() {
            fitting.validate(&format!("outfit_draft.fittings[{index}]"))?;
            if !fittings.insert((fitting.slot_id.clone(), fitting.direction)) {
                return Err(DomainError::DuplicateId(format!(
                    "outfit_draft.fitting:{}:{:?}",
                    fitting.slot_id, fitting.direction
                )));
            }
        }
        let mut approvals = HashSet::new();
        for (index, approval) in self.asset_fallback_approvals.iter().enumerate() {
            approval.validate(&format!("outfit_draft.asset_fallback_approvals[{index}]"))?;
            if !approvals.insert((
                approval.slot_id.clone(),
                approval.target_direction,
                approval.variant.clone(),
            )) {
                return Err(DomainError::DuplicateId(format!(
                    "outfit_draft.asset_fallback:{}:{:?}:{}",
                    approval.slot_id, approval.target_direction, approval.variant
                )));
            }
        }
        let mut overrides = HashSet::new();
        for (index, local) in self.local_overrides.iter().enumerate() {
            local.validate(&format!("outfit_draft.local_overrides[{index}]"))?;
            if !overrides.insert((local.slot_id.clone(), local.direction)) {
                return Err(DomainError::DuplicateId(format!(
                    "outfit_draft.override:{}:{:?}",
                    local.slot_id, local.direction
                )));
            }
        }
        if !self.fittings.is_empty() {
            for selected in &self.selected_assets {
                if !self.fittings.iter().any(|fitting| {
                    fitting.slot_id == selected.slot_id
                        && fitting.asset.asset_id == selected.asset_id
                        && fitting.asset.revision == selected.revision
                }) {
                    return Err(DomainError::invalid(
                        "outfit_draft.selected_assets",
                        "each base selection must be one of the persisted direction fittings",
                    ));
                }
            }
            if self.fittings.iter().any(|fitting| {
                !self
                    .selected_assets
                    .iter()
                    .any(|selected| selected.slot_id == fitting.slot_id)
            }) {
                return Err(DomainError::invalid(
                    "outfit_draft.fittings",
                    "each fitted slot requires one base selection",
                ));
            }
        }
        if self.local_overrides.iter().any(|local| {
            !self.fittings.iter().any(|fitting| {
                fitting.slot_id == local.slot_id && fitting.direction == local.direction
            })
        }) {
            return Err(DomainError::invalid(
                "outfit_draft.local_overrides",
                "a local override requires an assigned image for the same slot and direction",
            ));
        }
        super::characters::validate_equipment_list(&self.equipment, "outfit_draft.equipment")?;
        Ok(())
    }
}

fn horizontal_mirror(direction: Direction) -> Direction {
    match direction {
        Direction::N => Direction::N,
        Direction::Ne => Direction::Nw,
        Direction::E => Direction::W,
        Direction::Se => Direction::Sw,
        Direction::S => Direction::S,
        Direction::Sw => Direction::Se,
        Direction::W => Direction::E,
        Direction::Nw => Direction::Ne,
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
