#[test]
fn committed_tauri_configuration_describes_the_desktop_shell() {
    let configuration = include_str!("../tauri.conf.json");

    assert!(configuration.contains("PixelCutoutSprite Studio"));
    assert!(configuration.contains("\"minWidth\": 1280"));
    assert!(configuration.contains("\"minHeight\": 720"));
    assert!(!configuration.contains("http://0.0.0.0"));
}
