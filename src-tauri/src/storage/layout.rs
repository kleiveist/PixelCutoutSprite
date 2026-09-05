use std::path::{Path, PathBuf};

use crate::domain::{portable_name_key, validate_portable_display_name, ObjectId};

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
