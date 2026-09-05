use std::path::Path;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State};

use crate::application::{OpenVault, VaultInspection, VaultService};
use crate::domain::ObjectId;
use crate::storage::DeviceSettingsStore;

#[tauri::command]
pub fn inspect_vault(path: String) -> Result<VaultInspection, String> {
    VaultService::inspect(Path::new(&path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn initialize_vault<R: Runtime>(
    path: String,
    confirmation_token: Option<String>,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OpenVault, String> {
    let opened = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .initialize(Path::new(&path), confirmation_token.as_deref())
        .map_err(|error| error.to_string())?;
    remember_vault(&app, Path::new(&opened.path))?;
    Ok(opened)
}

#[tauri::command]
pub fn open_vault<R: Runtime>(
    path: String,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OpenVault, String> {
    let opened = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .open(Path::new(&path))
        .map_err(|error| error.to_string())?;
    remember_vault(&app, Path::new(&opened.path))?;
    Ok(opened)
}

#[tauri::command]
pub fn close_vault(
    session_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let session_id =
        ObjectId::parse("session_id", &session_id).map_err(|error| error.to_string())?;
    service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .close(session_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn recent_vaults<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let config = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    DeviceSettingsStore::new(&config)
        .load()
        .map(|settings| {
            settings
                .recent_vaults
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect()
        })
        .map_err(|error| error.to_string())
}

fn remember_vault<R: Runtime>(app: &AppHandle<R>, path: &Path) -> Result<(), String> {
    let config = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    DeviceSettingsStore::new(&config)
        .remember_vault(path)
        .map(|_| ())
        .map_err(|error| error.to_string())
}
