#[test]
fn sampled_sprite_variant_requires_a_named_fitting_and_survives_npc_save_and_resume() {
    let fixture = OutfitFixture::new();
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
        slot_id: SlotId::parse("hand_l").unwrap(),
        property: TrackProperty::SpriteVariant,
        interpolation: Interpolation::Hold,
        keys: vec![
            Keyframe {
                frame: 0,
                value: TrackValue::Text("base".to_owned()),
            },
            Keyframe {
                frame: 1,
                value: TrackValue::Text("open".to_owned()),
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
    let draft = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::NewNpc,
        )
        .unwrap();
    let assigned = AppearanceService
        .auto_assign(
            &fixture.root,
            Path::new(AREA_PATH),
            draft.draft.id,
            draft.draft.revision,
            fixture
                .assets
                .iter()
                .map(|(_, asset)| asset.clone())
                .collect(),
        )
        .unwrap();
    let south_missing = assigned
        .missing_required_slots
        .iter()
        .find(|missing| missing.slot_id.as_str() == "hand_l")
        .unwrap();
    assert!(south_missing
        .missing_variants
        .iter()
        .any(|missing| missing.direction == Direction::S && missing.variant == "open"));

    assert!(matches!(
        AppearanceService.render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            1,
            None,
        ),
        Err(AppearanceServiceError::Direction(error))
            if error.to_string().contains("variant `open` is missing")
    ));

    let open = seed_variant_asset(
        &fixture.root,
        fixture.area_id,
        fixture.profile_ref,
        &SlotId::parse("hand_l").unwrap(),
        timestamp(),
        Direction::S,
        "open",
    );
    let variant_draft = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::NewNpc,
        )
        .unwrap();
    let assets = fixture
        .assets
        .iter()
        .map(|(_, asset)| asset.clone())
        .chain([open.clone()])
        .collect();
    let assigned = AppearanceService
        .auto_assign(
            &fixture.root,
            Path::new(AREA_PATH),
            variant_draft.draft.id,
            variant_draft.draft.revision,
            assets,
        )
        .unwrap();
    let south = assigned
        .draft
        .fittings
        .iter()
        .find(|fit| fit.direction == Direction::S)
        .unwrap();
    assert_eq!(south.variant_fittings.len(), 1);
    assert_eq!(south.variant_fittings[0].variant, "open");
    assert_eq!(south.variant_fittings[0].asset, open);
    assert!(assigned.missing_required_slots.iter().all(|missing| {
        !missing
            .missing_variants
            .iter()
            .any(|missing| missing.direction == Direction::S && missing.variant == "open")
    }));

    let base = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            0,
            None,
        )
        .unwrap();
    let open_frame = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            1,
            None,
        )
        .unwrap();
    assert!(base
        .rgba
        .chunks_exact(4)
        .any(|pixel| pixel == [240, 20, 30, 255]));
    assert!(open_frame
        .rgba
        .chunks_exact(4)
        .any(|pixel| pixel == [70, 220, 160, 255]));

    let saved = AppearanceService
        .save_as_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            SaveNpcRequest {
                name: "Variant Mara".to_owned(),
                description: String::new(),
                label_ids: Vec::new(),
            },
        )
        .unwrap();
    let saved_south = saved.appearance.slots[0]
        .fit_by_direction
        .iter()
        .find(|fit| fit.direction == Direction::S)
        .unwrap();
    assert_eq!(saved_south.variant_fittings[0].variant, "open");
    let resumed = fixture.start_existing(saved.character.id);
    let resumed_south = resumed
        .draft
        .fittings
        .iter()
        .find(|fit| fit.direction == Direction::S)
        .unwrap();
    assert_eq!(resumed_south.variant_fittings[0].asset, open);
}
#[test]
fn preview_resolves_mirrored_pose_but_keeps_the_exact_target_asset_unmirrored() {
    let fixture = OutfitFixture::new();
    let west_source = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/w/source.png"))
        .unwrap();
    RgbaImage::from_fn(2, 1, |x, _| {
        Rgba(if x == 0 {
            [26, 190, 80, 255]
        } else {
            [250, 210, 40, 255]
        })
    })
    .save(west_source.as_path())
    .unwrap();
    let west_revision_path = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/w/revision.json"))
        .unwrap();
    let loaded_west = JsonStore::default().load(&west_revision_path).unwrap();
    let DomainDocument::AssetRevision(mut west_revision) = loaded_west.value else {
        panic!("fixture asset revision has the wrong document kind");
    };
    west_revision.image_size_px = PixelSize(2, 1);
    JsonStore::default()
        .compare_and_swap(
            &west_revision_path,
            &loaded_west.stamp,
            &DomainDocument::AssetRevision(west_revision),
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
    let west = motion
        .directions
        .iter_mut()
        .find(|definition| definition.direction == Direction::W)
        .unwrap();
    west.mode = DirectionMode::Mirrored;
    west.source = Some(Direction::E);
    let east_offset = motion
        .tracks
        .iter_mut()
        .find(|track| {
            track.direction == Direction::E
                && track.slot_id.as_str() == "hand_l"
                && track.property == TrackProperty::OffsetXPx
        })
        .unwrap();
    east_offset.keys = vec![Keyframe {
        frame: 0,
        value: TrackValue::Number(1.0),
    }];
    JsonStore::default()
        .compare_and_swap(
            &motion_path,
            &loaded.stamp,
            &DomainDocument::MotionRevision(motion),
        )
        .unwrap();
    let assigned = fixture.start_and_assign();

    let west = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::W,
            0,
            None,
        )
        .unwrap();

    assert_eq!(pixel(&west.rgba, west.width, 1, 2), [26, 190, 80, 255]);
    assert_eq!(pixel(&west.rgba, west.width, 2, 2), [250, 210, 40, 255]);
    assert_eq!(pixel(&west.rgba, west.width, 3, 2), [0, 0, 0, 0]);
    assert_eq!(opaque_pixels(&west.rgba), 2);
}

#[test]
fn approved_mirror_target_keeps_an_independent_target_local_fitting() {
    let fixture = OutfitFixture::new();
    let east_source = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/e/source.png"))
        .unwrap();
    RgbaImage::from_fn(2, 1, |x, _| {
        Rgba(if x == 0 {
            [26, 190, 80, 255]
        } else {
            [250, 210, 40, 255]
        })
    })
    .save(east_source.as_path())
    .unwrap();
    let east_revision_path = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/e/revision.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&east_revision_path).unwrap();
    let DomainDocument::AssetRevision(mut east_revision) = loaded.value else {
        panic!("fixture asset revision has the wrong document kind");
    };
    east_revision.image_size_px = PixelSize(2, 1);
    east_revision.sprite_mirroring_allowed = true;
    JsonStore::default()
        .compare_and_swap(
            &east_revision_path,
            &loaded.stamp,
            &DomainDocument::AssetRevision(east_revision),
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
    let east_ref = fixture
        .assets
        .iter()
        .find(|(direction, _)| *direction == Direction::E)
        .unwrap()
        .1
        .clone();
    let assigned = AppearanceService
        .auto_assign(
            &fixture.root,
            Path::new(AREA_PATH),
            draft.draft.id,
            draft.draft.revision,
            vec![east_ref.clone()],
        )
        .unwrap();
    let mut fittings = assigned.draft.fittings.clone();
    fittings.push(OutfitFitting {
        slot_id: SlotId::parse("hand_l").unwrap(),
        direction: Direction::W,
        asset: east_ref,
        pivot_px: PixelPoint(1, 0),
        variant_fittings: Vec::new(),
        transform: transform(1, 0, 0.0),
        visible: true,
        layer_delta: 0,
    });
    let saved = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: vec![AssetFallbackApproval {
                    slot_id: SlotId::parse("hand_l").unwrap(),
                    target_direction: Direction::W,
                    source_direction: Direction::E,
                    variant: "base".to_owned(),
                }],
                local_overrides: vec![OutfitLocalOverride {
                    slot_id: SlotId::parse("hand_l").unwrap(),
                    direction: Direction::W,
                    transform: transform(0, 1, 0.0),
                }],
                equipment: assigned.draft.equipment.clone(),
            },
        )
        .unwrap();
    let west = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            saved.draft.id,
            Direction::W,
            0,
            None,
        )
        .unwrap();

    assert_eq!(pixel(&west.rgba, west.width, 2, 3), [250, 210, 40, 255]);
    assert_eq!(pixel(&west.rgba, west.width, 3, 3), [26, 190, 80, 255]);
    assert_eq!(opaque_pixels(&west.rgba), 2);
}
