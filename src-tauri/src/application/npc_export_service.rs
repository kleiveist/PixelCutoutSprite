use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::domain::{
    canonical_json_bytes, ActionKey, AnimationBinding, Appearance, AssetFallbackApproval,
    AssetRevision, Direction, DirectionFit, DirectionMode, EffectiveSource, EffectiveSourceKind,
    Equipment, EquipmentMotionTrack, ExportJumpMode, ExportProfileSnapshot, ExportRootMotionMode,
    ExportSources, LocalOverride, LoopMode, MotionRevision, ObjectId, PixelPoint, PixelSize,
    ProfileRevision, ReviewState, RevisionRef, Sha256Digest, SlotAppearance, SlotDefinition,
    SlotId, SlotRef,
};
use crate::exports::{
    motion_semantic_sha256, CancellationToken, ExportActionInput, ExportError, ExportOutcome,
    ExportRequest, ExportService, FrameContext, FrameSource, FrameSourceError, ProgressReporter,
};
use crate::storage::{StorageError, VaultRoot};

use super::npc_dashboard::{validate_compatibility, validate_export_compatibility};
use super::outfit_render::{
    persisted_render_source, render_request, OutfitRenderContext, OutfitRenderSource,
};
use super::outfit_snapshot::AreaSnapshot;
use super::AppearanceServiceError;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartNpcExportRequest {
    pub character_id: ObjectId,
    pub binding_ids: Vec<ObjectId>,
    pub profile: ExportProfileSnapshot,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NpcExportBindingInspection {
    pub binding_id: ObjectId,
    pub action_key: ActionKey,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub covered_directions: Vec<Direction>,
    pub missing_directions: Vec<Direction>,
    pub reviewed: bool,
    pub ready: bool,
    pub issue: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NpcExportInspection {
    pub character_id: ObjectId,
    pub bindings: Vec<NpcExportBindingInspection>,
    pub missing_required_actions: Vec<ActionKey>,
    pub common_frame_size_px: Option<PixelSize>,
    pub common_ground_origin_px: Option<PixelPoint>,
}

#[derive(Debug, Error)]
pub enum NpcExportError {
    #[error(transparent)]
    Appearance(#[from] AppearanceServiceError),
    #[error(transparent)]
    Export(#[from] ExportError),
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error("{0}")]
    Invalid(String),
    #[error("could not read export image `{path}`: {message}")]
    Image { path: String, message: String },
}

pub(crate) struct PreparedNpcExport {
    pub(crate) output_directory: PathBuf,
    pub(crate) request: ExportRequest,
    pub(crate) frame_source: PersistedNpcFrameSource,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct NpcExportService;

impl NpcExportService {
    pub fn inspect(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        character_id: ObjectId,
    ) -> Result<NpcExportInspection, NpcExportError> {
        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let character = require_character(&snapshot, character_id)?;
        let appearance = require_appearance(&snapshot, character)?;
        let mut bindings = snapshot
            .bindings
            .iter()
            .filter(|binding| binding.character_id == character.id)
            .collect::<Vec<_>>();
        bindings.sort_by(|left, right| {
            left.action_key
                .as_str()
                .cmp(right.action_key.as_str())
                .then(left.id.cmp(&right.id))
        });
        let mut result = Vec::with_capacity(bindings.len());
        for binding in bindings {
            let (_, motion, _) = snapshot.workflow(binding.template_ref)?;
            let (covered_directions, missing_directions) = direction_coverage(motion);
            let issue = validate_compatibility(
                &snapshot,
                character,
                appearance,
                motion,
                &binding.local_overrides,
            )
            .err()
            .map(|error| error.to_string());
            result.push(NpcExportBindingInspection {
                binding_id: binding.id,
                action_key: binding.action_key.clone(),
                frame_size_px: motion.frame_size_px,
                ground_origin_px: motion.ground_origin_px,
                frame_count: motion.frame_count,
                fps: motion.fps,
                loop_mode: motion.loop_mode,
                covered_directions,
                ready: issue.is_none() && missing_directions.is_empty(),
                missing_directions,
                reviewed: binding.review_state == ReviewState::Reviewed,
                issue,
            });
        }
        let assigned = result
            .iter()
            .map(|binding| &binding.action_key)
            .collect::<HashSet<_>>();
        let missing_required_actions = character
            .required_actions
            .iter()
            .filter(|action| !assigned.contains(action))
            .cloned()
            .collect();
        let common_frame_size_px = common_value(result.iter().map(|item| item.frame_size_px));
        let common_ground_origin_px = common_value(result.iter().map(|item| item.ground_origin_px));
        Ok(NpcExportInspection {
            character_id,
            bindings: result,
            missing_required_actions,
            common_frame_size_px,
            common_ground_origin_px,
        })
    }

    pub fn export<C, P>(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: StartNpcExportRequest,
        cancellation: &C,
        progress: &mut P,
    ) -> Result<ExportOutcome, NpcExportError>
    where
        C: CancellationToken,
        P: ProgressReporter,
    {
        let prepared = self.prepare(vault, area_path, request)?;
        let mut source = prepared.frame_source;
        ExportService::new(vault.clone(), env!("CARGO_PKG_VERSION"))
            .export(
                &prepared.output_directory,
                &prepared.request,
                &mut source,
                cancellation,
                progress,
            )
            .map_err(Into::into)
    }

    pub(crate) fn prepare(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: StartNpcExportRequest,
    ) -> Result<PreparedNpcExport, NpcExportError> {
        request.profile.validate().map_err(|error| {
            NpcExportError::Invalid(format!("export profile is invalid: {error}"))
        })?;
        if request.binding_ids.is_empty() {
            return Err(NpcExportError::Invalid(
                "select at least one NPC animation binding".to_owned(),
            ));
        }
        let mut unique_binding_ids = HashSet::new();
        if request
            .binding_ids
            .iter()
            .any(|id| !unique_binding_ids.insert(*id))
        {
            return Err(NpcExportError::Invalid(
                "an animation binding was selected more than once".to_owned(),
            ));
        }

        let snapshot = AreaSnapshot::load(vault, area_path)?;
        let character = require_character(&snapshot, request.character_id)?.clone();
        let appearance = require_appearance(&snapshot, &character)?.clone();
        let mut bindings = request
            .binding_ids
            .iter()
            .map(|id| require_binding(&snapshot, *id).cloned())
            .collect::<Result<Vec<_>, _>>()?;
        if bindings.iter().any(|binding| {
            binding.character_id != character.id || binding.appearance_id != appearance.id
        }) {
            return Err(NpcExportError::Invalid(
                "every selected binding must belong to the NPC and use its default appearance"
                    .to_owned(),
            ));
        }
        bindings.sort_by(|left, right| {
            left.action_key
                .as_str()
                .cmp(right.action_key.as_str())
                .then(left.id.cmp(&right.id))
        });
        if bindings
            .windows(2)
            .any(|pair| pair[0].action_key == pair[1].action_key)
        {
            return Err(NpcExportError::Invalid(
                "selected bindings must have unique action keys".to_owned(),
            ));
        }
        if bindings.len() > 1 && !request.profile.allow_incomplete_test {
            let selected_actions = bindings
                .iter()
                .map(|binding| &binding.action_key)
                .collect::<HashSet<_>>();
            let missing = character
                .required_actions
                .iter()
                .filter(|action| !selected_actions.contains(action))
                .map(ActionKey::as_str)
                .collect::<Vec<_>>();
            if !missing.is_empty() {
                return Err(NpcExportError::Invalid(format!(
                    "complete NPC export is missing required action(s): {}",
                    missing.join(", ")
                )));
            }
        }

        let profile = snapshot
            .profiles
            .iter()
            .find(|profile| profile.reference() == character.profile_ref)
            .ok_or_else(|| NpcExportError::Invalid("NPC profile revision is missing".to_owned()))?
            .clone();
        let mut actions = Vec::with_capacity(bindings.len());
        let mut render_sources = HashMap::new();
        let mut motions = Vec::new();
        let mut incomplete_reasons = Vec::new();
        for binding in &bindings {
            let (_, motion, motion_profile) = snapshot.workflow(binding.template_ref)?;
            incomplete_reasons.extend(validate_export_compatibility(
                &snapshot,
                &character,
                &appearance,
                motion,
                &binding.local_overrides,
                request.profile.allow_incomplete_test,
            )?);
            if motion_profile.reference() != profile.reference() {
                return Err(NpcExportError::Invalid(format!(
                    "binding `{}` uses a different profile revision",
                    binding.action_key
                )));
            }
            let motion = motion.clone();
            actions.push(ExportActionInput {
                action_key: binding.action_key.clone(),
                binding_ref: revision_ref(binding.id, binding.revision),
                motion: motion.clone(),
                root_motion_mode: request.root_motion_mode,
                jump_mode: request.jump_mode,
            });
            render_sources.insert(
                binding.action_key.clone(),
                ActionRenderSource {
                    source: persisted_render_source(&snapshot, &appearance, binding)?,
                },
            );
            motions.push(motion);
        }

        let asset_revisions = referenced_asset_revisions(&snapshot, &appearance)?;
        let (bitmaps, missing_bitmap_reasons) = load_verified_bitmaps(
            vault,
            area_path,
            &asset_revisions,
            request.profile.allow_incomplete_test,
        )?;
        incomplete_reasons.extend(missing_bitmap_reasons);
        incomplete_reasons.sort();
        incomplete_reasons.dedup();
        let mut unique_motions = motions.clone();
        unique_motions.sort_by_key(|motion| (motion.template_id, motion.revision));
        unique_motions.dedup_by_key(|motion| motion.reference());
        let sources = ExportSources {
            profile: profile.reference(),
            motion: unique_motions
                .iter()
                .map(MotionRevision::reference)
                .collect(),
            assets: asset_revisions
                .iter()
                .map(AssetRevision::reference)
                .collect(),
            appearances: vec![revision_ref(appearance.id, appearance.revision)],
            bindings: bindings
                .iter()
                .map(|binding| revision_ref(binding.id, binding.revision))
                .collect(),
        };
        let effective_sources = effective_sources(
            &profile,
            &unique_motions,
            &asset_revisions,
            &appearance,
            &bindings,
        )?;
        let output_directory =
            managed_output_directory(area_path, &snapshot, character.id, &bindings)?;
        Ok(PreparedNpcExport {
            output_directory,
            request: ExportRequest {
                character_id: character.id,
                sources,
                effective_sources,
                actions,
                profile: request.profile,
                incomplete_reasons,
            },
            frame_source: PersistedNpcFrameSource {
                vault: vault.clone(),
                area_path: area_path.to_path_buf(),
                snapshot,
                profile,
                actions: render_sources,
                bitmaps,
            },
        })
    }
}

pub(crate) struct PersistedNpcFrameSource {
    vault: VaultRoot,
    area_path: PathBuf,
    snapshot: AreaSnapshot,
    profile: ProfileRevision,
    actions: HashMap<ActionKey, ActionRenderSource>,
    bitmaps: HashMap<RevisionRef, RgbaImage>,
}

struct ActionRenderSource {
    source: OutfitRenderSource,
}

impl FrameSource for PersistedNpcFrameSource {
    fn render_request(
        &mut self,
        context: FrameContext<'_>,
    ) -> Result<crate::render::RenderRequest, FrameSourceError> {
        let action = self.actions.get(context.action_key).ok_or_else(|| {
            FrameSourceError::missing(format!(
                "persisted render source for action `{}` is missing",
                context.action_key
            ))
        })?;
        render_request(
            OutfitRenderContext {
                vault: &self.vault,
                area_path: &self.area_path,
                snapshot: &self.snapshot,
                source: &action.source,
                motion: context.motion,
                profile: &self.profile,
                bitmaps: Some(&self.bitmaps),
            },
            context.pose,
            context.include_shadow,
        )
        .map_err(|error| FrameSourceError::new("persisted_render", error.to_string()))
    }
}

fn require_character(
    snapshot: &AreaSnapshot,
    character_id: ObjectId,
) -> Result<&crate::domain::Character, NpcExportError> {
    snapshot
        .characters
        .iter()
        .find(|character| character.id == character_id)
        .ok_or_else(|| NpcExportError::Invalid("NPC does not exist in this area".to_owned()))
}

fn require_appearance<'a>(
    snapshot: &'a AreaSnapshot,
    character: &crate::domain::Character,
) -> Result<&'a Appearance, NpcExportError> {
    snapshot
        .appearances
        .iter()
        .find(|appearance| appearance.id == character.default_appearance_id)
        .filter(|appearance| appearance.character_id == character.id)
        .ok_or_else(|| {
            NpcExportError::Invalid("NPC default appearance is missing or mismatched".to_owned())
        })
}

fn require_binding(
    snapshot: &AreaSnapshot,
    binding_id: ObjectId,
) -> Result<&AnimationBinding, NpcExportError> {
    snapshot
        .bindings
        .iter()
        .find(|binding| binding.id == binding_id)
        .ok_or_else(|| {
            NpcExportError::Invalid("animation binding does not exist in this area".to_owned())
        })
}

pub(super) fn managed_output_directory(
    area_path: &Path,
    snapshot: &AreaSnapshot,
    character_id: ObjectId,
    bindings: &[AnimationBinding],
) -> Result<PathBuf, NpcExportError> {
    let character_file = snapshot.character_paths.get(&character_id).ok_or_else(|| {
        NpcExportError::Invalid("NPC character document path is missing".to_owned())
    })?;
    let character_directory = character_file.parent().ok_or_else(|| {
        NpcExportError::Invalid("NPC character document has no owning folder".to_owned())
    })?;
    if character_directory.parent() != Some(area_path) {
        return Err(NpcExportError::Invalid(
            "NPC is not directly owned by the selected area".to_owned(),
        ));
    }
    if bindings.len() > 1 {
        return Ok(character_directory.join("_exports"));
    }
    let binding_file = snapshot.binding_paths.get(&bindings[0].id).ok_or_else(|| {
        NpcExportError::Invalid("animation binding document path is missing".to_owned())
    })?;
    let binding_directory = binding_file.parent().ok_or_else(|| {
        NpcExportError::Invalid("animation binding document has no owning folder".to_owned())
    })?;
    if binding_directory.parent() != Some(character_directory) {
        return Err(NpcExportError::Invalid(
            "animation binding is not directly owned by the selected NPC".to_owned(),
        ));
    }
    Ok(binding_directory.join("exports"))
}

fn referenced_asset_revisions(
    snapshot: &AreaSnapshot,
    appearance: &Appearance,
) -> Result<Vec<AssetRevision>, NpcExportError> {
    let mut references = Vec::<&SlotRef>::new();
    for slot in &appearance.slots {
        for fit in &slot.fit_by_direction {
            references.push(fit.asset.as_ref().unwrap_or(&slot.asset));
            references.extend(fit.variant_fittings.iter().map(|variant| &variant.asset));
        }
    }
    for equipment in &appearance.equipment {
        if equipment.enabled {
            push_equipment_assets(
                &mut references,
                &equipment.asset,
                &equipment.fit_by_direction,
            );
        }
        for part in &equipment.additional_parts {
            if part.enabled {
                push_equipment_assets(&mut references, &part.asset, &part.fit_by_direction);
            }
        }
    }
    references.sort_by_key(|reference| (reference.asset_id, reference.revision));
    references.dedup_by_key(|reference| (reference.asset_id, reference.revision));
    references
        .into_iter()
        .map(|reference| {
            snapshot
                .require_asset_revision(reference)
                .cloned()
                .map_err(Into::into)
        })
        .collect()
}

fn push_equipment_assets<'a>(
    references: &mut Vec<&'a SlotRef>,
    base: &'a SlotRef,
    fits: &'a [DirectionFit],
) {
    for fit in fits {
        references.push(fit.asset.as_ref().unwrap_or(base));
        references.extend(fit.variant_fittings.iter().map(|variant| &variant.asset));
    }
}

fn load_verified_bitmaps(
    vault: &VaultRoot,
    area_path: &Path,
    revisions: &[AssetRevision],
    allow_incomplete_test: bool,
) -> Result<(HashMap<RevisionRef, RgbaImage>, Vec<String>), NpcExportError> {
    let mut result = HashMap::new();
    let mut missing = Vec::new();
    for revision in revisions {
        let relative = area_path.join(revision.source_file.as_str());
        let resolved = vault.resolve(&relative)?;
        let bytes = match fs::read(resolved.as_path()) {
            Ok(bytes) => bytes,
            Err(error) if allow_incomplete_test && error.kind() == std::io::ErrorKind::NotFound => {
                missing.push(format!(
                    "asset {} PNG is missing from its authoritative area source",
                    revision.reference()
                ));
                // Only an absent file receives a transparent stand-in. Existing bytes must pass
                // every integrity and decode check below and are never hidden by test mode.
                result.insert(revision.reference(), RgbaImage::new(1, 1));
                continue;
            }
            Err(error) => {
                return Err(NpcExportError::Image {
                    path: revision.source_file.to_string(),
                    message: error.to_string(),
                })
            }
        };
        let actual = Sha256Digest::parse(format!("{:x}", Sha256::digest(&bytes)))
            .expect("SHA-256 output is valid");
        if actual != revision.content_hash {
            return Err(NpcExportError::Invalid(format!(
                "asset {} content hash does not match its released PNG",
                revision.reference()
            )));
        }
        let image = image::load_from_memory(&bytes)
            .map_err(|error| NpcExportError::Image {
                path: revision.source_file.to_string(),
                message: error.to_string(),
            })?
            .to_rgba8();
        if image.dimensions()
            != (
                u32::from(revision.image_size_px.0),
                u32::from(revision.image_size_px.1),
            )
        {
            return Err(NpcExportError::Invalid(format!(
                "asset {} dimensions do not match its released metadata",
                revision.reference()
            )));
        }
        result.insert(revision.reference(), image);
    }
    Ok((result, missing))
}

fn effective_sources(
    profile: &ProfileRevision,
    motions: &[MotionRevision],
    assets: &[AssetRevision],
    appearance: &Appearance,
    bindings: &[AnimationBinding],
) -> Result<Vec<EffectiveSource>, NpcExportError> {
    let mut result = vec![effective_source(
        EffectiveSourceKind::Profile,
        profile.reference(),
        &ProfileSemantic::from(profile),
    )?];
    for motion in motions {
        result.push(EffectiveSource {
            kind: EffectiveSourceKind::Motion,
            reference: motion.reference(),
            content_sha256: motion_semantic_sha256(motion)?,
        });
    }
    for asset in assets {
        result.push(effective_source(
            EffectiveSourceKind::Asset,
            asset.reference(),
            &AssetSemantic::from(asset),
        )?);
    }
    result.push(effective_source(
        EffectiveSourceKind::Appearance,
        revision_ref(appearance.id, appearance.revision),
        &AppearanceSemantic::from(appearance),
    )?);
    for binding in bindings {
        result.push(effective_source(
            EffectiveSourceKind::Binding,
            revision_ref(binding.id, binding.revision),
            &BindingSemantic::from(binding),
        )?);
    }
    Ok(result)
}

fn effective_source<T: Serialize>(
    kind: EffectiveSourceKind,
    reference: RevisionRef,
    value: &T,
) -> Result<EffectiveSource, NpcExportError> {
    let bytes = canonical_json_bytes(value).map_err(AppearanceServiceError::from)?;
    let content_sha256 = Sha256Digest::parse(format!("{:x}", Sha256::digest(bytes)))
        .expect("SHA-256 output is valid");
    Ok(EffectiveSource {
        kind,
        reference,
        content_sha256,
    })
}

#[derive(Serialize)]
struct ProfileSemantic<'a> {
    reference_height_px: u16,
    slots: &'a [SlotDefinition],
    views: &'a [crate::domain::DirectionView],
    mirror_pairs: &'a [crate::domain::MirrorPair],
}

impl<'a> From<&'a ProfileRevision> for ProfileSemantic<'a> {
    fn from(value: &'a ProfileRevision) -> Self {
        Self {
            reference_height_px: value.reference_height_px,
            slots: &value.slots,
            views: &value.views,
            mirror_pairs: &value.mirror_pairs,
        }
    }
}

#[derive(Serialize)]
struct AssetSemantic<'a> {
    profile_ref: RevisionRef,
    slot_id: &'a SlotId,
    direction: Direction,
    variant: &'a str,
    image_size_px: PixelSize,
    pivot_px: PixelPoint,
    content_hash: &'a Sha256Digest,
    sprite_mirroring_allowed: bool,
}

impl<'a> From<&'a AssetRevision> for AssetSemantic<'a> {
    fn from(value: &'a AssetRevision) -> Self {
        Self {
            profile_ref: value.profile_ref,
            slot_id: &value.slot_id,
            direction: value.direction,
            variant: &value.variant,
            image_size_px: value.image_size_px,
            pivot_px: value.pivot_px,
            content_hash: &value.content_hash,
            sprite_mirroring_allowed: value.sprite_mirroring_allowed,
        }
    }
}

#[derive(Serialize)]
struct AppearanceSemantic<'a> {
    profile_ref: RevisionRef,
    slots: &'a [SlotAppearance],
    asset_fallback_approvals: &'a [AssetFallbackApproval],
    equipment: Vec<EquipmentSemantic<'a>>,
}

impl<'a> From<&'a Appearance> for AppearanceSemantic<'a> {
    fn from(value: &'a Appearance) -> Self {
        let mut equipment = Vec::new();
        for item in &value.equipment {
            if item.enabled {
                equipment.push(EquipmentSemantic::primary(item));
            }
            equipment.extend(
                item.additional_parts
                    .iter()
                    .filter(|part| part.enabled)
                    .map(EquipmentSemantic::additional),
            );
        }
        Self {
            profile_ref: value.profile_ref,
            slots: &value.slots,
            asset_fallback_approvals: &value.asset_fallback_approvals,
            equipment,
        }
    }
}

#[derive(Serialize)]
struct EquipmentSemantic<'a> {
    id: ObjectId,
    anchor_slot: &'a SlotId,
    asset: &'a SlotRef,
    follow_mode: crate::domain::FollowMode,
    own_motion_enabled: bool,
    fits: &'a [DirectionFit],
    own_motion_tracks: Option<&'a [EquipmentMotionTrack]>,
}

impl<'a> EquipmentSemantic<'a> {
    fn primary(value: &'a Equipment) -> Self {
        Self {
            id: value.id,
            anchor_slot: &value.anchor_slot,
            asset: &value.asset,
            follow_mode: value.follow_mode,
            own_motion_enabled: value.own_motion_enabled,
            fits: &value.fit_by_direction,
            own_motion_tracks: value
                .own_motion_enabled
                .then_some(value.own_motion_tracks.as_slice()),
        }
    }

    fn additional(value: &'a crate::domain::EquipmentPart) -> Self {
        Self {
            id: value.id,
            anchor_slot: &value.anchor_slot,
            asset: &value.asset,
            follow_mode: value.follow_mode,
            own_motion_enabled: value.own_motion_enabled,
            fits: &value.fit_by_direction,
            own_motion_tracks: value
                .own_motion_enabled
                .then_some(value.own_motion_tracks.as_slice()),
        }
    }
}

#[derive(Serialize)]
struct BindingSemantic<'a> {
    action_key: &'a ActionKey,
    template_ref: RevisionRef,
    appearance_id: ObjectId,
    local_overrides: &'a [LocalOverride],
}

impl<'a> From<&'a AnimationBinding> for BindingSemantic<'a> {
    fn from(value: &'a AnimationBinding) -> Self {
        Self {
            action_key: &value.action_key,
            template_ref: value.template_ref,
            appearance_id: value.appearance_id,
            local_overrides: &value.local_overrides,
        }
    }
}

fn direction_coverage(motion: &MotionRevision) -> (Vec<Direction>, Vec<Direction>) {
    Direction::ALL.into_iter().partition(|direction| {
        motion.directions.iter().any(|definition| {
            definition.direction == *direction && definition.mode != DirectionMode::Missing
        })
    })
}

fn common_value<T: Copy + PartialEq>(values: impl IntoIterator<Item = T>) -> Option<T> {
    let mut values = values.into_iter();
    let first = values.next()?;
    values.all(|value| value == first).then_some(first)
}

fn revision_ref(id: ObjectId, revision: u32) -> RevisionRef {
    RevisionRef { id, revision }
}
