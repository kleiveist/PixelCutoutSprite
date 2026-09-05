use std::path::{Path, PathBuf};

use crate::domain::{
    portable_name_key, validate_portable_display_name, ActionKey, AnimationBinding, Appearance,
    Character, CharacterStatus, DocumentKind, DomainDocument, ObjectId, OutfitDraft,
    OutfitDraftStatus, ReviewState, UtcTimestamp, SCHEMA_VERSION,
};
use crate::storage::{object_folder, JsonStore, TransactionPurpose, VaultRoot, VersionStamp};

use super::appearance_service::{
    appearance_from_draft, now, AppearanceServiceError, SaveNpcRequest, SavedNpc,
};
use super::outfit_apply::{publish, replacement, write_plan};
use super::outfit_snapshot::{validate_project_labels, AreaSnapshot};

struct ValidatedSave {
    draft: OutfitDraft,
    draft_path: PathBuf,
    draft_stamp: VersionStamp,
    action_key: ActionKey,
    timestamp: UtcTimestamp,
}

struct NpcDocuments {
    character: Character,
    appearance: Appearance,
    binding: AnimationBinding,
}

struct SaveLayout {
    final_dir: PathBuf,
    staging_root: PathBuf,
    backup_root: PathBuf,
    binding_folder: PathBuf,
    project_path: PathBuf,
    transaction_id: ObjectId,
}

pub(super) fn save_as_npc(
    vault: &VaultRoot,
    area_path: &Path,
    draft_id: ObjectId,
    expected_revision: u32,
    expected_sha256: Option<&str>,
    request: SaveNpcRequest,
) -> Result<SavedNpc, AppearanceServiceError> {
    let input = validate_save(
        vault,
        area_path,
        draft_id,
        expected_revision,
        expected_sha256,
        &request,
    )?;
    let documents = build_documents(&input, request)?;
    let layout = SaveLayout::new(area_path, &documents)?;
    let assigned = assigned_draft(
        &input.draft,
        documents.character.id,
        documents.appearance.id,
        input.timestamp,
    )?;
    publish_npc(vault, &layout, &documents, &input, &assigned)?;
    Ok(SavedNpc {
        character: documents.character,
        appearance: documents.appearance,
        binding: documents.binding,
        draft: assigned,
        character_folder: layout.final_dir.to_string_lossy().replace('\\', "/"),
    })
}

fn validate_save(
    vault: &VaultRoot,
    area_path: &Path,
    draft_id: ObjectId,
    expected_revision: u32,
    expected_sha256: Option<&str>,
    request: &SaveNpcRequest,
) -> Result<ValidatedSave, AppearanceServiceError> {
    validate_portable_display_name("npc.name", &request.name)?;
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    snapshot.require_draft(draft_id)?;
    let draft_path = snapshot
        .draft_paths
        .get(&draft_id)
        .cloned()
        .ok_or_else(|| {
            AppearanceServiceError::InvalidState("outfit draft path is missing".to_owned())
        })?;
    let loaded = JsonStore::default().load(&vault.resolve(&draft_path)?)?;
    if expected_sha256.is_some_and(|expected| expected != loaded.stamp.sha256) {
        return Err(AppearanceServiceError::Storage(
            crate::storage::StorageError::WriteConflict,
        ));
    }
    let DomainDocument::OutfitDraft(draft) = loaded.value else {
        return Err(AppearanceServiceError::InvalidState(
            "outfit path contains the wrong document kind".to_owned(),
        ));
    };
    if draft.id != draft_id {
        return Err(AppearanceServiceError::InvalidState(
            "outfit draft identity does not match its path".to_owned(),
        ));
    }
    if draft.revision != expected_revision {
        return Err(AppearanceServiceError::RevisionConflict {
            expected: expected_revision,
            found: draft.revision,
        });
    }
    if draft.status != OutfitDraftStatus::InProgress {
        return Err(AppearanceServiceError::InvalidState(
            "only an in-progress outfit draft can create an NPC".to_owned(),
        ));
    }
    if draft.character_id.is_some() {
        return Err(AppearanceServiceError::InvalidState(
            "this draft explicitly targets an existing NPC and cannot silently create another"
                .to_owned(),
        ));
    }
    let name_key = portable_name_key(&request.name);
    if snapshot
        .characters
        .iter()
        .any(|character| portable_name_key(&character.name) == name_key)
    {
        return Err(AppearanceServiceError::InvalidState(
            "an NPC with the same portable name already exists in this area".to_owned(),
        ));
    }
    validate_project_labels(vault, snapshot.area.project_id, &request.label_ids)?;
    snapshot.validate_draft_references(&draft)?;
    snapshot.validate_equipment_references(
        &draft.equipment,
        draft.profile_ref,
        draft.template_ref,
        true,
    )?;
    let action_key = snapshot.workflow(draft.template_ref)?.0.action_key.clone();
    Ok(ValidatedSave {
        draft,
        draft_path,
        draft_stamp: loaded.stamp,
        action_key,
        timestamp: now()?,
    })
}

fn build_documents(
    input: &ValidatedSave,
    request: SaveNpcRequest,
) -> Result<NpcDocuments, AppearanceServiceError> {
    let character_id = ObjectId::new();
    let appearance_id = ObjectId::new();
    let appearance =
        appearance_from_draft(&input.draft, character_id, appearance_id, input.timestamp)?;
    let binding = AnimationBinding {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::AnimationBinding,
        id: ObjectId::new(),
        revision: 1,
        character_id,
        action_key: input.action_key.clone(),
        template_ref: input.draft.template_ref,
        appearance_id,
        local_overrides: input
            .draft
            .local_overrides
            .iter()
            .map(|item| crate::domain::LocalOverride {
                slot_id: item.slot_id.clone(),
                direction: item.direction,
                transform: item.transform,
            })
            .collect(),
        review_state: ReviewState::Draft,
        created_at: input.timestamp,
        updated_at: input.timestamp,
    };
    let character = Character {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Character,
        id: character_id,
        revision: 1,
        area_id: input.draft.area_id,
        name: request.name,
        description: request.description,
        status: CharacterStatus::Draft,
        profile_ref: input.draft.profile_ref,
        default_appearance_id: appearance_id,
        label_ids: request.label_ids,
        required_actions: vec![input.action_key.clone()],
        created_at: input.timestamp,
        updated_at: input.timestamp,
    };
    character.validate()?;
    appearance.validate()?;
    binding.validate()?;
    Ok(NpcDocuments {
        character,
        appearance,
        binding,
    })
}

impl SaveLayout {
    fn new(area_path: &Path, documents: &NpcDocuments) -> Result<Self, AppearanceServiceError> {
        let character_folder = object_folder(&documents.character.name, documents.character.id)?;
        let final_dir = area_path.join(&character_folder);
        let transaction_id = ObjectId::new();
        let binding_folder =
            object_folder(documents.binding.action_key.as_str(), documents.binding.id)?;
        let project_path = area_path.parent().ok_or_else(|| {
            AppearanceServiceError::InvalidState(
                "area path must be nested directly inside a project".to_owned(),
            )
        })?;
        let transaction_root = project_path
            .join(".project/transactions")
            .join(format!("{transaction_id}.stage"));
        Ok(Self {
            final_dir,
            staging_root: transaction_root,
            backup_root: project_path
                .join(".project/backups")
                .join(format!("outfit-save--{transaction_id}")),
            binding_folder,
            project_path: project_path.to_path_buf(),
            transaction_id,
        })
    }
}

fn publish_npc(
    vault: &VaultRoot,
    layout: &SaveLayout,
    documents: &NpcDocuments,
    input: &ValidatedSave,
    assigned: &OutfitDraft,
) -> Result<(), AppearanceServiceError> {
    if vault.resolve(&layout.final_dir)?.as_path().exists() {
        return Err(AppearanceServiceError::InvalidState(
            "the generated NPC folder unexpectedly already exists".to_owned(),
        ));
    }
    let plans = vec![
        write_plan(
            &layout.final_dir.join("character.json"),
            &layout.staging_root.join("character.json"),
            None,
            None,
            DomainDocument::Character(documents.character.clone()),
        )?,
        write_plan(
            &layout.final_dir.join("appearances/default.json"),
            &layout.staging_root.join("appearance.json"),
            None,
            None,
            DomainDocument::Appearance(documents.appearance.clone()),
        )?,
        write_plan(
            &layout
                .final_dir
                .join(&layout.binding_folder)
                .join("binding.json"),
            &layout.staging_root.join("binding.json"),
            None,
            None,
            DomainDocument::AnimationBinding(documents.binding.clone()),
        )?,
        replacement(
            &input.draft_path,
            &layout.staging_root.join("draft.json"),
            &layout.backup_root.join("draft.json"),
            input.draft_stamp.clone(),
            DomainDocument::OutfitDraft(assigned.clone()),
        )?,
    ];
    publish(
        vault,
        &layout.project_path,
        TransactionPurpose::General,
        layout.transaction_id,
        &plans,
    )?;
    Ok(())
}

fn assigned_draft(
    draft: &OutfitDraft,
    character_id: ObjectId,
    appearance_id: ObjectId,
    timestamp: UtcTimestamp,
) -> Result<OutfitDraft, AppearanceServiceError> {
    let mut assigned = draft.clone();
    assigned.revision = assigned.revision.checked_add(1).ok_or_else(|| {
        AppearanceServiceError::InvalidState("outfit revision overflow".to_owned())
    })?;
    assigned.character_id = Some(character_id);
    assigned.appearance_id = Some(appearance_id);
    assigned.status = OutfitDraftStatus::Assigned;
    assigned.updated_at = timestamp;
    assigned.validate()?;
    Ok(assigned)
}
