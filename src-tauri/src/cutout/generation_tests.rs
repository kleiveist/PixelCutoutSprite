use super::{generation::*, *};
use crate::{
    storage::{StorageError, VaultRoot},
    workspace::{
        data_folder::manifest::{self, Manifest},
        InterruptWorkspaceAfterStep, WorkspaceWriter,
    },
};
use image::{Rgba, RgbaImage};
use std::{fs, path::Path};
use tempfile::TempDir;

fn fixture() -> (TempDir, VaultRoot, LoadedCutout, Vec<u8>) {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let image = RgbaImage::from_fn(7, 5, |x, y| {
        Rgba([
            x as u8 * 29,
            y as u8 * 43,
            173,
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
    let opened = open_source(&root, "Held.png", &digest(&bytes), true).unwrap();
    let mut request = edits(&opened);
    for part in &mut request.parts {
        if catalog()
            .iter()
            .any(|entry| entry.part_id == part.part_id && entry.required)
        {
            part.status = PartStatus::Confirmed;
            part.mask.confirmed = vec![[9, 5], [17, 3]];
            part.mask.draft = part.mask.confirmed.clone();
        }
    }
    let loaded = save_project(&root, request).unwrap();
    (temp, root, loaded, bytes)
}
fn edits(loaded: &LoadedCutout) -> SaveCutoutRequest {
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
fn request(root: &VaultRoot, loaded: &LoadedCutout) -> GenerateRequest {
    GenerateRequest {
        project_path: loaded.project_path.clone(),
        expected_revision: loaded.project.revision,
        expected_sha256: loaded.sha256.clone(),
        directory: target(root, &loaded.project_path, &loaded.sha256)
            .unwrap()
            .directory,
        padding: 1,
    }
}
fn manifest(root: &VaultRoot, directory: &str) -> Manifest {
    serde_json::from_slice(
        &fs::read(root.path().join(directory).join("sprite.parts.json")).unwrap(),
    )
    .unwrap()
}

#[test]
fn all_fifteen_names_pixels_alpha_hashes_coordinates_and_canonical_reopen_are_exact() {
    let (temp, root, loaded, original) = fixture();
    let generated = generate(&root, request(&root, &loaded)).unwrap();
    assert_eq!(generated.directory, "Held");
    assert_eq!(generated.part_count, 15);
    assert!(generated.complete);
    assert!(!temp.path().join(&loaded.project_path).exists());
    assert!(!temp
        .path()
        .join(project_directory(&loaded.project_path).unwrap())
        .join(".source/original.png")
        .exists());
    let manifest = manifest(&root, "Held");
    let decoded = image::load_from_memory(&original).unwrap().to_rgba8();
    for (index, part) in manifest.parts.iter().enumerate() {
        assert_eq!(
            part.file,
            format!("{:02}_{}.png", index + 1, catalog()[index].part_id)
        );
        let bytes = fs::read(temp.path().join("Held").join(&part.file)).unwrap();
        assert_eq!(digest(&bytes), part.sha256);
        let crop = image::load_from_memory(&bytes).unwrap().to_rgba8();
        assert_eq!(
            (
                part.source_rect.x,
                part.source_rect.y,
                part.source_rect.width,
                part.source_rect.height
            ),
            (1, 0, 6, 4)
        );
        assert_eq!(crop.dimensions(), (6, 4));
        for (x, y, pixel) in crop.enumerate_pixels() {
            let source_x = x + 1;
            let index = y * 7 + source_x;
            if (9..14).contains(&index) || (17..20).contains(&index) {
                assert_eq!(pixel, decoded.get_pixel(source_x, y));
            } else {
                assert_eq!(pixel.0[3], 0);
            }
            // Independent assembly equation: offset = position - pivot.
            assert_eq!(
                x as f64 + part.default_position.x - part.pivot.x,
                source_x as f64
            );
            assert_eq!(y as f64 + part.default_position.y - part.pivot.y, y as f64);
        }
        assert_eq!(crop.get_pixel(5, 1).0[3], 91);
        assert_eq!(part.default_z, default_z(&part.part_id));
    }
    assert_eq!(fs::read(temp.path().join("Held.png")).unwrap(), original);
    let reopened = open_source(&root, "Held.png", &digest(&original), true).unwrap();
    assert_eq!(reopened.project, generated.loaded.project);
    assert_eq!(reopened.masks, loaded.masks);
    assert_eq!(
        open_set_project(&root, "Held", &generated.manifest_sha256)
            .unwrap()
            .project,
        reopened.project
    );
    assert!(!temp.path().join("Held/16_cape.png").exists());
    assert!(!temp.path().join("Held/18_hair.png").exists());
}

#[test]
fn crop_preserves_invisible_rgb_clamps_padding_and_allows_independent_overlap() {
    let (_temp, root, loaded, _) = fixture();
    let source = snapshot_image(&root, &loaded).unwrap();
    let mask = vec![[0, 2], [9, 5], [17, 3]];
    let (part, rect) = crop(&source, &mask, 64).unwrap();
    assert_eq!((rect.x, rect.y, rect.width, rect.height), (0, 0, 7, 5));
    assert_eq!(part.get_pixel(0, 0), source.get_pixel(0, 0));
    assert_eq!(part.get_pixel(6, 1).0, source.get_pixel(6, 1).0);
    assert_eq!(part.get_pixel(5, 3).0[3], 0);
    let (neighbor, _) = crop(&source, &vec![[9, 5]], 64).unwrap();
    assert_eq!(part.get_pixel(6, 1), neighbor.get_pixel(6, 1));
}

#[test]
fn incomplete_explicit_omissions_are_valid_but_pending_and_empty_sets_are_not() {
    let (_temp, root, loaded, _) = fixture();
    let mut edit = edits(&loaded);
    edit.parts[0].status = PartStatus::Editing;
    let pending = save_project(&root, edit).unwrap();
    assert!(generate(&root, request(&root, &pending))
        .unwrap_err()
        .to_string()
        .contains("noch nicht bestätigt"));
    let mut edit = edits(&pending);
    edit.parts[0].status = PartStatus::NotPresent;
    edit.parts[0].reason = Some("Im Original verdeckt".into());
    let absent = save_project(&root, edit).unwrap();
    let generated = generate(&root, request(&root, &absent)).unwrap();
    assert!(!generated.complete);
    assert_eq!(generated.part_count, 14);
    let manifest = manifest(&root, &generated.directory);
    assert_eq!(manifest.omitted_parts[0].part_id, "head");
    assert_eq!(manifest.omitted_parts[0].reason, "Im Original verdeckt");
    assert!(!root.path().join("Held/01_head.png").exists());
    let mut edit = edits(&generated.loaded);
    for part in &mut edit.parts {
        if catalog()
            .iter()
            .any(|entry| entry.part_id == part.part_id && entry.required)
        {
            part.status = PartStatus::NotPresent;
            part.reason = Some("verdeckt".into());
        }
    }
    let empty = save_project(&root, edit).unwrap();
    assert!(generate(&root, request(&root, &empty))
        .unwrap_err()
        .to_string()
        .contains("Mindestens ein"));
}

#[test]
fn regeneration_deletes_only_owned_extras_preserves_scene_and_switches_slot_without_renumbering() {
    let (temp, root, loaded, _) = fixture();
    let mut edit = edits(&loaded);
    for part in &mut edit.parts {
        if !catalog()
            .iter()
            .find(|entry| entry.part_id == part.part_id)
            .unwrap()
            .required
        {
            part.status = PartStatus::Confirmed;
            part.mask.draft = vec![[6, 2]];
            part.mask.confirmed = part.mask.draft.clone();
        }
    }
    let all = save_project(&root, edit).unwrap();
    let first = generate(&root, request(&root, &all)).unwrap();
    assert_eq!(first.part_count, 18);
    fs::write(
        temp.path().join("Held/sprite.scene.json"),
        b"user scene: preserve these exact bytes",
    )
    .unwrap();
    fs::write(temp.path().join("Held/notes.txt"), b"foreign notes").unwrap();
    fs::write(temp.path().join("Held/unused.png"), b"foreign PNG").unwrap();
    let mut edit = edits(&first.loaded);
    edit.parts
        .iter_mut()
        .find(|part| part.part_id == "cape")
        .unwrap()
        .status = PartStatus::Disabled;
    edit.parts
        .iter_mut()
        .find(|part| part.part_id == "belt_accessory")
        .unwrap()
        .part_id = "sword".into();
    let changed = save_project(&root, edit).unwrap();
    assert!(!temp.path().join("Held/.masks/belt_accessory.json").exists());
    let second = generate(&root, request(&root, &changed)).unwrap();
    assert_ne!(first.generation_id, second.generation_id);
    assert!(!temp.path().join("Held/16_cape.png").exists());
    assert!(!temp.path().join("Held/17_belt_accessory.png").exists());
    assert!(temp.path().join("Held/17_sword.png").is_file());
    assert!(temp.path().join("Held/18_hair.png").is_file());
    assert_eq!(
        fs::read(temp.path().join("Held/sprite.scene.json")).unwrap(),
        b"user scene: preserve these exact bytes"
    );
    assert_eq!(
        fs::read(temp.path().join("Held/notes.txt")).unwrap(),
        b"foreign notes"
    );
    assert_eq!(
        fs::read(temp.path().join("Held/unused.png")).unwrap(),
        b"foreign PNG"
    );
    let mut edit = edits(&second.loaded);
    edit.parts
        .iter_mut()
        .find(|part| part.part_id == "sword")
        .unwrap()
        .part_id = "belt_accessory".into();
    let reverted = save_project(&root, edit).unwrap();
    let third = generate(&root, request(&root, &reverted)).unwrap();
    assert!(temp.path().join("Held/17_belt_accessory.png").is_file());
    assert!(!temp.path().join("Held/17_sword.png").exists());
    assert_eq!(third.loaded.masks["belt_accessory"].confirmed, vec![[6, 2]]);
}

#[test]
fn foreign_directory_case_alias_and_modified_owned_files_are_never_taken_over() {
    let (temp, root, loaded, _) = fixture();
    fs::create_dir(temp.path().join("held")).unwrap();
    fs::write(temp.path().join("held/foreign.png"), b"foreign").unwrap();
    let proposal = target(&root, &loaded.project_path, &loaded.sha256).unwrap();
    assert!(proposal.alternative);
    assert!(proposal.directory.starts_with("Held-cutout-"));
    let mut wrong = request(&root, &loaded);
    wrong.directory = "held".into();
    assert!(generate(&root, wrong).is_err());
    let first = generate(&root, request(&root, &loaded)).unwrap();
    assert_eq!(
        fs::read(temp.path().join("held/foreign.png")).unwrap(),
        b"foreign"
    );
    let path = temp.path().join(&first.directory).join("01_head.png");
    let before_manifest =
        fs::read(temp.path().join(&first.directory).join("sprite.parts.json")).unwrap();
    fs::write(&path, b"manually edited").unwrap();
    assert!(generate(&root, request(&root, &first.loaded)).is_err());
    assert_eq!(fs::read(path).unwrap(), b"manually edited");
    assert_eq!(
        fs::read(temp.path().join(&first.directory).join("sprite.parts.json")).unwrap(),
        before_manifest
    );
    assert_eq!(
        fs::read_dir(temp.path().join(".PixelStudio/transactions"))
            .unwrap()
            .count(),
        0
    );
}

#[test]
fn every_critical_migration_boundary_is_blocked_until_recovery_and_yields_one_canonical_set() {
    // 20 deletes, 15 PNGs, 19 context files, locator, project, manifest.
    for boundary in [1, 19, 20, 21, 54, 55, 56, 57] {
        let (temp, root, loaded, original) = fixture();
        let writer =
            WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(boundary));
        let result = generate_with_writer(&root, request(&root, &loaded), &writer);
        assert!(
            matches!(result,Err(StorageError::TransactionInterrupted {step}) if step==boundary),
            "boundary {boundary}: {result:?}"
        );
        assert!(manifest::read_set(&root, "Held", "Held/sprite.parts.json").is_err());
        assert!(open_source(&root, "Held.png", &digest(&original), true).is_err());
        assert_eq!(
            WorkspaceWriter::new(root.clone())
                .recover_file_sets()
                .unwrap(),
            1
        );
        manifest::read_set(&root, "Held", "Held/sprite.parts.json").unwrap();
        let reopened = open_source(&root, "Held.png", &digest(&original), true).unwrap();
        assert_eq!(reopened.project_path, "Held/cutout.project.json");
        assert_eq!(reopened.masks, loaded.masks);
        assert!(!temp.path().join(&loaded.project_path).exists());
    }
}

#[test]
fn regeneration_with_identical_png_hashes_still_requires_a_committed_manifest() {
    let (_temp, root, loaded, _) = fixture();
    let first = generate(&root, request(&root, &loaded)).unwrap();
    let writer = WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1));
    assert!(generate_with_writer(&root, request(&root, &first.loaded), &writer).is_err());
    assert!(manifest::read_set(&root, "Held", "Held/sprite.parts.json").is_err());
    WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .unwrap();
    manifest::read_set(&root, "Held", "Held/sprite.parts.json").unwrap();
    assert_ne!(manifest(&root, "Held").generation_id, first.generation_id);
}

#[test]
fn changed_extra_is_not_deleted_and_new_foreign_filename_causes_an_all_or_nothing_preflight() {
    let (temp, root, loaded, _) = fixture();
    let first = generate(&root, request(&root, &loaded)).unwrap();
    fs::write(
        temp.path().join("Held/18_hair.png"),
        b"foreign unowned hair",
    )
    .unwrap();
    let mut edit = edits(&first.loaded);
    let hair = edit
        .parts
        .iter_mut()
        .find(|part| part.part_id == "hair")
        .unwrap();
    hair.status = PartStatus::Confirmed;
    hair.mask.draft = vec![[6, 1]];
    hair.mask.confirmed = hair.mask.draft.clone();
    let updated = save_project(&root, edit).unwrap();
    let before = fs::read(temp.path().join("Held/sprite.parts.json")).unwrap();
    assert!(generate(&root, request(&root, &updated)).is_err());
    assert_eq!(
        fs::read(temp.path().join("Held/18_hair.png")).unwrap(),
        b"foreign unowned hair"
    );
    assert_eq!(
        fs::read(temp.path().join("Held/sprite.parts.json")).unwrap(),
        before
    );
    assert_eq!(
        fs::read_dir(temp.path().join(".PixelStudio/transactions"))
            .unwrap()
            .count(),
        0
    );
    fs::remove_file(temp.path().join("Held/18_hair.png")).unwrap();
    let generated = generate(&root, request(&root, &updated)).unwrap();
    fs::write(
        temp.path().join("Held/18_hair.png"),
        b"user changed owned hair",
    )
    .unwrap();
    let mut edit = edits(&generated.loaded);
    edit.parts
        .iter_mut()
        .find(|part| part.part_id == "hair")
        .unwrap()
        .status = PartStatus::Disabled;
    let disabled = save_project(&root, edit).unwrap();
    assert!(generate(&root, request(&root, &disabled)).is_err());
    assert_eq!(
        fs::read(temp.path().join("Held/18_hair.png")).unwrap(),
        b"user changed owned hair"
    );
}

fn copy_directory(source: &Path, target: &Path) {
    fs::create_dir_all(target).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let destination = target.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_directory(&entry.path(), &destination);
        } else {
            fs::copy(entry.path(), destination).unwrap();
        }
    }
}
#[test]
fn copied_set_loads_without_the_original_vault_or_original_image() {
    let (_temp, root, loaded, _) = fixture();
    let generated = generate(&root, request(&root, &loaded)).unwrap();
    let other = TempDir::new().unwrap();
    copy_directory(&root.path().join("Held"), &other.path().join("Portable"));
    let other_root = VaultRoot::open(other.path()).unwrap();
    manifest::read_set(&other_root, "Portable", "Portable/sprite.parts.json").unwrap();
    let reopened = open_set_project(&other_root, "Portable", &generated.manifest_sha256).unwrap();
    assert_eq!(reopened.project, generated.loaded.project);
    assert_eq!(
        read_pixels(
            &other_root,
            ".source/original.png",
            &reopened.project.source.sha256,
            Some(&reopened.project_path)
        )
        .unwrap()
        .len(),
        140
    );
    assert!(!other.path().join("Held.png").exists());
}
