use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::domain::{
    ActionKey, AtlasSize, Direction, DirectionDefinition, DirectionMode, DocumentKind,
    EffectiveSource, EffectiveSourceKind, ExportJumpMode, ExportProfileSnapshot,
    ExportRootMotionMode, ExportSources, Interpolation, Keyframe, LoopMode, MotionRevision,
    MotionTrack, ObjectId, PixelPoint, PixelSize, RevisionRef, Sha256Digest, SlotId, TrackProperty,
    TrackValue, UtcTimestamp,
};
use pixel_cutout_sprite_studio_lib::exports::{
    motion_semantic_sha256, ExportActionInput, ExportRequest, FrameContext, FrameSource,
    FrameSourceError,
};
use pixel_cutout_sprite_studio_lib::render::{RenderPart, RenderRequest, RenderTransform};

pub const OUTPUT_DIRECTORY: &str = "hero--66666666/walk--88888888/exports";

#[derive(Default)]
pub struct FixtureSource {
    pub color_bias: u8,
    pub missing: Option<(String, Direction, u16)>,
    pub clipping: bool,
    pub corrupt: bool,
    pub sampled_y: Vec<f64>,
}

impl FrameSource for FixtureSource {
    fn render_request(
        &mut self,
        context: FrameContext<'_>,
    ) -> Result<RenderRequest, FrameSourceError> {
        if self.corrupt {
            return Err(FrameSourceError::new(
                "corrupt_source",
                "fixture bytes failed verification",
            ));
        }
        if self.missing.as_ref().is_some_and(|missing| {
            missing.0 == context.action_key.as_str()
                && missing.1 == context.pose.requested_direction
                && missing.2 == context.pose.sample_index
        }) {
            return Err(FrameSourceError::missing("fixture body image is absent"));
        }
        let sampled_x = context
            .pose
            .slots
            .iter()
            .find(|slot| slot.slot_id.as_str() == "body")
            .map_or(0.0, |slot| slot.offset_x_px);
        let sampled_y = context
            .pose
            .slots
            .iter()
            .find(|slot| slot.slot_id.as_str() == "body")
            .map_or(0.0, |slot| slot.offset_y_px);
        self.sampled_y.push(sampled_y);
        let ground = context.motion.ground_origin_px;
        let clip_offset = if self.clipping { -1.0 } else { 0.0 };
        let part = RenderPart {
            slot_id: SlotId::parse("body").unwrap(),
            parent_id: None,
            profile: RenderTransform::new(
                -f64::from(ground.0) + clip_offset,
                -f64::from(ground.1),
                0.0,
            )
            .unwrap(),
            motion: RenderTransform::new(sampled_x, sampled_y, 0.0).unwrap(),
            fitting: RenderTransform::IDENTITY,
            local_override: RenderTransform::IDENTITY,
            pivot_px: (0.0, 0.0),
            visible: true,
            layer: 0,
            mirror_bitmap_x: context.pose.mirror_parity,
            bitmap: RgbaImage::from_pixel(
                1,
                1,
                Rgba(frame_color(
                    context.action_key.as_str(),
                    context.pose.requested_direction,
                    context.pose.sample_index,
                    self.color_bias,
                )),
            )
            .into(),
        };
        Ok(RenderRequest {
            direction: context.pose.requested_direction,
            frame_size_px: context.motion.frame_size_px,
            ground_origin_px: ground,
            parts: vec![part],
        })
    }
}

pub fn request(action_specs: &[(&str, PixelSize, PixelPoint)]) -> ExportRequest {
    let actions = action_specs
        .iter()
        .enumerate()
        .map(|(index, (key, size, ground))| action(index, key, *size, *ground))
        .collect::<Vec<_>>();
    let profile_ref = revision("33333333-3333-4333-8333-333333333333");
    let asset_ref = revision("55555555-5555-4555-8555-555555555555");
    let appearance_ref = revision("77777777-7777-4777-8777-777777777777");
    let sources = ExportSources {
        profile: profile_ref,
        motion: actions
            .iter()
            .map(|action| action.motion.reference())
            .collect(),
        assets: vec![asset_ref],
        appearances: vec![appearance_ref],
        bindings: actions.iter().map(|action| action.binding_ref).collect(),
    };
    let mut effective_sources = vec![
        effective(EffectiveSourceKind::Profile, profile_ref, 0x11),
        effective(EffectiveSourceKind::Asset, asset_ref, 0x22),
        effective(EffectiveSourceKind::Appearance, appearance_ref, 0x33),
    ];
    for action in &actions {
        effective_sources.push(EffectiveSource {
            kind: EffectiveSourceKind::Motion,
            reference: action.motion.reference(),
            content_sha256: motion_semantic_sha256(&action.motion).unwrap(),
        });
        effective_sources.push(effective(
            EffectiveSourceKind::Binding,
            action.binding_ref,
            0x44,
        ));
    }
    ExportRequest {
        character_id: object("66666666-6666-4666-8666-666666666666"),
        sources,
        effective_sources,
        actions,
        profile: ExportProfileSnapshot {
            name: "Portable PNG + JSON".to_owned(),
            directions: Direction::ALL.to_vec(),
            max_page_size_px: AtlasSize(8, 8),
            max_pages: 64,
            memory_budget_bytes: 16 * 1024 * 1024,
            padding_px: 0,
            extrude_edges: false,
            individual_frames: false,
            include_shadow: true,
            normalize_geometry: false,
            clipping_policy: pixel_cutout_sprite_studio_lib::domain::ClippingPolicy::Block,
            allow_incomplete_test: false,
        },
        incomplete_reasons: Vec::new(),
    }
}

pub fn frame_color(action: &str, direction: Direction, frame: u16, bias: u8) -> [u8; 4] {
    let action_base = if action == "sprint" { 100 } else { 20 };
    let direction = Direction::ALL
        .iter()
        .position(|candidate| *candidate == direction)
        .unwrap() as u8;
    [
        action_base + direction * 8 + frame as u8 + bias,
        40 + frame as u8,
        180 - direction * 4,
        255,
    ]
}

fn action(index: usize, key: &str, size: PixelSize, ground: PixelPoint) -> ExportActionInput {
    let (template, binding) = if index == 0 {
        (
            "44444444-4444-4444-8444-444444444444",
            "88888888-8888-4888-8888-888888888888",
        )
    } else {
        (
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "99999999-9999-4999-8999-999999999999",
        )
    };
    let template_id = object(template);
    ExportActionInput {
        action_key: ActionKey::parse(key).unwrap(),
        binding_ref: revision(binding),
        motion: MotionRevision {
            schema_version: 1,
            kind: DocumentKind::MotionRevision,
            template_id,
            revision: 1,
            profile_ref: revision("33333333-3333-4333-8333-333333333333"),
            frame_size_px: size,
            ground_origin_px: ground,
            frame_count: 2,
            fps: if key == "sprint" { 18 } else { 12 },
            loop_mode: LoopMode::Loop,
            directions: direction_definitions(),
            tracks: explicit_directions()
                .into_iter()
                .map(|direction| MotionTrack {
                    direction,
                    slot_id: SlotId::parse("body").unwrap(),
                    property: TrackProperty::OffsetXPx,
                    interpolation: Interpolation::Linear,
                    keys: vec![
                        Keyframe {
                            frame: 0,
                            value: TrackValue::Number(0.0),
                        },
                        Keyframe {
                            frame: 1,
                            value: TrackValue::Number(1.0),
                        },
                    ],
                })
                .collect(),
            semantics: None,
            published_at: UtcTimestamp::parse("2026-09-05T09:15:00Z").unwrap(),
        },
        root_motion_mode: ExportRootMotionMode::Baked,
        jump_mode: ExportJumpMode::External,
    }
}

fn direction_definitions() -> Vec<DirectionDefinition> {
    Direction::ALL
        .into_iter()
        .map(|direction| match direction {
            Direction::N | Direction::E | Direction::S | Direction::W => DirectionDefinition {
                direction,
                mode: DirectionMode::Explicit,
                source: None,
            },
            Direction::Ne | Direction::Nw => DirectionDefinition {
                direction,
                mode: DirectionMode::Mirrored,
                source: Some(Direction::N),
            },
            Direction::Se | Direction::Sw => DirectionDefinition {
                direction,
                mode: DirectionMode::Mirrored,
                source: Some(Direction::S),
            },
        })
        .collect()
}

fn explicit_directions() -> [Direction; 4] {
    [Direction::N, Direction::E, Direction::S, Direction::W]
}

fn effective(kind: EffectiveSourceKind, reference: RevisionRef, byte: u8) -> EffectiveSource {
    EffectiveSource {
        kind,
        reference,
        content_sha256: Sha256Digest::parse(format!("{byte:02x}").repeat(32)).unwrap(),
    }
}

fn revision(value: &str) -> RevisionRef {
    RevisionRef {
        id: object(value),
        revision: 1,
    }
}

fn object(value: &str) -> ObjectId {
    ObjectId::parse("fixture", value).unwrap()
}
