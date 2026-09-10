use super::DomainError;
use std::collections::HashSet;
use unicode_normalization::UnicodeNormalization;

pub fn validate_portable_display_name(path: &str, name: &str) -> Result<(), DomainError> {
    super::validate_name(path, name)?;
    let forbidden_character = name.chars().any(|character| {
        matches!(
            character,
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
        )
    });
    let key = portable_name_key(name);
    let reserved = matches!(
        key.as_str(),
        "." | ".."
            | ".pixelforge-studio"
            | "con"
            | "prn"
            | "aux"
            | "nul"
            | "com1"
            | "com2"
            | "com3"
            | "com4"
            | "com5"
            | "com6"
            | "com7"
            | "com8"
            | "com9"
            | "lpt1"
            | "lpt2"
            | "lpt3"
            | "lpt4"
            | "lpt5"
            | "lpt6"
            | "lpt7"
            | "lpt8"
            | "lpt9"
    );
    if forbidden_character || reserved || name.ends_with(['.', ' ']) {
        return Err(DomainError::invalid(
            path,
            "is not a portable display name for a filesystem-backed object",
        ));
    }
    Ok(())
}

pub fn ensure_no_portable_name_collisions<'a>(
    path: &str,
    names: impl IntoIterator<Item = &'a str>,
) -> Result<(), DomainError> {
    let mut keys = HashSet::new();
    for name in names {
        validate_portable_display_name(path, name)?;
        if !keys.insert(portable_name_key(name)) {
            return Err(DomainError::invalid(
                path,
                "contains names that collide after Unicode normalization and case folding",
            ));
        }
    }
    Ok(())
}

pub fn portable_name_key(value: &str) -> String {
    value.nfc().flat_map(char::to_lowercase).collect()
}
