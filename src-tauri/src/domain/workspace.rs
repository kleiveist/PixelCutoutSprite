use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use super::{
    validate_name, validate_schema, Direction, DomainError, ObjectId, PixelPoint, PixelSize,
    RevisionRef, UtcTimestamp, VAULT_FORMAT,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    Vault,
    Label,
    Project,
    Area,
    ProfileRevision,
    MotionTemplate,
    MotionRevision,
    Asset,
    AssetRevision,
    OutfitDraft,
    Character,
    Appearance,
    AnimationBinding,
    ExportManifest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordStatus {
    Active,
    Archived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabelScope {
    Workspace,
    Project,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Vault {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub format: String,
    pub created_at: UtcTimestamp,
}

impl Vault {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        if self.kind != DocumentKind::Vault {
            return Err(DomainError::invalid("vault.kind", "must be `vault`"));
        }
        if self.format != VAULT_FORMAT {
            return Err(DomainError::invalid(
                "vault.format",
                format!("must be `{VAULT_FORMAT}`"),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Label {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub scope: LabelScope,
    pub project_id: Option<ObjectId>,
    pub name: String,
    pub color: String,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Label {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(self.kind, DocumentKind::Label, self.revision, "label")?;
        validate_name("label.name", &self.name)?;
        if !is_hex_color(&self.color) {
            return Err(DomainError::invalid(
                "label.color",
                "must be a six-digit hexadecimal RGB color",
            ));
        }
        match (self.scope, self.project_id) {
            (LabelScope::Workspace, None) | (LabelScope::Project, Some(_)) => Ok(()),
            _ => Err(DomainError::invalid(
                "label.project_id",
                "workspace labels must omit project_id and project labels must include it",
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Project {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub name: String,
    pub status: RecordStatus,
    pub workspace_label_ids: Vec<ObjectId>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Project {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(self.kind, DocumentKind::Project, self.revision, "project")?;
        validate_name("project.name", &self.name)?;
        ensure_unique_ids("project.workspace_label_ids", &self.workspace_label_ids)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectType {
    Humanoid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirectionModel {
    EightWay,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Area {
    pub schema_version: u32,
    pub kind: DocumentKind,
    pub id: ObjectId,
    pub revision: u32,
    pub project_id: ObjectId,
    pub name: String,
    pub object_type: ObjectType,
    pub profile_ref: RevisionRef,
    pub reference_height_px: u16,
    pub direction_model: DirectionModel,
    pub directions: Vec<Direction>,
    pub default_frame_size_px: PixelSize,
    pub default_ground_origin_px: PixelPoint,
    pub label_ids: Vec<ObjectId>,
    pub created_at: UtcTimestamp,
    pub updated_at: UtcTimestamp,
}

impl Area {
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_schema(self.schema_version)?;
        validate_kind_revision(self.kind, DocumentKind::Area, self.revision, "area")?;
        validate_name("area.name", &self.name)?;
        self.profile_ref.validate("area.profile_ref")?;
        if !(16..=512).contains(&self.reference_height_px) {
            return Err(DomainError::invalid(
                "area.reference_height_px",
                "must be within 16..=512",
            ));
        }
        self.default_frame_size_px
            .validate("area.default_frame_size_px")?;
        self.default_ground_origin_px
            .validate("area.default_ground_origin_px")?;
        ensure_exact_directions("area.directions", &self.directions)?;
        ensure_unique_ids("area.label_ids", &self.label_ids)
    }
}

pub(crate) fn validate_kind_revision(
    actual: DocumentKind,
    expected: DocumentKind,
    revision: u32,
    path: &str,
) -> Result<(), DomainError> {
    if actual != expected {
        return Err(DomainError::invalid(
            format!("{path}.kind"),
            format!(
                "must be `{}`",
                serde_json::to_value(expected).unwrap_or_default()
            ),
        ));
    }
    if revision == 0 {
        return Err(DomainError::invalid(
            format!("{path}.revision"),
            "must be positive",
        ));
    }
    Ok(())
}

pub(crate) fn ensure_unique_ids(path: &str, ids: &[ObjectId]) -> Result<(), DomainError> {
    let mut seen = HashSet::new();
    for id in ids {
        if !seen.insert(*id) {
            return Err(DomainError::DuplicateId(format!("{path}:{id}")));
        }
    }
    Ok(())
}

pub(crate) fn ensure_exact_directions(
    path: &str,
    directions: &[Direction],
) -> Result<(), DomainError> {
    let found = directions.iter().copied().collect::<HashSet<_>>();
    let required = Direction::ALL.into_iter().collect::<HashSet<_>>();
    if directions.len() != Direction::ALL.len() || found != required {
        return Err(DomainError::invalid(
            path,
            "must contain each of n, ne, e, se, s, sw, w, and nw exactly once",
        ));
    }
    Ok(())
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}
