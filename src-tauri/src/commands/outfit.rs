use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use tauri::State;

use crate::animation::PreviewCache;
use crate::application::{
    AppearanceService, AreaService, OutfitDraftEdits, OutfitEditorContext, OutfitLaunchContext,
    OutfitPreviewFrame, OutfitTarget, SaveNpcRequest, SavedNpc, VaultService,
};
use crate::domain::{Direction, ObjectId, RevisionRef};
use crate::storage::VaultRoot;

#[tauri::command]
pub fn inspect_outfit_launch(
    session_id: String,
    area_id: String,
    template_ref: RevisionRef,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OutfitLaunchContext, String> {
    let (_service, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    AppearanceService
        .launch_context(&root, &area_path, template_ref)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_outfit_draft(
    session_id: String,
    area_id: String,
    template_ref: RevisionRef,
    target: OutfitTarget,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OutfitEditorContext, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = AppearanceService
        .start_draft(&root, &area_path, template_ref, target)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn resume_outfit_draft(
    session_id: String,
    area_id: String,
    draft_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OutfitEditorContext, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (_service, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    AppearanceService
        .resume_draft(&root, &area_path, draft_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn autosave_outfit_draft(
    session_id: String,
    area_id: String,
    draft_id: String,
    expected_revision: u32,
    edits: OutfitDraftEdits,
    expected_sha256: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OutfitEditorContext, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = AppearanceService
        .autosave_draft_checked(
            &root,
            &area_path,
            draft_id,
            expected_revision,
            Some(&expected_sha256),
            edits,
        )
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn auto_assign_outfit(
    session_id: String,
    area_id: String,
    draft_id: String,
    expected_revision: u32,
    assets: Vec<crate::domain::SlotRef>,
    expected_sha256: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<OutfitEditorContext, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = AppearanceService
        .auto_assign_checked(
            &root,
            &area_path,
            draft_id,
            expected_revision,
            Some(&expected_sha256),
            assets,
        )
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn render_outfit_preview(
    session_id: String,
    area_id: String,
    draft_id: String,
    direction: Direction,
    frame_index: u16,
    edits: Option<OutfitDraftEdits>,
    service: State<'_, Mutex<VaultService>>,
    cache: State<'_, Mutex<PreviewCache>>,
) -> Result<OutfitPreviewFrame, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (service_guard, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    let prepared = AppearanceService
        .prepare_preview(&root, &area_path, draft_id, direction, frame_index, edits)
        .map_err(|error| error.to_string())?;
    // Preparation captured a validated, owned metadata snapshot. Image decoding
    // and compositing can now run without serializing unrelated vault commands.
    drop(service_guard);
    AppearanceService
        .render_prepared_preview(&root, &area_path, prepared, cache.inner())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_outfit_as_npc(
    session_id: String,
    area_id: String,
    draft_id: String,
    expected_revision: u32,
    request: SaveNpcRequest,
    expected_sha256: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<SavedNpc, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = AppearanceService
        .save_as_npc_checked(
            &root,
            &area_path,
            draft_id,
            expected_revision,
            Some(&expected_sha256),
            request,
        )
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn apply_outfit_to_npc(
    session_id: String,
    area_id: String,
    draft_id: String,
    expected_revision: u32,
    expected_sha256: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<SavedNpc, String> {
    let draft_id = parse_id("draft_id", &draft_id)?;
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = AppearanceService
        .apply_to_existing_npc_checked(
            &root,
            &area_path,
            draft_id,
            expected_revision,
            Some(&expected_sha256),
        )
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

pub(super) fn locked_area_session<'a>(
    service: &'a Mutex<VaultService>,
    raw_session_id: &str,
    raw_area_id: &str,
    require_write: bool,
) -> Result<(MutexGuard<'a, VaultService>, ObjectId, VaultRoot, PathBuf), String> {
    let session_id = parse_id("session_id", raw_session_id)?;
    let area_id = parse_id("area_id", raw_area_id)?;
    let service = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?;
    let root = service
        .session_root(session_id, require_write)
        .map_err(|error| error.to_string())?;
    let area_path = AreaService::folder(&root, area_id).map_err(|error| error.to_string())?;
    Ok((service, session_id, root, area_path))
}

pub(super) fn refresh(service: &mut VaultService, session_id: ObjectId) -> Result<(), String> {
    service
        .refresh_index(session_id)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn parse_id(field: &'static str, value: &str) -> Result<ObjectId, String> {
    ObjectId::parse(field, value).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use std::sync::{mpsc, Arc};
    use std::thread;
    use std::time::Duration;

    use tempfile::TempDir;

    use super::*;
    use crate::application::{CreateAreaRequest, ProjectService};
    use crate::domain::ObjectType;

    #[test]
    fn locked_area_session_serializes_reads_writes_and_close_for_the_full_operation_scope() {
        let directory = TempDir::new().unwrap();
        let mut vaults = VaultService::default();
        let opened = vaults.initialize(directory.path(), None).unwrap();
        let project = ProjectService::create(
            &mut vaults,
            opened.session_id,
            "Lock test".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &vaults,
            opened.session_id,
            CreateAreaRequest {
                project_id: project.id,
                name: "NPCs".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: 80,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap();
        let session_id = opened.session_id.to_string();
        let area_id = area.area.id.to_string();
        let vaults = Arc::new(Mutex::new(vaults));
        let (guard, _, _, _) =
            locked_area_session(vaults.as_ref(), &session_id, &area_id, true).unwrap();

        let (started_tx, started_rx) = mpsc::channel();
        let (acquired_tx, acquired_rx) = mpsc::channel();
        let competing = Arc::clone(&vaults);
        let thread_session = session_id.clone();
        let thread_area = area_id.clone();
        let handle = thread::spawn(move || {
            started_tx.send(()).unwrap();
            let (_guard, _, _, _) =
                locked_area_session(competing.as_ref(), &thread_session, &thread_area, false)
                    .unwrap();
            acquired_tx.send(()).unwrap();
        });

        started_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(acquired_rx
            .recv_timeout(Duration::from_millis(100))
            .is_err());
        drop(guard);
        acquired_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        handle.join().unwrap();
    }
}
