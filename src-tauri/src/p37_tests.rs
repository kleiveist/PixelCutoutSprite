//! P37 executable removal and preservation evidence. These are not production models.
use super::*;
use crate::application::{VaultOpenMode, VaultService};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, path::Path};

#[test]
fn removed_commands_are_rejected_by_the_actual_production_handler() {
    let app = compose(tauri::test::mock_builder())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "p37", Default::default())
        .build()
        .unwrap();
    let invoke = |command: &str| {
        tauri::test::get_ipc_response(
            &webview,
            tauri::webview::InvokeRequest {
                cmd: command.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: if cfg!(windows) {
                    "http://tauri.localhost"
                } else {
                    "tauri://localhost"
                }
                .parse()
                .unwrap(),
                body: tauri::ipc::InvokeBody::default(),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        )
    };
    // Positive control: this really invokes our composed handler.
    let identity = invoke("desktop_identity")
        .unwrap()
        .deserialize::<serde_json::Value>()
        .unwrap();
    assert_eq!(identity["name"], "PixelCutoutSprite Studio");
    for command in [
        "generate_example_vault",
        "get_project_dashboard",
        "list_projects",
        "save_project_view_state",
        "create_project",
        "rename_project",
        "duplicate_project",
        "set_project_archived",
        "set_project_labels",
        "remove_project",
        "create_label",
        "list_labels",
        "update_label",
        "remove_label",
        "preview_humanoid_profile",
        "get_area_dashboard",
        "open_area",
        "create_area",
        "create_area_profile_revision",
        "get_asset_inventory",
        "get_asset_thumbnail",
        "inspect_asset_sources",
        "cancel_asset_inspection",
        "import_asset_sources",
        "get_asset_import_job",
        "list_active_asset_import_jobs",
        "cancel_asset_import",
        "archive_asset",
        "get_motion_dashboard",
        "create_motion",
        "duplicate_motion",
        "load_motion_draft",
        "open_motion_editor",
        "render_motion_dummy",
        "render_motion_sample",
        "detach_motion_direction",
        "bake_motion_helper",
        "get_motion_card_preview",
        "save_motion_draft",
        "publish_motion",
        "set_motion_archived",
        "remove_motion",
        "resolve_motion_open",
        "inspect_outfit_launch",
        "start_outfit_draft",
        "resume_outfit_draft",
        "autosave_outfit_draft",
        "auto_assign_outfit",
        "render_outfit_preview",
        "save_outfit_as_npc",
        "apply_outfit_to_npc",
        "inspect_npc_workspace",
        "add_npc_binding",
        "update_npc_binding_overrides",
        "adopt_npc_binding_revision",
        "review_npc_binding",
        "set_npc_status",
        "duplicate_npc",
        "rename_npc",
        "inspect_npc_export",
        "list_npc_export_profiles",
        "save_npc_export_profile",
        "delete_npc_export_profile",
        "start_npc_export",
        "get_npc_export_job",
        "cancel_npc_export",
        "read_prompt_package",
        "save_prompt_output",
        "handoff_prompt_to_area",
        "read_prompt_workspace",
        "write_prompt_workspace",
        "remove_prompt_draft",
    ] {
        let error = invoke(command)
            .err()
            .unwrap_or_else(|| panic!("{command} unexpectedly callable"));
        assert_eq!(
            error,
            serde_json::Value::String(format!("Command {command} not found")),
            "{command}"
        );
    }
}

fn hashes(root: &Path) -> BTreeMap<String, String> {
    fn visit(root: &Path, directory: &Path, result: &mut BTreeMap<String, String>) {
        for entry in fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path).unwrap();
            assert!(!metadata.file_type().is_symlink());
            if metadata.is_dir() {
                visit(root, &path, result);
            } else {
                result.insert(
                    path.strip_prefix(root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/"),
                    format!("{:x}", Sha256::digest(fs::read(&path).unwrap())),
                );
            }
        }
    }
    let mut result = BTreeMap::new();
    visit(root, root, &mut result);
    result
}
fn put(root: &Path, relative: &str, bytes: &[u8]) {
    let path = root.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}

#[test]
fn opening_an_actual_legacy_vault_preserves_every_original_file_hash() {
    let vault = tempfile::TempDir::new().unwrap();
    let root = vault.path();
    // No new-workspace initializer: start with the original on-disk vault identity.
    put(
        root,
        ".pixelforge-studio/vault.json",
        include_bytes!("../tests/fixtures/contracts/valid/vault.json"),
    );
    let fixtures = [
        (
            "game--11111111/.project/project.json",
            include_bytes!("../tests/fixtures/contracts/valid/project.json").as_slice(),
        ),
        (
            "game--11111111/.project/labels.json",
            include_bytes!("../tests/fixtures/contracts/valid/project-label.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/.area/area.json",
            include_bytes!("../tests/fixtures/contracts/valid/area.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/.area/profiles/r0001.json",
            include_bytes!("../tests/fixtures/contracts/valid/profile-revision.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/motions/template.json",
            include_bytes!("../tests/fixtures/contracts/valid/motion-template.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/motions/revision.json",
            include_bytes!("../tests/fixtures/contracts/valid/motion-revision.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/npcs/character.json",
            include_bytes!("../tests/fixtures/contracts/valid/character.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/npcs/appearance.json",
            include_bytes!("../tests/fixtures/contracts/valid/appearance.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/npcs/binding.json",
            include_bytes!("../tests/fixtures/contracts/valid/binding.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/outfit/draft.json",
            include_bytes!("../tests/fixtures/contracts/valid/outfit-draft.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/exports/manifest.json",
            include_bytes!("../tests/fixtures/contracts/valid/export-manifest.json").as_slice(),
        ),
        (
            "legacy--33333333/.project/project.json",
            include_bytes!("../tests/fixtures/migrations/project-v0.json").as_slice(),
        ),
        (
            "future--44444444/.project/project.json",
            include_bytes!("../tests/fixtures/contracts/invalid/future-project.json").as_slice(),
        ),
        (
            "game--11111111/area--22222222/prompt-references/old.json",
            b"old user prompt reference".as_slice(),
        ),
        (
            "game--11111111/area--22222222/.source/hero.png",
            b"preserve original source bytes".as_slice(),
        ),
        (
            "game--11111111/.project/backups/important.json",
            b"unknown backup".as_slice(),
        ),
        (
            ".creating-project--55555555-5555-4555-8555-555555555555/source.bin",
            b"unpublished user bytes".as_slice(),
        ),
        ("foreign/broken.json", b"not json".as_slice()),
    ];
    for (path, bytes) in fixtures {
        put(root, path, bytes);
    }
    let before = hashes(root);
    let mut first = VaultService::default();
    let opened = first.open(root).unwrap();
    assert_eq!(opened.mode, VaultOpenMode::ReadWrite);
    assert!(opened.recovery.is_empty());
    let mut second = VaultService::default();
    let readonly = second.open(root).unwrap();
    assert_eq!(readonly.mode, VaultOpenMode::ReadOnly);
    second.close(readonly.session_id).unwrap();
    first.close(opened.session_id).unwrap();
    let reopened = first.open(root).unwrap();
    assert_eq!(reopened.vault_id, opened.vault_id);
    first.close(reopened.session_id).unwrap();
    let after = hashes(root);
    for (path, hash) in &before {
        assert_eq!(
            after.get(path),
            Some(hash),
            "legacy file changed or deleted: {path}"
        );
    }
    for path in after.keys().filter(|path| !before.contains_key(*path)) {
        assert!(
            path.starts_with(".PixelStudio/")
                || path.starts_with(".PixelPrompt/")
                || path == ".pixelforge-studio/runtime/writer.lock.json.os-lock",
            "unexpected new file: {path}"
        );
    }
    println!(
        "P37: {} original files have identical SHA-256 before and after writer/read-only/reopen.",
        before.len()
    );
}

#[test]
fn generic_identity_paths_names_and_vault_schema_stay_validated() {
    use crate::domain::*;
    assert!(ObjectId::parse("id", "00000000-0000-0000-0000-000000000000").is_err());
    assert!(ObjectId::parse("id", "not-an-id").is_err());
    for path in [
        "../escape",
        "/absolute",
        "C:\\outside",
        ".pixelforge-studio/secrets",
    ] {
        assert!(RelativePath::parse(path).is_err(), "{path}");
    }
    assert!(UtcTimestamp::parse("2026-09-10T10:00:00+03:00").is_err());
    assert!(ensure_no_portable_name_collisions("names", ["Kleif", "kleif"]).is_err());
    assert!(ensure_no_portable_name_collisions("names", ["Ä", "A\u{0308}"]).is_err());
    for name in ["CON", "../escape", "unsafe:", "trailing."] {
        assert!(validate_portable_display_name("name", name).is_err());
    }
    let mut vault: Vault = serde_json::from_slice(include_bytes!(
        "../tests/fixtures/contracts/valid/vault.json"
    ))
    .unwrap();
    assert!(vault.validate().is_ok());
    vault.schema_version = 99;
    assert!(vault.validate().is_err());
}
