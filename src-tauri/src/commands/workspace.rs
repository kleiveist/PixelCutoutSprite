use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};

use tauri::{AppHandle, Manager, Runtime, State};

use crate::application::VaultService;
use crate::domain::ObjectId;
use crate::storage::{StorageError, VaultRoot};
use crate::workspace::data_folder::{
    self, DirectoryPage, DirectoryQuery, WorkspaceSelection, WorkspaceThumbnail,
};
use crate::workspace::validate_workspace_relative;

#[derive(Default)]
pub struct WorkspaceReadBudget(Arc<AtomicUsize>);
struct ReadPermit(Arc<AtomicUsize>);
impl Drop for ReadPermit {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

async fn workspace_read<R: Runtime, T: Send + 'static>(
    app: AppHandle<R>,
    session_id: String,
    generation: u64,
    operation: impl FnOnce(&VaultRoot) -> Result<T, StorageError> + Send + 'static,
) -> Result<T, String> {
    let id = ObjectId::parse("session_id", &session_id).map_err(|error| error.to_string())?;
    let budget = app.state::<WorkspaceReadBudget>().0.clone();
    budget
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |count| {
            (count < 4).then_some(count + 1)
        })
        .map_err(|_| {
            "Dateinavigation ist ausgelastet. Bitte kurz warten und erneut versuchen.".to_owned()
        })?;
    let permit = ReadPermit(budget);
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let service = app.state::<Mutex<VaultService>>();
        let root = service
            .lock()
            .map_err(|_| "vault service lock is poisoned".to_owned())?
            .session_root_at_generation(id, generation, false)
            .map_err(|e| e.to_string())?;
        let result = operation(&root).map_err(|e| e.to_string())?;
        service
            .lock()
            .map_err(|_| "vault service lock is poisoned".to_owned())?
            .session_root_at_generation(id, generation, false)
            .map_err(|e| e.to_string())?;
        Ok(result)
    })
    .await
    .map_err(|error| format!("Dateinavigation konnte nicht abgeschlossen werden: {error}"))?
}

#[tauri::command]
pub async fn list_workspace_entries<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    query: DirectoryQuery,
) -> Result<DirectoryPage, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        data_folder::list_entries(root, &query)
    })
    .await
}

#[tauri::command]
pub async fn inspect_workspace_entry<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    relative_path: String,
    expected_fingerprint: String,
) -> Result<WorkspaceSelection, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        data_folder::select_entry(root, &relative_path, &expected_fingerprint)
    })
    .await
}

#[tauri::command]
pub async fn read_workspace_thumbnail<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    relative_path: String,
    expected_fingerprint: String,
) -> Result<WorkspaceThumbnail, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        data_folder::thumbnail(root, &relative_path, &expected_fingerprint)
    })
    .await
}

fn reveal_target(root: &VaultRoot, relative: &str) -> Result<PathBuf, StorageError> {
    let path = Path::new(relative);
    if relative.len() > 1024 {
        return Err(StorageError::InvalidVault(
            "workspace path is too long".to_owned(),
        ));
    }
    validate_workspace_relative(path)?;
    // Reopen the root as well: replacing the selected directory with a symlink is invalid.
    let current_root = VaultRoot::open(root.path())?;
    let resolved = current_root.resolve(path)?;
    let metadata = fs::symlink_metadata(resolved.as_path())
        .map_err(|error| StorageError::io("inspect reveal target", path, error))?;
    if metadata.file_type().is_symlink() || !(metadata.is_file() || metadata.is_dir()) {
        return Err(StorageError::UnsafePath {
            path: relative.to_owned(),
            reason: "only existing regular files and directories can be revealed".to_owned(),
        });
    }
    Ok(current_root.resolve(path)?.as_path().to_path_buf())
}

#[tauri::command]
pub fn reveal_workspace_path(
    session_id: String,
    session_generation: u64,
    relative_path: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<(), String> {
    let session_id =
        ObjectId::parse("session_id", &session_id).map_err(|error| error.to_string())?;
    let service = service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())?;
    let root = service
        .session_root_at_generation(session_id, session_generation, false)
        .map_err(|error| error.to_string())?;
    let target = reveal_target(&root, &relative_path).map_err(|error| error.to_string())?;
    // Native-only API: no frontend opener permission, URL handling, or shell string.
    tauri_plugin_opener::reveal_item_in_dir(target).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn native_listing_checks_session_generation_close_and_read_budget() {
        let app = crate::compose(tauri::test::mock_builder())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let folder = TempDir::new().unwrap();
        let opened = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .initialize(folder.path(), None)
            .unwrap();
        let query = || DirectoryQuery {
            relative_path: String::new(),
            search: String::new(),
            filter: data_folder::EntryFilter::All,
            show_technical: false,
            limit: 50,
            cursor: None,
        };
        let call = |generation| {
            tauri::async_runtime::block_on(list_workspace_entries(
                app.handle().clone(),
                opened.session_id.to_string(),
                generation,
                query(),
            ))
        };
        assert!(call(opened.session_generation).is_ok());
        assert!(call(opened.session_generation + 1).is_err());
        let budget = app.state::<WorkspaceReadBudget>();
        budget.0.store(4, Ordering::SeqCst);
        assert!(call(opened.session_generation)
            .unwrap_err()
            .contains("ausgelastet"));
        budget.0.store(0, Ordering::SeqCst);
        app.state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .close(opened.session_id)
            .unwrap();
        assert!(call(opened.session_generation).is_err());
        assert_eq!(budget.0.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn reveal_accepts_only_existing_portable_vault_targets() {
        let vault = TempDir::new().unwrap();
        fs::create_dir(vault.path().join("Profile")).unwrap();
        fs::write(vault.path().join("Profile/Held.md"), "text").unwrap();
        fs::write(vault.path().join("Profile/Held.json"), "{}").unwrap();
        let root = VaultRoot::open(vault.path()).unwrap();
        for path in ["Profile", "Profile/Held.md", "Profile/Held.json"] {
            assert!(reveal_target(&root, path)
                .unwrap()
                .starts_with(vault.path()));
        }
        for path in [
            "",
            "../other",
            "/etc/passwd",
            "C:/windows",
            "Profile/CON.md",
            "Profile/missing",
            "Profile\\Held.md",
        ] {
            assert!(reveal_target(&root, path).is_err(), "{path}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn reveal_rejects_symlinked_files_and_parents() {
        use std::os::unix::fs::symlink;
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("private.json"), "{}").unwrap();
        symlink(outside.path(), vault.path().join("linked")).unwrap();
        symlink(
            outside.path().join("private.json"),
            vault.path().join("file.json"),
        )
        .unwrap();
        let root = VaultRoot::open(vault.path()).unwrap();
        assert!(reveal_target(&root, "linked/private.json").is_err());
        assert!(reveal_target(&root, "file.json").is_err());
    }
}
