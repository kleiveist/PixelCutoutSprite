use std::fs;
use std::path::Path;

use pixel_cutout_sprite_studio_lib::application::{
    DeleteNpcExportProfileRequest, ExportOutputFormat, ExportProfileService,
    ExportProfileServiceError, SaveNpcExportProfileRequest,
};
use pixel_cutout_sprite_studio_lib::domain::{
    Area, AtlasSize, ClippingPolicy, Direction, DirectionModel, DocumentKind, DomainDocument,
    ExportJumpMode, ExportProfileSnapshot, ExportRootMotionMode, ObjectId, ObjectType, PixelPoint,
    PixelSize, RevisionRef, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::{JsonStore, VaultRoot};
use tempfile::TempDir;

const AREA_PATH: &str = "game/npcs";

#[test]
fn area_export_profiles_create_update_list_and_delete_with_revision_guards() {
    let (directory, root, area_id) = fixture();
    let service = ExportProfileService;
    assert!(service
        .list(&root, Path::new(AREA_PATH), area_id)
        .unwrap()
        .is_empty());

    let created = service
        .save(
            &root,
            Path::new(AREA_PATH),
            area_id,
            save_request(None, None, "Production"),
        )
        .unwrap();
    assert_eq!(created.revision, 1);
    assert_eq!(
        service.list(&root, Path::new(AREA_PATH), area_id).unwrap(),
        vec![created.clone()]
    );

    assert!(matches!(
        service.save(
            &root,
            Path::new(AREA_PATH),
            area_id,
            save_request(Some(created.id), Some(9), "Wrong revision"),
        ),
        Err(ExportProfileServiceError::RevisionConflict {
            expected: 9,
            found: 1
        })
    ));
    let updated = service
        .save(
            &root,
            Path::new(AREA_PATH),
            area_id,
            save_request(Some(created.id), Some(1), "Production v2"),
        )
        .unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.revision, 2);

    assert!(matches!(
        service.delete(
            &root,
            Path::new(AREA_PATH),
            area_id,
            DeleteNpcExportProfileRequest {
                profile_id: updated.id,
                expected_revision: 1,
            },
        ),
        Err(ExportProfileServiceError::RevisionConflict {
            expected: 1,
            found: 2
        })
    ));
    service
        .delete(
            &root,
            Path::new(AREA_PATH),
            area_id,
            DeleteNpcExportProfileRequest {
                profile_id: updated.id,
                expected_revision: 2,
            },
        )
        .unwrap();
    assert!(service
        .list(&root, Path::new(AREA_PATH), area_id)
        .unwrap()
        .is_empty());
    drop(directory);
}

#[test]
fn export_profile_store_rejects_unknown_fields_and_cross_area_access() {
    let (_directory, root, area_id) = fixture();
    let service = ExportProfileService;
    let created = service
        .save(
            &root,
            Path::new(AREA_PATH),
            area_id,
            save_request(None, None, "Strict"),
        )
        .unwrap();
    let path = root
        .resolve(
            &Path::new(AREA_PATH)
                .join(".area/export-profiles")
                .join(format!("{}.json", created.id)),
        )
        .unwrap();
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
    value.as_object_mut().unwrap().insert(
        "caller_path".to_owned(),
        serde_json::Value::String("/tmp".to_owned()),
    );
    fs::write(path.as_path(), serde_json::to_vec_pretty(&value).unwrap()).unwrap();
    assert!(matches!(
        service.list(&root, Path::new(AREA_PATH), area_id),
        Err(ExportProfileServiceError::InvalidStored(_))
    ));
    assert!(service
        .list(&root, Path::new(AREA_PATH), ObjectId::new())
        .is_err());
}

#[test]
fn legacy_stored_profile_defaults_migrate_only_when_it_is_loaded_and_saved() {
    let (_directory, root, area_id) = fixture();
    let service = ExportProfileService;
    let created = service
        .save(
            &root,
            Path::new(AREA_PATH),
            area_id,
            save_request(None, None, "Legacy"),
        )
        .unwrap();
    let path = root
        .resolve(
            &Path::new(AREA_PATH)
                .join(".area/export-profiles")
                .join(format!("{}.json", created.id)),
        )
        .unwrap();
    let mut legacy: serde_json::Value =
        serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
    legacy.as_object_mut().unwrap().remove("format");
    legacy
        .as_object_mut()
        .unwrap()
        .remove("include_godot_scene");
    fs::write(path.as_path(), serde_json::to_vec_pretty(&legacy).unwrap()).unwrap();

    let loaded = service
        .list(&root, Path::new(AREA_PATH), area_id)
        .unwrap()
        .pop()
        .unwrap();
    assert_eq!(loaded.format, ExportOutputFormat::PngJson);
    assert!(loaded.include_godot_scene);
    let mut update = save_request(Some(loaded.id), Some(loaded.revision), "Migrated");
    update.format = ExportOutputFormat::GodotPackage;
    update.include_godot_scene = false;
    let migrated = service
        .save(&root, Path::new(AREA_PATH), area_id, update)
        .unwrap();
    assert_eq!(migrated.revision, 2);
    assert_eq!(migrated.format, ExportOutputFormat::GodotPackage);
    assert!(!migrated.include_godot_scene);
    let persisted: serde_json::Value =
        serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
    assert_eq!(persisted["format"], "godot_package");
    assert_eq!(persisted["include_godot_scene"], false);
}

fn fixture() -> (TempDir, VaultRoot, ObjectId) {
    let directory = TempDir::new().unwrap();
    fs::create_dir_all(directory.path().join(AREA_PATH).join(".area")).unwrap();
    let root = VaultRoot::open(directory.path()).unwrap();
    let area_id = ObjectId::new();
    let timestamp = UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap();
    let area = Area {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Area,
        id: area_id,
        revision: 1,
        project_id: ObjectId::new(),
        name: "NPCs".to_owned(),
        object_type: ObjectType::Humanoid,
        profile_ref: RevisionRef {
            id: ObjectId::new(),
            revision: 1,
        },
        reference_height_px: 80,
        direction_model: DirectionModel::EightWay,
        directions: Direction::ALL.to_vec(),
        default_frame_size_px: PixelSize(128, 128),
        default_ground_origin_px: PixelPoint(64, 108),
        label_ids: Vec::new(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    JsonStore::default()
        .write(
            &root
                .resolve(&Path::new(AREA_PATH).join(".area/area.json"))
                .unwrap(),
            &DomainDocument::Area(area),
        )
        .unwrap();
    (directory, root, area_id)
}

fn save_request(
    profile_id: Option<ObjectId>,
    expected_revision: Option<u32>,
    name: &str,
) -> SaveNpcExportProfileRequest {
    SaveNpcExportProfileRequest {
        profile_id,
        expected_revision,
        profile: ExportProfileSnapshot {
            name: name.to_owned(),
            directions: Direction::ALL.to_vec(),
            max_page_size_px: AtlasSize(2048, 2048),
            max_pages: 16,
            memory_budget_bytes: 256 * 1024 * 1024,
            padding_px: 0,
            extrude_edges: false,
            individual_frames: false,
            include_shadow: true,
            normalize_geometry: false,
            clipping_policy: ClippingPolicy::Block,
            allow_incomplete_test: false,
        },
        root_motion_mode: ExportRootMotionMode::Baked,
        jump_mode: ExportJumpMode::External,
        format: ExportOutputFormat::PngJson,
        include_godot_scene: true,
    }
}
