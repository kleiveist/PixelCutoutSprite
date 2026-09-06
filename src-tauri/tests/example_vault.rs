use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::application::{
    AreaService, AssetService, BindingService, ExampleVaultService, ExportOutputFormat,
    ExportProfileService, MotionCardStatus, MotionService, NpcExportService, ProjectService,
    StartNpcExportRequest, VaultService,
};
use pixel_cutout_sprite_studio_lib::commands;
use pixel_cutout_sprite_studio_lib::domain::{
    parse_document, CharacterStatus, Direction, DomainDocument, FollowMode, ReviewState,
};
use pixel_cutout_sprite_studio_lib::exports::NeverCancel;
use pixel_cutout_sprite_studio_lib::storage::object_folder;
use tempfile::tempdir;

const PROJECT_NAME: &str = "Lichterhain";
const AREA_NAME: &str = "Dorf-NPCs";

#[test]
fn lichterhain_uses_production_services_reopens_copies_and_exports() {
    let directory = tempdir().unwrap();
    let vault_path = directory.path().join("Lichterhain Beispiel");
    let outcome = tauri::async_runtime::block_on(commands::generate_example_vault(
        vault_path.to_string_lossy().into_owned(),
    ))
    .unwrap();

    assert_eq!(outcome.generated_asset_count, 272);
    assert_eq!(outcome.motions.len(), 3);
    assert_eq!(outcome.npcs.len(), 2);
    assert_eq!(
        outcome
            .npcs
            .iter()
            .map(|npc| npc.name.as_str())
            .collect::<HashSet<_>>(),
        HashSet::from(["Mira", "Borin"])
    );
    assert!(vault_path.join("LICHTERHAIN-LICENSE.txt").is_file());
    assert!(vault_path.join("LICHTERHAIN-README.md").is_file());

    let mut vaults = VaultService::default();
    let opened = vaults.open(&vault_path).unwrap();
    let projects = ProjectService::dashboard(&vaults, opened.session_id).unwrap();
    assert_eq!(projects.projects.len(), 1);
    assert_eq!(projects.projects[0].name, PROJECT_NAME);
    assert_eq!(projects.projects[0].labels[0].name, "Beispiel");

    let areas = AreaService::dashboard(&vaults, opened.session_id, outcome.project_id).unwrap();
    assert_eq!(areas.areas.len(), 1);
    assert_eq!(areas.areas[0].name, AREA_NAME);
    assert_eq!(areas.labels[0].name, "Dorfbewohner");
    let area = AreaService::open(&vaults, opened.session_id, outcome.area_id).unwrap();
    assert_eq!(area.area.reference_height_px, 80);
    assert_eq!(area.profile.slots.len(), 16);
    assert_eq!(area.profile.reference(), outcome.profile_ref);

    let motions = MotionService::dashboard(&vaults, opened.session_id, outcome.area_id).unwrap();
    assert_eq!(motions.motions.len(), 3);
    assert!(motions
        .motions
        .iter()
        .all(|motion| motion.status == MotionCardStatus::Released));
    assert_eq!(
        motions
            .motions
            .iter()
            .map(|motion| motion.action_key.as_str())
            .collect::<HashSet<_>>(),
        HashSet::from(["walk", "sprint", "jump"])
    );

    let inventory = AssetService::inventory(&vaults, opened.session_id, outcome.area_id).unwrap();
    assert_eq!(inventory.items.len(), 272);
    assert!(inventory.items.iter().all(|asset| !asset.archived));

    let area_path = object_folder(PROJECT_NAME, outcome.project_id)
        .unwrap()
        .join(object_folder(AREA_NAME, outcome.area_id).unwrap());
    let root = vaults.session_root(opened.session_id, true).unwrap();
    let workspace = BindingService.workspace_context(&root, &area_path).unwrap();
    assert_eq!(workspace.npcs.len(), 2);
    let expected_motion_refs = outcome
        .motions
        .iter()
        .map(|motion| motion.template_ref)
        .collect::<HashSet<_>>();
    for npc in &workspace.npcs {
        assert_eq!(npc.character.status, CharacterStatus::Reviewed);
        assert_eq!(npc.character.label_ids.len(), 1);
        assert_eq!(npc.bindings.len(), 3);
        assert!(npc.missing_actions.is_empty());
        assert_eq!(
            npc.bindings
                .iter()
                .map(|binding| binding.binding.template_ref)
                .collect::<HashSet<_>>(),
            expected_motion_refs
        );
        assert!(npc
            .bindings
            .iter()
            .all(|binding| binding.binding.review_state == ReviewState::Reviewed));
    }
    let mira = workspace
        .npcs
        .iter()
        .find(|npc| npc.character.name == "Mira")
        .unwrap();
    assert_eq!(
        mira.bindings
            .iter()
            .find(|binding| binding.binding.action_key.as_str() == "walk")
            .unwrap()
            .binding
            .local_overrides
            .len(),
        1
    );
    let borin = workspace
        .npcs
        .iter()
        .find(|npc| npc.character.name == "Borin")
        .unwrap();
    assert_eq!(
        borin
            .bindings
            .iter()
            .find(|binding| binding.binding.action_key.as_str() == "sprint")
            .unwrap()
            .binding
            .local_overrides
            .len(),
        1
    );

    for npc in &outcome.npcs {
        let character_folder = area_path.join(object_folder(&npc.name, npc.character_id).unwrap());
        let appearance_path = root
            .resolve(&character_folder.join("appearances/default.json"))
            .unwrap();
        let DomainDocument::Appearance(appearance) =
            parse_document(&fs::read(appearance_path.as_path()).unwrap()).unwrap()
        else {
            panic!("default appearance has the wrong document kind");
        };
        assert_eq!(appearance.id, npc.appearance_id);
        assert_eq!(appearance.equipment.len(), 1);
        let equipment = &appearance.equipment[0];
        assert!(equipment.enabled);
        assert_eq!(equipment.follow_mode, FollowMode::Slot);
        assert!(!equipment.own_motion_enabled);
        assert!(equipment.own_motion_tracks.is_empty());
        assert_eq!(equipment.fit_by_direction.len(), Direction::ALL.len());

        let generic_manifest = root
            .resolve(&Path::new(&npc.generic_build).join("animation.json"))
            .unwrap();
        let DomainDocument::ExportManifest(manifest) =
            parse_document(&fs::read(generic_manifest.as_path()).unwrap()).unwrap()
        else {
            panic!("generic animation.json has the wrong document kind");
        };
        assert!(manifest.complete);
        assert_eq!(manifest.actions.len(), 3);
        assert_eq!(manifest.frames.len(), 256);
        assert!(manifest
            .actions
            .iter()
            .all(|action| action.directions == Direction::ALL));
        assert_eq!(npc.animation_names.len(), 24);

        let package = root.resolve(Path::new(&npc.godot_package)).unwrap();
        for file in [
            "animation.json",
            "character.tscn",
            "GODOT_IMPORT.md",
            "sheet-0.png",
            "sprite_frames.tres",
        ] {
            assert!(package.as_path().join(file).is_file(), "missing {file}");
        }
        for file in ["character.tscn", "sprite_frames.tres"] {
            let content = fs::read_to_string(package.as_path().join(file)).unwrap();
            assert!(!content.contains(&vault_path.to_string_lossy().into_owned()));
        }
    }

    let asset_manifests = files_named(&vault_path, "asset.json");
    assert_eq!(asset_manifests.len(), 272);
    for path in asset_manifests {
        let DomainDocument::Asset(asset) = parse_document(&fs::read(path).unwrap()).unwrap() else {
            panic!("asset.json has the wrong document kind");
        };
        assert!(asset.origin_note.contains("no external source"));
        assert!(asset.license_note.contains("MIT"));
    }

    vaults.close(opened.session_id).unwrap();

    let copied_path = directory.path().join("Kopie mit Leerzeichen ü");
    copy_tree(&vault_path, &copied_path);
    let mut copied_vaults = VaultService::default();
    let copied = copied_vaults.open(&copied_path).unwrap();
    let copied_root = copied_vaults.session_root(copied.session_id, true).unwrap();
    let copied_workspace = BindingService
        .workspace_context(&copied_root, &area_path)
        .unwrap();
    let copied_mira = copied_workspace
        .npcs
        .iter()
        .find(|npc| npc.character.name == "Mira")
        .unwrap();
    let stored_profile = ExportProfileService
        .list(&copied_root, &area_path, outcome.area_id)
        .unwrap()
        .pop()
        .unwrap();
    let mut profile = stored_profile.profile;
    profile.name = "Unicode copy verification".to_owned();
    profile.individual_frames = true;
    let exported = NpcExportService
        .execute(
            &copied_root,
            &area_path,
            StartNpcExportRequest {
                character_id: copied_mira.character.id,
                binding_ids: copied_mira
                    .bindings
                    .iter()
                    .map(|binding| binding.binding.id)
                    .collect(),
                profile,
                root_motion_mode: stored_profile.root_motion_mode,
                jump_mode: stored_profile.jump_mode,
                format: ExportOutputFormat::PngJson,
                include_godot_scene: false,
            },
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(exported.generic.manifest.complete);
    assert!(!exported.generic.reused_existing_build);
    assert!(exported
        .generic
        .manifest
        .frames
        .iter()
        .all(|frame| frame.individual_file.is_some()));
    copied_vaults.close(copied.session_id).unwrap();
}

#[test]
fn lichterhain_refuses_to_modify_a_nonempty_destination() {
    let directory = tempdir().unwrap();
    let destination = directory.path().join("existing");
    fs::create_dir(&destination).unwrap();
    let sentinel = destination.join("keep.txt");
    fs::write(&sentinel, b"keep me").unwrap();

    let error = ExampleVaultService::generate(&destination).unwrap_err();

    assert!(error.to_string().contains("must be empty"));
    assert_eq!(fs::read(&sentinel).unwrap(), b"keep me");
    assert!(!destination.join(".pixelforge-studio").exists());
}

fn files_named(root: &Path, name: &str) -> Vec<PathBuf> {
    let mut result = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let file_type = entry.file_type().unwrap();
            assert!(!file_type.is_symlink(), "sample vault contains a symlink");
            if file_type.is_dir() {
                pending.push(entry.path());
            } else if entry.file_name() == name {
                result.push(entry.path());
            }
        }
    }
    result.sort();
    result
}

fn copy_tree(source: &Path, destination: &Path) {
    fs::create_dir(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let file_type = entry.file_type().unwrap();
        assert!(!file_type.is_symlink(), "sample vault contains a symlink");
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}
