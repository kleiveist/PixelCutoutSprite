use super::*;
use serde_json::json;
use tempfile::TempDir;

fn query() -> DirectoryQuery {
    DirectoryQuery {
        relative_path: String::new(),
        search: String::new(),
        filter: EntryFilter::All,
        show_technical: false,
        limit: 50,
        cursor: None,
    }
}
fn fixture() -> (TempDir, VaultRoot) {
    let dir = TempDir::new().unwrap();
    let root = VaultRoot::open(dir.path()).unwrap();
    (dir, root)
}
fn png_bytes() -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    DynamicImage::new_rgba8(4, 4)
        .write_to(&mut out, ImageFormat::Png)
        .unwrap();
    out.into_inner()
}
fn entry(root: &VaultRoot, name: &str) -> WorkspaceEntry {
    list_entries(root, &query())
        .unwrap()
        .entries
        .into_iter()
        .find(|e| e.name == name)
        .unwrap()
}

#[test]
fn sorts_pages_filters_and_detects_external_creation_rename_and_deletion() {
    let (_dir, root) = fixture();
    for name in ["z.png", "A.png", "readme.txt", "b.png"] {
        fs::write(root.path().join(name), "not decoded during listing").unwrap();
    }
    fs::create_dir(root.path().join("Folder")).unwrap();
    let mut q = query();
    q.limit = 2;
    let first = list_entries(&root, &q).unwrap();
    assert_eq!(
        first
            .entries
            .iter()
            .map(|e| e.name.as_str())
            .collect::<Vec<_>>(),
        ["Folder", "A.png"]
    );
    q.cursor = first.next_cursor;
    let second = list_entries(&root, &q).unwrap();
    assert_eq!(second.entries[0].name, "b.png");
    fs::write(root.path().join("new.png"), "new").unwrap();
    assert!(list_entries(&root, &q).is_err());
    q.cursor = None;
    q.filter = EntryFilter::Images;
    q.limit = 100;
    assert_eq!(list_entries(&root, &q).unwrap().total_matches, 5);
    fs::rename(root.path().join("new.png"), root.path().join("renamed.png")).unwrap();
    q.search = "rename".to_owned();
    assert_eq!(
        list_entries(&root, &q).unwrap().entries[0].name,
        "renamed.png"
    );
    fs::remove_file(root.path().join("renamed.png")).unwrap();
    assert_eq!(list_entries(&root, &q).unwrap().total_matches, 0);
}

#[test]
fn large_directory_is_paged_without_decoding_pixels_and_limits_are_enforced() {
    let (_dir, root) = fixture();
    for i in 0..1100 {
        fs::write(root.path().join(format!("{i:04}.png")), "broken").unwrap();
    }
    let mut q = query();
    q.limit = 100;
    let page = list_entries(&root, &q).unwrap();
    assert_eq!(page.total_matches, 1100);
    assert_eq!(page.entries.len(), 100);
    q.cursor = page.next_cursor;
    assert_eq!(list_entries(&root, &q).unwrap().entries[0].name, "0100.png");
    q.search = "different scope".to_owned();
    assert!(list_entries(&root, &q).is_err());
    q.limit = 101;
    assert!(list_entries(&root, &q).is_err());
    q.limit = 0;
    assert!(list_entries(&root, &q).is_err());
}

#[test]
fn over_budget_directory_reports_an_error_instead_of_a_silent_partial_listing() {
    let (_dir, root) = fixture();
    for i in 0..=MAX_DIRECTORY_ENTRIES {
        File::create(root.path().join(format!("{i}.png"))).unwrap();
    }
    assert!(list_entries(&root, &query())
        .unwrap_err()
        .to_string()
        .contains("20.000"));
}

#[test]
fn technical_and_unknown_files_cannot_be_opened_as_images() {
    let (_dir, root) = fixture();
    fs::create_dir(root.path().join(".source")).unwrap();
    fs::write(root.path().join(".source/source.png"), png_bytes()).unwrap();
    fs::write(root.path().join("run.exe"), "not executable").unwrap();
    assert_eq!(list_entries(&root, &query()).unwrap().entries.len(), 1);
    let mut q = query();
    q.show_technical = true;
    let technical = list_entries(&root, &q)
        .unwrap()
        .entries
        .into_iter()
        .find(|e| e.technical)
        .unwrap();
    assert!(select_entry(&root, &technical.relative_path, &technical.fingerprint).is_err());
    let unknown = entry(&root, "run.exe");
    assert!(select_entry(&root, &unknown.relative_path, &unknown.fingerprint).is_err());
    for path in [
        "../outside",
        "/etc",
        "C:/private",
        "dir\\file",
        "dir//file",
        "dir/./file",
        "CON.png",
        "dir/NUL",
        "a\0b",
    ] {
        q.relative_path = path.to_owned();
        assert!(list_entries(&root, &q).is_err(), "{path}");
    }
}

#[test]
fn image_activation_and_lazy_thumbnail_are_bounded_and_detect_changed_sources() {
    let (_dir, root) = fixture();
    fs::write(root.path().join("image.png"), png_bytes()).unwrap();
    let image = entry(&root, "image.png");
    assert!(matches!(
        select_entry(&root, &image.relative_path, &image.fingerprint).unwrap(),
        WorkspaceSelection::Image {
            width: 4,
            height: 4,
            ..
        }
    ));
    assert!(thumbnail(&root, &image.relative_path, &image.fingerprint)
        .unwrap()
        .data_url
        .starts_with("data:image/png;base64,"));
    fs::write(root.path().join("image.png"), "changed").unwrap();
    assert!(thumbnail(&root, &image.relative_path, &image.fingerprint).is_err());
    assert!(select_entry(&root, &image.relative_path, &image.fingerprint).is_err());
    let invalid_image = entry(&root, "image.png");
    assert!(select_entry(
        &root,
        &invalid_image.relative_path,
        &invalid_image.fingerprint
    )
    .is_err());
    let huge = File::create(root.path().join("huge.png")).unwrap();
    huge.set_len(MAX_IMAGE_BYTES as u64 + 1).unwrap();
    let huge = entry(&root, "huge.png");
    assert!(thumbnail(&root, &huge.relative_path, &huge.fingerprint).is_err());
}

#[test]
fn jpeg_and_webp_are_supported_with_the_same_content_and_dimension_limits() {
    let (_dir, root) = fixture();
    for (extension, format) in [
        ("jpg", ImageFormat::Jpeg),
        ("jpeg", ImageFormat::Jpeg),
        ("webp", ImageFormat::WebP),
    ] {
        let mut output = Cursor::new(Vec::new());
        DynamicImage::new_rgb8(4, 6)
            .write_to(&mut output, format)
            .unwrap();
        let name = format!("picture.{extension}");
        fs::write(root.path().join(&name), output.into_inner()).unwrap();
        let picture = entry(&root, &name);
        assert_eq!(picture.kind, EntryKind::Image);
        assert!(matches!(
            select_entry(&root, &picture.relative_path, &picture.fingerprint).unwrap(),
            WorkspaceSelection::Image {
                width: 4,
                height: 6,
                ..
            }
        ));
        assert!(
            thumbnail(&root, &picture.relative_path, &picture.fingerprint)
                .unwrap()
                .data_url
                .starts_with("data:image/png;base64,")
        );
        let mut huge = Cursor::new(Vec::new());
        DynamicImage::new_rgb8(8193, 1)
            .write_to(&mut huge, format)
            .unwrap();
        fs::write(root.path().join(&name), huge.into_inner()).unwrap();
        let oversized = entry(&root, &name);
        assert!(select_entry(&root, &oversized.relative_path, &oversized.fingerprint).is_err());
        fs::write(root.path().join(&name), png_bytes()).unwrap();
        let disguised = entry(&root, &name);
        assert!(select_entry(&root, &disguised.relative_path, &disguised.fingerprint).is_err());
    }
}

fn set_fixture(root: &VaultRoot) -> serde_json::Value {
    fs::create_dir(root.path().join("Set")).unwrap();
    let bytes = png_bytes();
    let parts: Vec<_> = manifest::PART_IDS[..15].iter().enumerate().map(|(i, id)| {
        let filename = format!("{:02}_{id}.png", i + 1);
        fs::write(root.path().join("Set").join(&filename), &bytes).unwrap();
        json!({ "partId": id, "file": filename, "sha256": digest(&bytes), "sourceRect": {"x": 0, "y": 0, "width": 4, "height": 4}, "pivot": {"x": 2, "y": 2}, "defaultPosition": {"x": 2, "y": 2}, "defaultZ": i, "parentId": null })
    }).collect();
    let value = json!({ "schemaVersion": 1, "kind": "spriteParts", "setId": "set_test", "generationId": "gen_test", "cutoutRevision": 1, "source": {"snapshotPath": ".source/original.png", "sha256": digest(&bytes), "width": 4, "height": 4}, "complete": true, "parts": parts, "omittedParts": [], "createdAt": "2026-09-10T12:00:00Z" });
    fs::write(
        root.path().join("Set/sprite.parts.json"),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();
    value
}
fn select_set(root: &VaultRoot) -> WorkspaceSelection {
    let item = entry(root, "Set");
    select_entry(root, &item.relative_path, &item.fingerprint).unwrap()
}

#[test]
fn complete_set_emits_only_after_full_hash_and_manifest_validation() {
    let (_dir, root) = fixture();
    let mut manifest = set_fixture(&root);
    assert!(entry(&root, "Set").set_candidate);
    assert!(matches!(
        select_set(&root),
        WorkspaceSelection::SpriteSet {
            complete: true,
            part_count: 15,
            ..
        }
    ));
    fs::write(root.path().join("Set/01_head.png"), "partial publication").unwrap();
    assert!(
        matches!(select_set(&root), WorkspaceSelection::Directory { status, .. } if status == "in_progress")
    );
    fs::remove_file(root.path().join("Set/01_head.png")).unwrap();
    assert!(
        matches!(select_set(&root), WorkspaceSelection::Directory { status, .. } if status == "in_progress")
    );
    manifest["parts"][0]["file"] = json!("../foreign.png");
    fs::write(
        root.path().join("Set/sprite.parts.json"),
        serde_json::to_vec(&manifest).unwrap(),
    )
    .unwrap();
    assert!(
        matches!(select_set(&root), WorkspaceSelection::Directory { status, .. } if status == "invalid")
    );
}

#[test]
fn ordinary_and_explicitly_incomplete_sets_are_distinguished_from_broken_sets() {
    let (_dir, root) = fixture();
    fs::create_dir(root.path().join("Ordinary")).unwrap();
    let folder = entry(&root, "Ordinary");
    assert!(
        matches!(select_entry(&root, &folder.relative_path, &folder.fingerprint).unwrap(), WorkspaceSelection::Directory { status, .. } if status == "ordinary")
    );
    let mut value = set_fixture(&root);
    value["complete"] = json!(false);
    value["parts"].as_array_mut().unwrap().remove(0);
    value["omittedParts"] = json!([{"partId": "head", "reason": "Nicht im Bild vorhanden"}]);
    fs::write(
        root.path().join("Set/sprite.parts.json"),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();
    assert!(matches!(
        select_set(&root),
        WorkspaceSelection::SpriteSet {
            complete: false,
            part_count: 14,
            ..
        }
    ));
    value["omittedParts"] = json!([]);
    fs::write(
        root.path().join("Set/sprite.parts.json"),
        serde_json::to_vec(&value).unwrap(),
    )
    .unwrap();
    assert!(
        matches!(select_set(&root), WorkspaceSelection::Directory { status, .. } if status == "invalid")
    );
}

#[cfg(unix)]
#[test]
fn symlinks_and_replaced_parents_are_never_followed() {
    use std::os::unix::fs::symlink;
    let (_dir, root) = fixture();
    let outside = TempDir::new().unwrap();
    fs::write(outside.path().join("secret.png"), png_bytes()).unwrap();
    symlink(outside.path(), root.path().join("linked")).unwrap();
    symlink(
        outside.path().join("secret.png"),
        root.path().join("image.png"),
    )
    .unwrap();
    let page = list_entries(&root, &query()).unwrap();
    assert!(page.entries.is_empty());
    assert_eq!(page.skipped_entries, 2);
    let mut q = query();
    q.relative_path = "linked".to_owned();
    assert!(list_entries(&root, &q).is_err());
    assert!(thumbnail(&root, "linked/secret.png", "anything").is_err());
    set_fixture(&root);
    fs::remove_file(root.path().join("Set/01_head.png")).unwrap();
    symlink(
        outside.path().join("secret.png"),
        root.path().join("Set/01_head.png"),
    )
    .unwrap();
    assert!(
        matches!(select_set(&root), WorkspaceSelection::Directory { status, .. } if status == "invalid")
    );
}
