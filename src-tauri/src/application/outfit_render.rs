use std::collections::{HashMap, HashSet};
use std::path::Path;

use image::RgbaImage;

use crate::animation::{AnimationSampler, EquipmentMotionSampler};
use crate::directions::{
    mirror_transform_x, AssetResolver, DirectionResolver, DirectionalPose, ResolvedDirection,
    ResolvedPoseSlot, SampledSlot as DirectionSampledSlot,
};
use crate::domain::{
    Direction, DirectionFit, Equipment, EquipmentMotionTrack, EquipmentPart, FollowMode,
    GroundShadow, LoopMode, ObjectId, OutfitDraft, OutfitFitting, PixelPoint, ProfileRevision,
    SlotId, SlotRef, Transform2D,
};
use crate::render::{
    resolve_world_transforms, Affine, PixelCompositor, RenderPart, RenderRequest, RenderTransform,
};
use crate::storage::VaultRoot;

use super::appearance_service::{
    preview_clipping, sort_equipment, sort_fittings, AppearanceServiceError, OutfitDraftEdits,
    OutfitPreviewFrame,
};
use super::outfit_snapshot::AreaSnapshot;

struct PartContext<'a> {
    vault: &'a VaultRoot,
    area_path: &'a Path,
    snapshot: &'a AreaSnapshot,
    draft: &'a OutfitDraft,
    direction_resolution: ResolvedDirection,
    fittings: HashMap<SlotId, &'a OutfitFitting>,
    overrides: HashMap<SlotId, Transform2D>,
    resolved_slots: HashMap<SlotId, &'a ResolvedPoseSlot>,
    direction: Direction,
    frame_index: u16,
    frame_count: u16,
    loop_mode: LoopMode,
}

#[derive(Clone, Copy)]
struct EquipmentRenderSource<'a> {
    id: ObjectId,
    anchor_slot: &'a SlotId,
    asset: &'a SlotRef,
    enabled: bool,
    follow_mode: FollowMode,
    own_motion_enabled: bool,
    fits: &'a [DirectionFit],
    tracks: &'a [EquipmentMotionTrack],
}

#[derive(Clone, Copy)]
struct PreviewFrameInput {
    sample_index: u16,
    frame_count: u16,
    loop_mode: LoopMode,
    ground_shadow: Option<GroundShadow>,
}

struct FittingRenderData {
    bitmap: RgbaImage,
    transform: RenderTransform,
    pivot_px: (f64, f64),
    visible: bool,
    layer_delta: i32,
    mirror_bitmap_x: bool,
}

struct ResolvedFitting<'a> {
    fit: Option<&'a OutfitFitting>,
    image: Option<FittedImage<'a>>,
    mirror_bitmap_x: bool,
    mirror_geometry: bool,
}

#[derive(Clone, Copy)]
struct FittedImage<'a> {
    asset: &'a SlotRef,
    pivot_px: PixelPoint,
}

pub(super) fn render_preview(
    vault: &VaultRoot,
    area_path: &Path,
    draft_id: ObjectId,
    direction: Direction,
    frame_index: u16,
    edits: Option<OutfitDraftEdits>,
) -> Result<OutfitPreviewFrame, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let draft = transient_draft(&snapshot, draft_id, edits)?;
    let (_, motion, profile) = snapshot.workflow(draft.template_ref)?;
    let resolver = DirectionResolver::new(motion, profile)?;
    let resolution = resolver.resolve(direction)?;
    let sampled = AnimationSampler.sample(motion, resolution.source, frame_index)?;
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
                Ok(DirectionSampledSlot {
                    slot_id: slot.id.clone(),
                    motion: RenderTransform::new(
                        sampled.map_or(0.0, |value| value.offset_x_px),
                        sampled.map_or(0.0, |value| value.offset_y_px),
                        sampled.map_or(0.0, |value| value.rotation_deg),
                    )?,
                    visible: sampled.is_none_or(|value| value.visible),
                    sprite_variant: sampled.and_then(|value| value.sprite_variant.clone()),
                    layer_delta: sampled.map_or(0, |value| i32::from(value.layer_delta)),
                })
            })
            .collect::<Result<Vec<_>, crate::render::RenderError>>()?,
    };
    let resolved = resolver.resolve_pose(direction, &source_pose)?;
    let parts = render_parts(
        vault,
        area_path,
        &snapshot,
        &draft,
        resolution,
        &resolved.slots,
        PreviewFrameInput {
            sample_index: sampled.sample_index,
            frame_count: motion.frame_count,
            loop_mode: motion.loop_mode,
            ground_shadow: motion
                .semantics
                .as_ref()
                .and_then(|semantics| semantics.ground_shadow),
        },
    )?;
    let request = RenderRequest {
        direction,
        frame_size_px: motion.frame_size_px,
        ground_origin_px: motion.ground_origin_px,
        parts,
    };
    let guides = preview_guides(&request, profile)?;
    let rendered = PixelCompositor.render(&request)?;
    Ok(OutfitPreviewFrame {
        direction,
        frame_index,
        width: rendered.image.width(),
        height: rendered.image.height(),
        rgba: rendered.image.into_raw(),
        clipping: rendered
            .clipping
            .into_iter()
            .map(preview_clipping)
            .collect(),
        guides,
        guides_included: false,
    })
}

fn preview_guides(
    request: &RenderRequest,
    profile: &ProfileRevision,
) -> Result<Vec<super::appearance_service::PreviewGuide>, AppearanceServiceError> {
    let world = resolve_world_transforms(request)?;
    request
        .parts
        .iter()
        .filter_map(|part| {
            let slot = profile.slots.iter().find(|slot| slot.id == part.slot_id)?;
            let dummy = world[&part.slot_id];
            let image = dummy
                .multiply(part.fitting.affine())
                .multiply(part.local_override.affine());
            Some(Ok(super::appearance_service::PreviewGuide {
                slot_id: part.slot_id.clone(),
                dummy_transform: affine_array(dummy),
                image_transform: affine_array(image),
                slot_size_px: slot.size_px,
                slot_pivot_px: slot.pivot_px,
            }))
        })
        .collect()
}

fn affine_array(value: Affine) -> [f64; 6] {
    [value.a, value.b, value.c, value.d, value.tx, value.ty]
}

fn transient_draft(
    snapshot: &AreaSnapshot,
    draft_id: ObjectId,
    edits: Option<OutfitDraftEdits>,
) -> Result<OutfitDraft, AppearanceServiceError> {
    let mut draft = snapshot.require_draft(draft_id)?.clone();
    if let Some(mut edits) = edits {
        sort_fittings(&mut edits.fittings);
        sort_equipment(&mut edits.equipment);
        draft.fittings = edits.fittings;
        draft.asset_fallback_approvals = edits.asset_fallback_approvals;
        draft.local_overrides = edits.local_overrides;
        draft.equipment = edits.equipment;
        draft.selected_assets = super::appearance_service::selected_assets(&draft.fittings);
        draft.validate()?;
    }
    snapshot.validate_draft_references(&draft)?;
    Ok(draft)
}

fn render_parts(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    draft: &OutfitDraft,
    direction_resolution: ResolvedDirection,
    resolved_slots: &[ResolvedPoseSlot],
    frame: PreviewFrameInput,
) -> Result<Vec<RenderPart>, AppearanceServiceError> {
    let fittings = draft
        .fittings
        .iter()
        .filter(|fit| fit.direction == direction_resolution.target)
        .map(|fit| (fit.slot_id.clone(), fit))
        .collect::<HashMap<_, _>>();
    let overrides = draft
        .local_overrides
        .iter()
        .filter(|fit| fit.direction == direction_resolution.target)
        .map(|fit| (fit.slot_id.clone(), fit.transform))
        .collect::<HashMap<_, _>>();
    let resolved_by_slot = resolved_slots
        .iter()
        .map(|slot| (slot.slot_id.clone(), slot))
        .collect::<HashMap<_, _>>();
    let context = PartContext {
        vault,
        area_path,
        snapshot,
        draft,
        direction_resolution,
        fittings,
        overrides,
        resolved_slots: resolved_by_slot,
        direction: direction_resolution.target,
        frame_index: frame.sample_index,
        frame_count: frame.frame_count,
        loop_mode: frame.loop_mode,
    };
    let mut parts = resolved_slots
        .iter()
        .map(|slot| build_render_part(&context, slot))
        .collect::<Result<Vec<_>, _>>()?;
    for equipment in &draft.equipment {
        parts.push(build_equipment_part(
            &context,
            primary_equipment_source(equipment),
        )?);
        for part in &equipment.additional_parts {
            parts.push(build_equipment_part(
                &context,
                additional_equipment_source(part),
            )?);
        }
    }
    if let Some(shadow) = frame.ground_shadow.filter(|shadow| shadow.enabled) {
        parts.push(RenderPart {
            slot_id: SlotId::parse("ground_shadow")?,
            parent_id: None,
            profile: RenderTransform::IDENTITY,
            motion: RenderTransform::IDENTITY,
            fitting: RenderTransform::IDENTITY,
            local_override: RenderTransform::IDENTITY,
            pivot_px: (
                f64::from(shadow.width_px) / 2.0,
                f64::from(shadow.height_px) / 2.0,
            ),
            visible: true,
            layer: -1_000,
            mirror_bitmap_x: false,
            bitmap: crate::editor::ground_shadow_bitmap(shadow),
        });
    }
    Ok(parts)
}

fn build_render_part(
    context: &PartContext<'_>,
    slot: &ResolvedPoseSlot,
) -> Result<RenderPart, AppearanceServiceError> {
    let resolved = resolve_fitting(context, slot)?;
    let fitting = fitting_render_data(
        context.vault,
        context.area_path,
        context.snapshot,
        resolved.fit,
        resolved.image,
        resolved.mirror_bitmap_x,
        resolved.mirror_geometry,
    )?;
    Ok(RenderPart {
        slot_id: slot.slot_id.clone(),
        parent_id: slot.parent_id.clone(),
        profile: slot.profile,
        motion: slot.motion,
        fitting: fitting.transform,
        local_override: context
            .overrides
            .get(&slot.slot_id)
            .copied()
            .map(RenderTransform::from)
            .unwrap_or(RenderTransform::IDENTITY),
        pivot_px: fitting.pivot_px,
        visible: fitting.visible && slot.visible,
        layer: slot.layer + fitting.layer_delta,
        mirror_bitmap_x: fitting.mirror_bitmap_x,
        bitmap: fitting.bitmap,
    })
}

fn resolve_fitting<'a>(
    context: &PartContext<'a>,
    slot: &ResolvedPoseSlot,
) -> Result<ResolvedFitting<'a>, AppearanceServiceError> {
    let target_fit = context.fittings.get(&slot.slot_id).copied();
    if let Some(fit) = target_fit {
        if let Some(image) =
            image_for_variant(context.snapshot, fit, slot.sprite_variant.as_deref())?
        {
            let revision = context.snapshot.require_asset_revision(image.asset)?;
            if revision.direction == context.direction_resolution.target {
                return Ok(ResolvedFitting {
                    fit: Some(fit),
                    image: Some(image),
                    mirror_bitmap_x: false,
                    mirror_geometry: false,
                });
            }
            if approved_fallback(context, slot, revision.direction, &revision.variant) {
                return Ok(ResolvedFitting {
                    fit: Some(fit),
                    image: Some(image),
                    mirror_bitmap_x: true,
                    // A target-direction fitting already stores target-local placement and pivot.
                    // Only its explicitly approved source bitmap is mirrored at render time.
                    mirror_geometry: false,
                });
            }
            return Err(AppearanceServiceError::InvalidState(
                "target fitting uses an unapproved direction image".to_owned(),
            ));
        }
    }

    let approvals = context
        .draft
        .asset_fallback_approvals
        .iter()
        .filter(|approval| {
            approval.slot_id == slot.slot_id
                && approval.target_direction == context.direction_resolution.target
        })
        .collect::<Vec<_>>();
    let variant = if let Some(variant) = slot.sprite_variant.as_deref() {
        variant
    } else if target_fit.is_some() {
        // A target fitting exists but has no named variant mapping. The default image path above
        // always succeeds, so this branch is reachable only for a malformed transient edit.
        return Err(AppearanceServiceError::InvalidState(
            "target fitting has no default image".to_owned(),
        ));
    } else if approvals.len() == 1 {
        approvals[0].variant.as_str()
    } else {
        "base"
    };
    let candidates = asset_candidates(context, &slot.slot_id)?;
    if candidates.is_empty() && slot.sprite_variant.is_none() && approvals.is_empty() {
        return Ok(ResolvedFitting {
            fit: None,
            image: None,
            mirror_bitmap_x: false,
            mirror_geometry: false,
        });
    }
    let resolved = AssetResolver::new(
        context.draft.profile_ref,
        &candidates,
        &context.draft.asset_fallback_approvals,
    )?
    .resolve(context.direction_resolution, &slot.slot_id, variant)?;
    let source = fitted_image_for_revision(
        context,
        &slot.slot_id,
        resolved.revision.asset_id,
        resolved.revision.revision,
        variant,
        resolved.revision.direction,
    )?;
    let geometry = target_fit.or(Some(source.0));
    let mut pivot_px = source.1.pivot_px;
    if resolved.bitmap_mirrored {
        pivot_px.0 =
            i16::try_from(i32::from(resolved.revision.image_size_px.0) - i32::from(pivot_px.0))
                .expect("validated image widths and pivots fit i16 after mirroring");
    }
    Ok(ResolvedFitting {
        fit: geometry,
        image: Some(FittedImage {
            asset: source.1.asset,
            pivot_px,
        }),
        mirror_bitmap_x: resolved.bitmap_mirrored,
        // Legacy drafts without a materialized target fitting reuse the source placement. A
        // target fitting, when present, keeps its already target-local transform.
        mirror_geometry: target_fit.is_none() && resolved.bitmap_mirrored,
    })
}

fn image_for_variant<'a>(
    snapshot: &AreaSnapshot,
    fit: &'a OutfitFitting,
    variant: Option<&str>,
) -> Result<Option<FittedImage<'a>>, AppearanceServiceError> {
    let Some(variant) = variant else {
        return Ok(Some(FittedImage {
            asset: &fit.asset,
            pivot_px: fit.pivot_px,
        }));
    };
    let base = snapshot.require_asset_revision(&fit.asset)?;
    if base.variant == variant {
        return Ok(Some(FittedImage {
            asset: &fit.asset,
            pivot_px: fit.pivot_px,
        }));
    }
    Ok(fit
        .variant_fittings
        .iter()
        .find(|candidate| candidate.variant == variant)
        .map(|candidate| FittedImage {
            asset: &candidate.asset,
            pivot_px: candidate.pivot_px,
        }))
}

fn approved_fallback(
    context: &PartContext<'_>,
    slot: &ResolvedPoseSlot,
    source_direction: Direction,
    variant: &str,
) -> bool {
    context
        .draft
        .asset_fallback_approvals
        .iter()
        .any(|approval| {
            approval.slot_id == slot.slot_id
                && approval.target_direction == context.direction_resolution.target
                && approval.source_direction == source_direction
                && approval.variant == variant
        })
}

fn asset_candidates(
    context: &PartContext<'_>,
    slot_id: &SlotId,
) -> Result<Vec<crate::domain::AssetRevision>, AppearanceServiceError> {
    let mut seen = HashSet::new();
    let mut candidates = Vec::new();
    for fit in context
        .draft
        .fittings
        .iter()
        .filter(|fit| fit.slot_id == *slot_id)
    {
        for asset in std::iter::once(&fit.asset)
            .chain(fit.variant_fittings.iter().map(|variant| &variant.asset))
        {
            let revision = context.snapshot.require_asset_revision(asset)?;
            if seen.insert((revision.asset_id, revision.revision)) {
                candidates.push(revision.clone());
            }
        }
    }
    Ok(candidates)
}

fn fitted_image_for_revision<'a>(
    context: &PartContext<'a>,
    slot_id: &SlotId,
    asset_id: ObjectId,
    revision: u32,
    variant: &str,
    source_direction: Direction,
) -> Result<(&'a OutfitFitting, FittedImage<'a>), AppearanceServiceError> {
    for fit in context
        .draft
        .fittings
        .iter()
        .filter(|fit| fit.slot_id == *slot_id && fit.direction == source_direction)
    {
        let base = context.snapshot.require_asset_revision(&fit.asset)?;
        if base.asset_id == asset_id && base.revision == revision && base.variant == variant {
            return Ok((
                fit,
                FittedImage {
                    asset: &fit.asset,
                    pivot_px: fit.pivot_px,
                },
            ));
        }
        if let Some(candidate) = fit.variant_fittings.iter().find(|candidate| {
            candidate.variant == variant
                && candidate.asset.asset_id == asset_id
                && candidate.asset.revision == revision
        }) {
            return Ok((
                fit,
                FittedImage {
                    asset: &candidate.asset,
                    pivot_px: candidate.pivot_px,
                },
            ));
        }
    }
    Err(AppearanceServiceError::InvalidState(format!(
        "resolved sprite variant {variant} has no matching outfit fitting"
    )))
}

fn fitting_render_data(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    fit: Option<&crate::domain::OutfitFitting>,
    image: Option<FittedImage<'_>>,
    bitmap_mirrored: bool,
    mirror_geometry: bool,
) -> Result<FittingRenderData, AppearanceServiceError> {
    let (Some(fit), Some(image)) = (fit, image) else {
        return Ok(FittingRenderData {
            bitmap: RgbaImage::new(1, 1),
            transform: RenderTransform::IDENTITY,
            pivot_px: (0.0, 0.0),
            visible: false,
            layer_delta: 0,
            mirror_bitmap_x: false,
        });
    };
    let revision = snapshot.require_asset_revision(image.asset)?;
    let source = vault.resolve(&area_path.join(revision.source_file.as_str()))?;
    let bitmap = image::open(source.as_path())
        .map_err(|error| AppearanceServiceError::Image(error.to_string()))?
        .to_rgba8();
    let mut transform = RenderTransform::from(fit.transform);
    let pivot_px = (f64::from(image.pivot_px.0), f64::from(image.pivot_px.1));
    if mirror_geometry {
        transform = mirror_transform_x(transform);
    }
    Ok(FittingRenderData {
        bitmap,
        transform,
        pivot_px,
        visible: fit.visible,
        layer_delta: i32::from(fit.layer_delta),
        // Pose mirroring and bitmap fallback are independent. Exact target fittings pass false;
        // only an explicit, persisted asset-fallback approval reaches this true branch.
        mirror_bitmap_x: bitmap_mirrored,
    })
}
fn build_equipment_part(
    context: &PartContext<'_>,
    source: EquipmentRenderSource<'_>,
) -> Result<RenderPart, AppearanceServiceError> {
    let slot_id = equipment_slot_id(source.id)?;
    if !source.enabled {
        return Ok(hidden_equipment_part(slot_id, source));
    }
    let anchor = context
        .resolved_slots
        .get(source.anchor_slot)
        .copied()
        .ok_or_else(|| {
            AppearanceServiceError::InvalidState(format!(
                "equipment part {} references missing resolved anchor {}",
                source.id, source.anchor_slot
            ))
        })?;
    let fitting = equipment_fitting_render_data(context, source, anchor.sprite_variant.as_deref())?;
    let own_motion = EquipmentMotionSampler.sample(
        source.own_motion_enabled && fitting.visible,
        source.tracks,
        context.direction,
        context.frame_index,
        context.frame_count,
        context.loop_mode,
    )?;
    let follows_visible_slot = source.follow_mode != FollowMode::Slot || anchor.visible;
    Ok(RenderPart {
        slot_id,
        parent_id: (source.follow_mode == FollowMode::Slot).then(|| source.anchor_slot.clone()),
        profile: RenderTransform::IDENTITY,
        motion: RenderTransform {
            offset_x: own_motion.offset_x_px,
            offset_y: own_motion.offset_y_px,
            rotation_deg: own_motion.rotation_deg,
        },
        fitting: fitting.transform,
        local_override: RenderTransform::IDENTITY,
        pivot_px: fitting.pivot_px,
        visible: fitting.visible && follows_visible_slot,
        layer: anchor.layer + fitting.layer_delta,
        mirror_bitmap_x: fitting.mirror_bitmap_x,
        bitmap: fitting.bitmap,
    })
}

fn hidden_equipment_part(slot_id: SlotId, source: EquipmentRenderSource<'_>) -> RenderPart {
    RenderPart {
        slot_id,
        parent_id: (source.follow_mode == FollowMode::Slot).then(|| source.anchor_slot.clone()),
        profile: RenderTransform::IDENTITY,
        motion: RenderTransform::IDENTITY,
        fitting: RenderTransform::IDENTITY,
        local_override: RenderTransform::IDENTITY,
        pivot_px: (0.0, 0.0),
        visible: false,
        layer: 0,
        mirror_bitmap_x: false,
        bitmap: RgbaImage::new(1, 1),
    }
}

fn equipment_fitting_render_data(
    context: &PartContext<'_>,
    source: EquipmentRenderSource<'_>,
    sprite_variant: Option<&str>,
) -> Result<FittingRenderData, AppearanceServiceError> {
    let Some(fit) = source
        .fits
        .iter()
        .find(|fit| fit.direction == context.direction)
    else {
        return Ok(missing_fitting_render_data());
    };
    let base_asset = fit.asset.as_ref().unwrap_or(source.asset);
    let base_revision = context.snapshot.require_asset_revision(base_asset)?;
    let (asset, pivot) = if let Some(variant) = sprite_variant {
        if base_revision.variant == variant {
            (base_asset, fit.pivot_px.unwrap_or(base_revision.pivot_px))
        } else {
            let variant_fit = fit
                .variant_fittings
                .iter()
                .find(|candidate| candidate.variant == variant)
                .ok_or_else(|| {
                    AppearanceServiceError::InvalidState(format!(
                        "equipment part {} has no {:?} image for sprite variant {}",
                        source.id, context.direction, variant
                    ))
                })?;
            (&variant_fit.asset, variant_fit.pivot_px)
        }
    } else {
        (base_asset, fit.pivot_px.unwrap_or(base_revision.pivot_px))
    };
    let revision = context.snapshot.require_asset_revision(asset)?;
    if revision.direction != context.direction
        || sprite_variant.is_some_and(|variant| revision.variant != variant)
    {
        return Err(AppearanceServiceError::InvalidState(format!(
            "equipment part {} uses an incompatible {:?} direction image or sprite variant",
            source.id, context.direction
        )));
    }
    let path = context
        .vault
        .resolve(&context.area_path.join(revision.source_file.as_str()))?;
    let bitmap = image::open(path.as_path())
        .map_err(|error| AppearanceServiceError::Image(error.to_string()))?
        .to_rgba8();
    Ok(FittingRenderData {
        bitmap,
        transform: RenderTransform::from(fit.transform),
        pivot_px: (f64::from(pivot.0), f64::from(pivot.1)),
        visible: fit.visible,
        layer_delta: i32::from(fit.layer_delta),
        // Equipment owns explicit target-direction images. Mirroring the resolved body motion
        // again would swap asymmetric gloves and accessories.
        mirror_bitmap_x: false,
    })
}

fn missing_fitting_render_data() -> FittingRenderData {
    FittingRenderData {
        bitmap: RgbaImage::new(1, 1),
        transform: RenderTransform::IDENTITY,
        pivot_px: (0.0, 0.0),
        visible: false,
        layer_delta: 0,
        mirror_bitmap_x: false,
    }
}

fn equipment_slot_id(id: ObjectId) -> Result<SlotId, AppearanceServiceError> {
    SlotId::parse(format!("equipment_{}", id.to_string().replace('-', "")))
        .map_err(AppearanceServiceError::from)
}

fn primary_equipment_source(value: &Equipment) -> EquipmentRenderSource<'_> {
    EquipmentRenderSource {
        id: value.id,
        anchor_slot: &value.anchor_slot,
        asset: &value.asset,
        enabled: value.enabled,
        follow_mode: value.follow_mode,
        own_motion_enabled: value.own_motion_enabled,
        fits: &value.fit_by_direction,
        tracks: &value.own_motion_tracks,
    }
}

fn additional_equipment_source(value: &EquipmentPart) -> EquipmentRenderSource<'_> {
    EquipmentRenderSource {
        id: value.id,
        anchor_slot: &value.anchor_slot,
        asset: &value.asset,
        enabled: value.enabled,
        follow_mode: value.follow_mode,
        own_motion_enabled: value.own_motion_enabled,
        fits: &value.fit_by_direction,
        tracks: &value.own_motion_tracks,
    }
}
