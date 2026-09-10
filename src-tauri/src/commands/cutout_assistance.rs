use crate::application::VaultService;
use crate::cutout::jobs::{CutoutJobs, RefineJobSnapshot, RefineRequest};
use crate::domain::ObjectId;
use crate::storage::VaultRoot;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

fn root<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    generation: u64,
) -> Result<VaultRoot, String> {
    let id = ObjectId::parse("session_id", session_id).map_err(|e| e.to_string())?;
    app.state::<Mutex<VaultService>>()
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .session_root_at_generation(id, generation, false)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn start_cutout_refine<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    request: RefineRequest,
) -> Result<String, String> {
    let root = root(&app, &session_id, session_generation)?;
    app.state::<CutoutJobs>()
        .start(root, session_id, session_generation, request)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_cutout_refine_progress<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    job_id: String,
) -> Result<RefineJobSnapshot, String> {
    root(&app, &session_id, session_generation)?;
    app.state::<CutoutJobs>()
        .snapshot(&job_id, &session_id, session_generation)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn cancel_cutout_refine<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    job_id: String,
) -> Result<(), String> {
    // A start reply may arrive after its UI session closed. Cancellation exposes no
    // file data and remains authorized by the captured job owner+generation, so it
    // can still release that old worker. Polling/starting require a live session.
    ObjectId::parse("session_id", &session_id).map_err(|e| e.to_string())?;
    app.state::<CutoutJobs>()
        .cancel(&job_id, &session_id, session_generation)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cutout::{self, segmentation::SelectionParameters, Mask};
    #[test]
    fn assistance_commands_reject_stale_closed_and_foreign_sessions() {
        let app = crate::compose(tauri::test::mock_builder())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let temp = tempfile::TempDir::new().unwrap();
        let opened = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .initialize(temp.path(), None)
            .unwrap();
        let bytes = cutout::encode_png(&image::RgbaImage::from_pixel(
            17,
            13,
            image::Rgba([50, 90, 160, 255]),
        ))
        .unwrap();
        std::fs::write(temp.path().join("source.png"), &bytes).unwrap();
        let loaded = cutout::open_source(
            &root(
                app.handle(),
                &opened.session_id.to_string(),
                opened.session_generation,
            )
            .unwrap(),
            "source.png",
            &cutout::digest(&bytes),
            true,
        )
        .unwrap();
        let request = RefineRequest {
            job_id: "native-job".to_owned(),
            project_path: loaded.project_path,
            source_hash: loaded.project.source.sha256,
            part_id: "head".to_owned(),
            mask_revision: 5,
            parameters: SelectionParameters::default(),
            mask: Mask {
                roi: vec![[0, 17 * 13]],
                ..Mask::default()
            },
        };
        assert!(start_cutout_refine(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation + 1,
            request.clone()
        )
        .is_err());
        start_cutout_refine(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            request,
        )
        .unwrap();
        assert!(get_cutout_refine_progress(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation + 1,
            "native-job".to_owned()
        )
        .is_err());
        let readonly = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .open(temp.path())
            .unwrap();
        assert!(cancel_cutout_refine(
            app.handle().clone(),
            readonly.session_id.to_string(),
            readonly.session_generation,
            "native-job".to_owned()
        )
        .is_err());
        cancel_cutout_refine(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            "native-job".to_owned(),
        )
        .unwrap();
        app.state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .close(opened.session_id)
            .unwrap();
        assert!(cancel_cutout_refine(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            "native-job".to_owned()
        )
        .is_ok());
        assert!(get_cutout_refine_progress(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            "native-job".to_owned()
        )
        .is_err());
    }
}
