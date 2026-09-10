use crate::domain::{PromptWorkspaceFile, PromptWorkspaceSnapshot};
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};

#[tauri::command]
pub fn read_legacy_prompt_workspace<R: Runtime>(
    app: AppHandle<R>,
) -> Result<PromptWorkspaceSnapshot, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("resolve legacy app-data directory: {error}"))?
        .join("prompt-studio");
    read_legacy_snapshot(&root)
}

// Explicit migration source: never creates, repairs, or writes legacy app-data.
fn read_legacy_snapshot(root: &Path) -> Result<PromptWorkspaceSnapshot, String> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(PromptWorkspaceSnapshot::default())
        }
        Err(error) => return Err(format!("inspect legacy app-data directory: {error}")),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("legacy prompt-studio app-data path must be a real directory".to_owned());
    }
    let read = |kind: PromptWorkspaceFile| -> Result<Option<Value>, String> {
        let path = root.join(kind.filename());
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("inspect legacy {}: {error}", kind.filename())),
        };
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(format!("legacy {} must be a regular file", kind.filename()));
        }
        if metadata.len() > kind.maximum_bytes() as u64 {
            return Err(format!("legacy {} exceeds its size limit", kind.filename()));
        }
        let bytes =
            fs::read(&path).map_err(|error| format!("read legacy {}: {error}", kind.filename()))?;
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|error| format!("parse legacy {}: {error}", kind.filename()))?;
        kind.validate(&value)?;
        Ok(Some(value))
    };
    Ok(PromptWorkspaceSnapshot {
        settings: read(PromptWorkspaceFile::Settings)?,
        profiles: read(PromptWorkspaceFile::Profiles)?,
        draft: read(PromptWorkspaceFile::Draft)?,
        migration_backup: read(PromptWorkspaceFile::MigrationBackup)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    #[test]
    fn legacy_preview_never_creates_repairs_or_deletes_source_files() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("prompt-studio");
        assert_eq!(
            read_legacy_snapshot(&root).unwrap(),
            PromptWorkspaceSnapshot::default()
        );
        assert!(!root.exists());
        fs::create_dir(&root).unwrap();
        let bytes = br#"{"schemaVersion":2,"kind":"wizardDraft"}"#;
        fs::write(root.join("draft.json"), bytes).unwrap();
        fs::write(root.join(".draft.json.pending"), b"must not recover").unwrap();
        fs::write(root.join(".draft.json.previous"), b"must not delete").unwrap();
        assert!(read_legacy_snapshot(&root).unwrap().draft.is_some());
        assert_eq!(fs::read(root.join("draft.json")).unwrap(), bytes);
        assert_eq!(
            fs::read(root.join(".draft.json.pending")).unwrap(),
            b"must not recover"
        );
        assert_eq!(
            fs::read(root.join(".draft.json.previous")).unwrap(),
            b"must not delete"
        );
        fs::write(root.join("settings.json"), b"damaged").unwrap();
        assert!(read_legacy_snapshot(&root).is_err());
        assert_eq!(fs::read(root.join("settings.json")).unwrap(), b"damaged");
    }
    #[test]
    fn legacy_preview_refuses_oversized_and_future_data() {
        let root = TempDir::new().unwrap();
        let path = root.path().join("settings.json");
        for bytes in [
            vec![b' '; PromptWorkspaceFile::Settings.maximum_bytes() + 1],
            br#"{"schemaVersion":99,"kind":"appSettings"}"#.to_vec(),
        ] {
            fs::write(&path, &bytes).unwrap();
            assert!(read_legacy_snapshot(root.path()).is_err());
            assert_eq!(fs::read(&path).unwrap(), bytes);
        }
    }
    #[cfg(unix)]
    #[test]
    fn legacy_preview_refuses_symlinks_without_touching_their_targets() {
        use std::os::unix::fs::symlink;
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("prompt-studio");
        fs::create_dir(&root).unwrap();
        let target = temp.path().join("outside.json");
        fs::write(&target, b"outside").unwrap();
        symlink(&target, root.join("draft.json")).unwrap();
        assert!(read_legacy_snapshot(&root).is_err());
        assert_eq!(fs::read(target).unwrap(), b"outside");
        symlink(&root, temp.path().join("linked")).unwrap();
        assert!(read_legacy_snapshot(&temp.path().join("linked")).is_err());
    }
}
