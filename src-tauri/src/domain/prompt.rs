use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROMPT_WORKSPACE_SCHEMA_VERSION: u64 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptWorkspaceFile {
    Settings,
    Profiles,
    Draft,
    MigrationBackup,
}

impl PromptWorkspaceFile {
    pub const ALL: [Self; 4] = [
        Self::Settings,
        Self::Profiles,
        Self::Draft,
        Self::MigrationBackup,
    ];

    pub fn filename(self) -> &'static str {
        match self {
            Self::Settings => "settings.json",
            Self::Profiles => "profiles.json",
            Self::Draft => "draft.json",
            Self::MigrationBackup => "migration-backup.json",
        }
    }

    pub fn maximum_bytes(self) -> usize {
        match self {
            Self::Settings => 256 * 1024,
            Self::Profiles => 10 * 1024 * 1024,
            Self::Draft => 2 * 1024 * 1024,
            Self::MigrationBackup => 10 * 1024 * 1024,
        }
    }

    pub fn validate(self, value: &Value) -> Result<(), String> {
        let object = value
            .as_object()
            .ok_or_else(|| format!("{} must contain a JSON object", self.filename()))?;
        match self {
            Self::Settings => validate_v2_kind(object, "appSettings"),
            Self::Draft => validate_v2_kind(object, "wizardDraft"),
            Self::MigrationBackup => validate_v2_kind(object, "migrationBackup"),
            Self::Profiles => {
                for field in ["baseProfiles", "categoryProfiles", "assetProfiles"] {
                    if !object.get(field).is_some_and(Value::is_array) {
                        return Err(format!("profiles.json requires an array at `{field}`"));
                    }
                }
                Ok(())
            }
        }
    }
}

fn validate_v2_kind(
    object: &serde_json::Map<String, Value>,
    expected_kind: &str,
) -> Result<(), String> {
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(PROMPT_WORKSPACE_SCHEMA_VERSION)
    {
        return Err("prompt workspace data must use schemaVersion 2".to_owned());
    }
    if object.get("kind").and_then(Value::as_str) != Some(expected_kind) {
        return Err(format!(
            "prompt workspace data must have kind `{expected_kind}`"
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptWorkspaceSnapshot {
    pub settings: Option<Value>,
    pub profiles: Option<Value>,
    pub draft: Option<Value>,
    pub migration_backup: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn validates_workspace_file_boundaries() {
        assert!(PromptWorkspaceFile::Settings
            .validate(&json!({"schemaVersion": 2, "kind": "appSettings"}))
            .is_ok());
        assert!(PromptWorkspaceFile::Profiles
            .validate(&json!({
                "baseProfiles": [],
                "categoryProfiles": [],
                "assetProfiles": []
            }))
            .is_ok());
        assert!(PromptWorkspaceFile::Draft
            .validate(&json!({"schemaVersion": 1, "kind": "wizardDraft"}))
            .is_err());
        assert!(PromptWorkspaceFile::Profiles
            .validate(&json!({"baseProfiles": {}, "categoryProfiles": [], "assetProfiles": []}))
            .is_err());
    }
}
