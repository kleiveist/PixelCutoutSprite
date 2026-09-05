use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Utc;
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::ObjectId;

use super::{ResolvedPath, StorageError};

const LOCK_SCHEMA_VERSION: u32 = 1;
const MAX_LOCK_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LockOwner {
    pub schema_version: u32,
    pub instance_id: ObjectId,
    pub writer_token: ObjectId,
    pub process_id: u32,
    pub acquired_at: String,
    pub heartbeat_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LockRecovery {
    pub owner: Option<LockOwner>,
    pub damaged: bool,
    pub confirmation_token: String,
}

/// A process lifetime writer lease. The JSON file is diagnostic state; exclusivity comes from an
/// OS lock on a persistent sibling guard file. Keeping the guard file separate lets us remove the
/// diagnostic file while the OS lock is still held on Windows as well as Unix.
#[derive(Debug)]
pub struct VaultLock {
    path: ResolvedPath,
    guard_path: PathBuf,
    guard: Mutex<Option<File>>,
    owner: Mutex<LockOwner>,
}

impl VaultLock {
    pub fn acquire(path: ResolvedPath, instance_id: ObjectId) -> Result<Self, StorageError> {
        let guard_path = guard_path(&path)?;
        reject_non_regular_guard(&guard_path)?;
        let guard = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&guard_path)
            .map_err(|error| StorageError::io("open vault writer guard", path.relative(), error))?;
        match FileExt::try_lock_exclusive(&guard) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                let existing = read_snapshot(&path)
                    .ok()
                    .flatten()
                    .and_then(|snapshot| snapshot.owner)
                    .map_or_else(
                        || "unknown or damaged lock".to_owned(),
                        |owner| owner.instance_id.to_string(),
                    );
                return Err(StorageError::AlreadyLocked { owner: existing });
            }
            Err(error) => {
                return Err(StorageError::io(
                    "lock vault writer guard",
                    path.relative(),
                    error,
                ));
            }
        }

        if let Some(snapshot) = read_snapshot(&path)? {
            let _ = FileExt::unlock(&guard);
            return Err(StorageError::LockRecoveryRequired {
                token: snapshot.confirmation_token,
            });
        }

        let now = now();
        let owner = LockOwner {
            schema_version: LOCK_SCHEMA_VERSION,
            instance_id,
            writer_token: ObjectId::new(),
            process_id: std::process::id(),
            acquired_at: now.clone(),
            heartbeat_at: now,
        };
        if let Err(error) = write_owner(&path, &owner, true) {
            let _ = FileExt::unlock(&guard);
            return Err(error);
        }
        Ok(Self {
            path,
            guard_path,
            guard: Mutex::new(Some(guard)),
            owner: Mutex::new(owner),
        })
    }

    pub fn owner(&self) -> LockOwner {
        self.owner
            .lock()
            .expect("vault-lock owner mutex should not be poisoned")
            .clone()
    }

    pub fn heartbeat(&self) -> Result<(), StorageError> {
        let guard = self
            .guard
            .lock()
            .map_err(|_| StorageError::InvalidVault("writer guard is poisoned".to_owned()))?;
        if guard.is_none() {
            return Err(StorageError::ActiveLockProtected);
        }
        let mut owner = self
            .owner
            .lock()
            .map_err(|_| StorageError::InvalidVault("writer owner is poisoned".to_owned()))?;
        let current = read_snapshot(&self.path)?
            .and_then(|snapshot| snapshot.owner)
            .ok_or_else(|| {
                StorageError::RecoveryRequired(
                    "writer metadata disappeared or became damaged while its lease was active"
                        .to_owned(),
                )
            })?;
        if current.instance_id != owner.instance_id || current.writer_token != owner.writer_token {
            return Err(StorageError::ActiveLockProtected);
        }
        owner.heartbeat_at = now();
        write_owner(&self.path, &owner, false)
    }

    /// Returns recovery metadata only when the OS lock can be obtained. An actively held lock is
    /// deliberately indistinguishable from "not recoverable" and is never offered for takeover.
    pub fn inspect_recovery(path: &ResolvedPath) -> Result<Option<LockRecovery>, StorageError> {
        let guard_path = guard_path(path)?;
        reject_non_regular_guard(&guard_path)?;
        if !guard_path.exists() {
            return read_snapshot(path).map(|snapshot| {
                snapshot.map(|snapshot| LockRecovery {
                    owner: snapshot.owner,
                    damaged: snapshot.damaged,
                    confirmation_token: snapshot.confirmation_token,
                })
            });
        }
        let guard = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&guard_path)
            .map_err(|error| StorageError::io("open vault writer guard", path.relative(), error))?;
        match FileExt::try_lock_exclusive(&guard) {
            Ok(()) => {
                let snapshot = read_snapshot(path)?;
                FileExt::unlock(&guard).map_err(|error| {
                    StorageError::io("unlock vault writer guard", path.relative(), error)
                })?;
                Ok(snapshot.map(|snapshot| LockRecovery {
                    owner: snapshot.owner,
                    damaged: snapshot.damaged,
                    confirmation_token: snapshot.confirmation_token,
                }))
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(None),
            Err(error) => Err(StorageError::io(
                "inspect vault writer guard",
                path.relative(),
                error,
            )),
        }
    }

    pub fn writer_present(path: &ResolvedPath) -> Result<bool, StorageError> {
        if read_snapshot(path)?.is_some() {
            return Ok(true);
        }
        let guard_path = guard_path(path)?;
        reject_non_regular_guard(&guard_path)?;
        if !guard_path.exists() {
            return Ok(false);
        }
        let guard = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&guard_path)
            .map_err(|error| StorageError::io("open vault writer guard", path.relative(), error))?;
        match FileExt::try_lock_exclusive(&guard) {
            Ok(()) => {
                FileExt::unlock(&guard).map_err(|error| {
                    StorageError::io("unlock vault writer guard", path.relative(), error)
                })?;
                Ok(false)
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(true),
            Err(error) => Err(StorageError::io(
                "inspect vault writer guard",
                path.relative(),
                error,
            )),
        }
    }

    pub fn recover_orphan(
        path: &ResolvedPath,
        confirmation_token: &str,
    ) -> Result<(), StorageError> {
        let guard_path = guard_path(path)?;
        reject_non_regular_guard(&guard_path)?;
        let guard = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&guard_path)
            .map_err(|error| StorageError::io("open vault writer guard", path.relative(), error))?;
        match FileExt::try_lock_exclusive(&guard) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                return Err(StorageError::ActiveLockProtected);
            }
            Err(error) => {
                return Err(StorageError::io(
                    "lock vault writer guard for recovery",
                    path.relative(),
                    error,
                ));
            }
        }
        let Some(snapshot) = read_snapshot(path)? else {
            let _ = FileExt::unlock(&guard);
            return Ok(());
        };
        if snapshot.confirmation_token != confirmation_token {
            let _ = FileExt::unlock(&guard);
            return Err(StorageError::LockRecoveryRequired {
                token: snapshot.confirmation_token,
            });
        }
        remove_metadata(path)?;
        FileExt::unlock(&guard).map_err(|error| {
            StorageError::io(
                "unlock recovered vault writer guard",
                path.relative(),
                error,
            )
        })
    }

    pub fn guard_path(&self) -> &PathBuf {
        &self.guard_path
    }
}

impl Drop for VaultLock {
    fn drop(&mut self) {
        let Ok(mut guard_slot) = self.guard.lock() else {
            return;
        };
        let Some(guard) = guard_slot.take() else {
            return;
        };
        let owner = self.owner.get_mut().ok().map(|owner| owner.clone());
        let still_owns_metadata = owner.is_some_and(|expected| {
            read_snapshot(&self.path)
                .ok()
                .flatten()
                .and_then(|snapshot| snapshot.owner)
                .is_some_and(|actual| {
                    actual.instance_id == expected.instance_id
                        && actual.writer_token == expected.writer_token
                })
        });
        if still_owns_metadata {
            let _ = remove_metadata(&self.path);
        }
        let _ = FileExt::unlock(&guard);
    }
}

#[derive(Debug)]
struct LockSnapshot {
    owner: Option<LockOwner>,
    damaged: bool,
    confirmation_token: String,
}

fn read_snapshot(path: &ResolvedPath) -> Result<Option<LockSnapshot>, StorageError> {
    let metadata = match fs::symlink_metadata(path.as_path()) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(StorageError::io(
                "inspect vault writer metadata",
                path.relative(),
                error,
            ));
        }
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(StorageError::UnsafePath {
            path: path.relative().to_string_lossy().into_owned(),
            reason: "writer metadata must be a regular file".to_owned(),
        });
    }
    if metadata.len() > MAX_LOCK_BYTES {
        return Err(StorageError::InvalidVault(
            "writer metadata exceeds the supported size".to_owned(),
        ));
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    File::open(path.as_path())
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .map_err(|error| StorageError::io("read vault writer metadata", path.relative(), error))?;
    let owner = serde_json::from_slice::<LockOwner>(&bytes)
        .ok()
        .filter(valid_owner);
    let confirmation_token = confirmation_token(path, &bytes);
    Ok(Some(LockSnapshot {
        damaged: owner.is_none(),
        owner,
        confirmation_token,
    }))
}

fn valid_owner(owner: &LockOwner) -> bool {
    owner.schema_version == LOCK_SCHEMA_VERSION
        && chrono::DateTime::parse_from_rfc3339(&owner.acquired_at).is_ok()
        && chrono::DateTime::parse_from_rfc3339(&owner.heartbeat_at).is_ok()
}

fn write_owner(
    path: &ResolvedPath,
    owner: &LockOwner,
    allow_create: bool,
) -> Result<(), StorageError> {
    if let Ok(metadata) = fs::symlink_metadata(path.as_path()) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(StorageError::UnsafePath {
                path: path.relative().to_string_lossy().into_owned(),
                reason: "writer metadata must be a regular file".to_owned(),
            });
        }
    }
    let bytes = serde_json::to_vec_pretty(owner)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    let mut options = OpenOptions::new();
    options.read(true).write(true).truncate(true);
    if allow_create {
        options.create(true);
    }
    let mut file = options
        .open(path.as_path())
        .map_err(|error| StorageError::io("write vault writer metadata", path.relative(), error))?;
    file.seek(SeekFrom::Start(0))
        .and_then(|_| file.write_all(&bytes))
        .and_then(|_| file.sync_all())
        .map_err(|error| StorageError::io("sync vault writer metadata", path.relative(), error))
}

fn remove_metadata(path: &ResolvedPath) -> Result<(), StorageError> {
    match fs::remove_file(path.as_path()) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StorageError::io(
            "remove vault writer metadata",
            path.relative(),
            error,
        )),
    }
}

fn guard_path(path: &ResolvedPath) -> Result<PathBuf, StorageError> {
    let file_name = path
        .as_path()
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| StorageError::UnsafePath {
            path: path.relative().to_string_lossy().into_owned(),
            reason: "writer metadata needs a UTF-8 filename".to_owned(),
        })?;
    Ok(path
        .as_path()
        .with_file_name(format!("{file_name}.os-lock")))
}

fn reject_non_regular_guard(path: &PathBuf) -> Result<(), StorageError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err(StorageError::UnsafePath {
                path: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                reason: "writer OS guard must be a regular file".to_owned(),
            })
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StorageError::io("inspect vault writer guard", path, error)),
    }
}

fn confirmation_token(path: &ResolvedPath, bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(b"pixel-cutout-sprite/orphan-lock/v1\0");
    digest.update(path.as_path().as_os_str().as_encoded_bytes());
    digest.update([0]);
    digest.update(bytes);
    format!("{:x}", digest.finalize())
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}
