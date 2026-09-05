use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainError {
    #[error("invalid JSON: {0}")]
    InvalidJson(String),
    #[error("missing or invalid document discriminator `{0}`")]
    InvalidDiscriminator(&'static str),
    #[error("unsupported schema version {found}; this build supports version {supported}")]
    UnsupportedSchemaVersion { found: u64, supported: u32 },
    #[error("invalid UUID for {field}: {value}")]
    InvalidId { field: &'static str, value: String },
    #[error("invalid value at {path}: {message}")]
    InvalidValue { path: String, message: String },
    #[error("duplicate identity `{0}`")]
    DuplicateId(String),
    #[error("missing reference at {path}: `{target}`")]
    MissingReference { path: String, target: String },
    #[error("incompatible reference at {path}: {message}")]
    IncompatibleReference { path: String, message: String },
    #[error("cycle detected in {relation}: {path}")]
    Cycle {
        relation: &'static str,
        path: String,
    },
}

impl DomainError {
    pub fn invalid(path: impl Into<String>, message: impl Into<String>) -> Self {
        Self::InvalidValue {
            path: path.into(),
            message: message.into(),
        }
    }
}
