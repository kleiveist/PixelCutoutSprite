use std::collections::{HashMap, VecDeque};

use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::domain::{canonical_json_bytes, Direction, DomainError, MotionRevision};
use crate::render::RenderedFrame;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PreviewCacheKey {
    pub content_fingerprint: String,
    pub renderer_version: u16,
    pub direction: Direction,
    pub frame: u16,
    pub options_fingerprint: String,
}

impl PreviewCacheKey {
    pub fn for_motion(
        motion: &MotionRevision,
        direction: Direction,
        frame: u16,
        options_fingerprint: impl Into<String>,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            content_fingerprint: preview_fingerprint(motion)?,
            renderer_version: 1,
            direction,
            frame,
            options_fingerprint: options_fingerprint.into(),
        })
    }
}

#[derive(Debug)]
pub struct PreviewCache {
    maximum_bytes: usize,
    used_bytes: usize,
    entries: HashMap<PreviewCacheKey, RenderedFrame>,
    recency: VecDeque<PreviewCacheKey>,
}

impl PreviewCache {
    pub fn new(maximum_bytes: usize) -> Self {
        Self {
            maximum_bytes,
            used_bytes: 0,
            entries: HashMap::new(),
            recency: VecDeque::new(),
        }
    }

    pub fn get(&mut self, key: &PreviewCacheKey) -> Option<&RenderedFrame> {
        if self.entries.contains_key(key) {
            self.touch(key);
        }
        self.entries.get(key)
    }

    pub fn insert(&mut self, key: PreviewCacheKey, frame: RenderedFrame) {
        let bytes = frame.image.as_raw().len();
        if bytes > self.maximum_bytes {
            return;
        }
        if let Some(previous) = self.entries.remove(&key) {
            self.used_bytes -= previous.image.as_raw().len();
            self.recency.retain(|candidate| candidate != &key);
        }
        while self.used_bytes + bytes > self.maximum_bytes {
            let Some(oldest) = self.recency.pop_front() else {
                break;
            };
            if let Some(removed) = self.entries.remove(&oldest) {
                self.used_bytes -= removed.image.as_raw().len();
            }
        }
        self.used_bytes += bytes;
        self.recency.push_back(key.clone());
        self.entries.insert(key, frame);
    }

    pub fn used_bytes(&self) -> usize {
        self.used_bytes
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    fn touch(&mut self, key: &PreviewCacheKey) {
        self.recency.retain(|candidate| candidate != key);
        self.recency.push_back(key.clone());
    }
}

pub fn preview_fingerprint(motion: &MotionRevision) -> Result<String, DomainError> {
    let mut value = serde_json::to_value(motion)
        .map_err(|error| DomainError::InvalidJson(error.to_string()))?;
    if let Value::Object(object) = &mut value {
        object.remove("published_at");
    }
    let bytes = canonical_json_bytes(&value)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}
