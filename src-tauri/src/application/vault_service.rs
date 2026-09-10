use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::Utc;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::domain::{DocumentKind, ObjectId, UtcTimestamp, Vault, SCHEMA_VERSION, VAULT_FORMAT};
use crate::storage::{
    JsonStore, LockRecovery, NoTransactionFault, RecoveryCandidate, RecoveryChoice, StorageError,
    TransactionService, VaultLayout, VaultLock, VaultRoot, ADMIN_DIR,
};
use crate::workspace::{ensure_workspace, preflight_workspace};

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
        lock_recovery: Option<LockRecovery>,
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
    pub session_generation: u64,
    pub vault_id: ObjectId,
    pub path: String,
    pub mode: VaultOpenMode,
    pub indexed_objects: usize,
    pub notice: Option<String>,
    pub recovery: Vec<RecoveryCandidate>,
    pub recovery_writable: bool,
    pub lock_recovery: Option<LockRecovery>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecoveryStatus {
    pub recovery: Vec<RecoveryCandidate>,
    pub mode: VaultOpenMode,
    pub recovery_writable: bool,
    pub indexed_objects: usize,
}

#[derive(Debug)]
struct BackgroundMutationPermit {
    active: Arc<AtomicBool>,
}

impl Drop for BackgroundMutationPermit {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Release);
    }
}

#[derive(Debug, Clone)]
pub struct VaultWriteLease {
    root: VaultRoot,
    _writer_lock: Arc<VaultLock>,
    _mutation: Arc<BackgroundMutationPermit>,
}

impl VaultWriteLease {
    pub fn root(&self) -> &VaultRoot {
        &self.root
    }
}

#[derive(Debug)]
struct VaultSession {
    root: VaultRoot,
    generation: u64,
    vault_id: ObjectId,
    mode: VaultOpenMode,
    writer_lock: Option<Arc<VaultLock>>,
    background_mutation: Arc<AtomicBool>,
    recovery_required: bool,
}

#[derive(Debug, Default)]
pub struct VaultService {
    sessions: HashMap<ObjectId, VaultSession>,
    next_generation: u64,
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
        preflight_workspace(&root, None)?;
        root.ensure_directory(Path::new(ADMIN_DIR))?;
        root.ensure_directory(Path::new(ADMIN_DIR).join("runtime").as_path())?;
        let layout = VaultLayout::new(root);
        let created_at =
            UtcTimestamp::parse(&Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))?;
        let vault = Vault {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Vault,
            id: ObjectId::new(),
            format: VAULT_FORMAT.to_owned(),
            created_at,
        };
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
        preflight_workspace(&root, Some(&vault_id.to_string()))?;

        // Legacy files are opaque user data. Discover journals, but never migrate, index,
        // quarantine or clean up old projects merely by opening the vault.
        let recovery = TransactionService::<NoTransactionFault>::scan_open(&root)?;

        root.ensure_directory(Path::new(ADMIN_DIR).join("runtime").as_path())?;
        let layout = VaultLayout::new(root.clone());
        let lock_path = layout.writer_lock()?;
        let session_id = ObjectId::new();
        let (writer_lock, mut notice, lock_recovery) =
            match VaultLock::acquire(lock_path.clone(), session_id) {
                Ok(lock) => (Some(Arc::new(lock)), None, None),
                Err(StorageError::AlreadyLocked { owner }) => (
                    None,
                    Some(format!(
                        "Vault is already open by writer {owner}; this session is read-only."
                    )),
                    None,
                ),
                Err(StorageError::LockRecoveryRequired { .. }) => (
                    None,
                    Some(
                        "A previous writer stopped without releasing its lock; this session is read-only until the orphan lock is explicitly confirmed."
                            .to_owned(),
                    ),
                    VaultLock::inspect_recovery(&lock_path)?,
                ),
                Err(error) => return Err(error),
            };
        let recovery_writable = writer_lock.is_some() && !recovery.is_empty();
        let mut visible_recovery = recovery;
        if writer_lock.is_none() {
            disable_recovery_actions(
                &mut visible_recovery,
                "recovery requires the active writer lease",
            );
        }

        let mode = if !visible_recovery.is_empty() {
            append_notice(
                &mut notice,
                format!(
                    "{} interrupted operation(s) need explicit resume or rollback.",
                    visible_recovery.len()
                ),
            );
            VaultOpenMode::ReadOnly
        } else if writer_lock.is_some() {
            ensure_workspace(&root, &vault_id.to_string())?;
            crate::workspace::WorkspaceWriter::new(root.clone()).recover_file_sets()?;
            VaultOpenMode::ReadWrite
        } else {
            VaultOpenMode::ReadOnly
        };

        self.next_generation = self.next_generation.saturating_add(1).max(1);
        let session_generation = self.next_generation;
        let result = OpenVault {
            session_id,
            session_generation,
            vault_id,
            path: root.path().to_string_lossy().into_owned(),
            mode,
            indexed_objects: usize::from(visible_recovery.is_empty()),
            notice,
            recovery: visible_recovery,
            recovery_writable,
            lock_recovery,
        };
        self.sessions.insert(
            session_id,
            VaultSession {
                root,
                generation: session_generation,
                vault_id,
                mode,
                writer_lock,
                background_mutation: Arc::new(AtomicBool::new(false)),
                recovery_required: !result.recovery.is_empty(),
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
                usize::from(!session.recovery_required),
            )
        })
    }

    pub fn list_recovery(&mut self, session_id: ObjectId) -> Result<RecoveryStatus, StorageError> {
        self.refresh_recovery(session_id)
    }

    pub fn recover_transaction(
        &mut self,
        session_id: ObjectId,
        transaction_id: ObjectId,
        choice: RecoveryChoice,
    ) -> Result<RecoveryStatus, StorageError> {
        let session = self
            .sessions
            .get_mut(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        if session.writer_lock.is_none() || !session.recovery_required {
            return Err(StorageError::InvalidVault(
                "recovery requires the session that owns the active writer lease".to_owned(),
            ));
        }
        let candidates = TransactionService::<NoTransactionFault>::scan_open(&session.root)?;
        let candidate = candidates
            .iter()
            .find(|candidate| candidate.transaction_id == transaction_id)
            .ok_or_else(|| {
                StorageError::RecoveryRequired(format!(
                    "no open transaction `{transaction_id}` was found"
                ))
            })?;
        let permitted = match choice {
            RecoveryChoice::Resume => candidate.can_resume,
            RecoveryChoice::Rollback => candidate.can_rollback,
        };
        if !permitted {
            return Err(StorageError::RecoveryRequired(
                candidate
                    .issue
                    .clone()
                    .unwrap_or_else(|| "the requested recovery action is not safe".to_owned()),
            ));
        }
        TransactionService::default().recover_candidate(&session.root, transaction_id, choice)?;
        self.refresh_recovery(session_id)
    }

    pub fn recover_orphaned_lock(
        path: &Path,
        confirmation_token: &str,
    ) -> Result<(), StorageError> {
        if !matches!(Self::inspect(path)?, VaultInspection::Valid { .. }) {
            return Err(StorageError::InvalidVault(
                "orphan recovery requires a valid vault".to_owned(),
            ));
        }
        let root = VaultRoot::open(path)?;
        let lock = VaultLayout::new(root).writer_lock()?;
        VaultLock::recover_orphan(&lock, confirmation_token)
    }

    pub fn heartbeat(&self, session_id: ObjectId) -> Result<(), StorageError> {
        let session = self
            .sessions
            .get(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        session
            .writer_lock
            .as_ref()
            .ok_or_else(|| {
                StorageError::InvalidVault("read-only sessions have no writer heartbeat".to_owned())
            })?
            .heartbeat()
    }

    /// A clone keeps the OS writer lock alive even if the UI session is closed. Long-running
    /// workers must retain this lease until their final managed write has completed.
    pub fn write_lease(&self, session_id: ObjectId) -> Result<VaultWriteLease, StorageError> {
        let session = self
            .sessions
            .get(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        if session.background_mutation.load(Ordering::Acquire) {
            return Err(StorageError::InvalidVault(
                "another background vault operation is already active".to_owned(),
            ));
        }
        if !TransactionService::<NoTransactionFault>::scan_open(&session.root)?.is_empty() {
            return Err(StorageError::RecoveryRequired(
                "an interrupted transaction blocks new writer leases until recovery".to_owned(),
            ));
        }
        if session.mode != VaultOpenMode::ReadWrite || session.recovery_required {
            return Err(StorageError::InvalidVault(
                "this vault session cannot issue a writer lease".to_owned(),
            ));
        }
        let writer_lock = session.writer_lock.clone().ok_or_else(|| {
            StorageError::InvalidVault("this vault session is read-only".to_owned())
        })?;
        session
            .background_mutation
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                StorageError::InvalidVault(
                    "another background vault operation is already active".to_owned(),
                )
            })?;
        Ok(VaultWriteLease {
            root: session.root.clone(),
            _writer_lock: writer_lock,
            _mutation: Arc::new(BackgroundMutationPermit {
                active: session.background_mutation.clone(),
            }),
        })
    }

    pub fn session_root(
        &self,
        session_id: ObjectId,
        require_write: bool,
    ) -> Result<VaultRoot, StorageError> {
        let session = self
            .sessions
            .get(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        if require_write {
            if session.background_mutation.load(Ordering::Acquire) {
                return Err(StorageError::InvalidVault(
                    "another background vault operation is already active".to_owned(),
                ));
            }
            if !TransactionService::<NoTransactionFault>::scan_open(&session.root)?.is_empty() {
                return Err(StorageError::RecoveryRequired(
                    "an interrupted transaction blocks further writes until recovery".to_owned(),
                ));
            }
            if session.mode != VaultOpenMode::ReadWrite {
                return Err(StorageError::InvalidVault(
                    "this vault session is read-only; changes were not written".to_owned(),
                ));
            }
        }
        Ok(session.root.clone())
    }

    pub fn session_root_at_generation(
        &self,
        session_id: ObjectId,
        generation: u64,
        require_write: bool,
    ) -> Result<VaultRoot, StorageError> {
        let session = self
            .sessions
            .get(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        if session.generation != generation {
            return Err(StorageError::WriteConflict);
        }
        self.session_root(session_id, require_write)
    }

    fn refresh_recovery(&mut self, session_id: ObjectId) -> Result<RecoveryStatus, StorageError> {
        let session = self
            .sessions
            .get_mut(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        let mut recovery = TransactionService::<NoTransactionFault>::scan_open(&session.root)?;
        if !recovery.is_empty() {
            session.mode = VaultOpenMode::ReadOnly;
            session.recovery_required = true;
        }
        let recovery_writable = session.writer_lock.is_some() && !recovery.is_empty();
        if session.writer_lock.is_none() {
            disable_recovery_actions(&mut recovery, "recovery requires the active writer lease");
        }
        if recovery.is_empty() && session.recovery_required && session.writer_lock.is_some() {
            ensure_workspace(&session.root, &session.vault_id.to_string())?;
            crate::workspace::WorkspaceWriter::new(session.root.clone()).recover_file_sets()?;
            session.mode = VaultOpenMode::ReadWrite;
            session.recovery_required = false;
        }
        Ok(RecoveryStatus {
            recovery,
            mode: session.mode,
            recovery_writable,
            indexed_objects: usize::from(!session.recovery_required),
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
    let loaded = JsonStore::default().load::<Vault>(&layout.vault_manifest()?);
    match loaded {
        Ok(value) => {
            let lock = layout.writer_lock()?;
            Ok(VaultInspection::Valid {
                path: display_path,
                vault_id: value.value.id,
                writer_present: VaultLock::writer_present(&lock)?,
                lock_recovery: VaultLock::inspect_recovery(&lock)?,
            })
        }
        Err(error) => Ok(VaultInspection::Damaged {
            path: display_path,
            message: error.to_string(),
        }),
    }
}

fn disable_recovery_actions(candidates: &mut [RecoveryCandidate], issue: &str) {
    for candidate in candidates {
        let combined = candidate.issue.as_ref().map_or_else(
            || issue.to_owned(),
            |existing| format!("{existing}; {issue}"),
        );
        candidate.disable_actions(combined);
    }
}

fn append_notice(notice: &mut Option<String>, addition: String) {
    *notice = Some(match notice.take() {
        Some(existing) => format!("{existing} {addition}"),
        None => addition,
    });
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
