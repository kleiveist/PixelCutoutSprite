use serde::Serialize;
use tauri::{Builder, Runtime};

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
    builder.invoke_handler(tauri::generate_handler![desktop_identity])
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
