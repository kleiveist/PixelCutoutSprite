use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::{
    ensure_exact_directions, validate_kind_revision, validate_schema, Direction, DocumentKind,
    DomainError, ObjectId, PixelPoint, PixelSize, SlotId, Transform2D, UtcTimestamp,
};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SlotDefinition {
    pub id: SlotId,
    pub parent_id: Option<SlotId>,
    pub optional: bool,
    pub size_px: PixelSize,
    pub pivot_px: PixelPoint,
    pub base_transform: Transform2D,
}

impl SlotDefinition {
    fn validate(&self, path: &str) -> Result<(), DomainError> {
        SlotId::parse(self.id.as_str())?;
        if let Some(parent) = &self.parent_id {
            SlotId::parse(parent.as_str())?;
            if parent == &self.id {
                return Err(DomainError::Cycle {
                    relation: "profile slot parents",
                    path: self.id.to_string(),
                });
            }
        }
        self.size_px.validate(&format!("{path}.size_px"))?;
        self.pivot_px.validate(&format!("{path}.pivot_px"))?;
        self.base_transform
            .validate(&format!("{path}.base_transform"))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MirrorPair {
    pub left: SlotId,
    pub right: SlotId,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DirectionView {
    pub direction: Direction,
    pub layer_order: Vec<SlotId>,
    pub base_transforms: Vec<ViewTransform>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ViewTransform {
    pub slot_id: SlotId,
    pub transform: Transform2D,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProfileRevision {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub profile_id: ObjectId,
    pub revision: u32,
    pub area_id: ObjectId,
    pub name: String,
    pub reference_height_px: u16,
    pub slots: Vec<SlotDefinition>,
    pub views: Vec<DirectionView>,
    pub mirror_pairs: Vec<MirrorPair>,
    pub published_at: UtcTimestamp,
}

impl ProfileRevision {
    pub fn reference(&self) -> super::RevisionRef {
        super::RevisionRef {
            id: self.profile_id,
            revision: self.revision,
        }
    }

    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(
            self.kind,
            DocumentKind::ProfileRevision,
            self.revision,
            "profile_revision",
        )?;
        super::validate_name("profile_revision.name", &self.name)?;
        if !(16..=512).contains(&self.reference_height_px) {
            return Err(DomainError::invalid(
                "profile_revision.reference_height_px",
                "must be within 16..=512",
            ));
        }
        self.validate_slots()?;
        self.validate_views()?;
        self.validate_mirror_pairs()
    }

    fn validate_slots(&self) -> Result<(), DomainError> {
        if self.slots.is_empty() || self.slots.len() > 64 {
            return Err(DomainError::invalid(
                "profile_revision.slots",
                "must contain 1..=64 slots",
            ));
        }
        let mut parents = HashMap::new();
        for (index, slot) in self.slots.iter().enumerate() {
            slot.validate(&format!("profile_revision.slots[{index}]"))?;
            if parents
                .insert(slot.id.clone(), slot.parent_id.clone())
                .is_some()
            {
                return Err(DomainError::DuplicateId(format!("slot:{}", slot.id)));
            }
        }
        for (slot, parent) in &parents {
            if let Some(parent) = parent {
                if !parents.contains_key(parent) {
                    return Err(DomainError::MissingReference {
                        path: format!("profile_revision.slot[{slot}].parent_id"),
                        target: parent.to_string(),
                    });
                }
            }
            ensure_no_parent_cycle(slot, &parents)?;
        }
        Ok(())
    }

    fn validate_views(&self) -> Result<(), DomainError> {
        let directions = self
            .views
            .iter()
            .map(|view| view.direction)
            .collect::<Vec<_>>();
        ensure_exact_directions("profile_revision.views", &directions)?;
        let slots = self
            .slots
            .iter()
            .map(|slot| &slot.id)
            .collect::<HashSet<_>>();
        for view in &self.views {
            let layers = view.layer_order.iter().collect::<HashSet<_>>();
            if layers.len() != view.layer_order.len() || layers != slots {
                return Err(DomainError::invalid(
                    format!("profile_revision.views.{:?}.layer_order", view.direction),
                    "must contain every slot exactly once",
                ));
            }
            let transforms = view
                .base_transforms
                .iter()
                .map(|item| &item.slot_id)
                .collect::<HashSet<_>>();
            if transforms.len() != view.base_transforms.len() || transforms != slots {
                return Err(DomainError::invalid(
                    format!(
                        "profile_revision.views.{:?}.base_transforms",
                        view.direction
                    ),
                    "must contain one transform for every slot",
                ));
            }
            for item in &view.base_transforms {
                item.transform
                    .validate("profile_revision.views.base_transform")?;
            }
        }
        Ok(())
    }

    fn validate_mirror_pairs(&self) -> Result<(), DomainError> {
        let slots = self
            .slots
            .iter()
            .map(|slot| &slot.id)
            .collect::<HashSet<_>>();
        let mut paired = HashSet::new();
        for pair in &self.mirror_pairs {
            if pair.left == pair.right {
                return Err(DomainError::Cycle {
                    relation: "profile mirror pairs",
                    path: pair.left.to_string(),
                });
            }
            if !slots.contains(&pair.left) || !slots.contains(&pair.right) {
                return Err(DomainError::MissingReference {
                    path: "profile_revision.mirror_pairs".to_owned(),
                    target: format!("{} or {}", pair.left, pair.right),
                });
            }
            if !paired.insert(pair.left.clone()) || !paired.insert(pair.right.clone()) {
                return Err(DomainError::invalid(
                    "profile_revision.mirror_pairs",
                    "a slot may occur in at most one mirror pair",
                ));
            }
        }
        Ok(())
    }
}

fn ensure_no_parent_cycle(
    start: &SlotId,
    parents: &HashMap<SlotId, Option<SlotId>>,
) -> Result<(), DomainError> {
    let mut path = Vec::new();
    let mut current = Some(start);
    while let Some(slot) = current {
        if let Some(position) = path.iter().position(|seen| seen == slot) {
            path.push(slot.clone());
            return Err(DomainError::Cycle {
                relation: "profile slot parents",
                path: path[position..]
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join(" -> "),
            });
        }
        path.push(slot.clone());
        current = parents.get(slot).and_then(Option::as_ref);
    }
    Ok(())
}
