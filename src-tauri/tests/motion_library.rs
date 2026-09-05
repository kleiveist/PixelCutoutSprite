use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::application::{
    AreaDetails, AreaService, CreateAreaRequest, CreateMotionRequest, MotionCardStatus,
    MotionOpenTarget, MotionService, ProjectCard, ProjectService, ReviseAreaProfileRequest,
    SaveMotionDraftRequest, VaultService,
};
use pixel_cutout_sprite_studio_lib::domain::{
    ActionKey, AnimationBinding, Character, CharacterStatus, Direction, DirectionMode,
    DocumentKind, DomainDocument, Interpolation, Keyframe, LoopMode, MotionTrack, ObjectId,
    ObjectType, ReviewState, TrackProperty, TrackValue, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::storage::{object_folder, JsonStore, VaultRoot};
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
        let root = VaultRoot::open(self.temp.path()).unwrap();
        root.ensure_directory(&binding_folder).unwrap();
        JsonStore::default()
            .create(
                &root.resolve(&binding_folder.join("binding.json")).unwrap(),
                &DomainDocument::AnimationBinding(binding.clone()),
            )
            .unwrap();
        binding
    }
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

    let draft =
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap();
    let edited = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: 24,
            loop_mode: draft.loop_mode,
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
    let draft =
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap();
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
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
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
    let draft =
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap();
    let result = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: draft.revision,
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
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
    let draft =
        MotionService::load_draft(&fixture.service, fixture.session_id, created.id).unwrap();
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
            frame_size_px: draft.frame_size_px,
            ground_origin_px: draft.ground_origin_px,
            frame_count: draft.frame_count,
            fps: draft.fps,
            loop_mode: draft.loop_mode,
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
    let invalid_result = MotionService::save_draft(
        &mut fixture.service,
        fixture.session_id,
        SaveMotionDraftRequest {
            template_id: created.id,
            expected_revision: saved.revision,
            frame_size_px: saved.frame_size_px,
            ground_origin_px: saved.ground_origin_px,
            frame_count: saved.frame_count,
            fps: saved.fps,
            loop_mode: saved.loop_mode,
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
