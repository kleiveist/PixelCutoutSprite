use std::collections::HashSet;

use crate::domain::{
    Direction, DirectionDefinition, DirectionMode, MotionRevision, MotionTrack, ProfileRevision,
    TrackProperty, TrackValue,
};

use super::{DirectionError, DirectionResolver};

#[derive(Debug, Clone, PartialEq)]
pub struct DetachedDirection {
    pub direction: Direction,
    pub source_direction: Direction,
    pub definitions: Vec<DirectionDefinition>,
    pub tracks: Vec<MotionTrack>,
    pub copied_track_count: usize,
    pub replaced_track_count: usize,
}

/// Produces one atomic editor result for turning a derived direction into editable source data.
/// Callers store the returned definitions and tracks in a mutable draft; released revisions are
/// never modified by this function.
pub fn detach_to_explicit(
    motion: &MotionRevision,
    profile: &ProfileRevision,
    target: Direction,
) -> Result<DetachedDirection, DirectionError> {
    let resolver = DirectionResolver::new(motion, profile)?;
    if resolver.definition(target).mode != DirectionMode::Mirrored {
        return Err(DirectionError::DirectionNotMirrored(target));
    }
    let resolution = resolver.resolve(target)?;

    let mut definitions = motion.directions.clone();
    let target_definition = definitions
        .iter_mut()
        .find(|definition| definition.direction == target)
        .ok_or(DirectionError::MissingDefinition(target))?;
    target_definition.mode = DirectionMode::Explicit;
    target_definition.source = None;

    let replaced_track_count = motion
        .tracks
        .iter()
        .filter(|track| track.direction == target)
        .count();
    let mut tracks = motion
        .tracks
        .iter()
        .filter(|track| track.direction != target)
        .cloned()
        .collect::<Vec<_>>();
    let copied = motion
        .tracks
        .iter()
        .filter(|track| track.direction == resolution.source)
        .map(|track| detach_track(track, &resolver, target, resolution.pose_mirrored))
        .collect::<Vec<_>>();
    let copied_track_count = copied.len();
    tracks.extend(copied);

    let mut candidate = motion.clone();
    candidate.directions = definitions.clone();
    candidate.tracks = tracks.clone();
    let profile_slots = profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    candidate
        .validate(Some(&profile_slots))
        .map_err(|error| DirectionError::InvalidDetachedData(error.to_string()))?;

    Ok(DetachedDirection {
        direction: target,
        source_direction: resolution.source,
        definitions,
        tracks,
        copied_track_count,
        replaced_track_count,
    })
}

fn detach_track(
    track: &MotionTrack,
    resolver: &DirectionResolver<'_>,
    target: Direction,
    mirrored: bool,
) -> MotionTrack {
    let mut copied = track.clone();
    copied.direction = target;
    if mirrored {
        copied.slot_id = resolver.mirror_slot(&track.slot_id);
        if matches!(
            copied.property,
            TrackProperty::OffsetXPx | TrackProperty::RotationDeg
        ) {
            for key in &mut copied.keys {
                if let TrackValue::Number(value) = &mut key.value {
                    *value = -*value;
                }
            }
        }
    }
    copied
}
