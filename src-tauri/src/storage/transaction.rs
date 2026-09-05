use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::{DocumentKind, ObjectId, RelativePath};

use super::{
    validate_managed_relative, JsonStore, ResolvedPath, StorageError, VaultRoot, VersionStamp,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionState {
    Prepared,
    Applying,
    Committed,
    RollingBack,
    RolledBack,
    NeedsRecovery,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionPurpose {
    #[default]
    General,
    ProjectCreate,
    ProjectRename,
    WorkspaceLabelRemove,
    CharacterRename,
    AssetImport,
    ReleaseRevision,
    ExportCompletion,
    TrashMove,
    Migration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionAction {
    Create,
    Replace,
    Move,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceLabelDocument {
    Labels,
    View,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceLabelPathRole {
    Target,
    Stage,
    Backup,
}

/// Constructs the only reserved global paths accepted by a workspace-label removal journal.
/// Project-manifest stages and backups deliberately continue to use ordinary project-local
/// `RelativePath` values.
pub fn workspace_label_remove_path(
    transaction_id: ObjectId,
    document: WorkspaceLabelDocument,
    role: WorkspaceLabelPathRole,
) -> Result<RelativePath, StorageError> {
    let file_name = match document {
        WorkspaceLabelDocument::Labels => "labels.json",
        WorkspaceLabelDocument::View => "ui.json",
    };
    let path = match role {
        WorkspaceLabelPathRole::Target => Path::new(super::ADMIN_DIR).join(file_name),
        WorkspaceLabelPathRole::Stage => Path::new(super::ADMIN_DIR)
            .join("transactions")
            .join(format!("{transaction_id}.stage"))
            .join(file_name),
        WorkspaceLabelPathRole::Backup => Path::new(super::ADMIN_DIR)
            .join("backups/transactions")
            .join(transaction_id.to_string())
            .join(file_name),
    };
    reserved_managed_relative(&path)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransactionStep {
    pub action: TransactionAction,
    pub target: RelativePath,
    pub staged: RelativePath,
    pub backup: Option<RelativePath>,
    pub expected_sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransactionJournal {
    pub schema_version: u32,
    pub id: ObjectId,
    #[serde(default)]
    pub purpose: TransactionPurpose,
    #[serde(default)]
    pub owner_project_id: Option<ObjectId>,
    pub state: TransactionState,
    pub cursor: usize,
    pub steps: Vec<TransactionStep>,
    #[serde(default)]
    pub result_sha256: Vec<Option<String>>,
    #[serde(default)]
    pub plan_sha256: Option<String>,
    pub created_at: String,
}

impl TransactionJournal {
    pub fn new(steps: Vec<TransactionStep>) -> Result<Self, StorageError> {
        Self::with_id(ObjectId::new(), TransactionPurpose::General, steps)
    }

    pub fn with_id(
        id: ObjectId,
        purpose: TransactionPurpose,
        steps: Vec<TransactionStep>,
    ) -> Result<Self, StorageError> {
        let journal = Self {
            schema_version: 1,
            id,
            purpose,
            owner_project_id: None,
            state: TransactionState::Prepared,
            cursor: 0,
            result_sha256: vec![None; steps.len()],
            plan_sha256: None,
            steps,
            created_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        };
        journal.validate()?;
        Ok(journal)
    }

    pub fn validate(&self) -> Result<(), StorageError> {
        if self.schema_version != 1 || self.cursor > self.steps.len() || self.steps.is_empty() {
            return Err(StorageError::InvalidVault(
                "invalid transaction version, cursor, or empty plan".to_owned(),
            ));
        }
        if (self.state == TransactionState::Prepared && self.cursor != 0)
            || (self.state == TransactionState::Committed && self.cursor != self.steps.len())
            || (self.state == TransactionState::RolledBack && self.cursor != 0)
        {
            return Err(StorageError::InvalidVault(
                "transaction state and cursor are inconsistent".to_owned(),
            ));
        }
        if !self.result_sha256.is_empty() && self.result_sha256.len() != self.steps.len() {
            return Err(StorageError::InvalidVault(
                "transaction result digest count does not match its steps".to_owned(),
            ));
        }
        validate_steps(self.purpose, &self.steps)?;
        for digest in self.result_sha256.iter().flatten() {
            validate_digest(digest)?;
        }
        if let Some(seal) = &self.plan_sha256 {
            validate_digest(seal)?;
            if *seal != plan_digest(self)? {
                return Err(StorageError::RecoveryRequired(
                    "transaction plan integrity check failed".to_owned(),
                ));
            }
        }
        chrono::DateTime::parse_from_rfc3339(&self.created_at).map_err(|_| {
            StorageError::InvalidVault("transaction created_at is not RFC 3339".to_owned())
        })?;
        Ok(())
    }

    pub fn advance(&mut self) -> Result<(), StorageError> {
        if !matches!(
            self.state,
            TransactionState::Prepared | TransactionState::Applying
        ) {
            return Err(StorageError::InvalidVault(
                "only a prepared or applying transaction can advance".to_owned(),
            ));
        }
        self.state = TransactionState::Applying;
        self.cursor = (self.cursor + 1).min(self.steps.len());
        if self.cursor == self.steps.len() {
            self.state = TransactionState::Committed;
        }
        Ok(())
    }

    fn is_sealed(&self) -> bool {
        self.plan_sha256.is_some()
            && self.result_sha256.len() == self.steps.len()
            && self.result_sha256.iter().all(Option::is_some)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecoveryCandidate {
    pub transaction_id: ObjectId,
    pub project: RelativePath,
    pub journal: RelativePath,
    pub purpose: TransactionPurpose,
    pub state: TransactionState,
    pub completed_steps: usize,
    pub total_steps: usize,
    pub can_resume: bool,
    pub can_rollback: bool,
    pub issue: Option<String>,
}

impl RecoveryCandidate {
    pub fn disable_actions(&mut self, issue: impl Into<String>) {
        self.can_resume = false;
        self.can_rollback = false;
        self.issue = Some(issue.into());
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryChoice {
    Resume,
    Rollback,
}

pub trait TransactionFault: Clone + Send + Sync + 'static {
    fn after_filesystem_step(
        &self,
        _purpose: TransactionPurpose,
        _completed_step: usize,
    ) -> Result<(), StorageError> {
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NoTransactionFault;

impl TransactionFault for NoTransactionFault {}

#[derive(Debug, Clone, Copy)]
pub struct InterruptAfterStep {
    pub completed_step: usize,
}

impl TransactionFault for InterruptAfterStep {
    fn after_filesystem_step(
        &self,
        _purpose: TransactionPurpose,
        completed_step: usize,
    ) -> Result<(), StorageError> {
        if completed_step == self.completed_step {
            Err(StorageError::TransactionInterrupted {
                step: completed_step,
            })
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Clone)]
pub struct TransactionService<F = NoTransactionFault> {
    fault: F,
}

impl Default for TransactionService<NoTransactionFault> {
    fn default() -> Self {
        Self {
            fault: NoTransactionFault,
        }
    }
}

impl<F: TransactionFault> TransactionService<F> {
    pub fn with_fault(fault: F) -> Self {
        Self { fault }
    }

    /// Creates a sealed journal at the only supported project-local location. Every staged source
    /// must already exist so recovery never has to trust content that was produced after the plan.
    pub fn prepare(
        &self,
        root: &VaultRoot,
        project_folder: &Path,
        id: ObjectId,
        purpose: TransactionPurpose,
        steps: Vec<TransactionStep>,
    ) -> Result<TransactionJournal, StorageError> {
        let owner = validate_transaction_owner(project_folder, purpose, id)?;
        let location = journal_path_for_owner(Path::new(owner.as_str()), id)?;
        let mut journal = TransactionJournal::with_id(id, purpose, steps)?;
        journal.owner_project_id = Some(read_initial_owner_id(
            root,
            Path::new(owner.as_str()),
            &journal,
        )?);
        validate_project_scope(
            Path::new(owner.as_str()),
            Path::new(owner.as_str()),
            &journal,
        )?;
        for (index, step) in journal.steps.iter().enumerate() {
            let staged = root.resolve(Path::new(step.staged.as_str()))?;
            let target = root.resolve(Path::new(step.target.as_str()))?;
            if !staged.as_path().exists() {
                return Err(StorageError::RecoveryRequired(format!(
                    "staged transaction source `{}` is missing",
                    step.staged
                )));
            }
            if step.action == TransactionAction::Move {
                if let Some(expected) = step.expected_sha256.as_deref() {
                    verify_move_source_digest(staged.as_path(), expected)?;
                }
            }
            match step.action {
                TransactionAction::Create | TransactionAction::Move
                    if target.as_path().exists() =>
                {
                    return Err(StorageError::WriteConflict);
                }
                TransactionAction::Replace => verify_raw_file_digest(
                    target.as_path(),
                    step.expected_sha256
                        .as_deref()
                        .expect("replacement target digest was validated"),
                )?,
                TransactionAction::Create | TransactionAction::Move => {}
            }
            let digest = if step.action == TransactionAction::Move && staged.as_path().is_dir() {
                let digest = projected_move_digest(
                    root,
                    Path::new(step.staged.as_str()),
                    &journal.steps[..index],
                )?;
                if let Some(expected) = step.expected_sha256.as_deref() {
                    // Do not absorb a directory mutation that races the first precondition check
                    // into the sealed result plan. Changes after this check are rejected by the
                    // result digest before the move is applied.
                    verify_move_source_digest(staged.as_path(), expected)?;
                }
                digest
            } else {
                hash_managed_path(staged.as_path())?
            };
            journal.result_sha256[index] = Some(digest);
        }
        journal.plan_sha256 = Some(plan_digest(&journal)?);
        journal.validate()?;
        let resolved = root.resolve(Path::new(location.as_str()))?;
        ensure_resolved_parent(root, &resolved)?;
        let bytes = journal_bytes(&journal)?;
        JsonStore::default().create_bytes(&resolved, &bytes, validate_journal_bytes)?;
        Ok(journal)
    }

    pub fn journal_path(project_folder: &Path, id: ObjectId) -> Result<RelativePath, StorageError> {
        let owner = validate_journal_owner_folder(project_folder)?;
        journal_path_for_owner(Path::new(owner.as_str()), id)
    }

    pub fn execute(
        &self,
        root: &VaultRoot,
        project_folder: &Path,
        id: ObjectId,
    ) -> Result<TransactionJournal, StorageError> {
        let location = Self::journal_path(project_folder, id)?;
        self.execute_at(root, Path::new(location.as_str()))
    }

    pub fn recover_candidate(
        &self,
        root: &VaultRoot,
        transaction_id: ObjectId,
        choice: RecoveryChoice,
    ) -> Result<TransactionJournal, StorageError> {
        let location = locate_open_journal(root, transaction_id)?;
        match choice {
            RecoveryChoice::Resume => self.execute_at(root, &location),
            RecoveryChoice::Rollback => self.rollback_at(root, &location),
        }
    }

    pub fn scan_open(root: &VaultRoot) -> Result<Vec<RecoveryCandidate>, StorageError> {
        let mut candidates = Vec::new();
        let mut ids = HashMap::new();
        for location in collect_journal_locations(root)? {
            let (journal, current_owner, _) = read_journal(root, &location)?;
            if matches!(
                journal.state,
                TransactionState::Committed | TransactionState::RolledBack
            ) {
                if journal.is_sealed() {
                    verify_terminal_outcome(root, &journal)?;
                }
                continue;
            }
            if ids.insert(journal.id, location.clone()).is_some() {
                return Err(StorageError::RecoveryRequired(format!(
                    "transaction id {} occurs in more than one project journal",
                    journal.id
                )));
            }
            let sealed = journal.is_sealed();
            let (can_resume, can_rollback, issue) = if sealed {
                recovery_capabilities(root, &journal)
            } else {
                (
                    false,
                    false,
                    Some(
                        "legacy journal has no complete result hashes and cannot be replayed automatically"
                            .to_owned(),
                    ),
                )
            };
            candidates.push(RecoveryCandidate {
                transaction_id: journal.id,
                project: if current_owner == Path::new(super::ADMIN_DIR) {
                    reserved_managed_relative(&current_owner)?
                } else {
                    portable_relative(&current_owner)?
                },
                journal: if location.starts_with(Path::new(super::ADMIN_DIR)) {
                    reserved_managed_relative(&location)?
                } else {
                    portable_relative(&location)?
                },
                purpose: journal.purpose,
                state: journal.state,
                completed_steps: journal.cursor,
                total_steps: journal.steps.len(),
                can_resume,
                can_rollback,
                issue,
            });
        }
        candidates.sort_by(|left, right| {
            left.project
                .as_str()
                .cmp(right.project.as_str())
                .then(left.transaction_id.cmp(&right.transaction_id))
        });
        Ok(candidates)
    }

    /// Removes administration artifacts for transactions whose terminal journal was made durable.
    /// This is also run when a writer opens the vault, closing the small crash window between the
    /// terminal journal write and immediate cleanup.
    pub fn cleanup_terminal(root: &VaultRoot) -> Result<usize, StorageError> {
        let mut removed = 0;
        for location in collect_journal_locations(root)? {
            let (journal, _, _) = read_journal(root, &location)?;
            if matches!(
                journal.state,
                TransactionState::Committed | TransactionState::RolledBack
            ) && journal.is_sealed()
            {
                verify_terminal_outcome(root, &journal)?;
                cleanup_terminal_journal(root, &location, &journal)?;
                removed += 1;
            }
        }
        Ok(removed)
    }

    /// Quarantines project-creation trees left before their journal was durably created. This is
    /// called only while holding the vault writer lease; a valid journal remains normal recovery.
    pub fn quarantine_orphan_project_creations(root: &VaultRoot) -> Result<usize, StorageError> {
        quarantine_orphan_project_creation_trees(root)
    }

    fn execute_at(
        &self,
        root: &VaultRoot,
        initial_location: &Path,
    ) -> Result<TransactionJournal, StorageError> {
        let mut location = initial_location.to_path_buf();
        let (mut journal, _, mut stamp) = read_journal(root, &location)?;
        require_sealed(&journal)?;
        if journal.state == TransactionState::Committed {
            verify_terminal_outcome(root, &journal)?;
            let _ = cleanup_terminal_journal(root, &location, &journal);
            return Ok(journal);
        }
        if journal.state == TransactionState::RolledBack {
            verify_terminal_outcome(root, &journal)?;
            let _ = cleanup_terminal_journal(root, &location, &journal);
            return Ok(journal);
        }
        if journal.state == TransactionState::RollingBack {
            return Err(StorageError::RecoveryRequired(
                "a rollback was interrupted; choose rollback again".to_owned(),
            ));
        }
        let physical = reconcile_physical_plan(root, &journal)?;
        if physical.occupied() {
            journal.state = TransactionState::NeedsRecovery;
            persist_at(root, &location, &journal, &mut stamp)?;
            return Err(StorageError::WriteConflict);
        }
        let (applied, midway) = physical.progress()?;
        if (journal.state == TransactionState::Prepared && (applied != 0 || midway.is_some()))
            || applied < journal.cursor
            || applied > journal.cursor.saturating_add(1)
            || midway.is_some_and(|index| index != journal.cursor)
        {
            return Err(StorageError::RecoveryRequired(
                "journal cursor does not match the hashed filesystem progress".to_owned(),
            ));
        }
        journal.cursor = applied;
        journal.state = if applied == journal.steps.len() {
            TransactionState::Committed
        } else {
            TransactionState::Applying
        };
        persist_at(root, &location, &journal, &mut stamp)?;
        if journal.state == TransactionState::Committed {
            let _ = cleanup_terminal_journal(root, &location, &journal);
            return Ok(journal);
        }
        while journal.cursor < journal.steps.len() {
            let index = journal.cursor;
            let digest = journal.result_sha256[index]
                .as_deref()
                .expect("sealed journal result hash was validated");
            if let Err(error) = apply_step(root, &journal.steps[index], digest) {
                journal.state = TransactionState::NeedsRecovery;
                let _ = persist_at(root, &location, &journal, &mut stamp);
                return Err(error);
            }
            remap_location(&mut location, &journal.steps[index], false);
            self.fault
                .after_filesystem_step(journal.purpose, index + 1)?;
            journal.advance()?;
            persist_at(root, &location, &journal, &mut stamp)?;
        }
        let _ = cleanup_terminal_journal(root, &location, &journal);
        Ok(journal)
    }

    fn rollback_at(
        &self,
        root: &VaultRoot,
        initial_location: &Path,
    ) -> Result<TransactionJournal, StorageError> {
        let mut location = initial_location.to_path_buf();
        let (mut journal, _, mut stamp) = read_journal(root, &location)?;
        require_sealed(&journal)?;
        if journal.state == TransactionState::Committed {
            verify_terminal_outcome(root, &journal)?;
            return Err(StorageError::RecoveryRequired(
                "a committed transaction is not an open recovery candidate".to_owned(),
            ));
        }
        if journal.state == TransactionState::RolledBack {
            verify_terminal_outcome(root, &journal)?;
            let _ = cleanup_terminal_journal(root, &location, &journal);
            return Ok(journal);
        }
        let physical = reconcile_physical_plan(root, &journal)?;
        let (applied, midway) = physical.progress()?;
        journal.state = TransactionState::RollingBack;
        journal.cursor = applied;
        persist_at(root, &location, &journal, &mut stamp)?;
        let upper = midway.map_or(applied, |index| index + 1);
        for index in (0..upper).rev() {
            let digest = journal.result_sha256[index]
                .as_deref()
                .expect("sealed journal result hash was validated");
            rollback_step(root, &journal.steps[index], digest)?;
            remap_location(&mut location, &journal.steps[index], true);
            journal.cursor = index;
            persist_at(root, &location, &journal, &mut stamp)?;
        }
        journal.cursor = 0;
        journal.state = TransactionState::RolledBack;
        persist_at(root, &location, &journal, &mut stamp)?;
        let _ = cleanup_terminal_journal(root, &location, &journal);
        Ok(journal)
    }
}

include!("transaction/recovery.rs");
include!("transaction/scope.rs");
include!("transaction/cleanup.rs");
include!("transaction/filesystem.rs");
