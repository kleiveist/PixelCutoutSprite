use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::domain::{parse_document, serialize_document, DomainDocument};

use super::{ResolvedPath, StorageError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionStamp {
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LoadedDocument {
    pub value: DomainDocument,
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

    pub fn load(&self, path: &ResolvedPath) -> Result<LoadedDocument, StorageError> {
        let bytes = fs::read(path.as_path())
            .map_err(|error| StorageError::io("read JSON document", path.relative(), error))?;
        let value = parse_document(&bytes)?;
        Ok(LoadedDocument {
            value,
            stamp: VersionStamp::from_bytes(&bytes),
        })
    }

    pub fn create(
        &self,
        path: &ResolvedPath,
        value: &DomainDocument,
    ) -> Result<VersionStamp, StorageError> {
        if path.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        self.write(path, value)
    }

    pub fn write(
        &self,
        path: &ResolvedPath,
        value: &DomainDocument,
    ) -> Result<VersionStamp, StorageError> {
        let bytes = serialize_document(value)?;
        self.write_bytes(path, &bytes, |candidate| {
            parse_document(candidate).map(|_| ())
        })?;
        Ok(VersionStamp::from_bytes(&bytes))
    }

    pub fn compare_and_swap(
        &self,
        path: &ResolvedPath,
        expected: &VersionStamp,
        value: &DomainDocument,
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
