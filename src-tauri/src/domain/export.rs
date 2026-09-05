use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::{
    validate_schema, ActionKey, Direction, DocumentKind, DomainError, ObjectId, PixelPoint,
    PixelSize, RelativePath, RevisionRef, Sha256Digest, SlotId, UtcTimestamp,
};

/// Atlas pages use a wider product limit than editable frame canvases.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AtlasSize(pub u16, pub u16);

impl AtlasSize {
    pub const MAX_SIDE: u16 = 4096;

    pub fn validate(&self, path: &str) -> Result<(), DomainError> {
        if self.0 == 0 || self.1 == 0 || self.0 > Self::MAX_SIDE || self.1 > Self::MAX_SIDE {
            return Err(DomainError::invalid(
                path,
                "each atlas axis must be within 1..=4096 pixels",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectiveSourceKind {
    Profile,
    Motion,
    Asset,
    Appearance,
    Binding,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EffectiveSource {
    pub kind: EffectiveSourceKind,
    pub reference: RevisionRef,
    pub content_sha256: Sha256Digest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportSources {
    pub profile: RevisionRef,
    pub motion: Vec<RevisionRef>,
    pub assets: Vec<RevisionRef>,
    pub appearances: Vec<RevisionRef>,
    pub bindings: Vec<RevisionRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AtlasPage {
    pub id: String,
    pub file: RelativePath,
    pub size_px: AtlasSize,
    pub rgba_sha256: Sha256Digest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PixelRect(pub u16, pub u16, pub u16, pub u16);

impl PixelRect {
    fn validate(&self, path: &str, page_size: AtlasSize) -> Result<(), DomainError> {
        let right = u32::from(self.0) + u32::from(self.2);
        let bottom = u32::from(self.1) + u32::from(self.3);
        if self.2 == 0
            || self.3 == 0
            || right > u32::from(page_size.0)
            || bottom > u32::from(page_size.1)
        {
            return Err(DomainError::invalid(
                path,
                "rectangle must be positive and fully inside its atlas page",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportRootMotionMode {
    Baked,
    External,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportJumpMode {
    Baked,
    External,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClippingPolicy {
    Block,
    Warn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportProfileSnapshot {
    pub name: String,
    pub directions: Vec<Direction>,
    pub max_page_size_px: AtlasSize,
    pub max_pages: u16,
    pub memory_budget_bytes: u64,
    pub padding_px: u16,
    pub extrude_edges: bool,
    pub individual_frames: bool,
    pub include_shadow: bool,
    pub normalize_geometry: bool,
    pub clipping_policy: ClippingPolicy,
    pub allow_incomplete_test: bool,
}

impl ExportProfileSnapshot {
    pub fn validate(&self) -> Result<(), DomainError> {
        super::validate_name("export_manifest.profile.name", &self.name)?;
        validate_direction_subset("export_manifest.profile.directions", &self.directions)?;
        self.max_page_size_px
            .validate("export_manifest.profile.max_page_size_px")?;
        if self.max_pages == 0 || self.max_pages > 1024 {
            return Err(DomainError::invalid(
                "export_manifest.profile.max_pages",
                "must be within 1..=1024",
            ));
        }
        if self.memory_budget_bytes == 0 || self.memory_budget_bytes > 4 * 1024 * 1024 * 1024 {
            return Err(DomainError::invalid(
                "export_manifest.profile.memory_budget_bytes",
                "must be within 1 byte..=4 GiB",
            ));
        }
        if self.padding_px > 64 {
            return Err(DomainError::invalid(
                "export_manifest.profile.padding_px",
                "must be within 0..=64",
            ));
        }
        if self.extrude_edges && self.padding_px == 0 {
            return Err(DomainError::invalid(
                "export_manifest.profile.extrude_edges",
                "edge extrusion requires positive padding",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportClipping {
    pub slot_id: SlotId,
    pub bounds_px: [i32; 4],
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportFrame {
    pub action_key: ActionKey,
    pub direction: Direction,
    pub sample_index: u16,
    pub page_id: String,
    pub rect_px: PixelRect,
    pub ground_origin_px: PixelPoint,
    pub duration_ticks: u16,
    pub mirrored_from: Option<Direction>,
    pub individual_file: Option<RelativePath>,
    pub rgba_sha256: Sha256Digest,
    pub clipping: Vec<ExportClipping>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportAction {
    pub action_key: ActionKey,
    pub binding_ref: RevisionRef,
    pub frame_size_px: PixelSize,
    pub ground_origin_px: PixelPoint,
    pub frame_count: u16,
    pub fps: u16,
    pub loop_mode: super::LoopMode,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
    pub directions: Vec<Direction>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckLevel {
    Passed,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportCheck {
    pub code: String,
    pub level: CheckLevel,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportManifest {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub format_version: u32,
    pub generator_version: String,
    pub rasterizer_version: String,
    pub character_id: ObjectId,
    pub source_fingerprint: Sha256Digest,
    pub complete: bool,
    pub profile: ExportProfileSnapshot,
    pub sources: ExportSources,
    pub effective_sources: Vec<EffectiveSource>,
    pub actions: Vec<ExportAction>,
    pub pages: Vec<AtlasPage>,
    pub frames: Vec<ExportFrame>,
    pub checks: Vec<ExportCheck>,
    pub created_at: UtcTimestamp,
}

impl ExportManifest {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        if self.kind != DocumentKind::ExportManifest {
            return Err(DomainError::invalid(
                "export_manifest.kind",
                "must be `export_manifest`",
            ));
        }
        if self.format_version != 1 {
            return Err(DomainError::invalid(
                "export_manifest.format_version",
                "must be 1",
            ));
        }
        for (path, value) in [
            ("generator_version", self.generator_version.as_str()),
            ("rasterizer_version", self.rasterizer_version.as_str()),
        ] {
            if value.is_empty() || value.len() > 64 {
                return Err(DomainError::invalid(
                    format!("export_manifest.{path}"),
                    "must contain 1..=64 characters",
                ));
            }
        }
        Sha256Digest::parse(self.source_fingerprint.as_str())?;
        self.profile.validate()?;
        self.validate_sources()?;
        let actions = self.validate_actions()?;
        let pages = self.validate_pages()?;
        self.validate_frames(&actions, &pages)?;
        self.validate_completeness(&actions)
    }

    fn validate_sources(&self) -> Result<(), DomainError> {
        self.sources
            .profile
            .validate("export_manifest.sources.profile")?;
        let groups = [
            (EffectiveSourceKind::Motion, "motion", &self.sources.motion),
            (EffectiveSourceKind::Asset, "assets", &self.sources.assets),
            (
                EffectiveSourceKind::Appearance,
                "appearances",
                &self.sources.appearances,
            ),
            (
                EffectiveSourceKind::Binding,
                "bindings",
                &self.sources.bindings,
            ),
        ];
        for (_, group, values) in groups {
            let mut refs = HashSet::new();
            for value in values {
                value.validate(&format!("export_manifest.sources.{group}"))?;
                if !refs.insert(*value) {
                    return Err(DomainError::DuplicateId(format!(
                        "export_manifest.sources.{group}:{}:{}",
                        value.id, value.revision
                    )));
                }
            }
        }
        let mut effective = HashSet::new();
        for source in &self.effective_sources {
            source
                .reference
                .validate("export_manifest.effective_sources.reference")?;
            Sha256Digest::parse(source.content_sha256.as_str())?;
            if !effective.insert((source.kind, source.reference)) {
                return Err(DomainError::DuplicateId(format!(
                    "export_manifest.effective_source:{:?}:{}",
                    source.kind, source.reference
                )));
            }
        }
        let profile = (EffectiveSourceKind::Profile, self.sources.profile);
        if !effective.contains(&profile) {
            return Err(DomainError::MissingReference {
                path: "export_manifest.effective_sources".to_owned(),
                target: format!("profile {}", self.sources.profile),
            });
        }
        for (kind, group, values) in groups {
            for reference in values {
                if !effective.contains(&(kind, *reference)) {
                    return Err(DomainError::MissingReference {
                        path: "export_manifest.effective_sources".to_owned(),
                        target: format!("{group} {reference}"),
                    });
                }
            }
        }
        Ok(())
    }

    fn validate_actions(&self) -> Result<HashMap<&ActionKey, &ExportAction>, DomainError> {
        if self.actions.is_empty() {
            return Err(DomainError::invalid(
                "export_manifest.actions",
                "must contain at least one action",
            ));
        }
        let mut actions = HashMap::new();
        for (index, action) in self.actions.iter().enumerate() {
            ActionKey::parse(action.action_key.as_str())?;
            action
                .binding_ref
                .validate(&format!("export_manifest.actions[{index}].binding_ref"))?;
            action
                .frame_size_px
                .validate(&format!("export_manifest.actions[{index}].frame_size_px"))?;
            action.ground_origin_px.validate(&format!(
                "export_manifest.actions[{index}].ground_origin_px"
            ))?;
            if !(1..=1024).contains(&action.frame_count) || !(1..=120).contains(&action.fps) {
                return Err(DomainError::invalid(
                    format!("export_manifest.actions[{index}]"),
                    "frame_count must be 1..=1024 and fps must be 1..=120",
                ));
            }
            validate_direction_subset(
                &format!("export_manifest.actions[{index}].directions"),
                &action.directions,
            )?;
            if actions.insert(&action.action_key, action).is_some() {
                return Err(DomainError::DuplicateId(format!(
                    "export_manifest.action:{}",
                    action.action_key
                )));
            }
        }
        Ok(actions)
    }

    fn validate_pages(&self) -> Result<HashMap<&str, AtlasSize>, DomainError> {
        if self.pages.is_empty() {
            return Err(DomainError::invalid(
                "export_manifest.pages",
                "must contain at least one atlas page",
            ));
        }
        let mut pages = HashMap::new();
        let mut files = HashSet::new();
        for (index, page) in self.pages.iter().enumerate() {
            validate_resource_name(&format!("export_manifest.pages[{index}].id"), &page.id)?;
            RelativePath::parse(page.file.as_str())?;
            page.size_px
                .validate(&format!("export_manifest.pages[{index}].size_px"))?;
            Sha256Digest::parse(page.rgba_sha256.as_str())?;
            if pages.insert(page.id.as_str(), page.size_px).is_some()
                || !files.insert(page.file.as_str())
            {
                return Err(DomainError::DuplicateId(format!(
                    "export_manifest.page:{}",
                    page.id
                )));
            }
        }
        Ok(pages)
    }

    fn validate_frames(
        &self,
        actions: &HashMap<&ActionKey, &ExportAction>,
        pages: &HashMap<&str, AtlasSize>,
    ) -> Result<(), DomainError> {
        if self.frames.is_empty() {
            return Err(DomainError::invalid(
                "export_manifest.frames",
                "must contain at least one rendered frame",
            ));
        }
        let mut frames = HashSet::new();
        let mut individual_files = HashSet::new();
        for (index, frame) in self.frames.iter().enumerate() {
            let action =
                actions
                    .get(&frame.action_key)
                    .ok_or_else(|| DomainError::MissingReference {
                        path: format!("export_manifest.frames[{index}].action_key"),
                        target: frame.action_key.to_string(),
                    })?;
            if frame.sample_index >= action.frame_count
                || !action.directions.contains(&frame.direction)
                || !frames.insert((&frame.action_key, frame.direction, frame.sample_index))
            {
                return Err(DomainError::invalid(
                    format!("export_manifest.frames[{index}]"),
                    "frame identity must be unique and inside the declared action",
                ));
            }
            let page =
                pages
                    .get(frame.page_id.as_str())
                    .ok_or_else(|| DomainError::MissingReference {
                        path: format!("export_manifest.frames[{index}].page_id"),
                        target: frame.page_id.clone(),
                    })?;
            frame
                .rect_px
                .validate(&format!("export_manifest.frames[{index}].rect_px"), *page)?;
            if frame.ground_origin_px != action.ground_origin_px || frame.duration_ticks != 1 {
                return Err(DomainError::invalid(
                    format!("export_manifest.frames[{index}]"),
                    "ground origin must match its action and duration_ticks must be 1",
                ));
            }
            if frame.rect_px.2 != action.frame_size_px.0
                || frame.rect_px.3 != action.frame_size_px.1
            {
                return Err(DomainError::invalid(
                    format!("export_manifest.frames[{index}].rect_px"),
                    "rectangle size must equal the fixed action frame size",
                ));
            }
            if frame.mirrored_from == Some(frame.direction) {
                return Err(DomainError::invalid(
                    format!("export_manifest.frames[{index}].mirrored_from"),
                    "must differ from the rendered direction",
                ));
            }
            Sha256Digest::parse(frame.rgba_sha256.as_str())?;
            match &frame.individual_file {
                Some(path) if self.profile.individual_frames => {
                    RelativePath::parse(path.as_str())?;
                    if !individual_files.insert(path.as_str()) {
                        return Err(DomainError::DuplicateId(format!(
                            "export_manifest.individual_file:{path}"
                        )));
                    }
                }
                None if !self.profile.individual_frames => {}
                _ => {
                    return Err(DomainError::invalid(
                        format!("export_manifest.frames[{index}].individual_file"),
                        "must be present exactly when individual frame export is enabled",
                    ));
                }
            }
            for clipping in &frame.clipping {
                SlotId::parse(clipping.slot_id.as_str())?;
            }
        }
        Ok(())
    }

    fn validate_completeness(
        &self,
        actions: &HashMap<&ActionKey, &ExportAction>,
    ) -> Result<(), DomainError> {
        if self.complete {
            for action in actions.values() {
                if action.directions != Direction::ALL
                    || self
                        .frames
                        .iter()
                        .filter(|frame| frame.action_key == action.action_key)
                        .count()
                        != usize::from(action.frame_count) * Direction::ALL.len()
                {
                    return Err(DomainError::invalid(
                        "export_manifest.complete",
                        "complete exports require every frame in all eight directions",
                    ));
                }
            }
        } else if !self.profile.allow_incomplete_test
            || !self.checks.iter().any(|check| {
                check.code == "incomplete_export" && check.level == CheckLevel::Warning
            })
        {
            return Err(DomainError::invalid(
                "export_manifest.complete",
                "incomplete output must be explicitly enabled and marked by a warning",
            ));
        }
        Ok(())
    }
}

fn validate_direction_subset(path: &str, directions: &[Direction]) -> Result<(), DomainError> {
    if directions.is_empty() {
        return Err(DomainError::invalid(
            path,
            "must contain at least one direction",
        ));
    }
    let mut previous = None;
    for direction in directions {
        let position = Direction::ALL
            .iter()
            .position(|candidate| candidate == direction)
            .expect("direction enum is exhaustive");
        if previous.is_some_and(|prior| position <= prior) {
            return Err(DomainError::invalid(
                path,
                "directions must be unique and use canonical n..nw order",
            ));
        }
        previous = Some(position);
    }
    Ok(())
}

fn validate_resource_name(path: &str, name: &str) -> Result<(), DomainError> {
    let valid = !name.is_empty()
        && name.len() <= 64
        && name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        && name
            .bytes()
            .next()
            .is_some_and(|byte| byte.is_ascii_lowercase());
    if valid {
        Ok(())
    } else {
        Err(DomainError::invalid(
            path,
            "must be a portable lowercase resource name",
        ))
    }
}
