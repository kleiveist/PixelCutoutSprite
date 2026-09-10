use super::*;
use crate::domain::{PromptWorkspaceFile, PromptWorkspaceSnapshot};

#[derive(Debug)]
pub struct PromptWorkspaceStorage {
    root: PathBuf,
}

impl PromptWorkspaceStorage {
    pub fn open(root: PathBuf) -> Result<Self, String> {
        if let Ok(metadata) = fs::symlink_metadata(&root) {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err("prompt-studio app-data path must be a real directory".to_owned());
            }
        } else {
            fs::create_dir_all(&root)
                .map_err(|error| format!("create prompt-studio app-data directory: {error}"))?;
        }
        let root = root
            .canonicalize()
            .map_err(|error| format!("canonicalize prompt-studio app-data directory: {error}"))?;
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn read_snapshot(&mut self) -> Result<PromptWorkspaceSnapshot, String> {
        Ok(PromptWorkspaceSnapshot {
            settings: self.read(PromptWorkspaceFile::Settings)?,
            profiles: self.read(PromptWorkspaceFile::Profiles)?,
            draft: self.read(PromptWorkspaceFile::Draft)?,
            migration_backup: self.read(PromptWorkspaceFile::MigrationBackup)?,
        })
    }

    pub fn read(&mut self, kind: PromptWorkspaceFile) -> Result<Option<Value>, String> {
        let path = self.root.join(kind.filename());
        recover_interrupted_write(&path, kind.maximum_bytes(), |bytes| {
            validate_workspace_bytes(kind, bytes)
        })?;
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("inspect {}: {error}", kind.filename())),
        };
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(format!("{} must be a regular file", kind.filename()));
        }
        if metadata.len() > kind.maximum_bytes() as u64 {
            return Err(format!("{} exceeds its size limit", kind.filename()));
        }
        let bytes =
            fs::read(&path).map_err(|error| format!("read {}: {error}", kind.filename()))?;
        validate_workspace_bytes(kind, &bytes)
    }

    pub fn write(&mut self, kind: PromptWorkspaceFile, value: Value) -> Result<(), String> {
        kind.validate(&value)?;
        let bytes = serde_json::to_vec_pretty(&value)
            .map_err(|error| format!("serialize {}: {error}", kind.filename()))?;
        write_atomic_bytes(
            &self.root.join(kind.filename()),
            &bytes,
            kind.maximum_bytes(),
            |candidate| validate_workspace_bytes(kind, candidate).map(|_| ()),
        )
    }

    pub fn remove_draft(&mut self) -> Result<(), String> {
        let path = self.root.join(PromptWorkspaceFile::Draft.filename());
        for candidate in [&path, &pending_path(&path), &previous_path(&path)] {
            match fs::symlink_metadata(candidate) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                    return Err("draft storage target is not a regular file".to_owned());
                }
                Ok(_) => fs::remove_file(candidate)
                    .map_err(|error| format!("remove prompt draft: {error}"))?,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("inspect prompt draft: {error}")),
            }
        }
        sync_parent(&path);
        Ok(())
    }
}

fn validate_workspace_bytes(
    kind: PromptWorkspaceFile,
    bytes: &[u8],
) -> Result<Option<Value>, String> {
    if bytes.len() > kind.maximum_bytes() {
        return Err(format!("{} exceeds its size limit", kind.filename()));
    }
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|error| format!("parse {}: {error}", kind.filename()))?;
    kind.validate(&value)?;
    Ok(Some(value))
}

use serde_json::json;
use tempfile::TempDir;

#[test]
fn writes_and_reads_each_workspace_namespace() {
    let directory = TempDir::new().unwrap();
    let root = directory.path().join("prompt-studio");
    let mut storage = PromptWorkspaceStorage::open(root.clone()).unwrap();
    storage
        .write(
            PromptWorkspaceFile::Settings,
            json!({"schemaVersion": 2, "kind": "appSettings"}),
        )
        .unwrap();
    storage
        .write(
            PromptWorkspaceFile::Profiles,
            json!({"baseProfiles": [], "categoryProfiles": [], "assetProfiles": []}),
        )
        .unwrap();
    storage
        .write(
            PromptWorkspaceFile::Draft,
            json!({"schemaVersion": 2, "kind": "wizardDraft"}),
        )
        .unwrap();

    drop(storage);
    let mut storage = PromptWorkspaceStorage::open(root).unwrap();

    let snapshot = storage.read_snapshot().unwrap();
    assert_eq!(snapshot.settings.unwrap()["kind"], "appSettings");
    assert_eq!(snapshot.profiles.unwrap()["assetProfiles"], json!([]));
    assert_eq!(snapshot.draft.unwrap()["kind"], "wizardDraft");
    assert!(snapshot.migration_backup.is_none());
}

#[test]
fn rejects_oversized_or_invalid_workspace_data_without_replacing_the_last_valid_file() {
    let directory = TempDir::new().unwrap();
    let mut storage = PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
    let original = json!({"schemaVersion": 2, "kind": "appSettings"});
    storage
        .write(PromptWorkspaceFile::Settings, original.clone())
        .unwrap();

    assert!(storage
        .write(
            PromptWorkspaceFile::Settings,
            json!({"schemaVersion": 99, "kind": "appSettings"}),
        )
        .is_err());
    assert!(storage
        .write(
            PromptWorkspaceFile::Settings,
            json!({
                "schemaVersion": 2,
                "kind": "appSettings",
                "oversized": "x".repeat(PromptWorkspaceFile::Settings.maximum_bytes()),
            }),
        )
        .is_err());

    assert_eq!(
        storage.read(PromptWorkspaceFile::Settings).unwrap(),
        Some(original)
    );
}

#[test]
fn keeps_the_previous_file_when_staged_json_is_invalid() {
    let directory = TempDir::new().unwrap();
    let path = directory.path().join("settings.json");
    write_atomic_json(&path, &json!({"value": 1}), 1024).unwrap();
    let result = write_atomic_bytes(&path, b"not json", 1024, |candidate| {
        serde_json::from_slice::<Value>(candidate)
            .map(|_| ())
            .map_err(|error| error.to_string())
    });
    assert!(result.is_err());
    assert_eq!(
        serde_json::from_slice::<Value>(&fs::read(path).unwrap()).unwrap()["value"],
        1
    );
}

#[test]
fn recovers_a_valid_pending_workspace_file() {
    let directory = TempDir::new().unwrap();
    let mut storage = PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
    let target = storage.root().join("draft.json");
    let pending = pending_path(&target);
    fs::write(&pending, br#"{"schemaVersion":2,"kind":"wizardDraft"}"#).unwrap();
    let draft = storage.read(PromptWorkspaceFile::Draft).unwrap().unwrap();
    assert_eq!(draft["kind"], "wizardDraft");
    assert!(target.exists());
    assert!(!pending.exists());
}

#[test]
fn restores_a_valid_previous_file_when_pending_data_is_corrupt() {
    let directory = TempDir::new().unwrap();
    let mut storage = PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
    let target = storage.root().join("draft.json");
    fs::write(pending_path(&target), b"not json").unwrap();
    fs::write(
        previous_path(&target),
        br#"{"schemaVersion":2,"kind":"wizardDraft"}"#,
    )
    .unwrap();

    let draft = storage.read(PromptWorkspaceFile::Draft).unwrap().unwrap();

    assert_eq!(draft["kind"], "wizardDraft");
    assert!(target.exists());
    assert!(!pending_path(&target).exists());
    assert!(!previous_path(&target).exists());
}

#[test]
fn removes_draft_and_interrupted_write_artifacts() {
    let directory = TempDir::new().unwrap();
    let mut storage = PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
    let target = storage.root().join("draft.json");
    for path in [&target, &pending_path(&target), &previous_path(&target)] {
        fs::write(path, br#"{"schemaVersion":2,"kind":"wizardDraft"}"#).unwrap();
    }

    storage.remove_draft().unwrap();

    assert!(!target.exists());
    assert!(!pending_path(&target).exists());
    assert!(!previous_path(&target).exists());
}

#[cfg(unix)]
#[test]
fn rejects_symlink_targets() {
    use std::os::unix::fs::symlink;

    let directory = TempDir::new().unwrap();
    let outside = directory.path().join("outside.json");
    fs::write(&outside, "{}").unwrap();
    let target = directory.path().join("target.json");
    symlink(&outside, &target).unwrap();
    assert!(write_atomic_json(&target, &json!({"value": 1}), 1024).is_err());
}
