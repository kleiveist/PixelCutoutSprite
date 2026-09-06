use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde_json::Value;

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

pub fn write_atomic_json(path: &Path, value: &Value, maximum_bytes: usize) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("serialize JSON output: {error}"))?;
    write_atomic_bytes(path, &bytes, maximum_bytes, |candidate| {
        serde_json::from_slice::<Value>(candidate)
            .map(|_| ())
            .map_err(|error| format!("validate staged JSON output: {error}"))
    })
}

pub fn write_atomic_bytes<F>(
    path: &Path,
    bytes: &[u8],
    maximum_bytes: usize,
    validate: F,
) -> Result<(), String>
where
    F: Fn(&[u8]) -> Result<(), String>,
{
    if bytes.len() > maximum_bytes {
        return Err(format!("output exceeds the {maximum_bytes}-byte limit"));
    }
    let parent = path
        .parent()
        .ok_or_else(|| "output path has no parent directory".to_owned())?;
    let parent_metadata = fs::symlink_metadata(parent)
        .map_err(|error| format!("inspect output directory: {error}"))?;
    if parent_metadata.file_type().is_symlink() || !parent_metadata.is_dir() {
        return Err("output directory must be a real directory".to_owned());
    }
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("output target must be a regular file".to_owned());
        }
    }

    validate(bytes)?;
    let pending = pending_path(path);
    reject_non_regular_if_present(&pending)?;
    let mut staged = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&pending)
        .map_err(|error| format!("create staged output: {error}"))?;
    staged
        .write_all(bytes)
        .map_err(|error| format!("write staged output: {error}"))?;
    staged
        .sync_all()
        .map_err(|error| format!("sync staged output: {error}"))?;
    drop(staged);
    let verified = fs::read(&pending).map_err(|error| format!("verify staged output: {error}"))?;
    validate(&verified)?;

    if let Err(error) = fs::rename(&pending, path) {
        if !path.exists() {
            return Err(format!("publish staged output: {error}"));
        }
        let previous = previous_path(path);
        reject_non_regular_if_present(&previous)?;
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|remove_error| format!("remove stale output backup: {remove_error}"))?;
        }
        fs::rename(path, &previous)
            .map_err(|move_error| format!("stage previous output: {move_error}"))?;
        if let Err(publish_error) = fs::rename(&pending, path) {
            let _ = fs::rename(&previous, path);
            return Err(format!("publish staged output: {publish_error}"));
        }
        fs::remove_file(&previous)
            .map_err(|remove_error| format!("remove replaced output backup: {remove_error}"))?;
    }
    sync_parent(path);
    Ok(())
}

fn recover_interrupted_write<F>(
    path: &Path,
    maximum_bytes: usize,
    validate: F,
) -> Result<(), String>
where
    F: Fn(&[u8]) -> Result<Option<Value>, String>,
{
    let pending = pending_path(path);
    let previous = previous_path(path);
    reject_non_regular_if_present(path)?;
    reject_non_regular_if_present(&pending)?;
    reject_non_regular_if_present(&previous)?;

    if path.exists() {
        if pending.exists() {
            fs::remove_file(&pending)
                .map_err(|error| format!("remove stale staged prompt data: {error}"))?;
        }
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|error| format!("remove stale prompt backup: {error}"))?;
        }
        return Ok(());
    }

    if pending.exists() {
        let staged = (|| {
            let metadata = fs::metadata(&pending)
                .map_err(|error| format!("inspect staged prompt data: {error}"))?;
            if metadata.len() > maximum_bytes as u64 {
                return Err("staged prompt data exceeds its size limit".to_owned());
            }
            let bytes =
                fs::read(&pending).map_err(|error| format!("read staged prompt data: {error}"))?;
            validate(&bytes)
        })();
        if let Err(staged_error) = staged {
            if previous.exists() {
                fs::remove_file(&pending)
                    .map_err(|error| format!("remove invalid staged prompt data: {error}"))?;
                validate_recovery_file(&previous, maximum_bytes, &validate)?;
                fs::rename(&previous, path)
                    .map_err(|error| format!("restore previous prompt data: {error}"))?;
                sync_parent(path);
                return Ok(());
            }
            return Err(staged_error);
        }
        fs::rename(&pending, path)
            .map_err(|error| format!("recover staged prompt data: {error}"))?;
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|error| format!("remove recovered prompt backup: {error}"))?;
        }
        sync_parent(path);
        return Ok(());
    }

    if previous.exists() {
        validate_recovery_file(&previous, maximum_bytes, &validate)?;
        fs::rename(&previous, path)
            .map_err(|error| format!("restore previous prompt data: {error}"))?;
        sync_parent(path);
    }
    Ok(())
}

fn validate_recovery_file<F>(path: &Path, maximum_bytes: usize, validate: &F) -> Result<(), String>
where
    F: Fn(&[u8]) -> Result<Option<Value>, String>,
{
    let metadata =
        fs::metadata(path).map_err(|error| format!("inspect prompt recovery data: {error}"))?;
    if metadata.len() > maximum_bytes as u64 {
        return Err("prompt recovery data exceeds its size limit".to_owned());
    }
    let bytes = fs::read(path).map_err(|error| format!("read prompt recovery data: {error}"))?;
    validate(&bytes).map(|_| ())
}

fn reject_non_regular_if_present(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err(format!("unsafe prompt storage path `{}`", path.display()))
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("inspect prompt storage path: {error}")),
    }
}

fn sibling_path(path: &Path, suffix: &str) -> PathBuf {
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("prompt.json");
    path.with_file_name(format!(".{filename}.{suffix}"))
}

fn pending_path(path: &Path) -> PathBuf {
    sibling_path(path, "pending")
}

fn previous_path(path: &Path) -> PathBuf {
    sibling_path(path, "previous")
}

fn sync_parent(path: &Path) {
    if let Some(parent) = path.parent() {
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
        let mut storage =
            PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
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
        let mut storage =
            PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
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
        let mut storage =
            PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
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
        let mut storage =
            PromptWorkspaceStorage::open(directory.path().join("prompt-studio")).unwrap();
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
}
