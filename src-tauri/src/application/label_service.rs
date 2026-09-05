use crate::domain::{
    validate_portable_display_name, DocumentKind, Label, LabelScope, ObjectId, SCHEMA_VERSION,
};
use crate::storage::{ResolvedPath, StorageError, VaultLayout};

use super::project_service::{
    load_project_labels, load_project_view, load_workspace_labels,
    remove_workspace_label_references, require_writable, scan_projects,
};
use super::workspace_documents::{now, save_json, LabelCatalog, LabelSummary};
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
        let (mut catalog, path) = load_catalog(&context, scope, project_id)?;
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
        save_json(&path, &catalog, LabelCatalog::validate)?;
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
        let context = require_writable(vaults, session_id)?;
        validate_portable_display_name("label.name", &name)?;
        let (mut catalog, path) = load_catalog(&context, scope, project_id)?;
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
        save_json(&path, &catalog, LabelCatalog::validate)?;
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
        let context = require_writable(vaults, session_id)?;
        let (mut catalog, path) = load_catalog(&context, scope, project_id)?;
        let label = catalog
            .labels
            .iter()
            .find(|label| label.id == label_id)
            .ok_or_else(|| StorageError::InvalidVault("label does not exist".to_owned()))?;
        if label.revision != expected_revision {
            return Err(StorageError::WriteConflict);
        }

        if scope == LabelScope::Workspace {
            remove_workspace_label_references(&context, label_id)?;
            remove_label_from_view(&context, label_id)?;
        }
        catalog.labels.retain(|label| label.id != label_id);
        touch_catalog(&mut catalog)?;
        save_json(&path, &catalog, LabelCatalog::validate)?;
        vaults.refresh_index(session_id)
    }
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

fn remove_label_from_view(
    context: &VaultSessionContext,
    label_id: ObjectId,
) -> Result<(), StorageError> {
    let layout = VaultLayout::new(context.root.clone());
    let mut view = load_project_view(&layout)?;
    let old_len = view.query.label_ids.len();
    view.query
        .label_ids
        .retain(|candidate| *candidate != label_id);
    if old_len != view.query.label_ids.len() {
        view.revision = view
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::InvalidVault("view revision overflow".to_owned()))?;
        view.updated_at = now()?;
        save_json(
            &layout.global_ui()?,
            &view,
            super::ProjectViewState::validate,
        )?;
    }
    Ok(())
}
