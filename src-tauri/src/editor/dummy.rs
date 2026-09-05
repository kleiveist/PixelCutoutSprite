use std::collections::HashMap;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::animation::{AnimationSampler, SampleError};
use crate::directions::{
    DirectionError, DirectionResolver, DirectionalPose, SampledSlot as DirectionSampledSlot,
};
use crate::domain::{
    Direction, GroundShadow, MotionRevision, PixelPoint, PixelSize, ProfileRevision, SlotId,
};
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
    #[error(transparent)]
    Sample(#[from] SampleError),
    #[error(transparent)]
    Direction(#[from] DirectionError),
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
    #[serde(default, rename = "layerDelta")]
    pub layer_delta: i16,
}

impl Default for PoseTransform {
    fn default() -> Self {
        Self {
            offset_x_px: 0.0,
            offset_y_px: 0.0,
            rotation_deg: 0.0,
            visible: true,
            locked: false,
            layer_delta: 0,
        }
    }
}

pub type EditablePose = HashMap<SlotId, PoseTransform>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DummyPreview {
    pub data_url: String,
    pub clipping: Vec<crate::render::ClippingNotice>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SampledDummyPreview {
    pub data_url: String,
    pub clipping: Vec<crate::render::ClippingNotice>,
    pub pose: EditablePose,
    pub source_direction: Direction,
    pub mirror_parity: bool,
    pub sample_index: u16,
}

#[derive(Debug, Clone)]
pub struct CompiledSampledDummy {
    pub frame: RenderedFrame,
    pub pose: EditablePose,
    pub source_direction: Direction,
    pub mirror_parity: bool,
    pub sample_index: u16,
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
    render_dummy_with_shadow(
        profile,
        pose,
        direction,
        frame_size_px,
        ground_origin_px,
        None,
    )
}

fn render_dummy_with_shadow(
    profile: &ProfileRevision,
    pose: &EditablePose,
    direction: Direction,
    frame_size_px: PixelSize,
    ground_origin_px: PixelPoint,
    ground_shadow: Option<GroundShadow>,
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
    let mut parts = Vec::with_capacity(profile.slots.len() + usize::from(ground_shadow.is_some()));
    if let Some(shadow) = ground_shadow.filter(|shadow| shadow.enabled) {
        parts.push(RenderPart {
            slot_id: SlotId::parse("ground_shadow").expect("bundled shadow id is valid"),
            parent_id: None,
            profile: RenderTransform::IDENTITY,
            motion: RenderTransform::IDENTITY,
            fitting: RenderTransform::IDENTITY,
            local_override: RenderTransform::IDENTITY,
            pivot_px: (
                f64::from(shadow.width_px) / 2.0,
                f64::from(shadow.height_px) / 2.0,
            ),
            visible: true,
            layer: -1_000,
            mirror_bitmap_x: false,
            bitmap: ground_shadow_bitmap(shadow),
        });
    }
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
            layer: *layers.get(&slot.id).unwrap_or(&(index as i32)) + i32::from(delta.layer_delta),
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

/// Samples the persisted motion model and sends that exact pose through the reference compositor.
/// Playback history and wall-clock time are deliberately absent from this path.
pub fn render_sampled_dummy(
    profile: &ProfileRevision,
    motion: &MotionRevision,
    direction: Direction,
    sample_index: u16,
) -> Result<SampledDummyPreview, DummyCompileError> {
    let compiled = compile_sampled_dummy(profile, motion, direction, sample_index)?;
    let rendered = encode_dummy_preview(compiled.frame)?;
    Ok(SampledDummyPreview {
        data_url: rendered.data_url,
        clipping: rendered.clipping,
        pose: compiled.pose,
        source_direction: compiled.source_direction,
        mirror_parity: compiled.mirror_parity,
        sample_index: compiled.sample_index,
    })
}

pub fn compile_sampled_dummy(
    profile: &ProfileRevision,
    motion: &MotionRevision,
    direction: Direction,
    sample_index: u16,
) -> Result<CompiledSampledDummy, DummyCompileError> {
    let resolver = DirectionResolver::new(motion, profile)?;
    let direction_resolution = resolver.resolve(direction)?;
    let sampled = AnimationSampler.sample(motion, direction_resolution.source, sample_index)?;
    let sampled_by_slot = sampled
        .slots
        .iter()
        .map(|slot| (&slot.slot_id, slot))
        .collect::<HashMap<_, _>>();
    let source_pose = DirectionalPose {
        direction: direction_resolution.source,
        slots: profile
            .slots
            .iter()
            .map(|slot| {
                let sampled = sampled_by_slot.get(&slot.id).copied();
                Ok(DirectionSampledSlot {
                    slot_id: slot.id.clone(),
                    motion: RenderTransform::new(
                        sampled.map_or(0.0, |value| value.offset_x_px),
                        sampled.map_or(0.0, |value| value.offset_y_px),
                        sampled.map_or(0.0, |value| value.rotation_deg),
                    )?,
                    visible: sampled.is_none_or(|value| value.visible),
                    sprite_variant: sampled.and_then(|value| value.sprite_variant.clone()),
                    layer_delta: sampled.map_or(0, |value| i32::from(value.layer_delta)),
                })
            })
            .collect::<Result<Vec<_>, RenderError>>()?,
    };
    let resolved = resolver.resolve_pose(direction, &source_pose)?;
    let pose = resolved
        .slots
        .iter()
        .map(|slot| {
            (
                slot.slot_id.clone(),
                PoseTransform {
                    offset_x_px: slot.motion.offset_x,
                    offset_y_px: slot.motion.offset_y,
                    rotation_deg: slot.motion.rotation_deg,
                    visible: slot.visible,
                    locked: false,
                    layer_delta: (slot.layer - slot.base_layer) as i16,
                },
            )
        })
        .collect::<EditablePose>();
    let ground_shadow = motion
        .semantics
        .as_ref()
        .and_then(|semantics| semantics.ground_shadow)
        .filter(|shadow| shadow.enabled);
    let frame = render_dummy_with_shadow(
        profile,
        &pose,
        direction,
        motion.frame_size_px,
        motion.ground_origin_px,
        ground_shadow,
    )?;
    Ok(CompiledSampledDummy {
        frame,
        pose,
        source_direction: direction_resolution.source,
        mirror_parity: direction_resolution.pose_mirrored,
        sample_index,
    })
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

pub(crate) fn ground_shadow_bitmap(shadow: GroundShadow) -> RgbaImage {
    let mut image = RgbaImage::new(u32::from(shadow.width_px), u32::from(shadow.height_px));
    let width = i64::from(shadow.width_px);
    let height = i64::from(shadow.height_px);
    let limit = width * width * height * height;
    for y in 0..height {
        for x in 0..width {
            let dx = 2 * x + 1 - width;
            let dy = 2 * y + 1 - height;
            if dx * dx * height * height + dy * dy * width * width <= limit {
                image.put_pixel(x as u32, y as u32, Rgba([18, 17, 22, shadow.opacity]));
            }
        }
    }
    image
}
