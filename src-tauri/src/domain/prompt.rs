use serde::{Deserialize, Serialize};
use serde_json::Value;

const PROMPT_ASSET_CATEGORIES: [&str; 9] = [
    "character",
    "movingObject",
    "staticObject",
    "texture",
    "nature",
    "building",
    "tileset",
    "item",
    "artwork",
];

pub const PROMPT_HANDOFF_SCHEMA_VERSION: u32 = 1;
pub const PROMPT_WORKSPACE_SCHEMA_VERSION: u64 = 2;
pub const MAX_PROMPT_OUTPUT_BYTES: usize = 16 * 1024 * 1024;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PromptHandoff {
    pub schema_version: u32,
    pub category: String,
    pub prompt: String,
    pub negative_prompt: String,
    pub technical_prompt: String,
    pub profile_references: Vec<String>,
    pub created_at: String,
}

impl PromptHandoff {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != PROMPT_HANDOFF_SCHEMA_VERSION {
            return Err("unsupported prompt handoff schemaVersion".to_owned());
        }
        bounded_nonempty("category", &self.category, 120)?;
        if !PROMPT_ASSET_CATEGORIES.contains(&self.category.as_str()) {
            return Err("prompt handoff category is not supported".to_owned());
        }
        bounded_nonempty("prompt", &self.prompt, 1_000_000)?;
        bounded_nonempty("negativePrompt", &self.negative_prompt, 500_000)?;
        bounded_nonempty("technicalPrompt", &self.technical_prompt, 500_000)?;
        bounded_nonempty("createdAt", &self.created_at, 80)?;
        chrono::DateTime::parse_from_rfc3339(&self.created_at)
            .map_err(|_| "createdAt must be an RFC 3339 timestamp".to_owned())?;
        if self.profile_references.len() > 128 {
            return Err("profileReferences exceeds 128 entries".to_owned());
        }
        for reference in &self.profile_references {
            bounded_nonempty("profileReferences", reference, 128)?;
        }
        Ok(())
    }
}

fn bounded_nonempty(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > maximum || value.contains('\0') {
        return Err(format!(
            "{field} must be non-empty and at most {maximum} bytes"
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptOutputFormat {
    Markdown,
    Json,
}

impl PromptOutputFormat {
    pub fn extension(self) -> &'static str {
        match self {
            Self::Markdown => "md",
            Self::Json => "json",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PromptHandoffReceipt {
    pub relative_path: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn handoff() -> PromptHandoff {
        PromptHandoff {
            schema_version: PROMPT_HANDOFF_SCHEMA_VERSION,
            category: "character".to_owned(),
            prompt: "main prompt".to_owned(),
            negative_prompt: "negative prompt".to_owned(),
            technical_prompt: "technical prompt".to_owned(),
            profile_references: vec!["asset_hero".to_owned()],
            created_at: "2026-09-06T10:00:00Z".to_owned(),
        }
    }

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

    #[test]
    fn validates_handoff_category_timestamp_and_limits() {
        assert!(handoff().validate().is_ok());

        let mut invalid_category = handoff();
        invalid_category.category = "animation-project".to_owned();
        assert!(invalid_category.validate().is_err());

        let mut invalid_timestamp = handoff();
        invalid_timestamp.created_at = "yesterday".to_owned();
        assert!(invalid_timestamp.validate().is_err());

        let mut too_many_profiles = handoff();
        too_many_profiles.profile_references = vec!["profile".to_owned(); 129];
        assert!(too_many_profiles.validate().is_err());
    }
}
