use std::time::Instant;

use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::domain::{Direction, PixelPoint, PixelSize, SlotId};
use pixel_cutout_sprite_studio_lib::render::{
    PixelCompositor, RenderError, RenderPart, RenderRequest, RenderTransform,
};

fn id(value: &str) -> SlotId {
    SlotId::parse(value).unwrap()
}

fn bitmap(width: u32, height: u32, pixels: &[[u8; 4]]) -> RgbaImage {
    assert_eq!(pixels.len(), (width * height) as usize);
    RgbaImage::from_fn(width, height, |x, y| Rgba(pixels[(y * width + x) as usize]))
}

fn part(name: &str, layer: i32, bitmap: RgbaImage) -> RenderPart {
    RenderPart {
        slot_id: id(name),
        parent_id: None,
        profile: RenderTransform::IDENTITY,
        motion: RenderTransform::IDENTITY,
        fitting: RenderTransform::IDENTITY,
        local_override: RenderTransform::IDENTITY,
        pivot_px: (0.0, 0.0),
        visible: true,
        layer,
        mirror_bitmap_x: false,
        bitmap: bitmap.into(),
    }
}

fn request(parts: Vec<RenderPart>) -> RenderRequest {
    RenderRequest {
        direction: Direction::S,
        frame_size_px: PixelSize(8, 8),
        ground_origin_px: PixelPoint(3, 3),
        parts,
    }
}

fn assert_only_pixels(image: &RgbaImage, expected: &[((u32, u32), [u8; 4])]) {
    for (x, y, pixel) in image.enumerate_pixels() {
        let expected_pixel = expected
            .iter()
            .find_map(|(position, value)| (*position == (x, y)).then_some(*value))
            .unwrap_or([0, 0, 0, 0]);
        assert_eq!(
            pixel.0, expected_pixel,
            "RGBA golden mismatch at ({x}, {y})"
        );
    }
}

#[test]
fn layers_and_straight_alpha_use_deterministic_source_over() {
    let bottom = part("bottom", 0, bitmap(1, 1, &[[255, 0, 0, 255]]));
    let top = part("top", 1, bitmap(1, 1, &[[0, 0, 255, 128]]));
    let result = PixelCompositor.render(&request(vec![top, bottom])).unwrap();
    assert_only_pixels(&result.image, &[((3, 3), [127, 0, 128, 255])]);
    assert!(result.clipping.is_empty());
}

#[test]
fn parent_motion_then_fitting_then_override_preserves_fraction_until_sampling() {
    let mut parent = part("parent", 0, bitmap(1, 1, &[[0, 0, 0, 0]]));
    parent.profile = RenderTransform::new(0.25, -1.0, 0.0).unwrap();
    parent.motion = RenderTransform::new(0.25, 0.0, 0.0).unwrap();
    parent.visible = false;
    let mut child = part("child", 1, bitmap(1, 1, &[[12, 240, 80, 255]]));
    child.parent_id = Some(id("parent"));
    child.profile = RenderTransform::new(0.25, 0.0, 0.0).unwrap();
    child.motion = RenderTransform::new(0.25, 0.0, 0.0).unwrap();
    child.fitting = RenderTransform::new(1.0, 0.0, 0.0).unwrap();
    child.local_override = RenderTransform::new(1.0, 0.0, 0.0).unwrap();
    let result = PixelCompositor
        .render(&request(vec![parent, child]))
        .unwrap();
    assert_only_pixels(&result.image, &[((6, 2), [12, 240, 80, 255])]);
}

#[test]
fn rotation_uses_inverse_nearest_around_the_declared_pivot_without_antialiasing() {
    let mut marker = part(
        "marker",
        0,
        bitmap(2, 1, &[[255, 200, 0, 255], [60, 20, 220, 255]]),
    );
    marker.pivot_px = (1.0, 0.0);
    marker.profile = RenderTransform::new(0.0, 0.0, 90.0).unwrap();
    let result = PixelCompositor.render(&request(vec![marker])).unwrap();
    assert_only_pixels(
        &result.image,
        &[((2, 2), [255, 200, 0, 255]), ((2, 3), [60, 20, 220, 255])],
    );
}

#[test]
fn bitmap_mirroring_is_exact_and_double_mirroring_restores_source() {
    let source = bitmap(2, 1, &[[255, 0, 0, 255], [0, 255, 0, 255]]);
    let mut mirrored = part("hand", 0, source.clone());
    mirrored.mirror_bitmap_x = true;
    let first = PixelCompositor.render(&request(vec![mirrored])).unwrap();
    assert_only_pixels(
        &first.image,
        &[((3, 3), [0, 255, 0, 255]), ((4, 3), [255, 0, 0, 255])],
    );

    let reversed_source = bitmap(2, 1, &[[0, 255, 0, 255], [255, 0, 0, 255]]);
    let mut restored = part("hand", 0, reversed_source);
    restored.mirror_bitmap_x = true;
    let second = PixelCompositor.render(&request(vec![restored])).unwrap();
    assert_only_pixels(
        &second.image,
        &[((3, 3), [255, 0, 0, 255]), ((4, 3), [0, 255, 0, 255])],
    );
}

#[test]
fn negative_coordinates_are_clipped_and_reported() {
    let mut clipped = part("cape", 0, RgbaImage::from_pixel(3, 3, Rgba([9, 8, 7, 255])));
    clipped.profile = RenderTransform::new(-5.0, -5.0, 0.0).unwrap();
    let result = PixelCompositor.render(&request(vec![clipped])).unwrap();
    assert_eq!(result.clipping.len(), 1);
    assert_eq!(result.clipping[0].bounds_px, [-2, -2, 1, 1]);
    assert_only_pixels(&result.image, &[((0, 0), [9, 8, 7, 255])]);
}

#[test]
fn invalid_public_transform_and_pivot_inputs_fail_closed() {
    let mut empty_frame = request(Vec::new());
    empty_frame.frame_size_px = PixelSize(0, 8);
    assert_eq!(
        PixelCompositor.render(&empty_frame).unwrap_err(),
        RenderError::EmptyFrame
    );

    let mut invalid_transform = part("head", 0, RgbaImage::new(1, 1));
    invalid_transform.motion = RenderTransform {
        offset_x: f64::NAN,
        offset_y: 0.0,
        rotation_deg: 0.0,
    };
    assert_eq!(
        PixelCompositor
            .render(&request(vec![invalid_transform]))
            .unwrap_err(),
        RenderError::InvalidTransform
    );

    let mut invalid_pivot = part("head", 0, RgbaImage::new(1, 1));
    invalid_pivot.pivot_px = (f64::INFINITY, 0.0);
    assert_eq!(
        PixelCompositor
            .render(&request(vec![invalid_pivot]))
            .unwrap_err(),
        RenderError::InvalidPivot("head".to_owned())
    );
}

#[test]
fn hierarchy_errors_are_explicit() {
    let mut orphan = part("hand", 0, RgbaImage::new(1, 1));
    orphan.parent_id = Some(id("arm"));
    assert_eq!(
        PixelCompositor.render(&request(vec![orphan])).unwrap_err(),
        RenderError::MissingParent {
            part: "hand".to_owned(),
            parent: "arm".to_owned(),
        }
    );

    let mut left = part("left", 0, RgbaImage::new(1, 1));
    let mut right = part("right", 0, RgbaImage::new(1, 1));
    left.parent_id = Some(id("right"));
    right.parent_id = Some(id("left"));
    assert!(matches!(
        PixelCompositor.render(&request(vec![left, right])),
        Err(RenderError::ParentCycle(_))
    ));
}

#[test]
fn repeated_128_pixel_reference_frames_are_equal_and_measured() {
    let mut body = part(
        "body",
        0,
        RgbaImage::from_pixel(24, 80, Rgba([110, 80, 190, 255])),
    );
    body.profile = RenderTransform::new(-12.0, -80.0, 0.0).unwrap();
    let sample = RenderRequest {
        direction: Direction::S,
        frame_size_px: PixelSize(128, 128),
        ground_origin_px: PixelPoint(64, 108),
        parts: vec![body],
    };
    let started = Instant::now();
    let first = PixelCompositor.render(&sample).unwrap();
    let second = PixelCompositor.render(&sample).unwrap();
    eprintln!("two 128x128 reference renders: {:?}", started.elapsed());
    assert_eq!(first.image.as_raw(), second.image.as_raw());
}
