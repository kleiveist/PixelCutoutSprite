mod support;

use std::fs;
use std::path::Path;

use pixel_cutout_sprite_studio_lib::domain::{
    ClippingPolicy, Direction, EffectiveSourceKind, ExportJumpMode, HelperKind, JumpHeightMode,
    MotionHelperChannel, MotionPresetKind, MotionSemantics, PixelPoint, PixelSize, RootMotionMode,
    SlotId, TrackProperty,
};
use pixel_cutout_sprite_studio_lib::exports::{
    motion_semantic_sha256, CurrentExport, ExportError, ExportProgress, ExportService, ExportStage,
    NeverCancel,
};
use pixel_cutout_sprite_studio_lib::storage::VaultRoot;
use tempfile::tempdir;

use support::{frame_color, request, FixtureSource, OUTPUT_DIRECTORY};

#[test]
fn complete_multi_action_export_is_ordered_validated_and_published_last() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let request = request(&[
        ("walk", PixelSize(2, 2), PixelPoint(0, 0)),
        ("sprint", PixelSize(2, 2), PixelPoint(0, 0)),
    ]);
    let mut source = FixtureSource::default();
    let mut progress = Vec::new();
    let outcome = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut source,
            &NeverCancel,
            &mut |update: ExportProgress| progress.push(update),
        )
        .unwrap();

    assert!(outcome.manifest.complete);
    assert_eq!(outcome.manifest.frames.len(), 32);
    assert_eq!(outcome.manifest.pages.len(), 2);
    assert_eq!(outcome.manifest.actions[0].action_key.as_str(), "sprint");
    assert_eq!(outcome.manifest.actions[1].action_key.as_str(), "walk");
    assert_eq!(outcome.manifest.frames[0].direction, Direction::N);
    assert_eq!(outcome.manifest.frames[0].sample_index, 0);
    assert_eq!(outcome.manifest.frames[2].direction, Direction::Ne);
    assert_eq!(outcome.manifest.frames[2].mirrored_from, Some(Direction::N));
    assert!(outcome
        .manifest
        .frames
        .iter()
        .all(|frame| frame.duration_ticks == 1 && frame.individual_file.is_none()));

    let export_root = temporary.path().join(OUTPUT_DIRECTORY);
    assert!(!export_root
        .join(outcome.build.as_str())
        .join("frames")
        .exists());
    let sheet = image::open(export_root.join(outcome.build.as_str()).join("sheet-0.png"))
        .unwrap()
        .into_rgba8();
    assert_eq!(
        sheet.get_pixel(0, 0).0,
        frame_color("sprint", Direction::N, 0, 0)
    );
    let current: CurrentExport =
        serde_json::from_slice(&fs::read(export_root.join("current.json")).unwrap()).unwrap();
    current.validate().unwrap();
    assert_eq!(current.build, outcome.build);
    assert_eq!(
        current.source_fingerprint,
        outcome.manifest.source_fingerprint
    );
    assert!(progress
        .iter()
        .any(|update| update.stage
            == pixel_cutout_sprite_studio_lib::exports::ExportStage::Publishing));
    let validated = service
        .current(Path::new(OUTPUT_DIRECTORY))
        .unwrap()
        .unwrap();
    assert_eq!(validated.current, current);
    assert_eq!(
        validated.manifest.source_fingerprint,
        current.source_fingerprint
    );
}

#[test]
fn fingerprint_tracks_semantic_sources_but_rejects_nondeterministic_pixels() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    let first = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let repeated = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert_eq!(
        first.manifest.source_fingerprint,
        repeated.manifest.source_fingerprint
    );
    assert_eq!(first.build, repeated.build);
    assert!(repeated.reused_existing_build);

    request.profile.name = "Renamed display profile".to_owned();
    request.actions[0].binding_ref.revision += 1;
    request.sources.bindings[0].revision += 1;
    request
        .effective_sources
        .iter_mut()
        .find(|source| source.kind == EffectiveSourceKind::Binding)
        .unwrap()
        .reference
        .revision += 1;
    request.actions[0].motion.published_at =
        pixel_cutout_sprite_studio_lib::domain::UtcTimestamp::parse("2026-09-05T12:00:00Z")
            .unwrap();
    assert_eq!(
        service.source_fingerprint(&request).unwrap(),
        first.manifest.source_fingerprint,
        "display names, mutable binding revisions, and publication timestamps are metadata",
    );
    let metadata_repeat = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(metadata_repeat.reused_existing_build);
    assert_eq!(metadata_repeat.build, first.build);

    request
        .effective_sources
        .iter_mut()
        .find(|source| source.kind == EffectiveSourceKind::Asset)
        .unwrap()
        .content_sha256 = pixel_cutout_sprite_studio_lib::domain::Sha256Digest::parse(
        "abababababababababababababababababababababababababababababababab",
    )
    .unwrap();
    let changed_source = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert_ne!(
        first.manifest.source_fingerprint,
        changed_source.manifest.source_fingerprint
    );

    let changed_pixels = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut FixtureSource {
            color_bias: 1,
            ..FixtureSource::default()
        },
        &NeverCancel,
        &mut |_| {},
    );
    assert!(matches!(
        changed_pixels,
        Err(pixel_cutout_sprite_studio_lib::exports::ExportError::InvalidBuild(message))
            if message.contains("different pixels")
    ));
}

#[test]
fn current_pointer_cas_preserves_an_external_publish_callback_update() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let original_request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &original_request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();

    let mut replacement_request = original_request.clone();
    replacement_request
        .effective_sources
        .iter_mut()
        .find(|source| source.kind == EffectiveSourceKind::Asset)
        .unwrap()
        .content_sha256 = pixel_cutout_sprite_studio_lib::domain::Sha256Digest::parse(
        "abababababababababababababababababababababababababababababababab",
    )
    .unwrap();
    let replacement = service
        .build_without_current(
            Path::new(OUTPUT_DIRECTORY),
            &replacement_request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();

    let mut external_request = original_request;
    external_request
        .effective_sources
        .iter_mut()
        .find(|source| source.kind == EffectiveSourceKind::Asset)
        .unwrap()
        .content_sha256 = pixel_cutout_sprite_studio_lib::domain::Sha256Digest::parse(
        "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
    )
    .unwrap();
    let external = service
        .build_without_current(
            Path::new(OUTPUT_DIRECTORY),
            &external_request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let external_pointer = service
        .validated_current_pointer(Path::new(OUTPUT_DIRECTORY), &external)
        .unwrap();
    let external_bytes = serde_json::to_vec_pretty(&external_pointer).unwrap();
    let current_path = temporary.path().join(OUTPUT_DIRECTORY).join("current.json");

    let result = service.publish_current(
        Path::new(OUTPUT_DIRECTORY),
        &replacement,
        &NeverCancel,
        &mut |progress: ExportProgress| {
            if progress.stage == ExportStage::Publishing && progress.completed == 0 {
                fs::write(&current_path, &external_bytes).unwrap();
            }
        },
    );
    assert!(matches!(result, Err(ExportError::CurrentPointerConflict)));
    assert_eq!(fs::read(current_path).unwrap(), external_bytes);
}

#[test]
fn individual_pngs_and_extruded_padding_are_opt_in_and_match_atlas_pixels() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    request.profile.individual_frames = true;
    request.profile.padding_px = 1;
    request.profile.extrude_edges = true;
    let outcome = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert_eq!(outcome.manifest.pages.len(), 4);
    let first = &outcome.manifest.frames[0];
    assert_eq!(first.rect_px.0, 1);
    assert_eq!(first.rect_px.1, 1);
    let individual = first.individual_file.as_ref().unwrap();
    assert_eq!(individual.as_str(), "frames/walk/n/0000.png");
    let decoded = image::open(
        temporary
            .path()
            .join(OUTPUT_DIRECTORY)
            .join(outcome.build.as_str())
            .join(individual.as_str()),
    )
    .unwrap()
    .into_rgba8();
    assert_eq!(decoded.dimensions(), (2, 2));
    assert_eq!(
        decoded.get_pixel(0, 0).0,
        frame_color("walk", Direction::N, 0, 0)
    );
}

#[test]
fn external_jump_policy_removes_baked_height_without_changing_the_source_document() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("jump", PixelSize(32, 32), PixelPoint(16, 16))]);
    request.profile.max_page_size_px = pixel_cutout_sprite_studio_lib::domain::AtlasSize(64, 64);
    request.profile.clipping_policy = ClippingPolicy::Warn;
    request.actions[0].motion.frame_count = 4;
    request.actions[0].motion.semantics = Some(MotionSemantics {
        preset: MotionPresetKind::Jump,
        root_motion: RootMotionMode::InPlace,
        recommended_speed_px_per_second: None,
        jump_height_mode: JumpHeightMode::BakedIntoFrames,
        ground_shadow: None,
        helpers: vec![MotionHelperChannel {
            kind: HelperKind::JumpHeight,
            slot_id: SlotId::parse("body").unwrap(),
            property: TrackProperty::OffsetYPx,
            amplitude: 4.0,
            cycles: 1.0,
            phase: 0.0,
            enabled: true,
        }],
    });
    let motion_hash = motion_semantic_sha256(&request.actions[0].motion).unwrap();
    request
        .effective_sources
        .iter_mut()
        .find(|source| source.kind == EffectiveSourceKind::Motion)
        .unwrap()
        .content_sha256 = motion_hash;

    request.actions[0].jump_mode = ExportJumpMode::External;
    let mut external_source = FixtureSource::default();
    let external = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut external_source,
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(external_source
        .sampled_y
        .iter()
        .all(|offset| offset.abs() < f64::EPSILON));
    assert_eq!(
        external.manifest.actions[0].jump_mode,
        ExportJumpMode::External
    );

    request.actions[0].jump_mode = ExportJumpMode::Baked;
    let mut baked_source = FixtureSource::default();
    service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut baked_source,
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(baked_source
        .sampled_y
        .iter()
        .any(|offset| offset.abs() > f64::EPSILON));
}
