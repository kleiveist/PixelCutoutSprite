use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use crate::domain::{
    ensure_no_portable_name_collisions, portable_name_key, validate_portable_display_name,
    DocumentKind, DomainDocument, LabelScope, ObjectId, Project, RecordStatus, SCHEMA_VERSION,
};
use crate::storage::{JsonStore, StorageError, VaultLayout, VersionStamp};

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
        let context = require_writable(vaults, session_id)?;
        let layout = VaultLayout::new(context.root);
        let labels = load_workspace_labels(&layout)?;
        validate_query_labels(&query, &labels)?;
        let current = load_project_view(&layout)?;
        let value = ProjectViewState {
            revision: current.revision + 1,
            query,
            updated_at: now()?,
            ..current
        };
        save_json(&layout.global_ui()?, &value, ProjectViewState::validate)?;
        Ok(value)
    }

    pub fn create(
        vaults: &mut VaultService,
        session_id: ObjectId,
        name: String,
        workspace_label_ids: Vec<ObjectId>,
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
        fs::create_dir(project_dir.as_path()).map_err(|error| {
            StorageError::io("create project directory", project_dir.relative(), error)
        })?;
        let creation = (|| {
            context
                .root
                .ensure_directory(layout.project_admin(&folder)?.relative())?;
            for directory in [
                layout.project_cache(&folder)?,
                layout.project_transactions(&folder)?,
                layout.project_backups(&folder)?,
                layout.project_trash(&folder)?,
            ] {
                context.root.ensure_directory(directory.relative())?;
            }
            JsonStore::default().create(
                &layout.project_manifest(&folder)?,
                &DomainDocument::Project(project.clone()),
            )?;
            let project_labels = LabelCatalog::empty(LabelScope::Project, Some(project.id))?;
            save_json(
                &layout.project_labels(&folder)?,
                &project_labels,
                LabelCatalog::validate,
            )?;
            Ok::<(), StorageError>(())
        })();
        if let Err(error) = creation {
            let _ = fs::remove_dir_all(project_dir.as_path());
            return Err(error);
        }
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
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("project.name", &name)?;
        let projects = scan_projects(&context)?;
        ensure_project_name_available(&projects, &name, Some(project_id))?;
        let mut current = take_project(projects, project_id)?;
        require_revision(&current.project, expected_revision)?;
        current.project.name = name;
        touch(&mut current.project)?;
        save_project(&context, &current)?;
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
        let context = require_writable(vaults, session_id)?;
        let projects = scan_projects(&context)?;
        let source = projects
            .iter()
            .find(|item| item.project.id == project_id)
            .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))?;
        let name = duplicate_name(&source.project.name, &projects);
        let labels = source.project.workspace_label_ids.clone();
        Self::create(vaults, session_id, name, labels)
    }

    pub fn remove(
        vaults: &mut VaultService,
        session_id: ObjectId,
        project_id: ObjectId,
        expected_revision: u32,
    ) -> Result<(), StorageError> {
        let context = require_writable(vaults, session_id)?;
        let current = take_project(scan_projects(&context)?, project_id)?;
        require_revision(&current.project, expected_revision)?;
        let layout = VaultLayout::new(context.root.clone());
        let trash = layout.removed_projects()?;
        context.root.ensure_directory(trash.relative())?;
        let source = context.root.resolve(&current.folder)?;
        let folder_name = current
            .folder
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| StorageError::InvalidVault("project folder is not UTF-8".to_owned()))?;
        let target_relative = trash.relative().join(format!(
            "{folder_name}--removed-{}",
            ObjectId::new()
                .to_string()
                .chars()
                .take(8)
                .collect::<String>()
        ));
        let target = context.root.resolve(&target_relative)?;
        fs::rename(source.as_path(), target.as_path()).map_err(|error| {
            StorageError::io("move project to controlled trash", source.relative(), error)
        })?;
        vaults.refresh_index(session_id)
    }
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

pub(crate) fn remove_workspace_label_references(
    context: &VaultSessionContext,
    label_id: ObjectId,
) -> Result<(), StorageError> {
    for mut location in scan_projects(context)? {
        let old_len = location.project.workspace_label_ids.len();
        location
            .project
            .workspace_label_ids
            .retain(|candidate| *candidate != label_id);
        if location.project.workspace_label_ids.len() != old_len {
            touch(&mut location.project)?;
            save_project(context, &location)?;
        }
    }
    Ok(())
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
