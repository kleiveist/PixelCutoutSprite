use std::sync::{Mutex, MutexGuard};

use tauri::State;

use crate::application::{
    CreateMotionRequest, MotionCard, MotionDashboard, MotionDraft, MotionOpenTarget, MotionService,
    SaveMotionDraftRequest, VaultService,
};
use crate::domain::{MotionRevision, ObjectId};

#[tauri::command]
pub fn get_motion_dashboard(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDashboard, String> {
    let service = lock(&service)?;
    MotionService::dashboard(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_motion(
    session_id: String,
    request: CreateMotionRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::create(&mut service, parse_id("session_id", &session_id)?, request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn duplicate_motion(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::duplicate(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_motion_draft(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDraft, String> {
    let service = lock(&service)?;
    MotionService::load_draft(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_motion_draft(
    session_id: String,
    request: SaveMotionDraftRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDraft, String> {
    let mut service = lock(&service)?;
    MotionService::save_draft(&mut service, parse_id("session_id", &session_id)?, request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn publish_motion(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionRevision, String> {
    let mut service = lock(&service)?;
    MotionService::publish(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_motion_archived(
    session_id: String,
    template_id: String,
    expected_revision: u32,
    archived: bool,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::set_archived(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
        expected_revision,
        archived,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_motion(
    session_id: String,
    template_id: String,
    expected_revision: u32,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let mut service = lock(&service)?;
    MotionService::remove(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
        expected_revision,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn resolve_motion_open(
    session_id: String,
    template_id: String,
    character_id: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionOpenTarget, String> {
    let service = lock(&service)?;
    MotionService::resolve_open(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
        character_id
            .map(|value| parse_id("character_id", &value))
            .transpose()?,
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
