use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde_json::Value;

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

#[cfg(test)]
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

#[cfg(test)]
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
#[path = "atomic_file_tests.rs"]
mod tests;
