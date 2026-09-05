use std::collections::{BTreeMap, HashMap};

use thiserror::Error;

use crate::domain::{
    Direction, DirectionMode, Interpolation, LoopMode, MotionRevision, MotionTrack, SlotId,
    TrackProperty, TrackValue,
};

#[derive(Debug, Error, PartialEq)]
pub enum SampleError {
    #[error("sample index {index} is outside 0..{frame_count}")]
    FrameOutOfRange { index: u16, frame_count: u16 },
    #[error("direction {0:?} is missing")]
    MissingDirection(Direction),
    #[error("direction {0:?} has an invalid mirror source")]
    InvalidDirection(Direction),
    #[error("track value does not match {0:?}")]
    InvalidTrackValue(TrackProperty),
    #[error("helper channel cannot target {0:?}")]
    InvalidHelperProperty(TrackProperty),
    #[error("retiming to {new_frame_count} frames would remove {affected_keys} key(s)")]
    RetimeConfirmationRequired {
        new_frame_count: u16,
        affected_keys: usize,
    },
    #[error("frame count must be within 1..=1024")]
    InvalidFrameCount,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SampledSlot {
    pub slot_id: SlotId,
    pub offset_x_px: f64,
    pub offset_y_px: f64,
    pub rotation_deg: f64,
    pub visible: bool,
    pub sprite_variant: Option<String>,
    pub layer_delta: i16,
}

impl SampledSlot {
    fn neutral(slot_id: SlotId) -> Self {
        Self {
            slot_id,
            offset_x_px: 0.0,
            offset_y_px: 0.0,
            rotation_deg: 0.0,
            visible: true,
            sprite_variant: None,
            layer_delta: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SampledPose {
    pub requested_direction: Direction,
    pub source_direction: Direction,
    pub mirror_parity: bool,
    pub sample_index: u16,
    pub slots: Vec<SampledSlot>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AffectedKey {
    pub direction: Direction,
    pub slot_id: SlotId,
    pub property: TrackProperty,
    pub frame: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetimePreview {
    pub old_frame_count: u16,
    pub new_frame_count: u16,
    pub affected_keys: Vec<AffectedKey>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct AnimationSampler;

impl AnimationSampler {
    /// Samples only persisted data. It has no clock or previous-frame state, so calling frames in
    /// a different order produces the same values.
    pub fn sample(
        &self,
        motion: &MotionRevision,
        direction: Direction,
        sample_index: u16,
    ) -> Result<SampledPose, SampleError> {
        if sample_index >= motion.frame_count {
            return Err(SampleError::FrameOutOfRange {
                index: sample_index,
                frame_count: motion.frame_count,
            });
        }
        let (source_direction, mirror_parity) = resolve_source(motion, direction)?;
        let mut slots = BTreeMap::<String, SampledSlot>::new();
        for track in motion
            .tracks
            .iter()
            .filter(|track| track.direction == source_direction)
        {
            let value = sample_track(track, sample_index, motion.frame_count, motion.loop_mode)?;
            let slot = slots
                .entry(track.slot_id.to_string())
                .or_insert_with(|| SampledSlot::neutral(track.slot_id.clone()));
            apply_value(slot, track.property, value)?;
        }
        if let Some(semantics) = &motion.semantics {
            for helper in semantics.helpers.iter().filter(|helper| helper.enabled) {
                let slot = slots
                    .entry(helper.slot_id.to_string())
                    .or_insert_with(|| SampledSlot::neutral(helper.slot_id.clone()));
                apply_helper_value(
                    slot,
                    helper.property,
                    helper.sample(sample_index, motion.frame_count),
                )?;
            }
        }
        Ok(SampledPose {
            requested_direction: direction,
            source_direction,
            mirror_parity,
            sample_index,
            slots: slots.into_values().collect(),
        })
    }

    pub fn duration_seconds(&self, motion: &MotionRevision) -> f64 {
        f64::from(motion.frame_count) / f64::from(motion.fps)
    }

    pub fn preview_retime(
        &self,
        motion: &MotionRevision,
        new_frame_count: u16,
    ) -> Result<RetimePreview, SampleError> {
        validate_frame_count(new_frame_count)?;
        let affected_keys = motion
            .tracks
            .iter()
            .flat_map(|track| {
                track
                    .keys
                    .iter()
                    .filter(move |key| key.frame >= new_frame_count)
                    .map(move |key| AffectedKey {
                        direction: track.direction,
                        slot_id: track.slot_id.clone(),
                        property: track.property,
                        frame: key.frame,
                    })
            })
            .collect();
        Ok(RetimePreview {
            old_frame_count: motion.frame_count,
            new_frame_count,
            affected_keys,
        })
    }

    /// Truncation is deliberately impossible without an explicit confirmation from the caller.
    pub fn apply_retime(
        &self,
        motion: &MotionRevision,
        new_frame_count: u16,
        confirm_truncation: bool,
    ) -> Result<MotionRevision, SampleError> {
        let preview = self.preview_retime(motion, new_frame_count)?;
        if !preview.affected_keys.is_empty() && !confirm_truncation {
            return Err(SampleError::RetimeConfirmationRequired {
                new_frame_count,
                affected_keys: preview.affected_keys.len(),
            });
        }
        let mut result = motion.clone();
        result.frame_count = new_frame_count;
        for track in &mut result.tracks {
            track.keys.retain(|key| key.frame < new_frame_count);
        }
        result.tracks.retain(|track| !track.keys.is_empty());
        Ok(result)
    }
}

fn apply_helper_value(
    slot: &mut SampledSlot,
    property: TrackProperty,
    value: f64,
) -> Result<(), SampleError> {
    match property {
        TrackProperty::OffsetXPx => slot.offset_x_px += value,
        TrackProperty::OffsetYPx => slot.offset_y_px += value,
        TrackProperty::RotationDeg => slot.rotation_deg += value,
        _ => return Err(SampleError::InvalidHelperProperty(property)),
    }
    Ok(())
}

fn resolve_source(
    motion: &MotionRevision,
    requested: Direction,
) -> Result<(Direction, bool), SampleError> {
    let definitions = motion
        .directions
        .iter()
        .map(|item| (item.direction, item))
        .collect::<HashMap<_, _>>();
    let mut current = requested;
    let mut mirrored = false;
    for _ in 0..=Direction::ALL.len() {
        let definition = definitions
            .get(&current)
            .ok_or(SampleError::InvalidDirection(current))?;
        match (definition.mode, definition.source) {
            (DirectionMode::Explicit, None) => return Ok((current, mirrored)),
            (DirectionMode::Mirrored, Some(source)) => {
                mirrored = !mirrored;
                current = source;
            }
            (DirectionMode::Missing, None) => {
                return Err(SampleError::MissingDirection(requested));
            }
            _ => return Err(SampleError::InvalidDirection(current)),
        }
    }
    Err(SampleError::InvalidDirection(requested))
}

fn sample_track(
    track: &MotionTrack,
    sample_index: u16,
    frame_count: u16,
    loop_mode: LoopMode,
) -> Result<TrackValue, SampleError> {
    if track.keys.len() == 1 {
        return Ok(track.keys[0].value.clone());
    }
    if let Some(exact) = track.keys.iter().find(|key| key.frame == sample_index) {
        return Ok(exact.value.clone());
    }
    let next_index = track.keys.partition_point(|key| key.frame < sample_index);
    let (left, left_frame, right, right_frame) = match (next_index, loop_mode) {
        (0, LoopMode::Once) => return Ok(track.keys[0].value.clone()),
        (index, LoopMode::Once) if index == track.keys.len() => {
            return Ok(track.keys.last().expect("two keys checked").value.clone());
        }
        (index, LoopMode::Once) => {
            let left = &track.keys[index - 1];
            let right = &track.keys[index];
            (left, i32::from(left.frame), right, i32::from(right.frame))
        }
        (0, LoopMode::Loop) => {
            let left = track.keys.last().expect("two keys checked");
            let right = &track.keys[0];
            (
                left,
                i32::from(left.frame) - i32::from(frame_count),
                right,
                i32::from(right.frame),
            )
        }
        (index, LoopMode::Loop) if index == track.keys.len() => {
            let left = track.keys.last().expect("two keys checked");
            let right = &track.keys[0];
            (
                left,
                i32::from(left.frame),
                right,
                i32::from(right.frame) + i32::from(frame_count),
            )
        }
        (index, LoopMode::Loop) => {
            let left = &track.keys[index - 1];
            let right = &track.keys[index];
            (left, i32::from(left.frame), right, i32::from(right.frame))
        }
    };
    if track.interpolation == Interpolation::Hold || is_discrete(track.property) {
        return Ok(left.value.clone());
    }
    let span = f64::from(right_frame - left_frame);
    let mut amount = f64::from(i32::from(sample_index) - left_frame) / span;
    if track.interpolation == Interpolation::EaseInOut {
        amount = amount * amount * (3.0 - 2.0 * amount);
    }
    interpolate(track.property, &left.value, &right.value, amount)
}

fn interpolate(
    property: TrackProperty,
    left: &TrackValue,
    right: &TrackValue,
    amount: f64,
) -> Result<TrackValue, SampleError> {
    let (TrackValue::Number(left), TrackValue::Number(right)) = (left, right) else {
        return Err(SampleError::InvalidTrackValue(property));
    };
    let value = if property == TrackProperty::RotationDeg {
        let mut delta = (right - left + 180.0).rem_euclid(360.0) - 180.0;
        if (delta + 180.0).abs() < f64::EPSILON {
            delta = 180.0;
        }
        left + delta * amount
    } else {
        left + (right - left) * amount
    };
    Ok(TrackValue::Number(value))
}

fn is_discrete(property: TrackProperty) -> bool {
    matches!(
        property,
        TrackProperty::Visible | TrackProperty::SpriteVariant | TrackProperty::LayerDelta
    )
}

fn apply_value(
    slot: &mut SampledSlot,
    property: TrackProperty,
    value: TrackValue,
) -> Result<(), SampleError> {
    match (property, value) {
        (TrackProperty::OffsetXPx, TrackValue::Number(value)) => slot.offset_x_px = value,
        (TrackProperty::OffsetYPx, TrackValue::Number(value)) => slot.offset_y_px = value,
        (TrackProperty::RotationDeg, TrackValue::Number(value)) => slot.rotation_deg = value,
        (TrackProperty::Visible, TrackValue::Boolean(value)) => slot.visible = value,
        (TrackProperty::SpriteVariant, TrackValue::Text(value)) => {
            slot.sprite_variant = Some(value)
        }
        (TrackProperty::LayerDelta, TrackValue::Number(value)) => slot.layer_delta = value as i16,
        (property, _) => return Err(SampleError::InvalidTrackValue(property)),
    }
    Ok(())
}

fn validate_frame_count(value: u16) -> Result<(), SampleError> {
    if (1..=1024).contains(&value) {
        Ok(())
    } else {
        Err(SampleError::InvalidFrameCount)
    }
}
