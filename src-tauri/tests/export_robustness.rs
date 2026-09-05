mod support;

use std::fs;
use std::path::Path;

use pixel_cutout_sprite_studio_lib::domain::{ClippingPolicy, Direction, PixelPoint, PixelSize};
use pixel_cutout_sprite_studio_lib::exports::{
    CancellationFlag, ExportError, ExportProgress, ExportService, ExportStage, NeverCancel,
};
use pixel_cutout_sprite_studio_lib::storage::VaultRoot;
use tempfile::tempdir;

use support::{request, FixtureSource, OUTPUT_DIRECTORY};

#[test]
fn freshness_follows_only_a_valid_current_pointer() {
    let temporary = tempdir().unwrap();
    let output = temporary.path().join(OUTPUT_DIRECTORY);
    fs::create_dir_all(output.join("build-orphan")).unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    assert!(service
        .current(Path::new(OUTPUT_DIRECTORY))
        .unwrap()
        .is_none());

    fs::write(output.join("current.json"), b"{\"schema_version\":1}").unwrap();
    assert!(matches!(
        service.current(Path::new(OUTPUT_DIRECTORY)),
        Err(ExportError::InvalidBuild(_))
    ));
}

#[test]
fn cancellation_removes_staging_and_preserves_the_previous_current_pointer() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let export_root = temporary.path().join(OUTPUT_DIRECTORY);
    let previous_current = fs::read(export_root.join("current.json")).unwrap();

    let cancellation = CancellationFlag::default();
    let callback_flag = cancellation.clone();
    let result = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut FixtureSource {
            color_bias: 1,
            ..FixtureSource::default()
        },
        &cancellation,
        &mut move |progress: ExportProgress| {
            if progress.stage == ExportStage::Rendering && progress.completed == 2 {
                callback_flag.cancel();
            }
        },
    );
    assert!(matches!(result, Err(ExportError::Cancelled)));
    assert_eq!(
        fs::read(export_root.join("current.json")).unwrap(),
        previous_current
    );
    assert!(fs::read_dir(&export_root).unwrap().all(|entry| {
        !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .contains(".staging")
    }));
}

#[test]
fn missing_sources_block_normal_export_but_are_marked_in_explicit_test_output() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    let missing = || FixtureSource {
        missing: Some(("walk".to_owned(), Direction::S, 1)),
        ..FixtureSource::default()
    };
    let blocked = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut missing(),
        &NeverCancel,
        &mut |_| {},
    );
    assert!(matches!(blocked, Err(ExportError::MissingSource { .. })));
    assert!(!temporary
        .path()
        .join(OUTPUT_DIRECTORY)
        .join("current.json")
        .exists());

    request.profile.allow_incomplete_test = true;
    let incomplete = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut missing(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(!incomplete.manifest.complete);
    assert_eq!(incomplete.manifest.frames.len(), 15);
    assert!(incomplete
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "incomplete_export"));
    assert!(incomplete
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "missing_source"));

    let corrupt = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut FixtureSource {
            corrupt: true,
            ..FixtureSource::default()
        },
        &NeverCancel,
        &mut |_| {},
    );
    assert!(
        matches!(corrupt, Err(ExportError::MissingSource { message, .. }) if message.contains("corrupt_source"))
    );
}

#[test]
fn declared_missing_parts_are_normalized_marked_and_fingerprinted() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    request.incomplete_reasons = vec!["missing hat".to_owned()];
    assert!(matches!(
        service.source_fingerprint(&request),
        Err(ExportError::InvalidRequest(message)) if message.contains("incomplete-test")
    ));

    request.profile.allow_incomplete_test = true;
    request.incomplete_reasons = vec![
        " missing hat ".to_owned(),
        "missing boots".to_owned(),
        "missing hat".to_owned(),
    ];
    let normalized = service.source_fingerprint(&request).unwrap();
    let outcome = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(!outcome.manifest.complete);
    assert_eq!(outcome.manifest.source_fingerprint, normalized);
    assert_eq!(
        outcome
            .manifest
            .checks
            .iter()
            .filter(|check| check.code == "missing_source")
            .count(),
        2
    );

    request.incomplete_reasons = vec!["missing gloves".to_owned()];
    assert_ne!(service.source_fingerprint(&request).unwrap(), normalized);
}

#[test]
fn clipping_is_either_blocking_or_reported_according_to_the_profile() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    let blocked = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut FixtureSource {
            clipping: true,
            ..FixtureSource::default()
        },
        &NeverCancel,
        &mut |_| {},
    );
    assert!(matches!(blocked, Err(ExportError::ClippingBlocked { .. })));

    request.profile.clipping_policy = ClippingPolicy::Warn;
    let warned = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource {
                clipping: true,
                ..FixtureSource::default()
            },
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(warned.manifest.complete);
    assert!(warned
        .manifest
        .frames
        .iter()
        .any(|frame| !frame.clipping.is_empty()));
    assert!(warned
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "clipping"));
}

#[test]
fn inconsistent_action_geometry_requires_explicit_transparent_padding() {
    let temporary = tempdir().unwrap();
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let mut request = request(&[
        ("walk", PixelSize(2, 2), PixelPoint(0, 0)),
        ("sprint", PixelSize(3, 2), PixelPoint(1, 0)),
    ]);
    let blocked = service.export(
        Path::new(OUTPUT_DIRECTORY),
        &request,
        &mut FixtureSource::default(),
        &NeverCancel,
        &mut |_| {},
    );
    assert!(
        matches!(blocked, Err(ExportError::InvalidRequest(message)) if message.contains("transparent geometry"))
    );

    request.profile.normalize_geometry = true;
    let padded = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(padded.manifest.actions.iter().all(|action| {
        action.frame_size_px == PixelSize(3, 2) && action.ground_origin_px == PixelPoint(1, 0)
    }));
    assert!(padded
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "transparent_padding"));
}
