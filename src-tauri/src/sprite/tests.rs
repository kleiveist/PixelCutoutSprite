use super::*;
use crate::{
    cutout::{catalog, digest, encode_png, json_bytes},
    storage::VaultRoot,
    workspace::data_folder::manifest::{Manifest, Omitted, Part, Point, Rect, Source},
};
use image::{Rgba, RgbaImage};
use std::{fs, path::Path};
use tempfile::TempDir;

pub(crate) fn files(root: &VaultRoot) -> String {
    fs::create_dir(root.path().join("Parts")).unwrap();
    let images = [
        (
            "head",
            RgbaImage::from_fn(2, 2, |x, y| {
                Rgba(if (x, y) == (1, 0) {
                    [255, 0, 0, 128]
                } else if (x, y) == (1, 1) {
                    [0, 0, 0, 0]
                } else {
                    [255, 0, 0, 255]
                })
            }),
        ),
        ("torso", RgbaImage::from_pixel(3, 1, Rgba([0, 0, 255, 255]))),
    ];
    let mut parts = Vec::new();
    for (id, image) in images {
        let bytes = encode_png(&image).unwrap();
        let file = catalog()
            .iter()
            .find(|part| part.part_id == id)
            .unwrap()
            .file
            .clone();
        fs::write(root.path().join("Parts").join(&file), &bytes).unwrap();
        let (x, y, pivot, z) = if id == "head" {
            (4, 3, Point { x: 0.0, y: 1.0 }, 40)
        } else {
            (3, 3, Point { x: 2.0, y: 0.0 }, -2)
        };
        parts.push(Part {
            part_id: id.into(),
            file,
            sha256: digest(&bytes),
            source_rect: Rect {
                x,
                y,
                width: image.width(),
                height: image.height(),
            },
            default_position: Point {
                x: f64::from(x) + pivot.x,
                y: f64::from(y) + pivot.y,
            },
            pivot,
            default_z: z,
            parent_id: None,
        });
    }
    let manifest = Manifest {
        schema_version: 1,
        kind: "spriteParts".into(),
        set_id: "set-asymmetric".into(),
        generation_id: "gen-original".into(),
        cutout_revision: 2,
        source: Source {
            original_path: None,
            original_sha256: None,
            snapshot_path: ".source/original.png".into(),
            sha256: "a".repeat(64),
            width: 9,
            height: 7,
        },
        complete: false,
        parts,
        omitted_parts: catalog()
            .iter()
            .filter(|part| part.required && part.part_id != "head" && part.part_id != "torso")
            .map(|part| Omitted {
                part_id: part.part_id.clone(),
                reason: "verdeckter Teil".into(),
            })
            .collect(),
        created_at: "2026-09-10T00:00:00Z".into(),
    };
    let bytes = json_bytes(&manifest).unwrap();
    fs::write(root.path().join("Parts/sprite.parts.json"), &bytes).unwrap();
    digest(&bytes)
}
pub(super) fn fixture() -> (TempDir, VaultRoot, String) {
    let temp = TempDir::new().unwrap();
    let root = VaultRoot::open(temp.path()).unwrap();
    let hash = files(&root);
    (temp, root, hash)
}
pub(super) fn read_json(root: &VaultRoot) -> serde_json::Value {
    serde_json::from_slice(&fs::read(root.path().join("Parts/sprite.parts.json")).unwrap()).unwrap()
}
pub(super) fn write_manifest(root: &VaultRoot, value: &serde_json::Value) -> String {
    let bytes = json_bytes(value).unwrap();
    fs::write(root.path().join("Parts/sprite.parts.json"), &bytes).unwrap();
    digest(&bytes)
}

#[test]
fn manifest_only_loading_keeps_noncentral_pivots_actual_z_and_binary_pixels_without_writes() {
    let (temp, root, hash) = fixture();
    fs::write(temp.path().join("Parts/16_cape.png"), b"obsolete leftover").unwrap();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    assert_eq!(loaded.assets.len(), 2);
    assert!(!loaded.manual_alignment);
    assert_eq!(loaded.warnings.len(), 13);
    assert_eq!(loaded.scene.layers[0].position, Point { x: 4.0, y: 4.0 });
    assert_eq!(loaded.scene.layers[0].pivot, Point { x: 0.0, y: 1.0 });
    assert_eq!(loaded.scene.layers[0].z_index, 40);
    assert_eq!(loaded.scene.layers[1].z_index, -2);
    let head = pixels(&root, "Parts", SpriteSourceKind::Manifest, &hash, "head").unwrap();
    assert_eq!(
        head,
        [255, 0, 0, 255, 255, 0, 0, 128, 255, 0, 0, 255, 0, 0, 0, 0]
    );
    assert!(pixels(&root, "Parts", SpriteSourceKind::Manifest, &hash, "cape").is_err());
    assert_eq!(
        fs::read(temp.path().join("Parts/16_cape.png")).unwrap(),
        b"obsolete leftover"
    );
    assert!(!temp.path().join("Parts/sprite.scene.json").exists());
    assert!(!temp.path().join(".PixelStudio").exists());
}

#[test]
fn saved_scene_wins_and_incompatible_or_corrupt_scenes_are_not_reset() {
    let (temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let mut scene = loaded.scene;
    scene.revision = 7;
    scene.layers[0].position = Point { x: 37.0, y: -12.0 };
    scene.layers[0].rotation_deg = 90.0;
    scene.layers[0].locked = true;
    scene.layers[1].visible = false;
    let path = temp.path().join("Parts/sprite.scene.json");
    let bytes = json_bytes(&scene).unwrap();
    fs::write(&path, &bytes).unwrap();
    let reopened = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    assert_eq!(reopened.scene, scene);
    assert_eq!(reopened.scene_sha256, Some(digest(&bytes)));
    scene.generation_id = "gen-older".into();
    let old = json_bytes(&scene).unwrap();
    fs::write(&path, &old).unwrap();
    let pending = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    assert!(pending.reconciliation.unwrap().geometry_unknown);
    assert_eq!(pending.scene.layers[0].position, scene.layers[0].position);
    assert_eq!(fs::read(&path).unwrap(), old);
    fs::write(&path, b"invalid scene").unwrap();
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    assert_eq!(fs::read(path).unwrap(), b"invalid scene");
}

#[test]
fn missing_changed_wrong_size_and_unsafe_manifest_members_are_rejected() {
    let (temp, root, hash) = fixture();
    let path = temp.path().join("Parts/01_head.png");
    let original = fs::read(&path).unwrap();
    fs::remove_file(&path).unwrap();
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    fs::write(&path, b"broken").unwrap();
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    fs::write(&path, original).unwrap();
    let mut document = read_json(&root);
    let original_document = document.clone();
    for file in [
        "../outside.png",
        "/outside.png",
        "nested/01_head.png",
        "02_head.png",
    ] {
        document["parts"][0]["file"] = file.into();
        let hash = write_manifest(&root, &document);
        assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    }
    document = original_document.clone();
    document["parts"][0]["sourceRect"]["width"] = 3.into();
    let hash = write_manifest(&root, &document);
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    document = original_document.clone();
    document["schemaVersion"] = 900.into();
    let hash = write_manifest(&root, &document);
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    document = original_document;
    document["parts"][1]["partId"] = "head".into();
    let hash = write_manifest(&root, &document);
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
}

#[test]
fn a_manifest_replacement_between_metadata_and_pixels_never_returns_old_pixels_as_current() {
    let (_temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let mut manifest = read_json(&root);
    manifest["generationId"] = "gen-next".into();
    let next = write_manifest(&root, &manifest);
    assert!(pixels(
        &root,
        "Parts",
        SpriteSourceKind::Manifest,
        &loaded.document_sha256,
        "head"
    )
    .is_err());
    assert_eq!(
        load(&root, "Parts", SpriteSourceKind::Manifest, &next)
            .unwrap()
            .scene
            .generation_id,
        "gen-next"
    );
}

#[test]
fn legacy_requires_manual_alignment_even_for_equal_sized_parts_and_never_falls_back_from_bad_manifest(
) {
    let (temp, root, _) = fixture();
    fs::remove_file(temp.path().join("Parts/sprite.parts.json")).unwrap();
    fs::write(temp.path().join("Parts/unknown.png"), b"ignored").unwrap();
    let assets = legacy::assets(&root, "Parts").unwrap();
    let hash = legacy::document_hash(&assets).unwrap();
    let loaded = load(&root, "Parts", SpriteSourceKind::Legacy, &hash).unwrap();
    assert!(loaded.manual_alignment);
    assert!(loaded.manifest.is_none());
    assert_eq!(
        loaded.scene.layers[0].position,
        loaded.scene.layers[0].pivot
    );
    assert!(loaded.warnings[0].contains("KEINE"));
    assert!(matches!(
        legacy::inspect(&root, "Parts").unwrap(),
        Some(crate::workspace::data_folder::WorkspaceSelection::LegacySet { part_count: 2, .. })
    ));
    fs::write(
        temp.path().join("Parts/02_torso.png"),
        fs::read(temp.path().join("Parts/01_head.png")).unwrap(),
    )
    .unwrap();
    let assets = legacy::assets(&root, "Parts").unwrap();
    let hash = legacy::document_hash(&assets).unwrap();
    assert!(
        load(&root, "Parts", SpriteSourceKind::Legacy, &hash)
            .unwrap()
            .manual_alignment
    );
    fs::write(
        temp.path().join("Parts/sprite.parts.json"),
        b"corrupt manifest",
    )
    .unwrap();
    assert!(load(&root, "Parts", SpriteSourceKind::Legacy, &hash).is_err());
    assert!(!temp.path().join("Parts/sprite.scene.json").exists());
}

#[test]
fn legacy_change_accessory_collision_and_unbounded_scene_transform_are_rejected() {
    let (temp, root, _) = fixture();
    fs::remove_file(temp.path().join("Parts/sprite.parts.json")).unwrap();
    let assets = legacy::assets(&root, "Parts").unwrap();
    let hash = legacy::document_hash(&assets).unwrap();
    let mut scene = load(&root, "Parts", SpriteSourceKind::Legacy, &hash)
        .unwrap()
        .scene;
    for scale in [0.0, 0.001, 101.0, f64::INFINITY] {
        scene.layers[0].scale.x = scale;
        assert!(scene.validate().is_err());
    }
    let bytes = fs::read(temp.path().join("Parts/01_head.png")).unwrap();
    fs::write(temp.path().join("Parts/17_sword.png"), &bytes).unwrap();
    assert!(pixels(&root, "Parts", SpriteSourceKind::Legacy, &hash, "head").is_err());
    fs::write(temp.path().join("Parts/17_belt_accessory.png"), bytes).unwrap();
    assert!(legacy::assets(&root, "Parts").is_err());
}

#[cfg(unix)]
#[test]
fn symlinked_set_or_png_is_not_followed() {
    let (temp, root, hash) = fixture();
    let outside = TempDir::new().unwrap();
    fs::write(outside.path().join("head.png"), b"private").unwrap();
    fs::remove_file(temp.path().join("Parts/01_head.png")).unwrap();
    std::os::unix::fs::symlink(
        outside.path().join("head.png"),
        temp.path().join("Parts/01_head.png"),
    )
    .unwrap();
    assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
    assert!(pixels(&root, "Parts", SpriteSourceKind::Manifest, &hash, "head").is_err());
    std::os::unix::fs::symlink(outside.path(), temp.path().join("Escaped")).unwrap();
    assert!(root
        .resolve(Path::new("Escaped/sprite.parts.json"))
        .is_err());
    assert_eq!(
        fs::read(outside.path().join("head.png")).unwrap(),
        b"private"
    );
}
