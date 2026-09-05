use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use super::{
    validate_schema, ActionKey, Direction, DocumentKind, DomainError, ObjectId, PixelPoint,
    PixelSize, RelativePath, RevisionRef, Sha256Digest, UtcTimestamp,
};

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
    pub size_px: PixelSize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PixelRect(pub u16, pub u16, pub u16, pub u16);

impl PixelRect {
    fn validate(&self, path: &str, page_size: PixelSize) -> Result<(), DomainError> {
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportFrame {
    pub action_key: ActionKey,
    pub direction: Direction,
    pub sample_index: u16,
    pub page_id: String,
    pub rect_px: PixelRect,
    pub mirrored_from: Option<Direction>,
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
    pub directions: Vec<Direction>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
    pub character_id: ObjectId,
    pub source_fingerprint: Sha256Digest,
    pub sources: ExportSources,
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
        if self.generator_version.is_empty() || self.generator_version.len() > 64 {
            return Err(DomainError::invalid(
                "export_manifest.generator_version",
                "must contain 1..=64 characters",
            ));
        }
        Sha256Digest::parse(self.source_fingerprint.as_str())?;
        self.validate_sources()?;
        let actions = self.validate_actions()?;
        let pages = self.validate_pages()?;
        self.validate_frames(&actions, &pages)
    }

    fn validate_sources(&self) -> Result<(), DomainError> {
        self.sources
            .profile
            .validate("export_manifest.sources.profile")?;
        for (group, values) in [
            ("motion", &self.sources.motion),
            ("assets", &self.sources.assets),
            ("appearances", &self.sources.appearances),
            ("bindings", &self.sources.bindings),
        ] {
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
            super::ensure_exact_directions(
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

    fn validate_pages(&self) -> Result<HashMap<&str, PixelSize>, DomainError> {
        if self.pages.is_empty() {
            return Err(DomainError::invalid(
                "export_manifest.pages",
                "must contain at least one atlas page",
            ));
        }
        let mut pages = HashMap::new();
        for (index, page) in self.pages.iter().enumerate() {
            validate_resource_name(&format!("export_manifest.pages[{index}].id"), &page.id)?;
            RelativePath::parse(page.file.as_str())?;
            page.size_px
                .validate(&format!("export_manifest.pages[{index}].size_px"))?;
            if pages.insert(page.id.as_str(), page.size_px).is_some() {
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
        pages: &HashMap<&str, PixelSize>,
    ) -> Result<(), DomainError> {
        let mut frames = HashSet::new();
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
        }
        Ok(())
    }
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
