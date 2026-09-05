use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::application::{
    ExportOutputFormat, NpcExportError, NpcExportService, StartNpcExportRequest,
};
use pixel_cutout_sprite_studio_lib::domain::{
    ActionKey, AnimationBinding, Appearance, Area, AtlasSize, Character, CharacterStatus,
    ClippingPolicy, Direction, DirectionDefinition, DirectionMode, DirectionModel, DocumentKind,
    DomainDocument, ExportJumpMode, ExportProfileSnapshot, ExportRootMotionMode, LoopMode,
    MotionRevision, MotionTemplate, ObjectId, ObjectType, PixelPoint, PixelSize, ProfileRevision,
    Project, RecordStatus, ReviewState, RevisionRef, SlotDefinition, SlotId, Transform2D,
    UtcTimestamp, ViewTransform, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::exports::{
    CancellationFlag, ExportError, ExportProgress, ExportService, ExportStage, NeverCancel,
};
use pixel_cutout_sprite_studio_lib::storage::{
    InterruptAfterStep, JsonStore, NoTransactionFault, RecoveryCandidate, RecoveryChoice,
    StorageError, TransactionPurpose, TransactionService, TransactionState, VaultRoot,
};
use tempfile::TempDir;

const AREA_PATH: &str = "game/npcs";

struct ExportFixture {
    directory: TempDir,
    root: VaultRoot,
    character_id: ObjectId,
    binding_id: ObjectId,
    motion_path: PathBuf,
    output_path: PathBuf,
}

impl ExportFixture {
    fn new() -> Self {
        let directory = TempDir::new().unwrap();
        let root = VaultRoot::open(directory.path()).unwrap();
        let timestamp = timestamp();
        let project_id = ObjectId::new();
        let area_id = ObjectId::new();
        let profile_id = ObjectId::new();
        let template_id = ObjectId::new();
        let character_id = ObjectId::new();
        let appearance_id = ObjectId::new();
        let binding_id = ObjectId::new();
        let profile_ref = RevisionRef {
            id: profile_id,
            revision: 1,
        };
        let template_ref = RevisionRef {
            id: template_id,
            revision: 1,
        };
        let character_path = PathBuf::from(AREA_PATH).join("transactional-hero");
        let binding_path = character_path.join("walk");

        write_document(
            &root,
            PathBuf::from("game/.project/project.json"),
            DomainDocument::Project(Project {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Project,
                id: project_id,
                revision: 1,
                name: "Game".to_owned(),
                status: RecordStatus::Active,
                workspace_label_ids: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );
        write_document(
            &root,
            PathBuf::from(AREA_PATH).join(".area/area.json"),
            DomainDocument::Area(Area {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Area,
                id: area_id,
                revision: 1,
                project_id,
                name: "NPCs".to_owned(),
                object_type: ObjectType::Humanoid,
                profile_ref,
                reference_height_px: 80,
                direction_model: DirectionModel::EightWay,
                directions: Direction::ALL.to_vec(),
                default_frame_size_px: PixelSize(4, 4),
                default_ground_origin_px: PixelPoint(2, 2),
                label_ids: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );

        let body = SlotId::parse("body").unwrap();
        write_document(
            &root,
            PathBuf::from(AREA_PATH).join(".area/profiles/humanoid/r0001.json"),
            DomainDocument::ProfileRevision(ProfileRevision {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::ProfileRevision,
                profile_id,
                revision: 1,
                area_id,
                name: "Optional test body".to_owned(),
                reference_height_px: 80,
                slots: vec![SlotDefinition {
                    id: body.clone(),
                    parent_id: None,
                    optional: true,
                    size_px: PixelSize(1, 1),
                    pivot_px: PixelPoint(0, 0),
                    base_transform: identity(),
                }],
                views: Direction::ALL
                    .into_iter()
                    .map(
                        |direction| pixel_cutout_sprite_studio_lib::domain::DirectionView {
                            direction,
                            layer_order: vec![body.clone()],
                            base_transforms: vec![ViewTransform {
                                slot_id: body.clone(),
                                transform: identity(),
                            }],
                        },
                    )
                    .collect(),
                mirror_pairs: Vec::new(),
                published_at: timestamp,
            }),
        );
        write_document(
            &root,
            PathBuf::from(AREA_PATH).join(".area/templates/walk/template.json"),
            DomainDocument::MotionTemplate(MotionTemplate {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::MotionTemplate,
                id: template_id,
                revision: 1,
                area_id,
                name: "Walk".to_owned(),
                action_key: ActionKey::parse("walk").unwrap(),
                status: pixel_cutout_sprite_studio_lib::domain::TemplateStatus::Active,
                label_ids: Vec::new(),
                draft_revision: 1,
                draft_base_release: Some(1),
                released_revisions: vec![1],
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );
        let motion_path =
            PathBuf::from(AREA_PATH).join(".area/templates/walk/revisions/r0001.json");
        write_document(
            &root,
            motion_path.clone(),
            DomainDocument::MotionRevision(MotionRevision {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::MotionRevision,
                template_id,
                revision: 1,
                profile_ref,
                frame_size_px: PixelSize(4, 4),
                ground_origin_px: PixelPoint(2, 2),
                frame_count: 1,
                fps: 8,
                loop_mode: LoopMode::Loop,
                directions: Direction::ALL
                    .into_iter()
                    .map(|direction| DirectionDefinition {
                        direction,
                        mode: DirectionMode::Explicit,
                        source: None,
                    })
                    .collect(),
                tracks: Vec::new(),
                semantics: None,
                published_at: timestamp,
            }),
        );
        write_document(
            &root,
            character_path.join("character.json"),
            DomainDocument::Character(Character {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Character,
                id: character_id,
                revision: 1,
                area_id,
                name: "Transactional hero".to_owned(),
                description: String::new(),
                status: CharacterStatus::Reviewed,
                profile_ref,
                default_appearance_id: appearance_id,
                label_ids: Vec::new(),
                required_actions: vec![ActionKey::parse("walk").unwrap()],
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );
        write_document(
            &root,
            character_path.join("appearances/default.json"),
            DomainDocument::Appearance(Appearance {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Appearance,
                id: appearance_id,
                revision: 1,
                character_id,
                profile_ref,
                name: "Default".to_owned(),
                slots: Vec::new(),
                asset_fallback_approvals: Vec::new(),
                equipment: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );
        write_document(
            &root,
            binding_path.join("binding.json"),
            DomainDocument::AnimationBinding(AnimationBinding {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::AnimationBinding,
                id: binding_id,
                revision: 1,
                character_id,
                action_key: ActionKey::parse("walk").unwrap(),
                template_ref,
                appearance_id,
                local_overrides: Vec::new(),
                review_state: ReviewState::Reviewed,
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );

        Self {
            directory,
            root,
            character_id,
            binding_id,
            motion_path,
            output_path: binding_path.join("exports"),
        }
    }

    fn request(&self) -> StartNpcExportRequest {
        StartNpcExportRequest {
            character_id: self.character_id,
            binding_ids: vec![self.binding_id],
            profile: ExportProfileSnapshot {
                name: "Recovery integration".to_owned(),
                directions: Direction::ALL.to_vec(),
                max_page_size_px: AtlasSize(32, 32),
                max_pages: 8,
                memory_budget_bytes: 1024 * 1024,
                padding_px: 0,
                extrude_edges: false,
                individual_frames: false,
                include_shadow: false,
                normalize_geometry: false,
                clipping_policy: ClippingPolicy::Block,
                allow_incomplete_test: false,
            },
            root_motion_mode: ExportRootMotionMode::Baked,
            jump_mode: ExportJumpMode::Baked,
            format: ExportOutputFormat::PngJson,
            include_godot_scene: false,
        }
    }

    fn change_motion_fingerprint(&self) {
        let resolved = self.root.resolve(&self.motion_path).unwrap();
        let loaded = JsonStore::default().load(&resolved).unwrap();
        let DomainDocument::MotionRevision(mut motion) = loaded.value else {
            panic!("fixture motion path contained the wrong document kind");
        };
        motion.fps += 1;
        JsonStore::default()
            .compare_and_swap(
                &resolved,
                &loaded.stamp,
                &DomainDocument::MotionRevision(motion),
            )
            .unwrap();
    }
}

#[test]
fn transactional_npc_export_publishes_a_pointer_that_reopens_cleanly() {
    let fixture = ExportFixture::new();
    let outcome = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.request(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();

    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&fixture.root)
            .unwrap()
            .is_empty()
    );
    let pointer = fixture
        .root
        .resolve(&fixture.output_path.join("current.json"))
        .unwrap();
    assert!(pointer.as_path().is_file());

    let reopened = VaultRoot::open(fixture.directory.path()).unwrap();
    let current = ExportService::new(reopened, env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.current.source_fingerprint,
        outcome.manifest.source_fingerprint
    );
    assert_eq!(current.manifest, outcome.manifest);
}

#[test]
fn failed_transactional_publication_preserves_the_last_valid_pointer() {
    let fixture = ExportFixture::new();
    let initial = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.request(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let pointer = fixture
        .root
        .resolve(&fixture.output_path.join("current.json"))
        .unwrap();
    let previous_pointer = fs::read(pointer.as_path()).unwrap();
    fixture.change_motion_fingerprint();

    let cancellation = CancellationFlag::default();
    let cancel_from_progress = cancellation.clone();
    let failed = NpcExportService.export(
        &fixture.root,
        Path::new(AREA_PATH),
        fixture.request(),
        &cancellation,
        &mut move |event: ExportProgress| {
            if event.stage == ExportStage::Publishing && event.completed == 0 {
                cancel_from_progress.cancel();
            }
        },
    );

    assert!(matches!(
        failed,
        Err(NpcExportError::Export(ExportError::Cancelled))
    ));
    assert_eq!(fs::read(pointer.as_path()).unwrap(), previous_pointer);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&fixture.root)
            .unwrap()
            .is_empty()
    );

    let reopened = VaultRoot::open(fixture.directory.path()).unwrap();
    let current = ExportService::new(reopened, env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.current.source_fingerprint,
        initial.manifest.source_fingerprint
    );
    assert_eq!(current.manifest, initial.manifest);
}

#[cfg(unix)]
#[test]
fn unreadable_current_pointer_preserves_it_and_removes_unjournaled_staging() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = ExportFixture::new();
    let initial = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.request(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let pointer = fixture
        .root
        .resolve(&fixture.output_path.join("current.json"))
        .unwrap();
    let previous_pointer = fs::read(pointer.as_path()).unwrap();
    fs::set_permissions(pointer.as_path(), fs::Permissions::from_mode(0o000)).unwrap();
    fixture.change_motion_fingerprint();

    let failed = NpcExportService.export(
        &fixture.root,
        Path::new(AREA_PATH),
        fixture.request(),
        &NeverCancel,
        &mut |_| {},
    );
    fs::set_permissions(pointer.as_path(), fs::Permissions::from_mode(0o600)).unwrap();

    assert!(matches!(
        failed,
        Err(NpcExportError::Storage(StorageError::Io { .. }))
    ));
    assert_eq!(fs::read(pointer.as_path()).unwrap(), previous_pointer);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&fixture.root)
            .unwrap()
            .is_empty()
    );
    let transaction_directory = fixture
        .root
        .resolve(Path::new("game/.project/transactions"))
        .unwrap();
    assert!(fs::read_dir(transaction_directory.as_path())
        .unwrap()
        .all(|entry| !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .ends_with(".stage")));

    let current = ExportService::new(fixture.root.clone(), env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.current.source_fingerprint,
        initial.manifest.source_fingerprint
    );
}

#[test]
fn interrupted_export_rollback_restores_and_validates_the_previous_pointer() {
    let fixture = ExportFixture::new();
    let initial = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.request(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    let pointer = fixture
        .root
        .resolve(&fixture.output_path.join("current.json"))
        .unwrap();
    let previous_pointer = fs::read(pointer.as_path()).unwrap();
    fixture.change_motion_fingerprint();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = NpcExportService.execute_with_transactions(
        &fixture.root,
        Path::new(AREA_PATH),
        fixture.request(),
        &NeverCancel,
        &mut |_| {},
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(NpcExportError::Storage(
            StorageError::TransactionInterrupted { step: 1 }
        ))
    ));
    assert_ne!(
        fs::read(pointer.as_path()).unwrap(),
        previous_pointer,
        "the injected crash occurs after the new pointer reaches its target"
    );

    let reopened = VaultRoot::open(fixture.directory.path()).unwrap();
    let candidate = sole_export_candidate(&reopened);
    let transaction_id = candidate.transaction_id;
    let recovered = TransactionService::<NoTransactionFault>::default()
        .recover_candidate(&reopened, transaction_id, RecoveryChoice::Rollback)
        .unwrap();
    assert_eq!(recovered.state, TransactionState::RolledBack);
    assert_eq!(fs::read(pointer.as_path()).unwrap(), previous_pointer);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&reopened)
            .unwrap()
            .is_empty()
    );

    let current = ExportService::new(reopened, env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.current.source_fingerprint,
        initial.manifest.source_fingerprint
    );
    assert_eq!(current.manifest, initial.manifest);
}

#[test]
fn interrupted_export_resume_validates_and_commits_the_new_pointer() {
    let fixture = ExportFixture::new();
    let initial = NpcExportService
        .export(
            &fixture.root,
            Path::new(AREA_PATH),
            fixture.request(),
            &NeverCancel,
            &mut |_| {},
        )
        .unwrap();
    fixture.change_motion_fingerprint();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = NpcExportService.execute_with_transactions(
        &fixture.root,
        Path::new(AREA_PATH),
        fixture.request(),
        &NeverCancel,
        &mut |_| {},
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(NpcExportError::Storage(
            StorageError::TransactionInterrupted { step: 1 }
        ))
    ));

    let reopened = VaultRoot::open(fixture.directory.path()).unwrap();
    let pending = ExportService::new(reopened.clone(), env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_ne!(
        pending.current.source_fingerprint,
        initial.manifest.source_fingerprint
    );
    let candidate = sole_export_candidate(&reopened);
    let transaction_id = candidate.transaction_id;
    let recovered = TransactionService::<NoTransactionFault>::default()
        .recover_candidate(&reopened, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    assert_eq!(recovered.state, TransactionState::Committed);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&reopened)
            .unwrap()
            .is_empty()
    );

    let reopened_after_recovery = VaultRoot::open(fixture.directory.path()).unwrap();
    let current = ExportService::new(reopened_after_recovery, env!("CARGO_PKG_VERSION"))
        .current(&fixture.output_path)
        .unwrap()
        .unwrap();
    assert_eq!(
        current.current.source_fingerprint,
        pending.current.source_fingerprint
    );
    assert_eq!(current.manifest, pending.manifest);
}

fn sole_export_candidate(root: &VaultRoot) -> RecoveryCandidate {
    let candidates = TransactionService::<NoTransactionFault>::scan_open(root).unwrap();
    assert_eq!(candidates.len(), 1);
    let candidate = candidates.into_iter().next().unwrap();
    assert_eq!(candidate.purpose, TransactionPurpose::ExportCompletion);
    assert_eq!(candidate.state, TransactionState::Applying);
    assert_eq!(candidate.completed_steps, 0);
    assert_eq!(candidate.total_steps, 1);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    assert!(candidate.issue.is_none());
    candidate
}

fn write_document(root: &VaultRoot, relative: PathBuf, document: DomainDocument) {
    fs::create_dir_all(root.path().join(&relative).parent().unwrap()).unwrap();
    JsonStore::default()
        .create(&root.resolve(&relative).unwrap(), &document)
        .unwrap();
}

fn timestamp() -> UtcTimestamp {
    UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap()
}

fn identity() -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(0, 0),
        rotation_deg: 0.0,
    }
}
