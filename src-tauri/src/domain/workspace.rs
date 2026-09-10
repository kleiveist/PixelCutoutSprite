use super::{validate_schema, DomainError, ObjectId, UtcTimestamp, VAULT_FORMAT};
use serde::{Deserialize, Serialize};

// Passive legacy discriminators are retained solely for safe transaction recovery.
// No legacy model, creation service, or dispatcher remains.
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
