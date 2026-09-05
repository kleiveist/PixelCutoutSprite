fn apply_step(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    match step.action {
        TransactionAction::Create | TransactionAction::Move => {
            apply_move(root, step, result_digest)
        }
        TransactionAction::Replace => apply_replace(root, step, result_digest),
    }
}

fn apply_move(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    let staged = root.resolve(Path::new(step.staged.as_str()))?;
    let target = root.resolve(Path::new(step.target.as_str()))?;
    match (staged.as_path().exists(), target.as_path().exists()) {
        (true, false) => {
            verify_digest(staged.as_path(), result_digest)?;
            ensure_resolved_parent(root, &target)?;
            rename_managed(staged.as_path(), target.as_path(), "apply transaction move")?;
            verify_digest(target.as_path(), result_digest)
        }
        (false, true) => verify_digest(target.as_path(), result_digest),
        (true, true) => Err(StorageError::WriteConflict),
        (false, false) => Err(StorageError::RecoveryRequired(format!(
            "both transaction source and target are missing for `{}`",
            step.target
        ))),
    }
}

fn apply_replace(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    let staged = root.resolve(Path::new(step.staged.as_str()))?;
    let target = root.resolve(Path::new(step.target.as_str()))?;
    let backup_path = step
        .backup
        .as_ref()
        .expect("replacement backup was validated");
    let backup = root.resolve(Path::new(backup_path.as_str()))?;
    let expected = step
        .expected_sha256
        .as_deref()
        .expect("replacement target hash was validated");

    if !staged.as_path().exists() {
        if !target.as_path().exists() || !backup.as_path().exists() {
            return Err(StorageError::RecoveryRequired(
                "replacement is missing its result or backup".to_owned(),
            ));
        }
        verify_raw_file_digest(backup.as_path(), expected)?;
        return verify_digest(target.as_path(), result_digest);
    }
    verify_digest(staged.as_path(), result_digest)?;
    if !backup.as_path().exists() {
        if !target.as_path().exists() {
            return Err(StorageError::RecoveryRequired(
                "replacement target disappeared before its backup was created".to_owned(),
            ));
        }
        verify_raw_file_digest(target.as_path(), expected)?;
        ensure_resolved_parent(root, &backup)?;
        rename_managed(
            target.as_path(),
            backup.as_path(),
            "backup transaction target",
        )?;
        verify_raw_file_digest(backup.as_path(), expected)?;
    } else {
        verify_raw_file_digest(backup.as_path(), expected)?;
    }
    if target.as_path().exists() {
        return Err(StorageError::WriteConflict);
    }
    rename_managed(
        staged.as_path(),
        target.as_path(),
        "apply transaction replacement",
    )?;
    verify_digest(target.as_path(), result_digest)
}

fn rollback_step(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    match step.action {
        TransactionAction::Create | TransactionAction::Move => {
            rollback_move(root, step, result_digest)
        }
        TransactionAction::Replace => rollback_replace(root, step, result_digest),
    }
}

fn rollback_move(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    let staged = root.resolve(Path::new(step.staged.as_str()))?;
    let target = root.resolve(Path::new(step.target.as_str()))?;
    match (staged.as_path().exists(), target.as_path().exists()) {
        (false, true) => {
            verify_digest(target.as_path(), result_digest)?;
            ensure_resolved_parent(root, &staged)?;
            rename_managed(
                target.as_path(),
                staged.as_path(),
                "roll back transaction move",
            )?;
            verify_digest(staged.as_path(), result_digest)
        }
        (true, false) => verify_digest(staged.as_path(), result_digest),
        (true, true) => Err(StorageError::WriteConflict),
        (false, false) => Err(StorageError::RecoveryRequired(
            "cannot roll back a missing transaction source and target".to_owned(),
        )),
    }
}

fn rollback_replace(
    root: &VaultRoot,
    step: &TransactionStep,
    result_digest: &str,
) -> Result<(), StorageError> {
    let staged = root.resolve(Path::new(step.staged.as_str()))?;
    let target = root.resolve(Path::new(step.target.as_str()))?;
    let backup = root.resolve(Path::new(
        step.backup
            .as_ref()
            .expect("replacement backup was validated")
            .as_str(),
    ))?;
    let expected = step
        .expected_sha256
        .as_deref()
        .expect("replacement target hash was validated");
    if !backup.as_path().exists() {
        if !target.as_path().exists() {
            return Err(StorageError::RecoveryRequired(
                "replacement target and backup are both missing".to_owned(),
            ));
        }
        verify_raw_file_digest(target.as_path(), expected)?;
        return if staged.as_path().exists() {
            verify_digest(staged.as_path(), result_digest)
        } else {
            Err(StorageError::RecoveryRequired(
                "unapplied replacement stage is missing".to_owned(),
            ))
        };
    }
    verify_raw_file_digest(backup.as_path(), expected)?;
    if target.as_path().exists() {
        verify_digest(target.as_path(), result_digest)?;
        if staged.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        ensure_resolved_parent(root, &staged)?;
        rename_managed(
            target.as_path(),
            staged.as_path(),
            "retain rolled-back transaction stage",
        )?;
    } else if staged.as_path().exists() {
        verify_digest(staged.as_path(), result_digest)?;
    } else {
        return Err(StorageError::RecoveryRequired(
            "replacement result and stage are both missing".to_owned(),
        ));
    }
    rename_managed(
        backup.as_path(),
        target.as_path(),
        "restore transaction backup",
    )?;
    verify_raw_file_digest(target.as_path(), expected)
}

fn rename_managed(
    source: &Path,
    target: &Path,
    operation: &'static str,
) -> Result<(), StorageError> {
    fs::rename(source, target).map_err(|error| StorageError::io(operation, target, error))
}

fn verify_digest(path: &Path, expected: &str) -> Result<(), StorageError> {
    if hash_managed_path(path)? == expected {
        Ok(())
    } else {
        Err(StorageError::WriteConflict)
    }
}

/// Move preconditions preserve the raw-byte CAS contract for regular files while allowing a
/// type-tagged managed-tree digest for directory moves. The latter closes the service-level
/// observation-to-journal window without changing replacement or file-move stamp semantics.
fn verify_move_source_digest(path: &Path, expected: &str) -> Result<(), StorageError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect transaction move source", path, error))?;
    if metadata.file_type().is_symlink() {
        return Err(StorageError::WriteConflict);
    }
    if metadata.is_file() {
        verify_raw_file_digest(path, expected)
    } else if metadata.is_dir() {
        verify_digest(path, expected)
    } else {
        Err(StorageError::WriteConflict)
    }
}

/// Compare-and-swap stamps intentionally hash only a document's raw bytes. Transaction result
/// hashes are type-tagged so file/tree digests cannot collide, but an expected replacement stamp
/// must stay byte-for-byte compatible with `VersionStamp::from_bytes`.
fn verify_raw_file_digest(path: &Path, expected: &str) -> Result<(), StorageError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect replacement target", path, error))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(StorageError::WriteConflict);
    }
    let mut digest = Sha256::new();
    hash_file(path, &mut digest)?;
    if format!("{:x}", digest.finalize()) == expected {
        Ok(())
    } else {
        Err(StorageError::WriteConflict)
    }
}

fn remap_location(location: &mut PathBuf, step: &TransactionStep, reverse: bool) {
    if step.action != TransactionAction::Move {
        return;
    }
    let (source, target) = if reverse {
        (
            Path::new(step.target.as_str()),
            Path::new(step.staged.as_str()),
        )
    } else {
        (
            Path::new(step.staged.as_str()),
            Path::new(step.target.as_str()),
        )
    };
    if let Ok(suffix) = location.strip_prefix(source) {
        *location = target.join(suffix);
    }
}

pub fn hash_managed_path(path: &Path) -> Result<String, StorageError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect transaction content", path, error))?;
    if metadata.file_type().is_symlink() {
        return Err(StorageError::UnsafePath {
            path: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            reason: "transaction content cannot be a symbolic link".to_owned(),
        });
    }
    let mut digest = Sha256::new();
    if metadata.is_file() {
        digest.update(b"file\0");
        hash_file(path, &mut digest)?;
    } else if metadata.is_dir() {
        digest.update(b"directory\0");
        digest_directory(path, path, &mut digest, 0)?;
    } else {
        return Err(StorageError::RecoveryRequired(
            "transaction path is neither a regular file nor a directory".to_owned(),
        ));
    }
    Ok(format!("{:x}", digest.finalize()))
}

/// Hashes the project tree as it will look immediately before its final whole-project move.
/// Replacement stages live below `.project/transactions`, which is intentionally omitted from a
/// project digest, so their bytes must be projected onto their logical target paths here.
fn projected_move_digest(
    root: &VaultRoot,
    owner: &Path,
    prior_steps: &[TransactionStep],
) -> Result<String, StorageError> {
    let resolved_owner = root.resolve(owner)?;
    let owner_metadata = fs::symlink_metadata(resolved_owner.as_path()).map_err(|error| {
        StorageError::io(
            "inspect project before transaction move",
            resolved_owner.relative(),
            error,
        )
    })?;
    if owner_metadata.file_type().is_symlink() || !owner_metadata.is_dir() {
        return Err(StorageError::RecoveryRequired(
            "whole-project transaction source must be a real directory".to_owned(),
        ));
    }

    let mut replacements = HashMap::new();
    for step in prior_steps
        .iter()
        .filter(|step| Path::new(step.target.as_str()).starts_with(owner))
    {
        if step.action != TransactionAction::Replace {
            return Err(StorageError::InvalidVault(
                "only file replacements may precede a whole-project move".to_owned(),
            ));
        }
        let target = root.resolve(Path::new(step.target.as_str()))?;
        let staged = root.resolve(Path::new(step.staged.as_str()))?;
        for (label, candidate) in [("target", &target), ("stage", &staged)] {
            let metadata = fs::symlink_metadata(candidate.as_path()).map_err(|error| {
                StorageError::io(
                    "inspect projected project replacement",
                    candidate.relative(),
                    error,
                )
            })?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(StorageError::InvalidVault(format!(
                    "project-move replacement {label} must be a regular file"
                )));
            }
        }
        replacements.insert(
            target.as_path().to_path_buf(),
            staged.as_path().to_path_buf(),
        );
    }

    let mut digest = Sha256::new();
    digest.update(b"directory\0");
    digest_projected_directory(
        resolved_owner.as_path(),
        resolved_owner.as_path(),
        &replacements,
        &mut digest,
        0,
    )?;
    Ok(format!("{:x}", digest.finalize()))
}

fn hash_file(path: &Path, digest: &mut Sha256) -> Result<(), StorageError> {
    let mut file = File::open(path)
        .map_err(|error| StorageError::io("open transaction file for hashing", path, error))?;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| StorageError::io("hash transaction file", path, error))?;
        if count == 0 {
            return Ok(());
        }
        digest.update(&buffer[..count]);
    }
}

fn digest_directory(
    root: &Path,
    directory: &Path,
    digest: &mut Sha256,
    depth: u8,
) -> Result<(), StorageError> {
    if depth > 32 {
        return Err(StorageError::InvalidVault(
            "transaction content exceeded the supported depth".to_owned(),
        ));
    }
    for entry in read_sorted_directory(directory, "hash transaction directory")? {
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .expect("transaction hash walk remains below its root");
        if skip_derived_digest_path(relative) {
            continue;
        }
        let kind = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect transaction content", &path, error))?;
        if kind.is_symlink() {
            return Err(StorageError::UnsafePath {
                path: relative.to_string_lossy().into_owned(),
                reason: "transaction trees cannot contain symbolic links".to_owned(),
            });
        }
        digest.update(relative.to_string_lossy().replace('\\', "/").as_bytes());
        digest.update([0]);
        if kind.is_dir() {
            digest.update(b"dir\0");
            digest_directory(root, &path, digest, depth + 1)?;
        } else if kind.is_file() {
            digest.update(b"file\0");
            hash_file(&path, digest)?;
        } else {
            return Err(StorageError::RecoveryRequired(
                "transaction trees may contain only regular files and directories".to_owned(),
            ));
        }
    }
    Ok(())
}

fn digest_projected_directory(
    root: &Path,
    directory: &Path,
    replacements: &HashMap<PathBuf, PathBuf>,
    digest: &mut Sha256,
    depth: u8,
) -> Result<(), StorageError> {
    if depth > 32 {
        return Err(StorageError::InvalidVault(
            "transaction content exceeded the supported depth".to_owned(),
        ));
    }
    for entry in read_sorted_directory(directory, "hash projected transaction directory")? {
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .expect("projected transaction hash walk remains below its root");
        if skip_derived_digest_path(relative) {
            continue;
        }
        let kind = entry.file_type().map_err(|error| {
            StorageError::io("inspect projected transaction content", &path, error)
        })?;
        if kind.is_symlink() {
            return Err(StorageError::UnsafePath {
                path: relative.to_string_lossy().into_owned(),
                reason: "transaction trees cannot contain symbolic links".to_owned(),
            });
        }
        digest.update(relative.to_string_lossy().replace('\\', "/").as_bytes());
        digest.update([0]);
        if kind.is_dir() {
            digest.update(b"dir\0");
            digest_projected_directory(root, &path, replacements, digest, depth + 1)?;
        } else if kind.is_file() {
            digest.update(b"file\0");
            hash_file(
                replacements
                    .get(&path)
                    .map_or(path.as_path(), PathBuf::as_path),
                digest,
            )?;
        } else {
            return Err(StorageError::RecoveryRequired(
                "transaction trees may contain only regular files and directories".to_owned(),
            ));
        }
    }
    Ok(())
}

fn skip_derived_digest_path(relative: &Path) -> bool {
    let parts = relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>();
    parts.windows(2).any(|pair| {
        pair[0] == ".project" && matches!(pair[1], "transactions" | "backups" | "cache" | "trash")
    }) || parts
        .iter()
        .any(|part| matches!(*part, "exports" | "_exports"))
}

fn validate_steps(
    purpose: TransactionPurpose,
    steps: &[TransactionStep],
) -> Result<(), StorageError> {
    let mut targets = HashSet::new();
    let mut stages = HashSet::new();
    let mut backups = HashSet::new();
    for step in steps {
        validate_transaction_step_path(purpose, step.target.as_str())?;
        validate_transaction_step_path(purpose, step.staged.as_str())?;
        if step.target == step.staged {
            return Err(StorageError::InvalidVault(
                "transaction target and stage must differ".to_owned(),
            ));
        }
        if !targets.insert(step.target.as_str()) || !stages.insert(step.staged.as_str()) {
            return Err(StorageError::InvalidVault(
                "transaction targets and stages must be unique".to_owned(),
            ));
        }
        match (&step.action, &step.backup, &step.expected_sha256) {
            (TransactionAction::Replace, Some(backup), Some(expected)) => {
                validate_transaction_step_path(purpose, backup.as_str())?;
                validate_digest(expected)?;
                if backup == &step.target || backup == &step.staged || !backups.insert(backup) {
                    return Err(StorageError::InvalidVault(
                        "transaction backups must be unique and distinct".to_owned(),
                    ));
                }
            }
            (TransactionAction::Replace, _, _) => {
                return Err(StorageError::InvalidVault(
                    "replacement steps require a backup and expected target SHA-256".to_owned(),
                ));
            }
            (_, Some(_), _) => {
                return Err(StorageError::InvalidVault(
                    "only replacement steps may name a backup".to_owned(),
                ));
            }
            (_, None, Some(expected)) => validate_digest(expected)?,
            (_, None, None) => {}
        }
    }
    Ok(())
}

fn validate_transaction_step_path(
    purpose: TransactionPurpose,
    value: &str,
) -> Result<(), StorageError> {
    match RelativePath::parse(value.to_owned()) {
        Ok(_) => Ok(()),
        Err(_)
            if purpose == TransactionPurpose::WorkspaceLabelRemove
                && Path::new(value).starts_with(super::ADMIN_DIR) =>
        {
            validate_managed_relative(Path::new(value))
        }
        Err(error) => Err(StorageError::InvalidDocument(error)),
    }
}

fn validate_digest(value: &str) -> Result<(), StorageError> {
    let valid = value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    if valid {
        Ok(())
    } else {
        Err(StorageError::InvalidVault(
            "transaction digest must be lowercase SHA-256".to_owned(),
        ))
    }
}

#[derive(Serialize)]
struct PlanDigest<'a> {
    id: ObjectId,
    purpose: TransactionPurpose,
    owner_project_id: Option<ObjectId>,
    steps: &'a [TransactionStep],
    result_sha256: &'a [Option<String>],
}

fn plan_digest(journal: &TransactionJournal) -> Result<String, StorageError> {
    let bytes = serde_json::to_vec(&PlanDigest {
        id: journal.id,
        purpose: journal.purpose,
        owner_project_id: journal.owner_project_id,
        steps: &journal.steps,
        result_sha256: &journal.result_sha256,
    })
    .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
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
