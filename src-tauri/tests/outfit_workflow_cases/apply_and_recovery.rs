#[test]
fn existing_npc_apply_writes_only_the_edited_scope_and_a_noop_only_assigns_the_draft() {
    let local_fixture = OutfitFixture::new();
    let local_saved = local_fixture.save_npc("Local Scope");
    let (local_character, local_appearance, local_binding) = npc_paths(&local_saved);
    let character_before = fs::read(
        local_fixture
            .root
            .resolve(&local_character)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let appearance_before = fs::read(
        local_fixture
            .root
            .resolve(&local_appearance)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let binding_before = fs::read(
        local_fixture
            .root
            .resolve(&local_binding)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let existing = local_fixture.start_existing(local_saved.character.id);
    let local = AppearanceService
        .autosave_draft(
            &local_fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            OutfitDraftEdits {
                fittings: existing.draft.fittings.clone(),
                asset_fallback_approvals: existing.draft.asset_fallback_approvals.clone(),
                local_overrides: vec![OutfitLocalOverride {
                    slot_id: SlotId::parse("hand_l").unwrap(),
                    direction: Direction::S,
                    transform: transform(3, 0, 0.0),
                }],
            },
        )
        .unwrap();
    let applied = AppearanceService
        .apply_to_existing_npc(
            &local_fixture.root,
            Path::new(AREA_PATH),
            local.draft.id,
            local.draft.revision,
        )
        .unwrap();
    assert_eq!(applied.character.revision, local_saved.character.revision);
    assert_eq!(applied.appearance.revision, local_saved.appearance.revision);
    assert_eq!(applied.binding.revision, local_saved.binding.revision + 1);
    assert_eq!(
        fs::read(
            local_fixture
                .root
                .resolve(&local_character)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        character_before
    );
    assert_eq!(
        fs::read(
            local_fixture
                .root
                .resolve(&local_appearance)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        appearance_before
    );
    assert_ne!(
        fs::read(
            local_fixture
                .root
                .resolve(&local_binding)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        binding_before
    );

    let shared_fixture = OutfitFixture::new();
    let shared_saved = shared_fixture.save_npc("Shared Scope");
    let (_, _, shared_binding) = npc_paths(&shared_saved);
    let binding_before = fs::read(
        shared_fixture
            .root
            .resolve(&shared_binding)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let existing = shared_fixture.start_existing(shared_saved.character.id);
    let mut fittings = existing.draft.fittings.clone();
    fittings[0].transform = transform(2, 0, 0.0);
    let shared = AppearanceService
        .autosave_draft(
            &shared_fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: existing.draft.asset_fallback_approvals.clone(),
                local_overrides: existing.draft.local_overrides.clone(),
            },
        )
        .unwrap();
    let applied = AppearanceService
        .apply_to_existing_npc(
            &shared_fixture.root,
            Path::new(AREA_PATH),
            shared.draft.id,
            shared.draft.revision,
        )
        .unwrap();
    assert_eq!(
        applied.appearance.revision,
        shared_saved.appearance.revision + 1
    );
    assert_eq!(applied.binding.revision, shared_saved.binding.revision);
    assert_eq!(
        fs::read(
            shared_fixture
                .root
                .resolve(&shared_binding)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        binding_before
    );

    let approval_fixture = OutfitFixture::new();
    let approval_saved = approval_fixture.save_npc("Approval Scope");
    let (approval_character, approval_appearance, approval_binding) = npc_paths(&approval_saved);
    let character_before = fs::read(
        approval_fixture
            .root
            .resolve(&approval_character)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let binding_before = fs::read(
        approval_fixture
            .root
            .resolve(&approval_binding)
            .unwrap()
            .as_path(),
    )
    .unwrap();
    let east_revision_path = approval_fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/e/revision.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&east_revision_path).unwrap();
    let DomainDocument::AssetRevision(mut east_revision) = loaded.value else {
        panic!("fixture asset revision has the wrong document kind");
    };
    east_revision.sprite_mirroring_allowed = true;
    JsonStore::default()
        .compare_and_swap(
            &east_revision_path,
            &loaded.stamp,
            &DomainDocument::AssetRevision(east_revision),
        )
        .unwrap();
    let existing = approval_fixture.start_existing(approval_saved.character.id);
    let approval = AssetFallbackApproval {
        slot_id: SlotId::parse("hand_l").unwrap(),
        target_direction: Direction::W,
        source_direction: Direction::E,
        variant: "base".to_owned(),
    };
    let changed = AppearanceService
        .autosave_draft(
            &approval_fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            OutfitDraftEdits {
                fittings: existing.draft.fittings.clone(),
                asset_fallback_approvals: vec![approval.clone()],
                local_overrides: existing.draft.local_overrides.clone(),
            },
        )
        .unwrap();
    let applied = AppearanceService
        .apply_to_existing_npc(
            &approval_fixture.root,
            Path::new(AREA_PATH),
            changed.draft.id,
            changed.draft.revision,
        )
        .unwrap();
    assert_eq!(
        applied.appearance.revision,
        approval_saved.appearance.revision + 1
    );
    assert_eq!(applied.appearance.asset_fallback_approvals, vec![approval]);
    assert_eq!(
        fs::read(
            approval_fixture
                .root
                .resolve(&approval_character)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        character_before
    );
    assert_eq!(
        fs::read(
            approval_fixture
                .root
                .resolve(&approval_binding)
                .unwrap()
                .as_path()
        )
        .unwrap(),
        binding_before
    );
    assert!(approval_fixture
        .root
        .resolve(&approval_appearance)
        .unwrap()
        .as_path()
        .is_file());

    let noop_fixture = OutfitFixture::new();
    let noop_saved = noop_fixture.save_npc("Noop Scope");
    let paths = npc_paths(&noop_saved);
    let bytes_before = [&paths.0, &paths.1, &paths.2]
        .map(|path| fs::read(noop_fixture.root.resolve(path).unwrap().as_path()).unwrap());
    let existing = noop_fixture.start_existing(noop_saved.character.id);
    let applied = AppearanceService
        .apply_to_existing_npc(
            &noop_fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
        )
        .unwrap();
    assert_eq!(applied.character.revision, noop_saved.character.revision);
    assert_eq!(applied.appearance.revision, noop_saved.appearance.revision);
    assert_eq!(applied.binding.revision, noop_saved.binding.revision);
    let bytes_after = [&paths.0, &paths.1, &paths.2]
        .map(|path| fs::read(noop_fixture.root.resolve(path).unwrap().as_path()).unwrap());
    assert_eq!(bytes_after, bytes_before);
    let transaction_dir = noop_fixture.root.path().join("game/.project/transactions");
    let journal_path = fs::read_dir(transaction_dir)
        .unwrap()
        .filter_map(Result::ok)
        .find(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.starts_with("outfit-apply--") && name.ends_with(".json"))
        })
        .unwrap()
        .path();
    let journal: TransactionJournal =
        serde_json::from_slice(&fs::read(journal_path).unwrap()).unwrap();
    assert_eq!(journal.steps.len(), 1);
    assert_eq!(journal.cursor, 1);
}
#[test]
fn existing_npc_apply_rejects_same_revision_external_edits_before_any_write() {
    for source in ["character", "appearance", "binding"] {
        let fixture = OutfitFixture::new();
        let saved = fixture.save_npc(&format!("External {source}"));
        let existing = fixture.start_existing(saved.character.id);
        let paths = npc_paths(&saved);
        let changed_path = match source {
            "character" => &paths.0,
            "appearance" => &paths.1,
            "binding" => &paths.2,
            _ => unreachable!(),
        };
        let resolved = fixture.root.resolve(changed_path).unwrap();
        let loaded = JsonStore::default().load(&resolved).unwrap();
        let changed = match loaded.value {
            DomainDocument::Character(mut value) => {
                value.description = "external same-revision change".to_owned();
                DomainDocument::Character(value)
            }
            DomainDocument::Appearance(mut value) => {
                value.name = "External".to_owned();
                DomainDocument::Appearance(value)
            }
            DomainDocument::AnimationBinding(mut value) => {
                value.review_state = ReviewState::Reviewed;
                DomainDocument::AnimationBinding(value)
            }
            _ => unreachable!(),
        };
        JsonStore::default().write(&resolved, &changed).unwrap();
        let before = [&paths.0, &paths.1, &paths.2]
            .map(|path| fs::read(fixture.root.resolve(path).unwrap().as_path()).unwrap());

        let result = AppearanceService.apply_to_existing_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
        );
        assert!(
            matches!(result, Err(AppearanceServiceError::InvalidState(ref message)) if message.contains("content changed")),
            "unexpected {source} result: {result:?}"
        );
        let after = [&paths.0, &paths.1, &paths.2]
            .map(|path| fs::read(fixture.root.resolve(path).unwrap().as_path()).unwrap());
        assert_eq!(after, before, "{source} conflict changed an NPC document");
    }
}

#[test]
fn duplicate_action_bindings_are_rejected_at_start_and_apply() {
    let start_fixture = OutfitFixture::new();
    let saved = start_fixture.save_npc("Duplicate Start");
    install_duplicate_binding(&start_fixture.root, &saved);
    assert!(matches!(
        AppearanceService.start_draft(
            &start_fixture.root,
            Path::new(AREA_PATH),
            start_fixture.template_ref,
            OutfitTarget::ExistingNpc {
                character_id: saved.character.id,
            },
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("duplicate bindings")
    ));

    let apply_fixture = OutfitFixture::new();
    let saved = apply_fixture.save_npc("Duplicate Apply");
    let existing = apply_fixture.start_existing(saved.character.id);
    install_duplicate_binding(&apply_fixture.root, &saved);
    assert!(matches!(
        AppearanceService.apply_to_existing_npc(
            &apply_fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("duplicate bindings")
    ));
}

#[test]
fn corrupt_or_future_managed_drafts_fail_launch_instead_of_disappearing() {
    for bytes in [
        b"{".as_slice(),
        br#"{"schema_version":99,"kind":"outfit_draft"}"#,
    ] {
        let fixture = OutfitFixture::new();
        let draft = AppearanceService
            .start_draft(
                &fixture.root,
                Path::new(AREA_PATH),
                fixture.template_ref,
                OutfitTarget::NewNpc,
            )
            .unwrap();
        let path = fixture
            .root
            .resolve(
                &Path::new(AREA_PATH)
                    .join(".area/drafts")
                    .join(format!("outfit--{}.json", draft.draft.id)),
            )
            .unwrap();
        fs::write(path.as_path(), bytes).unwrap();
        assert!(AppearanceService
            .launch_context(&fixture.root, Path::new(AREA_PATH), fixture.template_ref)
            .is_err());
        assert_eq!(fs::read(path.as_path()).unwrap(), bytes);
    }
}

#[test]
fn resumable_draft_rejects_a_deleted_asset_reference_without_mutating_the_draft() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let draft_path = fixture
        .root
        .resolve(
            &Path::new(AREA_PATH)
                .join(".area/drafts")
                .join(format!("outfit--{}.json", assigned.draft.id)),
        )
        .unwrap();
    let before = fs::read(draft_path.as_path()).unwrap();
    let revision = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/s/revision.json"))
        .unwrap();
    fs::remove_file(revision.as_path()).unwrap();

    assert!(matches!(
        AppearanceService.resume_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("is missing")
    ));
    assert_eq!(fs::read(draft_path.as_path()).unwrap(), before);
}
