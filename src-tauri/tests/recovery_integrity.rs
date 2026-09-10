use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::thread;
use std::time::Duration;

use pixel_cutout_sprite_studio_lib::application::{VaultInspection, VaultOpenMode, VaultService};
use pixel_cutout_sprite_studio_lib::domain::{
    validate_name, validate_schema, DocumentKind, DomainError, ObjectId, RelativePath, UtcTimestamp,
};
use pixel_cutout_sprite_studio_lib::storage::{
    hash_managed_path, InterruptAfterStep, JsonStore, LockOwner, NoTransactionFault,
    RecoveryChoice, StorageError, StoredJson, TransactionAction, TransactionPurpose,
    TransactionService, TransactionState, TransactionStep, VaultLayout, VaultRoot, VersionStamp,
};
use tempfile::TempDir;

// Test-only legacy fixture: no retired model is linked into the production crate.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Project {
    schema_version: u32,
    kind: DocumentKind,
    id: ObjectId,
    revision: u32,
    name: String,
    status: String,
    workspace_label_ids: Vec<ObjectId>,
    created_at: UtcTimestamp,
    updated_at: UtcTimestamp,
}
impl StoredJson for Project {
    fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_name("fixture.name", &self.name)?;
        if self.kind != DocumentKind::Project || self.revision == 0 {
            return Err(DomainError::invalid("fixture", "invalid kind or revision"));
        }
        Ok(())
    }
}

const PROJECT_FOLDER: &str = "game--11111111";
const CREATED_AT: &str = "2026-09-05T08:00:00Z";
const UPDATED_AT: &str = "2026-09-05T09:00:00Z";

fn timestamp(value: &str) -> UtcTimestamp {
    UtcTimestamp::parse(value).unwrap()
}

fn project(id: ObjectId, name: &str, revision: u32) -> Project {
    Project {
        schema_version: 1,
        kind: DocumentKind::Project,
        id,
        revision,
        name: name.to_owned(),
        status: "active".to_owned(),
        workspace_label_ids: Vec::new(),
        created_at: timestamp(CREATED_AT),
        updated_at: timestamp(UPDATED_AT),
    }
}

fn initialize_closed(temp: &TempDir) -> ObjectId {
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    service.close(opened.session_id).unwrap();
    opened.vault_id
}

fn write_project(root: &VaultRoot, folder: &str, value: Project) {
    root.ensure_directory(Path::new(folder).join(".project/transactions").as_path())
        .unwrap();
    root.ensure_directory(Path::new(folder).join(".project/backups").as_path())
        .unwrap();
    JsonStore::default()
        .create(
            &root
                .resolve(Path::new(folder).join(".project/project.json").as_path())
                .unwrap(),
            &value,
        )
        .unwrap();
}

fn relative(value: impl AsRef<Path>) -> RelativePath {
    RelativePath::parse(value.as_ref().to_string_lossy().replace('\\', "/")).unwrap()
}

fn stage_file(root: &VaultRoot, relative: &Path, bytes: &[u8]) {
    root.ensure_directory(relative.parent().unwrap()).unwrap();
    fs::write(root.resolve(relative).unwrap().as_path(), bytes).unwrap();
}

fn set_journal_progress(root: &VaultRoot, folder: &str, id: ObjectId, state: &str, cursor: u64) {
    let journal =
        TransactionService::<NoTransactionFault>::journal_path(Path::new(folder), id).unwrap();
    let path = root.resolve(Path::new(journal.as_str())).unwrap();
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
    value["state"] = serde_json::Value::String(state.to_owned());
    value["cursor"] = serde_json::Value::from(cursor);
    fs::write(path.as_path(), serde_json::to_vec_pretty(&value).unwrap()).unwrap();
}

#[test]
fn real_replace_uses_raw_version_stamp_and_cleans_terminal_administration() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Before", 1));
    let target = Path::new(PROJECT_FOLDER).join(".project/project.json");
    let loaded = JsonStore::default()
        .load::<Project>(&root.resolve(&target).unwrap())
        .unwrap();
    let transaction_id = ObjectId::new();
    let stage_root = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let stage = stage_root.join("project.json");
    let backup = Path::new(PROJECT_FOLDER)
        .join(".project/backups/saves")
        .join(transaction_id.to_string())
        .join("project.json");
    root.ensure_directory(&stage_root).unwrap();
    JsonStore::default()
        .create(
            &root.resolve(&stage).unwrap(),
            &project(project_id, "After", 2),
        )
        .unwrap();
    let transactions = TransactionService::default();
    transactions
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::General,
            vec![TransactionStep {
                action: TransactionAction::Replace,
                target: relative(&target),
                staged: relative(&stage),
                backup: Some(relative(&backup)),
                expected_sha256: Some(loaded.stamp.sha256),
            }],
        )
        .unwrap();
    let committed = transactions
        .execute(&root, Path::new(PROJECT_FOLDER), transaction_id)
        .unwrap();
    assert_eq!(committed.state, TransactionState::Committed);
    let saved = JsonStore::default()
        .load::<Project>(&root.resolve(&target).unwrap())
        .unwrap()
        .value;
    assert_eq!(saved.name, "After");
    assert!(!root.resolve(&backup).unwrap().as_path().exists());
    assert!(!root.resolve(&stage_root).unwrap().as_path().exists());
    assert!(!root
        .resolve(Path::new(
            TransactionService::<NoTransactionFault>::journal_path(
                Path::new(PROJECT_FOLDER),
                transaction_id,
            )
            .unwrap()
            .as_str(),
        ))
        .unwrap()
        .as_path()
        .exists());
}

#[test]
fn replacement_crash_window_resumes_or_rolls_back_from_project_local_evidence() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Original", 1));
    let target = Path::new(PROJECT_FOLDER).join(".project/project.json");

    for (choice, expected_name) in [
        (RecoveryChoice::Resume, "Replacement"),
        (RecoveryChoice::Rollback, "Replacement"),
    ] {
        let original = fs::read(root.resolve(&target).unwrap().as_path()).unwrap();
        let transaction_id = ObjectId::new();
        let stage = Path::new(PROJECT_FOLDER)
            .join(".project/transactions")
            .join(format!("{transaction_id}.stage/project.json"));
        let backup = Path::new(PROJECT_FOLDER)
            .join(".project/backups/windows")
            .join(transaction_id.to_string())
            .join("project.json");
        root.ensure_directory(stage.parent().unwrap()).unwrap();
        JsonStore::default()
            .create(
                &root.resolve(&stage).unwrap(),
                &project(
                    project_id,
                    "Replacement",
                    if choice == RecoveryChoice::Resume {
                        2
                    } else {
                        3
                    },
                ),
            )
            .unwrap();
        let transactions = TransactionService::default();
        transactions
            .prepare(
                &root,
                Path::new(PROJECT_FOLDER),
                transaction_id,
                TransactionPurpose::General,
                vec![TransactionStep {
                    action: TransactionAction::Replace,
                    target: relative(&target),
                    staged: relative(&stage),
                    backup: Some(relative(&backup)),
                    expected_sha256: Some(VersionStamp::from_bytes(&original).sha256),
                }],
            )
            .unwrap();
        set_journal_progress(&root, PROJECT_FOLDER, transaction_id, "applying", 0);
        root.ensure_directory(backup.parent().unwrap()).unwrap();
        fs::rename(
            root.resolve(&target).unwrap().as_path(),
            root.resolve(&backup).unwrap().as_path(),
        )
        .unwrap();

        let candidates = TransactionService::<NoTransactionFault>::scan_open(&root).unwrap();
        assert!(candidates
            .iter()
            .any(|candidate| candidate.transaction_id == transaction_id));
        transactions
            .recover_candidate(&root, transaction_id, choice)
            .unwrap();
        let saved = JsonStore::default()
            .load::<Project>(&root.resolve(&target).unwrap())
            .unwrap()
            .value;
        if choice == RecoveryChoice::Resume {
            assert_eq!(saved.name, expected_name);
        } else {
            assert_eq!(
                fs::read(root.resolve(&target).unwrap().as_path()).unwrap(),
                original
            );
        }
    }
}

#[test]
fn faulted_plan_enters_same_session_barrier_and_recovers_without_reopening() {
    let temp = TempDir::new().unwrap();
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    let root = service.session_root(opened.session_id, true).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Barrier", 1));
    let transaction_id = ObjectId::new();
    let stage_root = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let first_stage = stage_root.join("first.txt");
    let second_stage = stage_root.join("second.txt");
    stage_file(&root, &first_stage, b"first");
    stage_file(&root, &second_stage, b"second");
    let steps = vec![
        TransactionStep {
            action: TransactionAction::Create,
            target: relative(Path::new(PROJECT_FOLDER).join("first.txt")),
            staged: relative(&first_stage),
            backup: None,
            expected_sha256: None,
        },
        TransactionStep {
            action: TransactionAction::Create,
            target: relative(Path::new(PROJECT_FOLDER).join("second.txt")),
            staged: relative(&second_stage),
            backup: None,
            expected_sha256: None,
        },
    ];
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    interrupted
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::General,
            steps,
        )
        .unwrap();
    assert!(matches!(
        interrupted.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    assert!(matches!(
        service.session_root(opened.session_id, true),
        Err(StorageError::RecoveryRequired(_))
    ));
    assert!(matches!(
        service.write_lease(opened.session_id),
        Err(StorageError::RecoveryRequired(_))
    ));
    assert!(matches!(
        service.session_root_at_generation(opened.session_id, opened.session_generation, true),
        Err(StorageError::RecoveryRequired(_))
    ));

    let blocked = service.list_recovery(opened.session_id).unwrap();
    assert_eq!(blocked.mode, VaultOpenMode::ReadOnly);
    assert!(blocked.recovery_writable);
    assert_eq!(blocked.recovery.len(), 1);
    let recovered = service
        .recover_transaction(opened.session_id, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    assert!(recovered.recovery.is_empty());
    assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
    assert!(!recovered.recovery_writable);
    assert_eq!(
        fs::read(temp.path().join(PROJECT_FOLDER).join("first.txt")).unwrap(),
        b"first"
    );
    assert_eq!(
        fs::read(temp.path().join(PROJECT_FOLDER).join("second.txt")).unwrap(),
        b"second"
    );
    assert!(service.session_root(opened.session_id, true).is_ok());
    service.close(opened.session_id).unwrap();
}

#[test]
fn cursor_stage_scope_and_filename_tampering_never_skip_work() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Integrity", 1),
    );
    write_project(
        &root,
        "other--22222222",
        project(ObjectId::new(), "Other", 1),
    );
    let transaction_id = ObjectId::new();
    let stage_root = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let first = stage_root.join("first.txt");
    let second = stage_root.join("second.txt");
    stage_file(&root, &first, b"one");
    stage_file(&root, &second, b"two");
    let transactions = TransactionService::default();
    transactions
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::General,
            vec![
                TransactionStep {
                    action: TransactionAction::Create,
                    target: relative(Path::new(PROJECT_FOLDER).join("one.txt")),
                    staged: relative(&first),
                    backup: None,
                    expected_sha256: None,
                },
                TransactionStep {
                    action: TransactionAction::Create,
                    target: relative(Path::new(PROJECT_FOLDER).join("two.txt")),
                    staged: relative(&second),
                    backup: None,
                    expected_sha256: None,
                },
            ],
        )
        .unwrap();
    set_journal_progress(&root, PROJECT_FOLDER, transaction_id, "applying", 1);
    assert!(matches!(
        transactions.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::RecoveryRequired(_))
    ));
    assert!(!temp.path().join(PROJECT_FOLDER).join("one.txt").exists());
    assert!(!temp.path().join(PROJECT_FOLDER).join("two.txt").exists());

    // Changing sealed stage contents is detected before publication.
    set_journal_progress(&root, PROJECT_FOLDER, transaction_id, "applying", 0);
    fs::write(root.resolve(&first).unwrap().as_path(), b"tampered").unwrap();
    assert!(matches!(
        transactions.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::WriteConflict)
    ));

    let cross_id = ObjectId::new();
    let cross_stage = Path::new(PROJECT_FOLDER).join(".project/transactions/cross.txt");
    stage_file(&root, &cross_stage, b"cross");
    assert!(matches!(
        transactions.prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            cross_id,
            TransactionPurpose::General,
            vec![TransactionStep {
                action: TransactionAction::Create,
                target: relative("other--22222222/stolen.txt"),
                staged: relative(&cross_stage),
                backup: None,
                expected_sha256: None,
            }],
        ),
        Err(StorageError::InvalidVault(_))
    ));

    // A sealed journal is addressed by its id and must have the exact canonical filename.
    let file_id = ObjectId::new();
    let file_stage = Path::new(PROJECT_FOLDER).join(".project/transactions/file-stage.txt");
    stage_file(&root, &file_stage, b"file");
    transactions
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            file_id,
            TransactionPurpose::General,
            vec![TransactionStep {
                action: TransactionAction::Create,
                target: relative(Path::new(PROJECT_FOLDER).join("file.txt")),
                staged: relative(&file_stage),
                backup: None,
                expected_sha256: None,
            }],
        )
        .unwrap();
    let canonical = root
        .resolve(Path::new(
            TransactionService::<NoTransactionFault>::journal_path(
                Path::new(PROJECT_FOLDER),
                file_id,
            )
            .unwrap()
            .as_str(),
        ))
        .unwrap();
    let forged = canonical.as_path().with_file_name("forged.json");
    fs::rename(canonical.as_path(), &forged).unwrap();
    assert!(matches!(
        TransactionService::<NoTransactionFault>::scan_open(&root),
        Err(StorageError::RecoveryRequired(_))
    ));
}

#[test]
fn projected_project_rename_hash_survives_crash_after_directory_move() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Old", 1));
    fs::write(
        temp.path().join(PROJECT_FOLDER).join("user-data.bin"),
        b"keep",
    )
    .unwrap();
    let target_manifest = Path::new(PROJECT_FOLDER).join(".project/project.json");
    let loaded = JsonStore::default()
        .load::<Project>(&root.resolve(&target_manifest).unwrap())
        .unwrap();
    let transaction_id = ObjectId::new();
    let stage = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage/project.json"));
    let backup = Path::new(PROJECT_FOLDER)
        .join(".project/backups/renames")
        .join(transaction_id.to_string())
        .join("project.json");
    root.ensure_directory(stage.parent().unwrap()).unwrap();
    JsonStore::default()
        .create(
            &root.resolve(&stage).unwrap(),
            &project(project_id, "Renamed", 2),
        )
        .unwrap();
    let renamed_folder = "renamed--11111111";
    let steps = vec![
        TransactionStep {
            action: TransactionAction::Replace,
            target: relative(&target_manifest),
            staged: relative(&stage),
            backup: Some(relative(&backup)),
            expected_sha256: Some(loaded.stamp.sha256),
        },
        TransactionStep {
            action: TransactionAction::Move,
            target: relative(renamed_folder),
            staged: relative(PROJECT_FOLDER),
            backup: None,
            expected_sha256: None,
        },
    ];
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 2 });
    interrupted
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::ProjectRename,
            steps,
        )
        .unwrap();
    assert!(matches!(
        interrupted.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::TransactionInterrupted { step: 2 })
    ));
    assert!(!temp.path().join(PROJECT_FOLDER).exists());
    assert!(temp.path().join(renamed_folder).exists());
    assert_eq!(
        TransactionService::<NoTransactionFault>::scan_open(&root)
            .unwrap()
            .len(),
        1
    );
    TransactionService::default()
        .recover_candidate(&root, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    let saved = JsonStore::default()
        .load::<Project>(
            &root
                .resolve(
                    Path::new(renamed_folder)
                        .join(".project/project.json")
                        .as_path(),
                )
                .unwrap(),
        )
        .unwrap()
        .value;
    assert_eq!(saved.name, "Renamed");
    assert_eq!(
        fs::read(temp.path().join(renamed_folder).join("user-data.bin")).unwrap(),
        b"keep"
    );
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn os_lock_never_offers_active_writer_and_requires_exact_orphan_confirmation() {
    let temp = TempDir::new().unwrap();
    let mut first = VaultService::default();
    let writer = first.initialize(temp.path(), None).unwrap();
    let VaultInspection::Valid {
        writer_present: true,
        lock_recovery: None,
        ..
    } = VaultService::inspect(temp.path()).unwrap()
    else {
        panic!("an active OS lock must not be recoverable");
    };
    assert!(matches!(
        VaultService::recover_orphaned_lock(temp.path(), "any-token"),
        Err(StorageError::ActiveLockProtected)
    ));
    let mut second = VaultService::default();
    let reader = second.open(temp.path()).unwrap();
    assert_eq!(reader.mode, VaultOpenMode::ReadOnly);
    assert!(reader.lock_recovery.is_none());

    let lease = first.write_lease(writer.session_id).unwrap();
    first.close(writer.session_id).unwrap();
    assert!(matches!(
        VaultService::inspect(temp.path()).unwrap(),
        VaultInspection::Valid {
            writer_present: true,
            lock_recovery: None,
            ..
        }
    ));
    drop(lease);
    second.close(reader.session_id).unwrap();
    assert!(matches!(
        VaultService::inspect(temp.path()).unwrap(),
        VaultInspection::Valid {
            writer_present: false,
            lock_recovery: None,
            ..
        }
    ));

    let root = VaultRoot::open(temp.path()).unwrap();
    let lock = VaultLayout::new(root).writer_lock().unwrap();
    let orphan = LockOwner {
        schema_version: 1,
        instance_id: ObjectId::new(),
        writer_token: ObjectId::new(),
        process_id: 424_242,
        acquired_at: CREATED_AT.to_owned(),
        heartbeat_at: UPDATED_AT.to_owned(),
    };
    fs::write(lock.as_path(), serde_json::to_vec_pretty(&orphan).unwrap()).unwrap();
    let VaultInspection::Valid {
        lock_recovery: Some(recovery),
        ..
    } = VaultService::inspect(temp.path()).unwrap()
    else {
        panic!("orphan metadata should be offered only after the OS guard is free");
    };
    assert!(!recovery.damaged);
    assert!(matches!(
        VaultService::recover_orphaned_lock(temp.path(), "wrong"),
        Err(StorageError::LockRecoveryRequired { .. })
    ));
    VaultService::recover_orphaned_lock(temp.path(), &recovery.confirmation_token).unwrap();
    assert!(!lock.as_path().exists());

    // Empty metadata is a crash artifact, never an invitation to take the lock automatically.
    fs::write(lock.as_path(), b"").unwrap();
    let VaultInspection::Valid {
        lock_recovery: Some(empty),
        ..
    } = VaultService::inspect(temp.path()).unwrap()
    else {
        panic!("zero-byte lock metadata must require confirmation");
    };
    assert!(empty.damaged);
    let mut third = VaultService::default();
    let blocked = third.open(temp.path()).unwrap();
    assert_eq!(blocked.mode, VaultOpenMode::ReadOnly);
    assert!(blocked
        .lock_recovery
        .as_ref()
        .is_some_and(|value| value.damaged));
    third.close(blocked.session_id).unwrap();
    VaultService::recover_orphaned_lock(temp.path(), &empty.confirmation_token).unwrap();
}

#[test]
fn background_mutation_lease_blocks_all_session_writes_until_its_last_clone_drops() {
    let temp = TempDir::new().unwrap();
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    let lease = service.write_lease(opened.session_id).unwrap();
    let worker_clone = lease.clone();

    let second = service.write_lease(opened.session_id).unwrap_err();
    assert!(second.to_string().contains("background vault operation"));
    let synchronous = service.session_root(opened.session_id, true).unwrap_err();
    assert!(synchronous
        .to_string()
        .contains("background vault operation"));
    assert!(service.session_root(opened.session_id, true).is_err());

    drop(lease);
    assert!(service.write_lease(opened.session_id).is_err());
    drop(worker_clone);
    assert!(service.session_root(opened.session_id, true).is_ok());
    assert!(service.write_lease(opened.session_id).is_ok());
}

#[test]
fn a_second_process_opens_read_only_until_the_writer_process_exits() {
    let vault = TempDir::new().unwrap();
    initialize_closed(&vault);
    let signals = TempDir::new().unwrap();
    let ready = signals.path().join("ready");
    let release = signals.path().join("release");
    let mut child = Command::new(env::current_exe().unwrap())
        .arg("--exact")
        .arg("lock_writer_process_helper")
        .arg("--nocapture")
        .arg("--test-threads=1")
        .env("PIXELCUTOUT_LOCK_TEST_VAULT", vault.path())
        .env("PIXELCUTOUT_LOCK_TEST_READY", &ready)
        .env("PIXELCUTOUT_LOCK_TEST_RELEASE", &release)
        .spawn()
        .unwrap();

    for _ in 0..500 {
        if ready.exists() {
            break;
        }
        if let Some(status) = child.try_wait().unwrap() {
            panic!("writer helper exited before acquiring the lock: {status}");
        }
        thread::sleep(Duration::from_millis(10));
    }
    assert!(
        ready.exists(),
        "writer helper did not acquire the lock in time"
    );

    let mut reader = VaultService::default();
    let opened = reader.open(vault.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
    assert!(opened.lock_recovery.is_none());
    reader.close(opened.session_id).unwrap();

    fs::write(&release, b"release").unwrap();
    assert!(child.wait().unwrap().success());
    let mut writer = VaultService::default();
    let reopened = writer.open(vault.path()).unwrap();
    assert_eq!(reopened.mode, VaultOpenMode::ReadWrite);
    writer.close(reopened.session_id).unwrap();
}

#[test]
fn lock_writer_process_helper() {
    let Some(vault) = env::var_os("PIXELCUTOUT_LOCK_TEST_VAULT") else {
        return;
    };
    let ready = env::var_os("PIXELCUTOUT_LOCK_TEST_READY").unwrap();
    let release = env::var_os("PIXELCUTOUT_LOCK_TEST_RELEASE").unwrap();
    let mut writer = VaultService::default();
    let opened = writer.open(Path::new(&vault)).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    fs::write(Path::new(&ready), b"ready").unwrap();
    for _ in 0..1_000 {
        if Path::new(&release).exists() {
            writer.close(opened.session_id).unwrap();
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
    panic!("parent process did not release the writer helper in time");
}

#[test]
fn foreign_json_and_old_projects_are_preserved_without_building_a_legacy_index() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Managed", 1));
    let broken_path = temp.path().join("notes/broken.json");
    fs::create_dir_all(broken_path.parent().unwrap()).unwrap();
    let broken = b"{ this is deliberately not JSON }";
    fs::write(&broken_path, broken).unwrap();
    let lookalike_path = temp.path().join("foreign-project.json");
    let lookalike = serde_json::to_vec_pretty(&project(project_id, "Lookalike", 1)).unwrap();
    fs::write(&lookalike_path, &lookalike).unwrap();
    let nested_lookalikes = [
        "foreign/area/npc/character.json",
        "foreign/area/npc/appearances/default.json",
        "foreign/area/npc/profile/binding.json",
    ];
    let nested = br#"{
  "schema_version": 1,
  "kind": "character",
  "id": "44444444-4444-4444-8444-444444444444"
}"#;
    for relative in nested_lookalikes {
        let path = temp.path().join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, nested).unwrap();
    }
    let before = snapshot_tree(temp.path());

    let mut service = VaultService::default();
    let opened = service.open(temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    assert_eq!(opened.indexed_objects, 1);
    service.close(opened.session_id).unwrap();

    assert_eq!(fs::read(&broken_path).unwrap(), broken);
    assert_eq!(fs::read(&lookalike_path).unwrap(), lookalike);
    for relative in nested_lookalikes {
        assert_eq!(fs::read(temp.path().join(relative)).unwrap(), nested);
    }
    assert_eq!(snapshot_tree(temp.path()), before);
}

#[test]
fn malformed_legacy_documents_are_opaque_user_files_not_an_open_blocker() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Managed", 1),
    );
    let manifest = temp
        .path()
        .join(PROJECT_FOLDER)
        .join("area--22222222/.area/area.json");
    fs::create_dir_all(manifest.parent().unwrap()).unwrap();
    let malformed = br#"{
  "schema_version": 1,
  "kind": "area",
  "id": "22222222-2222-4222-8222-222222222222"
}"#;
    fs::write(&manifest, malformed).unwrap();
    let before = snapshot_tree(temp.path());

    let mut service = VaultService::default();
    let opened = service.open(temp.path()).unwrap();
    service.close(opened.session_id).unwrap();
    assert_eq!(snapshot_tree(temp.path()), before);
    assert_eq!(fs::read(&manifest).unwrap(), malformed);
}

#[test]
fn project_creation_crash_without_journal_is_preserved_in_place() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let staging = format!(".creating-project--{}", ObjectId::new());
    write_project(
        &root,
        &staging,
        project(ObjectId::new(), "Never published", 1),
    );
    fs::write(temp.path().join(&staging).join("source.bin"), b"preserve").unwrap();
    let before = snapshot_tree(temp.path());
    let mut service = VaultService::default();
    let opened = service.open(temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    service.close(opened.session_id).unwrap();
    assert_eq!(snapshot_tree(temp.path()), before);
}

#[test]
fn move_expected_stamp_rejects_external_change_before_journal_creation() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Move CAS", 1),
    );
    let source = Path::new(PROJECT_FOLDER).join("profile.json");
    let target = Path::new(PROJECT_FOLDER).join(".project/trash/profile.json");
    fs::write(root.resolve(&source).unwrap().as_path(), b"observed").unwrap();
    let expected = VersionStamp::from_bytes(b"observed");
    fs::write(root.resolve(&source).unwrap().as_path(), b"external edit").unwrap();
    let transaction_id = ObjectId::new();
    let transactions = TransactionService::default();
    assert!(matches!(
        transactions.prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::TrashMove,
            vec![TransactionStep {
                action: TransactionAction::Move,
                target: relative(&target),
                staged: relative(&source),
                backup: None,
                expected_sha256: Some(expected.sha256),
            }],
        ),
        Err(StorageError::WriteConflict)
    ));
    assert_eq!(
        fs::read(root.resolve(&source).unwrap().as_path()).unwrap(),
        b"external edit"
    );
    assert!(!root.resolve(&target).unwrap().as_path().exists());
    let journal = TransactionService::<NoTransactionFault>::journal_path(
        Path::new(PROJECT_FOLDER),
        transaction_id,
    )
    .unwrap();
    assert!(!root
        .resolve(Path::new(journal.as_str()))
        .unwrap()
        .as_path()
        .exists());
}

#[test]
fn directory_move_expected_tree_digest_rejects_external_change_before_journal_creation() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Tree move CAS", 1),
    );
    fs::write(
        temp.path().join(PROJECT_FOLDER).join("observed.txt"),
        b"observed",
    )
    .unwrap();
    let expected = hash_managed_path(&temp.path().join(PROJECT_FOLDER)).unwrap();
    fs::write(
        temp.path().join(PROJECT_FOLDER).join("external.txt"),
        b"external edit",
    )
    .unwrap();
    let transaction_id = ObjectId::new();
    let transactions = TransactionService::default();
    assert!(matches!(
        transactions.prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::TrashMove,
            vec![TransactionStep {
                action: TransactionAction::Move,
                target: relative(Path::new(".trash").join(PROJECT_FOLDER)),
                staged: relative(PROJECT_FOLDER),
                backup: None,
                expected_sha256: Some(expected),
            }],
        ),
        Err(StorageError::WriteConflict)
    ));
    assert!(temp.path().join(PROJECT_FOLDER).is_dir());
    assert!(!temp.path().join(".trash").join(PROJECT_FOLDER).exists());
    let journal = TransactionService::<NoTransactionFault>::journal_path(
        Path::new(PROJECT_FOLDER),
        transaction_id,
    )
    .unwrap();
    assert!(!root
        .resolve(Path::new(journal.as_str()))
        .unwrap()
        .as_path()
        .exists());
}

#[test]
fn occupied_create_target_disables_resume_and_rollback_preserves_foreign_bytes() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Collision", 1),
    );
    let transaction_id = ObjectId::new();
    let stage_root = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let stage = stage_root.join("payload.txt");
    let target = Path::new(PROJECT_FOLDER).join("payload.txt");
    stage_file(&root, &stage, b"managed payload");
    let transactions = TransactionService::default();
    transactions
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::General,
            vec![TransactionStep {
                action: TransactionAction::Create,
                target: relative(&target),
                staged: relative(&stage),
                backup: None,
                expected_sha256: None,
            }],
        )
        .unwrap();
    fs::write(root.resolve(&target).unwrap().as_path(), b"foreign winner").unwrap();

    assert!(matches!(
        transactions.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::WriteConflict)
    ));
    let candidates = TransactionService::<NoTransactionFault>::scan_open(&root).unwrap();
    let candidate = candidates
        .iter()
        .find(|candidate| candidate.transaction_id == transaction_id)
        .unwrap();
    assert!(!candidate.can_resume);
    assert!(candidate.can_rollback);
    transactions
        .recover_candidate(&root, transaction_id, RecoveryChoice::Rollback)
        .unwrap();

    assert_eq!(
        fs::read(root.resolve(&target).unwrap().as_path()).unwrap(),
        b"foreign winner"
    );
    assert!(!root.resolve(&stage_root).unwrap().as_path().exists());
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn occupied_project_rename_destination_rolls_back_applied_manifest_only() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let root = VaultRoot::open(temp.path()).unwrap();
    let project_id = ObjectId::new();
    write_project(&root, PROJECT_FOLDER, project(project_id, "Original", 1));
    let manifest = Path::new(PROJECT_FOLDER).join(".project/project.json");
    let original = fs::read(root.resolve(&manifest).unwrap().as_path()).unwrap();
    let stamp = VersionStamp::from_bytes(&original);
    let transaction_id = ObjectId::new();
    let stage = Path::new(PROJECT_FOLDER)
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage/project.json"));
    let backup = Path::new(PROJECT_FOLDER)
        .join(".project/backups/renames")
        .join(transaction_id.to_string())
        .join("project.json");
    root.ensure_directory(stage.parent().unwrap()).unwrap();
    JsonStore::default()
        .create(
            &root.resolve(&stage).unwrap(),
            &project(project_id, "Desired", 2),
        )
        .unwrap();
    let destination = Path::new("desired--33333333");
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    interrupted
        .prepare(
            &root,
            Path::new(PROJECT_FOLDER),
            transaction_id,
            TransactionPurpose::ProjectRename,
            vec![
                TransactionStep {
                    action: TransactionAction::Replace,
                    target: relative(&manifest),
                    staged: relative(&stage),
                    backup: Some(relative(&backup)),
                    expected_sha256: Some(stamp.sha256),
                },
                TransactionStep {
                    action: TransactionAction::Move,
                    target: relative(destination),
                    staged: relative(PROJECT_FOLDER),
                    backup: None,
                    expected_sha256: None,
                },
            ],
        )
        .unwrap();
    assert!(matches!(
        interrupted.execute(&root, Path::new(PROJECT_FOLDER), transaction_id),
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    fs::create_dir(root.resolve(destination).unwrap().as_path()).unwrap();
    fs::write(
        root.resolve(&destination.join("sentinel.txt"))
            .unwrap()
            .as_path(),
        b"foreign directory",
    )
    .unwrap();

    let candidates = TransactionService::<NoTransactionFault>::scan_open(&root).unwrap();
    let candidate = candidates
        .iter()
        .find(|candidate| candidate.transaction_id == transaction_id)
        .unwrap();
    assert!(!candidate.can_resume);
    assert!(candidate.can_rollback);
    TransactionService::default()
        .recover_candidate(&root, transaction_id, RecoveryChoice::Rollback)
        .unwrap();

    assert_eq!(
        fs::read(root.resolve(&manifest).unwrap().as_path()).unwrap(),
        original
    );
    assert_eq!(
        fs::read(
            root.resolve(&destination.join("sentinel.txt"))
                .unwrap()
                .as_path()
        )
        .unwrap(),
        b"foreign directory"
    );
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn legacy_and_future_project_files_are_never_migrated_on_open() {
    let temp = TempDir::new().unwrap();
    initialize_closed(&temp);
    let legacy = include_bytes!("fixtures/migrations/project-v0.json");
    let future = include_bytes!("fixtures/contracts/invalid/future-project.json");
    for (folder, bytes) in [
        ("legacy--11111111", legacy.as_slice()),
        ("future--22222222", future.as_slice()),
    ] {
        let target = temp.path().join(folder).join(".project/project.json");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(target, bytes).unwrap();
    }
    let before = snapshot_tree(temp.path());
    assert!(matches!(
        VaultService::inspect(temp.path()).unwrap(),
        VaultInspection::Valid { .. }
    ));
    assert_eq!(snapshot_tree(temp.path()), before);
    let mut service = VaultService::default();
    let opened = service.open(temp.path()).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    service.close(opened.session_id).unwrap();
    assert_eq!(snapshot_tree(temp.path()), before);
}

#[test]
fn a_clean_copied_vault_reopens_without_origin_paths_or_stale_lock_ownership() {
    let origin = TempDir::new().unwrap();
    let vault_id = initialize_closed(&origin);
    let root = VaultRoot::open(origin.path()).unwrap();
    write_project(
        &root,
        PROJECT_FOLDER,
        project(ObjectId::new(), "Portable", 1),
    );
    root.ensure_directory(Path::new(PROJECT_FOLDER).join(".project/cache").as_path())
        .unwrap();
    fs::write(
        origin
            .path()
            .join(PROJECT_FOLDER)
            .join(".project/cache/origin.txt"),
        origin.path().to_string_lossy().as_bytes(),
    )
    .unwrap();

    let destination_parent = TempDir::new().unwrap();
    let destination = destination_parent.path().join("portable-vault");
    copy_tree(origin.path(), &destination);
    fs::remove_dir_all(destination.join(PROJECT_FOLDER).join(".project/cache")).unwrap();
    let mut service = VaultService::default();
    let opened = service.open(&destination).unwrap();
    assert_eq!(opened.vault_id, vault_id);
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    assert_eq!(opened.indexed_objects, 1);
    assert_eq!(
        opened.path,
        destination.canonicalize().unwrap().to_string_lossy()
    );
    assert!(!origin
        .path()
        .join(".pixelforge-studio/runtime/writer.lock.json")
        .exists());
    service.close(opened.session_id).unwrap();
}

fn snapshot_tree(root: &Path) -> BTreeMap<String, Option<Vec<u8>>> {
    fn collect(root: &Path, directory: &Path, output: &mut BTreeMap<String, Option<Vec<u8>>>) {
        let mut entries = fs::read_dir(directory)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        entries.sort_by_key(fs::DirEntry::file_name);
        for entry in entries {
            let path = entry.path();
            let relative = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            if entry.file_type().unwrap().is_dir() {
                output.insert(relative, None);
                collect(root, &path, output);
            } else {
                output.insert(relative, Some(fs::read(&path).unwrap()));
            }
        }
    }
    let mut output = BTreeMap::new();
    collect(root, root, &mut output);
    output
}

fn copy_tree(source: &Path, destination: &Path) {
    fs::create_dir(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let target = destination.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}
