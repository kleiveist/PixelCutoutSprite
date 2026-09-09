use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::{
    parse_document, validate_name, DocumentKind, DomainDocument, ObjectId, Project, RecordStatus,
    RelativePath, UtcTimestamp, Vault, SCHEMA_VERSION, VAULT_FORMAT,
};
use crate::storage::{
    is_derived_managed_path, is_managed_namespace_path, managed_json_kind, JsonStore, LockRecovery,
    ManagedJsonKind, ManagedSupportJsonKind, NoTransactionFault, ObjectIndex, RecoveryCandidate,
    RecoveryChoice, StorageError, TransactionAction, TransactionPurpose, TransactionService,
    TransactionStep, VaultLayout, VaultLock, VaultRoot, VersionStamp, ADMIN_DIR,
};
use crate::workspace::{ensure_workspace, preflight_workspace};

use super::{LabelCatalog, MotionDraft, ProjectViewState};

const MAX_PROJECT_MANIFEST_BYTES: u64 = 4 * 1024 * 1024;

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
    index: ObjectIndex,
}

#[derive(Debug, Clone)]
pub(crate) struct VaultSessionContext {
    pub root: VaultRoot,
    pub mode: VaultOpenMode,
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
        preflight_workspace(&root, Some(&vault_id.to_string()))?;

        // Discovery is read-only and precedes every mutation. In particular, a future project
        // schema prevents creation of runtime/lock files and prevents any older migration.
        let recovery = TransactionService::<NoTransactionFault>::scan_open(&root)?;
        preflight_authoritative_json(&root)?;
        let schema_preview = inspect_project_schemas(&root)?;

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

        let (mode, index) = if !visible_recovery.is_empty() {
            append_notice(
                &mut notice,
                format!(
                    "{} interrupted operation(s) need explicit resume or rollback before indexing.",
                    visible_recovery.len()
                ),
            );
            (VaultOpenMode::ReadOnly, ObjectIndex::default())
        } else if writer_lock.is_some() {
            ensure_workspace(&root, &vault_id.to_string())?;
            crate::workspace::WorkspaceWriter::new(root.clone()).recover_file_sets()?;
            TransactionService::<NoTransactionFault>::cleanup_terminal(&root)?;
            let quarantined =
                TransactionService::<NoTransactionFault>::quarantine_orphan_project_creations(
                    &root,
                )?;
            if quarantined > 0 {
                append_notice(
                    &mut notice,
                    format!(
                        "Moved {quarantined} incomplete project creation(s) without journals to the vault trash."
                    ),
                );
            }
            // Re-read under the writer lease; the preview above exists to guarantee that future
            // versions are rejected before we create or replace project data.
            preflight_authoritative_json(&root)?;
            let migrations = inspect_project_schemas(&root)?;
            let migrated = migrate_known_projects(&root, migrations)?;
            if migrated > 0 {
                append_notice(
                    &mut notice,
                    format!(
                        "Migrated {migrated} project manifest(s) with exact version-0 backups."
                    ),
                );
            }
            (VaultOpenMode::ReadWrite, ObjectIndex::rebuild(&root)?)
        } else if schema_preview.is_empty() {
            (VaultOpenMode::ReadOnly, ObjectIndex::rebuild(&root)?)
        } else {
            append_notice(
                &mut notice,
                format!(
                    "{} project manifest(s) need migration by the active writer before indexing.",
                    schema_preview.len()
                ),
            );
            (VaultOpenMode::ReadOnly, ObjectIndex::default())
        };

        self.next_generation = self.next_generation.saturating_add(1).max(1);
        let session_generation = self.next_generation;
        let result = OpenVault {
            session_id,
            session_generation,
            vault_id,
            path: root.path().to_string_lossy().into_owned(),
            mode,
            indexed_objects: index.len(),
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

    pub(crate) fn context(
        &self,
        session_id: ObjectId,
    ) -> Result<VaultSessionContext, StorageError> {
        let session = self
            .sessions
            .get(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        let background_mutation = session.background_mutation.load(Ordering::Acquire);
        if !background_mutation
            && !TransactionService::<NoTransactionFault>::scan_open(&session.root)?.is_empty()
        {
            return Err(StorageError::RecoveryRequired(
                "an interrupted transaction blocks workspace access until recovery".to_owned(),
            ));
        }
        Ok(VaultSessionContext {
            root: session.root.clone(),
            // Background jobs retain the process writer lease after releasing the service
            // mutex. Presenting their session as temporarily read-only lets ordinary reads
            // continue while every existing service-level write guard fails closed.
            mode: if background_mutation {
                VaultOpenMode::ReadOnly
            } else {
                session.mode
            },
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

    pub(crate) fn refresh_index(&mut self, session_id: ObjectId) -> Result<(), StorageError> {
        let session = self
            .sessions
            .get_mut(&session_id)
            .ok_or_else(|| StorageError::InvalidVault("unknown vault session".to_owned()))?;
        if !TransactionService::<NoTransactionFault>::scan_open(&session.root)?.is_empty() {
            session.mode = VaultOpenMode::ReadOnly;
            session.recovery_required = true;
            return Err(StorageError::RecoveryRequired(
                "an interrupted transaction blocks index refresh until recovery".to_owned(),
            ));
        }
        if session.mode != VaultOpenMode::ReadWrite || session.recovery_required {
            return Err(StorageError::InvalidVault(
                "cannot rebuild a writable index during vault recovery".to_owned(),
            ));
        }
        session.index = ObjectIndex::rebuild(&session.root)?;
        Ok(())
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
            TransactionService::<NoTransactionFault>::cleanup_terminal(&session.root)?;
            TransactionService::<NoTransactionFault>::quarantine_orphan_project_creations(
                &session.root,
            )?;
            preflight_authoritative_json(&session.root)?;
            let migrations = inspect_project_schemas(&session.root)?;
            migrate_known_projects(&session.root, migrations)?;
            session.index = ObjectIndex::rebuild(&session.root)?;
            session.mode = VaultOpenMode::ReadWrite;
            session.recovery_required = false;
        }
        Ok(RecoveryStatus {
            recovery,
            mode: session.mode,
            recovery_writable,
            indexed_objects: session.index.len(),
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
            DomainDocument::Vault(vault) => {
                let lock = layout.writer_lock()?;
                Ok(VaultInspection::Valid {
                    path: display_path,
                    vault_id: vault.id,
                    writer_present: VaultLock::writer_present(&lock)?,
                    lock_recovery: VaultLock::inspect_recovery(&lock)?,
                })
            }
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

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProjectV0 {
    schema_version: u32,
    kind: DocumentKind,
    id: ObjectId,
    name: String,
    created_at: UtcTimestamp,
    updated_at: UtcTimestamp,
}

#[derive(Debug, Deserialize)]
struct ProjectHeader {
    schema_version: u64,
    kind: DocumentKind,
}

#[derive(Debug)]
struct LegacyProject {
    folder: PathBuf,
    original: Vec<u8>,
    value: ProjectV0,
}

fn preflight_authoritative_json(root: &VaultRoot) -> Result<(), StorageError> {
    preflight_authoritative_directory(root, root.path(), 0)
}

fn preflight_authoritative_directory(
    root: &VaultRoot,
    directory: &Path,
    depth: u8,
) -> Result<(), StorageError> {
    if depth > 32 {
        return Err(StorageError::InvalidVault(
            "authoritative vault data exceeds the supported nesting depth".to_owned(),
        ));
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| StorageError::io("preflight vault JSON", directory, error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| StorageError::io("preflight vault JSON", directory, error))?;
    entries.sort_by_key(fs::DirEntry::file_name);
    for entry in entries {
        let path = entry.path();
        let relative = path
            .strip_prefix(root.path())
            .map_err(|_| StorageError::UnsafePath {
                path: "vault".to_owned(),
                reason: "authoritative preflight escaped the vault".to_owned(),
            })?;
        let kind = entry.file_type().map_err(|error| {
            StorageError::io("inspect authoritative vault entry", relative, error)
        })?;
        if is_derived_managed_path(relative) {
            continue;
        }
        if kind.is_symlink() {
            if managed_json_kind(root.path(), relative).is_some()
                || is_managed_namespace_path(root.path(), relative)
            {
                return Err(StorageError::UnsafePath {
                    path: relative.to_string_lossy().into_owned(),
                    reason: "authoritative vault data cannot be a symbolic link".to_owned(),
                });
            }
            continue;
        }
        if kind.is_dir() {
            preflight_authoritative_directory(root, &path, depth + 1)?;
            continue;
        }
        let Some(managed_kind) = managed_json_kind(root.path(), relative) else {
            continue;
        };
        if !kind.is_file() {
            return Err(StorageError::UnsafePath {
                path: relative.to_string_lossy().into_owned(),
                reason: "authoritative JSON must be a regular file".to_owned(),
            });
        }
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| StorageError::io("inspect authoritative JSON", relative, error))?;
        if metadata.len() > MAX_PROJECT_MANIFEST_BYTES {
            return Err(StorageError::InvalidVault(format!(
                "authoritative JSON `{}` exceeds the supported size",
                relative.to_string_lossy()
            )));
        }
        let bytes = fs::read(&path)
            .map_err(|error| StorageError::io("read authoritative JSON", relative, error))?;
        let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|error| {
            StorageError::InvalidVault(format!(
                "invalid authoritative JSON `{}`: {error}",
                relative.to_string_lossy()
            ))
        })?;
        let version_value = value.get("schema_version").ok_or_else(|| {
            StorageError::InvalidVault(format!(
                "authoritative JSON `{}` has no schema_version",
                relative.to_string_lossy()
            ))
        })?;
        let version = version_value.as_u64().ok_or_else(|| {
            StorageError::InvalidVault(format!(
                "schema_version in `{}` must be an unsigned integer",
                relative.to_string_lossy()
            ))
        })?;
        if version > u64::from(SCHEMA_VERSION) {
            return Err(StorageError::FutureSchemaProtected {
                found: version,
                supported: SCHEMA_VERSION,
            });
        }
        if version < u64::from(SCHEMA_VERSION) && !(version == 0 && is_project_manifest(relative)) {
            return Err(StorageError::InvalidVault(format!(
                "no safe migration is available for schema version {version} in `{}`",
                relative.to_string_lossy()
            )));
        }
        if version == u64::from(SCHEMA_VERSION) {
            validate_current_managed_json(relative, managed_kind, &bytes)?;
        }
    }
    Ok(())
}

fn validate_current_managed_json(
    relative: &Path,
    managed_kind: ManagedJsonKind,
    bytes: &[u8],
) -> Result<(), StorageError> {
    match managed_kind {
        ManagedJsonKind::Domain(expected) => {
            let document = parse_document(bytes)?;
            let actual = domain_document_kind(&document);
            if actual != expected {
                return Err(StorageError::InvalidVault(format!(
                    "authoritative JSON `{}` has kind {actual:?}, expected {expected:?}",
                    relative.to_string_lossy()
                )));
            }
        }
        ManagedJsonKind::Support(ManagedSupportJsonKind::LabelCatalog) => {
            let document: LabelCatalog = serde_json::from_slice(bytes).map_err(|error| {
                StorageError::InvalidVault(format!(
                    "invalid label catalog `{}`: {error}",
                    relative.to_string_lossy()
                ))
            })?;
            document.validate()?;
        }
        ManagedJsonKind::Support(ManagedSupportJsonKind::ProjectView) => {
            let document: ProjectViewState = serde_json::from_slice(bytes).map_err(|error| {
                StorageError::InvalidVault(format!(
                    "invalid project view `{}`: {error}",
                    relative.to_string_lossy()
                ))
            })?;
            document.validate()?;
        }
        ManagedJsonKind::Support(ManagedSupportJsonKind::MotionDraft) => {
            let document: MotionDraft = serde_json::from_slice(bytes).map_err(|error| {
                StorageError::InvalidVault(format!(
                    "invalid motion draft `{}`: {error}",
                    relative.to_string_lossy()
                ))
            })?;
            document.validate()?;
        }
        ManagedJsonKind::Support(ManagedSupportJsonKind::Other) => {}
    }
    Ok(())
}

fn domain_document_kind(document: &DomainDocument) -> DocumentKind {
    match document {
        DomainDocument::Vault(value) => value.kind,
        DomainDocument::Label(value) => value.kind,
        DomainDocument::Project(value) => value.kind,
        DomainDocument::Area(value) => value.kind,
        DomainDocument::ProfileRevision(value) => value.kind,
        DomainDocument::MotionTemplate(value) => value.kind,
        DomainDocument::MotionRevision(value) => value.kind,
        DomainDocument::Asset(value) => value.kind,
        DomainDocument::AssetRevision(value) => value.kind,
        DomainDocument::OutfitDraft(value) => value.kind,
        DomainDocument::Character(value) => value.kind,
        DomainDocument::Appearance(value) => value.kind,
        DomainDocument::AnimationBinding(value) => value.kind,
        DomainDocument::ExportManifest(value) => value.kind,
    }
}

fn is_project_manifest(relative: &Path) -> bool {
    let parts = relative
        .components()
        .map(|component| component.as_os_str())
        .collect::<Vec<_>>();
    parts.len() == 3 && parts[1] == ".project" && parts[2] == "project.json"
}

fn inspect_project_schemas(root: &VaultRoot) -> Result<Vec<LegacyProject>, StorageError> {
    let mut entries = fs::read_dir(root.path())
        .map_err(|error| StorageError::io("scan project migrations", root.path(), error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| StorageError::io("scan project migrations", root.path(), error))?;
    entries.sort_by_key(fs::DirEntry::file_name);
    let mut legacy = Vec::new();
    for entry in entries {
        let kind = entry.file_type().map_err(|error| {
            StorageError::io("inspect project migration candidate", &entry.path(), error)
        })?;
        if kind.is_symlink() || !kind.is_dir() {
            continue;
        }
        let name = entry.file_name();
        if name == ADMIN_DIR || name == ".trash" || name.to_string_lossy().starts_with('.') {
            continue;
        }
        let folder = PathBuf::from(name);
        let manifest = root.resolve(&folder.join(".project/project.json"))?;
        let metadata = match fs::symlink_metadata(manifest.as_path()) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(StorageError::io(
                    "inspect project migration manifest",
                    manifest.relative(),
                    error,
                ));
            }
        };
        if metadata.file_type().is_symlink()
            || !metadata.is_file()
            || metadata.len() > MAX_PROJECT_MANIFEST_BYTES
        {
            return Err(StorageError::UnsafePath {
                path: manifest.relative().to_string_lossy().into_owned(),
                reason: "project manifest must be a bounded regular file".to_owned(),
            });
        }
        let bytes = fs::read(manifest.as_path()).map_err(|error| {
            StorageError::io(
                "read project migration manifest",
                manifest.relative(),
                error,
            )
        })?;
        let header: ProjectHeader = serde_json::from_slice(&bytes).map_err(|error| {
            StorageError::InvalidVault(format!("invalid project header: {error}"))
        })?;
        if header.kind != DocumentKind::Project {
            return Err(StorageError::InvalidVault(
                "project manifest has the wrong document kind".to_owned(),
            ));
        }
        if header.schema_version > u64::from(SCHEMA_VERSION) {
            return Err(StorageError::FutureSchemaProtected {
                found: header.schema_version,
                supported: SCHEMA_VERSION,
            });
        }
        match header.schema_version {
            version if version == u64::from(SCHEMA_VERSION) => {
                if !matches!(
                    crate::domain::parse_document(&bytes)?,
                    DomainDocument::Project(_)
                ) {
                    return Err(StorageError::InvalidVault(
                        "project manifest has the wrong document kind".to_owned(),
                    ));
                }
            }
            0 => {
                let value: ProjectV0 = serde_json::from_slice(&bytes).map_err(|error| {
                    StorageError::InvalidVault(format!("invalid version 0 project: {error}"))
                })?;
                if value.schema_version != 0 || value.kind != DocumentKind::Project {
                    return Err(StorageError::InvalidVault(
                        "invalid version 0 project discriminator".to_owned(),
                    ));
                }
                validate_name("project.name", &value.name)?;
                legacy.push(LegacyProject {
                    folder,
                    original: bytes,
                    value,
                });
            }
            version => {
                return Err(StorageError::FutureSchemaProtected {
                    found: version,
                    supported: SCHEMA_VERSION,
                });
            }
        }
    }
    Ok(legacy)
}

fn migrate_known_projects(
    root: &VaultRoot,
    projects: Vec<LegacyProject>,
) -> Result<usize, StorageError> {
    let count = projects.len();
    for legacy in projects {
        let project = Project {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::Project,
            id: legacy.value.id,
            revision: 1,
            name: legacy.value.name,
            status: RecordStatus::Active,
            workspace_label_ids: Vec::new(),
            created_at: legacy.value.created_at,
            updated_at: legacy.value.updated_at,
        };
        project.validate()?;
        let transaction_id = ObjectId::new();
        let stage_root = legacy
            .folder
            .join(".project/transactions")
            .join(format!("{transaction_id}.stage"));
        let stage = stage_root.join("project.json");
        let target = legacy.folder.join(".project/project.json");
        let backup = legacy
            .folder
            .join(".project/backups/migrations")
            .join(transaction_id.to_string())
            .join("project-v0.json");
        root.ensure_directory(&stage_root)?;
        if let Err(error) =
            JsonStore::default().create(&root.resolve(&stage)?, &DomainDocument::Project(project))
        {
            let _ = fs::remove_dir_all(root.resolve(&stage_root)?.as_path());
            return Err(error);
        }
        let steps = vec![TransactionStep {
            action: TransactionAction::Replace,
            target: portable(&target)?,
            staged: portable(&stage)?,
            backup: Some(portable(&backup)?),
            expected_sha256: Some(VersionStamp::from_bytes(&legacy.original).sha256),
        }];
        let transactions = TransactionService::default();
        if let Err(error) = transactions.prepare(
            root,
            &legacy.folder,
            transaction_id,
            TransactionPurpose::Migration,
            steps,
        ) {
            let _ = fs::remove_dir_all(root.resolve(&stage_root)?.as_path());
            return Err(error);
        }
        transactions.execute(root, &legacy.folder, transaction_id)?;
    }
    Ok(count)
}

fn portable(path: &Path) -> Result<RelativePath, StorageError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(StorageError::from)
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
