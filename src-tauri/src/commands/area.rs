use std::sync::{Mutex, MutexGuard};

use tauri::State;

use crate::application::{
    AreaDashboard, AreaDetails, AreaService, CreateAreaRequest, ReviseAreaProfileRequest,
    VaultService,
};
use crate::domain::{HumanoidProfilePreview, ObjectId};

#[tauri::command]
pub fn preview_humanoid_profile(
    reference_height_px: u16,
) -> Result<HumanoidProfilePreview, String> {
    AreaService::preview(reference_height_px).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_area_dashboard(
    session_id: String,
    project_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AreaDashboard, String> {
    let service = lock(&service)?;
    AreaService::dashboard(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("project_id", &project_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_area(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AreaDetails, String> {
    let service = lock(&service)?;
    AreaService::open(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_area(
    session_id: String,
    request: CreateAreaRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AreaDetails, String> {
    let service = lock(&service)?;
    AreaService::create(&service, parse_id("session_id", &session_id)?, request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_area_profile_revision(
    session_id: String,
    request: ReviseAreaProfileRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AreaDetails, String> {
    let service = lock(&service)?;
    AreaService::revise_profile(&service, parse_id("session_id", &session_id)?, request)
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
