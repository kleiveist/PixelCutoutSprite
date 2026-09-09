use std::sync::Mutex;

use serde_json::Value;
use tauri::State;

use crate::application::VaultService;
use crate::domain::ObjectId;
use crate::prompt_vault::{
    GeneratedOutputWrite, PromptVaultIndex, PromptVaultMigrationBundle, PromptVaultRepository,
};
use crate::workspace::WriteReceipt;

#[tauri::command]
pub fn scan_prompt_vault(
    session_id: String,
    session_generation: u64,
    service: State<'_, Mutex<VaultService>>,
) -> Result<PromptVaultIndex, String> {
    let session_id = parse_id(&session_id)?;
    let root = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .session_root_at_generation(session_id, session_generation, false)
        .map_err(|error| error.to_string())?;
    PromptVaultRepository::new(root)
        .scan()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_vault_base_profile(
    session_id: String,
    session_generation: u64,
    value: Value,
    expected_sha256: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<WriteReceipt, String> {
    repository(&service, &session_id, session_generation, true)?
        .save_base_profile(value, expected_sha256)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_prompt_vault_draft(
    session_id: String,
    session_generation: u64,
    value: Value,
    expected_sha256: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<WriteReceipt, String> {
    repository(&service, &session_id, session_generation, true)?
        .save_draft(value, expected_sha256)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_prompt_vault_profile(
    session_id: String,
    session_generation: u64,
    profile: Value,
    expected_sha256: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<WriteReceipt, String> {
    repository(&service, &session_id, session_generation, true)?
        .save_profile_without_outputs(profile, expected_sha256)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_prompt_vault_generation(
    session_id: String,
    session_generation: u64,
    profile: Value,
    outputs: Vec<GeneratedOutputWrite>,
    expected_profile_sha256: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Vec<WriteReceipt>, String> {
    repository(&service, &session_id, session_generation, true)?
        .save_profile_generation(profile, outputs, expected_profile_sha256)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_prompt_vault_draft(
    session_id: String,
    session_generation: u64,
    draft_id: String,
    expected_sha256: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    repository(&service, &session_id, session_generation, true)?
        .remove_draft(&draft_id, &expected_sha256)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn apply_prompt_vault_migration(
    session_id: String,
    session_generation: u64,
    bundle: PromptVaultMigrationBundle,
    service: State<'_, Mutex<VaultService>>,
) -> Result<Vec<WriteReceipt>, String> {
    repository(&service, &session_id, session_generation, true)?
        .apply_migration(bundle)
        .map_err(|error| error.to_string())
}

fn repository(
    service: &State<'_, Mutex<VaultService>>,
    session_id: &str,
    generation: u64,
    require_write: bool,
) -> Result<PromptVaultRepository, String> {
    let session_id = parse_id(session_id)?;
    let root = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?
        .session_root_at_generation(session_id, generation, require_write)
        .map_err(|error| error.to_string())?;
    Ok(PromptVaultRepository::new(root))
}

fn parse_id(value: &str) -> Result<ObjectId, String> {
    ObjectId::parse("session_id", value).map_err(|error| error.to_string())
}
