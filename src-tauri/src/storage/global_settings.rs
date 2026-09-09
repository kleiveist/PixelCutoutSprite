use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::StorageError;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GlobalTheme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UiLanguage {
    #[default]
    De,
    En,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UiDensity {
    Compact,
    #[default]
    Comfortable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GlobalSettings {
    pub schema_version: u32,
    pub kind: String,
    pub theme: GlobalTheme,
    pub ui_language: UiLanguage,
    pub density: UiDensity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_state: Option<WindowState>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            kind: "globalSettings".to_owned(),
            theme: GlobalTheme::System,
            ui_language: UiLanguage::De,
            density: UiDensity::Comfortable,
            window_state: None,
        }
    }
}

impl GlobalSettings {
    pub fn validate(&self) -> Result<(), StorageError> {
        if self.schema_version != 1 || self.kind != "globalSettings" {
            return Err(StorageError::InvalidVault(
                "unsupported global-settings document".to_owned(),
            ));
        }
        if self
            .window_state
            .as_ref()
            .is_some_and(|state| state.width < 480 || state.height < 360)
        {
            return Err(StorageError::InvalidVault(
                "global window state is below the supported 480x360 minimum".to_owned(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct GlobalSettingsStore {
    path: PathBuf,
}

impl GlobalSettingsStore {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            path: config_dir.join("global-settings.json"),
        }
    }

    pub fn load(&self) -> Result<GlobalSettings, StorageError> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(GlobalSettings::default())
            }
            Err(error) => return Err(StorageError::io("read global settings", &self.path, error)),
        };
        if bytes.len() > 64 * 1024 {
            return Err(StorageError::InvalidVault(
                "global-settings.json exceeds 64 KiB".to_owned(),
            ));
        }
        let settings: GlobalSettings = serde_json::from_slice(&bytes)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        settings.validate()?;
        Ok(settings)
    }

    pub fn save(&self, settings: &GlobalSettings) -> Result<(), StorageError> {
        settings.validate()?;
        let parent = self.path.parent().ok_or_else(|| {
            StorageError::InvalidVault("global settings path has no parent".to_owned())
        })?;
        fs::create_dir_all(parent)
            .map_err(|error| StorageError::io("create app configuration", parent, error))?;
        reject_non_regular(&self.path)?;
        let bytes = serde_json::to_vec_pretty(settings)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let staged = parent.join(format!(
            ".global-settings.json.{}.stage",
            uuid::Uuid::new_v4()
        ));
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&staged)
            .map_err(|error| StorageError::io("stage global settings", &staged, error))?;
        file.write_all(&bytes)
            .map_err(|error| StorageError::io("write global settings", &staged, error))?;
        file.sync_all()
            .map_err(|error| StorageError::io("sync global settings", &staged, error))?;
        drop(file);
        let verified: GlobalSettings = serde_json::from_slice(
            &fs::read(&staged)
                .map_err(|error| StorageError::io("verify global settings", &staged, error))?,
        )
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        verified.validate()?;
        if let Err(error) = fs::rename(&staged, &self.path) {
            let _ = fs::remove_file(&staged);
            return Err(StorageError::io(
                "publish global settings",
                &self.path,
                error,
            ));
        }
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    }
}

fn reject_non_regular(path: &Path) -> Result<(), StorageError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err(StorageError::UnsafePath {
                path: "global-settings.json".to_owned(),
                reason: "global settings target must be a regular file".to_owned(),
            })
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(StorageError::io("inspect global settings", path, error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn round_trip_contains_only_global_ui_fields() {
        let directory = TempDir::new().unwrap();
        let store = GlobalSettingsStore::new(directory.path());
        let settings = GlobalSettings {
            theme: GlobalTheme::Dark,
            density: UiDensity::Compact,
            ..GlobalSettings::default()
        };
        store.save(&settings).unwrap();
        assert_eq!(store.load().unwrap(), settings);
        let bytes = fs::read(directory.path().join("global-settings.json")).unwrap();
        let text = String::from_utf8(bytes).unwrap();
        assert!(!text.contains("activeBaseProfileId"));
        assert!(!text.contains("profiles"));
        assert!(!text.contains("answers"));
        assert!(!text.contains("outputs"));
    }

    #[test]
    fn rejects_unknown_fields_and_too_small_windows_without_rewriting() {
        let directory = TempDir::new().unwrap();
        let path = directory.path().join("global-settings.json");
        let original = br#"{"schemaVersion":1,"kind":"globalSettings","theme":"dark","uiLanguage":"de","density":"comfortable","activeBaseProfileId":"bad"}"#;
        fs::write(&path, original).unwrap();
        let store = GlobalSettingsStore::new(directory.path());
        assert!(store.load().is_err());
        assert_eq!(fs::read(path).unwrap(), original);

        let invalid = GlobalSettings {
            window_state: Some(WindowState {
                width: 479,
                height: 360,
            }),
            ..GlobalSettings::default()
        };
        assert!(store.save(&invalid).is_err());
    }
}
