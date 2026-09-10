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

    fs::write(
        root.path().join(".PixelStudio/vault.json"),
        b"{\"unknown\":true}",
    )
    .unwrap();
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
        .write_json(
            Path::new("../outside.json"),
            &json!({}),
            &WriteExpectation::default()
        )
        .is_err());
    assert!(writer
        .write_json(
            Path::new(".PixelPrompt/CON.json"),
            &json!({}),
            &WriteExpectation::default()
        )
        .is_err());

    let path = Path::new(".PixelPrompt/test.json");
    let first = writer
        .write_json(
            path,
            &json!({"revision": 1}),
            &WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            },
        )
        .unwrap();
    fs::write(root.path().join(path), b"{\"revision\":9}").unwrap();
    assert!(matches!(
        writer.write_json(
            path,
            &json!({"revision": 2}),
            &WriteExpectation {
                expected_sha256: Some(first.sha256),
                ..WriteExpectation::default()
            },
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
            expectation: WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            },
        },
        ManagedFileWrite {
            relative_path: PathBuf::from(".PixelPrompt/A/two.md"),
            bytes: b"complete generation".to_vec(),
            expectation: WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            },
        },
    ];
    let interrupted = WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1));
    assert!(matches!(
        interrupted.publish_file_set(&writes),
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    assert_eq!(
        WorkspaceWriter::new(root.clone())
            .recover_file_sets()
            .unwrap(),
        1
    );
    assert_eq!(
        fs::read(root.path().join(".PixelPrompt/A/one.json")).unwrap(),
        writes[0].bytes
    );
    assert_eq!(
        fs::read(root.path().join(".PixelPrompt/A/two.md")).unwrap(),
        writes[1].bytes
    );
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
        result_sha256: Some(digest(b"new")),
    };
    publish_step(&root, &step, &NoWorkspaceFault).unwrap();
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
            &WriteExpectation {
                create_only: true,
                ..WriteExpectation::default()
            },
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

#[test]
fn prepared_incomplete_staging_is_discarded_without_touching_old_targets() {
    let (_temp, root) = root();
    ensure_workspace(&root, "vault-one").unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let base = format!(".PixelStudio/transactions/{id}");
    let target = Path::new("old.json");
    fs::write(root.path().join(target), b"old").unwrap();
    let journal = FileSetJournal {
        schema_version: 1,
        transaction_id: id,
        state: FileSetState::Prepared,
        cursor: 0,
        steps: vec![FileSetStep {
            target: "old.json".into(),
            staged: format!("{base}/stage/0.data"),
            backup: format!("{base}/backup/0.data"),
            before_sha256: Some(digest(b"old")),
            result_sha256: Some(digest(b"new")),
        }],
    };
    let writer = WorkspaceWriter::new(root.clone());
    writer
        .persist_journal(Path::new(&format!("{base}/journal.json")), &journal)
        .unwrap();
    assert_eq!(writer.recover_file_sets().unwrap(), 1);
    assert_eq!(fs::read(root.path().join(target)).unwrap(), b"old");
    assert!(require_settled_file_sets(&root).is_ok());
}

#[test]
fn recovery_rejects_foreign_stage_backup_scope_and_changed_completed_members() {
    let (_temp, root) = root();
    ensure_workspace(&root, "vault-one").unwrap();
    let writes: Vec<_> = ["one.json", "two.json"]
        .iter()
        .map(|name| ManagedFileWrite {
            relative_path: name.into(),
            bytes: b"generated".to_vec(),
            expectation: WriteExpectation {
                create_only: true,
                ..Default::default()
            },
        })
        .collect();
    assert!(
        WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1))
            .publish_file_set(&writes)
            .is_err()
    );
    fs::write(root.path().join("one.json"), b"changed after crash").unwrap();
    assert!(WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .is_err());
    assert_eq!(
        fs::read(root.path().join("one.json")).unwrap(),
        b"changed after crash"
    );
    let transaction = fs::read_dir(root.path().join(".PixelStudio/transactions"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap();
    let path = transaction.path().join("journal.json");
    let mut journal: FileSetJournal = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    let original = journal.steps[0].staged.clone();
    journal.steps[0].staged = "foreign.json".into();
    assert!(validate_journal(&journal).is_err());
    journal.steps[0].staged = original;
    journal.steps[0].backup = "foreign.json".into();
    assert!(validate_journal(&journal).is_err());
    assert!(validate_journal_location(
        Path::new(".PixelStudio/transactions/other/journal.json"),
        &journal
    )
    .is_err());
}

#[test]
fn managed_deletion_resumes_its_backup_crash_window_and_rejects_stale_hashes() {
    let (_temp, root) = root();
    ensure_workspace(&root, "vault-one").unwrap();
    fs::write(root.path().join("extra.png"), b"old extra").unwrap();
    let writes = [ManagedFileWrite {
        relative_path: "manifest.json".into(),
        bytes: b"new generation".to_vec(),
        expectation: WriteExpectation {
            create_only: true,
            ..Default::default()
        },
    }];
    let mut deletes = [ManagedFileDelete {
        relative_path: "extra.png".into(),
        expected_sha256: digest(b"wrong"),
    }];
    let writer = WorkspaceWriter::new(root.clone());
    assert!(writer.publish_file_changes(&writes, &deletes).is_err());
    assert!(require_settled_file_sets(&root).is_ok());
    deletes[0].expected_sha256 = digest(b"old extra");
    assert!(
        WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(1))
            .publish_file_changes(&writes, &deletes)
            .is_err()
    );
    assert!(!root.path().join("extra.png").exists());
    let transaction = fs::read_dir(root.path().join(".PixelStudio/transactions"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap();
    let path = transaction.path().join("journal.json");
    let mut journal: FileSetJournal = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    journal.cursor = 0; // Simulated power loss after rename, before cursor persistence.
    fs::write(path, serde_json::to_vec(&journal).unwrap()).unwrap();
    writer.recover_file_sets().unwrap();
    assert!(!root.path().join("extra.png").exists());
    assert_eq!(
        fs::read(root.path().join("manifest.json")).unwrap(),
        b"new generation"
    );
}
