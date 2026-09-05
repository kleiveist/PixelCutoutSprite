use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::animation::{AnimationSampler, PresetKind};
use pixel_cutout_sprite_studio_lib::application::{
    AreaDetails, AreaService, CreateAreaRequest, CreateMotionRequest, LabelService,
    MotionCardStatus, MotionEditorData, MotionOpenTarget, MotionService, ProjectCard,
    ProjectService, ReviseAreaProfileRequest, SaveMotionDraftRequest, VaultOpenMode, VaultService,
};
use pixel_cutout_sprite_studio_lib::domain::{
    ActionKey, AnimationBinding, Character, CharacterStatus, Direction, DirectionMode,
    DocumentKind, DomainDocument, Interpolation, Keyframe, LabelScope, LoopMode, MotionTrack,
    ObjectId, ObjectType, ReviewState, TrackProperty, TrackValue, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::{
    object_folder, InterruptAfterStep, JsonStore, NoTransactionFault, RecoveryChoice, StorageError,
    TransactionPurpose, TransactionService, TransactionState, VaultRoot,
};
use tempfile::TempDir;

struct Fixture {
    temp: TempDir,
    service: VaultService,
    session_id: ObjectId,
    project: ProjectCard,
    area: AreaDetails,
}

impl Fixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let mut service = VaultService::default();
        let opened = service.initialize(temp.path(), None).unwrap();
        let project = ProjectService::create(
            &mut service,
            opened.session_id,
            "Demo RPG".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &service,
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
            service,
            session_id: opened.session_id,
            project,
            area,
        }
    }

    fn request(&self, name: &str, action: &str) -> CreateMotionRequest {
        CreateMotionRequest {
            area_id: self.area.area.id,
            name: name.to_owned(),
            action_key: action.to_owned(),
            frame_count: 12,
            fps: 12,
            loop_mode: LoopMode::Loop,
            frame_size_px: None,
            ground_origin_px: None,
            label_ids: Vec::new(),
            preset_kind: None,
        }
    }

    fn area_folder(&self) -> PathBuf {
        object_folder(&self.project.name, self.project.id)
            .unwrap()
            .join(object_folder(&self.area.area.name, self.area.area.id).unwrap())
    }

    fn template_folder(&self, name: &str, id: ObjectId) -> PathBuf {
        self.area_folder()
            .join(".area/templates")
            .join(object_folder(name, id).unwrap())
    }

    fn install_character(&self, name: &str) -> Character {
        let timestamp = UtcTimestamp::parse("2026-09-05T11:05:00Z").unwrap();
        let character = Character {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Character,
            id: ObjectId::new(),
            revision: 1,
            area_id: self.area.area.id,
            name: name.to_owned(),
            description: String::new(),
            status: CharacterStatus::Draft,
            profile_ref: self.area.area.profile_ref,
            default_appearance_id: ObjectId::new(),
            label_ids: Vec::new(),
            required_actions: vec![ActionKey::parse("walk").unwrap()],
            created_at: timestamp,
            updated_at: timestamp,
        };
        let folder = self
            .area_folder()
            .join(object_folder(&character.name, character.id).unwrap());
        let root = VaultRoot::open(self.temp.path()).unwrap();
        root.ensure_directory(&folder).unwrap();
        JsonStore::default()
            .create(
                &root.resolve(&folder.join("character.json")).unwrap(),
                &DomainDocument::Character(character.clone()),
            )
            .unwrap();
        character
    }

    fn install_binding(&self, character: &Character, template_id: ObjectId) -> AnimationBinding {
        let (binding, binding_path) = self.binding_fixture(character, template_id);
        let root = VaultRoot::open(self.temp.path()).unwrap();
        root.ensure_directory(binding_path.parent().unwrap())
            .unwrap();
        JsonStore::default()
            .create(
                &root.resolve(&binding_path).unwrap(),
                &DomainDocument::AnimationBinding(binding.clone()),
            )
            .unwrap();
        binding
    }

    fn binding_fixture(
        &self,
        character: &Character,
        template_id: ObjectId,
    ) -> (AnimationBinding, PathBuf) {
        let timestamp = UtcTimestamp::parse("2026-09-05T11:05:00Z").unwrap();
        let binding = AnimationBinding {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::AnimationBinding,
            id: ObjectId::new(),
            revision: 1,
            character_id: character.id,
            action_key: ActionKey::parse("walk").unwrap(),
            template_ref: pixel_cutout_sprite_studio_lib::domain::RevisionRef {
                id: template_id,
                revision: 1,
            },
            appearance_id: character.default_appearance_id,
            local_overrides: Vec::new(),
            review_state: ReviewState::Draft,
            created_at: timestamp,
            updated_at: timestamp,
        };
        let character_folder = self
            .area_folder()
            .join(object_folder(&character.name, character.id).unwrap());
        let binding_folder = character_folder.join(object_folder("walk", binding.id).unwrap());
        (binding, binding_folder.join("binding.json"))
    }
}

fn save_request(editor: &MotionEditorData, fps: u16) -> SaveMotionDraftRequest {
    SaveMotionDraftRequest {
        template_id: editor.draft.template_id,
        expected_revision: editor.draft.revision,
        expected_sha256: editor.draft_sha256.clone(),
        frame_size_px: editor.draft.frame_size_px,
        ground_origin_px: editor.draft.ground_origin_px,
        frame_count: editor.draft.frame_count,
        fps,
        loop_mode: editor.draft.loop_mode,
        directions: editor.draft.directions.clone(),
        tracks: editor.draft.tracks.clone(),
        semantics: editor.draft.semantics.clone(),
    }
}

fn motion_paths(fixture: &Fixture, name: &str, id: ObjectId) -> (PathBuf, PathBuf) {
    let folder = fixture.temp.path().join(fixture.template_folder(name, id));
    (folder.join("draft.json"), folder.join("template.json"))
}

fn read_json(path: &Path) -> serde_json::Value {
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}

#[test]
fn preset_creation_persists_editable_semantics_and_releases_the_same_motion() {
    let mut fixture = Fixture::new();
    let mut request = fixture.request("Guided walk", "walk");
    request.preset_kind = Some(PresetKind::Walk);
    request.frame_count = 10;
    request.fps = 24;
    let card = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    assert_eq!((card.frame_count, card.fps), (10, 24));
    assert_eq!(card.semantics.as_ref().unwrap().preset, PresetKind::Walk);
    let draft = MotionService::load_draft(&fixture.service, fixture.session_id, card.id).unwrap();
    assert_eq!(draft.tracks.len(), 5);
    for direction in Direction::ALL {
        AnimationSampler
            .sample(&draft.sampling_revision(), direction, 0)
            .unwrap();
    }
    let release =
        MotionService::publish(&mut fixture.service, fixture.session_id, card.id).unwrap();
    assert_eq!(release.semantics, draft.semantics);
    assert_eq!(release.tracks, draft.tracks);
}

#[test]
fn motion_dashboard_includes_project_label_display_names() {
    let mut fixture = Fixture::new();
    let label = LabelService::create(
        &mut fixture.service,
        fixture.session_id,
        LabelScope::Project,
        Some(fixture.project.id),
        "Locomotion".to_owned(),
        "#55aa77".to_owned(),
    )
    .unwrap();
    let mut request = fixture.request("Village walk", "walk");
    request.label_ids = vec![label.id];
    MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();

    let dashboard =
        MotionService::dashboard(&fixture.service, fixture.session_id, fixture.area.area.id)
            .unwrap();
    assert_eq!(dashboard.labels, vec![label]);
    assert_eq!(dashboard.motions[0].label_ids, vec![dashboard.labels[0].id]);
}

#[test]
fn create_publish_edit_and_republish_keep_every_release_immutable() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Village walk", "walk");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    assert_eq!(created.status, MotionCardStatus::New);
    assert_eq!(created.direction_coverage.len(), 8);
    assert_eq!(created.profile_ref, fixture.area.area.profile_ref);
    assert_eq!(created.frame_count, 12);
    assert_eq!(created.fps, 12);

    let release =
        MotionService::publish(&mut fixture.service, fixture.session_id, created.id).unwrap();
    assert_eq!(release.revision, 1);
    let release_path = fixture
        .temp
        .path()
        .join(fixture.template_folder(&created.name, created.id))
        .join("revisions/r0001.json");
    let first_release_bytes = fs::read(&release_path).unwrap();
    let released_dashboard =
        MotionService::dashboard(&fixture.service, fixture.session_id, fixture.area.area.id)
            .unwrap();
    assert_eq!(
        released_dashboard.motions[0].status,
        MotionCardStatus::Released
    );
    assert!(matches!(
        MotionService::resolve_open(&fixture.service, fixture.session_id, created.id, None).unwrap(),
        MotionOpenTarget::OutfitChooser {
            template_revision: 1,
            compatible_character_ids,
            ..
        } if compatible_character_ids.is_empty()
    ));

    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let draft = editor.draft;
    let edited = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            expected_sha256: editor.draft_sha256,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: 24,
            loop_mode: draft.loop_mode,
            semantics: draft.semantics.clone(),
            directions: draft.directions,
            tracks: draft.tracks,
        },
    )
    .unwrap();
    assert_eq!(edited.revision, 2);
    assert_eq!(fs::read(&release_path).unwrap(), first_release_bytes);
    let changed =
        MotionService::dashboard(&fixture.service, fixture.session_id, fixture.area.area.id)
            .unwrap();
    assert_eq!(
        changed.motions[0].status,
        MotionCardStatus::UnpublishedChanges
    );

    let second =
        MotionService::publish(&mut fixture.service, fixture.session_id, created.id).unwrap();
    assert_eq!(second.revision, 2);
    assert_eq!(second.fps, 24);
    assert_eq!(fs::read(&release_path).unwrap(), first_release_bytes);
}

#[test]
fn invalid_timing_is_rejected_and_duplicate_gets_a_new_identity() {
    let mut fixture = Fixture::new();
    let mut invalid = fixture.request("Broken", "walk");
    invalid.fps = 0;
    assert!(MotionService::create(&mut fixture.service, fixture.session_id, invalid).is_err());

    let request = fixture.request("Jump", "jump");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let copy =
        MotionService::duplicate(&mut fixture.service, fixture.session_id, created.id).unwrap();
    assert_ne!(copy.id, created.id);
    assert_eq!(copy.status, MotionCardStatus::New);
    assert!(copy.name.starts_with("Jump copy"));
    let archived = MotionService::set_archived(
        &mut fixture.service,
        fixture.session_id,
        copy.id,
        copy.revision,
        true,
    )
    .unwrap();
    assert_eq!(archived.status, MotionCardStatus::Archived);
    MotionService::remove(
        &mut fixture.service,
        fixture.session_id,
        copy.id,
        archived.revision,
    )
    .unwrap();
    assert_eq!(
        MotionService::dashboard(&fixture.service, fixture.session_id, fixture.area.area.id)
            .unwrap()
            .motions
            .len(),
        1
    );
}

#[test]
fn multiple_compatible_npcs_are_returned_as_choices_and_never_selected_arbitrarily() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Village walk", "walk");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    MotionService::publish(&mut fixture.service, fixture.session_id, created.id).unwrap();
    let first = fixture.install_character("Villager 01");
    let second = fixture.install_character("Villager 02");

    let MotionOpenTarget::OutfitChooser {
        compatible_character_ids,
        ..
    } = MotionService::resolve_open(&fixture.service, fixture.session_id, created.id, None)
        .unwrap()
    else {
        panic!("a released template must enter the explicit outfit chooser");
    };
    assert_eq!(compatible_character_ids.len(), 2);
    assert!(compatible_character_ids.contains(&first.id));
    assert!(compatible_character_ids.contains(&second.id));

    let binding = fixture.install_binding(&first, created.id);
    assert_eq!(
        MotionService::resolve_open(
            &fixture.service,
            fixture.session_id,
            created.id,
            Some(first.id),
        )
        .unwrap(),
        MotionOpenTarget::BindingEditor {
            template_id: created.id,
            binding_id: binding.id,
            character_id: first.id,
        }
    );
    let dashboard =
        MotionService::dashboard(&fixture.service, fixture.session_id, fixture.area.area.id)
            .unwrap();
    let error = MotionService::remove(
        &mut fixture.service,
        fixture.session_id,
        created.id,
        dashboard.motions[0].revision,
    )
    .unwrap_err();
    assert!(error.to_string().contains("referenced"));
}

#[test]
fn motion_remove_rechecks_a_binding_that_appears_after_journal_prepare() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Late binding", "walk");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let character = fixture.install_character("Late user");
    let (binding, binding_path) = fixture.binding_fixture(&character, created.id);
    let absolute_binding = fixture.temp.path().join(&binding_path);
    let binding_bytes = serde_json::to_vec_pretty(&binding).unwrap();
    let transactions = TransactionService::default();

    let result = MotionService::remove_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        created.id,
        created.revision,
        &transactions,
        (
            || Ok(()),
            || {
                fs::create_dir_all(absolute_binding.parent().unwrap()).unwrap();
                fs::write(&absolute_binding, &binding_bytes).unwrap();
                Ok(())
            },
        ),
    );

    assert!(
        matches!(result, Err(StorageError::InvalidVault(message)) if message.contains("became referenced"))
    );
    assert!(absolute_binding.is_file());
    assert!(fixture
        .temp
        .path()
        .join(fixture.template_folder(&created.name, created.id))
        .is_dir());
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn motion_remove_rejects_an_external_source_tree_change_before_prepare() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Externally edited", "external_edit");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let template_folder = fixture
        .temp
        .path()
        .join(fixture.template_folder(&created.name, created.id));
    let external = template_folder.join("external-note.txt");
    let transactions = TransactionService::default();

    let result = MotionService::remove_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        created.id,
        created.revision,
        &transactions,
        (
            || {
                fs::write(&external, b"arrived after the remove view").unwrap();
                Ok(())
            },
            || Ok(()),
        ),
    );

    assert!(matches!(result, Err(StorageError::WriteConflict)));
    assert!(template_folder.is_dir());
    assert_eq!(
        fs::read(&external).unwrap(),
        b"arrived after the remove view"
    );
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn interrupted_motion_remove_resumes_or_rolls_back_after_reopen() {
    for choice in [RecoveryChoice::Resume, RecoveryChoice::Rollback] {
        let mut fixture = Fixture::new();
        let request = fixture.request("Recover remove", "recover_remove");
        let created =
            MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
        let original_folder = fixture.template_folder(&created.name, created.id);
        let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });

        assert!(matches!(
            MotionService::remove_with_transactions(
                &mut fixture.service,
                fixture.session_id,
                created.id,
                created.revision,
                &interrupted,
                (|| Ok(()), || Ok(())),
            ),
            Err(StorageError::TransactionInterrupted { step: 1 })
        ));
        assert!(!fixture.temp.path().join(&original_folder).exists());
        fixture.service.close(fixture.session_id).unwrap();

        let mut reopened = VaultService::default();
        let opened = reopened.open(fixture.temp.path()).unwrap();
        assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
        assert!(opened.recovery_writable);
        assert_eq!(opened.recovery.len(), 1);
        assert_eq!(opened.recovery[0].purpose, TransactionPurpose::TrashMove);
        assert!(opened.recovery[0].can_resume);
        assert!(opened.recovery[0].can_rollback);
        let recovered = reopened
            .recover_transaction(opened.session_id, opened.recovery[0].transaction_id, choice)
            .unwrap();
        assert!(recovered.recovery.is_empty());
        assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);

        let dashboard =
            MotionService::dashboard(&reopened, opened.session_id, fixture.area.area.id).unwrap();
        if choice == RecoveryChoice::Resume {
            assert!(dashboard.motions.is_empty());
            assert!(!fixture.temp.path().join(&original_folder).exists());
        } else {
            assert_eq!(dashboard.motions.len(), 1);
            assert_eq!(dashboard.motions[0].id, created.id);
            assert!(fixture.temp.path().join(&original_folder).is_dir());
        }
        reopened.close(opened.session_id).unwrap();
    }
}

#[test]
fn draft_file_is_area_owned_and_not_confused_with_an_immutable_release() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Idle", "idle");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let template_folder = fixture.template_folder(&created.name, created.id);
    assert!(fixture
        .temp
        .path()
        .join(&template_folder)
        .join("draft.json")
        .is_file());
    assert!(!fixture
        .temp
        .path()
        .join(&template_folder)
        .join("revisions/r0001.json")
        .exists());
    let json: serde_json::Value = serde_json::from_slice(
        &fs::read(fixture.temp.path().join(template_folder).join("draft.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(json["kind"], "motion_draft");
    assert!(json["released_from_draft_revision"].is_null());
    assert!(!Path::new(json["template_id"].as_str().unwrap()).is_absolute());
}

#[test]
fn editor_reopens_saved_pose_with_its_exact_pinned_profile() {
    let mut fixture = Fixture::new();
    let old_profile = fixture.area.area.profile_ref;
    let request = fixture.request("Wave", "wave");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let draft = editor.draft;
    let track = MotionTrack {
        direction: Direction::S,
        slot_id: pixel_cutout_sprite_studio_lib::domain::SlotId::parse("hand_l").unwrap(),
        property: TrackProperty::OffsetXPx,
        interpolation: Interpolation::Linear,
        keys: vec![Keyframe {
            frame: 0,
            value: TrackValue::Number(5.0),
        }],
    };
    MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            expected_sha256: editor.draft_sha256,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
            semantics: draft.semantics.clone(),
            directions: draft.directions,
            tracks: vec![track.clone()],
        },
    )
    .unwrap();
    let revised = AreaService::revise_profile(
        &fixture.service,
        fixture.session_id,
        ReviseAreaProfileRequest {
            area_id: fixture.area.area.id,
            expected_area_revision: fixture.area.area.revision,
            reference_height_px: 96,
            default_frame_size_px: None,
            default_ground_origin_px: None,
        },
    )
    .unwrap();
    assert_ne!(revised.area.profile_ref, old_profile);

    fixture.service.close(fixture.session_id).unwrap();
    fixture.session_id = fixture
        .service
        .open(fixture.temp.path())
        .unwrap()
        .session_id;
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    assert_eq!(editor.profile.reference(), old_profile);
    assert_eq!(editor.draft.tracks, vec![track]);
    assert!(editor.writable);
}

#[test]
fn saving_rejects_tracks_outside_the_pinned_profile_without_mutating_the_draft() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Invalid slot", "invalid_slot");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let draft = editor.draft;
    let result = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            expected_sha256: editor.draft_sha256,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
            semantics: draft.semantics.clone(),
            directions: draft.directions.clone(),
            tracks: vec![MotionTrack {
                direction: Direction::S,
                slot_id: pixel_cutout_sprite_studio_lib::domain::SlotId::parse("ghost").unwrap(),
                property: TrackProperty::OffsetXPx,
                interpolation: Interpolation::Linear,
                keys: vec![Keyframe {
                    frame: 0,
                    value: TrackValue::Number(1.0),
                }],
            }],
        },
    );
    assert!(result.is_err());
    let reopened =
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap();
    assert_eq!(reopened, draft);
}

#[test]
fn five_source_defaults_and_release_gate_reject_direction_gaps_or_invalid_mirrors() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Eight way", "eight_way");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let draft = editor.draft;
    assert_eq!(
        draft
            .directions
            .iter()
            .filter(|definition| definition.mode == DirectionMode::Explicit)
            .count(),
        5
    );
    assert_eq!(
        draft
            .directions
            .iter()
            .filter(|definition| definition.mode == DirectionMode::Mirrored)
            .count(),
        3
    );

    let mut with_gap = draft.directions.clone();
    let northwest = with_gap
        .iter_mut()
        .find(|definition| definition.direction == Direction::Nw)
        .unwrap();
    northwest.mode = DirectionMode::Missing;
    northwest.source = None;
    let saved = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            expected_sha256: editor.draft_sha256,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
            semantics: draft.semantics.clone(),
            directions: with_gap,
            tracks: draft.tracks.clone(),
        },
    )
    .unwrap();
    let error =
        MotionService::publish(&mut fixture.service, fixture.session_id, created.id).unwrap_err();
    assert!(error.to_string().contains("missing"));
    assert!(!fixture
        .temp
        .path()
        .join(fixture.template_folder(&created.name, created.id))
        .join("revisions/r0001.json")
        .exists());

    let mut invalid = saved.directions.clone();
    let west = invalid
        .iter_mut()
        .find(|definition| definition.direction == Direction::W)
        .unwrap();
    west.mode = DirectionMode::Mirrored;
    west.source = Some(Direction::Ne);
    let saved_sha256 = MotionService::editor_data(&fixture.service, fixture.session_id, created.id)
        .unwrap()
        .draft_sha256;
    let invalid_result = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: saved.revision,
            expected_sha256: saved_sha256,
            frame_size_px: saved.frame_size_px,
            ground_origin_px: saved.ground_origin_px,
            frame_count: saved.frame_count,
            fps: saved.fps,
            loop_mode: saved.loop_mode,
            semantics: saved.semantics.clone(),
            directions: invalid,
            tracks: saved.tracks.clone(),
        },
    );
    assert!(invalid_result
        .unwrap_err()
        .to_string()
        .contains("may only mirror horizontally"));
    assert_eq!(
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap(),
        saved
    );
}

#[test]
fn same_revision_external_draft_edit_is_rejected_by_the_editor_baseline_hash() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Concurrent edit", "concurrent_edit");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let (draft_path, template_path) = motion_paths(&fixture, &created.name, created.id);
    let template_before = fs::read(&template_path).unwrap();
    let mut externally_edited = read_json(&draft_path);
    externally_edited["fps"] = serde_json::Value::from(18);
    let external_bytes = serde_json::to_vec_pretty(&externally_edited).unwrap();
    fs::write(&draft_path, &external_bytes).unwrap();

    let error = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        save_request(&editor, 24),
    )
    .unwrap_err();
    assert!(matches!(error, StorageError::WriteConflict));
    assert_eq!(fs::read(&draft_path).unwrap(), external_bytes);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);
    let current =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    assert_eq!(current.draft.revision, editor.draft.revision);
    assert_eq!(current.draft.fps, 18);
    assert_ne!(current.draft_sha256, editor.draft_sha256);
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn interrupted_two_file_draft_save_resumes_after_reopen() {
    let mut fixture = Fixture::new();
    let mut create = fixture.request("Recover save", "recover_save");
    create.preset_kind = Some(PresetKind::Walk);
    let created = MotionService::create(&mut fixture.service, fixture.session_id, create).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let original_semantics = editor.draft.semantics.clone();
    let (draft_path, template_path) = motion_paths(&fixture, &created.name, created.id);
    let template_before = fs::read(&template_path).unwrap();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = MotionService::save_draft_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        save_request(&editor, 24),
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    let partial_draft = read_json(&draft_path);
    assert_eq!(partial_draft["revision"].as_u64(), Some(2));
    assert_eq!(partial_draft["fps"].as_u64(), Some(24));
    assert_eq!(fs::read(&template_path).unwrap(), template_before);

    fixture.service.close(fixture.session_id).unwrap();
    let mut reopened = VaultService::default();
    let opened = reopened.open(fixture.temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(opened.recovery_writable);
    assert_eq!(opened.recovery.len(), 1);
    let candidate = &opened.recovery[0];
    assert_eq!(candidate.purpose, TransactionPurpose::General);
    assert_eq!(candidate.state, TransactionState::Applying);
    assert_eq!(candidate.completed_steps, 0);
    assert_eq!(candidate.total_steps, 2);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;

    let recovered = reopened
        .recover_transaction(opened.session_id, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
    assert!(!recovered.recovery_writable);
    assert!(recovered.recovery.is_empty());
    let saved = MotionService::editor_data(&reopened, opened.session_id, created.id).unwrap();
    assert_eq!(saved.draft.revision, editor.draft.revision + 1);
    assert_eq!(saved.draft.fps, 24);
    assert_eq!(saved.draft.semantics, original_semantics);
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    let loaded_template = JsonStore::default()
        .load(
            &root
                .resolve(
                    &fixture
                        .template_folder(&created.name, created.id)
                        .join("template.json"),
                )
                .unwrap(),
        )
        .unwrap();
    let DomainDocument::MotionTemplate(template) = loaded_template.value else {
        panic!("motion template expected after recovery");
    };
    assert_eq!(template.revision, created.revision + 1);
    assert_eq!(template.draft_revision, saved.draft.revision);
    assert_eq!(template.updated_at, saved.draft.updated_at);
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
    let project_folder = fixture.area_folder().parent().unwrap().to_path_buf();
    assert!(!fixture
        .temp
        .path()
        .join(&project_folder)
        .join(format!(".project/transactions/{transaction_id}.stage"))
        .exists());
    assert!(!fixture
        .temp
        .path()
        .join(project_folder)
        .join(format!(".project/backups/motion-save--{transaction_id}"))
        .exists());
}

#[test]
fn interrupted_two_file_draft_save_rolls_back_after_reopen() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Rollback save", "rollback_save");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let (draft_path, template_path) = motion_paths(&fixture, &created.name, created.id);
    let draft_before = fs::read(&draft_path).unwrap();
    let template_before = fs::read(&template_path).unwrap();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = MotionService::save_draft_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        save_request(&editor, 30),
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    assert_ne!(fs::read(&draft_path).unwrap(), draft_before);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);

    fixture.service.close(fixture.session_id).unwrap();
    let mut reopened = VaultService::default();
    let opened = reopened.open(fixture.temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(opened.recovery_writable);
    assert_eq!(opened.recovery.len(), 1);
    let candidate = &opened.recovery[0];
    assert_eq!(candidate.purpose, TransactionPurpose::General);
    assert_eq!(candidate.total_steps, 2);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;

    let recovered = reopened
        .recover_transaction(opened.session_id, transaction_id, RecoveryChoice::Rollback)
        .unwrap();
    assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
    assert!(!recovered.recovery_writable);
    assert!(recovered.recovery.is_empty());
    assert_eq!(fs::read(&draft_path).unwrap(), draft_before);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);
    let restored = MotionService::editor_data(&reopened, opened.session_id, created.id).unwrap();
    assert_eq!(restored.draft, editor.draft);
    assert_eq!(restored.draft_sha256, editor.draft_sha256);
    let dashboard =
        MotionService::dashboard(&reopened, opened.session_id, fixture.area.area.id).unwrap();
    assert_eq!(dashboard.motions[0].revision, created.revision);
    assert_eq!(dashboard.motions[0].fps, editor.draft.fps);
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn interrupted_motion_publish_resumes_after_reopen() {
    let mut fixture = Fixture::new();
    let mut request = fixture.request("Recover publish", "recover_publish");
    request.preset_kind = Some(PresetKind::Walk);
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor_before =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let (draft_path, template_path) = motion_paths(&fixture, &created.name, created.id);
    let release_path = draft_path.parent().unwrap().join("revisions/r0001.json");
    let draft_before = fs::read(&draft_path).unwrap();
    let template_before = fs::read(&template_path).unwrap();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = MotionService::publish_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        created.id,
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    assert_eq!(read_json(&release_path)["revision"].as_u64(), Some(1));
    assert_eq!(fs::read(&draft_path).unwrap(), draft_before);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);

    fixture.service.close(fixture.session_id).unwrap();
    let mut reopened = VaultService::default();
    let opened = reopened.open(fixture.temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(opened.recovery_writable);
    assert_eq!(opened.recovery.len(), 1);
    let candidate = &opened.recovery[0];
    assert_eq!(candidate.purpose, TransactionPurpose::ReleaseRevision);
    assert_eq!(candidate.state, TransactionState::Applying);
    assert_eq!(candidate.completed_steps, 0);
    assert_eq!(candidate.total_steps, 3);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;

    let recovered = reopened
        .recover_transaction(opened.session_id, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
    assert!(!recovered.recovery_writable);
    assert!(recovered.recovery.is_empty());
    let editor_after =
        MotionService::editor_data(&reopened, opened.session_id, created.id).unwrap();
    assert_eq!(editor_after.draft.revision, editor_before.draft.revision);
    assert_eq!(
        editor_after.draft.released_from_draft_revision,
        Some(editor_after.draft.revision)
    );
    let dashboard =
        MotionService::dashboard(&reopened, opened.session_id, fixture.area.area.id).unwrap();
    assert_eq!(dashboard.motions[0].status, MotionCardStatus::Released);
    assert_eq!(dashboard.motions[0].released_revisions, vec![1]);
    assert_eq!(dashboard.motions[0].latest_release, Some(1));
    let release = read_json(&release_path);
    let template = read_json(&template_path);
    assert_eq!(release["revision"].as_u64(), Some(1));
    assert_eq!(release["published_at"], template["updated_at"]);
    assert_eq!(template["draft_base_release"].as_u64(), Some(1));
    assert_eq!(template["draft_revision"].as_u64(), Some(1));
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
    let project_folder = fixture.area_folder().parent().unwrap().to_path_buf();
    assert!(!fixture
        .temp
        .path()
        .join(&project_folder)
        .join(format!(".project/transactions/{transaction_id}.stage"))
        .exists());
    assert!(!fixture
        .temp
        .path()
        .join(project_folder)
        .join(format!(".project/backups/motion-release--{transaction_id}"))
        .exists());
}

#[test]
fn interrupted_motion_publish_rolls_back_after_reopen() {
    let mut fixture = Fixture::new();
    let request = fixture.request("Rollback publish", "rollback_publish");
    let created = MotionService::create(&mut fixture.service, fixture.session_id, request).unwrap();
    let editor_before =
        MotionService::editor_data(&fixture.service, fixture.session_id, created.id).unwrap();
    let (draft_path, template_path) = motion_paths(&fixture, &created.name, created.id);
    let release_path = draft_path.parent().unwrap().join("revisions/r0001.json");
    let draft_before = fs::read(&draft_path).unwrap();
    let template_before = fs::read(&template_path).unwrap();

    let faulting = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    let interrupted = MotionService::publish_with_transactions(
        &mut fixture.service,
        fixture.session_id,
        created.id,
        &faulting,
    );
    assert!(matches!(
        interrupted,
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    assert!(release_path.is_file());
    assert_eq!(fs::read(&draft_path).unwrap(), draft_before);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);

    fixture.service.close(fixture.session_id).unwrap();
    let mut reopened = VaultService::default();
    let opened = reopened.open(fixture.temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(opened.recovery_writable);
    assert_eq!(opened.recovery.len(), 1);
    let candidate = &opened.recovery[0];
    assert_eq!(candidate.purpose, TransactionPurpose::ReleaseRevision);
    assert_eq!(candidate.state, TransactionState::Applying);
    assert_eq!(candidate.completed_steps, 0);
    assert_eq!(candidate.total_steps, 3);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;

    let recovered = reopened
        .recover_transaction(opened.session_id, transaction_id, RecoveryChoice::Rollback)
        .unwrap();
    assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
    assert!(!recovered.recovery_writable);
    assert!(recovered.recovery.is_empty());
    assert!(!release_path.exists());
    assert_eq!(fs::read(&draft_path).unwrap(), draft_before);
    assert_eq!(fs::read(&template_path).unwrap(), template_before);
    let editor_after =
        MotionService::editor_data(&reopened, opened.session_id, created.id).unwrap();
    assert_eq!(editor_after.draft, editor_before.draft);
    assert_eq!(editor_after.draft_sha256, editor_before.draft_sha256);
    let dashboard =
        MotionService::dashboard(&reopened, opened.session_id, fixture.area.area.id).unwrap();
    assert_eq!(dashboard.motions[0].status, MotionCardStatus::New);
    assert!(dashboard.motions[0].released_revisions.is_empty());
    assert_eq!(dashboard.motions[0].latest_release, None);
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
    let project_folder = fixture.area_folder().parent().unwrap().to_path_buf();
    assert!(!fixture
        .temp
        .path()
        .join(&project_folder)
        .join(format!(".project/transactions/{transaction_id}.stage"))
        .exists());
    assert!(!fixture
        .temp
        .path()
        .join(project_folder)
        .join(format!(".project/backups/motion-release--{transaction_id}"))
        .exists());
}
