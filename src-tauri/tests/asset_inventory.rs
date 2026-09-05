use std::fs;
use std::path::Path;

use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::application::{
    AreaDetails, AreaService, AssetService, ConfirmAssetImportRequest, CreateAreaRequest,
    ProjectService, VaultService,
};
use pixel_cutout_sprite_studio_lib::asset_io::{ImportDecision, SizeHandling};
use pixel_cutout_sprite_studio_lib::domain::{
    DocumentKind, DomainDocument, ObjectId, ObjectType, OutfitDraft, OutfitDraftStatus,
    RevisionRef, SlotId, SlotRef, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::{object_folder, JsonStore, VaultRoot};
use tempfile::TempDir;

struct Fixture {
    temp: TempDir,
    vaults: VaultService,
    session_id: ObjectId,
    project_name: String,
    project_id: ObjectId,
    area: AreaDetails,
}

impl Fixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let mut vaults = VaultService::default();
        let opened = vaults.initialize(temp.path(), None).unwrap();
        let project = ProjectService::create(
            &mut vaults,
            opened.session_id,
            "Import Demo".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &vaults,
            opened.session_id,
            CreateAreaRequest {
                project_id: project.id,
                name: "NPCs".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: 80,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap();
        Self {
            temp,
            vaults,
            session_id: opened.session_id,
            project_name: project.name,
            project_id: project.id,
            area,
        }
    }

    fn area_folder(&self) -> std::path::PathBuf {
        object_folder(&self.project_name, self.project_id)
            .unwrap()
            .join(object_folder(&self.area.area.name, self.area.area.id).unwrap())
    }

    fn install_usage(&self, asset_id: ObjectId, revision: u32, slot_id: SlotId) {
        let root = VaultRoot::open(self.temp.path()).unwrap();
        let draft_id = ObjectId::new();
        let path = self
            .area_folder()
            .join(".area/drafts")
            .join(format!("outfit--{draft_id}.json"));
        root.ensure_directory(path.parent().unwrap()).unwrap();
        let timestamp = UtcTimestamp::parse("2026-09-05T11:05:00Z").unwrap();
        let draft = OutfitDraft {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::OutfitDraft,
            id: draft_id,
            revision: 1,
            area_id: self.area.area.id,
            template_ref: RevisionRef {
                id: ObjectId::new(),
                revision: 1,
            },
            profile_ref: self.area.profile.reference(),
            character_id: None,
            appearance_id: None,
            base_character_revision: None,
            base_character_sha256: None,
            base_appearance_revision: None,
            base_appearance_sha256: None,
            base_binding_ref: None,
            base_binding_sha256: None,
            status: OutfitDraftStatus::InProgress,
            selected_assets: vec![SlotRef {
                asset_id,
                revision,
                slot_id,
            }],
            asset_fallback_approvals: Vec::new(),
            fittings: Vec::new(),
            local_overrides: Vec::new(),
            equipment: Vec::new(),
            created_at: timestamp,
            updated_at: timestamp,
        };
        JsonStore::default()
            .create(
                &root.resolve(&path).unwrap(),
                &DomainDocument::OutfitDraft(draft),
            )
            .unwrap();
    }
}

fn write_loose_png(path: &Path) {
    RgbaImage::from_fn(4, 4, |x, y| {
        Rgba([
            x as u8 * 20,
            y as u8 * 20,
            190,
            if x == 0 { 128 } else { 255 },
        ])
    })
    .save(path)
    .unwrap();
}

#[test]
fn loose_png_review_import_reopen_usage_and_archive_follow_the_desktop_flow() {
    let mut fixture = Fixture::new();
    let external = TempDir::new().unwrap();
    let png = external.path().join("hand_l__s__base.png");
    write_loose_png(&png);
    let original = fs::read(&png).unwrap();

    let inspection = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        vec![png.to_string_lossy().into_owned()],
    )
    .unwrap();
    assert_eq!(inspection.entries.len(), 1);
    assert_eq!(
        inspection.entries[0].suggested_slot_id.as_ref().unwrap(),
        &SlotId::parse("hand_l").unwrap()
    );
    assert_eq!(
        inspection.entries[0].suggested_direction,
        Some(pixel_cutout_sprite_studio_lib::domain::Direction::S)
    );
    assert!(inspection.entries[0].size_warning.is_some());
    assert_eq!(inspection.entries[0].size_options.len(), 3);

    let request = ConfirmAssetImportRequest {
        area_id: fixture.area.area.id,
        source: inspection.source,
        decisions: vec![ImportDecision {
            entry_index: 0,
            slot_id: SlotId::parse("hand_l").unwrap(),
            direction: pixel_cutout_sprite_studio_lib::domain::Direction::S,
            size_handling: SizeHandling::RescaleNearest,
        }],
    };
    let inventory = AssetService::import(&mut fixture.vaults, fixture.session_id, request).unwrap();
    assert_eq!(inventory.items.len(), 1);
    let imported = &inventory.items[0];
    let hand = fixture
        .area
        .profile
        .slots
        .iter()
        .find(|slot| slot.id.as_str() == "hand_l")
        .unwrap();
    assert_eq!(imported.image_size_px, hand.size_px);
    assert!(imported.thumbnail_url.starts_with("data:image/png;base64,"));
    assert_eq!(fs::read(&png).unwrap(), original);

    fixture.install_usage(
        imported.id,
        imported.released_revision,
        imported.slot_id.clone(),
    );
    let with_usage =
        AssetService::inventory(&fixture.vaults, fixture.session_id, fixture.area.area.id).unwrap();
    assert_eq!(with_usage.items[0].usage.len(), 1);
    assert!(with_usage.items[0].usage[0].description.contains("hand_l"));

    let archived = AssetService::archive(
        &mut fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        imported.id,
        imported.revision,
    )
    .unwrap();
    assert!(archived.items[0].archived);
    assert_eq!(archived.items[0].usage.len(), 1);

    fixture.vaults.close(fixture.session_id).unwrap();
    let reopened = fixture.vaults.open(fixture.temp.path()).unwrap();
    let persisted =
        AssetService::inventory(&fixture.vaults, reopened.session_id, fixture.area.area.id)
            .unwrap();
    assert_eq!(persisted.items.len(), 1);
    assert!(persisted.items[0].archived);
    assert_eq!(persisted.items[0].content_hash, imported.content_hash);
}

#[test]
fn unconfirmed_and_mixed_source_assignments_are_rejected_without_copying() {
    let mut fixture = Fixture::new();
    let external = TempDir::new().unwrap();
    let png = external.path().join("ambiguous.png");
    write_loose_png(&png);
    let inspection = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        vec![png.to_string_lossy().into_owned()],
    )
    .unwrap();
    assert!(inspection.entries[0].suggested_slot_id.is_none());
    let error = AssetService::import(
        &mut fixture.vaults,
        fixture.session_id,
        ConfirmAssetImportRequest {
            area_id: fixture.area.area.id,
            source: inspection.source,
            decisions: Vec::new(),
        },
    )
    .unwrap_err();
    assert!(error.to_string().contains("not assigned"));
    assert!(
        AssetService::inventory(&fixture.vaults, fixture.session_id, fixture.area.area.id)
            .unwrap()
            .items
            .is_empty()
    );

    let json = external.path().join("package.json");
    fs::write(&json, b"{}").unwrap();
    let mixed = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        vec![
            png.to_string_lossy().into_owned(),
            json.to_string_lossy().into_owned(),
        ],
    )
    .unwrap_err();
    assert!(mixed.to_string().contains("either one .json"));
}

#[test]
fn transparent_padding_aligns_the_source_and_profile_pivots_without_scaling() {
    let mut fixture = Fixture::new();
    let external = TempDir::new().unwrap();
    let png = external.path().join("head__s__base.png");
    write_loose_png(&png);
    let original = fs::read(&png).unwrap();
    let inspection = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        vec![png.to_string_lossy().into_owned()],
    )
    .unwrap();
    let inventory = AssetService::import(
        &mut fixture.vaults,
        fixture.session_id,
        ConfirmAssetImportRequest {
            area_id: fixture.area.area.id,
            source: inspection.source,
            decisions: vec![ImportDecision {
                entry_index: 0,
                slot_id: SlotId::parse("head").unwrap(),
                direction: pixel_cutout_sprite_studio_lib::domain::Direction::S,
                size_handling: SizeHandling::PadTransparent,
            }],
        },
    )
    .unwrap();
    let head = fixture
        .area
        .profile
        .slots
        .iter()
        .find(|slot| slot.id.as_str() == "head")
        .unwrap();
    assert_eq!(inventory.items[0].image_size_px, head.size_px);
    assert_eq!(inventory.items[0].pivot_px, head.pivot_px);
    assert_eq!(fs::read(png).unwrap(), original);
}
