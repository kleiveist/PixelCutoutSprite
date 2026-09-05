use std::collections::HashMap;

use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::directions::*;
use pixel_cutout_sprite_studio_lib::domain::*;
use pixel_cutout_sprite_studio_lib::render::{
    PixelCompositor, RenderPart, RenderRequest, RenderTransform,
};

fn profile() -> ProfileRevision {
    serde_json::from_slice(include_bytes!(
        "fixtures/contracts/valid/profile-revision.json"
    ))
    .unwrap()
}

fn motion() -> MotionRevision {
    serde_json::from_slice(include_bytes!(
        "fixtures/contracts/valid/motion-revision.json"
    ))
    .unwrap()
}

fn asset() -> AssetRevision {
    serde_json::from_slice(include_bytes!(
        "fixtures/contracts/valid/asset-revision.json"
    ))
    .unwrap()
}

fn slot(value: &str) -> SlotId {
    SlotId::parse(value).unwrap()
}

fn sampled_pose(direction: Direction) -> DirectionalPose {
    DirectionalPose {
        direction,
        slots: vec![
            SampledSlot {
                slot_id: slot("torso_lower"),
                motion: RenderTransform::IDENTITY,
                visible: true,
                sprite_variant: None,
                layer_delta: 0,
            },
            SampledSlot {
                slot_id: slot("hand_l"),
                motion: RenderTransform::new(-2.0, 1.0, -15.0).unwrap(),
                visible: false,
                sprite_variant: Some("open".to_owned()),
                layer_delta: 0,
            },
            SampledSlot {
                slot_id: slot("hand_r"),
                motion: RenderTransform::new(4.0, 3.0, 30.0).unwrap(),
                visible: true,
                sprite_variant: Some("closed".to_owned()),
                layer_delta: 0,
            },
        ],
    }
}

fn definition_mut(motion: &mut MotionRevision, direction: Direction) -> &mut DirectionDefinition {
    motion
        .directions
        .iter_mut()
        .find(|definition| definition.direction == direction)
        .unwrap()
}

fn direction_key(direction: Direction) -> &'static str {
    match direction {
        Direction::N => "n",
        Direction::Ne => "ne",
        Direction::E => "e",
        Direction::Se => "se",
        Direction::S => "s",
        Direction::Sw => "sw",
        Direction::W => "w",
        Direction::Nw => "nw",
    }
}

#[test]
fn five_sources_resolve_all_eight_and_eight_explicit_views_are_allowed() {
    let profile = profile();
    let mut motion = motion();
    let resolver = DirectionResolver::new(&motion, &profile).unwrap();
    let expected = [
        (Direction::N, Direction::N, false),
        (Direction::Ne, Direction::Ne, false),
        (Direction::E, Direction::E, false),
        (Direction::Se, Direction::Se, false),
        (Direction::S, Direction::S, false),
        (Direction::Sw, Direction::Se, true),
        (Direction::W, Direction::E, true),
        (Direction::Nw, Direction::Ne, true),
    ];
    for (target, source, mirrored) in expected {
        let resolved = resolver.resolve(target).unwrap();
        assert_eq!(resolved.source, source);
        assert_eq!(resolved.pose_mirrored, mirrored);
    }

    for definition in &mut motion.directions {
        definition.mode = DirectionMode::Explicit;
        definition.source = None;
    }
    let explicit = DirectionResolver::new(&motion, &profile).unwrap();
    for direction in Direction::ALL {
        assert_eq!(explicit.resolve(direction).unwrap().source, direction);
    }
}

#[test]
fn cycles_and_front_back_or_non_horizontal_sources_are_rejected() {
    let profile = profile();
    let mut cycle = motion();
    let east = definition_mut(&mut cycle, Direction::E);
    east.mode = DirectionMode::Mirrored;
    east.source = Some(Direction::W);
    assert!(matches!(
        DirectionResolver::new(&cycle, &profile),
        Err(DirectionError::MirrorCycle { .. })
    ));

    let mut front_back = motion();
    let north = definition_mut(&mut front_back, Direction::N);
    north.mode = DirectionMode::Mirrored;
    north.source = Some(Direction::S);
    assert_eq!(
        DirectionResolver::new(&front_back, &profile).unwrap_err(),
        DirectionError::FrontBackMirror(Direction::N)
    );

    let mut diagonal = motion();
    definition_mut(&mut diagonal, Direction::W).source = Some(Direction::Ne);
    assert!(matches!(
        DirectionResolver::new(&diagonal, &profile),
        Err(DirectionError::InvalidHorizontalMirror {
            target: Direction::W,
            source_direction: Direction::Ne,
            expected: Direction::E,
        })
    ));
}

#[test]
fn mirrored_pose_uses_anatomical_pairs_but_target_view_and_target_layers() {
    let profile = profile();
    let motion = motion();
    let resolver = DirectionResolver::new(&motion, &profile).unwrap();
    let resolved = resolver
        .resolve_pose(Direction::W, &sampled_pose(Direction::E))
        .unwrap();

    assert_eq!(resolved.source_direction, Direction::E);
    assert!(resolved.pose_mirrored);
    assert_eq!(
        resolved
            .slots
            .iter()
            .map(|part| part.slot_id.as_str())
            .collect::<Vec<_>>(),
        vec!["hand_r", "torso_lower", "hand_l"]
    );
    let left = resolved
        .slots
        .iter()
        .find(|part| part.slot_id == slot("hand_l"))
        .unwrap();
    assert_eq!(left.profile.offset_x, -5.0, "W profile view must win");
    assert_eq!(left.motion.offset_x, -4.0);
    assert_eq!(left.motion.offset_y, 3.0);
    assert_eq!(left.motion.rotation_deg, -30.0);
    assert!(left.visible);
    assert_eq!(left.sprite_variant.as_deref(), Some("closed"));

    let right = resolved
        .slots
        .iter()
        .find(|part| part.slot_id == slot("hand_r"))
        .unwrap();
    assert!(
        !right.visible,
        "hidden is preserved rather than treated as missing"
    );
    assert_eq!(right.motion.offset_x, 2.0);
    assert_eq!(right.motion.rotation_deg, 15.0);

    let left_id = slot("hand_l");
    assert_eq!(
        resolver.mirror_slot(&resolver.mirror_slot(&left_id)),
        left_id
    );
}

#[test]
fn discrete_layer_deltas_reorder_parts_with_target_order_as_the_stable_tie_breaker() {
    let profile = profile();
    let motion = motion();
    let resolver = DirectionResolver::new(&motion, &profile).unwrap();
    let mut pose = sampled_pose(Direction::E);
    pose.slots
        .iter_mut()
        .find(|part| part.slot_id == slot("hand_l"))
        .unwrap()
        .layer_delta = 2;
    pose.slots
        .iter_mut()
        .find(|part| part.slot_id == slot("hand_r"))
        .unwrap()
        .layer_delta = -1;

    let resolved = resolver.resolve_pose(Direction::W, &pose).unwrap();
    assert_eq!(
        resolved
            .slots
            .iter()
            .map(|part| (part.slot_id.as_str(), part.layer))
            .collect::<Vec<_>>(),
        vec![("torso_lower", 1), ("hand_l", 1), ("hand_r", 2)]
    );
}

#[test]
fn a_missing_pose_part_is_not_confused_with_a_hidden_part() {
    let profile = profile();
    let motion = motion();
    let resolver = DirectionResolver::new(&motion, &profile).unwrap();
    let mut pose = sampled_pose(Direction::E);
    pose.slots.retain(|part| part.slot_id != slot("hand_l"));
    assert_eq!(
        resolver.resolve_pose(Direction::W, &pose).unwrap_err(),
        DirectionError::MissingPoseSlot(slot("hand_l"))
    );
}

#[test]
fn asset_resolution_keeps_the_target_hand_and_requires_confirmed_safe_mirroring() {
    let profile = profile();
    let motion = motion();
    let resolver = DirectionResolver::new(&motion, &profile).unwrap();
    let direction = resolver.resolve(Direction::Sw).unwrap();
    let mut source = asset();
    source.direction = Direction::Se;
    source.pivot_px = PixelPoint(2, 2);
    let target_slot = slot("hand_l");

    let strict_candidates = [source.clone()];
    let strict = AssetResolver::new(profile.reference(), &strict_candidates, &[]).unwrap();
    assert!(matches!(
        strict.resolve(direction, &target_slot, "default"),
        Err(DirectionError::UnapprovedAssetFallback {
            slot_id,
            direction: Direction::Sw,
            source_direction: Direction::Se,
        }) if slot_id == target_slot
    ));

    let approval = AssetFallbackApproval {
        slot_id: target_slot.clone(),
        target_direction: Direction::Sw,
        source_direction: Direction::Se,
        variant: "default".to_owned(),
    };
    let approvals = [approval];
    let candidates = [source.clone()];
    let approved = AssetResolver::new(profile.reference(), &candidates, &approvals).unwrap();
    let result = approved
        .resolve(direction, &target_slot, "default")
        .unwrap();
    assert_eq!(result.target_slot, target_slot);
    assert_eq!(
        result.origin,
        AssetOrigin::Mirrored {
            source: Direction::Se
        }
    );
    assert!(result.bitmap_mirrored);
    assert_eq!(result.pivot_px, (6.0, 2.0));

    source.sprite_mirroring_allowed = false;
    let candidates = [source];
    let blocked = AssetResolver::new(profile.reference(), &candidates, &approvals).unwrap();
    assert!(matches!(
        blocked.resolve(direction, &slot("hand_l"), "default"),
        Err(DirectionError::NonMirrorableAsset { .. })
    ));
}

#[test]
fn exact_target_asset_wins_without_pose_or_whole_frame_mirror_leaking_into_it() {
    let profile = profile();
    let motion = motion();
    let directions = DirectionResolver::new(&motion, &profile).unwrap();
    let resolution = directions.resolve(Direction::W).unwrap();
    assert!(resolution.pose_mirrored);

    let mut source = asset();
    source.direction = Direction::E;
    let mut exact = source.clone();
    exact.asset_id = ObjectId::new();
    exact.direction = Direction::W;
    exact.source_file = RelativePath::parse("assets/glove-w.png").unwrap();
    exact.sprite_mirroring_allowed = false;
    let candidates = [source, exact];
    let assets = AssetResolver::new(profile.reference(), &candidates, &[]).unwrap();
    let resolved = assets
        .resolve(resolution, &slot("hand_l"), "default")
        .unwrap();
    assert_eq!(resolved.origin, AssetOrigin::Exact);
    assert!(!resolved.bitmap_mirrored);
}

#[test]
fn wrong_hand_assets_are_never_used_as_anatomical_fallbacks() {
    let profile = profile();
    let motion = motion();
    let directions = DirectionResolver::new(&motion, &profile).unwrap();
    let resolution = directions.resolve(Direction::W).unwrap();
    let mut wrong_hand = asset();
    wrong_hand.direction = Direction::E;
    wrong_hand.slot_id = slot("hand_r");
    let approval = AssetFallbackApproval {
        slot_id: slot("hand_l"),
        target_direction: Direction::W,
        source_direction: Direction::E,
        variant: "default".to_owned(),
    };
    let candidates = [wrong_hand];
    let approvals = [approval];
    let assets = AssetResolver::new(profile.reference(), &candidates, &approvals).unwrap();
    assert!(matches!(
        assets.resolve(resolution, &slot("hand_l"), "default"),
        Err(DirectionError::MissingAsset { slot_id, .. }) if slot_id == slot("hand_l")
    ));
}

#[test]
fn detach_creates_editable_mirrored_tracks_as_one_atomic_result() {
    let profile = profile();
    let mut motion = motion();
    motion.tracks = vec![
        MotionTrack {
            direction: Direction::E,
            slot_id: slot("hand_l"),
            property: TrackProperty::OffsetXPx,
            interpolation: Interpolation::Linear,
            keys: vec![Keyframe {
                frame: 0,
                value: TrackValue::Number(3.0),
            }],
        },
        MotionTrack {
            direction: Direction::E,
            slot_id: slot("hand_l"),
            property: TrackProperty::RotationDeg,
            interpolation: Interpolation::Linear,
            keys: vec![Keyframe {
                frame: 0,
                value: TrackValue::Number(40.0),
            }],
        },
        MotionTrack {
            direction: Direction::W,
            slot_id: slot("hand_l"),
            property: TrackProperty::Visible,
            interpolation: Interpolation::Hold,
            keys: vec![Keyframe {
                frame: 0,
                value: TrackValue::Boolean(false),
            }],
        },
    ];

    let detached = detach_to_explicit(&motion, &profile, Direction::W).unwrap();
    assert_eq!(detached.source_direction, Direction::E);
    assert_eq!(detached.copied_track_count, 2);
    assert_eq!(detached.replaced_track_count, 1);
    let definition = detached
        .definitions
        .iter()
        .find(|definition| definition.direction == Direction::W)
        .unwrap();
    assert_eq!(definition.mode, DirectionMode::Explicit);
    assert_eq!(definition.source, None);
    let target_tracks = detached
        .tracks
        .iter()
        .filter(|track| track.direction == Direction::W)
        .collect::<Vec<_>>();
    assert_eq!(target_tracks.len(), 2);
    assert!(target_tracks
        .iter()
        .all(|track| track.slot_id == slot("hand_r")));
    assert_eq!(target_tracks[0].keys[0].value, TrackValue::Number(-3.0));
    assert_eq!(target_tracks[1].keys[0].value, TrackValue::Number(-40.0));
}

#[test]
fn release_coverage_blocks_missing_and_nonmirrorable_data_but_accepts_hidden_parts() {
    let profile = profile();
    let mut incomplete = motion();
    let west = definition_mut(&mut incomplete, Direction::W);
    west.mode = DirectionMode::Missing;
    west.source = None;
    let directions = DirectionResolver::new(&incomplete, &profile).unwrap();
    let assets = AssetResolver::new(profile.reference(), &[], &[]).unwrap();
    let report = check_release_coverage(&directions, &assets, &[]);
    assert!(!report.can_release());
    assert_eq!(report.directions.len(), 8);
    assert!(report.directions.iter().any(|entry| {
        entry.direction == Direction::W && entry.state == DirectionCoverageState::Missing
    }));

    let complete_motion = motion();
    let directions = DirectionResolver::new(&complete_motion, &profile).unwrap();
    let hidden = AssetNeed {
        slot_id: slot("hand_l"),
        direction: Direction::W,
        variant: "default".to_owned(),
        visibility: RequiredPartVisibility::Hidden,
    };
    let hidden_report = check_release_coverage(&directions, &assets, &[hidden]);
    assert!(hidden_report.can_release());
    assert_eq!(hidden_report.assets[0].state, AssetCoverageState::Hidden);

    let visible = AssetNeed {
        visibility: RequiredPartVisibility::Visible,
        ..hidden_report.assets[0].need.clone()
    };
    let visible_report = check_release_coverage(&directions, &assets, &[visible]);
    assert!(!visible_report.can_release());
    assert_eq!(visible_report.assets[0].state, AssetCoverageState::Blocked);

    let mut nonmirrorable = asset();
    nonmirrorable.direction = Direction::E;
    nonmirrorable.sprite_mirroring_allowed = false;
    let approval = AssetFallbackApproval {
        slot_id: slot("hand_l"),
        target_direction: Direction::W,
        source_direction: Direction::E,
        variant: "default".to_owned(),
    };
    let candidates = [nonmirrorable];
    let approvals = [approval];
    let assets = AssetResolver::new(profile.reference(), &candidates, &approvals).unwrap();
    let nonmirrorable_report = check_release_coverage(
        &directions,
        &assets,
        &[AssetNeed {
            slot_id: slot("hand_l"),
            direction: Direction::W,
            variant: "default".to_owned(),
            visibility: RequiredPartVisibility::Visible,
        }],
    );
    assert!(!nonmirrorable_report.can_release());
    assert!(nonmirrorable_report.issues[0]
        .message
        .contains("cannot be mirrored"));
}

fn golden_profile() -> ProfileRevision {
    let mut profile = profile();
    for body_slot in &mut profile.slots {
        body_slot.parent_id = None;
    }
    for view in &mut profile.views {
        for transform in &mut view.base_transforms {
            transform.transform = Transform2D {
                offset_px: if transform.slot_id == slot("hand_l") {
                    PixelPoint(2, 0)
                } else if transform.slot_id == slot("hand_r") {
                    PixelPoint(4, 0)
                } else {
                    PixelPoint(0, 0)
                },
                rotation_deg: 0.0,
            };
        }
    }
    profile
}

fn glove_asset_candidates() -> Vec<AssetRevision> {
    let mut source_asset = asset();
    source_asset.slot_id = slot("hand_l");
    source_asset.image_size_px = PixelSize(2, 1);
    source_asset.pivot_px = PixelPoint(1, 0);
    source_asset.sprite_mirroring_allowed = true;
    let mut candidates = Vec::new();
    for direction in [
        Direction::N,
        Direction::Ne,
        Direction::E,
        Direction::Se,
        Direction::S,
    ] {
        let mut candidate = source_asset.clone();
        candidate.asset_id = ObjectId::new();
        candidate.direction = direction;
        candidate.source_file =
            RelativePath::parse(format!("assets/glove-{}.png", direction_key(direction))).unwrap();
        candidates.push(candidate);
    }
    candidates
}

fn glove_approvals() -> Vec<AssetFallbackApproval> {
    [
        (Direction::Sw, Direction::Se),
        (Direction::W, Direction::E),
        (Direction::Nw, Direction::Ne),
    ]
    .into_iter()
    .map(
        |(target_direction, source_direction)| AssetFallbackApproval {
            slot_id: slot("hand_l"),
            target_direction,
            source_direction,
            variant: "default".to_owned(),
        },
    )
    .collect()
}

fn glove_pose(direction: Direction) -> DirectionalPose {
    DirectionalPose {
        direction,
        slots: vec![
            SampledSlot {
                slot_id: slot("torso_lower"),
                motion: RenderTransform::IDENTITY,
                visible: false,
                sprite_variant: None,
                layer_delta: 0,
            },
            SampledSlot {
                slot_id: slot("hand_l"),
                motion: RenderTransform::IDENTITY,
                visible: true,
                sprite_variant: Some("default".to_owned()),
                layer_delta: 0,
            },
            SampledSlot {
                slot_id: slot("hand_r"),
                motion: RenderTransform::new(1.0, 0.0, 0.0).unwrap(),
                visible: true,
                sprite_variant: Some("default".to_owned()),
                layer_delta: 0,
            },
        ],
    }
}

fn glove_bitmap() -> RgbaImage {
    RgbaImage::from_fn(2, 1, |x, _| {
        if x == 0 {
            Rgba([255, 0, 0, 255])
        } else {
            Rgba([0, 0, 255, 255])
        }
    })
}

fn render_glove(
    target: Direction,
    directions: &DirectionResolver<'_>,
    assets: &AssetResolver<'_>,
) -> String {
    let resolution = directions.resolve(target).unwrap();
    let pose = directions
        .resolve_pose(target, &glove_pose(resolution.source))
        .unwrap();
    let hand = pose
        .slots
        .iter()
        .find(|part| part.slot_id == slot("hand_l"))
        .unwrap();
    let chosen = assets
        .resolve(resolution, &hand.slot_id, "default")
        .unwrap();
    let rendered = PixelCompositor
        .render(&RenderRequest {
            direction: target,
            frame_size_px: PixelSize(4, 1),
            ground_origin_px: PixelPoint(0, 0),
            parts: vec![RenderPart {
                slot_id: hand.slot_id.clone(),
                parent_id: None,
                profile: hand.profile,
                motion: hand.motion,
                fitting: RenderTransform::IDENTITY,
                local_override: RenderTransform::IDENTITY,
                pivot_px: chosen.pivot_px,
                visible: hand.visible,
                layer: hand.layer,
                mirror_bitmap_x: chosen.bitmap_mirrored,
                bitmap: glove_bitmap().into(),
            }],
        })
        .unwrap();
    rendered
        .image
        .as_raw()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[test]
fn asymmetric_left_glove_matches_all_eight_rgba_goldens() {
    let profile = golden_profile();
    let motion = motion();
    let directions = DirectionResolver::new(&motion, &profile).unwrap();
    let candidates = glove_asset_candidates();
    let approvals = glove_approvals();
    let assets = AssetResolver::new(profile.reference(), &candidates, &approvals).unwrap();
    let golden: HashMap<String, String> = serde_json::from_str(include_str!(
        "fixtures/directions/asymmetric-glove-rgba.json"
    ))
    .unwrap();

    for target in Direction::ALL {
        assert_eq!(
            render_glove(target, &directions, &assets),
            golden[direction_key(target)],
            "{target:?}"
        );
    }
}
