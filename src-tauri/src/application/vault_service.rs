use std::collections::HashMap;
use std::fs;
use std::path::Path;

use chrono::Utc;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::domain::{
    DocumentKind, DomainDocument, ObjectId, UtcTimestamp, Vault, SCHEMA_VERSION, VAULT_FORMAT,
};
use crate::storage::{
    JsonStore, ObjectIndex, StorageError, VaultLayout, VaultLock, VaultRoot, ADMIN_DIR,
};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum VaultInspection {
    Empty {
        path: String,
    },
    Foreign {
        path: String,
        entry_count: usize,
        confirmation_token: String,
    },
    Valid {
        path: String,
        vault_id: ObjectId,
        writer_present: bool,
    },
    Damaged {
        path: String,
        message: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultOpenMode {
    ReadWrite,
    ReadOnly,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenVault {
    pub session_id: ObjectId,
    pub vault_id: ObjectId,
    pub path: String,
    pub mode: VaultOpenMode,
    pub indexed_objects: usize,
    pub notice: Option<String>,
}

#[derive(Debug)]
struct VaultSession {
    root: VaultRoot,
    vault_id: ObjectId,
    mode: VaultOpenMode,
    _writer_lock: Option<VaultLock>,
    index: ObjectIndex,
}

#[derive(Debug, Default)]
pub struct VaultService {
    sessions: HashMap<ObjectId, VaultSession>,
}

impl VaultService {
    pub fn inspect(path: &Path) -> Result<VaultInspection, StorageError> {
        let root = VaultRoot::open(path)?;
        let display_path = root.path().to_string_lossy().into_owned();
        let entries = read_root_entries(root.path())?;
        let admin = root.path().join(ADMIN_DIR);
        if !admin.exists() {
            return if entries.is_empty() {
                Ok(VaultInspection::Empty { path: display_path })
            } else {
                Ok(VaultInspection::Foreign {
                    path: display_path,
                    entry_count: entries.len(),
                    confirmation_token: confirmation_token(root.path(), &entries),
                })
            };
        }
        inspect_existing_vault(&root, display_path)
    }

    pub fn initialize(
        &mut self,
        path: &Path,
        confirmation: Option<&str>,
    ) -> Result<OpenVault, StorageError> {
        match Self::inspect(path)? {
            VaultInspection::Empty { .. } => {}
            VaultInspection::Foreign {
                confirmation_token, ..
            } if confirmation == Some(confirmation_token.as_str()) => {}
            VaultInspection::Foreign {
                confirmation_token, ..
            } => {
                return Err(StorageError::ConfirmationRequired {
                    token: confirmation_token,
                });
            }
            VaultInspection::Valid { .. } => return self.open(path),
            VaultInspection::Damaged { message, .. } => {
                return Err(StorageError::InvalidVault(message));
            }
        }
        let root = VaultRoot::open(path)?;
        root.ensure_directory(Path::new(ADMIN_DIR))?;
        root.ensure_directory(Path::new(ADMIN_DIR).join("runtime").as_path())?;
        let layout = VaultLayout::new(root);
        let created_at =
            UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))?;
        let vault = DomainDocument::Vault(Vault {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Vault,
            id: ObjectId::new(),
            format: VAULT_FORMAT.to_owned(),
            created_at,
        });
        JsonStore::default().create(&layout.vault_manifest()?, &vault)?;
        self.open(layout.root().path())
    }

    pub fn open(&mut self, path: &Path) -> Result<OpenVault, StorageError> {
        let inspection = Self::inspect(path)?;
        let VaultInspection::Valid { vault_id, .. } = inspection else {
            return Err(StorageError::InvalidVault(
                "select or initialize a valid vault first".to_owned(),
            ));
        };
        let root = VaultRoot::open(path)?;
        let layout = VaultLayout::new(root.clone());
        root.ensure_directory(Path::new(ADMIN_DIR).join("runtime").as_path())?;
        let session_id = ObjectId::new();
        let (mode, writer_lock, notice) =
            match VaultLock::acquire(layout.writer_lock()?, session_id) {
                Ok(lock) => (VaultOpenMode::ReadWrite, Some(lock), None),
                Err(StorageError::AlreadyLocked { owner }) => (
                    VaultOpenMode::ReadOnly,
                    None,
                    Some(format!(
                        "Vault is already open by writer {owner}; this session is read-only."
                    )),
                ),
                Err(error) => return Err(error),
            };
        let index = ObjectIndex::rebuild(&root)?;
        let result = OpenVault {
            session_id,
            vault_id,
            path: root.path().to_string_lossy().into_owned(),
            mode,
            indexed_objects: index.len(),
            notice,
        };
        self.sessions.insert(
            session_id,
            VaultSession {
                root,
                vault_id,
                mode,
                _writer_lock: writer_lock,
                index,
            },
        );
        Ok(result)
    }

    pub fn close(&mut self, session_id: ObjectId) -> Result<(), StorageError> {
        if self.sessions.remove(&session_id).is_none() {
            return Err(StorageError::InvalidVault(
                "unknown vault session".to_owned(),
            ));
        }
        Ok(())
    }

    pub fn session(&self, session_id: ObjectId) -> Option<(&Path, ObjectId, VaultOpenMode, usize)> {
        self.sessions.get(&session_id).map(|session| {
            (
                session.root.path(),
                session.vault_id,
                session.mode,
                session.index.len(),
            )
        })
    }
}

fn inspect_existing_vault(
    root: &VaultRoot,
    display_path: String,
) -> Result<VaultInspection, StorageError> {
    let admin = root.path().join(ADMIN_DIR);
    let metadata = fs::symlink_metadata(&admin)
        .map_err(|error| StorageError::io("inspect vault administration", &admin, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Ok(VaultInspection::Damaged {
            path: display_path,
            message: "the administration path is not a real directory".to_owned(),
        });
    }
    let layout = VaultLayout::new(root.clone());
    let loaded = JsonStore::default().load(&layout.vault_manifest()?);
    match loaded {
        Ok(value) => match value.value {
            DomainDocument::Vault(vault) => Ok(VaultInspection::Valid {
                path: display_path,
                vault_id: vault.id,
                writer_present: layout.writer_lock()?.as_path().exists(),
            }),
            _ => Ok(VaultInspection::Damaged {
                path: display_path,
                message: "vault.json has the wrong document kind".to_owned(),
            }),
        },
        Err(error) => Ok(VaultInspection::Damaged {
            path: display_path,
            message: error.to_string(),
        }),
    }
}

fn read_root_entries(root: &Path) -> Result<Vec<(String, u64)>, StorageError> {
    let mut entries = fs::read_dir(root)
        .map_err(|error| StorageError::io("inspect vault", root, error))?
        .map(|entry| {
            let entry =
                entry.map_err(|error| StorageError::io("inspect vault entry", root, error))?;
            let metadata = entry
                .metadata()
                .map_err(|error| StorageError::io("inspect vault entry", &entry.path(), error))?;
            Ok((
                entry.file_name().to_string_lossy().into_owned(),
                metadata.len(),
            ))
        })
        .collect::<Result<Vec<_>, StorageError>>()?;
    entries.sort();
    Ok(entries)
}

fn confirmation_token(root: &Path, entries: &[(String, u64)]) -> String {
    let mut digest = Sha256::new();
    digest.update(root.as_os_str().as_encoded_bytes());
    for (name, size) in entries {
        digest.update(name.as_bytes());
        digest.update(size.to_le_bytes());
    }
    format!("{:x}", digest.finalize())
}
