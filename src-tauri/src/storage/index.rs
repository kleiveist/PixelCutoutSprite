use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{parse_document, DocumentKind, DomainDocument, ObjectId, RevisionRef};

use super::{
    is_derived_managed_path, is_managed_namespace_path, managed_json_kind, ManagedJsonKind,
    StorageError, VaultRoot,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ObjectKey {
    Object(ObjectId),
    Revision(RevisionRef),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexedObject {
    pub kind: DocumentKind,
    pub relative_path: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub struct ObjectIndex {
    entries: HashMap<ObjectKey, IndexedObject>,
}

impl ObjectIndex {
    pub fn rebuild(root: &VaultRoot) -> Result<Self, StorageError> {
        let mut documents = Vec::new();
        collect_json_files(root.path(), root.path(), 0, &mut documents)?;
        let mut index = Self::default();
        for path in documents {
            let relative = path
                .strip_prefix(root.path())
                .map_err(|_| StorageError::UnsafePath {
                    path: "index".to_owned(),
                    reason: "indexed path escaped the vault".to_owned(),
                })?
                .to_path_buf();
            let bytes = fs::read(&path)
                .map_err(|error| StorageError::io("read indexed JSON", &relative, error))?;
            let expected = match managed_json_kind(root.path(), &relative) {
                Some(ManagedJsonKind::Domain(expected)) => expected,
                _ => continue,
            };
            let document = parse_document(&bytes)?;
            let actual = document_kind(&document);
            if actual != expected {
                return Err(StorageError::InvalidVault(format!(
                    "managed JSON `{}` has kind {actual:?}, expected {expected:?}",
                    relative.to_string_lossy()
                )));
            }
            index.insert(document_key(&document), actual, relative)?;
        }
        Ok(index)
    }

    pub fn insert(
        &mut self,
        key: ObjectKey,
        kind: DocumentKind,
        relative_path: PathBuf,
    ) -> Result<(), StorageError> {
        if self
            .entries
            .insert(
                key.clone(),
                IndexedObject {
                    kind,
                    relative_path,
                },
            )
            .is_some()
        {
            return Err(StorageError::InvalidVault(format!(
                "duplicate indexed identity: {key:?}"
            )));
        }
        Ok(())
    }

    pub fn resolve(&self, key: &ObjectKey) -> Option<&IndexedObject> {
        self.entries.get(key)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

fn collect_json_files(
    root: &Path,
    directory: &Path,
    depth: u8,
    output: &mut Vec<PathBuf>,
) -> Result<(), StorageError> {
    if depth > 16 {
        return Err(StorageError::InvalidVault(
            "vault nesting exceeds the supported index depth".to_owned(),
        ));
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|error| StorageError::io("scan vault index", directory, error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| StorageError::io("scan vault entry", directory, error))?;
    entries.sort_by_key(fs::DirEntry::file_name);
    for entry in entries {
        let file_type = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect vault entry", &entry.path(), error))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|_| StorageError::UnsafePath {
                path: "index".to_owned(),
                reason: "indexed path escaped the vault".to_owned(),
            })?;
        if file_type.is_symlink() {
            if managed_json_kind(root, relative).is_some()
                || is_managed_namespace_path(root, relative)
            {
                return Err(StorageError::UnsafePath {
                    path: relative.to_string_lossy().into_owned(),
                    reason: "managed index data cannot be a symbolic link".to_owned(),
                });
            }
            continue;
        }
        if file_type.is_dir() {
            if is_derived_managed_path(relative) {
                continue;
            }
            collect_json_files(root, &path, depth + 1, output)?;
        } else if file_type.is_file()
            && matches!(
                managed_json_kind(root, relative),
                Some(ManagedJsonKind::Domain(_))
            )
        {
            output.push(path);
        }
    }
    Ok(())
}

fn document_key(document: &DomainDocument) -> ObjectKey {
    match document {
        DomainDocument::ProfileRevision(value) => ObjectKey::Revision(value.reference()),
        DomainDocument::MotionRevision(value) => ObjectKey::Revision(value.reference()),
        DomainDocument::AssetRevision(value) => ObjectKey::Revision(value.reference()),
        DomainDocument::Vault(value) => ObjectKey::Object(value.id),
        DomainDocument::Label(value) => ObjectKey::Object(value.id),
        DomainDocument::Project(value) => ObjectKey::Object(value.id),
        DomainDocument::Area(value) => ObjectKey::Object(value.id),
        DomainDocument::MotionTemplate(value) => ObjectKey::Object(value.id),
        DomainDocument::Asset(value) => ObjectKey::Object(value.id),
        DomainDocument::OutfitDraft(value) => ObjectKey::Object(value.id),
        DomainDocument::Character(value) => ObjectKey::Object(value.id),
        DomainDocument::Appearance(value) => ObjectKey::Object(value.id),
        DomainDocument::AnimationBinding(value) => ObjectKey::Object(value.id),
        DomainDocument::ExportManifest(value) => ObjectKey::Object(value.id),
    }
}

fn document_kind(document: &DomainDocument) -> DocumentKind {
    match document {
        DomainDocument::Vault(value) => value.kind,
        DomainDocument::Label(value) => value.kind,
        DomainDocument::Project(value) => value.kind,
        DomainDocument::Area(value) => value.kind,
        DomainDocument::ProfileRevision(value) => value.kind,
        DomainDocument::MotionTemplate(value) => value.kind,
        DomainDocument::MotionRevision(value) => value.kind,
        DomainDocument::Asset(value) => value.kind,
        DomainDocument::AssetRevision(value) => value.kind,
        DomainDocument::OutfitDraft(value) => value.kind,
        DomainDocument::Character(value) => value.kind,
        DomainDocument::Appearance(value) => value.kind,
        DomainDocument::AnimationBinding(value) => value.kind,
        DomainDocument::ExportManifest(value) => value.kind,
    }
}
