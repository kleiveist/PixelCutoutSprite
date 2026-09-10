use super::segmentation::*;
use super::{Mask, Runs};
use image::{Rgba, RgbaImage};
use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    Arc,
};
use std::time::{Duration, Instant};

fn runs(width: u32, height: u32, predicate: impl Fn(u32, u32) -> bool) -> Runs {
    let mut runs: Runs = Vec::new();
    for y in 0..height {
        for x in 0..width {
            if predicate(x, y) {
                let index = y * width + x;
                if let Some(last) = runs.last_mut() {
                    if last[0] + last[1] == index {
                        last[1] += 1;
                        continue;
                    }
                }
                runs.push([index, 1]);
            }
        }
    }
    runs
}
fn execute(image: &RgbaImage, mask: &Mask) -> RefineResult {
    refine(
        image,
        mask,
        SelectionParameters::default(),
        &RefineControl {
            cancelled: &AtomicBool::new(false),
            progress: &AtomicU8::new(0),
        },
    )
    .unwrap()
}
fn full_roi(width: u32, height: u32) -> Mask {
    Mask {
        roi: vec![[0, width * height]],
        draft: vec![[0, width * height]],
        ..Mask::default()
    }
}

#[test]
fn transparent_outer_contour_keeps_thin_lines_and_semitransparent_pixels_exactly() {
    let image = RgbaImage::from_fn(17, 13, |x, y| {
        Rgba([
            40,
            100,
            180,
            if (3..13).contains(&x) && (2..11).contains(&y) {
                255
            } else if x == 8 {
                31
            } else {
                0
            },
        ])
    });
    let expected = runs(17, 13, |x, y| image.get_pixel(x, y)[3] > 0);
    let result = execute(&image, &full_roi(17, 13));
    assert_eq!(result.draft, Some(expected));
    assert!(!result.uncertain);
    println!(
        "P39 transparent/thin/semi-alpha fixture: exact match, {} pixels, {} ms",
        result.selected_pixels, result.elapsed_ms
    );
}

#[test]
fn ambiguous_islands_require_a_seed_instead_of_selecting_an_arbitrary_component() {
    let image = RgbaImage::from_fn(17, 13, |x, y| {
        Rgba([
            40,
            100,
            180,
            if (2..5).contains(&x) && (2..6).contains(&y)
                || (10..15).contains(&x) && (5..11).contains(&y)
            {
                255
            } else {
                0
            },
        ])
    });
    let mut mask = full_roi(17, 13);
    let result = execute(&image, &mask);
    assert!(result.draft.is_none());
    assert!(result.advice.contains("Mehrere sichtbare Inseln"));
    mask.positive = vec![[3 * 17 + 3, 1]];
    let seeded = execute(&image, &mask);
    assert_eq!(
        seeded.draft,
        Some(runs(17, 13, |x, y| (2..5).contains(&x) && (2..6).contains(&y)))
    );
}

#[test]
fn opaque_background_uses_positive_negative_color_seeds_without_leaking_outside_roi() {
    let image = RgbaImage::from_fn(37, 29, |x, y| {
        if (5..29).contains(&x) && (3..25).contains(&y) {
            Rgba([40, 90, 170, 255])
        } else {
            Rgba([235, 235, 235, 255])
        }
    });
    let mut mask = full_roi(37, 29);
    mask.positive = vec![[12 * 37 + 15, 1]];
    mask.negative = vec![[0, 1]];
    let result = execute(&image, &mask);
    assert_eq!(
        result.draft,
        Some(runs(37, 29, |x, y| (5..29).contains(&x) && (3..25).contains(&y)))
    );
    assert!(!result.uncertain);
    println!(
        "P39 opaque-background fixture: exact match, {} pixels, {} ms",
        result.selected_pixels, result.elapsed_ms
    );
    mask.roi = runs(37, 29, |x, y| (8..20).contains(&x) && (8..20).contains(&y));
    let limited = execute(&image, &mask);
    assert_eq!(limited.draft, Some(mask.roi));
}

#[test]
fn touching_same_color_parts_have_a_deterministic_seed_boundary_and_an_honest_warning() {
    let image = RgbaImage::from_pixel(19, 9, Rgba([90, 130, 170, 255]));
    let mut mask = full_roi(19, 9);
    let unseeded = execute(&image, &mask);
    assert!(unseeded.uncertain);
    mask.positive = vec![[4 * 19 + 3, 1]];
    mask.negative = vec![[4 * 19 + 15, 1]];
    let first = execute(&image, &mask);
    let second = execute(&image, &mask);
    assert_eq!(first.draft, second.draft);
    assert!(first.uncertain);
    assert_eq!(first.draft, Some(runs(19, 9, |x, _| x < 9)));
    // A deliberate connector beyond the automatic midpoint survives the next pass.
    mask.protected = runs(19, 9, |x, y| (8..12).contains(&x) && (3..6).contains(&y));
    let protected = execute(&image, &mask);
    assert_eq!(
        protected.draft,
        Some(runs(19, 9, |x, y| x < 9
            || (8..12).contains(&x) && (3..6).contains(&y)))
    );
}

#[test]
fn multicolored_part_accepts_multiple_seed_colors_and_excludes_the_background() {
    let image = RgbaImage::from_fn(21, 17, |x, y| {
        if (4..17).contains(&x) && (2..15).contains(&y) {
            if x < 10 {
                Rgba([220, 45, 60, 255])
            } else {
                Rgba([30, 80, 230, 255])
            }
        } else {
            Rgba([240, 240, 240, 255])
        }
    });
    let mut mask = full_roi(21, 17);
    mask.positive = vec![[8 * 21 + 7, 1], [8 * 21 + 13, 1]];
    mask.negative = vec![[0, 1]];
    let result = execute(&image, &mask);
    assert_eq!(
        result.draft,
        Some(runs(21, 17, |x, y| (4..17).contains(&x) && (2..15).contains(&y)))
    );
    println!(
        "P39 multicolor fixture: exact match, {} pixels, {} ms",
        result.selected_pixels, result.elapsed_ms
    );
}

#[test]
fn protected_overlaps_survive_outside_roi_but_not_invisible_or_hard_negative_pixels() {
    let image = RgbaImage::from_fn(13, 9, |x, _| {
        Rgba([
            90,
            130,
            170,
            if x == 12 {
                0
            } else if x == 11 {
                7
            } else {
                255
            },
        ])
    });
    let mut mask = full_roi(13, 9);
    mask.roi = runs(13, 9, |x, y| (2..7).contains(&x) && (2..7).contains(&y));
    mask.positive = vec![[4 * 13 + 4, 1]];
    mask.protected = runs(13, 9, |x, y| (6..13).contains(&x) && (4..6).contains(&y));
    mask.negative = vec![[4 * 13 + 9, 1]];
    let parameters = SelectionParameters {
        alpha_threshold: 128,
        ..SelectionParameters::default()
    };
    let result = refine(
        &image,
        &mask,
        parameters,
        &RefineControl {
            cancelled: &AtomicBool::new(false),
            progress: &AtomicU8::new(0),
        },
    )
    .unwrap();
    assert_eq!(
        result.draft,
        Some(runs(13, 9, |x, y| (x, y) != (9, 4)
            && ((2..7).contains(&x) && (2..7).contains(&y)
                || (6..12).contains(&x) && (4..6).contains(&y))))
    );
}

#[test]
fn cancellation_interrupts_real_work_and_reports_measured_latency() {
    let image = RgbaImage::from_pixel(1024, 1024, Rgba([90, 130, 170, 255]));
    let mut mask = full_roi(1024, 1024);
    mask.positive = vec![[1, 1]];
    mask.negative = vec![[1024 * 1024 - 1, 1]];
    let cancelled = Arc::new(AtomicBool::new(false));
    let progress = Arc::new(AtomicU8::new(0));
    let worker_cancel = cancelled.clone();
    let worker_progress = progress.clone();
    let worker = std::thread::spawn(move || {
        refine(
            &image,
            &mask,
            SelectionParameters::default(),
            &RefineControl {
                cancelled: &worker_cancel,
                progress: &worker_progress,
            },
        )
    });
    let deadline = Instant::now() + Duration::from_secs(10);
    while progress.load(Ordering::Relaxed) < 15 && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(1));
    }
    assert!(progress.load(Ordering::Relaxed) >= 15);
    let at = Instant::now();
    cancelled.store(true, Ordering::Relaxed);
    assert!(worker
        .join()
        .unwrap()
        .unwrap_err()
        .to_string()
        .contains("CANCELLED"));
    println!(
        "P39 cancel latency: {} microseconds at progress {}",
        at.elapsed().as_micros(),
        progress.load(Ordering::Relaxed)
    );
    assert!(at.elapsed() < Duration::from_secs(3));
}

#[test]
fn seeded_workload_has_measured_time_and_explicit_array_budget() {
    let image = RgbaImage::from_fn(512, 512, |x, y| {
        if (80..430).contains(&x) && (65..450).contains(&y) {
            Rgba([30, 80, 180, 255])
        } else {
            Rgba([235, 235, 235, 255])
        }
    });
    let mut mask = full_roi(512, 512);
    mask.positive = vec![[256 * 512 + 256, 1]];
    mask.negative = vec![[0, 1]];
    let result = execute(&image, &mask);
    assert_eq!(
        result.draft,
        Some(runs(512, 512, |x, y| (80..430).contains(&x)
            && (65..450).contains(&y)))
    );
    println!(
        "P39 seeded 512x512: exact match, {} ms, {} conservative working-array bytes",
        result.elapsed_ms, result.estimated_working_bytes
    );
    assert!(result.estimated_working_bytes < 7 * 1024 * 1024);
}
