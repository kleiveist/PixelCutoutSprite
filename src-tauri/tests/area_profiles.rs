use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::application::{
    AreaService, CreateAreaRequest, LabelService, ReviseAreaProfileRequest, VaultOpenMode,
    VaultService,
};
use pixel_cutout_sprite_studio_lib::domain::{
    parse_document, DocumentKind, DomainDocument, LabelScope, ObjectId, ObjectType, Project,
    RecordStatus, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::{
    object_folder, JsonStore, StorageError, VaultLayout, VaultRoot,
};
use tempfile::TempDir;

struct TestProject {
    temp: TempDir,
    service: VaultService,
    session_id: ObjectId,
    project: Project,
    project_folder: PathBuf,
}

impl TestProject {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let mut service = VaultService::default();
        let opened = service.initialize(temp.path(), None).unwrap();
        let timestamp = UtcTimestamp::parse("2026-09-05T11:05:00Z").unwrap();
        let project = Project {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Project,
            id: ObjectId::new(),
            revision: 1,
            name: "Demo RPG".to_owned(),
            status: RecordStatus::Active,
            workspace_label_ids: Vec::new(),
            created_at: timestamp,
            updated_at: timestamp,
        };
        let root = VaultRoot::open(temp.path()).unwrap();
        let layout = VaultLayout::new(root.clone());
        let project_folder = object_folder(&project.name, project.id).unwrap();
        root.ensure_directory(&project_folder.join(".project"))
            .unwrap();
        JsonStore::default()
            .create(
                &layout.project_manifest(&project_folder).unwrap(),
                &DomainDocument::Project(project.clone()),
            )
            .unwrap();
        Self {
            temp,
            service,
            session_id: opened.session_id,
            project,
            project_folder,
        }
    }

    fn create_npcs(&self, height: u16) -> pixel_cutout_sprite_studio_lib::application::AreaDetails {
        AreaService::create(
            &self.service,
            self.session_id,
            CreateAreaRequest {
                project_id: self.project.id,
                name: "NPCs".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: height,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap()
    }

    fn area_folder(&self, area_name: &str, area_id: ObjectId) -> PathBuf {
        self.project_folder
            .join(object_folder(area_name, area_id).unwrap())
    }

    fn profile_path(&self, area_folder: &Path, profile_id: ObjectId, revision: u32) -> PathBuf {
        self.temp
            .path()
            .join(area_folder)
            .join(".area/profiles")
            .join(object_folder("humanoid", profile_id).unwrap())
            .join(format!("r{revision:04}.json"))
    }

    fn install_project_label(&self) -> ObjectId {
        let label_id = ObjectId::new();
        let catalog = serde_json::json!({
            "schema_version": 1,
            "kind": "label_catalog",
            "id": ObjectId::new(),
            "revision": 1,
            "scope": "project",
            "project_id": self.project.id,
            "labels": [{
                "schema_version": 1,
                "kind": "label",
                "id": label_id,
                "revision": 1,
                "scope": "project",
                "project_id": self.project.id,
                "name": "Villagers",
                "color": "#a0c060",
                "created_at": "2026-09-05T11:05:00Z",
                "updated_at": "2026-09-05T11:05:00Z"
            }],
            "updated_at": "2026-09-05T11:05:00Z"
        });
        fs::write(
            self.temp
                .path()
                .join(&self.project_folder)
                .join(".project/labels.json"),
            serde_json::to_vec_pretty(&catalog).unwrap(),
        )
        .unwrap();
        label_id
    }
}

#[test]
fn npc_area_at_eighty_pixels_is_created_listed_and_reopened() {
    let mut fixture = TestProject::new();
    let created = fixture.create_npcs(80);
    assert_eq!(created.area.name, "NPCs");
    assert_eq!(created.area.reference_height_px, 80);
    assert_eq!(created.area.directions.len(), 8);
    assert_eq!(created.profile.slots.len(), 16);
    assert_eq!(created.profile.views.len(), 8);
    assert_eq!(created.profile.mirror_pairs.len(), 6);
    assert_eq!(created.preview.measured_height_px, 80);
    created.profile.validate_humanoid_v1().unwrap();

    let dashboard =
        AreaService::dashboard(&fixture.service, fixture.session_id, fixture.project.id).unwrap();
    assert_eq!(dashboard.areas.len(), 1);
    assert_eq!(dashboard.areas[0].profile_ref, created.profile.reference());

    let opened = AreaService::open(&fixture.service, fixture.session_id, created.area.id).unwrap();
    assert_eq!(opened.area, created.area);
    assert_eq!(opened.profile, created.profile);

    fixture.service.close(fixture.session_id).unwrap();
    let reopened_vault = fixture.service.open(fixture.temp.path()).unwrap();
    assert_eq!(reopened_vault.indexed_objects, 4);
    let reopened =
        AreaService::open(&fixture.service, reopened_vault.session_id, created.area.id).unwrap();
    assert_eq!(reopened.area, created.area);
    assert_eq!(reopened.preview.measured_height_px, 80);
    fixture.service.close(reopened_vault.session_id).unwrap();

    let transactions = fixture
        .temp
        .path()
        .join(&fixture.project_folder)
        .join(".project/transactions");
    assert_eq!(fs::read_dir(transactions).unwrap().count(), 0);
}

#[test]
fn changing_height_publishes_a_new_snapshot_without_mutating_the_old_one() {
    let fixture = TestProject::new();
    let created = fixture.create_npcs(80);
    let area_folder = fixture.area_folder(&created.area.name, created.area.id);
    let old_path = fixture.profile_path(&area_folder, created.profile.profile_id, 1);
    let old_bytes = fs::read(&old_path).unwrap();

    let revised = AreaService::revise_profile(
        &fixture.service,
        fixture.session_id,
        ReviseAreaProfileRequest {
            area_id: created.area.id,
            expected_area_revision: created.area.revision,
            reference_height_px: 97,
            default_frame_size_px: None,
            default_ground_origin_px: None,
        },
    )
    .unwrap();
    assert_eq!(revised.area.revision, 2);
    assert_eq!(revised.profile.revision, 2);
    assert_eq!(revised.profile.reference_height_px, 97);
    assert_eq!(revised.preview.measured_height_px, 97);
    assert_eq!(fs::read(&old_path).unwrap(), old_bytes);
    let DomainDocument::ProfileRevision(old_profile) = parse_document(&old_bytes).unwrap() else {
        panic!("expected profile snapshot");
    };
    assert_eq!(old_profile.revision, 1);
    assert_eq!(old_profile.reference_height_px, 80);

    assert!(matches!(
        AreaService::revise_profile(
            &fixture.service,
            fixture.session_id,
            ReviseAreaProfileRequest {
                area_id: created.area.id,
                expected_area_revision: 1,
                reference_height_px: 112,
                default_frame_size_px: None,
                default_ground_origin_px: None,
            },
        ),
        Err(StorageError::WriteConflict)
    ));
    assert!(!fixture
        .profile_path(&area_folder, created.profile.profile_id, 3)
        .exists());
}

#[test]
fn a_read_only_vault_can_browse_areas_but_cannot_create_them() {
    let writer = TestProject::new();
    let created = writer.create_npcs(80);
    let mut reader = VaultService::default();
    let opened = reader.open(writer.temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(
        !AreaService::open(&reader, opened.session_id, created.area.id)
            .unwrap()
            .writable
    );
    assert!(AreaService::create(
        &reader,
        opened.session_id,
        CreateAreaRequest {
            project_id: writer.project.id,
            name: "Enemies".to_owned(),
            object_type: ObjectType::Humanoid,
            reference_height_px: 80,
            default_frame_size_px: None,
            default_ground_origin_px: None,
            label_ids: Vec::new(),
        },
    )
    .unwrap_err()
    .to_string()
    .contains("read-only"));
    reader.close(opened.session_id).unwrap();
}

#[test]
fn area_labels_are_limited_to_the_selected_projects_catalog() {
    let mut fixture = TestProject::new();
    let label_id = fixture.install_project_label();
    let dashboard =
        AreaService::dashboard(&fixture.service, fixture.session_id, fixture.project.id).unwrap();
    assert_eq!(dashboard.labels.len(), 1);
    assert_eq!(dashboard.labels[0].id, label_id);

    let created = AreaService::create(
        &fixture.service,
        fixture.session_id,
        CreateAreaRequest {
            project_id: fixture.project.id,
            name: "Villager NPCs".to_owned(),
            object_type: ObjectType::Humanoid,
            reference_height_px: 80,
            default_frame_size_px: None,
            default_ground_origin_px: None,
            label_ids: vec![label_id],
        },
    )
    .unwrap();
    assert_eq!(created.area.label_ids, vec![label_id]);

    let removal = LabelService::remove(
        &mut fixture.service,
        fixture.session_id,
        LabelScope::Project,
        Some(fixture.project.id),
        label_id,
        1,
    )
    .unwrap_err();
    assert!(removal.to_string().contains("assigned to area"));

    let error = AreaService::create(
        &fixture.service,
        fixture.session_id,
        CreateAreaRequest {
            project_id: fixture.project.id,
            name: "Enemy NPCs".to_owned(),
            object_type: ObjectType::Humanoid,
            reference_height_px: 80,
            default_frame_size_px: None,
            default_ground_origin_px: None,
            label_ids: vec![ObjectId::new()],
        },
    )
    .unwrap_err();
    assert!(error.to_string().contains("missing project label"));
}
