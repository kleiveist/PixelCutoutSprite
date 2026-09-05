use std::fs;
use std::path::{Component, Path, PathBuf};

use super::StorageError;

#[derive(Debug, Clone)]
pub struct VaultRoot {
    canonical: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ResolvedPath {
    absolute: PathBuf,
    relative: PathBuf,
}

impl VaultRoot {
    pub fn open(path: &Path) -> Result<Self, StorageError> {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| StorageError::io("inspect vault root", path, error))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(StorageError::UnsafePath {
                path: "vault".to_owned(),
                reason: "root must be a real directory, not a symlink".to_owned(),
            });
        }
        let canonical = path
            .canonicalize()
            .map_err(|error| StorageError::io("canonicalize vault root", path, error))?;
        Ok(Self { canonical })
    }

    pub fn path(&self) -> &Path {
        &self.canonical
    }

    pub fn resolve(&self, relative: &Path) -> Result<ResolvedPath, StorageError> {
        validate_managed_relative(relative)?;
        self.reject_symlink_components(relative)?;
        let absolute = self.canonical.join(relative);
        let existing_parent = nearest_existing_parent(&absolute)?;
        let canonical_parent = existing_parent
            .canonicalize()
            .map_err(|error| StorageError::io("canonicalize vault path", relative, error))?;
        if !canonical_parent.starts_with(&self.canonical) {
            return Err(StorageError::UnsafePath {
                path: relative.to_string_lossy().into_owned(),
                reason: "resolved outside the selected vault".to_owned(),
            });
        }
        Ok(ResolvedPath {
            absolute,
            relative: relative.to_path_buf(),
        })
    }

    pub fn ensure_directory(&self, relative: &Path) -> Result<ResolvedPath, StorageError> {
        let resolved = self.resolve(relative)?;
        let mut current = self.canonical.clone();
        for component in relative.components() {
            let Component::Normal(segment) = component else {
                unreachable!("validated components are normal");
            };
            current.push(segment);
            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                    return Err(StorageError::UnsafePath {
                        path: relative.to_string_lossy().into_owned(),
                        reason: "an existing component is not a real directory".to_owned(),
                    });
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    fs::create_dir(&current).map_err(|error| {
                        StorageError::io("create vault directory", relative, error)
                    })?;
                }
                Err(error) => {
                    return Err(StorageError::io("inspect vault directory", relative, error));
                }
            }
        }
        Ok(resolved)
    }

    fn reject_symlink_components(&self, relative: &Path) -> Result<(), StorageError> {
        let mut current = self.canonical.clone();
        for component in relative.components() {
            let Component::Normal(segment) = component else {
                unreachable!("validated components are normal");
            };
            current.push(segment);
            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(StorageError::UnsafePath {
                        path: relative.to_string_lossy().into_owned(),
                        reason: "symbolic links are not followed".to_owned(),
                    });
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(error) => return Err(StorageError::io("inspect vault path", relative, error)),
            }
        }
        Ok(())
    }
}

impl ResolvedPath {
    pub fn as_path(&self) -> &Path {
        &self.absolute
    }

    pub fn relative(&self) -> &Path {
        &self.relative
    }
}

pub fn validate_managed_relative(path: &Path) -> Result<(), StorageError> {
    let text = path.to_string_lossy();
    let valid = !text.is_empty()
        && !text.contains('\\')
        && !text.contains('\0')
        && !path.is_absolute()
        && path
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
        && !text.starts_with("//")
        && !text.as_bytes().get(1).is_some_and(|byte| *byte == b':');
    if valid {
        Ok(())
    } else {
        Err(StorageError::UnsafePath {
            path: text.into_owned(),
            reason: "expected a portable relative managed path".to_owned(),
        })
    }
}

fn nearest_existing_parent(path: &Path) -> Result<&Path, StorageError> {
    let mut candidate = path;
    loop {
        match fs::symlink_metadata(candidate) {
            Ok(_) => return Ok(candidate),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                candidate = candidate.parent().ok_or_else(|| StorageError::UnsafePath {
                    path: "vault".to_owned(),
                    reason: "path has no existing parent".to_owned(),
                })?;
            }
            Err(error) => return Err(StorageError::io("inspect vault path", candidate, error)),
        }
    }
}
