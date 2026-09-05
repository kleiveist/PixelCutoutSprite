use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::{
    validate_kind_revision, validate_name, validate_schema, ActionKey, AssetFallbackApproval,
    Direction, DocumentKind, DomainError, ObjectId, PixelPoint, RevisionRef, SlotId, SlotRef,
    SpriteVariantFitting, Transform2D, UtcTimestamp,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CharacterStatus {
    Draft,
    Reviewed,
    Archived,
}

impl CharacterStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Reviewed)
                | (Self::Draft, Self::Archived)
                | (Self::Reviewed, Self::Draft)
                | (Self::Reviewed, Self::Archived)
                | (Self::Archived, Self::Draft)
        ) || self == next
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Character {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub name: String,
    pub description: String,
    pub status: CharacterStatus,
    pub profile_ref: RevisionRef,
    pub default_appearance_id: ObjectId,
    pub label_ids: Vec<ObjectId>,
    pub required_actions: Vec<ActionKey>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Character {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::Character,
            self.revision,
            "character",
        )?;
        validate_name("character.name", &self.name)?;
        if self.description.chars().count() > 2000 {
            return Err(DomainError::invalid(
                "character.description",
                "must not exceed 2000 characters",
            ));
        }
        self.profile_ref.validate("character.profile_ref")?;
        super::ensure_unique_ids("character.label_ids", &self.label_ids)?;
        let mut actions = HashSet::new();
        for action in &self.required_actions {
            ActionKey::parse(action.as_str())?;
            if !actions.insert(action) {
                return Err(DomainError::DuplicateId(format!(
                    "character.action:{action}"
                )));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FollowMode {
    Slot,
    World,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DirectionFit {
    pub direction: Direction,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset: Option<SlotRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pivot_px: Option<PixelPoint>,
    #[serde(default)]
    pub variant_fittings: Vec<SpriteVariantFitting>,
    pub transform: Transform2D,
    pub visible: bool,
    pub layer_delta: i16,
}

impl DirectionFit {
    fn validate(&self, path: &str) -> Result<(), DomainError> {
        if let Some(asset) = &self.asset {
            asset.validate(&format!("{path}.asset"))?;
        }
        if let Some(pivot) = self.pivot_px {
            pivot.validate(&format!("{path}.pivot_px"))?;
        }
        let mut variants = HashSet::new();
        for (index, variant) in self.variant_fittings.iter().enumerate() {
            variant.validate(&format!("{path}.variant_fittings[{index}]"))?;
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
pub struct SlotAppearance {
    pub slot_id: SlotId,
    pub asset: SlotRef,
    pub fit_by_direction: Vec<DirectionFit>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Equipment {
    pub id: ObjectId,
    pub name: String,
    pub anchor_slot: SlotId,
    pub asset: SlotRef,
    pub enabled: bool,
    pub follow_mode: FollowMode,
    pub own_motion_enabled: bool,
    pub fit_by_direction: Vec<DirectionFit>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Appearance {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub character_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub name: String,
    pub slots: Vec<SlotAppearance>,
    #[serde(default)]
    pub asset_fallback_approvals: Vec<AssetFallbackApproval>,
    pub equipment: Vec<Equipment>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Appearance {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::Appearance,
            self.revision,
            "appearance",
        )?;
        validate_name("appearance.name", &self.name)?;
        self.profile_ref.validate("appearance.profile_ref")?;
        let mut slots = HashSet::new();
        for (index, slot) in self.slots.iter().enumerate() {
            SlotId::parse(slot.slot_id.as_str())?;
            slot.asset
                .validate(&format!("appearance.slots[{index}].asset"))?;
            if slot.asset.slot_id != slot.slot_id || !slots.insert(slot.slot_id.clone()) {
                return Err(DomainError::invalid(
                    format!("appearance.slots[{index}]"),
                    "slot identity must be unique and match the asset slot",
                ));
            }
            validate_fits(
                &slot.fit_by_direction,
                &format!("appearance.slots[{index}]"),
            )?;
            if slot.fit_by_direction.iter().any(|fit| {
                fit.asset
                    .as_ref()
                    .is_some_and(|asset| asset.slot_id != slot.slot_id)
                    || fit
                        .variant_fittings
                        .iter()
                        .any(|variant| variant.asset.slot_id != slot.slot_id)
            }) {
                return Err(DomainError::invalid(
                    format!("appearance.slots[{index}].fit_by_direction.asset"),
                    "direction asset must match the appearance slot",
                ));
            }
        }
        let mut approvals = HashSet::new();
        for (index, approval) in self.asset_fallback_approvals.iter().enumerate() {
            approval.validate(&format!("appearance.asset_fallback_approvals[{index}]"))?;
            if !slots.contains(&approval.slot_id)
                || !approvals.insert((
                    approval.slot_id.clone(),
                    approval.target_direction,
                    approval.variant.clone(),
                ))
            {
                return Err(DomainError::invalid(
                    "appearance.asset_fallback_approvals",
                    "fallback approvals must be unique and target an appearance slot",
                ));
            }
        }
        let mut equipment_ids = HashSet::new();
        for (index, equipment) in self.equipment.iter().enumerate() {
            validate_name(
                &format!("appearance.equipment[{index}].name"),
                &equipment.name,
            )?;
            SlotId::parse(equipment.anchor_slot.as_str())?;
            equipment
                .asset
                .validate(&format!("appearance.equipment[{index}].asset"))?;
            if !equipment_ids.insert(equipment.id) {
                return Err(DomainError::DuplicateId(format!(
                    "appearance.equipment:{}",
                    equipment.id
                )));
            }
            validate_fits(
                &equipment.fit_by_direction,
                &format!("appearance.equipment[{index}]"),
            )?;
            if equipment.fit_by_direction.iter().any(|fit| {
                fit.asset
                    .as_ref()
                    .is_some_and(|asset| asset.slot_id != equipment.asset.slot_id)
                    || fit
                        .variant_fittings
                        .iter()
                        .any(|variant| variant.asset.slot_id != equipment.asset.slot_id)
            }) {
                return Err(DomainError::invalid(
                    format!("appearance.equipment[{index}].fit_by_direction.asset"),
                    "direction assets must match the equipment slot",
                ));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewState {
    Draft,
    Reviewed,
}

impl ReviewState {
    pub fn can_transition_to(self, next: Self) -> bool {
        self == next || matches!((self, next), (Self::Draft, Self::Reviewed))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LocalOverride {
    pub slot_id: SlotId,
    pub direction: Direction,
    pub transform: Transform2D,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnimationBinding {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub character_id: ObjectId,
    pub action_key: ActionKey,
    pub template_ref: RevisionRef,
    pub appearance_id: ObjectId,
    pub local_overrides: Vec<LocalOverride>,
    pub review_state: ReviewState,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl AnimationBinding {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::AnimationBinding,
            self.revision,
            "animation_binding",
        )?;
        ActionKey::parse(self.action_key.as_str())?;
        self.template_ref
            .validate("animation_binding.template_ref")?;
        let mut targets = HashSet::new();
        for (index, local) in self.local_overrides.iter().enumerate() {
            SlotId::parse(local.slot_id.as_str())?;
            local
                .transform
                .validate(&format!("animation_binding.local_overrides[{index}]"))?;
            if !targets.insert((local.slot_id.clone(), local.direction)) {
                return Err(DomainError::DuplicateId(format!(
                    "animation_binding.override:{}:{:?}",
                    local.slot_id, local.direction
                )));
            }
        }
        Ok(())
    }
}

fn validate_fits(fits: &[DirectionFit], path: &str) -> Result<(), DomainError> {
    let mut directions = HashSet::new();
    for (index, fit) in fits.iter().enumerate() {
        fit.validate(&format!("{path}.fit_by_direction[{index}]"))?;
        if !directions.insert(fit.direction) {
            return Err(DomainError::DuplicateId(format!(
                "{path}.direction:{:?}",
                fit.direction
            )));
        }
    }
    Ok(())
}
