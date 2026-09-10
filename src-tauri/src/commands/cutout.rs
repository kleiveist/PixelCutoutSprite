use super::workspace::{workspace_read, workspace_write};
use crate::cutout::{self, LoadedCutout, SaveCutoutRequest};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn open_cutout_source<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    relative_path: String,
    expected_sha256: String,
    writable: bool,
) -> Result<LoadedCutout, String> {
    let operation = move |root: &crate::storage::VaultRoot| {
        cutout::open_source(root, &relative_path, &expected_sha256, writable)
    };
    if writable {
        workspace_write(app, session_id, session_generation, operation).await
    } else {
        workspace_read(app, session_id, session_generation, operation).await
    }
}

#[tauri::command]
pub async fn read_cutout_pixels<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    relative_path: String,
    expected_sha256: String,
    project_path: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        cutout::read_pixels(
            root,
            &relative_path,
            &expected_sha256,
            project_path.as_deref(),
        )
    })
    .await
    .map(tauri::ipc::Response::new)
}

#[tauri::command]
pub async fn save_cutout_project<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    request: SaveCutoutRequest,
) -> Result<LoadedCutout, String> {
    workspace_write(app, session_id, session_generation, move |root| {
        cutout::save_project(root, request)
    })
    .await
}

#[tauri::command]
pub async fn preview_cutout_generation<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    project_path: String,
    expected_sha256: String,
) -> Result<cutout::generation::GenerationTarget, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        cutout::generation::target(root, &project_path, &expected_sha256)
    })
    .await
}

#[tauri::command]
pub async fn generate_cutout_parts<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    request: cutout::generation::GenerateRequest,
) -> Result<cutout::generation::GeneratedCutout, String> {
    workspace_write(app, session_id, session_generation, move |root| {
        cutout::generation::generate(root, request)
    })
    .await
}

#[tauri::command]
pub async fn open_cutout_set<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    session_generation: u64,
    directory: String,
    expected_manifest_sha256: String,
) -> Result<LoadedCutout, String> {
    workspace_read(app, session_id, session_generation, move |root| {
        cutout::generation::open_set_project(root, &directory, &expected_manifest_sha256)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::{VaultOpenMode, VaultService};
    use std::sync::Mutex;
    use tauri::Manager;

    #[test]
    fn cutout_commands_check_generation_writer_mode_close_and_binary_response() {
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
        let bytes = cutout::encode_png(&image::RgbaImage::from_pixel(
            7,
            5,
            image::Rgba([1, 2, 3, 127]),
        ))
        .unwrap();
        std::fs::write(temp.path().join("source.png"), &bytes).unwrap();
        let call = |id: String, generation, writable| {
            tauri::async_runtime::block_on(open_cutout_source(
                app.handle().clone(),
                id,
                generation,
                "source.png".to_owned(),
                cutout::digest(&bytes),
                writable,
            ))
        };
        assert!(call(
            opened.session_id.to_string(),
            opened.session_generation + 1,
            true
        )
        .is_err());
        let loaded = call(
            opened.session_id.to_string(),
            opened.session_generation,
            true,
        )
        .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "p38", Default::default())
            .build()
            .unwrap();
        let response = tauri::test::get_ipc_response(&webview, tauri::webview::InvokeRequest {
            cmd: "read_cutout_pixels".into(), callback: tauri::ipc::CallbackFn(0), error: tauri::ipc::CallbackFn(1),
            url: if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" }.parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(serde_json::json!({"sessionId": opened.session_id.to_string(), "sessionGeneration": opened.session_generation, "relativePath": ".source/original.png", "expectedSha256": loaded.project.source.sha256, "projectPath": loaded.project_path})),
            headers: Default::default(), invoke_key: tauri::test::INVOKE_KEY.to_string(),
        }).unwrap();
        match response {
            tauri::ipc::InvokeResponseBody::Raw(bytes) => {
                assert_eq!(bytes, [1, 2, 3, 127].repeat(35))
            }
            _ => panic!("pixel transport must be binary, never base64 JSON"),
        }
        let saved = tauri::async_runtime::block_on(save_cutout_project(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            SaveCutoutRequest {
                project_path: loaded.project_path.clone(),
                expected_revision: loaded.project.revision,
                expected_sha256: loaded.sha256.clone(),
                active_part_id: "head".into(),
                detach_original: false,
                parts: loaded
                    .project
                    .parts
                    .iter()
                    .map(|part| {
                        let required = cutout::catalog()
                            .iter()
                            .any(|entry| entry.part_id == part.part_id && entry.required);
                        let mut mask = cutout::Mask::default();
                        if required {
                            mask.draft = vec![[1, 6]];
                            mask.confirmed = mask.draft.clone();
                        }
                        cutout::PartEdit {
                            part_id: part.part_id.clone(),
                            status: if required {
                                cutout::PartStatus::Confirmed
                            } else {
                                cutout::PartStatus::Disabled
                            },
                            reason: None,
                            mask,
                            selection_parameters: None,
                        }
                    })
                    .collect(),
            },
        ))
        .unwrap();
        let target = tauri::async_runtime::block_on(preview_cutout_generation(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            saved.project_path.clone(),
            saved.sha256.clone(),
        ))
        .unwrap();
        let request = cutout::generation::GenerateRequest {
            project_path: saved.project_path.clone(),
            expected_revision: saved.project.revision,
            expected_sha256: saved.sha256.clone(),
            directory: target.directory.clone(),
            padding: 1,
        };
        let generated = tauri::async_runtime::block_on(generate_cutout_parts(
            app.handle().clone(),
            opened.session_id.to_string(),
            opened.session_generation,
            request.clone(),
        ))
        .unwrap();
        assert_eq!(generated.part_count, 15);
        assert_eq!(generated.loaded.project_path, "source/cutout.project.json");
        assert_eq!(
            tauri::async_runtime::block_on(open_cutout_set(
                app.handle().clone(),
                opened.session_id.to_string(),
                opened.session_generation,
                generated.directory.clone(),
                generated.manifest_sha256.clone()
            ))
            .unwrap()
            .project,
            generated.loaded.project
        );
        let readonly = app
            .state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .open(temp.path())
            .unwrap();
        assert_eq!(readonly.mode, VaultOpenMode::ReadOnly);
        assert!(tauri::async_runtime::block_on(generate_cutout_parts(
            app.handle().clone(),
            readonly.session_id.to_string(),
            readonly.session_generation,
            request
        ))
        .is_err());
        assert!(call(
            readonly.session_id.to_string(),
            readonly.session_generation,
            true
        )
        .is_err());
        assert!(call(
            readonly.session_id.to_string(),
            readonly.session_generation,
            false
        )
        .is_ok());
        app.state::<Mutex<VaultService>>()
            .lock()
            .unwrap()
            .close(opened.session_id)
            .unwrap();
        assert!(call(
            opened.session_id.to_string(),
            opened.session_generation,
            true
        )
        .is_err());
    }
}
