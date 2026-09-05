mod support;

use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::domain::{Direction, PixelPoint, PixelSize};
use pixel_cutout_sprite_studio_lib::exports::{
    CancellationFlag, ExportError, ExportProgress, ExportService, ExportStage, GodotExportOptions,
    GodotExporter, NeverCancel,
};
use pixel_cutout_sprite_studio_lib::storage::VaultRoot;
use tempfile::tempdir;

use support::{request, FixtureSource, OUTPUT_DIRECTORY};

#[test]
fn creates_a_complete_portable_package_without_copying_user_code() {
    let temporary = tempdir().unwrap();
    let generic_build = create_generic_build(
        temporary.path(),
        &["walk", "sprint"],
        PixelSize(2, 2),
        PixelPoint(1, 1),
    );
    fs::write(generic_build.join("untrusted.gd"), "@tool\nextends Node\n").unwrap();

    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());
    let outcome = exporter
        .export(
            &generic_build,
            Path::new("packages/hero"),
            GodotExportOptions::default(),
        )
        .unwrap();
    let package = temporary.path().join(&outcome.package_directory);

    assert!(!outcome.reused_existing_package);
    assert_eq!(outcome.animation_names.len(), 16);
    assert_eq!(outcome.animation_names[0], "sprint_n");
    assert_eq!(outcome.animation_names[7], "sprint_nw");
    assert_eq!(outcome.animation_names[8], "walk_n");
    assert_eq!(outcome.animation_names[15], "walk_nw");
    assert!(outcome.scene.is_some());
    assert!(package.join("animation.json").is_file());
    assert!(package.join("sheet-0.png").is_file());
    assert!(package.join("sprite_frames.tres").is_file());
    assert!(package.join("character.tscn").is_file());
    assert!(package.join("GODOT_IMPORT.md").is_file());
    assert!(!package.join("untrusted.gd").exists());

    let resource = fs::read_to_string(package.join("sprite_frames.tres")).unwrap();
    assert!(resource.contains("path=\"sheet-0.png\""));
    assert!(resource.contains("\"name\": &\"walk_s\""));
    assert!(resource.contains("\"speed\": 12.0"));
    assert!(resource.contains("\"loop\": 1"));
    assert!(!resource.contains("res://"));
    assert!(!resource.contains("ImageTexture"));
    assert!(!resource.contains("PackedByteArray"));
    assert!(!resource.contains(temporary.path().to_string_lossy().as_ref()));

    let reused = exporter
        .export(
            &generic_build,
            Path::new("packages/hero"),
            GodotExportOptions::default(),
        )
        .unwrap();
    assert!(reused.reused_existing_package);
    assert_eq!(outcome.source_fingerprint, reused.source_fingerprint);

    let copied = exporter
        .export(
            &generic_build,
            Path::new("packages/hero-copy"),
            GodotExportOptions::default(),
        )
        .unwrap();
    assert!(!copied.reused_existing_package);
    assert_eq!(outcome.source_fingerprint, copied.source_fingerprint);
    assert_eq!(
        resource,
        fs::read_to_string(
            temporary
                .path()
                .join(copied.package_directory)
                .join("sprite_frames.tres")
        )
        .unwrap()
    );

    let scene = fs::read_to_string(package.join("character.tscn")).unwrap();
    assert!(scene.contains("path=\"sprite_frames.tres\""));
    assert!(scene.contains("texture_filter = 1"));
    assert!(scene.contains("centered = false"));
    assert!(scene.contains("offset = Vector2(-1, -1)"));
    assert!(!scene.contains("script ="));

    for relative in [
        "animation.json",
        "sprite_frames.tres",
        "character.tscn",
        "GODOT_IMPORT.md",
    ] {
        let path = package.join(relative);
        let original = fs::read(&path).unwrap();
        let mut changed = original.clone();
        changed.extend_from_slice(if relative == "animation.json" {
            b"\n "
        } else {
            b"\n# external mutation\n"
        });
        fs::write(&path, &changed).unwrap();
        assert!(matches!(
            exporter.export(
                &generic_build,
                Path::new("packages/hero"),
                GodotExportOptions::default(),
            ),
            Err(ExportError::InvalidGodotPackage(_)) | Err(ExportError::InvalidBuild(_))
        ));
        assert_eq!(
            fs::read(&path).unwrap(),
            changed,
            "{relative} was overwritten"
        );
        fs::write(path, original).unwrap();
    }
}

#[test]
fn optional_scene_can_be_omitted_while_generic_metadata_remains() {
    let temporary = tempdir().unwrap();
    let generic_build = create_generic_build(
        temporary.path(),
        &["walk"],
        PixelSize(2, 2),
        PixelPoint(0, 0),
    );
    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());
    let outcome = exporter
        .export(
            &generic_build,
            Path::new("without_scene"),
            GodotExportOptions {
                include_scene: false,
            },
        )
        .unwrap();
    let package = temporary.path().join(&outcome.package_directory);

    assert_eq!(outcome.scene, None);
    assert!(package.join("sprite_frames.tres").is_file());
    assert!(package.join("animation.json").is_file());
    assert!(!package.join("character.tscn").exists());
}

#[test]
fn incomplete_generic_build_is_rejected_without_leaving_a_package_or_stage() {
    let temporary = tempdir().unwrap();
    let mut export_request = request(&[("walk", PixelSize(2, 2), PixelPoint(0, 0))]);
    export_request.profile.directions = vec![Direction::S];
    export_request.profile.allow_incomplete_test = true;
    let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
    let generic = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &export_request,
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let generic_build = temporary
        .path()
        .join(OUTPUT_DIRECTORY)
        .join(generic.build.as_str());
    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());
    let result = exporter.export(
        &generic_build,
        Path::new("blocked_package"),
        GodotExportOptions::default(),
    );

    assert!(
        matches!(result, Err(ExportError::InvalidGodotPackage(message)) if message.contains("complete"))
    );
    assert!(!temporary.path().join("blocked_package").exists());
    assert!(fs::read_dir(temporary.path()).unwrap().all(|entry| {
        !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .contains(".staging")
    }));
}

#[test]
fn an_existing_destination_is_never_overwritten() {
    let temporary = tempdir().unwrap();
    let generic_build = create_generic_build(
        temporary.path(),
        &["walk"],
        PixelSize(2, 2),
        PixelPoint(0, 0),
    );
    let destination = temporary.path().join("existing");
    fs::create_dir(&destination).unwrap();
    fs::write(destination.join("keep.txt"), "owned by user").unwrap();
    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());

    let result = exporter.export(
        &generic_build,
        Path::new("existing"),
        GodotExportOptions::default(),
    );
    assert!(matches!(result, Err(ExportError::InvalidGodotPackage(_))));
    assert_eq!(
        fs::read_to_string(destination.join("keep.txt")).unwrap(),
        "owned by user"
    );
}

#[test]
fn cancellation_cleans_the_stage_and_preserves_an_older_package() {
    let temporary = tempdir().unwrap();
    let generic_build = create_generic_build(
        temporary.path(),
        &["walk"],
        PixelSize(2, 2),
        PixelPoint(0, 0),
    );
    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());
    exporter
        .export(
            &generic_build,
            Path::new("packages/old"),
            GodotExportOptions::default(),
        )
        .unwrap();
    let old_resource = fs::read(temporary.path().join("packages/old/sprite_frames.tres")).unwrap();
    let cancellation = CancellationFlag::default();
    let cancel_from_progress = cancellation.clone();
    let mut events = Vec::new();
    let mut progress = |event: ExportProgress| {
        if event.stage == ExportStage::GodotPackaging && event.completed == 2 {
            cancel_from_progress.cancel();
        }
        events.push(event);
    };

    let result = exporter.export_with_control(
        &generic_build,
        Path::new("packages/new"),
        GodotExportOptions::default(),
        &cancellation,
        &mut progress,
    );
    assert!(matches!(result, Err(ExportError::Cancelled)));
    assert_eq!(
        fs::read(temporary.path().join("packages/old/sprite_frames.tres")).unwrap(),
        old_resource
    );
    assert!(!temporary.path().join("packages/new").exists());
    assert!(fs::read_dir(temporary.path().join("packages"))
        .unwrap()
        .all(|entry| !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .contains(".staging")));
    assert_eq!(events[0].stage, ExportStage::GodotPackaging);
    assert_eq!(events[0].completed, 0);
}

#[cfg(unix)]
#[test]
fn existing_package_rejects_non_regular_entries_before_opening_them() {
    use std::os::unix::net::UnixListener;

    let temporary = tempdir().unwrap();
    let generic_build = create_generic_build(
        temporary.path(),
        &["walk"],
        PixelSize(2, 2),
        PixelPoint(0, 0),
    );
    let exporter = GodotExporter::new(VaultRoot::open(temporary.path()).unwrap());
    exporter
        .export(
            &generic_build,
            Path::new("packages/socket-entry"),
            GodotExportOptions::default(),
        )
        .unwrap();
    let guide = temporary
        .path()
        .join("packages/socket-entry/GODOT_IMPORT.md");
    fs::remove_file(&guide).unwrap();
    let _socket = UnixListener::bind(&guide).unwrap();

    let result = exporter.export(
        &generic_build,
        Path::new("packages/socket-entry"),
        GodotExportOptions::default(),
    );
    assert!(matches!(
        result,
        Err(ExportError::InvalidGodotPackage(message))
            if message.contains("regular files or directories")
    ));
}

fn create_generic_build(
    root: &Path,
    actions: &[&str],
    frame_size: PixelSize,
    ground: PixelPoint,
) -> PathBuf {
    let action_specs = actions
        .iter()
        .map(|action| (*action, frame_size, ground))
        .collect::<Vec<_>>();
    let service = ExportService::new(VaultRoot::open(root).unwrap(), "0.1.0");
    let outcome = service
        .export(
            Path::new(OUTPUT_DIRECTORY),
            &request(&action_specs),
            &mut FixtureSource::default(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    root.join(OUTPUT_DIRECTORY).join(outcome.build.as_str())
}
