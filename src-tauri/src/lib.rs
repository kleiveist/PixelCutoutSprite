use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;
use tauri::{Builder, Runtime};

pub mod application;
pub mod commands;
pub mod cutout;
pub mod domain;
pub mod prompt_vault;
pub(crate) mod sprite;
pub mod storage;
pub mod workspace;

#[cfg(test)]
mod p37_tests;

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
        .manage(commands::WorkspaceReadBudget::default())
        .manage(cutout::jobs::CutoutJobs::default())
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
            commands::read_legacy_prompt_workspace,
            commands::scan_prompt_vault,
            commands::read_prompt_vault_generation,
            commands::reveal_workspace_path,
            commands::list_workspace_entries,
            commands::inspect_workspace_entry,
            commands::read_workspace_thumbnail,
            commands::open_cutout_source,
            commands::read_cutout_pixels,
            commands::save_cutout_project,
            commands::preview_cutout_generation,
            commands::generate_cutout_parts,
            commands::open_cutout_set,
            commands::open_sprite_set,
            commands::read_sprite_pixels,
            commands::inspect_sprite_set,
            commands::save_sprite_scene,
            commands::start_cutout_refine,
            commands::get_cutout_refine_progress,
            commands::cancel_cutout_refine,
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
            "acceptance window must stay within 480..=3840 by 360..=2160 logical pixels".to_owned(),
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
