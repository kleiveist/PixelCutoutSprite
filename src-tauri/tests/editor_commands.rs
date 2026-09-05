use std::collections::HashMap;

use pixel_cutout_sprite_studio_lib::domain::{
    Direction, DirectionDefinition, DirectionMode, DirectionView, DocumentKind, Interpolation,
    Keyframe, LoopMode, MirrorPair, MotionRevision, MotionTrack, ObjectId, PixelPoint, PixelSize,
    ProfileRevision, SlotDefinition, SlotId, TrackProperty, TrackValue, Transform2D, UtcTimestamp,
    ViewTransform,
};
use pixel_cutout_sprite_studio_lib::editor::{
    encode_dummy_preview, render_dummy, render_sampled_dummy, CommandHistory, PoseTransform,
};

fn slot(value: &str) -> SlotId {
    SlotId::parse(value).unwrap()
}

fn transform(x: i16, y: i16, rotation_deg: f32) -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(x, y),
        rotation_deg,
    }
}

fn profile() -> ProfileRevision {
    let parent = SlotDefinition {
        id: slot("torso"),
        parent_id: None,
        optional: false,
        size_px: PixelSize(4, 4),
        pivot_px: PixelPoint(0, 0),
        base_transform: transform(0, -4, 0.0),
    };
    let child = SlotDefinition {
        id: slot("hand"),
        parent_id: Some(slot("torso")),
        optional: false,
        size_px: PixelSize(2, 2),
        pivot_px: PixelPoint(0, 0),
        base_transform: transform(4, 0, 0.0),
    };
    let views = Direction::ALL
        .into_iter()
        .map(|direction| DirectionView {
            direction,
            layer_order: vec![slot("torso"), slot("hand")],
            base_transforms: vec![
                ViewTransform {
                    slot_id: slot("torso"),
                    transform: parent.base_transform,
                },
                ViewTransform {
                    slot_id: slot("hand"),
                    transform: child.base_transform,
                },
            ],
        })
        .collect();
    ProfileRevision {
        schema_version: 1,
        kind: DocumentKind::ProfileRevision,
        profile_id: ObjectId::new(),
        revision: 1,
        area_id: ObjectId::new(),
        name: "Test profile".to_owned(),
        reference_height_px: 80,
        slots: vec![parent, child],
        views,
        mirror_pairs: vec![MirrorPair {
            left: slot("torso"),
            right: slot("hand"),
        }],
        published_at: UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
    }
}

#[test]
fn a_completed_drag_is_one_undo_action_and_redo_restores_it() {
    let initial = HashMap::<SlotId, PoseTransform>::new();
    let mut history = CommandHistory::new(initial.clone());
    let mut preview = initial;
    preview.insert(
        slot("hand"),
        PoseTransform {
            offset_x_px: 1.0,
            ..PoseTransform::default()
        },
    );
    preview.get_mut(&slot("hand")).unwrap().offset_x_px = 7.0;
    assert!(history.commit("Move hand", preview.clone()));
    assert!(history.can_undo());
    assert_eq!(history.undo(), Some(&HashMap::new()));
    assert!(!history.can_undo());
    assert!(history.can_redo());
    assert_eq!(history.redo(), Some(&preview));
}

#[test]
fn child_parts_follow_parent_motion_through_the_reference_compositor() {
    let profile = profile();
    let baseline = render_dummy(
        &profile,
        &HashMap::new(),
        Direction::S,
        PixelSize(24, 24),
        PixelPoint(8, 12),
    )
    .unwrap();
    let mut moved = HashMap::new();
    moved.insert(
        slot("torso"),
        PoseTransform {
            offset_x_px: 3.0,
            ..PoseTransform::default()
        },
    );
    let shifted = render_dummy(
        &profile,
        &moved,
        Direction::S,
        PixelSize(24, 24),
        PixelPoint(8, 12),
    )
    .unwrap();
    assert_ne!(baseline.image.as_raw(), shifted.image.as_raw());
    assert_eq!(baseline.image.get_pixel(12, 8)[3], 255);
    assert_eq!(shifted.image.get_pixel(15, 8)[3], 255);
}

#[test]
fn editor_helpers_are_not_part_of_the_render_contract() {
    let profile = profile();
    let first = render_dummy(
        &profile,
        &HashMap::new(),
        Direction::S,
        PixelSize(24, 24),
        PixelPoint(8, 12),
    )
    .unwrap();
    // Grid, selection handles, names and focus live only in the frontend overlay. Rendering again
    // with identical source data therefore has byte-identical output.
    let second = render_dummy(
        &profile,
        &HashMap::new(),
        Direction::S,
        PixelSize(24, 24),
        PixelPoint(8, 12),
    )
    .unwrap();
    assert_eq!(first.image.as_raw(), second.image.as_raw());
}

#[test]
fn compositor_preview_is_a_decodable_png_data_url() {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

    let rendered = render_dummy(
        &profile(),
        &HashMap::new(),
        Direction::S,
        PixelSize(24, 24),
        PixelPoint(8, 12),
    )
    .unwrap();
    let preview = encode_dummy_preview(rendered).unwrap();
    let encoded = preview
        .data_url
        .strip_prefix("data:image/png;base64,")
        .unwrap();
    let bytes = BASE64.decode(encoded).unwrap();
    let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).unwrap();
    assert_eq!((image.width(), image.height()), (24, 24));
}

#[test]
fn sampled_preview_uses_the_pure_sampler_pose_and_is_repeatable() {
    let profile = profile();
    let mut motion = MotionRevision {
        schema_version: 1,
        kind: DocumentKind::MotionRevision,
        template_id: ObjectId::new(),
        revision: 1,
        profile_ref: profile.reference(),
        frame_size_px: PixelSize(24, 24),
        ground_origin_px: PixelPoint(8, 12),
        frame_count: 12,
        fps: 12,
        loop_mode: LoopMode::Loop,
        directions: Direction::ALL
            .into_iter()
            .map(|direction| DirectionDefinition {
                direction,
                mode: DirectionMode::Explicit,
                source: None,
            })
            .collect(),
        tracks: vec![MotionTrack {
            direction: Direction::S,
            slot_id: slot("hand"),
            property: TrackProperty::OffsetXPx,
            interpolation: Interpolation::Linear,
            keys: vec![
                Keyframe {
                    frame: 0,
                    value: TrackValue::Number(0.0),
                },
                Keyframe {
                    frame: 6,
                    value: TrackValue::Number(6.0),
                },
            ],
        }],
        semantics: None,
        published_at: UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
    };
    let first = render_sampled_dummy(&profile, &motion, Direction::S, 3).unwrap();
    let second = render_sampled_dummy(&profile, &motion, Direction::S, 3).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.pose[&slot("hand")].offset_x_px, 3.0);
    assert_eq!(first.sample_index, 3);

    let west = motion
        .directions
        .iter_mut()
        .find(|definition| definition.direction == Direction::W)
        .unwrap();
    west.mode = DirectionMode::Mirrored;
    west.source = Some(Direction::E);
    motion.tracks.push(MotionTrack {
        direction: Direction::E,
        slot_id: slot("torso"),
        property: TrackProperty::OffsetXPx,
        interpolation: Interpolation::Linear,
        keys: vec![Keyframe {
            frame: 0,
            value: TrackValue::Number(4.0),
        }],
    });
    let mirrored = render_sampled_dummy(&profile, &motion, Direction::W, 0).unwrap();
    assert_eq!(mirrored.source_direction, Direction::E);
    assert!(mirrored.mirror_parity);
    assert_eq!(mirrored.pose[&slot("hand")].offset_x_px, -4.0);
}
