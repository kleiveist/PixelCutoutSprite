use std::collections::HashMap;

use crate::domain::{
    Direction, DirectionDefinition, DirectionMode, DirectionView, MotionRevision, ProfileRevision,
    RevisionRef, SlotDefinition, SlotId,
};
use crate::render::RenderTransform;

use super::{DirectionError, DirectionalPose, ResolvedDirection, ResolvedPose, ResolvedPoseSlot};

#[derive(Debug)]
pub struct DirectionResolver<'a> {
    definitions: HashMap<Direction, DirectionDefinition>,
    profile: &'a ProfileRevision,
    views: HashMap<Direction, &'a DirectionView>,
    slots: HashMap<SlotId, &'a SlotDefinition>,
    mirrored_slots: HashMap<SlotId, SlotId>,
}

impl<'a> DirectionResolver<'a> {
    pub fn new(
        motion: &MotionRevision,
        profile: &'a ProfileRevision,
    ) -> Result<Self, DirectionError> {
        profile
            .validate()
            .map_err(|error| DirectionError::InvalidProfile(error.to_string()))?;
        if motion.profile_ref != profile.reference() {
            return Err(DirectionError::ProfileMismatch);
        }

        let definitions = collect_definitions(&motion.directions)?;
        validate_definition_shapes(&definitions)?;
        validate_cycles(&definitions)?;

        let views = profile
            .views
            .iter()
            .map(|view| (view.direction, view))
            .collect::<HashMap<_, _>>();
        for direction in Direction::ALL {
            if !views.contains_key(&direction) {
                return Err(DirectionError::MissingProfileView(direction));
            }
        }
        let slots = profile
            .slots
            .iter()
            .map(|slot| (slot.id.clone(), slot))
            .collect::<HashMap<_, _>>();
        let mut mirrored_slots = HashMap::new();
        for pair in &profile.mirror_pairs {
            mirrored_slots.insert(pair.left.clone(), pair.right.clone());
            mirrored_slots.insert(pair.right.clone(), pair.left.clone());
        }

        Ok(Self {
            definitions,
            profile,
            views,
            slots,
            mirrored_slots,
        })
    }

    pub fn profile_reference(&self) -> RevisionRef {
        self.profile.reference()
    }

    pub fn definition(&self, direction: Direction) -> &DirectionDefinition {
        // Construction verifies that every named direction exists.
        &self.definitions[&direction]
    }

    pub fn resolve(&self, target: Direction) -> Result<ResolvedDirection, DirectionError> {
        let mut current = target;
        let mut path = Vec::new();
        let mut mirror_count = 0;
        loop {
            if let Some(position) = path.iter().position(|seen| *seen == current) {
                path.push(current);
                return Err(DirectionError::MirrorCycle {
                    path: format_direction_path(&path[position..]),
                });
            }
            path.push(current);
            let definition = self
                .definitions
                .get(&current)
                .ok_or(DirectionError::MissingDefinition(current))?;
            match definition.mode {
                DirectionMode::Explicit => {
                    return Ok(ResolvedDirection {
                        target,
                        source: current,
                        mirror_count,
                        pose_mirrored: mirror_count % 2 == 1,
                    });
                }
                DirectionMode::Missing if current == target => {
                    return Err(DirectionError::MissingDirection(target));
                }
                DirectionMode::Missing => {
                    return Err(DirectionError::MissingMirrorEndpoint {
                        target,
                        source_direction: current,
                    });
                }
                DirectionMode::Mirrored => {
                    current = definition
                        .source
                        .ok_or(DirectionError::MissingMirrorSource(current))?;
                    mirror_count += 1;
                }
            }
        }
    }

    pub fn resolve_pose(
        &self,
        target: Direction,
        source_pose: &DirectionalPose,
    ) -> Result<ResolvedPose, DirectionError> {
        let resolution = self.resolve(target)?;
        if source_pose.direction != resolution.source {
            return Err(DirectionError::PoseSourceMismatch {
                expected: resolution.source,
                found: source_pose.direction,
            });
        }

        let mut sampled = HashMap::new();
        for slot in &source_pose.slots {
            if !self.slots.contains_key(&slot.slot_id) {
                return Err(DirectionError::UnknownPoseSlot(slot.slot_id.clone()));
            }
            if sampled.insert(slot.slot_id.clone(), slot).is_some() {
                return Err(DirectionError::DuplicatePoseSlot(slot.slot_id.clone()));
            }
        }
        for slot_id in self.slots.keys() {
            if !sampled.contains_key(slot_id) {
                return Err(DirectionError::MissingPoseSlot(slot_id.clone()));
            }
        }

        let view = self
            .views
            .get(&target)
            .copied()
            .ok_or(DirectionError::MissingProfileView(target))?;
        let transforms = view
            .base_transforms
            .iter()
            .map(|entry| (&entry.slot_id, entry.transform))
            .collect::<HashMap<_, _>>();
        let mut slots = Vec::with_capacity(view.layer_order.len());
        for (base_layer, target_slot_id) in view.layer_order.iter().enumerate() {
            let source_slot_id = if resolution.pose_mirrored {
                self.mirror_slot(target_slot_id)
            } else {
                target_slot_id.clone()
            };
            let source = sampled
                .get(&source_slot_id)
                .copied()
                .ok_or_else(|| DirectionError::MissingPoseSlot(source_slot_id.clone()))?;
            let definition = self
                .slots
                .get(target_slot_id)
                .copied()
                .ok_or_else(|| DirectionError::UnknownPoseSlot(target_slot_id.clone()))?;
            let profile = transforms.get(target_slot_id).copied().ok_or_else(|| {
                DirectionError::MissingProfileTransform {
                    direction: target,
                    slot_id: target_slot_id.clone(),
                }
            })?;
            let motion = if resolution.pose_mirrored {
                mirror_transform_x(source.motion)
            } else {
                source.motion
            };
            let base_layer = i32::try_from(base_layer).expect("profile slot count fits i32");
            slots.push(ResolvedPoseSlot {
                slot_id: target_slot_id.clone(),
                parent_id: definition.parent_id.clone(),
                profile: RenderTransform::from(profile),
                motion,
                visible: source.visible,
                sprite_variant: source.sprite_variant.clone(),
                base_layer,
                layer: base_layer.saturating_add(source.layer_delta),
            });
        }
        // PixelCompositor uses input order as its tie breaker. Sorting here therefore preserves
        // the target view's base order when two discrete layer deltas produce the same layer.
        slots.sort_by_key(|slot| (slot.layer, slot.base_layer));
        Ok(ResolvedPose {
            direction: target,
            source_direction: resolution.source,
            pose_mirrored: resolution.pose_mirrored,
            slots,
        })
    }

    pub fn mirror_slot(&self, slot_id: &SlotId) -> SlotId {
        self.mirrored_slots
            .get(slot_id)
            .cloned()
            .unwrap_or_else(|| slot_id.clone())
    }
}

pub fn horizontal_mirror(direction: Direction) -> Direction {
    match direction {
        Direction::N => Direction::N,
        Direction::Ne => Direction::Nw,
        Direction::E => Direction::W,
        Direction::Se => Direction::Sw,
        Direction::S => Direction::S,
        Direction::Sw => Direction::Se,
        Direction::W => Direction::E,
        Direction::Nw => Direction::Ne,
    }
}

pub fn mirror_transform_x(transform: RenderTransform) -> RenderTransform {
    RenderTransform {
        offset_x: -transform.offset_x,
        offset_y: transform.offset_y,
        rotation_deg: -transform.rotation_deg,
    }
}

fn collect_definitions(
    definitions: &[DirectionDefinition],
) -> Result<HashMap<Direction, DirectionDefinition>, DirectionError> {
    let mut result = HashMap::new();
    for definition in definitions {
        if result.insert(definition.direction, *definition).is_some() {
            return Err(DirectionError::DuplicateDefinition(definition.direction));
        }
    }
    for direction in Direction::ALL {
        if !result.contains_key(&direction) {
            return Err(DirectionError::MissingDefinition(direction));
        }
    }
    Ok(result)
}

fn validate_definition_shapes(
    definitions: &HashMap<Direction, DirectionDefinition>,
) -> Result<(), DirectionError> {
    for direction in Direction::ALL {
        let definition = &definitions[&direction];
        match (definition.mode, definition.source) {
            (DirectionMode::Explicit | DirectionMode::Missing, Some(_)) => {
                return Err(DirectionError::UnexpectedMirrorSource(direction));
            }
            (DirectionMode::Explicit | DirectionMode::Missing, None) => {}
            (DirectionMode::Mirrored, None) => {
                return Err(DirectionError::MissingMirrorSource(direction));
            }
            (DirectionMode::Mirrored, Some(source)) => {
                if matches!(direction, Direction::N | Direction::S) {
                    return Err(DirectionError::FrontBackMirror(direction));
                }
                let expected = horizontal_mirror(direction);
                if source != expected {
                    return Err(DirectionError::InvalidHorizontalMirror {
                        target: direction,
                        source_direction: source,
                        expected,
                    });
                }
            }
        }
    }
    Ok(())
}

fn validate_cycles(
    definitions: &HashMap<Direction, DirectionDefinition>,
) -> Result<(), DirectionError> {
    for start in Direction::ALL {
        let mut path = Vec::new();
        let mut current = start;
        loop {
            if let Some(position) = path.iter().position(|seen| *seen == current) {
                path.push(current);
                return Err(DirectionError::MirrorCycle {
                    path: format_direction_path(&path[position..]),
                });
            }
            path.push(current);
            match definitions[&current] {
                DirectionDefinition {
                    mode: DirectionMode::Mirrored,
                    source: Some(source),
                    ..
                } => current = source,
                _ => break,
            }
        }
    }
    Ok(())
}

fn format_direction_path(path: &[Direction]) -> String {
    path.iter()
        .map(|direction| format!("{direction:?}").to_ascii_lowercase())
        .collect::<Vec<_>>()
        .join(" -> ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn horizontal_mirror_keeps_front_and_back_distinct() {
        assert_eq!(horizontal_mirror(Direction::N), Direction::N);
        assert_eq!(horizontal_mirror(Direction::S), Direction::S);
        assert_eq!(horizontal_mirror(Direction::Ne), Direction::Nw);
        assert_eq!(horizontal_mirror(Direction::E), Direction::W);
        assert_eq!(horizontal_mirror(Direction::Se), Direction::Sw);
    }

    #[test]
    fn mirror_transform_is_an_involution() {
        let original = RenderTransform::new(-3.5, 2.25, 47.0).unwrap();
        assert_eq!(mirror_transform_x(mirror_transform_x(original)), original);
    }
}
