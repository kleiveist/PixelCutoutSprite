use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;
use tauri::{Builder, Runtime};

pub mod animation;
pub mod application;
pub mod asset_io;
pub mod commands;
pub mod directions;
pub mod domain;
pub mod editor;
pub mod exports;
pub mod prompt_vault;
pub mod render;
pub mod storage;
pub mod workspace;

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
        .manage(Mutex::new(animation::PreviewCache::new(256 * 1024 * 1024)))
        .manage(application::ExportJobRegistry::default())
        .manage(application::AssetImportJobRegistry::default())
        .manage(application::AssetInspectionRegistry::default())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            if let Some((width, height)) =
                native_acceptance_window_size().map_err(std::io::Error::other)?
            {
                let window = _app.get_webview_window("main").ok_or_else(|| {
                    std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "native acceptance window `main` is missing",
                    )
                })?;
                window.set_size(tauri::LogicalSize::new(width, height))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_identity,
            commands::inspect_vault,
            commands::generate_example_vault,
            commands::initialize_vault,
            commands::open_vault,
            commands::close_vault,
            commands::list_recovery,
            commands::recover_transaction,
            commands::recover_orphaned_lock,
            commands::heartbeat_vault,
            commands::recent_vaults,
            commands::get_global_settings,
            commands::save_global_settings,
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
            commands::get_asset_inventory,
            commands::get_asset_thumbnail,
            commands::inspect_asset_sources,
            commands::cancel_asset_inspection,
            commands::import_asset_sources,
            commands::get_asset_import_job,
            commands::list_active_asset_import_jobs,
            commands::cancel_asset_import,
            commands::archive_asset,
            commands::get_motion_dashboard,
            commands::create_motion,
            commands::duplicate_motion,
            commands::load_motion_draft,
            commands::open_motion_editor,
            commands::render_motion_dummy,
            commands::render_motion_sample,
            commands::detach_motion_direction,
            commands::bake_motion_helper,
            commands::get_motion_card_preview,
            commands::save_motion_draft,
            commands::publish_motion,
            commands::set_motion_archived,
            commands::remove_motion,
            commands::resolve_motion_open,
            commands::inspect_outfit_launch,
            commands::start_outfit_draft,
            commands::resume_outfit_draft,
            commands::autosave_outfit_draft,
            commands::auto_assign_outfit,
            commands::render_outfit_preview,
            commands::save_outfit_as_npc,
            commands::apply_outfit_to_npc,
            commands::inspect_npc_workspace,
            commands::add_npc_binding,
            commands::update_npc_binding_overrides,
            commands::adopt_npc_binding_revision,
            commands::review_npc_binding,
            commands::set_npc_status,
            commands::duplicate_npc,
            commands::rename_npc,
            commands::inspect_npc_export,
            commands::list_npc_export_profiles,
            commands::save_npc_export_profile,
            commands::delete_npc_export_profile,
            commands::start_npc_export,
            commands::get_npc_export_job,
            commands::cancel_npc_export,
            commands::read_legacy_prompt_workspace,
            commands::read_prompt_package,
            commands::save_prompt_output,
            commands::handoff_prompt_to_area,
            commands::scan_prompt_vault,
            commands::save_vault_base_profile,
            commands::save_prompt_vault_draft,
            commands::save_prompt_vault_profile,
            commands::save_prompt_vault_generation,
            commands::remove_prompt_vault_draft,
            commands::apply_prompt_vault_migration,
        ])
}

#[cfg(debug_assertions)]
fn native_acceptance_window_size() -> Result<Option<(f64, f64)>, String> {
    let Ok(value) = std::env::var("PIXELCUTOUTSPRITE_ACCEPTANCE_WINDOW") else {
        return Ok(None);
    };
    parse_native_acceptance_window_size(&value).map(Some)
}

#[cfg(debug_assertions)]
fn parse_native_acceptance_window_size(value: &str) -> Result<(f64, f64), String> {
    let (width, height) = value
        .split_once('x')
        .ok_or_else(|| "acceptance window must use WIDTHxHEIGHT".to_owned())?;
    let width = width
        .parse::<u32>()
        .map_err(|_| "acceptance window width is not an integer".to_owned())?;
    let height = height
        .parse::<u32>()
        .map_err(|_| "acceptance window height is not an integer".to_owned())?;
    if !(480..=3840).contains(&width) || !(360..=2160).contains(&height) {
        return Err(
            "acceptance window must stay within 480..=3840 by 360..=2160 logical pixels"
                .to_owned(),
        );
    }
    Ok((f64::from(width), f64::from(height)))
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

    #[cfg(debug_assertions)]
    #[test]
    fn native_acceptance_window_parser_is_strict_and_bounded() {
        assert_eq!(
            parse_native_acceptance_window_size("480x360").unwrap(),
            (480.0, 360.0)
        );
        assert_eq!(
            parse_native_acceptance_window_size("720x450").unwrap(),
            (720.0, 450.0)
        );
        assert!(parse_native_acceptance_window_size("479x360").is_err());
        assert!(parse_native_acceptance_window_size("480X360").is_err());
    }
}
