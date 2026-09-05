use std::collections::HashSet;
use std::fs;
use std::path::Path;

use image::{Rgb, RgbImage, Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::asset_io::{
    filename_suggestion, AssetImportError, AssetPackage, AssetRepository, ImportLimits,
    PackageEntry, PngImporter, SheetRect, ASSET_PACKAGE_FORMAT,
};
use pixel_cutout_sprite_studio_lib::domain::{
    AssetKind, Direction, DomainDocument, ObjectId, PixelPoint, PixelSize, RevisionRef, SlotId,
};
use pixel_cutout_sprite_studio_lib::storage::{JsonStore, ObjectIndex, VaultRoot};
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
    fs::create_dir_all(vault.path().join("game/characters/.area")).unwrap();
    let root = VaultRoot::open(vault.path()).unwrap();
    let area_id = ObjectId::new();
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
    assert_eq!(ObjectIndex::rebuild(&root).unwrap().len(), 2);
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
    fs::create_dir_all(vault.path().join("game/area/.area")).unwrap();
    let root = VaultRoot::open(vault.path()).unwrap();
    let imported = AssetRepository
        .import_package(
            &root,
            Path::new("game/area"),
            ObjectId::new(),
            &inspected,
            &[],
        )
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
    fs::create_dir_all(vault.path().join(area_path).join(".area")).unwrap();
    let root = VaultRoot::open(vault.path()).unwrap();
    let first = AssetRepository
        .import_package(&root, area_path, ObjectId::new(), &first_package, &[])
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
