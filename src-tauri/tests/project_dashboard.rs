use std::fs;

use pixel_cutout_sprite_studio_lib::application::{
    LabelMatch, LabelService, ProjectQuery, ProjectService, ProjectSort, ProjectStatusFilter,
    VaultService,
};
use pixel_cutout_sprite_studio_lib::domain::{LabelScope, RecordStatus};
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
