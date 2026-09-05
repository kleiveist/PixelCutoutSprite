use std::collections::HashMap;

use super::*;

#[derive(serde::Deserialize)]
struct ReferenceFixture {
    preset_version: u32,
    reference_height_px: u16,
    measured_height_px: u16,
    suggested_frame_size_px: PixelSize,
    suggested_ground_origin_px: PixelPoint,
    slots: Vec<ReferenceSlot>,
    mirror_pairs: Vec<[String; 2]>,
    layer_orders: Vec<ReferenceLayers>,
}

#[derive(serde::Deserialize)]
struct ReferenceSlot {
    id: String,
    parent_id: Option<String>,
    optional: bool,
    size_px: PixelSize,
    pivot_px: PixelPoint,
}

#[derive(serde::Deserialize)]
struct ReferenceLayers {
    direction: Direction,
    slots: Vec<String>,
}

#[test]
fn documented_eighty_pixel_fixture_matches_the_generator() {
    let reference: ReferenceFixture = serde_json::from_str(include_str!(
        "../../tests/fixtures/profiles/humanoid-v1-80-reference.json"
    ))
    .unwrap();
    let preview = HumanoidProfileGenerator::preview(80).unwrap();
    assert_eq!(preview.preset_version, reference.preset_version);
    assert_eq!(preview.reference_height_px, reference.reference_height_px);
    assert_eq!(preview.measured_height_px, reference.measured_height_px);
    assert_eq!(
        preview.suggested_frame_size_px,
        reference.suggested_frame_size_px
    );
    assert_eq!(
        preview.suggested_ground_origin_px,
        reference.suggested_ground_origin_px
    );
    assert_eq!(preview.slots.len(), reference.slots.len());
    for (actual, expected) in preview.slots.iter().zip(reference.slots) {
        assert_eq!(actual.id.as_str(), expected.id);
        assert_eq!(
            actual.parent_id.as_ref().map(SlotId::as_str),
            expected.parent_id.as_deref()
        );
        assert_eq!(actual.optional, expected.optional);
        assert_eq!(actual.size_px, expected.size_px);
        assert_eq!(actual.pivot_px, expected.pivot_px);
    }
    let pairs = preview
        .mirror_pairs
        .iter()
        .map(|pair| [pair.left.to_string(), pair.right.to_string()])
        .collect::<Vec<_>>();
    assert_eq!(pairs, reference.mirror_pairs);
    assert_eq!(preview.views.len(), reference.layer_orders.len());
    for (actual, expected) in preview.views.iter().zip(reference.layer_orders) {
        assert_eq!(actual.direction, expected.direction);
        assert_eq!(
            actual
                .layer_order
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>(),
            expected.slots
        );
    }
}

#[test]
fn eighty_pixel_profile_has_the_documented_geometry() {
    let preview = HumanoidProfileGenerator::preview(80).unwrap();
    assert_eq!(preview.measured_height_px, 80);
    assert_eq!(preview.slots.len(), 16);
    assert_eq!(preview.views.len(), 8);
    assert_eq!(preview.mirror_pairs.len(), 6);
    let sizes = preview
        .slots
        .iter()
        .map(|slot| (slot.id.as_str(), slot.size_px))
        .collect::<HashMap<_, _>>();
    assert_eq!(sizes["head"], PixelSize(18, 16));
    assert_eq!(sizes["torso_upper"], PixelSize(24, 20));
    assert_eq!(sizes["torso_lower"], PixelSize(20, 10));
    assert_eq!(sizes["thigh_l"], PixelSize(10, 16));
    assert_eq!(sizes["shin_l"], PixelSize(8, 14));
    assert_eq!(sizes["foot_l"], PixelSize(12, 4));
    assert_eq!(preview.slots.iter().filter(|slot| slot.optional).count(), 1);
    assert!(
        preview
            .slots
            .iter()
            .find(|slot| slot.id.as_str() == "hair")
            .unwrap()
            .optional
    );
}

#[test]
fn every_supported_height_is_integer_and_exact() {
    for height in 16..=512 {
        let preview = HumanoidProfileGenerator::preview(height).unwrap();
        assert_eq!(preview.measured_height_px, height);
        assert!(preview
            .slots
            .iter()
            .all(|slot| slot.size_px.0 > 0 && slot.size_px.1 > 0));
        assert!(preview
            .direction_previews
            .iter()
            .all(|view| view.slots.len() == 16));
    }
    assert!(HumanoidProfileGenerator::preview(15).is_err());
    assert!(HumanoidProfileGenerator::preview(513).is_err());
}

#[test]
fn mirrored_views_swap_pairs_and_negate_view_offsets() {
    let preview = HumanoidProfileGenerator::preview(80).unwrap();
    let view = |direction| {
        preview
            .views
            .iter()
            .find(|view| view.direction == direction)
            .unwrap()
    };
    for (east, west) in [
        (Direction::Ne, Direction::Nw),
        (Direction::E, Direction::W),
        (Direction::Se, Direction::Sw),
    ] {
        let east = view(east);
        let west = view(west);
        assert_eq!(west.layer_order, mirror_layer_ids(&east.layer_order));
        let west_map = west
            .base_transforms
            .iter()
            .map(|item| (item.slot_id.as_str(), item.transform.offset_px.0))
            .collect::<HashMap<_, _>>();
        for item in &east.base_transforms {
            let mirrored = mirror_name(item.slot_id.as_str());
            assert_eq!(west_map[mirrored], -item.transform.offset_px.0);
        }
    }
}

fn mirror_layer_ids(ids: &[SlotId]) -> Vec<SlotId> {
    ids.iter()
        .map(|id| slot_id(mirror_name(id.as_str())).unwrap())
        .collect()
}

fn mirror_name(name: &str) -> &str {
    match name {
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
    }
}
