use super::*;
use tempfile::TempDir;

#[derive(Clone)]
struct Failure {
    root: PathBuf,
    kind: &'static str,
}
impl WorkspaceFault for Failure {
    fn before_stage(&self, target: &Path) -> Result<(), StorageError> {
        if self.kind == "disk_full" {
            return Err(StorageError::io(
                "injected staging write",
                target,
                std::io::Error::from(std::io::ErrorKind::StorageFull),
            ));
        }
        Ok(())
    }
    fn before_backup(&self, target: &Path) -> Result<(), StorageError> {
        if self.kind == "changed_before_backup" {
            fs::write(self.root.join(target), b"foreign modified old file").unwrap();
        }
        #[cfg(unix)]
        if self.kind == "parent_swap" {
            fs::rename(self.root.join("Set"), self.root.join("Moved")).unwrap();
            std::os::unix::fs::symlink(self.root.join("Outside"), self.root.join("Set")).unwrap();
        }
        Ok(())
    }
    fn after_backup(&self, target: &Path) -> Result<(), StorageError> {
        if self.kind == "foreign_after_backup" {
            fs::write(self.root.join(target), b"foreign new target").unwrap();
        }
        if self.kind == "publish_failure" {
            return Err(StorageError::io(
                "injected publication failure",
                target,
                std::io::Error::from(std::io::ErrorKind::PermissionDenied),
            ));
        }
        Ok(())
    }
}
fn setup(
    kind: &'static str,
) -> (
    TempDir,
    VaultRoot,
    WorkspaceWriter<Failure>,
    [ManagedFileWrite; 1],
) {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    root.ensure_directory(Path::new("Set")).unwrap();
    fs::write(temp.path().join("Set/data.json"), b"old").unwrap();
    let writer = WorkspaceWriter::with_fault(
        root.clone(),
        Failure {
            root: temp.path().into(),
            kind,
        },
    );
    let writes = [ManagedFileWrite {
        relative_path: "Set/data.json".into(),
        bytes: b"new".to_vec(),
        expectation: WriteExpectation {
            expected_sha256: Some(digest(b"old")),
            ..Default::default()
        },
    }];
    (temp, root, writer, writes)
}
fn transaction(root: &VaultRoot) -> PathBuf {
    fs::read_dir(root.path().join(".PixelStudio/transactions"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path()
}

#[test]
fn full_disk_before_staging_and_failed_publication_recover_without_false_success() {
    for kind in ["disk_full", "publish_failure"] {
        let (_temp, root, writer, writes) = setup(kind);
        assert!(writer.publish_file_set(&writes).is_err());
        assert!(require_settled_file_sets(&root).is_err());
        if kind == "disk_full" {
            assert_eq!(fs::read(root.path().join("Set/data.json")).unwrap(), b"old");
        } else {
            assert_eq!(
                fs::read(transaction(&root).join("backup/0.data")).unwrap(),
                b"old"
            );
            assert!(!root.path().join("Set/data.json").exists());
        }
        assert_eq!(
            WorkspaceWriter::new(root.clone())
                .recover_file_sets()
                .unwrap(),
            1
        );
        assert_eq!(
            fs::read(root.path().join("Set/data.json")).unwrap(),
            if kind == "disk_full" { b"old" } else { b"new" }
        );
        require_settled_file_sets(&root).unwrap();
    }
}

#[test]
fn foreign_file_appearing_after_backup_is_never_replaced_or_restored_over() {
    let (_temp, root, writer, writes) = setup("foreign_after_backup");
    assert!(matches!(
        writer.publish_file_set(&writes),
        Err(StorageError::WriteConflict)
    ));
    assert_eq!(
        fs::read(root.path().join("Set/data.json")).unwrap(),
        b"foreign new target"
    );
    let tx = transaction(&root);
    assert_eq!(fs::read(tx.join("backup/0.data")).unwrap(), b"old");
    assert_eq!(fs::read(tx.join("stage/0.data")).unwrap(), b"new");
    assert!(WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .is_err());
    assert_eq!(
        fs::read(root.path().join("Set/data.json")).unwrap(),
        b"foreign new target"
    );
    // Explicit resolution by the fixture owner, not automatic overwriting.
    fs::rename(
        root.path().join("Set/data.json"),
        root.path().join("foreign-kept.json"),
    )
    .unwrap();
    WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .unwrap();
    assert_eq!(fs::read(root.path().join("Set/data.json")).unwrap(), b"new");
    assert_eq!(
        fs::read(root.path().join("foreign-kept.json")).unwrap(),
        b"foreign new target"
    );
}

#[test]
fn external_change_in_backup_window_is_preserved_as_conflicting_backup() {
    let (_temp, root, writer, writes) = setup("changed_before_backup");
    assert!(writer.publish_file_set(&writes).is_err());
    assert_eq!(
        fs::read(transaction(&root).join("backup/0.data")).unwrap(),
        b"foreign modified old file"
    );
    assert!(WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .is_err());
    assert!(!root.path().join("Set/data.json").exists());
}

#[cfg(unix)]
#[test]
fn parent_swapped_before_publication_never_redirects_the_write() {
    let (_temp, root, writer, writes) = setup("parent_swap");
    fs::create_dir(root.path().join("Outside")).unwrap();
    fs::write(root.path().join("Outside/data.json"), b"foreign outside").unwrap();
    assert!(writer.publish_file_set(&writes).is_err());
    assert_eq!(
        fs::read(root.path().join("Outside/data.json")).unwrap(),
        b"foreign outside"
    );
    assert_eq!(
        fs::read(root.path().join("Moved/data.json")).unwrap(),
        b"old"
    );
}

#[test]
fn empty_unjournaled_crash_directories_recover_but_unknown_data_is_preserved() {
    for unknown in [false, true] {
        let (_temp, root, _, _) = setup("none");
        let directory =
            Path::new(".PixelStudio/transactions").join(uuid::Uuid::new_v4().to_string());
        root.ensure_directory(&directory.join("stage")).unwrap();
        root.ensure_directory(&directory.join("backup")).unwrap();
        if unknown {
            fs::write(
                root.path().join(&directory).join("stage/foreign.txt"),
                b"keep",
            )
            .unwrap();
        }
        let result = WorkspaceWriter::new(root.clone()).recover_file_sets();
        if unknown {
            assert!(result.is_err());
            assert_eq!(
                fs::read(root.path().join(&directory).join("stage/foreign.txt")).unwrap(),
                b"keep"
            );
        } else {
            assert_eq!(result.unwrap(), 1);
            require_settled_file_sets(&root).unwrap();
        }
    }
}

#[test]
fn prepared_cleanup_never_recursively_deletes_foreign_files() {
    let (_temp, root, writer, writes) = setup("disk_full");
    assert!(writer.publish_file_set(&writes).is_err());
    let foreign = transaction(&root).join("foreign.txt");
    fs::write(&foreign, b"keep this evidence").unwrap();
    assert!(WorkspaceWriter::new(root.clone())
        .recover_file_sets()
        .is_err());
    assert_eq!(fs::read(foreign).unwrap(), b"keep this evidence");
    assert_eq!(fs::read(root.path().join("Set/data.json")).unwrap(), b"old");
}
