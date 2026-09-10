use super::workspace::{workspace_read, workspace_write};
use crate::sprite::{self, LoadedSprite, SpriteSourceKind};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn open_sprite_set<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    directory: String,
    source_kind: SpriteSourceKind,
    expected_sha256: String,
) -> Result<LoadedSprite, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        sprite::load(root, &directory, source_kind, &expected_sha256)
    })
    .await
}
#[tauri::command]
pub async fn read_sprite_pixels<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    directory: String,
    source_kind: SpriteSourceKind,
    expected_sha256: String,
    part_id: String,
) -> Result<tauri::ipc::Response, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        sprite::pixels(root, &directory, source_kind, &expected_sha256, &part_id)
    })
    .await
    .map(tauri::ipc::Response::new)
}

#[tauri::command]
pub async fn inspect_sprite_set<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    directory: String,
    source_kind: SpriteSourceKind,
) -> Result<LoadedSprite, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        sprite::load_current(root, &directory, source_kind)
    })
    .await
}

#[tauri::command]
pub async fn save_sprite_scene<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    request: sprite::SaveSpriteRequest,
) -> Result<LoadedSprite, String> {
    workspace_write(app, session_id, session_generation, move |root| {
        sprite::save_scene(root, request)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{application::VaultService, storage::VaultRoot};
    use std::sync::Mutex;
    use tauri::Manager;
    #[test]
    fn sprite_commands_use_real_files_binary_ipc_and_current_session_generation() {
        let app = crate::compose(tauri::test::mock_builder())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let temp = tempfile::TempDir::new().unwrap();
        let opened = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .initialize(temp.path(), None)
            .unwrap();
        let root = VaultRoot::open(temp.path()).unwrap();
        let hash = crate::sprite::tests::files(&root);
        let call = |generation| {
            tauri::async_runtime::block_on(open_sprite_set(
                app.handle().clone(),
                opened.session_id.to_string(),
                generation,
                "Parts".into(),
                SpriteSourceKind::Manifest,
                hash.clone(),
            ))
        };
        assert!(call(opened.session_generation + 1).is_err());
        assert_eq!(call(opened.session_generation).unwrap().assets.len(), 2);
        let webview = tauri::WebviewWindowBuilder::new(&app, "p41", Default::default())
            .build()
            .unwrap();
        let response=tauri::test::get_ipc_response(&webview,tauri::webview::InvokeRequest { cmd:"read_sprite_pixels".into(),callback:tauri::ipc::CallbackFn(0),error:tauri::ipc::CallbackFn(1),url:if cfg!(windows){"http://tauri.localhost"}else{"tauri://localhost"}.parse().unwrap(),body:tauri::ipc::InvokeBody::Json(serde_json::json!({"sessionId":opened.session_id.to_string(),"sessionGeneration":opened.session_generation,"directory":"Parts","sourceKind":"manifest","expectedSha256":hash,"partId":"head"})),headers:Default::default(),invoke_key:tauri::test::INVOKE_KEY.into() }).unwrap();
        match response {
            tauri::ipc::InvokeResponseBody::Raw(bytes) => assert_eq!(bytes.len(), 16),
            _ => panic!("sprite transport must remain binary"),
        };
        let loaded = call(opened.session_generation).unwrap();
        let request = sprite::SaveSpriteRequest {
            directory: "Parts".into(),
            source_kind: SpriteSourceKind::Manifest,
            expected_document_sha256: hash.clone(),
            expected_scene_sha256: None,
            expected_basis_sha256: None,
            expected_revision: None,
            accept_generation: false,
            scene: loaded.scene,
        };
        let save = |id: String, generation, request| {
            tauri::async_runtime::block_on(save_sprite_scene(
                app.handle().clone(),
                id,
                generation,
                request,
            ))
        };
        assert!(save(
            opened.session_id.to_string(),
            opened.session_generation + 1,
            request.clone()
        )
        .is_err());
        let readonly = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .open(temp.path())
            .unwrap();
        assert_eq!(readonly.mode, crate::application::VaultOpenMode::ReadOnly);
        assert!(save(
            readonly.session_id.to_string(),
            readonly.session_generation,
            request.clone()
        )
        .is_err());
        assert!(!temp.path().join("Parts/sprite.scene.json").exists());
        let saved = save(
            opened.session_id.to_string(),
            opened.session_generation,
            request.clone(),
        )
        .unwrap();
        assert_eq!(saved.scene.revision, 1);
        assert_eq!(
            call(opened.session_generation).unwrap().scene_sha256,
            saved.scene_sha256
        );
        app.state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .close(opened.session_id)
            .unwrap();
        assert!(call(opened.session_generation).is_err());
        assert!(save(
            opened.session_id.to_string(),
            opened.session_generation,
            request
        )
        .is_err());
    }
}
