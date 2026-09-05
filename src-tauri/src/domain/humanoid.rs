use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::{
    Direction, DirectionView, DocumentKind, DomainError, MirrorPair, ObjectId, PixelPoint,
    PixelSize, ProfileRevision, SlotDefinition, SlotId, Transform2D, UtcTimestamp, ViewTransform,
    SCHEMA_VERSION,
};

pub const HUMANOID_PROFILE_VERSION: u32 = 1;
pub const HUMANOID_SLOT_NAMES: [&str; 16] = [
    "torso_lower",
    "torso_upper",
    "head",
    "hair",
    "upper_arm_l",
    "forearm_l",
    "hand_l",
    "upper_arm_r",
    "forearm_r",
    "hand_r",
    "thigh_l",
    "shin_l",
    "foot_l",
    "thigh_r",
    "shin_r",
    "foot_r",
];

const HEIGHT_SLOT_NAMES: [&str; 9] = [
    "head",
    "torso_upper",
    "torso_lower",
    "thigh_l",
    "shin_l",
    "foot_l",
    "thigh_r",
    "shin_r",
    "foot_r",
];
const BASE_HEIGHTS: [u16; 6] = [16, 20, 10, 16, 14, 4];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HumanoidPreviewSlot {
    pub slot_id: SlotId,
    pub optional: bool,
    pub x: i16,
    pub y: i16,
    pub width: u16,
    pub height: u16,
    pub layer: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HumanoidDirectionPreview {
    pub direction: Direction,
    pub slots: Vec<HumanoidPreviewSlot>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HumanoidProfilePreview {
    pub preset_version: u32,
    pub reference_height_px: u16,
    pub measured_height_px: u16,
    pub suggested_frame_size_px: PixelSize,
    pub suggested_ground_origin_px: PixelPoint,
    pub slots: Vec<SlotDefinition>,
    pub views: Vec<DirectionView>,
    pub mirror_pairs: Vec<MirrorPair>,
    pub direction_previews: Vec<HumanoidDirectionPreview>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct HumanoidProfileGenerator;

impl HumanoidProfileGenerator {
    pub fn preview(reference_height_px: u16) -> Result<HumanoidProfilePreview, DomainError> {
        validate_height(reference_height_px)?;
        let parts = generate_profile_parts(reference_height_px)?;
        let direction_previews = build_direction_previews(&parts.slots, &parts.views)?;
        let (minimum, maximum) = neutral_vertical_bounds(&direction_previews)?;
        if minimum != -i32::from(reference_height_px) || maximum != 0 {
            return Err(DomainError::invalid(
                "humanoid_profile.height",
                format!(
                    "generated neutral bounds must be -{reference_height_px}..=0, found {minimum}..={maximum}"
                ),
            ));
        }
        let frame_side = round_scaled(128, reference_height_px).max(1);
        let frame_size = PixelSize(frame_side, frame_side);
        let ground = PixelPoint(
            i16::try_from(frame_side / 2).unwrap_or(i16::MAX),
            round_scaled_signed(108, reference_height_px),
        );
        Ok(HumanoidProfilePreview {
            preset_version: HUMANOID_PROFILE_VERSION,
            reference_height_px,
            measured_height_px: u16::try_from(maximum - minimum).unwrap_or(u16::MAX),
            suggested_frame_size_px: frame_size,
            suggested_ground_origin_px: ground,
            slots: parts.slots,
            views: parts.views,
            mirror_pairs: parts.mirror_pairs,
            direction_previews,
        })
    }

    pub fn generate(
        profile_id: ObjectId,
        area_id: ObjectId,
        revision: u32,
        name: String,
        reference_height_px: u16,
        published_at: UtcTimestamp,
    ) -> Result<ProfileRevision, DomainError> {
        if revision == 0 {
            return Err(DomainError::invalid(
                "profile_revision.revision",
                "must be positive",
            ));
        }
        let preview = Self::preview(reference_height_px)?;
        let profile = ProfileRevision {
            schema_version: SCHEMA_VERSION,
            kind: DocumentKind::ProfileRevision,
            profile_id,
            revision,
            area_id,
            name,
            reference_height_px,
            slots: preview.slots,
            views: preview.views,
            mirror_pairs: preview.mirror_pairs,
            published_at,
        };
        profile.validate_humanoid_v1()?;
        Ok(profile)
    }
}

impl ProfileRevision {
    pub fn validate_humanoid_v1(&self) -> Result<(), DomainError> {
        self.validate()?;
        let expected = HumanoidProfileGenerator::preview(self.reference_height_px)?;
        if self.slots != expected.slots {
            return Err(DomainError::invalid(
                "profile_revision.slots",
                "must match the complete humanoid-v1 slot geometry",
            ));
        }
        if self.views != expected.views {
            return Err(DomainError::invalid(
                "profile_revision.views",
                "must match all humanoid-v1 direction transforms and layer orders",
            ));
        }
        if self.mirror_pairs != expected.mirror_pairs {
            return Err(DomainError::invalid(
                "profile_revision.mirror_pairs",
                "must contain the six humanoid-v1 left/right pairs",
            ));
        }
        let south = self
            .views
            .iter()
            .find(|view| view.direction == Direction::S)
            .expect("base profile validation guarantees a south view");
        for slot in &self.slots {
            let view = south
                .base_transforms
                .iter()
                .find(|item| item.slot_id == slot.id)
                .expect("base profile validation guarantees every view transform");
            if slot.base_transform != view.transform {
                return Err(DomainError::invalid(
                    "profile_revision.slots.base_transform",
                    "is the south-view fallback and must equal its direction transform",
                ));
            }
        }
        Ok(())
    }
}

fn validate_height(height: u16) -> Result<(), DomainError> {
    if !(16..=512).contains(&height) {
        return Err(DomainError::invalid(
            "profile_revision.reference_height_px",
            "must be within 16..=512",
        ));
    }
    Ok(())
}

struct GeneratedProfileParts {
    slots: Vec<SlotDefinition>,
    views: Vec<DirectionView>,
    mirror_pairs: Vec<MirrorPair>,
}

fn generate_profile_parts(height: u16) -> Result<GeneratedProfileParts, DomainError> {
    let heights = allocate_anatomical_heights(height);
    let dimensions = slot_dimensions(height, heights);
    let south_transforms = direction_transforms(Direction::S, height, &dimensions)?;
    let slots = HUMANOID_SLOT_NAMES
        .iter()
        .map(|name| make_slot(name, height, &dimensions, &south_transforms))
        .collect::<Result<Vec<_>, _>>()?;
    let views = Direction::ALL
        .into_iter()
        .map(|direction| make_view(direction, height, &dimensions))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(GeneratedProfileParts {
        slots,
        views,
        mirror_pairs: mirror_pairs()?,
    })
}

fn allocate_anatomical_heights(height: u16) -> [u16; 6] {
    let mut values = BASE_HEIGHTS.map(|base| ((u32::from(height) * u32::from(base)) / 80) as u16);
    for value in &mut values {
        *value = (*value).max(1);
    }
    let mut remaining =
        i32::from(height) - values.iter().map(|value| i32::from(*value)).sum::<i32>();
    let mut order = (0..BASE_HEIGHTS.len()).collect::<Vec<_>>();
    order.sort_by_key(|index| {
        let remainder = (u32::from(height) * u32::from(BASE_HEIGHTS[*index])) % 80;
        (std::cmp::Reverse(remainder), *index)
    });
    while remaining > 0 {
        for index in &order {
            if remaining == 0 {
                break;
            }
            values[*index] += 1;
            remaining -= 1;
        }
    }
    while remaining < 0 {
        for index in order.iter().rev() {
            if remaining == 0 {
                break;
            }
            if values[*index] > 1 {
                values[*index] -= 1;
                remaining += 1;
            }
        }
    }
    values
}

fn slot_dimensions(height: u16, body: [u16; 6]) -> HashMap<&'static str, PixelSize> {
    let [head, torso_upper, torso_lower, thigh, shin, foot] = body;
    HashMap::from([
        (
            "torso_lower",
            PixelSize(round_scaled(20, height), torso_lower),
        ),
        (
            "torso_upper",
            PixelSize(round_scaled(24, height), torso_upper),
        ),
        ("head", PixelSize(round_scaled(18, height), head)),
        ("hair", scaled_size(20, 20, height)),
        ("upper_arm_l", scaled_size(8, 14, height)),
        ("forearm_l", scaled_size(7, 12, height)),
        ("hand_l", scaled_size(8, 6, height)),
        ("upper_arm_r", scaled_size(8, 14, height)),
        ("forearm_r", scaled_size(7, 12, height)),
        ("hand_r", scaled_size(8, 6, height)),
        ("thigh_l", PixelSize(round_scaled(10, height), thigh)),
        ("shin_l", PixelSize(round_scaled(8, height), shin)),
        ("foot_l", PixelSize(round_scaled(12, height), foot)),
        ("thigh_r", PixelSize(round_scaled(10, height), thigh)),
        ("shin_r", PixelSize(round_scaled(8, height), shin)),
        ("foot_r", PixelSize(round_scaled(12, height), foot)),
    ])
}

fn scaled_size(width: u16, height_px: u16, reference_height: u16) -> PixelSize {
    PixelSize(
        round_scaled(width, reference_height).max(1),
        round_scaled(height_px, reference_height).max(1),
    )
}

fn make_slot(
    name: &'static str,
    reference_height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
    south_transforms: &HashMap<&'static str, Transform2D>,
) -> Result<SlotDefinition, DomainError> {
    let size = dimensions[name];
    Ok(SlotDefinition {
        id: slot_id(name)?,
        parent_id: parent_name(name).map(slot_id).transpose()?,
        optional: name == "hair",
        size_px: size,
        pivot_px: slot_pivot(name, size, reference_height),
        base_transform: south_transforms[name],
    })
}

fn parent_name(name: &str) -> Option<&'static str> {
    match name {
        "torso_lower" => None,
        "torso_upper" | "thigh_l" | "thigh_r" => Some("torso_lower"),
        "head" | "upper_arm_l" | "upper_arm_r" => Some("torso_upper"),
        "hair" => Some("head"),
        "forearm_l" => Some("upper_arm_l"),
        "hand_l" => Some("forearm_l"),
        "forearm_r" => Some("upper_arm_r"),
        "hand_r" => Some("forearm_r"),
        "shin_l" => Some("thigh_l"),
        "foot_l" => Some("shin_l"),
        "shin_r" => Some("thigh_r"),
        "foot_r" => Some("shin_r"),
        _ => None,
    }
}

fn slot_pivot(name: &str, size: PixelSize, reference_height: u16) -> PixelPoint {
    let center = i16::try_from(size.0 / 2).unwrap_or(i16::MAX);
    let bottom = i16::try_from(size.1).unwrap_or(i16::MAX);
    match name {
        "torso_lower" | "torso_upper" | "head" | "hair" => PixelPoint(center, bottom),
        "upper_arm_l" | "upper_arm_r" | "forearm_l" | "forearm_r" | "hand_l" | "hand_r" => {
            PixelPoint(center, round_scaled_signed(2, reference_height))
        }
        _ => PixelPoint(center, 0),
    }
}

#[derive(Clone, Copy)]
struct ViewRecipe {
    torso_x: i16,
    head_x: i16,
    shoulder_l: i16,
    shoulder_r: i16,
    hip_l: i16,
    hip_r: i16,
    foot_x: i16,
}

fn view_recipe(direction: Direction) -> ViewRecipe {
    match direction {
        Direction::N | Direction::S => ViewRecipe {
            torso_x: 0,
            head_x: 0,
            shoulder_l: -10,
            shoulder_r: 10,
            hip_l: -5,
            hip_r: 5,
            foot_x: 0,
        },
        Direction::Ne | Direction::Se => ViewRecipe {
            torso_x: 0,
            head_x: 1,
            shoulder_l: -7,
            shoulder_r: 9,
            hip_l: -3,
            hip_r: 5,
            foot_x: 1,
        },
        Direction::E => ViewRecipe {
            torso_x: 1,
            head_x: 2,
            shoulder_l: -2,
            shoulder_r: 4,
            hip_l: -1,
            hip_r: 3,
            foot_x: 2,
        },
        Direction::Nw | Direction::Sw => mirror_recipe(view_recipe(Direction::Ne)),
        Direction::W => mirror_recipe(view_recipe(Direction::E)),
    }
}

fn mirror_recipe(source: ViewRecipe) -> ViewRecipe {
    ViewRecipe {
        torso_x: -source.torso_x,
        head_x: -source.head_x,
        shoulder_l: -source.shoulder_r,
        shoulder_r: -source.shoulder_l,
        hip_l: -source.hip_r,
        hip_r: -source.hip_l,
        foot_x: -source.foot_x,
    }
}

fn direction_transforms(
    direction: Direction,
    height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
) -> Result<HashMap<&'static str, Transform2D>, DomainError> {
    let recipe = view_recipe(direction);
    let mut map = body_transforms(recipe, height, dimensions);
    insert_arm_transforms(
        &mut map,
        ["upper_arm_l", "forearm_l", "hand_l"],
        recipe.shoulder_l,
        height,
        dimensions,
    );
    insert_arm_transforms(
        &mut map,
        ["upper_arm_r", "forearm_r", "hand_r"],
        recipe.shoulder_r,
        height,
        dimensions,
    );
    insert_leg_transforms(
        &mut map,
        ["thigh_l", "shin_l", "foot_l"],
        recipe.hip_l,
        recipe.foot_x,
        height,
        dimensions,
    );
    insert_leg_transforms(
        &mut map,
        ["thigh_r", "shin_r", "foot_r"],
        recipe.hip_r,
        recipe.foot_x,
        height,
        dimensions,
    );
    if map.len() != HUMANOID_SLOT_NAMES.len() {
        return Err(DomainError::invalid(
            "humanoid_profile",
            "incomplete transform recipe",
        ));
    }
    Ok(map)
}

fn body_transforms(
    recipe: ViewRecipe,
    height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
) -> HashMap<&'static str, Transform2D> {
    let leg_height = dimensions["thigh_l"].1 + dimensions["shin_l"].1 + dimensions["foot_l"].1;
    HashMap::from([
        (
            "torso_lower",
            transform(0, -i16::try_from(leg_height).unwrap_or(i16::MAX)),
        ),
        (
            "torso_upper",
            transform(
                round_scaled_signed(recipe.torso_x, height),
                -size_height(dimensions, "torso_lower"),
            ),
        ),
        (
            "head",
            transform(
                round_scaled_signed(recipe.head_x, height),
                -size_height(dimensions, "torso_upper"),
            ),
        ),
        ("hair", transform(0, 0)),
    ])
}

fn insert_arm_transforms(
    map: &mut HashMap<&'static str, Transform2D>,
    slots: [&'static str; 3],
    shoulder_x: i16,
    height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
) {
    let [upper, forearm, hand] = slots;
    let overlap = i16::try_from(round_scaled(2, height).max(1)).unwrap_or(1);
    map.insert(
        upper,
        transform(
            round_scaled_signed(shoulder_x, height),
            -round_scaled_signed(16, height),
        ),
    );
    map.insert(
        forearm,
        transform(0, size_height(dimensions, upper) - overlap),
    );
    map.insert(
        hand,
        transform(0, size_height(dimensions, forearm) - overlap),
    );
}

fn insert_leg_transforms(
    map: &mut HashMap<&'static str, Transform2D>,
    slots: [&'static str; 3],
    hip_x: i16,
    foot_x: i16,
    height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
) {
    let [thigh, shin, foot] = slots;
    map.insert(thigh, transform(round_scaled_signed(hip_x, height), 0));
    map.insert(shin, transform(0, size_height(dimensions, thigh)));
    map.insert(
        foot,
        transform(
            round_scaled_signed(foot_x, height),
            size_height(dimensions, shin),
        ),
    );
}

fn size_height(dimensions: &HashMap<&'static str, PixelSize>, name: &str) -> i16 {
    i16::try_from(dimensions[name].1).unwrap_or(i16::MAX)
}

fn transform(x: i16, y: i16) -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(x, y),
        rotation_deg: 0.0,
    }
}

fn make_view(
    direction: Direction,
    height: u16,
    dimensions: &HashMap<&'static str, PixelSize>,
) -> Result<DirectionView, DomainError> {
    let transforms = direction_transforms(direction, height, dimensions)?;
    Ok(DirectionView {
        direction,
        layer_order: layer_names(direction)
            .into_iter()
            .map(slot_id)
            .collect::<Result<Vec<_>, _>>()?,
        base_transforms: HUMANOID_SLOT_NAMES
            .iter()
            .map(|name| {
                Ok(ViewTransform {
                    slot_id: slot_id(name)?,
                    transform: transforms[name],
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?,
    })
}

fn layer_names(direction: Direction) -> Vec<&'static str> {
    let left_arm = ["upper_arm_l", "forearm_l", "hand_l"];
    let right_arm = ["upper_arm_r", "forearm_r", "hand_r"];
    let left_leg = ["thigh_l", "shin_l", "foot_l"];
    let right_leg = ["thigh_r", "shin_r", "foot_r"];
    let names = match direction {
        Direction::N => [
            left_arm.as_slice(),
            right_arm.as_slice(),
            left_leg.as_slice(),
            right_leg.as_slice(),
            &["torso_lower", "torso_upper", "head", "hair"],
        ]
        .concat(),
        Direction::Ne => [
            left_leg.as_slice(),
            left_arm.as_slice(),
            &["torso_lower"],
            right_leg.as_slice(),
            &["torso_upper", "head", "hair"],
            right_arm.as_slice(),
        ]
        .concat(),
        Direction::E => [
            left_leg.as_slice(),
            left_arm.as_slice(),
            &["torso_lower", "torso_upper", "head", "hair"],
            right_leg.as_slice(),
            right_arm.as_slice(),
        ]
        .concat(),
        Direction::Se => [
            left_leg.as_slice(),
            left_arm.as_slice(),
            &["torso_lower"],
            right_leg.as_slice(),
            &["torso_upper", "hair", "head"],
            right_arm.as_slice(),
        ]
        .concat(),
        Direction::S => [
            left_leg.as_slice(),
            right_leg.as_slice(),
            &[
                "upper_arm_l",
                "upper_arm_r",
                "torso_lower",
                "torso_upper",
                "hair",
                "head",
                "forearm_l",
                "hand_l",
                "forearm_r",
                "hand_r",
            ],
        ]
        .concat(),
        Direction::Nw => mirror_layer_names(layer_names(Direction::Ne)),
        Direction::W => mirror_layer_names(layer_names(Direction::E)),
        Direction::Sw => mirror_layer_names(layer_names(Direction::Se)),
    };
    names
}

fn mirror_layer_names(names: Vec<&'static str>) -> Vec<&'static str> {
    names
        .into_iter()
        .map(|name| match name {
            "upper_arm_l" => "upper_arm_r",
            "forearm_l" => "forearm_r",
            "hand_l" => "hand_r",
            "thigh_l" => "thigh_r",
            "shin_l" => "shin_r",
            "foot_l" => "foot_r",
            "upper_arm_r" => "upper_arm_l",
            "forearm_r" => "forearm_l",
            "hand_r" => "hand_l",
            "thigh_r" => "thigh_l",
            "shin_r" => "shin_l",
            "foot_r" => "foot_l",
            other => other,
        })
        .collect()
}

fn mirror_pairs() -> Result<Vec<MirrorPair>, DomainError> {
    [
        ("upper_arm_l", "upper_arm_r"),
        ("forearm_l", "forearm_r"),
        ("hand_l", "hand_r"),
        ("thigh_l", "thigh_r"),
        ("shin_l", "shin_r"),
        ("foot_l", "foot_r"),
    ]
    .into_iter()
    .map(|(left, right)| {
        Ok(MirrorPair {
            left: slot_id(left)?,
            right: slot_id(right)?,
        })
    })
    .collect()
}

fn build_direction_previews(
    slots: &[SlotDefinition],
    views: &[DirectionView],
) -> Result<Vec<HumanoidDirectionPreview>, DomainError> {
    views
        .iter()
        .map(|view| build_direction_preview(slots, view))
        .collect()
}

fn build_direction_preview(
    slots: &[SlotDefinition],
    view: &DirectionView,
) -> Result<HumanoidDirectionPreview, DomainError> {
    let slot_map = slots
        .iter()
        .map(|slot| (slot.id.as_str(), slot))
        .collect::<HashMap<_, _>>();
    let transform_map = view
        .base_transforms
        .iter()
        .map(|item| (item.slot_id.as_str(), item.transform))
        .collect::<HashMap<_, _>>();
    let mut positions = HashMap::new();
    let mut output = Vec::with_capacity(slots.len());
    for (layer, id) in view.layer_order.iter().enumerate() {
        let slot = slot_map[id.as_str()];
        let (world_x, world_y) =
            world_position(id.as_str(), &slot_map, &transform_map, &mut positions)?;
        output.push(HumanoidPreviewSlot {
            slot_id: id.clone(),
            optional: slot.optional,
            x: checked_i16(world_x - i32::from(slot.pivot_px.0))?,
            y: checked_i16(world_y - i32::from(slot.pivot_px.1))?,
            width: slot.size_px.0,
            height: slot.size_px.1,
            layer: u8::try_from(layer).unwrap_or(u8::MAX),
        });
    }
    Ok(HumanoidDirectionPreview {
        direction: view.direction,
        slots: output,
    })
}

fn world_position(
    name: &str,
    slots: &HashMap<&str, &SlotDefinition>,
    transforms: &HashMap<&str, Transform2D>,
    memo: &mut HashMap<String, (i32, i32)>,
) -> Result<(i32, i32), DomainError> {
    if let Some(position) = memo.get(name) {
        return Ok(*position);
    }
    let local = transforms[name].offset_px;
    let parent = slots[name].parent_id.as_ref();
    let parent_position = if let Some(parent) = parent {
        world_position(parent.as_str(), slots, transforms, memo)?
    } else {
        (0, 0)
    };
    let position = (
        parent_position.0 + i32::from(local.0),
        parent_position.1 + i32::from(local.1),
    );
    memo.insert(name.to_owned(), position);
    Ok(position)
}

fn neutral_vertical_bounds(
    previews: &[HumanoidDirectionPreview],
) -> Result<(i32, i32), DomainError> {
    let south = previews
        .iter()
        .find(|preview| preview.direction == Direction::S)
        .ok_or_else(|| DomainError::invalid("humanoid_profile.views", "south view is missing"))?;
    let selected = south
        .slots
        .iter()
        .filter(|slot| HEIGHT_SLOT_NAMES.contains(&slot.slot_id.as_str()))
        .collect::<Vec<_>>();
    let minimum = selected
        .iter()
        .map(|slot| i32::from(slot.y))
        .min()
        .unwrap_or(0);
    let maximum = selected
        .iter()
        .map(|slot| i32::from(slot.y) + i32::from(slot.height))
        .max()
        .unwrap_or(0);
    Ok((minimum, maximum))
}

fn checked_i16(value: i32) -> Result<i16, DomainError> {
    i16::try_from(value)
        .map_err(|_| DomainError::invalid("humanoid_profile", "coordinate overflow"))
}

fn slot_id(name: &str) -> Result<SlotId, DomainError> {
    SlotId::parse(name)
}

fn round_scaled(value: u16, height: u16) -> u16 {
    ((u32::from(value) * u32::from(height) + 40) / 80) as u16
}

fn round_scaled_signed(value: i16, height: u16) -> i16 {
    let magnitude = round_scaled(value.unsigned_abs(), height);
    let scaled = i16::try_from(magnitude).unwrap_or(i16::MAX);
    if value.is_negative() {
        -scaled
    } else {
        scaled
    }
}

#[cfg(test)]
#[path = "humanoid_tests.rs"]
mod tests;
