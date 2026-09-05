use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{
    parse_document, AnimationBinding, Appearance, Area, Asset, AssetKind, AssetRevision, Character,
    CharacterStatus, Direction, DirectionFit, DomainDocument, Equipment, EquipmentMotionTrack,
    EquipmentPart, ExportManifest, MotionRevision, MotionTemplate, ObjectId, OutfitDraft,
    OutfitDraftStatus, OutfitFitting, ProfileRevision, RevisionRef, SlotId, SlotRef,
};
use crate::storage::{JsonStore, VaultRoot};

use super::appearance_service::{
    direction_rank, sort_fittings, AppearanceServiceError, OutfitAssetOption,
    OutfitCharacterChoice, OutfitDraftChoice, OutfitLabelOption,
};

#[derive(Debug)]
pub(super) struct AreaSnapshot {
    pub(super) area: Area,
    pub(super) templates: Vec<MotionTemplate>,
    pub(super) motions: Vec<MotionRevision>,
    pub(super) profiles: Vec<ProfileRevision>,
    pub(super) assets: Vec<Asset>,
    pub(super) asset_revisions: Vec<AssetRevision>,
    pub(super) drafts: Vec<OutfitDraft>,
    pub(super) draft_paths: HashMap<ObjectId, PathBuf>,
    pub(super) characters: Vec<Character>,
    pub(super) character_paths: HashMap<ObjectId, PathBuf>,
    pub(super) appearances: Vec<Appearance>,
    pub(super) appearance_paths: HashMap<ObjectId, PathBuf>,
    pub(super) bindings: Vec<AnimationBinding>,
    pub(super) binding_paths: HashMap<ObjectId, PathBuf>,
    pub(super) exports: Vec<ExportManifest>,
}

struct EquipmentPieceInput<'a> {
    id: ObjectId,
    anchor_slot: &'a SlotId,
    base_asset: &'a SlotRef,
    enabled: bool,
    fits: &'a [DirectionFit],
    tracks: &'a [EquipmentMotionTrack],
}

impl AreaSnapshot {
    pub(super) fn load(
        vault: &VaultRoot,
        area_path: &Path,
    ) -> Result<Self, AppearanceServiceError> {
        let area_manifest = vault.resolve(&area_path.join(".area/area.json"))?;
        let loaded = JsonStore::default().load(&area_manifest)?;
        let DomainDocument::Area(area) = loaded.value else {
            return Err(AppearanceServiceError::InvalidState(
                "the selected path has no valid area manifest".to_owned(),
            ));
        };
        let root = vault.resolve(area_path)?;
        let documents = collect_documents(vault, root.as_path(), 0, true)?;
        let mut result = Self {
            area,
            templates: Vec::new(),
            motions: Vec::new(),
            profiles: Vec::new(),
            assets: Vec::new(),
            asset_revisions: Vec::new(),
            drafts: Vec::new(),
            draft_paths: HashMap::new(),
            characters: Vec::new(),
            character_paths: HashMap::new(),
            appearances: Vec::new(),
            appearance_paths: HashMap::new(),
            bindings: Vec::new(),
            binding_paths: HashMap::new(),
            exports: Vec::new(),
        };
        for (path, document) in documents {
            result.add_document(path, document);
        }
        Ok(result)
    }

    fn add_document(&mut self, path: PathBuf, document: DomainDocument) {
        let is_binding_export = path
            .components()
            .any(|part| part.as_os_str().to_str() == Some("exports"));
        if is_binding_export && !matches!(&document, DomainDocument::ExportManifest(_)) {
            return;
        }
        match document {
            DomainDocument::MotionTemplate(value) if value.area_id == self.area.id => {
                self.templates.push(value);
            }
            DomainDocument::MotionRevision(value) => self.motions.push(value),
            DomainDocument::ProfileRevision(value) if value.area_id == self.area.id => {
                self.profiles.push(value);
            }
            DomainDocument::Asset(value) if value.area_id == self.area.id => {
                self.assets.push(value);
            }
            DomainDocument::AssetRevision(value) => self.asset_revisions.push(value),
            DomainDocument::OutfitDraft(value) if value.area_id == self.area.id => {
                self.draft_paths.insert(value.id, path);
                self.drafts.push(value);
            }
            DomainDocument::Character(value) if value.area_id == self.area.id => {
                self.character_paths.insert(value.id, path);
                self.characters.push(value);
            }
            DomainDocument::Appearance(value) => {
                self.appearance_paths.insert(value.id, path);
                self.appearances.push(value);
            }
            DomainDocument::AnimationBinding(value) => {
                self.binding_paths.insert(value.id, path);
                self.bindings.push(value);
            }
            DomainDocument::ExportManifest(value) => self.exports.push(value),
            _ => {}
        }
    }

    pub(super) fn workflow(
        &self,
        reference: RevisionRef,
    ) -> Result<(&MotionTemplate, &MotionRevision, &ProfileRevision), AppearanceServiceError> {
        let template = self
            .templates
            .iter()
            .find(|item| item.id == reference.id)
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "motion template does not exist in this area".to_owned(),
                )
            })?;
        if !template.released_revisions.contains(&reference.revision) {
            return Err(AppearanceServiceError::InvalidState(
                "only a released motion revision can enter the outfit workflow".to_owned(),
            ));
        }
        let motion = self
            .motions
            .iter()
            .find(|item| item.reference() == reference)
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "released motion revision is missing".to_owned(),
                )
            })?;
        let profile = self
            .profiles
            .iter()
            .find(|item| item.reference() == motion.profile_ref)
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "motion profile snapshot is missing".to_owned(),
                )
            })?;
        Ok((template, motion, profile))
    }

    pub(super) fn compatible_characters(
        &self,
        profile_ref: RevisionRef,
    ) -> Vec<OutfitCharacterChoice> {
        let mut values = self
            .characters
            .iter()
            .filter(|item| {
                item.profile_ref == profile_ref && item.status != CharacterStatus::Archived
            })
            .map(|item| OutfitCharacterChoice {
                id: item.id,
                name: item.name.clone(),
                appearance_id: item.default_appearance_id,
            })
            .collect::<Vec<_>>();
        values.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
        values
    }

    pub(super) fn resumable_drafts(&self, template_ref: RevisionRef) -> Vec<OutfitDraftChoice> {
        let mut values = self
            .drafts
            .iter()
            .filter(|draft| {
                draft.template_ref == template_ref && draft.status == OutfitDraftStatus::InProgress
            })
            .map(|draft| OutfitDraftChoice {
                id: draft.id,
                revision: draft.revision,
                character_id: draft.character_id,
                updated_at: draft.updated_at,
            })
            .collect::<Vec<_>>();
        values.sort_by_key(|item| std::cmp::Reverse(item.updated_at));
        values
    }

    pub(super) fn inventory(&self, profile_ref: RevisionRef) -> Vec<OutfitAssetOption> {
        self.inventory_with_pins(profile_ref, &[])
    }

    pub(super) fn inventory_for_draft(
        &self,
        profile_ref: RevisionRef,
        draft: &OutfitDraft,
    ) -> Vec<OutfitAssetOption> {
        let mut pinned = draft
            .fittings
            .iter()
            .flat_map(|fitting| {
                std::iter::once(fitting.asset.clone()).chain(
                    fitting
                        .variant_fittings
                        .iter()
                        .map(|variant| variant.asset.clone()),
                )
            })
            .collect::<Vec<_>>();
        for item in &draft.equipment {
            push_equipment_piece_references(&item.asset, &item.fit_by_direction, &mut pinned);
            for part in &item.additional_parts {
                push_equipment_piece_references(&part.asset, &part.fit_by_direction, &mut pinned);
            }
        }
        self.inventory_with_pins(profile_ref, &pinned)
    }

    fn inventory_with_pins(
        &self,
        profile_ref: RevisionRef,
        pinned: &[SlotRef],
    ) -> Vec<OutfitAssetOption> {
        let assets = self
            .assets
            .iter()
            .map(|asset| (asset.id, asset))
            .collect::<HashMap<_, _>>();
        let mut values = self
            .asset_revisions
            .iter()
            .filter_map(|revision| {
                let asset = assets.get(&revision.asset_id)?;
                let reference = SlotRef {
                    asset_id: revision.asset_id,
                    revision: revision.revision,
                    slot_id: revision.slot_id.clone(),
                };
                let assignable =
                    !asset.archived && asset.released_revisions.contains(&revision.revision);
                (revision.profile_ref == profile_ref
                    && (assignable || pinned.iter().any(|item| item == &reference)))
                .then(|| OutfitAssetOption {
                    asset: reference,
                    name: asset.name.clone(),
                    asset_kind: asset.asset_kind,
                    direction: revision.direction,
                    variant: revision.variant.clone(),
                    assignable,
                    sprite_mirroring_allowed: revision.sprite_mirroring_allowed,
                    pivot_px: revision.pivot_px,
                    image_size_px: revision.image_size_px,
                    source_file: revision.source_file.clone(),
                })
            })
            .collect::<Vec<_>>();
        values.sort_by_key(|item| {
            (
                item.asset.slot_id.to_string(),
                direction_rank(item.direction),
                item.name.clone(),
                item.asset.asset_id,
                item.asset.revision,
            )
        });
        values
    }

    pub(super) fn require_draft(
        &self,
        id: ObjectId,
    ) -> Result<&OutfitDraft, AppearanceServiceError> {
        self.drafts
            .iter()
            .find(|draft| draft.id == id)
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "the requested outfit draft does not exist in this area".to_owned(),
                )
            })
    }

    pub(super) fn require_asset_revision(
        &self,
        reference: &SlotRef,
    ) -> Result<&AssetRevision, AppearanceServiceError> {
        let revision = self
            .asset_revisions
            .iter()
            .find(|revision| {
                revision.asset_id == reference.asset_id && revision.revision == reference.revision
            })
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(format!(
                    "asset {} r{} is missing",
                    reference.asset_id, reference.revision
                ))
            })?;
        if !self
            .assets
            .iter()
            .any(|asset| asset.id == revision.asset_id)
        {
            return Err(AppearanceServiceError::InvalidState(format!(
                "asset {} has no manifest in this area",
                reference.asset_id
            )));
        }
        Ok(revision)
    }

    pub(super) fn require_assignable_asset_revision(
        &self,
        reference: &SlotRef,
    ) -> Result<&AssetRevision, AppearanceServiceError> {
        let revision = self.require_asset_revision(reference)?;
        let asset = self
            .assets
            .iter()
            .find(|asset| asset.id == revision.asset_id)
            .expect("require_asset_revision checked the parent manifest");
        if asset.archived || !asset.released_revisions.contains(&revision.revision) {
            return Err(AppearanceServiceError::InvalidState(format!(
                "asset {} r{} is archived or not released and cannot be newly assigned",
                reference.asset_id, reference.revision
            )));
        }
        Ok(revision)
    }

    pub(super) fn validate_draft_references(
        &self,
        draft: &OutfitDraft,
    ) -> Result<(), AppearanceServiceError> {
        let (_, _, profile) = self.workflow(draft.template_ref)?;
        if draft.area_id != self.area.id || draft.profile_ref != profile.reference() {
            return Err(AppearanceServiceError::InvalidState(
                "outfit draft does not belong to this area and motion profile".to_owned(),
            ));
        }
        for fit in &draft.fittings {
            if !profile.slots.iter().any(|slot| slot.id == fit.slot_id) {
                return Err(AppearanceServiceError::InvalidState(
                    "outfit draft fitting targets an unknown profile slot".to_owned(),
                ));
            }
            let base_revision = self.validate_fitting_asset(draft, fit, &fit.asset, None)?;
            for variant in &fit.variant_fittings {
                if variant.variant == base_revision.variant {
                    return Err(AppearanceServiceError::InvalidState(format!(
                        "outfit fitting {} {:?} defines variant {} more than once",
                        fit.slot_id, fit.direction, variant.variant
                    )));
                }
                self.validate_fitting_asset(draft, fit, &variant.asset, Some(&variant.variant))?;
            }
        }
        for approval in &draft.asset_fallback_approvals {
            if !profile.slots.iter().any(|slot| slot.id == approval.slot_id) {
                return Err(AppearanceServiceError::InvalidState(
                    "asset fallback approval targets an unknown profile slot".to_owned(),
                ));
            }
            let source = draft
                .fittings
                .iter()
                .find(|fit| {
                    fit.slot_id == approval.slot_id && fit.direction == approval.source_direction
                })
                .ok_or_else(|| {
                    AppearanceServiceError::InvalidState(
                        "asset fallback approval has no selected source fitting".to_owned(),
                    )
                })?;
            let base_revision = self.require_asset_revision(&source.asset)?;
            let revision = if base_revision.variant == approval.variant {
                base_revision
            } else {
                let variant = source
                    .variant_fittings
                    .iter()
                    .find(|variant| variant.variant == approval.variant)
                    .ok_or_else(|| {
                        AppearanceServiceError::InvalidState(
                            "asset fallback approval has no selected source variant".to_owned(),
                        )
                    })?;
                self.require_asset_revision(&variant.asset)?
            };
            if revision.profile_ref != draft.profile_ref
                || revision.slot_id != approval.slot_id
                || revision.direction != approval.source_direction
                || revision.variant != approval.variant
                || !revision.sprite_mirroring_allowed
            {
                return Err(AppearanceServiceError::InvalidState(
                    "asset fallback approval source is incompatible or not mirrorable".to_owned(),
                ));
            }
        }
        self.validate_equipment_references(
            &draft.equipment,
            draft.profile_ref,
            draft.template_ref,
            false,
        )?;
        Ok(())
    }

    fn validate_fitting_asset<'a>(
        &'a self,
        draft: &OutfitDraft,
        fit: &OutfitFitting,
        reference: &SlotRef,
        expected_variant: Option<&str>,
    ) -> Result<&'a AssetRevision, AppearanceServiceError> {
        let revision = self.require_asset_revision(reference)?;
        let approved_fallback = draft.asset_fallback_approvals.iter().any(|approval| {
            approval.slot_id == fit.slot_id
                && approval.target_direction == fit.direction
                && approval.source_direction == revision.direction
                && approval.variant == revision.variant
                && revision.sprite_mirroring_allowed
        });
        if revision.profile_ref != draft.profile_ref
            || revision.slot_id != fit.slot_id
            || expected_variant.is_some_and(|variant| variant != revision.variant)
            || (revision.direction != fit.direction && !approved_fallback)
        {
            return Err(AppearanceServiceError::InvalidState(
                "outfit draft references an incompatible or unapproved direction image".to_owned(),
            ));
        }
        Ok(revision)
    }

    pub(super) fn validate_equipment_references(
        &self,
        equipment: &[Equipment],
        profile_ref: RevisionRef,
        template_ref: RevisionRef,
        require_complete: bool,
    ) -> Result<(), AppearanceServiceError> {
        let (_, motion, profile) = self.workflow(template_ref)?;
        if profile.reference() != profile_ref {
            return Err(AppearanceServiceError::InvalidState(
                "equipment profile does not match the active outfit workflow".to_owned(),
            ));
        }
        for item in equipment {
            self.validate_equipment_piece(
                EquipmentPieceInput {
                    id: item.id,
                    anchor_slot: &item.anchor_slot,
                    base_asset: &item.asset,
                    enabled: item.enabled,
                    fits: &item.fit_by_direction,
                    tracks: &item.own_motion_tracks,
                },
                profile,
                motion,
                require_complete,
            )?;
            for part in &item.additional_parts {
                self.validate_equipment_part(part, profile, motion, require_complete)?;
            }
        }
        Ok(())
    }

    fn validate_equipment_part(
        &self,
        part: &EquipmentPart,
        profile: &ProfileRevision,
        motion: &MotionRevision,
        require_complete: bool,
    ) -> Result<(), AppearanceServiceError> {
        self.validate_equipment_piece(
            EquipmentPieceInput {
                id: part.id,
                anchor_slot: &part.anchor_slot,
                base_asset: &part.asset,
                enabled: part.enabled,
                fits: &part.fit_by_direction,
                tracks: &part.own_motion_tracks,
            },
            profile,
            motion,
            require_complete,
        )
    }

    fn validate_equipment_piece(
        &self,
        part: EquipmentPieceInput<'_>,
        profile: &ProfileRevision,
        motion: &MotionRevision,
        require_complete: bool,
    ) -> Result<(), AppearanceServiceError> {
        if !profile
            .slots
            .iter()
            .any(|slot| slot.id == *part.anchor_slot)
        {
            return Err(AppearanceServiceError::InvalidState(format!(
                "equipment part {} references unknown anchor slot {}",
                part.id, part.anchor_slot
            )));
        }
        self.validate_equipment_asset(part.base_asset, profile.reference(), part.anchor_slot)?;
        for fit in part.fits {
            let reference = fit.asset.as_ref().unwrap_or(part.base_asset);
            let revision =
                self.validate_equipment_asset(reference, profile.reference(), part.anchor_slot)?;
            if fit.asset.is_some() && revision.direction != fit.direction {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "equipment part {} has an incompatible {:?} direction image",
                    part.id, fit.direction
                )));
            }
            if fit
                .variant_fittings
                .iter()
                .any(|variant| variant.variant == revision.variant)
            {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "equipment part {} defines sprite variant {} more than once",
                    part.id, revision.variant
                )));
            }
            for variant in &fit.variant_fittings {
                let variant_revision = self.validate_equipment_asset(
                    &variant.asset,
                    profile.reference(),
                    part.anchor_slot,
                )?;
                if variant_revision.direction != fit.direction
                    || variant_revision.variant != variant.variant
                {
                    return Err(AppearanceServiceError::InvalidState(format!(
                        "equipment part {} has an incompatible {:?} sprite variant {}",
                        part.id, fit.direction, variant.variant
                    )));
                }
            }
        }
        for track in part.tracks {
            if track.keys.iter().any(|key| key.frame >= motion.frame_count) {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "equipment part {} has a motion key outside 0..{}",
                    part.id, motion.frame_count
                )));
            }
        }
        if require_complete && part.enabled {
            let complete = Direction::ALL.into_iter().all(|direction| {
                part.fits.iter().any(|fit| {
                    if fit.direction != direction {
                        return false;
                    }
                    let reference = fit.asset.as_ref().unwrap_or(part.base_asset);
                    self.validate_equipment_asset(reference, profile.reference(), part.anchor_slot)
                        .is_ok_and(|revision| {
                            revision.profile_ref == profile.reference()
                                && revision.slot_id == *part.anchor_slot
                                && revision.direction == direction
                        })
                })
            });
            if !complete {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "enabled equipment part {} needs an explicit compatible image in all eight directions",
                    part.id
                )));
            }
        }
        Ok(())
    }

    fn validate_equipment_asset(
        &self,
        reference: &SlotRef,
        profile_ref: RevisionRef,
        anchor_slot: &SlotId,
    ) -> Result<&AssetRevision, AppearanceServiceError> {
        let revision = self.require_asset_revision(reference)?;
        if revision.profile_ref != profile_ref || revision.slot_id != *anchor_slot {
            return Err(AppearanceServiceError::InvalidState(
                "equipment image must match its profile and anchor slot".to_owned(),
            ));
        }
        let asset = self
            .assets
            .iter()
            .find(|asset| asset.id == reference.asset_id)
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "equipment image has no owning asset manifest".to_owned(),
                )
            })?;
        if !matches!(
            asset.asset_kind,
            AssetKind::Armour | AssetKind::Accessory | AssetKind::Equipment
        ) {
            return Err(AppearanceServiceError::InvalidState(
                "only armour, accessory, or equipment assets can become equipment pieces"
                    .to_owned(),
            ));
        }
        Ok(revision)
    }

    pub(super) fn fittings_from_appearance(
        &self,
        appearance: &Appearance,
    ) -> Result<Vec<OutfitFitting>, AppearanceServiceError> {
        let mut result = Vec::new();
        for slot in &appearance.slots {
            for fit in &slot.fit_by_direction {
                let has_direction_asset = fit.asset.is_some();
                let asset = fit.asset.clone().unwrap_or_else(|| slot.asset.clone());
                let revision = self.require_asset_revision(&asset)?;
                let approved_fallback =
                    appearance.asset_fallback_approvals.iter().any(|approval| {
                        approval.slot_id == slot.slot_id
                            && approval.target_direction == fit.direction
                            && approval.source_direction == revision.direction
                            && approval.variant == revision.variant
                            && revision.sprite_mirroring_allowed
                    });
                let compatible = revision.profile_ref == appearance.profile_ref
                    && revision.slot_id == slot.slot_id
                    && (revision.direction == fit.direction || approved_fallback);
                if !compatible && has_direction_asset {
                    return Err(AppearanceServiceError::InvalidState(
                        "the selected NPC appearance contains an incompatible direction image"
                            .to_owned(),
                    ));
                }
                // Legacy v1 appearances have only a base image. Keep the one matching direction
                // and expose every other direction as missing until the user explicitly assigns it.
                if !compatible {
                    continue;
                }
                if fit
                    .variant_fittings
                    .iter()
                    .any(|variant| variant.variant == revision.variant)
                {
                    return Err(AppearanceServiceError::InvalidState(
                        "the selected NPC appearance defines a sprite variant more than once"
                            .to_owned(),
                    ));
                }
                for variant in &fit.variant_fittings {
                    let variant_revision = self.require_asset_revision(&variant.asset)?;
                    let approved_fallback =
                        appearance.asset_fallback_approvals.iter().any(|approval| {
                            approval.slot_id == slot.slot_id
                                && approval.target_direction == fit.direction
                                && approval.source_direction == variant_revision.direction
                                && approval.variant == variant.variant
                                && variant_revision.sprite_mirroring_allowed
                        });
                    if variant_revision.profile_ref != appearance.profile_ref
                        || variant_revision.slot_id != slot.slot_id
                        || variant_revision.variant != variant.variant
                        || (variant_revision.direction != fit.direction && !approved_fallback)
                    {
                        return Err(AppearanceServiceError::InvalidState(
                            "the selected NPC appearance contains an incompatible sprite variant"
                                .to_owned(),
                        ));
                    }
                }
                result.push(OutfitFitting {
                    slot_id: slot.slot_id.clone(),
                    direction: fit.direction,
                    asset,
                    pivot_px: fit.pivot_px.unwrap_or(revision.pivot_px),
                    variant_fittings: fit.variant_fittings.clone(),
                    transform: fit.transform,
                    visible: fit.visible,
                    layer_delta: fit.layer_delta,
                });
            }
        }
        sort_fittings(&mut result);
        Ok(result)
    }
}

fn push_equipment_piece_references(
    base: &SlotRef,
    fits: &[DirectionFit],
    references: &mut Vec<SlotRef>,
) {
    references.push(base.clone());
    for fit in fits {
        if let Some(asset) = &fit.asset {
            references.push(asset.clone());
        }
        references.extend(
            fit.variant_fittings
                .iter()
                .map(|variant| variant.asset.clone()),
        );
    }
}

pub(super) fn validate_project_labels(
    vault: &VaultRoot,
    project_id: ObjectId,
    requested: &[ObjectId],
) -> Result<(), AppearanceServiceError> {
    let requested_set = requested.iter().copied().collect::<HashSet<_>>();
    if requested_set.len() != requested.len() {
        return Err(AppearanceServiceError::InvalidState(
            "NPC labels must be unique".to_owned(),
        ));
    }
    if requested.is_empty() {
        return Ok(());
    }
    let matching = collect_documents(vault, vault.path(), 0, false)?
        .into_iter()
        .filter_map(|(_, document)| match document {
            DomainDocument::Label(label)
                if label.project_id == Some(project_id) && requested_set.contains(&label.id) =>
            {
                Some(label.id)
            }
            _ => None,
        })
        .collect::<HashSet<_>>();
    if matching != requested_set {
        return Err(AppearanceServiceError::InvalidState(
            "one or more NPC labels do not belong to this project".to_owned(),
        ));
    }
    Ok(())
}

pub(super) fn project_labels(
    vault: &VaultRoot,
    project_id: ObjectId,
) -> Result<Vec<OutfitLabelOption>, AppearanceServiceError> {
    let mut labels = collect_documents(vault, vault.path(), 0, false)?
        .into_iter()
        .filter_map(|(_, document)| match document {
            DomainDocument::Label(label) if label.project_id == Some(project_id) => {
                Some(OutfitLabelOption {
                    id: label.id,
                    name: label.name,
                    color: label.color,
                })
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    labels.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Ok(labels)
}

fn collect_documents(
    vault: &VaultRoot,
    directory: &Path,
    depth: u8,
    include_exports: bool,
) -> Result<Vec<(PathBuf, DomainDocument)>, AppearanceServiceError> {
    let derived_export = is_derived_export_path(vault, directory);
    if depth > 16 {
        if derived_export {
            return Ok(Vec::new());
        }
        return Err(AppearanceServiceError::InvalidState(
            "area nesting exceeds the supported depth".to_owned(),
        ));
    }
    let mut result = Vec::new();
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) if derived_export => return Ok(result),
        Err(error) => {
            return Err(AppearanceServiceError::InvalidState(format!(
                "could not scan area sources: {error}"
            )))
        }
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) if derived_export => continue,
            Err(error) => {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "could not inspect area source: {error}"
                )))
            }
        };
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) if derived_export => continue,
            Err(error) => {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "could not inspect area source: {error}"
                )))
            }
        };
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        if file_type.is_dir() {
            if should_skip_directory(&path, include_exports) {
                continue;
            }
            result.extend(collect_documents(vault, &path, depth + 1, include_exports)?);
        } else if file_type.is_file() && path.extension().is_some_and(|value| value == "json") {
            let document = if is_derived_export_path(vault, &path) {
                read_export_manifest_candidate(&path)
            } else {
                read_domain_document(&path)
            }?;
            if let Some(document) = document {
                let relative = path
                    .strip_prefix(vault.path())
                    .map_err(|_| {
                        AppearanceServiceError::InvalidState(
                            "area scan escaped the vault".to_owned(),
                        )
                    })?
                    .to_path_buf();
                result.push((relative, document));
            }
        }
    }
    Ok(result)
}

fn should_skip_directory(path: &Path, include_exports: bool) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(".staged"))
        || (!include_exports
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name == "exports"))
        || path.components().any(|part| {
            matches!(
                part.as_os_str().to_str(),
                Some("cache" | "_exports" | ".trash" | "trash" | "backups" | "transactions")
            )
        })
}

fn is_derived_export_path(vault: &VaultRoot, path: &Path) -> bool {
    path.strip_prefix(vault.path())
        .unwrap_or(path)
        .components()
        .any(|part| part.as_os_str().to_str() == Some("exports"))
}

fn read_export_manifest_candidate(
    path: &Path,
) -> Result<Option<DomainDocument>, AppearanceServiceError> {
    let Ok(bytes) = fs::read(path) else {
        return Ok(None);
    };
    match parse_document(&bytes) {
        Ok(document @ DomainDocument::ExportManifest(_)) => Ok(Some(document)),
        Ok(_) | Err(_) => Ok(None),
    }
}

fn read_domain_document(path: &Path) -> Result<Option<DomainDocument>, AppearanceServiceError> {
    let bytes = fs::read(path).map_err(|error| {
        AppearanceServiceError::InvalidState(format!("could not read area source: {error}"))
    })?;
    match parse_document(&bytes) {
        Ok(document) => Ok(Some(document)),
        Err(error) if is_managed_document_path(path) => Err(error.into()),
        Err(_) => Ok(None),
    }
}

fn is_managed_document_path(path: &Path) -> bool {
    if path
        .components()
        .any(|part| matches!(part.as_os_str().to_str(), Some(".area")))
    {
        return true;
    }
    let name = path.file_name().and_then(|value| value.to_str());
    if matches!(
        name,
        Some("vault.json" | "character.json" | "binding.json" | "asset.json" | "template.json")
    ) {
        return true;
    }
    path.parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .is_some_and(|name| name == "appearances")
}
