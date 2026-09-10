use super::*;
use crate::storage::VaultRoot;
use crate::workspace::{InterruptWorkspaceAfterStep, WorkspaceWriter};
use image::{Rgba, RgbaImage};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

fn fixture() -> (TempDir, VaultRoot, Vec<u8>) {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let image = RgbaImage::from_fn(7, 5, |x, y| {
        Rgba([
            x as u8 * 23,
            y as u8 * 41,
            137,
            if (x, y) == (0, 0) {
                0
            } else if x == 6 {
                91
            } else {
                255
            },
        ])
    });
    let bytes = encode_png(&image).unwrap();
    fs::write(temp.path().join("Held.png"), &bytes).unwrap();
    (temp, root, bytes)
}
fn edit(loaded: &LoadedCutout) -> SaveCutoutRequest {
    SaveCutoutRequest {
        project_path: loaded.project_path.clone(),
        expected_revision: loaded.project.revision,
        expected_sha256: loaded.sha256.clone(),
        active_part_id: loaded.project.active_part_id.clone(),
        detach_original: false,
        parts: loaded
            .project
            .parts
            .iter()
            .map(|part| PartEdit {
                part_id: part.part_id.clone(),
                status: part.status,
                reason: part.reason.clone(),
                mask: loaded.masks[&part.part_id].clone(),
                selection_parameters: None,
            })
            .collect(),
    }
}

#[test]
fn cutout_roundtrip_keeps_original_snapshot_drafts_confirmation_active_part_and_overlaps() {
    let (temp, root, bytes) = fixture();
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let mut request = edit(&opened);
    request.active_part_id = "upper_arm_r".to_owned();
    request.parts[0].status = PartStatus::Confirmed;
    request.parts[0].mask.draft = vec![[1, 6]];
    request.parts[0].mask.confirmed = vec![[1, 6]];
    request.parts[0].selection_parameters = Some(super::segmentation::SelectionParameters {
        alpha_threshold: 5,
        tolerance: 70,
        edge_weight: 6,
    });
    request.parts[1].status = PartStatus::Editing;
    request.parts[1].mask.draft = vec![[3, 8]];
    request.parts[1].mask.positive = vec![[4, 2]];
    request.parts[1].mask.negative = vec![[12, 1]];
    let saved = save_project(&root, request).unwrap();
    assert_eq!(saved.project.revision, 2);
    let reopened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    assert_eq!(saved.project, reopened.project);
    assert_eq!(
        reopened.project.parts[0].selection_parameters["tolerance"],
        serde_json::json!(70)
    );
    assert_eq!(saved.masks, reopened.masks);
    assert_eq!(reopened.project.active_part_id, "upper_arm_r");
    assert_eq!(fs::read(temp.path().join("Held.png")).unwrap(), bytes);
    let pixels = read_pixels(
        &root,
        ".source/original.png",
        &saved.project.source.sha256,
        Some(&saved.project_path),
    )
    .unwrap();
    assert_eq!(pixels.len(), 7 * 5 * 4);
    assert_eq!(pixels[6 * 4 + 3], 91);
    let mut stale = edit(&opened);
    stale.parts[0].status = PartStatus::Editing;
    assert!(matches!(
        save_project(&root, stale),
        Err(crate::storage::StorageError::WriteConflict)
    ));
}

#[test]
fn readonly_source_open_is_ephemeral_and_changed_source_never_reuses_masks() {
    let (temp, root, bytes) = fixture();
    let opened = open_source(&root, "Held.png", &digest(&bytes), false).unwrap();
    assert!(!opened.persisted);
    assert!(!temp.path().join(".PixelStudio").exists());
    assert_eq!(
        read_pixels(&root, "Held.png", &digest(&bytes), None)
            .unwrap()
            .len(),
        140
    );
    let persisted = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    fs::write(
        temp.path().join("Held.png"),
        encode_png(&RgbaImage::from_pixel(7, 5, Rgba([1, 2, 3, 255]))).unwrap(),
    )
    .unwrap();
    assert!(open_source(&root, "Held.png", &digest(&bytes), true)
        .unwrap_err()
        .to_string()
        .contains("SOURCE_CHANGED"));
    assert!(save_project(&root, edit(&persisted))
        .unwrap_err()
        .to_string()
        .contains("SOURCE_CHANGED"));
    assert_eq!(
        load_project(&root, &persisted.project_path)
            .unwrap()
            .project
            .revision,
        1
    );
}

#[test]
fn mask_validation_rejects_empty_invisible_unsorted_oversized_and_invalid_statuses() {
    let (_temp, root, bytes) = fixture();
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    for runs in [
        vec![],
        vec![[0, 1]],
        vec![[1, 99]],
        vec![[1, 2], [2, 3]],
        vec![[1, 0]],
    ] {
        let mut request = edit(&opened);
        request.parts[0].status = PartStatus::Confirmed;
        request.parts[0].mask.confirmed = runs.clone();
        request.parts[0].mask.draft = runs;
        assert!(save_project(&root, request).is_err());
    }
    let mut request = edit(&opened);
    request.parts[0].status = PartStatus::Disabled;
    assert!(save_project(&root, request).is_err());
    let mut request = edit(&opened);
    request.parts[0].status = PartStatus::NotPresent;
    assert!(save_project(&root, request.clone()).is_err());
    request.parts[0].reason = Some("Durch den Helm vollständig verdeckt".to_owned());
    assert!(save_project(&root, request).is_ok());
}

#[test]
fn explicit_snapshot_detachment_preserves_edits_after_missing_or_changed_original() {
    for missing in [true, false] {
        let (temp, root, bytes) = fixture();
        let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
        let original = temp.path().join("Held.png");
        let replacement = encode_png(&RgbaImage::from_pixel(7, 5, Rgba([9, 8, 7, 255]))).unwrap();
        if missing {
            fs::rename(&original, temp.path().join("Extern-umbenannt.png")).unwrap();
        } else {
            fs::write(&original, &replacement).unwrap();
        }
        let mut request = edit(&opened);
        for part in &mut request.parts {
            if catalog()
                .iter()
                .any(|p| p.part_id == part.part_id && p.required)
            {
                part.status = PartStatus::NotPresent;
                part.reason = Some("Im Testbild nicht vorhanden".into());
            }
        }
        request.parts[0].status = PartStatus::Confirmed;
        request.parts[0].reason = None;
        request.parts[0].mask.draft = vec![[1, 6]];
        request.parts[0].mask.confirmed = vec![[1, 6]];
        assert!(save_project(&root, request.clone()).is_err());
        request.detach_original = true;
        let saved = save_project(&root, request.clone()).unwrap();
        assert!(saved.project.source.original_path.is_none());
        assert!(saved.project.source.original_sha256.is_none());
        assert_eq!(saved.project.source.sha256, opened.project.source.sha256);
        assert_eq!(saved.masks["head"].confirmed, vec![[1, 6]]);
        assert!(matches!(
            save_project(&root, request),
            Err(crate::storage::StorageError::WriteConflict)
        ));
        let target = super::generation::target(&root, &saved.project_path, &saved.sha256).unwrap();
        assert_eq!(target.directory, saved.project.id);
        let generated = super::generation::generate(
            &root,
            super::generation::GenerateRequest {
                project_path: saved.project_path.clone(),
                expected_revision: saved.project.revision,
                expected_sha256: saved.sha256.clone(),
                directory: target.directory,
                padding: 0,
            },
        )
        .unwrap();
        assert_eq!(generated.part_count, 1);
        assert_eq!(
            load_project(&root, &generated.loaded.project_path)
                .unwrap()
                .masks,
            saved.masks
        );
        if missing {
            assert!(!original.exists());
            assert_eq!(
                fs::read(temp.path().join("Extern-umbenannt.png")).unwrap(),
                bytes
            );
            fs::rename(temp.path().join("Extern-umbenannt.png"), &original).unwrap();
            let reopened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
            assert_eq!(reopened.project_path, generated.loaded.project_path);
            assert!(reopened.project.source.original_path.is_none());
        } else {
            assert_eq!(fs::read(&original).unwrap(), replacement);
            let different = open_source(&root, "Held.png", &digest(&replacement), true).unwrap();
            assert_ne!(different.project.id, saved.project.id);
            assert!(different.masks["head"].draft.is_empty());
        }
    }
}

#[test]
fn snapshot_detachment_never_bypasses_snapshot_integrity() {
    let (temp, root, bytes) = fixture();
    let loaded = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let snapshot = temp
        .path()
        .join(project_directory(&loaded.project_path).unwrap())
        .join(".source/original.png");
    fs::write(&snapshot, b"corrupt PNG").unwrap();
    let mut request = edit(&loaded);
    request.detach_original = true;
    assert!(save_project(&root, request).is_err());
    assert_eq!(fs::read(snapshot).unwrap(), b"corrupt PNG");
    assert_eq!(fs::read(temp.path().join("Held.png")).unwrap(), bytes);
}

#[test]
fn tampered_mask_or_snapshot_and_escaping_paths_are_rejected_without_replacement() {
    let (temp, root, bytes) = fixture();
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let saved = save_project(&root, edit(&opened)).unwrap();
    for path in [
        "../Held.png",
        "Held.png/cutout.project.json",
        ".PixelStudio/recovery/cutout/../../cutout.project.json",
    ] {
        assert!(load_project(&root, path).is_err());
    }
    let path = Path::new(&saved.project_path)
        .parent()
        .unwrap()
        .join(".masks/head.json");
    fs::write(temp.path().join(path), b"{}").unwrap();
    assert!(load_project(&root, &saved.project_path)
        .unwrap_err()
        .to_string()
        .contains("MASK_CHANGED"));
    assert_eq!(fs::read(temp.path().join("Held.png")).unwrap(), bytes);
}

#[test]
fn interrupted_multi_file_mask_save_recovers_one_consistent_generation() {
    let (temp, root, bytes) = fixture();
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let mut project = opened.project.clone();
    project.revision += 1;
    let directory = project_directory(&opened.project_path).unwrap();
    let mask = Mask {
        draft: vec![[1, 5]],
        ..Mask::default()
    };
    let mask_bytes = json_bytes(&mask).unwrap();
    project.parts[0].mask_path = Some(".masks/head.json".to_owned());
    project.parts[0].mask_sha256 = Some(digest(&mask_bytes));
    project.parts[0].status = PartStatus::Editing;
    let writes = [
        managed(format!("{directory}/.masks/head.json"), mask_bytes, None),
        managed(
            opened.project_path.clone(),
            json_bytes(&project).unwrap(),
            Some(opened.sha256),
        ),
    ];
    assert!(
        WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1))
            .publish_file_set(&writes)
            .is_err()
    );
    WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .unwrap();
    let recovered = load_project(&root, &opened.project_path).unwrap();
    assert_eq!(recovered.project.revision, 2);
    assert_eq!(recovered.masks["head"].draft, vec![[1, 5]]);
    assert_eq!(fs::read(temp.path().join("Held.png")).unwrap(), bytes);
}

#[cfg(unix)]
#[test]
fn source_and_recovery_symlinks_are_never_followed() {
    let (temp, root, bytes) = fixture();
    std::os::unix::fs::symlink(temp.path().join("Held.png"), temp.path().join("link.png")).unwrap();
    assert!(open_source(&root, "link.png", &digest(&bytes), true).is_err());
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let mask_dir = Path::new(&opened.project_path)
        .parent()
        .unwrap()
        .join(".masks");
    std::os::unix::fs::symlink(temp.path(), temp.path().join(mask_dir)).unwrap();
    assert!(save_project(&root, edit(&opened)).is_err());
}

#[test]
fn catalog_preserves_anatomical_side_filenames_and_optional_slot_numbers() {
    assert_eq!(catalog().len(), 19);
    assert_eq!(catalog().iter().filter(|part| part.required).count(), 15);
    assert_eq!(
        catalog()
            .iter()
            .find(|part| part.part_id == "upper_arm_l")
            .unwrap()
            .file,
        "04_upper_arm_l.png"
    );
    assert_eq!(
        catalog()
            .iter()
            .find(|part| part.part_id == "sword")
            .unwrap()
            .file,
        "17_sword.png"
    );
}

#[test]
fn jpeg_orientation_is_normalized_without_modifying_original_bytes() {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let rgb = image::RgbImage::from_fn(7, 3, |x, y| image::Rgb([x as u8 * 30, y as u8 * 60, 100]));
    let mut jpeg = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(rgb)
        .write_to(&mut jpeg, image::ImageFormat::Jpeg)
        .unwrap();
    let jpeg = jpeg.into_inner();
    let exif = [
        b'E', b'x', b'i', b'f', 0, 0, b'I', b'I', 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 1, 3, 0, 1, 0, 0,
        0, 6, 0, 0, 0, 0, 0, 0, 0,
    ];
    let mut bytes = jpeg[..2].to_vec();
    bytes.extend_from_slice(&[0xff, 0xe1, 0, (exif.len() + 2) as u8]);
    bytes.extend_from_slice(&exif);
    bytes.extend_from_slice(&jpeg[2..]);
    fs::write(temp.path().join("rotated.jpg"), &bytes).unwrap();
    let opened = open_source(&root, "rotated.jpg", &digest(&bytes), true).unwrap();
    assert_eq!(
        (opened.project.source.width, opened.project.source.height),
        (3, 7)
    );
    assert_eq!(fs::read(temp.path().join("rotated.jpg")).unwrap(), bytes);
    assert_eq!(snapshot_image(&root, &opened).unwrap().dimensions(), (3, 7));
}

#[test]
fn sixteen_megapixel_source_is_bounded_and_releases_decoded_buffers() {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let started = std::time::Instant::now();
    let bytes = encode_png(&RgbaImage::from_pixel(
        8192,
        2048,
        Rgba([80, 140, 220, 127]),
    ))
    .unwrap();
    fs::write(temp.path().join("large.png"), &bytes).unwrap();
    let loaded = open_source(&root, "large.png", &digest(&bytes), true).unwrap();
    let pixels = read_pixels(
        &root,
        ".source/original.png",
        &loaded.project.source.sha256,
        Some(&loaded.project_path),
    )
    .unwrap();
    assert_eq!(pixels.len(), 64 * 1024 * 1024);
    assert!(pixels
        .chunks_exact(4)
        .all(|pixel| pixel == [80, 140, 220, 127]));
    println!(
        "P38 large-source: {} pixels, {} encoded bytes, {} binary IPC bytes, {} ms (debug build)",
        8192 * 2048,
        bytes.len(),
        pixels.len(),
        started.elapsed().as_millis()
    );
    drop(pixels);
    assert_eq!(
        load_project(&root, &loaded.project_path)
            .unwrap()
            .project
            .source
            .width,
        8192
    );
}
