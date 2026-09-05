use super::*;
use pixel_cutout_sprite_studio_lib::application::{
    AddBindingRequest, AdoptBindingRevisionRequest, DuplicateNpcRequest, ExportOutputFormat,
    NpcCompleteness, NpcExportError, NpcExportService, NpcExportStatus, RenameNpcRequest,
    ReviewBindingRequest, RevisionCompatibility, SetCharacterStatusRequest, StartNpcExportRequest,
    UpdateBindingOverridesRequest,
};
use pixel_cutout_sprite_studio_lib::exports::{
    CancellationFlag, ExportError, ExportService, ExportStage, NeverCancel,
};

#[test]
fn one_npc_keeps_walk_sprint_and_jump_with_explicit_variant_keys() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Villager 01");
    let sprint = seed_released_motion(&fixture, "sprint", "Sprint");
    let jump = seed_released_motion(&fixture, "jump", "Jump");
    set_required_actions(&fixture, &saved, &["walk", "sprint", "jump"]);

    let before = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(before.npcs[0].completeness, NpcCompleteness::MissingActions);
    assert_eq!(
        action_names(&before.npcs[0].missing_actions),
        vec!["sprint", "jump"]
    );

    let sprint_binding = add_motion(&fixture, saved.character.id, sprint, None).unwrap();
    assert_eq!(sprint_binding.appearance_id, saved.appearance.id);
    let sprint_folder = Path::new(&saved.character_folder)
        .join(object_folder(sprint_binding.action_key.as_str(), sprint_binding.id).unwrap());
    assert_committed_directory_journal(
        &fixture,
        "binding-add",
        TransactionAction::Create,
        &sprint_folder,
        None,
    );
    let jump_binding = add_motion(&fixture, saved.character.id, jump, None).unwrap();
    assert_eq!(jump_binding.appearance_id, saved.appearance.id);
    assert!(matches!(
        add_motion(&fixture, saved.character.id, sprint, None),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("already has")
    ));
    let variant = add_motion(&fixture, saved.character.id, sprint, Some("sprint_fast")).unwrap();
    assert_eq!(variant.action_key.as_str(), "sprint_fast");

    let context = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    let villager = &context.npcs[0];
    assert_eq!(villager.character.name, "Villager 01");
    assert_eq!(villager.labels[0].id, fixture.label_id);
    assert_eq!(villager.completeness, NpcCompleteness::Complete);
    assert!(villager.missing_actions.is_empty());
    assert_eq!(villager.export_status, NpcExportStatus::NotExported);
    assert_eq!(villager.bindings.len(), 4);
    assert!(villager.bindings.iter().all(|view| {
        view.covered_directions == Direction::ALL && view.missing_directions.is_empty()
    }));
    assert_ne!(sprint_binding.id, jump_binding.id);
    let root = fixture
        .root
        .resolve(Path::new(&saved.character_folder))
        .unwrap();
    let binding_files = fs::read_dir(root.as_path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().join("binding.json").is_file())
        .count();
    assert_eq!(binding_files, 4);
}

#[test]
fn revision_adoption_is_explicit_and_rejects_equipment_outside_the_new_frame_range() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let equipment_assets = seed_equipment_assets(
        &fixture,
        "revision-glove",
        "hand_l",
        AssetKind::Equipment,
        205,
    );
    let mut piece = equipment_piece("Revision glove", "hand_l", &equipment_assets, 0, |_| 0);
    piece.own_motion_enabled = true;
    piece.own_motion_tracks = vec![equipment_track(Direction::E, true, 1)];
    let equipped = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings: assigned.draft.fittings.clone(),
                asset_fallback_approvals: assigned.draft.asset_fallback_approvals.clone(),
                local_overrides: Vec::new(),
                equipment: vec![equipment_from_parts("Revision glove", vec![piece])],
            },
        )
        .unwrap();
    let saved = save_context(&fixture, &equipped, "Revision keeper");
    let revision_two = release_walk_revision(&fixture, 2, 2, 10);
    let revision_three = release_walk_revision(&fixture, 3, 1, 10);

    let offered = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    let offer = offered.npcs[0].bindings[0].revision_offer.as_ref().unwrap();
    assert_eq!(offer.template_ref, revision_two);
    assert_eq!(offer.compatibility, RevisionCompatibility::Compatible);
    assert_eq!(offer.comparison.current_frame_count, 2);
    assert_eq!(offer.comparison.candidate_frame_count, 2);
    assert_eq!(offer.comparison.current_fps, 8);
    assert_eq!(offer.comparison.candidate_fps, 10);
    assert_eq!(offer.comparison.current_covered_directions, Direction::ALL);
    assert_eq!(
        offer.comparison.candidate_covered_directions,
        Direction::ALL
    );
    assert_eq!(offer.comparison.retained_local_override_count, 0);
    assert_eq!(
        offered.npcs[0].bindings[0].binding.template_ref, fixture.template_ref,
        "a release must never move a pinned NPC automatically"
    );
    let adopted = BindingService
        .adopt_revision(
            &fixture.root,
            Path::new(AREA_PATH),
            AdoptBindingRevisionRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                template_ref: revision_two,
            },
        )
        .unwrap();
    assert_eq!(adopted.template_ref, revision_two);

    let incompatible = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    let offer = incompatible.npcs[0].bindings[0]
        .revision_offer
        .as_ref()
        .unwrap();
    assert_eq!(offer.template_ref, revision_three);
    assert_eq!(offer.compatibility, RevisionCompatibility::Incompatible);
    assert_eq!(offer.comparison.current_frame_count, 2);
    assert_eq!(offer.comparison.candidate_frame_count, 1);
    assert!(offer
        .reason
        .as_deref()
        .unwrap()
        .contains("motion key outside"));
    assert!(matches!(
        BindingService.adopt_revision(
            &fixture.root,
            Path::new(AREA_PATH),
            AdoptBindingRevisionRequest {
                binding_id: saved.binding.id,
                expected_revision: adopted.revision,
                template_ref: revision_three,
            },
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("motion key outside")
    ));
    let retained = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(
        retained.npcs[0].bindings[0].binding.template_ref,
        revision_two
    );
}

#[test]
fn revision_adoption_validates_retained_local_override_slots_and_directions() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Local revision keeper");
    assert!(matches!(
        BindingService.update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                local_overrides: vec![LocalOverride {
                    slot_id: SlotId::parse("unknown_slot").unwrap(),
                    direction: Direction::E,
                    transform: transform(1, 0, 0.0),
                }],
            },
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("unknown slot")
    ));
    let local = BindingService
        .update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                local_overrides: vec![local_override(1)],
            },
        )
        .unwrap();
    let candidate = release_walk_revision_missing(&fixture, 2, Direction::E);
    let context = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    let offer = context.npcs[0].bindings[0].revision_offer.as_ref().unwrap();
    assert_eq!(offer.compatibility, RevisionCompatibility::Incompatible);
    assert_eq!(offer.comparison.retained_local_override_count, 1);
    assert_eq!(offer.comparison.current_covered_directions, Direction::ALL);
    assert_eq!(offer.comparison.candidate_covered_directions.len(), 7);
    assert!(!offer
        .comparison
        .candidate_covered_directions
        .contains(&Direction::E));
    assert!(offer
        .reason
        .as_deref()
        .unwrap()
        .contains("unavailable direction"));
    assert!(BindingService
        .adopt_revision(
            &fixture.root,
            Path::new(AREA_PATH),
            AdoptBindingRevisionRequest {
                binding_id: saved.binding.id,
                expected_revision: local.revision,
                template_ref: candidate,
            },
        )
        .is_err());
}

#[test]
fn binding_overrides_require_a_slot_assigned_in_the_npc_appearance() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Optional-slot keeper");
    add_optional_profile_slot(&fixture, "hair");

    let context = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(
        context.npcs[0]
            .available_slots
            .iter()
            .map(SlotId::as_str)
            .collect::<Vec<_>>(),
        vec!["hand_l"]
    );
    assert!(matches!(
        BindingService.update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                local_overrides: vec![LocalOverride {
                    slot_id: SlotId::parse("hair").unwrap(),
                    direction: Direction::E,
                    transform: transform(1, 0, 0.0),
                }],
            },
        ),
        Err(AppearanceServiceError::InvalidState(message))
            if message.contains("unassigned appearance slot")
    ));
}

#[test]
fn npc_workspace_rejects_a_binding_that_bypasses_the_default_appearance() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Appearance keeper");
    mutate_saved_binding(&fixture, &saved, |binding| {
        binding.appearance_id = ObjectId::new();
    });

    assert!(matches!(
        BindingService.workspace_context(&fixture.root, Path::new(AREA_PATH)),
        Err(AppearanceServiceError::InvalidState(message))
            if message.contains("does not use") && message.contains("default appearance")
    ));
}

#[test]
fn derived_export_json_is_ignored_while_corrupt_managed_sources_still_fail_closed() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Export scanner");
    let package = Path::new(&saved.character_folder).join("exports/full-package/data");
    fs::create_dir_all(fixture.root.resolve(&package).unwrap().as_path()).unwrap();
    fs::write(
        fixture
            .root
            .resolve(&package.join("character.json"))
            .unwrap()
            .as_path(),
        b"{ definitely-not-a-domain-document",
    )
    .unwrap();
    fs::write(
        fixture
            .root
            .resolve(&package.join("current.json"))
            .unwrap()
            .as_path(),
        b"{ not-valid-json",
    )
    .unwrap();
    assert!(BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .is_ok());

    let character_path = Path::new(&saved.character_folder).join("character.json");
    fs::write(
        fixture.root.resolve(&character_path).unwrap().as_path(),
        b"{ corrupt-managed-source",
    )
    .unwrap();
    assert!(BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .is_err());
}

#[test]
fn approval_metadata_stays_current_while_binding_local_edits_stale_the_export() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Mara");
    let initial = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    seed_export(
        &fixture,
        &saved,
        initial.npcs[0].effective_source_fingerprint.clone(),
    );
    let current = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(current.npcs[0].export_status, NpcExportStatus::Current);

    let appearance_path = Path::new(&saved.character_folder).join("appearances/default.json");
    let motion_path = Path::new(AREA_PATH).join(".area/templates/walk/revisions/r0001.json");
    let appearance_before =
        fs::read(fixture.root.resolve(&appearance_path).unwrap().as_path()).unwrap();
    let motion_before = fs::read(fixture.root.resolve(&motion_path).unwrap().as_path()).unwrap();
    let reviewed = BindingService
        .review_binding(
            &fixture.root,
            Path::new(AREA_PATH),
            ReviewBindingRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
            },
        )
        .unwrap();
    let reviewed_context = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(
        reviewed_context.npcs[0].export_status,
        NpcExportStatus::Current
    );
    assert_eq!(
        reviewed_context.npcs[0].effective_source_fingerprint,
        initial.npcs[0].effective_source_fingerprint,
        "review metadata is not an effective render source"
    );
    let character = BindingService
        .set_character_status(
            &fixture.root,
            Path::new(AREA_PATH),
            SetCharacterStatusRequest {
                character_id: saved.character.id,
                expected_revision: saved.character.revision,
                status: CharacterStatus::Reviewed,
            },
        )
        .unwrap();
    assert_eq!(character.status, CharacterStatus::Reviewed);

    let local = BindingService
        .update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: reviewed.revision,
                local_overrides: vec![LocalOverride {
                    slot_id: SlotId::parse("hand_l").unwrap(),
                    direction: Direction::E,
                    transform: transform(2, 0, 0.0),
                }],
            },
        )
        .unwrap();
    assert_eq!(local.review_state, ReviewState::Draft);
    assert_eq!(
        fs::read(fixture.root.resolve(&appearance_path).unwrap().as_path()).unwrap(),
        appearance_before
    );
    assert_eq!(
        fs::read(fixture.root.resolve(&motion_path).unwrap().as_path()).unwrap(),
        motion_before
    );
    let stale = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    assert_eq!(stale.npcs[0].export_status, NpcExportStatus::Stale);
}

#[test]
fn authoritative_npc_export_renders_multiple_actions_and_current_pointer_controls_freshness() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Atlas keeper");
    let sprint_motion = seed_released_motion(&fixture, "sprint", "Sprint");
    let sprint = add_motion(&fixture, saved.character.id, sprint_motion, None).unwrap();

    let request = export_request(saved.character.id, vec![saved.binding.id, sprint.id], false);
    let first = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            request.clone(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(first.manifest.complete);
    assert_eq!(first.manifest.actions.len(), 2);
    assert_eq!(first.manifest.frames.len(), 2 * 8 * 2);
    for action in &first.manifest.actions {
        assert_eq!(action.directions, Direction::ALL);
        assert_eq!(action.frame_count, 2);
        assert_eq!(action.fps, 8);
        assert_eq!(action.ground_origin_px, PixelPoint(2, 2));
    }
    assert!(first
        .manifest
        .frames
        .iter()
        .all(|frame| frame.individual_file.is_none()));
    let output = Path::new(&saved.character_folder).join("_exports");
    let current = ExportService::new(fixture.root.clone(), env!("CARGO_PKG_VERSION"))
        .current(&output)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.manifest.source_fingerprint,
        first.manifest.source_fingerprint
    );
    assert_eq!(
        BindingService
            .workspace_context(&fixture.root, Path::new(AREA_PATH))
            .unwrap()
            .npcs[0]
            .export_status,
        NpcExportStatus::Current
    );

    let repeated = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            request,
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(repeated.reused_existing_build);
    assert_eq!(
        repeated.manifest.source_fingerprint,
        first.manifest.source_fingerprint
    );

    fs::remove_file(
        fixture
            .root
            .resolve(&output.join("current.json"))
            .unwrap()
            .as_path(),
    )
    .unwrap();
    assert_eq!(
        BindingService
            .workspace_context(&fixture.root, Path::new(AREA_PATH))
            .unwrap()
            .npcs[0]
            .export_status,
        NpcExportStatus::NotExported,
        "an orphan build must never be promoted without its managed current pointer"
    );
}

#[test]
fn real_npc_godot_export_reuses_both_variants_and_publishes_current_only_at_the_end() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Godot package keeper");
    let sprint_motion = seed_released_motion(&fixture, "sprint", "Sprint");
    let sprint = add_motion(&fixture, saved.character.id, sprint_motion, None).unwrap();
    let mut request = export_request(saved.character.id, vec![saved.binding.id, sprint.id], false);
    request.format = ExportOutputFormat::GodotPackage;

    let first = NpcExportService
        .execute(
            &fixture.root,
            Path::new(AREA_PATH),
            request.clone(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert_eq!(first.format, ExportOutputFormat::GodotPackage);
    assert!(first.generic.manifest.complete);
    let first_package = first.godot_package.as_ref().unwrap();
    assert!(!first_package.reused_existing_package);
    assert_eq!(first_package.animation_names.len(), 16);
    assert_eq!(
        first_package.scene.as_ref().unwrap().as_str(),
        "character.tscn"
    );
    let first_package_path = fixture
        .root
        .resolve(&first_package.package_directory)
        .unwrap();
    assert!(first_package_path
        .as_path()
        .join("character.tscn")
        .is_file());

    let repeated = NpcExportService
        .execute(
            &fixture.root,
            Path::new(AREA_PATH),
            request.clone(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(repeated.generic.reused_existing_build);
    assert!(
        repeated
            .godot_package
            .as_ref()
            .unwrap()
            .reused_existing_package
    );

    let mut resources_request = request.clone();
    resources_request.include_godot_scene = false;
    let resources = NpcExportService
        .execute(
            &fixture.root,
            Path::new(AREA_PATH),
            resources_request,
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(resources.generic.reused_existing_build);
    let resources_package = resources.godot_package.as_ref().unwrap();
    assert!(resources_package.scene.is_none());
    assert_ne!(
        resources_package.package_directory,
        first_package.package_directory
    );
    assert!(!fixture
        .root
        .resolve(&resources_package.package_directory)
        .unwrap()
        .as_path()
        .join("character.tscn")
        .exists());

    let output = Path::new(&saved.character_folder).join("_exports");
    let current_path = fixture.root.resolve(&output.join("current.json")).unwrap();
    let old_current = fs::read(current_path.as_path()).unwrap();
    let changed = BindingService
        .update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                local_overrides: vec![local_override(1)],
            },
        )
        .unwrap();
    assert_eq!(changed.revision, saved.binding.revision + 1);

    let cancellation = CancellationFlag::default();
    let cancel_from_progress = cancellation.clone();
    let mut progress = move |event: pixel_cutout_sprite_studio_lib::exports::ExportProgress| {
        if event.stage == ExportStage::Publishing && event.completed == 0 {
            cancel_from_progress.cancel();
        }
    };
    let cancelled = NpcExportService.execute(
        &fixture.root,
        Path::new(AREA_PATH),
        request.clone(),
        &cancellation,
        &mut progress,
    );
    assert!(matches!(
        cancelled,
        Err(NpcExportError::Export(ExportError::Cancelled))
    ));
    assert_eq!(
        fs::read(current_path.as_path()).unwrap(),
        old_current,
        "cancellation after Godot publication must preserve the previous current pointer"
    );

    let retry = NpcExportService
        .execute(
            &fixture.root,
            Path::new(AREA_PATH),
            request,
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(retry.generic.reused_existing_build);
    assert!(
        retry
            .godot_package
            .as_ref()
            .unwrap()
            .reused_existing_package
    );
    assert_ne!(
        fs::read(current_path.as_path()).unwrap(),
        old_current,
        "the successful retry must publish the new source fingerprint"
    );
    let package_parent = fixture
        .root
        .resolve(&output.join("godot-packages"))
        .unwrap();
    assert!(fs::read_dir(package_parent.as_path())
        .unwrap()
        .all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .contains(".staging")
        }));
}

#[test]
fn real_npc_godot_export_rejects_incomplete_mode_before_creating_output() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Incomplete Godot keeper");
    let mut request = export_request(saved.character.id, vec![saved.binding.id], true);
    request.format = ExportOutputFormat::GodotPackage;

    let result = NpcExportService.execute(
        &fixture.root,
        Path::new(AREA_PATH),
        request,
        &NeverCancel,
        &mut |_| {},
    );
    assert!(matches!(
        result,
        Err(NpcExportError::Invalid(message)) if message.contains("complete export")
    ));
    let binding_folder =
        object_folder(saved.binding.action_key.as_str(), saved.binding.id).unwrap();
    assert!(!fixture
        .root
        .resolve(
            &Path::new(&saved.character_folder)
                .join(binding_folder)
                .join("exports")
        )
        .unwrap()
        .as_path()
        .exists());
}

#[test]
fn incomplete_real_export_marks_a_missing_png_but_never_masks_corrupt_bytes() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Missing source keeper");
    let source = Path::new(AREA_PATH).join(".area/assets/n/source.png");
    fs::remove_file(fixture.root.resolve(&source).unwrap().as_path()).unwrap();

    let complete = NpcExportService.export(
        &fixture.root,
        Path::new(AREA_PATH),
        export_request(saved.character.id, vec![saved.binding.id], false),
        &NeverCancel,
        &mut |_| {},
    );
    assert!(
        complete.is_err(),
        "ordinary export must block a missing PNG"
    );

    let outcome = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            export_request(saved.character.id, vec![saved.binding.id], true),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    assert!(!outcome.manifest.complete);
    assert_eq!(outcome.manifest.frames.len(), 16);
    assert!(outcome
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "missing_source" && check.message.contains("PNG is missing")));
    assert!(outcome
        .manifest
        .checks
        .iter()
        .any(|check| check.code == "incomplete_export"));

    let binding_folder =
        object_folder(saved.binding.action_key.as_str(), saved.binding.id).unwrap();
    let output = Path::new(&saved.character_folder)
        .join(binding_folder)
        .join("exports");
    let exporter = ExportService::new(fixture.root.clone(), env!("CARGO_PKG_VERSION"));
    let previous = exporter.current(&output).unwrap().unwrap();
    assert_eq!(
        previous.current.source_fingerprint,
        outcome.manifest.source_fingerprint
    );
    assert_eq!(
        BindingService
            .workspace_context(&fixture.root, Path::new(AREA_PATH))
            .unwrap()
            .npcs[0]
            .export_status,
        NpcExportStatus::Stale,
        "an explicitly incomplete test build is never a current game-ready NPC export"
    );

    let corrupt_path = fixture.root.resolve(&source).unwrap();
    RgbaImage::from_pixel(1, 1, Rgba([1, 2, 3, 255]))
        .save(corrupt_path.as_path())
        .unwrap();
    let corrupt = NpcExportService.export(
        &fixture.root,
        Path::new(AREA_PATH),
        export_request(saved.character.id, vec![saved.binding.id], true),
        &NeverCancel,
        &mut |_| {},
    );
    assert!(
        corrupt
            .unwrap_err()
            .to_string()
            .contains("content hash does not match"),
        "incomplete test mode must not accept altered source bytes"
    );
    assert_eq!(
        exporter
            .current(&output)
            .unwrap()
            .unwrap()
            .current
            .source_fingerprint,
        previous.current.source_fingerprint,
        "a failed retry must preserve the last valid current pointer"
    );
}

#[test]
fn effective_fingerprint_tracks_fallback_approvals_and_variant_asset_revisions() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Fingerprint keeper");
    set_asset_mirroring(&fixture, Direction::E, true);

    let baseline = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap()
        .npcs[0]
        .effective_source_fingerprint
        .clone();
    let appearance_path = Path::new(&saved.character_folder).join("appearances/default.json");
    mutate_appearance(&fixture, &appearance_path, |appearance| {
        appearance
            .asset_fallback_approvals
            .push(AssetFallbackApproval {
                slot_id: SlotId::parse("hand_l").unwrap(),
                target_direction: Direction::W,
                source_direction: Direction::E,
                variant: "base".to_owned(),
            });
    });
    let with_approval = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap()
        .npcs[0]
        .effective_source_fingerprint
        .clone();
    assert_ne!(with_approval, baseline);

    let variant = seed_variant_asset(
        &fixture.root,
        fixture.area_id,
        fixture.profile_ref,
        &SlotId::parse("hand_l").unwrap(),
        timestamp(),
        Direction::E,
        "open",
    );
    mutate_appearance(&fixture, &appearance_path, |appearance| {
        appearance
            .slots
            .iter_mut()
            .find(|slot| slot.slot_id.as_str() == "hand_l")
            .unwrap()
            .fit_by_direction
            .iter_mut()
            .find(|fit| fit.direction == Direction::E)
            .unwrap()
            .variant_fittings
            .push(SpriteVariantFitting {
                variant: "open".to_owned(),
                asset: variant,
                pivot_px: PixelPoint(0, 0),
            });
    });
    let before_variant_revision_change = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap()
        .npcs[0]
        .effective_source_fingerprint
        .clone();
    set_asset_content_hash(&fixture, "e-open", "b");
    let after_variant_revision_change = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap()
        .npcs[0]
        .effective_source_fingerprint
        .clone();
    assert_ne!(
        after_variant_revision_change,
        before_variant_revision_change
    );
}

#[test]
fn duplicate_preserves_approved_mirror_fallbacks() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    set_asset_mirroring(&fixture, Direction::E, true);
    let east = fixture
        .assets
        .iter()
        .find(|(direction, _)| *direction == Direction::E)
        .unwrap()
        .1
        .clone();
    let mut fittings = assigned.draft.fittings.clone();
    fittings
        .iter_mut()
        .find(|fit| fit.direction == Direction::W)
        .unwrap()
        .asset = east;
    let approval = AssetFallbackApproval {
        slot_id: SlotId::parse("hand_l").unwrap(),
        target_direction: Direction::W,
        source_direction: Direction::E,
        variant: "base".to_owned(),
    };
    let mirrored = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: vec![approval.clone()],
                local_overrides: assigned.draft.local_overrides.clone(),
                equipment: assigned.draft.equipment.clone(),
            },
        )
        .unwrap();
    let saved = save_context(&fixture, &mirrored, "Mirrored Mara");

    let duplicate = BindingService
        .duplicate_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            DuplicateNpcRequest {
                character_id: saved.character.id,
                name: "Mirrored Mara Copy".to_owned(),
            },
        )
        .unwrap();

    assert_eq!(
        duplicate.appearance.asset_fallback_approvals,
        vec![approval]
    );
    assert!(BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .is_ok());
}

#[test]
fn duplicate_and_rename_preserve_shared_releases_but_not_identity_or_local_state() {
    let fixture = OutfitFixture::new();
    let saved = save_standard_npc(&fixture, "Mara");
    let local = BindingService
        .update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: saved.binding.revision,
                local_overrides: vec![local_override(2)],
            },
        )
        .unwrap();

    let duplicate = BindingService
        .duplicate_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            DuplicateNpcRequest {
                character_id: saved.character.id,
                name: "Mara Copy".to_owned(),
            },
        )
        .unwrap();
    assert_committed_directory_journal(
        &fixture,
        "npc-duplicate",
        TransactionAction::Create,
        Path::new(&duplicate.character_folder),
        None,
    );
    assert_ne!(duplicate.character.id, saved.character.id);
    assert_ne!(duplicate.appearance.id, saved.appearance.id);
    assert_ne!(duplicate.bindings[0].id, saved.binding.id);
    assert_eq!(duplicate.bindings[0].template_ref, local.template_ref);
    assert_eq!(
        duplicate.appearance.slots[0].asset,
        saved.appearance.slots[0].asset
    );

    let changed_again = BindingService
        .update_local_overrides(
            &fixture.root,
            Path::new(AREA_PATH),
            UpdateBindingOverridesRequest {
                binding_id: saved.binding.id,
                expected_revision: local.revision,
                local_overrides: vec![local_override(4)],
            },
        )
        .unwrap();

    let old_folder = saved.character_folder.clone();
    let renamed = BindingService
        .rename_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            RenameNpcRequest {
                character_id: saved.character.id,
                expected_revision: saved.character.revision,
                name: "Mara Smith".to_owned(),
            },
        )
        .unwrap();
    assert_committed_directory_journal(
        &fixture,
        "npc-rename",
        TransactionAction::Move,
        Path::new(&renamed.character_folder),
        Some(Path::new(&old_folder)),
    );
    assert!(!fixture
        .root
        .resolve(Path::new(&old_folder))
        .unwrap()
        .as_path()
        .exists());
    assert!(fixture
        .root
        .resolve(Path::new(&renamed.character_folder))
        .unwrap()
        .as_path()
        .is_dir());
    let reopened = BindingService
        .workspace_context(&fixture.root, Path::new(AREA_PATH))
        .unwrap();
    let original = reopened
        .npcs
        .iter()
        .find(|npc| npc.character.id == saved.character.id)
        .unwrap();
    let copied = reopened
        .npcs
        .iter()
        .find(|npc| npc.character.id == duplicate.character.id)
        .unwrap();
    assert_eq!(original.character.name, "Mara Smith");
    assert_eq!(original.bindings[0].binding.id, saved.binding.id);
    assert_eq!(
        original.bindings[0].binding.local_overrides,
        changed_again.local_overrides
    );
    assert_eq!(copied.bindings[0].binding.id, duplicate.bindings[0].id);
    assert_eq!(
        copied.bindings[0].binding.local_overrides,
        local.local_overrides
    );
}

fn local_override(x: i16) -> LocalOverride {
    LocalOverride {
        slot_id: SlotId::parse("hand_l").unwrap(),
        direction: Direction::E,
        transform: transform(x, 0, 0.0),
    }
}

fn mutate_appearance(fixture: &OutfitFixture, path: &Path, mutate: impl FnOnce(&mut Appearance)) {
    let resolved = fixture.root.resolve(path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::Appearance(mut appearance) = loaded.value else {
        panic!("appearance fixture has the wrong kind");
    };
    mutate(&mut appearance);
    appearance.revision += 1;
    appearance.updated_at = timestamp();
    appearance.validate().unwrap();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::Appearance(appearance),
        )
        .unwrap();
}

fn set_asset_mirroring(fixture: &OutfitFixture, direction: Direction, allowed: bool) {
    let path = Path::new(AREA_PATH).join(format!(
        ".area/assets/{}/revision.json",
        direction_name(direction)
    ));
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::AssetRevision(mut revision) = loaded.value else {
        panic!("asset revision fixture has the wrong kind");
    };
    revision.sprite_mirroring_allowed = allowed;
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::AssetRevision(revision),
        )
        .unwrap();
}

fn set_asset_content_hash(fixture: &OutfitFixture, asset_folder: &str, digit: &str) {
    let path = Path::new(AREA_PATH).join(format!(".area/assets/{asset_folder}/revision.json"));
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::AssetRevision(mut revision) = loaded.value else {
        panic!("asset revision fixture has the wrong kind");
    };
    revision.content_hash = Sha256Digest::parse(digit.repeat(64)).unwrap();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::AssetRevision(revision),
        )
        .unwrap();
}

fn assert_committed_directory_journal(
    fixture: &OutfitFixture,
    prefix: &str,
    action: TransactionAction,
    expected_target: &Path,
    expected_staged: Option<&Path>,
) {
    let directory = fixture.root.path().join("game/.project/transactions");
    let expected_target = expected_target.to_string_lossy().replace('\\', "/");
    let journal = fs::read_dir(directory)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix))
        })
        .filter_map(|path| serde_json::from_slice::<TransactionJournal>(&fs::read(path).ok()?).ok())
        .find(|journal| {
            journal.steps.len() == 1 && journal.steps[0].target.as_str() == expected_target.as_str()
        })
        .unwrap();
    assert_eq!(journal.state, TransactionState::Committed);
    assert_eq!(journal.cursor, journal.steps.len());
    let step = &journal.steps[0];
    assert_eq!(step.action, action);
    assert_eq!(step.target.as_str(), expected_target);
    if let Some(expected_staged) = expected_staged {
        assert_eq!(
            step.staged.as_str(),
            expected_staged.to_string_lossy().replace('\\', "/")
        );
    } else {
        let staged = Path::new(step.staged.as_str());
        assert_eq!(staged.parent(), Path::new(&expected_target).parent());
        let name = staged.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with('.'));
        assert!(name.ends_with(".staged"));
    }
    assert!(fixture
        .root
        .resolve(Path::new(step.target.as_str()))
        .unwrap()
        .as_path()
        .is_dir());
    assert!(!fixture
        .root
        .resolve(Path::new(step.staged.as_str()))
        .unwrap()
        .as_path()
        .exists());
}

fn mutate_saved_binding(
    fixture: &OutfitFixture,
    saved: &pixel_cutout_sprite_studio_lib::application::SavedNpc,
    mutate: impl FnOnce(&mut AnimationBinding),
) {
    let folder = object_folder(saved.binding.action_key.as_str(), saved.binding.id).unwrap();
    let path = Path::new(&saved.character_folder)
        .join(folder)
        .join("binding.json");
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::AnimationBinding(mut binding) = loaded.value else {
        panic!("saved binding path has the wrong document kind");
    };
    mutate(&mut binding);
    binding.validate().unwrap();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::AnimationBinding(binding),
        )
        .unwrap();
}

fn add_optional_profile_slot(fixture: &OutfitFixture, slot_name: &str) {
    let path = Path::new(AREA_PATH).join(".area/profiles/humanoid/r0001.json");
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::ProfileRevision(mut profile) = loaded.value else {
        panic!("profile fixture has the wrong document kind");
    };
    let slot_id = SlotId::parse(slot_name).unwrap();
    profile.slots.push(SlotDefinition {
        id: slot_id.clone(),
        parent_id: None,
        optional: true,
        size_px: PixelSize(2, 2),
        pivot_px: PixelPoint(0, 0),
        base_transform: transform(0, 0, 0.0),
    });
    for view in &mut profile.views {
        view.layer_order.push(slot_id.clone());
        view.base_transforms.push(ViewTransform {
            slot_id: slot_id.clone(),
            transform: transform(0, 0, 0.0),
        });
    }
    profile.validate().unwrap();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::ProfileRevision(profile),
        )
        .unwrap();
}

fn save_standard_npc(
    fixture: &OutfitFixture,
    name: &str,
) -> pixel_cutout_sprite_studio_lib::application::SavedNpc {
    let assigned = fixture.start_and_assign();
    save_context(fixture, &assigned, name)
}

fn save_context(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    name: &str,
) -> pixel_cutout_sprite_studio_lib::application::SavedNpc {
    AppearanceService
        .save_as_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            context.draft.id,
            context.draft.revision,
            SaveNpcRequest {
                name: name.to_owned(),
                description: "Village resident".to_owned(),
                label_ids: vec![fixture.label_id],
            },
        )
        .unwrap()
}

fn seed_released_motion(fixture: &OutfitFixture, action: &str, name: &str) -> RevisionRef {
    let template_id = ObjectId::new();
    let mut template = template_document(template_id, fixture.area_id, timestamp());
    template.name = name.to_owned();
    template.action_key = ActionKey::parse(action).unwrap();
    let motion = motion_document(template_id, fixture.profile_ref, timestamp());
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(format!(".area/templates/{action}/template.json")),
        DomainDocument::MotionTemplate(template),
    );
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(format!(".area/templates/{action}/revisions/r0001.json")),
        DomainDocument::MotionRevision(motion),
    );
    RevisionRef {
        id: template_id,
        revision: 1,
    }
}

fn release_walk_revision(
    fixture: &OutfitFixture,
    revision: u32,
    frame_count: u16,
    fps: u16,
) -> RevisionRef {
    let template_path = Path::new(AREA_PATH).join(".area/templates/walk/template.json");
    let resolved = fixture.root.resolve(&template_path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::MotionTemplate(mut template) = loaded.value else {
        panic!("walk template fixture has the wrong kind");
    };
    template.revision += 1;
    template.released_revisions.push(revision);
    template.released_revisions.sort_unstable();
    template.updated_at = timestamp();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::MotionTemplate(template),
        )
        .unwrap();
    let mut motion = motion_document(fixture.template_ref.id, fixture.profile_ref, timestamp());
    motion.revision = revision;
    motion.frame_count = frame_count;
    motion.fps = fps;
    for track in &mut motion.tracks {
        track.keys.retain(|key| key.frame < frame_count);
    }
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(format!(
            ".area/templates/walk/revisions/r{revision:04}.json"
        )),
        DomainDocument::MotionRevision(motion),
    );
    RevisionRef {
        id: fixture.template_ref.id,
        revision,
    }
}

fn release_walk_revision_missing(
    fixture: &OutfitFixture,
    revision: u32,
    missing: Direction,
) -> RevisionRef {
    let reference = release_walk_revision(fixture, revision, 2, 8);
    let path = Path::new(AREA_PATH).join(format!(
        ".area/templates/walk/revisions/r{revision:04}.json"
    ));
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::MotionRevision(mut motion) = loaded.value else {
        panic!("walk motion fixture has the wrong kind");
    };
    let direction = motion
        .directions
        .iter_mut()
        .find(|direction| direction.direction == missing)
        .unwrap();
    direction.mode = DirectionMode::Missing;
    direction.source = None;
    motion.tracks.retain(|track| track.direction != missing);
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::MotionRevision(motion),
        )
        .unwrap();
    reference
}

fn set_required_actions(
    fixture: &OutfitFixture,
    saved: &pixel_cutout_sprite_studio_lib::application::SavedNpc,
    actions: &[&str],
) {
    let path = Path::new(&saved.character_folder).join("character.json");
    let resolved = fixture.root.resolve(&path).unwrap();
    let loaded = JsonStore::default().load(&resolved).unwrap();
    let DomainDocument::Character(mut character) = loaded.value else {
        panic!("character fixture has the wrong kind");
    };
    character.revision += 1;
    character.required_actions = actions
        .iter()
        .map(|action| ActionKey::parse(*action).unwrap())
        .collect();
    character.updated_at = timestamp();
    JsonStore::default()
        .compare_and_swap(
            &resolved,
            &loaded.stamp,
            &DomainDocument::Character(character),
        )
        .unwrap();
}

fn add_motion(
    fixture: &OutfitFixture,
    character_id: ObjectId,
    template_ref: RevisionRef,
    variant: Option<&str>,
) -> Result<AnimationBinding, AppearanceServiceError> {
    BindingService.add_binding(
        &fixture.root,
        Path::new(AREA_PATH),
        AddBindingRequest {
            character_id,
            template_ref,
            variant_action_key: variant.map(|key| ActionKey::parse(key).unwrap()),
        },
    )
}

fn seed_export(
    fixture: &OutfitFixture,
    saved: &pixel_cutout_sprite_studio_lib::application::SavedNpc,
    _source_fingerprint: Sha256Digest,
) {
    NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            export_request(saved.character.id, vec![saved.binding.id], false),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
}

fn export_request(
    character_id: ObjectId,
    binding_ids: Vec<ObjectId>,
    allow_incomplete_test: bool,
) -> StartNpcExportRequest {
    StartNpcExportRequest {
        character_id,
        binding_ids,
        profile: ExportProfileSnapshot {
            name: "Test PNG + JSON".to_owned(),
            directions: Direction::ALL.to_vec(),
            max_page_size_px: AtlasSize(64, 64),
            max_pages: 16,
            memory_budget_bytes: 8 * 1024 * 1024,
            padding_px: 0,
            extrude_edges: false,
            individual_frames: false,
            include_shadow: true,
            normalize_geometry: false,
            clipping_policy: ClippingPolicy::Block,
            allow_incomplete_test,
        },
        root_motion_mode: ExportRootMotionMode::Baked,
        jump_mode: ExportJumpMode::Baked,
        format: ExportOutputFormat::PngJson,
        include_godot_scene: true,
    }
}

fn action_names(actions: &[ActionKey]) -> Vec<&str> {
    actions.iter().map(ActionKey::as_str).collect()
}
