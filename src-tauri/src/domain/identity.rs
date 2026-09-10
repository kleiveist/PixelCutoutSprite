use std::fmt;
use std::path::{Component, Path};
use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use uuid::Uuid;

use super::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ObjectId(Uuid);

impl ObjectId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn parse(field: &'static str, value: &str) -> Result<Self, DomainError> {
        let id = Uuid::parse_str(value).map_err(|_| DomainError::InvalidId {
            field,
            value: value.to_owned(),
        })?;
        if id.is_nil() || id.hyphenated().to_string() != value {
            return Err(DomainError::InvalidId {
                field,
                value: value.to_owned(),
            });
        }
        Ok(Self(id))
    }
}

impl Default for ObjectId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ObjectId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.0.hyphenated())
    }
}

impl FromStr for ObjectId {
    type Err = DomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        Self::parse("id", value)
    }
}

impl Serialize for ObjectId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for ObjectId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::parse("id", &value).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RelativePath(String);

impl RelativePath {
    pub fn parse(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let path = Path::new(&value);
        let components_are_safe = path
            .components()
            .all(|part| matches!(part, Component::Normal(_)));
        let has_reserved_segment = value
            .split('/')
            .any(|segment| segment.eq_ignore_ascii_case(".pixelforge-studio"));
        let has_windows_prefix = value.starts_with("//")
            || value.starts_with("\\\\")
            || value.as_bytes().get(1).is_some_and(|byte| *byte == b':');
        if value.is_empty()
            || value.len() > 512
            || value.contains('\\')
            || value.contains('\0')
            || has_reserved_segment
            || has_windows_prefix
            || path.is_absolute()
            || !components_are_safe
        {
            return Err(DomainError::invalid(
                "relative_path",
                "must be a non-empty portable relative path without traversal",
            ));
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RelativePath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct UtcTimestamp(DateTime<Utc>);

impl UtcTimestamp {
    pub fn now() -> Self {
        Self(Utc::now())
    }

    pub fn parse(value: &str) -> Result<Self, DomainError> {
        let parsed = DateTime::parse_from_rfc3339(value)
            .map_err(|_| DomainError::invalid("timestamp", "must be RFC 3339"))?;
        if parsed.offset().local_minus_utc() != 0 {
            return Err(DomainError::invalid(
                "timestamp",
                "must use a UTC offset (`Z` or `+00:00`)",
            ));
        }
        Ok(Self(parsed.with_timezone(&Utc)))
    }
}

impl Serialize for UtcTimestamp {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.0.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
    }
}

impl<'de> Deserialize<'de> for UtcTimestamp {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::parse(&value).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Sha256Digest(String);

impl Sha256Digest {
    pub fn parse(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let valid = value.len() == 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
        if !valid {
            return Err(DomainError::invalid(
                "sha256",
                "must contain exactly 64 lowercase hexadecimal characters",
            ));
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
