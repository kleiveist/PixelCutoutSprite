use std::sync::{Mutex, MutexGuard};

use tauri::State;

use crate::application::{
    AssetImportInspection, AssetInventory, AssetService, ConfirmAssetImportRequest, VaultService,
};
use crate::domain::ObjectId;

#[tauri::command]
pub fn get_asset_inventory(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AssetInventory, String> {
    let service = lock(&service)?;
    AssetService::inventory(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn inspect_asset_sources(
    session_id: String,
    area_id: String,
    paths: Vec<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AssetImportInspection, String> {
    let service = lock(&service)?;
    AssetService::inspect_sources(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
        paths,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_asset_sources(
    session_id: String,
    request: ConfirmAssetImportRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AssetInventory, String> {
    let mut service = lock(&service)?;
    AssetService::import(&mut service, parse_id("session_id", &session_id)?, request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn archive_asset(
    session_id: String,
    area_id: String,
    asset_id: String,
    expected_revision: u32,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AssetInventory, String> {
    let mut service = lock(&service)?;
    AssetService::archive(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
        parse_id("asset_id", &asset_id)?,
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
