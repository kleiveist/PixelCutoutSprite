use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::StorageError;

const MAX_RECENT_VAULTS: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeviceSettings {
    pub schema_version: u32,
    pub recent_vaults: Vec<PathBuf>,
}

impl Default for DeviceSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            recent_vaults: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DeviceSettingsStore {
    path: PathBuf,
}

impl DeviceSettingsStore {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            path: config_dir.join("device-settings.json"),
        }
    }

    pub fn load(&self) -> Result<DeviceSettings, StorageError> {
        match fs::read(&self.path) {
            Ok(bytes) => {
                let settings: DeviceSettings = serde_json::from_slice(&bytes)
                    .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
                if settings.schema_version != 1 {
                    return Err(StorageError::InvalidVault(
                        "unsupported device-settings schema".to_owned(),
                    ));
                }
                Ok(settings)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(DeviceSettings::default())
            }
            Err(error) => Err(StorageError::io("read device settings", &self.path, error)),
        }
    }

    pub fn remember_vault(&self, root: &Path) -> Result<DeviceSettings, StorageError> {
        let canonical = root
            .canonicalize()
            .map_err(|error| StorageError::io("canonicalize recent vault", root, error))?;
        let mut settings = self.load()?;
        settings.recent_vaults.retain(|path| path != &canonical);
        settings.recent_vaults.insert(0, canonical);
        settings.recent_vaults.truncate(MAX_RECENT_VAULTS);
        self.save(&settings)?;
        Ok(settings)
    }

    fn save(&self, settings: &DeviceSettings) -> Result<(), StorageError> {
        let parent = self.path.parent().ok_or_else(|| {
            StorageError::InvalidVault("device settings path has no parent".to_owned())
        })?;
        fs::create_dir_all(parent)
            .map_err(|error| StorageError::io("create app configuration", parent, error))?;
        let staged = parent.join(".device-settings.json.tmp");
        let bytes = serde_json::to_vec_pretty(settings)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        fs::write(&staged, bytes)
            .map_err(|error| StorageError::io("stage device settings", &staged, error))?;
        fs::rename(&staged, &self.path)
            .map_err(|error| StorageError::io("replace device settings", &self.path, error))
    }
}
