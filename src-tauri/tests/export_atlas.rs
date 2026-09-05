use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::domain::{AtlasSize, PixelRect, PixelSize};
use pixel_cutout_sprite_studio_lib::exports::{AtlasBuilder, AtlasOptions, ExportError};

fn options(size: AtlasSize) -> AtlasOptions {
    AtlasOptions {
        max_page_size_px: size,
        padding_px: 0,
        extrude_edges: false,
        max_pages: 16,
        memory_budget_bytes: 1024 * 1024,
    }
}

#[test]
fn regular_grid_is_row_major_and_uses_multiple_tight_pages() {
    let builder = AtlasBuilder::new(PixelSize(2, 2), options(AtlasSize(4, 4))).unwrap();
    let plan = builder.plan(5).unwrap();

    assert_eq!(plan.pages.len(), 2);
    assert_eq!(plan.pages[0].size_px, AtlasSize(4, 4));
    assert_eq!(plan.pages[1].size_px, AtlasSize(2, 2));
    assert_eq!(
        plan.placements
            .iter()
            .map(|placement| (placement.page_index, placement.rect_px))
            .collect::<Vec<_>>(),
        vec![
            (0, PixelRect(0, 0, 2, 2)),
            (0, PixelRect(2, 0, 2, 2)),
            (0, PixelRect(0, 2, 2, 2)),
            (0, PixelRect(2, 2, 2, 2)),
            (1, PixelRect(0, 0, 2, 2)),
        ]
    );
}

#[test]
fn edge_extrusion_matches_a_decoded_rgba_golden() {
    let builder = AtlasBuilder::new(
        PixelSize(2, 2),
        AtlasOptions {
            max_page_size_px: AtlasSize(4, 4),
            padding_px: 1,
            extrude_edges: true,
            max_pages: 1,
            memory_budget_bytes: 80,
        },
    )
    .unwrap();
    let plan = builder.plan(1).unwrap();
    assert_eq!(plan.placements[0].rect_px, PixelRect(1, 1, 2, 2));
    let source = RgbaImage::from_fn(2, 2, |x, y| match (x, y) {
        (0, 0) => Rgba([255, 0, 0, 255]),
        (1, 0) => Rgba([0, 255, 0, 255]),
        (0, 1) => Rgba([0, 0, 255, 255]),
        _ => Rgba([255, 255, 0, 128]),
    });
    let mut page = builder.blank_page(&plan.pages[0]);
    builder
        .place(&mut page, &plan.placements[0], &source)
        .unwrap();

    let expected = [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [255, 0, 0, 255],
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [255, 255, 0, 128],
        [255, 255, 0, 128],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [255, 255, 0, 128],
        [255, 255, 0, 128],
    ];
    assert_eq!(
        page.pixels().map(|pixel| pixel.0).collect::<Vec<_>>(),
        expected
    );
}

#[test]
fn page_count_and_decoded_memory_limits_fail_before_allocation() {
    let mut limited = options(AtlasSize(2, 2));
    limited.max_pages = 1;
    let builder = AtlasBuilder::new(PixelSize(2, 2), limited).unwrap();
    assert!(matches!(
        builder.plan(2),
        Err(ExportError::PageLimit {
            required: 2,
            limit: 1
        })
    ));

    let mut limited = options(AtlasSize(4, 4));
    limited.memory_budget_bytes = 31;
    let builder = AtlasBuilder::new(PixelSize(2, 2), limited).unwrap();
    assert!(matches!(
        builder.plan(1),
        Err(ExportError::MemoryLimit {
            required: 32,
            budget: 31
        })
    ));
}

#[test]
fn padding_that_cannot_fit_is_rejected_without_scaling_or_cropping() {
    let mut profile = options(AtlasSize(16, 16));
    profile.padding_px = 5;
    assert!(matches!(
        AtlasBuilder::new(PixelSize(8, 8), profile),
        Err(ExportError::FrameDoesNotFit)
    ));
}
