use std::collections::HashMap;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::{Direction, PixelPoint, PixelSize, ProfileRevision, SlotId};
use crate::render::{
    PixelCompositor, RenderError, RenderPart, RenderRequest, RenderTransform, RenderedFrame,
};

#[derive(Debug, Error)]
pub enum DummyCompileError {
    #[error("profile has no view for {0:?}")]
    MissingView(Direction),
    #[error("profile view has no transform for `{0}`")]
    MissingTransform(String),
    #[error(transparent)]
    Render(#[from] RenderError),
    #[error("dummy preview could not be encoded as PNG: {0}")]
    Encode(#[from] image::ImageError),
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoseTransform {
    #[serde(rename = "offsetX")]
    pub offset_x_px: f64,
    #[serde(rename = "offsetY")]
    pub offset_y_px: f64,
    #[serde(rename = "rotation")]
    pub rotation_deg: f64,
    pub visible: bool,
    pub locked: bool,
}

impl Default for PoseTransform {
    fn default() -> Self {
        Self {
            offset_x_px: 0.0,
            offset_y_px: 0.0,
            rotation_deg: 0.0,
            visible: true,
            locked: false,
        }
    }
}

pub type EditablePose = HashMap<SlotId, PoseTransform>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DummyPreview {
    pub data_url: String,
    pub clipping: Vec<crate::render::ClippingNotice>,
}

/// Compiles the neutral colored dummy through the same PixelCompositor used by export. Grid,
/// handles, names, focus rings and onion-skin helpers are UI overlays and cannot enter this API.
pub fn render_dummy(
    profile: &ProfileRevision,
    pose: &EditablePose,
    direction: Direction,
    frame_size_px: PixelSize,
    ground_origin_px: PixelPoint,
) -> Result<RenderedFrame, DummyCompileError> {
    let view = profile
        .views
        .iter()
        .find(|view| view.direction == direction)
        .ok_or(DummyCompileError::MissingView(direction))?;
    let transforms = view
        .base_transforms
        .iter()
        .map(|item| (&item.slot_id, item.transform))
        .collect::<HashMap<_, _>>();
    let layers = view
        .layer_order
        .iter()
        .enumerate()
        .map(|(layer, slot)| (slot, layer as i32))
        .collect::<HashMap<_, _>>();
    let mut parts = Vec::with_capacity(profile.slots.len());
    for (index, slot) in profile.slots.iter().enumerate() {
        let base = transforms
            .get(&slot.id)
            .ok_or_else(|| DummyCompileError::MissingTransform(slot.id.to_string()))?;
        let delta = pose.get(&slot.id).copied().unwrap_or_default();
        let color = dummy_color(index, slot.optional);
        parts.push(RenderPart {
            slot_id: slot.id.clone(),
            parent_id: slot.parent_id.clone(),
            // DirectionView is the authoritative profile pose. SlotDefinition.base_transform is
            // the S-view fallback in the v1 profile contract and is not added a second time.
            profile: (*base).into(),
            motion: RenderTransform::new(delta.offset_x_px, delta.offset_y_px, delta.rotation_deg)?,
            fitting: RenderTransform::IDENTITY,
            local_override: RenderTransform::IDENTITY,
            pivot_px: (f64::from(slot.pivot_px.0), f64::from(slot.pivot_px.1)),
            visible: delta.visible,
            layer: *layers.get(&slot.id).unwrap_or(&(index as i32)),
            mirror_bitmap_x: false,
            bitmap: RgbaImage::from_pixel(
                u32::from(slot.size_px.0),
                u32::from(slot.size_px.1),
                color,
            ),
        });
    }
    PixelCompositor
        .render(&RenderRequest {
            direction,
            frame_size_px,
            ground_origin_px,
            parts,
        })
        .map_err(Into::into)
}

pub fn encode_dummy_preview(frame: RenderedFrame) -> Result<DummyPreview, DummyCompileError> {
    let mut png = Vec::new();
    PngEncoder::new(&mut png).write_image(
        frame.image.as_raw(),
        frame.image.width(),
        frame.image.height(),
        ExtendedColorType::Rgba8,
    )?;
    Ok(DummyPreview {
        data_url: format!("data:image/png;base64,{}", BASE64.encode(png)),
        clipping: frame.clipping,
    })
}

fn dummy_color(index: usize, optional: bool) -> Rgba<u8> {
    const COLORS: [[u8; 3]; 8] = [
        [232, 255, 104],
        [255, 121, 94],
        [114, 87, 187],
        [82, 169, 190],
        [230, 173, 121],
        [129, 190, 105],
        [210, 112, 163],
        [117, 110, 132],
    ];
    let color = COLORS[index % COLORS.len()];
    Rgba([
        color[0],
        color[1],
        color[2],
        if optional { 210 } else { 255 },
    ])
}
