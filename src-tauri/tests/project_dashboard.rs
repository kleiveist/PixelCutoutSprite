use std::fs;

use pixel_cutout_sprite_studio_lib::application::{
    LabelMatch, LabelService, ProjectQuery, ProjectService, ProjectSort, ProjectStatusFilter,
    VaultOpenMode, VaultService,
};
use pixel_cutout_sprite_studio_lib::domain::{LabelScope, RecordStatus};
use pixel_cutout_sprite_studio_lib::storage::{
    object_folder, InterruptAfterStep, NoTransactionFault, RecoveryChoice, StorageError,
    TransactionPurpose, TransactionService, VaultRoot, ADMIN_DIR,
};
use tempfile::TempDir;

fn open_vault() -> (
    TempDir,
    VaultService,
    pixel_cutout_sprite_studio_lib::domain::ObjectId,
) {
    let directory = tempfile::tempdir().expect("temporary vault");
    let mut vaults = VaultService::default();
    let opened = vaults
        .initialize(directory.path(), None)
        .expect("vault should initialize");
    (directory, vaults, opened.session_id)
}

#[test]
fn projects_labels_filters_and_view_state_survive_reopen() {
    let (directory, mut vaults, session_id) = open_vault();
    let rpg = LabelService::create(
        &mut vaults,
        session_id,
        LabelScope::Workspace,
        None,
        "RPG".to_owned(),
        "#7ac7ff".to_owned(),
    )
    .expect("workspace label");
    let prototype = LabelService::create(
        &mut vaults,
        session_id,
        LabelScope::Workspace,
        None,
        "Prototype".to_owned(),
        "#ffcc66".to_owned(),
    )
    .expect("second workspace label");
    let first = ProjectService::create(
        &mut vaults,
        session_id,
        "My RPG".to_owned(),
        vec![rpg.id, prototype.id],
    )
    .expect("first project");
    let second = ProjectService::create(
        &mut vaults,
        session_id,
        "Tiny Quest".to_owned(),
        vec![rpg.id],
    )
    .expect("second project");

    let any = ProjectQuery {
        label_ids: vec![prototype.id],
        ..ProjectQuery::default()
    };
    assert_eq!(
        ProjectService::list(&vaults, session_id, &any)
            .unwrap()
            .len(),
        1
    );
    let all = ProjectQuery {
        label_ids: vec![rpg.id, prototype.id],
        label_match: LabelMatch::All,
        sort: ProjectSort::NameAsc,
        ..ProjectQuery::default()
    };
    assert_eq!(
        ProjectService::list(&vaults, session_id, &all).unwrap()[0].id,
        first.id
    );
    let filtered = ProjectQuery {
        search: "quest".to_owned(),
        status: ProjectStatusFilter::Active,
        sort: ProjectSort::NameDesc,
        ..ProjectQuery::default()
    };
    ProjectService::save_view(&vaults, session_id, filtered.clone()).unwrap();

    vaults.close(session_id).unwrap();
    let reopened = vaults.open(directory.path()).expect("vault should reopen");
    let dashboard = ProjectService::dashboard(&vaults, reopened.session_id).unwrap();
    assert_eq!(dashboard.projects.len(), 2);
    assert_eq!(dashboard.view.query, filtered);
    assert!(dashboard.projects.iter().any(|card| card.id == second.id));
}

#[test]
fn label_update_rejects_an_external_same_revision_catalog_edit() {
    let (_directory, mut vaults, session_id) = open_vault();
    let label = LabelService::create(
        &mut vaults,
        session_id,
        LabelScope::Workspace,
        None,
        "Villagers".to_owned(),
        "#55aa77".to_owned(),
    )
    .unwrap();

    let result = LabelService::update_with_catalog_prewrite(
        &mut vaults,
        session_id,
        (
            LabelScope::Workspace,
            None,
            label.id,
            label.revision,
            "Residents".to_owned(),
            "#123456".to_owned(),
        ),
        |path| {
            let mut external: serde_json::Value =
                serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
            external["labels"][0]["color"] = serde_json::Value::String("#abcdef".to_owned());
            fs::write(
                path.as_path(),
                serde_json::to_vec_pretty(&external).unwrap(),
            )
            .unwrap();
            Ok(())
        },
    );
    assert!(matches!(result, Err(StorageError::WriteConflict)));

    let labels = LabelService::list(&vaults, session_id, LabelScope::Workspace, None).unwrap();
    assert_eq!(labels.len(), 1);
    assert_eq!(labels[0].name, "Villagers");
    assert_eq!(labels[0].color, "#abcdef");
    assert_eq!(labels[0].revision, label.revision);
}

#[test]
fn project_view_save_rejects_an_external_same_revision_edit() {
    let (_directory, vaults, session_id) = open_vault();
    let initial = ProjectService::save_view(
        &vaults,
        session_id,
        ProjectQuery {
            search: "initial".to_owned(),
            ..ProjectQuery::default()
        },
    )
    .unwrap();

    let result = ProjectService::save_view_with_prewrite(
        &vaults,
        session_id,
        ProjectQuery {
            search: "local".to_owned(),
            ..ProjectQuery::default()
        },
        |path| {
            let mut external: serde_json::Value =
                serde_json::from_slice(&fs::read(path.as_path()).unwrap()).unwrap();
            external["search"] = serde_json::Value::String("external".to_owned());
            fs::write(
                path.as_path(),
                serde_json::to_vec_pretty(&external).unwrap(),
            )
            .unwrap();
            Ok(())
        },
    );
    assert!(matches!(result, Err(StorageError::WriteConflict)));

    let dashboard = ProjectService::dashboard(&vaults, session_id).unwrap();
    assert_eq!(dashboard.view.query.search, "external");
    assert_eq!(dashboard.view.revision, initial.revision);
}

#[test]
fn rename_duplicate_archive_and_controlled_remove_preserve_identity_rules() {
    let (directory, mut vaults, session_id) = open_vault();
    let original =
        ProjectService::create(&mut vaults, session_id, "Village".to_owned(), Vec::new()).unwrap();
    let renamed = ProjectService::rename(
        &mut vaults,
        session_id,
        original.id,
        original.revision,
        "Market Town".to_owned(),
    )
    .unwrap();
    assert_eq!(renamed.id, original.id);
    assert_eq!(renamed.revision, 2);

    let copy = ProjectService::duplicate(&mut vaults, session_id, renamed.id).unwrap();
    assert_ne!(copy.id, renamed.id);
    assert_eq!(copy.name, "Market Town copy");
    let archived =
        ProjectService::set_archived(&mut vaults, session_id, copy.id, copy.revision, true)
            .unwrap();
    assert_eq!(archived.status, RecordStatus::Archived);

    ProjectService::remove(&mut vaults, session_id, archived.id, archived.revision).unwrap();
    let dashboard = ProjectService::dashboard(&vaults, session_id).unwrap();
    assert_eq!(dashboard.projects.len(), 1);
    assert!(directory
        .path()
        .join(".trash")
        .read_dir()
        .unwrap()
        .next()
        .is_some());
}

#[test]
fn deleting_a_workspace_label_removes_references_but_not_projects() {
    let (_directory, mut vaults, session_id) = open_vault();
    let label = LabelService::create(
        &mut vaults,
        session_id,
        LabelScope::Workspace,
        None,
        "Villagers".to_owned(),
        "#55aa77".to_owned(),
    )
    .unwrap();
    let project =
        ProjectService::create(&mut vaults, session_id, "People".to_owned(), vec![label.id])
            .unwrap();
    ProjectService::save_view(
        &vaults,
        session_id,
        ProjectQuery {
            label_ids: vec![label.id],
            ..ProjectQuery::default()
        },
    )
    .unwrap();

    LabelService::remove(
        &mut vaults,
        session_id,
        LabelScope::Workspace,
        None,
        label.id,
        label.revision,
    )
    .unwrap();
    let dashboard = ProjectService::dashboard(&vaults, session_id).unwrap();
    assert_eq!(dashboard.projects.len(), 1);
    assert_eq!(dashboard.projects[0].id, project.id);
    assert!(dashboard.projects[0].labels.is_empty());
    assert!(dashboard.view.query.label_ids.is_empty());
}

#[test]
fn real_workspace_label_removal_resumes_or_rolls_back_all_files_after_reopen() {
    for choice in [RecoveryChoice::Resume, RecoveryChoice::Rollback] {
        let (directory, mut vaults, session_id) = open_vault();
        let label = LabelService::create(
            &mut vaults,
            session_id,
            LabelScope::Workspace,
            None,
            "Villagers".to_owned(),
            "#55aa77".to_owned(),
        )
        .unwrap();
        let first =
            ProjectService::create(&mut vaults, session_id, "People".to_owned(), vec![label.id])
                .unwrap();
        let second =
            ProjectService::create(&mut vaults, session_id, "Market".to_owned(), vec![label.id])
                .unwrap();
        ProjectService::save_view(
            &vaults,
            session_id,
            ProjectQuery {
                label_ids: vec![label.id],
                ..ProjectQuery::default()
            },
        )
        .unwrap();

        let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
        let removal = LabelService::remove_with_transactions(
            &mut vaults,
            session_id,
            (LabelScope::Workspace, None, label.id, label.revision),
            &interrupted,
        );
        assert!(
            matches!(
                removal,
                Err(StorageError::TransactionInterrupted { step: 1 })
            ),
            "unexpected label-removal result: {removal:?}"
        );
        let interrupted_root = vaults.session_root(session_id, false).unwrap();
        let interrupted_candidate =
            TransactionService::<NoTransactionFault>::scan_open(&interrupted_root)
                .unwrap()
                .into_iter()
                .next()
                .unwrap();
        let global_stage = directory
            .path()
            .join(ADMIN_DIR)
            .join("transactions")
            .join(format!("{}.stage", interrupted_candidate.transaction_id));
        assert!(!global_stage.join("projects").exists());
        assert!(fs::read_dir(&global_stage).unwrap().all(|entry| {
            matches!(
                entry.unwrap().file_name().to_str(),
                Some("labels.json" | "ui.json")
            )
        }));
        let global_backup = directory
            .path()
            .join(ADMIN_DIR)
            .join("backups/transactions")
            .join(interrupted_candidate.transaction_id.to_string());
        assert!(!global_backup.join("projects").exists());
        assert!(!global_backup.join("project.json").exists());
        vaults.close(session_id).unwrap();

        let mut reopened = VaultService::default();
        let recovery_open = reopened.open(directory.path()).unwrap();
        assert_eq!(recovery_open.mode, VaultOpenMode::ReadOnly);
        assert!(recovery_open.recovery_writable);
        assert_eq!(recovery_open.recovery.len(), 1);
        let candidate = &recovery_open.recovery[0];
        assert_eq!(candidate.purpose, TransactionPurpose::WorkspaceLabelRemove);
        assert!(candidate.can_resume);
        assert!(candidate.can_rollback);
        let recovered = reopened
            .recover_transaction(recovery_open.session_id, candidate.transaction_id, choice)
            .unwrap();
        assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
        assert!(recovered.recovery.is_empty());

        let labels = LabelService::list(
            &reopened,
            recovery_open.session_id,
            LabelScope::Workspace,
            None,
        )
        .unwrap();
        let dashboard = ProjectService::dashboard(&reopened, recovery_open.session_id).unwrap();
        assert_eq!(dashboard.projects.len(), 2);
        for original in [&first, &second] {
            let current = dashboard
                .projects
                .iter()
                .find(|project| project.id == original.id)
                .unwrap();
            if choice == RecoveryChoice::Resume {
                assert!(current.workspace_label_ids.is_empty());
                assert_eq!(current.revision, original.revision + 1);
            } else {
                assert_eq!(current.workspace_label_ids, vec![label.id]);
                assert_eq!(current.revision, original.revision);
            }
        }
        if choice == RecoveryChoice::Resume {
            assert!(labels.is_empty());
            assert!(dashboard.view.query.label_ids.is_empty());
        } else {
            assert_eq!(labels.len(), 1);
            assert_eq!(labels[0].id, label.id);
            assert_eq!(dashboard.view.query.label_ids, vec![label.id]);
        }
        reopened.close(recovery_open.session_id).unwrap();
    }
}

#[test]
fn collisions_project_label_scope_and_read_only_mutations_are_checked() {
    let (directory, mut writer, session_id) = open_vault();
    let project =
        ProjectService::create(&mut writer, session_id, "Händlerin".to_owned(), Vec::new())
            .unwrap();
    assert!(ProjectService::create(
        &mut writer,
        session_id,
        "Ha\u{308}ndlerin".to_owned(),
        Vec::new()
    )
    .is_err());

    let local = LabelService::create(
        &mut writer,
        session_id,
        LabelScope::Project,
        Some(project.id),
        "NPC".to_owned(),
        "#abcdef".to_owned(),
    )
    .unwrap();
    let updated = LabelService::update(
        &mut writer,
        session_id,
        LabelScope::Project,
        Some(project.id),
        local.id,
        local.revision,
        "Characters".to_owned(),
        "#123456".to_owned(),
    )
    .unwrap();
    assert_eq!(updated.name, "Characters");
    assert_eq!(
        LabelService::list(&writer, session_id, LabelScope::Project, Some(project.id))
            .unwrap()
            .len(),
        1
    );

    let mut reader = VaultService::default();
    let opened = reader.open(directory.path()).unwrap();
    assert!(
        !ProjectService::dashboard(&reader, opened.session_id)
            .unwrap()
            .writable
    );
    assert!(ProjectService::create(
        &mut reader,
        opened.session_id,
        "Blocked".to_owned(),
        Vec::new()
    )
    .is_err());

    let project_directories = fs::read_dir(directory.path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .count();
    assert_eq!(project_directories, 1);
}

#[test]
fn real_project_create_resumes_or_rolls_back_after_publish_interruption_and_reopen() {
    for choice in [RecoveryChoice::Resume, RecoveryChoice::Rollback] {
        let (directory, mut vaults, session_id) = open_vault();
        let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
        assert!(matches!(
            ProjectService::create_with_transactions(
                &mut vaults,
                session_id,
                "Crash-safe project".to_owned(),
                Vec::new(),
                &interrupted,
            ),
            Err(StorageError::TransactionInterrupted { step: 1 })
        ));
        vaults.close(session_id).unwrap();

        let mut reopened = VaultService::default();
        let recovery_open = reopened.open(directory.path()).unwrap();
        assert_eq!(recovery_open.mode, VaultOpenMode::ReadOnly);
        assert!(recovery_open.recovery_writable);
        assert_eq!(recovery_open.recovery.len(), 1);
        assert_eq!(
            recovery_open.recovery[0].purpose,
            TransactionPurpose::ProjectCreate
        );
        let transaction_id = recovery_open.recovery[0].transaction_id;
        let recovered = reopened
            .recover_transaction(recovery_open.session_id, transaction_id, choice)
            .unwrap();
        assert!(recovered.recovery.is_empty());
        assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);

        let dashboard = ProjectService::dashboard(&reopened, recovery_open.session_id).unwrap();
        if choice == RecoveryChoice::Resume {
            assert_eq!(dashboard.projects.len(), 1);
            assert_eq!(dashboard.projects[0].name, "Crash-safe project");
            assert_eq!(recovered.indexed_objects, 2);
        } else {
            assert!(dashboard.projects.is_empty());
            assert_eq!(recovered.indexed_objects, 1);
            let preserved = directory
                .path()
                .join(".trash")
                .join(format!("rolled-back-project-create--{transaction_id}"));
            assert!(preserved.join(".project/project.json").is_file());
            assert!(preserved.join(".project/labels.json").is_file());
        }
        assert!(fs::read_dir(directory.path()).unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(".creating-project--")
        }));
        reopened.close(recovery_open.session_id).unwrap();
    }
}

#[test]
fn real_project_duplicate_uses_the_same_recoverable_publish_path() {
    let (directory, mut vaults, session_id) = open_vault();
    let source =
        ProjectService::create(&mut vaults, session_id, "Village".to_owned(), Vec::new()).unwrap();
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });
    assert!(matches!(
        ProjectService::duplicate_with_transactions(
            &mut vaults,
            session_id,
            source.id,
            &interrupted,
        ),
        Err(StorageError::TransactionInterrupted { step: 1 })
    ));
    vaults.close(session_id).unwrap();

    let mut reopened = VaultService::default();
    let recovery_open = reopened.open(directory.path()).unwrap();
    let candidate = recovery_open.recovery.first().unwrap();
    assert_eq!(candidate.purpose, TransactionPurpose::ProjectCreate);
    reopened
        .recover_transaction(
            recovery_open.session_id,
            candidate.transaction_id,
            RecoveryChoice::Resume,
        )
        .unwrap();
    let dashboard = ProjectService::dashboard(&reopened, recovery_open.session_id).unwrap();
    assert_eq!(dashboard.projects.len(), 2);
    assert!(dashboard
        .projects
        .iter()
        .any(|project| project.id == source.id && project.name == "Village"));
    assert!(dashboard
        .projects
        .iter()
        .any(|project| project.id != source.id && project.name == "Village copy"));
    reopened.close(recovery_open.session_id).unwrap();
}

#[test]
fn real_project_rename_resumes_or_rolls_back_after_directory_move_and_reopen() {
    for choice in [RecoveryChoice::Resume, RecoveryChoice::Rollback] {
        let (directory, mut vaults, session_id) = open_vault();
        let original =
            ProjectService::create(&mut vaults, session_id, "Village".to_owned(), Vec::new())
                .unwrap();
        let old_folder = object_folder("Village", original.id).unwrap();
        let renamed_folder = object_folder("Market Town", original.id).unwrap();
        fs::write(
            directory.path().join(&old_folder).join("user-data.bin"),
            b"keep",
        )
        .unwrap();

        let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 2 });
        let rename = ProjectService::rename_with_transactions(
            &mut vaults,
            session_id,
            original.id,
            original.revision,
            "Market Town".to_owned(),
            &interrupted,
        );
        assert!(
            matches!(
                rename,
                Err(StorageError::TransactionInterrupted { step: 2 })
            ),
            "unexpected project-rename result: {rename:?}"
        );
        assert!(!directory.path().join(&old_folder).exists());
        assert!(directory.path().join(&renamed_folder).is_dir());
        vaults.close(session_id).unwrap();

        let mut reopened = VaultService::default();
        let recovery_open = reopened.open(directory.path()).unwrap();
        assert_eq!(recovery_open.mode, VaultOpenMode::ReadOnly);
        assert!(recovery_open.recovery_writable);
        assert_eq!(recovery_open.recovery.len(), 1);
        let candidate = &recovery_open.recovery[0];
        assert_eq!(candidate.purpose, TransactionPurpose::ProjectRename);
        assert!(candidate.can_resume);
        assert!(candidate.can_rollback);
        let recovered = reopened
            .recover_transaction(recovery_open.session_id, candidate.transaction_id, choice)
            .unwrap();
        assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);
        assert!(recovered.recovery.is_empty());

        let dashboard = ProjectService::dashboard(&reopened, recovery_open.session_id).unwrap();
        assert_eq!(dashboard.projects.len(), 1);
        let current = &dashboard.projects[0];
        assert_eq!(current.id, original.id);
        let expected_folder = if choice == RecoveryChoice::Resume {
            assert_eq!(current.name, "Market Town");
            assert_eq!(current.revision, original.revision + 1);
            &renamed_folder
        } else {
            assert_eq!(current.name, "Village");
            assert_eq!(current.revision, original.revision);
            &old_folder
        };
        let absent_folder = if choice == RecoveryChoice::Resume {
            &old_folder
        } else {
            &renamed_folder
        };
        assert_eq!(
            fs::read(directory.path().join(expected_folder).join("user-data.bin")).unwrap(),
            b"keep"
        );
        assert!(!directory.path().join(absent_folder).exists());
        reopened.close(recovery_open.session_id).unwrap();
    }
}

#[test]
fn occupied_project_rename_target_is_rejected_before_a_journal_or_manifest_write() {
    let (_directory, mut vaults, session_id) = open_vault();
    let original =
        ProjectService::create(&mut vaults, session_id, "Village".to_owned(), Vec::new()).unwrap();
    let root = vaults.session_root(session_id, true).unwrap();
    let occupied = object_folder("Market Town", original.id).unwrap();
    fs::create_dir(root.resolve(&occupied).unwrap().as_path()).unwrap();

    assert!(matches!(
        ProjectService::rename(
            &mut vaults,
            session_id,
            original.id,
            original.revision,
            "Market Town".to_owned(),
        ),
        Err(StorageError::WriteConflict)
    ));
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
    let dashboard = ProjectService::dashboard(&vaults, session_id).unwrap();
    assert_eq!(dashboard.projects.len(), 1);
    assert_eq!(dashboard.projects[0].name, "Village");
    assert_eq!(dashboard.projects[0].revision, original.revision);
}

#[test]
fn project_remove_rejects_a_tree_change_before_journal_prepare() {
    let (directory, mut vaults, session_id) = open_vault();
    let project =
        ProjectService::create(&mut vaults, session_id, "Village".to_owned(), Vec::new()).unwrap();
    let project_folder = object_folder(&project.name, project.id).unwrap();
    let external = directory
        .path()
        .join(&project_folder)
        .join("external-note.txt");
    let transactions = TransactionService::default();

    let result = ProjectService::remove_with_transactions(
        &mut vaults,
        session_id,
        project.id,
        project.revision,
        &transactions,
        || {
            fs::write(&external, b"arrived after the remove view").unwrap();
            Ok(())
        },
    );

    assert!(matches!(result, Err(StorageError::WriteConflict)));
    assert_eq!(
        fs::read(&external).unwrap(),
        b"arrived after the remove view"
    );
    assert!(directory.path().join(&project_folder).is_dir());
    assert!(!directory
        .path()
        .join(".trash")
        .join(&project_folder)
        .exists());
    let root = VaultRoot::open(directory.path()).unwrap();
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
}

#[test]
fn interrupted_project_remove_resumes_or_rolls_back_after_reopen() {
    for choice in [RecoveryChoice::Resume, RecoveryChoice::Rollback] {
        let (directory, mut vaults, session_id) = open_vault();
        let project = ProjectService::create(
            &mut vaults,
            session_id,
            "Recoverable remove".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let project_folder = object_folder(&project.name, project.id).unwrap();
        fs::write(
            directory.path().join(&project_folder).join("user-data.bin"),
            b"preserve",
        )
        .unwrap();
        let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });

        assert!(matches!(
            ProjectService::remove_with_transactions(
                &mut vaults,
                session_id,
                project.id,
                project.revision,
                &interrupted,
                || Ok(()),
            ),
            Err(StorageError::TransactionInterrupted { step: 1 })
        ));
        assert!(!directory.path().join(&project_folder).exists());
        assert!(directory
            .path()
            .join(".trash")
            .join(&project_folder)
            .is_dir());
        vaults.close(session_id).unwrap();

        let mut reopened = VaultService::default();
        let opened = reopened.open(directory.path()).unwrap();
        assert_eq!(opened.mode, VaultOpenMode::ReadOnly);
        assert!(opened.recovery_writable);
        assert_eq!(opened.recovery.len(), 1);
        assert_eq!(opened.recovery[0].purpose, TransactionPurpose::TrashMove);
        assert!(opened.recovery[0].can_resume);
        assert!(opened.recovery[0].can_rollback);
        let recovered = reopened
            .recover_transaction(opened.session_id, opened.recovery[0].transaction_id, choice)
            .unwrap();
        assert!(recovered.recovery.is_empty());
        assert_eq!(recovered.mode, VaultOpenMode::ReadWrite);

        let dashboard = ProjectService::dashboard(&reopened, opened.session_id).unwrap();
        if choice == RecoveryChoice::Resume {
            assert!(dashboard.projects.is_empty());
            assert_eq!(
                fs::read(
                    directory
                        .path()
                        .join(".trash")
                        .join(&project_folder)
                        .join("user-data.bin")
                )
                .unwrap(),
                b"preserve"
            );
        } else {
            assert_eq!(dashboard.projects.len(), 1);
            assert_eq!(dashboard.projects[0].id, project.id);
            assert_eq!(
                fs::read(directory.path().join(&project_folder).join("user-data.bin")).unwrap(),
                b"preserve"
            );
        }
        reopened.close(opened.session_id).unwrap();
    }
}
