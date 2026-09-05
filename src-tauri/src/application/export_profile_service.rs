use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::{
    DomainDocument, DomainError, ExportJumpMode, ExportProfileSnapshot, ExportRootMotionMode,
    ObjectId, UtcTimestamp,
};
use crate::storage::{JsonStore, StorageError, VaultRoot, VersionStamp};

const PROFILE_SCHEMA_VERSION: u32 = 1;
const PROFILE_DIRECTORY: &str = ".area/export-profiles";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StoredNpcExportProfile {
    pub id: ObjectId,
    pub revision: u32,
    pub profile: ExportProfileSnapshot,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveNpcExportProfileRequest {
    pub profile_id: Option<ObjectId>,
    pub expected_revision: Option<u32>,
    pub profile: ExportProfileSnapshot,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteNpcExportProfileRequest {
    pub profile_id: ObjectId,
    pub expected_revision: u32,
}

#[derive(Debug, Error)]
pub enum ExportProfileServiceError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error("invalid stored export profile: {0}")]
    InvalidStored(String),
    #[error("{0}")]
    Invalid(String),
    #[error("export profile does not exist in this area")]
    NotFound,
    #[error("export profile revision conflict: expected {expected}, found {found}")]
    RevisionConflict { expected: u32, found: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ExportProfileDocumentKind {
    ExportProfile,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportProfileDocument {
    schema_version: u32,
    kind: ExportProfileDocumentKind,
    id: ObjectId,
    revision: u32,
    area_id: ObjectId,
    profile: ExportProfileSnapshot,
    root_motion_mode: ExportRootMotionMode,
    jump_mode: ExportJumpMode,
    created_at: UtcTimestamp,
    updated_at: UtcTimestamp,
}

struct LoadedExportProfile {
    document: ExportProfileDocument,
    stamp: VersionStamp,
}

impl ExportProfileDocument {
    fn validate(
        &self,
        expected_area_id: ObjectId,
        expected_id: ObjectId,
    ) -> Result<(), ExportProfileServiceError> {
        if self.schema_version != PROFILE_SCHEMA_VERSION {
            return Err(ExportProfileServiceError::InvalidStored(format!(
                "schema_version must be {PROFILE_SCHEMA_VERSION}"
            )));
        }
        if self.area_id != expected_area_id || self.id != expected_id {
            return Err(ExportProfileServiceError::InvalidStored(
                "document identity does not match its area-owned path".to_owned(),
            ));
        }
        if self.revision == 0 {
            return Err(ExportProfileServiceError::InvalidStored(
                "revision must be positive".to_owned(),
            ));
        }
        if self.updated_at < self.created_at {
            return Err(ExportProfileServiceError::InvalidStored(
                "updated_at must not precede created_at".to_owned(),
            ));
        }
        self.profile
            .validate()
            .map_err(|error| ExportProfileServiceError::InvalidStored(error.to_string()))
    }

    fn view(&self) -> StoredNpcExportProfile {
        StoredNpcExportProfile {
            id: self.id,
            revision: self.revision,
            profile: self.profile.clone(),
            root_motion_mode: self.root_motion_mode,
            jump_mode: self.jump_mode,
        }
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ExportProfileService;

impl ExportProfileService {
    pub fn list(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
    ) -> Result<Vec<StoredNpcExportProfile>, ExportProfileServiceError> {
        validate_area(vault, area_path, area_id)?;
        let directory = vault.resolve(&profile_directory(area_path))?;
        let metadata = match fs::symlink_metadata(directory.as_path()) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => {
                return Err(StorageError::io(
                    "inspect export profile directory",
                    directory.relative(),
                    error,
                )
                .into())
            }
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(ExportProfileServiceError::InvalidStored(
                "export profile storage must be a real directory".to_owned(),
            ));
        }

        let mut profiles = Vec::new();
        for entry in fs::read_dir(directory.as_path()).map_err(|error| {
            StorageError::io("list export profiles", directory.relative(), error)
        })? {
            let entry = entry.map_err(|error| {
                StorageError::io("inspect export profile", directory.relative(), error)
            })?;
            let file_type = entry.file_type().map_err(|error| {
                StorageError::io("inspect export profile", &entry.path(), error)
            })?;
            if file_type.is_symlink() || !file_type.is_file() {
                return Err(ExportProfileServiceError::InvalidStored(
                    "export profile storage contains a non-file entry".to_owned(),
                ));
            }
            let path = entry.path();
            let id = profile_id_from_path(&path)?;
            let relative = path.strip_prefix(vault.path()).map_err(|_| {
                ExportProfileServiceError::InvalidStored(
                    "export profile path escaped the selected vault".to_owned(),
                )
            })?;
            let resolved = vault.resolve(relative)?;
            profiles.push(read_profile(&resolved, area_id, id)?.view());
        }
        profiles.sort_by(|left, right| {
            left.profile
                .name
                .cmp(&right.profile.name)
                .then(left.id.cmp(&right.id))
        });
        Ok(profiles)
    }

    pub fn save(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
        request: SaveNpcExportProfileRequest,
    ) -> Result<StoredNpcExportProfile, ExportProfileServiceError> {
        validate_area(vault, area_path, area_id)?;
        request.profile.validate().map_err(|error| {
            ExportProfileServiceError::Invalid(format!("export profile is invalid: {error}"))
        })?;
        let directory = profile_directory(area_path);
        vault.ensure_directory(&directory)?;
        let now = UtcTimestamp::now();
        let (document, expected_stamp) = match (request.profile_id, request.expected_revision) {
            (None, None) => (
                ExportProfileDocument {
                    schema_version: PROFILE_SCHEMA_VERSION,
                    kind: ExportProfileDocumentKind::ExportProfile,
                    id: ObjectId::new(),
                    revision: 1,
                    area_id,
                    profile: request.profile,
                    root_motion_mode: request.root_motion_mode,
                    jump_mode: request.jump_mode,
                    created_at: now,
                    updated_at: now,
                },
                None,
            ),
            (Some(id), Some(expected_revision)) => {
                let path = vault.resolve(&profile_path(area_path, id))?;
                let loaded = read_profile_with_stamp(&path, area_id, id)?;
                let current = loaded.document;
                check_revision(current.revision, expected_revision)?;
                (
                    ExportProfileDocument {
                        revision: current.revision.checked_add(1).ok_or_else(|| {
                            ExportProfileServiceError::Invalid(
                                "export profile revision overflow".to_owned(),
                            )
                        })?,
                        profile: request.profile,
                        root_motion_mode: request.root_motion_mode,
                        jump_mode: request.jump_mode,
                        updated_at: now,
                        ..current
                    },
                    Some(loaded.stamp),
                )
            }
            _ => {
                return Err(ExportProfileServiceError::Invalid(
                    "profile_id and expected_revision must either both be null or both be set"
                        .to_owned(),
                ))
            }
        };
        let path = vault.resolve(&profile_path(area_path, document.id))?;
        write_profile(&path, &document, area_id, expected_stamp.as_ref())?;
        Ok(document.view())
    }

    pub fn delete(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        area_id: ObjectId,
        request: DeleteNpcExportProfileRequest,
    ) -> Result<(), ExportProfileServiceError> {
        validate_area(vault, area_path, area_id)?;
        let path = vault.resolve(&profile_path(area_path, request.profile_id))?;
        let current = read_profile(&path, area_id, request.profile_id)?;
        check_revision(current.revision, request.expected_revision)?;
        let metadata = fs::symlink_metadata(path.as_path()).map_err(|error| {
            StorageError::io(
                "inspect export profile for deletion",
                path.relative(),
                error,
            )
        })?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(ExportProfileServiceError::InvalidStored(
                "export profile path is not a real file".to_owned(),
            ));
        }
        fs::remove_file(path.as_path())
            .map_err(|error| StorageError::io("delete export profile", path.relative(), error))?;
        Ok(())
    }
}

fn validate_area(
    vault: &VaultRoot,
    area_path: &Path,
    area_id: ObjectId,
) -> Result<(), ExportProfileServiceError> {
    let manifest = vault.resolve(&area_path.join(".area/area.json"))?;
    let loaded = JsonStore::default().load(&manifest)?;
    match loaded.value {
        DomainDocument::Area(area) if area.id == area_id => Ok(()),
        _ => Err(ExportProfileServiceError::Invalid(
            "selected area does not own this export profile store".to_owned(),
        )),
    }
}

fn profile_directory(area_path: &Path) -> PathBuf {
    area_path.join(PROFILE_DIRECTORY)
}

fn profile_path(area_path: &Path, id: ObjectId) -> PathBuf {
    profile_directory(area_path).join(format!("{id}.json"))
}

fn profile_id_from_path(path: &Path) -> Result<ObjectId, ExportProfileServiceError> {
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err(ExportProfileServiceError::InvalidStored(
            "export profile filenames must use the .json extension".to_owned(),
        ));
    }
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            ExportProfileServiceError::InvalidStored(
                "export profile filename must be valid UTF-8".to_owned(),
            )
        })?;
    ObjectId::parse("export_profile_id", stem)
        .map_err(|error| ExportProfileServiceError::InvalidStored(error.to_string()))
}

fn read_profile(
    path: &crate::storage::ResolvedPath,
    area_id: ObjectId,
    id: ObjectId,
) -> Result<ExportProfileDocument, ExportProfileServiceError> {
    read_profile_with_stamp(path, area_id, id).map(|loaded| loaded.document)
}

fn read_profile_with_stamp(
    path: &crate::storage::ResolvedPath,
    area_id: ObjectId,
    id: ObjectId,
) -> Result<LoadedExportProfile, ExportProfileServiceError> {
    let bytes = match fs::read(path.as_path()) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(ExportProfileServiceError::NotFound)
        }
        Err(error) => {
            return Err(StorageError::io("read export profile", path.relative(), error).into())
        }
    };
    let document = parse_profile(&bytes, area_id, id)?;
    Ok(LoadedExportProfile {
        document,
        stamp: VersionStamp::from_bytes(&bytes),
    })
}

fn parse_profile(
    bytes: &[u8],
    area_id: ObjectId,
    id: ObjectId,
) -> Result<ExportProfileDocument, ExportProfileServiceError> {
    let document: ExportProfileDocument = serde_json::from_slice(bytes)
        .map_err(|error| ExportProfileServiceError::InvalidStored(error.to_string()))?;
    document.validate(area_id, id)?;
    Ok(document)
}

fn write_profile(
    path: &crate::storage::ResolvedPath,
    document: &ExportProfileDocument,
    area_id: ObjectId,
    expected: Option<&VersionStamp>,
) -> Result<(), ExportProfileServiceError> {
    let bytes = serde_json::to_vec_pretty(document)
        .map_err(|error| ExportProfileServiceError::Invalid(error.to_string()))?;
    let id = document.id;
    let validate = move |candidate: &[u8]| {
        parse_profile(candidate, area_id, id)
            .map(|_| ())
            .map_err(|error| DomainError::invalid("export_profile", error.to_string()))
    };
    let store = JsonStore::default();
    if let Some(expected) = expected {
        store.compare_and_swap_bytes(path, expected, &bytes, validate)?;
    } else {
        store.create_bytes(path, &bytes, validate)?;
    }
    Ok(())
}

fn check_revision(found: u32, expected: u32) -> Result<(), ExportProfileServiceError> {
    if found == expected {
        Ok(())
    } else {
        Err(ExportProfileServiceError::RevisionConflict { expected, found })
    }
}
