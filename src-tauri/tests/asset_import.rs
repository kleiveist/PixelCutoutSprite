use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use image::{Rgb, RgbImage, Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::asset_io::{
    filename_suggestion, AssetImportError, AssetPackage, AssetRepository, ImportLimits,
    PackageEntry, PngImporter, SheetRect, ASSET_PACKAGE_FORMAT,
};
use pixel_cutout_sprite_studio_lib::domain::{
    Area, AssetKind, Direction, DirectionModel, DocumentKind, DomainDocument, ObjectId, ObjectType,
    PixelPoint, PixelSize, Project, RecordStatus, RevisionRef, SlotId, UtcTimestamp, Vault,
    SCHEMA_VERSION, VAULT_FORMAT,
};
use pixel_cutout_sprite_studio_lib::storage::{
    InterruptAfterStep, JsonStore, NoTransactionFault, ObjectIndex, RecoveryChoice, StorageError,
    TransactionPurpose, TransactionService, TransactionState, VaultRoot,
};
use tempfile::TempDir;

fn allowed() -> HashSet<SlotId> {
    ["head", "torso_upper", "hand_l"]
        .into_iter()
        .map(|value| SlotId::parse(value).unwrap())
        .collect()
}

fn write_rgba(path: &Path, width: u32, height: u32) {
    RgbaImage::from_fn(width, height, |x, y| {
        Rgba([
            x as u8 * 20,
            y as u8 * 20,
            160,
            if x == 0 { 128 } else { 255 },
        ])
    })
    .save(path)
    .unwrap();
}

fn entry(source: &str) -> PackageEntry {
    PackageEntry {
        name: "Left hand glove".to_owned(),
        source: source.to_owned(),
        asset_kind: AssetKind::Equipment,
        slot_id: Some("hand_l".to_owned()),
        direction: Some(Direction::S),
        variant: "base".to_owned(),
        image_size_px: PixelSize(4, 4),
        pivot_px: PixelPoint(2, 1),
        sheet_rect_px: None,
        sprite_mirroring_allowed: false,
        origin_note: "Generated test pixels".to_owned(),
        license_note: "CC0 test fixture".to_owned(),
    }
}

fn package(entries: Vec<PackageEntry>) -> AssetPackage {
    AssetPackage {
        format: ASSET_PACKAGE_FORMAT.to_owned(),
        format_version: 1,
        profile_ref: RevisionRef {
            id: ObjectId::new(),
            revision: 1,
        },
        entries,
    }
}

fn write_package(root: &Path, package: &AssetPackage) -> std::path::PathBuf {
    let path = root.join("package.json");
    fs::write(&path, serde_json::to_vec_pretty(package).unwrap()).unwrap();
    path
}

fn two_entry_package(root: &Path) -> pixel_cutout_sprite_studio_lib::asset_io::InspectedPackage {
    let first = root.join("hand_l__s__base.png");
    let second = root.join("head__s__base.png");
    write_rgba(&first, 4, 4);
    write_rgba(&second, 4, 4);
    let mut first_entry = entry("hand_l__s__base.png");
    first_entry.name = "Left hand glove".to_owned();
    let mut second_entry = entry("head__s__base.png");
    second_entry.name = "Iron helmet".to_owned();
    second_entry.slot_id = Some("head".to_owned());
    PngImporter::default()
        .inspect_package(
            &write_package(root, &package(vec![first_entry, second_entry])),
            &allowed(),
        )
        .unwrap()
}

fn test_vault(
    directory: &TempDir,
    area_path: &Path,
    area_id: ObjectId,
    profile_ref: RevisionRef,
) -> VaultRoot {
    fs::create_dir_all(directory.path().join(".pixelforge-studio")).unwrap();
    fs::create_dir_all(directory.path().join("game/.project")).unwrap();
    fs::create_dir_all(directory.path().join(area_path).join(".area")).unwrap();
    let root = VaultRoot::open(directory.path()).unwrap();
    let timestamp = UtcTimestamp::parse("2026-09-05T10:00:00Z").unwrap();
    JsonStore::default()
        .create(
            &root
                .resolve(Path::new(".pixelforge-studio/vault.json"))
                .unwrap(),
            &DomainDocument::Vault(Vault {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Vault,
                id: ObjectId::new(),
                format: VAULT_FORMAT.to_owned(),
                created_at: timestamp,
            }),
        )
        .unwrap();
    let project_id = ObjectId::new();
    JsonStore::default()
        .create(
            &root
                .resolve(Path::new("game/.project/project.json"))
                .unwrap(),
            &DomainDocument::Project(Project {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Project,
                id: project_id,
                revision: 1,
                name: "Game".to_owned(),
                status: RecordStatus::Active,
                workspace_label_ids: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        )
        .unwrap();
    let area_name = area_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap()
        .to_owned();
    JsonStore::default()
        .create(
            &root.resolve(&area_path.join(".area/area.json")).unwrap(),
            &DomainDocument::Area(Area {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Area,
                id: area_id,
                revision: 1,
                project_id,
                name: area_name,
                object_type: ObjectType::Humanoid,
                profile_ref,
                reference_height_px: 80,
                direction_model: DirectionModel::EightWay,
                directions: Direction::ALL.to_vec(),
                default_frame_size_px: PixelSize(64, 64),
                default_ground_origin_px: PixelPoint(32, 56),
                label_ids: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        )
        .unwrap();
    root
}

#[test]
fn a_described_png_package_imports_reproducibly_without_touching_the_external_source() {
    let source = TempDir::new().unwrap();
    let png = source.path().join("hand_l__s__base.png");
    write_rgba(&png, 4, 4);
    let before = fs::read(&png).unwrap();
    let package_path = write_package(source.path(), &package(vec![entry("hand_l__s__base.png")]));
    let inspected = PngImporter::default()
        .inspect_package(&package_path, &allowed())
        .unwrap();
    assert_eq!(
        inspected.entries[0].suggestion.as_ref().unwrap().slot_id,
        SlotId::parse("hand_l").unwrap()
    );

    let vault = TempDir::new().unwrap();
    let area_id = ObjectId::new();
    let root = test_vault(
        &vault,
        Path::new("game/characters"),
        area_id,
        inspected.package.profile_ref,
    );
    let imported = AssetRepository
        .import_package(
            &root,
            Path::new("game/characters"),
            area_id,
            &inspected,
            &[],
        )
        .unwrap();
    assert_eq!(imported.len(), 1);
    assert_eq!(imported[0].asset.area_id, area_id);
    assert_eq!(
        imported[0].revision.slot_id,
        SlotId::parse("hand_l").unwrap()
    );
    assert_eq!(fs::read(&png).unwrap(), before);
    let copied = root
        .resolve(&Path::new("game/characters").join(imported[0].revision.source_file.as_str()))
        .unwrap();
    assert_eq!(fs::read(copied.as_path()).unwrap(), before);
    assert_eq!(ObjectIndex::rebuild(&root).unwrap().len(), 5);
}

#[test]
fn repository_rehashes_the_source_immediately_before_staging() {
    let source = TempDir::new().unwrap();
    let png = source.path().join("hand_l__s__base.png");
    write_rgba(&png, 4, 4);
    let package_path = write_package(source.path(), &package(vec![entry("hand_l__s__base.png")]));
    let inspected = PngImporter::default()
        .inspect_package(&package_path, &allowed())
        .unwrap();

    RgbaImage::from_pixel(4, 4, Rgba([255, 0, 0, 255]))
        .save(&png)
        .unwrap();
    let vault = TempDir::new().unwrap();
    let area_path = Path::new("game/characters");
    let area_id = ObjectId::new();
    let root = test_vault(&vault, area_path, area_id, inspected.package.profile_ref);
    let error = AssetRepository
        .import_package(&root, area_path, area_id, &inspected, &[])
        .unwrap_err();
    assert!(matches!(
        error,
        pixel_cutout_sprite_studio_lib::asset_io::AssetRepositoryError::Import(
            AssetImportError::InvalidEntry { entry: 0, message }
        ) if message.contains("changed after inspection")
    ));
    let assets = root.resolve(&area_path.join(".area/assets")).unwrap();
    assert!(!assets.as_path().exists());
}

#[test]
fn interrupted_multi_asset_import_resumes_after_reopen() {
    let source = TempDir::new().unwrap();
    let inspected = two_entry_package(source.path());
    let vault = TempDir::new().unwrap();
    let area_path = Path::new("game/characters");
    let area_id = ObjectId::new();
    let root = test_vault(&vault, area_path, area_id, inspected.package.profile_ref);
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });

    let result = AssetRepository.import_package_with_transactions(
        &root,
        area_path,
        area_id,
        &inspected,
        &[],
        &interrupted,
    );
    assert!(matches!(
        result,
        Err(
            pixel_cutout_sprite_studio_lib::asset_io::AssetRepositoryError::Storage(
                StorageError::TransactionInterrupted { step: 1 }
            )
        )
    ));
    assert_eq!(ObjectIndex::rebuild(&root).unwrap().len(), 5);

    let reopened = VaultRoot::open(vault.path()).unwrap();
    let candidates = TransactionService::<NoTransactionFault>::scan_open(&reopened).unwrap();
    assert_eq!(candidates.len(), 1);
    let candidate = &candidates[0];
    assert_eq!(candidate.purpose, TransactionPurpose::AssetImport);
    assert_eq!(candidate.state, TransactionState::Applying);
    assert_eq!(candidate.completed_steps, 0);
    assert_eq!(candidate.total_steps, 2);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;

    let recovered = TransactionService::<NoTransactionFault>::default()
        .recover_candidate(&reopened, transaction_id, RecoveryChoice::Resume)
        .unwrap();
    assert_eq!(recovered.state, TransactionState::Committed);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&reopened)
            .unwrap()
            .is_empty()
    );
    assert_eq!(ObjectIndex::rebuild(&reopened).unwrap().len(), 7);
    assert!(!vault
        .path()
        .join("game/.project/transactions")
        .join(format!("{transaction_id}.stage"))
        .exists());

    let assets = fs::read_dir(vault.path().join(area_path).join(".area/assets"))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(assets.len(), 2);
    for asset in assets {
        let manifest = asset.path().join("asset.json");
        let loaded = JsonStore::default()
            .load(
                &reopened
                    .resolve(manifest.strip_prefix(vault.path()).unwrap())
                    .unwrap(),
            )
            .unwrap();
        let DomainDocument::Asset(saved) = loaded.value else {
            panic!("asset manifest expected after resume");
        };
        assert_eq!(saved.area_id, area_id);
        assert!(asset.path().join("r0001/revision.json").is_file());
        assert!(asset.path().join("r0001/source.png").is_file());
    }
}

#[test]
fn cancelled_import_removes_staging_before_a_journal_is_prepared() {
    let source = TempDir::new().unwrap();
    let inspected = two_entry_package(source.path());
    let vault = TempDir::new().unwrap();
    let area_path = Path::new("game/characters");
    let area_id = ObjectId::new();
    let root = test_vault(&vault, area_path, area_id, inspected.package.profile_ref);
    let cancelled = AtomicBool::new(false);
    let is_cancelled = || cancelled.load(Ordering::Acquire);
    let mut progress = |completed: usize, _total: usize| {
        if completed == 1 {
            cancelled.store(true, Ordering::Release);
        }
    };

    let result = AssetRepository.import_package_controlled(
        &root,
        area_path,
        area_id,
        &inspected,
        (&[], &is_cancelled, &mut progress),
    );

    assert!(matches!(
        result,
        Err(pixel_cutout_sprite_studio_lib::asset_io::AssetRepositoryError::Cancelled)
    ));
    assert!(TransactionService::<NoTransactionFault>::scan_open(&root)
        .unwrap()
        .is_empty());
    let assets = root.resolve(&area_path.join(".area/assets")).unwrap();
    assert!(
        !assets.as_path().exists() || fs::read_dir(assets.as_path()).unwrap().next().is_none(),
        "cancelled staging must not publish a partial asset"
    );
}

#[test]
fn interrupted_multi_asset_import_rolls_back_after_reopen() {
    let source = TempDir::new().unwrap();
    let inspected = two_entry_package(source.path());
    let vault = TempDir::new().unwrap();
    let area_path = Path::new("game/characters");
    let area_id = ObjectId::new();
    let root = test_vault(&vault, area_path, area_id, inspected.package.profile_ref);
    let interrupted = TransactionService::with_fault(InterruptAfterStep { completed_step: 1 });

    let result = AssetRepository.import_package_with_transactions(
        &root,
        area_path,
        area_id,
        &inspected,
        &[],
        &interrupted,
    );
    assert!(matches!(
        result,
        Err(
            pixel_cutout_sprite_studio_lib::asset_io::AssetRepositoryError::Storage(
                StorageError::TransactionInterrupted { step: 1 }
            )
        )
    ));

    let reopened = VaultRoot::open(vault.path()).unwrap();
    let candidates = TransactionService::<NoTransactionFault>::scan_open(&reopened).unwrap();
    assert_eq!(candidates.len(), 1);
    let candidate = &candidates[0];
    assert_eq!(candidate.purpose, TransactionPurpose::AssetImport);
    assert_eq!(candidate.total_steps, 2);
    assert!(candidate.can_resume);
    assert!(candidate.can_rollback);
    let transaction_id = candidate.transaction_id;
    let recovered = TransactionService::<NoTransactionFault>::default()
        .recover_candidate(&reopened, transaction_id, RecoveryChoice::Rollback)
        .unwrap();
    assert_eq!(recovered.state, TransactionState::RolledBack);
    assert!(
        TransactionService::<NoTransactionFault>::scan_open(&reopened)
            .unwrap()
            .is_empty()
    );
    assert_eq!(ObjectIndex::rebuild(&reopened).unwrap().len(), 3);
    let assets = vault.path().join(area_path).join(".area/assets");
    assert!(
        !assets.exists() || fs::read_dir(assets).unwrap().next().is_none(),
        "rollback must not leave a published asset behind"
    );
    assert!(!vault
        .path()
        .join("game/.project/transactions")
        .join(format!("{transaction_id}.stage"))
        .exists());
}

#[test]
fn sheet_rectangles_create_a_derived_crop_and_retain_the_original_sheet() {
    let source = TempDir::new().unwrap();
    let png = source.path().join("sheet.png");
    write_rgba(&png, 4, 4);
    let original = fs::read(&png).unwrap();
    let mut package_entry = entry("sheet.png");
    package_entry.sheet_rect_px = Some(SheetRect(1, 1, 2, 2));
    let package_path = write_package(source.path(), &package(vec![package_entry]));
    let inspected = PngImporter::default()
        .inspect_package(&package_path, &allowed())
        .unwrap();
    let vault = TempDir::new().unwrap();
    let area_id = ObjectId::new();
    let root = test_vault(
        &vault,
        Path::new("game/area"),
        area_id,
        inspected.package.profile_ref,
    );
    let imported = AssetRepository
        .import_package(&root, Path::new("game/area"), area_id, &inspected, &[])
        .unwrap();
    assert_eq!(imported[0].revision.image_size_px, PixelSize(2, 2));
    let source_file = root
        .resolve(&Path::new("game/area").join(imported[0].revision.source_file.as_str()))
        .unwrap();
    assert_eq!(image::open(source_file.as_path()).unwrap().width(), 2);
    let original_file = source_file.as_path().with_file_name("original.png");
    assert_eq!(fs::read(original_file).unwrap(), original);
}

#[test]
fn adding_a_revision_preserves_the_previous_release_and_updates_the_manifest() {
    let source = TempDir::new().unwrap();
    let png = source.path().join("hand_l__s__base.png");
    write_rgba(&png, 4, 4);
    let package_path = write_package(source.path(), &package(vec![entry("hand_l__s__base.png")]));
    let first_package = PngImporter::default()
        .inspect_package(&package_path, &allowed())
        .unwrap();
    let vault = TempDir::new().unwrap();
    let area_path = Path::new("game/characters");
    let area_id = ObjectId::new();
    let root = test_vault(
        &vault,
        area_path,
        area_id,
        first_package.package.profile_ref,
    );
    let first = AssetRepository
        .import_package(&root, area_path, area_id, &first_package, &[])
        .unwrap()
        .remove(0);
    let first_source = root
        .resolve(&area_path.join(first.revision.source_file.as_str()))
        .unwrap();
    let first_bytes = fs::read(first_source.as_path()).unwrap();
    let revision_path = Path::new(first.revision.source_file.as_str());
    let asset_folder = revision_path
        .parent()
        .and_then(Path::parent)
        .and_then(Path::file_name)
        .unwrap()
        .to_owned();

    RgbaImage::from_pixel(4, 4, Rgba([20, 40, 60, 200]))
        .save(&png)
        .unwrap();
    let second_package = PngImporter::default()
        .inspect_package(&package_path, &allowed())
        .unwrap();
    let second = AssetRepository
        .add_revision(
            &root,
            area_path,
            Path::new(&asset_folder),
            &second_package,
            0,
            &[],
        )
        .unwrap();

    assert_eq!(second.asset.id, first.asset.id);
    assert_eq!(second.revision.revision, 2);
    assert_eq!(fs::read(first_source.as_path()).unwrap(), first_bytes);
    let second_source = root
        .resolve(&area_path.join(second.revision.source_file.as_str()))
        .unwrap();
    assert_ne!(fs::read(second_source.as_path()).unwrap(), first_bytes);
    let manifest = root
        .resolve(
            &area_path
                .join(".area/assets")
                .join(&asset_folder)
                .join("asset.json"),
        )
        .unwrap();
    let loaded = JsonStore::default().load(&manifest).unwrap();
    let DomainDocument::Asset(saved) = loaded.value else {
        panic!("asset manifest expected");
    };
    assert_eq!(saved.released_revisions, vec![1, 2]);
}

#[test]
fn invalid_dimensions_rectangles_size_and_alpha_are_rejected() {
    let source = TempDir::new().unwrap();
    let rgba = source.path().join("part.png");
    write_rgba(&rgba, 4, 4);
    let mut wrong_dimensions = entry("part.png");
    wrong_dimensions.image_size_px = PixelSize(3, 4);
    let path = write_package(source.path(), &package(vec![wrong_dimensions]));
    assert!(matches!(
        PngImporter::default().inspect_package(&path, &allowed()),
        Err(AssetImportError::InvalidEntry { .. })
    ));

    let mut outside = entry("part.png");
    outside.sheet_rect_px = Some(SheetRect(3, 3, 2, 2));
    let path = write_package(source.path(), &package(vec![outside]));
    assert!(PngImporter::default()
        .inspect_package(&path, &allowed())
        .is_err());

    let tiny_limit = PngImporter::with_limits(ImportLimits {
        maximum_file_bytes: 8,
        maximum_axis_px: 4096,
        maximum_decoded_pixels: 1024,
    });
    assert!(tiny_limit.inspect_package(&path, &allowed()).is_err());

    let rgb = source.path().join("rgb.png");
    RgbImage::from_pixel(4, 4, Rgb([1, 2, 3]))
        .save(&rgb)
        .unwrap();
    let path = write_package(source.path(), &package(vec![entry("rgb.png")]));
    assert!(PngImporter::default()
        .inspect_package(&path, &allowed())
        .is_err());
}

#[test]
fn final_importer_snapshot_enforces_aggregate_budgets_and_entry_count() {
    let source = TempDir::new().unwrap();
    write_rgba(&source.path().join("first.png"), 4, 4);
    write_rgba(&source.path().join("second.png"), 4, 4);
    let mut first = entry("first.png");
    first.name = "First image".to_owned();
    let mut second = entry("second.png");
    second.name = "Second image".to_owned();
    let package_path = write_package(source.path(), &package(vec![first, second]));
    let one_encoded = fs::metadata(source.path().join("first.png")).unwrap().len();
    let encoded_error = PngImporter::default()
        .with_aggregate_limits(one_encoded * 2 - 1, u64::MAX)
        .inspect_package(&package_path, &allowed())
        .unwrap_err();
    assert!(matches!(
        encoded_error,
        AssetImportError::InvalidPackage(message)
            if message.contains("aggregate encoded PNG data budget")
    ));
    let importer = PngImporter::default().with_aggregate_limits(u64::MAX, 127);
    let error = importer
        .inspect_package(&package_path, &allowed())
        .unwrap_err();
    assert!(matches!(
        error,
        AssetImportError::InvalidPackage(message)
            if message.contains("aggregate decoded RGBA data budget")
    ));

    let too_many = write_package(
        source.path(),
        &package((0..65).map(|_| entry("first.png")).collect()),
    );
    let error = PngImporter::default()
        .with_maximum_entries(64)
        .inspect_package(&too_many, &allowed())
        .unwrap_err();
    assert!(matches!(
        error,
        AssetImportError::InvalidPackage(message) if message.contains("1..=64")
    ));
}

#[test]
fn traversal_and_ambiguous_filenames_never_become_silent_assignments() {
    let source = TempDir::new().unwrap();
    let path = write_package(source.path(), &package(vec![entry("../outside.png")]));
    assert!(PngImporter::default()
        .inspect_package(&path, &allowed())
        .is_err());
    assert!(filename_suggestion("hand_l__s.png", &allowed()).is_none());
    assert!(filename_suggestion("unknown__s__base.png", &allowed()).is_none());
    assert!(filename_suggestion("hand_l__side__base.png", &allowed()).is_none());
}

#[test]
fn committed_package_fixtures_cover_a_valid_import_and_a_traversal_counterexample() {
    let source = TempDir::new().unwrap();
    let png = source.path().join("hand_l__s__base.png");
    write_rgba(&png, 4, 4);
    let valid = source.path().join("valid-package.json");
    fs::write(&valid, include_bytes!("fixtures/import/valid-package.json")).unwrap();
    let inspected = PngImporter::default()
        .inspect_package(&valid, &allowed())
        .unwrap();
    assert_eq!(inspected.entries.len(), 1);

    let invalid = source.path().join("invalid-traversal.json");
    fs::write(
        &invalid,
        include_bytes!("fixtures/import/invalid-traversal.json"),
    )
    .unwrap();
    assert!(matches!(
        PngImporter::default().inspect_package(&invalid, &allowed()),
        Err(AssetImportError::InvalidEntry { .. })
    ));
}
