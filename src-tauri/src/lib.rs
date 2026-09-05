use serde::Serialize;
use std::sync::Mutex;
use tauri::{Builder, Runtime};

pub mod application;
pub mod commands;
pub mod domain;
pub mod editor;
pub mod render;
pub mod storage;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopIdentity {
    name: &'static str,
    version: &'static str,
}

#[tauri::command]
fn desktop_identity() -> DesktopIdentity {
    DesktopIdentity {
        name: "PixelCutoutSprite Studio",
        version: env!("CARGO_PKG_VERSION"),
    }
}

fn compose<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(application::VaultService::default()))
        .invoke_handler(tauri::generate_handler![
            desktop_identity,
            commands::inspect_vault,
            commands::initialize_vault,
            commands::open_vault,
            commands::close_vault,
            commands::recent_vaults,
            commands::get_project_dashboard,
            commands::list_projects,
            commands::save_project_view_state,
            commands::create_project,
            commands::rename_project,
            commands::duplicate_project,
            commands::set_project_archived,
            commands::set_project_labels,
            commands::remove_project,
            commands::create_label,
            commands::list_labels,
            commands::update_label,
            commands::remove_label,
            commands::preview_humanoid_profile,
            commands::get_area_dashboard,
            commands::open_area,
            commands::create_area,
            commands::create_area_profile_revision,
            commands::get_motion_dashboard,
            commands::create_motion,
            commands::duplicate_motion,
            commands::load_motion_draft,
            commands::open_motion_editor,
            commands::render_motion_dummy,
            commands::save_motion_draft,
            commands::publish_motion,
            commands::set_motion_archived,
            commands::remove_motion,
            commands::resolve_motion_open,
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    compose(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("PixelCutoutSprite Studio failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_identity_matches_product_metadata() {
        assert_eq!(
            desktop_identity(),
            DesktopIdentity {
                name: "PixelCutoutSprite Studio",
                version: "0.1.0",
            }
        );
    }

    #[test]
    fn production_composition_builds_with_a_mock_runtime() {
        let _app = compose(tauri::test::mock_builder())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("composition root should build");
    }
}
