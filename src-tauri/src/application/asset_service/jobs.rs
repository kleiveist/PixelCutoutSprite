use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use thiserror::Error;

use crate::domain::ObjectId;
use crate::exports::CancellationFlag;

use super::AssetInventoryItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetImportJobStatus {
    Queued,
    Running,
    Completed,
    Cancelled,
    Failed,
}

impl AssetImportJobStatus {
    fn is_active(self) -> bool {
        matches!(self, Self::Queued | Self::Running)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetImportJobStage {
    Preflight,
    Decoding,
    Staging,
    Committing,
    Refreshing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetImportJobProgress {
    pub stage: AssetImportJobStage,
    pub completed: usize,
    pub total: usize,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetImportJobResult {
    pub imported_assets: Vec<AssetInventoryItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssetImportJobView {
    pub job_id: ObjectId,
    pub session_id: ObjectId,
    pub area_id: ObjectId,
    pub state: AssetImportJobStatus,
    pub progress: AssetImportJobProgress,
    pub result: Option<AssetImportJobResult>,
    pub error: Option<String>,
}

#[derive(Debug, Error)]
pub enum AssetImportJobError {
    #[error("another asset import is already writing to this area")]
    AreaBusy,
    #[error("asset import job does not exist for this vault session")]
    UnknownJob,
    #[error("asset import job registry lock is poisoned")]
    Poisoned,
}

#[derive(Debug, Error)]
pub enum AssetInspectionRegistryError {
    #[error("another asset inspection is already active in the vault session")]
    InspectionActive,
    #[error("asset inspection registry lock is poisoned")]
    Poisoned,
}

#[derive(Default)]
pub struct AssetInspectionRegistry {
    active: Mutex<HashMap<(ObjectId, ObjectId), CancellationFlag>>,
}

impl AssetInspectionRegistry {
    pub fn register(
        &self,
        session_id: ObjectId,
        inspection_id: ObjectId,
    ) -> Result<CancellationFlag, AssetInspectionRegistryError> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| AssetInspectionRegistryError::Poisoned)?;
        if active.keys().any(|(owner, _)| *owner == session_id) {
            return Err(AssetInspectionRegistryError::InspectionActive);
        }
        let cancellation = CancellationFlag::default();
        active.insert((session_id, inspection_id), cancellation.clone());
        Ok(cancellation)
    }

    pub fn cancel(
        &self,
        session_id: ObjectId,
        inspection_id: ObjectId,
    ) -> Result<bool, AssetInspectionRegistryError> {
        let active = self
            .active
            .lock()
            .map_err(|_| AssetInspectionRegistryError::Poisoned)?;
        let Some(cancellation) = active.get(&(session_id, inspection_id)) else {
            return Ok(false);
        };
        cancellation.cancel();
        Ok(true)
    }

    pub fn cancel_session(
        &self,
        session_id: ObjectId,
    ) -> Result<usize, AssetInspectionRegistryError> {
        let active = self
            .active
            .lock()
            .map_err(|_| AssetInspectionRegistryError::Poisoned)?;
        let mut cancelled = 0;
        for ((owner, _), cancellation) in active.iter() {
            if *owner == session_id {
                cancellation.cancel();
                cancelled += 1;
            }
        }
        Ok(cancelled)
    }

    pub fn finish(
        &self,
        session_id: ObjectId,
        inspection_id: ObjectId,
    ) -> Result<(), AssetInspectionRegistryError> {
        self.active
            .lock()
            .map_err(|_| AssetInspectionRegistryError::Poisoned)?
            .remove(&(session_id, inspection_id));
        Ok(())
    }
}

struct AssetImportJobEntry {
    view: AssetImportJobView,
    cancellation: CancellationFlag,
}

#[derive(Default)]
struct RegistryState {
    jobs: HashMap<ObjectId, AssetImportJobEntry>,
    active_areas: HashMap<(ObjectId, ObjectId), ObjectId>,
}

#[derive(Default)]
pub struct AssetImportJobRegistry {
    state: Mutex<RegistryState>,
}

impl AssetImportJobRegistry {
    #[doc(hidden)]
    pub fn register(
        &self,
        session_id: ObjectId,
        area_id: ObjectId,
    ) -> Result<(AssetImportJobView, CancellationFlag), AssetImportJobError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        if state.active_areas.contains_key(&(session_id, area_id)) {
            return Err(AssetImportJobError::AreaBusy);
        }
        prune_terminal_jobs(&mut state);
        let job_id = ObjectId::new();
        let cancellation = CancellationFlag::default();
        let view = AssetImportJobView {
            job_id,
            session_id,
            area_id,
            state: AssetImportJobStatus::Queued,
            progress: AssetImportJobProgress {
                stage: AssetImportJobStage::Preflight,
                completed: 0,
                total: 1,
                message: "Asset import queued".to_owned(),
            },
            result: None,
            error: None,
        };
        state.active_areas.insert((session_id, area_id), job_id);
        state.jobs.insert(
            job_id,
            AssetImportJobEntry {
                view: view.clone(),
                cancellation: cancellation.clone(),
            },
        );
        Ok((view, cancellation))
    }

    pub fn get(
        &self,
        session_id: ObjectId,
        job_id: ObjectId,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        let state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        require_job(&state, session_id, job_id).map(|entry| entry.view.clone())
    }

    pub fn list_active(
        &self,
        session_id: ObjectId,
    ) -> Result<Vec<AssetImportJobView>, AssetImportJobError> {
        let state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        let mut jobs = state
            .jobs
            .values()
            .filter(|entry| entry.view.session_id == session_id && entry.view.state.is_active())
            .map(|entry| entry.view.clone())
            .collect::<Vec<_>>();
        jobs.sort_by_key(|job| job.job_id);
        Ok(jobs)
    }

    pub fn cancel(
        &self,
        session_id: ObjectId,
        job_id: ObjectId,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        let state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        let entry = require_job(&state, session_id, job_id)?;
        if entry.view.state.is_active() {
            entry.cancellation.cancel();
        }
        Ok(entry.view.clone())
    }

    pub(crate) fn report(
        &self,
        job_id: ObjectId,
        progress: AssetImportJobProgress,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        let entry = state
            .jobs
            .get_mut(&job_id)
            .ok_or(AssetImportJobError::UnknownJob)?;
        if entry.view.state.is_active() {
            entry.view.state = AssetImportJobStatus::Running;
            entry.view.progress = progress;
        }
        Ok(entry.view.clone())
    }

    pub(crate) fn complete(
        &self,
        job_id: ObjectId,
        imported_assets: Vec<AssetInventoryItem>,
        warning: Option<String>,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        self.finish(
            job_id,
            AssetImportJobStatus::Completed,
            Some(AssetImportJobResult {
                imported_assets,
                warning,
            }),
            None,
        )
    }

    pub(crate) fn cancelled(
        &self,
        job_id: ObjectId,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        self.finish(job_id, AssetImportJobStatus::Cancelled, None, None)
    }

    pub(crate) fn failed(
        &self,
        job_id: ObjectId,
        message: String,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        self.finish(job_id, AssetImportJobStatus::Failed, None, Some(message))
    }

    pub fn has_active_session(&self, session_id: ObjectId) -> Result<bool, AssetImportJobError> {
        let state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        Ok(state
            .jobs
            .values()
            .any(|entry| entry.view.session_id == session_id && entry.view.state.is_active()))
    }

    fn finish(
        &self,
        job_id: ObjectId,
        status: AssetImportJobStatus,
        result: Option<AssetImportJobResult>,
        error: Option<String>,
    ) -> Result<AssetImportJobView, AssetImportJobError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| AssetImportJobError::Poisoned)?;
        let (session_id, area_id, view) = {
            let entry = state
                .jobs
                .get_mut(&job_id)
                .ok_or(AssetImportJobError::UnknownJob)?;
            if entry.view.state.is_active() {
                if status == AssetImportJobStatus::Completed {
                    let refresh_failed = result
                        .as_ref()
                        .is_some_and(|result| result.warning.is_some());
                    entry.view.progress = AssetImportJobProgress {
                        stage: AssetImportJobStage::Refreshing,
                        completed: if refresh_failed { 0 } else { 1 },
                        total: 1,
                        message: if refresh_failed {
                            "Import committed; vault index refresh needs attention".to_owned()
                        } else {
                            "Import committed and vault index refreshed".to_owned()
                        },
                    };
                }
                entry.view.state = status;
                entry.view.result = result;
                entry.view.error = error;
            }
            (
                entry.view.session_id,
                entry.view.area_id,
                entry.view.clone(),
            )
        };
        state.active_areas.remove(&(session_id, area_id));
        Ok(view)
    }
}

fn require_job(
    state: &RegistryState,
    session_id: ObjectId,
    job_id: ObjectId,
) -> Result<&AssetImportJobEntry, AssetImportJobError> {
    state
        .jobs
        .get(&job_id)
        .filter(|entry| entry.view.session_id == session_id)
        .ok_or(AssetImportJobError::UnknownJob)
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
    use super::*;
    use crate::exports::CancellationToken;

    #[test]
    fn jobs_are_session_owned_and_serialize_each_area() {
        let jobs = AssetImportJobRegistry::default();
        let session = ObjectId::new();
        let area = ObjectId::new();
        let (first, _) = jobs.register(session, area).unwrap();
        assert_eq!(jobs.list_active(session).unwrap(), vec![first.clone()]);
        assert!(matches!(
            jobs.register(session, area),
            Err(AssetImportJobError::AreaBusy)
        ));
        assert!(matches!(
            jobs.get(ObjectId::new(), first.job_id),
            Err(AssetImportJobError::UnknownJob)
        ));
        assert_eq!(
            jobs.cancelled(first.job_id).unwrap().state,
            AssetImportJobStatus::Cancelled
        );
        assert!(jobs.list_active(session).unwrap().is_empty());
        assert!(jobs.register(session, area).is_ok());
    }

    #[test]
    fn committed_import_can_report_a_non_fatal_refresh_warning() {
        let jobs = AssetImportJobRegistry::default();
        let (job, _) = jobs.register(ObjectId::new(), ObjectId::new()).unwrap();
        let completed = jobs
            .complete(
                job.job_id,
                Vec::new(),
                Some("index refresh failed after commit".to_owned()),
            )
            .unwrap();
        assert_eq!(completed.state, AssetImportJobStatus::Completed);
        assert_eq!(
            completed.result.unwrap().warning.as_deref(),
            Some("index refresh failed after commit")
        );
        assert!(completed.error.is_none());
    }

    #[test]
    fn inspection_cancellation_is_session_owned_and_idempotent() {
        let inspections = AssetInspectionRegistry::default();
        let session = ObjectId::new();
        let inspection = ObjectId::new();
        let cancellation = inspections.register(session, inspection).unwrap();
        assert!(matches!(
            inspections.register(session, inspection),
            Err(AssetInspectionRegistryError::InspectionActive)
        ));
        assert!(matches!(
            inspections.register(session, ObjectId::new()),
            Err(AssetInspectionRegistryError::InspectionActive)
        ));
        assert!(!inspections.cancel(ObjectId::new(), inspection).unwrap());
        assert!(inspections.cancel(session, inspection).unwrap());
        assert!(cancellation.is_cancelled());
        inspections.finish(session, inspection).unwrap();
        assert!(!inspections.cancel(session, inspection).unwrap());
    }
}
