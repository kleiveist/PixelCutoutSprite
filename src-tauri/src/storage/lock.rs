use std::fs::{self, OpenOptions};
use std::io::Write;

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::domain::ObjectId;

use super::{ResolvedPath, StorageError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LockOwner {
    pub schema_version: u32,
    pub instance_id: ObjectId,
    pub process_id: u32,
    pub acquired_at: String,
    pub heartbeat_at: String,
}

#[derive(Debug)]
pub struct VaultLock {
    path: ResolvedPath,
    owner: LockOwner,
}

impl VaultLock {
    pub fn acquire(path: ResolvedPath, instance_id: ObjectId) -> Result<Self, StorageError> {
        let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let owner = LockOwner {
            schema_version: 1,
            instance_id,
            process_id: std::process::id(),
            acquired_at: now.clone(),
            heartbeat_at: now,
        };
        let bytes = serde_json::to_vec_pretty(&owner)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let mut options = OpenOptions::new();
        options.create_new(true).write(true);
        match options.open(path.as_path()) {
            Ok(mut file) => {
                file.write_all(&bytes).map_err(|error| {
                    StorageError::io("write vault lock", path.relative(), error)
                })?;
                file.sync_all()
                    .map_err(|error| StorageError::io("sync vault lock", path.relative(), error))?;
                Ok(Self { path, owner })
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let existing = read_owner(&path).map_or_else(
                    |_| "unknown or damaged lock".to_owned(),
                    |value| value.instance_id.to_string(),
                );
                Err(StorageError::AlreadyLocked { owner: existing })
            }
            Err(error) => Err(StorageError::io(
                "create vault lock",
                path.relative(),
                error,
            )),
        }
    }

    pub fn owner(&self) -> &LockOwner {
        &self.owner
    }

    pub fn heartbeat(&mut self) -> Result<(), StorageError> {
        self.owner.heartbeat_at = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let current = read_owner(&self.path)?;
        if current.instance_id != self.owner.instance_id {
            return Err(StorageError::AlreadyLocked {
                owner: current.instance_id.to_string(),
            });
        }
        let bytes = serde_json::to_vec_pretty(&self.owner)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        fs::write(self.path.as_path(), bytes)
            .map_err(|error| StorageError::io("update vault lock", self.path.relative(), error))
    }
}

impl Drop for VaultLock {
    fn drop(&mut self) {
        let owns_file =
            read_owner(&self.path).is_ok_and(|owner| owner.instance_id == self.owner.instance_id);
        if owns_file {
            let _ = fs::remove_file(self.path.as_path());
        }
    }
}

fn read_owner(path: &ResolvedPath) -> Result<LockOwner, StorageError> {
    let bytes = fs::read(path.as_path())
        .map_err(|error| StorageError::io("read vault lock", path.relative(), error))?;
    serde_json::from_slice(&bytes).map_err(|error| StorageError::InvalidVault(error.to_string()))
}
