use crate::domain::{canonical_json_bytes, Direction, DomainError, MotionRevision, ObjectId};
use crate::render::RenderedFrame;
use image::RgbaImage;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Arc, Condvar, Mutex};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PreviewCacheKey {
    content_id: ObjectId,
    content_fingerprint: String,
    renderer_version: u16,
    direction: Direction,
    frame: u16,
    options_fingerprint: String,
}

impl PreviewCacheKey {
    pub fn for_motion(
        motion: &MotionRevision,
        direction: Direction,
        frame: u16,
        options_fingerprint: impl Into<String>,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            content_id: motion.template_id,
            content_fingerprint: preview_fingerprint(motion)?,
            renderer_version: 1,
            direction,
            frame,
            options_fingerprint: options_fingerprint.into(),
        })
    }
}

/// A preview payload kept in the in-memory cache.
///
/// The cache budget accounts for the two potentially large payloads exactly:
/// decoded RGBA bytes and the encoded data-URL bytes. Small Rust container and
/// clipping metadata overhead is deliberately outside the byte budget.
#[derive(Debug, Clone)]
pub struct CachedPreviewFrame {
    pub frame: RenderedFrame,
    pub data_url: String,
}

impl CachedPreviewFrame {
    pub fn new(frame: RenderedFrame, data_url: String) -> Self {
        Self { frame, data_url }
    }

    pub fn decoded_bytes(&self) -> usize {
        self.frame.image.as_raw().len()
    }

    pub fn encoded_bytes(&self) -> usize {
        self.data_url.len()
    }

    fn payload_bytes(&self) -> Option<usize> {
        self.decoded_bytes().checked_add(self.encoded_bytes())
    }
}

impl From<RenderedFrame> for CachedPreviewFrame {
    fn from(frame: RenderedFrame) -> Self {
        Self::new(frame, String::new())
    }
}

#[derive(Debug)]
struct PreviewFlight {
    result: Mutex<Option<Result<Arc<CachedPreviewFrame>, String>>>,
    ready: Condvar,
}

#[derive(Debug)]
struct BitmapFlight {
    result: Mutex<Option<Result<Arc<RgbaImage>, String>>>,
    ready: Condvar,
}

impl BitmapFlight {
    fn new() -> Self {
        Self {
            result: Mutex::new(None),
            ready: Condvar::new(),
        }
    }

    fn finish(&self, result: Result<Arc<RgbaImage>, String>) {
        let mut state = self
            .result
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.is_none() {
            *state = Some(result);
            self.ready.notify_all();
        }
    }

    fn wait(&self) -> Result<Arc<RgbaImage>, String> {
        let mut state = self
            .result
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while state.is_none() {
            state = self
                .ready
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
        state
            .as_ref()
            .expect("bitmap flight result is ready")
            .clone()
    }
}

impl PreviewFlight {
    fn new() -> Self {
        Self {
            result: Mutex::new(None),
            ready: Condvar::new(),
        }
    }

    fn finish(&self, result: Result<Arc<CachedPreviewFrame>, String>) {
        let mut state = self
            .result
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.is_none() {
            *state = Some(result);
            self.ready.notify_all();
        }
    }

    fn wait(&self) -> Result<Arc<CachedPreviewFrame>, String> {
        let mut state = self
            .result
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while state.is_none() {
            state = self
                .ready
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
        state.as_ref().expect("flight result is ready").clone()
    }
}

#[derive(Debug)]
struct CacheEntry {
    value: Arc<CachedPreviewFrame>,
    decoded_bytes: usize,
    encoded_bytes: usize,
}

#[derive(Debug)]
struct BitmapEntry {
    value: Arc<RgbaImage>,
    decoded_bytes: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RecencyKey {
    Motion(PreviewCacheKey),
    Bitmap(String),
}

/// Bounded LRU cache shared by decoded source bitmaps and decoded/encoded
/// motion-card previews.
///
/// Call [`PreviewCache::get_or_render`] for cache misses. It coalesces identical
/// concurrent work and never holds the global cache mutex while rendering or
/// PNG-encoding the frame.
#[derive(Debug)]
pub struct PreviewCache {
    max_bytes: usize,
    decoded_bytes: usize,
    encoded_bytes: usize,
    entries: HashMap<PreviewCacheKey, CacheEntry>,
    bitmaps: HashMap<String, BitmapEntry>,
    recency: VecDeque<RecencyKey>,
    in_flight: HashMap<PreviewCacheKey, Arc<PreviewFlight>>,
    bitmap_in_flight: HashMap<String, Arc<BitmapFlight>>,
}

impl PreviewCache {
    pub fn new(max_bytes: usize) -> Self {
        Self {
            max_bytes,
            decoded_bytes: 0,
            encoded_bytes: 0,
            entries: HashMap::new(),
            bitmaps: HashMap::new(),
            recency: VecDeque::new(),
            in_flight: HashMap::new(),
            bitmap_in_flight: HashMap::new(),
        }
    }

    pub fn used_bytes(&self) -> usize {
        self.decoded_bytes + self.encoded_bytes
    }

    pub fn decoded_bytes(&self) -> usize {
        self.decoded_bytes
    }

    pub fn encoded_bytes(&self) -> usize {
        self.encoded_bytes
    }

    pub fn len(&self) -> usize {
        self.entries.len() + self.bitmaps.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty() && self.bitmaps.is_empty()
    }

    pub fn get(&mut self, key: &PreviewCacheKey) -> Option<Arc<CachedPreviewFrame>> {
        let value = self.entries.get(key)?.value.clone();
        self.touch(key);
        Some(value)
    }

    /// Inserts a payload if it fits the configured budget. An oversized
    /// replacement is ignored and leaves the existing entry untouched.
    pub fn insert(&mut self, key: PreviewCacheKey, value: impl Into<CachedPreviewFrame>) -> bool {
        self.insert_shared(key, Arc::new(value.into()))
    }

    /// Returns a cached preview or performs exactly one render for concurrent
    /// callers of the same key. Waiting happens on a per-key condition variable,
    /// outside the global cache lock.
    pub fn get_or_render<F>(
        cache: &Mutex<Self>,
        key: PreviewCacheKey,
        render: F,
    ) -> Result<Arc<CachedPreviewFrame>, String>
    where
        F: FnOnce() -> Result<CachedPreviewFrame, String>,
    {
        enum Work {
            Ready(Arc<CachedPreviewFrame>),
            Wait(Arc<PreviewFlight>),
            Render(Arc<PreviewFlight>),
        }

        let work = {
            let mut cache = cache.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(value) = cache.get(&key) {
                Work::Ready(value)
            } else if let Some(flight) = cache.in_flight.get(&key) {
                Work::Wait(flight.clone())
            } else {
                let flight = Arc::new(PreviewFlight::new());
                cache.in_flight.insert(key.clone(), flight.clone());
                Work::Render(flight)
            }
        };

        match work {
            Work::Ready(value) => Ok(value),
            Work::Wait(flight) => flight.wait(),
            Work::Render(flight) => {
                let rendered = match catch_unwind(AssertUnwindSafe(render)) {
                    Ok(result) => result.map(Arc::new),
                    Err(_) => Err("preview renderer panicked".to_owned()),
                };
                {
                    let mut cache = cache.lock().unwrap_or_else(|error| error.into_inner());
                    if cache
                        .in_flight
                        .get(&key)
                        .is_some_and(|current| Arc::ptr_eq(current, &flight))
                    {
                        if let Ok(value) = &rendered {
                            cache.insert_shared(key.clone(), value.clone());
                        }
                        // Complete while the flight is still registered so clear or
                        // invalidation has one unambiguous linearization point.
                        flight.finish(rendered);
                        cache.in_flight.remove(&key);
                    }
                }
                // Always observe the published flight result. If clear or invalidation
                // won the race while the callback was running, the owner must receive
                // that terminal error instead of returning its locally rendered value.
                flight.wait()
            }
        }
    }

    /// Returns a shared decoded source image. The caller supplies an immutable
    /// identity containing the resolved path and the revision content hash.
    /// Concurrent loads of that identity are coalesced and decoding happens
    /// outside the global cache lock.
    pub fn get_or_load_bitmap<F>(
        cache: &Mutex<Self>,
        identity: String,
        load: F,
    ) -> Result<Arc<RgbaImage>, String>
    where
        F: FnOnce() -> Result<RgbaImage, String>,
    {
        enum Work {
            Ready(Arc<RgbaImage>),
            Wait(Arc<BitmapFlight>),
            Load(Arc<BitmapFlight>),
        }

        let work = {
            let mut cache = cache.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(value) = cache.get_bitmap(&identity) {
                Work::Ready(value)
            } else if let Some(flight) = cache.bitmap_in_flight.get(&identity) {
                Work::Wait(flight.clone())
            } else {
                let flight = Arc::new(BitmapFlight::new());
                cache
                    .bitmap_in_flight
                    .insert(identity.clone(), flight.clone());
                Work::Load(flight)
            }
        };

        match work {
            Work::Ready(value) => Ok(value),
            Work::Wait(flight) => flight.wait(),
            Work::Load(flight) => {
                let loaded = match catch_unwind(AssertUnwindSafe(load)) {
                    Ok(result) => result.map(Arc::new),
                    Err(_) => Err("bitmap loader panicked".to_owned()),
                };
                {
                    let mut cache = cache.lock().unwrap_or_else(|error| error.into_inner());
                    if cache
                        .bitmap_in_flight
                        .get(&identity)
                        .is_some_and(|current| Arc::ptr_eq(current, &flight))
                    {
                        if let Ok(value) = &loaded {
                            cache.insert_bitmap_shared(identity.clone(), value.clone());
                        }
                        flight.finish(loaded);
                        cache.bitmap_in_flight.remove(&identity);
                    }
                }
                flight.wait()
            }
        }
    }

    pub fn invalidate_motion(&mut self, motion_id: ObjectId) -> usize {
        let keys = self
            .entries
            .keys()
            .filter(|key| key.content_id == motion_id)
            .cloned()
            .collect::<Vec<_>>();
        for key in &keys {
            self.remove_entry(key);
        }

        let flights = self
            .in_flight
            .iter()
            .filter(|(key, _)| key.content_id == motion_id)
            .map(|(key, flight)| (key.clone(), flight.clone()))
            .collect::<Vec<_>>();
        for (key, flight) in flights {
            self.in_flight.remove(&key);
            flight.finish(Err("preview invalidated while rendering".to_string()));
        }

        keys.len()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.bitmaps.clear();
        self.recency.clear();
        self.decoded_bytes = 0;
        self.encoded_bytes = 0;
        for (_, flight) in self.in_flight.drain() {
            flight.finish(Err("preview cache cleared while rendering".to_string()));
        }
        for (_, flight) in self.bitmap_in_flight.drain() {
            flight.finish(Err("preview cache cleared while loading bitmap".to_string()));
        }
    }

    fn insert_shared(&mut self, key: PreviewCacheKey, value: Arc<CachedPreviewFrame>) -> bool {
        let decoded_bytes = value.decoded_bytes();
        let encoded_bytes = value.encoded_bytes();
        let Some(payload_bytes) = value.payload_bytes() else {
            return false;
        };
        if payload_bytes > self.max_bytes {
            return false;
        }

        self.remove_entry(&key);
        self.evict_for(payload_bytes);

        self.decoded_bytes += decoded_bytes;
        self.encoded_bytes += encoded_bytes;
        self.recency.push_back(RecencyKey::Motion(key.clone()));
        self.entries.insert(
            key,
            CacheEntry {
                value,
                decoded_bytes,
                encoded_bytes,
            },
        );
        true
    }

    fn remove_entry(&mut self, key: &PreviewCacheKey) -> Option<CacheEntry> {
        let removed = self.entries.remove(key)?;
        self.decoded_bytes -= removed.decoded_bytes;
        self.encoded_bytes -= removed.encoded_bytes;
        self.recency
            .retain(|candidate| candidate != &RecencyKey::Motion(key.clone()));
        Some(removed)
    }

    fn touch(&mut self, key: &PreviewCacheKey) {
        let key = RecencyKey::Motion(key.clone());
        self.recency.retain(|candidate| candidate != &key);
        self.recency.push_back(key);
    }

    fn get_bitmap(&mut self, identity: &str) -> Option<Arc<RgbaImage>> {
        let value = self.bitmaps.get(identity)?.value.clone();
        let key = RecencyKey::Bitmap(identity.to_owned());
        self.recency.retain(|candidate| candidate != &key);
        self.recency.push_back(key);
        Some(value)
    }

    fn insert_bitmap_shared(&mut self, identity: String, value: Arc<RgbaImage>) -> bool {
        let decoded_bytes = value.as_raw().len();
        if decoded_bytes > self.max_bytes {
            return false;
        }
        self.remove_bitmap(&identity);
        self.evict_for(decoded_bytes);
        self.decoded_bytes += decoded_bytes;
        self.recency.push_back(RecencyKey::Bitmap(identity.clone()));
        self.bitmaps.insert(
            identity,
            BitmapEntry {
                value,
                decoded_bytes,
            },
        );
        true
    }

    fn remove_bitmap(&mut self, identity: &str) -> Option<BitmapEntry> {
        let removed = self.bitmaps.remove(identity)?;
        self.decoded_bytes -= removed.decoded_bytes;
        let key = RecencyKey::Bitmap(identity.to_owned());
        self.recency.retain(|candidate| candidate != &key);
        Some(removed)
    }

    fn evict_for(&mut self, bytes: usize) {
        while bytes > self.max_bytes.saturating_sub(self.used_bytes()) {
            let Some(oldest) = self.recency.front().cloned() else {
                break;
            };
            match oldest {
                RecencyKey::Motion(key) => {
                    self.remove_entry(&key);
                }
                RecencyKey::Bitmap(identity) => {
                    self.remove_bitmap(&identity);
                }
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::RenderedFrame;
    use image::{Rgba, RgbaImage};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::mpsc;
    use std::thread;
    use std::time::{Duration, Instant};

    fn key(seed: u128, frame: u16) -> PreviewCacheKey {
        PreviewCacheKey {
            content_id: ObjectId::parse(
                "test_id",
                &uuid::Uuid::from_u128(seed).hyphenated().to_string(),
            )
            .unwrap(),
            content_fingerprint: format!("content-{seed}"),
            renderer_version: 1,
            direction: Direction::S,
            frame,
            options_fingerprint: "default".to_string(),
        }
    }

    fn payload(width: u32, height: u32, encoded: &str) -> CachedPreviewFrame {
        CachedPreviewFrame::new(
            RenderedFrame {
                image: RgbaImage::from_pixel(width, height, Rgba([1, 2, 3, 4])),
                clipping: Vec::new(),
            },
            encoded.to_string(),
        )
    }

    fn wait_for_preview_waiter(cache: &Mutex<PreviewCache>, cache_key: &PreviewCacheKey) {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            let references = cache
                .lock()
                .unwrap()
                .in_flight
                .get(cache_key)
                .map(Arc::strong_count)
                .unwrap_or_default();
            // The map, rendering owner, and waiting caller each retain one reference.
            if references >= 3 {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "waiting caller did not join the preview flight"
            );
            thread::yield_now();
        }
    }

    fn wait_for_bitmap_waiter(cache: &Mutex<PreviewCache>, identity: &str) {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            let references = cache
                .lock()
                .unwrap()
                .bitmap_in_flight
                .get(identity)
                .map(Arc::strong_count)
                .unwrap_or_default();
            if references >= 3 {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "waiting caller did not join the bitmap flight"
            );
            thread::yield_now();
        }
    }

    #[test]
    fn accounts_decoded_and_encoded_payload_bytes_exactly() {
        let mut cache = PreviewCache::new(64);
        assert!(cache.insert(key(1, 0), payload(2, 2, "12345")));

        assert_eq!(cache.decoded_bytes(), 16);
        assert_eq!(cache.encoded_bytes(), 5);
        assert_eq!(cache.used_bytes(), 21);
    }

    #[test]
    fn replacing_a_key_updates_each_counter_instead_of_double_counting() {
        let mut cache = PreviewCache::new(128);
        let cache_key = key(1, 0);
        assert!(cache.insert(cache_key.clone(), payload(2, 2, "old")));
        assert!(cache.insert(cache_key.clone(), payload(3, 2, "new-value")));

        assert_eq!(cache.len(), 1);
        assert_eq!(cache.decoded_bytes(), 24);
        assert_eq!(cache.encoded_bytes(), 9);
        assert_eq!(cache.get(&cache_key).unwrap().data_url, "new-value");
    }

    #[test]
    fn oversized_insert_does_not_evict_or_replace_existing_entries() {
        let mut cache = PreviewCache::new(24);
        let existing = key(1, 0);
        assert!(cache.insert(existing.clone(), payload(2, 2, "1234")));

        assert!(!cache.insert(existing.clone(), payload(3, 2, "x")));
        assert!(!cache.insert(key(2, 0), payload(3, 2, "x")));

        assert_eq!(cache.len(), 1);
        assert_eq!(cache.used_bytes(), 20);
        assert_eq!(cache.get(&existing).unwrap().data_url, "1234");
    }

    #[test]
    fn evicts_the_least_recently_used_payload() {
        let mut cache = PreviewCache::new(40);
        let first = key(1, 0);
        let second = key(2, 0);
        let third = key(3, 0);
        assert!(cache.insert(first.clone(), payload(2, 2, "1234")));
        assert!(cache.insert(second.clone(), payload(2, 2, "1234")));
        assert!(cache.get(&first).is_some());

        assert!(cache.insert(third.clone(), payload(2, 2, "1234")));

        assert!(cache.get(&first).is_some());
        assert!(cache.get(&second).is_none());
        assert!(cache.get(&third).is_some());
        assert_eq!(cache.used_bytes(), 40);
    }

    #[test]
    fn invalidates_only_the_requested_motion() {
        let mut cache = PreviewCache::new(128);
        let first_a = key(1, 0);
        let first_b = key(1, 1);
        let second = key(2, 0);
        cache.insert(first_a.clone(), payload(1, 1, "a"));
        cache.insert(first_b.clone(), payload(1, 1, "b"));
        cache.insert(second.clone(), payload(1, 1, "c"));

        assert_eq!(cache.invalidate_motion(first_a.content_id), 2);
        assert!(cache.get(&first_a).is_none());
        assert!(cache.get(&first_b).is_none());
        assert!(cache.get(&second).is_some());
        assert_eq!(cache.used_bytes(), 5);
    }

    #[test]
    fn clear_resets_entries_and_byte_counters() {
        let mut cache = PreviewCache::new(128);
        cache.insert(key(1, 0), payload(2, 2, "encoded"));

        cache.clear();

        assert!(cache.is_empty());
        assert_eq!(cache.decoded_bytes(), 0);
        assert_eq!(cache.encoded_bytes(), 0);
        assert_eq!(cache.used_bytes(), 0);
    }

    #[test]
    fn shared_source_bitmaps_are_loaded_once_and_counted_as_decoded_bytes() {
        let cache = Mutex::new(PreviewCache::new(128));
        let loads = AtomicUsize::new(0);
        let first =
            PreviewCache::get_or_load_bitmap(&cache, "vault/asset.png:sha256".to_string(), || {
                loads.fetch_add(1, Ordering::SeqCst);
                Ok(RgbaImage::from_pixel(2, 3, Rgba([1, 2, 3, 4])))
            })
            .unwrap();
        let second =
            PreviewCache::get_or_load_bitmap(&cache, "vault/asset.png:sha256".to_string(), || {
                loads.fetch_add(1, Ordering::SeqCst);
                Ok(RgbaImage::new(9, 9))
            })
            .unwrap();

        assert_eq!(loads.load(Ordering::SeqCst), 1);
        assert!(Arc::ptr_eq(&first, &second));
        let cache = cache.lock().unwrap();
        assert_eq!(cache.decoded_bytes(), 24);
        assert_eq!(cache.encoded_bytes(), 0);
        assert_eq!(cache.used_bytes(), 24);
    }

    #[test]
    fn render_callback_runs_without_the_global_cache_mutex() {
        let cache = Mutex::new(PreviewCache::new(128));
        PreviewCache::get_or_render(&cache, key(1, 0), || {
            let unlocked = cache.try_lock().expect("render must not hold cache lock");
            drop(unlocked);
            Ok(payload(1, 1, "encoded"))
        })
        .unwrap();
    }

    #[test]
    fn concurrent_identical_misses_are_coalesced() {
        let cache = Arc::new(Mutex::new(PreviewCache::new(1024)));
        let renders = Arc::new(AtomicUsize::new(0));
        let start = Arc::new(std::sync::Barrier::new(8));
        let mut workers = Vec::new();

        for _ in 0..8 {
            let cache = cache.clone();
            let renders = renders.clone();
            let start = start.clone();
            workers.push(thread::spawn(move || {
                start.wait();
                PreviewCache::get_or_render(&cache, key(1, 0), || {
                    renders.fetch_add(1, Ordering::SeqCst);
                    thread::sleep(Duration::from_millis(30));
                    Ok(payload(2, 2, "encoded"))
                })
                .unwrap()
            }));
        }

        let previews = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(renders.load(Ordering::SeqCst), 1);
        assert!(previews
            .iter()
            .all(|preview| Arc::ptr_eq(preview, &previews[0])));
    }

    #[test]
    fn panicking_preview_owner_releases_waiters_and_allows_retry() {
        let cache = Arc::new(Mutex::new(PreviewCache::new(1024)));
        let cache_key = key(1, 0);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();

        let owner_cache = cache.clone();
        let owner_key = cache_key.clone();
        let owner = thread::spawn(move || {
            PreviewCache::get_or_render(&owner_cache, owner_key, || {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                panic!("fixture renderer panic");
            })
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        let waiter_cache = cache.clone();
        let waiter_key = cache_key.clone();
        let waiter = thread::spawn(move || {
            PreviewCache::get_or_render(&waiter_cache, waiter_key, || {
                Ok(payload(1, 1, "unexpected second render"))
            })
        });
        wait_for_preview_waiter(&cache, &cache_key);
        release_tx.send(()).unwrap();

        assert_eq!(
            owner.join().unwrap().unwrap_err(),
            "preview renderer panicked"
        );
        assert_eq!(
            waiter.join().unwrap().unwrap_err(),
            "preview renderer panicked"
        );
        assert!(cache.lock().unwrap().in_flight.is_empty());

        let retried =
            PreviewCache::get_or_render(&cache, cache_key, || Ok(payload(1, 1, "retry"))).unwrap();
        assert_eq!(retried.data_url, "retry");
    }

    #[test]
    fn panicking_bitmap_owner_releases_waiters_and_allows_retry() {
        let cache = Arc::new(Mutex::new(PreviewCache::new(1024)));
        let identity = "panic-bitmap".to_owned();
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();

        let owner_cache = cache.clone();
        let owner_identity = identity.clone();
        let owner = thread::spawn(move || {
            PreviewCache::get_or_load_bitmap(&owner_cache, owner_identity, || {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                panic!("fixture bitmap panic");
            })
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        let waiter_cache = cache.clone();
        let waiter_identity = identity.clone();
        let waiter = thread::spawn(move || {
            PreviewCache::get_or_load_bitmap(&waiter_cache, waiter_identity, || {
                Ok(RgbaImage::new(9, 9))
            })
        });
        wait_for_bitmap_waiter(&cache, &identity);
        release_tx.send(()).unwrap();

        assert_eq!(owner.join().unwrap().unwrap_err(), "bitmap loader panicked");
        assert_eq!(
            waiter.join().unwrap().unwrap_err(),
            "bitmap loader panicked"
        );
        assert!(cache.lock().unwrap().bitmap_in_flight.is_empty());

        let retried =
            PreviewCache::get_or_load_bitmap(&cache, identity, || Ok(RgbaImage::new(2, 2)))
                .unwrap();
        assert_eq!(retried.dimensions(), (2, 2));
    }

    #[test]
    fn invalidation_aborts_the_rendering_owner_instead_of_returning_stale_success() {
        let cache = Arc::new(Mutex::new(PreviewCache::new(1024)));
        let cache_key = key(1, 0);
        let motion_id = cache_key.content_id;
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();

        let owner_cache = cache.clone();
        let owner_key = cache_key.clone();
        let owner = thread::spawn(move || {
            PreviewCache::get_or_render(&owner_cache, owner_key, || {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                Ok(payload(1, 1, "stale"))
            })
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        cache.lock().unwrap().invalidate_motion(motion_id);
        release_tx.send(()).unwrap();

        assert_eq!(
            owner.join().unwrap().unwrap_err(),
            "preview invalidated while rendering"
        );
        let cache = cache.lock().unwrap();
        assert!(cache.is_empty());
        assert!(cache.in_flight.is_empty());
    }

    #[test]
    fn clear_aborts_render_and_bitmap_owners_instead_of_returning_stale_success() {
        let cache = Arc::new(Mutex::new(PreviewCache::new(1024)));
        let (preview_entered_tx, preview_entered_rx) = mpsc::channel();
        let (preview_release_tx, preview_release_rx) = mpsc::channel();
        let (bitmap_entered_tx, bitmap_entered_rx) = mpsc::channel();
        let (bitmap_release_tx, bitmap_release_rx) = mpsc::channel();

        let preview_cache = cache.clone();
        let preview_owner = thread::spawn(move || {
            PreviewCache::get_or_render(&preview_cache, key(1, 0), || {
                preview_entered_tx.send(()).unwrap();
                preview_release_rx.recv().unwrap();
                Ok(payload(1, 1, "stale"))
            })
        });
        let bitmap_cache = cache.clone();
        let bitmap_owner = thread::spawn(move || {
            PreviewCache::get_or_load_bitmap(&bitmap_cache, "clear-bitmap".to_owned(), || {
                bitmap_entered_tx.send(()).unwrap();
                bitmap_release_rx.recv().unwrap();
                Ok(RgbaImage::new(2, 2))
            })
        });
        preview_entered_rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap();
        bitmap_entered_rx
            .recv_timeout(Duration::from_secs(2))
            .unwrap();

        cache.lock().unwrap().clear();
        preview_release_tx.send(()).unwrap();
        bitmap_release_tx.send(()).unwrap();

        assert_eq!(
            preview_owner.join().unwrap().unwrap_err(),
            "preview cache cleared while rendering"
        );
        assert_eq!(
            bitmap_owner.join().unwrap().unwrap_err(),
            "preview cache cleared while loading bitmap"
        );
        let cache = cache.lock().unwrap();
        assert!(cache.is_empty());
        assert!(cache.in_flight.is_empty());
        assert!(cache.bitmap_in_flight.is_empty());
    }
}
