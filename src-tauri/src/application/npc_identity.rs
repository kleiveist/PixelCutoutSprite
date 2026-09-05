use std::path::Path;

use crate::domain::{
    portable_name_key, validate_portable_display_name, AnimationBinding, Appearance, Character,
    CharacterStatus, DocumentKind, DomainDocument, ObjectId, RelativePath, ReviewState,
};
use crate::storage::{
    object_folder, JsonStore, TransactionAction, TransactionFault, TransactionPurpose,
    TransactionService, TransactionStep, VaultRoot,
};

use super::appearance_service::{now, AppearanceServiceError};
use super::binding_service::{
    BindingService, DuplicateNpcRequest, DuplicatedNpc, RenameNpcRequest, RenamedNpc,
};
use super::binding_write::{
    check_revision, invalid, next_revision, remove_new_directory, require_character,
};
use super::npc_dashboard::{require_appearance, require_motion, validate_compatibility};
use super::outfit_snapshot::AreaSnapshot;

pub(super) fn duplicate_npc(
    vault: &VaultRoot,
    area_path: &Path,
    request: DuplicateNpcRequest,
) -> Result<DuplicatedNpc, AppearanceServiceError> {
    validate_portable_display_name("npc.name", &request.name)?;
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    ensure_unique_name(&snapshot, &request.name, None)?;
    let source = require_character(&snapshot, request.character_id)?;
    let source_appearance = require_appearance(&snapshot, source)?;
    let source_bindings = snapshot
        .bindings
        .iter()
        .filter(|binding| binding.character_id == source.id)
        .collect::<Vec<_>>();
    if source_bindings
        .iter()
        .any(|binding| binding.appearance_id != source_appearance.id)
    {
        return Err(invalid(
            "NPC uses additional appearances; duplicate them explicitly before this operation",
        ));
    }
    let timestamp = now()?;
    let character_id = ObjectId::new();
    let appearance_id = ObjectId::new();
    let character =
        duplicate_character(source, character_id, appearance_id, request.name, timestamp);
    let appearance =
        duplicate_appearance(source_appearance, character_id, appearance_id, timestamp);
    let mut bindings = source_bindings
        .into_iter()
        .map(|binding| duplicate_binding(binding, character_id, appearance_id, timestamp))
        .collect::<Vec<_>>();
    bindings.sort_by(|left, right| left.action_key.as_str().cmp(right.action_key.as_str()));
    character.validate()?;
    appearance.validate()?;
    for binding in &bindings {
        binding.validate()?;
        let motion = require_motion(&snapshot, binding.template_ref)?;
        validate_compatibility(
            &snapshot,
            &character,
            &appearance,
            motion,
            &binding.local_overrides,
        )?;
    }
    let folder = publish_duplicate(vault, area_path, &character, &appearance, &bindings)?;
    Ok(DuplicatedNpc {
        character,
        appearance,
        bindings,
        character_folder: folder,
    })
}

pub(super) fn rename_npc(
    vault: &VaultRoot,
    area_path: &Path,
    request: RenameNpcRequest,
) -> Result<RenamedNpc, AppearanceServiceError> {
    rename_npc_using_transactions(vault, area_path, request, &TransactionService::default())
}

impl BindingService {
    /// Test seam for interrupting the real NPC-rename producer after a filesystem step.
    /// Normal application callers use [`BindingService::rename_npc`].
    #[doc(hidden)]
    pub fn rename_npc_with_transactions<F: TransactionFault>(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: RenameNpcRequest,
        transactions: &TransactionService<F>,
    ) -> Result<RenamedNpc, AppearanceServiceError> {
        rename_npc_using_transactions(vault, area_path, request, transactions)
    }
}

fn rename_npc_using_transactions<F: TransactionFault>(
    vault: &VaultRoot,
    area_path: &Path,
    request: RenameNpcRequest,
    transactions: &TransactionService<F>,
) -> Result<RenamedNpc, AppearanceServiceError> {
    validate_portable_display_name("npc.name", &request.name)?;
    let snapshot = AreaSnapshot::load(vault, area_path)?;
    let current = require_character(&snapshot, request.character_id)?;
    check_revision(current.revision, request.expected_revision)?;
    if current.name == request.name {
        return Err(invalid("new NPC name must differ from the current name"));
    }
    ensure_unique_name(&snapshot, &request.name, Some(current.id))?;
    let character_path = snapshot
        .character_paths
        .get(&current.id)
        .ok_or_else(|| invalid("NPC character path is missing"))?;
    let old_dir = character_path
        .parent()
        .ok_or_else(|| invalid("NPC character path has no parent"))?;
    if old_dir.parent() != Some(area_path) {
        return Err(invalid(
            "NPC folder is not directly contained by the selected area",
        ));
    }
    let new_dir = area_path.join(object_folder(&request.name, current.id)?);
    if new_dir != old_dir && vault.resolve(&new_dir)?.as_path().exists() {
        return Err(invalid("the renamed NPC folder already exists"));
    }

    let resolved = vault.resolve(character_path)?;
    let loaded = JsonStore::default().load(&resolved)?;
    let DomainDocument::Character(mut character) = loaded.value else {
        return Err(invalid("renamed NPC path contains the wrong document kind"));
    };
    if character.id != current.id {
        return Err(invalid("renamed NPC identity changed unexpectedly"));
    }
    check_revision(character.revision, request.expected_revision)?;
    character.revision = next_revision(character.revision, "NPC")?;
    character.name = request.name;
    character.updated_at = now()?;
    character.validate()?;

    let project_path = area_path
        .parent()
        .ok_or_else(|| invalid("area path must be nested directly inside a project"))?;
    let transaction_id = ObjectId::new();
    let stage_root = project_path
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"));
    let staged_character = stage_root.join("character.json");
    let backup = project_path
        .join(".project/backups/npc-renames")
        .join(transaction_id.to_string())
        .join("character.json");
    vault.ensure_directory(&stage_root)?;
    if let Err(error) = JsonStore::default().create(
        &vault.resolve(&staged_character)?,
        &DomainDocument::Character(character.clone()),
    ) {
        remove_new_directory(vault, &stage_root);
        return Err(error.into());
    }
    let mut steps = vec![TransactionStep {
        action: TransactionAction::Replace,
        target: portable(character_path)?,
        staged: portable(&staged_character)?,
        backup: Some(portable(&backup)?),
        expected_sha256: Some(loaded.stamp.sha256),
    }];
    if new_dir != old_dir {
        steps.push(TransactionStep {
            action: TransactionAction::Move,
            target: portable(&new_dir)?,
            staged: portable(old_dir)?,
            backup: None,
            expected_sha256: None,
        });
    }
    if let Err(error) = transactions.prepare(
        vault,
        project_path,
        transaction_id,
        TransactionPurpose::CharacterRename,
        steps,
    ) {
        remove_new_directory(vault, &stage_root);
        return Err(error.into());
    }
    transactions.execute(vault, project_path, transaction_id)?;
    Ok(RenamedNpc {
        character,
        character_folder: new_dir.to_string_lossy().replace('\\', "/"),
    })
}

fn duplicate_character(
    source: &Character,
    id: ObjectId,
    appearance_id: ObjectId,
    name: String,
    timestamp: crate::domain::UtcTimestamp,
) -> Character {
    Character {
        schema_version: source.schema_version,
        kind: DocumentKind::Character,
        id,
        revision: 1,
        area_id: source.area_id,
        name,
        description: source.description.clone(),
        status: CharacterStatus::Draft,
        profile_ref: source.profile_ref,
        default_appearance_id: appearance_id,
        label_ids: source.label_ids.clone(),
        required_actions: source.required_actions.clone(),
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn duplicate_appearance(
    source: &Appearance,
    character_id: ObjectId,
    id: ObjectId,
    timestamp: crate::domain::UtcTimestamp,
) -> Appearance {
    Appearance {
        schema_version: source.schema_version,
        kind: DocumentKind::Appearance,
        id,
        revision: 1,
        character_id,
        profile_ref: source.profile_ref,
        name: source.name.clone(),
        slots: source.slots.clone(),
        asset_fallback_approvals: source.asset_fallback_approvals.clone(),
        equipment: source.equipment.clone(),
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn duplicate_binding(
    source: &AnimationBinding,
    character_id: ObjectId,
    appearance_id: ObjectId,
    timestamp: crate::domain::UtcTimestamp,
) -> AnimationBinding {
    AnimationBinding {
        schema_version: source.schema_version,
        kind: DocumentKind::AnimationBinding,
        id: ObjectId::new(),
        revision: 1,
        character_id,
        action_key: source.action_key.clone(),
        template_ref: source.template_ref,
        appearance_id,
        local_overrides: source.local_overrides.clone(),
        review_state: ReviewState::Draft,
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn publish_duplicate(
    vault: &VaultRoot,
    area_path: &Path,
    character: &Character,
    appearance: &Appearance,
    bindings: &[AnimationBinding],
) -> Result<String, AppearanceServiceError> {
    let folder = object_folder(&character.name, character.id)?;
    let final_dir = area_path.join(&folder);
    let transaction_id = ObjectId::new();
    let project_path = area_path
        .parent()
        .ok_or_else(|| invalid("area path must be nested directly inside a project"))?;
    let staged_dir = project_path
        .join(".project/transactions")
        .join(format!("{transaction_id}.stage"))
        .join("npc");
    if let Err(error) = stage_duplicate(vault, &staged_dir, character, appearance, bindings) {
        remove_new_directory(vault, &staged_dir);
        return Err(error);
    }
    if vault.resolve(&final_dir)?.as_path().exists() {
        remove_new_directory(vault, &staged_dir);
        return Err(invalid("the generated duplicate NPC folder already exists"));
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
        remove_new_directory(vault, &staged_dir);
        return Err(error.into());
    }
    transactions.execute(vault, project_path, transaction_id)?;
    Ok(final_dir.to_string_lossy().replace('\\', "/"))
}

fn stage_duplicate(
    vault: &VaultRoot,
    staged_dir: &Path,
    character: &Character,
    appearance: &Appearance,
    bindings: &[AnimationBinding],
) -> Result<(), AppearanceServiceError> {
    vault.ensure_directory(staged_dir)?;
    vault.ensure_directory(&staged_dir.join("appearances"))?;
    let store = JsonStore::default();
    store.create(
        &vault.resolve(&staged_dir.join("character.json"))?,
        &DomainDocument::Character(character.clone()),
    )?;
    store.create(
        &vault.resolve(&staged_dir.join("appearances/default.json"))?,
        &DomainDocument::Appearance(appearance.clone()),
    )?;
    for binding in bindings {
        let folder = object_folder(binding.action_key.as_str(), binding.id)?;
        vault.ensure_directory(&staged_dir.join(&folder))?;
        store.create(
            &vault.resolve(&staged_dir.join(folder).join("binding.json"))?,
            &DomainDocument::AnimationBinding(binding.clone()),
        )?;
    }
    Ok(())
}

fn ensure_unique_name(
    snapshot: &AreaSnapshot,
    name: &str,
    except: Option<ObjectId>,
) -> Result<(), AppearanceServiceError> {
    let key = portable_name_key(name);
    if snapshot
        .characters
        .iter()
        .any(|character| Some(character.id) != except && portable_name_key(&character.name) == key)
    {
        return Err(invalid(
            "an NPC with the same portable name already exists in this area",
        ));
    }
    Ok(())
}

fn portable(path: &Path) -> Result<RelativePath, AppearanceServiceError> {
    RelativePath::parse(path.to_string_lossy().replace('\\', "/")).map_err(Into::into)
}
