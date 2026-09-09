use tauri::{AppHandle, Manager, Runtime};

use crate::storage::{GlobalSettings, GlobalSettingsStore};

#[tauri::command]
pub fn get_global_settings<R: Runtime>(app: AppHandle<R>) -> Result<GlobalSettings, String> {
    let config = app.path().app_config_dir().map_err(|error| error.to_string())?;
    GlobalSettingsStore::new(&config)
        .load()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_global_settings<R: Runtime>(
    settings: GlobalSettings,
    app: AppHandle<R>,
) -> Result<GlobalSettings, String> {
    let config = app.path().app_config_dir().map_err(|error| error.to_string())?;
    GlobalSettingsStore::new(&config)
        .save(&settings)
        .map_err(|error| error.to_string())?;
    Ok(settings)
}
