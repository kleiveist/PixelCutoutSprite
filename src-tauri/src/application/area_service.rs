use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::domain::{
    portable_name_key, validate_portable_display_name, Area, Direction, DirectionModel,
    DocumentKind, DomainDocument, HumanoidProfileGenerator, HumanoidProfilePreview, Label,
    LabelScope, ObjectId, ObjectType, PixelPoint, PixelSize, ProfileRevision, Project,
    RecordStatus, RelativePath, RevisionRef, UtcTimestamp, SCHEMA_VERSION,
};
use crate::storage::{
    object_folder, write_journal, JsonStore, StorageError, TransactionAction, TransactionJournal,
    TransactionStep, VaultLayout, VaultRoot, VersionStamp, AREA_ADMIN_DIR, PROJECT_ADMIN_DIR,
};

use super::{VaultOpenMode, VaultService};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAreaRequest {
    pub project_id: ObjectId,
    pub name: String,
    pub object_type: ObjectType,
    pub reference_height_px: u16,
    #[serde(default)]
    pub default_frame_size_px: Option<PixelSize>,
    #[serde(default)]
    pub default_ground_origin_px: Option<PixelPoint>,
    #[serde(default)]
    pub label_ids: Vec<ObjectId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviseAreaProfileRequest {
    pub area_id: ObjectId,
    pub expected_area_revision: u32,
    pub reference_height_px: u16,
    #[serde(default)]
    pub default_frame_size_px: Option<PixelSize>,
    #[serde(default)]
    pub default_ground_origin_px: Option<PixelPoint>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AreaCard {
    pub id: ObjectId,
    pub revision: u32,
    pub project_id: ObjectId,
    pub name: String,
    pub object_type: ObjectType,
    pub profile_ref: RevisionRef,
    pub reference_height_px: u16,
    pub direction_model: DirectionModel,
    pub default_frame_size_px: PixelSize,
    pub default_ground_origin_px: PixelPoint,
    pub label_ids: Vec<ObjectId>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl From<&Area> for AreaCard {
    fn from(value: &Area) -> Self {
        Self {
            id: value.id,
            revision: value.revision,
            project_id: value.project_id,
            name: value.name.clone(),
            object_type: value.object_type,
            profile_ref: value.profile_ref,
            reference_height_px: value.reference_height_px,
            direction_model: value.direction_model,
            default_frame_size_px: value.default_frame_size_px,
            default_ground_origin_px: value.default_ground_origin_px,
            label_ids: value.label_ids.clone(),
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AreaDetails {
    pub area: Area,
    pub profile: ProfileRevision,
    pub preview: HumanoidProfilePreview,
    pub writable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AreaDashboard {
    pub project_id: ObjectId,
    pub areas: Vec<AreaCard>,
    pub labels: Vec<AreaLabelSummary>,
    pub writable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AreaLabelSummary {
    pub id: ObjectId,
    pub revision: u32,
    pub name: String,
    pub color: String,
}

#[derive(Debug)]
struct ProjectLocation {
    folder: PathBuf,
    project: Project,
}

#[derive(Debug)]
struct AreaLocation {
    folder: PathBuf,
    area: Area,
    stamp: VersionStamp,
}

#[derive(Debug, Deserialize)]
struct ProjectLabelCatalog {
    scope: LabelScope,
    project_id: Option<ObjectId>,
    labels: Vec<Label>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AreaService;

impl AreaService {
    pub fn preview(reference_height_px: u16) -> Result<HumanoidProfilePreview, StorageError> {
        HumanoidProfileGenerator::preview(reference_height_px).map_err(StorageError::from)
    }

    pub(crate) fn folder(root: &VaultRoot, area_id: ObjectId) -> Result<PathBuf, StorageError> {
        Ok(find_area(root, area_id)?.folder)
    }

    pub fn dashboard(
        vaults: &VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
    ) -> Result<AreaDashboard, StorageError> {
        let (root, mode) = session_context(vaults, session_id)?;
        let project = find_project(&root, project_id)?;
        let mut areas = scan_areas(&root, &project)?
            .iter()
            .map(|location| AreaCard::from(&location.area))
            .collect::<Vec<_>>();
        areas.sort_by_key(|area| portable_name_key(&area.name));
        let labels = project_labels(&root, &project)?
            .into_iter()
            .map(|label| AreaLabelSummary {
                id: label.id,
                revision: label.revision,
                name: label.name,
                color: label.color,
            })
            .collect();
        Ok(AreaDashboard {
            project_id,
            areas,
            labels,
            writable: mode == VaultOpenMode::ReadWrite,
        })
    }

    pub fn open(
        vaults: &VaultService,
        session_id: ObjectId,
        area_id: ObjectId,
    ) -> Result<AreaDetails, StorageError> {
        let (root, mode) = session_context(vaults, session_id)?;
        let location = find_area(&root, area_id)?;
        load_details(&root, location, mode)
    }

    pub fn create(
        vaults: &VaultService,
        session_id: ObjectId,
        request: CreateAreaRequest,
    ) -> Result<AreaDetails, StorageError> {
        let root = writable_root(vaults, session_id)?;
        if request.object_type != ObjectType::Humanoid {
            return Err(StorageError::InvalidVault(
                "only the humanoid object type is available in profile version 1".to_owned(),
            ));
        }
        validate_portable_display_name("area.name", &request.name)?;
        let project = find_project(&root, request.project_id)?;
        if project.project.status != RecordStatus::Active {
            return Err(StorageError::InvalidVault(
                "areas cannot be created in an archived project".to_owned(),
            ));
        }
        let existing = scan_areas(&root, &project)?;
        if existing
            .iter()
            .any(|area| portable_name_key(&area.area.name) == portable_name_key(&request.name))
        {
            return Err(StorageError::InvalidVault(
                "an area with the same portable name already exists in this project".to_owned(),
            ));
        }
        validate_label_ids(&root, &project, &request.label_ids)?;

        let timestamp = now()?;
        let area_id = ObjectId::new();
        let profile_id = ObjectId::new();
        let profile = HumanoidProfileGenerator::generate(
            profile_id,
            area_id,
            1,
            profile_name(request.reference_height_px),
            request.reference_height_px,
            timestamp,
        )?;
        let preview = HumanoidProfileGenerator::preview(request.reference_height_px)?;
        let area = Area {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Area,
            id: area_id,
            revision: 1,
            project_id: request.project_id,
            name: request.name,
            object_type: request.object_type,
            profile_ref: profile.reference(),
            reference_height_px: request.reference_height_px,
            direction_model: DirectionModel::EightWay,
            directions: Direction::ALL.to_vec(),
            default_frame_size_px: request
                .default_frame_size_px
                .unwrap_or(preview.suggested_frame_size_px),
            default_ground_origin_px: request
                .default_ground_origin_px
                .unwrap_or(preview.suggested_ground_origin_px),
            label_ids: request.label_ids,
            created_at: timestamp,
            updated_at: timestamp,
        };
        area.validate()?;
        create_area_snapshot(&root, &project.folder, &area, &profile)?;
        Ok(AreaDetails {
            area,
            profile,
            preview,
            writable: true,
        })
    }

    pub fn revise_profile(
        vaults: &VaultService,
        session_id: ObjectId,
        request: ReviseAreaProfileRequest,
    ) -> Result<AreaDetails, StorageError> {
        let root = writable_root(vaults, session_id)?;
        let mut current = find_area(&root, request.area_id)?;
        if current.area.revision != request.expected_area_revision {
            return Err(StorageError::WriteConflict);
        }
        let old_profile = load_profile(&root, &current.folder, current.area.profile_ref)?;
        old_profile.validate_humanoid_v1()?;
        let next_revision =
            highest_profile_revision(&root, &current.folder, current.area.profile_ref.id)?
                .checked_add(1)
                .ok_or_else(|| {
                    StorageError::InvalidVault("profile revision overflow".to_owned())
                })?;
        let timestamp = now()?;
        let profile = HumanoidProfileGenerator::generate(
            current.area.profile_ref.id,
            current.area.id,
            next_revision,
            profile_name(request.reference_height_px),
            request.reference_height_px,
            timestamp,
        )?;
        let preview = HumanoidProfileGenerator::preview(request.reference_height_px)?;
        let profile_path =
            profile_revision_path(&root, &current.folder, profile.profile_id, profile.revision)?;
        JsonStore::default().create(
            &profile_path,
            &DomainDocument::ProfileRevision(profile.clone()),
        )?;

        current.area.revision = current
            .area
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::InvalidVault("area revision overflow".to_owned()))?;
        current.area.profile_ref = profile.reference();
        current.area.reference_height_px = request.reference_height_px;
        current.area.default_frame_size_px = request
            .default_frame_size_px
            .unwrap_or(preview.suggested_frame_size_px);
        current.area.default_ground_origin_px = request
            .default_ground_origin_px
            .unwrap_or(preview.suggested_ground_origin_px);
        current.area.updated_at = timestamp;
        current.area.validate()?;
        let manifest = VaultLayout::new(root.clone()).area_manifest(&current.folder)?;
        if let Err(error) = JsonStore::default().compare_and_swap(
            &manifest,
            &current.stamp,
            &DomainDocument::Area(current.area.clone()),
        ) {
            let _ = fs::remove_file(profile_path.as_path());
            return Err(error);
        }
        Ok(AreaDetails {
            area: current.area,
            profile,
            preview,
            writable: true,
        })
    }
}

fn session_context(
    vaults: &VaultService,
    session_id: ObjectId,
) -> Result<(VaultRoot, VaultOpenMode), StorageError> {
    let (path, _, mode, _) = vaults
        .session(session_id)
        .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
    Ok((VaultRoot::open(path)?, mode))
}

fn writable_root(vaults: &VaultService, session_id: ObjectId) -> Result<VaultRoot, StorageError> {
    let (root, mode) = session_context(vaults, session_id)?;
    if mode != VaultOpenMode::ReadWrite {
        return Err(StorageError::InvalidVault(
            "this vault session is read-only".to_owned(),
        ));
    }
    Ok(root)
}

fn find_project(root: &VaultRoot, project_id: ObjectId) -> Result<ProjectLocation, StorageError> {
    for entry in read_real_directories(root.path(), "scan projects")? {
        if entry
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            continue;
        }
        let folder = entry
            .strip_prefix(root.path())
            .map_err(|_| StorageError::InvalidVault("project escaped its vault".to_owned()))?
            .to_path_buf();
        let admin = entry.join(PROJECT_ADMIN_DIR);
        if !admin.exists() {
            continue;
        }
        require_real_directory(&admin, "project administration")?;
        let loaded = JsonStore::default()
            .load(&VaultLayout::new(root.clone()).project_manifest(&folder)?)?;
        let DomainDocument::Project(project) = loaded.value else {
            return Err(StorageError::InvalidVault(format!(
                "{} has a non-project manifest",
                folder.to_string_lossy()
            )));
        };
        if project.id == project_id {
            return Ok(ProjectLocation { folder, project });
        }
    }
    Err(StorageError::InvalidVault(format!(
        "project {project_id} does not exist"
    )))
}

fn scan_areas(
    root: &VaultRoot,
    project: &ProjectLocation,
) -> Result<Vec<AreaLocation>, StorageError> {
    let project_path = root.resolve(&project.folder)?;
    let mut areas = Vec::new();
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for entry in read_real_directories(project_path.as_path(), "scan areas")? {
        let name = entry
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| {
                StorageError::InvalidVault("area folder name is not UTF-8".to_owned())
            })?;
        if name.starts_with('.') {
            continue;
        }
        let admin = entry.join(AREA_ADMIN_DIR);
        if !admin.exists() {
            continue;
        }
        require_real_directory(&admin, "area administration")?;
        let folder = entry
            .strip_prefix(root.path())
            .map_err(|_| StorageError::InvalidVault("area escaped its vault".to_owned()))?
            .to_path_buf();
        let loaded =
            JsonStore::default().load(&VaultLayout::new(root.clone()).area_manifest(&folder)?)?;
        let DomainDocument::Area(area) = loaded.value else {
            return Err(StorageError::InvalidVault(format!(
                "{} has a non-area manifest",
                folder.to_string_lossy()
            )));
        };
        if area.project_id != project.project.id {
            return Err(StorageError::InvalidVault(format!(
                "area {} belongs to another project",
                area.id
            )));
        }
        if !ids.insert(area.id) {
            return Err(StorageError::InvalidVault(format!(
                "duplicate area identity {}",
                area.id
            )));
        }
        if !names.insert(portable_name_key(&area.name)) {
            return Err(StorageError::InvalidVault(
                "area names collide under portable comparison".to_owned(),
            ));
        }
        areas.push(AreaLocation {
            folder,
            area,
            stamp: loaded.stamp,
        });
    }
    Ok(areas)
}

fn find_area(root: &VaultRoot, area_id: ObjectId) -> Result<AreaLocation, StorageError> {
    for entry in read_real_directories(root.path(), "scan projects")? {
        if entry
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.'))
        {
            continue;
        }
        let folder = entry
            .strip_prefix(root.path())
            .map_err(|_| StorageError::InvalidVault("project escaped its vault".to_owned()))?
            .to_path_buf();
        let manifest = VaultLayout::new(root.clone()).project_manifest(&folder)?;
        if !manifest.as_path().is_file() {
            continue;
        }
        let loaded = JsonStore::default().load(&manifest)?;
        let DomainDocument::Project(project) = loaded.value else {
            continue;
        };
        let project = ProjectLocation { folder, project };
        if let Some(area) = scan_areas(root, &project)?
            .into_iter()
            .find(|area| area.area.id == area_id)
        {
            return Ok(area);
        }
    }
    Err(StorageError::InvalidVault(format!(
        "area {area_id} does not exist"
    )))
}

fn load_details(
    root: &VaultRoot,
    location: AreaLocation,
    mode: VaultOpenMode,
) -> Result<AreaDetails, StorageError> {
    let profile = load_profile(root, &location.folder, location.area.profile_ref)?;
    profile.validate_humanoid_v1()?;
    if profile.area_id != location.area.id
        || profile.reference_height_px != location.area.reference_height_px
    {
        return Err(StorageError::InvalidVault(
            "area and profile snapshot are incompatible".to_owned(),
        ));
    }
    let preview = HumanoidProfileGenerator::preview(profile.reference_height_px)?;
    Ok(AreaDetails {
        area: location.area,
        profile,
        preview,
        writable: mode == VaultOpenMode::ReadWrite,
    })
}

fn create_area_snapshot(
    root: &VaultRoot,
    project_folder: &Path,
    area: &Area,
    profile: &ProfileRevision,
) -> Result<(), StorageError> {
    let area_segment = object_folder(&area.name, area.id)?;
    let area_name = area_segment
        .file_name()
        .ok_or_else(|| StorageError::InvalidVault("area folder has no name".to_owned()))?;
    let target_area = project_folder.join(&area_segment);
    let target = root.resolve(&target_area)?;
    if target.as_path().exists() {
        return Err(StorageError::WriteConflict);
    }

    let transaction_id = ObjectId::new();
    let transaction_root = project_folder
        .join(PROJECT_ADMIN_DIR)
        .join("transactions")
        .join(transaction_id.to_string());
    let staged_area = transaction_root.join("staged").join(area_name);
    let profile_folder = object_folder("humanoid", profile.profile_id)?;
    let staged_profile_dir = staged_area
        .join(AREA_ADMIN_DIR)
        .join("profiles")
        .join(profile_folder);
    root.ensure_directory(&staged_profile_dir)?;
    let staged_manifest = VaultLayout::new(root.clone()).area_manifest(&staged_area)?;
    let staged_profile =
        root.resolve(&staged_profile_dir.join(profile_revision_filename(profile.revision)))?;
    let store = JsonStore::default();
    let staged_result = (|| {
        store.create(
            &staged_profile,
            &DomainDocument::ProfileRevision(profile.clone()),
        )?;
        store.create(&staged_manifest, &DomainDocument::Area(area.clone()))?;
        Ok::<(), StorageError>(())
    })();
    if let Err(error) = staged_result {
        let _ = fs::remove_dir_all(root.resolve(&transaction_root)?.as_path());
        return Err(error);
    }

    let mut journal = TransactionJournal::new(vec![TransactionStep {
        action: TransactionAction::Move,
        target: portable_relative(&target_area)?,
        staged: portable_relative(&staged_area)?,
        backup: None,
        expected_sha256: None,
    }])?;
    let journal_path = root.resolve(&transaction_root.join("journal.json"))?;
    write_journal(&journal_path, &journal)?;
    fs::rename(root.resolve(&staged_area)?.as_path(), target.as_path())
        .map_err(|error| StorageError::io("publish staged area", &target_area, error))?;
    journal.advance()?;
    write_journal(&journal_path, &journal)
}

fn load_profile(
    root: &VaultRoot,
    area_folder: &Path,
    reference: RevisionRef,
) -> Result<ProfileRevision, StorageError> {
    let path = profile_revision_path(root, area_folder, reference.id, reference.revision)?;
    let loaded = JsonStore::default().load(&path)?;
    let DomainDocument::ProfileRevision(profile) = loaded.value else {
        return Err(StorageError::InvalidVault(
            "profile snapshot has the wrong document kind".to_owned(),
        ));
    };
    if profile.reference() != reference {
        return Err(StorageError::InvalidVault(
            "profile snapshot identity does not match its path".to_owned(),
        ));
    }
    Ok(profile)
}

fn profile_revision_path(
    root: &VaultRoot,
    area_folder: &Path,
    profile_id: ObjectId,
    revision: u32,
) -> Result<crate::storage::ResolvedPath, StorageError> {
    VaultLayout::new(root.clone()).profile_revision(area_folder, profile_id, revision)
}

fn highest_profile_revision(
    root: &VaultRoot,
    area_folder: &Path,
    profile_id: ObjectId,
) -> Result<u32, StorageError> {
    let resolved = VaultLayout::new(root.clone()).humanoid_profile_dir(area_folder, profile_id)?;
    let directory = resolved.relative();
    let mut highest = 0;
    for entry in fs::read_dir(resolved.as_path())
        .map_err(|error| StorageError::io("scan profile revisions", directory, error))?
    {
        let entry = entry.map_err(|error| {
            StorageError::io("scan profile revision", resolved.relative(), error)
        })?;
        if !entry
            .file_type()
            .map_err(|error| StorageError::io("inspect profile revision", &entry.path(), error))?
            .is_file()
            || entry
                .path()
                .extension()
                .is_none_or(|extension| extension != "json")
        {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root.path())
            .map_err(|_| StorageError::InvalidVault("profile escaped its vault".to_owned()))?
            .to_path_buf();
        let loaded = JsonStore::default().load(&root.resolve(&relative)?)?;
        let DomainDocument::ProfileRevision(profile) = loaded.value else {
            return Err(StorageError::InvalidVault(
                "profile directory contains another document kind".to_owned(),
            ));
        };
        if profile.profile_id != profile_id {
            return Err(StorageError::InvalidVault(
                "profile directory contains another profile identity".to_owned(),
            ));
        }
        profile.validate_humanoid_v1()?;
        highest = highest.max(profile.revision);
    }
    if highest == 0 {
        return Err(StorageError::InvalidVault(
            "area profile has no immutable revisions".to_owned(),
        ));
    }
    Ok(highest)
}

fn validate_label_ids(
    root: &VaultRoot,
    project: &ProjectLocation,
    label_ids: &[ObjectId],
) -> Result<(), StorageError> {
    let mut unique = HashSet::new();
    if label_ids.iter().any(|id| !unique.insert(*id)) {
        return Err(StorageError::InvalidVault(
            "area label IDs must be unique".to_owned(),
        ));
    }
    if label_ids.is_empty() {
        return Ok(());
    }
    let labels = project_labels(root, project)?;
    if label_ids
        .iter()
        .any(|id| !labels.iter().any(|label| label.id == *id))
    {
        return Err(StorageError::InvalidVault(
            "area references a missing project label".to_owned(),
        ));
    }
    Ok(())
}

fn project_labels(root: &VaultRoot, project: &ProjectLocation) -> Result<Vec<Label>, StorageError> {
    let path = root.resolve(&project.folder.join(PROJECT_ADMIN_DIR).join("labels.json"))?;
    if !path.as_path().exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path.as_path())
        .map_err(|error| StorageError::io("read project labels", path.relative(), error))?;
    let catalog: ProjectLabelCatalog = serde_json::from_slice(&bytes)
        .map_err(|error| StorageError::InvalidVault(format!("invalid project labels: {error}")))?;
    if catalog.scope != LabelScope::Project || catalog.project_id != Some(project.project.id) {
        return Err(StorageError::InvalidVault(
            "project label catalog has the wrong scope".to_owned(),
        ));
    }
    let mut ids = HashSet::new();
    for label in &catalog.labels {
        label.validate()?;
        if label.scope != LabelScope::Project || label.project_id != Some(project.project.id) {
            return Err(StorageError::InvalidVault(
                "area label belongs to another project".to_owned(),
            ));
        }
        if !ids.insert(label.id) {
            return Err(StorageError::InvalidVault(
                "project label catalog contains duplicate IDs".to_owned(),
            ));
        }
    }
    Ok(catalog.labels)
}

fn read_real_directories(
    directory: &Path,
    operation: &'static str,
) -> Result<Vec<PathBuf>, StorageError> {
    let mut paths = Vec::new();
    for entry in
        fs::read_dir(directory).map_err(|error| StorageError::io(operation, directory, error))?
    {
        let entry = entry.map_err(|error| StorageError::io(operation, directory, error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| StorageError::io(operation, &entry.path(), error))?;
        if file_type.is_symlink() || !file_type.is_dir() {
            continue;
        }
        paths.push(entry.path());
    }
    paths.sort();
    Ok(paths)
}

fn require_real_directory(path: &Path, description: &str) -> Result<(), StorageError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect managed directory", path, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(StorageError::InvalidVault(format!(
            "{description} is not a real directory"
        )));
    }
    Ok(())
}

fn portable_relative(path: &Path) -> Result<RelativePath, StorageError> {
    let value = path
        .iter()
        .map(|component| {
            component
                .to_str()
                .ok_or_else(|| StorageError::InvalidVault("managed path is not UTF-8".to_owned()))
        })
        .collect::<Result<Vec<_>, _>>()?
        .join("/");
    RelativePath::parse(value).map_err(StorageError::from)
}

fn profile_revision_filename(revision: u32) -> String {
    format!("r{revision:04}.json")
}

fn profile_name(height: u16) -> String {
    format!("Humanoid NPC v1 · {height}px")
}

fn now() -> Result<UtcTimestamp, StorageError> {
    UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .map_err(StorageError::from)
}
