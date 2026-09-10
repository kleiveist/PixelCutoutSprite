fn cleanup_terminal_journal(
    root: &VaultRoot,
    location: &Path,
    expected_journal: &TransactionJournal,
) -> Result<(), StorageError> {
    if !matches!(
        expected_journal.state,
        TransactionState::Committed | TransactionState::RolledBack
    ) {
        return Err(StorageError::RecoveryRequired(
            "refusing to clean a non-terminal transaction".to_owned(),
        ));
    }
    let (actual_journal, current_owner, _) = read_journal(root, location)?;
    if &actual_journal != expected_journal {
        return Err(StorageError::WriteConflict);
    }
    let original_owner = original_owner(&current_owner, expected_journal);
    if expected_journal.state == TransactionState::RolledBack
        && expected_journal.purpose == TransactionPurpose::ProjectCreate
    {
        return quarantine_rolled_back_project_creation(
            root,
            location,
            &current_owner,
            original_owner,
            expected_journal,
        );
    }
    let (transaction_dir, backup_dir) =
        if expected_journal.purpose == TransactionPurpose::WorkspaceLabelRemove {
            (
                current_owner.join("transactions"),
                current_owner.join("backups"),
            )
        } else {
            (
                current_owner.join(".project/transactions"),
                current_owner.join(".project/backups"),
            )
        };
    let collision_rollback = expected_journal.state == TransactionState::RolledBack
        && rolled_back_has_occupied_target(root, expected_journal)?;

    if expected_journal.purpose != TransactionPurpose::Migration {
        for step in &expected_journal.steps {
            let Some(backup) = &step.backup else {
                continue;
            };
            let current_backup =
                remap_owned_path(Path::new(backup.as_str()), original_owner, &current_owner)?;
            let resolved = root.resolve(&current_backup)?;
            match fs::symlink_metadata(resolved.as_path()) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                    return Err(StorageError::RecoveryRequired(format!(
                        "terminal transaction backup `{}` is not a regular file",
                        current_backup.to_string_lossy()
                    )));
                }
                Ok(_) => {
                    verify_raw_file_digest(
                        resolved.as_path(),
                        step.expected_sha256
                            .as_deref()
                            .expect("replacement backup digest was validated"),
                    )?;
                    fs::remove_file(resolved.as_path()).map_err(|error| {
                        StorageError::io(
                            "remove terminal transaction backup",
                            resolved.relative(),
                            error,
                        )
                    })?;
                    let cleanup_root = workspace_or_project_administration_root(
                        &current_backup,
                        expected_journal.purpose,
                        &backup_dir,
                        "backups",
                    );
                    prune_empty_parents(root, resolved.relative().parent(), &cleanup_root)?;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(StorageError::io(
                        "inspect terminal transaction backup",
                        resolved.relative(),
                        error,
                    ));
                }
            }
        }
    }

    let resolved_journal = root.resolve(location)?;
    let mut journal_removed = false;
    if collision_rollback {
        fs::remove_file(resolved_journal.as_path()).map_err(|error| {
            StorageError::io(
                "remove terminal collision journal",
                resolved_journal.relative(),
                error,
            )
        })?;
        journal_removed = true;
    }

    for (index, step) in expected_journal.steps.iter().enumerate() {
        let current_stage = remap_owned_path(
            Path::new(step.staged.as_str()),
            original_owner,
            &current_owner,
        )?;
        let cleanup_root = workspace_or_project_administration_root(
            &current_stage,
            expected_journal.purpose,
            &transaction_dir,
            "transactions",
        );
        if expected_journal.state == TransactionState::RolledBack
            && current_stage.starts_with(&cleanup_root)
        {
            let resolved = root.resolve(&current_stage)?;
            if resolved.as_path().exists() {
                remove_verified_artifact(
                    resolved.as_path(),
                    expected_journal.result_sha256[index]
                        .as_deref()
                        .expect("terminal sealed transaction has result digests"),
                )?;
            }
        }
        prune_empty_parents(root, current_stage.parent(), &cleanup_root)?;
    }

    if !journal_removed {
        fs::remove_file(resolved_journal.as_path()).map_err(|error| {
            StorageError::io(
                "remove terminal transaction journal",
                resolved_journal.relative(),
                error,
            )
        })?;
    }
    Ok(())
}


fn workspace_or_project_administration_root(
    path: &Path,
    purpose: TransactionPurpose,
    default: &Path,
    leaf: &str,
) -> PathBuf {
    if purpose != TransactionPurpose::WorkspaceLabelRemove
        || path.starts_with(Path::new(super::ADMIN_DIR))
    {
        return default.to_path_buf();
    }
    path.components()
        .next()
        .map(|project| {
            PathBuf::from(project.as_os_str())
                .join(".project")
                .join(leaf)
        })
        .unwrap_or_else(|| default.to_path_buf())
}

fn quarantine_rolled_back_project_creation(
    root: &VaultRoot,
    location: &Path,
    current_owner: &Path,
    original_owner: &Path,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    if parse_project_create_owner(original_owner) != Some(journal.id) || journal.steps.len() != 1 {
        return Err(StorageError::RecoveryRequired(
            "rolled-back project creation does not match its sealed staging owner".to_owned(),
        ));
    }
    let rollback_owner = project_create_rollback_owner(journal.id);
    let digest = journal.result_sha256[0]
        .as_deref()
        .expect("sealed project creation has a result digest");
    let journal_suffix = location.strip_prefix(current_owner).map_err(|_| {
        StorageError::RecoveryRequired(
            "project-creation journal escaped its current staging owner".to_owned(),
        )
    })?;

    let final_owner = if current_owner == rollback_owner {
        let resolved = root.resolve(&rollback_owner)?;
        verify_digest(resolved.as_path(), digest)?;
        rollback_owner
    } else if current_owner == original_owner {
        let source = root.resolve(original_owner)?;
        verify_digest(source.as_path(), digest)?;
        root.ensure_directory(Path::new(".trash"))?;
        let target = root.resolve(&rollback_owner)?;
        if target.as_path().exists() {
            return Err(StorageError::WriteConflict);
        }
        rename_managed(
            source.as_path(),
            target.as_path(),
            "quarantine rolled-back project creation",
        )?;
        verify_digest(target.as_path(), digest)?;
        rollback_owner
    } else {
        return Err(StorageError::RecoveryRequired(
            "rolled-back project creation is outside its staging or quarantine owner".to_owned(),
        ));
    };

    let resolved_journal = root.resolve(&final_owner.join(journal_suffix))?;
    fs::remove_file(resolved_journal.as_path()).map_err(|error| {
        StorageError::io(
            "remove quarantined project-creation journal",
            resolved_journal.relative(),
            error,
        )
    })
}

fn rolled_back_has_occupied_target(
    root: &VaultRoot,
    journal: &TransactionJournal,
) -> Result<bool, StorageError> {
    for step in &journal.steps {
        if !matches!(
            step.action,
            TransactionAction::Create | TransactionAction::Move
        ) {
            continue;
        }
        let staged = root.resolve(Path::new(step.staged.as_str()))?;
        let target = root.resolve(Path::new(step.target.as_str()))?;
        if staged.as_path().exists() && target.as_path().exists() {
            return Ok(true);
        }
    }
    Ok(false)
}

fn remove_verified_artifact(path: &Path, expected_digest: &str) -> Result<(), StorageError> {
    verify_digest(path, expected_digest)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| StorageError::io("inspect terminal transaction artifact", path, error))?;
    if metadata.is_file() {
        fs::remove_file(path)
            .map_err(|error| StorageError::io("remove terminal transaction artifact", path, error))
    } else if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| StorageError::io("remove terminal transaction artifact", path, error))
    } else {
        Err(StorageError::RecoveryRequired(
            "terminal transaction artifact has an unsupported type".to_owned(),
        ))
    }
}

fn remap_owned_path(
    path: &Path,
    original_owner: &Path,
    current_owner: &Path,
) -> Result<PathBuf, StorageError> {
    if original_owner == current_owner {
        return Ok(path.to_path_buf());
    }
    let suffix = path.strip_prefix(original_owner).map_err(|_| {
        StorageError::RecoveryRequired(
            "terminal transaction artifact escaped its original project".to_owned(),
        )
    })?;
    Ok(current_owner.join(suffix))
}

fn prune_empty_parents(
    root: &VaultRoot,
    start: Option<&Path>,
    stop: &Path,
) -> Result<(), StorageError> {
    let Some(mut current) = start.map(Path::to_path_buf) else {
        return Ok(());
    };
    while current.starts_with(stop) && current != stop {
        let resolved = root.resolve(&current)?;
        match fs::remove_dir(resolved.as_path()) {
            Ok(()) => {}
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::NotFound | std::io::ErrorKind::DirectoryNotEmpty
                ) =>
            {
                break;
            }
            Err(error) => {
                return Err(StorageError::io(
                    "prune transaction administration directory",
                    resolved.relative(),
                    error,
                ));
            }
        }
        let Some(parent) = current.parent() else {
            break;
        };
        current = parent.to_path_buf();
    }
    Ok(())
}

fn ensure_resolved_parent(root: &VaultRoot, path: &ResolvedPath) -> Result<(), StorageError> {
    let parent = path
        .relative()
        .parent()
        .ok_or_else(|| StorageError::UnsafePath {
            path: path.relative().to_string_lossy().into_owned(),
            reason: "managed transaction path has no parent".to_owned(),
        })?;
    if parent.as_os_str().is_empty() {
        Ok(())
    } else {
        root.ensure_directory(parent).map(|_| ())
    }
}

fn portable_relative(path: &Path) -> Result<RelativePath, StorageError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(StorageError::from)
}

fn reserved_managed_relative(path: &Path) -> Result<RelativePath, StorageError> {
    validate_managed_relative(path)?;
    let text = path.to_str().ok_or_else(|| StorageError::UnsafePath {
        path: "managed transaction path".to_owned(),
        reason: "reserved transaction paths must be UTF-8".to_owned(),
    })?;
    serde_json::from_value(serde_json::Value::String(text.to_owned())).map_err(|error| {
        StorageError::InvalidVault(format!(
            "failed to construct a validated reserved transaction path: {error}"
        ))
    })
}
