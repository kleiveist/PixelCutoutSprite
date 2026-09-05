use thiserror::Error;

use crate::domain::{Direction, RevisionRef, SlotId};
use crate::render::RenderTransform;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DirectionError {
    #[error("direction definition `{0:?}` occurs more than once")]
    DuplicateDefinition(Direction),
    #[error("direction definition `{0:?}` is missing")]
    MissingDefinition(Direction),
    #[error("mirrored direction `{0:?}` has no source")]
    MissingMirrorSource(Direction),
    #[error("non-mirrored direction `{0:?}` must not define a mirror source")]
    UnexpectedMirrorSource(Direction),
    #[error("direction mirror cycle: {path}")]
    MirrorCycle { path: String },
    #[error(
        "direction `{target:?}` may only mirror horizontally from `{expected:?}`, not `{source_direction:?}`"
    )]
    InvalidHorizontalMirror {
        target: Direction,
        source_direction: Direction,
        expected: Direction,
    },
    #[error("front/back direction `{0:?}` cannot be derived by horizontal mirroring")]
    FrontBackMirror(Direction),
    #[error("direction `{0:?}` is explicitly marked missing")]
    MissingDirection(Direction),
    #[error("mirror source `{source_direction:?}` for `{target:?}` is missing")]
    MissingMirrorEndpoint {
        target: Direction,
        source_direction: Direction,
    },
    #[error("motion profile reference does not match the supplied profile")]
    ProfileMismatch,
    #[error("invalid profile: {0}")]
    InvalidProfile(String),
    #[error("profile view `{0:?}` is missing")]
    MissingProfileView(Direction),
    #[error("profile view `{direction:?}` has no transform for slot `{slot_id}`")]
    MissingProfileTransform {
        direction: Direction,
        slot_id: SlotId,
    },
    #[error("pose was sampled for `{found:?}` but resolver needs `{expected:?}`")]
    PoseSourceMismatch {
        expected: Direction,
        found: Direction,
    },
    #[error("pose slot `{0}` occurs more than once")]
    DuplicatePoseSlot(SlotId),
    #[error("pose is missing slot `{0}`; hidden parts must be present with visible=false")]
    MissingPoseSlot(SlotId),
    #[error("pose contains unknown slot `{0}`")]
    UnknownPoseSlot(SlotId),
    #[error("direction `{0:?}` is not mirrored and cannot be detached")]
    DirectionNotMirrored(Direction),
    #[error("detached direction would produce invalid motion data: {0}")]
    InvalidDetachedData(String),
    #[error("asset selection is ambiguous for slot `{slot_id}`, direction `{direction:?}`, variant `{variant}`")]
    AmbiguousAsset {
        slot_id: SlotId,
        direction: Direction,
        variant: String,
    },
    #[error(
        "asset for slot `{slot_id}`, direction `{direction:?}`, variant `{variant}` is missing"
    )]
    MissingAsset {
        slot_id: SlotId,
        direction: Direction,
        variant: String,
    },
    #[error("asset fallback for slot `{slot_id}` and direction `{direction:?}` requires explicit approval")]
    UnapprovedAssetFallback {
        slot_id: SlotId,
        direction: Direction,
        source_direction: Direction,
    },
    #[error(
        "asset fallback approval for `{direction:?}` names invalid source `{source_direction:?}`"
    )]
    InvalidFallbackApproval {
        slot_id: SlotId,
        direction: Direction,
        source_direction: Direction,
        expected: Direction,
    },
    #[error("asset for slot `{slot_id}` cannot be mirrored from `{source_direction:?}` to `{direction:?}`")]
    NonMirrorableAsset {
        slot_id: SlotId,
        direction: Direction,
        source_direction: Direction,
    },
    #[error("asset for slot `{slot_id}` and direction `{direction:?}` targets another profile")]
    IncompatibleAssetProfile {
        slot_id: SlotId,
        direction: Direction,
    },
    #[error("invalid asset revision: {0}")]
    InvalidAsset(String),
    #[error("whole-frame mirror would produce an invalid ground origin")]
    InvalidWholeFrameOrigin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedDirection {
    pub target: Direction,
    pub source: Direction,
    pub mirror_count: usize,
    pub pose_mirrored: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SampledSlot {
    pub slot_id: SlotId,
    pub motion: RenderTransform,
    pub visible: bool,
    pub sprite_variant: Option<String>,
    pub layer_delta: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DirectionalPose {
    pub direction: Direction,
    pub slots: Vec<SampledSlot>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedPoseSlot {
    pub slot_id: SlotId,
    pub parent_id: Option<SlotId>,
    pub profile: RenderTransform,
    pub motion: RenderTransform,
    pub visible: bool,
    pub sprite_variant: Option<String>,
    pub base_layer: i32,
    pub layer: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedPose {
    pub direction: Direction,
    pub source_direction: Direction,
    pub pose_mirrored: bool,
    pub slots: Vec<ResolvedPoseSlot>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequiredPartVisibility {
    Visible,
    Hidden,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetNeed {
    pub slot_id: SlotId,
    pub direction: Direction,
    pub variant: String,
    pub visibility: RequiredPartVisibility,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DirectionCoverageState {
    Explicit,
    Mirrored {
        source: Direction,
        mirror_count: usize,
    },
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectionCoverage {
    pub direction: Direction,
    pub state: DirectionCoverageState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssetCoverageState {
    Hidden,
    Exact {
        revision: RevisionRef,
    },
    Mirrored {
        revision: RevisionRef,
        source: Direction,
    },
    Blocked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetCoverage {
    pub need: AssetNeed,
    pub state: AssetCoverageState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageIssue {
    pub direction: Direction,
    pub slot_id: Option<SlotId>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseCoverage {
    pub directions: Vec<DirectionCoverage>,
    pub assets: Vec<AssetCoverage>,
    pub issues: Vec<CoverageIssue>,
}

impl ReleaseCoverage {
    pub fn can_release(&self) -> bool {
        self.issues.is_empty()
            && self.directions.len() == Direction::ALL.len()
            && self
                .directions
                .iter()
                .all(|item| item.state != DirectionCoverageState::Missing)
    }
}
