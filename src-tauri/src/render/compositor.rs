use std::collections::{HashMap, HashSet};

use image::{Rgba, RgbaImage};
use serde::Serialize;
use thiserror::Error;

use crate::domain::{Direction, PixelPoint, PixelSize, SlotId};

use super::{Affine, RenderTransform};

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RenderError {
    #[error("render input has an invalid non-finite transform")]
    InvalidTransform,
    #[error("render frame dimensions must both be non-zero")]
    EmptyFrame,
    #[error("render part `{0}` has an invalid non-finite pivot")]
    InvalidPivot(String),
    #[error("render part `{0}` occurs more than once")]
    DuplicatePart(String),
    #[error("render part `{part}` references missing parent `{parent}`")]
    MissingParent { part: String, parent: String },
    #[error("render hierarchy contains a cycle through `{0}`")]
    ParentCycle(String),
    #[error("render bitmap for `{0}` is empty")]
    EmptyBitmap(String),
}

#[derive(Debug, Clone)]
pub struct RenderPart {
    pub slot_id: SlotId,
    pub parent_id: Option<SlotId>,
    /// Profile base/view placement relative to the parent.
    pub profile: RenderTransform,
    /// Sampled reusable motion relative to the profile placement.
    pub motion: RenderTransform,
    /// Shared NPC appearance fitting.
    pub fitting: RenderTransform,
    /// Binding-local correction, applied after fitting.
    pub local_override: RenderTransform,
    pub pivot_px: (f64, f64),
    pub visible: bool,
    pub layer: i32,
    pub mirror_bitmap_x: bool,
    pub bitmap: RgbaImage,
}

#[derive(Debug, Clone)]
pub struct RenderRequest {
    pub direction: Direction,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub parts: Vec<RenderPart>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ClippingNotice {
    pub slot_id: SlotId,
    pub bounds_px: [i32; 4],
}

#[derive(Debug, Clone)]
pub struct RenderedFrame {
    pub image: RgbaImage,
    pub clipping: Vec<ClippingNotice>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PixelCompositor;

impl PixelCompositor {
    pub fn render(&self, request: &RenderRequest) -> Result<RenderedFrame, RenderError> {
        validate_request(request)?;
        let transforms = resolve_world_transforms(request)?;
        let mut ordered = request.parts.iter().enumerate().collect::<Vec<_>>();
        ordered.sort_by_key(|(index, part)| (part.layer, *index));
        let mut image = RgbaImage::new(
            u32::from(request.frame_size_px.0),
            u32::from(request.frame_size_px.1),
        );
        let mut clipping = Vec::new();
        for (_, part) in ordered {
            if !part.visible {
                continue;
            }
            if part.bitmap.width() == 0 || part.bitmap.height() == 0 {
                return Err(RenderError::EmptyBitmap(part.slot_id.to_string()));
            }
            let world = transforms[&part.slot_id]
                .multiply(part.fitting.affine())
                .multiply(part.local_override.affine())
                .multiply(Affine::translation(-part.pivot_px.0, -part.pivot_px.1));
            let bounds = transformed_bounds(world, part.bitmap.width(), part.bitmap.height());
            if bounds[0] < 0
                || bounds[1] < 0
                || bounds[2] > i32::from(request.frame_size_px.0)
                || bounds[3] > i32::from(request.frame_size_px.1)
            {
                clipping.push(ClippingNotice {
                    slot_id: part.slot_id.clone(),
                    bounds_px: bounds,
                });
            }
            if world.is_integer_translation() {
                blit_integer(
                    &mut image,
                    part,
                    world.tx.round() as i32,
                    world.ty.round() as i32,
                );
            } else {
                blit_inverse_nearest(&mut image, part, world, bounds);
            }
        }
        Ok(RenderedFrame { image, clipping })
    }
}

fn validate_request(request: &RenderRequest) -> Result<(), RenderError> {
    if request.frame_size_px.0 == 0 || request.frame_size_px.1 == 0 {
        return Err(RenderError::EmptyFrame);
    }
    for part in &request.parts {
        if !part.profile.is_finite()
            || !part.motion.is_finite()
            || !part.fitting.is_finite()
            || !part.local_override.is_finite()
        {
            return Err(RenderError::InvalidTransform);
        }
        if !part.pivot_px.0.is_finite() || !part.pivot_px.1.is_finite() {
            return Err(RenderError::InvalidPivot(part.slot_id.to_string()));
        }
    }
    Ok(())
}

pub(crate) fn resolve_world_transforms(
    request: &RenderRequest,
) -> Result<HashMap<SlotId, Affine>, RenderError> {
    let mut by_id = HashMap::new();
    for part in &request.parts {
        if by_id.insert(part.slot_id.clone(), part).is_some() {
            return Err(RenderError::DuplicatePart(part.slot_id.to_string()));
        }
    }
    for part in &request.parts {
        if let Some(parent) = &part.parent_id {
            if !by_id.contains_key(parent) {
                return Err(RenderError::MissingParent {
                    part: part.slot_id.to_string(),
                    parent: parent.to_string(),
                });
            }
        }
    }
    let root = Affine::translation(
        f64::from(request.ground_origin_px.0),
        f64::from(request.ground_origin_px.1),
    );
    let mut resolved = HashMap::new();
    let mut visiting = HashSet::new();
    for part in &request.parts {
        resolve_part(part, &by_id, &mut resolved, &mut visiting, root)?;
    }
    Ok(resolved)
}

fn resolve_part(
    part: &RenderPart,
    by_id: &HashMap<SlotId, &RenderPart>,
    resolved: &mut HashMap<SlotId, Affine>,
    visiting: &mut HashSet<SlotId>,
    root: Affine,
) -> Result<Affine, RenderError> {
    if let Some(value) = resolved.get(&part.slot_id) {
        return Ok(*value);
    }
    if !visiting.insert(part.slot_id.clone()) {
        return Err(RenderError::ParentCycle(part.slot_id.to_string()));
    }
    let parent = match &part.parent_id {
        Some(parent_id) => resolve_part(by_id[parent_id], by_id, resolved, visiting, root)?,
        None => root,
    };
    // Contract order: parent × profile × sampled motion. Fitting and local override are image
    // transforms and are intentionally applied later, after the child hierarchy is resolved.
    let world = parent
        .multiply(part.profile.affine())
        .multiply(part.motion.affine());
    visiting.remove(&part.slot_id);
    resolved.insert(part.slot_id.clone(), world);
    Ok(world)
}

fn transformed_bounds(transform: Affine, width: u32, height: u32) -> [i32; 4] {
    let corners = [
        transform.point(0.0, 0.0),
        transform.point(f64::from(width), 0.0),
        transform.point(0.0, f64::from(height)),
        transform.point(f64::from(width), f64::from(height)),
    ];
    let min_x = corners
        .iter()
        .map(|point| point.0)
        .fold(f64::INFINITY, f64::min);
    let min_y = corners
        .iter()
        .map(|point| point.1)
        .fold(f64::INFINITY, f64::min);
    let max_x = corners
        .iter()
        .map(|point| point.0)
        .fold(f64::NEG_INFINITY, f64::max);
    let max_y = corners
        .iter()
        .map(|point| point.1)
        .fold(f64::NEG_INFINITY, f64::max);
    [
        min_x.floor() as i32,
        min_y.floor() as i32,
        max_x.ceil() as i32,
        max_y.ceil() as i32,
    ]
}

fn blit_integer(target: &mut RgbaImage, part: &RenderPart, offset_x: i32, offset_y: i32) {
    for source_y in 0..part.bitmap.height() {
        for source_x in 0..part.bitmap.width() {
            let target_x = offset_x + source_x as i32;
            let target_y = offset_y + source_y as i32;
            if target_x < 0
                || target_y < 0
                || target_x >= target.width() as i32
                || target_y >= target.height() as i32
            {
                continue;
            }
            blend_at(
                target,
                target_x as u32,
                target_y as u32,
                source_pixel(part, source_x, source_y),
            );
        }
    }
}

fn blit_inverse_nearest(
    target: &mut RgbaImage,
    part: &RenderPart,
    transform: Affine,
    bounds: [i32; 4],
) {
    let Some(inverse) = transform.inverse() else {
        return;
    };
    let start_x = bounds[0].max(0);
    let start_y = bounds[1].max(0);
    let end_x = bounds[2].min(target.width() as i32);
    let end_y = bounds[3].min(target.height() as i32);
    for target_y in start_y..end_y {
        for target_x in start_x..end_x {
            // Pixel centers are half-integer coordinates. `floor` gives a deterministic nearest
            // texel cell for positive and negative inverse coordinates.
            let (source_x, source_y) =
                inverse.point(f64::from(target_x) + 0.5, f64::from(target_y) + 0.5);
            let source_x = source_x.floor() as i32;
            let source_y = source_y.floor() as i32;
            if source_x >= 0
                && source_y >= 0
                && source_x < part.bitmap.width() as i32
                && source_y < part.bitmap.height() as i32
            {
                blend_at(
                    target,
                    target_x as u32,
                    target_y as u32,
                    source_pixel(part, source_x as u32, source_y as u32),
                );
            }
        }
    }
}

fn source_pixel(part: &RenderPart, source_x: u32, source_y: u32) -> Rgba<u8> {
    let source_x = if part.mirror_bitmap_x {
        part.bitmap.width() - 1 - source_x
    } else {
        source_x
    };
    *part.bitmap.get_pixel(source_x, source_y)
}

fn blend_at(target: &mut RgbaImage, x: u32, y: u32, source: Rgba<u8>) {
    if source[3] == 0 {
        return;
    }
    if source[3] == 255 {
        target.put_pixel(x, y, source);
        return;
    }
    let destination = *target.get_pixel(x, y);
    let source_alpha = u32::from(source[3]);
    let destination_alpha = u32::from(destination[3]);
    let inverse = 255 - source_alpha;
    let output_alpha = source_alpha + rounded_div(destination_alpha * inverse, 255);
    if output_alpha == 0 {
        return;
    }
    let mut output = [0_u8; 4];
    for channel in 0..3 {
        let premultiplied = u32::from(source[channel]) * source_alpha
            + rounded_div(
                u32::from(destination[channel]) * destination_alpha * inverse,
                255,
            );
        output[channel] = rounded_div(premultiplied, output_alpha).min(255) as u8;
    }
    output[3] = output_alpha.min(255) as u8;
    target.put_pixel(x, y, Rgba(output));
}

fn rounded_div(numerator: u32, denominator: u32) -> u32 {
    (numerator + denominator / 2) / denominator
}
