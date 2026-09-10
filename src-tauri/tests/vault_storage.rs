use std::fs;
use std::path::Path;

use pixel_cutout_sprite_studio_lib::application::{VaultInspection, VaultOpenMode, VaultService};
use pixel_cutout_sprite_studio_lib::domain::{ObjectId, RelativePath, UtcTimestamp, Vault};
use pixel_cutout_sprite_studio_lib::storage::{
    write_journal, DeviceSettingsStore, FileReplacer, JsonStore, StorageError, TransactionAction,
    TransactionJournal, TransactionState, TransactionStep, VaultLayout, VaultRoot, ADMIN_DIR,
};
use tempfile::TempDir;

#[derive(Debug, Clone)]
struct FailingReplacer;

impl FileReplacer for FailingReplacer {
    fn replace(&self, _staged: &Path, _target: &Path) -> Result<(), StorageError> {
        Err(StorageError::ReplacementFailed(
            "injected before target replacement".to_owned(),
        ))
    }
}

#[test]
fn empty_vault_initializes_closes_and_reopens_with_the_same_identity() {
    let temp = TempDir::new().unwrap();
    assert!(matches!(
        VaultService::inspect(temp.path()).unwrap(),
        VaultInspection::Empty { .. }
    ));
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    assert_eq!(opened.indexed_objects, 1);
    assert!(temp.path().join(ADMIN_DIR).join("vault.json").is_file());
    assert!(temp
        .path()
        .join(ADMIN_DIR)
        .join("runtime/writer.lock.json")
        .is_file());
    service.close(opened.session_id).unwrap();
    assert!(!temp
        .path()
        .join(ADMIN_DIR)
        .join("runtime/writer.lock.json")
        .exists());
    let reopened = service.open(temp.path()).unwrap();
    assert_eq!(reopened.vault_id, opened.vault_id);
    assert_eq!(reopened.mode, VaultOpenMode::ReadWrite);
    service.close(reopened.session_id).unwrap();
}

#[test]
fn foreign_directory_is_unchanged_until_current_confirmation_is_supplied() {
    let temp = TempDir::new().unwrap();
    let foreign = temp.path().join("notes.txt");
    fs::write(&foreign, b"keep me").unwrap();
    let inspection = VaultService::inspect(temp.path()).unwrap();
    let VaultInspection::Foreign {
        confirmation_token,
        entry_count,
        ..
    } = inspection
    else {
        panic!("expected foreign directory");
    };
    assert_eq!(entry_count, 1);
    let mut service = VaultService::default();
    assert!(matches!(
        service.initialize(temp.path(), None),
        Err(StorageError::ConfirmationRequired { .. })
    ));
    assert_eq!(fs::read(&foreign).unwrap(), b"keep me");
    assert!(!temp.path().join(ADMIN_DIR).exists());

    fs::write(temp.path().join("new.txt"), b"changed after review").unwrap();
    assert!(matches!(
        service.initialize(temp.path(), Some(&confirmation_token)),
        Err(StorageError::ConfirmationRequired { .. })
    ));
    let VaultInspection::Foreign {
        confirmation_token, ..
    } = VaultService::inspect(temp.path()).unwrap()
    else {
        panic!("expected refreshed foreign inspection");
    };
    let opened = service
        .initialize(temp.path(), Some(&confirmation_token))
        .unwrap();
    assert_eq!(fs::read(&foreign).unwrap(), b"keep me");
    assert_eq!(
        fs::read(temp.path().join("new.txt")).unwrap(),
        b"changed after review"
    );
    service.close(opened.session_id).unwrap();
}

#[test]
fn damaged_vault_is_not_treated_as_empty_or_overwritten() {
    let temp = TempDir::new().unwrap();
    let admin = temp.path().join(ADMIN_DIR);
    fs::create_dir(&admin).unwrap();
    let manifest = admin.join("vault.json");
    fs::write(&manifest, b"not-json").unwrap();
    assert!(matches!(
        VaultService::inspect(temp.path()).unwrap(),
        VaultInspection::Damaged { .. }
    ));
    let mut service = VaultService::default();
    assert!(matches!(
        service.initialize(temp.path(), None),
        Err(StorageError::InvalidVault(_))
    ));
    assert_eq!(fs::read(&manifest).unwrap(), b"not-json");
}

#[test]
fn a_second_writer_is_opened_read_only_and_never_steals_the_lock() {
    let temp = TempDir::new().unwrap();
    let mut first = VaultService::default();
    let writer = first.initialize(temp.path(), None).unwrap();
    let mut second = VaultService::default();
    let reader = second.open(temp.path()).unwrap();
    assert_eq!(writer.mode, VaultOpenMode::ReadWrite);
    assert_eq!(reader.mode, VaultOpenMode::ReadOnly);
    assert!(reader.notice.as_deref().unwrap().contains("read-only"));
    second.close(reader.session_id).unwrap();
    assert!(temp
        .path()
        .join(ADMIN_DIR)
        .join("runtime/writer.lock.json")
        .exists());
    first.close(writer.session_id).unwrap();
    let promoted = second.open(temp.path()).unwrap();
    assert_eq!(promoted.mode, VaultOpenMode::ReadWrite);
    second.close(promoted.session_id).unwrap();
}

#[test]
fn staged_validation_and_injected_replacement_failure_preserve_the_last_file() {
    let temp = TempDir::new().unwrap();
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    service.close(opened.session_id).unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let manifest = VaultLayout::new(root).vault_manifest().unwrap();
    let original = fs::read(manifest.as_path()).unwrap();
    let value = Vault {
        schema_version: 1,
        kind: pixel_cutout_sprite_studio_lib::domain::DocumentKind::Vault,
        id: opened.vault_id,
        format: "pixel-cutout-sprite-vault".to_owned(),
        created_at: UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap(),
    };
    let failing = JsonStore::with_replacer(FailingReplacer);
    assert!(matches!(
        failing.write(&manifest, &value),
        Err(StorageError::ReplacementFailed(_))
    ));
    assert_eq!(fs::read(manifest.as_path()).unwrap(), original);
    assert_eq!(
        fs::read_dir(manifest.as_path().parent().unwrap())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .count(),
        0
    );
}

#[test]
fn compare_and_swap_rejects_external_changes() {
    let temp = TempDir::new().unwrap();
    let mut service = VaultService::default();
    let opened = service.initialize(temp.path(), None).unwrap();
    service.close(opened.session_id).unwrap();
    let manifest = VaultLayout::new(VaultRoot::open(temp.path()).unwrap())
        .vault_manifest()
        .unwrap();
    let store = JsonStore::default();
    let loaded = store.load::<Vault>(&manifest).unwrap();
    let mut vault = loaded.value.clone();
    vault.created_at = UtcTimestamp::parse("2026-09-05T10:01:00Z").unwrap();
    store.write(&manifest, &vault.clone()).unwrap();
    vault.created_at = UtcTimestamp::parse("2026-09-05T10:02:00Z").unwrap();
    assert!(matches!(
        store.compare_and_swap(&manifest, &loaded.stamp, &vault),
        Err(StorageError::WriteConflict)
    ));
}

#[test]
fn transaction_journal_is_validated_and_persisted_in_project_scope() {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    root.ensure_directory(Path::new("game--11111111/.project/transactions"))
        .unwrap();
    let journal_path = root
        .resolve(Path::new("game--11111111/.project/transactions/tx.json"))
        .unwrap();
    let step = TransactionStep {
        action: TransactionAction::Replace,
        target: RelativePath::parse("game--11111111/.project/project.json").unwrap(),
        staged: RelativePath::parse("game--11111111/.project/transactions/project.next.json")
            .unwrap(),
        backup: Some(
            RelativePath::parse("game--11111111/.project/backups/project.previous.json").unwrap(),
        ),
        expected_sha256: Some("a".repeat(64)),
    };
    let mut journal = TransactionJournal::new(vec![step]).unwrap();
    write_journal(&journal_path, &journal).unwrap();
    let persisted: TransactionJournal =
        serde_json::from_slice(&fs::read(journal_path.as_path()).unwrap()).unwrap();
    assert_eq!(persisted.state, TransactionState::Prepared);
    journal.advance().unwrap();
    assert_eq!(journal.state, TransactionState::Committed);
}

#[test]
fn only_global_metadata_and_runtime_coordination_use_the_admin_directory() {
    for allowed in [
        ".pixelforge-studio/vault.json",
        ".pixelforge-studio/labels.json",
        ".pixelforge-studio/ui.json",
        ".pixelforge-studio/runtime/writer.lock.json",
    ] {
        assert!(VaultLayout::global_path_allows(Path::new(allowed)));
    }
    for forbidden in [
        ".pixelforge-studio/project.json",
        ".pixelforge-studio/character.json",
        ".pixelforge-studio/assets/body.png",
        ".pixelforge-studio/backups/project.json",
    ] {
        assert!(!VaultLayout::global_path_allows(Path::new(forbidden)));
    }
}

#[test]
fn device_recents_live_outside_the_vault() {
    let vault = TempDir::new().unwrap();
    let config = TempDir::new().unwrap();
    let settings = DeviceSettingsStore::new(config.path())
        .remember_vault(vault.path())
        .unwrap();
    assert_eq!(
        settings.recent_vaults,
        vec![vault.path().canonicalize().unwrap()]
    );
    assert!(config.path().join("device-settings.json").is_file());
    assert!(!vault.path().join("device-settings.json").exists());
}

#[cfg(unix)]
#[test]
fn symlink_components_are_rejected_instead_of_followed() {
    use std::os::unix::fs::symlink;

    let vault = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    symlink(outside.path(), vault.path().join("linked")).unwrap();
    let root = VaultRoot::open(vault.path()).unwrap();
    assert!(matches!(
        root.resolve(Path::new("linked/data.json")),
        Err(StorageError::UnsafePath { .. })
    ));
    assert!(!outside.path().join("data.json").exists());
}

#[cfg(unix)]
#[test]
fn a_write_permission_failure_is_reported_without_redirecting_data() {
    use std::os::unix::fs::PermissionsExt;

    let vault = TempDir::new().unwrap();
    let mut service = VaultService::default();
    let opened = service.initialize(vault.path(), None).unwrap();
    service.close(opened.session_id).unwrap();
    let runtime = vault.path().join(ADMIN_DIR).join("runtime");
    fs::set_permissions(&runtime, fs::Permissions::from_mode(0o555)).unwrap();

    let result = service.open(vault.path());

    fs::set_permissions(&runtime, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(matches!(result, Err(StorageError::Io { .. })));
    assert!(!vault.path().join("writer.lock.json").exists());
}

#[test]
fn session_ids_are_stable_uuid_strings_not_paths_or_names() {
    let id = ObjectId::new();
    assert_eq!(ObjectId::parse("session_id", &id.to_string()).unwrap(), id);
}
