use thiserror::Error;

use crate::domain::{
    Direction, EquipmentMotionKey, EquipmentMotionTrack, Interpolation, LoopMode, Transform2D,
};

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EquipmentSampleError {
    #[error("equipment sample index {index} is outside 0..{frame_count}")]
    FrameOutOfRange { index: u16, frame_count: u16 },
    #[error("enabled equipment track for {0:?} has no keys")]
    EmptyTrack(Direction),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SampledEquipmentMotion {
    pub offset_x_px: f64,
    pub offset_y_px: f64,
    pub rotation_deg: f64,
}

impl SampledEquipmentMotion {
    pub const IDENTITY: Self = Self {
        offset_x_px: 0.0,
        offset_y_px: 0.0,
        rotation_deg: 0.0,
    };
}

#[derive(Debug, Default, Clone, Copy)]
pub struct EquipmentMotionSampler;

impl EquipmentMotionSampler {
    /// Equipment motion is sampled solely from persisted keys. Disabled parts, disabled own
    /// motion, and disabled tracks all return identity without consulting hidden key values.
    pub fn sample(
        &self,
        own_motion_active: bool,
        tracks: &[EquipmentMotionTrack],
        direction: Direction,
        sample_index: u16,
        frame_count: u16,
        loop_mode: LoopMode,
    ) -> Result<SampledEquipmentMotion, EquipmentSampleError> {
        if sample_index >= frame_count {
            return Err(EquipmentSampleError::FrameOutOfRange {
                index: sample_index,
                frame_count,
            });
        }
        if !own_motion_active {
            return Ok(SampledEquipmentMotion::IDENTITY);
        }
        let Some(track) = tracks
            .iter()
            .find(|track| track.direction == direction && track.enabled)
        else {
            return Ok(SampledEquipmentMotion::IDENTITY);
        };
        if track.keys.is_empty() {
            return Err(EquipmentSampleError::EmptyTrack(direction));
        }
        let (left, left_frame, right, right_frame) =
            sample_span(&track.keys, sample_index, frame_count, loop_mode);
        if std::ptr::eq(left, right) || track.interpolation == Interpolation::Hold {
            return Ok(from_transform(left.transform));
        }
        let span = f64::from(right_frame - left_frame);
        let mut amount = f64::from(i32::from(sample_index) - left_frame) / span;
        if track.interpolation == Interpolation::EaseInOut {
            amount = amount * amount * (3.0 - 2.0 * amount);
        }
        Ok(interpolate(left.transform, right.transform, amount))
    }
}

fn sample_span(
    keys: &[EquipmentMotionKey],
    sample_index: u16,
    frame_count: u16,
    loop_mode: LoopMode,
) -> (&EquipmentMotionKey, i32, &EquipmentMotionKey, i32) {
    if keys.len() == 1 {
        return (
            &keys[0],
            i32::from(keys[0].frame),
            &keys[0],
            i32::from(keys[0].frame),
        );
    }
    if let Some(exact) = keys.iter().find(|key| key.frame == sample_index) {
        return (exact, i32::from(exact.frame), exact, i32::from(exact.frame));
    }
    let next_index = keys.partition_point(|key| key.frame < sample_index);
    match (next_index, loop_mode) {
        (0, LoopMode::Once) => (&keys[0], 0, &keys[0], 0),
        (index, LoopMode::Once) if index == keys.len() => {
            let last = keys.last().expect("at least two keys checked");
            (last, i32::from(last.frame), last, i32::from(last.frame))
        }
        (index, LoopMode::Once) => {
            let left = &keys[index - 1];
            let right = &keys[index];
            (left, i32::from(left.frame), right, i32::from(right.frame))
        }
        (0, LoopMode::Loop) => {
            let left = keys.last().expect("at least two keys checked");
            let right = &keys[0];
            (
                left,
                i32::from(left.frame) - i32::from(frame_count),
                right,
                i32::from(right.frame),
            )
        }
        (index, LoopMode::Loop) if index == keys.len() => {
            let left = keys.last().expect("at least two keys checked");
            let right = &keys[0];
            (
                left,
                i32::from(left.frame),
                right,
                i32::from(right.frame) + i32::from(frame_count),
            )
        }
        (index, LoopMode::Loop) => {
            let left = &keys[index - 1];
            let right = &keys[index];
            (left, i32::from(left.frame), right, i32::from(right.frame))
        }
    }
}

fn from_transform(value: Transform2D) -> SampledEquipmentMotion {
    SampledEquipmentMotion {
        offset_x_px: f64::from(value.offset_px.0),
        offset_y_px: f64::from(value.offset_px.1),
        rotation_deg: f64::from(value.rotation_deg),
    }
}

fn interpolate(left: Transform2D, right: Transform2D, amount: f64) -> SampledEquipmentMotion {
    let mut rotation_delta =
        (f64::from(right.rotation_deg - left.rotation_deg) + 180.0).rem_euclid(360.0) - 180.0;
    if (rotation_delta + 180.0).abs() < f64::EPSILON {
        rotation_delta = 180.0;
    }
    SampledEquipmentMotion {
        offset_x_px: f64::from(left.offset_px.0)
            + (f64::from(right.offset_px.0) - f64::from(left.offset_px.0)) * amount,
        offset_y_px: f64::from(left.offset_px.1)
            + (f64::from(right.offset_px.1) - f64::from(left.offset_px.1)) * amount,
        rotation_deg: f64::from(left.rotation_deg) + rotation_delta * amount,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{EquipmentMotionTrack, PixelPoint};

    fn tracks() -> Vec<EquipmentMotionTrack> {
        vec![EquipmentMotionTrack {
            direction: Direction::S,
            enabled: true,
            interpolation: Interpolation::Linear,
            keys: vec![
                EquipmentMotionKey {
                    frame: 0,
                    transform: transform(0, 0, 170.0),
                },
                EquipmentMotionKey {
                    frame: 2,
                    transform: transform(4, 2, -170.0),
                },
            ],
        }]
    }

    #[test]
    fn samples_transform_keys_deterministically_and_uses_short_rotation() {
        let sampled = EquipmentMotionSampler
            .sample(true, &tracks(), Direction::S, 1, 4, LoopMode::Loop)
            .unwrap();
        assert_eq!(sampled.offset_x_px, 2.0);
        assert_eq!(sampled.offset_y_px, 1.0);
        assert_eq!(sampled.rotation_deg, 180.0);
    }

    #[test]
    fn disabled_part_own_motion_or_track_never_leaks_stored_values() {
        let mut value = tracks();
        assert_eq!(sample(false, &value), SampledEquipmentMotion::IDENTITY);
        value[0].enabled = false;
        assert_eq!(sample(true, &value), SampledEquipmentMotion::IDENTITY);
        assert_eq!(value[0].keys.len(), 2);
    }

    #[test]
    fn interpolation_handles_the_full_persisted_integer_coordinate_range() {
        let value = vec![EquipmentMotionTrack {
            direction: Direction::S,
            enabled: true,
            interpolation: Interpolation::Linear,
            keys: vec![
                EquipmentMotionKey {
                    frame: 0,
                    transform: transform(i16::MIN, i16::MAX, 0.0),
                },
                EquipmentMotionKey {
                    frame: 2,
                    transform: transform(i16::MAX, i16::MIN, 0.0),
                },
            ],
        }];
        let sampled = EquipmentMotionSampler
            .sample(true, &value, Direction::S, 1, 3, LoopMode::Once)
            .unwrap();
        assert_eq!(sampled.offset_x_px, -0.5);
        assert_eq!(sampled.offset_y_px, -0.5);
    }

    fn sample(active: bool, tracks: &[EquipmentMotionTrack]) -> SampledEquipmentMotion {
        EquipmentMotionSampler
            .sample(active, tracks, Direction::S, 1, 4, LoopMode::Loop)
            .unwrap()
    }

    fn transform(x: i16, y: i16, rotation_deg: f32) -> Transform2D {
        Transform2D {
            offset_px: PixelPoint(x, y),
            rotation_deg,
        }
    }
}
