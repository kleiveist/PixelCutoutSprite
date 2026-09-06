use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;
use pixel_cutout_sprite_studio_lib::application::{
    AppearanceService, AreaService, AssetService, BindingService, ExampleMotion,
    ExampleVaultService, ExportOutputFormat, ExportProfileService, MotionCardStatus, MotionService,
    NpcExportService, OutfitDraftEdits, OutfitTarget, ProjectService, SetCharacterStatusRequest,
    StartNpcExportRequest, VaultService,
};
use pixel_cutout_sprite_studio_lib::commands;
use pixel_cutout_sprite_studio_lib::domain::{
    parse_document, Appearance, CharacterStatus, Direction, DomainDocument, EffectiveSourceKind,
    Equipment, ExportManifest, FollowMode, LoopMode, ObjectId, PixelRect, ReviewState, RevisionRef,
    SlotRef,
};
use pixel_cutout_sprite_studio_lib::exports::NeverCancel;
use pixel_cutout_sprite_studio_lib::storage::{object_folder, VaultRoot};
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
    let mira_character_id = mira.character.id;
    let mira_appearance_id = mira.character.default_appearance_id;
    let borin_character_id = borin.character.id;
    let borin_appearance_id = borin.character.default_appearance_id;
    assert_ne!(mira_appearance_id, borin_appearance_id);

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

    let mira_outcome = outcome
        .npcs
        .iter()
        .find(|npc| npc.character_id == mira_character_id)
        .unwrap();
    let borin_outcome = outcome
        .npcs
        .iter()
        .find(|npc| npc.character_id == borin_character_id)
        .unwrap();
    let mira_build = root
        .resolve(Path::new(&mira_outcome.generic_build))
        .unwrap();
    let borin_build = root
        .resolve(Path::new(&borin_outcome.generic_build))
        .unwrap();
    let mira_manifest = load_export_manifest(mira_build.as_path());
    let borin_manifest = load_export_manifest(borin_build.as_path());

    assert_complete_sample_sets_without_duplicate_loop_end(&mira_manifest, mira_build.as_path());
    assert_preview_matches_every_exported_frame(
        &root,
        &area_path,
        mira_character_id,
        &outcome.motions,
        mira_build.as_path(),
        &mira_manifest,
    );
    assert_shared_motions_keep_distinct_appearances(
        mira_appearance_id,
        borin_appearance_id,
        &mira_manifest,
        mira_build.as_path(),
        &borin_manifest,
        borin_build.as_path(),
    );

    let borin_appearance = load_appearance(
        &root,
        &area_path,
        "Borin",
        borin_character_id,
        borin_appearance_id,
    );
    assert_disabled_equipment_is_absent_from_preview_and_export(
        &root,
        &area_path,
        mira_character_id,
        &outcome.motions,
        &mira_manifest,
        mira_build.as_path(),
        borin_appearance.equipment[0].clone(),
    );

    vaults.close(opened.session_id).unwrap();
    assert_global_admin_contains_no_project_sources(&vault_path);

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

type FrameKey = (String, Direction, u16);

fn load_export_manifest(build: &Path) -> ExportManifest {
    let DomainDocument::ExportManifest(manifest) =
        parse_document(&fs::read(build.join("animation.json")).unwrap()).unwrap()
    else {
        panic!("animation.json has the wrong document kind");
    };
    *manifest
}

fn load_appearance(
    root: &VaultRoot,
    area_path: &Path,
    name: &str,
    character_id: ObjectId,
    appearance_id: ObjectId,
) -> Appearance {
    let character_folder = area_path.join(object_folder(name, character_id).unwrap());
    let path = root
        .resolve(&character_folder.join("appearances/default.json"))
        .unwrap();
    let DomainDocument::Appearance(appearance) =
        parse_document(&fs::read(path.as_path()).unwrap()).unwrap()
    else {
        panic!("default appearance has the wrong document kind");
    };
    assert_eq!(appearance.id, appearance_id);
    appearance
}

fn exported_frame_pixels(build: &Path, manifest: &ExportManifest) -> HashMap<FrameKey, Vec<u8>> {
    let pages = manifest
        .pages
        .iter()
        .map(|page| {
            let image = image::open(build.join(page.file.as_str()))
                .unwrap()
                .to_rgba8();
            assert_eq!(
                image.dimensions(),
                (u32::from(page.size_px.0), u32::from(page.size_px.1))
            );
            (page.id.clone(), image)
        })
        .collect::<HashMap<String, RgbaImage>>();
    manifest
        .frames
        .iter()
        .map(|frame| {
            let page = pages.get(&frame.page_id).unwrap();
            let PixelRect(x, y, width, height) = frame.rect_px;
            let rgba = image::imageops::crop_imm(
                page,
                u32::from(x),
                u32::from(y),
                u32::from(width),
                u32::from(height),
            )
            .to_image()
            .into_raw();
            (
                (
                    frame.action_key.as_str().to_owned(),
                    frame.direction,
                    frame.sample_index,
                ),
                rgba,
            )
        })
        .collect()
}

fn assert_complete_sample_sets_without_duplicate_loop_end(manifest: &ExportManifest, build: &Path) {
    let pixels = exported_frame_pixels(build, manifest);
    for action in &manifest.actions {
        for direction in &action.directions {
            let mut samples = manifest
                .frames
                .iter()
                .filter(|frame| {
                    frame.action_key == action.action_key && frame.direction == *direction
                })
                .map(|frame| frame.sample_index)
                .collect::<Vec<_>>();
            samples.sort_unstable();
            assert_eq!(samples, (0..action.frame_count).collect::<Vec<_>>());
            assert!(!samples.contains(&action.frame_count));

            if action.loop_mode == LoopMode::Loop && action.frame_count > 1 {
                let first = pixels
                    .get(&(action.action_key.as_str().to_owned(), *direction, 0))
                    .unwrap();
                let last = pixels
                    .get(&(
                        action.action_key.as_str().to_owned(),
                        *direction,
                        action.frame_count - 1,
                    ))
                    .unwrap();
                assert_ne!(
                    first, last,
                    "{} {:?} duplicates its first image as a terminal loop frame",
                    action.action_key, direction
                );
            }
        }
    }
}

fn assert_preview_matches_every_exported_frame(
    root: &VaultRoot,
    area_path: &Path,
    character_id: ObjectId,
    motions: &[ExampleMotion],
    build: &Path,
    manifest: &ExportManifest,
) {
    let expected = exported_frame_pixels(build, manifest);
    let template_refs = motions
        .iter()
        .map(|motion| (motion.action_key.as_str(), motion.template_ref))
        .collect::<HashMap<_, _>>();

    for action in &manifest.actions {
        let draft = AppearanceService
            .start_draft(
                root,
                area_path,
                template_refs[action.action_key.as_str()],
                OutfitTarget::ExistingNpc { character_id },
            )
            .unwrap();
        for frame in manifest
            .frames
            .iter()
            .filter(|frame| frame.action_key == action.action_key)
        {
            let preview = AppearanceService
                .render_preview(
                    root,
                    area_path,
                    draft.draft.id,
                    frame.direction,
                    frame.sample_index,
                    None,
                )
                .unwrap();
            let PixelRect(_, _, width, height) = frame.rect_px;
            assert_eq!(preview.width, u32::from(width));
            assert_eq!(preview.height, u32::from(height));
            assert!(!preview.guides_included);
            assert_eq!(
                preview.rgba,
                expected[&(
                    frame.action_key.as_str().to_owned(),
                    frame.direction,
                    frame.sample_index,
                )],
                "preview differs from export at {}/{:?}/{}",
                frame.action_key,
                frame.direction,
                frame.sample_index
            );
        }
    }
}

fn assert_shared_motions_keep_distinct_appearances(
    mira_appearance_id: ObjectId,
    borin_appearance_id: ObjectId,
    mira_manifest: &ExportManifest,
    mira_build: &Path,
    borin_manifest: &ExportManifest,
    borin_build: &Path,
) {
    assert_ne!(mira_appearance_id, borin_appearance_id);
    assert_eq!(
        mira_manifest
            .sources
            .motion
            .iter()
            .copied()
            .collect::<HashSet<_>>(),
        borin_manifest
            .sources
            .motion
            .iter()
            .copied()
            .collect::<HashSet<_>>()
    );
    let key = ("walk".to_owned(), Direction::S, 0);
    assert_ne!(
        exported_frame_pixels(mira_build, mira_manifest)[&key],
        exported_frame_pixels(borin_build, borin_manifest)[&key],
        "different persisted appearances must produce different NPC pixels"
    );
}

fn assert_disabled_equipment_is_absent_from_preview_and_export(
    root: &VaultRoot,
    area_path: &Path,
    character_id: ObjectId,
    motions: &[ExampleMotion],
    original_manifest: &ExportManifest,
    original_build: &Path,
    mut disabled_equipment: Equipment,
) {
    let disabled_assets = equipment_references(&disabled_equipment);
    assert!(!disabled_assets.is_empty());
    assert!(disabled_assets
        .iter()
        .all(|reference| !original_manifest.sources.assets.contains(reference)));

    disabled_equipment.id = ObjectId::new();
    disabled_equipment.name = "Disabled shield acceptance fixture".to_owned();
    disabled_equipment.enabled = false;
    disabled_equipment.additional_parts.clear();
    let walk_ref = motions
        .iter()
        .find(|motion| motion.action_key == "walk")
        .unwrap()
        .template_ref;
    let draft = AppearanceService
        .start_draft(
            root,
            area_path,
            walk_ref,
            OutfitTarget::ExistingNpc { character_id },
        )
        .unwrap();
    let mut edits = edits_from_draft(&draft.draft);
    edits.equipment.push(disabled_equipment);
    let saved = AppearanceService
        .autosave_draft(root, area_path, draft.draft.id, draft.draft.revision, edits)
        .unwrap();

    let disabled_preview = AppearanceService
        .render_preview(root, area_path, saved.draft.id, Direction::S, 0, None)
        .unwrap();
    let mut enabled_edits = edits_from_draft(&saved.draft);
    enabled_edits.equipment.last_mut().unwrap().enabled = true;
    let enabled_preview = AppearanceService
        .render_preview(
            root,
            area_path,
            saved.draft.id,
            Direction::S,
            0,
            Some(enabled_edits),
        )
        .unwrap();
    assert_ne!(
        disabled_preview.rgba, enabled_preview.rgba,
        "the disabled equipment fixture must visibly affect the enabled control preview"
    );

    let applied = AppearanceService
        .apply_to_existing_npc(root, area_path, saved.draft.id, saved.draft.revision)
        .unwrap();
    assert_eq!(applied.character.status, CharacterStatus::Draft);
    assert!(applied
        .appearance
        .equipment
        .iter()
        .any(|equipment| !equipment.enabled));
    let reviewed = BindingService
        .set_character_status(
            root,
            area_path,
            SetCharacterStatusRequest {
                character_id,
                expected_revision: applied.character.revision,
                status: CharacterStatus::Reviewed,
            },
        )
        .unwrap();
    assert_eq!(reviewed.status, CharacterStatus::Reviewed);

    let workspace = BindingService.workspace_context(root, area_path).unwrap();
    let npc = workspace
        .npcs
        .iter()
        .find(|npc| npc.character.id == character_id)
        .unwrap();
    assert!(npc
        .bindings
        .iter()
        .all(|binding| binding.binding.review_state == ReviewState::Reviewed));
    let binding_ids = npc
        .bindings
        .iter()
        .map(|binding| binding.binding.id)
        .collect::<Vec<_>>();

    let area_directory = root.resolve(area_path).unwrap();
    let sources_before = immutable_revision_files(area_directory.as_path());
    let root_motion_mode = original_manifest.actions[0].root_motion_mode;
    let jump_mode = original_manifest.actions[0].jump_mode;
    assert!(original_manifest.actions.iter().all(|action| {
        action.root_motion_mode == root_motion_mode && action.jump_mode == jump_mode
    }));
    let exported = NpcExportService
        .execute(
            root,
            area_path,
            StartNpcExportRequest {
                character_id,
                binding_ids,
                profile: original_manifest.profile.clone(),
                root_motion_mode,
                jump_mode,
                format: ExportOutputFormat::PngJson,
                include_godot_scene: false,
            },
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(exported.generic.manifest.complete);
    assert_eq!(
        sources_before,
        immutable_revision_files(area_directory.as_path())
    );
    assert!(disabled_assets.iter().all(|reference| {
        !exported.generic.manifest.sources.assets.contains(reference)
            && !exported
                .generic
                .manifest
                .effective_sources
                .iter()
                .any(|source| {
                    source.kind == EffectiveSourceKind::Asset && source.reference == *reference
                })
    }));

    let new_build = root
        .resolve(
            &area_path
                .join(object_folder("Mira", character_id).unwrap())
                .join("_exports")
                .join(exported.generic.build.as_str()),
        )
        .unwrap();
    let original_pixels = exported_frame_pixels(original_build, original_manifest);
    let new_pixels = exported_frame_pixels(new_build.as_path(), &exported.generic.manifest);
    assert_eq!(new_pixels, original_pixels);
    let key = ("walk".to_owned(), Direction::S, 0);
    assert_eq!(new_pixels[&key], disabled_preview.rgba);
    assert_ne!(new_pixels[&key], enabled_preview.rgba);
}

fn edits_from_draft(
    draft: &pixel_cutout_sprite_studio_lib::domain::OutfitDraft,
) -> OutfitDraftEdits {
    OutfitDraftEdits {
        fittings: draft.fittings.clone(),
        asset_fallback_approvals: draft.asset_fallback_approvals.clone(),
        local_overrides: draft.local_overrides.clone(),
        equipment: draft.equipment.clone(),
    }
}

fn equipment_references(equipment: &Equipment) -> HashSet<RevisionRef> {
    let mut references = Vec::<&SlotRef>::new();
    references.push(&equipment.asset);
    for fit in &equipment.fit_by_direction {
        if let Some(asset) = &fit.asset {
            references.push(asset);
        }
        references.extend(fit.variant_fittings.iter().map(|variant| &variant.asset));
    }
    references
        .into_iter()
        .map(|reference| RevisionRef {
            id: reference.asset_id,
            revision: reference.revision,
        })
        .collect()
}

fn immutable_revision_files(area: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    let mut result = BTreeMap::new();
    let mut pending = vec![area.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let file_type = entry.file_type().unwrap();
            assert!(!file_type.is_symlink());
            if file_type.is_dir() {
                pending.push(entry.path());
                continue;
            }
            let relative = entry.path().strip_prefix(area).unwrap().to_path_buf();
            if relative.components().any(|component| {
                matches!(
                    component.as_os_str().to_str(),
                    Some("profiles" | "revisions")
                )
            }) {
                result.insert(relative, fs::read(entry.path()).unwrap());
            }
        }
    }
    assert!(!result.is_empty());
    result
}

fn assert_global_admin_contains_no_project_sources(vault: &Path) {
    let admin = vault.join(".pixelforge-studio");
    let mut files = Vec::new();
    collect_relative_files(&admin, &admin, &mut files);
    let allowed = HashSet::from([
        PathBuf::from("labels.json"),
        PathBuf::from("runtime/writer.lock.json.os-lock"),
        PathBuf::from("ui.json"),
        PathBuf::from("vault.json"),
    ]);
    assert!(files.contains(&PathBuf::from("vault.json")));
    assert!(files.contains(&PathBuf::from("labels.json")));
    assert!(files.iter().all(|path| allowed.contains(path)));
    assert!(files
        .iter()
        .all(|path| path.extension().is_none_or(|extension| extension != "png")));
}

fn collect_relative_files(root: &Path, directory: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let file_type = entry.file_type().unwrap();
        assert!(!file_type.is_symlink());
        if file_type.is_dir() {
            collect_relative_files(root, &entry.path(), files);
        } else {
            files.push(entry.path().strip_prefix(root).unwrap().to_path_buf());
        }
    }
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
