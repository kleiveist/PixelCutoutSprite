use std::cmp::Reverse;
use std::fs;

use chrono::Utc;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::domain::{
    ensure_no_portable_name_collisions, portable_name_key, validate_schema, Label, LabelScope,
    ObjectId, RecordStatus, UtcTimestamp, SCHEMA_VERSION,
};
use crate::storage::{JsonStore, ResolvedPath, StorageError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceDocumentKind {
    LabelCatalog,
    ProjectView,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LabelCatalog {
    pub schema_version: u32,
    pub kind: WorkspaceDocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub scope: LabelScope,
    pub project_id: Option<ObjectId>,
    pub labels: Vec<Label>,
    pub updated_at: UtcTimestamp,
}

impl LabelCatalog {
    pub fn empty(scope: LabelScope, project_id: Option<ObjectId>) -> Result<Self, StorageError> {
        let catalog = Self {
            schema_version: SCHEMA_VERSION,
            kind: WorkspaceDocumentKind::LabelCatalog,
            id: ObjectId::new(),
            revision: 1,
            scope,
            project_id,
            labels: Vec::new(),
            updated_at: now()?,
        };
        catalog.validate()?;
        Ok(catalog)
    }

    pub fn validate(&self) -> Result<(), StorageError> {
        validate_schema(self.schema_version)?;
        if self.kind != WorkspaceDocumentKind::LabelCatalog || self.revision == 0 {
            return Err(StorageError::InvalidVault(
                "label catalog has an invalid kind or revision".to_owned(),
            ));
        }
        match (self.scope, self.project_id) {
            (LabelScope::Workspace, None) | (LabelScope::Project, Some(_)) => {}
            _ => {
                return Err(StorageError::InvalidVault(
                    "label catalog scope does not match project_id".to_owned(),
                ));
            }
        }
        let mut ids = std::collections::HashSet::new();
        for label in &self.labels {
            label.validate()?;
            if label.scope != self.scope || label.project_id != self.project_id {
                return Err(StorageError::InvalidVault(
                    "label belongs to a different catalog scope".to_owned(),
                ));
            }
            if !ids.insert(label.id) {
                return Err(StorageError::InvalidVault(
                    "label catalog contains a duplicate ID".to_owned(),
                ));
            }
        }
        ensure_no_portable_name_collisions(
            "label_catalog.labels",
            self.labels.iter().map(|label| label.name.as_str()),
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabelMatch {
    #[default]
    Any,
    All,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatusFilter {
    #[default]
    Any,
    Active,
    Archived,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectSort {
    #[default]
    UpdatedDesc,
    UpdatedAsc,
    NameAsc,
    NameDesc,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ProjectQuery {
    pub search: String,
    pub label_ids: Vec<ObjectId>,
    pub label_match: LabelMatch,
    pub status: ProjectStatusFilter,
    pub sort: ProjectSort,
}

impl ProjectQuery {
    pub fn is_default(&self) -> bool {
        self == &Self::default()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectViewState {
    pub schema_version: u32,
    pub kind: WorkspaceDocumentKind,
    pub revision: u32,
    #[serde(flatten)]
    pub query: ProjectQuery,
    pub updated_at: UtcTimestamp,
}

impl ProjectViewState {
    pub fn initial() -> Result<Self, StorageError> {
        Ok(Self {
            schema_version: SCHEMA_VERSION,
            kind: WorkspaceDocumentKind::ProjectView,
            revision: 1,
            query: ProjectQuery::default(),
            updated_at: now()?,
        })
    }

    pub fn validate(&self) -> Result<(), StorageError> {
        validate_schema(self.schema_version)?;
        if self.kind != WorkspaceDocumentKind::ProjectView || self.revision == 0 {
            return Err(StorageError::InvalidVault(
                "project view has an invalid kind or revision".to_owned(),
            ));
        }
        let mut ids = std::collections::HashSet::new();
        if self.query.label_ids.iter().any(|id| !ids.insert(*id)) {
            return Err(StorageError::InvalidVault(
                "project view contains duplicate label filters".to_owned(),
            ));
        }
        if self.query.search.chars().count() > 200 {
            return Err(StorageError::InvalidVault(
                "project search must not exceed 200 characters".to_owned(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LabelSummary {
    pub id: ObjectId,
    pub name: String,
    pub color: String,
    pub revision: u32,
}

impl From<&Label> for LabelSummary {
    fn from(value: &Label) -> Self {
        Self {
            id: value.id,
            name: value.name.clone(),
            color: value.color.clone(),
            revision: value.revision,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjectCard {
    pub id: ObjectId,
    pub revision: u32,
    pub name: String,
    pub status: RecordStatus,
    pub labels: Vec<LabelSummary>,
    pub workspace_label_ids: Vec<ObjectId>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjectDashboard {
    pub projects: Vec<ProjectCard>,
    pub labels: Vec<LabelSummary>,
    pub view: ProjectViewState,
    pub writable: bool,
}

pub fn filter_project_cards(cards: &mut Vec<ProjectCard>, query: &ProjectQuery) {
    let search = portable_name_key(query.search.trim());
    cards.retain(|card| {
        let search_matches = search.is_empty() || portable_name_key(&card.name).contains(&search);
        let status_matches = match query.status {
            ProjectStatusFilter::Any => true,
            ProjectStatusFilter::Active => card.status == RecordStatus::Active,
            ProjectStatusFilter::Archived => card.status == RecordStatus::Archived,
        };
        let labels_match = if query.label_ids.is_empty() {
            true
        } else {
            match query.label_match {
                LabelMatch::Any => query
                    .label_ids
                    .iter()
                    .any(|id| card.workspace_label_ids.contains(id)),
                LabelMatch::All => query
                    .label_ids
                    .iter()
                    .all(|id| card.workspace_label_ids.contains(id)),
            }
        };
        search_matches && status_matches && labels_match
    });
    match query.sort {
        ProjectSort::UpdatedDesc => cards.sort_by_key(|card| Reverse(card.updated_at)),
        ProjectSort::UpdatedAsc => cards.sort_by_key(|card| card.updated_at),
        ProjectSort::NameAsc => cards.sort_by_key(|card| portable_name_key(&card.name)),
        ProjectSort::NameDesc => {
            cards.sort_by_key(|card| Reverse(portable_name_key(&card.name)));
        }
    }
}

pub(crate) fn load_json<T: DeserializeOwned>(
    path: &ResolvedPath,
    validate: impl FnOnce(&T) -> Result<(), StorageError>,
) -> Result<Option<T>, StorageError> {
    match fs::read(path.as_path()) {
        Ok(bytes) => {
            let value = serde_json::from_slice(&bytes)
                .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
            validate(&value)?;
            Ok(Some(value))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(StorageError::io(
            "read workspace JSON",
            path.relative(),
            error,
        )),
    }
}

pub(crate) fn save_json<T: Serialize + DeserializeOwned>(
    path: &ResolvedPath,
    value: &T,
    validate: impl Fn(&T) -> Result<(), StorageError> + Copy,
) -> Result<(), StorageError> {
    validate(value)?;
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    JsonStore::default().write_bytes(path, &bytes, |candidate| {
        let decoded: T = serde_json::from_slice(candidate)
            .map_err(|error| crate::domain::DomainError::InvalidJson(error.to_string()))?;
        validate(&decoded)
            .map_err(|error| crate::domain::DomainError::invalid("workspace", error.to_string()))
    })
}

pub(crate) fn now() -> Result<UtcTimestamp, StorageError> {
    UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .map_err(StorageError::from)
}
