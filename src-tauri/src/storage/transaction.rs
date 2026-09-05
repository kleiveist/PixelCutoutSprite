use std::collections::HashSet;

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::domain::{ObjectId, RelativePath};

use super::{JsonStore, ResolvedPath, StorageError};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionAction {
    Create,
    Replace,
    Move,
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
    pub state: TransactionState,
    pub cursor: usize,
    pub steps: Vec<TransactionStep>,
    pub created_at: String,
}

impl TransactionJournal {
    pub fn new(steps: Vec<TransactionStep>) -> Result<Self, StorageError> {
        let journal = Self {
            schema_version: 1,
            id: ObjectId::new(),
            state: TransactionState::Prepared,
            cursor: 0,
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
        let mut targets = HashSet::new();
        for step in &self.steps {
            RelativePath::parse(step.target.as_str())?;
            RelativePath::parse(step.staged.as_str())?;
            if let Some(backup) = &step.backup {
                RelativePath::parse(backup.as_str())?;
            }
            if !targets.insert(step.target.as_str()) {
                return Err(StorageError::InvalidVault(
                    "a transaction may target a path only once".to_owned(),
                ));
            }
        }
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
}

pub fn write_journal(
    path: &ResolvedPath,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    journal.validate()?;
    let bytes = serde_json::to_vec_pretty(journal)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    JsonStore::default().write_bytes(path, &bytes, |candidate| {
        let decoded: TransactionJournal = serde_json::from_slice(candidate)
            .map_err(|error| crate::domain::DomainError::InvalidJson(error.to_string()))?;
        decoded
            .validate()
            .map_err(|error| crate::domain::DomainError::invalid("journal", error.to_string()))
    })
}
