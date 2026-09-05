use super::*;

#[test]
fn segmented_armour_and_static_glove_follow_their_body_slots() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let segmented = segmented_armour(&fixture);
    let mut glove = left_glove(&fixture, "static-left-glove", 210);
    glove.own_motion_tracks = vec![equipment_track(Direction::E, true, 2)];
    let saved = persist_equipment(&fixture, &assigned, vec![segmented, glove]);

    let first = equipment_preview(&fixture, &saved, Direction::E, 0);
    let second = equipment_preview(&fixture, &saved, Direction::E, 1);
    assert_eq!(
        pixel(&first.rgba, first.width, 2, 3),
        equipment_color(180, Direction::E)
    );
    assert_eq!(
        pixel(&first.rgba, first.width, 2, 4),
        equipment_color(140, Direction::E)
    );
    assert_eq!(
        pixel(&first.rgba, first.width, 2, 2),
        equipment_color(210, Direction::E)
    );
    assert_eq!(
        pixel(&second.rgba, second.width, 3, 2),
        equipment_color(210, Direction::E)
    );
    assert_eq!(pixel(&second.rgba, second.width, 2, 2), [0, 0, 0, 0]);
    assert!(!saved.draft.equipment[1].own_motion_enabled);
    assert_eq!(
        saved.draft.equipment[1].own_motion_tracks[0].keys[1]
            .transform
            .offset_px
            .0,
        2
    );

    let npc = save_npc(&fixture, &saved, "Equipped guard").unwrap();
    let existing = fixture.start_existing(npc.character.id);
    let mut equipment = existing.draft.equipment.clone();
    equipment[0].follow_mode = FollowMode::Root;
    let edited = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            existing.draft.id,
            existing.draft.revision,
            OutfitDraftEdits {
                fittings: existing.draft.fittings.clone(),
                asset_fallback_approvals: existing.draft.asset_fallback_approvals.clone(),
                local_overrides: existing.draft.local_overrides.clone(),
                equipment: equipment.clone(),
            },
        )
        .unwrap();
    let applied = AppearanceService
        .apply_to_existing_npc(
            &fixture.root,
            Path::new(AREA_PATH),
            edited.draft.id,
            edited.draft.revision,
        )
        .unwrap();
    assert_eq!(applied.appearance.equipment, equipment);
    assert_eq!(applied.appearance.revision, npc.appearance.revision + 1);
}

#[test]
fn accessory_sway_is_optional_and_disabled_states_retain_every_key() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let mut charm = head_charm(&fixture);
    charm.own_motion_enabled = true;
    charm.own_motion_tracks = vec![equipment_track(Direction::E, true, 1)];
    let swaying = persist_equipment(&fixture, &assigned, vec![charm]);
    let moved = equipment_preview(&fixture, &swaying, Direction::E, 1);
    assert_eq!(
        pixel(&moved.rgba, moved.width, 3, 1),
        equipment_color(240, Direction::E)
    );

    let mut equipment = swaying.draft.equipment.clone();
    equipment[0].own_motion_enabled = false;
    let stopped = persist_equipment(&fixture, &swaying, equipment);
    let resumed = AppearanceService
        .resume_draft(&fixture.root, Path::new(AREA_PATH), stopped.draft.id)
        .unwrap();
    let static_frame = equipment_preview(&fixture, &resumed, Direction::E, 1);
    assert_eq!(
        pixel(&static_frame.rgba, static_frame.width, 2, 1),
        equipment_color(240, Direction::E)
    );
    assert_eq!(
        resumed.draft.equipment[0].own_motion_tracks[0].keys[1]
            .transform
            .offset_px
            .0,
        1
    );

    let mut equipment = resumed.draft.equipment.clone();
    equipment[0].enabled = false;
    equipment[0].own_motion_enabled = true;
    equipment[0].own_motion_tracks[0].enabled = false;
    let hidden = persist_equipment(&fixture, &resumed, equipment);
    let hidden_frame = equipment_preview(&fixture, &hidden, Direction::E, 1);
    assert!(!contains_pixel(
        &hidden_frame.rgba,
        equipment_color(240, Direction::E)
    ));
    assert_eq!(hidden.draft.equipment[0].own_motion_tracks[0].keys.len(), 2);
}

#[test]
fn figure_root_follow_is_an_explicit_alternative_to_slot_follow() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let slot_follow = persist_equipment(
        &fixture,
        &assigned,
        vec![left_glove(&fixture, "root-choice-glove", 205)],
    );
    let attached = equipment_preview(&fixture, &slot_follow, Direction::E, 1);
    assert_eq!(
        pixel(&attached.rgba, attached.width, 3, 2),
        equipment_color(205, Direction::E)
    );

    let mut equipment = slot_follow.draft.equipment.clone();
    equipment[0].follow_mode = FollowMode::Root;
    let rooted = transient_equipment_preview(&fixture, &slot_follow, Direction::E, 1, equipment);
    assert_eq!(
        pixel(&rooted.rgba, rooted.width, 2, 2),
        equipment_color(205, Direction::E)
    );
    assert_eq!(pixel(&rooted.rgba, rooted.width, 3, 2), [20, 40, 240, 255]);
}

#[test]
fn asymmetric_images_and_occlusion_are_explicit_in_all_eight_directions() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let armour_assets = seed_equipment_assets(
        &fixture,
        "overlay-armour",
        "torso_upper",
        AssetKind::Armour,
        160,
    );
    let accessory_assets = seed_equipment_assets(
        &fixture,
        "overlay-accessory",
        "head",
        AssetKind::Accessory,
        230,
    );
    let armour = equipment_from_parts(
        "Direction armour",
        vec![equipment_piece(
            "Direction armour",
            "torso_upper",
            &armour_assets,
            0,
            |_| 0,
        )],
    );
    let accessory = equipment_from_parts(
        "Direction accessory",
        vec![equipment_piece(
            "Direction accessory",
            "head",
            &accessory_assets,
            2,
            |direction| if direction_is_front(direction) { 3 } else { 0 },
        )],
    );
    let glove = left_glove(&fixture, "asymmetric-left-glove", 200);
    let saved = persist_equipment(&fixture, &assigned, vec![armour, accessory, glove]);

    for direction in Direction::ALL {
        let preview = equipment_preview(&fixture, &saved, direction, 0);
        let expected_overlay = if direction_is_front(direction) {
            equipment_color(230, direction)
        } else {
            equipment_color(160, direction)
        };
        assert_eq!(pixel(&preview.rgba, preview.width, 2, 3), expected_overlay);
        assert!(contains_pixel(
            &preview.rgba,
            equipment_color(200, direction)
        ));
    }
}

#[test]
fn enabled_parts_need_eight_images_for_npc_save_while_hidden_parts_may_stay_incomplete() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let assets = seed_equipment_assets(
        &fixture,
        "incomplete-glove",
        "hand_l",
        AssetKind::Equipment,
        190,
    );
    assert_equipment_is_not_a_body_assignment(&fixture, &assigned, &assets[0].1);
    let mut glove = equipment_from_parts(
        "Incomplete glove",
        vec![equipment_piece(
            "Incomplete glove",
            "hand_l",
            &assets[..1],
            0,
            |_| 0,
        )],
    );
    glove.own_motion_enabled = true;
    glove.own_motion_tracks = vec![equipment_track(Direction::N, false, 2)];
    let incomplete = persist_equipment(&fixture, &assigned, vec![glove]);
    assert!(matches!(
        save_npc(&fixture, &incomplete, "Incomplete"),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("all eight directions")
    ));

    let mut equipment = incomplete.draft.equipment.clone();
    equipment[0].enabled = false;
    let hidden = persist_equipment(&fixture, &incomplete, equipment);
    let npc = save_npc(&fixture, &hidden, "Stored equipment").unwrap();
    assert!(!npc.appearance.equipment[0].enabled);
    assert!(npc.appearance.equipment[0].own_motion_enabled);
    assert!(!npc.appearance.equipment[0].own_motion_tracks[0].enabled);
    assert_eq!(
        npc.appearance.equipment[0].own_motion_tracks[0].keys.len(),
        2
    );
    let reopened = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::ExistingNpc {
                character_id: npc.character.id,
            },
        )
        .unwrap();
    assert_eq!(reopened.draft.equipment, npc.appearance.equipment);
}

#[test]
fn equipment_sprite_variants_follow_motion_and_survive_save_and_resume() {
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
        direction: Direction::E,
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

    let mut assigned = fixture.start_and_assign();
    let body_open = seed_variant_asset(
        &fixture.root,
        fixture.area_id,
        fixture.profile_ref,
        &SlotId::parse("hand_l").unwrap(),
        timestamp(),
        Direction::E,
        "open",
    );
    assigned
        .draft
        .fittings
        .iter_mut()
        .find(|fit| fit.direction == Direction::E)
        .unwrap()
        .variant_fittings
        .push(SpriteVariantFitting {
            variant: "open".to_owned(),
            asset: body_open,
            pivot_px: PixelPoint(0, 0),
        });
    let mut glove = left_glove(&fixture, "variant-left-glove", 240);
    let open_color = [245, 175, 25, 255];
    let open = seed_equipment_variant(
        &fixture,
        "variant-left-glove-open",
        "hand_l",
        Direction::E,
        "open",
        open_color,
    );
    glove
        .fit_by_direction
        .iter_mut()
        .find(|fit| fit.direction == Direction::E)
        .unwrap()
        .variant_fittings
        .push(SpriteVariantFitting {
            variant: "open".to_owned(),
            asset: open.clone(),
            pivot_px: PixelPoint(0, 0),
        });
    let saved = persist_equipment(&fixture, &assigned, vec![glove]);

    let base = equipment_preview(&fixture, &saved, Direction::E, 0);
    let variant = equipment_preview(&fixture, &saved, Direction::E, 1);
    assert!(contains_pixel(
        &base.rgba,
        equipment_color(240, Direction::E)
    ));
    assert!(!contains_pixel(&base.rgba, open_color));
    assert!(contains_pixel(&variant.rgba, open_color));
    assert!(!contains_pixel(
        &variant.rgba,
        equipment_color(240, Direction::E)
    ));

    let npc = save_npc(&fixture, &saved, "Variant charm").unwrap();
    let east = npc.appearance.equipment[0]
        .fit_by_direction
        .iter()
        .find(|fit| fit.direction == Direction::E)
        .unwrap();
    assert_eq!(east.variant_fittings[0].asset, open);
    let reopened = AppearanceService
        .start_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.template_ref,
            OutfitTarget::ExistingNpc {
                character_id: npc.character.id,
            },
        )
        .unwrap();
    assert_eq!(reopened.draft.equipment, npc.appearance.equipment);
}

fn segmented_armour(fixture: &OutfitFixture) -> Equipment {
    let upper = seed_equipment_assets(
        fixture,
        "cuirass-upper",
        "torso_upper",
        AssetKind::Armour,
        180,
    );
    let lower = seed_equipment_assets(
        fixture,
        "cuirass-lower",
        "torso_lower",
        AssetKind::Armour,
        140,
    );
    equipment_from_parts(
        "Segmented cuirass",
        vec![
            equipment_piece("Upper cuirass", "torso_upper", &upper, 0, |_| 0),
            equipment_piece("Lower cuirass", "torso_lower", &lower, 0, |_| 0),
        ],
    )
}

fn left_glove(fixture: &OutfitFixture, prefix: &str, palette: u8) -> Equipment {
    let assets = seed_equipment_assets(fixture, prefix, "hand_l", AssetKind::Equipment, palette);
    equipment_from_parts(
        "Left glove",
        vec![equipment_piece("Left glove", "hand_l", &assets, 0, |_| 0)],
    )
}

fn head_charm(fixture: &OutfitFixture) -> Equipment {
    let assets = seed_equipment_assets(fixture, "head-charm", "head", AssetKind::Accessory, 240);
    equipment_from_parts(
        "Swinging charm",
        vec![equipment_piece("Swinging charm", "head", &assets, 0, |_| 3)],
    )
}

fn seed_equipment_variant(
    fixture: &OutfitFixture,
    name: &str,
    slot: &str,
    direction: Direction,
    variant: &str,
    color: [u8; 4],
) -> SlotRef {
    let asset_id = ObjectId::new();
    let slot_id = SlotId::parse(slot).unwrap();
    let source_relative = format!(".area/assets/{name}/source.png");
    let source = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(&source_relative))
        .unwrap();
    fs::create_dir_all(source.as_path().parent().unwrap()).unwrap();
    RgbaImage::from_pixel(1, 1, Rgba(color))
        .save(source.as_path())
        .unwrap();
    let mut asset = asset_document(asset_id, fixture.area_id, name, timestamp());
    asset.name = name.to_owned();
    asset.original_name = format!("{name}.png");
    asset.asset_kind = AssetKind::Accessory;
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(format!(".area/assets/{name}/asset.json")),
        DomainDocument::Asset(asset),
    );
    let mut revision = asset_revision_document(
        asset_id,
        fixture.profile_ref,
        &slot_id,
        direction,
        source_relative,
        timestamp(),
    );
    revision.variant = variant.to_owned();
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(format!(".area/assets/{name}/revision.json")),
        DomainDocument::AssetRevision(revision),
    );
    SlotRef {
        asset_id,
        revision: 1,
        slot_id,
    }
}

fn persist_equipment(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    equipment: Vec<Equipment>,
) -> pixel_cutout_sprite_studio_lib::application::OutfitEditorContext {
    AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            context.draft.id,
            context.draft.revision,
            OutfitDraftEdits {
                fittings: context.draft.fittings.clone(),
                asset_fallback_approvals: context.draft.asset_fallback_approvals.clone(),
                local_overrides: context.draft.local_overrides.clone(),
                equipment,
            },
        )
        .unwrap()
}

fn equipment_preview(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    direction: Direction,
    frame: u16,
) -> pixel_cutout_sprite_studio_lib::application::OutfitPreviewFrame {
    AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            context.draft.id,
            direction,
            frame,
            None,
        )
        .unwrap()
}

fn transient_equipment_preview(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    direction: Direction,
    frame: u16,
    equipment: Vec<Equipment>,
) -> pixel_cutout_sprite_studio_lib::application::OutfitPreviewFrame {
    AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            context.draft.id,
            direction,
            frame,
            Some(OutfitDraftEdits {
                fittings: context.draft.fittings.clone(),
                asset_fallback_approvals: context.draft.asset_fallback_approvals.clone(),
                local_overrides: context.draft.local_overrides.clone(),
                equipment,
            }),
        )
        .unwrap()
}

fn assert_equipment_is_not_a_body_assignment(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    asset: &SlotRef,
) {
    assert!(matches!(
        AppearanceService.auto_assign(
            &fixture.root,
            Path::new(AREA_PATH),
            context.draft.id,
            context.draft.revision,
            vec![asset.clone()],
        ),
        Err(AppearanceServiceError::InvalidState(message)) if message.contains("equipment pieces")
    ));
}

fn save_npc(
    fixture: &OutfitFixture,
    context: &pixel_cutout_sprite_studio_lib::application::OutfitEditorContext,
    name: &str,
) -> Result<pixel_cutout_sprite_studio_lib::application::SavedNpc, AppearanceServiceError> {
    AppearanceService.save_as_npc(
        &fixture.root,
        Path::new(AREA_PATH),
        context.draft.id,
        context.draft.revision,
        SaveNpcRequest {
            name: name.to_owned(),
            description: String::new(),
            label_ids: Vec::new(),
        },
    )
}

fn direction_is_front(direction: Direction) -> bool {
    matches!(
        direction,
        Direction::E | Direction::Se | Direction::S | Direction::Sw | Direction::W
    )
}

fn contains_pixel(rgba: &[u8], expected: [u8; 4]) -> bool {
    rgba.chunks_exact(4).any(|pixel| pixel == expected)
}
