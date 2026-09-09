use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::storage::{StorageError, VaultRoot};
use crate::workspace::{
    validate_workspace_relative, ManagedFileWrite, WorkspaceWriter, WriteExpectation,
    WriteReceipt, PROMPT_VAULT_DIR,
};

const BASE_PROFILE_PATH: &str = ".PixelPrompt/basisprofil.json";
const MAX_SCAN_DEPTH: u8 = 8;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredPromptDocument {
    pub relative_path: String,
    pub value: Value,
    pub sha256: String,
    pub revision: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptVaultIssue {
    pub code: String,
    pub relative_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptVaultIndex {
    pub base_profile: Option<StoredPromptDocument>,
    pub profiles: Vec<StoredPromptDocument>,
    pub drafts: Vec<StoredPromptDocument>,
    pub issues: Vec<PromptVaultIssue>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeneratedOutputWrite {
    pub relative_path: String,
    pub contents: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LegacySourceMapping {
    pub source_kind: String,
    pub source_id: String,
    pub target_id: String,
    pub target_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PromptVaultMigrationBundle {
    pub schema_version: u32,
    pub kind: String,
    pub migration_id: String,
    pub source_id: String,
    pub source_hash: String,
    pub source_snapshot: Value,
    pub mappings: Vec<LegacySourceMapping>,
    pub base_profile: Option<Value>,
    pub profiles: Vec<Value>,
    pub draft: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct PromptVaultRepository {
    root: VaultRoot,
}

impl PromptVaultRepository {
    pub fn new(root: VaultRoot) -> Self {
        Self { root }
    }

    pub fn scan(&self) -> Result<PromptVaultIndex, StorageError> {
        let prompt = self.root.resolve(Path::new(PROMPT_VAULT_DIR))?;
        let metadata = fs::symlink_metadata(prompt.as_path())
            .map_err(|error| StorageError::io("inspect prompt vault", Path::new(PROMPT_VAULT_DIR), error))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(StorageError::UnsafePath {
                path: PROMPT_VAULT_DIR.to_owned(),
                reason: "prompt vault must be a real directory".to_owned(),
            });
        }
        let mut index = PromptVaultIndex::default();
        self.scan_directory(Path::new(PROMPT_VAULT_DIR), 0, &mut index)?;
        detect_duplicate_profile_ids(&mut index);
        index.profiles.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
        index.drafts.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
        Ok(index)
    }

    pub fn save_base_profile(
        &self,
        value: Value,
        expected_sha256: Option<String>,
    ) -> Result<WriteReceipt, StorageError> {
        validate_v3_document(&value, "vaultBaseProfile", "id")?;
        require_object(&value, "values")?;
        require_object(&value, "locks")?;
        let target = Path::new(BASE_PROFILE_PATH);
        let exists = self.root.resolve(target)?.as_path().exists();
        let expectation = WriteExpectation {
            expected_revision: if exists { revision(&value).checked_sub(1) } else { None },
            expected_sha256,
            create_only: !exists,
        };
        WorkspaceWriter::new(self.root.clone()).write_json(target, &value, &expectation)
    }

    pub fn save_draft(
        &self,
        value: Value,
        expected_sha256: Option<String>,
    ) -> Result<WriteReceipt, StorageError> {
        validate_v3_document(&value, "vaultPromptDraft", "draftId")?;
        require_object(&value, "identity")?;
        require_object(&value, "rawValues")?;
        require_object(&value, "wizard")?;
        let draft_id = string_field(&value, "draftId")?;
        let relative = Path::new(PROMPT_VAULT_DIR)
            .join(".drafts")
            .join(format!("{draft_id}.json"));
        let exists = self.root.resolve(&relative)?.as_path().exists();
        let expectation = WriteExpectation {
            expected_revision: if exists { revision(&value).checked_sub(1) } else { None },
            expected_sha256,
            create_only: !exists,
        };
        WorkspaceWriter::new(self.root.clone()).write_json(&relative, &value, &expectation)
    }

    pub fn save_profile_generation(
        &self,
        profile: Value,
        outputs: Vec<GeneratedOutputWrite>,
        expected_profile_sha256: Option<String>,
    ) -> Result<Vec<WriteReceipt>, StorageError> {
        validate_prompt_profile(&profile)?;
        let profile_id = string_field(&profile, "id")?;
        let directory = profile_directory(&profile)?;
        let folder_name = string_field(&profile, "folderName")?;
        let profile_relative = directory.join(format!("{folder_name}-profile.json"));
        self.reject_profile_collision(&profile_id, &profile_relative, false)?;

        let expected_outputs = output_manifest(&profile)?;
        if expected_outputs.len() != outputs.len() {
            return Err(StorageError::InvalidVault(
                "generated output count does not match the profile manifest".to_owned(),
            ));
        }
        let previous_outputs = self
            .load_profile_by_id(&profile_id)?
            .map(|document| output_manifest(&document.value))
            .transpose()?
            .unwrap_or_default()
            .into_iter()
            .map(|entry| (entry.relative_path, entry.sha256))
            .collect::<HashMap<_, _>>();

        let supplied = outputs
            .into_iter()
            .map(|output| (output.relative_path.clone(), output))
            .collect::<HashMap<_, _>>();
        if supplied.len() != expected_outputs.len() {
            return Err(StorageError::InvalidVault(
                "generated output paths must be unique".to_owned(),
            ));
        }

        let mut writes = Vec::with_capacity(expected_outputs.len() + 1);
        for expected in expected_outputs {
            let output = supplied.get(&expected.relative_path).ok_or_else(|| {
                StorageError::InvalidVault(format!(
                    "generated output `{}` is missing",
                    expected.relative_path
                ))
            })?;
            let relative = PathBuf::from(&expected.relative_path);
            validate_output_path(&profile, &directory, &relative, &expected)?;
            let bytes = output.contents.as_bytes().to_vec();
            if digest(&bytes) != expected.sha256 {
                return Err(StorageError::InvalidVault(format!(
                    "generated output hash does not match `{}`",
                    expected.relative_path
                )));
            }
            let exists = self.root.resolve(&relative)?.as_path().exists();
            let old_hash = previous_outputs.get(&expected.relative_path).cloned();
            if exists && old_hash.is_none() {
                return Err(StorageError::WriteConflict);
            }
            writes.push(ManagedFileWrite {
                relative_path: relative,
                bytes,
                expectation: WriteExpectation {
                    expected_sha256: old_hash,
                    create_only: !exists,
                    ..WriteExpectation::default()
                },
            });
        }

        let profile_bytes = serde_json::to_vec_pretty(&profile)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let profile_exists = self.root.resolve(&profile_relative)?.as_path().exists();
        writes.push(ManagedFileWrite {
            relative_path: profile_relative,
            bytes: profile_bytes,
            expectation: WriteExpectation {
                expected_revision: if profile_exists {
                    revision(&profile).checked_sub(1)
                } else {
                    None
                },
                expected_sha256: expected_profile_sha256,
                create_only: !profile_exists,
            },
        });
        WorkspaceWriter::new(self.root.clone()).publish_file_set(&writes)
    }

    pub fn save_profile_without_outputs(
        &self,
        profile: Value,
        expected_sha256: Option<String>,
    ) -> Result<WriteReceipt, StorageError> {
        validate_prompt_profile(&profile)?;
        if profile.pointer("/outputs/status").and_then(Value::as_str) == Some("fresh") {
            return Err(StorageError::InvalidVault(
                "a fresh profile must use the generation writer".to_owned(),
            ));
        }
        let profile_id = string_field(&profile, "id")?;
        let folder_name = string_field(&profile, "folderName")?;
        let relative = profile_directory(&profile)?.join(format!("{folder_name}-profile.json"));
        let existing = self.load_profile_by_id(&profile_id)?;
        if let Some(stored) = &existing {
            if stored.relative_path.to_lowercase() != portable(&relative).to_lowercase() {
                self.reject_profile_collision(&profile_id, &relative, true)?;
                return self.relocate_profile_without_outputs(
                    stored,
                    &profile,
                    &relative,
                    expected_sha256,
                );
            }
        }
        self.reject_profile_collision(&profile_id, &relative, false)?;
        let exists = self.root.resolve(&relative)?.as_path().exists();
        WorkspaceWriter::new(self.root.clone()).write_json(
            &relative,
            &profile,
            &WriteExpectation {
                expected_revision: if exists { revision(&profile).checked_sub(1) } else { None },
                expected_sha256,
                create_only: !exists,
            },
        )
    }

    pub fn remove_draft(
        &self,
        draft_id: &str,
        expected_sha256: &str,
    ) -> Result<(), StorageError> {
        validate_id(draft_id)?;
        validate_sha256(expected_sha256)?;
        let relative = Path::new(PROMPT_VAULT_DIR)
            .join(".drafts")
            .join(format!("{draft_id}.json"));
        let resolved = self.root.resolve(&relative)?;
        let bytes = fs::read(resolved.as_path())
            .map_err(|error| StorageError::io("read prompt draft before removal", &relative, error))?;
        if digest(&bytes) != expected_sha256 {
            return Err(StorageError::WriteConflict);
        }
        let metadata = fs::symlink_metadata(resolved.as_path())
            .map_err(|error| StorageError::io("inspect prompt draft before removal", &relative, error))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(StorageError::UnsafePath {
                path: portable(&relative),
                reason: "draft must be a regular file".to_owned(),
            });
        }
        fs::remove_file(resolved.as_path())
            .map_err(|error| StorageError::io("remove prompt draft", &relative, error))
    }

    pub fn apply_migration(
        &self,
        bundle: PromptVaultMigrationBundle,
    ) -> Result<Vec<WriteReceipt>, StorageError> {
        let documents = validate_migration_bundle(&bundle)?;
        let marker = Path::new(PROMPT_VAULT_DIR)
            .join(".migration")
            .join(format!("{}.json", bundle.source_hash));
        let marker_value = serde_json::to_value(&bundle)
            .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
        let writer = WorkspaceWriter::new(self.root.clone());

        if self.root.resolve(&marker)?.as_path().exists() {
            let (stored, marker_receipt) = writer.read_json(&marker)?;
            if stored != marker_value {
                return Err(StorageError::WriteConflict);
            }
            let mut receipts = verify_migration_documents(&writer, &documents)?;
            receipts.push(marker_receipt);
            return Ok(receipts);
        }

        let mut writes = Vec::new();
        let mut existing_receipts = Vec::new();
        for (relative, value) in &documents {
            if self.root.resolve(relative)?.as_path().exists() {
                let (stored, receipt) = writer.read_json(relative)?;
                if stored != *value {
                    return Err(StorageError::WriteConflict);
                }
                existing_receipts.push(receipt);
                continue;
            }
            writes.push(json_file_write(relative.clone(), value)?);
        }
        writes.push(json_file_write(marker.clone(), &marker_value)?);
        let mut receipts = writer.publish_file_set(&writes)?;
        receipts.extend(existing_receipts);
        verify_migration_documents(&writer, &documents)?;
        let (stored_marker, _) = writer.read_json(&marker)?;
        if stored_marker != marker_value {
            return Err(StorageError::RecoveryRequired(
                "migration provenance could not be verified after publication".to_owned(),
            ));
        }
        Ok(receipts)
    }

    fn load_profile_by_id(
        &self,
        profile_id: &str,
    ) -> Result<Option<StoredPromptDocument>, StorageError> {
        let index = self.scan()?;
        let matching = index
            .profiles
            .into_iter()
            .filter(|profile| profile.value.get("id").and_then(Value::as_str) == Some(profile_id))
            .collect::<Vec<_>>();
        if matching.len() > 1 {
            return Err(StorageError::WriteConflict);
        }
        Ok(matching.into_iter().next())
    }

    fn reject_profile_collision(
        &self,
        profile_id: &str,
        target: &Path,
        allow_same_id_relocation: bool,
    ) -> Result<(), StorageError> {
        let target_key = portable(target).to_lowercase();
        let index = self.scan()?;
        if index.issues.iter().any(|issue| issue.code == "duplicate_profile_id") {
            return Err(StorageError::WriteConflict);
        }
        for profile in index.profiles {
            let id = string_field(&profile.value, "id")?;
            let path_key = profile.relative_path.to_lowercase();
            if (!allow_same_id_relocation && id == profile_id && path_key != target_key)
                || (id != profile_id && path_key == target_key)
            {
                return Err(StorageError::WriteConflict);
            }
        }
        Ok(())
    }

    fn relocate_profile_without_outputs(
        &self,
        stored: &StoredPromptDocument,
        profile: &Value,
        target: &Path,
        expected_sha256: Option<String>,
    ) -> Result<WriteReceipt, StorageError> {
        let source = PathBuf::from(&stored.relative_path);
        let previous_outputs = output_manifest(&stored.value)?;
        let next_outputs = output_manifest(profile)?;
        if !next_outputs.is_empty() && next_outputs.len() != previous_outputs.len() {
            return Err(StorageError::InvalidVault(
                "profile relocation may only retain or clear its existing output set".to_owned(),
            ));
        }
        let next_by_key = next_outputs
            .iter()
            .map(|entry| (output_tuple(entry), entry))
            .collect::<HashMap<_, _>>();
        let directory = profile_directory(profile)?;
        let writer = WorkspaceWriter::new(self.root.clone());
        let mut old_outputs = Vec::new();
        for previous in &previous_outputs {
            let old_relative = PathBuf::from(&previous.relative_path);
            old_outputs.push((old_relative.clone(), previous.sha256.clone()));
            let Some(next) = next_by_key.get(&output_tuple(previous)) else {
                if next_outputs.is_empty() {
                    continue;
                }
                return Err(StorageError::InvalidVault(
                    "profile relocation changed an output tuple".to_owned(),
                ));
            };
            if previous.sha256 != next.sha256 {
                return Err(StorageError::WriteConflict);
            }
            let next_relative = PathBuf::from(&next.relative_path);
            validate_output_path(profile, &directory, &next_relative, next)?;
            writer.link_file(&old_relative, &next_relative, &previous.sha256)?;
        }
        let receipt = writer.relocate_json(
            &source,
            target,
            profile,
            &WriteExpectation {
                expected_revision: revision(profile).checked_sub(1),
                expected_sha256,
                create_only: false,
            },
        )?;
        for (old_relative, old_sha256) in old_outputs {
            let _ = writer.remove_file_if_unchanged(&old_relative, &old_sha256);
        }
        Ok(receipt)
    }

    fn scan_directory(
        &self,
        relative: &Path,
        depth: u8,
        index: &mut PromptVaultIndex,
    ) -> Result<(), StorageError> {
        if depth > MAX_SCAN_DEPTH {
            return Err(StorageError::InvalidVault(
                "prompt vault exceeds the supported nesting depth".to_owned(),
            ));
        }
        validate_workspace_relative(relative)?;
        let directory = self.root.resolve(relative)?;
        let mut entries = fs::read_dir(directory.as_path())
            .map_err(|error| StorageError::io("scan prompt vault", relative, error))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| StorageError::io("scan prompt vault", relative, error))?;
        entries.sort_by_key(fs::DirEntry::file_name);
        for entry in entries {
            let child = relative.join(entry.file_name());
            validate_workspace_relative(&child)?;
            let kind = entry.file_type().map_err(|error| {
                StorageError::io("inspect prompt vault entry", &child, error)
            })?;
            if kind.is_symlink() {
                return Err(StorageError::UnsafePath {
                    path: portable(&child),
                    reason: "symbolic links are forbidden in .PixelPrompt".to_owned(),
                });
            }
            if kind.is_dir() {
                self.scan_directory(&child, depth + 1, index)?;
                continue;
            }
            if !kind.is_file() || child.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            let role = json_role(&child);
            if role == JsonRole::Foreign {
                if child
                    .file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case("basisprofil.json"))
                {
                    if let Ok((value, _)) = WorkspaceWriter::new(self.root.clone()).read_json(&child)
                    {
                        if value.get("kind").and_then(Value::as_str) == Some("vaultBaseProfile") {
                            index.issues.push(issue(
                                "duplicate_base_profile",
                                &child,
                                "A competing Vault base exists outside .PixelPrompt/basisprofil.json.",
                            ));
                        }
                    }
                }
                continue;
            }
            match WorkspaceWriter::new(self.root.clone()).read_json(&child) {
                Ok((value, receipt)) => {
                    let expected_kind = match role {
                        JsonRole::Base => "vaultBaseProfile",
                        JsonRole::Draft => "vaultPromptDraft",
                        JsonRole::Profile => "vaultPromptProfile",
                        JsonRole::Foreign => unreachable!(),
                    };
                    let id_field = if role == JsonRole::Draft { "draftId" } else { "id" };
                    match validate_v3_document(&value, expected_kind, id_field) {
                        Ok(()) => {
                            let document = StoredPromptDocument {
                                relative_path: portable(&child),
                                revision: revision(&value),
                                value,
                                sha256: receipt.sha256,
                            };
                            match role {
                                JsonRole::Base if index.base_profile.is_none() => {
                                    index.base_profile = Some(document)
                                }
                                JsonRole::Base => index.issues.push(issue(
                                    "duplicate_base_profile",
                                    &child,
                                    "Only .PixelPrompt/basisprofil.json may define the active base.",
                                )),
                                JsonRole::Draft => index.drafts.push(document),
                                JsonRole::Profile => index.profiles.push(document),
                                JsonRole::Foreign => unreachable!(),
                            }
                        }
                        Err(error) => index.issues.push(issue(
                            "invalid_document",
                            &child,
                            &error.to_string(),
                        )),
                    }
                }
                Err(error) => index.issues.push(issue(
                    "unreadable_document",
                    &child,
                    &error.to_string(),
                )),
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum JsonRole {
    Base,
    Draft,
    Profile,
    Foreign,
}

fn json_role(path: &Path) -> JsonRole {
    if portable(path) == BASE_PROFILE_PATH {
        return JsonRole::Base;
    }
    let components = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>();
    if components.len() == 3
        && components[0] == PROMPT_VAULT_DIR
        && components[1] == ".drafts"
    {
        return JsonRole::Draft;
    }
    if components.len() == 5
        && components[0] == PROMPT_VAULT_DIR
        && components[4].ends_with("-profile.json")
    {
        return JsonRole::Profile;
    }
    JsonRole::Foreign
}

#[derive(Debug, Clone)]
struct OutputManifestEntry {
    relative_path: String,
    style: String,
    language: String,
    part: String,
    sha256: String,
}

fn output_tuple(entry: &OutputManifestEntry) -> String {
    format!("{}:{}:{}", entry.style, entry.language, entry.part)
}

fn output_manifest(profile: &Value) -> Result<Vec<OutputManifestEntry>, StorageError> {
    let files = profile
        .pointer("/outputs/files")
        .and_then(Value::as_array)
        .ok_or_else(|| StorageError::InvalidVault("profile outputs.files must be an array".to_owned()))?;
    let mut keys = HashSet::new();
    files
        .iter()
        .map(|file| {
            let entry = OutputManifestEntry {
                relative_path: string_field(file, "relativePath")?,
                style: string_field(file, "style")?,
                language: string_field(file, "language")?,
                part: string_field(file, "part")?,
                sha256: string_field(file, "sha256")?,
            };
            validate_sha256(&entry.sha256)?;
            let key = format!("{}:{}:{}", entry.style, entry.language, entry.part);
            if !keys.insert(key) {
                return Err(StorageError::InvalidVault(
                    "profile output tuples must be unique".to_owned(),
                ));
            }
            Ok(entry)
        })
        .collect()
}

fn validate_migration_bundle(
    bundle: &PromptVaultMigrationBundle,
) -> Result<Vec<(PathBuf, Value)>, StorageError> {
    if bundle.schema_version != 1 || bundle.kind != "promptVaultMigration" {
        return Err(StorageError::InvalidVault(
            "unsupported prompt migration bundle".to_owned(),
        ));
    }
    validate_id(&bundle.migration_id)?;
    validate_sha256(&bundle.source_hash)?;
    if bundle.source_id.trim().is_empty() || bundle.source_id.len() > 256 {
        return Err(StorageError::InvalidVault(
            "migration sourceId must be bounded and non-empty".to_owned(),
        ));
    }
    chrono::DateTime::parse_from_rfc3339(&bundle.created_at).map_err(|_| {
        StorageError::InvalidVault("migration createdAt must be RFC 3339".to_owned())
    })?;
    let canonical_source = serde_json::to_vec(&bundle.source_snapshot)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    if digest(&canonical_source) != bundle.source_hash {
        return Err(StorageError::InvalidVault(
            "migration source hash does not match the preserved source snapshot".to_owned(),
        ));
    }
    if bundle.profiles.len() > 10_000 || bundle.mappings.len() > 20_000 {
        return Err(StorageError::InvalidVault(
            "migration bundle exceeds its item limit".to_owned(),
        ));
    }
    let mut documents = Vec::new();
    let mut ids = HashSet::new();
    if let Some(base) = &bundle.base_profile {
        validate_v3_document(base, "vaultBaseProfile", "id")?;
        require_object(base, "values")?;
        require_object(base, "locks")?;
        documents.push((PathBuf::from(BASE_PROFILE_PATH), base.clone()));
    }
    for profile in &bundle.profiles {
        validate_prompt_profile(profile)?;
        let id = string_field(profile, "id")?;
        if !ids.insert(id) {
            return Err(StorageError::WriteConflict);
        }
        let folder_name = string_field(profile, "folderName")?;
        let relative = profile_directory(profile)?.join(format!("{folder_name}-profile.json"));
        documents.push((relative, profile.clone()));
    }
    if let Some(draft) = &bundle.draft {
        validate_v3_document(draft, "vaultPromptDraft", "draftId")?;
        require_object(draft, "identity")?;
        require_object(draft, "rawValues")?;
        require_object(draft, "wizard")?;
        let id = string_field(draft, "draftId")?;
        documents.push((
            Path::new(PROMPT_VAULT_DIR)
                .join(".drafts")
                .join(format!("{id}.json")),
            draft.clone(),
        ));
    }
    let targets = documents
        .iter()
        .map(|(path, _)| portable(path))
        .collect::<HashSet<_>>();
    for mapping in &bundle.mappings {
        if mapping.source_id.is_empty()
            || mapping.target_id.is_empty()
            || !matches!(
                mapping.source_kind.as_str(),
                "baseProfile" | "categoryProfile" | "assetProfile" | "wizardDraft"
            )
            || !targets.contains(&mapping.target_path)
        {
            return Err(StorageError::InvalidVault(
                "migration contains an invalid source mapping".to_owned(),
            ));
        }
    }
    Ok(documents)
}

fn json_file_write(relative_path: PathBuf, value: &Value) -> Result<ManagedFileWrite, StorageError> {
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))?;
    Ok(ManagedFileWrite {
        relative_path,
        bytes,
        expectation: WriteExpectation {
            create_only: true,
            ..WriteExpectation::default()
        },
    })
}

fn verify_migration_documents(
    writer: &WorkspaceWriter,
    documents: &[(PathBuf, Value)],
) -> Result<Vec<WriteReceipt>, StorageError> {
    documents
        .iter()
        .map(|(relative, expected)| {
            let (actual, receipt) = writer.read_json(relative)?;
            if actual != *expected {
                return Err(StorageError::WriteConflict);
            }
            Ok(receipt)
        })
        .collect()
}

fn validate_output_path(
    profile: &Value,
    directory: &Path,
    relative: &Path,
    output: &OutputManifestEntry,
) -> Result<(), StorageError> {
    validate_workspace_relative(relative)?;
    if relative.parent() != Some(directory) || relative.extension().and_then(|value| value.to_str()) != Some("md") {
        return Err(StorageError::UnsafePath {
            path: portable(relative),
            reason: "prompt output must stay in its profile directory".to_owned(),
        });
    }
    if !matches!(output.style.as_str(), "classic" | "dark")
        || !matches!(output.part.as_str(), "main" | "negative" | "technical" | "combined")
        || !valid_language(&output.language)
    {
        return Err(StorageError::InvalidVault(
            "unsupported prompt output variant".to_owned(),
        ));
    }
    let folder_name = string_field(profile, "folderName")?;
    let expected = format!(
        "{folder_name}-{}-{}-{}.md",
        output.style, output.language, output.part
    );
    if relative.file_name().and_then(|value| value.to_str()) != Some(expected.as_str()) {
        return Err(StorageError::UnsafePath {
            path: portable(relative),
            reason: "prompt output filename does not match its manifest tuple".to_owned(),
        });
    }
    Ok(())
}

fn validate_prompt_profile(value: &Value) -> Result<(), StorageError> {
    validate_v3_document(value, "vaultPromptProfile", "id")?;
    require_object(value, "answers")?;
    require_object(value, "wizard")?;
    require_object(value, "outputSelection")?;
    require_object(value, "outputs")?;
    profile_directory(value)?;
    output_manifest(value)?;
    let status = string_field(value, "status")?;
    if !matches!(status.as_str(), "incomplete" | "ready") {
        return Err(StorageError::InvalidVault("invalid prompt profile status".to_owned()));
    }
    if status == "ready" && value.get("baseProfileId").and_then(Value::as_str).is_none() {
        return Err(StorageError::InvalidVault(
            "a ready profile requires the vault base profile".to_owned(),
        ));
    }
    Ok(())
}

fn profile_directory(value: &Value) -> Result<PathBuf, StorageError> {
    let category = string_field(value, "category")?;
    let subtype = string_field(value, "subtype")?;
    let folder_name = string_field(value, "folderName")?;
    validate_single_segment(&folder_name)?;
    let category_folder = category_folder(&category)?;
    let subtype_folder = subtype_folder(&category, &subtype)?;
    let result = Path::new(PROMPT_VAULT_DIR)
        .join(category_folder)
        .join(subtype_folder)
        .join(folder_name);
    validate_workspace_relative(&result)?;
    Ok(result)
}

fn category_folder(category: &str) -> Result<&'static str, StorageError> {
    match category {
        "character" => Ok("Charakter"),
        "movingObject" => Ok("Bewegliches-Objekt"),
        "staticObject" => Ok("Statisches-Objekt"),
        "texture" => Ok("Textur"),
        "nature" => Ok("Natur"),
        "building" => Ok("Gebaeude"),
        "tileset" => Ok("Tileset"),
        "item" => Ok("Item"),
        "artwork" => Ok("Artwork"),
        _ => Err(StorageError::InvalidVault("unknown prompt category".to_owned())),
    }
}

fn subtype_folder(category: &str, subtype: &str) -> Result<String, StorageError> {
    let supported: &[&str] = match category {
        "character" => &["hero", "npc", "merchant", "villager", "artisan", "guard", "scholar", "religiousFigure", "enemy", "boss", "animal", "creature"],
        "movingObject" => &["cart", "rollingObject", "floatingObject", "floatingCrystal", "slidingObject", "mechanicalConstruct", "boat", "platform", "magicObject", "nonHumanoidUnit"],
        "staticObject" => &["furniture", "container", "barrel", "crate", "chest", "door", "well", "sign", "pillar", "altar", "decoration", "workTool", "interactiveObject"],
        "texture" => &["wood", "stone", "snow", "ice", "earth", "sand", "grass", "moss", "metal", "fabric", "leather", "brick", "paving", "clay", "ceramic", "customMaterial"],
        "nature" => &["tree", "deciduousTree", "conifer", "witheredTree", "magicTree", "bush", "grassTuft", "mushroom", "root", "treeStump", "vine"],
        "building" => &["house", "hut", "shop", "workshop", "inn", "tower", "gate", "temple", "ruin", "fortification", "dungeonModule"],
        "tileset" => &["groundTile", "wallTile", "roofPart", "transition", "corner", "edge", "autotile", "decal", "animatedTile"],
        "item" => &["sword", "potion", "weapon", "tool", "clothing", "armorPiece", "bag", "jewelry", "consumable", "keyItem", "questItem", "collectible"],
        "artwork" => &["concept", "characterConcept", "environmentConcept", "buildingConcept", "materialStudy", "scene", "promoArtwork", "moodPainting"],
        _ => return Err(StorageError::InvalidVault("unknown prompt category".to_owned())),
    };
    if !supported.contains(&subtype) {
        return Err(StorageError::InvalidVault(
            "prompt subtype does not belong to its category".to_owned(),
        ));
    }
    let folder = match subtype {
        "npc" => "NPC",
        "hero" => "Held",
        "boss" => "Boss",
        "cart" => "Wagen",
        "boat" => "Boot",
        "mechanicalConstruct" => "Mechanik",
        "crate" => "Kiste",
        "well" => "Brunnen",
        "altar" => "Altar",
        "wood" => "Holz",
        "stone" => "Stein",
        "snow" => "Schnee",
        "tree" => "Baum",
        "mushroom" => "Pilz",
        "root" => "Wurzel",
        "house" => "Haus",
        "tower" => "Turm",
        "temple" => "Tempel",
        "groundTile" => "Boden",
        "wallTile" => "Wand",
        "autotile" => "Autotile",
        "sword" => "Schwert",
        "potion" => "Trank",
        "tool" => "Werkzeug",
        "concept" => "Konzept",
        "scene" => "Szene",
        "promoArtwork" => "Promo",
        other => other,
    };
    Ok(folder.to_owned())
}

fn validate_v3_document(value: &Value, kind: &str, id_field: &str) -> Result<(), StorageError> {
    let object = value.as_object().ok_or_else(|| {
        StorageError::InvalidVault("prompt document must be an object".to_owned())
    })?;
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(3) {
        return Err(StorageError::FutureSchemaProtected {
            found: object.get("schemaVersion").and_then(Value::as_u64).unwrap_or(0),
            supported: 3,
        });
    }
    if object.get("kind").and_then(Value::as_str) != Some(kind) {
        return Err(StorageError::InvalidVault(format!(
            "expected prompt document kind {kind}"
        )));
    }
    validate_id(&string_field(value, id_field)?)?;
    if revision(value) == 0 {
        return Err(StorageError::InvalidVault(
            "prompt document revision must be positive".to_owned(),
        ));
    }
    Ok(())
}

fn validate_id(value: &str) -> Result<(), StorageError> {
    let valid = (3..=128).contains(&value.len())
        && value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'_' | b'-'))
        });
    if valid {
        Ok(())
    } else {
        Err(StorageError::InvalidVault("invalid stable prompt ID".to_owned()))
    }
}

fn validate_single_segment(value: &str) -> Result<(), StorageError> {
    let path = Path::new(value);
    if value.is_empty()
        || value.len() > 120
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err(StorageError::UnsafePath {
            path: value.to_owned(),
            reason: "profile folder must be one portable segment".to_owned(),
        });
    }
    validate_workspace_relative(path)
}

fn require_object<'a>(value: &'a Value, field: &str) -> Result<&'a serde_json::Map<String, Value>, StorageError> {
    value.get(field).and_then(Value::as_object).ok_or_else(|| {
        StorageError::InvalidVault(format!("prompt document {field} must be an object"))
    })
}

fn string_field(value: &Value, field: &str) -> Result<String, StorageError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| StorageError::InvalidVault(format!("prompt document needs {field}")))
}

fn revision(value: &Value) -> u64 {
    value.get("revision").and_then(Value::as_u64).unwrap_or(0)
}

fn valid_language(value: &str) -> bool {
    let bytes = value.as_bytes();
    (bytes.len() == 2 && bytes.iter().all(u8::is_ascii_lowercase))
        || (bytes.len() == 5
            && bytes[0..2].iter().all(u8::is_ascii_lowercase)
            && bytes[2] == b'-'
            && bytes[3..5].iter().all(u8::is_ascii_uppercase))
}

fn validate_sha256(value: &str) -> Result<(), StorageError> {
    if value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(StorageError::InvalidVault("invalid SHA-256 digest".to_owned()))
    }
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn detect_duplicate_profile_ids(index: &mut PromptVaultIndex) {
    let mut first_paths = HashMap::<String, String>::new();
    for profile in &index.profiles {
        let Some(id) = profile.value.get("id").and_then(Value::as_str) else {
            continue;
        };
        if let Some(first) = first_paths.insert(id.to_owned(), profile.relative_path.clone()) {
            index.issues.push(PromptVaultIssue {
                code: "duplicate_profile_id".to_owned(),
                relative_path: profile.relative_path.clone(),
                message: format!("Profile ID {id} also exists at {first}."),
            });
        }
    }
}

fn issue(code: &str, path: &Path, message: &str) -> PromptVaultIssue {
    PromptVaultIssue {
        code: code.to_owned(),
        relative_path: portable(path),
        message: message.to_owned(),
    }
}

fn portable(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::ensure_workspace;
    use serde_json::json;
    use tempfile::TempDir;

    fn repository() -> (TempDir, PromptVaultRepository) {
        let directory = TempDir::new().unwrap();
        let root = VaultRoot::open(directory.path()).unwrap();
        ensure_workspace(&root, "vault-one").unwrap();
        (directory, PromptVaultRepository::new(root))
    }

    #[test]
    fn base_profile_is_a_single_cas_path() {
        let (_directory, repository) = repository();
        let first = json!({
            "schemaVersion": 3,
            "kind": "vaultBaseProfile",
            "id": "base-one",
            "revision": 1,
            "values": {},
            "locks": {}
        });
        let receipt = repository.save_base_profile(first, None).unwrap();
        let second = json!({
            "schemaVersion": 3,
            "kind": "vaultBaseProfile",
            "id": "base-one",
            "revision": 2,
            "values": {},
            "locks": {}
        });
        assert!(repository
            .save_base_profile(second.clone(), Some("0".repeat(64)))
            .is_err());
        repository
            .save_base_profile(second, Some(receipt.sha256))
            .unwrap();
        assert_eq!(repository.scan().unwrap().base_profile.unwrap().revision, 2);
    }

    #[test]
    fn raw_drafts_survive_without_a_valid_identity() {
        let (_directory, repository) = repository();
        repository
            .save_draft(
                json!({
                    "schemaVersion": 3,
                    "kind": "vaultPromptDraft",
                    "draftId": "draft-one",
                    "profileId": null,
                    "revision": 1,
                    "identity": {"name": "", "category": null, "subtype": null},
                    "rawValues": {"unfinished": true},
                    "wizard": {"currentStepId": "identity", "completedStepIds": []}
                }),
                None,
            )
            .unwrap();
        let index = repository.scan().unwrap();
        assert_eq!(index.drafts.len(), 1);
        assert!(index.profiles.is_empty());
    }

    #[test]
    fn derives_normative_profile_path_and_rejects_a_foreign_collision() {
        let (directory, repository) = repository();
        let profile = json!({
            "schemaVersion": 3,
            "kind": "vaultPromptProfile",
            "id": "profile-kleif",
            "revision": 1,
            "draftRevision": 1,
            "name": "Kleif",
            "folderName": "Kleif",
            "category": "character",
            "subtype": "hero",
            "baseProfileId": null,
            "catalogVersion": "v3.0",
            "status": "incomplete",
            "answers": {},
            "wizard": {"currentStepId": "identity", "completedStepIds": []},
            "outputSelection": {"styles": ["classic"], "languages": ["de"]},
            "outputs": {"status": "none", "generatedFrom": null, "files": []}
        });
        repository.save_profile_without_outputs(profile.clone(), None).unwrap();
        assert!(directory
            .path()
            .join(".PixelPrompt/Charakter/Held/Kleif/Kleif-profile.json")
            .is_file());
        let mut collision = profile;
        collision["id"] = Value::String("profile-other".to_owned());
        assert!(repository.save_profile_without_outputs(collision, None).is_err());
    }

    #[test]
    fn relocates_a_stable_profile_id_when_its_identity_path_changes() {
        let (directory, repository) = repository();
        let original = json!({
            "schemaVersion": 3,
            "kind": "vaultPromptProfile",
            "id": "profile-moving",
            "revision": 1,
            "draftRevision": 1,
            "name": "Kleif",
            "folderName": "Kleif",
            "category": "character",
            "subtype": "hero",
            "baseProfileId": null,
            "catalogVersion": "v3.0",
            "status": "incomplete",
            "answers": {},
            "wizard": {"currentStepId": "identity", "completedStepIds": []},
            "outputSelection": {"styles": ["classic"], "languages": ["de"]},
            "outputs": {"status": "none", "generatedFrom": null, "files": []}
        });
        let first = repository
            .save_profile_without_outputs(original, None)
            .unwrap();
        let moved = json!({
            "schemaVersion": 3,
            "kind": "vaultPromptProfile",
            "id": "profile-moving",
            "revision": 2,
            "draftRevision": 2,
            "name": "Werkzeug",
            "folderName": "Werkzeug",
            "category": "item",
            "subtype": "tool",
            "baseProfileId": null,
            "catalogVersion": "v3.0",
            "status": "incomplete",
            "answers": {},
            "wizard": {"currentStepId": "identity", "completedStepIds": []},
            "outputSelection": {"styles": ["classic"], "languages": ["de"]},
            "outputs": {"status": "none", "generatedFrom": null, "files": []}
        });
        repository
            .save_profile_without_outputs(moved, Some(first.sha256))
            .unwrap();
        assert!(!directory
            .path()
            .join(".PixelPrompt/Charakter/Held/Kleif/Kleif-profile.json")
            .exists());
        assert!(directory
            .path()
            .join(".PixelPrompt/Item/Werkzeug/Werkzeug/Werkzeug-profile.json")
            .is_file());
        let index = repository.scan().unwrap();
        assert_eq!(index.profiles.len(), 1);
        assert_eq!(index.profiles[0].value["id"], "profile-moving");
    }

    #[test]
    fn confirmed_migration_is_journaled_verified_and_idempotent() {
        let (directory, repository) = repository();
        let source_snapshot = json!({"profiles": ["legacy-profile"], "version": 2});
        let source_hash = digest(&serde_json::to_vec(&source_snapshot).unwrap());
        let base = json!({
            "schemaVersion": 3,
            "kind": "vaultBaseProfile",
            "id": "base-legacy",
            "revision": 1,
            "values": {},
            "locks": {}
        });
        let profile = json!({
            "schemaVersion": 3,
            "kind": "vaultPromptProfile",
            "id": "profile-legacy",
            "revision": 1,
            "draftRevision": 1,
            "name": "Kleif",
            "folderName": "Kleif",
            "category": "character",
            "subtype": "hero",
            "baseProfileId": "base-legacy",
            "catalogVersion": "v3.0",
            "status": "ready",
            "answers": {},
            "wizard": {"currentStepId": "review", "completedStepIds": []},
            "outputSelection": {"styles": ["classic"], "languages": ["de"]},
            "outputs": {"status": "none", "generatedFrom": null, "files": []}
        });
        let profile_path = ".PixelPrompt/Charakter/Held/Kleif/Kleif-profile.json";
        let bundle = PromptVaultMigrationBundle {
            schema_version: 1,
            kind: "promptVaultMigration".to_owned(),
            migration_id: format!("migration-{source_hash}"),
            source_id: "native-app-data-v2".to_owned(),
            source_hash: source_hash.clone(),
            source_snapshot: source_snapshot.clone(),
            mappings: vec![
                LegacySourceMapping {
                    source_kind: "baseProfile".to_owned(),
                    source_id: "base-legacy".to_owned(),
                    target_id: "base-legacy".to_owned(),
                    target_path: BASE_PROFILE_PATH.to_owned(),
                },
                LegacySourceMapping {
                    source_kind: "assetProfile".to_owned(),
                    source_id: "profile-legacy".to_owned(),
                    target_id: "profile-legacy".to_owned(),
                    target_path: profile_path.to_owned(),
                },
            ],
            base_profile: Some(base),
            profiles: vec![profile],
            draft: None,
            created_at: "2026-09-09T12:00:00Z".to_owned(),
        };
        repository.apply_migration(bundle.clone()).unwrap();
        let repeated = repository.apply_migration(bundle.clone()).unwrap();
        assert_eq!(repeated.len(), 3);
        let marker = directory
            .path()
            .join(format!(".PixelPrompt/.migration/{source_hash}.json"));
        let stored: Value = serde_json::from_slice(&fs::read(marker).unwrap()).unwrap();
        assert_eq!(stored["sourceSnapshot"], source_snapshot);

        fs::write(directory.path().join(profile_path), b"{\"external\":true}").unwrap();
        assert!(matches!(
            repository.apply_migration(bundle),
            Err(StorageError::WriteConflict) | Err(StorageError::InvalidVault(_))
        ));
    }
}
