#[test]
fn committed_tauri_configuration_describes_the_desktop_shell() {
    let configuration = include_str!("../tauri.conf.json");

    assert!(configuration.contains("PixelCutoutSprite Studio"));
    assert!(configuration.contains("\"minWidth\": 480"));
    assert!(configuration.contains("\"minHeight\": 360"));
    assert!(!configuration.contains("http://0.0.0.0"));
}
