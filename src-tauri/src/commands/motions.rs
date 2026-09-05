use std::collections::HashSet;
use std::sync::{Mutex, MutexGuard};

use tauri::State;

use crate::application::{
    CreateMotionRequest, MotionCard, MotionDashboard, MotionDraft, MotionEditorData,
    MotionOpenTarget, MotionService, SaveMotionDraftRequest, VaultService,
};
use crate::domain::{Direction, MotionRevision, ObjectId};
use crate::editor::{
    encode_dummy_preview, render_dummy, render_sampled_dummy, DummyPreview, EditablePose,
    SampledDummyPreview,
};

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
pub fn open_motion_editor(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionEditorData, String> {
    let service = lock(&service)?;
    MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn render_motion_dummy(
    session_id: String,
    template_id: String,
    direction: Direction,
    pose: EditablePose,
    service: State<'_, Mutex<VaultService>>,
) -> Result<DummyPreview, String> {
    let service = lock(&service)?;
    let editor = MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())?;
    encode_dummy_preview(
        render_dummy(
            &editor.profile,
            &pose,
            direction,
            editor.draft.frame_size_px,
            editor.draft.ground_origin_px,
        )
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn render_motion_sample(
    session_id: String,
    template_id: String,
    draft: MotionDraft,
    direction: Direction,
    sample_index: u16,
    service: State<'_, Mutex<VaultService>>,
) -> Result<SampledDummyPreview, String> {
    let service = lock(&service)?;
    let editor = MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())?;
    if draft.template_id != editor.draft.template_id
        || draft.revision != editor.draft.revision
        || draft.profile_ref != editor.draft.profile_ref
    {
        return Err(
            "preview draft does not match the currently opened template revision".to_owned(),
        );
    }
    let slots = editor
        .profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    let motion = draft.sampling_revision();
    motion
        .validate(Some(&slots))
        .map_err(|error| error.to_string())?;
    render_sampled_dummy(&editor.profile, &motion, direction, sample_index)
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
