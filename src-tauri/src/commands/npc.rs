use std::sync::Mutex;

use tauri::State;

use crate::application::{
    AddBindingRequest, AdoptBindingRevisionRequest, BindingService, DuplicateNpcRequest,
    DuplicatedNpc, ExportJobRegistry, NpcWorkspaceContext, RenameNpcRequest, RenamedNpc,
    ReviewBindingRequest, SetCharacterStatusRequest, UpdateBindingOverridesRequest, VaultService,
};
use crate::domain::{AnimationBinding, Character};

use super::outfit::{locked_area_session, refresh};

#[tauri::command]
pub fn inspect_npc_workspace(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<NpcWorkspaceContext, String> {
    let (_service, _, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, false)?;
    BindingService
        .workspace_context(&root, &area_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_npc_binding(
    session_id: String,
    area_id: String,
    request: AddBindingRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AnimationBinding, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .add_binding(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn update_npc_binding_overrides(
    session_id: String,
    area_id: String,
    request: UpdateBindingOverridesRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AnimationBinding, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .update_local_overrides(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn adopt_npc_binding_revision(
    session_id: String,
    area_id: String,
    request: AdoptBindingRevisionRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AnimationBinding, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .adopt_revision(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn review_npc_binding(
    session_id: String,
    area_id: String,
    request: ReviewBindingRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<AnimationBinding, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .review_binding(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn set_npc_status(
    session_id: String,
    area_id: String,
    request: SetCharacterStatusRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Character, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .set_character_status(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn duplicate_npc(
    session_id: String,
    area_id: String,
    request: DuplicateNpcRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<DuplicatedNpc, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    let result = BindingService
        .duplicate_npc(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}

#[tauri::command]
pub fn rename_npc(
    session_id: String,
    area_id: String,
    request: RenameNpcRequest,
    service: State<'_, Mutex<VaultService>>,
    jobs: State<'_, ExportJobRegistry>,
) -> Result<RenamedNpc, String> {
    let (mut service, session_id, root, area_path) =
        locked_area_session(&service, &session_id, &area_id, true)?;
    if jobs
        .has_active_character(session_id, request.character_id)
        .map_err(|error| error.to_string())?
    {
        return Err("cancel the active export before renaming this NPC".to_owned());
    }
    let result = BindingService
        .rename_npc(&root, &area_path, request)
        .map_err(|error| error.to_string())?;
    refresh(&mut service, session_id)?;
    Ok(result)
}
