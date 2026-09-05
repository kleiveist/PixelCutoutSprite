#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PhysicalStepState {
    Unapplied,
    CreateOccupied,
    MoveOccupied,
    ReplaceMidway,
    Applied,
}

#[derive(Debug)]
struct PhysicalPlan {
    steps: Vec<PhysicalStepState>,
}

impl PhysicalPlan {
    fn progress(&self) -> Result<(usize, Option<usize>), StorageError> {
        let applied = self
            .steps
            .iter()
            .take_while(|state| **state == PhysicalStepState::Applied)
            .count();
        let midway =
            (self.steps.get(applied) == Some(&PhysicalStepState::ReplaceMidway)).then_some(applied);
        let suffix = &self.steps[applied + usize::from(midway.is_some())..];
        if suffix.iter().any(|state| {
            !matches!(
                state,
                PhysicalStepState::Unapplied
                    | PhysicalStepState::CreateOccupied
                    | PhysicalStepState::MoveOccupied
            )
        }) {
            return Err(StorageError::RecoveryRequired(
                "transaction filesystem state is not an applied prefix followed by untouched steps"
                    .to_owned(),
            ));
        }
        Ok((applied, midway))
    }

    fn occupied(&self) -> bool {
        self.steps.iter().any(|state| {
            matches!(
                state,
                PhysicalStepState::CreateOccupied | PhysicalStepState::MoveOccupied
            )
        })
    }
}

fn recovery_capabilities(
    root: &VaultRoot,
    journal: &TransactionJournal,
) -> (bool, bool, Option<String>) {
    let physical = match reconcile_physical_plan(root, journal) {
        Ok(physical) => physical,
        Err(error) => return (false, false, Some(error.to_string())),
    };
    let (applied, midway) = match physical.progress() {
        Ok(progress) => progress,
        Err(error) => return (false, false, Some(error.to_string())),
    };
    if physical.occupied() {
        return (
            false,
            true,
            Some(
                "a transaction target became occupied; rollback preserves the foreign target"
                    .to_owned(),
            ),
        );
    }
    if journal.state == TransactionState::RollingBack {
        return (
            false,
            true,
            Some("an interrupted rollback must continue rolling back".to_owned()),
        );
    }
    let cursor_matches = !(journal.state == TransactionState::Prepared
        && (applied != 0 || midway.is_some()))
        && applied >= journal.cursor
        && applied <= journal.cursor.saturating_add(1)
        && midway.is_none_or(|index| index == journal.cursor);
    if cursor_matches {
        (true, true, None)
    } else {
        (
            false,
            true,
            Some("journal cursor does not match the hashed filesystem progress".to_owned()),
        )
    }
}

fn reconcile_physical_plan(
    root: &VaultRoot,
    journal: &TransactionJournal,
) -> Result<PhysicalPlan, StorageError> {
    let mut states = vec![None; journal.steps.len()];
    let mut applied_moves: Vec<(usize, PathBuf, PathBuf)> = Vec::new();

    // Later directory moves relocate the paths of earlier steps. Determine those moves from last
    // to first, applying only already-observed later mappings while inspecting each source/target.
    for index in (0..journal.steps.len()).rev() {
        let step = &journal.steps[index];
        if step.action != TransactionAction::Move {
            continue;
        }
        let source = remap_through_moves(Path::new(step.staged.as_str()), &applied_moves);
        let target = remap_through_moves(Path::new(step.target.as_str()), &applied_moves);
        let source = root.resolve(&source)?;
        let target = root.resolve(&target)?;
        let state = match (source.as_path().exists(), target.as_path().exists()) {
            (true, false) => {
                verify_unapplied_move_digest(
                    root,
                    journal,
                    index,
                    source.as_path(),
                    journal.result_sha256[index]
                        .as_deref()
                        .expect("sealed journal result hash was validated"),
                )?;
                PhysicalStepState::Unapplied
            }
            (false, true) => {
                verify_digest(
                    target.as_path(),
                    journal.result_sha256[index]
                        .as_deref()
                        .expect("sealed journal result hash was validated"),
                )?;
                PhysicalStepState::Applied
            }
            (true, true) => {
                if step.action == TransactionAction::Move {
                    PhysicalStepState::MoveOccupied
                } else {
                    unreachable!("only move steps are classified in this pass")
                }
            }
            (false, false) => {
                return Err(StorageError::RecoveryRequired(format!(
                    "transaction move `{}` has neither source nor target",
                    step.target
                )));
            }
        };
        states[index] = Some(state);
        if state == PhysicalStepState::Applied {
            applied_moves.push((
                index,
                PathBuf::from(step.staged.as_str()),
                PathBuf::from(step.target.as_str()),
            ));
            applied_moves.sort_by_key(|mapping| mapping.0);
        }
    }

    for (index, step) in journal.steps.iter().enumerate() {
        if states[index].is_some() {
            continue;
        }
        let target = root.resolve(&remap_through_moves(
            Path::new(step.target.as_str()),
            &applied_moves,
        ))?;
        let staged = root.resolve(&remap_through_moves(
            Path::new(step.staged.as_str()),
            &applied_moves,
        ))?;
        let result_digest = journal.result_sha256[index]
            .as_deref()
            .expect("sealed journal result hash was validated");
        states[index] = Some(match step.action {
            TransactionAction::Create => {
                match (staged.as_path().exists(), target.as_path().exists()) {
                    (true, false) => {
                        verify_digest(staged.as_path(), result_digest)?;
                        PhysicalStepState::Unapplied
                    }
                    (false, true) => {
                        verify_digest(target.as_path(), result_digest)?;
                        PhysicalStepState::Applied
                    }
                    (true, true) => {
                        verify_digest(staged.as_path(), result_digest)?;
                        PhysicalStepState::CreateOccupied
                    }
                    (false, false) => {
                        return Err(StorageError::RecoveryRequired(format!(
                            "transaction create `{}` has neither stage nor result",
                            step.target
                        )));
                    }
                }
            }
            TransactionAction::Replace => {
                classify_physical_replace(root, step, &applied_moves, result_digest)?
            }
            TransactionAction::Move => unreachable!("move states were classified first"),
        });
    }
    Ok(PhysicalPlan {
        steps: states
            .into_iter()
            .map(|state| state.expect("every transaction step was classified"))
            .collect(),
    })
}

fn verify_terminal_outcome(
    root: &VaultRoot,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    match journal.state {
        TransactionState::Committed => {
            let mut applied_moves: Vec<(usize, PathBuf, PathBuf)> = Vec::new();
            for index in (0..journal.steps.len()).rev() {
                let step = &journal.steps[index];
                if step.action != TransactionAction::Move {
                    continue;
                }
                let source = root.resolve(&remap_through_moves(
                    Path::new(step.staged.as_str()),
                    &applied_moves,
                ))?;
                let target = root.resolve(&remap_through_moves(
                    Path::new(step.target.as_str()),
                    &applied_moves,
                ))?;
                if source.as_path().exists() || !target.as_path().exists() {
                    return Err(StorageError::RecoveryRequired(format!(
                        "committed move `{}` does not match its terminal result",
                        step.target
                    )));
                }
                verify_digest(
                    target.as_path(),
                    journal.result_sha256[index]
                        .as_deref()
                        .expect("sealed terminal journal has result hashes"),
                )?;
                applied_moves.push((
                    index,
                    PathBuf::from(step.staged.as_str()),
                    PathBuf::from(step.target.as_str()),
                ));
                applied_moves.sort_by_key(|mapping| mapping.0);
            }
            for (index, step) in journal.steps.iter().enumerate() {
                if step.action == TransactionAction::Move {
                    continue;
                }
                let target = root.resolve(&remap_through_moves(
                    Path::new(step.target.as_str()),
                    &applied_moves,
                ))?;
                if !target.as_path().exists() {
                    return Err(StorageError::RecoveryRequired(format!(
                        "committed transaction result `{}` is missing",
                        step.target
                    )));
                }
                verify_digest(
                    target.as_path(),
                    journal.result_sha256[index]
                        .as_deref()
                        .expect("sealed terminal journal has result hashes"),
                )?;
            }
            Ok(())
        }
        TransactionState::RolledBack => {
            if journal.purpose == TransactionPurpose::ProjectCreate {
                let step = journal.steps.first().ok_or_else(|| {
                    StorageError::RecoveryRequired(
                        "rolled-back project creation has no publish step".to_owned(),
                    )
                })?;
                let staged = root.resolve(Path::new(step.staged.as_str()))?;
                let quarantined = root.resolve(&project_create_rollback_owner(journal.id))?;
                let preserved = match (staged.as_path().exists(), quarantined.as_path().exists()) {
                    (true, false) => staged.as_path(),
                    (false, true) => quarantined.as_path(),
                    _ => {
                        return Err(StorageError::RecoveryRequired(
                            "rolled-back project creation must have exactly one preserved staging tree"
                                .to_owned(),
                        ));
                    }
                };
                return verify_digest(
                    preserved,
                    journal.result_sha256[0]
                        .as_deref()
                        .expect("sealed project creation has a result digest"),
                );
            }
            for (index, step) in journal.steps.iter().enumerate() {
                let target = root.resolve(Path::new(step.target.as_str()))?;
                let staged = root.resolve(Path::new(step.staged.as_str()))?;
                match step.action {
                    TransactionAction::Create => {
                        if target.as_path().exists() {
                            if !staged.as_path().exists() {
                                return Err(StorageError::RecoveryRequired(format!(
                                    "rolled-back create result `{}` still exists without its untouched stage",
                                    step.target
                                )));
                            }
                            verify_digest(
                                staged.as_path(),
                                journal.result_sha256[index]
                                    .as_deref()
                                    .expect("sealed terminal journal has result hashes"),
                            )?;
                        }
                    }
                    TransactionAction::Move => {
                        if !staged.as_path().exists() {
                            return Err(StorageError::RecoveryRequired(format!(
                                "rolled-back move `{}` is not restored",
                                step.target
                            )));
                        }
                        verify_unapplied_move_digest(
                            root,
                            journal,
                            index,
                            staged.as_path(),
                            journal.result_sha256[index]
                                .as_deref()
                                .expect("sealed terminal journal has result hashes"),
                        )?;
                    }
                    TransactionAction::Replace => {
                        if !target.as_path().exists() {
                            return Err(StorageError::RecoveryRequired(format!(
                                "rolled-back replacement `{}` is not restored",
                                step.target
                            )));
                        }
                        verify_raw_file_digest(
                            target.as_path(),
                            step.expected_sha256
                                .as_deref()
                                .expect("replacement target digest was validated"),
                        )?;
                    }
                }
            }
            Ok(())
        }
        _ => Err(StorageError::RecoveryRequired(
            "terminal outcome verification requires a terminal journal".to_owned(),
        )),
    }
}

fn verify_unapplied_move_digest(
    root: &VaultRoot,
    journal: &TransactionJournal,
    index: usize,
    source: &Path,
    expected: &str,
) -> Result<(), StorageError> {
    if source.is_dir() {
        let actual = projected_move_digest(
            root,
            Path::new(journal.steps[index].staged.as_str()),
            &journal.steps[..index],
        )?;
        if actual == expected {
            Ok(())
        } else {
            Err(StorageError::WriteConflict)
        }
    } else {
        verify_digest(source, expected)
    }
}

fn classify_physical_replace(
    root: &VaultRoot,
    step: &TransactionStep,
    applied_moves: &[(usize, PathBuf, PathBuf)],
    result_digest: &str,
) -> Result<PhysicalStepState, StorageError> {
    let target = root.resolve(&remap_through_moves(
        Path::new(step.target.as_str()),
        applied_moves,
    ))?;
    let staged = root.resolve(&remap_through_moves(
        Path::new(step.staged.as_str()),
        applied_moves,
    ))?;
    let backup_path = step
        .backup
        .as_ref()
        .expect("replacement backup was validated");
    let backup = root.resolve(&remap_through_moves(
        Path::new(backup_path.as_str()),
        applied_moves,
    ))?;
    let expected = step
        .expected_sha256
        .as_deref()
        .expect("replacement target digest was validated");
    let present = (
        staged.as_path().exists(),
        target.as_path().exists(),
        backup.as_path().exists(),
    );
    match present {
        (true, true, false) => {
            verify_digest(staged.as_path(), result_digest)?;
            verify_raw_file_digest(target.as_path(), expected)?;
            Ok(PhysicalStepState::Unapplied)
        }
        (true, false, true) => {
            verify_digest(staged.as_path(), result_digest)?;
            verify_raw_file_digest(backup.as_path(), expected)?;
            Ok(PhysicalStepState::ReplaceMidway)
        }
        (false, true, true) => {
            verify_digest(target.as_path(), result_digest)?;
            verify_raw_file_digest(backup.as_path(), expected)?;
            Ok(PhysicalStepState::Applied)
        }
        _ => Err(StorageError::RecoveryRequired(format!(
            "replacement filesystem state is inconsistent for `{}`",
            step.target
        ))),
    }
}

fn remap_through_moves(path: &Path, moves: &[(usize, PathBuf, PathBuf)]) -> PathBuf {
    let mut current = path.to_path_buf();
    for (_, source, target) in moves {
        if let Ok(suffix) = current.strip_prefix(source) {
            current = target.join(suffix);
        }
    }
    current
}

fn require_sealed(journal: &TransactionJournal) -> Result<(), StorageError> {
    if journal.is_sealed() {
        Ok(())
    } else {
        Err(StorageError::RecoveryRequired(
            "transaction journal predates sealed recovery and requires a safe copy review"
                .to_owned(),
        ))
    }
}
