use std::collections::BTreeMap;

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;

use super::{
    AnimationBinding, Appearance, Area, Asset, AssetRevision, Character, DocumentKind, DomainError,
    ExportManifest, Label, MotionRevision, MotionTemplate, OutfitDraft, ProfileRevision, Project,
    Vault, SCHEMA_VERSION,
};

#[derive(Debug, Clone, PartialEq)]
pub enum DomainDocument {
    Vault(Vault),
    Label(Label),
    Project(Project),
    Area(Area),
    ProfileRevision(ProfileRevision),
    MotionTemplate(MotionTemplate),
    MotionRevision(MotionRevision),
    Asset(Asset),
    AssetRevision(AssetRevision),
    OutfitDraft(OutfitDraft),
    Character(Character),
    Appearance(Appearance),
    AnimationBinding(AnimationBinding),
    ExportManifest(Box<ExportManifest>),
}

#[derive(Debug, Deserialize)]
struct Discriminator {
    schema_version: u64,
    kind: DocumentKind,
}

pub fn parse_document(source: &[u8]) -> Result<DomainDocument, DomainError> {
    let value: Value = serde_json::from_slice(source)
        .map_err(|error| DomainError::InvalidJson(error.to_string()))?;
    let discriminator: Discriminator = serde_json::from_value(value.clone())
        .map_err(|error| DomainError::InvalidJson(format!("document header: {error}")))?;
    if discriminator.schema_version != u64::from(SCHEMA_VERSION) {
        return Err(DomainError::UnsupportedSchemaVersion {
            found: discriminator.schema_version,
            supported: SCHEMA_VERSION,
        });
    }
    dispatch_document(discriminator.kind, value)
}

pub fn serialize_document(document: &DomainDocument) -> Result<Vec<u8>, DomainError> {
    match document {
        DomainDocument::Vault(value) => serialize(value),
        DomainDocument::Label(value) => serialize(value),
        DomainDocument::Project(value) => serialize(value),
        DomainDocument::Area(value) => serialize(value),
        DomainDocument::ProfileRevision(value) => serialize(value),
        DomainDocument::MotionTemplate(value) => serialize(value),
        DomainDocument::MotionRevision(value) => serialize(value),
        DomainDocument::Asset(value) => serialize(value),
        DomainDocument::AssetRevision(value) => serialize(value),
        DomainDocument::OutfitDraft(value) => serialize(value),
        DomainDocument::Character(value) => serialize(value),
        DomainDocument::Appearance(value) => serialize(value),
        DomainDocument::AnimationBinding(value) => serialize(value),
        DomainDocument::ExportManifest(value) => serialize(value),
    }
}

pub fn canonical_json_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>, DomainError> {
    let value =
        serde_json::to_value(value).map_err(|error| DomainError::InvalidJson(error.to_string()))?;
    serde_json::to_vec(&canonicalize(value))
        .map_err(|error| DomainError::InvalidJson(error.to_string()))
}

fn dispatch_document(kind: DocumentKind, value: Value) -> Result<DomainDocument, DomainError> {
    match kind {
        DocumentKind::Vault => parse(value, Vault::validate).map(DomainDocument::Vault),
        DocumentKind::Label => parse(value, Label::validate).map(DomainDocument::Label),
        DocumentKind::Project => parse(value, Project::validate).map(DomainDocument::Project),
        DocumentKind::Area => parse(value, Area::validate).map(DomainDocument::Area),
        DocumentKind::ProfileRevision => {
            parse(value, ProfileRevision::validate).map(DomainDocument::ProfileRevision)
        }
        DocumentKind::MotionTemplate => {
            parse(value, MotionTemplate::validate).map(DomainDocument::MotionTemplate)
        }
        DocumentKind::MotionRevision => {
            parse(value, |motion: &MotionRevision| motion.validate(None))
                .map(DomainDocument::MotionRevision)
        }
        DocumentKind::Asset => parse(value, Asset::validate).map(DomainDocument::Asset),
        DocumentKind::AssetRevision => {
            parse(value, AssetRevision::validate).map(DomainDocument::AssetRevision)
        }
        DocumentKind::OutfitDraft => {
            parse(value, OutfitDraft::validate).map(DomainDocument::OutfitDraft)
        }
        DocumentKind::Character => parse(value, Character::validate).map(DomainDocument::Character),
        DocumentKind::Appearance => {
            parse(value, Appearance::validate).map(DomainDocument::Appearance)
        }
        DocumentKind::AnimationBinding => {
            parse(value, AnimationBinding::validate).map(DomainDocument::AnimationBinding)
        }
        DocumentKind::ExportManifest => parse(value, ExportManifest::validate)
            .map(Box::new)
            .map(DomainDocument::ExportManifest),
    }
}

fn parse<T, F>(value: Value, validate: F) -> Result<T, DomainError>
where
    T: DeserializeOwned,
    F: FnOnce(&T) -> Result<(), DomainError>,
{
    let document = serde_json::from_value(value)
        .map_err(|error| DomainError::InvalidJson(error.to_string()))?;
    validate(&document)?;
    Ok(document)
}

fn serialize<T: Serialize>(value: &T) -> Result<Vec<u8>, DomainError> {
    serde_json::to_vec_pretty(value).map_err(|error| DomainError::InvalidJson(error.to_string()))
}

fn canonicalize(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| (key, canonicalize(value)))
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .collect(),
        ),
        Value::Array(values) => Value::Array(values.into_iter().map(canonicalize).collect()),
        other => other,
    }
}
