use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::{
    AnimationBinding, CharacterStatus, DocumentKind, DomainDocument, ObjectId, OutfitDraftStatus,
    RelativePath, ReviewState, SCHEMA_VERSION,
};
use crate::storage::{
    object_folder, JsonStore, TransactionAction, TransactionPurpose, TransactionService,
    TransactionStep, VaultRoot, VersionStamp,
};

use super::appearance_service::{appearance_from_draft, now, AppearanceServiceError, SavedNpc};
use super::outfit_snapshot::AreaSnapshot;

pub(super) struct PlannedWrite {
    pub(super) step: TransactionStep,
    pub(super) document: DomainDocument,
}

pub(super) fn apply_to_existing_npc(
    vault: &VaultRoot,
    area_path: &Path,
    draft_id: ObjectId,
    expected_revision: u32,
    expected_sha256: Option<&str>,
) -> Result<SavedNpc, AppearanceServiceError> {
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let draft_path = snapshot
        .draft_paths
        .get(&draft_id)
        .cloned()
        .ok_or_else(|| invalid("outfit draft path is missing"))?;
    let loaded_draft = JsonStore::default().load(&vault.resolve(&draft_path)?)?;
    if expected_sha256.is_some_and(|expected| expected != loaded_draft.stamp.sha256) {
        return Err(AppearanceServiceError::Storage(
            crate::storage::StorageError::WriteConflict,
        ));
    }
    let DomainDocument::OutfitDraft(draft) = loaded_draft.value else {
        return Err(invalid("outfit path contains the wrong document kind"));
    };
    if draft.id != draft_id {
        return Err(invalid("outfit draft identity does not match its path"));
    }
    if draft.revision != expected_revision {
        return Err(AppearanceServiceError::RevisionConflict {
            expected: expected_revision,
            found: draft.revision,
        });
    }
    if draft.status != OutfitDraftStatus::InProgress {
        return Err(invalid("only an in-progress outfit draft can be applied"));
    }
    snapshot.validate_draft_references(&draft)?;
    let character_id = draft
        .character_id
        .ok_or_else(|| invalid("this outfit draft does not target an existing NPC"))?;
    let appearance_id = draft
        .appearance_id
        .ok_or_else(|| invalid("the existing NPC draft has no appearance identity"))?;
    let (_, _, profile) = snapshot.workflow(draft.template_ref)?;
    let timestamp = now()?;

    let character_path = snapshot
        .character_paths
        .get(&character_id)
        .cloned()
        .ok_or_else(|| invalid("NPC character path is missing"))?;
    let loaded_character = JsonStore::default().load(&vault.resolve(&character_path)?)?;
    let DomainDocument::Character(mut character) = loaded_character.value else {
        return Err(invalid("NPC path contains the wrong document kind"));
    };
    if character.id != character_id
        || character.default_appearance_id != appearance_id
        || character.profile_ref != profile.reference()
        || character.status == CharacterStatus::Archived
    {
        return Err(invalid(
            "the selected NPC identity, appearance, status, or profile changed",
        ));
    }
    if draft.base_character_revision != Some(character.revision) {
        return Err(invalid(
            "the NPC changed after this outfit draft started; reopen the workflow before applying",
        ));
    }
    require_baseline_digest(
        draft.base_character_sha256.as_ref(),
        &loaded_character.stamp,
        "NPC",
    )?;

    let appearance_path = snapshot
        .appearance_paths
        .get(&appearance_id)
        .cloned()
        .ok_or_else(|| invalid("NPC appearance path is missing"))?;
    let loaded_appearance = JsonStore::default().load(&vault.resolve(&appearance_path)?)?;
    let DomainDocument::Appearance(current_appearance) = loaded_appearance.value else {
        return Err(invalid("appearance path contains the wrong document kind"));
    };
    if current_appearance.id != appearance_id
        || current_appearance.character_id != character_id
        || current_appearance.profile_ref != draft.profile_ref
    {
        return Err(invalid(
            "the selected NPC appearance changed or is incompatible",
        ));
    }
    if draft.base_appearance_revision != Some(current_appearance.revision) {
        return Err(invalid(
            "the shared appearance changed after this outfit draft started; reopen before applying",
        ));
    }
    require_baseline_digest(
        draft.base_appearance_sha256.as_ref(),
        &loaded_appearance.stamp,
        "shared appearance",
    )?;

    let template = snapshot.workflow(draft.template_ref)?.0;
    let matching_bindings = snapshot
        .bindings
        .iter()
        .filter(|binding| {
            binding.character_id == character_id && binding.action_key == template.action_key
        })
        .collect::<Vec<_>>();
    if matching_bindings.len() > 1 {
        return Err(invalid(
            "the NPC has duplicate bindings for this action; repair the vault before applying",
        ));
    }
    let baseline_binding = match draft.base_binding_ref {
        Some(reference) => {
            let binding = matching_bindings
                .first()
                .copied()
                .filter(|binding| binding.id == reference.id)
                .ok_or_else(|| invalid("the pinned NPC binding no longer exists"))?;
            if binding.revision != reference.revision
                || binding.character_id != character_id
                || binding.action_key != template.action_key
                || binding.template_ref != draft.template_ref
            {
                return Err(invalid(
                    "the NPC binding changed after this outfit draft started; reopen before applying",
                ));
            }
            Some(binding)
        }
        None => {
            if !matching_bindings.is_empty() {
                return Err(invalid(
                    "the NPC received this action after the outfit draft started; reopen before applying",
                ));
            }
            None
        }
    };

    let mut proposed_appearance =
        appearance_from_draft(&draft, character_id, appearance_id, timestamp)?;
    proposed_appearance.name = current_appearance.name.clone();
    proposed_appearance.created_at = current_appearance.created_at;
    let appearance_changed = proposed_appearance.slots != current_appearance.slots
        || proposed_appearance.equipment != current_appearance.equipment
        || proposed_appearance.asset_fallback_approvals
            != current_appearance.asset_fallback_approvals;
    let mut appearance = current_appearance;
    if appearance_changed {
        appearance.slots = proposed_appearance.slots;
        appearance.equipment = proposed_appearance.equipment;
        appearance.asset_fallback_approvals = proposed_appearance.asset_fallback_approvals;
        appearance.revision = next_revision(appearance.revision, "appearance")?;
        appearance.updated_at = timestamp;
        appearance.validate()?;
    }

    let desired_overrides = local_overrides(&draft);
    let (binding, binding_path, binding_stamp, binding_changed) =
        if let Some(current) = baseline_binding {
            let binding_path = snapshot
                .binding_paths
                .get(&current.id)
                .cloned()
                .ok_or_else(|| invalid("NPC binding path is missing"))?;
            let loaded = JsonStore::default().load(&vault.resolve(&binding_path)?)?;
            let DomainDocument::AnimationBinding(mut binding) = loaded.value else {
                return Err(invalid("binding path contains the wrong document kind"));
            };
            if binding.id != current.id
                || binding.revision != current.revision
                || binding.character_id != character_id
                || binding.action_key != template.action_key
                || binding.template_ref != draft.template_ref
                || binding.appearance_id != appearance_id
            {
                return Err(invalid("the selected NPC binding changed while editing"));
            }
            require_baseline_digest(
                draft.base_binding_sha256.as_ref(),
                &loaded.stamp,
                "NPC binding",
            )?;
            let binding_changed = binding.local_overrides != desired_overrides;
            if binding_changed {
                binding.revision = next_revision(binding.revision, "binding")?;
                binding.local_overrides = desired_overrides.clone();
                binding.review_state = ReviewState::Draft;
                binding.updated_at = timestamp;
                binding.validate()?;
            }
            (binding, binding_path, Some(loaded.stamp), binding_changed)
        } else {
            let binding = AnimationBinding {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::AnimationBinding,
                id: ObjectId::new(),
                revision: 1,
                character_id,
                action_key: template.action_key.clone(),
                template_ref: draft.template_ref,
                appearance_id,
                local_overrides: desired_overrides,
                review_state: ReviewState::Draft,
                created_at: timestamp,
                updated_at: timestamp,
            };
            binding.validate()?;
            let character_root = character_path
                .parent()
                .ok_or_else(|| invalid("NPC character path has no parent"))?;
            let folder = object_folder(binding.action_key.as_str(), binding.id)?;
            (
                binding,
                character_root.join(folder).join("binding.json"),
                None,
                true,
            )
        };

    let action_added = if character.required_actions.contains(&template.action_key) {
        false
    } else {
        character.required_actions.push(template.action_key.clone());
        true
    };
    let character_changed = action_added
        || ((appearance_changed || binding_changed)
            && character.status == CharacterStatus::Reviewed);
    if character_changed {
        character.revision = next_revision(character.revision, "NPC")?;
        character.status = CharacterStatus::Draft;
        character.updated_at = timestamp;
        character.validate()?;
    }

    let mut assigned = draft;
    assigned.revision = next_revision(assigned.revision, "outfit draft")?;
    assigned.character_id = Some(character_id);
    assigned.appearance_id = Some(appearance_id);
    assigned.status = OutfitDraftStatus::Assigned;
    assigned.updated_at = timestamp;
    assigned.validate()?;

    let project_path = area_path
        .parent()
        .ok_or_else(|| invalid("area path must be nested directly inside a project"))?;
    let transaction_id = ObjectId::new();
    let transaction_root = project_path
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let backup_root = project_path
        .join(".project/backups")
        .join(format!("outfit-apply--{transaction_id}"));
    let mut plans = Vec::new();
    if character_changed {
        plans.push(replacement(
            &character_path,
            &transaction_root.join("character.json"),
            &backup_root.join("character.json"),
            loaded_character.stamp,
            DomainDocument::Character(character.clone()),
        )?);
    }
    if appearance_changed {
        plans.push(replacement(
            &appearance_path,
            &transaction_root.join("appearance.json"),
            &backup_root.join("appearance.json"),
            loaded_appearance.stamp,
            DomainDocument::Appearance(appearance.clone()),
        )?);
    }
    if binding_changed {
        let binding_backup = binding_stamp
            .as_ref()
            .map(|_| backup_root.join("binding.json"));
        plans.push(write_plan(
            &binding_path,
            &transaction_root.join("binding.json"),
            binding_stamp,
            binding_backup,
            DomainDocument::AnimationBinding(binding.clone()),
        )?);
    }
    plans.push(replacement(
        &draft_path,
        &transaction_root.join("draft.json"),
        &backup_root.join("draft.json"),
        loaded_draft.stamp,
        DomainDocument::OutfitDraft(assigned.clone()),
    )?);
    publish(
        vault,
        project_path,
        TransactionPurpose::General,
        transaction_id,
        &plans,
    )?;

    Ok(SavedNpc {
        character,
        appearance,
        binding,
        draft: assigned,
        character_folder: character_path
            .parent()
            .unwrap_or(&character_path)
            .to_string_lossy()
            .replace('\\', "/"),
    })
}

fn local_overrides(draft: &crate::domain::OutfitDraft) -> Vec<crate::domain::LocalOverride> {
    draft
        .local_overrides
        .iter()
        .map(|item| crate::domain::LocalOverride {
            slot_id: item.slot_id.clone(),
            direction: item.direction,
            transform: item.transform,
        })
        .collect()
}

fn next_revision(revision: u32, object: &str) -> Result<u32, AppearanceServiceError> {
    revision
        .checked_add(1)
        .ok_or_else(|| invalid(format!("{object} revision overflow")))
}

fn require_baseline_digest(
    expected: Option<&crate::domain::Sha256Digest>,
    current: &VersionStamp,
    object: &str,
) -> Result<(), AppearanceServiceError> {
    let expected = expected.ok_or_else(|| {
        invalid(format!(
            "the outfit draft has no pinned {object} content digest"
        ))
    })?;
    if expected.as_str() != current.sha256 {
        return Err(invalid(format!(
            "the {object} content changed after this outfit draft started; reopen before applying"
        )));
    }
    Ok(())
}

pub(super) fn replacement(
    target: &Path,
    staged: &Path,
    backup: &Path,
    stamp: VersionStamp,
    document: DomainDocument,
) -> Result<PlannedWrite, AppearanceServiceError> {
    write_plan(
        target,
        staged,
        Some(stamp),
        Some(backup.to_path_buf()),
        document,
    )
}

pub(super) fn write_plan(
    target: &Path,
    staged: &Path,
    stamp: Option<VersionStamp>,
    backup: Option<PathBuf>,
    document: DomainDocument,
) -> Result<PlannedWrite, AppearanceServiceError> {
    Ok(PlannedWrite {
        step: TransactionStep {
            action: if stamp.is_some() {
                TransactionAction::Replace
            } else {
                TransactionAction::Create
            },
            target: portable(target)?,
            staged: portable(staged)?,
            backup: backup.as_deref().map(portable).transpose()?,
            expected_sha256: stamp.map(|value| value.sha256),
        },
        document,
    })
}

pub(super) fn publish(
    vault: &VaultRoot,
    project_path: &Path,
    purpose: TransactionPurpose,
    transaction_id: ObjectId,
    plans: &[PlannedWrite],
) -> Result<(), AppearanceServiceError> {
    preflight_targets(vault, plans)?;
    let staged_result = (|| {
        for plan in plans {
            let staged = Path::new(plan.step.staged.as_str());
            let parent = staged
                .parent()
                .ok_or_else(|| invalid("staged outfit document has no parent"))?;
            vault.ensure_directory(parent)?;
            JsonStore::default().create(&vault.resolve(staged)?, &plan.document)?;
        }
        preflight(vault, plans)
    })();
    if let Err(error) = staged_result {
        remove_staging(vault, plans)?;
        return Err(error);
    }
    let transactions = TransactionService::default();
    if let Err(error) = transactions.prepare(
        vault,
        project_path,
        transaction_id,
        purpose,
        plans.iter().map(|plan| plan.step.clone()).collect(),
    ) {
        remove_staging(vault, plans)?;
        return Err(error.into());
    }
    transactions.execute(vault, project_path, transaction_id)?;
    Ok(())
}

fn preflight_targets(
    vault: &VaultRoot,
    plans: &[PlannedWrite],
) -> Result<(), AppearanceServiceError> {
    for plan in plans {
        let target = vault.resolve(Path::new(plan.step.target.as_str()))?;
        let staged = vault.resolve(Path::new(plan.step.staged.as_str()))?;
        if staged.as_path().exists() {
            return Err(invalid("outfit transaction staging path already exists"));
        }
        match plan.step.action {
            TransactionAction::Create | TransactionAction::Move => {
                if target.as_path().exists() {
                    return Err(invalid("outfit transaction target already exists"));
                }
            }
            TransactionAction::Replace => verify_replacement(vault, &plan.step, target.as_path())?,
        }
    }
    Ok(())
}

fn preflight(vault: &VaultRoot, plans: &[PlannedWrite]) -> Result<(), AppearanceServiceError> {
    for plan in plans {
        let target = vault.resolve(Path::new(plan.step.target.as_str()))?;
        let staged = vault.resolve(Path::new(plan.step.staged.as_str()))?;
        if !staged.as_path().is_file() {
            return Err(invalid("a staged outfit transaction document is missing"));
        }
        match plan.step.action {
            TransactionAction::Create | TransactionAction::Move => {
                if target.as_path().exists() {
                    return Err(invalid("outfit transaction target already exists"));
                }
            }
            TransactionAction::Replace => verify_replacement(vault, &plan.step, target.as_path())?,
        }
    }
    Ok(())
}

fn verify_replacement(
    vault: &VaultRoot,
    step: &TransactionStep,
    target: &Path,
) -> Result<(), AppearanceServiceError> {
    let expected = step
        .expected_sha256
        .as_deref()
        .ok_or_else(|| invalid("replacement has no expected digest"))?;
    let current = fs::read(target).map_err(|error| {
        invalid(format!(
            "could not verify outfit transaction target: {error}"
        ))
    })?;
    if VersionStamp::from_bytes(&current).sha256 != expected {
        return Err(AppearanceServiceError::Storage(
            crate::storage::StorageError::WriteConflict,
        ));
    }
    let backup = step
        .backup
        .as_ref()
        .ok_or_else(|| invalid("replacement has no backup path"))?;
    if vault
        .resolve(Path::new(backup.as_str()))?
        .as_path()
        .exists()
    {
        return Err(invalid("outfit transaction backup already exists"));
    }
    Ok(())
}

fn remove_staging(vault: &VaultRoot, plans: &[PlannedWrite]) -> Result<(), AppearanceServiceError> {
    let first = plans
        .first()
        .ok_or_else(|| invalid("outfit transaction has no planned writes"))?;
    let staging_root = Path::new(first.step.staged.as_str())
        .parent()
        .ok_or_else(|| invalid("staged outfit document has no parent"))?;
    if plans
        .iter()
        .any(|plan| Path::new(plan.step.staged.as_str()).parent() != Some(staging_root))
    {
        return Err(invalid("outfit transaction staging roots do not match"));
    }
    let resolved = vault.resolve(staging_root)?;
    if resolved.as_path().exists() {
        fs::remove_dir_all(resolved.as_path()).map_err(|error| {
            invalid(format!(
                "could not clean outfit transaction staging: {error}"
            ))
        })?;
    }
    Ok(())
}

fn portable(path: &Path) -> Result<RelativePath, AppearanceServiceError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(Into::into)
}

fn invalid(message: impl Into<String>) -> AppearanceServiceError {
    AppearanceServiceError::InvalidState(message.into())
}
