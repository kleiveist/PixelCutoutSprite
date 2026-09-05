use std::io;

use thiserror::Error;

use crate::domain::DomainError;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("{operation} failed for `{path}`: {source}")]
    Io {
        operation: &'static str,
        path: String,
        #[source]
        source: io::Error,
    },
    #[error("unsafe vault path `{path}`: {reason}")]
    UnsafePath { path: String, reason: String },
    #[error("invalid stored document: {0}")]
    InvalidDocument(#[from] DomainError),
    #[error("document changed since it was loaded")]
    WriteConflict,
    #[error("vault is already held by writer `{owner}`")]
    AlreadyLocked { owner: String },
    #[error("vault initialization needs current confirmation token `{token}`")]
    ConfirmationRequired { token: String },
    #[error("orphaned writer-lock recovery needs current confirmation token `{token}`")]
    LockRecoveryRequired { token: String },
    #[error("the writer lock is actively held and cannot be recovered")]
    ActiveLockProtected,
    #[error("vault cannot be opened: {0}")]
    InvalidVault(String),
    #[error("transaction was interrupted after filesystem step {step}; recovery is required")]
    TransactionInterrupted { step: usize },
    #[error("transaction needs explicit recovery: {0}")]
    RecoveryRequired(String),
    #[error("schema version {found} is newer than supported version {supported}; the file was not changed")]
    FutureSchemaProtected { found: u64, supported: u32 },
    #[error("simulated replacement failure: {0}")]
    ReplacementFailed(String),
}

impl StorageError {
    pub(crate) fn io(operation: &'static str, path: &std::path::Path, source: io::Error) -> Self {
        Self::Io {
            operation,
            path: path.file_name().map_or_else(
                || "vault".to_owned(),
                |name| name.to_string_lossy().into_owned(),
            ),
            source,
        }
    }
}
