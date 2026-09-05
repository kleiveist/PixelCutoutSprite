#[test]
fn preview_guides_follow_direction_parent_hierarchy_and_sampled_frame_motion() {
    let fixture = OutfitFixture::new();
    let torso = SlotId::parse("torso_lower").unwrap();
    let profile_path = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/profiles/humanoid/r0001.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&profile_path).unwrap();
    let DomainDocument::ProfileRevision(mut profile) = loaded.value else {
        panic!("fixture profile path has the wrong document kind");
    };
    profile.slots[0].parent_id = Some(torso.clone());
    profile.slots.insert(
        0,
        SlotDefinition {
            id: torso.clone(),
            parent_id: None,
            optional: true,
            size_px: PixelSize(2, 2),
            pivot_px: PixelPoint(1, 1),
            base_transform: transform(0, 0, 0.0),
        },
    );
    for view in &mut profile.views {
        view.layer_order.insert(0, torso.clone());
        view.base_transforms.insert(
            0,
            ViewTransform {
                slot_id: torso.clone(),
                transform: transform(0, 0, 0.0),
            },
        );
    }
    JsonStore::default()
        .compare_and_swap(
            &profile_path,
            &loaded.stamp,
            &DomainDocument::ProfileRevision(profile),
        )
        .unwrap();
    let motion_path = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/templates/walk/revisions/r0001.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&motion_path).unwrap();
    let DomainDocument::MotionRevision(mut motion) = loaded.value else {
        panic!("fixture motion path has the wrong document kind");
    };
    motion.tracks.push(MotionTrack {
        direction: Direction::S,
        slot_id: torso,
        property: TrackProperty::OffsetXPx,
        interpolation: Interpolation::Linear,
        keys: vec![
            Keyframe {
                frame: 0,
                value: TrackValue::Number(0.0),
            },
            Keyframe {
                frame: 1,
                value: TrackValue::Number(1.0),
            },
        ],
    });
    JsonStore::default()
        .compare_and_swap(
            &motion_path,
            &loaded.stamp,
            &DomainDocument::MotionRevision(motion),
        )
        .unwrap();
    let assigned = fixture.start_and_assign();

    let first = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            0,
            None,
        )
        .unwrap();
    let second = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            1,
            None,
        )
        .unwrap();
    let hand = SlotId::parse("hand_l").unwrap();
    let first = first
        .guides
        .iter()
        .find(|guide| guide.slot_id == hand)
        .unwrap();
    let second = second
        .guides
        .iter()
        .find(|guide| guide.slot_id == hand)
        .unwrap();
    assert!(first.dummy_transform[0].abs() < 1.0e-9);
    assert!((first.dummy_transform[1] - 1.0).abs() < 1.0e-9);
    assert!((second.dummy_transform[4] - first.dummy_transform[4] - 1.0).abs() < 1.0e-9);
    assert_eq!(second.image_transform, second.dummy_transform);
}
#[test]
fn outfit_preview_keeps_the_released_ground_shadow_anchored_outside_profile_guides() {
    let fixture = OutfitFixture::new();
    let motion_path = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/templates/walk/revisions/r0001.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&motion_path).unwrap();
    let DomainDocument::MotionRevision(mut motion) = loaded.value else {
        panic!("fixture motion path contains the wrong document kind");
    };
    motion.semantics = Some(MotionSemantics {
        preset: MotionPresetKind::Jump,
        root_motion: RootMotionMode::InPlace,
        recommended_speed_px_per_second: None,
        jump_height_mode: JumpHeightMode::ExternalGameMotion,
        ground_shadow: Some(GroundShadow {
            enabled: true,
            width_px: 3,
            height_px: 1,
            opacity: 77,
        }),
        helpers: Vec::new(),
    });
    JsonStore::default()
        .compare_and_swap(
            &motion_path,
            &loaded.stamp,
            &DomainDocument::MotionRevision(motion),
        )
        .unwrap();
    let draft = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::NewNpc,
        )
        .unwrap();

    let preview = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            draft.draft.id,
            Direction::S,
            0,
            None,
        )
        .unwrap();
    assert!(preview
        .rgba
        .chunks_exact(4)
        .any(|pixel| pixel == [18, 17, 22, 77]));
    assert_eq!(preview.guides.len(), 1);
    assert_eq!(preview.guides[0].slot_id.as_str(), "hand_l");
    assert!(!preview.guides_included);
}

#[test]
fn saving_creates_stable_character_appearance_and_first_binding_without_copying_motion() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let saved = AppearanceService
        .save_as_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            SaveNpcRequest {
                name: "Mara".to_owned(),
                description: "Village smith".to_owned(),
                label_ids: vec![fixture.label_id],
            },
        )
        .unwrap();
    assert_eq!(saved.character.area_id, fixture.area_id);
    assert_eq!(saved.character.profile_ref, fixture.profile_ref);
    assert_eq!(saved.character.label_ids, vec![fixture.label_id]);
    assert_eq!(saved.appearance.character_id, saved.character.id);
    assert_eq!(saved.binding.character_id, saved.character.id);
    assert_eq!(saved.binding.appearance_id, saved.appearance.id);
    assert_eq!(saved.binding.template_ref, fixture.template_ref);
    assert_ne!(saved.binding.id, saved.binding.template_ref.id);
    assert_eq!(saved.appearance.slots[0].fit_by_direction.len(), 8);
    assert!(saved.appearance.slots[0]
        .fit_by_direction
        .iter()
        .all(|fit| fit.asset.is_some() && fit.pivot_px.is_some()));
    assert_eq!(saved.draft.status, OutfitDraftStatus::Assigned);

    let character_folder = PathBuf::from(&saved.character_folder);
    assert!(fixture
        .root
        .resolve(&character_folder.join("character.json"))
        .unwrap()
        .as_path()
        .is_file());
    assert!(fixture
        .root
        .resolve(&character_folder.join("appearances/default.json"))
        .unwrap()
        .as_path()
        .is_file());
    let copied_motion = fixture
        .root
        .resolve(&character_folder.join("motion-revision.json"))
        .unwrap();
    assert!(!copied_motion.as_path().exists());

    let transaction_dir = fixture.root.path().join("game/.project/transactions");
    let transaction_file = fs::read_dir(&transaction_dir)
        .unwrap()
        .filter_map(Result::ok)
        .find_map(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            (entry.file_type().ok()?.is_file()
                && name.starts_with("outfit-save--")
                && name.ends_with(".json"))
            .then(|| entry.path())
        })
        .expect("outfit save transaction journal");
    let journal: TransactionJournal =
        serde_json::from_slice(&fs::read(transaction_file).unwrap()).unwrap();
    assert_eq!(journal.state, TransactionState::Committed);
    assert_eq!(journal.cursor, journal.steps.len());

    let launch = AppearanceService
        .launch_context(&fixture.root, Path::new(AREA_PATH), fixture.template_ref)
        .unwrap();
    assert_eq!(launch.compatible_characters.len(), 1);
    assert_eq!(launch.compatible_characters[0].id, saved.character.id);
    let existing = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::ExistingNpc {
                character_id: saved.character.id,
            },
        )
        .unwrap();
    assert_eq!(existing.draft.character_id, Some(saved.character.id));
    assert_eq!(existing.affected_binding_count, 1);
    assert_eq!(existing.draft.fittings.len(), 8);
    assert!(matches!(
        AppearanceService.save_as_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            SaveNpcRequest {
                name: "Accidental duplicate".to_owned(),
                description: String::new(),
                label_ids: Vec::new(),
            },
        ),
        Err(AppearanceServiceError::InvalidState(message))
            if message.contains("existing NPC")
    ));

    let mut existing_edits = OutfitDraftEdits {
        fittings: existing.draft.fittings.clone(),
        asset_fallback_approvals: existing.draft.asset_fallback_approvals.clone(),
        local_overrides: vec![OutfitLocalOverride {
            slot_id: SlotId::parse("hand_l").unwrap(),
            direction: Direction::S,
            transform: transform(1, 0, 2.0),
        }],
    };
    existing_edits
        .fittings
        .iter_mut()
        .find(|fit| fit.direction == Direction::S)
        .unwrap()
        .transform = transform(2, 1, 4.0);
    let existing = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            existing_edits,
        )
        .unwrap();
    let applied = AppearanceService
        .apply_to_existing_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
        )
        .unwrap();
    assert_eq!(applied.character.id, saved.character.id);
    assert_eq!(applied.appearance.id, saved.appearance.id);
    assert_eq!(applied.binding.id, saved.binding.id);
    assert_eq!(applied.character.revision, 1);
    assert_eq!(applied.appearance.revision, 2);
    assert_eq!(applied.binding.revision, 2);
    assert_eq!(applied.binding.local_overrides.len(), 1);
    assert_eq!(applied.draft.status, OutfitDraftStatus::Assigned);
    assert_eq!(
        applied.appearance.slots[0]
            .fit_by_direction
            .iter()
            .find(|fit| fit.direction == Direction::S)
            .unwrap()
            .transform,
        transform(2, 1, 4.0)
    );

    let apply_journal = fs::read_dir(&transaction_dir)
        .unwrap()
        .filter_map(Result::ok)
        .find(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.starts_with("outfit-apply--") && name.ends_with(".json"))
        })
        .unwrap();
    let journal: TransactionJournal =
        serde_json::from_slice(&fs::read(apply_journal.path()).unwrap()).unwrap();
    assert_eq!(journal.state, TransactionState::Committed);
    assert_eq!(journal.cursor, 3);
}
