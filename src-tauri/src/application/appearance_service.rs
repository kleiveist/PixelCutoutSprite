use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::animation::{AnimationSampler, EquipmentSampleError, SampleError};
use crate::directions::{
    DirectionError, DirectionResolver, DirectionalPose, SampledSlot as DirectionSampledSlot,
};
use crate::domain::{
    AnimationBinding, Appearance, AssetKind, AssetRevision, Character, CharacterStatus, Direction,
    DirectionFit, DocumentKind, DomainDocument, DomainError, Equipment, MotionRevision,
    MotionTemplate, ObjectId, OutfitDraft, OutfitDraftStatus, OutfitFitting, OutfitLocalOverride,
    PixelPoint, PixelSize, ProfileRevision, RelativePath, RevisionRef, Sha256Digest,
    SlotAppearance, SlotId, SlotRef, SpriteVariantFitting, Transform2D, UtcTimestamp,
    SCHEMA_VERSION,
};
use crate::render::{ClippingNotice, RenderError, RenderTransform};
use crate::storage::{JsonStore, SaveState, StorageError, VaultRoot};

use super::outfit_snapshot::{project_labels, AreaSnapshot};

#[derive(Debug, Error)]
pub enum AppearanceServiceError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Sample(#[from] SampleError),
    #[error(transparent)]
    Direction(#[from] DirectionError),
    #[error(transparent)]
    EquipmentSample(#[from] EquipmentSampleError),
    #[error(transparent)]
    Render(#[from] RenderError),
    #[error("outfit image could not be decoded: {0}")]
    Image(String),
    #[error("{0}")]
    InvalidState(String),
    #[error("outfit draft revision conflict: expected {expected}, found {found}")]
    RevisionConflict { expected: u32, found: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OutfitTarget {
    NewNpc,
    ExistingNpc { character_id: ObjectId },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitCharacterChoice {
    pub id: ObjectId,
    pub name: String,
    pub appearance_id: ObjectId,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitDraftChoice {
    pub id: ObjectId,
    pub revision: u32,
    pub character_id: Option<ObjectId>,
    pub updated_at: UtcTimestamp,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitAssetOption {
    pub asset: SlotRef,
    pub name: String,
    pub asset_kind: AssetKind,
    pub direction: Direction,
    pub variant: String,
    /// False only for an archived or no-longer-released revision already pinned by this draft.
    pub assignable: bool,
    pub sprite_mirroring_allowed: bool,
    pub pivot_px: PixelPoint,
    pub image_size_px: PixelSize,
    pub source_file: RelativePath,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OutfitLabelOption {
    pub id: ObjectId,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MissingOutfitSlot {
    pub slot_id: SlotId,
    pub missing_directions: Vec<Direction>,
    pub missing_variants: Vec<MissingOutfitVariant>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MissingOutfitVariant {
    pub direction: Direction,
    pub variant: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitLaunchContext {
    pub template: MotionTemplate,
    pub motion: MotionRevision,
    pub profile: ProfileRevision,
    pub compatible_characters: Vec<OutfitCharacterChoice>,
    pub resumable_drafts: Vec<OutfitDraftChoice>,
    pub inventory: Vec<OutfitAssetOption>,
    pub available_labels: Vec<OutfitLabelOption>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitEditorContext {
    pub draft: OutfitDraft,
    pub template: MotionTemplate,
    pub motion: MotionRevision,
    pub profile: ProfileRevision,
    pub inventory: Vec<OutfitAssetOption>,
    pub available_labels: Vec<OutfitLabelOption>,
    /// Bindings that share the edited Appearance and may observe shared fitting changes.
    pub affected_binding_count: usize,
    pub missing_required_slots: Vec<MissingOutfitSlot>,
    pub save_state: SaveState,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OutfitDraftEdits {
    pub fittings: Vec<OutfitFitting>,
    #[serde(default)]
    pub asset_fallback_approvals: Vec<crate::domain::AssetFallbackApproval>,
    pub local_overrides: Vec<OutfitLocalOverride>,
    #[serde(default)]
    pub equipment: Vec<Equipment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveNpcRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub label_ids: Vec<ObjectId>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SavedNpc {
    pub character: Character,
    pub appearance: Appearance,
    pub binding: AnimationBinding,
    pub draft: OutfitDraft,
    pub character_folder: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PreviewClipping {
    pub slot_id: SlotId,
    pub bounds_px: [i32; 4],
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PreviewGuide {
    pub slot_id: SlotId,
    /// SVG-compatible affine matrix: a, b, c, d, translate-x, translate-y.
    pub dummy_transform: [f64; 6],
    /// Image-local axes after appearance fitting and binding-local correction, before pivot.
    pub image_transform: [f64; 6],
    pub slot_size_px: PixelSize,
    pub slot_pivot_px: PixelPoint,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutfitPreviewFrame {
    pub direction: Direction,
    pub frame_index: u16,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    pub clipping: Vec<PreviewClipping>,
    pub guides: Vec<PreviewGuide>,
    /// Dummy outlines, pivots, axes, and selection handles are UI overlays, never render inputs.
    pub guides_included: bool,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct AppearanceService;

impl AppearanceService {
    pub fn launch_context(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        template_ref: RevisionRef,
    ) -> Result<OutfitLaunchContext, AppearanceServiceError> {
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let (template, motion, profile) = snapshot.workflow(template_ref)?;
        Ok(OutfitLaunchContext {
            template: template.clone(),
            motion: motion.clone(),
            profile: profile.clone(),
            compatible_characters: snapshot.compatible_characters(profile.reference()),
            resumable_drafts: snapshot.resumable_drafts(template_ref),
            inventory: snapshot.inventory(profile.reference()),
            available_labels: project_labels(vault, snapshot.area.project_id)?,
        })
    }

    pub fn start_draft(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        template_ref: RevisionRef,
        target: OutfitTarget,
    ) -> Result<OutfitEditorContext, AppearanceServiceError> {
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let (template, _, profile) = snapshot.workflow(template_ref)?;
        let now = now()?;
        let mut draft = OutfitDraft {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::OutfitDraft,
            id: ObjectId::new(),
            revision: 1,
            area_id: snapshot.area.id,
            template_ref,
            profile_ref: profile.reference(),
            character_id: None,
            appearance_id: None,
            base_character_revision: None,
            base_character_sha256: None,
            base_appearance_revision: None,
            base_appearance_sha256: None,
            base_binding_ref: None,
            base_binding_sha256: None,
            status: OutfitDraftStatus::InProgress,
            selected_assets: Vec::new(),
            asset_fallback_approvals: Vec::new(),
            fittings: Vec::new(),
            local_overrides: Vec::new(),
            equipment: Vec::new(),
            created_at: now,
            updated_at: now,
        };
        if let OutfitTarget::ExistingNpc { character_id } = target {
            let character = snapshot
                .characters
                .iter()
                .find(|item| item.id == character_id)
                .ok_or_else(|| {
                    AppearanceServiceError::InvalidState(
                        "the selected NPC does not exist in this area".to_owned(),
                    )
                })?;
            let character_path = snapshot.character_paths.get(&character.id).ok_or_else(|| {
                AppearanceServiceError::InvalidState("NPC character path is missing".to_owned())
            })?;
            let expected_appearance_id = character.default_appearance_id;
            let loaded_character = JsonStore::default().load(&vault.resolve(character_path)?)?;
            let DomainDocument::Character(character) = loaded_character.value else {
                return Err(AppearanceServiceError::InvalidState(
                    "NPC path contains the wrong document kind".to_owned(),
                ));
            };
            if character.id != character_id
                || character.area_id != snapshot.area.id
                || character.default_appearance_id != expected_appearance_id
                || character.status == CharacterStatus::Archived
                || character.profile_ref != profile.reference()
            {
                return Err(AppearanceServiceError::InvalidState(
                    "the selected NPC is archived or uses an incompatible profile".to_owned(),
                ));
            }
            let appearance = snapshot
                .appearances
                .iter()
                .find(|item| item.id == expected_appearance_id)
                .ok_or_else(|| {
                    AppearanceServiceError::InvalidState(
                        "the selected NPC has no default appearance".to_owned(),
                    )
                })?;
            let appearance_path =
                snapshot
                    .appearance_paths
                    .get(&appearance.id)
                    .ok_or_else(|| {
                        AppearanceServiceError::InvalidState(
                            "NPC appearance path is missing".to_owned(),
                        )
                    })?;
            let loaded_appearance = JsonStore::default().load(&vault.resolve(appearance_path)?)?;
            let DomainDocument::Appearance(appearance) = loaded_appearance.value else {
                return Err(AppearanceServiceError::InvalidState(
                    "appearance path contains the wrong document kind".to_owned(),
                ));
            };
            if appearance.id != expected_appearance_id
                || appearance.character_id != character.id
                || appearance.profile_ref != profile.reference()
            {
                return Err(AppearanceServiceError::InvalidState(
                    "the selected NPC default appearance is incompatible".to_owned(),
                ));
            }
            draft.character_id = Some(character.id);
            draft.appearance_id = Some(appearance.id);
            draft.base_character_revision = Some(character.revision);
            draft.base_character_sha256 = Some(Sha256Digest::parse(loaded_character.stamp.sha256)?);
            draft.base_appearance_revision = Some(appearance.revision);
            draft.base_appearance_sha256 =
                Some(Sha256Digest::parse(loaded_appearance.stamp.sha256)?);
            draft.fittings = snapshot.fittings_from_appearance(&appearance)?;
            draft.asset_fallback_approvals = appearance.asset_fallback_approvals.clone();
            draft.equipment = appearance.equipment.clone();
            draft.selected_assets = selected_assets(&draft.fittings);
            let matching_bindings = snapshot
                .bindings
                .iter()
                .filter(|binding| {
                    binding.character_id == character.id
                        && binding.action_key == template.action_key
                })
                .collect::<Vec<_>>();
            if matching_bindings.len() > 1 {
                return Err(AppearanceServiceError::InvalidState(
                    "this NPC has duplicate bindings for the selected action; repair the vault before editing"
                        .to_owned(),
                ));
            }
            if let Some(binding) = matching_bindings.first().copied() {
                let expected_binding_id = binding.id;
                let binding_path = snapshot.binding_paths.get(&binding.id).ok_or_else(|| {
                    AppearanceServiceError::InvalidState("NPC binding path is missing".to_owned())
                })?;
                let loaded_binding = JsonStore::default().load(&vault.resolve(binding_path)?)?;
                let DomainDocument::AnimationBinding(binding) = loaded_binding.value else {
                    return Err(AppearanceServiceError::InvalidState(
                        "binding path contains the wrong document kind".to_owned(),
                    ));
                };
                if binding.id != expected_binding_id
                    || binding.template_ref != template_ref
                    || binding.character_id != character.id
                    || binding.action_key != template.action_key
                    || binding.appearance_id != appearance.id
                {
                    return Err(AppearanceServiceError::InvalidState(
                        "this NPC action is pinned to another release; adopt that revision explicitly in the NPC workflow first"
                            .to_owned(),
                    ));
                }
                draft.base_binding_ref = Some(RevisionRef {
                    id: binding.id,
                    revision: binding.revision,
                });
                draft.base_binding_sha256 = Some(Sha256Digest::parse(loaded_binding.stamp.sha256)?);
                draft.local_overrides = binding
                    .local_overrides
                    .iter()
                    .map(|item| OutfitLocalOverride {
                        slot_id: item.slot_id.clone(),
                        direction: item.direction,
                        transform: item.transform,
                    })
                    .collect();
            }
        }
        draft.validate()?;
        vault.ensure_directory(&area_path.join(".area/drafts"))?;
        let path = draft_path(area_path, draft.id);
        JsonStore::default().create(
            &vault.resolve(&path)?,
            &DomainDocument::OutfitDraft(draft.clone()),
        )?;
        self.editor_context(vault, area_path, draft, SaveState::Saved)
    }

    pub fn resume_draft(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
    ) -> Result<OutfitEditorContext, AppearanceServiceError> {
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let draft = snapshot
            .drafts
            .iter()
            .find(|draft| draft.id == draft_id)
            .cloned()
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(
                    "the requested outfit draft does not exist in this area".to_owned(),
                )
            })?;
        if draft.status != OutfitDraftStatus::InProgress {
            return Err(AppearanceServiceError::InvalidState(
                "the requested outfit draft has already been assigned".to_owned(),
            ));
        }
        self.editor_context(vault, area_path, draft, SaveState::Saved)
    }

    pub fn autosave_draft(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        expected_revision: u32,
        edits: OutfitDraftEdits,
    ) -> Result<OutfitEditorContext, AppearanceServiceError> {
        let draft = self.persist_edits(vault, area_path, draft_id, expected_revision, edits)?;
        self.editor_context(vault, area_path, draft, SaveState::Saved)
    }

    pub fn auto_assign(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        expected_revision: u32,
        assets: Vec<SlotRef>,
    ) -> Result<OutfitEditorContext, AppearanceServiceError> {
        if assets.is_empty() {
            return Err(AppearanceServiceError::InvalidState(
                "select at least one confirmed inventory image before auto-assignment".to_owned(),
            ));
        }
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let draft = snapshot.require_draft(draft_id)?;
        if draft.revision != expected_revision {
            return Err(AppearanceServiceError::RevisionConflict {
                expected: expected_revision,
                found: draft.revision,
            });
        }
        let mut fittings = draft
            .fittings
            .iter()
            .cloned()
            .map(|fit| ((fit.slot_id.clone(), fit.direction), fit))
            .collect::<HashMap<_, _>>();
        let mut approvals = draft.asset_fallback_approvals.clone();
        let mut requested = HashMap::<(SlotId, Direction), Vec<(SlotRef, AssetRevision)>>::new();
        for asset_ref in assets {
            let revision = snapshot.require_assignable_asset_revision(&asset_ref)?;
            let asset_kind = snapshot
                .assets
                .iter()
                .find(|asset| asset.id == asset_ref.asset_id)
                .map(|asset| asset.asset_kind)
                .ok_or_else(|| {
                    AppearanceServiceError::InvalidState(
                        "selected image has no owning asset manifest".to_owned(),
                    )
                })?;
            if matches!(
                asset_kind,
                AssetKind::Armour | AssetKind::Accessory | AssetKind::Equipment
            ) {
                return Err(AppearanceServiceError::InvalidState(
                    "armour, accessory, and equipment images must be added as equipment pieces"
                        .to_owned(),
                ));
            }
            if revision.profile_ref != draft.profile_ref || revision.slot_id != asset_ref.slot_id {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "asset {} r{} is incompatible with this outfit profile or slot",
                    asset_ref.asset_id, asset_ref.revision
                )));
            }
            let key = (revision.slot_id.clone(), revision.direction);
            requested
                .entry(key)
                .or_default()
                .push((asset_ref, revision.clone()));
        }
        for (key, mut selected) in requested {
            selected.sort_by(|left, right| {
                (right.1.variant == "base")
                    .cmp(&(left.1.variant == "base"))
                    .then(left.1.variant.cmp(&right.1.variant))
                    .then(left.0.asset_id.cmp(&right.0.asset_id))
                    .then(left.0.revision.cmp(&right.0.revision))
            });
            let mut requested_variants = HashSet::new();
            if let Some(duplicate) = selected
                .iter()
                .find(|(_, revision)| !requested_variants.insert(revision.variant.clone()))
            {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "more than one selected image targets {} {:?} variant {}; choose explicitly",
                    key.0, key.1, duplicate.1.variant
                )));
            }

            // Replacing a source image revokes only mirror approvals for the same named variant.
            // Other variants in the same direction remain explicit, independent choices.
            for (_, revision) in &selected {
                let dependent_targets = approvals
                    .iter()
                    .filter(|approval| {
                        approval.slot_id == key.0
                            && approval.source_direction == key.1
                            && approval.variant == revision.variant
                    })
                    .map(|approval| approval.target_direction)
                    .collect::<Vec<_>>();
                approvals.retain(|approval| {
                    approval.slot_id != key.0
                        || approval.source_direction != key.1
                        || approval.variant != revision.variant
                });
                for target in dependent_targets {
                    let target_key = (key.0.clone(), target);
                    let remove_base = fittings
                        .get(&target_key)
                        .and_then(|fit| snapshot.require_asset_revision(&fit.asset).ok())
                        .is_some_and(|asset| {
                            asset.direction == key.1 && asset.variant == revision.variant
                        });
                    if remove_base {
                        fittings.remove(&target_key);
                    } else if let Some(target_fit) = fittings.get_mut(&target_key) {
                        target_fit.variant_fittings.retain(|variant| {
                            variant.variant != revision.variant
                                || snapshot
                                    .require_asset_revision(&variant.asset)
                                    .is_ok_and(|asset| asset.direction != key.1)
                        });
                    }
                }
            }

            let previous = fittings.remove(&key);
            let previous_base_variant = previous
                .as_ref()
                .map(|fit| snapshot.require_asset_revision(&fit.asset))
                .transpose()?
                .map(|revision| revision.variant.clone());
            let base_index = selected
                .iter()
                .position(|(_, revision)| revision.variant == "base")
                .or_else(|| {
                    previous_base_variant.as_ref().and_then(|variant| {
                        selected
                            .iter()
                            .position(|(_, revision)| &revision.variant == variant)
                    })
                })
                .or_else(|| (previous.is_none() && selected.len() == 1).then_some(0));
            if previous.is_none() && base_index.is_none() {
                return Err(AppearanceServiceError::InvalidState(format!(
                    "multiple variants target {} {:?} without a base image",
                    key.0, key.1
                )));
            }

            let mut fitting = if let Some(previous) = previous {
                previous
            } else {
                let (asset, revision) = &selected[base_index.expect("new fitting has a base")];
                OutfitFitting {
                    slot_id: revision.slot_id.clone(),
                    direction: revision.direction,
                    asset: asset.clone(),
                    pivot_px: revision.pivot_px,
                    variant_fittings: Vec::new(),
                    transform: identity_transform(),
                    visible: true,
                    layer_delta: 0,
                }
            };

            if let Some(base_index) = base_index {
                let (asset, revision) = &selected[base_index];
                let old_revision = snapshot.require_asset_revision(&fitting.asset)?;
                if old_revision.variant != revision.variant
                    && !fitting
                        .variant_fittings
                        .iter()
                        .any(|variant| variant.variant == old_revision.variant)
                {
                    fitting.variant_fittings.push(SpriteVariantFitting {
                        variant: old_revision.variant.clone(),
                        asset: fitting.asset.clone(),
                        pivot_px: fitting.pivot_px,
                    });
                }
                fitting.asset = asset.clone();
                fitting.pivot_px = revision.pivot_px;
                fitting
                    .variant_fittings
                    .retain(|variant| variant.variant != revision.variant);
            }
            for (index, (asset, revision)) in selected.into_iter().enumerate() {
                if Some(index) == base_index {
                    continue;
                }
                fitting
                    .variant_fittings
                    .retain(|variant| variant.variant != revision.variant);
                fitting.variant_fittings.push(SpriteVariantFitting {
                    variant: revision.variant,
                    asset,
                    pivot_px: revision.pivot_px,
                });
            }
            sort_variant_fittings(&mut fitting.variant_fittings);
            fittings.insert(key, fitting);
        }
        let mut fittings = fittings.into_values().collect::<Vec<_>>();
        sort_fittings(&mut fittings);
        self.autosave_draft(
            vault,
            area_path,
            draft_id,
            expected_revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: approvals,
                local_overrides: draft.local_overrides.clone(),
                equipment: draft.equipment.clone(),
            },
        )
    }

    pub fn render_preview(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        direction: Direction,
        frame_index: u16,
        edits: Option<OutfitDraftEdits>,
    ) -> Result<OutfitPreviewFrame, AppearanceServiceError> {
        super::outfit_render::render_preview(
            vault,
            area_path,
            draft_id,
            direction,
            frame_index,
            edits,
        )
    }

    pub fn save_as_npc(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        expected_revision: u32,
        request: SaveNpcRequest,
    ) -> Result<SavedNpc, AppearanceServiceError> {
        super::outfit_save::save_as_npc(vault, area_path, draft_id, expected_revision, request)
    }

    pub fn apply_to_existing_npc(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        expected_revision: u32,
    ) -> Result<SavedNpc, AppearanceServiceError> {
        super::outfit_apply::apply_to_existing_npc(vault, area_path, draft_id, expected_revision)
    }

    fn persist_edits(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft_id: ObjectId,
        expected_revision: u32,
        mut edits: OutfitDraftEdits,
    ) -> Result<OutfitDraft, AppearanceServiceError> {
        sort_fittings(&mut edits.fittings);
        edits
            .local_overrides
            .sort_by_key(|item| (item.slot_id.to_string(), direction_rank(item.direction)));
        sort_equipment(&mut edits.equipment);
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let baseline = snapshot.require_draft(draft_id)?;
        if baseline.revision != expected_revision {
            return Err(AppearanceServiceError::RevisionConflict {
                expected: expected_revision,
                found: baseline.revision,
            });
        }
        if baseline.status != OutfitDraftStatus::InProgress {
            return Err(AppearanceServiceError::InvalidState(
                "assigned outfit drafts are immutable".to_owned(),
            ));
        }
        for fit in &edits.fittings {
            let references = std::iter::once((&fit.asset, None)).chain(
                fit.variant_fittings
                    .iter()
                    .map(|variant| (&variant.asset, Some(variant.variant.as_str()))),
            );
            for (reference, expected_variant) in references {
                let already_pinned = baseline.fittings.iter().any(|current| {
                    current.asset == *reference
                        || current
                            .variant_fittings
                            .iter()
                            .any(|variant| variant.asset == *reference)
                });
                let revision = if already_pinned {
                    snapshot.require_asset_revision(reference)?
                } else {
                    snapshot.require_assignable_asset_revision(reference)?
                };
                let approved_fallback = edits.asset_fallback_approvals.iter().any(|approval| {
                    approval.slot_id == fit.slot_id
                        && approval.target_direction == fit.direction
                        && approval.source_direction == revision.direction
                        && approval.variant == revision.variant
                        && revision.sprite_mirroring_allowed
                });
                if expected_variant.is_some_and(|variant| variant != revision.variant.as_str())
                    || revision.profile_ref != baseline.profile_ref
                    || revision.slot_id != fit.slot_id
                    || (revision.direction != fit.direction && !approved_fallback)
                {
                    return Err(AppearanceServiceError::InvalidState(format!(
                        "fitting {} {:?} references an incompatible direction image or sprite variant",
                        fit.slot_id, fit.direction
                    )));
                }
            }
        }
        for approval in &edits.asset_fallback_approvals {
            if baseline.asset_fallback_approvals.contains(approval) {
                continue;
            }
            let source = edits
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
            let base_revision = snapshot.require_asset_revision(&source.asset)?;
            let source_asset = if base_revision.variant == approval.variant {
                &source.asset
            } else {
                &source
                    .variant_fittings
                    .iter()
                    .find(|variant| variant.variant == approval.variant)
                    .ok_or_else(|| {
                        AppearanceServiceError::InvalidState(
                            "asset fallback approval has no selected source variant".to_owned(),
                        )
                    })?
                    .asset
            };
            snapshot.require_assignable_asset_revision(source_asset)?;
        }
        snapshot.validate_equipment_references(
            &edits.equipment,
            baseline.profile_ref,
            baseline.template_ref,
            false,
        )?;
        let pinned_equipment = equipment_asset_references(&baseline.equipment);
        for reference in equipment_asset_references(&edits.equipment) {
            if !pinned_equipment.contains(&reference) {
                snapshot.require_assignable_asset_revision(reference)?;
            }
        }
        let path = snapshot.draft_paths.get(&draft_id).ok_or_else(|| {
            AppearanceServiceError::InvalidState("outfit draft path is missing".to_owned())
        })?;
        let resolved = vault.resolve(path)?;
        let loaded = JsonStore::default().load(&resolved)?;
        let DomainDocument::OutfitDraft(mut current) = loaded.value else {
            return Err(AppearanceServiceError::InvalidState(
                "outfit path contains the wrong document kind".to_owned(),
            ));
        };
        if current.revision != expected_revision {
            return Err(AppearanceServiceError::RevisionConflict {
                expected: expected_revision,
                found: current.revision,
            });
        }
        current.fittings = edits.fittings;
        current.asset_fallback_approvals = edits.asset_fallback_approvals;
        current.local_overrides = edits.local_overrides;
        current.equipment = edits.equipment;
        current.selected_assets = selected_assets(&current.fittings);
        current.revision = current.revision.checked_add(1).ok_or_else(|| {
            AppearanceServiceError::InvalidState("outfit revision overflow".to_owned())
        })?;
        current.updated_at = now()?;
        current.validate()?;
        snapshot.validate_draft_references(&current)?;
        JsonStore::default().compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::OutfitDraft(current.clone()),
        )?;
        Ok(current)
    }

    fn editor_context(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        draft: OutfitDraft,
        save_state: SaveState,
    ) -> Result<OutfitEditorContext, AppearanceServiceError> {
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let (template, motion, profile) = snapshot.workflow(draft.template_ref)?;
        if draft.area_id != snapshot.area.id || draft.profile_ref != profile.reference() {
            return Err(AppearanceServiceError::InvalidState(
                "outfit draft does not belong to this workflow".to_owned(),
            ));
        }
        snapshot.validate_draft_references(&draft)?;
        Ok(OutfitEditorContext {
            missing_required_slots: missing_required_slots(&snapshot, motion, profile, &draft)?,
            inventory: snapshot.inventory_for_draft(profile.reference(), &draft),
            available_labels: project_labels(vault, snapshot.area.project_id)?,
            affected_binding_count: draft
                .appearance_id
                .map(|appearance_id| {
                    snapshot
                        .bindings
                        .iter()
                        .filter(|binding| binding.appearance_id == appearance_id)
                        .count()
                })
                .unwrap_or(0),
            template: template.clone(),
            motion: motion.clone(),
            profile: profile.clone(),
            draft,
            save_state,
        })
    }
}

pub(super) fn appearance_from_draft(
    draft: &OutfitDraft,
    character_id: ObjectId,
    appearance_id: ObjectId,
    timestamp: UtcTimestamp,
) -> Result<Appearance, AppearanceServiceError> {
    let mut by_slot = BTreeMap::<String, Vec<&OutfitFitting>>::new();
    for fit in &draft.fittings {
        by_slot
            .entry(fit.slot_id.to_string())
            .or_default()
            .push(fit);
    }
    let fallback = draft
        .selected_assets
        .iter()
        .map(|asset| (asset.slot_id.to_string(), asset))
        .collect::<HashMap<_, _>>();
    let mut slots = Vec::new();
    for (slot_name, mut fits) in by_slot {
        fits.sort_by_key(|fit| direction_rank(fit.direction));
        let slot_id = SlotId::parse(slot_name.clone())?;
        let base = fallback
            .get(&slot_name)
            .copied()
            .cloned()
            .or_else(|| fits.first().map(|fit| fit.asset.clone()))
            .ok_or_else(|| {
                AppearanceServiceError::InvalidState(format!(
                    "slot {slot_name} has no selected image"
                ))
            })?;
        slots.push(SlotAppearance {
            slot_id,
            asset: base,
            fit_by_direction: fits
                .into_iter()
                .map(|fit| DirectionFit {
                    direction: fit.direction,
                    asset: Some(fit.asset.clone()),
                    pivot_px: Some(fit.pivot_px),
                    variant_fittings: fit.variant_fittings.clone(),
                    transform: fit.transform,
                    visible: fit.visible,
                    layer_delta: fit.layer_delta,
                })
                .collect(),
        });
    }
    Ok(Appearance {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Appearance,
        id: appearance_id,
        revision: 1,
        character_id,
        profile_ref: draft.profile_ref,
        name: "Default".to_owned(),
        slots,
        asset_fallback_approvals: draft.asset_fallback_approvals.clone(),
        equipment: draft.equipment.clone(),
        created_at: timestamp,
        updated_at: timestamp,
    })
}

fn missing_required_slots(
    snapshot: &AreaSnapshot,
    motion: &MotionRevision,
    profile: &ProfileRevision,
    draft: &OutfitDraft,
) -> Result<Vec<MissingOutfitSlot>, AppearanceServiceError> {
    let required_variants = required_sprite_variants(motion, profile)?;
    let mut result = Vec::new();
    for slot in &profile.slots {
        let missing_directions = if slot.optional {
            Vec::new()
        } else {
            Direction::ALL
                .into_iter()
                .filter(|direction| {
                    !has_exact_or_approved_fallback(snapshot, draft, &slot.id, *direction)
                })
                .collect::<Vec<_>>()
        };
        let slot_is_worn = draft.fittings.iter().any(|fit| fit.slot_id == slot.id);
        let mut missing_variants = required_variants
            .iter()
            .filter(|(slot_id, _, _)| *slot_id == slot.id)
            .filter(|_| !slot.optional || slot_is_worn)
            .filter(|(_, direction, variant)| {
                !has_sprite_variant(snapshot, draft, &slot.id, *direction, variant)
            })
            .map(|(_, direction, variant)| MissingOutfitVariant {
                direction: *direction,
                variant: variant.clone(),
            })
            .collect::<Vec<_>>();
        missing_variants.sort_by(|left, right| {
            direction_rank(left.direction)
                .cmp(&direction_rank(right.direction))
                .then(left.variant.cmp(&right.variant))
        });
        if !missing_directions.is_empty() || !missing_variants.is_empty() {
            result.push(MissingOutfitSlot {
                slot_id: slot.id.clone(),
                missing_directions,
                missing_variants,
            });
        }
    }
    Ok(result)
}

fn required_sprite_variants(
    motion: &MotionRevision,
    profile: &ProfileRevision,
) -> Result<HashSet<(SlotId, Direction, String)>, AppearanceServiceError> {
    let resolver = DirectionResolver::new(motion, profile)?;
    let mut required = HashSet::new();
    for target in Direction::ALL {
        let Ok(resolution) = resolver.resolve(target) else {
            // Missing released directions remain a motion-authoring concern; there is no target
            // pose from which an outfit variant requirement could be derived.
            continue;
        };
        for frame in 0..motion.frame_count {
            let sampled = AnimationSampler.sample(motion, resolution.source, frame)?;
            let sampled_by_slot = sampled
                .slots
                .iter()
                .map(|slot| (&slot.slot_id, slot))
                .collect::<HashMap<_, _>>();
            let source_pose = DirectionalPose {
                direction: resolution.source,
                slots: profile
                    .slots
                    .iter()
                    .map(|slot| {
                        let sampled = sampled_by_slot.get(&slot.id).copied();
                        DirectionSampledSlot {
                            slot_id: slot.id.clone(),
                            motion: RenderTransform::IDENTITY,
                            visible: sampled.is_none_or(|value| value.visible),
                            sprite_variant: sampled.and_then(|value| value.sprite_variant.clone()),
                            layer_delta: 0,
                        }
                    })
                    .collect(),
            };
            for slot in resolver.resolve_pose(target, &source_pose)?.slots {
                if slot.visible {
                    if let Some(variant) = slot.sprite_variant {
                        required.insert((slot.slot_id, target, variant));
                    }
                }
            }
        }
    }
    Ok(required)
}

fn has_exact_or_approved_fallback(
    snapshot: &AreaSnapshot,
    draft: &OutfitDraft,
    slot_id: &SlotId,
    direction: Direction,
) -> bool {
    if draft
        .fittings
        .iter()
        .any(|fit| fit.slot_id == *slot_id && fit.direction == direction)
    {
        return true;
    }
    draft.asset_fallback_approvals.iter().any(|approval| {
        if approval.slot_id != *slot_id || approval.target_direction != direction {
            return false;
        }
        draft
            .fittings
            .iter()
            .find(|fit| fit.slot_id == *slot_id && fit.direction == approval.source_direction)
            .and_then(|fit| snapshot.require_asset_revision(&fit.asset).ok())
            .is_some_and(|revision| {
                revision.profile_ref == draft.profile_ref
                    && revision.variant == approval.variant
                    && revision.sprite_mirroring_allowed
            })
    })
}

fn has_sprite_variant(
    snapshot: &AreaSnapshot,
    draft: &OutfitDraft,
    slot_id: &SlotId,
    direction: Direction,
    variant: &str,
) -> bool {
    if draft
        .fittings
        .iter()
        .find(|fit| fit.slot_id == *slot_id && fit.direction == direction)
        .and_then(|fit| fitting_variant_revision(snapshot, fit, variant))
        .is_some()
    {
        return true;
    }
    draft.asset_fallback_approvals.iter().any(|approval| {
        if approval.slot_id != *slot_id
            || approval.target_direction != direction
            || approval.variant != variant
        {
            return false;
        }
        draft
            .fittings
            .iter()
            .find(|fit| fit.slot_id == *slot_id && fit.direction == approval.source_direction)
            .and_then(|fit| fitting_variant_revision(snapshot, fit, variant))
            .is_some_and(|revision| {
                revision.profile_ref == draft.profile_ref
                    && revision.direction == approval.source_direction
                    && revision.sprite_mirroring_allowed
            })
    })
}

fn fitting_variant_revision<'a>(
    snapshot: &'a AreaSnapshot,
    fitting: &OutfitFitting,
    variant: &str,
) -> Option<&'a AssetRevision> {
    let base = snapshot.require_asset_revision(&fitting.asset).ok()?;
    if base.variant == variant {
        return Some(base);
    }
    let named = fitting
        .variant_fittings
        .iter()
        .find(|candidate| candidate.variant == variant)?;
    let revision = snapshot.require_asset_revision(&named.asset).ok()?;
    (revision.variant == variant).then_some(revision)
}

pub(super) fn selected_assets(fittings: &[OutfitFitting]) -> Vec<SlotRef> {
    let mut first = BTreeMap::<String, SlotRef>::new();
    let mut ordered = fittings.to_vec();
    sort_fittings(&mut ordered);
    for fit in ordered {
        first.entry(fit.slot_id.to_string()).or_insert(fit.asset);
    }
    first.into_values().collect()
}

pub(super) fn sort_fittings(fittings: &mut [OutfitFitting]) {
    for fit in fittings.iter_mut() {
        sort_variant_fittings(&mut fit.variant_fittings);
    }
    fittings.sort_by_key(|fit| {
        (
            fit.slot_id.to_string(),
            direction_rank(fit.direction),
            fit.asset.asset_id,
            fit.asset.revision,
        )
    });
}

fn sort_variant_fittings(variants: &mut [SpriteVariantFitting]) {
    variants.sort_by(|left, right| {
        left.variant
            .cmp(&right.variant)
            .then(left.asset.asset_id.cmp(&right.asset.asset_id))
            .then(left.asset.revision.cmp(&right.asset.revision))
    });
}

pub(super) fn sort_equipment(equipment: &mut [Equipment]) {
    for item in equipment {
        sort_equipment_piece(&mut item.fit_by_direction, &mut item.own_motion_tracks);
        for part in &mut item.additional_parts {
            sort_equipment_piece(&mut part.fit_by_direction, &mut part.own_motion_tracks);
        }
    }
}

fn sort_equipment_piece(
    fits: &mut [DirectionFit],
    tracks: &mut [crate::domain::EquipmentMotionTrack],
) {
    for fit in fits.iter_mut() {
        sort_variant_fittings(&mut fit.variant_fittings);
    }
    fits.sort_by_key(|fit| direction_rank(fit.direction));
    tracks.sort_by_key(|track| direction_rank(track.direction));
    for track in tracks {
        track.keys.sort_by_key(|key| key.frame);
    }
}

fn equipment_asset_references(equipment: &[Equipment]) -> Vec<&SlotRef> {
    let mut references = Vec::new();
    for item in equipment {
        push_equipment_piece_references(&item.asset, &item.fit_by_direction, &mut references);
        for part in &item.additional_parts {
            push_equipment_piece_references(&part.asset, &part.fit_by_direction, &mut references);
        }
    }
    references
}

fn push_equipment_piece_references<'a>(
    base: &'a SlotRef,
    fits: &'a [DirectionFit],
    references: &mut Vec<&'a SlotRef>,
) {
    references.push(base);
    for fit in fits {
        if let Some(asset) = &fit.asset {
            references.push(asset);
        }
        references.extend(fit.variant_fittings.iter().map(|variant| &variant.asset));
    }
}

pub(super) fn direction_rank(direction: Direction) -> u8 {
    Direction::ALL
        .iter()
        .position(|candidate| *candidate == direction)
        .unwrap_or_default() as u8
}

fn identity_transform() -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(0, 0),
        rotation_deg: 0.0,
    }
}

fn draft_path(area_path: &Path, id: ObjectId) -> PathBuf {
    area_path
        .join(".area/drafts")
        .join(format!("outfit--{id}.json"))
}

pub(super) fn now() -> Result<UtcTimestamp, DomainError> {
    UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
}

pub(super) fn preview_clipping(value: ClippingNotice) -> PreviewClipping {
    PreviewClipping {
        slot_id: value.slot_id,
        bounds_px: value.bounds_px,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        parse_document, Interpolation, Keyframe, MotionTrack, TrackProperty, TrackValue,
    };

    #[test]
    fn required_sprite_variants_follow_mirrored_target_slots() {
        let DomainDocument::ProfileRevision(profile) = parse_document(include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/contracts/valid/profile-revision.json"
        )))
        .unwrap() else {
            panic!("profile fixture has the wrong kind");
        };
        let DomainDocument::MotionRevision(mut motion) = parse_document(include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/contracts/valid/motion-revision.json"
        )))
        .unwrap() else {
            panic!("motion fixture has the wrong kind");
        };
        motion.tracks.push(MotionTrack {
            direction: Direction::E,
            slot_id: SlotId::parse("hand_l").unwrap(),
            property: TrackProperty::SpriteVariant,
            interpolation: Interpolation::Hold,
            keys: vec![Keyframe {
                frame: 0,
                value: TrackValue::Text("open".to_owned()),
            }],
        });

        let required = required_sprite_variants(&motion, &profile).unwrap();

        assert!(required.contains(&(
            SlotId::parse("hand_l").unwrap(),
            Direction::E,
            "open".to_owned(),
        )));
        assert!(required.contains(&(
            SlotId::parse("hand_r").unwrap(),
            Direction::W,
            "open".to_owned(),
        )));
        assert!(!required.contains(&(
            SlotId::parse("hand_l").unwrap(),
            Direction::W,
            "open".to_owned(),
        )));
    }
}
