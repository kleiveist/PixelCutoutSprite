use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::animation::{
    bake_helper_channel, build_preset, configure_preset_timing, preview_fingerprint,
    set_external_jump_height, AnimationSampler, JumpHeightMode, MotionPreset, PresetContext,
    PresetKind, PreviewCache, PreviewCacheKey, RootMotionMode,
};
use pixel_cutout_sprite_studio_lib::domain::{
    Direction, HumanoidProfileGenerator, ObjectId, PixelPoint, PixelSize, ProfileRevision,
    RevisionRef, UtcTimestamp,
};
use pixel_cutout_sprite_studio_lib::editor::{
    compile_sampled_dummy, encode_dummy_preview, render_sampled_dummy,
};
use pixel_cutout_sprite_studio_lib::render::RenderedFrame;

fn context() -> PresetContext {
    PresetContext {
        template_id: ObjectId::new(),
        profile_ref: RevisionRef {
            id: ObjectId::new(),
            revision: 1,
        },
        published_at: UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
        frame_size_px: PixelSize(128, 128),
        ground_origin_px: PixelPoint(64, 108),
    }
}

fn preset(kind: PresetKind) -> MotionPreset {
    build_preset(kind, &context())
}

fn humanoid(profile_ref: RevisionRef) -> ProfileRevision {
    HumanoidProfileGenerator::generate(
        profile_ref.id,
        ObjectId::new(),
        profile_ref.revision,
        "Humanoid 80px".to_owned(),
        80,
        UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
    )
    .unwrap()
}

#[test]
fn every_bundled_preset_is_editable_valid_and_covers_eight_directions() {
    for kind in PresetKind::ALL {
        let preset = preset(kind);
        assert_eq!(preset.root_motion, RootMotionMode::InPlace);
        assert_eq!(preset.motion.directions.len(), 8);
        assert_eq!(preset.motion.tracks.len(), 5);
        preset.motion.validate(None).unwrap();
        for direction in Direction::ALL {
            AnimationSampler
                .sample(&preset.motion, direction, 0)
                .unwrap();
        }
    }
}

#[test]
fn walk_and_sprint_have_distinct_timing_pose_and_speed_metadata() {
    let walk = preset(PresetKind::Walk);
    let sprint = preset(PresetKind::Sprint);
    assert_ne!(
        (walk.motion.frame_count, walk.motion.fps),
        (sprint.motion.frame_count, sprint.motion.fps)
    );
    assert_ne!(walk.motion.tracks[0].keys, sprint.motion.tracks[0].keys);
    assert!(sprint.recommended_speed_px_per_second > walk.recommended_speed_px_per_second);
    let fast_sprint = configure_preset_timing(sprint.clone(), 8, 24, sprint.motion.loop_mode);
    assert_eq!(fast_sprint.motion.fps, 24);
    assert_eq!(fast_sprint.motion.tracks, sprint.motion.tracks);
    assert_eq!(fast_sprint.motion.semantics, sprint.motion.semantics);
    fast_sprint.motion.validate(None).unwrap();
}

#[test]
fn jump_mode_never_moves_the_ground_anchor_and_external_mode_removes_body_height() {
    let mut jump = preset(PresetKind::Jump);
    let anchor = jump.motion.ground_origin_px;
    assert_eq!(jump.jump_height_mode, JumpHeightMode::BakedIntoFrames);
    let airborne = AnimationSampler
        .sample(&jump.motion, Direction::S, 6)
        .unwrap();
    assert!(
        airborne
            .slots
            .iter()
            .find(|slot| slot.slot_id.as_str() == "torso_lower")
            .unwrap()
            .offset_y_px
            < 0.0
    );
    set_external_jump_height(&mut jump);
    assert_eq!(jump.jump_height_mode, JumpHeightMode::ExternalGameMotion);
    assert!(jump
        .motion
        .semantics
        .as_ref()
        .unwrap()
        .helpers
        .iter()
        .any(|helper| helper.kind
            == pixel_cutout_sprite_studio_lib::animation::HelperKind::JumpHeight
            && !helper.enabled));
    assert_eq!(jump.motion.ground_origin_px, anchor);
}

#[test]
fn bundled_jump_stays_inside_the_frame_and_its_shadow_stays_on_the_ground() {
    let jump = preset(PresetKind::Jump).motion;
    let profile = humanoid(jump.profile_ref);
    let grounded = compile_sampled_dummy(&profile, &jump, Direction::S, 0).unwrap();
    let apex = compile_sampled_dummy(&profile, &jump, Direction::S, 6).unwrap();
    for direction in Direction::ALL {
        for frame in 0..jump.frame_count {
            assert!(
                compile_sampled_dummy(&profile, &jump, direction, frame)
                    .unwrap()
                    .frame
                    .clipping
                    .is_empty(),
                "bundled jump clipped at {direction:?} frame {frame}"
            );
        }
    }
    let shadow_sample = (
        u32::try_from(i32::from(jump.ground_origin_px.0) - 12).unwrap(),
        u32::try_from(i32::from(jump.ground_origin_px.1) - 1).unwrap(),
    );
    assert_ne!(
        grounded
            .frame
            .image
            .get_pixel(shadow_sample.0, shadow_sample.1)[3],
        0
    );
    assert_eq!(
        grounded
            .frame
            .image
            .get_pixel(shadow_sample.0, shadow_sample.1),
        apex.frame.image.get_pixel(shadow_sample.0, shadow_sample.1)
    );
}

#[test]
fn visible_helpers_bake_to_their_exact_deterministic_samples() {
    let walk = preset(PresetKind::Walk);
    let helper = &walk.helpers[0];
    let baked = helper.bake(Direction::S, walk.motion.frame_count);
    for key in baked.keys {
        let pixel_cutout_sprite_studio_lib::domain::TrackValue::Number(value) = key.value else {
            panic!("helper must bake numeric values");
        };
        assert_eq!(value, helper.sample(key.frame, walk.motion.frame_count));
    }
}

#[test]
fn converting_a_helper_to_keys_preserves_every_sample() {
    let walk = preset(PresetKind::Walk).motion;
    let baked = bake_helper_channel(&walk, 0).unwrap();
    assert!(baked.semantics.as_ref().unwrap().helpers.is_empty());
    for direction in Direction::ALL {
        for frame in 0..walk.frame_count {
            assert_eq!(
                AnimationSampler.sample(&walk, direction, frame).unwrap(),
                AnimationSampler.sample(&baked, direction, frame).unwrap()
            );
        }
    }
}

#[test]
fn preview_fingerprint_ignores_timestamp_but_changes_for_effective_data() {
    let original = preset(PresetKind::Idle).motion;
    let mut timestamp_only = original.clone();
    timestamp_only.published_at = UtcTimestamp::parse("2026-09-06T10:00:00Z").unwrap();
    assert_eq!(
        preview_fingerprint(&original).unwrap(),
        preview_fingerprint(&timestamp_only).unwrap()
    );
    timestamp_only.fps += 1;
    assert_ne!(
        preview_fingerprint(&original).unwrap(),
        preview_fingerprint(&timestamp_only).unwrap()
    );
    let mut shadow_change = original.clone();
    shadow_change
        .semantics
        .as_mut()
        .unwrap()
        .ground_shadow
        .as_mut()
        .unwrap()
        .enabled = false;
    assert_ne!(
        preview_fingerprint(&original).unwrap(),
        preview_fingerprint(&shadow_change).unwrap()
    );
}

#[test]
fn cached_card_frame_and_editor_preview_encode_the_same_pixels() {
    let motion = preset(PresetKind::Idle).motion;
    let profile = humanoid(motion.profile_ref);
    let compiled = compile_sampled_dummy(&profile, &motion, Direction::S, 3).unwrap();
    let card_frame = encode_dummy_preview(compiled.frame).unwrap();
    let editor_frame = render_sampled_dummy(&profile, &motion, Direction::S, 3).unwrap();
    assert_eq!(card_frame.data_url, editor_frame.data_url);
    assert_eq!(card_frame.clipping, editor_frame.clipping);
}

#[test]
fn byte_limited_lru_releases_the_least_recently_used_images() {
    let motion = preset(PresetKind::Idle).motion;
    let key = |frame| PreviewCacheKey::for_motion(&motion, Direction::S, frame, "dummy").unwrap();
    let image = || RenderedFrame {
        image: RgbaImage::from_pixel(2, 2, Rgba([1, 2, 3, 255])),
        clipping: Vec::new(),
    };
    let mut cache = PreviewCache::new(32);
    cache.insert(key(0), image());
    cache.insert(key(1), image());
    assert!(cache.get(&key(0)).is_some());
    cache.insert(key(2), image());
    assert_eq!(cache.len(), 2);
    assert!(cache.get(&key(1)).is_none());
    assert!(cache.get(&key(0)).is_some());
    assert!(cache.used_bytes() <= 32);
}
