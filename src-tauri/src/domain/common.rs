use super::DomainError;

pub const SCHEMA_VERSION: u32 = 1;
pub const VAULT_FORMAT: &str = "pixel-cutout-sprite-vault";

pub fn validate_schema(schema_version: u32) -> Result<(), DomainError> {
    if schema_version != SCHEMA_VERSION {
        return Err(DomainError::UnsupportedSchemaVersion {
            found: u64::from(schema_version),
            supported: SCHEMA_VERSION,
        });
    }
    Ok(())
}

pub fn validate_name(path: &str, name: &str) -> Result<(), DomainError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 120 || trimmed != name {
        return Err(DomainError::invalid(
            path,
            "must contain 1–120 characters without surrounding whitespace",
        ));
    }
    if name.chars().any(char::is_control) {
        return Err(DomainError::invalid(
            path,
            "must not contain control characters",
        ));
    }
    Ok(())
}
