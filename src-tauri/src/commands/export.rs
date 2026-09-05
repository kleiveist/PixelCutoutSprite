use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::application::{
    DeleteNpcExportProfileRequest, ExportJobRegistry, ExportJobView, ExportProfileService,
    NpcExportInspection, NpcExportService, SaveNpcExportProfileRequest, StartNpcExportRequest,
    StoredNpcExportProfile, VaultService,
};
use crate::domain::ObjectId;
use crate::exports::{ExportError, ExportService};

use super::outfit::{locked_area_session, refresh};

pub const EXPORT_PROGRESS_EVENT: &str = "pixelcutoutsprite://export-progress";
pub const EXPORT_FINISHED_EVENT: &str = "pixelcutoutsprite://export-finished";

#[tauri::command]
pub fn inspect_npc_export(
    session_id: String,
    area_id: String,
    character_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<NpcExportInspection, String> {
    let character_id = parse_id("character_id", &character_id)?;
    let (_service, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    NpcExportService
        .inspect(&root, &area_path, character_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_npc_export_profiles(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Vec<StoredNpcExportProfile>, String> {
    let parsed_area_id = parse_id("area_id", &area_id)?;
    let (_service, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    ExportProfileService
        .list(&root, &area_path, parsed_area_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_npc_export_profile(
    session_id: String,
    area_id: String,
    request: SaveNpcExportProfileRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<StoredNpcExportProfile, String> {
    let parsed_area_id = parse_id("area_id", &area_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = ExportProfileService
        .save(&root, &area_path, parsed_area_id, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn delete_npc_export_profile(
    session_id: String,
    area_id: String,
    request: DeleteNpcExportProfileRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let parsed_area_id = parse_id("area_id", &area_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    ExportProfileService
        .delete(&root, &area_path, parsed_area_id, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(())
}

#[tauri::command]
pub fn start_npc_export<R: Runtime>(
    session_id: String,
    area_id: String,
    request: StartNpcExportRequest,
    app: AppHandle<R>,
    service: State<'_, Mutex<VaultService>>,
    jobs: State<'_, ExportJobRegistry>,
) -> Result<ExportJobView, String> {
    let (service_guard, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let prepared = NpcExportService
        .prepare(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    let (job, cancellation) = jobs
        .register(
            session_id,
            prepared.request.character_id,
            &prepared.output_directory,
        )
        .map_err(|error| error.to_string())?;
    drop(service_guard);

    let job_id = job.job_id;
    tauri::async_runtime::spawn_blocking(move || {
        let result = catch_unwind(AssertUnwindSafe(|| {
            let mut source = prepared.frame_source;
            let exporter = ExportService::new(root, env!("CARGO_PKG_VERSION"));
            let mut report = |progress| {
                let registry = app.state::<ExportJobRegistry>();
                if let Ok(view) = registry.report(job_id, progress) {
                    let _ = app.emit(EXPORT_PROGRESS_EVENT, view);
                }
            };
            exporter.export(
                &prepared.output_directory,
                &prepared.request,
                &mut source,
                &cancellation,
                &mut report,
            )
        }));
        let registry = app.state::<ExportJobRegistry>();
        let terminal = match result {
            Ok(Ok(outcome)) => registry.complete(job_id, outcome),
            Ok(Err(ExportError::Cancelled)) => registry.cancelled(job_id),
            Ok(Err(error)) => registry.failed(job_id, error.to_string()),
            Err(_) => registry.failed(job_id, "export worker stopped unexpectedly".to_owned()),
        };
        if let Ok(view) = terminal {
            let _ = app.emit(EXPORT_FINISHED_EVENT, view);
        }
    });
    Ok(job)
}

#[tauri::command]
pub fn get_npc_export_job(
    session_id: String,
    job_id: String,
    jobs: State<'_, ExportJobRegistry>,
) -> Result<ExportJobView, String> {
    jobs.get(
        parse_id("session_id", &session_id)?,
        parse_id("job_id", &job_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_npc_export(
    session_id: String,
    job_id: String,
    jobs: State<'_, ExportJobRegistry>,
) -> Result<ExportJobView, String> {
    jobs.cancel(
        parse_id("session_id", &session_id)?,
        parse_id("job_id", &job_id)?,
    )
    .map_err(|error| error.to_string())
}

fn parse_id(field: &'static str, value: &str) -> Result<ObjectId, String> {
    ObjectId::parse(field, value).map_err(|error| error.to_string())
}
