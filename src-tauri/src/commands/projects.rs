use std::sync::{Mutex, MutexGuard};

use serde::Deserialize;
use tauri::State;

use crate::application::{
    LabelService, LabelSummary, ProjectCard, ProjectDashboard, ProjectQuery, ProjectService,
    ProjectViewState, VaultService,
};
use crate::domain::{LabelScope, ObjectId};

#[tauri::command]
pub fn get_project_dashboard(
    session_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectDashboard, String> {
    let id = parse_id("session_id", &session_id)?;
    let service = lock(&service)?;
    ProjectService::dashboard(&service, id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_projects(
    session_id: String,
    query: ProjectQuery,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Vec<ProjectCard>, String> {
    let id = parse_id("session_id", &session_id)?;
    let service = lock(&service)?;
    ProjectService::list(&service, id, &query).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_project_view_state(
    session_id: String,
    query: ProjectQuery,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectViewState, String> {
    let id = parse_id("session_id", &session_id)?;
    let service = lock(&service)?;
    ProjectService::save_view(&service, id, query).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_project(
    session_id: String,
    name: String,
    label_ids: Vec<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectCard, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let label_ids = parse_ids("label_ids", label_ids)?;
    let mut service = lock(&service)?;
    ProjectService::create(&mut service, session_id, name, label_ids)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rename_project(
    session_id: String,
    project_id: String,
    expected_revision: u32,
    name: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectCard, String> {
    let mut service = lock(&service)?;
    ProjectService::rename(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
        expected_revision,
        name,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn duplicate_project(
    session_id: String,
    project_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectCard, String> {
    let mut service = lock(&service)?;
    ProjectService::duplicate(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_project_archived(
    session_id: String,
    project_id: String,
    expected_revision: u32,
    archived: bool,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectCard, String> {
    let mut service = lock(&service)?;
    ProjectService::set_archived(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
        expected_revision,
        archived,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_project_labels(
    session_id: String,
    project_id: String,
    expected_revision: u32,
    label_ids: Vec<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<ProjectCard, String> {
    let mut service = lock(&service)?;
    ProjectService::set_labels(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
        expected_revision,
        parse_ids("label_ids", label_ids)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_project(
    session_id: String,
    project_id: String,
    expected_revision: u32,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let mut service = lock(&service)?;
    ProjectService::remove(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
        expected_revision,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_label(
    session_id: String,
    scope: LabelScope,
    project_id: Option<String>,
    name: String,
    color: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<LabelSummary, String> {
    let mut service = lock(&service)?;
    LabelService::create(
        &mut service,
        parse_id("session_id", &session_id)?,
        scope,
        parse_optional_id("project_id", project_id)?,
        name,
        color,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_labels(
    session_id: String,
    scope: LabelScope,
    project_id: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Vec<LabelSummary>, String> {
    let service = lock(&service)?;
    LabelService::list(
        &service,
        parse_id("session_id", &session_id)?,
        scope,
        parse_optional_id("project_id", project_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_label(
    session_id: String,
    input: UpdateLabelInput,
    service: State<'_, Mutex<VaultService>>,
) -> Result<LabelSummary, String> {
    let mut service = lock(&service)?;
    LabelService::update(
        &mut service,
        parse_id("session_id", &session_id)?,
        input.scope,
        parse_optional_id("project_id", input.project_id)?,
        parse_id("label_id", &input.label_id)?,
        input.expected_revision,
        input.name,
        input.color,
    )
    .map_err(|error| error.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateLabelInput {
    scope: LabelScope,
    project_id: Option<String>,
    label_id: String,
    expected_revision: u32,
    name: String,
    color: String,
}

#[tauri::command]
pub fn remove_label(
    session_id: String,
    scope: LabelScope,
    project_id: Option<String>,
    label_id: String,
    expected_revision: u32,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let mut service = lock(&service)?;
    LabelService::remove(
        &mut service,
        parse_id("session_id", &session_id)?,
        scope,
        parse_optional_id("project_id", project_id)?,
        parse_id("label_id", &label_id)?,
        expected_revision,
    )
    .map_err(|error| error.to_string())
}

fn lock<'a>(
    service: &'a State<'_, Mutex<VaultService>>,
) -> Result<MutexGuard<'a, VaultService>, String> {
    service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())
}

fn parse_id(field: &'static str, value: &str) -> Result<ObjectId, String> {
    ObjectId::parse(field, value).map_err(|error| error.to_string())
}

fn parse_optional_id(
    field: &'static str,
    value: Option<String>,
) -> Result<Option<ObjectId>, String> {
    value.map(|value| parse_id(field, &value)).transpose()
}

fn parse_ids(field: &'static str, values: Vec<String>) -> Result<Vec<ObjectId>, String> {
    values.iter().map(|value| parse_id(field, value)).collect()
}
