use super::{
    tests::{fixture, read_json, write_manifest},
    *,
};
use crate::{
    cutout::{digest, json_bytes},
    storage::StorageError,
    workspace::{InterruptWorkspaceAfterStep, WorkspaceWriter},
};
use std::{fs, path::Path};

pub(super) fn request(loaded: &LoadedSprite) -> SaveSpriteRequest {
    SaveSpriteRequest {
        directory: loaded.directory.clone(),
        source_kind: loaded.source_kind,
        expected_document_sha256: loaded.document_sha256.clone(),
        expected_scene_sha256: loaded.scene_sha256.clone(),
        expected_basis_sha256: loaded.basis_sha256.clone(),
        expected_revision: loaded.scene_sha256.as_ref().map(|_| loaded.scene.revision),
        accept_generation: false,
        scene: loaded.scene.clone(),
    }
}

#[test]
fn scene_roundtrip_preserves_every_transform_without_writing_parts_or_manifest() {
    let (temp, root, hash) = fixture();
    let paths = [
        "Parts/01_head.png",
        "Parts/02_torso.png",
        "Parts/sprite.parts.json",
    ];
    let originals: Vec<_> = paths
        .iter()
        .map(|path| fs::read(temp.path().join(path)).unwrap())
        .collect();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let mut edit = request(&loaded);
    edit.scene.pixel_snap = false;
    edit.scene.layers[0].position.x = -17.25;
    edit.scene.layers[0].pivot.y = 0.25;
    edit.scene.layers[0].rotation_deg = 90.0;
    edit.scene.layers[0].scale.x = 1.5;
    edit.scene.layers[0].scale.y = 2.5;
    edit.scene.layers[0].z_index = -100;
    edit.scene.layers[0].locked = true;
    edit.scene.layers[1].visible = false;
    let saved = save_scene(&root, edit.clone()).unwrap();
    assert_eq!(saved.scene.revision, 1);
    assert_eq!(saved.scene.layers, edit.scene.layers);
    assert!(saved.basis_sha256.is_some());
    drop(root);
    let reopened_root = crate::storage::VaultRoot::open(temp.path()).unwrap();
    let reopened = load(&reopened_root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    assert_eq!(reopened.scene, saved.scene);
    let next = save_scene(&reopened_root, request(&reopened)).unwrap();
    assert_eq!(next.scene.revision, 2);
    for (path, bytes) in paths.iter().zip(originals) {
        assert_eq!(fs::read(temp.path().join(path)).unwrap(), bytes);
    }
    assert!(!temp.path().join("Parts/.source").exists());
}

#[test]
fn changed_manifest_hash_requires_review_even_if_generation_id_was_reused() {
    let (_temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let saved = save_scene(&root, request(&loaded)).unwrap();
    let mut manifest = read_json(&root);
    manifest["parts"][0]["sourceRect"]["x"] = 5.into();
    manifest["parts"][0]["defaultPosition"]["x"] = 5.into();
    let next_hash = write_manifest(&root, &manifest);
    let next = load(&root, "Parts", SpriteSourceKind::Manifest, &next_hash).unwrap();
    assert!(next.reconciliation.is_some());
    assert_eq!(next.scene.generation_id, saved.scene.generation_id);
    assert_eq!(next.scene.layers[0].pivot.x, -1.0);
    assert!(save_scene(&root, request(&next)).is_err());
}

#[test]
fn scene_cas_checks_revision_scene_hash_basis_hash_and_current_manifest() {
    let (temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let stale = request(&loaded);
    let saved = save_scene(&root, stale.clone()).unwrap();
    assert!(matches!(
        save_scene(&root, stale),
        Err(StorageError::WriteConflict)
    ));
    for mode in 0..3 {
        let mut edit = request(&saved);
        match mode {
            0 => edit.expected_revision = Some(999),
            1 => edit.expected_scene_sha256 = Some("0".repeat(64)),
            _ => edit.expected_basis_sha256 = Some("0".repeat(64)),
        }
        assert!(matches!(
            save_scene(&root, edit),
            Err(StorageError::WriteConflict)
        ));
    }
    let mut manifest = read_json(&root);
    manifest["generationId"] = "generation-next".into();
    write_manifest(&root, &manifest);
    assert!(save_scene(&root, request(&saved)).is_err());
    assert_eq!(
        digest(&fs::read(temp.path().join("Parts/sprite.scene.json")).unwrap()),
        saved.scene_sha256.unwrap()
    );
}

#[test]
fn new_generation_requires_confirmation_and_preserves_source_anchors_and_stable_parts() {
    let (temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    let mut edit = request(&loaded);
    edit.scene.layers[0].position.x = 42.0;
    edit.scene.layers[0].position.y = -7.0;
    edit.scene.layers[0].rotation_deg = 90.0;
    edit.scene.layers[0].scale.x = 2.0;
    edit.scene.layers[0].scale.y = 3.0;
    edit.scene.layers[0].locked = true;
    let saved = save_scene(&root, edit).unwrap();
    let old_scene = fs::read(temp.path().join("Parts/sprite.scene.json")).unwrap();
    let mut manifest = read_json(&root);
    manifest["generationId"] = "generation-next".into();
    manifest["parts"][0]["sourceRect"]["x"] = 5.into();
    manifest["parts"][0]["defaultPosition"]["x"] = 5.into();
    let mut cape = manifest["parts"][0].clone();
    cape["partId"] = "cape".into();
    cape["file"] = "16_cape.png".into();
    cape["defaultZ"] = (-100).into();
    fs::copy(
        temp.path().join("Parts/01_head.png"),
        temp.path().join("Parts/16_cape.png"),
    )
    .unwrap();
    manifest["parts"].as_array_mut().unwrap().remove(1);
    manifest["parts"].as_array_mut().unwrap().push(cape);
    manifest["omittedParts"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!({"partId":"torso", "reason":"in neuer Generation abgewählt"}));
    let next_hash = write_manifest(&root, &manifest);
    let next = load(&root, "Parts", SpriteSourceKind::Manifest, &next_hash).unwrap();
    let change = next.reconciliation.as_ref().unwrap();
    assert_eq!(change.added_parts, ["cape"]);
    assert_eq!(change.removed_parts, ["torso"]);
    assert_eq!(change.geometry_changed_parts, ["head"]);
    assert!(!change.geometry_unknown && !change.source_changed);
    assert_eq!(
        next.scene.layers[0].position,
        saved.scene.layers[0].position
    );
    assert_eq!(next.scene.layers[0].pivot.x, -1.0);
    assert!(next.scene.layers[0].locked);
    assert_eq!(next.scene.layers[0].rotation_deg, 90.0);
    assert_eq!(next.scene.layers[0].scale.x, 2.0);
    // Independently: source (5,3) was local (1,0), now (0,0). Both yield
    // R90*S(2,3)*(1,-1) = (3,2), hence world (45,-5).
    assert_eq!(
        saved.scene.layers[0].position.x + 3.0,
        next.scene.layers[0].position.x + 3.0
    );
    assert_eq!(
        fs::read(temp.path().join("Parts/sprite.scene.json")).unwrap(),
        old_scene
    );
    assert!(save_scene(&root, request(&next)).is_err());
    let mut accept = request(&next);
    accept.accept_generation = true;
    let committed = save_scene(&root, accept).unwrap();
    assert!(committed.reconciliation.is_none());
    assert_eq!(committed.scene.revision, 2);
    assert!(!committed
        .assets
        .iter()
        .any(|asset| asset.part_id == "torso"));
    assert!(
        temp.path().join("Parts/02_torso.png").exists(),
        "leftover PNG is neither loaded nor deleted by scene edits"
    );
}

#[test]
fn interrupted_scene_and_geometry_publication_is_unreadable_until_recovered() {
    for boundary in 1..=2 {
        let (_temp, root, hash) = fixture();
        let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
        let saved = save_scene(&root, request(&loaded)).unwrap();
        let mut edit = request(&saved);
        edit.scene.layers[0].position.x = 73.0;
        let writer =
            WorkspaceWriter::with_fault(root.clone(), InterruptWorkspaceAfterStep(boundary));
        assert!(matches!(
            super::scene::save_with_writer(&root, edit, &writer),
            Err(StorageError::TransactionInterrupted { .. })
        ));
        assert!(load(&root, "Parts", SpriteSourceKind::Manifest, &hash).is_err());
        WorkspaceWriter::new(root.clone())
            .recover_file_sets()
            .unwrap();
        let recovered = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
        assert_eq!(recovered.scene.revision, 2);
        assert_eq!(recovered.scene.layers[0].position.x, 73.0);
    }
}

#[test]
fn invalid_scene_and_foreign_or_modified_geometry_receipts_are_never_overwritten() {
    let (temp, root, hash) = fixture();
    let loaded = load(&root, "Parts", SpriteSourceKind::Manifest, &hash).unwrap();
    for mode in 0..5 {
        let mut edit = request(&loaded);
        match mode {
            0 => edit.scene.layers[0].scale.x = 0.0,
            1 => edit.scene.layers[0].position.x = f64::INFINITY,
            2 => edit.scene.layers.push(edit.scene.layers[0].clone()),
            3 => edit.scene.schema_version = 99,
            _ => edit.directory = "../outside".into(),
        }
        assert!(save_scene(&root, edit).is_err());
        assert!(!temp.path().join("Parts/sprite.scene.json").exists());
    }
    let saved = save_scene(&root, request(&loaded)).unwrap();
    let path = temp.path().join("Parts/.scene/basis.json");
    let mut basis: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    basis["sceneId"] = "foreign-scene".into();
    let foreign = json_bytes(&basis).unwrap();
    fs::write(&path, &foreign).unwrap();
    assert!(save_scene(&root, request(&saved)).is_err());
    assert_eq!(fs::read(&path).unwrap(), foreign);
    assert_eq!(
        digest(&fs::read(temp.path().join("Parts/sprite.scene.json")).unwrap()),
        saved.scene_sha256.unwrap()
    );
    assert!(root.resolve(Path::new("../outside")).is_err());
}

#[test]
fn legacy_scene_saves_without_inventing_a_manifest_and_reconciles_dimension_changes() {
    let (temp, root, _hash) = fixture();
    fs::remove_file(temp.path().join("Parts/sprite.parts.json")).unwrap();
    let loaded = load_current(&root, "Parts", SpriteSourceKind::Legacy).unwrap();
    let saved = save_scene(&root, request(&loaded)).unwrap();
    assert!(!temp.path().join("Parts/sprite.parts.json").exists());
    fs::copy(
        temp.path().join("Parts/01_head.png"),
        temp.path().join("Parts/02_torso.png"),
    )
    .unwrap();
    let next = load_current(&root, "Parts", SpriteSourceKind::Legacy).unwrap();
    assert!(next.manual_alignment);
    assert_eq!(
        next.reconciliation.unwrap().geometry_changed_parts,
        ["torso"]
    );
    assert_eq!(
        next.scene.layers[0].position,
        saved.scene.layers[0].position
    );
}
