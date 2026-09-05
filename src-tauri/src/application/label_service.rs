use std::fs;
use std::path::Path;

use crate::domain::{
    validate_portable_display_name, DocumentKind, DomainDocument, Label, LabelScope, ObjectId,
    RelativePath, SCHEMA_VERSION,
};
use crate::storage::{
    workspace_label_remove_path, JsonStore, ResolvedPath, StorageError, TransactionAction,
    TransactionFault, TransactionPurpose, TransactionService, TransactionStep, VaultLayout,
    VersionStamp, WorkspaceLabelDocument, WorkspaceLabelPathRole, ADMIN_DIR, AREA_ADMIN_DIR,
};

use super::project_service::{
    load_project_labels, load_workspace_labels, require_writable, scan_projects,
};
use super::workspace_documents::{now, save_json, LabelCatalog, LabelSummary, ProjectViewState};
use super::{VaultService, VaultSessionContext};

#[derive(Debug, Default)]
pub struct LabelService;

impl LabelService {
    pub fn list(
        vaults: &VaultService,
        session_id: ObjectId,
        scope: LabelScope,
        project_id: Option<ObjectId>,
    ) -> Result<Vec<LabelSummary>, StorageError> {
        let context = vaults.context(session_id)?;
        let (catalog, _) = load_catalog(&context, scope, project_id)?;
        Ok(catalog.labels.iter().map(LabelSummary::from).collect())
    }

    pub fn create(
        vaults: &mut VaultService,
        session_id: ObjectId,
        scope: LabelScope,
        project_id: Option<ObjectId>,
        name: String,
        color: String,
    ) -> Result<LabelSummary, StorageError> {
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("label.name", &name)?;
        let (mut catalog, path, catalog_stamp) =
            load_catalog_for_write(&context, scope, project_id)?;
        let timestamp = now()?;
        let label = Label {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Label,
            id: ObjectId::new(),
            revision: 1,
            scope,
            project_id,
            name,
            color,
            created_at: timestamp,
            updated_at: timestamp,
        };
        label.validate()?;
        catalog.labels.push(label.clone());
        touch_catalog(&mut catalog)?;
        save_catalog_cas(&path, &catalog, catalog_stamp.as_ref())?;
        vaults.refresh_index(session_id)?;
        Ok(LabelSummary::from(&label))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update(
        vaults: &mut VaultService,
        session_id: ObjectId,
        scope: LabelScope,
        project_id: Option<ObjectId>,
        label_id: ObjectId,
        expected_revision: u32,
        name: String,
        color: String,
    ) -> Result<LabelSummary, StorageError> {
        Self::update_with_catalog_prewrite(
            vaults,
            session_id,
            (scope, project_id, label_id, expected_revision, name, color),
            |_| Ok(()),
        )
    }

    /// Test seam for simulating a concurrent catalog edit after load but before compare-and-swap.
    #[doc(hidden)]
    pub fn update_with_catalog_prewrite<F>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        update: (LabelScope, Option<ObjectId>, ObjectId, u32, String, String),
        before_write: F,
    ) -> Result<LabelSummary, StorageError>
    where
        F: FnOnce(&ResolvedPath) -> Result<(), StorageError>,
    {
        let (scope, project_id, label_id, expected_revision, name, color) = update;
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("label.name", &name)?;
        let (mut catalog, path, catalog_stamp) =
            load_catalog_for_write(&context, scope, project_id)?;
        let label = catalog
            .labels
            .iter_mut()
            .find(|label| label.id == label_id)
            .ok_or_else(|| StorageError::InvalidVault("label does not exist".to_owned()))?;
        if label.revision != expected_revision {
            return Err(StorageError::WriteConflict);
        }
        label.name = name;
        label.color = color;
        label.revision = label
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::InvalidVault("label revision overflow".to_owned()))?;
        label.updated_at = now()?;
        label.validate()?;
        let result = label.clone();
        touch_catalog(&mut catalog)?;
        before_write(&path)?;
        save_catalog_cas(&path, &catalog, catalog_stamp.as_ref())?;
        vaults.refresh_index(session_id)?;
        Ok(LabelSummary::from(&result))
    }

    pub fn remove(
        vaults: &mut VaultService,
        session_id: ObjectId,
        scope: LabelScope,
        project_id: Option<ObjectId>,
        label_id: ObjectId,
        expected_revision: u32,
    ) -> Result<(), StorageError> {
        Self::remove_with_transactions(
            vaults,
            session_id,
            (scope, project_id, label_id, expected_revision),
            &TransactionService::default(),
        )
    }

    /// Test seam for interrupting the real multi-file workspace-label removal producer.
    /// Normal application callers use [`LabelService::remove`].
    #[doc(hidden)]
    pub fn remove_with_transactions<F: TransactionFault>(
        vaults: &mut VaultService,
        session_id: ObjectId,
        removal: (LabelScope, Option<ObjectId>, ObjectId, u32),
        transactions: &TransactionService<F>,
    ) -> Result<(), StorageError> {
        let (scope, project_id, label_id, expected_revision) = removal;
        let context = require_writable(vaults, session_id)?;
        let (mut catalog, path, catalog_stamp) =
            load_catalog_for_write(&context, scope, project_id)?;
        let label = catalog
            .labels
            .iter()
            .find(|label| label.id == label_id)
            .ok_or_else(|| StorageError::InvalidVault("label does not exist".to_owned()))?;
        if label.revision != expected_revision {
            return Err(StorageError::WriteConflict);
        }
        let catalog_stamp = catalog_stamp
            .ok_or_else(|| StorageError::InvalidVault("label does not exist".to_owned()))?;

        if scope == LabelScope::Workspace {
            remove_workspace_label_transactionally(
                &context,
                label_id,
                &mut catalog,
                catalog_stamp,
                transactions,
            )?;
        } else if let Some(project_id) = project_id {
            ensure_project_label_is_unused(&context, project_id, label_id)?;
            catalog.labels.retain(|label| label.id != label_id);
            touch_catalog(&mut catalog)?;
            save_catalog_cas(&path, &catalog, Some(&catalog_stamp))?;
        }
        vaults.refresh_index(session_id)
    }
}

fn remove_workspace_label_transactionally<F: TransactionFault>(
    context: &VaultSessionContext,
    label_id: ObjectId,
    catalog: &mut LabelCatalog,
    catalog_stamp: VersionStamp,
    transactions: &TransactionService<F>,
) -> Result<(), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    let transaction_id = ObjectId::new();
    let stage_root = Path::new(ADMIN_DIR)
        .join("transactions")
        .join(format!("{transaction_id}.stage"));
    context.root.ensure_directory(&stage_root)?;

    let staging = (|| {
        let mut steps = Vec::new();
        for mut project in scan_projects(context)? {
            let old_len = project.project.workspace_label_ids.len();
            project
                .project
                .workspace_label_ids
                .retain(|candidate| *candidate != label_id);
            if project.project.workspace_label_ids.len() == old_len {
                continue;
            }
            touch_project(&mut project.project)?;
            let staged = project
                .folder
                .join(".project/transactions")
                .join(format!("{transaction_id}.stage"))
                .join("workspace-label-remove.json");
            context
                .root
                .ensure_directory(staged.parent().ok_or_else(|| {
                    StorageError::InvalidVault("project label stage has no parent".to_owned())
                })?)?;
            JsonStore::default().create(
                &context.root.resolve(&staged)?,
                &DomainDocument::Project(project.project),
            )?;
            steps.push(TransactionStep {
                action: TransactionAction::Replace,
                target: portable(layout.project_manifest(&project.folder)?.relative())?,
                staged: portable(&staged)?,
                backup: Some(portable(
                    &project
                        .folder
                        .join(".project/backups/workspace-label-removals")
                        .join(transaction_id.to_string())
                        .join("project.json"),
                )?),
                expected_sha256: Some(project.stamp.sha256),
            });
        }

        let (mut view, view_stamp) = load_project_view_versioned(&layout)?;
        let old_len = view.query.label_ids.len();
        view.query
            .label_ids
            .retain(|candidate| *candidate != label_id);
        if view.query.label_ids.len() != old_len {
            view.revision = view
                .revision
                .checked_add(1)
                .ok_or_else(|| StorageError::InvalidVault("view revision overflow".to_owned()))?;
            view.updated_at = now()?;
            view.validate()?;
            let target_path = workspace_label_remove_path(
                transaction_id,
                WorkspaceLabelDocument::View,
                WorkspaceLabelPathRole::Target,
            )?;
            let staged = workspace_label_remove_path(
                transaction_id,
                WorkspaceLabelDocument::View,
                WorkspaceLabelPathRole::Stage,
            )?;
            let backup = workspace_label_remove_path(
                transaction_id,
                WorkspaceLabelDocument::View,
                WorkspaceLabelPathRole::Backup,
            )?;
            save_json(
                &context.root.resolve(Path::new(staged.as_str()))?,
                &view,
                ProjectViewState::validate,
            )?;
            steps.push(TransactionStep {
                action: TransactionAction::Replace,
                target: target_path,
                staged,
                backup: Some(backup),
                expected_sha256: Some(
                    view_stamp
                        .ok_or_else(|| {
                            StorageError::InvalidVault(
                                "workspace view references a label but has no persisted document"
                                    .to_owned(),
                            )
                        })?
                        .sha256,
                ),
            });
        }

        catalog.labels.retain(|label| label.id != label_id);
        touch_catalog(catalog)?;
        let catalog_target = workspace_label_remove_path(
            transaction_id,
            WorkspaceLabelDocument::Labels,
            WorkspaceLabelPathRole::Target,
        )?;
        let staged_catalog = workspace_label_remove_path(
            transaction_id,
            WorkspaceLabelDocument::Labels,
            WorkspaceLabelPathRole::Stage,
        )?;
        let catalog_backup = workspace_label_remove_path(
            transaction_id,
            WorkspaceLabelDocument::Labels,
            WorkspaceLabelPathRole::Backup,
        )?;
        save_json(
            &context.root.resolve(Path::new(staged_catalog.as_str()))?,
            catalog,
            LabelCatalog::validate,
        )?;
        steps.push(TransactionStep {
            action: TransactionAction::Replace,
            target: catalog_target,
            staged: staged_catalog,
            backup: Some(catalog_backup),
            expected_sha256: Some(catalog_stamp.sha256),
        });
        Ok::<_, StorageError>(steps)
    })();
    let steps = match staging {
        Ok(steps) => steps,
        Err(error) => {
            remove_stage(&context.root, &stage_root);
            return Err(error);
        }
    };
    if let Err(error) = transactions.prepare(
        &context.root,
        Path::new(ADMIN_DIR),
        transaction_id,
        TransactionPurpose::WorkspaceLabelRemove,
        steps,
    ) {
        remove_stage(&context.root, &stage_root);
        return Err(error);
    }
    transactions.execute(&context.root, Path::new(ADMIN_DIR), transaction_id)?;
    Ok(())
}

fn touch_project(project: &mut crate::domain::Project) -> Result<(), StorageError> {
    project.revision = project
        .revision
        .checked_add(1)
        .ok_or_else(|| StorageError::InvalidVault("project revision overflow".to_owned()))?;
    project.updated_at = now()?;
    project.validate()?;
    Ok(())
}

fn load_catalog_for_write(
    context: &VaultSessionContext,
    scope: LabelScope,
    project_id: Option<ObjectId>,
) -> Result<(LabelCatalog, ResolvedPath, Option<VersionStamp>), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    let path = catalog_path(context, &layout, scope, project_id)?;
    match fs::read(path.as_path()) {
        Ok(bytes) => {
            let catalog: LabelCatalog = serde_json::from_slice(&bytes)
                .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
            catalog.validate()?;
            Ok((catalog, path, Some(VersionStamp::from_bytes(&bytes))))
        }
        Err(error)
            if error.kind() == std::io::ErrorKind::NotFound && scope == LabelScope::Workspace =>
        {
            Ok((
                LabelCatalog::empty(LabelScope::Workspace, None)?,
                path,
                None,
            ))
        }
        Err(error) => Err(StorageError::io(
            "read label catalog for write",
            path.relative(),
            error,
        )),
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
            "read workspace view for label removal",
            path.relative(),
            error,
        )),
    }
}

fn save_catalog_cas(
    path: &ResolvedPath,
    catalog: &LabelCatalog,
    expected: Option<&VersionStamp>,
) -> Result<(), StorageError> {
    catalog.validate()?;
    let bytes = serde_json::to_vec_pretty(catalog)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    let validate = |candidate: &[u8]| {
        let decoded: LabelCatalog = serde_json::from_slice(candidate)
            .map_err(|error| crate::domain::DomainError::InvalidJson(error.to_string()))?;
        decoded.validate().map_err(|error| {
            crate::domain::DomainError::invalid("label_catalog", error.to_string())
        })
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

fn catalog_path(
    context: &VaultSessionContext,
    layout: &VaultLayout,
    scope: LabelScope,
    project_id: Option<ObjectId>,
) -> Result<ResolvedPath, StorageError> {
    match (scope, project_id) {
        (LabelScope::Workspace, None) => layout.global_labels(),
        (LabelScope::Project, Some(project_id)) => {
            let project = scan_projects(context)?
                .into_iter()
                .find(|candidate| candidate.project.id == project_id)
                .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))?;
            layout.project_labels(&project.folder)
        }
        _ => Err(StorageError::InvalidVault(
            "label scope does not match project_id".to_owned(),
        )),
    }
}

fn portable(path: &Path) -> Result<RelativePath, StorageError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(|error| {
        StorageError::InvalidVault(format!(
            "invalid workspace-label transaction path `{}`: {error}",
            path.to_string_lossy()
        ))
    })
}

fn remove_stage(root: &crate::storage::VaultRoot, relative: &Path) {
    if let Ok(path) = root.resolve(relative) {
        if path.as_path().exists() {
            let _ = fs::remove_dir_all(path.as_path());
        }
    }
}

fn ensure_project_label_is_unused(
    context: &VaultSessionContext,
    project_id: ObjectId,
    label_id: ObjectId,
) -> Result<(), StorageError> {
    let project = scan_projects(context)?
        .into_iter()
        .find(|candidate| candidate.project.id == project_id)
        .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))?;
    let project_path = context.root.resolve(&project.folder)?;
    for entry in fs::read_dir(project_path.as_path()).map_err(|error| {
        StorageError::io(
            "scan areas before label removal",
            project_path.relative(),
            error,
        )
    })? {
        let entry = entry.map_err(|error| {
            StorageError::io(
                "scan area before label removal",
                project_path.relative(),
                error,
            )
        })?;
        let file_type = entry.file_type().map_err(|error| {
            StorageError::io("inspect area before label removal", &entry.path(), error)
        })?;
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let relative = project
            .folder
            .join(entry.file_name())
            .join(AREA_ADMIN_DIR)
            .join("area.json");
        let manifest = context.root.resolve(&relative)?;
        if !manifest.as_path().is_file() {
            continue;
        }
        let loaded = JsonStore::default().load(&manifest)?;
        if let DomainDocument::Area(area) = loaded.value {
            if area.label_ids.contains(&label_id) {
                return Err(StorageError::InvalidVault(format!(
                    "label is assigned to area `{}`; remove that assignment first",
                    area.name
                )));
            }
        }
    }
    Ok(())
}

fn load_catalog(
    context: &VaultSessionContext,
    scope: LabelScope,
    project_id: Option<ObjectId>,
) -> Result<(LabelCatalog, ResolvedPath), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    match (scope, project_id) {
        (LabelScope::Workspace, None) => {
            let catalog = load_workspace_labels(&layout)?;
            Ok((catalog, layout.global_labels()?))
        }
        (LabelScope::Project, Some(project_id)) => {
            let project = scan_projects(context)?
                .into_iter()
                .find(|candidate| candidate.project.id == project_id)
                .ok_or_else(|| StorageError::InvalidVault("project does not exist".to_owned()))?;
            let catalog = load_project_labels(&layout, &project)?;
            Ok((catalog, layout.project_labels(&project.folder)?))
        }
        _ => Err(StorageError::InvalidVault(
            "label scope does not match project_id".to_owned(),
        )),
    }
}

fn touch_catalog(catalog: &mut LabelCatalog) -> Result<(), StorageError> {
    catalog.revision = catalog
        .revision
        .checked_add(1)
        .ok_or_else(|| StorageError::InvalidVault("label catalog revision overflow".to_owned()))?;
    catalog.updated_at = now()?;
    catalog.validate()
}
