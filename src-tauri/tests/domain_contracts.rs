use std::fs;
use std::path::{Path, PathBuf};

use pixel_cutout_sprite_studio_lib::domain::*;
use serde_json::Value;

const VALID_FIXTURES: &str = "tests/fixtures/contracts/valid";
const INVALID_FIXTURES: &str = "tests/fixtures/contracts/invalid";

fn fixture(path: impl AsRef<Path>) -> Vec<u8> {
    fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join(path)).expect("fixture should be readable")
}

fn valid_fixture_paths() -> Vec<PathBuf> {
    let mut paths = fs::read_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join(VALID_FIXTURES))
        .expect("valid fixture directory should exist")
        .map(|entry| entry.expect("fixture entry should be readable").path())
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn valid_catalog() -> DomainCatalog {
    let documents = valid_fixture_paths()
        .into_iter()
        .map(|path| parse_document(&fs::read(path).expect("fixture should be readable")))
        .collect::<Result<Vec<_>, _>>()
        .expect("valid fixtures should parse");
    DomainCatalog::from_documents(documents)
}

#[test]
fn every_valid_document_round_trips_and_the_complete_graph_is_valid() {
    let documents = valid_fixture_paths()
        .into_iter()
        .map(|path| {
            let document = parse_document(&fs::read(path).expect("fixture should be readable"))?;
            let encoded = serialize_document(&document)?;
            let reparsed = parse_document(&encoded)?;
            assert_eq!(document, reparsed);
            Ok(document)
        })
        .collect::<Result<Vec<_>, DomainError>>()
        .expect("every v1 contract should round-trip");
    assert_eq!(documents.len(), 15);
    DomainCatalog::from_documents(documents)
        .validate()
        .expect("the complete graph should validate");
}

#[test]
fn future_versions_and_invalid_headers_fail_without_mutating_input() {
    let source = fixture(format!("{INVALID_FIXTURES}/future-project.json"));
    let before = source.clone();
    assert!(matches!(
        parse_document(&source),
        Err(DomainError::UnsupportedSchemaVersion {
            found: 99,
            supported: 1
        })
    ));
    assert_eq!(source, before);

    let bad_uuid = fixture(format!("{INVALID_FIXTURES}/invalid-uuid-project.json"));
    assert!(matches!(
        parse_document(&bad_uuid),
        Err(DomainError::InvalidJson(_))
    ));
    assert!(matches!(
        parse_document(b"{"),
        Err(DomainError::InvalidJson(_))
    ));
    assert!(parse_document(br#"{"schema_version":1,"kind":"unknown"}"#).is_err());
}

#[test]
fn local_graphs_reject_cycles_unsafe_paths_and_invalid_atlas_bounds() {
    let direction_cycle = fixture(format!("{INVALID_FIXTURES}/direction-cycle.json"));
    assert!(matches!(
        parse_document(&direction_cycle),
        Err(DomainError::Cycle {
            relation: "direction mirrors",
            ..
        })
    ));
    let traversal = fixture(format!("{INVALID_FIXTURES}/traversal-asset-revision.json"));
    assert!(matches!(
        parse_document(&traversal),
        Err(DomainError::InvalidValue { .. })
    ));
    let bounds = fixture(format!("{INVALID_FIXTURES}/out-of-bounds-export.json"));
    assert!(matches!(
        parse_document(&bounds),
        Err(DomainError::InvalidValue { .. })
    ));

    let mut profile = valid_catalog().profiles.remove(0);
    profile.slots[0].parent_id = Some(profile.slots[1].id.clone());
    profile.slots[1].parent_id = Some(profile.slots[0].id.clone());
    assert!(matches!(profile.validate(), Err(DomainError::Cycle { .. })));
}

#[test]
fn aggregate_validation_rejects_duplicates_missing_refs_and_action_collisions() {
    let mut duplicate = valid_catalog();
    duplicate.projects.push(duplicate.projects[0].clone());
    assert!(matches!(
        duplicate.validate(),
        Err(DomainError::DuplicateId(_))
    ));

    let mut missing = valid_catalog();
    missing.areas[0].project_id =
        ObjectId::parse("project_id", "00000000-0000-4000-8000-000000000001").unwrap();
    assert!(matches!(
        missing.validate(),
        Err(DomainError::MissingReference { path, .. }) if path == "area.project_id"
    ));

    let mut collision = valid_catalog();
    let mut second = collision.bindings[0].clone();
    second.id = ObjectId::parse("id", "00000000-0000-4000-8000-000000000002").unwrap();
    collision.bindings.push(second);
    assert!(matches!(
        collision.validate(),
        Err(DomainError::DuplicateId(_))
    ));
}

#[test]
fn one_released_motion_can_serve_multiple_distinct_characters() {
    let mut catalog = valid_catalog();
    let mut appearance = catalog.appearances[0].clone();
    appearance.id = ObjectId::parse("id", "00000000-0000-4000-8000-000000000003").unwrap();
    appearance.character_id =
        ObjectId::parse("id", "00000000-0000-4000-8000-000000000004").unwrap();
    appearance.name = "Alternate".to_owned();
    let mut character = catalog.characters[0].clone();
    character.id = appearance.character_id;
    character.default_appearance_id = appearance.id;
    character.name = "Merchant 01".to_owned();
    let mut binding = catalog.bindings[0].clone();
    binding.id = ObjectId::parse("id", "00000000-0000-4000-8000-000000000005").unwrap();
    binding.character_id = character.id;
    binding.appearance_id = appearance.id;
    assert_eq!(binding.template_ref, catalog.bindings[0].template_ref);
    assert_ne!(binding.id, binding.appearance_id);
    assert_ne!(binding.id, binding.template_ref.id);
    catalog.appearances.push(appearance);
    catalog.characters.push(character);
    catalog.bindings.push(binding);
    catalog
        .validate()
        .expect("shared motion revision should remain valid");
}

#[test]
fn immutable_revisions_statuses_and_freshness_have_explicit_rules() {
    let catalog = valid_catalog();
    let motion = &catalog.motions[0];
    ensure_motion_revision_unchanged(motion, motion).unwrap();
    let mut changed = motion.clone();
    changed.fps = 24;
    assert!(ensure_motion_revision_unchanged(motion, &changed).is_err());
    assert!(TemplateStatus::Active.can_transition_to(TemplateStatus::Archived));
    assert!(OutfitDraftStatus::InProgress.can_transition_to(OutfitDraftStatus::Assigned));
    assert!(!OutfitDraftStatus::Assigned.can_transition_to(OutfitDraftStatus::InProgress));
    assert!(ReviewState::Draft.can_transition_to(ReviewState::Reviewed));
    assert!(!ReviewState::Reviewed.can_transition_to(ReviewState::Draft));

    let export = &catalog.exports[0];
    assert_eq!(
        export_freshness(export, &export.source_fingerprint),
        ExportFreshness::Current
    );
    let changed_hash =
        Sha256Digest::parse("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            .unwrap();
    assert_eq!(
        export_freshness(export, &changed_hash),
        ExportFreshness::Stale
    );
}

#[test]
fn numbers_names_and_canonical_json_are_portable_and_deterministic() {
    assert!(RelativePath::parse("assets/body.png").is_ok());
    for invalid in [
        "/tmp/body.png",
        "C:/body.png",
        "../body.png",
        "a\\body.png",
        ".pixelforge-studio/body.png",
    ] {
        assert!(RelativePath::parse(invalid).is_err(), "{invalid} must fail");
    }
    assert!(validate_portable_display_name("name", "CON").is_err());
    assert!(
        ensure_no_portable_name_collisions("names", ["Händlerin", "Ha\u{308}ndlerin"]).is_err()
    );

    let first: Value = serde_json::from_str(r#"{"b":2,"a":{"d":4,"c":3}}"#).unwrap();
    let second: Value = serde_json::from_str(r#"{"a":{"c":3,"d":4},"b":2}"#).unwrap();
    assert_eq!(
        canonical_json_bytes(&first).unwrap(),
        canonical_json_bytes(&second).unwrap()
    );

    let mut motion = valid_catalog().motions.remove(0);
    motion.fps = 0;
    assert!(motion.validate(None).is_err());
    motion.fps = 12;
    motion.tracks[0].keys[0].value = TrackValue::Number(f64::NAN);
    assert!(motion.validate(None).is_err());
}

#[test]
fn source_contract_and_runtime_dependencies_are_file_based_only() {
    let cargo = fixture("Cargo.toml");
    let manifest = String::from_utf8(cargo).unwrap().to_ascii_lowercase();
    for forbidden in ["sqlite", "rusqlite", "sqlx", "diesel"] {
        assert!(
            !manifest.contains(forbidden),
            "{forbidden} must not be a runtime dependency"
        );
    }
    assert_eq!(RESERVED_ADMIN_DIRECTORY, ".pixelforge-studio");
    assert_eq!(VAULT_FORMAT, "pixel-cutout-sprite-vault");
}
