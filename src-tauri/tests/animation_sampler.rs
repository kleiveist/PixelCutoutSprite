use pixel_cutout_sprite_studio_lib::animation::{AnimationSampler, SampleError};
use pixel_cutout_sprite_studio_lib::domain::{
    Direction, DirectionDefinition, DirectionMode, DocumentKind, Interpolation, Keyframe, LoopMode,
    MotionRevision, MotionTrack, ObjectId, PixelPoint, PixelSize, RevisionRef, SlotId,
    TrackProperty, TrackValue, UtcTimestamp,
};

fn directions() -> Vec<DirectionDefinition> {
    Direction::ALL
        .into_iter()
        .map(|direction| DirectionDefinition {
            direction,
            mode: DirectionMode::Explicit,
            source: None,
        })
        .collect()
}

fn key(frame: u16, value: f64) -> Keyframe {
    Keyframe {
        frame,
        value: TrackValue::Number(value),
    }
}

fn track(
    property: TrackProperty,
    interpolation: Interpolation,
    keys: Vec<Keyframe>,
) -> MotionTrack {
    MotionTrack {
        direction: Direction::S,
        slot_id: SlotId::parse("torso_upper").unwrap(),
        property,
        interpolation,
        keys,
    }
}

fn motion(loop_mode: LoopMode, tracks: Vec<MotionTrack>) -> MotionRevision {
    MotionRevision {
        schema_version: 1,
        kind: DocumentKind::MotionRevision,
        template_id: ObjectId::new(),
        revision: 1,
        profile_ref: RevisionRef {
            id: ObjectId::new(),
            revision: 1,
        },
        frame_size_px: PixelSize(128, 128),
        ground_origin_px: PixelPoint(64, 108),
        frame_count: 12,
        fps: 12,
        loop_mode,
        directions: directions(),
        tracks,
        published_at: UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
    }
}

fn number(result: &pixel_cutout_sprite_studio_lib::animation::SampledPose) -> f64 {
    result.slots[0].offset_x_px
}

#[test]
fn four_key_poses_create_exactly_twelve_deterministic_samples_and_one_second() {
    let clip = motion(
        LoopMode::Loop,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Linear,
            vec![key(0, 0.0), key(3, 6.0), key(6, 0.0), key(9, -6.0)],
        )],
    );
    let sampler = AnimationSampler;
    assert_eq!(sampler.duration_seconds(&clip), 1.0);
    let forward = (0..12)
        .map(|frame| number(&sampler.sample(&clip, Direction::S, frame).unwrap()))
        .collect::<Vec<_>>();
    let reverse = (0..12)
        .rev()
        .map(|frame| {
            (
                frame,
                number(&sampler.sample(&clip, Direction::S, frame).unwrap()),
            )
        })
        .collect::<std::collections::HashMap<_, _>>();
    assert_eq!(
        forward,
        vec![0.0, 2.0, 4.0, 6.0, 4.0, 2.0, 0.0, -2.0, -4.0, -6.0, -4.0, -2.0]
    );
    assert!(forward
        .iter()
        .enumerate()
        .all(|(frame, value)| reverse[&(frame as u16)] == *value));
    assert!(matches!(
        sampler.sample(&clip, Direction::S, 12),
        Err(SampleError::FrameOutOfRange { .. })
    ));
}

#[test]
fn hold_linear_ease_and_single_key_have_fixed_results() {
    let sampler = AnimationSampler;
    let linear = motion(
        LoopMode::Once,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Linear,
            vec![key(0, 0.0), key(4, 8.0)],
        )],
    );
    assert_eq!(
        number(&sampler.sample(&linear, Direction::S, 2).unwrap()),
        4.0
    );
    let ease = motion(
        LoopMode::Once,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::EaseInOut,
            vec![key(0, 0.0), key(4, 8.0)],
        )],
    );
    assert_eq!(
        number(&sampler.sample(&ease, Direction::S, 1).unwrap()),
        1.25
    );
    let hold = motion(
        LoopMode::Once,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Hold,
            vec![key(0, 2.0), key(4, 8.0)],
        )],
    );
    assert_eq!(
        number(&sampler.sample(&hold, Direction::S, 3).unwrap()),
        2.0
    );
    let single = motion(
        LoopMode::Loop,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Linear,
            vec![key(7, 3.0)],
        )],
    );
    assert_eq!(
        number(&sampler.sample(&single, Direction::S, 0).unwrap()),
        3.0
    );
}

#[test]
fn discrete_values_hold_and_once_clamps_at_both_ends() {
    let mut visible = track(
        TrackProperty::Visible,
        Interpolation::Hold,
        vec![
            Keyframe {
                frame: 3,
                value: TrackValue::Boolean(false),
            },
            Keyframe {
                frame: 6,
                value: TrackValue::Boolean(true),
            },
        ],
    );
    visible.slot_id = SlotId::parse("hand_l").unwrap();
    let clip = motion(LoopMode::Once, vec![visible]);
    let sampler = AnimationSampler;
    assert!(!sampler.sample(&clip, Direction::S, 0).unwrap().slots[0].visible);
    assert!(!sampler.sample(&clip, Direction::S, 5).unwrap().slots[0].visible);
    assert!(sampler.sample(&clip, Direction::S, 11).unwrap().slots[0].visible);
}

#[test]
fn rotation_uses_documented_shortest_path_with_stable_half_turn() {
    let clip = motion(
        LoopMode::Once,
        vec![track(
            TrackProperty::RotationDeg,
            Interpolation::Linear,
            vec![key(0, 350.0), key(4, 10.0)],
        )],
    );
    let sample = AnimationSampler.sample(&clip, Direction::S, 2).unwrap();
    assert_eq!(sample.slots[0].rotation_deg, 360.0);
}

#[test]
fn mirrored_direction_reads_the_source_and_reports_parity() {
    let mut clip = motion(
        LoopMode::Loop,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Linear,
            vec![key(0, 1.0)],
        )],
    );
    let west = clip
        .directions
        .iter_mut()
        .find(|item| item.direction == Direction::W)
        .unwrap();
    west.mode = DirectionMode::Mirrored;
    west.source = Some(Direction::S);
    let sample = AnimationSampler.sample(&clip, Direction::W, 0).unwrap();
    assert_eq!(sample.source_direction, Direction::S);
    assert!(sample.mirror_parity);
    assert_eq!(sample.slots[0].offset_x_px, 1.0);
}

#[test]
fn retiming_previews_loss_and_requires_explicit_truncation() {
    let clip = motion(
        LoopMode::Loop,
        vec![track(
            TrackProperty::OffsetXPx,
            Interpolation::Linear,
            vec![key(0, 0.0), key(6, 1.0), key(11, 2.0)],
        )],
    );
    let sampler = AnimationSampler;
    let preview = sampler.preview_retime(&clip, 7).unwrap();
    assert_eq!(preview.affected_keys.len(), 1);
    assert!(matches!(
        sampler.apply_retime(&clip, 7, false),
        Err(SampleError::RetimeConfirmationRequired {
            affected_keys: 1,
            ..
        })
    ));
    let shorter = sampler.apply_retime(&clip, 7, true).unwrap();
    assert_eq!(shorter.frame_count, 7);
    assert_eq!(shorter.tracks[0].keys.len(), 2);
    let extended = sampler.apply_retime(&clip, 20, false).unwrap();
    assert_eq!(extended.tracks[0].keys.len(), 3);
}

#[test]
fn duplicate_track_channels_are_rejected_by_the_domain() {
    let repeated = track(
        TrackProperty::OffsetXPx,
        Interpolation::Linear,
        vec![key(0, 0.0)],
    );
    let clip = motion(LoopMode::Loop, vec![repeated.clone(), repeated]);
    assert!(clip.validate(None).is_err());
}
