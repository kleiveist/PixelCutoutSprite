use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::{
    ensure_exact_directions, ensure_unique_ids, validate_kind_revision, validate_name,
    validate_schema, ActionKey, Direction, DocumentKind, DomainError, ObjectId, PixelPoint,
    PixelSize, RevisionRef, SlotId, UtcTimestamp,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TemplateStatus {
    Active,
    Archived,
}

impl TemplateStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Active, Self::Archived) | (Self::Archived, Self::Active)
        ) || self == next
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MotionTemplate {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub name: String,
    pub action_key: ActionKey,
    pub status: TemplateStatus,
    pub label_ids: Vec<ObjectId>,
    pub draft_revision: u32,
    pub draft_base_release: Option<u32>,
    pub released_revisions: Vec<u32>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl MotionTemplate {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::MotionTemplate,
            self.revision,
            "motion_template",
        )?;
        validate_name("motion_template.name", &self.name)?;
        ActionKey::parse(self.action_key.as_str())?;
        if self.draft_revision == 0 {
            return Err(DomainError::invalid(
                "motion_template.draft_revision",
                "must be positive",
            ));
        }
        let revisions = self
            .released_revisions
            .iter()
            .copied()
            .collect::<HashSet<_>>();
        if revisions.len() != self.released_revisions.len() || self.released_revisions.contains(&0)
        {
            return Err(DomainError::invalid(
                "motion_template.released_revisions",
                "must contain unique positive revisions",
            ));
        }
        if self
            .draft_base_release
            .is_some_and(|revision| !revisions.contains(&revision))
        {
            return Err(DomainError::invalid(
                "motion_template.draft_base_release",
                "must reference one of the immutable released revisions",
            ));
        }
        ensure_unique_ids("motion_template.label_ids", &self.label_ids)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoopMode {
    Loop,
    Once,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirectionMode {
    Explicit,
    Mirrored,
    Missing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DirectionDefinition {
    pub direction: Direction,
    pub mode: DirectionMode,
    pub source: Option<Direction>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrackProperty {
    OffsetXPx,
    OffsetYPx,
    RotationDeg,
    Visible,
    SpriteVariant,
    LayerDelta,
}

impl TrackProperty {
    fn is_discrete(self) -> bool {
        matches!(self, Self::Visible | Self::SpriteVariant | Self::LayerDelta)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Interpolation {
    Linear,
    Hold,
    EaseInOut,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TrackValue {
    Boolean(bool),
    Text(String),
    Number(f64),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Keyframe {
    pub frame: u16,
    pub value: TrackValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MotionTrack {
    pub direction: Direction,
    pub slot_id: SlotId,
    pub property: TrackProperty,
    pub interpolation: Interpolation,
    pub keys: Vec<Keyframe>,
}

impl MotionTrack {
    fn validate(&self, path: &str, frame_count: u16) -> Result<(), DomainError> {
        SlotId::parse(self.slot_id.as_str())?;
        if self.keys.is_empty() {
            return Err(DomainError::invalid(
                format!("{path}.keys"),
                "must contain at least one keyframe",
            ));
        }
        if self.property.is_discrete() && self.interpolation != Interpolation::Hold {
            return Err(DomainError::invalid(
                format!("{path}.interpolation"),
                "discrete tracks must use hold interpolation",
            ));
        }
        let mut frames = HashSet::new();
        let mut previous = None;
        for (index, key) in self.keys.iter().enumerate() {
            if key.frame >= frame_count
                || !frames.insert(key.frame)
                || previous.is_some_and(|prior| key.frame <= prior)
            {
                return Err(DomainError::invalid(
                    format!("{path}.keys[{index}].frame"),
                    "must be strictly increasing, unique, and inside the frame sequence",
                ));
            }
            previous = Some(key.frame);
            validate_track_value(self.property, &key.value, &format!("{path}.keys[{index}]"))?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MotionRevision {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub template_id: ObjectId,
    pub revision: u32,
    pub profile_ref: RevisionRef,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: LoopMode,
    pub directions: Vec<DirectionDefinition>,
    pub tracks: Vec<MotionTrack>,
    pub published_at: UtcTimestamp,
}

impl MotionRevision {
    pub fn reference(&self) -> RevisionRef {
        RevisionRef {
            id: self.template_id,
            revision: self.revision,
        }
    }

    pub fn validate(&self, profile_slots: Option<&HashSet<SlotId>>) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::MotionRevision,
            self.revision,
            "motion_revision",
        )?;
        self.profile_ref.validate("motion_revision.profile_ref")?;
        self.frame_size_px
            .validate("motion_revision.frame_size_px")?;
        self.ground_origin_px
            .validate("motion_revision.ground_origin_px")?;
        if !(1..=1024).contains(&self.frame_count) {
            return Err(DomainError::invalid(
                "motion_revision.frame_count",
                "must be within 1..=1024",
            ));
        }
        if !(1..=120).contains(&self.fps) {
            return Err(DomainError::invalid(
                "motion_revision.fps",
                "must be within 1..=120",
            ));
        }
        self.validate_directions()?;
        let mut channels = HashSet::new();
        for (index, track) in self.tracks.iter().enumerate() {
            track.validate(
                &format!("motion_revision.tracks[{index}]"),
                self.frame_count,
            )?;
            if profile_slots.is_some_and(|slots| !slots.contains(&track.slot_id)) {
                return Err(DomainError::MissingReference {
                    path: format!("motion_revision.tracks[{index}].slot_id"),
                    target: track.slot_id.to_string(),
                });
            }
            if !channels.insert((track.direction, track.slot_id.clone(), track.property)) {
                return Err(DomainError::DuplicateId(format!(
                    "motion_revision.track:{:?}:{}:{:?}",
                    track.direction, track.slot_id, track.property
                )));
            }
        }
        Ok(())
    }

    fn validate_directions(&self) -> Result<(), DomainError> {
        let directions = self
            .directions
            .iter()
            .map(|definition| definition.direction)
            .collect::<Vec<_>>();
        ensure_exact_directions("motion_revision.directions", &directions)?;
        let sources = self
            .directions
            .iter()
            .map(|definition| (definition.direction, (definition.mode, definition.source)))
            .collect::<HashMap<_, _>>();
        for direction in Direction::ALL {
            ensure_no_direction_cycle(direction, &sources)?;
        }
        Ok(())
    }
}

fn validate_track_value(
    property: TrackProperty,
    value: &TrackValue,
    path: &str,
) -> Result<(), DomainError> {
    let valid = match (property, value) {
        (TrackProperty::Visible, TrackValue::Boolean(_)) => true,
        (TrackProperty::SpriteVariant, TrackValue::Text(value)) => {
            !value.is_empty() && value.len() <= 64
        }
        (TrackProperty::LayerDelta, TrackValue::Number(value)) => {
            value.is_finite() && value.fract() == 0.0 && (-64.0..=64.0).contains(value)
        }
        (
            TrackProperty::OffsetXPx | TrackProperty::OffsetYPx | TrackProperty::RotationDeg,
            TrackValue::Number(value),
        ) => value.is_finite() && (-4096.0..=4096.0).contains(value),
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err(DomainError::invalid(
            format!("{path}.value"),
            "value type or range does not match its track property",
        ))
    }
}

fn ensure_no_direction_cycle(
    start: Direction,
    sources: &HashMap<Direction, (DirectionMode, Option<Direction>)>,
) -> Result<(), DomainError> {
    let mut path = Vec::new();
    let mut current = start;
    loop {
        if let Some(position) = path.iter().position(|seen| *seen == current) {
            path.push(current);
            return Err(DomainError::Cycle {
                relation: "direction mirrors",
                path: path[position..]
                    .iter()
                    .map(|direction| format!("{direction:?}").to_ascii_lowercase())
                    .collect::<Vec<_>>()
                    .join(" -> "),
            });
        }
        path.push(current);
        match sources.get(&current) {
            Some((DirectionMode::Mirrored, Some(source))) => current = *source,
            Some((DirectionMode::Mirrored, None)) => {
                return Err(DomainError::MissingReference {
                    path: format!("motion_revision.direction.{current:?}.source"),
                    target: "mirror source".to_owned(),
                })
            }
            Some((DirectionMode::Explicit, None)) => return Ok(()),
            Some((DirectionMode::Missing, None)) if path.len() == 1 => return Ok(()),
            Some((DirectionMode::Missing, None)) => {
                return Err(DomainError::MissingReference {
                    path: format!("motion_revision.direction.{start:?}.source"),
                    target: format!("{current:?}").to_ascii_lowercase(),
                })
            }
            Some((DirectionMode::Explicit | DirectionMode::Missing, Some(_))) => {
                return Err(DomainError::invalid(
                    format!("motion_revision.direction.{current:?}.source"),
                    "only mirrored directions may define a source",
                ))
            }
            None => {
                return Err(DomainError::MissingReference {
                    path: format!("motion_revision.direction.{current:?}"),
                    target: format!("{current:?}").to_ascii_lowercase(),
                })
            }
        }
    }
}
