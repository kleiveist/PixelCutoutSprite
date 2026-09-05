use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{portable_name_key, validate_portable_display_name, DocumentKind, ObjectId};

use super::{ResolvedPath, StorageError, VaultRoot};

pub const ADMIN_DIR: &str = ".pixelforge-studio";
pub const PROJECT_ADMIN_DIR: &str = ".project";
pub const AREA_ADMIN_DIR: &str = ".area";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataOwnership {
    VaultGlobal,
    Project,
    Area,
    Character,
    DerivedExport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManagedSupportJsonKind {
    LabelCatalog,
    ProjectView,
    MotionDraft,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManagedJsonKind {
    Domain(DocumentKind),
    Support(ManagedSupportJsonKind),
}

/// Classifies only paths owned by the studio's persisted contract. Arbitrary JSON placed beside
/// projects is user/foreign data: it is neither indexed nor rejected during schema preflight.
pub fn managed_json_kind(vault_root: &Path, path: &Path) -> Option<ManagedJsonKind> {
    if path.extension().is_none_or(|extension| extension != "json") {
        return None;
    }
    let parts = path
        .components()
        .map(|component| component.as_os_str().to_str())
        .collect::<Option<Vec<_>>>()?;
    match parts.as_slice() {
        [ADMIN_DIR, "vault.json"] => {
            return Some(ManagedJsonKind::Domain(DocumentKind::Vault));
        }
        [ADMIN_DIR, "labels.json"] => {
            return Some(ManagedJsonKind::Support(
                ManagedSupportJsonKind::LabelCatalog,
            ));
        }
        [ADMIN_DIR, "ui.json"] => {
            return Some(ManagedJsonKind::Support(
                ManagedSupportJsonKind::ProjectView,
            ));
        }
        [project, PROJECT_ADMIN_DIR, "project.json"] if is_source_segment(project) => {
            return Some(ManagedJsonKind::Domain(DocumentKind::Project));
        }
        [project, PROJECT_ADMIN_DIR, "labels.json"]
            if is_source_segment(project)
                && is_regular_anchor(
                    vault_root,
                    &Path::new(project)
                        .join(PROJECT_ADMIN_DIR)
                        .join("project.json"),
                ) =>
        {
            return Some(ManagedJsonKind::Support(
                ManagedSupportJsonKind::LabelCatalog,
            ));
        }
        _ => {}
    }

    if let [project, area, AREA_ADMIN_DIR, suffix @ ..] = parts.as_slice() {
        if !is_source_segment(project)
            || !is_source_segment(area)
            || !is_regular_anchor(
                vault_root,
                &Path::new(project)
                    .join(PROJECT_ADMIN_DIR)
                    .join("project.json"),
            )
        {
            return None;
        }
        let classified = match suffix {
            ["area.json"] => ManagedJsonKind::Domain(DocumentKind::Area),
            _ if !is_regular_anchor(
                vault_root,
                &Path::new(project)
                    .join(area)
                    .join(AREA_ADMIN_DIR)
                    .join("area.json"),
            ) =>
            {
                return None
            }
            ["profiles", _, revision] if is_numbered_json(revision) => {
                ManagedJsonKind::Domain(DocumentKind::ProfileRevision)
            }
            ["templates", _, "template.json"] => {
                ManagedJsonKind::Domain(DocumentKind::MotionTemplate)
            }
            ["templates", _, "revisions", revision] if is_numbered_json(revision) => {
                ManagedJsonKind::Domain(DocumentKind::MotionRevision)
            }
            ["templates", _, "draft.json"] => {
                ManagedJsonKind::Support(ManagedSupportJsonKind::MotionDraft)
            }
            ["assets", _, "asset.json"] => ManagedJsonKind::Domain(DocumentKind::Asset),
            ["assets", _, revision, "revision.json"] if is_numbered_directory(revision) => {
                ManagedJsonKind::Domain(DocumentKind::AssetRevision)
            }
            ["assets", _, "revisions", _, "revision.json"] => {
                ManagedJsonKind::Domain(DocumentKind::AssetRevision)
            }
            ["drafts", draft] if draft.starts_with("outfit--") => {
                ManagedJsonKind::Domain(DocumentKind::OutfitDraft)
            }
            ["export-profiles", _] => ManagedJsonKind::Support(ManagedSupportJsonKind::Other),
            _ => ManagedJsonKind::Support(ManagedSupportJsonKind::Other),
        };
        return Some(classified);
    }

    if let [project, area, character, suffix @ ..] = parts.as_slice() {
        let area_manifest = Path::new(project)
            .join(area)
            .join(AREA_ADMIN_DIR)
            .join("area.json");
        if !is_source_segment(project)
            || !is_source_segment(area)
            || !is_source_segment(character)
            || !is_regular_anchor(vault_root, &area_manifest)
        {
            return None;
        }
        match suffix {
            ["character.json"] => {
                return Some(ManagedJsonKind::Domain(DocumentKind::Character));
            }
            ["appearances", _]
                if is_regular_anchor(
                    vault_root,
                    &Path::new(project)
                        .join(area)
                        .join(character)
                        .join("character.json"),
                ) =>
            {
                return Some(ManagedJsonKind::Domain(DocumentKind::Appearance));
            }
            [_, "binding.json"]
                if is_regular_anchor(
                    vault_root,
                    &Path::new(project)
                        .join(area)
                        .join(character)
                        .join("character.json"),
                ) =>
            {
                return Some(ManagedJsonKind::Domain(DocumentKind::AnimationBinding));
            }
            _ => {}
        }
    }
    if parts.contains(&PROJECT_ADMIN_DIR) || parts.first() == Some(&ADMIN_DIR) {
        return Some(ManagedJsonKind::Support(ManagedSupportJsonKind::Other));
    }
    None
}

pub fn is_derived_managed_path(path: &Path) -> bool {
    let parts = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>();
    parts
        .first()
        .is_some_and(|part| part.starts_with(".creating-project--"))
        || parts.iter().any(|part| {
            matches!(
                *part,
                "cache" | "exports" | "_exports" | ".trash" | "trash" | "backups" | "transactions"
            )
        })
        || (parts.first() == Some(&ADMIN_DIR) && parts.get(1) == Some(&"runtime"))
}

pub fn is_managed_namespace_path(vault_root: &Path, path: &Path) -> bool {
    let parts = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>();
    if parts.first() == Some(&ADMIN_DIR) {
        return true;
    }
    match parts.as_slice() {
        [project, PROJECT_ADMIN_DIR, ..] => is_source_segment(project),
        [project, area, AREA_ADMIN_DIR, ..] => {
            is_source_segment(project)
                && is_source_segment(area)
                && is_regular_anchor(
                    vault_root,
                    &Path::new(project)
                        .join(PROJECT_ADMIN_DIR)
                        .join("project.json"),
                )
        }
        _ => false,
    }
}

fn is_source_segment(value: &str) -> bool {
    !value.is_empty() && !value.starts_with('.')
}

fn is_regular_anchor(vault_root: &Path, relative: &Path) -> bool {
    fs::symlink_metadata(vault_root.join(relative))
        .is_ok_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
}

fn is_numbered_json(file_name: &str) -> bool {
    file_name
        .strip_prefix('r')
        .and_then(|value| value.strip_suffix(".json"))
        .is_some_and(|digits| {
            !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
        })
}

fn is_numbered_directory(name: &str) -> bool {
    name.strip_prefix('r').is_some_and(|digits| {
        !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
    })
}

#[derive(Debug, Clone)]
pub struct VaultLayout {
    root: VaultRoot,
}

impl VaultLayout {
    pub fn new(root: VaultRoot) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &VaultRoot {
        &self.root
    }

    pub fn admin_dir(&self) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(Path::new(ADMIN_DIR))
    }

    pub fn vault_manifest(&self) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(Path::new(ADMIN_DIR).join("vault.json").as_path())
    }

    pub fn global_labels(&self) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(Path::new(ADMIN_DIR).join("labels.json").as_path())
    }

    pub fn global_ui(&self) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(Path::new(ADMIN_DIR).join("ui.json").as_path())
    }

    pub fn runtime_dir(&self) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(Path::new(ADMIN_DIR).join("runtime").as_path())
    }

    pub fn writer_lock(&self) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(
            Path::new(ADMIN_DIR)
                .join("runtime/writer.lock.json")
                .as_path(),
        )
    }

    pub fn project_dir(&self, name: &str, id: ObjectId) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(&object_folder(name, id)?)
    }

    pub fn project_manifest(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("project.json"))
    }

    pub fn project_admin(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(&project_folder.join(PROJECT_ADMIN_DIR))
    }

    pub fn project_labels(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("labels.json"))
    }

    pub fn project_cache(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("cache"))
    }

    pub fn project_transactions(
        &self,
        project_folder: &Path,
    ) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("transactions"))
    }

    pub fn project_backups(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("backups"))
    }

    pub fn project_trash(&self, project_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&project_folder.join(PROJECT_ADMIN_DIR).join("trash"))
    }

    pub fn removed_projects(&self) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(Path::new(".trash"))
    }

    pub fn area_manifest(&self, area_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&area_folder.join(AREA_ADMIN_DIR).join("area.json"))
    }

    pub fn area_profiles(&self, area_folder: &Path) -> Result<ResolvedPath, StorageError> {
        self.root
            .resolve(&area_folder.join(AREA_ADMIN_DIR).join("profiles"))
    }

    pub fn humanoid_profile_dir(
        &self,
        area_folder: &Path,
        profile_id: ObjectId,
    ) -> Result<ResolvedPath, StorageError> {
        self.root.resolve(
            &area_folder
                .join(AREA_ADMIN_DIR)
                .join("profiles")
                .join(object_folder("humanoid", profile_id)?),
        )
    }

    pub fn profile_revision(
        &self,
        area_folder: &Path,
        profile_id: ObjectId,
        revision: u32,
    ) -> Result<ResolvedPath, StorageError> {
        if revision == 0 {
            return Err(StorageError::InvalidVault(
                "profile revision must be positive".to_owned(),
            ));
        }
        let directory = self.humanoid_profile_dir(area_folder, profile_id)?;
        self.root
            .resolve(&directory.relative().join(format!("r{revision:04}.json")))
    }

    pub fn ownership(path: &Path) -> DataOwnership {
        let first = path.components().next().and_then(|part| match part {
            std::path::Component::Normal(value) => value.to_str(),
            _ => None,
        });
        if first == Some(ADMIN_DIR) {
            DataOwnership::VaultGlobal
        } else if path
            .components()
            .any(|part| part.as_os_str() == PROJECT_ADMIN_DIR)
        {
            DataOwnership::Project
        } else if path
            .components()
            .any(|part| part.as_os_str() == AREA_ADMIN_DIR)
        {
            DataOwnership::Area
        } else if path.components().any(|part| part.as_os_str() == "exports") {
            DataOwnership::DerivedExport
        } else {
            DataOwnership::Character
        }
    }

    pub fn global_path_allows(path: &Path) -> bool {
        matches!(
            path.strip_prefix(ADMIN_DIR).ok().and_then(Path::to_str),
            Some("vault.json" | "labels.json" | "ui.json" | "runtime")
        ) || path.starts_with(Path::new(ADMIN_DIR).join("runtime"))
    }
}

pub fn object_folder(name: &str, id: ObjectId) -> Result<PathBuf, StorageError> {
    validate_portable_display_name("folder.name", name).map_err(StorageError::InvalidDocument)?;
    let mut slug = portable_name_key(name)
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    slug = slug.trim_matches('-').chars().take(48).collect();
    if slug.is_empty() {
        slug = "object".to_owned();
    }
    let suffix = id.to_string().chars().take(8).collect::<String>();
    Ok(PathBuf::from(format!("{slug}--{suffix}")))
}
