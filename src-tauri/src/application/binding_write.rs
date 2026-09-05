use std::fs;
use std::path::Path;

use crate::domain::{
    AnimationBinding, Character, CharacterStatus, DirectionMode, DocumentKind, DomainDocument,
    ObjectId, RelativePath, ReviewState, TemplateStatus, SCHEMA_VERSION,
};
use crate::storage::{
    object_folder, JsonStore, TransactionAction, TransactionPurpose, TransactionService,
    TransactionStep, VaultRoot,
};

use super::appearance_service::{now, AppearanceServiceError};
use super::binding_service::{
    AddBindingRequest, AdoptBindingRevisionRequest, ReviewBindingRequest,
    SetCharacterStatusRequest, UpdateBindingOverridesRequest,
};
use super::npc_dashboard::{require_appearance, require_motion, validate_compatibility};
use super::outfit_snapshot::AreaSnapshot;

pub(super) fn add_binding(
    vault: &VaultRoot,
    area_path: &Path,
    request: AddBindingRequest,
) -> Result<AnimationBinding, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let character = require_character(&snapshot, request.character_id)?;
    if character.status == CharacterStatus::Archived {
        return Err(invalid("an archived NPC cannot receive another motion"));
    }
    let appearance = require_appearance(&snapshot, character)?;
    let template = snapshot
        .templates
        .iter()
        .find(|template| template.id == request.template_ref.id)
        .ok_or_else(|| invalid("the requested motion template is missing"))?;
    if template.status != TemplateStatus::Active {
        return Err(invalid(
            "an archived motion template cannot be newly assigned",
        ));
    }
    let action_key = request
        .variant_action_key
        .unwrap_or_else(|| template.action_key.clone());
    if snapshot
        .bindings
        .iter()
        .any(|binding| binding.character_id == character.id && binding.action_key == action_key)
    {
        return Err(invalid(format!(
            "NPC already has an active `{action_key}` binding; variants need a distinct explicit key"
        )));
    }
    let motion = require_motion(&snapshot, request.template_ref)?;
    validate_compatibility(&snapshot, character, appearance, motion, &[])?;
    let timestamp = now()?;
    let binding = AnimationBinding {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::AnimationBinding,
        id: ObjectId::new(),
        revision: 1,
        character_id: character.id,
        action_key,
        template_ref: request.template_ref,
        appearance_id: appearance.id,
        local_overrides: Vec::new(),
        review_state: ReviewState::Draft,
        created_at: timestamp,
        updated_at: timestamp,
    };
    binding.validate()?;
    publish_binding(vault, area_path, &snapshot, &binding)?;
    Ok(binding)
}

pub(super) fn update_local_overrides(
    vault: &VaultRoot,
    area_path: &Path,
    request: UpdateBindingOverridesRequest,
) -> Result<AnimationBinding, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let current = require_binding(&snapshot, request.binding_id)?;
    check_revision(current.revision, request.expected_revision)?;
    let character = require_character(&snapshot, current.character_id)?;
    let appearance = require_appearance(&snapshot, character)?;
    if current.appearance_id != appearance.id {
        return Err(invalid(
            "binding does not use the NPC default appearance and cannot be edited here",
        ));
    }
    let motion = require_motion(&snapshot, current.template_ref)?;
    validate_compatibility(
        &snapshot,
        character,
        appearance,
        motion,
        &request.local_overrides,
    )?;
    mutate_binding(
        vault,
        &snapshot,
        current,
        request.expected_revision,
        |binding| {
            binding.local_overrides = request.local_overrides;
            binding.review_state = ReviewState::Draft;
            Ok(())
        },
    )
}

pub(super) fn adopt_revision(
    vault: &VaultRoot,
    area_path: &Path,
    request: AdoptBindingRevisionRequest,
) -> Result<AnimationBinding, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let current = require_binding(&snapshot, request.binding_id)?;
    check_revision(current.revision, request.expected_revision)?;
    if request.template_ref.id != current.template_ref.id
        || request.template_ref.revision <= current.template_ref.revision
    {
        return Err(invalid(
            "revision adoption must choose a newer released revision of the same template",
        ));
    }
    let character = require_character(&snapshot, current.character_id)?;
    let appearance = require_appearance(&snapshot, character)?;
    let motion = require_motion(&snapshot, request.template_ref)?;
    validate_compatibility(
        &snapshot,
        character,
        appearance,
        motion,
        &current.local_overrides,
    )?;
    mutate_binding(
        vault,
        &snapshot,
        current,
        request.expected_revision,
        |binding| {
            binding.template_ref = request.template_ref;
            binding.review_state = ReviewState::Draft;
            Ok(())
        },
    )
}

pub(super) fn review_binding(
    vault: &VaultRoot,
    area_path: &Path,
    request: ReviewBindingRequest,
) -> Result<AnimationBinding, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let current = require_binding(&snapshot, request.binding_id)?;
    check_revision(current.revision, request.expected_revision)?;
    let character = require_character(&snapshot, current.character_id)?;
    let appearance = require_appearance(&snapshot, character)?;
    let motion = require_motion(&snapshot, current.template_ref)?;
    validate_compatibility(
        &snapshot,
        character,
        appearance,
        motion,
        &current.local_overrides,
    )?;
    if motion
        .directions
        .iter()
        .any(|direction| direction.mode == DirectionMode::Missing)
    {
        return Err(invalid(
            "binding review requires usable motion coverage in all eight directions",
        ));
    }
    mutate_binding(
        vault,
        &snapshot,
        current,
        request.expected_revision,
        |binding| {
            if !binding
                .review_state
                .can_transition_to(ReviewState::Reviewed)
            {
                return Err(invalid("binding review transition is not allowed"));
            }
            binding.review_state = ReviewState::Reviewed;
            Ok(())
        },
    )
}

pub(super) fn set_character_status(
    vault: &VaultRoot,
    area_path: &Path,
    request: SetCharacterStatusRequest,
) -> Result<Character, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let current = require_character(&snapshot, request.character_id)?;
    check_revision(current.revision, request.expected_revision)?;
    if !current.status.can_transition_to(request.status) {
        return Err(invalid("NPC status transition is not allowed"));
    }
    if request.status == CharacterStatus::Reviewed {
        ensure_character_reviewable(&snapshot, current)?;
    }
    let path = snapshot
        .character_paths
        .get(&current.id)
        .ok_or_else(|| invalid("NPC character path is missing"))?;
    let resolved = vault.resolve(path)?;
    let loaded = JsonStore::default().load(&resolved)?;
    let DomainDocument::Character(mut persisted) = loaded.value else {
        return Err(invalid("NPC path contains the wrong document kind"));
    };
    check_revision(persisted.revision, request.expected_revision)?;
    persisted.revision = next_revision(persisted.revision, "NPC")?;
    persisted.status = request.status;
    persisted.updated_at = now()?;
    persisted.validate()?;
    JsonStore::default().compare_and_swap(
        &resolved,
        &loaded.stamp,
        &DomainDocument::Character(persisted.clone()),
    )?;
    Ok(persisted)
}

fn ensure_character_reviewable(
    snapshot: &AreaSnapshot,
    character: &Character,
) -> Result<(), AppearanceServiceError> {
    let bindings = snapshot
        .bindings
        .iter()
        .filter(|binding| binding.character_id == character.id)
        .collect::<Vec<_>>();
    let missing = character.required_actions.iter().any(|required| {
        !bindings
            .iter()
            .any(|binding| binding.action_key == *required)
    });
    if missing {
        return Err(invalid(
            "NPC cannot be reviewed while a required action is missing",
        ));
    }
    if bindings.is_empty()
        || bindings
            .iter()
            .any(|binding| binding.review_state != ReviewState::Reviewed)
    {
        return Err(invalid(
            "NPC review requires every active motion binding to be reviewed",
        ));
    }
    Ok(())
}

fn mutate_binding<F>(
    vault: &VaultRoot,
    snapshot: &AreaSnapshot,
    current: &AnimationBinding,
    expected_revision: u32,
    change: F,
) -> Result<AnimationBinding, AppearanceServiceError>
where
    F: FnOnce(&mut AnimationBinding) -> Result<(), AppearanceServiceError>,
{
    let path = snapshot
        .binding_paths
        .get(&current.id)
        .ok_or_else(|| invalid("binding path is missing"))?;
    let resolved = vault.resolve(path)?;
    let loaded = JsonStore::default().load(&resolved)?;
    let DomainDocument::AnimationBinding(mut persisted) = loaded.value else {
        return Err(invalid("binding path contains the wrong document kind"));
    };
    check_revision(persisted.revision, expected_revision)?;
    if persisted.id != current.id {
        return Err(invalid("binding identity changed while editing"));
    }
    change(&mut persisted)?;
    persisted.revision = next_revision(persisted.revision, "binding")?;
    persisted.updated_at = now()?;
    persisted.validate()?;
    JsonStore::default().compare_and_swap(
        &resolved,
        &loaded.stamp,
        &DomainDocument::AnimationBinding(persisted.clone()),
    )?;
    Ok(persisted)
}

fn publish_binding(
    vault: &VaultRoot,
    area_path: &Path,
    snapshot: &AreaSnapshot,
    binding: &AnimationBinding,
) -> Result<(), AppearanceServiceError> {
    let character_path = snapshot
        .character_paths
        .get(&binding.character_id)
        .ok_or_else(|| invalid("NPC character path is missing"))?;
    let character_root = character_path
        .parent()
        .ok_or_else(|| invalid("NPC character path has no parent"))?;
    let folder = object_folder(binding.action_key.as_str(), binding.id)?;
    let final_dir = character_root.join(&folder);
    if vault.resolve(&final_dir)?.as_path().exists() {
        return Err(invalid("the generated binding folder already exists"));
    }
    let project_path = area_path
        .parent()
        .ok_or_else(|| invalid("area path must be nested directly inside a project"))?;
    let transaction_id = ObjectId::new();
    let staged_dir = project_path
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"))
        .join("binding");
    let staged = (|| {
        vault.ensure_directory(&staged_dir)?;
        JsonStore::default().create(
            &vault.resolve(&staged_dir.join("binding.json"))?,
            &DomainDocument::AnimationBinding(binding.clone()),
        )?;
        Ok::<_, AppearanceServiceError>(())
    })();
    if let Err(error) = staged {
        remove_new_directory(
            vault,
            &project_path
                .join(".project/transactions")
                .join(format!("{transaction_id}.stage")),
        );
        return Err(error);
    }
    let transactions = TransactionService::default();
    if let Err(error) = transactions.prepare(
        vault,
        project_path,
        transaction_id,
        TransactionPurpose::General,
        vec![TransactionStep {
            action: TransactionAction::Create,
            target: portable(&final_dir)?,
            staged: portable(&staged_dir)?,
            backup: None,
            expected_sha256: None,
        }],
    ) {
        remove_new_directory(
            vault,
            &project_path
                .join(".project/transactions")
                .join(format!("{transaction_id}.stage")),
        );
        return Err(error.into());
    }
    transactions.execute(vault, project_path, transaction_id)?;
    Ok(())
}

pub(super) fn remove_new_directory(vault: &VaultRoot, relative: &Path) {
    if let Ok(path) = vault.resolve(relative) {
        let _ = fs::remove_dir_all(path.as_path());
    }
}

fn portable(path: &Path) -> Result<RelativePath, AppearanceServiceError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(Into::into)
}

pub(super) fn require_character(
    snapshot: &AreaSnapshot,
    id: ObjectId,
) -> Result<&Character, AppearanceServiceError> {
    snapshot
        .characters
        .iter()
        .find(|character| character.id == id)
        .ok_or_else(|| invalid("the selected NPC does not exist in this area"))
}

pub(super) fn require_binding(
    snapshot: &AreaSnapshot,
    id: ObjectId,
) -> Result<&AnimationBinding, AppearanceServiceError> {
    snapshot
        .bindings
        .iter()
        .find(|binding| binding.id == id)
        .ok_or_else(|| invalid("the selected binding does not exist in this area"))
}

pub(super) fn check_revision(found: u32, expected: u32) -> Result<(), AppearanceServiceError> {
    if found != expected {
        return Err(AppearanceServiceError::RevisionConflict { expected, found });
    }
    Ok(())
}

pub(super) fn next_revision(revision: u32, object: &str) -> Result<u32, AppearanceServiceError> {
    revision
        .checked_add(1)
        .ok_or_else(|| invalid(format!("{object} revision overflow")))
}

pub(super) fn invalid(message: impl Into<String>) -> AppearanceServiceError {
    AppearanceServiceError::InvalidState(message.into())
}
