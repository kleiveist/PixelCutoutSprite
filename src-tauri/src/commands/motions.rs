use std::collections::HashSet;
use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::State;

use crate::animation::{bake_helper_channel, CachedPreviewFrame, PreviewCache, PreviewCacheKey};
use crate::application::{
    CreateMotionRequest, MotionCard, MotionDashboard, MotionDraft, MotionEditorData,
    MotionOpenTarget, MotionService, SaveMotionDraftRequest, VaultService,
};
use crate::directions::{detach_to_explicit, DirectionResolver};
use crate::domain::{Direction, MotionRevision, ObjectId};
use crate::editor::{
    compile_sampled_dummy, encode_dummy_preview, encode_dummy_preview_data_url, render_dummy,
    render_sampled_dummy, DummyPreview, EditablePose, SampledDummyPreview,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MotionCardPreviewData {
    pub frame_urls: Vec<String>,
    pub sample_indices: Vec<u16>,
    pub fps: u16,
    pub direction: Direction,
    pub clipping_count: usize,
}

#[tauri::command]
pub fn get_motion_dashboard(
    session_id: String,
    area_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDashboard, String> {
    let service = lock(&service)?;
    MotionService::dashboard(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("area_id", &area_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_motion(
    session_id: String,
    request: CreateMotionRequest,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::create(&mut service, parse_id("session_id", &session_id)?, request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn duplicate_motion(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::duplicate(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_motion_draft(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDraft, String> {
    let service = lock(&service)?;
    MotionService::load_draft(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_motion_editor(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionEditorData, String> {
    let service = lock(&service)?;
    MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn render_motion_dummy(
    session_id: String,
    template_id: String,
    direction: Direction,
    pose: EditablePose,
    service: State<'_, Mutex<VaultService>>,
) -> Result<DummyPreview, String> {
    let editor = {
        let service = lock(&service)?;
        MotionService::editor_data(
            &service,
            parse_id("session_id", &session_id)?,
            parse_id("template_id", &template_id)?,
        )
        .map_err(|error| error.to_string())?
    };
    encode_dummy_preview(
        render_dummy(
            &editor.profile,
            &pose,
            direction,
            editor.draft.frame_size_px,
            editor.draft.ground_origin_px,
        )
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn render_motion_sample(
    session_id: String,
    template_id: String,
    draft: MotionDraft,
    direction: Direction,
    sample_index: u16,
    service: State<'_, Mutex<VaultService>>,
) -> Result<SampledDummyPreview, String> {
    let editor = {
        let service = lock(&service)?;
        MotionService::editor_data(
            &service,
            parse_id("session_id", &session_id)?,
            parse_id("template_id", &template_id)?,
        )
        .map_err(|error| error.to_string())?
    };
    if draft.template_id != editor.draft.template_id
        || draft.revision != editor.draft.revision
        || draft.profile_ref != editor.draft.profile_ref
    {
        return Err(
            "preview draft does not match the currently opened template revision".to_owned(),
        );
    }
    let slots = editor
        .profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    let motion = draft.sampling_revision();
    motion
        .validate(Some(&slots))
        .map_err(|error| error.to_string())?;
    render_sampled_dummy(&editor.profile, &motion, direction, sample_index)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn detach_motion_direction(
    session_id: String,
    template_id: String,
    mut draft: MotionDraft,
    direction: Direction,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDraft, String> {
    let service = lock(&service)?;
    let editor = MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())?;
    if draft.template_id != editor.draft.template_id
        || draft.revision != editor.draft.revision
        || draft.profile_ref != editor.draft.profile_ref
    {
        return Err(
            "direction draft does not match the currently opened template revision".to_owned(),
        );
    }
    let detached = detach_to_explicit(&draft.sampling_revision(), &editor.profile, direction)
        .map_err(|error| error.to_string())?;
    draft.directions = detached.definitions;
    draft.tracks = detached.tracks;
    draft.validate().map_err(|error| error.to_string())?;
    Ok(draft)
}

#[tauri::command]
pub fn bake_motion_helper(
    session_id: String,
    template_id: String,
    mut draft: MotionDraft,
    helper_index: usize,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionDraft, String> {
    let service = lock(&service)?;
    let editor = MotionService::editor_data(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())?;
    if draft.template_id != editor.draft.template_id
        || draft.revision != editor.draft.revision
        || draft.profile_ref != editor.draft.profile_ref
    {
        return Err(
            "helper draft does not match the currently opened template revision".to_owned(),
        );
    }
    let baked = bake_helper_channel(&draft.sampling_revision(), helper_index)
        .map_err(|error| error.to_string())?;
    draft.tracks = baked.tracks;
    draft.semantics = baked.semantics;
    let slots = editor
        .profile
        .slots
        .iter()
        .map(|slot| slot.id.clone())
        .collect::<HashSet<_>>();
    draft
        .sampling_revision()
        .validate(Some(&slots))
        .map_err(|error| error.to_string())?;
    Ok(draft)
}

#[tauri::command]
pub fn get_motion_card_preview(
    session_id: String,
    template_id: String,
    reduced_motion: bool,
    service: State<'_, Mutex<VaultService>>,
    cache: State<'_, Mutex<PreviewCache>>,
) -> Result<MotionCardPreviewData, String> {
    let editor = {
        let service = lock(&service)?;
        MotionService::editor_data(
            &service,
            parse_id("session_id", &session_id)?,
            parse_id("template_id", &template_id)?,
        )
        .map_err(|error| error.to_string())?
    };
    let motion = editor.draft.sampling_revision();
    let resolver =
        DirectionResolver::new(&motion, &editor.profile).map_err(|error| error.to_string())?;
    let direction = [
        Direction::S,
        Direction::Se,
        Direction::E,
        Direction::Ne,
        Direction::N,
        Direction::Sw,
        Direction::W,
        Direction::Nw,
    ]
    .into_iter()
    .find(|candidate| resolver.resolve(*candidate).is_ok())
    .ok_or_else(|| "motion has no renderable direction".to_owned())?;
    let sample_indices = preview_sample_indices(motion.frame_count, reduced_motion);
    let mut frame_urls = Vec::with_capacity(sample_indices.len());
    let mut clipping_count = 0;
    for sample_index in &sample_indices {
        let key =
            PreviewCacheKey::for_motion(&motion, direction, *sample_index, "stored-dummy-card-v1")
                .map_err(|error| error.to_string())?;
        let preview = PreviewCache::get_or_render(cache.inner(), key, || {
            let frame = compile_sampled_dummy(&editor.profile, &motion, direction, *sample_index)
                .map_err(|error| error.to_string())?
                .frame;
            let data_url =
                encode_dummy_preview_data_url(&frame.image).map_err(|error| error.to_string())?;
            Ok(CachedPreviewFrame::new(frame, data_url))
        })?;
        clipping_count += preview.frame.clipping.len();
        frame_urls.push(preview.data_url.clone());
    }
    let fps = ((u32::try_from(sample_indices.len()).unwrap_or(1) * u32::from(motion.fps))
        / u32::from(motion.frame_count))
    .clamp(1, 120) as u16;
    Ok(MotionCardPreviewData {
        frame_urls,
        sample_indices,
        fps,
        direction,
        clipping_count,
    })
}

#[tauri::command]
pub fn save_motion_draft(
    session_id: String,
    request: SaveMotionDraftRequest,
    service: State<'_, Mutex<VaultService>>,
    cache: State<'_, Mutex<PreviewCache>>,
) -> Result<MotionEditorData, String> {
    let session_id = parse_id("session_id", &session_id)?;
    let template_id = request.template_id;
    let editor = {
        let mut service = lock(&service)?;
        MotionService::save_draft(&mut service, session_id, request)
            .and_then(|_| MotionService::editor_data(&service, session_id, template_id))
            .map_err(|error| error.to_string())?
    };
    cache
        .lock()
        .map_err(|_| "motion preview cache lock is poisoned".to_owned())?
        .invalidate_motion(template_id);
    Ok(editor)
}

#[tauri::command]
pub fn publish_motion(
    session_id: String,
    template_id: String,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionRevision, String> {
    let mut service = lock(&service)?;
    MotionService::publish(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_motion_archived(
    session_id: String,
    template_id: String,
    expected_revision: u32,
    archived: bool,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionCard, String> {
    let mut service = lock(&service)?;
    MotionService::set_archived(
        &mut service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
        expected_revision,
        archived,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_motion(
    session_id: String,
    template_id: String,
    expected_revision: u32,
    service: State<'_, Mutex<VaultService>>,
    cache: State<'_, Mutex<PreviewCache>>,
) -> Result<(), String> {
    let session_id = parse_id("session_id", &session_id)?;
    let template_id = parse_id("template_id", &template_id)?;
    {
        let mut service = lock(&service)?;
        MotionService::remove(&mut service, session_id, template_id, expected_revision)
            .map_err(|error| error.to_string())?;
    }
    cache
        .lock()
        .map_err(|_| "motion preview cache lock is poisoned".to_owned())?
        .invalidate_motion(template_id);
    Ok(())
}

#[tauri::command]
pub fn resolve_motion_open(
    session_id: String,
    template_id: String,
    character_id: Option<String>,
    service: State<'_, Mutex<VaultService>>,
) -> Result<MotionOpenTarget, String> {
    let service = lock(&service)?;
    MotionService::resolve_open(
        &service,
        parse_id("session_id", &session_id)?,
        parse_id("template_id", &template_id)?,
        character_id
            .map(|value| parse_id("character_id", &value))
            .transpose()?,
    )
    .map_err(|error| error.to_string())
}

fn lock<'a>(
    service: &'a State<'_, Mutex<VaultService>>,
) -> Result<MutexGuard<'a, VaultService>, String> {
    service
        .lock()
        .map_err(|_| "vault service lock is poisoned".to_owned())
}

fn parse_id(field: &'static str, value: &str) -> Result<ObjectId, String> {
    ObjectId::parse(field, value).map_err(|error| error.to_string())
}

fn preview_sample_indices(frame_count: u16, reduced_motion: bool) -> Vec<u16> {
    if reduced_motion || frame_count == 1 {
        return vec![0];
    }
    let last = frame_count - 1;
    let mut frames = (0..3)
        .map(|step| (u32::from(last) * step / 2) as u16)
        .collect::<Vec<_>>();
    frames.dedup();
    frames
}

#[cfg(test)]
mod tests {
    use super::preview_sample_indices;

    #[test]
    fn card_preview_sampling_is_bounded_and_reduced_motion_is_static() {
        assert_eq!(preview_sample_indices(1, false), vec![0]);
        assert_eq!(preview_sample_indices(2, false), vec![0, 1]);
        assert_eq!(preview_sample_indices(12, false), vec![0, 5, 11]);
        assert_eq!(preview_sample_indices(12, true), vec![0]);
        for frame_count in 1..=1_024 {
            let animated = preview_sample_indices(frame_count, false);
            assert!(animated.len() <= 3);
            assert_eq!(preview_sample_indices(frame_count, true), vec![0]);
        }
    }
}
