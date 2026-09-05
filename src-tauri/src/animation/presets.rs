use crate::domain::{
    ActionKey, Direction, DirectionDefinition, DirectionMode, DocumentKind, GroundShadow,
    Interpolation, Keyframe, LoopMode, MotionHelperChannel, MotionRevision, MotionSemantics,
    MotionTrack, ObjectId, PixelPoint, PixelSize, RevisionRef, SlotId, TrackProperty, TrackValue,
    UtcTimestamp,
};
use thiserror::Error;

use super::{AnimationSampler, SampleError};

pub use crate::domain::{
    HelperKind, JumpHeightMode, MotionHelperChannel as HelperChannel,
    MotionPresetKind as PresetKind, RootMotionMode,
};

#[derive(Debug, Clone)]
pub struct MotionPreset {
    pub kind: PresetKind,
    pub name: &'static str,
    pub action_key: ActionKey,
    pub root_motion: RootMotionMode,
    pub recommended_speed_px_per_second: Option<u16>,
    pub jump_height_mode: JumpHeightMode,
    pub helpers: Vec<HelperChannel>,
    pub motion: MotionRevision,
}

#[derive(Debug, Clone)]
pub struct PresetContext {
    pub template_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub published_at: UtcTimestamp,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
}

#[derive(Debug, Error)]
pub enum PresetError {
    #[error("helper channel index {0} does not exist")]
    MissingHelper(usize),
    #[error("helper channel must be enabled before it can be baked")]
    DisabledHelper,
    #[error(transparent)]
    Sample(#[from] SampleError),
    #[error("baked preset is invalid: {0}")]
    Invalid(String),
}

struct PresetRecipe {
    name: &'static str,
    action: &'static str,
    frame_count: u16,
    fps: u16,
    loop_mode: LoopMode,
    pose_slot: &'static str,
    pose_property: TrackProperty,
    pose_values: [f64; 4],
    helpers: Vec<MotionHelperChannel>,
    speed: Option<u16>,
    jump_mode: JumpHeightMode,
}

pub fn build_preset(kind: PresetKind, context: &PresetContext) -> MotionPreset {
    let recipe = preset_recipe(kind);
    let tracks = directional_tracks(
        recipe.pose_slot,
        recipe.pose_property,
        recipe.frame_count,
        &recipe.pose_values,
    );
    MotionPreset {
        kind,
        name: recipe.name,
        action_key: ActionKey::parse(recipe.action).expect("bundled action keys are valid"),
        root_motion: RootMotionMode::InPlace,
        recommended_speed_px_per_second: recipe.speed,
        jump_height_mode: recipe.jump_mode,
        helpers: recipe.helpers.clone(),
        motion: MotionRevision {
            schema_version: 1,
            kind: DocumentKind::MotionRevision,
            template_id: context.template_id,
            revision: 1,
            profile_ref: context.profile_ref,
            frame_size_px: context.frame_size_px,
            ground_origin_px: context.ground_origin_px,
            frame_count: recipe.frame_count,
            fps: recipe.fps,
            loop_mode: recipe.loop_mode,
            directions: default_directions(),
            tracks,
            semantics: Some(MotionSemantics {
                preset: kind,
                root_motion: RootMotionMode::InPlace,
                recommended_speed_px_per_second: recipe.speed,
                jump_height_mode: recipe.jump_mode,
                ground_shadow: Some(GroundShadow {
                    enabled: true,
                    width_px: 28,
                    height_px: 8,
                    opacity: 72,
                }),
                helpers: recipe.helpers,
            }),
            published_at: context.published_at,
        },
    }
}

fn preset_recipe(kind: PresetKind) -> PresetRecipe {
    match kind {
        PresetKind::Idle => recipe(
            PresetKind::Idle,
            (8, 8, LoopMode::Loop),
            (
                "torso_upper",
                TrackProperty::OffsetYPx,
                [0.0, -1.0, 0.0, 1.0],
            ),
            vec![helper(
                HelperKind::BodyBob,
                "torso_upper",
                TrackProperty::OffsetYPx,
                1.0,
                1.0,
            )],
            None,
            JumpHeightMode::NotApplicable,
        ),
        PresetKind::Walk => recipe(
            PresetKind::Walk,
            (12, 12, LoopMode::Loop),
            (
                "thigh_l",
                TrackProperty::RotationDeg,
                [-18.0, 0.0, 18.0, 0.0],
            ),
            vec![helper(
                HelperKind::BodyBob,
                "torso_lower",
                TrackProperty::OffsetYPx,
                2.0,
                2.0,
            )],
            Some(48),
            JumpHeightMode::NotApplicable,
        ),
        PresetKind::Sprint => sprint_recipe(),
        PresetKind::Jump => recipe(
            PresetKind::Jump,
            (12, 12, LoopMode::Once),
            (
                "thigh_l",
                TrackProperty::RotationDeg,
                [24.0, -8.0, -18.0, 12.0],
            ),
            vec![helper(
                HelperKind::JumpHeight,
                "torso_lower",
                TrackProperty::OffsetYPx,
                18.0,
                0.5,
            )],
            None,
            JumpHeightMode::BakedIntoFrames,
        ),
        PresetKind::Interact => recipe(
            PresetKind::Interact,
            (8, 10, LoopMode::Once),
            (
                "forearm_r",
                TrackProperty::RotationDeg,
                [0.0, -25.0, -25.0, 0.0],
            ),
            Vec::new(),
            None,
            JumpHeightMode::NotApplicable,
        ),
        PresetKind::Attack => recipe(
            PresetKind::Attack,
            (6, 12, LoopMode::Once),
            (
                "upper_arm_r",
                TrackProperty::RotationDeg,
                [-20.0, -55.0, 35.0, 0.0],
            ),
            vec![helper(
                HelperKind::FollowThrough,
                "forearm_r",
                TrackProperty::RotationDeg,
                8.0,
                0.5,
            )],
            None,
            JumpHeightMode::NotApplicable,
        ),
    }
}

fn sprint_recipe() -> PresetRecipe {
    recipe(
        PresetKind::Sprint,
        (8, 16, LoopMode::Loop),
        (
            "thigh_l",
            TrackProperty::RotationDeg,
            [-32.0, 8.0, 32.0, -8.0],
        ),
        vec![
            helper(
                HelperKind::BodyBob,
                "torso_lower",
                TrackProperty::OffsetYPx,
                3.0,
                2.0,
            ),
            helper(
                HelperKind::BodySway,
                "torso_upper",
                TrackProperty::RotationDeg,
                5.0,
                1.0,
            ),
        ],
        Some(88),
        JumpHeightMode::NotApplicable,
    )
}

fn recipe(
    kind: PresetKind,
    timing: (u16, u16, LoopMode),
    pose: (&'static str, TrackProperty, [f64; 4]),
    helpers: Vec<MotionHelperChannel>,
    speed: Option<u16>,
    jump_mode: JumpHeightMode,
) -> PresetRecipe {
    let (name, action) = match kind {
        PresetKind::Idle => ("Idle", "idle"),
        PresetKind::Walk => ("Walk", "walk"),
        PresetKind::Sprint => ("Sprint", "sprint"),
        PresetKind::Jump => ("Jump", "jump"),
        PresetKind::Interact => ("Interact", "interact"),
        PresetKind::Attack => ("Attack", "attack"),
    };
    PresetRecipe {
        name,
        action,
        frame_count: timing.0,
        fps: timing.1,
        loop_mode: timing.2,
        pose_slot: pose.0,
        pose_property: pose.1,
        pose_values: pose.2,
        helpers,
        speed,
        jump_mode,
    }
}

pub fn configure_preset_timing(
    mut preset: MotionPreset,
    frame_count: u16,
    fps: u16,
    loop_mode: LoopMode,
) -> MotionPreset {
    let source_frame_count = preset.motion.frame_count;
    if frame_count != source_frame_count && frame_count > 0 {
        for track in &mut preset.motion.tracks {
            let mut keys = Vec::with_capacity(track.keys.len());
            for key in &track.keys {
                let target = (u32::from(key.frame) * u32::from(frame_count)
                    / u32::from(source_frame_count))
                .min(u32::from(frame_count - 1)) as u16;
                if keys
                    .last()
                    .is_some_and(|previous: &Keyframe| previous.frame == target)
                {
                    continue;
                }
                keys.push(Keyframe {
                    frame: target,
                    value: key.value.clone(),
                });
            }
            track.keys = keys;
        }
    }
    preset.motion.frame_count = frame_count;
    preset.motion.fps = fps;
    preset.motion.loop_mode = loop_mode;
    preset
}

pub fn set_external_jump_height(preset: &mut MotionPreset) {
    if preset.kind != PresetKind::Jump {
        return;
    }
    preset.jump_height_mode = JumpHeightMode::ExternalGameMotion;
    for helper in preset
        .helpers
        .iter_mut()
        .filter(|helper| helper.kind == HelperKind::JumpHeight)
    {
        helper.enabled = false;
    }
    if let Some(semantics) = &mut preset.motion.semantics {
        semantics.jump_height_mode = JumpHeightMode::ExternalGameMotion;
        for helper in semantics
            .helpers
            .iter_mut()
            .filter(|helper| helper.kind == HelperKind::JumpHeight)
        {
            helper.enabled = false;
        }
    }
}

pub fn bake_helper_channel(
    motion: &MotionRevision,
    helper_index: usize,
) -> Result<MotionRevision, PresetError> {
    let helper = motion
        .semantics
        .as_ref()
        .and_then(|semantics| semantics.helpers.get(helper_index))
        .cloned()
        .ok_or(PresetError::MissingHelper(helper_index))?;
    if !helper.enabled {
        return Err(PresetError::DisabledHelper);
    }

    let mut base = motion.clone();
    base.semantics = None;
    let explicit_directions = motion
        .directions
        .iter()
        .filter(|definition| definition.mode == DirectionMode::Explicit)
        .map(|definition| definition.direction)
        .collect::<Vec<_>>();
    let mut result = motion.clone();
    result.tracks.retain(|track| {
        !(explicit_directions.contains(&track.direction)
            && track.slot_id == helper.slot_id
            && track.property == helper.property)
    });
    for direction in explicit_directions {
        let mut track = helper.bake(direction, motion.frame_count);
        for key in &mut track.keys {
            let sampled = AnimationSampler.sample(&base, direction, key.frame)?;
            let base_value = sampled
                .slots
                .iter()
                .find(|slot| slot.slot_id == helper.slot_id)
                .map_or(0.0, |slot| numeric_property(slot, helper.property));
            let TrackValue::Number(value) = &mut key.value else {
                unreachable!("helper bake always creates numeric values")
            };
            *value += base_value;
        }
        result.tracks.push(track);
    }
    if let Some(semantics) = &mut result.semantics {
        semantics.helpers.remove(helper_index);
    }
    result
        .validate(None)
        .map_err(|error| PresetError::Invalid(error.to_string()))?;
    Ok(result)
}

fn numeric_property(slot: &super::SampledSlot, property: TrackProperty) -> f64 {
    match property {
        TrackProperty::OffsetXPx => slot.offset_x_px,
        TrackProperty::OffsetYPx => slot.offset_y_px,
        TrackProperty::RotationDeg => slot.rotation_deg,
        _ => 0.0,
    }
}

fn helper(
    kind: HelperKind,
    slot: &str,
    property: TrackProperty,
    amplitude: f64,
    cycles: f64,
) -> MotionHelperChannel {
    MotionHelperChannel {
        kind,
        slot_id: SlotId::parse(slot).expect("bundled helper slot is valid"),
        property,
        amplitude,
        cycles,
        phase: 0.0,
        enabled: true,
    }
}

fn directional_tracks(
    slot: &str,
    property: TrackProperty,
    frame_count: u16,
    values: &[f64; 4],
) -> Vec<MotionTrack> {
    let slot_id = SlotId::parse(slot).expect("bundled preset slot is valid");
    source_directions()
        .into_iter()
        .map(|direction| MotionTrack {
            direction,
            slot_id: slot_id.clone(),
            property,
            interpolation: Interpolation::EaseInOut,
            keys: values
                .iter()
                .enumerate()
                .map(|(index, value)| Keyframe {
                    frame: (index as u16 * frame_count) / 4,
                    value: TrackValue::Number(*value),
                })
                .collect(),
        })
        .collect()
}

fn default_directions() -> Vec<DirectionDefinition> {
    Direction::ALL
        .into_iter()
        .map(|direction| {
            let source = match direction {
                Direction::Sw => Some(Direction::Se),
                Direction::W => Some(Direction::E),
                Direction::Nw => Some(Direction::Ne),
                _ => None,
            };
            DirectionDefinition {
                direction,
                mode: if source.is_some() {
                    DirectionMode::Mirrored
                } else {
                    DirectionMode::Explicit
                },
                source,
            }
        })
        .collect()
}

fn source_directions() -> [Direction; 5] {
    [
        Direction::N,
        Direction::Ne,
        Direction::E,
        Direction::Se,
        Direction::S,
    ]
}
