use super::segmentation::{refine, RefineControl, RefineResult, SelectionParameters};
use super::{
    catalog, invalid, load_project, snapshot_image, valid_hash, verify_original, Mask, MAX_PIXELS,
};
use crate::storage::{StorageError, VaultRoot};
use crate::workspace::validate_portable_id;
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    Arc, Mutex,
};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RefineRequest {
    pub job_id: String,
    pub project_path: String,
    pub source_hash: String,
    pub part_id: String,
    pub mask_revision: u64,
    pub mask: Mask,
    pub parameters: SelectionParameters,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefineJobSnapshot {
    pub job_id: String,
    pub source_hash: String,
    pub part_id: String,
    pub mask_revision: u64,
    pub progress: u8,
    pub status: &'static str,
    pub result: Option<RefineResult>,
    pub error: Option<String>,
}
struct Job {
    id: String,
    session_id: String,
    generation: u64,
    source_hash: String,
    part_id: String,
    mask_revision: u64,
    cancelled: AtomicBool,
    progress: AtomicU8,
    completion: Mutex<Option<Result<RefineResult, String>>>,
}
#[derive(Default)]
pub struct CutoutJobs {
    current: Mutex<Option<Arc<Job>>>,
}

impl CutoutJobs {
    pub fn start(
        &self,
        root: VaultRoot,
        session_id: String,
        generation: u64,
        request: RefineRequest,
    ) -> Result<String, StorageError> {
        validate_portable_id(&request.job_id)?;
        if !valid_hash(&request.source_hash)
            || request.mask_revision > 9_007_199_254_740_991
            || !catalog().iter().any(|part| part.part_id == request.part_id)
        {
            return Err(invalid("Ungültiger Auswahlauftrag."));
        }
        request.parameters.validate()?;
        request.mask.validate(MAX_PIXELS as u32)?;
        let mut current = self
            .current
            .lock()
            .map_err(|_| invalid("Auswahlaufträge sind gesperrt."))?;
        if let Some(previous) = current.as_ref() {
            if previous
                .completion
                .lock()
                .map_err(|_| invalid("Auswahlauftrag ist gesperrt."))?
                .is_none()
            {
                return Err(invalid("Eine Auswahlberechnung läuft noch. Bitte abbrechen oder ihren Abschluss abwarten."));
            }
        }
        let job = Arc::new(Job {
            id: request.job_id.clone(),
            session_id,
            generation,
            source_hash: request.source_hash.clone(),
            part_id: request.part_id.clone(),
            mask_revision: request.mask_revision,
            cancelled: AtomicBool::new(false),
            progress: AtomicU8::new(0),
            completion: Mutex::new(None),
        });
        *current = Some(job.clone());
        tauri::async_runtime::spawn_blocking(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if job.cancelled.load(Ordering::Relaxed) {
                    return Err(invalid("CANCELLED: Auswahlhilfe abgebrochen."));
                }
                let loaded = load_project(&root, &request.project_path)?;
                if loaded.project.source.sha256 != request.source_hash
                    || !loaded
                        .project
                        .parts
                        .iter()
                        .any(|part| part.part_id == request.part_id)
                {
                    return Err(StorageError::WriteConflict);
                }
                if let (Some(path), Some(hash)) = (
                    &loaded.project.source.original_path,
                    &loaded.project.source.original_sha256,
                ) {
                    verify_original(&root, path, hash)?;
                }
                let image = snapshot_image(&root, &loaded)?;
                let result = refine(
                    &image,
                    &request.mask,
                    request.parameters,
                    &RefineControl {
                        cancelled: &job.cancelled,
                        progress: &job.progress,
                    },
                )?;
                if let (Some(path), Some(hash)) = (
                    &loaded.project.source.original_path,
                    &loaded.project.source.original_sha256,
                ) {
                    verify_original(&root, path, hash)?;
                }
                if job.cancelled.load(Ordering::Relaxed) {
                    return Err(invalid("CANCELLED: Auswahlhilfe abgebrochen."));
                }
                Ok(result)
            }))
            .map_err(|_| "Die lokale Auswahlberechnung wurde unerwartet beendet.".to_owned())
            .and_then(|result| result.map_err(|error| error.to_string()));
            if let Ok(mut completion) = job.completion.lock() {
                *completion = Some(result);
                job.progress.store(100, Ordering::Relaxed);
            }
        });
        Ok(request.job_id)
    }
    fn owned(&self, id: &str, session_id: &str, generation: u64) -> Result<Arc<Job>, StorageError> {
        self.current
            .lock()
            .map_err(|_| invalid("Auswahlaufträge sind gesperrt."))?
            .as_ref()
            .filter(|job| {
                job.id == id && job.session_id == session_id && job.generation == generation
            })
            .cloned()
            .ok_or_else(|| invalid("Unbekannter oder veralteter Auswahlauftrag."))
    }
    pub fn cancel(&self, id: &str, session_id: &str, generation: u64) -> Result<(), StorageError> {
        self.owned(id, session_id, generation)?
            .cancelled
            .store(true, Ordering::Relaxed);
        Ok(())
    }
    pub fn snapshot(
        &self,
        id: &str,
        session_id: &str,
        generation: u64,
    ) -> Result<RefineJobSnapshot, StorageError> {
        let job = self.owned(id, session_id, generation)?;
        let completion = job
            .completion
            .lock()
            .map_err(|_| invalid("Auswahlauftrag ist gesperrt."))?;
        let (status, result, error) = match completion.as_ref() {
            None => (
                if job.cancelled.load(Ordering::Relaxed) {
                    "cancelling"
                } else {
                    "running"
                },
                None,
                None,
            ),
            Some(Ok(result)) if !job.cancelled.load(Ordering::Relaxed) => {
                ("completed", Some(result.clone()), None)
            }
            Some(Err(error)) if !error.contains("CANCELLED") => {
                ("failed", None, Some(error.clone()))
            }
            _ => ("cancelled", None, None),
        };
        Ok(RefineJobSnapshot {
            job_id: job.id.clone(),
            source_hash: job.source_hash.clone(),
            part_id: job.part_id.clone(),
            mask_revision: job.mask_revision,
            progress: job.progress.load(Ordering::Relaxed),
            status,
            result,
            error,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cutout::{digest, encode_png, open_source, LoadedCutout};
    use std::{
        fs,
        time::{Duration, Instant},
    };
    use tempfile::TempDir;

    fn fixture() -> (TempDir, VaultRoot, LoadedCutout) {
        let temp = TempDir::new().unwrap();
        let root = VaultRoot::open(temp.path()).unwrap();
        let bytes = encode_png(&image::RgbaImage::from_pixel(
            512,
            512,
            image::Rgba([60, 100, 170, 255]),
        ))
        .unwrap();
        fs::write(temp.path().join("source.png"), &bytes).unwrap();
        let loaded = open_source(&root, "source.png", &digest(&bytes), true).unwrap();
        (temp, root, loaded)
    }
    fn request(loaded: &LoadedCutout, id: &str) -> RefineRequest {
        RefineRequest {
            job_id: id.to_owned(),
            project_path: loaded.project_path.clone(),
            source_hash: loaded.project.source.sha256.clone(),
            part_id: "head".to_owned(),
            mask_revision: 7,
            parameters: SelectionParameters::default(),
            mask: Mask {
                roi: vec![[0, 512 * 512]],
                positive: vec![[1, 1]],
                negative: vec![[512 * 512 - 1, 1]],
                ..Mask::default()
            },
        }
    }
    fn finish(jobs: &CutoutJobs, id: &str) -> RefineJobSnapshot {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let state = jobs.snapshot(id, "owner-a", 3).unwrap();
            if !matches!(state.status, "running" | "cancelling") {
                return state;
            }
            assert!(Instant::now() < deadline, "worker did not finish");
            std::thread::sleep(Duration::from_millis(2));
        }
    }
    #[test]
    fn jobs_are_bounded_scoped_cancellable_and_never_write_masks() {
        let (temp, root, loaded) = fixture();
        let before = fs::read(temp.path().join(&loaded.project_path)).unwrap();
        let jobs = CutoutJobs::default();
        jobs.start(
            root.clone(),
            "owner-a".to_owned(),
            3,
            request(&loaded, "job-first"),
        )
        .unwrap();
        assert!(jobs
            .start(
                root.clone(),
                "owner-a".to_owned(),
                3,
                request(&loaded, "job-second")
            )
            .is_err());
        assert!(jobs.snapshot("job-first", "owner-b", 3).is_err());
        assert!(jobs.cancel("job-first", "owner-a", 4).is_err());
        let cancelled_at = Instant::now();
        jobs.cancel("job-first", "owner-a", 3).unwrap();
        assert_eq!(finish(&jobs, "job-first").status, "cancelled");
        println!("P39 worker cancel-to-terminal (512x512 source, including any in-flight decode): {} microseconds", cancelled_at.elapsed().as_micros());
        jobs.start(
            root,
            "owner-a".to_owned(),
            3,
            request(&loaded, "job-second"),
        )
        .unwrap();
        let complete = finish(&jobs, "job-second");
        assert_eq!(complete.status, "completed");
        assert_eq!(complete.mask_revision, 7);
        assert!(complete.result.unwrap().draft.is_some());
        assert_eq!(
            fs::read(temp.path().join(&loaded.project_path)).unwrap(),
            before
        );
        assert!(jobs.snapshot("job-first", "owner-a", 3).is_err());
    }
    #[test]
    fn a_changed_source_is_reported_without_any_result_or_document_write() {
        let (temp, root, loaded) = fixture();
        let jobs = CutoutJobs::default();
        let bytes = encode_png(&image::RgbaImage::from_pixel(
            512,
            512,
            image::Rgba([200, 80, 10, 255]),
        ))
        .unwrap();
        fs::write(temp.path().join("source.png"), bytes).unwrap();
        jobs.start(
            root,
            "owner-a".to_owned(),
            3,
            request(&loaded, "job-changed"),
        )
        .unwrap();
        let failed = finish(&jobs, "job-changed");
        assert_eq!(failed.status, "failed");
        assert!(failed.result.is_none());
        assert!(failed.error.unwrap().contains("SOURCE_CHANGED"));
    }
}
