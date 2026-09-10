use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::domain::{DomainError, Vault};
use serde::{de::DeserializeOwned, Serialize};

/// Typed JSON validation without a registry of retired application models.
pub trait StoredJson: Serialize + DeserializeOwned {
    fn validate(&self) -> Result<(), DomainError>;
}
impl StoredJson for Vault {
    fn validate(&self) -> Result<(), DomainError> {
        Vault::validate(self)
    }
}
fn parse_document<T: StoredJson>(bytes: &[u8]) -> Result<T, DomainError> {
    let value: T =
        serde_json::from_slice(bytes).map_err(|e| DomainError::InvalidJson(e.to_string()))?;
    value.validate()?;
    Ok(value)
}
fn serialize_document<T: StoredJson>(value: &T) -> Result<Vec<u8>, DomainError> {
    value.validate()?;
    serde_json::to_vec_pretty(value).map_err(|e| DomainError::InvalidJson(e.to_string()))
}

use super::{ResolvedPath, StorageError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionStamp {
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LoadedDocument<T> {
    pub value: T,
    pub stamp: VersionStamp,
}

pub trait FileReplacer: Clone + Send + Sync + 'static {
    fn replace(&self, staged: &Path, target: &Path) -> Result<(), StorageError>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct RenameReplacer;

impl FileReplacer for RenameReplacer {
    fn replace(&self, staged: &Path, target: &Path) -> Result<(), StorageError> {
        fs::rename(staged, target)
            .map_err(|error| StorageError::io("replace JSON document", target, error))
    }
}

#[derive(Debug, Clone)]
pub struct JsonStore<R = RenameReplacer> {
    replacer: R,
}

impl Default for JsonStore<RenameReplacer> {
    fn default() -> Self {
        Self {
            replacer: RenameReplacer,
        }
    }
}

impl<R: FileReplacer> JsonStore<R> {
    pub fn with_replacer(replacer: R) -> Self {
        Self { replacer }
    }

    pub fn load<T: StoredJson>(
        &self,
        path: &ResolvedPath,
    ) -> Result<LoadedDocument<T>, StorageError> {
        let bytes = fs::read(path.as_path())
            .map_err(|error| StorageError::io("read JSON document", path.relative(), error))?;
        let value = parse_document(&bytes)?;
        Ok(LoadedDocument {
            value,
            stamp: VersionStamp::from_bytes(&bytes),
        })
    }

    pub fn create<T: StoredJson>(
        &self,
        path: &ResolvedPath,
        value: &T,
    ) -> Result<VersionStamp, StorageError> {
        if path.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        self.write(path, value)
    }

    pub fn write<T: StoredJson>(
        &self,
        path: &ResolvedPath,
        value: &T,
    ) -> Result<VersionStamp, StorageError> {
        let bytes = serialize_document(value)?;
        self.write_bytes(path, &bytes, |candidate| {
            parse_document::<T>(candidate).map(|_| ())
        })?;
        Ok(VersionStamp::from_bytes(&bytes))
    }

    pub fn compare_and_swap<T: StoredJson>(
        &self,
        path: &ResolvedPath,
        expected: &VersionStamp,
        value: &T,
    ) -> Result<VersionStamp, StorageError> {
        let current = fs::read(path.as_path())
            .map_err(|error| StorageError::io("read JSON document", path.relative(), error))?;
        if VersionStamp::from_bytes(&current) != *expected {
            return Err(StorageError::WriteConflict);
        }
        self.write(path, value)
    }

    pub fn write_bytes<F>(
        &self,
        path: &ResolvedPath,
        bytes: &[u8],
        validate: F,
    ) -> Result<(), StorageError>
    where
        F: Fn(&[u8]) -> Result<(), crate::domain::DomainError>,
    {
        validate(bytes)?;
        let parent = path
            .as_path()
            .parent()
            .ok_or_else(|| StorageError::UnsafePath {
                path: path.relative().to_string_lossy().into_owned(),
                reason: "document has no parent directory".to_owned(),
            })?;
        let file_name = path
            .as_path()
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| StorageError::UnsafePath {
                path: path.relative().to_string_lossy().into_owned(),
                reason: "document needs a UTF-8 filename".to_owned(),
            })?;
        let staged = parent.join(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()));
        let result = self.stage_validate_replace(&staged, path, bytes, |candidate| {
            validate(candidate).map_err(StorageError::from)
        });
        if result.is_err() {
            let _ = fs::remove_file(&staged);
        }
        result
    }

    pub fn create_bytes<F>(
        &self,
        path: &ResolvedPath,
        bytes: &[u8],
        validate: F,
    ) -> Result<VersionStamp, StorageError>
    where
        F: Fn(&[u8]) -> Result<(), crate::domain::DomainError>,
    {
        validate(bytes)?;
        let parent = path
            .as_path()
            .parent()
            .ok_or_else(|| StorageError::UnsafePath {
                path: path.relative().to_string_lossy().into_owned(),
                reason: "document has no parent directory".to_owned(),
            })?;
        let file_name = path
            .as_path()
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| StorageError::UnsafePath {
                path: path.relative().to_string_lossy().into_owned(),
                reason: "document needs a UTF-8 filename".to_owned(),
            })?;
        let staged = parent.join(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| {
            let mut file = create_staged_file(&staged)?;
            file.write_all(bytes)
                .map_err(|error| StorageError::io("write staged JSON", path.relative(), error))?;
            file.sync_all()
                .map_err(|error| StorageError::io("sync staged JSON", path.relative(), error))?;
            drop(file);
            let verified = fs::read(&staged)
                .map_err(|error| StorageError::io("verify staged JSON", path.relative(), error))?;
            validate(&verified)?;
            match fs::hard_link(&staged, path.as_path()) {
                Ok(()) => Ok(VersionStamp::from_bytes(bytes)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                    Err(StorageError::WriteConflict)
                }
                Err(error) => Err(StorageError::io(
                    "publish new JSON document",
                    path.relative(),
                    error,
                )),
            }
        })();
        let _ = fs::remove_file(&staged);
        result
    }

    pub fn compare_and_swap_bytes<F>(
        &self,
        path: &ResolvedPath,
        expected: &VersionStamp,
        bytes: &[u8],
        validate: F,
    ) -> Result<VersionStamp, StorageError>
    where
        F: Fn(&[u8]) -> Result<(), crate::domain::DomainError>,
    {
        let current = fs::read(path.as_path())
            .map_err(|error| StorageError::io("read JSON document", path.relative(), error))?;
        if VersionStamp::from_bytes(&current) != *expected {
            return Err(StorageError::WriteConflict);
        }
        self.write_bytes(path, bytes, validate)?;
        Ok(VersionStamp::from_bytes(bytes))
    }

    fn stage_validate_replace<F>(
        &self,
        staged: &Path,
        target: &ResolvedPath,
        bytes: &[u8],
        validate: F,
    ) -> Result<(), StorageError>
    where
        F: FnOnce(&[u8]) -> Result<(), StorageError>,
    {
        let mut file = create_staged_file(staged)?;
        file.write_all(bytes)
            .map_err(|error| StorageError::io("write staged JSON", target.relative(), error))?;
        file.sync_all()
            .map_err(|error| StorageError::io("sync staged JSON", target.relative(), error))?;
        drop(file);
        let verified = fs::read(staged)
            .map_err(|error| StorageError::io("verify staged JSON", target.relative(), error))?;
        validate(&verified)?;
        self.replacer.replace(staged, target.as_path())
    }
}

impl VersionStamp {
    pub fn from_bytes(bytes: &[u8]) -> Self {
        Self {
            sha256: format!("{:x}", Sha256::digest(bytes)),
        }
    }
}

fn create_staged_file(path: &Path) -> Result<File, StorageError> {
    OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|error| StorageError::io("create staged JSON", path, error))
}
