use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::domain::{
    validate_portable_display_name, ActionKey, AnimationBinding, Area, Character, Direction,
    DirectionDefinition, DirectionMode, DocumentKind, DomainDocument, DomainError, LoopMode,
    MotionRevision, MotionTemplate, MotionTrack, ObjectId, PixelPoint, PixelSize, RevisionRef,
    TemplateStatus, UtcTimestamp, SCHEMA_VERSION,
};
use crate::storage::{
    object_folder, JsonStore, ResolvedPath, StorageError, VaultRoot, VersionStamp, AREA_ADMIN_DIR,
    PROJECT_ADMIN_DIR,
};

use super::{now, VaultOpenMode, VaultService};

const TEMPLATE_DIRECTORY: &str = "templates";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionDraftKind {
    MotionDraft,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MotionDraft {
    pub schema_version: u32,
    pub kind: MotionDraftKind,
    pub template_id: ObjectId,
    pub revision: u32,
    pub released_from_draft_revision: Option<u32>,
    pub profile_ref: RevisionRef,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub directions: Vec<DirectionDefinition>,
    pub tracks: Vec<MotionTrack>,
    pub updated_at: UtcTimestamp,
}

impl MotionDraft {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.schema_version != SCHEMA_VERSION
            || self.kind != MotionDraftKind::MotionDraft
            || self.revision == 0
            || self
                .released_from_draft_revision
                .is_some_and(|revision| revision == 0 || revision > self.revision)
        {
            return Err(DomainError::invalid(
                "motion_draft",
                "schema, kind, and draft revisions must be valid",
            ));
        }
        self.as_release(1, self.updated_at).validate(None)
    }

    pub fn has_unpublished_changes(&self) -> bool {
        self.released_from_draft_revision != Some(self.revision)
    }

    fn as_release(&self, revision: u32, published_at: UtcTimestamp) -> MotionRevision {
        MotionRevision {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::MotionRevision,
            template_id: self.template_id,
            revision,
            profile_ref: self.profile_ref,
            frame_size_px: self.frame_size_px,
            ground_origin_px: self.ground_origin_px,
            frame_count: self.frame_count,
            fps: self.fps,
            loop_mode: self.loop_mode,
            directions: self.directions.clone(),
            tracks: self.tracks.clone(),
            published_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateMotionRequest {
    pub area_id: ObjectId,
    pub name: String,
    pub action_key: String,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub frame_size_px: Option<PixelSize>,
    pub ground_origin_px: Option<PixelPoint>,
    #[serde(default)]
    pub label_ids: Vec<ObjectId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveMotionDraftRequest {
    pub template_id: ObjectId,
    pub expected_revision: u32,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub directions: Vec<DirectionDefinition>,
    pub tracks: Vec<MotionTrack>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionCardStatus {
    New,
    Released,
    UnpublishedChanges,
    Archived,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MotionCard {
    pub id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub name: String,
    pub action_key: ActionKey,
    pub status: MotionCardStatus,
    pub label_ids: Vec<ObjectId>,
    pub profile_ref: RevisionRef,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub direction_coverage: Vec<Direction>,
    pub released_revisions: Vec<u32>,
    pub latest_release: Option<u32>,
    pub updated_at: UtcTimestamp,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MotionDashboard {
    pub area_id: ObjectId,
    pub motions: Vec<MotionCard>,
    pub profiles: Vec<RevisionRef>,
    pub writable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MotionOpenTarget {
    DummyEditor {
        template_id: ObjectId,
    },
    OutfitChooser {
        template_id: ObjectId,
        template_revision: u32,
        compatible_character_ids: Vec<ObjectId>,
    },
    BindingEditor {
        template_id: ObjectId,
        binding_id: ObjectId,
        character_id: ObjectId,
    },
}

#[derive(Debug)]
struct AreaLocation {
    folder: PathBuf,
    area: Area,
}

#[derive(Debug)]
struct MotionLocation {
    folder: PathBuf,
    template: MotionTemplate,
    template_stamp: VersionStamp,
    draft: MotionDraft,
    draft_stamp: VersionStamp,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct MotionService;

impl MotionService {
    pub fn dashboard(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
    ) -> Result<MotionDashboard, StorageError> {
        let (root, mode) = session(vaults, session_id)?;
        let area = find_area(&root, area_id)?;
        let mut motions = scan_motions(&root, &area)?
            .iter()
            .map(motion_card)
            .collect::<Vec<_>>();
        motions.sort_by_key(|card| std::cmp::Reverse(card.updated_at));
        let mut profiles = motions
            .iter()
            .map(|motion| motion.profile_ref)
            .collect::<Vec<_>>();
        if !profiles.contains(&area.area.profile_ref) {
            profiles.push(area.area.profile_ref);
        }
        profiles.sort_by_key(|profile| (profile.id, profile.revision));
        profiles.dedup();
        Ok(MotionDashboard {
            area_id,
            motions,
            profiles,
            writable: mode == VaultOpenMode::ReadWrite,
        })
    }

    pub fn create(
        vaults: &mut VaultService,
        session_id: ObjectId,
        request: CreateMotionRequest,
    ) -> Result<MotionCard, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let area = find_area(&root, request.area_id)?;
        let created = create_motion(&root, &area, request, None)?;
        vaults.refresh_index(session_id)?;
        Ok(motion_card(&created))
    }

    pub fn duplicate(
        vaults: &mut VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
    ) -> Result<MotionCard, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let (area, source) = find_motion(&root, template_id)?;
        let locations = scan_motions(&root, &area)?;
        let name = duplicate_name(&source.template.name, &locations);
        let request = CreateMotionRequest {
            area_id: area.area.id,
            name,
            action_key: source.template.action_key.to_string(),
            frame_count: source.draft.frame_count,
            fps: source.draft.fps,
            loop_mode: source.draft.loop_mode,
            frame_size_px: Some(source.draft.frame_size_px),
            ground_origin_px: Some(source.draft.ground_origin_px),
            label_ids: source.template.label_ids.clone(),
        };
        let created = create_motion(&root, &area, request, Some(&source.draft))?;
        vaults.refresh_index(session_id)?;
        Ok(motion_card(&created))
    }

    pub fn load_draft(
        vaults: &VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
    ) -> Result<MotionDraft, StorageError> {
        let (root, _) = session(vaults, session_id)?;
        Ok(find_motion(&root, template_id)?.1.draft)
    }

    pub fn save_draft(
        vaults: &mut VaultService,
        session_id: ObjectId,
        request: SaveMotionDraftRequest,
    ) -> Result<MotionDraft, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let (_, mut location) = find_motion(&root, request.template_id)?;
        if location.draft.revision != request.expected_revision {
            return Err(StorageError::WriteConflict);
        }
        let previous_draft = location.draft.clone();
        location.draft.revision = next_revision(location.draft.revision, "draft revision")?;
        location.draft.frame_size_px = request.frame_size_px;
        location.draft.ground_origin_px = request.ground_origin_px;
        location.draft.frame_count = request.frame_count;
        location.draft.fps = request.fps;
        location.draft.loop_mode = request.loop_mode;
        location.draft.directions = request.directions;
        location.draft.tracks = request.tracks;
        location.draft.updated_at = now()?;
        location.draft.validate()?;
        let draft_path = root.resolve(&location.folder.join("draft.json"))?;
        let next_draft_stamp =
            compare_and_swap_draft(&draft_path, &location.draft_stamp, &location.draft)?;

        location.template.revision =
            next_revision(location.template.revision, "template revision")?;
        location.template.draft_revision = location.draft.revision;
        location.template.updated_at = location.draft.updated_at;
        location.template.validate()?;
        let template_path = root.resolve(&location.folder.join("template.json"))?;
        if let Err(error) = JsonStore::default().compare_and_swap(
            &template_path,
            &location.template_stamp,
            &DomainDocument::MotionTemplate(location.template),
        ) {
            let _ = compare_and_swap_draft(&draft_path, &next_draft_stamp, &previous_draft);
            return Err(error);
        }
        vaults.refresh_index(session_id)?;
        Ok(location.draft)
    }

    pub fn publish(
        vaults: &mut VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
    ) -> Result<MotionRevision, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let (_, mut location) = find_motion(&root, template_id)?;
        let release_number = location
            .template
            .released_revisions
            .iter()
            .copied()
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or_else(|| StorageError::InvalidVault("motion release overflow".to_owned()))?;
        let timestamp = now()?;
        let release = location.draft.as_release(release_number, timestamp);
        release.validate(None)?;
        let release_path = root.resolve(
            &location
                .folder
                .join("revisions")
                .join(format!("r{release_number:04}.json")),
        )?;
        root.ensure_directory(&location.folder.join("revisions"))?;
        JsonStore::default().create(
            &release_path,
            &DomainDocument::MotionRevision(release.clone()),
        )?;

        let old_template = location.template.clone();
        location.template.revision =
            next_revision(location.template.revision, "template revision")?;
        location.template.released_revisions.push(release_number);
        location.template.draft_base_release = Some(release_number);
        location.template.updated_at = timestamp;
        location.template.validate()?;
        let template_path = root.resolve(&location.folder.join("template.json"))?;
        let template_stamp = match JsonStore::default().compare_and_swap(
            &template_path,
            &location.template_stamp,
            &DomainDocument::MotionTemplate(location.template),
        ) {
            Ok(stamp) => stamp,
            Err(error) => {
                let _ = fs::remove_file(release_path.as_path());
                return Err(error);
            }
        };
        location.draft.released_from_draft_revision = Some(location.draft.revision);
        location.draft.updated_at = timestamp;
        let draft_path = root.resolve(&location.folder.join("draft.json"))?;
        if let Err(error) =
            compare_and_swap_draft(&draft_path, &location.draft_stamp, &location.draft)
        {
            let _ = JsonStore::default().compare_and_swap(
                &template_path,
                &template_stamp,
                &DomainDocument::MotionTemplate(old_template),
            );
            let _ = fs::remove_file(release_path.as_path());
            return Err(error);
        }
        vaults.refresh_index(session_id)?;
        Ok(release)
    }

    pub fn set_archived(
        vaults: &mut VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
        expected_revision: u32,
        archived: bool,
    ) -> Result<MotionCard, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let (_, mut location) = find_motion(&root, template_id)?;
        if location.template.revision != expected_revision {
            return Err(StorageError::WriteConflict);
        }
        let next_status = if archived {
            TemplateStatus::Archived
        } else {
            TemplateStatus::Active
        };
        if !location.template.status.can_transition_to(next_status) {
            return Err(StorageError::InvalidVault(
                "invalid template status transition".to_owned(),
            ));
        }
        location.template.status = next_status;
        location.template.revision =
            next_revision(location.template.revision, "template revision")?;
        location.template.updated_at = now()?;
        let path = root.resolve(&location.folder.join("template.json"))?;
        JsonStore::default().compare_and_swap(
            &path,
            &location.template_stamp,
            &DomainDocument::MotionTemplate(location.template.clone()),
        )?;
        vaults.refresh_index(session_id)?;
        Ok(motion_card(&location))
    }

    pub fn remove(
        vaults: &mut VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
        expected_revision: u32,
    ) -> Result<(), StorageError> {
        let root = writable_root(vaults, session_id)?;
        let (area, location) = find_motion(&root, template_id)?;
        if location.template.revision != expected_revision {
            return Err(StorageError::WriteConflict);
        }
        if scan_bindings(&root, &area.folder)?
            .iter()
            .any(|binding| binding.template_ref.id == template_id)
        {
            return Err(StorageError::InvalidVault(
                "template is referenced by an NPC binding; archive it instead".to_owned(),
            ));
        }
        let project = area.folder.parent().ok_or_else(|| {
            StorageError::InvalidVault("area does not have a project parent".to_owned())
        })?;
        let trash = project.join(PROJECT_ADMIN_DIR).join("trash");
        root.ensure_directory(&trash)?;
        let source = root.resolve(&location.folder)?;
        let folder_name = location
            .folder
            .file_name()
            .ok_or_else(|| StorageError::InvalidVault("template folder has no name".to_owned()))?;
        let target = root.resolve(&trash.join(format!(
            "{}--removed-{}",
            folder_name.to_string_lossy(),
            ObjectId::new().to_string().chars().take(8).collect::<String>()
        )))?;
        fs::rename(source.as_path(), target.as_path()).map_err(|error| {
            StorageError::io("move template to project trash", source.relative(), error)
        })?;
        vaults.refresh_index(session_id)
    }

    pub fn resolve_open(
        vaults: &VaultService,
        session_id: ObjectId,
        template_id: ObjectId,
        character_id: Option<ObjectId>,
    ) -> Result<MotionOpenTarget, StorageError> {
        let (root, _) = session(vaults, session_id)?;
        let (area, location) = find_motion(&root, template_id)?;
        let Some(revision) = location.template.released_revisions.iter().copied().max() else {
            return Ok(MotionOpenTarget::DummyEditor { template_id });
        };
        let release = load_release(&root, &location.folder, template_id, revision)?;
        let compatible = scan_characters(&root, &area.folder)?
            .into_iter()
            .filter(|character| character.profile_ref == release.profile_ref)
            .collect::<Vec<_>>();
        if let Some(requested) = character_id {
            if !compatible.iter().any(|character| character.id == requested) {
                return Err(StorageError::InvalidVault(
                    "selected NPC is not compatible with this motion profile".to_owned(),
                ));
            }
            if let Some(binding) = scan_bindings(&root, &area.folder)?
                .into_iter()
                .find(|binding| {
                    binding.character_id == requested && binding.template_ref.id == template_id
                })
            {
                return Ok(MotionOpenTarget::BindingEditor {
                    template_id,
                    binding_id: binding.id,
                    character_id: requested,
                });
            }
            return Ok(MotionOpenTarget::OutfitChooser {
                template_id,
                template_revision: revision,
                compatible_character_ids: vec![requested],
            });
        }
        Ok(MotionOpenTarget::OutfitChooser {
            template_id,
            template_revision: revision,
            compatible_character_ids: compatible
                .into_iter()
                .map(|character| character.id)
                .collect(),
        })
    }
}

fn create_motion(
    root: &VaultRoot,
    area: &AreaLocation,
    request: CreateMotionRequest,
    source_draft: Option<&MotionDraft>,
) -> Result<MotionLocation, StorageError> {
    validate_portable_display_name("motion_template.name", &request.name)?;
    let action_key = ActionKey::parse(request.action_key)?;
    ensure_unique_labels(&request.label_ids)?;
    let existing = scan_motions(root, area)?;
    if existing.iter().any(|motion| {
        crate::domain::portable_name_key(&motion.template.name)
            == crate::domain::portable_name_key(&request.name)
    }) {
        return Err(StorageError::InvalidVault(
            "an animation with the same portable name already exists in this area".to_owned(),
        ));
    }
    let timestamp = now()?;
    let template_id = ObjectId::new();
    let template = MotionTemplate {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::MotionTemplate,
        id: template_id,
        revision: 1,
        area_id: area.area.id,
        name: request.name,
        action_key,
        status: TemplateStatus::Active,
        label_ids: request.label_ids,
        draft_revision: 1,
        draft_base_release: None,
        released_revisions: Vec::new(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    template.validate()?;
    let (directions, tracks) = source_draft.map_or_else(
        || {
            (
                Direction::ALL
                    .into_iter()
                    .map(|direction| DirectionDefinition {
                        direction,
                        mode: DirectionMode::Explicit,
                        source: None,
                    })
                    .collect(),
                Vec::new(),
            )
        },
        |source| (source.directions.clone(), source.tracks.clone()),
    );
    let draft = MotionDraft {
        schema_version: SCHEMA_VERSION,
        kind: MotionDraftKind::MotionDraft,
        template_id,
        revision: 1,
        released_from_draft_revision: None,
        profile_ref: area.area.profile_ref,
        frame_size_px: request
            .frame_size_px
            .unwrap_or(area.area.default_frame_size_px),
        ground_origin_px: request
            .ground_origin_px
            .unwrap_or(area.area.default_ground_origin_px),
        frame_count: request.frame_count,
        fps: request.fps,
        loop_mode: request.loop_mode,
        directions,
        tracks,
        updated_at: timestamp,
    };
    draft.validate()?;
    let base = area.folder.join(AREA_ADMIN_DIR).join(TEMPLATE_DIRECTORY);
    root.ensure_directory(&base)?;
    let folder = base.join(object_folder(&template.name, template.id)?);
    root.ensure_directory(&folder)?;
    root.ensure_directory(&folder.join("revisions"))?;
    let template_path = root.resolve(&folder.join("template.json"))?;
    let draft_path = root.resolve(&folder.join("draft.json"))?;
    let result = (|| {
        let template_stamp = JsonStore::default().create(
            &template_path,
            &DomainDocument::MotionTemplate(template.clone()),
        )?;
        let draft_stamp = create_draft(&draft_path, &draft)?;
        Ok(MotionLocation {
            folder: folder.clone(),
            template,
            template_stamp,
            draft,
            draft_stamp,
        })
    })();
    if result.is_err() {
        let resolved = root.resolve(&folder)?;
        let _ = fs::remove_dir_all(resolved.as_path());
    }
    result
}

fn motion_card(location: &MotionLocation) -> MotionCard {
    let latest_release = location.template.released_revisions.iter().copied().max();
    let status = if location.template.status == TemplateStatus::Archived {
        MotionCardStatus::Archived
    } else if latest_release.is_none() {
        MotionCardStatus::New
    } else if location.draft.has_unpublished_changes() {
        MotionCardStatus::UnpublishedChanges
    } else {
        MotionCardStatus::Released
    };
    MotionCard {
        id: location.template.id,
        revision: location.template.revision,
        area_id: location.template.area_id,
        name: location.template.name.clone(),
        action_key: location.template.action_key.clone(),
        status,
        label_ids: location.template.label_ids.clone(),
        profile_ref: location.draft.profile_ref,
        frame_count: location.draft.frame_count,
        fps: location.draft.fps,
        loop_mode: location.draft.loop_mode,
        direction_coverage: location
            .draft
            .directions
            .iter()
            .filter(|definition| definition.mode != DirectionMode::Missing)
            .map(|definition| definition.direction)
            .collect(),
        released_revisions: location.template.released_revisions.clone(),
        latest_release,
        updated_at: location.template.updated_at,
    }
}

fn session(
    vaults: &VaultService,
    session_id: ObjectId,
) -> Result<(VaultRoot, VaultOpenMode), StorageError> {
    let context = vaults.context(session_id)?;
    Ok((context.root, context.mode))
}

fn writable_root(vaults: &VaultService, session_id: ObjectId) -> Result<VaultRoot, StorageError> {
    let (root, mode) = session(vaults, session_id)?;
    if mode != VaultOpenMode::ReadWrite {
        return Err(StorageError::InvalidVault(
            "this vault session is read-only".to_owned(),
        ));
    }
    Ok(root)
}

fn find_area(root: &VaultRoot, area_id: ObjectId) -> Result<AreaLocation, StorageError> {
    for project in real_directories(root.path())? {
        if project
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            continue;
        }
        for candidate in real_directories(&project)? {
            let manifest = candidate.join(AREA_ADMIN_DIR).join("area.json");
            if !manifest.is_file() {
                continue;
            }
            let folder = candidate
                .strip_prefix(root.path())
                .map_err(|_| StorageError::InvalidVault("area escaped the vault".to_owned()))?
                .to_path_buf();
            let resolved = root.resolve(&folder.join(AREA_ADMIN_DIR).join("area.json"))?;
            let loaded = JsonStore::default().load(&resolved)?;
            let DomainDocument::Area(area) = loaded.value else {
                return Err(StorageError::InvalidVault(
                    "area manifest has the wrong document kind".to_owned(),
                ));
            };
            if area.id == area_id {
                return Ok(AreaLocation { folder, area });
            }
        }
    }
    Err(StorageError::InvalidVault(format!(
        "area {area_id} does not exist"
    )))
}

fn scan_motions(
    root: &VaultRoot,
    area: &AreaLocation,
) -> Result<Vec<MotionLocation>, StorageError> {
    let relative = area.folder.join(AREA_ADMIN_DIR).join(TEMPLATE_DIRECTORY);
    let path = root.resolve(&relative)?;
    if !path.as_path().exists() {
        return Ok(Vec::new());
    }
    let mut motions = Vec::new();
    let mut ids = HashSet::new();
    for absolute in real_directories(path.as_path())? {
        let folder = absolute
            .strip_prefix(root.path())
            .map_err(|_| StorageError::InvalidVault("template escaped the vault".to_owned()))?
            .to_path_buf();
        let loaded = JsonStore::default().load(&root.resolve(&folder.join("template.json"))?)?;
        let DomainDocument::MotionTemplate(template) = loaded.value else {
            return Err(StorageError::InvalidVault(
                "template manifest has the wrong document kind".to_owned(),
            ));
        };
        if template.area_id != area.area.id || !ids.insert(template.id) {
            return Err(StorageError::InvalidVault(
                "template belongs to another area or duplicates an ID".to_owned(),
            ));
        }
        let (draft, draft_stamp) = load_draft_document(&root.resolve(&folder.join("draft.json"))?)?;
        if draft.template_id != template.id || draft.revision != template.draft_revision {
            return Err(StorageError::InvalidVault(
                "template and draft identity or revision disagree".to_owned(),
            ));
        }
        motions.push(MotionLocation {
            folder,
            template,
            template_stamp: loaded.stamp,
            draft,
            draft_stamp,
        });
    }
    Ok(motions)
}

fn find_motion(
    root: &VaultRoot,
    template_id: ObjectId,
) -> Result<(AreaLocation, MotionLocation), StorageError> {
    let area_ids = scan_area_ids(root)?;
    for area_id in area_ids {
        let area = find_area(root, area_id)?;
        if let Some(location) = scan_motions(root, &area)?
            .into_iter()
            .find(|motion| motion.template.id == template_id)
        {
            return Ok((area, location));
        }
    }
    Err(StorageError::InvalidVault(format!(
        "motion template {template_id} does not exist"
    )))
}

fn scan_area_ids(root: &VaultRoot) -> Result<Vec<ObjectId>, StorageError> {
    let mut ids = Vec::new();
    for project in real_directories(root.path())? {
        if project
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            continue;
        }
        for candidate in real_directories(&project)? {
            let manifest = candidate.join(AREA_ADMIN_DIR).join("area.json");
            if !manifest.is_file() {
                continue;
            }
            let relative = manifest.strip_prefix(root.path()).map_err(|_| {
                StorageError::InvalidVault("area manifest escaped the vault".to_owned())
            })?;
            let loaded = JsonStore::default().load(&root.resolve(relative)?)?;
            if let DomainDocument::Area(area) = loaded.value {
                ids.push(area.id);
            }
        }
    }
    Ok(ids)
}

fn load_release(
    root: &VaultRoot,
    folder: &Path,
    template_id: ObjectId,
    revision: u32,
) -> Result<MotionRevision, StorageError> {
    let path = root.resolve(
        &folder
            .join("revisions")
            .join(format!("r{revision:04}.json")),
    )?;
    let loaded = JsonStore::default().load(&path)?;
    let DomainDocument::MotionRevision(release) = loaded.value else {
        return Err(StorageError::InvalidVault(
            "motion release has the wrong document kind".to_owned(),
        ));
    };
    if release.template_id != template_id || release.revision != revision {
        return Err(StorageError::InvalidVault(
            "motion release identity does not match its path".to_owned(),
        ));
    }
    Ok(release)
}

fn scan_characters(root: &VaultRoot, area_folder: &Path) -> Result<Vec<Character>, StorageError> {
    let area = root.resolve(area_folder)?;
    let mut characters = Vec::new();
    for directory in real_directories(area.as_path())? {
        if directory
            .file_name()
            .is_some_and(|name| name == AREA_ADMIN_DIR)
        {
            continue;
        }
        let manifest = directory.join("character.json");
        if !manifest.is_file() {
            continue;
        }
        let relative = manifest.strip_prefix(root.path()).map_err(|_| {
            StorageError::InvalidVault("character manifest escaped the vault".to_owned())
        })?;
        let loaded = JsonStore::default().load(&root.resolve(relative)?)?;
        if let DomainDocument::Character(character) = loaded.value {
            characters.push(character);
        }
    }
    Ok(characters)
}

fn scan_bindings(
    root: &VaultRoot,
    area_folder: &Path,
) -> Result<Vec<AnimationBinding>, StorageError> {
    let area = root.resolve(area_folder)?;
    let mut bindings = Vec::new();
    for character in real_directories(area.as_path())? {
        if character
            .file_name()
            .is_some_and(|name| name == AREA_ADMIN_DIR)
        {
            continue;
        }
        for candidate in real_directories(&character)? {
            let manifest = candidate.join("binding.json");
            if !manifest.is_file() {
                continue;
            }
            let relative = manifest.strip_prefix(root.path()).map_err(|_| {
                StorageError::InvalidVault("binding manifest escaped the vault".to_owned())
            })?;
            let loaded = JsonStore::default().load(&root.resolve(relative)?)?;
            if let DomainDocument::AnimationBinding(binding) = loaded.value {
                bindings.push(binding);
            }
        }
    }
    Ok(bindings)
}

fn real_directories(parent: &Path) -> Result<Vec<PathBuf>, StorageError> {
    let mut result = Vec::new();
    for entry in fs::read_dir(parent)
        .map_err(|error| StorageError::io("scan object directories", parent, error))?
    {
        let entry =
            entry.map_err(|error| StorageError::io("scan object directory", parent, error))?;
        let kind = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect object directory", &entry.path(), error))?;
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            result.push(entry.path());
        }
    }
    Ok(result)
}

fn create_draft(path: &ResolvedPath, draft: &MotionDraft) -> Result<VersionStamp, StorageError> {
    if path.as_path().exists() {
        return Err(StorageError::WriteConflict);
    }
    write_draft(path, draft)
}

fn compare_and_swap_draft(
    path: &ResolvedPath,
    expected: &VersionStamp,
    draft: &MotionDraft,
) -> Result<VersionStamp, StorageError> {
    let bytes = fs::read(path.as_path())
        .map_err(|error| StorageError::io("read motion draft", path.relative(), error))?;
    if VersionStamp::from_bytes(&bytes) != *expected {
        return Err(StorageError::WriteConflict);
    }
    write_draft(path, draft)
}

fn write_draft(path: &ResolvedPath, draft: &MotionDraft) -> Result<VersionStamp, StorageError> {
    draft.validate()?;
    let bytes = serde_json::to_vec_pretty(draft)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    JsonStore::default().write_bytes(path, &bytes, |candidate| {
        let decoded: MotionDraft = serde_json::from_slice(candidate)
            .map_err(|error| DomainError::InvalidJson(error.to_string()))?;
        decoded.validate()
    })?;
    Ok(VersionStamp::from_bytes(&bytes))
}

fn load_draft_document(path: &ResolvedPath) -> Result<(MotionDraft, VersionStamp), StorageError> {
    let bytes = fs::read(path.as_path())
        .map_err(|error| StorageError::io("read motion draft", path.relative(), error))?;
    let draft: MotionDraft = serde_json::from_slice(&bytes)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    draft.validate()?;
    Ok((draft, VersionStamp::from_bytes(&bytes)))
}

fn ensure_unique_labels(labels: &[ObjectId]) -> Result<(), StorageError> {
    let mut unique = HashSet::new();
    if labels.iter().any(|label| !unique.insert(*label)) {
        return Err(StorageError::InvalidVault(
            "motion label IDs must be unique".to_owned(),
        ));
    }
    Ok(())
}

fn next_revision(current: u32, name: &str) -> Result<u32, StorageError> {
    current
        .checked_add(1)
        .ok_or_else(|| StorageError::InvalidVault(format!("{name} overflow")))
}

fn duplicate_name(base: &str, existing: &[MotionLocation]) -> String {
    for index in 1..=10_000 {
        let suffix = if index == 1 {
            " copy".to_owned()
        } else {
            format!(" copy {index}")
        };
        let keep = 120usize.saturating_sub(suffix.chars().count());
        let candidate = format!("{}{suffix}", base.chars().take(keep).collect::<String>());
        if !existing.iter().any(|motion| {
            crate::domain::portable_name_key(&motion.template.name)
                == crate::domain::portable_name_key(&candidate)
        }) {
            return candidate;
        }
    }
    format!("Copy {}", ObjectId::new())
}
