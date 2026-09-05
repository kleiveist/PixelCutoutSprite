use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::animation::{SampleError, SampledPose};
use crate::domain::{
    ActionKey, Direction, DomainError, EffectiveSource, ExportJumpMode, ExportManifest,
    ExportProfileSnapshot, ExportRootMotionMode, ExportSources, ObjectId, RelativePath,
    RevisionRef,
};
use crate::render::{RenderError, RenderRequest};

#[derive(Debug, Clone)]
pub struct ExportActionInput {
    pub action_key: ActionKey,
    pub binding_ref: RevisionRef,
    pub motion: crate::domain::MotionRevision,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
}

#[derive(Debug, Clone)]
pub struct ExportRequest {
    pub character_id: ObjectId,
    pub sources: ExportSources,
    pub effective_sources: Vec<EffectiveSource>,
    pub actions: Vec<ExportActionInput>,
    pub profile: ExportProfileSnapshot,
    /// Stable descriptions of deliberately absent authoritative parts. These are permitted only
    /// for an explicitly marked incomplete test export and participate in the build identity.
    pub incomplete_reasons: Vec<String>,
}

pub struct FrameContext<'a> {
    pub action_key: &'a ActionKey,
    pub motion: &'a crate::domain::MotionRevision,
    pub pose: &'a SampledPose,
    pub include_shadow: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("{message}")]
pub struct FrameSourceError {
    pub code: String,
    pub message: String,
}

impl FrameSourceError {
    pub fn missing(message: impl Into<String>) -> Self {
        Self {
            code: "missing_source".to_owned(),
            message: message.into(),
        }
    }

    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

/// P13/P15 adapt profile, appearance, equipment, and binding data at this boundary. Sampling and
/// rasterization deliberately remain owned by the export service.
pub trait FrameSource {
    fn render_request(
        &mut self,
        context: FrameContext<'_>,
    ) -> Result<RenderRequest, FrameSourceError>;
}

pub trait CancellationToken: Send + Sync {
    fn is_cancelled(&self) -> bool;
}

#[derive(Debug, Clone, Default)]
pub struct CancellationFlag(Arc<AtomicBool>);

impl CancellationFlag {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }
}

impl CancellationToken for CancellationFlag {
    fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NeverCancel;

impl CancellationToken for NeverCancel {
    fn is_cancelled(&self) -> bool {
        false
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportStage {
    Preflight,
    Rendering,
    Packing,
    Validating,
    Publishing,
    GodotPackaging,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExportProgress {
    pub stage: ExportStage,
    pub completed: usize,
    pub total: usize,
    pub message: String,
}

pub trait ProgressReporter {
    fn report(&mut self, progress: ExportProgress);
}

impl<F> ProgressReporter for F
where
    F: FnMut(ExportProgress),
{
    fn report(&mut self, progress: ExportProgress) {
        self(progress);
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CurrentExport {
    pub schema_version: u32,
    pub format_version: u32,
    pub build: RelativePath,
    pub manifest: RelativePath,
    pub source_fingerprint: crate::domain::Sha256Digest,
    pub complete: bool,
}

impl CurrentExport {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.schema_version != 1 || self.format_version != 1 {
            return Err(DomainError::invalid(
                "current_export",
                "schema_version and format_version must be 1",
            ));
        }
        RelativePath::parse(self.build.as_str())?;
        RelativePath::parse(self.manifest.as_str())?;
        crate::domain::Sha256Digest::parse(self.source_fingerprint.as_str())?;
        let expected_build = format!("build-{}", self.source_fingerprint.as_str());
        if self.build.as_str() != expected_build
            || self.manifest.as_str() != format!("{expected_build}/animation.json")
        {
            return Err(DomainError::invalid(
                "current_export",
                "build and manifest must identify the fingerprinted managed build",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct ValidatedCurrentExport {
    pub current: CurrentExport,
    pub manifest: ExportManifest,
}

#[derive(Debug, Clone)]
pub struct ExportOutcome {
    pub build: RelativePath,
    pub manifest: ExportManifest,
    pub reused_existing_build: bool,
}

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("export request is invalid: {0}")]
    InvalidRequest(String),
    #[error("export profile is invalid: {0}")]
    InvalidProfile(String),
    #[error("export would need {required} bytes, above the {budget}-byte budget")]
    MemoryLimit { required: u64, budget: u64 },
    #[error("export needs {required} atlas pages, above the configured limit of {limit}")]
    PageLimit { required: usize, limit: u16 },
    #[error("frame does not fit on an atlas page with the selected padding")]
    FrameDoesNotFit,
    #[error("missing source for {action}/{direction:?}/{frame}: {message}")]
    MissingSource {
        action: String,
        direction: Direction,
        frame: u16,
        message: String,
    },
    #[error("clipping blocked export at {action}/{direction:?}/{frame} ({count} part(s))")]
    ClippingBlocked {
        action: String,
        direction: Direction,
        frame: u16,
        count: usize,
    },
    #[error("export was cancelled; the previous current build was preserved")]
    Cancelled,
    #[error("animation sampling failed: {0}")]
    Sampling(#[from] SampleError),
    #[error("pixel composition failed: {0}")]
    Rendering(#[from] RenderError),
    #[error("export contract failed: {0}")]
    Contract(#[from] DomainError),
    #[error("{operation} failed for `{path}`: {source}")]
    Io {
        operation: &'static str,
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("PNG processing failed: {0}")]
    Image(#[from] image::ImageError),
    #[error("generated build failed validation: {0}")]
    InvalidBuild(String),
    #[error("Godot package failed validation: {0}")]
    InvalidGodotPackage(String),
}

impl ExportError {
    pub(crate) fn io(
        operation: &'static str,
        path: impl Into<PathBuf>,
        source: std::io::Error,
    ) -> Self {
        let path = path.into();
        Self::Io {
            operation,
            path: path
                .file_name()
                .map_or_else(|| "export".to_owned(), |name| name.to_string_lossy().into()),
            source,
        }
    }
}
