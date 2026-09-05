mod support;

use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::animation::PreviewCache;
use pixel_cutout_sprite_studio_lib::domain::{
    Direction, EffectiveSourceKind, PixelPoint, PixelSize, SlotId,
};
use pixel_cutout_sprite_studio_lib::exports::{motion_semantic_sha256, ExportService, NeverCancel};
use pixel_cutout_sprite_studio_lib::render::{
    PixelCompositor, RenderPart, RenderRequest, RenderTransform,
};
use pixel_cutout_sprite_studio_lib::storage::VaultRoot;
use tempfile::tempdir;

use support::{request, FixtureSource, OUTPUT_DIRECTORY};

const SAMPLE_COUNT: usize = 360;

#[test]
#[ignore = "hardware-specific P19 measurement; run explicitly with --nocapture"]
fn representative_raster_and_export_measurement() {
    let render_request = representative_render_request();
    assert_eq!(render_request.frame_size_px, PixelSize(128, 128));
    assert_eq!(render_request.parts.len(), 20);

    let compositor = PixelCompositor;
    let reference = compositor.render(&render_request).unwrap();
    let reference_pixels = reference.image.as_raw().clone();
    let mut raster_samples = Vec::with_capacity(SAMPLE_COUNT);
    for _ in 0..SAMPLE_COUNT {
        let started = Instant::now();
        let rendered = compositor.render(&render_request).unwrap();
        raster_samples.push(started.elapsed());
        assert_eq!(rendered.image.as_raw(), &reference_pixels);
    }

    let preview_cache = Mutex::new(PreviewCache::new(256 * 1024 * 1024));
    let cached_reference = reference.image.clone();
    PreviewCache::get_or_load_bitmap(
        &preview_cache,
        "p19-representative-frame".to_owned(),
        || Ok(cached_reference),
    )
    .unwrap();
    let mut cache_samples = Vec::with_capacity(SAMPLE_COUNT);
    for _ in 0..SAMPLE_COUNT {
        let started = Instant::now();
        let cached = PreviewCache::get_or_load_bitmap(
            &preview_cache,
            "p19-representative-frame".to_owned(),
            || panic!("warm representative cache entry must not reload"),
        )
        .unwrap();
        cache_samples.push(started.elapsed());
        assert_eq!(cached.as_raw(), &reference_pixels);
    }
    assert_eq!(preview_cache.lock().unwrap().used_bytes(), 128 * 128 * 4);

    let mut export_samples = Vec::with_capacity(7);
    let mut exported_frames = 0_usize;
    for iteration in 0..7 {
        let temporary = tempdir().unwrap();
        let service = ExportService::new(VaultRoot::open(temporary.path()).unwrap(), "0.1.0");
        let mut export_request = request(&[
            ("walk", PixelSize(128, 128), PixelPoint(64, 108)),
            ("sprint", PixelSize(128, 128), PixelPoint(64, 108)),
        ]);
        for action in &mut export_request.actions {
            action.motion.frame_count = 12;
        }
        let motion_hashes = export_request
            .actions
            .iter()
            .map(|action| {
                (
                    action.motion.reference(),
                    motion_semantic_sha256(&action.motion).unwrap(),
                )
            })
            .collect::<Vec<_>>();
        for source in &mut export_request.effective_sources {
            if source.kind == EffectiveSourceKind::Motion {
                source.content_sha256 = motion_hashes
                    .iter()
                    .find(|(reference, _)| reference == &source.reference)
                    .expect("each effective motion source belongs to an export action")
                    .1
                    .clone();
            }
        }
        export_request.profile.max_page_size_px =
            pixel_cutout_sprite_studio_lib::domain::AtlasSize(2048, 2048);
        export_request.profile.memory_budget_bytes = 256 * 1024 * 1024;

        let started = Instant::now();
        let outcome = service
            .export(
                Path::new(OUTPUT_DIRECTORY),
                &export_request,
                &mut FixtureSource::default(),
                &NeverCancel,
                &mut |_| {},
            )
            .unwrap();
        export_samples.push(started.elapsed());
        exported_frames = outcome.manifest.frames.len();
        assert!(
            !outcome.reused_existing_build,
            "iteration {iteration} is isolated"
        );
        assert!(outcome.manifest.complete);
    }

    println!(
        "P19_PERF raster_128x128_20_parts {} peak_rss_kib={}",
        summarize(&raster_samples),
        peak_rss_kib().map_or_else(|| "unavailable".to_owned(), |value| value.to_string())
    );
    println!("P19_PERF cache_128x128_rgba {}", summarize(&cache_samples));
    println!(
        "P19_PERF export_2_actions_8_directions_12_frames frames={} {}",
        exported_frames,
        summarize(&export_samples)
    );
}

fn representative_render_request() -> RenderRequest {
    let transparent = Rgba([0, 0, 0, 0]);
    let slots = [
        ("torso_lower", None, -8.0, -42.0, 0.0),
        ("torso_upper", Some("torso_lower"), 0.0, -16.0, -2.0),
        ("head", Some("torso_upper"), 0.0, -15.0, 1.0),
        ("hair", Some("head"), 0.0, -5.0, -1.0),
        ("upper_arm_l", Some("torso_upper"), -7.0, 1.0, -18.0),
        ("forearm_l", Some("upper_arm_l"), 0.0, 8.0, 13.0),
        ("hand_l", Some("forearm_l"), 0.0, 7.0, 4.0),
        ("upper_arm_r", Some("torso_upper"), 9.0, 1.0, 18.0),
        ("forearm_r", Some("upper_arm_r"), 0.0, 8.0, -13.0),
        ("hand_r", Some("forearm_r"), 0.0, 7.0, -4.0),
        ("thigh_l", Some("torso_lower"), 1.0, 8.0, 6.0),
        ("shin_l", Some("thigh_l"), 0.0, 10.0, -3.0),
        ("foot_l", Some("shin_l"), -2.0, 9.0, 0.0),
        ("thigh_r", Some("torso_lower"), 8.0, 8.0, -6.0),
        ("shin_r", Some("thigh_r"), 0.0, 10.0, 3.0),
        ("foot_r", Some("shin_r"), 0.0, 9.0, 0.0),
        ("equipment_hat", Some("head"), 0.0, -4.0, 0.0),
        ("equipment_glove", Some("hand_l"), 0.0, 0.0, 0.0),
        ("equipment_shield", Some("forearm_r"), 4.0, 1.0, -8.0),
        ("equipment_belt", Some("torso_lower"), 0.0, 1.0, 0.0),
    ];
    let parts = slots
        .iter()
        .enumerate()
        .map(|(index, (id, parent, x, y, rotation))| {
            let mut bitmap = RgbaImage::from_pixel(9, 9, transparent);
            let color = Rgba([
                35_u8.saturating_add((index as u8).saturating_mul(9)),
                210_u8.saturating_sub((index as u8).saturating_mul(6)),
                80_u8.saturating_add((index as u8).saturating_mul(5)),
                220,
            ]);
            for pixel_y in 1..8 {
                for pixel_x in 1..8 {
                    bitmap.put_pixel(pixel_x, pixel_y, color);
                }
            }
            RenderPart {
                slot_id: slot(id),
                parent_id: parent.map(slot),
                profile: RenderTransform::new(*x, *y, *rotation).unwrap(),
                motion: RenderTransform::new(0.25, -0.25, (index % 3) as f64).unwrap(),
                fitting: RenderTransform::IDENTITY,
                local_override: RenderTransform::IDENTITY,
                pivot_px: (4.0, 4.0),
                visible: true,
                layer: index as i32,
                mirror_bitmap_x: false,
                bitmap: bitmap.into(),
            }
        })
        .collect();
    RenderRequest {
        direction: Direction::S,
        frame_size_px: PixelSize(128, 128),
        ground_origin_px: PixelPoint(64, 108),
        parts,
    }
}

fn summarize(samples: &[Duration]) -> String {
    let mut micros = samples
        .iter()
        .map(|duration| duration.as_secs_f64() * 1_000.0)
        .collect::<Vec<_>>();
    micros.sort_by(f64::total_cmp);
    format!(
        "samples={} p50_ms={:.3} p95_ms={:.3} max_ms={:.3}",
        micros.len(),
        percentile(&micros, 0.50),
        percentile(&micros, 0.95),
        *micros.last().unwrap_or(&0.0)
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

fn slot(value: &str) -> SlotId {
    SlotId::parse(value).unwrap()
}

#[test]
fn percentile_uses_nearest_rank_without_hiding_tail_latency() {
    let sorted = [1.0, 2.0, 3.0, 4.0, 100.0];
    assert_eq!(percentile(&sorted, 0.50), 3.0);
    assert_eq!(percentile(&sorted, 0.95), 100.0);
    assert_eq!(percentile(&[], 0.95), 0.0);
}
