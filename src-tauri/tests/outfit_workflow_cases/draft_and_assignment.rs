#[test]
fn confirmed_direction_images_auto_assign_and_the_unnamed_draft_resumes() {
    let fixture = OutfitFixture::new();
    let launch = AppearanceService
        .launch_context(&fixture.root, Path::new(AREA_PATH), fixture.template_ref)
        .unwrap();
    assert!(launch.compatible_characters.is_empty());
    assert!(launch.resumable_drafts.is_empty());
    assert_eq!(launch.inventory.len(), 8);
    assert_eq!(launch.available_labels[0].id, fixture.label_id);

    let assigned = fixture.start_and_assign();
    assert_eq!(assigned.draft.fittings.len(), 8);
    assert!(assigned.missing_required_slots.is_empty());
    assert_eq!(assigned.draft.selected_assets.len(), 1);
    let draft_file = fixture
        .root
        .resolve(
            &Path::new(AREA_PATH)
                .join(".area/drafts")
                .join(format!("outfit--{}.json", assigned.draft.id)),
        )
        .unwrap();
    assert!(draft_file.as_path().is_file());

    let mut edits = OutfitDraftEdits {
        fittings: assigned.draft.fittings.clone(),
        asset_fallback_approvals: assigned.draft.asset_fallback_approvals.clone(),
        local_overrides: Vec::new(),
    };
    edits.fittings[0].transform = transform(2, -1, 3.5);
    let saved = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            edits,
        )
        .unwrap();
    let resumed = AppearanceService
        .resume_draft(&fixture.root, Path::new(AREA_PATH), assigned.draft.id)
        .unwrap();
    assert_eq!(resumed.draft, saved.draft);
    assert!(matches!(
        AppearanceService.autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings: saved.draft.fittings.clone(),
                asset_fallback_approvals: saved.draft.asset_fallback_approvals.clone(),
                local_overrides: Vec::new(),
            },
        ),
        Err(AppearanceServiceError::RevisionConflict { .. })
    ));
}
#[test]
fn described_package_import_flows_through_fitting_resume_and_first_npc_save() {
    let fixture = OutfitFixture::new();
    let source = TempDir::new().unwrap();
    let png = source.path().join("hand_l__s__imported.png");
    RgbaImage::from_pixel(1, 1, Rgba([99, 77, 211, 255]))
        .save(&png)
        .unwrap();
    let original = fs::read(&png).unwrap();
    let package = AssetPackage {
        format: ASSET_PACKAGE_FORMAT.to_owned(),
        format_version: 1,
        profile_ref: fixture.profile_ref,
        entries: vec![PackageEntry {
            name: "Imported south hand".to_owned(),
            source: "hand_l__s__imported.png".to_owned(),
            asset_kind: AssetKind::Body,
            slot_id: Some("hand_l".to_owned()),
            direction: Some(Direction::S),
            variant: "base".to_owned(),
            image_size_px: PixelSize(1, 1),
            pivot_px: PixelPoint(0, 0),
            sheet_rect_px: None,
            sprite_mirroring_allowed: false,
            origin_note: "Generated integration fixture".to_owned(),
            license_note: "CC0 test fixture".to_owned(),
        }],
    };
    let package_path = source.path().join("package.json");
    fs::write(&package_path, serde_json::to_vec_pretty(&package).unwrap()).unwrap();
    let allowed = HashSet::from([SlotId::parse("hand_l").unwrap()]);
    let inspected = PngImporter::default()
        .inspect_package(&package_path, &allowed)
        .unwrap();
    let imported = AssetRepository
        .import_package(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.area_id,
            &inspected,
            &[],
        )
        .unwrap()
        .remove(0);
    let imported_ref = SlotRef {
        asset_id: imported.asset.id,
        revision: imported.revision.revision,
        slot_id: imported.revision.slot_id.clone(),
    };
    let draft = AppearanceService
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
        .filter(|(direction, _)| *direction != Direction::S)
        .map(|(_, asset)| asset.clone())
        .chain([imported_ref.clone()])
        .collect();
    let assigned = AppearanceService
        .auto_assign(
            &fixture.root,
            Path::new(AREA_PATH),
            draft.draft.id,
            draft.draft.revision,
            assets,
        )
        .unwrap();
    assert!(assigned.missing_required_slots.is_empty());
    let mut fittings = assigned.draft.fittings.clone();
    fittings
        .iter_mut()
        .find(|fit| fit.asset == imported_ref)
        .unwrap()
        .transform = transform(1, -1, 2.5);
    let adjusted = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: Vec::new(),
                local_overrides: Vec::new(),
            },
        )
        .unwrap();

    let reopened = VaultRoot::open(fixture._directory.path()).unwrap();
    let resumed = AppearanceService
        .resume_draft(&reopened, Path::new(AREA_PATH), adjusted.draft.id)
        .unwrap();
    let saved = AppearanceService
        .save_as_npc(
            &reopened,
            Path::new(AREA_PATH),
            resumed.draft.id,
            resumed.draft.revision,
            SaveNpcRequest {
                name: "Imported Mara".to_owned(),
                description: "Package-to-NPC integration".to_owned(),
                label_ids: vec![fixture.label_id],
            },
        )
        .unwrap();
    let imported_fit = saved.appearance.slots[0]
        .fit_by_direction
        .iter()
        .find(|fit| fit.direction == Direction::S)
        .unwrap();
    assert_eq!(imported_fit.asset.as_ref(), Some(&imported_ref));
    assert_eq!(imported_fit.transform, transform(1, -1, 2.5));
    assert_eq!(saved.binding.template_ref, fixture.template_ref);
    assert_eq!(fs::read(&png).unwrap(), original);
}

#[test]
fn new_assignments_reject_archived_or_unreleased_assets_but_existing_pins_remain_editable() {
    for archive in [true, false] {
        let fixture = OutfitFixture::new();
        let draft = AppearanceService
            .start_draft(
                &fixture.root,
                Path::new(AREA_PATH),
                fixture.template_ref,
                OutfitTarget::NewNpc,
            )
            .unwrap();
        let south_ref = fixture
            .assets
            .iter()
            .find(|(direction, _)| *direction == Direction::S)
            .unwrap()
            .1
            .clone();
        let manifest = fixture
            .root
            .resolve(&Path::new(AREA_PATH).join(".area/assets/s/asset.json"))
            .unwrap();
        let loaded = JsonStore::default().load(&manifest).unwrap();
        let DomainDocument::Asset(mut asset) = loaded.value else {
            panic!("fixture asset manifest has the wrong document kind");
        };
        if archive {
            asset.archived = true;
        } else {
            asset.released_revisions = vec![2];
        }
        JsonStore::default()
            .compare_and_swap(&manifest, &loaded.stamp, &DomainDocument::Asset(asset))
            .unwrap();
        let draft_path = fixture
            .root
            .resolve(
                &Path::new(AREA_PATH)
                    .join(".area/drafts")
                    .join(format!("outfit--{}.json", draft.draft.id)),
            )
            .unwrap();
        let before = fs::read(draft_path.as_path()).unwrap();

        assert!(matches!(
            AppearanceService.auto_assign(
                &fixture.root,
                Path::new(AREA_PATH),
                draft.draft.id,
                draft.draft.revision,
                vec![south_ref.clone()],
            ),
            Err(AppearanceServiceError::InvalidState(message))
                if message.contains("archived or not released")
        ));
        assert!(matches!(
            AppearanceService.autosave_draft(
                &fixture.root,
                Path::new(AREA_PATH),
                draft.draft.id,
                draft.draft.revision,
                OutfitDraftEdits {
                    fittings: vec![OutfitFitting {
                        slot_id: SlotId::parse("hand_l").unwrap(),
                        direction: Direction::S,
                        asset: south_ref,
                        pivot_px: PixelPoint(0, 0),
                        variant_fittings: Vec::new(),
                        transform: transform(0, 0, 0.0),
                        visible: true,
                        layer_delta: 0,
                    }],
                    asset_fallback_approvals: Vec::new(),
                    local_overrides: Vec::new(),
                },
            ),
            Err(AppearanceServiceError::InvalidState(message))
                if message.contains("archived or not released")
        ));
        assert_eq!(fs::read(draft_path.as_path()).unwrap(), before);
    }

    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let pinned_south_ref = assigned
        .draft
        .fittings
        .iter()
        .find(|fit| fit.direction == Direction::S)
        .unwrap()
        .asset
        .clone();
    let manifest = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/assets/s/asset.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&manifest).unwrap();
    let DomainDocument::Asset(mut asset) = loaded.value else {
        panic!("fixture asset manifest has the wrong document kind");
    };
    asset.archived = true;
    JsonStore::default()
        .compare_and_swap(&manifest, &loaded.stamp, &DomainDocument::Asset(asset))
        .unwrap();
    let mut fittings = assigned.draft.fittings.clone();
    fittings
        .iter_mut()
        .find(|fit| fit.direction == Direction::S)
        .unwrap()
        .transform = transform(1, 0, 0.0);
    let resumed = AppearanceService
        .autosave_draft(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            assigned.draft.revision,
            OutfitDraftEdits {
                fittings,
                asset_fallback_approvals: assigned.draft.asset_fallback_approvals,
                local_overrides: assigned.draft.local_overrides,
            },
        )
        .expect("an already-pinned archived revision remains editable");
    let pinned = resumed
        .inventory
        .iter()
        .find(|item| item.asset == pinned_south_ref)
        .expect("the archived pinned revision remains named in the editor");
    assert!(!pinned.assignable);
}

#[test]
fn released_motion_keeps_its_pinned_profile_after_the_area_default_changes() {
    let fixture = OutfitFixture::new();
    let manifest = fixture
        .root
        .resolve(&Path::new(AREA_PATH).join(".area/area.json"))
        .unwrap();
    let loaded = JsonStore::default().load(&manifest).unwrap();
    let DomainDocument::Area(mut area) = loaded.value else {
        panic!("fixture area manifest has the wrong document kind");
    };
    let mut next_profile = profile_document(
        fixture.profile_ref.id,
        fixture.area_id,
        SlotId::parse("hand_l").unwrap(),
        timestamp(),
    );
    next_profile.revision = 2;
    write_document(
        &fixture.root,
        Path::new(AREA_PATH).join(".area/profiles/humanoid/r0002.json"),
        DomainDocument::ProfileRevision(next_profile),
    );
    area.revision += 1;
    area.profile_ref.revision = 2;
    JsonStore::default()
        .compare_and_swap(&manifest, &loaded.stamp, &DomainDocument::Area(area))
        .unwrap();

    let launch = AppearanceService
        .launch_context(&fixture.root, Path::new(AREA_PATH), fixture.template_ref)
        .unwrap();

    assert_eq!(launch.motion.profile_ref, fixture.profile_ref);
    assert_eq!(launch.profile.reference(), fixture.profile_ref);
    assert_eq!(launch.inventory.len(), Direction::ALL.len());
}

#[test]
fn preview_applies_direction_image_shared_fitting_and_binding_override_without_guides() {
    let fixture = OutfitFixture::new();
    let assigned = fixture.start_and_assign();
    let mut fittings = assigned.draft.fittings.clone();
    fittings
        .iter_mut()
        .find(|fit| fit.direction == Direction::S)
        .unwrap()
        .transform = transform(1, 0, 0.0);
    let edits = OutfitDraftEdits {
        fittings,
        asset_fallback_approvals: assigned.draft.asset_fallback_approvals.clone(),
        local_overrides: vec![OutfitLocalOverride {
            slot_id: SlotId::parse("hand_l").unwrap(),
            direction: Direction::S,
            transform: transform(0, 1, 0.0),
        }],
    };
    let south = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::S,
            0,
            Some(edits.clone()),
        )
        .unwrap();
    assert!(!south.guides_included);
    assert_eq!(pixel(&south.rgba, south.width, 0, 3), [240, 20, 30, 255]);
    assert_eq!(pixel(&south.rgba, south.width, 3, 3), [0, 0, 0, 0]);
    assert_eq!(opaque_pixels(&south.rgba), 1);
    assert!(!south
        .rgba
        .chunks_exact(4)
        .any(|rgba| rgba == [142, 216, 255, 255]));

    let east = AppearanceService
        .render_preview(
            &fixture.root,
            Path::new(AREA_PATH),
            assigned.draft.id,
            Direction::E,
            0,
            Some(edits),
        )
        .unwrap();
    assert_eq!(pixel(&east.rgba, east.width, 2, 2), [20, 40, 240, 255]);
    assert_eq!(opaque_pixels(&east.rgba), 1);
}
