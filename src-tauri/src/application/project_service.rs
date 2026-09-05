use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{
    ensure_no_portable_name_collisions, portable_name_key, validate_portable_display_name,
    DocumentKind, DomainDocument, LabelScope, ObjectId, Project, RecordStatus, RelativePath,
    SCHEMA_VERSION,
};
use crate::storage::{
    hash_managed_path, JsonStore, ResolvedPath, StorageError, TransactionAction, TransactionFault,
    TransactionPurpose, TransactionService, TransactionStep, VaultLayout, VersionStamp,
};

use super::workspace_documents::{
    filter_project_cards, load_json, now, save_json, LabelCatalog, LabelSummary, ProjectCard,
    ProjectDashboard, ProjectQuery, ProjectViewState,
};
use super::{VaultOpenMode, VaultService, VaultSessionContext};

#[derive(Debug)]
pub(crate) struct ProjectLocation {
    pub folder: PathBuf,
    pub project: Project,
    pub stamp: VersionStamp,
}

#[derive(Debug, Default)]
pub struct ProjectService;

impl ProjectService {
    pub fn dashboard(
        vaults: &VaultService,
        session_id: ObjectId,
    ) -> Result<ProjectDashboard, StorageError> {
        let context = vaults.context(session_id)?;
        let layout = VaultLayout::new(context.root.clone());
        let labels = load_workspace_labels(&layout)?;
        let view = load_project_view(&layout)?;
        validate_query_labels(&view.query, &labels)?;
        let projects = project_cards(&context, &labels)?;
        Ok(ProjectDashboard {
            projects,
            labels: labels.labels.iter().map(LabelSummary::from).collect(),
            view,
            writable: context.mode == VaultOpenMode::ReadWrite,
        })
    }

    pub fn list(
        vaults: &VaultService,
        session_id: ObjectId,
        query: &ProjectQuery,
    ) -> Result<Vec<ProjectCard>, StorageError> {
        let context = vaults.context(session_id)?;
        let layout = VaultLayout::new(context.root.clone());
        let labels = load_workspace_labels(&layout)?;
        validate_query_labels(query, &labels)?;
        let mut projects = project_cards(&context, &labels)?;
        filter_project_cards(&mut projects, query);
        Ok(projects)
    }

    pub fn save_view(
        vaults: &VaultService,
        session_id: ObjectId,
        query: ProjectQuery,
    ) -> Result<ProjectViewState, StorageError> {
        Self::save_view_with_prewrite(vaults, session_id, query, |_| Ok(()))
    }

    /// Test seam for simulating an external edit after loading the view and before its CAS write.
    #[doc(hidden)]
    pub fn save_view_with_prewrite<F>(
        vaults: &VaultService,
        session_id: ObjectId,
        query: ProjectQuery,
        before_write: F,
    ) -> Result<ProjectViewState, StorageError>
    where
        F: FnOnce(&ResolvedPath) -> Result<(), StorageError>,
    {
        let context = require_writable(vaults, session_id)?;
        let layout = VaultLayout::new(context.root);
        let labels = load_workspace_labels(&layout)?;
        validate_query_labels(&query, &labels)?;
        let (current, expected_stamp) = load_project_view_versioned(&layout)?;
        let value = ProjectViewState {
            revision: current.revision.checked_add(1).ok_or_else(|| {
                StorageError::InvalidVault("project view revision overflow".to_owned())
            })?,
            query,
            updated_at: now()?,
            ..current
        };
        let path = layout.global_ui()?;
        before_write(&path)?;
        save_project_view_cas(&path, &value, expected_stamp.as_ref())?;
        Ok(value)
    }

    pub fn create(
        vaults: &mut VaultService,
        session_id: ObjectId,
        name: String,
        workspace_label_ids: Vec<ObjectId>,
    ) -> Result<ProjectCard, StorageError> {
        Self::create_with_transactions(
            vaults,
            session_id,
            name,
            workspace_label_ids,
            &TransactionService::default(),
        )
    }

    /// Test seam for exercising the real project-creation producer across a process interruption.
    /// Production callers use [`ProjectService::create`], which supplies the no-fault service.
    #[doc(hidden)]
    pub fn create_with_transactions<F: TransactionFault>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        name: String,
        workspace_label_ids: Vec<ObjectId>,
        transactions: &TransactionService<F>,
    ) -> Result<ProjectCard, StorageError> {
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("project.name", &name)?;
        let layout = VaultLayout::new(context.root.clone());
        let labels = load_workspace_labels(&layout)?;
        validate_label_ids(&workspace_label_ids, &labels)?;
        let existing = scan_projects(&context)?;
        ensure_project_name_available(&existing, &name, None)?;

        let timestamp = now()?;
        let project = Project {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Project,
            id: ObjectId::new(),
            revision: 1,
            name,
            status: RecordStatus::Active,
            workspace_label_ids,
            created_at: timestamp,
            updated_at: timestamp,
        };
        project.validate()?;
        let project_dir = layout.project_dir(&project.name, project.id)?;
        let folder = project_dir.relative().to_path_buf();
        if project_dir.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        let transaction_id = ObjectId::new();
        let staged_folder = PathBuf::from(format!(".creating-project--{transaction_id}"));
        let staged_project = context.root.resolve(&staged_folder)?;
        fs::create_dir(staged_project.as_path()).map_err(|error| {
            StorageError::io(
                "create staged project directory",
                staged_project.relative(),
                error,
            )
        })?;
        let staged_layout = VaultLayout::new(context.root.clone());
        let creation = (|| {
            context
                .root
                .ensure_directory(staged_layout.project_admin(&staged_folder)?.relative())?;
            for directory in [
                staged_layout.project_cache(&staged_folder)?,
                staged_layout.project_transactions(&staged_folder)?,
                staged_layout.project_backups(&staged_folder)?,
                staged_layout.project_trash(&staged_folder)?,
            ] {
                context.root.ensure_directory(directory.relative())?;
            }
            JsonStore::default().create(
                &staged_layout.project_manifest(&staged_folder)?,
                &DomainDocument::Project(project.clone()),
            )?;
            let project_labels = LabelCatalog::empty(LabelScope::Project, Some(project.id))?;
            save_json(
                &staged_layout.project_labels(&staged_folder)?,
                &project_labels,
                LabelCatalog::validate,
            )?;
            Ok::<(), StorageError>(())
        })();
        if let Err(error) = creation {
            let _ = fs::remove_dir_all(staged_project.as_path());
            return Err(error);
        }
        if let Err(error) = transactions.prepare(
            &context.root,
            &staged_folder,
            transaction_id,
            TransactionPurpose::ProjectCreate,
            vec![TransactionStep {
                action: TransactionAction::Move,
                target: relative_path(&folder)?,
                staged: relative_path(&staged_folder)?,
                backup: None,
                expected_sha256: None,
            }],
        ) {
            let _ = fs::remove_dir_all(staged_project.as_path());
            return Err(error);
        }
        transactions.execute(&context.root, &staged_folder, transaction_id)?;
        vaults.refresh_index(session_id)?;
        project_card(&project, &labels)
    }

    pub fn rename(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
        name: String,
    ) -> Result<ProjectCard, StorageError> {
        Self::rename_with_transactions(
            vaults,
            session_id,
            project_id,
            expected_revision,
            name,
            &TransactionService::default(),
        )
    }

    /// Test seam for interrupting the real project-rename producer after either durable step.
    /// Production callers use [`ProjectService::rename`], which supplies the no-fault service.
    #[doc(hidden)]
    pub fn rename_with_transactions<F: TransactionFault>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
        name: String,
        transactions: &TransactionService<F>,
    ) -> Result<ProjectCard, StorageError> {
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("project.name", &name)?;
        let projects = scan_projects(&context)?;
        ensure_project_name_available(&projects, &name, Some(project_id))?;
        let mut current = take_project(projects, project_id)?;
        require_revision(&current.project, expected_revision)?;
        current.project.name = name;
        touch(&mut current.project)?;
        rename_project_transactionally(&context, &current, transactions)?;
        vaults.refresh_index(session_id)?;
        let labels = load_workspace_labels(&VaultLayout::new(context.root))?;
        project_card(&current.project, &labels)
    }

    pub fn set_labels(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
        label_ids: Vec<ObjectId>,
    ) -> Result<ProjectCard, StorageError> {
        let context = require_writable(vaults, session_id)?;
        let layout = VaultLayout::new(context.root.clone());
        let labels = load_workspace_labels(&layout)?;
        validate_label_ids(&label_ids, &labels)?;
        let mut current = take_project(scan_projects(&context)?, project_id)?;
        require_revision(&current.project, expected_revision)?;
        current.project.workspace_label_ids = label_ids;
        touch(&mut current.project)?;
        save_project(&context, &current)?;
        vaults.refresh_index(session_id)?;
        project_card(&current.project, &labels)
    }

    pub fn set_archived(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
        archived: bool,
    ) -> Result<ProjectCard, StorageError> {
        let context = require_writable(vaults, session_id)?;
        let mut current = take_project(scan_projects(&context)?, project_id)?;
        require_revision(&current.project, expected_revision)?;
        current.project.status = if archived {
            RecordStatus::Archived
        } else {
            RecordStatus::Active
        };
        touch(&mut current.project)?;
        save_project(&context, &current)?;
        vaults.refresh_index(session_id)?;
        let labels = load_workspace_labels(&VaultLayout::new(context.root))?;
        project_card(&current.project, &labels)
    }

    pub fn duplicate(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
    ) -> Result<ProjectCard, StorageError> {
        Self::duplicate_with_transactions(
            vaults,
            session_id,
            project_id,
            &TransactionService::default(),
        )
    }

    /// Test seam matching project creation so duplication exercises the same durable publish path.
    #[doc(hidden)]
    pub fn duplicate_with_transactions<F: TransactionFault>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        transactions: &TransactionService<F>,
    ) -> Result<ProjectCard, StorageError> {
        let context = require_writable(vaults, session_id)?;
        let projects = scan_projects(&context)?;
        let source = projects
            .iter()
            .find(|item| item.project.id == project_id)
            .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))?;
        let name = duplicate_name(&source.project.name, &projects);
        let labels = source.project.workspace_label_ids.clone();
        Self::create_with_transactions(vaults, session_id, name, labels, transactions)
    }

    pub fn remove(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
    ) -> Result<(), StorageError> {
        Self::remove_with_transactions(
            vaults,
            session_id,
            project_id,
            expected_revision,
            &TransactionService::default(),
            || Ok(()),
        )
    }

    /// Test seam for observing the real trash producer at its last referential check and for
    /// interrupting the durable move. Production callers use [`Self::remove`].
    #[doc(hidden)]
    pub fn remove_with_transactions<F, P>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
        transactions: &TransactionService<F>,
        before_prepare: P,
    ) -> Result<(), StorageError>
    where
        F: TransactionFault,
        P: FnOnce() -> Result<(), StorageError>,
    {
        let context = require_writable(vaults, session_id)?;
        let current = take_project(scan_projects(&context)?, project_id)?;
        let source = context.root.resolve(&current.folder)?;
        let expected_tree_sha256 = hash_managed_path(source.as_path())?;
        let manifest = context
            .root
            .resolve(&current.folder.join(".project/project.json"))?;
        let observed = JsonStore::default().load(&manifest)?;
        if observed.stamp != current.stamp {
            return Err(StorageError::WriteConflict);
        }
        require_revision(&current.project, expected_revision)?;
        let layout = VaultLayout::new(context.root.clone());
        let trash = layout.removed_projects()?;
        context.root.ensure_directory(trash.relative())?;
        let folder_name = current
            .folder
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| StorageError::InvalidVault("project folder is not UTF-8".to_owned()))?;
        let target_relative = trash.relative().join(folder_name);
        if context.root.resolve(&target_relative)?.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        let transaction_id = ObjectId::new();
        before_prepare()?;
        transactions.prepare(
            &context.root,
            &current.folder,
            transaction_id,
            TransactionPurpose::TrashMove,
            vec![TransactionStep {
                action: TransactionAction::Move,
                target: relative_path(&target_relative)?,
                staged: relative_path(&current.folder)?,
                backup: None,
                expected_sha256: Some(expected_tree_sha256),
            }],
        )?;
        transactions.execute(&context.root, &current.folder, transaction_id)?;
        vaults.refresh_index(session_id)
    }
}

/// Updates the display name and the readable project-folder segment as one recoverable
/// project-owned transaction. The project UUID remains the source of identity; names never are.
fn rename_project_transactionally<F: TransactionFault>(
    context: &VaultSessionContext,
    current: &ProjectLocation,
    transactions: &TransactionService<F>,
) -> Result<(), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    let transaction_id = ObjectId::new();
    let stage_root = current
        .folder
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let staged_manifest = stage_root.join("project.json");
    let backup = current
        .folder
        .join(".project/backups/renames")
        .join(transaction_id.to_string())
        .join("project.json");
    let target_manifest = current.folder.join(".project/project.json");
    let renamed_folder = layout.project_dir(&current.project.name, current.project.id)?;
    let renamed_folder = renamed_folder.relative().to_path_buf();

    if renamed_folder != current.folder && context.root.resolve(&renamed_folder)?.as_path().exists()
    {
        return Err(StorageError::WriteConflict);
    }

    context.root.ensure_directory(&stage_root)?;
    let staged = context.root.resolve(&staged_manifest)?;
    if let Err(error) =
        JsonStore::default().create(&staged, &DomainDocument::Project(current.project.clone()))
    {
        let _ = remove_stage(&context.root, &stage_root);
        return Err(error);
    }

    let mut steps = vec![TransactionStep {
        action: TransactionAction::Replace,
        target: relative_path(&target_manifest)?,
        staged: relative_path(&staged_manifest)?,
        backup: Some(relative_path(&backup)?),
        expected_sha256: Some(current.stamp.sha256.clone()),
    }];
    if renamed_folder != current.folder {
        steps.push(TransactionStep {
            action: TransactionAction::Move,
            target: relative_path(&renamed_folder)?,
            staged: relative_path(&current.folder)?,
            backup: None,
            expected_sha256: None,
        });
    }

    if let Err(error) = transactions.prepare(
        &context.root,
        &current.folder,
        transaction_id,
        TransactionPurpose::ProjectRename,
        steps,
    ) {
        let _ = remove_stage(&context.root, &stage_root);
        return Err(error);
    }
    transactions.execute(&context.root, &current.folder, transaction_id)?;
    Ok(())
}

fn relative_path(path: &Path) -> Result<RelativePath, StorageError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(Into::into)
}

fn remove_stage(root: &crate::storage::VaultRoot, relative: &Path) -> Result<(), StorageError> {
    let path = root.resolve(relative)?;
    if path.as_path().exists() {
        fs::remove_dir_all(path.as_path()).map_err(|error| {
            StorageError::io("remove failed project rename stage", path.relative(), error)
        })?;
    }
    Ok(())
}

pub(crate) fn require_writable(
    vaults: &VaultService,
    session_id: ObjectId,
) -> Result<VaultSessionContext, StorageError> {
    let context = vaults.context(session_id)?;
    if context.mode != VaultOpenMode::ReadWrite {
        return Err(StorageError::InvalidVault(
            "this vault session is read-only".to_owned(),
        ));
    }
    Ok(context)
}

pub(crate) fn scan_projects(
    context: &VaultSessionContext,
) -> Result<Vec<ProjectLocation>, StorageError> {
    let mut projects = Vec::new();
    let layout = VaultLayout::new(context.root.clone());
    for entry in fs::read_dir(context.root.path())
        .map_err(|error| StorageError::io("scan projects", context.root.path(), error))?
    {
        let entry = entry
            .map_err(|error| StorageError::io("scan project entry", context.root.path(), error))?;
        let kind = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect project entry", &entry.path(), error))?;
        if kind.is_symlink()
            || !kind.is_dir()
            || entry.file_name().to_string_lossy().starts_with('.')
        {
            continue;
        }
        let folder = PathBuf::from(entry.file_name());
        let admin = entry.path().join(".project");
        if !admin.exists() {
            continue;
        }
        let metadata = fs::symlink_metadata(&admin)
            .map_err(|error| StorageError::io("inspect project metadata", &admin, error))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(StorageError::InvalidVault(format!(
                "project metadata is unsafe in {}",
                folder.to_string_lossy()
            )));
        }
        let loaded = JsonStore::default().load(&layout.project_manifest(&folder)?)?;
        let DomainDocument::Project(project) = loaded.value else {
            return Err(StorageError::InvalidVault(format!(
                "project manifest has the wrong kind in {}",
                folder.to_string_lossy()
            )));
        };
        projects.push(ProjectLocation {
            folder,
            project,
            stamp: loaded.stamp,
        });
    }
    ensure_no_portable_name_collisions(
        "projects",
        projects.iter().map(|item| item.project.name.as_str()),
    )?;
    let mut ids = HashSet::new();
    if projects.iter().any(|item| !ids.insert(item.project.id)) {
        return Err(StorageError::InvalidVault(
            "project manifests contain duplicate IDs".to_owned(),
        ));
    }
    Ok(projects)
}

pub(crate) fn load_workspace_labels(layout: &VaultLayout) -> Result<LabelCatalog, StorageError> {
    let path = layout.global_labels()?;
    match load_json(&path, LabelCatalog::validate)? {
        Some(value) => Ok(value),
        None => LabelCatalog::empty(LabelScope::Workspace, None),
    }
}

pub(crate) fn load_project_labels(
    layout: &VaultLayout,
    project: &ProjectLocation,
) -> Result<LabelCatalog, StorageError> {
    load_json(
        &layout.project_labels(&project.folder)?,
        LabelCatalog::validate,
    )?
    .ok_or_else(|| {
        StorageError::InvalidVault(format!(
            "project {} is missing .project/labels.json",
            project.project.id
        ))
    })
}

pub(crate) fn load_project_view(layout: &VaultLayout) -> Result<ProjectViewState, StorageError> {
    match load_json(&layout.global_ui()?, ProjectViewState::validate)? {
        Some(value) => Ok(value),
        None => ProjectViewState::initial(),
    }
}

fn load_project_view_versioned(
    layout: &VaultLayout,
) -> Result<(ProjectViewState, Option<VersionStamp>), StorageError> {
    let path = layout.global_ui()?;
    match fs::read(path.as_path()) {
        Ok(bytes) => {
            let view: ProjectViewState = serde_json::from_slice(&bytes)
                .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
            view.validate()?;
            Ok((view, Some(VersionStamp::from_bytes(&bytes))))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok((ProjectViewState::initial()?, None))
        }
        Err(error) => Err(StorageError::io(
            "read project view for write",
            path.relative(),
            error,
        )),
    }
}

fn save_project_view_cas(
    path: &ResolvedPath,
    view: &ProjectViewState,
    expected: Option<&VersionStamp>,
) -> Result<(), StorageError> {
    view.validate()?;
    let bytes = serde_json::to_vec_pretty(view)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    let validate = |candidate: &[u8]| {
        let decoded: ProjectViewState = serde_json::from_slice(candidate)
            .map_err(|error| crate::domain::DomainError::InvalidJson(error.to_string()))?;
        decoded
            .validate()
            .map_err(|error| crate::domain::DomainError::invalid("project_view", error.to_string()))
    };
    match expected {
        Some(stamp) => JsonStore::default()
            .compare_and_swap_bytes(path, stamp, &bytes, validate)
            .map(|_| ()),
        None => JsonStore::default()
            .create_bytes(path, &bytes, validate)
            .map(|_| ()),
    }
}

fn project_cards(
    context: &VaultSessionContext,
    labels: &LabelCatalog,
) -> Result<Vec<ProjectCard>, StorageError> {
    let mut cards = scan_projects(context)?
        .iter()
        .map(|item| project_card(&item.project, labels))
        .collect::<Result<Vec<_>, _>>()?;
    cards.sort_by_key(|card| std::cmp::Reverse(card.updated_at));
    Ok(cards)
}

fn project_card(project: &Project, labels: &LabelCatalog) -> Result<ProjectCard, StorageError> {
    let labels_by_id = labels
        .labels
        .iter()
        .map(|label| (label.id, label))
        .collect::<HashMap<_, _>>();
    let resolved = project
        .workspace_label_ids
        .iter()
        .map(|id| {
            labels_by_id
                .get(id)
                .map(|label| LabelSummary::from(*label))
                .ok_or_else(|| {
                    StorageError::InvalidVault(format!(
                        "project {} references missing workspace label {id}",
                        project.id
                    ))
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ProjectCard {
        id: project.id,
        revision: project.revision,
        name: project.name.clone(),
        status: project.status,
        labels: resolved,
        workspace_label_ids: project.workspace_label_ids.clone(),
        created_at: project.created_at,
        updated_at: project.updated_at,
    })
}

fn validate_query_labels(query: &ProjectQuery, labels: &LabelCatalog) -> Result<(), StorageError> {
    if query.search.chars().count() > 200 {
        return Err(StorageError::InvalidVault(
            "project search must not exceed 200 characters".to_owned(),
        ));
    }
    validate_label_ids(&query.label_ids, labels)
}

fn validate_label_ids(ids: &[ObjectId], labels: &LabelCatalog) -> Result<(), StorageError> {
    let known = labels
        .labels
        .iter()
        .map(|label| label.id)
        .collect::<HashSet<_>>();
    let mut unique = HashSet::new();
    for id in ids {
        if !unique.insert(*id) {
            return Err(StorageError::InvalidVault(
                "label selection contains a duplicate ID".to_owned(),
            ));
        }
        if !known.contains(id) {
            return Err(StorageError::InvalidVault(format!(
                "workspace label {id} does not exist"
            )));
        }
    }
    Ok(())
}

fn ensure_project_name_available(
    projects: &[ProjectLocation],
    name: &str,
    except: Option<ObjectId>,
) -> Result<(), StorageError> {
    let candidate = portable_name_key(name);
    if projects.iter().any(|item| {
        Some(item.project.id) != except && portable_name_key(&item.project.name) == candidate
    }) {
        return Err(StorageError::InvalidVault(
            "a project with this normalized name already exists".to_owned(),
        ));
    }
    Ok(())
}

fn duplicate_name(source: &str, projects: &[ProjectLocation]) -> String {
    let existing = projects
        .iter()
        .map(|item| portable_name_key(&item.project.name))
        .collect::<HashSet<_>>();
    for number in 1..=10_000 {
        let candidate = if number == 1 {
            format!("{source} copy")
        } else {
            format!("{source} copy {number}")
        };
        if candidate.chars().count() <= 120 && !existing.contains(&portable_name_key(&candidate)) {
            return candidate;
        }
    }
    format!(
        "Project copy {}",
        ObjectId::new()
            .to_string()
            .chars()
            .take(8)
            .collect::<String>()
    )
}

fn take_project(
    projects: Vec<ProjectLocation>,
    id: ObjectId,
) -> Result<ProjectLocation, StorageError> {
    projects
        .into_iter()
        .find(|item| item.project.id == id)
        .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))
}

fn require_revision(project: &Project, expected: u32) -> Result<(), StorageError> {
    if project.revision != expected {
        return Err(StorageError::WriteConflict);
    }
    Ok(())
}

fn touch(project: &mut Project) -> Result<(), StorageError> {
    project.revision = project
        .revision
        .checked_add(1)
        .ok_or_else(|| StorageError::InvalidVault("project revision overflow".to_owned()))?;
    project.updated_at = now()?;
    project.validate()?;
    Ok(())
}

fn save_project(
    context: &VaultSessionContext,
    location: &ProjectLocation,
) -> Result<(), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    JsonStore::default().compare_and_swap(
        &layout.project_manifest(&location.folder)?,
        &location.stamp,
        &DomainDocument::Project(location.project.clone()),
    )?;
    Ok(())
}
