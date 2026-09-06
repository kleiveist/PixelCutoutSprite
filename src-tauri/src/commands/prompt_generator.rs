use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde_json::Value;
use tauri::State;

use crate::application::VaultService;
use crate::domain::{
    PromptHandoff, PromptHandoffReceipt, PromptOutputFormat, PromptWorkspaceFile,
    PromptWorkspaceSnapshot, MAX_PROMPT_OUTPUT_BYTES,
};
use crate::storage::{write_atomic_bytes, write_atomic_json, PromptWorkspaceStorage};

use super::outfit::locked_area_session;

const MAX_IMPORT_BYTES: u64 = 10 * 1024 * 1024;

#[tauri::command]
pub fn read_prompt_workspace(
    storage: State<'_, Mutex<PromptWorkspaceStorage>>,
) -> Result<PromptWorkspaceSnapshot, String> {
    lock_prompt_storage(&storage)?.read_snapshot()
}

#[tauri::command]
pub fn write_prompt_workspace(
    kind: PromptWorkspaceFile,
    value: Value,
    storage: State<'_, Mutex<PromptWorkspaceStorage>>,
) -> Result<(), String> {
    lock_prompt_storage(&storage)?.write(kind, value)
}

#[tauri::command]
pub fn remove_prompt_draft(
    storage: State<'_, Mutex<PromptWorkspaceStorage>>,
) -> Result<(), String> {
    lock_prompt_storage(&storage)?.remove_draft()
}

#[tauri::command]
pub fn read_prompt_package(path: String) -> Result<String, String> {
    let path = validate_user_file_path(&path, "json")?;
    let metadata =
        fs::symlink_metadata(&path).map_err(|error| format!("inspect prompt package: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("prompt package must be a regular JSON file".to_owned());
    }
    if metadata.len() > MAX_IMPORT_BYTES {
        return Err("prompt package exceeds the 10 MiB import limit".to_owned());
    }
    let bytes = fs::read(&path).map_err(|error| format!("read prompt package: {error}"))?;
    serde_json::from_slice::<Value>(&bytes)
        .map_err(|error| format!("prompt package is not valid JSON: {error}"))?;
    String::from_utf8(bytes).map_err(|_| "prompt package must be UTF-8 JSON".to_owned())
}

#[tauri::command]
pub fn save_prompt_output(
    path: String,
    contents: String,
    format: PromptOutputFormat,
) -> Result<(), String> {
    let path = validate_user_file_path(&path, format.extension())?;
    if contents.len() > MAX_PROMPT_OUTPUT_BYTES {
        return Err("prompt output exceeds the 16 MiB export limit".to_owned());
    }
    if format == PromptOutputFormat::Json {
        serde_json::from_str::<Value>(&contents)
            .map_err(|error| format!("prompt JSON output is invalid: {error}"))?;
    }
    write_atomic_bytes(&path, contents.as_bytes(), MAX_PROMPT_OUTPUT_BYTES, |_| {
        Ok(())
    })
}

#[tauri::command]
pub fn handoff_prompt_to_area(
    session_id: String,
    area_id: String,
    handoff: PromptHandoff,
    service: State<'_, Mutex<VaultService>>,
) -> Result<PromptHandoffReceipt, String> {
    store_prompt_handoff(
        &session_id,
        &area_id,
        &handoff,
        &service,
        uuid::Uuid::new_v4(),
    )
}

fn store_prompt_handoff(
    session_id: &str,
    area_id: &str,
    handoff: &PromptHandoff,
    service: &Mutex<VaultService>,
    reference_id: uuid::Uuid,
) -> Result<PromptHandoffReceipt, String> {
    handoff.validate()?;
    let (_service, _, root, area_path) = locked_area_session(service, session_id, area_id, true)?;
    let directory = area_path.join("prompt-references");
    root.ensure_directory(&directory)
        .map_err(|error| error.to_string())?;
    let relative_path = directory.join(format!("prompt--{reference_id}.json"));
    let target = root
        .resolve(&relative_path)
        .map_err(|error| error.to_string())?;
    let value = serde_json::to_value(&handoff)
        .map_err(|error| format!("serialize prompt handoff: {error}"))?;
    write_atomic_json(target.as_path(), &value, MAX_PROMPT_OUTPUT_BYTES)?;
    Ok(PromptHandoffReceipt {
        relative_path: relative_path.to_string_lossy().replace('\\', "/"),
    })
}

fn lock_prompt_storage<'a>(
    storage: &'a State<'_, Mutex<PromptWorkspaceStorage>>,
) -> Result<MutexGuard<'a, PromptWorkspaceStorage>, String> {
    storage
        .lock()
        .map_err(|_| "prompt workspace storage lock is poisoned".to_owned())
}

fn validate_user_file_path(value: &str, extension: &str) -> Result<PathBuf, String> {
    if value.contains('\0') {
        return Err("file path contains a null byte".to_owned());
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err("file path must be absolute and selected explicitly".to_owned());
    }
    if path.extension().and_then(|value| value.to_str()) != Some(extension) {
        return Err(format!("file path must use the .{extension} extension"));
    }
    let parent = path
        .parent()
        .ok_or_else(|| "file path has no parent directory".to_owned())?;
    validate_existing_directory(parent)?;
    Ok(path)
}

fn validate_existing_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("inspect selected directory: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("selected directory must be a real directory".to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::{AreaService, CreateAreaRequest, ProjectService};
    use crate::domain::ObjectType;
    use tempfile::TempDir;

    const REFERENCE_ID: uuid::Uuid = uuid::Uuid::from_u128(0xdddddddd_dddd_4ddd_8ddd_dddddddddddd);

    fn valid_handoff() -> PromptHandoff {
        PromptHandoff {
            schema_version: 1,
            category: "character".to_owned(),
            prompt: "main".to_owned(),
            negative_prompt: "negative".to_owned(),
            technical_prompt: "technical".to_owned(),
            profile_references: vec!["asset_hero".to_owned()],
            created_at: "2026-01-01T00:00:00Z".to_owned(),
        }
    }

    #[test]
    fn output_paths_must_be_absolute_and_match_the_format() {
        assert!(validate_user_file_path("relative/output.json", "json").is_err());
        let directory = TempDir::new().unwrap();
        let wrong = directory.path().join("output.txt");
        assert!(validate_user_file_path(wrong.to_str().unwrap(), "json").is_err());
        let valid = directory.path().join("output.json");
        assert_eq!(
            validate_user_file_path(valid.to_str().unwrap(), "json").unwrap(),
            valid
        );
    }

    #[test]
    fn invalid_handoffs_are_rejected_before_vault_access() {
        let handoff = PromptHandoff {
            schema_version: 99,
            ..valid_handoff()
        };
        assert!(handoff.validate().is_err());
    }

    #[test]
    fn handoff_writes_a_versioned_reference_inside_the_selected_area() {
        let directory = TempDir::new().unwrap();
        let mut vaults = VaultService::default();
        let opened = vaults.initialize(directory.path(), None).unwrap();
        let project = ProjectService::create(
            &mut vaults,
            opened.session_id,
            "Prompt project".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &vaults,
            opened.session_id,
            CreateAreaRequest {
                project_id: project.id,
                name: "Prompt area".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: 80,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap();
        let root = vaults.session_root(opened.session_id, true).unwrap();
        let area_path = AreaService::folder(&root, area.area.id).unwrap();
        let vaults = Mutex::new(vaults);

        let receipt = store_prompt_handoff(
            &opened.session_id.to_string(),
            &area.area.id.to_string(),
            &valid_handoff(),
            &vaults,
            REFERENCE_ID,
        )
        .unwrap();

        let expected = area_path.join(format!("prompt-references/prompt--{REFERENCE_ID}.json"));
        assert_eq!(
            receipt.relative_path,
            expected.to_string_lossy().replace('\\', "/")
        );
        let stored: PromptHandoff =
            serde_json::from_slice(&fs::read(root.resolve(&expected).unwrap().as_path()).unwrap())
                .unwrap();
        assert_eq!(stored, valid_handoff());
    }

    #[test]
    fn handoff_refuses_a_read_only_session_without_touching_the_area() {
        let directory = TempDir::new().unwrap();
        let mut writer = VaultService::default();
        let opened = writer.initialize(directory.path(), None).unwrap();
        let project = ProjectService::create(
            &mut writer,
            opened.session_id,
            "Prompt project".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &writer,
            opened.session_id,
            CreateAreaRequest {
                project_id: project.id,
                name: "Prompt area".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: 80,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap();
        let writer_root = writer.session_root(opened.session_id, true).unwrap();
        let area_path = AreaService::folder(&writer_root, area.area.id).unwrap();
        let mut reader = VaultService::default();
        let read_only = reader.open(directory.path()).unwrap();
        let reader = Mutex::new(reader);

        let result = store_prompt_handoff(
            &read_only.session_id.to_string(),
            &area.area.id.to_string(),
            &valid_handoff(),
            &reader,
            REFERENCE_ID,
        );

        assert!(result.unwrap_err().contains("read-only"));
        assert!(!writer_root
            .resolve(&area_path.join("prompt-references"))
            .unwrap()
            .as_path()
            .exists());
    }

    #[test]
    fn rejects_corrupt_import_packages() {
        let directory = TempDir::new().unwrap();
        let package = directory.path().join("broken.json");
        fs::write(&package, b"not json").unwrap();

        assert!(read_prompt_package(package.to_string_lossy().into_owned()).is_err());
    }

    #[test]
    fn saves_valid_json_and_rejects_invalid_json() {
        let directory = TempDir::new().unwrap();
        let valid = directory.path().join("prompt.json");
        save_prompt_output(
            valid.to_string_lossy().into_owned(),
            "{\"schemaVersion\":1}".to_owned(),
            PromptOutputFormat::Json,
        )
        .unwrap();
        assert_eq!(fs::read_to_string(valid).unwrap(), "{\"schemaVersion\":1}");

        let invalid = directory.path().join("invalid.json");
        assert!(save_prompt_output(
            invalid.to_string_lossy().into_owned(),
            "not json".to_owned(),
            PromptOutputFormat::Json,
        )
        .is_err());
        assert!(!invalid.exists());
    }
}
