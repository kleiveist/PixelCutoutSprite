use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::storage::{validate_managed_relative, StorageError, VaultRoot};

pub mod data_folder;

pub const WORKSPACE_ADMIN_DIR: &str = ".PixelStudio";
pub const PROMPT_VAULT_DIR: &str = ".PixelPrompt";
const WORKSPACE_KIND: &str = "pixelStudioVault";
const MAX_MANAGED_FILE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceMetadata {
    pub schema_version: u32,
    pub kind: String,
    pub vault_id: String,
    pub created_at: String,
}

impl WorkspaceMetadata {
    fn new(vault_id: String) -> Self {
        Self {
            schema_version: 1,
            kind: WORKSPACE_KIND.to_owned(),
            vault_id,
            created_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        }
    }

    fn validate(&self) -> Result<(), StorageError> {
        if self.schema_version != 1 || self.kind != WORKSPACE_KIND {
            return Err(StorageError::InvalidVault(
                "unsupported .PixelStudio/vault.json metadata".to_owned(),
            ));
        }
        validate_portable_id(&self.vault_id)?;
        chrono::DateTime::parse_from_rfc3339(&self.created_at).map_err(|_| {
            StorageError::InvalidVault("workspace createdAt must be RFC 3339".to_owned())
        })?;
        Ok(())
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WriteExpectation {
    pub expected_revision: Option<u64>,
    pub expected_sha256: Option<String>,
    pub create_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteReceipt {
    pub relative_path: String,
    pub revision: Option<u64>,
    pub sha256: String,
}

#[derive(Debug, Clone)]
pub struct ManagedFileWrite {
    pub relative_path: PathBuf,
    pub bytes: Vec<u8>,
    pub expectation: WriteExpectation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum FileSetState {
    Prepared,
    Applying,
    Committed,
    RollingBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FileSetStep {
    target: String,
    staged: String,
    backup: String,
    before_sha256: Option<String>,
    result_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FileSetJournal {
    schema_version: u32,
    transaction_id: String,
    state: FileSetState,
    cursor: usize,
    steps: Vec<FileSetStep>,
}

pub trait WorkspaceFault: Clone + Send + Sync + 'static {
    fn after_publish_step(&self, _completed_steps: usize) -> Result<(), StorageError> {
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NoWorkspaceFault;

impl WorkspaceFault for NoWorkspaceFault {}

#[derive(Debug, Clone, Copy)]
pub struct InterruptWorkspaceAfterStep(pub usize);

impl WorkspaceFault for InterruptWorkspaceAfterStep {
    fn after_publish_step(&self, completed_steps: usize) -> Result<(), StorageError> {
        if completed_steps == self.0 {
            Err(StorageError::TransactionInterrupted {
                step: completed_steps,
            })
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Clone)]
pub struct WorkspaceWriter<F = NoWorkspaceFault> {
    root: VaultRoot,
    fault: F,
}

impl WorkspaceWriter<NoWorkspaceFault> {
    pub fn new(root: VaultRoot) -> Self {
        Self {
            root,
            fault: NoWorkspaceFault,
        }
    }
}

impl<F: WorkspaceFault> WorkspaceWriter<F> {
    pub fn with_fault(root: VaultRoot, fault: F) -> Self {
        Self { root, fault }
    }

    pub fn read_json(&self, relative: &Path) -> Result<(Value, WriteReceipt), StorageError> {
        let bytes = read_regular_bounded(&self.root, relative)?;
        let value = parse_json(&bytes, relative)?;
        let receipt = receipt(relative, &bytes, json_revision(&value));
        Ok((value, receipt))
    }

    pub fn write_json(
        &self,
        relative: &Path,
        value: &Value,
        expectation: &WriteExpectation,
    ) -> Result<WriteReceipt, StorageError> {
        let bytes = serde_json::to_vec_pretty(value)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        parse_json(&bytes, relative)?;
        self.write_bytes(relative, &bytes, expectation)
    }

    pub fn write_bytes(
        &self,
        relative: &Path,
        bytes: &[u8],
        expectation: &WriteExpectation,
    ) -> Result<WriteReceipt, StorageError> {
        validate_workspace_relative(relative)?;
        if bytes.len() > MAX_MANAGED_FILE_BYTES {
            return Err(StorageError::InvalidVault(
                "managed file exceeds the 16 MiB limit".to_owned(),
            ));
        }
        let parent = relative.parent().ok_or_else(|| StorageError::UnsafePath {
            path: portable(relative),
            reason: "managed file needs a parent directory".to_owned(),
        })?;
        self.root.ensure_directory(parent)?;
        let target = self.root.resolve(relative)?;
        let before = read_optional_regular(target.as_path(), relative)?;
        check_expectation(before.as_deref(), expectation)?;

        let staged_relative = sibling_relative(relative, &format!("{}.stage", uuid::Uuid::new_v4()))?;
        let staged = self.root.resolve(&staged_relative)?;
        stage_file(staged.as_path(), relative, bytes)?;
        let verified = fs::read(staged.as_path())
            .map_err(|error| StorageError::io("verify staged workspace file", relative, error))?;
        if verified != bytes {
            let _ = fs::remove_file(staged.as_path());
            return Err(StorageError::ReplacementFailed(
                "staged bytes changed before publication".to_owned(),
            ));
        }

        // Resolve and inspect once more immediately before publish. This closes symlink and
        // coarse external-change races; the writer lease serializes cooperating app instances.
        let target = self.root.resolve(relative)?;
        let current = read_optional_regular(target.as_path(), relative)?;
        if digest_optional(current.as_deref()) != digest_optional(before.as_deref()) {
            let _ = fs::remove_file(staged.as_path());
            return Err(StorageError::WriteConflict);
        }
        let publish = if before.is_none() {
            fs::hard_link(staged.as_path(), target.as_path())
                .map_err(|error| map_create_error(relative, error))
        } else {
            fs::rename(staged.as_path(), target.as_path())
                .map_err(|error| StorageError::io("publish workspace file", relative, error))
        };
        if publish.is_err() {
            let _ = fs::remove_file(staged.as_path());
        } else if before.is_none() {
            let _ = fs::remove_file(staged.as_path());
        }
        publish?;
        sync_directory(target.as_path().parent());
        let value = serde_json::from_slice::<Value>(bytes).ok();
        Ok(receipt(relative, bytes, value.as_ref().and_then(json_revision)))
    }

    /**
     * Creates a recoverable same-vault link without replacing an existing
     * target. Existing identical targets are treated as an interrupted retry.
     */
    pub fn link_file(
        &self,
        source: &Path,
        target: &Path,
        expected_sha256: &str,
    ) -> Result<WriteReceipt, StorageError> {
        validate_workspace_relative(source)?;
        validate_workspace_relative(target)?;
        validate_digest(expected_sha256)?;
        if source == target {
            let bytes = read_regular_bounded(&self.root, source)?;
            if digest(&bytes) != expected_sha256 {
                return Err(StorageError::WriteConflict);
            }
            let revision = serde_json::from_slice::<Value>(&bytes)
                .ok()
                .as_ref()
                .and_then(json_revision);
            return Ok(receipt(target, &bytes, revision));
        }
        let source_bytes = read_regular_bounded(&self.root, source)?;
        if digest(&source_bytes) != expected_sha256 {
            return Err(StorageError::WriteConflict);
        }
        let parent = target.parent().ok_or_else(|| StorageError::UnsafePath {
            path: portable(target),
            reason: "managed file needs a parent directory".to_owned(),
        })?;
        self.root.ensure_directory(parent)?;
        let source_path = self.root.resolve(source)?;
        let target_path = self.root.resolve(target)?;
        if let Some(existing) = read_optional_regular(target_path.as_path(), target)? {
            if digest(&existing) != expected_sha256 {
                return Err(StorageError::WriteConflict);
            }
            let revision = serde_json::from_slice::<Value>(&existing)
                .ok()
                .as_ref()
                .and_then(json_revision);
            return Ok(receipt(target, &existing, revision));
        }
        fs::hard_link(source_path.as_path(), target_path.as_path())
            .map_err(|error| map_create_error(target, error))?;
        let linked = read_regular_bounded(&self.root, target)?;
        if digest(&linked) != expected_sha256 {
            return Err(StorageError::RecoveryRequired(format!(
                "linked file `{}` changed during relocation",
                portable(target)
            )));
        }
        sync_directory(target_path.as_path().parent());
        let revision = serde_json::from_slice::<Value>(&linked)
            .ok()
            .as_ref()
            .and_then(json_revision);
        Ok(receipt(target, &linked, revision))
    }

    pub fn remove_file_if_unchanged(
        &self,
        relative: &Path,
        expected_sha256: &str,
    ) -> Result<bool, StorageError> {
        validate_workspace_relative(relative)?;
        validate_digest(expected_sha256)?;
        let resolved = self.root.resolve(relative)?;
        let Some(bytes) = read_optional_regular(resolved.as_path(), relative)? else {
            return Ok(false);
        };
        if digest(&bytes) != expected_sha256 {
            return Err(StorageError::WriteConflict);
        }
        fs::remove_file(resolved.as_path())
            .map_err(|error| StorageError::io("remove relocated workspace file", relative, error))?;
        sync_directory(resolved.as_path().parent());
        Ok(true)
    }

    /**
     * Updates a JSON document and relocates it without ever overwriting the
     * destination. The hard-link/remove sequence is idempotent across crashes.
     */
    pub fn relocate_json(
        &self,
        source: &Path,
        target: &Path,
        value: &Value,
        expectation: &WriteExpectation,
    ) -> Result<WriteReceipt, StorageError> {
        if source == target {
            return self.write_json(target, value, expectation);
        }
        validate_workspace_relative(source)?;
        validate_workspace_relative(target)?;
        let bytes = serde_json::to_vec_pretty(value)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let desired_sha256 = digest(&bytes);
        let target_path = self.root.resolve(target)?;
        if let Some(existing) = read_optional_regular(target_path.as_path(), target)? {
            if existing != bytes {
                return Err(StorageError::WriteConflict);
            }
            let source_path = self.root.resolve(source)?;
            if let Some(source_bytes) = read_optional_regular(source_path.as_path(), source)? {
                if source_bytes != bytes {
                    return Err(StorageError::WriteConflict);
                }
                self.remove_file_if_unchanged(source, &desired_sha256)?;
            }
            return Ok(receipt(target, &existing, json_revision(value)));
        }

        let source_path = self.root.resolve(source)?;
        let source_bytes = read_optional_regular(source_path.as_path(), source)?
            .ok_or(StorageError::WriteConflict)?;
        if source_bytes != bytes {
            self.write_bytes(source, &bytes, expectation)?;
        }
        self.link_file(source, target, &desired_sha256)?;
        self.remove_file_if_unchanged(source, &desired_sha256)?;
        Ok(receipt(target, &bytes, json_revision(value)))
    }

    pub fn publish_file_set(
        &self,
        writes: &[ManagedFileWrite],
    ) -> Result<Vec<WriteReceipt>, StorageError> {
        if writes.is_empty() {
            return Err(StorageError::InvalidVault(
                "a managed file set cannot be empty".to_owned(),
            ));
        }
        let transaction_id = uuid::Uuid::new_v4().to_string();
        let transaction_root = Path::new(WORKSPACE_ADMIN_DIR)
            .join("transactions")
            .join(&transaction_id);
        self.root.ensure_directory(&transaction_root.join("stage"))?;
        self.root.ensure_directory(&transaction_root.join("backup"))?;

        let mut seen = std::collections::HashSet::new();
        let mut steps = Vec::with_capacity(writes.len());
        for (index, write) in writes.iter().enumerate() {
            validate_workspace_relative(&write.relative_path)?;
            let key = portable(&write.relative_path).to_lowercase();
            if !seen.insert(key) {
                return Err(StorageError::WriteConflict);
            }
            if write.bytes.len() > MAX_MANAGED_FILE_BYTES {
                return Err(StorageError::InvalidVault(
                    "managed file exceeds the 16 MiB limit".to_owned(),
                ));
            }
            let parent = write.relative_path.parent().ok_or_else(|| StorageError::UnsafePath {
                path: portable(&write.relative_path),
                reason: "managed file needs a parent directory".to_owned(),
            })?;
            self.root.ensure_directory(parent)?;
            let target = self.root.resolve(&write.relative_path)?;
            let before = read_optional_regular(target.as_path(), &write.relative_path)?;
            check_expectation(before.as_deref(), &write.expectation)?;
            let staged_relative = transaction_root.join("stage").join(format!("{index}.data"));
            let staged = self.root.resolve(&staged_relative)?;
            stage_file(staged.as_path(), &write.relative_path, &write.bytes)?;
            steps.push(FileSetStep {
                target: portable(&write.relative_path),
                staged: portable(&staged_relative),
                backup: portable(&transaction_root.join("backup").join(format!("{index}.data"))),
                before_sha256: digest_optional(before.as_deref()),
                result_sha256: digest(&write.bytes),
            });
        }
        let journal_relative = transaction_root.join("journal.json");
        let mut journal = FileSetJournal {
            schema_version: 1,
            transaction_id,
            state: FileSetState::Prepared,
            cursor: 0,
            steps,
        };
        self.persist_journal(&journal_relative, &journal)?;
        self.resume_journal(&journal_relative, &mut journal)?;

        let mut receipts = Vec::with_capacity(writes.len());
        for write in writes {
            let value = serde_json::from_slice::<Value>(&write.bytes).ok();
            receipts.push(receipt(
                &write.relative_path,
                &write.bytes,
                value.as_ref().and_then(json_revision),
            ));
        }
        Ok(receipts)
    }

    pub fn recover_file_sets(&self) -> Result<usize, StorageError> {
        let root_relative = Path::new(WORKSPACE_ADMIN_DIR).join("transactions");
        let root = self.root.resolve(&root_relative)?;
        let entries = match fs::read_dir(root.as_path()) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
            Err(error) => {
                return Err(StorageError::io(
                    "scan workspace transactions",
                    &root_relative,
                    error,
                ))
            }
        };
        let mut recovered = 0;
        for entry in entries {
            let entry = entry.map_err(|error| {
                StorageError::io("read workspace transaction", &root_relative, error)
            })?;
            let metadata = entry.file_type().map_err(|error| {
                StorageError::io("inspect workspace transaction", &entry.path(), error)
            })?;
            if metadata.is_symlink() || !metadata.is_dir() {
                return Err(StorageError::UnsafePath {
                    path: entry.file_name().to_string_lossy().into_owned(),
                    reason: "transaction entry must be a real directory".to_owned(),
                });
            }
            let journal_relative = root_relative.join(entry.file_name()).join("journal.json");
            let bytes = read_regular_bounded(&self.root, &journal_relative)?;
            let mut journal: FileSetJournal = serde_json::from_slice(&bytes)
                .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
            validate_journal(&journal)?;
            if journal.state == FileSetState::Committed {
                cleanup_transaction(&self.root, &journal_relative)?;
            } else {
                self.resume_journal(&journal_relative, &mut journal)?;
            }
            recovered += 1;
        }
        Ok(recovered)
    }

    fn resume_journal(
        &self,
        journal_relative: &Path,
        journal: &mut FileSetJournal,
    ) -> Result<(), StorageError> {
        validate_journal(journal)?;
        journal.state = FileSetState::Applying;
        self.persist_journal(journal_relative, journal)?;
        while journal.cursor < journal.steps.len() {
            let step = &journal.steps[journal.cursor];
            publish_step(&self.root, step)?;
            journal.cursor += 1;
            self.persist_journal(journal_relative, journal)?;
            self.fault.after_publish_step(journal.cursor)?;
        }
        journal.state = FileSetState::Committed;
        self.persist_journal(journal_relative, journal)?;
        cleanup_transaction(&self.root, journal_relative)
    }

    fn persist_journal(
        &self,
        relative: &Path,
        journal: &FileSetJournal,
    ) -> Result<(), StorageError> {
        let bytes = serde_json::to_vec_pretty(journal)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let expectation = if self.root.resolve(relative)?.as_path().exists() {
            let current = read_regular_bounded(&self.root, relative)?;
            WriteExpectation {
                expected_sha256: Some(digest(&current)),
                ..WriteExpectation::default()
            }
        } else {
            WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            }
        };
        self.write_bytes(relative, &bytes, &expectation).map(|_| ())
    }
}

pub fn preflight_workspace(root: &VaultRoot, expected_vault_id: Option<&str>) -> Result<(), StorageError> {
    let admin = root.path().join(WORKSPACE_ADMIN_DIR);
    match fs::symlink_metadata(&admin) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(StorageError::io("inspect .PixelStudio", &admin, error)),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(StorageError::UnsafePath {
                path: WORKSPACE_ADMIN_DIR.to_owned(),
                reason: "workspace administration must be a real directory".to_owned(),
            })
        }
        Ok(_) => {}
    }
    let manifest = Path::new(WORKSPACE_ADMIN_DIR).join("vault.json");
    let bytes = read_regular_bounded(root, &manifest)?;
    let metadata: WorkspaceMetadata = serde_json::from_slice(&bytes)
        .map_err(|error| StorageError::InvalidVault(format!("invalid .PixelStudio/vault.json: {error}")))?;
    metadata.validate()?;
    if expected_vault_id.is_some_and(|expected| expected != metadata.vault_id) {
        return Err(StorageError::InvalidVault(
            ".PixelStudio vaultId does not match the selected vault".to_owned(),
        ));
    }
    Ok(())
}

pub fn ensure_workspace(root: &VaultRoot, vault_id: &str) -> Result<WorkspaceMetadata, StorageError> {
    validate_portable_id(vault_id)?;
    // Reject a hostile pre-existing prompt namespace before creating metadata.
    // Failed initialization must not leave a vault looking initialized.
    if let Ok(metadata) = fs::symlink_metadata(root.path().join(PROMPT_VAULT_DIR)) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(StorageError::UnsafePath {
                path: PROMPT_VAULT_DIR.to_owned(),
                reason: "prompt workspace must be a real directory".to_owned(),
            });
        }
    }
    preflight_workspace(root, Some(vault_id)).or_else(|error| {
        if root.path().join(WORKSPACE_ADMIN_DIR).exists() {
            Err(error)
        } else {
            Ok(())
        }
    })?;
    root.ensure_directory(Path::new(WORKSPACE_ADMIN_DIR))?;
    let manifest = Path::new(WORKSPACE_ADMIN_DIR).join("vault.json");
    let writer = WorkspaceWriter::new(root.clone());
    let metadata = if root.resolve(&manifest)?.as_path().exists() {
        let (value, _) = writer.read_json(&manifest)?;
        let value: WorkspaceMetadata = serde_json::from_value(value)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        value.validate()?;
        value
    } else {
        let value = WorkspaceMetadata::new(vault_id.to_owned());
        let json = serde_json::to_value(&value)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        writer.write_json(
            &manifest,
            &json,
            &WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            },
        )?;
        value
    };
    let prompt = root.ensure_directory(Path::new(PROMPT_VAULT_DIR))?;
    let prompt_metadata = fs::symlink_metadata(prompt.as_path())
        .map_err(|error| StorageError::io("inspect .PixelPrompt", Path::new(PROMPT_VAULT_DIR), error))?;
    if prompt_metadata.file_type().is_symlink() || !prompt_metadata.is_dir() {
        return Err(StorageError::UnsafePath {
            path: PROMPT_VAULT_DIR.to_owned(),
            reason: "prompt workspace must be a real directory".to_owned(),
        });
    }
    Ok(metadata)
}

fn publish_step(root: &VaultRoot, step: &FileSetStep) -> Result<(), StorageError> {
    let target_relative = Path::new(&step.target);
    let staged_relative = Path::new(&step.staged);
    let backup_relative = Path::new(&step.backup);
    validate_workspace_relative(target_relative)?;
    let target = root.resolve(target_relative)?;
    let staged = root.resolve(staged_relative)?;
    let backup = root.resolve(backup_relative)?;
    let current = read_optional_regular(target.as_path(), target_relative)?;
    let current_digest = digest_optional(current.as_deref());
    if current_digest.as_deref() == Some(step.result_sha256.as_str()) {
        return Ok(());
    }
    // Resume the narrow crash window after the old target was moved to the
    // transaction backup but before the staged replacement was published.
    let backup_bytes = read_optional_regular(backup.as_path(), backup_relative)?;
    let backup_digest = digest_optional(backup_bytes.as_deref());
    let target_already_backed_up = current.is_none()
        && step.before_sha256.is_some()
        && backup_digest == step.before_sha256;
    if current_digest != step.before_sha256 && !target_already_backed_up {
        return Err(StorageError::WriteConflict);
    }
    if !staged.as_path().exists() {
        return Err(StorageError::RecoveryRequired(format!(
            "staged file `{}` is missing",
            step.staged
        )));
    }
    let staged_bytes = fs::read(staged.as_path())
        .map_err(|error| StorageError::io("read staged file set member", staged_relative, error))?;
    if digest(&staged_bytes) != step.result_sha256 {
        return Err(StorageError::RecoveryRequired(format!(
            "staged file `{}` changed",
            step.staged
        )));
    }
    if current.is_some() {
        if backup_bytes.is_some() {
            return Err(StorageError::RecoveryRequired(format!(
                "unexpected backup already exists for `{}`",
                step.target
            )));
        }
        fs::rename(target.as_path(), backup.as_path())
            .map_err(|error| StorageError::io("backup file set member", target_relative, error))?;
    }
    if let Err(error) = fs::rename(staged.as_path(), target.as_path()) {
        if backup.as_path().exists() {
            let _ = fs::rename(backup.as_path(), target.as_path());
        }
        return Err(StorageError::io(
            "publish file set member",
            target_relative,
            error,
        ));
    }
    sync_directory(target.as_path().parent());
    Ok(())
}

fn validate_journal(journal: &FileSetJournal) -> Result<(), StorageError> {
    if journal.schema_version != 1
        || journal.steps.is_empty()
        || journal.cursor > journal.steps.len()
        || journal.transaction_id.is_empty()
    {
        return Err(StorageError::RecoveryRequired(
            "invalid workspace transaction journal".to_owned(),
        ));
    }
    for step in &journal.steps {
        validate_workspace_relative(Path::new(&step.target))?;
        validate_workspace_relative(Path::new(&step.staged))?;
        validate_workspace_relative(Path::new(&step.backup))?;
        validate_digest(&step.result_sha256)?;
        if let Some(value) = &step.before_sha256 {
            validate_digest(value)?;
        }
    }
    Ok(())
}

fn cleanup_transaction(root: &VaultRoot, journal_relative: &Path) -> Result<(), StorageError> {
    let directory = journal_relative.parent().ok_or_else(|| StorageError::RecoveryRequired(
        "workspace journal has no transaction directory".to_owned(),
    ))?;
    let resolved = root.resolve(directory)?;
    fs::remove_dir_all(resolved.as_path())
        .map_err(|error| StorageError::io("clean workspace transaction", directory, error))?;
    sync_directory(resolved.as_path().parent());
    Ok(())
}

fn read_regular_bounded(root: &VaultRoot, relative: &Path) -> Result<Vec<u8>, StorageError> {
    validate_workspace_relative(relative)?;
    let resolved = root.resolve(relative)?;
    let metadata = fs::symlink_metadata(resolved.as_path())
        .map_err(|error| StorageError::io("inspect managed file", relative, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(StorageError::UnsafePath {
            path: portable(relative),
            reason: "managed target must be a regular file".to_owned(),
        });
    }
    if metadata.len() > MAX_MANAGED_FILE_BYTES as u64 {
        return Err(StorageError::InvalidVault(
            "managed file exceeds the 16 MiB limit".to_owned(),
        ));
    }
    fs::read(resolved.as_path())
        .map_err(|error| StorageError::io("read managed file", relative, error))
}

fn read_optional_regular(path: &Path, relative: &Path) -> Result<Option<Vec<u8>>, StorageError> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(StorageError::io("inspect managed target", relative, error)),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err(StorageError::UnsafePath {
                path: portable(relative),
                reason: "managed target must be a regular file".to_owned(),
            })
        }
        Ok(metadata) if metadata.len() > MAX_MANAGED_FILE_BYTES as u64 => Err(
            StorageError::InvalidVault("managed file exceeds the 16 MiB limit".to_owned()),
        ),
        Ok(_) => fs::read(path)
            .map(Some)
            .map_err(|error| StorageError::io("read managed target", relative, error)),
    }
}

fn check_expectation(
    current: Option<&[u8]>,
    expectation: &WriteExpectation,
) -> Result<(), StorageError> {
    if expectation.create_only && current.is_some() {
        return Err(StorageError::WriteConflict);
    }
    if current.is_none()
        && (expectation.expected_revision.is_some() || expectation.expected_sha256.is_some())
    {
        return Err(StorageError::WriteConflict);
    }
    if let Some(expected) = &expectation.expected_sha256 {
        validate_digest(expected)?;
        if current.map(digest).as_ref() != Some(expected) {
            return Err(StorageError::WriteConflict);
        }
    }
    if let Some(expected) = expectation.expected_revision {
        let actual = current
            .and_then(|bytes| serde_json::from_slice::<Value>(bytes).ok())
            .as_ref()
            .and_then(json_revision);
        if actual != Some(expected) {
            return Err(StorageError::WriteConflict);
        }
    }
    Ok(())
}

pub fn validate_workspace_relative(path: &Path) -> Result<(), StorageError> {
    validate_managed_relative(path)?;
    for component in path.components() {
        let Component::Normal(segment) = component else {
            return Err(StorageError::UnsafePath {
                path: portable(path),
                reason: "path components must be portable".to_owned(),
            });
        };
        let text = segment.to_str().ok_or_else(|| StorageError::UnsafePath {
            path: portable(path),
            reason: "path must be valid UTF-8".to_owned(),
        })?;
        if text.len() > 160
            || text.ends_with('.')
            || text.ends_with(' ')
            || text.contains(':')
            || is_windows_device_name(text)
        {
            return Err(StorageError::UnsafePath {
                path: portable(path),
                reason: "path contains a non-portable or reserved segment".to_owned(),
            });
        }
    }
    Ok(())
}

fn is_windows_device_name(segment: &str) -> bool {
    let stem = segment.split('.').next().unwrap_or(segment).to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || stem
            .strip_prefix("COM")
            .is_some_and(|number| matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"))
        || stem
            .strip_prefix("LPT")
            .is_some_and(|number| matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"))
}

fn validate_portable_id(value: &str) -> Result<(), StorageError> {
    let valid = (3..=128).contains(&value.len())
        && value
            .bytes()
            .enumerate()
            .all(|(index, byte)| byte.is_ascii_lowercase() || byte.is_ascii_digit() || (index > 0 && matches!(byte, b'_' | b'-')));
    if valid {
        Ok(())
    } else {
        Err(StorageError::InvalidVault(
            "workspace vaultId is not a portable stable ID".to_owned(),
        ))
    }
}

fn sibling_relative(path: &Path, suffix: &str) -> Result<PathBuf, StorageError> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| StorageError::UnsafePath {
            path: portable(path),
            reason: "managed file needs a UTF-8 name".to_owned(),
        })?;
    Ok(path.with_file_name(format!(".{name}.{suffix}")))
}

fn stage_file(path: &Path, display: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|error| StorageError::io("create staged workspace file", display, error))?;
    file.write_all(bytes)
        .map_err(|error| StorageError::io("write staged workspace file", display, error))?;
    file.sync_all()
        .map_err(|error| StorageError::io("sync staged workspace file", display, error))
}

fn parse_json(bytes: &[u8], relative: &Path) -> Result<Value, StorageError> {
    serde_json::from_slice(bytes).map_err(|error| {
        StorageError::InvalidVault(format!("invalid JSON in `{}`: {error}", portable(relative)))
    })
}

fn json_revision(value: &Value) -> Option<u64> {
    value.get("revision").and_then(Value::as_u64)
}

fn receipt(relative: &Path, bytes: &[u8], revision: Option<u64>) -> WriteReceipt {
    WriteReceipt {
        relative_path: portable(relative),
        revision,
        sha256: digest(bytes),
    }
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn digest_optional(bytes: Option<&[u8]>) -> Option<String> {
    bytes.map(digest)
}

fn validate_digest(value: &str) -> Result<(), StorageError> {
    if value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(StorageError::InvalidVault("invalid SHA-256 digest".to_owned()))
    }
}

fn map_create_error(relative: &Path, error: std::io::Error) -> StorageError {
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        StorageError::WriteConflict
    } else {
        StorageError::io("publish new workspace file", relative, error)
    }
}

fn sync_directory(path: Option<&Path>) {
    if let Some(path) = path {
        if let Ok(directory) = File::open(path) {
            let _ = directory.sync_all();
        }
    }
}

fn portable(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    fn root() -> (TempDir, VaultRoot) {
        let directory = TempDir::new().unwrap();
        let root = VaultRoot::open(directory.path()).unwrap();
        (directory, root)
    }

    #[test]
    fn creates_namespaces_without_replacing_unknown_metadata() {
        let (_directory, root) = root();
        let metadata = ensure_workspace(&root, "vault-one").unwrap();
        assert_eq!(metadata.vault_id, "vault-one");
        assert!(root.path().join(".PixelPrompt").is_dir());

        fs::write(root.path().join(".PixelStudio/vault.json"), b"{\"unknown\":true}").unwrap();
        assert!(ensure_workspace(&root, "vault-one").is_err());
        assert_eq!(
            fs::read(root.path().join(".PixelStudio/vault.json")).unwrap(),
            b"{\"unknown\":true}"
        );
    }

    #[test]
    fn rejects_escape_symlink_devices_and_external_changes() {
        let (_directory, root) = root();
        ensure_workspace(&root, "vault-one").unwrap();
        let writer = WorkspaceWriter::new(root.clone());
        assert!(writer
            .write_json(Path::new("../outside.json"), &json!({}), &WriteExpectation::default())
            .is_err());
        assert!(writer
            .write_json(Path::new(".PixelPrompt/CON.json"), &json!({}), &WriteExpectation::default())
            .is_err());

        let path = Path::new(".PixelPrompt/test.json");
        let first = writer
            .write_json(
                path,
                &json!({"revision": 1}),
                &WriteExpectation { create_only: true, ..WriteExpectation::default() },
            )
            .unwrap();
        fs::write(root.path().join(path), b"{\"revision\":9}").unwrap();
        assert!(matches!(
            writer.write_json(
                path,
                &json!({"revision": 2}),
                &WriteExpectation { expected_sha256: Some(first.sha256), ..WriteExpectation::default() },
            ),
            Err(StorageError::WriteConflict)
        ));
    }

    #[test]
    fn interrupted_file_set_resumes_to_one_complete_generation() {
        let (_directory, root) = root();
        ensure_workspace(&root, "vault-one").unwrap();
        let writes = vec![
            ManagedFileWrite {
                relative_path: PathBuf::from(".PixelPrompt/A/one.json"),
                bytes: b"{\"revision\":1}".to_vec(),
                expectation: WriteExpectation { create_only: true, ..WriteExpectation::default() },
            },
            ManagedFileWrite {
                relative_path: PathBuf::from(".PixelPrompt/A/two.md"),
                bytes: b"complete generation".to_vec(),
                expectation: WriteExpectation { create_only: true, ..WriteExpectation::default() },
            },
        ];
        let interrupted = WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1));
        assert!(matches!(
            interrupted.publish_file_set(&writes),
            Err(StorageError::TransactionInterrupted { step: 1 })
        ));
        assert_eq!(WorkspaceWriter::new(root.clone()).recover_file_sets().unwrap(), 1);
        assert_eq!(fs::read(root.path().join(".PixelPrompt/A/one.json")).unwrap(), writes[0].bytes);
        assert_eq!(fs::read(root.path().join(".PixelPrompt/A/two.md")).unwrap(), writes[1].bytes);
    }

    #[test]
    fn recovery_resumes_between_backup_and_replacement() {
        let (_directory, root) = root();
        ensure_workspace(&root, "vault-one").unwrap();
        let target = Path::new(".PixelPrompt/A/profile.json");
        root.ensure_directory(target.parent().unwrap()).unwrap();
        fs::write(root.path().join(target), b"old").unwrap();
        let stage = Path::new(".PixelStudio/transactions/manual/stage/0.data");
        let backup = Path::new(".PixelStudio/transactions/manual/backup/0.data");
        root.ensure_directory(stage.parent().unwrap()).unwrap();
        root.ensure_directory(backup.parent().unwrap()).unwrap();
        fs::write(root.path().join(stage), b"new").unwrap();
        fs::rename(root.path().join(target), root.path().join(backup)).unwrap();
        let step = FileSetStep {
            target: portable(target),
            staged: portable(stage),
            backup: portable(backup),
            before_sha256: Some(digest(b"old")),
            result_sha256: digest(b"new"),
        };
        publish_step(&root, &step).unwrap();
        assert_eq!(fs::read(root.path().join(target)).unwrap(), b"new");
        assert_eq!(fs::read(root.path().join(backup)).unwrap(), b"old");
    }

    #[test]
    fn invalid_prompt_namespace_does_not_create_workspace_metadata() {
        let (_directory, root) = root();
        fs::write(root.path().join(PROMPT_VAULT_DIR), b"foreign").unwrap();
        assert!(ensure_workspace(&root, "vault-one").is_err());
        assert!(!root.path().join(WORKSPACE_ADMIN_DIR).exists());
    }

    #[test]
    fn json_relocation_is_cas_guarded_and_retryable() {
        let (_directory, root) = root();
        ensure_workspace(&root, "vault-one").unwrap();
        let writer = WorkspaceWriter::new(root.clone());
        let source = Path::new(".PixelPrompt/Alt/Profil/Profil-profile.json");
        let target = Path::new(".PixelPrompt/Neu/Profil/Profil-profile.json");
        let first = writer
            .write_json(
                source,
                &json!({"revision": 1, "name": "Alt"}),
                &WriteExpectation { create_only: true, ..WriteExpectation::default() },
            )
            .unwrap();
        let changed = json!({"revision": 2, "name": "Neu"});
        let receipt = writer
            .relocate_json(
                source,
                target,
                &changed,
                &WriteExpectation {
                    expected_revision: Some(1),
                    expected_sha256: Some(first.sha256),
                    create_only: false,
                },
            )
            .unwrap();
        assert!(!root.path().join(source).exists());
        assert_eq!(writer.read_json(target).unwrap().0, changed);
        assert_eq!(
            writer
                .relocate_json(source, target, &changed, &WriteExpectation::default())
                .unwrap(),
            receipt
        );
    }
}
