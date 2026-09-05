use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use thiserror::Error;

use crate::domain::{ObjectId, Sha256Digest};
use crate::exports::{CancellationFlag, ExportProgress, GodotPackageOutcome};

use super::{ExportOutputFormat, NpcExportExecutionOutcome};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportJobStatus {
    Queued,
    Running,
    Completed,
    Cancelled,
    Failed,
}

impl ExportJobStatus {
    fn is_active(self) -> bool {
        matches!(self, Self::Queued | Self::Running)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NpcExportResult {
    pub build: String,
    pub source_fingerprint: Sha256Digest,
    pub complete: bool,
    pub reused_existing_build: bool,
    pub format: ExportOutputFormat,
    pub godot_package: Option<NpcGodotPackageResult>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NpcGodotPackageResult {
    pub package_directory: String,
    pub animation_names: Vec<String>,
    pub scene: Option<String>,
    pub reused_existing_package: bool,
}

impl From<GodotPackageOutcome> for NpcGodotPackageResult {
    fn from(value: GodotPackageOutcome) -> Self {
        Self {
            package_directory: value.package_directory.to_string_lossy().replace('\\', "/"),
            animation_names: value.animation_names,
            scene: value.scene.map(|scene| scene.to_string()),
            reused_existing_package: value.reused_existing_package,
        }
    }
}

impl From<NpcExportExecutionOutcome> for NpcExportResult {
    fn from(value: NpcExportExecutionOutcome) -> Self {
        Self {
            build: value.generic.build.to_string(),
            source_fingerprint: value.generic.manifest.source_fingerprint,
            complete: value.generic.manifest.complete,
            reused_existing_build: value.generic.reused_existing_build,
            format: value.format,
            godot_package: value.godot_package.map(Into::into),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExportJobView {
    pub job_id: ObjectId,
    pub session_id: ObjectId,
    pub character_id: ObjectId,
    pub state: ExportJobStatus,
    pub progress: Option<ExportProgress>,
    pub result: Option<NpcExportResult>,
    pub error: Option<String>,
}

#[derive(Debug, Error)]
pub enum ExportJobError {
    #[error("another export is already writing to this managed destination")]
    DestinationBusy,
    #[error("export job does not exist for this vault session")]
    UnknownJob,
    #[error("export job registry lock is poisoned")]
    Poisoned,
}

struct ExportJobEntry {
    view: ExportJobView,
    cancellation: CancellationFlag,
    target_key: String,
}

#[derive(Default)]
struct RegistryState {
    jobs: HashMap<ObjectId, ExportJobEntry>,
    active_targets: HashMap<(ObjectId, String), ObjectId>,
}

#[derive(Default)]
pub struct ExportJobRegistry {
    state: Mutex<RegistryState>,
}

impl ExportJobRegistry {
    pub(crate) fn register(
        &self,
        session_id: ObjectId,
        character_id: ObjectId,
        target: &Path,
    ) -> Result<(ExportJobView, CancellationFlag), ExportJobError> {
        let mut state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        let target_key = target.to_string_lossy().replace('\\', "/");
        if state
            .active_targets
            .contains_key(&(session_id, target_key.clone()))
        {
            return Err(ExportJobError::DestinationBusy);
        }
        prune_terminal_jobs(&mut state);
        let job_id = ObjectId::new();
        let cancellation = CancellationFlag::default();
        let view = ExportJobView {
            job_id,
            session_id,
            character_id,
            state: ExportJobStatus::Queued,
            progress: None,
            result: None,
            error: None,
        };
        state
            .active_targets
            .insert((session_id, target_key.clone()), job_id);
        state.jobs.insert(
            job_id,
            ExportJobEntry {
                view: view.clone(),
                cancellation: cancellation.clone(),
                target_key,
            },
        );
        Ok((view, cancellation))
    }

    pub fn get(
        &self,
        session_id: ObjectId,
        job_id: ObjectId,
    ) -> Result<ExportJobView, ExportJobError> {
        let state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        require_job(&state, session_id, job_id).map(|entry| entry.view.clone())
    }

    pub fn cancel(
        &self,
        session_id: ObjectId,
        job_id: ObjectId,
    ) -> Result<ExportJobView, ExportJobError> {
        let state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        let entry = require_job(&state, session_id, job_id)?;
        if entry.view.state.is_active() {
            entry.cancellation.cancel();
        }
        Ok(entry.view.clone())
    }

    pub(crate) fn report(
        &self,
        job_id: ObjectId,
        progress: ExportProgress,
    ) -> Result<ExportJobView, ExportJobError> {
        let mut state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        let entry = state
            .jobs
            .get_mut(&job_id)
            .ok_or(ExportJobError::UnknownJob)?;
        if entry.view.state.is_active() {
            entry.view.state = ExportJobStatus::Running;
            entry.view.progress = Some(progress);
        }
        Ok(entry.view.clone())
    }

    pub(crate) fn complete(
        &self,
        job_id: ObjectId,
        outcome: NpcExportExecutionOutcome,
    ) -> Result<ExportJobView, ExportJobError> {
        self.finish(
            job_id,
            ExportJobStatus::Completed,
            Some(outcome.into()),
            None,
        )
    }

    pub(crate) fn cancelled(&self, job_id: ObjectId) -> Result<ExportJobView, ExportJobError> {
        self.finish(job_id, ExportJobStatus::Cancelled, None, None)
    }

    pub(crate) fn failed(
        &self,
        job_id: ObjectId,
        message: String,
    ) -> Result<ExportJobView, ExportJobError> {
        self.finish(job_id, ExportJobStatus::Failed, None, Some(message))
    }

    pub fn has_active_session(&self, session_id: ObjectId) -> Result<bool, ExportJobError> {
        let state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        Ok(state
            .jobs
            .values()
            .any(|entry| entry.view.session_id == session_id && entry.view.state.is_active()))
    }

    pub fn has_active_character(
        &self,
        session_id: ObjectId,
        character_id: ObjectId,
    ) -> Result<bool, ExportJobError> {
        let state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        Ok(state.jobs.values().any(|entry| {
            entry.view.session_id == session_id
                && entry.view.character_id == character_id
                && entry.view.state.is_active()
        }))
    }

    fn finish(
        &self,
        job_id: ObjectId,
        status: ExportJobStatus,
        result: Option<NpcExportResult>,
        error: Option<String>,
    ) -> Result<ExportJobView, ExportJobError> {
        let mut state = self.state.lock().map_err(|_| ExportJobError::Poisoned)?;
        let (session_id, target_key, view) = {
            let entry = state
                .jobs
                .get_mut(&job_id)
                .ok_or(ExportJobError::UnknownJob)?;
            if entry.view.state.is_active() {
                entry.view.state = status;
                entry.view.result = result;
                entry.view.error = error;
            }
            (
                entry.view.session_id,
                entry.target_key.clone(),
                entry.view.clone(),
            )
        };
        state.active_targets.remove(&(session_id, target_key));
        Ok(view)
    }
}

fn require_job(
    state: &RegistryState,
    session_id: ObjectId,
    job_id: ObjectId,
) -> Result<&ExportJobEntry, ExportJobError> {
    state
        .jobs
        .get(&job_id)
        .filter(|entry| entry.view.session_id == session_id)
        .ok_or(ExportJobError::UnknownJob)
}

fn prune_terminal_jobs(state: &mut RegistryState) {
    const RETAINED_JOBS: usize = 128;
    if state.jobs.len() < RETAINED_JOBS {
        return;
    }
    let remove = state
        .jobs
        .iter()
        .filter(|(_, entry)| !entry.view.state.is_active())
        .map(|(id, _)| *id)
        .take(state.jobs.len() + 1 - RETAINED_JOBS)
        .collect::<Vec<_>>();
    for id in remove {
        state.jobs.remove(&id);
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn jobs_are_owned_by_a_session_and_serialize_a_destination() {
        let jobs = ExportJobRegistry::default();
        let session = ObjectId::new();
        let character = ObjectId::new();
        let (first, _) = jobs
            .register(session, character, Path::new("npc/_exports"))
            .unwrap();
        assert!(matches!(
            jobs.register(session, character, Path::new("npc/_exports")),
            Err(ExportJobError::DestinationBusy)
        ));
        assert!(matches!(
            jobs.get(ObjectId::new(), first.job_id),
            Err(ExportJobError::UnknownJob)
        ));
        let cancelled = jobs.cancelled(first.job_id).unwrap();
        assert_eq!(cancelled.state, ExportJobStatus::Cancelled);
        assert!(jobs
            .register(session, character, Path::new("npc/_exports"))
            .is_ok());
    }
}
