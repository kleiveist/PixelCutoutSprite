use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::animation::{AnimationSampler, SampleError};
use crate::domain::{
    canonical_json_bytes, ActionKey, AtlasPage, CheckLevel, Direction, DocumentKind,
    EffectiveSource, EffectiveSourceKind, ExportAction, ExportCheck, ExportClipping, ExportFrame,
    ExportManifest, ExportSources, PixelPoint, PixelSize, RelativePath, RevisionRef, Sha256Digest,
    UtcTimestamp,
};
use crate::render::{PixelCompositor, RenderedFrame};
use crate::storage::VaultRoot;

use super::artifact::{read_png, rgba_digest, validate_build, write_bytes, write_png};
use super::{
    AtlasBuilder, AtlasOptions, CancellationToken, CurrentExport, ExportActionInput, ExportError,
    ExportOutcome, ExportProgress, ExportRequest, ExportStage, FrameContext, FrameSource,
    FrameSourceError, ProgressReporter,
};

const RASTERIZER_VERSION: &str = "pixel-compositor-v1";

#[derive(Debug, Clone)]
pub struct ExportService {
    output_root: VaultRoot,
    generator_version: String,
}

impl ExportService {
    pub fn new(output_root: VaultRoot, generator_version: impl Into<String>) -> Self {
        Self {
            output_root,
            generator_version: generator_version.into(),
        }
    }

    /// Computes the build identity without rendering. Callers must supply hashes assembled from
    /// authoritative sources; generated frame hashes deliberately are not freshness inputs.
    pub fn source_fingerprint(&self, request: &ExportRequest) -> Result<Sha256Digest, ExportError> {
        let prepared = self.preflight(request)?;
        source_fingerprint(
            self,
            request,
            &prepared.actions,
            &prepared.incomplete_reasons,
        )
    }

    /// Follows only the managed pointer and validates every referenced artifact. Orphaned or
    /// older build directories are never promoted implicitly.
    pub fn current(
        &self,
        output_directory: &Path,
    ) -> Result<Option<super::ValidatedCurrentExport>, ExportError> {
        let pointer_relative = output_directory.join("current.json");
        let pointer = self
            .output_root
            .resolve(&pointer_relative)
            .map_err(|error| ExportError::InvalidRequest(error.to_string()))?;
        let bytes = match fs::read(pointer.as_path()) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(ExportError::io(
                    "read current pointer",
                    pointer.as_path(),
                    error,
                ));
            }
        };
        let current: CurrentExport = serde_json::from_slice(&bytes)
            .map_err(|error| ExportError::InvalidBuild(error.to_string()))?;
        current.validate()?;
        let build_relative = output_directory.join(current.build.as_str());
        let build = self
            .output_root
            .resolve(&build_relative)
            .map_err(|error| ExportError::InvalidBuild(error.to_string()))?;
        let manifest = validated_fingerprint(build.as_path(), &current.source_fingerprint)?;
        if manifest.complete != current.complete {
            return Err(ExportError::InvalidBuild(
                "current pointer completeness differs from its manifest".to_owned(),
            ));
        }
        Ok(Some(super::ValidatedCurrentExport { current, manifest }))
    }

    pub fn export<S, C, P>(
        &self,
        output_directory: &Path,
        request: &ExportRequest,
        frame_source: &mut S,
        cancellation: &C,
        progress: &mut P,
    ) -> Result<ExportOutcome, ExportError>
    where
        S: FrameSource,
        C: CancellationToken,
        P: ProgressReporter,
    {
        let prepared = self.preflight(request)?;
        progress.report(ExportProgress {
            stage: ExportStage::Preflight,
            completed: 1,
            total: 1,
            message: format!(
                "Validated {} action(s), {} planned frame(s)",
                prepared.actions.len(),
                prepared.expected_frames
            ),
        });
        ensure_not_cancelled(cancellation)?;

        let output = self
            .output_root
            .ensure_directory(output_directory)
            .map_err(|error| ExportError::InvalidRequest(error.to_string()))?;
        let stage_path = output.as_path().join(format!(
            ".export-job-{}.staging",
            Uuid::new_v4().hyphenated()
        ));
        fs::create_dir(&stage_path)
            .map_err(|error| ExportError::io("create staged export", &stage_path, error))?;
        let mut stage = StageGuard::new(stage_path);
        let spool = stage.path().join(".frames");
        fs::create_dir(&spool)
            .map_err(|error| ExportError::io("create frame spool", &spool, error))?;

        let (records, checks) = self.render_frames(
            &prepared,
            request,
            frame_source,
            cancellation,
            progress,
            &spool,
        )?;
        let fingerprint = source_fingerprint(
            self,
            request,
            &prepared.actions,
            &prepared.incomplete_reasons,
        )?;
        self.assemble_stage(StageAssembly {
            prepared: &prepared,
            request,
            records: &records,
            checks,
            stage: &stage,
            spool: &spool,
            cancellation,
            progress,
            fingerprint: &fingerprint,
        })?;
        self.publish_stage(
            output.as_path(),
            &mut stage,
            fingerprint,
            cancellation,
            progress,
        )
    }

    fn assemble_stage<C, P>(
        &self,
        work: StageAssembly<'_, C, P>,
    ) -> Result<Sha256Digest, ExportError>
    where
        C: CancellationToken,
        P: ProgressReporter,
    {
        let StageAssembly {
            prepared,
            request,
            records,
            mut checks,
            stage,
            spool,
            cancellation,
            progress,
            fingerprint,
        } = work;
        if records.is_empty() {
            return Err(ExportError::InvalidRequest(
                "no frame could be rendered, even for an incomplete test export".to_owned(),
            ));
        }
        let complete = records.len() == prepared.expected_frames
            && request.profile.directions.as_slice() == Direction::ALL
            && prepared.incomplete_reasons.is_empty();
        add_completion_check(&mut checks, complete);
        let atlas = AtlasBuilder::new(prepared.geometry.size, atlas_options(request))?;
        let plan = atlas.plan(records.len())?;
        checks.push(memory_check(&plan));
        let (pages, frames) = pack_artifacts(PackContext {
            stage: stage.path(),
            spool,
            atlas: &atlas,
            plan: &plan,
            records,
            request,
            geometry: prepared.geometry,
            cancellation,
            progress: &mut *progress,
        })?;
        fs::remove_dir_all(spool)
            .map_err(|error| ExportError::io("remove frame spool", spool, error))?;
        let manifest = ExportManifest {
            schema_version: 1,
            kind: DocumentKind::ExportManifest,
            id: crate::domain::ObjectId::new(),
            format_version: 1,
            generator_version: self.generator_version.clone(),
            rasterizer_version: RASTERIZER_VERSION.to_owned(),
            character_id: request.character_id,
            source_fingerprint: fingerprint.clone(),
            complete,
            profile: request.profile.clone(),
            sources: sorted_sources(&request.sources),
            effective_sources: sorted_effective_sources(&request.effective_sources),
            actions: manifest_actions(&prepared.actions, records, prepared.geometry),
            pages,
            frames,
            checks,
            created_at: UtcTimestamp::now(),
        };
        manifest.validate()?;
        let bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|error| ExportError::InvalidBuild(error.to_string()))?;
        write_bytes(&stage.path().join("animation.json"), &bytes)?;
        validate_staged(stage.path(), fingerprint, cancellation, progress)?;
        Ok(fingerprint.clone())
    }

    fn publish_stage<C, P>(
        &self,
        output: &Path,
        stage: &mut StageGuard,
        fingerprint: Sha256Digest,
        cancellation: &C,
        progress: &mut P,
    ) -> Result<ExportOutcome, ExportError>
    where
        C: CancellationToken,
        P: ProgressReporter,
    {
        let build_name = format!("build-{}", fingerprint.as_str());
        let build_path = output.join(&build_name);
        let reused_existing_build = publish_build(stage, &build_path, &fingerprint)?;
        let published_manifest = validated_fingerprint(&build_path, &fingerprint)?;
        ensure_not_cancelled(cancellation)?;
        progress.report(ExportProgress {
            stage: ExportStage::Publishing,
            completed: 0,
            total: 1,
            message: "Updating current.json after successful build validation".to_owned(),
        });
        let build = RelativePath::parse(&build_name)?;
        write_current(
            output,
            &CurrentExport {
                schema_version: 1,
                format_version: 1,
                build: build.clone(),
                manifest: RelativePath::parse(format!("{build_name}/animation.json"))?,
                source_fingerprint: fingerprint,
                complete: published_manifest.complete,
            },
        )?;
        progress.report(ExportProgress {
            stage: ExportStage::Publishing,
            completed: 1,
            total: 1,
            message: "Published current.json".to_owned(),
        });
        Ok(ExportOutcome {
            build,
            manifest: published_manifest,
            reused_existing_build,
        })
    }

    fn preflight(&self, request: &ExportRequest) -> Result<PreparedExport, ExportError> {
        if self.generator_version.is_empty() || self.generator_version.len() > 64 {
            return Err(ExportError::InvalidRequest(
                "generator version must contain 1..=64 characters".to_owned(),
            ));
        }
        request
            .profile
            .validate()
            .map_err(|error| ExportError::InvalidProfile(error.to_string()))?;
        if request.profile.directions.as_slice() != Direction::ALL
            && !request.profile.allow_incomplete_test
        {
            return Err(ExportError::InvalidProfile(
                "a direction subset requires the explicit incomplete-test option".to_owned(),
            ));
        }
        let incomplete_reasons = normalize_incomplete_reasons(&request.incomplete_reasons)?;
        if !incomplete_reasons.is_empty() && !request.profile.allow_incomplete_test {
            return Err(ExportError::InvalidRequest(
                "missing authoritative parts require the explicit incomplete-test option"
                    .to_owned(),
            ));
        }
        if request.actions.is_empty() {
            return Err(ExportError::InvalidRequest(
                "at least one action is required".to_owned(),
            ));
        }
        let mut actions = request.actions.clone();
        actions.sort_by(|left, right| left.action_key.as_str().cmp(right.action_key.as_str()));
        let mut keys = HashSet::new();
        for action in &actions {
            if !keys.insert(action.action_key.as_str()) {
                return Err(ExportError::InvalidRequest(format!(
                    "action `{}` occurs more than once",
                    action.action_key
                )));
            }
            action.motion.validate(None)?;
            if action.motion.profile_ref != request.sources.profile {
                return Err(ExportError::InvalidRequest(format!(
                    "action `{}` uses a different profile revision",
                    action.action_key
                )));
            }
            if !request.sources.motion.contains(&action.motion.reference()) {
                return Err(ExportError::InvalidRequest(format!(
                    "motion source for `{}` is absent from ExportSources",
                    action.action_key
                )));
            }
            if !request.sources.bindings.contains(&action.binding_ref) {
                return Err(ExportError::InvalidRequest(format!(
                    "binding source for `{}` is absent from ExportSources",
                    action.action_key
                )));
            }
        }
        validate_effective_sources(request, &actions)?;
        for action in &mut actions {
            apply_export_motion_policy(action)?;
        }
        let geometry = common_geometry(&actions, request.profile.normalize_geometry)?;
        let expected_frames = actions.iter().try_fold(0_usize, |total, action| {
            usize::from(action.motion.frame_count)
                .checked_mul(request.profile.directions.len())
                .and_then(|count| total.checked_add(count))
                .ok_or_else(|| ExportError::InvalidRequest("frame count overflow".to_owned()))
        })?;
        AtlasBuilder::new(geometry.size, atlas_options(request))?.plan(expected_frames)?;
        Ok(PreparedExport {
            actions,
            geometry,
            expected_frames,
            incomplete_reasons,
        })
    }

    fn render_frames<S, C, P>(
        &self,
        prepared: &PreparedExport,
        request: &ExportRequest,
        source: &mut S,
        cancellation: &C,
        progress: &mut P,
        spool: &Path,
    ) -> Result<(Vec<RenderedRecord>, Vec<ExportCheck>), ExportError>
    where
        S: FrameSource,
        C: CancellationToken,
        P: ProgressReporter,
    {
        let mut records = Vec::with_capacity(prepared.expected_frames);
        let mut checks = initial_checks(prepared.geometry, &prepared.incomplete_reasons);
        let sampler = AnimationSampler;
        let compositor = PixelCompositor;
        let mut completed = 0;
        for action in &prepared.actions {
            for &direction in &request.profile.directions {
                for frame in 0..action.motion.frame_count {
                    ensure_not_cancelled(cancellation)?;
                    let pose = match sampler.sample(&action.motion, direction, frame) {
                        Ok(pose) => pose,
                        Err(SampleError::MissingDirection(_))
                            if request.profile.allow_incomplete_test =>
                        {
                            record_missing(
                                &mut checks,
                                action,
                                direction,
                                frame,
                                "motion direction is missing",
                            );
                            completed += 1;
                            report_render(progress, completed, prepared.expected_frames);
                            continue;
                        }
                        Err(error) => return Err(error.into()),
                    };
                    let context = FrameContext {
                        action_key: &action.action_key,
                        motion: &action.motion,
                        pose: &pose,
                        include_shadow: request.profile.include_shadow,
                    };
                    let render_request = match source.render_request(context) {
                        Ok(render_request) => render_request,
                        Err(error)
                            if request.profile.allow_incomplete_test
                                && error.code == "missing_source" =>
                        {
                            record_missing(&mut checks, action, direction, frame, &error.message);
                            completed += 1;
                            report_render(progress, completed, prepared.expected_frames);
                            continue;
                        }
                        Err(error) => return Err(missing_error(action, direction, frame, error)),
                    };
                    validate_render_request(action, direction, &render_request)?;
                    let rendered = compositor.render(&render_request)?;
                    if !rendered.clipping.is_empty()
                        && request.profile.clipping_policy == crate::domain::ClippingPolicy::Block
                    {
                        return Err(ExportError::ClippingBlocked {
                            action: action.action_key.to_string(),
                            direction,
                            frame,
                            count: rendered.clipping.len(),
                        });
                    }
                    let normalized = normalize_frame(rendered, action, prepared.geometry)?;
                    let file_name = format!("{:06}.png", records.len());
                    write_png(&spool.join(&file_name), &normalized.image)?;
                    let clipping = normalized
                        .clipping
                        .into_iter()
                        .map(|notice| ExportClipping {
                            slot_id: notice.slot_id,
                            bounds_px: notice.bounds_px,
                        })
                        .collect::<Vec<_>>();
                    if !clipping.is_empty() {
                        checks.push(ExportCheck {
                            code: "clipping".to_owned(),
                            level: CheckLevel::Warning,
                            message: format!(
                                "{}/{direction:?}/{frame} clips {} part(s); export continued by profile policy.",
                                action.action_key,
                                clipping.len()
                            ),
                        });
                    }
                    records.push(RenderedRecord {
                        action_key: action.action_key.clone(),
                        direction,
                        source_direction: pose.source_direction,
                        sample_index: frame,
                        spool_file: file_name,
                        rgba_sha256: rgba_digest(&normalized.image),
                        clipping,
                    });
                    completed += 1;
                    report_render(progress, completed, prepared.expected_frames);
                }
            }
        }
        Ok((records, checks))
    }
}

fn apply_export_motion_policy(action: &mut ExportActionInput) -> Result<(), ExportError> {
    let Some(semantics) = &mut action.motion.semantics else {
        return Ok(());
    };
    match (action.jump_mode, semantics.jump_height_mode) {
        (
            crate::domain::ExportJumpMode::External,
            crate::domain::JumpHeightMode::BakedIntoFrames,
        ) => {
            for helper in semantics
                .helpers
                .iter_mut()
                .filter(|helper| helper.kind == crate::domain::HelperKind::JumpHeight)
            {
                helper.enabled = false;
            }
            semantics.jump_height_mode = crate::domain::JumpHeightMode::ExternalGameMotion;
        }
        (
            crate::domain::ExportJumpMode::Baked,
            crate::domain::JumpHeightMode::ExternalGameMotion,
        ) => {
            return Err(ExportError::InvalidRequest(format!(
                "action `{}` has no baked jump-height source",
                action.action_key
            )));
        }
        _ => {}
    }
    action.motion.validate(None)?;
    Ok(())
}

#[derive(Debug)]
struct PreparedExport {
    actions: Vec<ExportActionInput>,
    geometry: CommonGeometry,
    expected_frames: usize,
    incomplete_reasons: Vec<String>,
}

struct StageAssembly<'a, C, P> {
    prepared: &'a PreparedExport,
    request: &'a ExportRequest,
    records: &'a [RenderedRecord],
    checks: Vec<ExportCheck>,
    stage: &'a StageGuard,
    spool: &'a Path,
    cancellation: &'a C,
    progress: &'a mut P,
    fingerprint: &'a Sha256Digest,
}

#[derive(Debug, Clone, Copy)]
struct CommonGeometry {
    size: PixelSize,
    ground: PixelPoint,
    padded: bool,
}

struct PackContext<'a, C, P> {
    stage: &'a Path,
    spool: &'a Path,
    atlas: &'a AtlasBuilder,
    plan: &'a super::AtlasPlan,
    records: &'a [RenderedRecord],
    request: &'a ExportRequest,
    geometry: CommonGeometry,
    cancellation: &'a C,
    progress: &'a mut P,
}

#[derive(Debug, Clone, Serialize)]
struct RenderedRecord {
    action_key: ActionKey,
    direction: Direction,
    source_direction: Direction,
    sample_index: u16,
    #[serde(skip)]
    spool_file: String,
    rgba_sha256: Sha256Digest,
    clipping: Vec<ExportClipping>,
}

#[derive(Debug, Serialize)]
struct FingerprintAction<'a> {
    action_key: &'a ActionKey,
    binding_id: crate::domain::ObjectId,
    motion_ref: RevisionRef,
    root_motion_mode: crate::domain::ExportRootMotionMode,
    jump_mode: crate::domain::ExportJumpMode,
}

#[derive(Debug, Serialize)]
struct FingerprintProfile<'a> {
    directions: &'a [Direction],
    max_page_size_px: crate::domain::AtlasSize,
    max_pages: u16,
    memory_budget_bytes: u64,
    padding_px: u16,
    extrude_edges: bool,
    individual_frames: bool,
    include_shadow: bool,
    normalize_geometry: bool,
    clipping_policy: crate::domain::ClippingPolicy,
    allow_incomplete_test: bool,
}

#[derive(Debug, Serialize)]
struct FingerprintEffectiveSource {
    kind: EffectiveSourceKind,
    id: crate::domain::ObjectId,
    immutable_revision: Option<u32>,
    content_sha256: Sha256Digest,
}

#[derive(Debug, Serialize)]
struct FingerprintInput<'a> {
    format_version: u32,
    generator_version: &'a str,
    rasterizer_version: &'a str,
    character_id: crate::domain::ObjectId,
    profile: FingerprintProfile<'a>,
    effective_sources: Vec<FingerprintEffectiveSource>,
    actions: Vec<FingerprintAction<'a>>,
    incomplete_reasons: &'a [String],
}

fn add_completion_check(checks: &mut Vec<ExportCheck>, complete: bool) {
    if !complete {
        checks.push(ExportCheck {
            code: "incomplete_export".to_owned(),
            level: CheckLevel::Warning,
            message:
                "This explicitly requested test export omits one or more directions, frames, or source parts."
                    .to_owned(),
        });
    }
}

fn initial_checks(geometry: CommonGeometry, incomplete_reasons: &[String]) -> Vec<ExportCheck> {
    let mut checks = vec![ExportCheck {
        code: "effective_sources".to_owned(),
        level: CheckLevel::Passed,
        message: "Every effective profile, motion, asset, appearance, and binding source has a content hash."
            .to_owned(),
    }];
    if geometry.padded {
        checks.push(ExportCheck {
            code: "transparent_padding".to_owned(),
            level: CheckLevel::Warning,
            message: "Different action canvases were aligned to one ground origin with transparent padding; no pixels were scaled."
                .to_owned(),
        });
    }
    checks.extend(incomplete_reasons.iter().map(|reason| ExportCheck {
        code: "missing_source".to_owned(),
        level: CheckLevel::Warning,
        message: reason.clone(),
    }));
    checks
}

fn normalize_incomplete_reasons(reasons: &[String]) -> Result<Vec<String>, ExportError> {
    if reasons.len() > 4096 {
        return Err(ExportError::InvalidRequest(
            "too many incomplete-source reasons".to_owned(),
        ));
    }
    let mut normalized = Vec::with_capacity(reasons.len());
    for reason in reasons {
        let reason = reason.trim();
        if reason.is_empty() || reason.len() > 512 || reason.chars().any(char::is_control) {
            return Err(ExportError::InvalidRequest(
                "incomplete-source reasons must contain 1..=512 printable characters".to_owned(),
            ));
        }
        normalized.push(reason.to_owned());
    }
    normalized.sort();
    normalized.dedup();
    Ok(normalized)
}

fn memory_check(plan: &super::AtlasPlan) -> ExportCheck {
    ExportCheck {
        code: "memory_budget".to_owned(),
        level: CheckLevel::Passed,
        message: format!(
            "Estimated decoded export data: {} bytes; peak atlas page: {} bytes.",
            plan.estimated_decoded_bytes, plan.peak_page_bytes
        ),
    }
}

fn validate_staged<C, P>(
    stage: &Path,
    fingerprint: &Sha256Digest,
    cancellation: &C,
    progress: &mut P,
) -> Result<(), ExportError>
where
    C: CancellationToken,
    P: ProgressReporter,
{
    ensure_not_cancelled(cancellation)?;
    progress.report(ExportProgress {
        stage: ExportStage::Validating,
        completed: 0,
        total: 1,
        message: "Decoding and validating staged PNG and JSON artifacts".to_owned(),
    });
    let validated = validate_build(stage)?;
    if validated.source_fingerprint != *fingerprint {
        return Err(ExportError::InvalidBuild(
            "staged manifest fingerprint changed during validation".to_owned(),
        ));
    }
    progress.report(ExportProgress {
        stage: ExportStage::Validating,
        completed: 1,
        total: 1,
        message: "All staged artifacts passed decoded-pixel validation".to_owned(),
    });
    ensure_not_cancelled(cancellation)
}

fn publish_build(
    stage: &mut StageGuard,
    build_path: &Path,
    fingerprint: &Sha256Digest,
) -> Result<bool, ExportError> {
    match fs::symlink_metadata(build_path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(ExportError::InvalidBuild(
                    "managed build targets must be real directories".to_owned(),
                ));
            }
            let existing = validated_fingerprint(build_path, fingerprint)?;
            let staged = validated_fingerprint(stage.path(), fingerprint)?;
            if !artifacts_match(&existing, &staged) {
                return Err(ExportError::InvalidBuild(
                    "the same source fingerprint produced different pixels or layout".to_owned(),
                ));
            }
            stage.cleanup()?;
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::rename(stage.path(), build_path)
                .map_err(|error| ExportError::io("publish validated build", build_path, error))?;
            stage.disarm();
            Ok(false)
        }
        Err(error) => Err(ExportError::io("inspect managed build", build_path, error)),
    }
}

fn artifacts_match(existing: &ExportManifest, staged: &ExportManifest) -> bool {
    existing.complete == staged.complete
        && export_profiles_match(&existing.profile, &staged.profile)
        && existing.pages == staged.pages
        && existing.frames == staged.frames
        && existing.checks == staged.checks
        && existing.actions.len() == staged.actions.len()
        && existing
            .actions
            .iter()
            .zip(&staged.actions)
            .all(|(left, right)| {
                left.action_key == right.action_key
                    && left.binding_ref.id == right.binding_ref.id
                    && left.frame_size_px == right.frame_size_px
                    && left.ground_origin_px == right.ground_origin_px
                    && left.frame_count == right.frame_count
                    && left.fps == right.fps
                    && left.loop_mode == right.loop_mode
                    && left.root_motion_mode == right.root_motion_mode
                    && left.jump_mode == right.jump_mode
                    && left.directions == right.directions
            })
}

fn export_profiles_match(
    left: &crate::domain::ExportProfileSnapshot,
    right: &crate::domain::ExportProfileSnapshot,
) -> bool {
    left.directions == right.directions
        && left.max_page_size_px == right.max_page_size_px
        && left.max_pages == right.max_pages
        && left.memory_budget_bytes == right.memory_budget_bytes
        && left.padding_px == right.padding_px
        && left.extrude_edges == right.extrude_edges
        && left.individual_frames == right.individual_frames
        && left.include_shadow == right.include_shadow
        && left.normalize_geometry == right.normalize_geometry
        && left.clipping_policy == right.clipping_policy
        && left.allow_incomplete_test == right.allow_incomplete_test
}

fn validated_fingerprint(
    build_path: &Path,
    fingerprint: &Sha256Digest,
) -> Result<ExportManifest, ExportError> {
    let manifest = validate_build(build_path)?;
    if manifest.source_fingerprint == *fingerprint {
        Ok(manifest)
    } else {
        Err(ExportError::InvalidBuild(
            "build directory has a different source fingerprint".to_owned(),
        ))
    }
}

fn source_fingerprint(
    service: &ExportService,
    request: &ExportRequest,
    actions: &[ExportActionInput],
    incomplete_reasons: &[String],
) -> Result<Sha256Digest, ExportError> {
    let actions = actions
        .iter()
        .map(|action| FingerprintAction {
            action_key: &action.action_key,
            binding_id: action.binding_ref.id,
            motion_ref: action.motion.reference(),
            root_motion_mode: action.root_motion_mode,
            jump_mode: action.jump_mode,
        })
        .collect::<Vec<_>>();
    let profile = &request.profile;
    let input = FingerprintInput {
        format_version: 1,
        generator_version: &service.generator_version,
        rasterizer_version: RASTERIZER_VERSION,
        character_id: request.character_id,
        profile: FingerprintProfile {
            directions: &profile.directions,
            max_page_size_px: profile.max_page_size_px,
            max_pages: profile.max_pages,
            memory_budget_bytes: profile.memory_budget_bytes,
            padding_px: profile.padding_px,
            extrude_edges: profile.extrude_edges,
            individual_frames: profile.individual_frames,
            include_shadow: profile.include_shadow,
            normalize_geometry: profile.normalize_geometry,
            clipping_policy: profile.clipping_policy,
            allow_incomplete_test: profile.allow_incomplete_test,
        },
        effective_sources: fingerprint_effective_sources(&request.effective_sources),
        actions,
        incomplete_reasons,
    };
    Ok(digest_bytes(&canonical_json_bytes(&input)?))
}

fn fingerprint_effective_sources(sources: &[EffectiveSource]) -> Vec<FingerprintEffectiveSource> {
    let mut result = sources
        .iter()
        .map(|source| FingerprintEffectiveSource {
            kind: source.kind,
            id: source.reference.id,
            immutable_revision: matches!(
                source.kind,
                EffectiveSourceKind::Profile
                    | EffectiveSourceKind::Motion
                    | EffectiveSourceKind::Asset
            )
            .then_some(source.reference.revision),
            content_sha256: source.content_sha256.clone(),
        })
        .collect::<Vec<_>>();
    result.sort_by_key(|source| {
        (
            format!("{:?}", source.kind),
            source.id.to_string(),
            source.immutable_revision,
        )
    });
    result
}

/// Hashes only render-affecting motion data. Publication timestamps and document identity are
/// tracked separately by `RevisionRef` and cannot make a visually unchanged build stale.
pub fn motion_semantic_sha256(
    motion: &crate::domain::MotionRevision,
) -> Result<Sha256Digest, ExportError> {
    let mut value = serde_json::to_value(motion)
        .map_err(|error| ExportError::InvalidRequest(error.to_string()))?;
    let object = value.as_object_mut().ok_or_else(|| {
        ExportError::InvalidRequest("motion source did not serialize as an object".to_owned())
    })?;
    for metadata in [
        "schema_version",
        "kind",
        "template_id",
        "revision",
        "published_at",
    ] {
        object.remove(metadata);
    }
    Ok(digest_bytes(&canonical_json_bytes(&value)?))
}

fn validate_effective_sources(
    request: &ExportRequest,
    actions: &[ExportActionInput],
) -> Result<(), ExportError> {
    let mut seen = HashSet::new();
    for source in &request.effective_sources {
        source.reference.validate("effective_source.reference")?;
        Sha256Digest::parse(source.content_sha256.as_str())?;
        if !seen.insert((source.kind, source.reference)) {
            return Err(ExportError::InvalidRequest(format!(
                "effective source {:?}/{} occurs more than once",
                source.kind, source.reference
            )));
        }
    }
    require_effective(&seen, EffectiveSourceKind::Profile, request.sources.profile)?;
    for (kind, refs) in [
        (EffectiveSourceKind::Motion, &request.sources.motion),
        (EffectiveSourceKind::Asset, &request.sources.assets),
        (
            EffectiveSourceKind::Appearance,
            &request.sources.appearances,
        ),
        (EffectiveSourceKind::Binding, &request.sources.bindings),
    ] {
        for reference in refs {
            require_effective(&seen, kind, *reference)?;
        }
    }
    for action in actions {
        let expected = motion_semantic_sha256(&action.motion)?;
        let actual = request.effective_sources.iter().find(|source| {
            source.kind == EffectiveSourceKind::Motion
                && source.reference == action.motion.reference()
        });
        if actual.is_none_or(|source| source.content_sha256 != expected) {
            return Err(ExportError::InvalidRequest(format!(
                "motion content hash for `{}` does not match its effective revision",
                action.action_key
            )));
        }
    }
    Ok(())
}

fn require_effective(
    seen: &HashSet<(EffectiveSourceKind, RevisionRef)>,
    kind: EffectiveSourceKind,
    reference: RevisionRef,
) -> Result<(), ExportError> {
    if seen.contains(&(kind, reference)) {
        Ok(())
    } else {
        Err(ExportError::InvalidRequest(format!(
            "effective {:?} source {} is missing its content hash",
            kind, reference
        )))
    }
}

fn common_geometry(
    actions: &[ExportActionInput],
    allow_padding: bool,
) -> Result<CommonGeometry, ExportError> {
    let first = &actions[0].motion;
    let same = actions.iter().all(|action| {
        action.motion.frame_size_px == first.frame_size_px
            && action.motion.ground_origin_px == first.ground_origin_px
    });
    if same {
        return Ok(CommonGeometry {
            size: first.frame_size_px,
            ground: first.ground_origin_px,
            padded: false,
        });
    }
    if !allow_padding {
        return Err(ExportError::InvalidRequest(
            "actions use different frame sizes or ground origins; enable transparent geometry normalization"
                .to_owned(),
        ));
    }
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;
    for action in actions {
        let size = action.motion.frame_size_px;
        let ground = action.motion.ground_origin_px;
        min_x = min_x.min(-i32::from(ground.0));
        min_y = min_y.min(-i32::from(ground.1));
        max_x = max_x.max(i32::from(size.0) - i32::from(ground.0));
        max_y = max_y.max(i32::from(size.1) - i32::from(ground.1));
    }
    let width = u16::try_from(max_x - min_x).map_err(|_| {
        ExportError::InvalidRequest("normalized frame width is outside product limits".to_owned())
    })?;
    let height = u16::try_from(max_y - min_y).map_err(|_| {
        ExportError::InvalidRequest("normalized frame height is outside product limits".to_owned())
    })?;
    let geometry = CommonGeometry {
        size: PixelSize(width, height),
        ground: PixelPoint(
            i16::try_from(-min_x).map_err(|_| {
                ExportError::InvalidRequest("normalized ground x is outside limits".to_owned())
            })?,
            i16::try_from(-min_y).map_err(|_| {
                ExportError::InvalidRequest("normalized ground y is outside limits".to_owned())
            })?,
        ),
        padded: true,
    };
    geometry.size.validate("normalized_frame_size")?;
    geometry.ground.validate("normalized_ground_origin")?;
    Ok(geometry)
}

fn validate_render_request(
    action: &ExportActionInput,
    direction: Direction,
    request: &crate::render::RenderRequest,
) -> Result<(), ExportError> {
    if request.direction != direction
        || request.frame_size_px != action.motion.frame_size_px
        || request.ground_origin_px != action.motion.ground_origin_px
    {
        return Err(ExportError::InvalidRequest(format!(
            "frame source changed direction or geometry for `{}`",
            action.action_key
        )));
    }
    Ok(())
}

fn normalize_frame(
    frame: RenderedFrame,
    action: &ExportActionInput,
    geometry: CommonGeometry,
) -> Result<RenderedFrame, ExportError> {
    if !geometry.padded {
        return Ok(frame);
    }
    let offset_x = i32::from(geometry.ground.0)
        .checked_sub(i32::from(action.motion.ground_origin_px.0))
        .ok_or_else(|| ExportError::InvalidRequest("frame x offset overflow".to_owned()))?;
    let offset_y = i32::from(geometry.ground.1)
        .checked_sub(i32::from(action.motion.ground_origin_px.1))
        .ok_or_else(|| ExportError::InvalidRequest("frame y offset overflow".to_owned()))?;
    if offset_x < 0 || offset_y < 0 {
        return Err(ExportError::InvalidRequest(
            "geometry normalization produced a negative placement".to_owned(),
        ));
    }
    let mut image = RgbaImage::new(u32::from(geometry.size.0), u32::from(geometry.size.1));
    for (x, y, pixel) in frame.image.enumerate_pixels() {
        image.put_pixel(x + offset_x as u32, y + offset_y as u32, *pixel);
    }
    let clipping = frame
        .clipping
        .into_iter()
        .map(|mut notice| {
            notice.bounds_px[0] += offset_x;
            notice.bounds_px[1] += offset_y;
            notice.bounds_px[2] += offset_x;
            notice.bounds_px[3] += offset_y;
            notice
        })
        .collect();
    Ok(RenderedFrame { image, clipping })
}

fn pack_artifacts<C, P>(
    context: PackContext<'_, C, P>,
) -> Result<(Vec<AtlasPage>, Vec<ExportFrame>), ExportError>
where
    C: CancellationToken,
    P: ProgressReporter,
{
    let PackContext {
        stage,
        spool,
        atlas,
        plan,
        records,
        request,
        geometry,
        cancellation,
        progress,
    } = context;
    let mut pages = Vec::with_capacity(plan.pages.len());
    let mut frames = Vec::with_capacity(records.len());
    for page_plan in &plan.pages {
        ensure_not_cancelled(cancellation)?;
        let mut page_image = atlas.blank_page(page_plan);
        let placement_slice =
            &plan.placements[page_plan.first_frame..page_plan.first_frame + page_plan.frame_count];
        for placement in placement_slice {
            let record = &records[placement.frame_index];
            let frame = read_png(&spool.join(&record.spool_file))?;
            if rgba_digest(&frame) != record.rgba_sha256 {
                return Err(ExportError::InvalidBuild(
                    "spooled frame failed its decoded-pixel hash".to_owned(),
                ));
            }
            atlas.place(&mut page_image, placement, &frame)?;
            let individual_file = if request.profile.individual_frames {
                let path = format!(
                    "frames/{}/{}/{:04}.png",
                    record.action_key,
                    direction_name(record.direction),
                    record.sample_index
                );
                let target = stage.join(&path);
                let parent = target.parent().expect("individual frame has parent");
                fs::create_dir_all(parent).map_err(|error| {
                    ExportError::io("create individual frame directory", parent, error)
                })?;
                write_png(&target, &frame)?;
                Some(RelativePath::parse(path)?)
            } else {
                None
            };
            frames.push(ExportFrame {
                action_key: record.action_key.clone(),
                direction: record.direction,
                sample_index: record.sample_index,
                page_id: format!("page_{}", page_plan.page_index),
                rect_px: placement.rect_px,
                ground_origin_px: geometry.ground,
                duration_ticks: 1,
                mirrored_from: (record.source_direction != record.direction)
                    .then_some(record.source_direction),
                individual_file,
                rgba_sha256: record.rgba_sha256.clone(),
                clipping: record.clipping.clone(),
            });
        }
        let page_file = format!("sheet-{}.png", page_plan.page_index);
        write_png(&stage.join(&page_file), &page_image)?;
        pages.push(AtlasPage {
            id: format!("page_{}", page_plan.page_index),
            file: RelativePath::parse(page_file)?,
            size_px: page_plan.size_px,
            rgba_sha256: rgba_digest(&page_image),
        });
        progress.report(ExportProgress {
            stage: ExportStage::Packing,
            completed: page_plan.page_index + 1,
            total: plan.pages.len(),
            message: format!(
                "Packed atlas page {} of {}",
                page_plan.page_index + 1,
                plan.pages.len()
            ),
        });
    }
    Ok((pages, frames))
}

fn manifest_actions(
    actions: &[ExportActionInput],
    records: &[RenderedRecord],
    geometry: CommonGeometry,
) -> Vec<ExportAction> {
    actions
        .iter()
        .filter(|action| {
            records
                .iter()
                .any(|record| record.action_key == action.action_key)
        })
        .map(|action| {
            let directions = Direction::ALL
                .into_iter()
                .filter(|direction| {
                    records.iter().any(|record| {
                        record.action_key == action.action_key && record.direction == *direction
                    })
                })
                .collect();
            ExportAction {
                action_key: action.action_key.clone(),
                binding_ref: action.binding_ref,
                frame_size_px: geometry.size,
                ground_origin_px: geometry.ground,
                frame_count: action.motion.frame_count,
                fps: action.motion.fps,
                loop_mode: action.motion.loop_mode,
                root_motion_mode: action.root_motion_mode,
                jump_mode: action.jump_mode,
                directions,
            }
        })
        .collect()
}

fn write_current(output: &Path, current: &CurrentExport) -> Result<(), ExportError> {
    current.validate()?;
    let bytes = serde_json::to_vec_pretty(current)
        .map_err(|error| ExportError::InvalidBuild(error.to_string()))?;
    let temporary = output.join(format!(".current.{}.tmp", Uuid::new_v4().hyphenated()));
    let target = output.join("current.json");
    let backup = output.join(format!(".current.{}.backup", Uuid::new_v4().hyphenated()));
    let result = (|| {
        write_bytes(&temporary, &bytes)?;
        let reread = fs::read(&temporary)
            .map_err(|error| ExportError::io("verify current pointer", &temporary, error))?;
        let decoded: CurrentExport = serde_json::from_slice(&reread)
            .map_err(|error| ExportError::InvalidBuild(error.to_string()))?;
        decoded.validate()?;
        let had_current = match fs::symlink_metadata(&target) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err(ExportError::InvalidBuild(
                    "current.json must be a regular file".to_owned(),
                ));
            }
            Ok(_) => {
                fs::rename(&target, &backup).map_err(|error| {
                    ExportError::io("preserve previous current pointer", &target, error)
                })?;
                true
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
            Err(error) => {
                return Err(ExportError::io("inspect current pointer", &target, error));
            }
        };
        if let Err(error) = fs::rename(&temporary, &target) {
            if had_current {
                fs::rename(&backup, &target).map_err(|restore_error| {
                    ExportError::InvalidBuild(format!(
                        "could not publish current pointer ({error}) or restore the previous pointer ({restore_error})"
                    ))
                })?;
            }
            return Err(ExportError::io("replace current pointer", &target, error));
        }
        if had_current {
            let _ = fs::remove_file(&backup);
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
        if backup.exists() && !target.exists() {
            let _ = fs::rename(&backup, &target);
        }
    }
    result
}

fn sorted_sources(sources: &ExportSources) -> ExportSources {
    let mut result = sources.clone();
    for values in [
        &mut result.motion,
        &mut result.assets,
        &mut result.appearances,
        &mut result.bindings,
    ] {
        values.sort_by_key(|reference| (reference.id.to_string(), reference.revision));
    }
    result
}

fn sorted_effective_sources(sources: &[EffectiveSource]) -> Vec<EffectiveSource> {
    let mut result = sources.to_vec();
    result.sort_by_key(|source| {
        (
            format!("{:?}", source.kind),
            source.reference.id.to_string(),
            source.reference.revision,
        )
    });
    result
}

fn atlas_options(request: &ExportRequest) -> AtlasOptions {
    AtlasOptions {
        max_page_size_px: request.profile.max_page_size_px,
        padding_px: request.profile.padding_px,
        extrude_edges: request.profile.extrude_edges,
        max_pages: request.profile.max_pages,
        memory_budget_bytes: request.profile.memory_budget_bytes,
    }
}

fn missing_error(
    action: &ExportActionInput,
    direction: Direction,
    frame: u16,
    error: FrameSourceError,
) -> ExportError {
    ExportError::MissingSource {
        action: action.action_key.to_string(),
        direction,
        frame,
        message: format!("{}: {}", error.code, error.message),
    }
}

fn record_missing(
    checks: &mut Vec<ExportCheck>,
    action: &ExportActionInput,
    direction: Direction,
    frame: u16,
    message: &str,
) {
    checks.push(ExportCheck {
        code: "missing_source".to_owned(),
        level: CheckLevel::Warning,
        message: format!("{}/{direction:?}/{frame}: {message}", action.action_key),
    });
}

fn report_render<P: ProgressReporter>(progress: &mut P, completed: usize, total: usize) {
    progress.report(ExportProgress {
        stage: ExportStage::Rendering,
        completed,
        total,
        message: format!("Rendered or checked frame {completed} of {total}"),
    });
}

fn ensure_not_cancelled(cancellation: &impl CancellationToken) -> Result<(), ExportError> {
    if cancellation.is_cancelled() {
        Err(ExportError::Cancelled)
    } else {
        Ok(())
    }
}

fn digest_bytes(bytes: &[u8]) -> Sha256Digest {
    Sha256Digest::parse(format!("{:x}", Sha256::digest(bytes)))
        .expect("SHA-256 is valid lowercase hex")
}

fn direction_name(direction: Direction) -> &'static str {
    match direction {
        Direction::N => "n",
        Direction::Ne => "ne",
        Direction::E => "e",
        Direction::Se => "se",
        Direction::S => "s",
        Direction::Sw => "sw",
        Direction::W => "w",
        Direction::Nw => "nw",
    }
}

struct StageGuard {
    path: PathBuf,
    armed: bool,
}

impl StageGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn cleanup(&mut self) -> Result<(), ExportError> {
        if self.armed {
            fs::remove_dir_all(&self.path)
                .map_err(|error| ExportError::io("remove staged export", &self.path, error))?;
            self.armed = false;
        }
        Ok(())
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for StageGuard {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
