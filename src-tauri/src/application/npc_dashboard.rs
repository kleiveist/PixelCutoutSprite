use std::collections::HashSet;
use std::path::Path;

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::domain::{
    canonical_json_bytes, AnimationBinding, Appearance, AssetFallbackApproval, AssetRevision,
    Character, Direction, DirectionFit, DirectionMode, Equipment, LocalOverride, MotionRevision,
    ProfileRevision, RevisionRef, Sha256Digest, SlotAppearance, SlotRef, TemplateStatus,
};
use crate::exports::ExportService;
use crate::storage::VaultRoot;

use super::appearance_service::{AppearanceServiceError, OutfitLabelOption};
use super::binding_service::{
    NpcBindingView, NpcCompleteness, NpcExportStatus, NpcView, NpcWorkspaceContext,
    ReleasedMotionOption, RevisionComparison, RevisionCompatibility, RevisionOffer,
};
use super::outfit_snapshot::{project_labels, AreaSnapshot};
use super::{managed_output_directory, NpcExportService, StartNpcExportRequest};

pub(super) fn workspace_context(
    vault: &VaultRoot,
    area_path: &Path,
) -> Result<NpcWorkspaceContext, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let labels = project_labels(vault, snapshot.area.project_id)?;
    let mut npcs = snapshot
        .characters
        .iter()
        .map(|character| npc_view(vault, area_path, &snapshot, character, &labels))
        .collect::<Result<Vec<_>, _>>()?;
    npcs.sort_by(|left, right| {
        left.character
            .name
            .cmp(&right.character.name)
            .then(left.character.id.cmp(&right.character.id))
    });
    Ok(NpcWorkspaceContext {
        area_id: snapshot.area.id,
        area_name: snapshot.area.name.clone(),
        available_labels: labels,
        npcs,
    })
}

fn npc_view(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    character: &Character,
    labels: &[OutfitLabelOption],
) -> Result<NpcView, AppearanceServiceError> {
    let appearance = require_appearance(snapshot, character)?;
    let mut bindings = snapshot
        .bindings
        .iter()
        .filter(|binding| binding.character_id == character.id)
        .map(|binding| binding_view(snapshot, character, appearance, binding))
        .collect::<Result<Vec<_>, _>>()?;
    bindings.sort_by(|left, right| {
        left.binding
            .action_key
            .as_str()
            .cmp(right.binding.action_key.as_str())
            .then(left.binding.id.cmp(&right.binding.id))
    });
    let assigned = bindings
        .iter()
        .map(|view| view.binding.action_key.as_str())
        .collect::<HashSet<_>>();
    let missing_actions = character
        .required_actions
        .iter()
        .filter(|action| !assigned.contains(action.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let effective_bindings = bindings
        .iter()
        .map(|view| view.binding.clone())
        .collect::<Vec<_>>();
    let fingerprint =
        effective_source_fingerprint(snapshot, character, appearance, &effective_bindings)?;
    let export_status = export_status(vault, area_path, snapshot, character, &bindings)?;
    let mut available_slots = appearance
        .slots
        .iter()
        .map(|slot| slot.slot_id.clone())
        .collect::<Vec<_>>();
    available_slots.sort_by(|left, right| left.as_str().cmp(right.as_str()));
    let character_labels = character
        .label_ids
        .iter()
        .filter_map(|id| labels.iter().find(|label| label.id == *id).cloned())
        .collect();
    Ok(NpcView {
        character: character.clone(),
        labels: character_labels,
        bindings,
        completeness: if missing_actions.is_empty() {
            NpcCompleteness::Complete
        } else {
            NpcCompleteness::MissingActions
        },
        missing_actions,
        export_status,
        effective_source_fingerprint: fingerprint,
        available_slots,
        motion_options: motion_options(snapshot, character, appearance),
    })
}

fn binding_view(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    binding: &AnimationBinding,
) -> Result<NpcBindingView, AppearanceServiceError> {
    if binding.appearance_id != appearance.id {
        return Err(invalid(format!(
            "binding {} does not use NPC {} default appearance",
            binding.id, character.id
        )));
    }
    let template = snapshot
        .templates
        .iter()
        .find(|template| template.id == binding.template_ref.id)
        .ok_or_else(|| missing("binding motion template"))?;
    let motion = require_motion(snapshot, binding.template_ref)?;
    let (covered_directions, missing_directions) = direction_coverage(motion);
    let effective_source_fingerprint = effective_source_fingerprint(
        snapshot,
        character,
        appearance,
        std::slice::from_ref(binding),
    )?;
    let revision_offer =
        newest_revision_offer(snapshot, character, appearance, binding, template, motion)?;
    Ok(NpcBindingView {
        binding: binding.clone(),
        template_name: template.name.clone(),
        covered_directions,
        missing_directions,
        effective_source_fingerprint,
        revision_offer,
    })
}

fn newest_revision_offer(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    binding: &AnimationBinding,
    template: &crate::domain::MotionTemplate,
    current_motion: &MotionRevision,
) -> Result<Option<RevisionOffer>, AppearanceServiceError> {
    let mut newer_revisions = template
        .released_revisions
        .iter()
        .copied()
        .filter(|revision| *revision > binding.template_ref.revision)
        .collect::<Vec<_>>();
    newer_revisions.sort_unstable_by(|left, right| right.cmp(left));

    let mut latest_incompatible = None;
    for revision in newer_revisions {
        let template_ref = RevisionRef {
            id: template.id,
            revision,
        };
        let candidate = require_motion(snapshot, template_ref)?;
        let offer = revision_offer(
            snapshot,
            character,
            appearance,
            binding,
            current_motion,
            candidate,
        );
        if offer.compatibility == RevisionCompatibility::Compatible {
            return Ok(Some(offer));
        }
        if latest_incompatible.is_none() {
            latest_incompatible = Some(offer);
        }
    }
    Ok(latest_incompatible)
}

fn revision_offer(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    binding: &AnimationBinding,
    current_motion: &MotionRevision,
    candidate: &MotionRevision,
) -> RevisionOffer {
    let (current_covered_directions, _) = direction_coverage(current_motion);
    let (candidate_covered_directions, _) = direction_coverage(candidate);
    let comparison = RevisionComparison {
        current_frame_count: current_motion.frame_count,
        candidate_frame_count: candidate.frame_count,
        current_fps: current_motion.fps,
        candidate_fps: candidate.fps,
        current_covered_directions,
        candidate_covered_directions,
        retained_local_override_count: binding.local_overrides.len(),
    };
    match validate_compatibility(
        snapshot,
        character,
        appearance,
        candidate,
        &binding.local_overrides,
    ) {
        Ok(()) => RevisionOffer {
            template_ref: candidate.reference(),
            compatibility: RevisionCompatibility::Compatible,
            reason: None,
            comparison,
        },
        Err(error) => RevisionOffer {
            template_ref: candidate.reference(),
            compatibility: RevisionCompatibility::Incompatible,
            reason: Some(error.to_string()),
            comparison,
        },
    }
}

fn motion_options(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
) -> Vec<ReleasedMotionOption> {
    let mut options = Vec::new();
    for template in snapshot
        .templates
        .iter()
        .filter(|template| template.status == TemplateStatus::Active)
    {
        for revision in &template.released_revisions {
            let template_ref = RevisionRef {
                id: template.id,
                revision: *revision,
            };
            let Ok(motion) = require_motion(snapshot, template_ref) else {
                continue;
            };
            let (covered_directions, missing_directions) = direction_coverage(motion);
            let compatibility =
                validate_compatibility(snapshot, character, appearance, motion, &[]);
            options.push(ReleasedMotionOption {
                template_ref,
                template_name: template.name.clone(),
                default_action_key: template.action_key.clone(),
                frame_count: motion.frame_count,
                covered_directions,
                missing_directions,
                compatibility: if compatibility.is_ok() {
                    RevisionCompatibility::Compatible
                } else {
                    RevisionCompatibility::Incompatible
                },
                reason: compatibility.err().map(|error| error.to_string()),
            });
        }
    }
    options.sort_by(|left, right| {
        left.template_name
            .cmp(&right.template_name)
            .then(left.template_ref.revision.cmp(&right.template_ref.revision))
    });
    options
}

pub(super) fn validate_compatibility(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    motion: &MotionRevision,
    local_overrides: &[LocalOverride],
) -> Result<(), AppearanceServiceError> {
    let profile = snapshot
        .profiles
        .iter()
        .find(|profile| profile.reference() == motion.profile_ref)
        .ok_or_else(|| missing("motion profile snapshot"))?;
    if character.profile_ref != motion.profile_ref
        || appearance.profile_ref != motion.profile_ref
        || appearance.character_id != character.id
    {
        return Err(invalid(
            "character, appearance, and released motion must use one exact profile revision",
        ));
    }
    validate_appearance_slots(snapshot, appearance, profile)?;
    validate_overrides(profile, appearance, motion, local_overrides)?;
    snapshot.validate_equipment_references(
        &appearance.equipment,
        appearance.profile_ref,
        motion.reference(),
        true,
    )?;
    Ok(())
}

pub(super) fn validate_export_compatibility(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    motion: &MotionRevision,
    local_overrides: &[LocalOverride],
    allow_incomplete_test: bool,
) -> Result<Vec<String>, AppearanceServiceError> {
    if !allow_incomplete_test {
        validate_compatibility(snapshot, character, appearance, motion, local_overrides)?;
        return Ok(Vec::new());
    }
    let profile = snapshot
        .profiles
        .iter()
        .find(|profile| profile.reference() == motion.profile_ref)
        .ok_or_else(|| missing("motion profile snapshot"))?;
    if character.profile_ref != motion.profile_ref
        || appearance.profile_ref != motion.profile_ref
        || appearance.character_id != character.id
    {
        return Err(invalid(
            "character, appearance, and released motion must use one exact profile revision",
        ));
    }
    let mut reasons = validate_appearance_slots_for_export(snapshot, appearance, profile, true)?;
    validate_overrides(profile, appearance, motion, local_overrides)?;
    snapshot.validate_equipment_references(
        &appearance.equipment,
        appearance.profile_ref,
        motion.reference(),
        false,
    )?;
    collect_incomplete_equipment_reasons(snapshot, appearance, &mut reasons)?;
    reasons.sort();
    reasons.dedup();
    Ok(reasons)
}

fn validate_appearance_slots(
    snapshot: &AreaSnapshot,
    appearance: &Appearance,
    profile: &ProfileRevision,
) -> Result<(), AppearanceServiceError> {
    let reasons = validate_appearance_slots_for_export(snapshot, appearance, profile, false)?;
    debug_assert!(reasons.is_empty());
    Ok(())
}

fn validate_appearance_slots_for_export(
    snapshot: &AreaSnapshot,
    appearance: &Appearance,
    profile: &ProfileRevision,
    allow_incomplete_test: bool,
) -> Result<Vec<String>, AppearanceServiceError> {
    let mut reasons = Vec::new();
    for slot in &appearance.slots {
        if !profile
            .slots
            .iter()
            .any(|profile_slot| profile_slot.id == slot.slot_id)
        {
            return Err(invalid(format!(
                "appearance references unknown profile slot {}",
                slot.slot_id
            )));
        }
        for direction in Direction::ALL {
            let Some(fit) = slot
                .fit_by_direction
                .iter()
                .find(|fit| fit.direction == direction)
            else {
                if allow_incomplete_test {
                    reasons.push(format!(
                        "appearance slot {} has no {:?} fitting",
                        slot.slot_id, direction
                    ));
                    continue;
                }
                return Err(invalid(format!(
                    "appearance slot {} has no {:?} fitting",
                    slot.slot_id, direction
                )));
            };
            let reference = fit.asset.as_ref().unwrap_or(&slot.asset);
            let revision = snapshot.require_asset_revision(reference)?;
            let approved_fallback = appearance.asset_fallback_approvals.iter().any(|approval| {
                approval.slot_id == slot.slot_id
                    && approval.target_direction == direction
                    && approval.source_direction == revision.direction
                    && approval.variant == revision.variant
                    && revision.sprite_mirroring_allowed
            });
            if revision.profile_ref != appearance.profile_ref
                || revision.slot_id != slot.slot_id
                || (revision.direction != direction && !approved_fallback)
            {
                return Err(invalid(format!(
                    "appearance slot {} has an incompatible {:?} image",
                    slot.slot_id, direction
                )));
            }
            for variant in &fit.variant_fittings {
                let variant_revision = snapshot.require_asset_revision(&variant.asset)?;
                let approved_fallback =
                    appearance.asset_fallback_approvals.iter().any(|approval| {
                        approval.slot_id == slot.slot_id
                            && approval.target_direction == direction
                            && approval.source_direction == variant_revision.direction
                            && approval.variant == variant.variant
                            && variant_revision.sprite_mirroring_allowed
                    });
                if variant.variant == revision.variant
                    || variant.variant != variant_revision.variant
                    || variant_revision.profile_ref != appearance.profile_ref
                    || variant_revision.slot_id != slot.slot_id
                    || (variant_revision.direction != direction && !approved_fallback)
                {
                    return Err(invalid(format!(
                        "appearance slot {} has an incompatible {:?} variant {}",
                        slot.slot_id, direction, variant.variant
                    )));
                }
            }
        }
    }
    for required in profile.slots.iter().filter(|slot| !slot.optional) {
        if !appearance
            .slots
            .iter()
            .any(|slot| slot.slot_id == required.id)
        {
            if allow_incomplete_test {
                reasons.push(format!(
                    "appearance is missing required profile slot {}",
                    required.id
                ));
                continue;
            }
            return Err(invalid(format!(
                "appearance is missing required profile slot {}",
                required.id
            )));
        }
    }
    validate_fallback_approvals(snapshot, appearance)?;
    Ok(reasons)
}

fn collect_incomplete_equipment_reasons(
    snapshot: &AreaSnapshot,
    appearance: &Appearance,
    reasons: &mut Vec<String>,
) -> Result<(), AppearanceServiceError> {
    for equipment in &appearance.equipment {
        if equipment.enabled {
            collect_equipment_piece_reasons(
                snapshot,
                equipment.id,
                &equipment.asset,
                &equipment.fit_by_direction,
                reasons,
            )?;
        }
        for part in &equipment.additional_parts {
            if part.enabled {
                collect_equipment_piece_reasons(
                    snapshot,
                    part.id,
                    &part.asset,
                    &part.fit_by_direction,
                    reasons,
                )?;
            }
        }
    }
    Ok(())
}

fn collect_equipment_piece_reasons(
    snapshot: &AreaSnapshot,
    id: crate::domain::ObjectId,
    base_asset: &SlotRef,
    fits: &[DirectionFit],
    reasons: &mut Vec<String>,
) -> Result<(), AppearanceServiceError> {
    for direction in Direction::ALL {
        let covered = fits
            .iter()
            .find(|fit| fit.direction == direction)
            .map(|fit| fit.asset.as_ref().unwrap_or(base_asset))
            .map(|reference| snapshot.require_asset_revision(reference))
            .transpose()?
            .is_some_and(|revision| revision.direction == direction);
        if !covered {
            reasons.push(format!(
                "enabled equipment part {id} has no compatible {direction:?} image"
            ));
        }
    }
    Ok(())
}

fn validate_fallback_approvals(
    snapshot: &AreaSnapshot,
    appearance: &Appearance,
) -> Result<(), AppearanceServiceError> {
    for approval in &appearance.asset_fallback_approvals {
        let slot = appearance
            .slots
            .iter()
            .find(|slot| slot.slot_id == approval.slot_id)
            .ok_or_else(|| invalid("appearance fallback approval targets a missing slot"))?;
        let source_fit = slot
            .fit_by_direction
            .iter()
            .find(|fit| fit.direction == approval.source_direction)
            .ok_or_else(|| invalid("appearance fallback approval has no source fitting"))?;
        let base_reference = source_fit.asset.as_ref().unwrap_or(&slot.asset);
        let base_revision = snapshot.require_asset_revision(base_reference)?;
        let revision = if base_revision.variant == approval.variant {
            base_revision
        } else {
            let variant = source_fit
                .variant_fittings
                .iter()
                .find(|variant| variant.variant == approval.variant)
                .ok_or_else(|| invalid("appearance fallback approval has no source variant"))?;
            snapshot.require_asset_revision(&variant.asset)?
        };
        if revision.profile_ref != appearance.profile_ref
            || revision.slot_id != approval.slot_id
            || revision.direction != approval.source_direction
            || revision.variant != approval.variant
            || !revision.sprite_mirroring_allowed
        {
            return Err(invalid(
                "appearance fallback approval source is incompatible or not mirrorable",
            ));
        }
    }
    Ok(())
}

fn validate_overrides(
    profile: &ProfileRevision,
    appearance: &Appearance,
    motion: &MotionRevision,
    local_overrides: &[LocalOverride],
) -> Result<(), AppearanceServiceError> {
    for local in local_overrides {
        if !profile.slots.iter().any(|slot| slot.id == local.slot_id) {
            return Err(invalid(format!(
                "local override references unknown slot {}",
                local.slot_id
            )));
        }
        if !appearance
            .slots
            .iter()
            .any(|slot| slot.slot_id == local.slot_id)
        {
            return Err(invalid(format!(
                "local override references unassigned appearance slot {}",
                local.slot_id
            )));
        }
        let usable = motion.directions.iter().any(|definition| {
            definition.direction == local.direction && definition.mode != DirectionMode::Missing
        });
        if !usable {
            return Err(invalid(format!(
                "local override references unavailable direction {:?}",
                local.direction
            )));
        }
    }
    Ok(())
}

fn direction_coverage(motion: &MotionRevision) -> (Vec<Direction>, Vec<Direction>) {
    Direction::ALL.into_iter().partition(|direction| {
        motion.directions.iter().any(|definition| {
            definition.direction == *direction && definition.mode != DirectionMode::Missing
        })
    })
}

pub(super) fn require_appearance<'a>(
    snapshot: &'a AreaSnapshot,
    character: &Character,
) -> Result<&'a Appearance, AppearanceServiceError> {
    snapshot
        .appearances
        .iter()
        .find(|appearance| appearance.id == character.default_appearance_id)
        .ok_or_else(|| missing("NPC default appearance"))
}

pub(super) fn require_motion(
    snapshot: &AreaSnapshot,
    reference: RevisionRef,
) -> Result<&MotionRevision, AppearanceServiceError> {
    snapshot.workflow(reference).map(|(_, motion, _)| motion)
}

fn export_status(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    character: &Character,
    bindings: &[NpcBindingView],
) -> Result<NpcExportStatus, AppearanceServiceError> {
    if bindings.is_empty() {
        return Ok(NpcExportStatus::NotExported);
    }
    let binding_documents = bindings
        .iter()
        .map(|view| view.binding.clone())
        .collect::<Vec<_>>();
    if binding_documents.len() > 1 {
        match managed_current_status(vault, area_path, snapshot, character.id, &binding_documents)?
        {
            ManagedCurrentStatus::Current => return Ok(NpcExportStatus::Current),
            ManagedCurrentStatus::Stale => return Ok(NpcExportStatus::Stale),
            ManagedCurrentStatus::Missing => {}
        }
    }

    let mut found_count = 0;
    for binding in &binding_documents {
        match managed_current_status(
            vault,
            area_path,
            snapshot,
            character.id,
            std::slice::from_ref(binding),
        )? {
            ManagedCurrentStatus::Current => found_count += 1,
            ManagedCurrentStatus::Stale => return Ok(NpcExportStatus::Stale),
            ManagedCurrentStatus::Missing => {}
        }
    }
    if found_count == bindings.len() {
        Ok(NpcExportStatus::Current)
    } else if found_count > 0 {
        Ok(NpcExportStatus::Stale)
    } else {
        Ok(NpcExportStatus::NotExported)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ManagedCurrentStatus {
    Missing,
    Current,
    Stale,
}

fn managed_current_status(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    character_id: crate::domain::ObjectId,
    bindings: &[AnimationBinding],
) -> Result<ManagedCurrentStatus, AppearanceServiceError> {
    let output = managed_output_directory(area_path, snapshot, character_id, bindings)
        .map_err(|error| invalid(error.to_string()))?;
    let exporter = ExportService::new(vault.clone(), env!("CARGO_PKG_VERSION"));
    let current = match exporter.current(&output) {
        Ok(Some(current)) => current,
        Ok(None) => return Ok(ManagedCurrentStatus::Missing),
        Err(_) => return Ok(ManagedCurrentStatus::Stale),
    };
    if !current.current.complete {
        return Ok(ManagedCurrentStatus::Stale);
    }
    let expected_ids = bindings
        .iter()
        .map(|binding| binding.id)
        .collect::<HashSet<_>>();
    let manifest_ids = current
        .manifest
        .sources
        .bindings
        .iter()
        .map(|reference| reference.id)
        .collect::<HashSet<_>>();
    if current.manifest.character_id != character_id || manifest_ids != expected_ids {
        return Ok(ManagedCurrentStatus::Stale);
    }
    let Some(first_action) = current.manifest.actions.first() else {
        return Ok(ManagedCurrentStatus::Stale);
    };
    if current.manifest.actions.iter().any(|action| {
        action.root_motion_mode != first_action.root_motion_mode
            || action.jump_mode != first_action.jump_mode
    }) {
        return Ok(ManagedCurrentStatus::Stale);
    }
    let request = StartNpcExportRequest {
        character_id,
        binding_ids: bindings.iter().map(|binding| binding.id).collect(),
        profile: current.manifest.profile.clone(),
        root_motion_mode: first_action.root_motion_mode,
        jump_mode: first_action.jump_mode,
    };
    let prepared = match NpcExportService.prepare(vault, area_path, request) {
        Ok(prepared) if prepared.output_directory == output => prepared,
        Ok(_) | Err(_) => return Ok(ManagedCurrentStatus::Stale),
    };
    let fingerprint = match exporter.source_fingerprint(&prepared.request) {
        Ok(fingerprint) => fingerprint,
        Err(_) => return Ok(ManagedCurrentStatus::Stale),
    };
    Ok(if fingerprint == current.current.source_fingerprint {
        ManagedCurrentStatus::Current
    } else {
        ManagedCurrentStatus::Stale
    })
}

#[derive(Serialize)]
struct EffectiveSources<'a> {
    profile: &'a ProfileRevision,
    appearance: EffectiveAppearance<'a>,
    bindings: Vec<EffectiveBinding<'a>>,
    motions: Vec<&'a MotionRevision>,
    assets: Vec<&'a AssetRevision>,
}

#[derive(Serialize)]
struct EffectiveAppearance<'a> {
    id: crate::domain::ObjectId,
    profile_ref: RevisionRef,
    slots: &'a [SlotAppearance],
    asset_fallback_approvals: &'a [AssetFallbackApproval],
    equipment: &'a [Equipment],
}

#[derive(Serialize)]
struct EffectiveBinding<'a> {
    id: crate::domain::ObjectId,
    action_key: &'a crate::domain::ActionKey,
    template_ref: RevisionRef,
    appearance_id: crate::domain::ObjectId,
    local_overrides: &'a [LocalOverride],
}

pub(super) fn effective_source_fingerprint(
    snapshot: &AreaSnapshot,
    character: &Character,
    appearance: &Appearance,
    bindings: &[AnimationBinding],
) -> Result<Sha256Digest, AppearanceServiceError> {
    if bindings.iter().any(|binding| {
        binding.character_id != character.id || binding.appearance_id != appearance.id
    }) {
        return Err(invalid(
            "effective source fingerprint requires bindings for the NPC default appearance",
        ));
    }
    let profile = snapshot
        .profiles
        .iter()
        .find(|profile| profile.reference() == character.profile_ref)
        .ok_or_else(|| missing("NPC profile snapshot"))?;
    let mut binding_sources = bindings
        .iter()
        .map(|binding| EffectiveBinding {
            id: binding.id,
            action_key: &binding.action_key,
            template_ref: binding.template_ref,
            appearance_id: binding.appearance_id,
            local_overrides: &binding.local_overrides,
        })
        .collect::<Vec<_>>();
    binding_sources.sort_by(|left, right| {
        left.action_key
            .as_str()
            .cmp(right.action_key.as_str())
            .then(left.id.cmp(&right.id))
    });
    let mut motions = bindings
        .iter()
        .map(|binding| require_motion(snapshot, binding.template_ref))
        .collect::<Result<Vec<_>, _>>()?;
    motions.sort_by_key(|motion| (motion.template_id, motion.revision));
    motions.dedup_by_key(|motion| (motion.template_id, motion.revision));
    let assets = effective_assets(snapshot, appearance)?;
    let payload = EffectiveSources {
        profile,
        appearance: EffectiveAppearance {
            id: appearance.id,
            profile_ref: appearance.profile_ref,
            slots: &appearance.slots,
            asset_fallback_approvals: &appearance.asset_fallback_approvals,
            equipment: &appearance.equipment,
        },
        bindings: binding_sources,
        motions,
        assets,
    };
    let bytes = canonical_json_bytes(&payload)?;
    Sha256Digest::parse(format!("{:x}", Sha256::digest(bytes))).map_err(Into::into)
}

fn effective_assets<'a>(
    snapshot: &'a AreaSnapshot,
    appearance: &Appearance,
) -> Result<Vec<&'a AssetRevision>, AppearanceServiceError> {
    let mut references = Vec::new();
    for slot in &appearance.slots {
        push_slot_references(&mut references, slot);
    }
    for equipment in &appearance.equipment {
        references.push(&equipment.asset);
        push_direction_fit_references(&mut references, &equipment.fit_by_direction);
        for part in &equipment.additional_parts {
            references.push(&part.asset);
            push_direction_fit_references(&mut references, &part.fit_by_direction);
        }
    }
    references.sort_by_key(|reference| (reference.asset_id, reference.revision));
    references.dedup_by_key(|reference| (reference.asset_id, reference.revision));
    references
        .into_iter()
        .map(|reference| snapshot.require_asset_revision(reference))
        .collect()
}

fn push_slot_references<'a>(references: &mut Vec<&'a SlotRef>, slot: &'a SlotAppearance) {
    references.push(&slot.asset);
    push_direction_fit_references(references, &slot.fit_by_direction);
}

fn push_direction_fit_references<'a>(references: &mut Vec<&'a SlotRef>, fits: &'a [DirectionFit]) {
    for fit in fits {
        if let Some(asset) = &fit.asset {
            references.push(asset);
        }
        references.extend(fit.variant_fittings.iter().map(|variant| &variant.asset));
    }
}

fn missing(what: &str) -> AppearanceServiceError {
    invalid(format!("{what} is missing"))
}

fn invalid(message: impl Into<String>) -> AppearanceServiceError {
    AppearanceServiceError::InvalidState(message.into())
}
