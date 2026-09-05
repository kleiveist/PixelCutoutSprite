use crate::domain::{AssetFallbackApproval, AssetRevision, Direction, RevisionRef, SlotId};

use super::{horizontal_mirror, DirectionError, ResolvedDirection};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetOrigin {
    Exact,
    Mirrored { source: Direction },
}

#[derive(Debug)]
pub struct ResolvedAsset<'a> {
    pub revision: &'a AssetRevision,
    pub target_slot: SlotId,
    pub target_direction: Direction,
    pub origin: AssetOrigin,
    pub bitmap_mirrored: bool,
    /// Pivot in the selected bitmap's post-mirror local coordinate system.
    pub pivot_px: (f64, f64),
}

pub struct AssetResolver<'a> {
    profile_ref: RevisionRef,
    assets: &'a [AssetRevision],
    approvals: &'a [AssetFallbackApproval],
}

impl<'a> AssetResolver<'a> {
    pub fn new(
        profile_ref: RevisionRef,
        assets: &'a [AssetRevision],
        approvals: &'a [AssetFallbackApproval],
    ) -> Result<Self, DirectionError> {
        for asset in assets {
            asset
                .validate()
                .map_err(|error| DirectionError::InvalidAsset(error.to_string()))?;
        }
        Ok(Self {
            profile_ref,
            assets,
            approvals,
        })
    }

    pub fn resolve(
        &self,
        direction: ResolvedDirection,
        target_slot: &SlotId,
        variant: &str,
    ) -> Result<ResolvedAsset<'a>, DirectionError> {
        if let Some(exact) = self.find_unique(target_slot, direction.target, variant)? {
            return Ok(ResolvedAsset {
                revision: exact,
                target_slot: target_slot.clone(),
                target_direction: direction.target,
                origin: AssetOrigin::Exact,
                bitmap_mirrored: false,
                pivot_px: (f64::from(exact.pivot_px.0), f64::from(exact.pivot_px.1)),
            });
        }

        let source = if direction.pose_mirrored {
            direction.source
        } else {
            horizontal_mirror(direction.target)
        };
        if source == direction.target {
            return Err(DirectionError::MissingAsset {
                slot_id: target_slot.clone(),
                direction: direction.target,
                variant: variant.to_owned(),
            });
        }

        let source_asset = self.find_unique(target_slot, source, variant)?;
        let approval = self.approvals.iter().find(|approval| {
            approval.slot_id == *target_slot
                && approval.target_direction == direction.target
                && approval.variant == variant
        });
        if let Some(approval) = approval {
            if approval.source_direction != source {
                return Err(DirectionError::InvalidFallbackApproval {
                    slot_id: target_slot.clone(),
                    direction: direction.target,
                    source_direction: approval.source_direction,
                    expected: source,
                });
            }
        } else if source_asset.is_some() {
            return Err(DirectionError::UnapprovedAssetFallback {
                slot_id: target_slot.clone(),
                direction: direction.target,
                source_direction: source,
            });
        }

        let source_asset = source_asset.ok_or_else(|| DirectionError::MissingAsset {
            slot_id: target_slot.clone(),
            direction: direction.target,
            variant: variant.to_owned(),
        })?;
        if !source_asset.sprite_mirroring_allowed {
            return Err(DirectionError::NonMirrorableAsset {
                slot_id: target_slot.clone(),
                direction: direction.target,
                source_direction: source,
            });
        }

        Ok(ResolvedAsset {
            revision: source_asset,
            target_slot: target_slot.clone(),
            target_direction: direction.target,
            origin: AssetOrigin::Mirrored { source },
            bitmap_mirrored: true,
            pivot_px: (
                f64::from(source_asset.image_size_px.0) - f64::from(source_asset.pivot_px.0),
                f64::from(source_asset.pivot_px.1),
            ),
        })
    }

    fn find_unique(
        &self,
        slot_id: &SlotId,
        direction: Direction,
        variant: &str,
    ) -> Result<Option<&'a AssetRevision>, DirectionError> {
        let candidates = self
            .assets
            .iter()
            .filter(|asset| {
                asset.slot_id == *slot_id
                    && asset.direction == direction
                    && asset.variant == variant
            })
            .collect::<Vec<_>>();
        let compatible = candidates
            .iter()
            .copied()
            .filter(|asset| asset.profile_ref == self.profile_ref)
            .collect::<Vec<_>>();
        if compatible.len() > 1 {
            return Err(DirectionError::AmbiguousAsset {
                slot_id: slot_id.clone(),
                direction,
                variant: variant.to_owned(),
            });
        }
        if compatible.is_empty() && !candidates.is_empty() {
            return Err(DirectionError::IncompatibleAssetProfile {
                slot_id: slot_id.clone(),
                direction,
            });
        }
        Ok(compatible.first().copied())
    }
}
