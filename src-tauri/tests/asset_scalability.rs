use std::collections::HashSet;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::application::{
    AreaDetails, AreaService, AssetImportJobRegistry, AssetInventoryQuery, AssetInventorySort,
    AssetService, AssetServiceError, ConfirmAssetImportRequest, CreateAreaRequest, ProjectQuery,
    ProjectService, VaultService,
};
use pixel_cutout_sprite_studio_lib::asset_io::AssetRepositoryError;
use pixel_cutout_sprite_studio_lib::asset_io::{ImportDecision, SizeHandling};
use pixel_cutout_sprite_studio_lib::domain::{
    Asset, AssetKind, AssetRevision, Direction, DocumentKind, DomainDocument, ObjectId, ObjectType,
    PixelPoint, PixelSize, RelativePath, Sha256Digest, SlotId, UtcTimestamp, SCHEMA_VERSION,
};
use pixel_cutout_sprite_studio_lib::exports::CancellationFlag;
use pixel_cutout_sprite_studio_lib::storage::{object_folder, JsonStore, VaultRoot};
use sha2::{Digest, Sha256};
use tempfile::TempDir;

const PROJECT_COUNT: usize = 100;
const ASSET_COUNT: usize = 1_000;
const PAGE_SIZE: usize = 100;
const VISIBLE_THUMBNAILS: usize = 16;

struct LargeFixture {
    temp: TempDir,
    vaults: VaultService,
    session_id: ObjectId,
    area: AreaDetails,
    area_folder: PathBuf,
}

impl LargeFixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let mut vaults = VaultService::default();
        let opened = vaults.initialize(temp.path(), None).unwrap();
        let project = ProjectService::create(
            &mut vaults,
            opened.session_id,
            "Scale Project 000".to_owned(),
            Vec::new(),
        )
        .unwrap();
        let area = AreaService::create(
            &vaults,
            opened.session_id,
            CreateAreaRequest {
                project_id: project.id,
                name: "Large Inventory".to_owned(),
                object_type: ObjectType::Humanoid,
                reference_height_px: 80,
                default_frame_size_px: None,
                default_ground_origin_px: None,
                label_ids: Vec::new(),
            },
        )
        .unwrap();
        for index in 1..PROJECT_COUNT {
            ProjectService::create(
                &mut vaults,
                opened.session_id,
                format!("Scale Project {index:03}"),
                Vec::new(),
            )
            .unwrap();
        }
        let area_folder = object_folder(&project.name, project.id)
            .unwrap()
            .join(object_folder(&area.area.name, area.area.id).unwrap());
        let fixture = Self {
            temp,
            vaults,
            session_id: opened.session_id,
            area,
            area_folder,
        };
        fixture.install_assets();
        fixture
    }

    fn install_assets(&self) {
        let root = VaultRoot::open(self.temp.path()).unwrap();
        let png = one_pixel_png();
        let content_hash = Sha256Digest::parse(format!("{:x}", Sha256::digest(&png))).unwrap();
        let timestamp = UtcTimestamp::parse("2026-09-05T11:05:00Z").unwrap();
        for index in 0..ASSET_COUNT {
            let id = ObjectId::new();
            let name = format!("Asset {index:04}");
            let folder = object_folder(&name, id).unwrap();
            let base = self.area_folder.join(".area/assets").join(&folder);
            let revision_directory = base.join("r0001");
            root.ensure_directory(&revision_directory).unwrap();
            fs::write(
                root.resolve(&revision_directory.join("source.png"))
                    .unwrap()
                    .as_path(),
                &png,
            )
            .unwrap();
            let asset = Asset {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Asset,
                id,
                revision: 1,
                area_id: self.area.area.id,
                name,
                original_name: format!("asset-{index:04}.png"),
                asset_kind: AssetKind::Body,
                label_ids: Vec::new(),
                released_revisions: vec![1],
                origin_note: "Generated scale fixture".to_owned(),
                license_note: "CC0 test fixture".to_owned(),
                archived: false,
                created_at: timestamp,
                updated_at: timestamp,
            };
            let revision = AssetRevision {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::AssetRevision,
                asset_id: id,
                revision: 1,
                profile_ref: self.area.profile.reference(),
                slot_id: SlotId::parse("head").unwrap(),
                direction: Direction::S,
                variant: "base".to_owned(),
                source_file: RelativePath::parse(
                    Path::new(".area/assets")
                        .join(folder)
                        .join("r0001/source.png")
                        .to_string_lossy()
                        .replace('\\', "/"),
                )
                .unwrap(),
                image_size_px: PixelSize(1, 1),
                pivot_px: PixelPoint(0, 1),
                content_hash: content_hash.clone(),
                sprite_mirroring_allowed: false,
                published_at: timestamp,
            };
            JsonStore::default()
                .create(
                    &root.resolve(&base.join("asset.json")).unwrap(),
                    &DomainDocument::Asset(asset),
                )
                .unwrap();
            JsonStore::default()
                .create(
                    &root
                        .resolve(&revision_directory.join("revision.json"))
                        .unwrap(),
                    &DomainDocument::AssetRevision(revision),
                )
                .unwrap();
        }
    }
}

#[test]
fn thousand_asset_inventory_is_deterministic_paged_and_metadata_only() {
    let fixture = LargeFixture::new();
    assert_eq!(count_projects(fixture.temp.path()), PROJECT_COUNT);

    let mut cursor = None;
    let mut ids = HashSet::new();
    let mut names = Vec::new();
    let mut first_page = None;
    let mut pages = 0;
    loop {
        let page = AssetService::inventory_page(
            &fixture.vaults,
            fixture.session_id,
            fixture.area.area.id,
            cursor.as_deref(),
            Some(PAGE_SIZE),
        )
        .unwrap();
        assert_eq!(page.total_items, ASSET_COUNT);
        assert!(page.items.len() <= PAGE_SIZE);
        let encoded = serde_json::to_string(&page).unwrap();
        assert!(!encoded.contains("data:image"));
        assert!(!encoded.contains("thumbnail_url"));
        if first_page.is_none() {
            first_page = Some(page.clone());
        }
        for item in &page.items {
            assert!(ids.insert(item.id));
            names.push(item.name.clone());
        }
        pages += 1;
        cursor = page.next_cursor;
        if cursor.is_none() {
            break;
        }
    }
    assert_eq!(ids.len(), ASSET_COUNT);
    assert_eq!(
        names,
        (0..ASSET_COUNT)
            .map(|index| format!("Asset {index:04}"))
            .collect::<Vec<_>>()
    );
    assert_eq!(pages, ASSET_COUNT / PAGE_SIZE);

    let first_page = first_page.unwrap();
    let repeated = AssetService::inventory_page(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        None,
        Some(PAGE_SIZE),
    )
    .unwrap();
    assert_eq!(first_page.items, repeated.items);
    for item in first_page.items.iter().take(VISIBLE_THUMBNAILS) {
        let thumbnail = AssetService::thumbnail(
            &fixture.vaults,
            fixture.session_id,
            fixture.area.area.id,
            item.id,
            item.released_revision,
            Some(48),
        )
        .unwrap();
        assert!(thumbnail.width_px <= 48 && thumbnail.height_px <= 48);
        assert!(thumbnail.data_url.starts_with("data:image/png;base64,"));
    }
    assert!(AssetService::thumbnail(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        first_page.items[0].id,
        1,
        Some(49),
    )
    .is_err());

    let searched = AssetService::inventory_page_query(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        &AssetInventoryQuery {
            search: "Asset 0999".to_owned(),
            ..AssetInventoryQuery::default()
        },
        None,
        Some(10),
    )
    .unwrap();
    assert_eq!(searched.total_items, 1);
    assert_eq!(searched.items[0].name, "Asset 0999");
    assert_eq!(
        searched.facets.slot_ids,
        vec![SlotId::parse("head").unwrap()]
    );
    assert!(searched.facets.has_unused);

    let descending_query = AssetInventoryQuery {
        search: "Asset 09".to_owned(),
        sort: AssetInventorySort::NameDesc,
        ..AssetInventoryQuery::default()
    };
    let descending = AssetService::inventory_page_query(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        &descending_query,
        None,
        Some(10),
    )
    .unwrap();
    assert_eq!(descending.items[0].name, "Asset 0999");
    let cursor = descending.next_cursor.as_deref().unwrap();
    let mismatched = AssetService::inventory_page_query(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        &AssetInventoryQuery {
            search: "Asset 08".to_owned(),
            sort: AssetInventorySort::NameDesc,
            ..AssetInventoryQuery::default()
        },
        Some(cursor),
        Some(10),
    )
    .unwrap_err();
    assert!(mismatched.to_string().contains("different filters"));

    println!(
        "P19_OPS projects={PROJECT_COUNT} assets={ASSET_COUNT} pages={pages} metadata_rows={} thumbnail_requests={VISIBLE_THUMBNAILS}",
        names.len()
    );
}

#[test]
fn import_job_rejects_a_batch_that_would_retain_hundreds_of_decodes() {
    let fixture = LargeFixture::new();
    let source = TempDir::new().unwrap();
    let png = source.path().join("head__s__base.png");
    fs::write(&png, one_pixel_png()).unwrap();
    let paths = (0..65)
        .map(|_| png.to_string_lossy().into_owned())
        .collect();
    let error = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        paths,
    )
    .unwrap_err();
    assert!(error.to_string().contains("between 1 and 64"));
}

#[test]
#[ignore = "creates a retained P19 vault for an explicit native WebView walkthrough"]
fn generate_native_walkthrough_fixture() {
    let mut fixture = LargeFixture::new();
    ProjectService::save_view(
        &fixture.vaults,
        fixture.session_id,
        ProjectQuery {
            search: "Scale Project 000".to_owned(),
            ..ProjectQuery::default()
        },
    )
    .unwrap();
    fixture.vaults.close(fixture.session_id).unwrap();
    let path = fixture.temp.keep();
    assert_eq!(count_projects(&path), PROJECT_COUNT);
    println!("P19_FIXTURE path={}", path.display());
}

#[test]
#[ignore = "hardware-specific P19 inventory/import measurement; run explicitly with --nocapture"]
fn inventory_and_import_cancellation_measurement() {
    let mut fixture = LargeFixture::new();
    fixture.vaults.close(fixture.session_id).unwrap();

    let mut open_samples = Vec::new();
    for _ in 0..7 {
        let mut vaults = VaultService::default();
        let started = Instant::now();
        let opened = vaults.open(fixture.temp.path()).unwrap();
        open_samples.push(started.elapsed());
        vaults.close(opened.session_id).unwrap();
    }

    let opened = fixture.vaults.open(fixture.temp.path()).unwrap();
    fixture.session_id = opened.session_id;
    let mut inventory_samples = Vec::new();
    let mut retained_page = None;
    for _ in 0..7 {
        let started = Instant::now();
        retained_page = Some(walk_all_pages(&fixture));
        inventory_samples.push(started.elapsed());
    }
    let page = retained_page.unwrap();
    let mut thumbnail_samples = Vec::new();
    for item in page.items.iter().take(VISIBLE_THUMBNAILS) {
        let started = Instant::now();
        AssetService::thumbnail(
            &fixture.vaults,
            fixture.session_id,
            fixture.area.area.id,
            item.id,
            item.released_revision,
            Some(48),
        )
        .unwrap();
        thumbnail_samples.push(started.elapsed());
    }

    let import_source = TempDir::new().unwrap();
    let import_png = import_source.path().join("head__s__base.png");
    fs::write(&import_png, one_pixel_png()).unwrap();
    let cancelled_inspection = AssetService::inspect_sources(
        &fixture.vaults,
        fixture.session_id,
        fixture.area.area.id,
        vec![import_png.to_string_lossy().into_owned()],
    )
    .unwrap();
    let request = ConfirmAssetImportRequest {
        area_id: fixture.area.area.id,
        inspection_fingerprint: cancelled_inspection.inspection_fingerprint,
        source: cancelled_inspection.source,
        decisions: Vec::new(),
    };
    let root = VaultRoot::open(fixture.temp.path()).unwrap();
    let mut successful_import_samples = Vec::new();
    let mut successful_import_refresh_samples = Vec::new();
    for batch in 0..7 {
        let paths = (0..4)
            .map(|entry| {
                let path = import_source
                    .path()
                    .join(format!("head__s__perf_{batch:02}_{entry:02}.png"));
                fs::write(&path, colored_pixel_png((batch * 4 + entry) as u8)).unwrap();
                path.to_string_lossy().into_owned()
            })
            .collect::<Vec<_>>();
        let inspection = AssetService::inspect_sources(
            &fixture.vaults,
            fixture.session_id,
            fixture.area.area.id,
            paths,
        )
        .unwrap();
        let decisions = inspection
            .entries
            .iter()
            .map(|entry| ImportDecision {
                entry_index: entry.entry_index,
                slot_id: entry.suggested_slot_id.clone().unwrap(),
                direction: entry.suggested_direction.unwrap(),
                size_handling: SizeHandling::KeepOriginal,
            })
            .collect();
        let request = ConfirmAssetImportRequest {
            area_id: fixture.area.area.id,
            inspection_fingerprint: inspection.inspection_fingerprint,
            source: inspection.source,
            decisions,
        };
        let started = Instant::now();
        let worker_started = Instant::now();
        let imported = AssetService::execute_import_job(
            &root,
            request,
            &CancellationFlag::default(),
            &mut |_| {},
        )
        .unwrap();
        successful_import_samples.push(worker_started.elapsed());
        assert_eq!(imported.len(), 4);
        fixture.vaults.close(fixture.session_id).unwrap();
        let reopened = fixture.vaults.open(fixture.temp.path()).unwrap();
        fixture.session_id = reopened.session_id;
        successful_import_refresh_samples.push(started.elapsed());
    }

    let mut cancel_samples = Vec::new();
    for _ in 0..15 {
        let registry = AssetImportJobRegistry::default();
        let (job, cancellation) = registry
            .register(fixture.session_id, fixture.area.area.id)
            .unwrap();
        registry.cancel(fixture.session_id, job.job_id).unwrap();
        let started = Instant::now();
        let error =
            AssetService::execute_import_job(&root, request.clone(), &cancellation, &mut |_| {})
                .unwrap_err();
        cancel_samples.push(started.elapsed());
        assert!(matches!(
            error,
            AssetServiceError::Repository(AssetRepositoryError::Cancelled)
                | AssetServiceError::Import(
                    pixel_cutout_sprite_studio_lib::asset_io::AssetImportError::Cancelled
                )
        ));
    }

    let peak = peak_rss_kib().map_or_else(|| "unavailable".to_owned(), |value| value.to_string());
    println!(
        "P19_PERF vault_open {} peak_rss_kib={peak}",
        summarize(&open_samples)
    );
    println!(
        "P19_PERF paged_inventory_1000_assets {} peak_rss_kib={peak}",
        summarize(&inventory_samples)
    );
    println!(
        "P19_PERF thumbnail_max_edge_48 {} peak_rss_kib={peak}",
        summarize(&thumbnail_samples)
    );
    println!(
        "P19_PERF successful_import_worker_batch_4 {} peak_rss_kib={peak}",
        summarize(&successful_import_samples)
    );
    println!(
        "P19_PERF successful_import_batch_4_with_index_reopen {} peak_rss_kib={peak}",
        summarize(&successful_import_refresh_samples)
    );
    println!(
        "P19_PERF import_cancellation {} peak_rss_kib={peak}",
        summarize(&cancel_samples)
    );
}

fn walk_all_pages(
    fixture: &LargeFixture,
) -> pixel_cutout_sprite_studio_lib::application::AssetInventoryPage {
    let mut cursor = None;
    let mut first = None;
    let mut count = 0;
    loop {
        let page = AssetService::inventory_page(
            &fixture.vaults,
            fixture.session_id,
            fixture.area.area.id,
            cursor.as_deref(),
            Some(PAGE_SIZE),
        )
        .unwrap();
        count += page.items.len();
        if first.is_none() {
            first = Some(page.clone());
        }
        cursor = page.next_cursor;
        if cursor.is_none() {
            break;
        }
    }
    assert_eq!(count, ASSET_COUNT);
    first.unwrap()
}

fn one_pixel_png() -> Vec<u8> {
    let image = RgbaImage::from_pixel(1, 1, Rgba([20, 80, 160, 255]));
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .unwrap();
    output.into_inner()
}

fn colored_pixel_png(seed: u8) -> Vec<u8> {
    let image = RgbaImage::from_pixel(
        1,
        1,
        Rgba([
            seed.wrapping_mul(17),
            seed.wrapping_mul(37),
            seed.wrapping_mul(67),
            255,
        ]),
    );
    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .unwrap();
    output.into_inner()
}

fn count_projects(root: &Path) -> usize {
    fs::read_dir(root)
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().join(".project/project.json").is_file())
        .count()
}

fn summarize(samples: &[Duration]) -> String {
    let mut milliseconds = samples
        .iter()
        .map(|duration| duration.as_secs_f64() * 1_000.0)
        .collect::<Vec<_>>();
    milliseconds.sort_by(f64::total_cmp);
    format!(
        "samples={} p50_ms={:.3} p95_ms={:.3} max_ms={:.3}",
        milliseconds.len(),
        percentile(&milliseconds, 0.50),
        percentile(&milliseconds, 0.95),
        *milliseconds.last().unwrap_or(&0.0)
    )
}

fn percentile(sorted: &[f64], quantile: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let index = ((sorted.len() - 1) as f64 * quantile).ceil() as usize;
    sorted[index]
}

fn peak_rss_kib() -> Option<u64> {
    let status = fs::read_to_string("/proc/self/status").ok()?;
    status.lines().find_map(|line| {
        let value = line.strip_prefix("VmHWM:")?.trim();
        value.split_whitespace().next()?.parse().ok()
    })
}
