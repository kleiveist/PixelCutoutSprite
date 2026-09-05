use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::animation::PreviewCache;
use crate::application::{
    AssetImportJobRegistry, AssetInspectionRegistry, ExportJobRegistry, OpenVault, RecoveryStatus,
    VaultInspection, VaultService,
};
use crate::domain::{DomainError, ObjectId};
use crate::storage::{DeviceSettingsStore, RecoveryChoice, StorageError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct VaultCommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmation_token: Option<String>,
}

impl VaultCommandError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            confirmation_token: None,
        }
    }

    fn confirmation(code: &str, message: String, confirmation_token: String) -> Self {
        Self {
            code: code.to_owned(),
            message,
            confirmation_token: Some(confirmation_token),
        }
    }
}

impl From<StorageError> for VaultCommandError {
    fn from(error: StorageError) -> Self {
        let message = error.to_string();
        match error {
            StorageError::Io { .. } => Self::new("io_error", message),
            StorageError::UnsafePath { .. } => Self::new("unsafe_path", message),
            StorageError::InvalidDocument(DomainError::UnsupportedSchemaVersion { .. }) => {
                Self::new("future_schema_protected", message)
            }
            StorageError::InvalidDocument(_) => Self::new("invalid_document", message),
            StorageError::WriteConflict => Self::new("write_conflict", message),
            StorageError::AlreadyLocked { .. } => Self::new("already_locked", message),
            StorageError::ConfirmationRequired { token } => {
                Self::confirmation("confirmation_required", message, token)
            }
            StorageError::LockRecoveryRequired { token } => {
                Self::confirmation("lock_recovery_required", message, token)
            }
            StorageError::ActiveLockProtected => Self::new("active_lock_protected", message),
            StorageError::InvalidVault(_) if message.to_lowercase().contains("read-only") => {
                Self::new("read_only", message)
            }
            StorageError::InvalidVault(_) => Self::new("invalid_vault", message),
            StorageError::TransactionInterrupted { .. } | StorageError::RecoveryRequired(_) => {
                Self::new("recovery_required", message)
            }
            StorageError::FutureSchemaProtected { .. } => {
                Self::new("future_schema_protected", message)
            }
            StorageError::ReplacementFailed(_) => Self::new("write_failed", message),
        }
    }
}

#[tauri::command]
pub fn inspect_vault(path: String) -> Result<VaultInspection, VaultCommandError> {
    VaultService::inspect(Path::new(&path)).map_err(Into::into)
}

#[tauri::command]
pub fn initialize_vault<R: Runtime>(
    path: String,
    confirmation_token: Option<String>,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OpenVault, VaultCommandError> {
    let opened = service
        .lock()
        .map_err(|_| service_poisoned())?
        .initialize(Path::new(&path), confirmation_token.as_deref())
        .map_err(VaultCommandError::from)?;
    remember_vault(&app, Path::new(&opened.path))?;
    Ok(opened)
}

#[tauri::command]
pub fn open_vault<R: Runtime>(
    path: String,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OpenVault, VaultCommandError> {
    let opened = service
        .lock()
        .map_err(|_| service_poisoned())?
        .open(Path::new(&path))
        .map_err(VaultCommandError::from)?;
    remember_vault(&app, Path::new(&opened.path))?;
    Ok(opened)
}

#[tauri::command]
pub fn close_vault(
    session_id: String,
    service: State<'_, Mutex<VaultService>>,
    jobs: State<'_, ExportJobRegistry>,
    asset_import_jobs: State<'_, AssetImportJobRegistry>,
    asset_inspections: State<'_, AssetInspectionRegistry>,
    preview_cache: State<'_, Mutex<PreviewCache>>,
) -> Result<(), VaultCommandError> {
    let session_id = parse_id("session_id", &session_id)?;
    {
        let mut service = service.lock().map_err(|_| service_poisoned())?;
        ensure_session_jobs_idle(session_id, &jobs, &asset_import_jobs)?;
        asset_inspections
            .cancel_session(session_id)
            .map_err(|error| VaultCommandError::new("asset_inspection_error", error.to_string()))?;
        service.close(session_id)?;
    }
    clear_preview_cache(&preview_cache)
}

fn ensure_session_jobs_idle(
    session_id: ObjectId,
    export_jobs: &ExportJobRegistry,
    asset_import_jobs: &AssetImportJobRegistry,
) -> Result<(), VaultCommandError> {
    if export_jobs
        .has_active_session(session_id)
        .map_err(|error| VaultCommandError::new("export_job_error", error.to_string()))?
    {
        return Err(VaultCommandError::new(
            "active_export",
            "cancel the active export before closing this vault",
        ));
    }
    if asset_import_jobs
        .has_active_session(session_id)
        .map_err(|error| VaultCommandError::new("asset_import_job_error", error.to_string()))?
    {
        return Err(VaultCommandError::new(
            "active_asset_import",
            "cancel the active asset import before closing this vault",
        ));
    }
    Ok(())
}

fn clear_preview_cache(cache: &Mutex<PreviewCache>) -> Result<(), VaultCommandError> {
    cache
        .lock()
        .map_err(|_| {
            VaultCommandError::new("preview_cache_error", "preview cache lock is poisoned")
        })?
        .clear();
    Ok(())
}

#[tauri::command]
pub fn list_recovery(
    session_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<RecoveryStatus, VaultCommandError> {
    let session_id = parse_id("session_id", &session_id)?;
    service
        .lock()
        .map_err(|_| service_poisoned())?
        .list_recovery(session_id)
        .map_err(Into::into)
}

#[tauri::command]
pub fn recover_transaction(
    session_id: String,
    transaction_id: String,
    choice: RecoveryChoice,
    service: State<'_, Mutex<VaultService>>,
) -> Result<RecoveryStatus, VaultCommandError> {
    let session_id = parse_id("session_id", &session_id)?;
    let transaction_id = parse_id("transaction_id", &transaction_id)?;
    service
        .lock()
        .map_err(|_| service_poisoned())?
        .recover_transaction(session_id, transaction_id, choice)
        .map_err(Into::into)
}

#[tauri::command]
pub fn recover_orphaned_lock(
    path: String,
    confirmation_token: String,
) -> Result<(), VaultCommandError> {
    VaultService::recover_orphaned_lock(Path::new(&path), &confirmation_token).map_err(Into::into)
}

#[tauri::command]
pub fn heartbeat_vault(
    session_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), VaultCommandError> {
    let session_id = parse_id("session_id", &session_id)?;
    service
        .lock()
        .map_err(|_| service_poisoned())?
        .heartbeat(session_id)
        .map_err(Into::into)
}

#[tauri::command]
pub fn recent_vaults<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, VaultCommandError> {
    let config = app
        .path()
        .app_config_dir()
        .map_err(|error| VaultCommandError::new("app_path_error", error.to_string()))?;
    DeviceSettingsStore::new(&config)
        .load()
        .map(|settings| {
            settings
                .recent_vaults
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect()
        })
        .map_err(Into::into)
}

fn remember_vault<R: Runtime>(app: &AppHandle<R>, path: &Path) -> Result<(), VaultCommandError> {
    let config = app
        .path()
        .app_config_dir()
        .map_err(|error| VaultCommandError::new("app_path_error", error.to_string()))?;
    DeviceSettingsStore::new(&config)
        .remember_vault(path)
        .map(|_| ())
        .map_err(Into::into)
}

fn parse_id(field: &'static str, value: &str) -> Result<ObjectId, VaultCommandError> {
    ObjectId::parse(field, value)
        .map_err(|error| VaultCommandError::new("invalid_argument", error.to_string()))
}

fn service_poisoned() -> VaultCommandError {
    VaultCommandError::new("internal_error", "vault service lock is poisoned")
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn closing_lifecycle_clear_releases_cached_image_payloads() {
        let cache = Mutex::new(PreviewCache::new(64));
        PreviewCache::get_or_load_bitmap(&cache, "fixture".to_owned(), || {
            Ok(image::RgbaImage::new(2, 2))
        })
        .unwrap();
        assert_eq!(cache.lock().unwrap().used_bytes(), 16);

        clear_preview_cache(&cache).unwrap();

        let cache = cache.lock().unwrap();
        assert!(cache.is_empty());
        assert_eq!(cache.used_bytes(), 0);
    }

    #[test]
    fn closing_is_blocked_by_export_and_asset_import_jobs() {
        let session_id = ObjectId::new();
        let export_jobs = ExportJobRegistry::default();
        let import_jobs = AssetImportJobRegistry::default();
        assert!(ensure_session_jobs_idle(session_id, &export_jobs, &import_jobs).is_ok());

        let (export, _) = export_jobs
            .register(session_id, ObjectId::new(), Path::new("build"))
            .unwrap();
        assert_eq!(
            ensure_session_jobs_idle(session_id, &export_jobs, &import_jobs)
                .unwrap_err()
                .code,
            "active_export"
        );
        export_jobs.cancelled(export.job_id).unwrap();

        let (import, _) = import_jobs.register(session_id, ObjectId::new()).unwrap();
        assert_eq!(
            ensure_session_jobs_idle(session_id, &export_jobs, &import_jobs)
                .unwrap_err()
                .code,
            "active_asset_import"
        );
        import_jobs.cancelled(import.job_id).unwrap();
        assert!(ensure_session_jobs_idle(session_id, &export_jobs, &import_jobs).is_ok());
    }
}
