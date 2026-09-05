use std::collections::HashSet;

use serde::Serialize;
use unicode_normalization::UnicodeNormalization;

use super::{
    canonical_json_bytes, AssetRevision, DomainError, ExportManifest, MotionRevision,
    ProfileRevision, Sha256Digest,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFreshness {
    Current,
    Stale,
}

pub fn export_freshness(
    manifest: &ExportManifest,
    effective_source_fingerprint: &Sha256Digest,
) -> ExportFreshness {
    if &manifest.source_fingerprint == effective_source_fingerprint {
        ExportFreshness::Current
    } else {
        ExportFreshness::Stale
    }
}

pub fn ensure_motion_revision_unchanged(
    current: &MotionRevision,
    candidate: &MotionRevision,
) -> Result<(), DomainError> {
    ensure_release_unchanged(
        "motion_revision",
        current.reference() == candidate.reference(),
        current,
        candidate,
    )
}

pub fn ensure_profile_revision_unchanged(
    current: &ProfileRevision,
    candidate: &ProfileRevision,
) -> Result<(), DomainError> {
    ensure_release_unchanged(
        "profile_revision",
        current.reference() == candidate.reference(),
        current,
        candidate,
    )
}

pub fn ensure_asset_revision_unchanged(
    current: &AssetRevision,
    candidate: &AssetRevision,
) -> Result<(), DomainError> {
    ensure_release_unchanged(
        "asset_revision",
        current.reference() == candidate.reference(),
        current,
        candidate,
    )
}

pub fn validate_portable_display_name(path: &str, name: &str) -> Result<(), DomainError> {
    super::validate_name(path, name)?;
    let forbidden_character = name.chars().any(|character| {
        matches!(
            character,
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
        )
    });
    let key = portable_name_key(name);
    let reserved = matches!(
        key.as_str(),
        "." | ".."
            | ".pixelforge-studio"
            | "con"
            | "prn"
            | "aux"
            | "nul"
            | "com1"
            | "com2"
            | "com3"
            | "com4"
            | "com5"
            | "com6"
            | "com7"
            | "com8"
            | "com9"
            | "lpt1"
            | "lpt2"
            | "lpt3"
            | "lpt4"
            | "lpt5"
            | "lpt6"
            | "lpt7"
            | "lpt8"
            | "lpt9"
    );
    if forbidden_character || reserved || name.ends_with(['.', ' ']) {
        return Err(DomainError::invalid(
            path,
            "is not a portable display name for a filesystem-backed object",
        ));
    }
    Ok(())
}

pub fn ensure_no_portable_name_collisions<'a>(
    path: &str,
    names: impl IntoIterator<Item = &'a str>,
) -> Result<(), DomainError> {
    let mut keys = HashSet::new();
    for name in names {
        validate_portable_display_name(path, name)?;
        if !keys.insert(portable_name_key(name)) {
            return Err(DomainError::invalid(
                path,
                "contains names that collide after Unicode normalization and case folding",
            ));
        }
    }
    Ok(())
}

pub fn portable_name_key(value: &str) -> String {
    value.nfc().flat_map(char::to_lowercase).collect()
}

fn ensure_release_unchanged<T: Serialize>(
    kind: &'static str,
    same_identity: bool,
    current: &T,
    candidate: &T,
) -> Result<(), DomainError> {
    if !same_identity {
        return Err(DomainError::invalid(
            kind,
            "immutable revisions must be compared using the same identity",
        ));
    }
    if canonical_json_bytes(current)? != canonical_json_bytes(candidate)? {
        return Err(DomainError::invalid(
            kind,
            "published revisions are immutable; create a new revision instead",
        ));
    }
    Ok(())
}
