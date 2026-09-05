use image::RgbaImage;

use crate::domain::PixelPoint;

use super::DirectionError;

#[derive(Debug, Clone)]
pub struct WholeFrameMirror {
    pub image: RgbaImage,
    pub ground_origin_px: PixelPoint,
}

/// Mirrors a completed frame as an explicit export shortcut. This is intentionally separate from
/// pose mirroring and per-asset bitmap mirroring; neither DirectionResolver nor AssetResolver calls
/// it implicitly.
pub fn mirror_whole_frame_x(
    source: &RgbaImage,
    ground_origin_px: PixelPoint,
) -> Result<WholeFrameMirror, DirectionError> {
    let width =
        i32::try_from(source.width()).map_err(|_| DirectionError::InvalidWholeFrameOrigin)?;
    let mirrored_origin_x = width - i32::from(ground_origin_px.0);
    let mirrored_origin_x =
        i16::try_from(mirrored_origin_x).map_err(|_| DirectionError::InvalidWholeFrameOrigin)?;
    let ground_origin_px = PixelPoint(mirrored_origin_x, ground_origin_px.1);
    ground_origin_px
        .validate("whole_frame_mirror.ground_origin_px")
        .map_err(|_| DirectionError::InvalidWholeFrameOrigin)?;

    let image = RgbaImage::from_fn(source.width(), source.height(), |x, y| {
        *source.get_pixel(source.width() - 1 - x, y)
    });
    Ok(WholeFrameMirror {
        image,
        ground_origin_px,
    })
}

#[cfg(test)]
mod tests {
    use image::Rgba;

    use super::*;

    #[test]
    fn double_whole_frame_mirror_restores_pixels_and_origin() {
        let source = RgbaImage::from_fn(3, 1, |x, _| Rgba([x as u8, 4, 8, 255]));
        let first = mirror_whole_frame_x(&source, PixelPoint(1, 0)).unwrap();
        assert_eq!(first.ground_origin_px, PixelPoint(2, 0));
        let second = mirror_whole_frame_x(&first.image, first.ground_origin_px).unwrap();
        assert_eq!(second.image, source);
        assert_eq!(second.ground_origin_px, PixelPoint(1, 0));
    }
}
