use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Mutex, MutexGuard};

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::application::{
    AssetImportInspection, AssetImportJobProgress, AssetImportJobRegistry, AssetImportJobStage,
    AssetImportJobView, AssetInspectionRegistry, AssetInventoryItem, AssetInventoryPage,
    AssetInventoryQuery, AssetService, AssetServiceError, AssetThumbnail,
    ConfirmAssetImportRequest, VaultService,
};
use crate::asset_io::{AssetImportError, AssetRepositoryError};
use crate::domain::ObjectId;
use crate::exports::{CancellationFlag, CancellationToken};

pub const ASSET_IMPORT_PROGRESS_EVENT: &str = "pixelcutoutsprite://asset-import-progress";
pub const ASSET_IMPORT_FINISHED_EVENT: &str = "pixelcutoutsprite://asset-import-finished";

struct InspectionRegistrationGuard<R: Runtime> {
    app: AppHandle<R>,
    session_id: ObjectId,
    inspection_id: ObjectId,
}

impl<R: Runtime> Drop for InspectionRegistrationGuard<R> {
    fn drop(&mut self) {
        let _ = self
            .app
            .state::<AssetInspectionRegistry>()
            .finish(self.session_id, self.inspection_id);
    }
}

#[tauri::command]
pub async fn get_asset_inventory<R: Runtime>(
    session_id: String,
    area_id: String,
    query: Option<AssetInventoryQuery>,
    cursor: Option<String>,
    limit: Option<usize>,
    app: AppHandle<R>,
) -> Result<AssetInventoryPage, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let area_id = parse_id("area_id", &area_id)?;
    let context = {
        let service = app.state::<Mutex<VaultService>>();
        let context = lock(&service)?
            .context(session_id)
            .map_err(|error| error.to_string())?;
        context
    };
    tauri::async_runtime::spawn_blocking(move || {
        AssetService::inventory_page_in_context(
            &context,
            area_id,
            &query.unwrap_or_default(),
            cursor.as_deref(),
            limit,
        )
        .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("inventory worker stopped unexpectedly: {error}"))?
}

#[tauri::command]
pub async fn get_asset_thumbnail<R: Runtime>(
    session_id: String,
    area_id: String,
    asset_id: String,
    revision: u32,
    max_edge: Option<u16>,
    app: AppHandle<R>,
) -> Result<AssetThumbnail, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let area_id = parse_id("area_id", &area_id)?;
    let asset_id = parse_id("asset_id", &asset_id)?;
    let context = {
        let service = app.state::<Mutex<VaultService>>();
        let context = lock(&service)?
            .context(session_id)
            .map_err(|error| error.to_string())?;
        context
    };
    tauri::async_runtime::spawn_blocking(move || {
        AssetService::thumbnail_in_context(&context, area_id, asset_id, revision, max_edge)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("thumbnail worker stopped unexpectedly: {error}"))?
}

#[tauri::command]
pub async fn inspect_asset_sources<R: Runtime>(
    session_id: String,
    area_id: String,
    paths: Vec<String>,
    inspection_id: Option<String>,
    app: AppHandle<R>,
) -> Result<AssetImportInspection, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let area_id = parse_id("area_id", &area_id)?;
    let inspection_id = inspection_id
        .as_deref()
        .map(|value| parse_id("inspection_id", value))
        .transpose()?;
    let context = {
        let service = app.state::<Mutex<VaultService>>();
        let context = lock(&service)?
            .context(session_id)
            .map_err(|error| error.to_string())?;
        context
    };
    let (cancellation, registration) = match inspection_id {
        Some(inspection_id) => {
            let cancellation = app
                .state::<AssetInspectionRegistry>()
                .register(session_id, inspection_id)
                .map_err(|error| error.to_string())?;
            (
                cancellation,
                Some(InspectionRegistrationGuard {
                    app: app.clone(),
                    session_id,
                    inspection_id,
                }),
            )
        }
        None => (CancellationFlag::default(), None),
    };
    let worker = tauri::async_runtime::spawn_blocking(move || {
        // Owned by the worker so completion, task cancellation and panic unwinding all remove
        // the registry entry without relying on the awaiting IPC future to remain alive.
        let _registration = registration;
        let is_cancelled = || cancellation.is_cancelled();
        AssetService::inspect_sources_in_context_controlled(&context, area_id, paths, &is_cancelled)
            .map_err(|error| error.to_string())
    })
    .await;
    worker.map_err(|error| format!("asset inspection worker stopped unexpectedly: {error}"))?
}

#[tauri::command]
pub fn cancel_asset_inspection(
    session_id: String,
    inspection_id: String,
    inspections: State<'_, AssetInspectionRegistry>,
) -> Result<bool, String> {
    inspections
        .cancel(
            parse_id("session_id", &session_id)?,
            parse_id("inspection_id", &inspection_id)?,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_asset_sources<R: Runtime>(
    session_id: String,
    request: ConfirmAssetImportRequest,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
    jobs: State<'_, AssetImportJobRegistry>,
) -> Result<AssetImportJobView, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let service = lock(&service)?;
    let writer_lease = service
        .write_lease(session_id)
        .map_err(|error| error.to_string())?;
    let (job, cancellation) = jobs
        .register(session_id, request.area_id)
        .map_err(|error| error.to_string())?;
    drop(service);

    let job_id = job.job_id;
    tauri::async_runtime::spawn_blocking(move || {
        let execution = catch_unwind(AssertUnwindSafe(|| {
            let imported = {
                let mut report = |progress| {
                    let registry = app.state::<AssetImportJobRegistry>();
                    if let Ok(view) = registry.report(job_id, progress) {
                        let _ = app.emit(ASSET_IMPORT_PROGRESS_EVENT, view);
                    }
                };
                AssetService::execute_import_job(
                    writer_lease.root(),
                    request,
                    &cancellation,
                    &mut report,
                )?
            };
            let refreshing = AssetImportJobProgress {
                stage: AssetImportJobStage::Refreshing,
                completed: 0,
                total: 1,
                message: "Refreshing the vault index".to_owned(),
            };
            if let Ok(view) = app
                .state::<AssetImportJobRegistry>()
                .report(job_id, refreshing)
            {
                let _ = app.emit(ASSET_IMPORT_PROGRESS_EVENT, view);
            }
            let warning = match app.state::<Mutex<VaultService>>().lock() {
                Ok(mut service) => service.refresh_index(session_id).err().map(|error| {
                    format!("Assets were committed, but the vault index refresh failed: {error}")
                }),
                Err(_) => Some(
                    "Assets were committed, but the vault index refresh could not lock the vault service"
                        .to_owned(),
                ),
            };
            Ok::<(Vec<AssetInventoryItem>, Option<String>), AssetServiceError>((imported, warning))
        }));
        // A terminal job state means all managed writes are over and ordinary session writes
        // may resume. Release the vault-wide coordinator before publishing that state.
        drop(writer_lease);
        let registry = app.state::<AssetImportJobRegistry>();
        let terminal = match execution {
            Ok(Ok((imported, warning))) => registry.complete(job_id, imported, warning),
            Ok(Err(AssetServiceError::Repository(AssetRepositoryError::Cancelled))) => {
                registry.cancelled(job_id)
            }
            Ok(Err(AssetServiceError::Import(AssetImportError::Cancelled))) => {
                registry.cancelled(job_id)
            }
            Ok(Err(error)) => registry.failed(job_id, error.to_string()),
            Err(_) => registry.failed(
                job_id,
                "asset import worker stopped unexpectedly".to_owned(),
            ),
        };
        if let Ok(view) = terminal {
            let _ = app.emit(ASSET_IMPORT_FINISHED_EVENT, view);
        }
    });
    Ok(job)
}

#[tauri::command]
pub fn get_asset_import_job(
    session_id: String,
    job_id: String,
    jobs: State<'_, AssetImportJobRegistry>,
) -> Result<AssetImportJobView, String> {
    jobs.get(
        parse_id("session_id", &session_id)?,
        parse_id("job_id", &job_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_active_asset_import_jobs(
    session_id: String,
    jobs: State<'_, AssetImportJobRegistry>,
) -> Result<Vec<AssetImportJobView>, String> {
    jobs.list_active(parse_id("session_id", &session_id)?)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_asset_import(
    session_id: String,
    job_id: String,
    jobs: State<'_, AssetImportJobRegistry>,
) -> Result<AssetImportJobView, String> {
    jobs.cancel(
        parse_id("session_id", &session_id)?,
        parse_id("job_id", &job_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn archive_asset<R: Runtime>(
    session_id: String,
    area_id: String,
    asset_id: String,
    expected_revision: u32,
    app: AppHandle<R>,
) -> Result<AssetInventoryItem, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let area_id = parse_id("area_id", &area_id)?;
    let asset_id = parse_id("asset_id", &asset_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let service = app.state::<Mutex<VaultService>>();
        let mut service = service
            .lock()
            .map_err(|_| "vault service lock is poisoned".to_owned())?;
        let inventory = AssetService::archive(
            &mut service,
            session_id,
            area_id,
            asset_id,
            expected_revision,
        )
        .map_err(|error| error.to_string())?;
        inventory
            .items
            .into_iter()
            .find(|item| item.id == asset_id)
            .ok_or_else(|| "archived asset disappeared from the inventory".to_owned())
    })
    .await
    .map_err(|error| format!("archive worker stopped unexpectedly: {error}"))?
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
