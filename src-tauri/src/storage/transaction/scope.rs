const MAX_JOURNAL_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Deserialize)]
struct StoredHeader {
    schema_version: u64,
}

#[derive(Deserialize)]
struct OwnerIdentityHeader {
    schema_version: u64,
    kind: DocumentKind,
    id: ObjectId,
}

fn validate_new_project_folder(project_folder: &Path) -> Result<RelativePath, StorageError> {
    let relative = portable_relative(project_folder)?;
    let mut components = project_folder.components();
    let one_component = components
        .next()
        .is_some_and(|part| matches!(part, std::path::Component::Normal(_)))
        && components.next().is_none();
    if one_component && !relative.as_str().starts_with('.') {
        Ok(relative)
    } else {
        Err(StorageError::InvalidVault(
            "transaction owner must be one project directory directly below the vault".to_owned(),
        ))
    }
}

const PROJECT_CREATE_PREFIX: &str = ".creating-project--";
const PROJECT_CREATE_ROLLBACK_PREFIX: &str = "rolled-back-project-create--";

fn validate_journal_owner_folder(project_folder: &Path) -> Result<RelativePath, StorageError> {
    if project_folder == Path::new(super::ADMIN_DIR) {
        return reserved_managed_relative(project_folder);
    }
    validate_new_project_folder(project_folder).or_else(|_| {
        let relative = portable_relative(project_folder)?;
        if parse_project_create_owner(Path::new(relative.as_str())).is_some() {
            Ok(relative)
        } else {
            Err(StorageError::InvalidVault(
                "transaction owner must be a project or a sealed project-creation staging directory"
                    .to_owned(),
            ))
        }
    })
}

fn validate_transaction_owner(
    project_folder: &Path,
    purpose: TransactionPurpose,
    id: ObjectId,
) -> Result<RelativePath, StorageError> {
    match purpose {
        TransactionPurpose::WorkspaceLabelRemove => {
            if project_folder == Path::new(super::ADMIN_DIR) {
                reserved_managed_relative(project_folder)
            } else {
                Err(StorageError::InvalidVault(format!(
                    "workspace label removal owner must be `{}`",
                    super::ADMIN_DIR
                )))
            }
        }
        TransactionPurpose::ProjectCreate => {
            let owner = validate_journal_owner_folder(project_folder)?;
            if parse_project_create_owner(Path::new(owner.as_str())) == Some(id) {
                Ok(owner)
            } else {
                Err(StorageError::InvalidVault(format!(
                    "project-creation owner must be `{PROJECT_CREATE_PREFIX}{id}`"
                )))
            }
        }
        _ => validate_new_project_folder(project_folder),
    }
}

fn journal_path_for_owner(owner: &Path, id: ObjectId) -> Result<RelativePath, StorageError> {
    let transaction_directory = if owner == Path::new(super::ADMIN_DIR) {
        owner.join("transactions")
    } else {
        owner.join(".project/transactions")
    };
    let location = transaction_directory.join(format!("{id}.json"));
    if owner == Path::new(super::ADMIN_DIR) {
        reserved_managed_relative(&location)
    } else {
        portable_relative(&location)
    }
}

fn parse_project_create_owner(owner: &Path) -> Option<ObjectId> {
    let mut components = owner.components();
    let name = match (components.next(), components.next()) {
        (Some(std::path::Component::Normal(name)), None) => name.to_str()?,
        _ => return None,
    };
    ObjectId::parse(
        "project_create_transaction_id",
        name.strip_prefix(PROJECT_CREATE_PREFIX)?,
    )
    .ok()
}

fn project_create_rollback_owner(id: ObjectId) -> PathBuf {
    Path::new(".trash").join(format!("{PROJECT_CREATE_ROLLBACK_PREFIX}{id}"))
}

fn read_initial_owner_id(
    root: &VaultRoot,
    owner: &Path,
    journal: &TransactionJournal,
) -> Result<ObjectId, StorageError> {
    if journal.purpose == TransactionPurpose::WorkspaceLabelRemove {
        return read_owner_id_path(
            &root.resolve(&owner.join("vault.json"))?,
            DocumentKind::Vault,
        );
    }
    let manifest = root.resolve(&owner.join(".project/project.json"))?;
    if manifest.as_path().exists() {
        return read_owner_id_path(&manifest, DocumentKind::Project);
    }
    let project_target = owner.join(".project/project.json");
    let creation = journal
        .steps
        .iter()
        .find(|step| {
            step.action == TransactionAction::Create
                && Path::new(step.target.as_str()) == project_target
        })
        .ok_or_else(|| {
            StorageError::RecoveryRequired(
                "new project transaction must stage its project identity".to_owned(),
            )
        })?;
    read_owner_id_path(
        &root.resolve(Path::new(creation.staged.as_str()))?,
        DocumentKind::Project,
    )
}

fn read_owner_id_path(
    manifest: &ResolvedPath,
    expected_kind: DocumentKind,
) -> Result<ObjectId, StorageError> {
    let metadata = fs::symlink_metadata(manifest.as_path()).map_err(|error| {
        StorageError::io(
            "inspect transaction owner project",
            manifest.relative(),
            error,
        )
    })?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_JOURNAL_BYTES
    {
        return Err(StorageError::RecoveryRequired(
            "transaction owner project manifest is not a bounded regular file".to_owned(),
        ));
    }
    let bytes = fs::read(manifest.as_path()).map_err(|error| {
        StorageError::io("read transaction owner project", manifest.relative(), error)
    })?;
    let header: OwnerIdentityHeader = serde_json::from_slice(&bytes).map_err(|error| {
        StorageError::InvalidVault(format!(
            "invalid transaction owner identity header: {error}"
        ))
    })?;
    if header.kind != expected_kind {
        return Err(StorageError::InvalidVault(
            "transaction owner manifest has the wrong document kind".to_owned(),
        ));
    }
    let _ = header.schema_version;
    Ok(header.id)
}

fn verify_recovery_project_identity(
    root: &VaultRoot,
    original_owner: &Path,
    current_owner: &Path,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    let expected = match journal.owner_project_id {
        Some(id) => id,
        None if !journal.is_sealed() => return Ok(()),
        None => {
            return Err(StorageError::RecoveryRequired(
                "sealed transaction journal has no project identity".to_owned(),
            ));
        }
    };
    if journal.purpose == TransactionPurpose::WorkspaceLabelRemove {
        if original_owner != Path::new(super::ADMIN_DIR)
            || current_owner != Path::new(super::ADMIN_DIR)
        {
            return Err(StorageError::RecoveryRequired(
                "workspace transaction journal moved outside the vault administration owner"
                    .to_owned(),
            ));
        }
        let manifest = root.resolve(Path::new(super::ADMIN_DIR).join("vault.json").as_path())?;
        if read_owner_id_path(&manifest, DocumentKind::Vault)? == expected {
            return Ok(());
        }
        return Err(StorageError::RecoveryRequired(
            "workspace transaction journal belongs to a different vault identity".to_owned(),
        ));
    }
    let current_manifest = current_owner.join(".project/project.json");
    let resolved_manifest = root.resolve(&current_manifest)?;
    match fs::symlink_metadata(resolved_manifest.as_path()) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            return Err(StorageError::RecoveryRequired(
                "transaction owner project manifest is not a regular file".to_owned(),
            ));
        }
        Ok(_) => {
            if read_owner_id_path(&resolved_manifest, DocumentKind::Project)? == expected {
                return Ok(());
            }
            return Err(StorageError::RecoveryRequired(
                "transaction journal belongs to a different project identity".to_owned(),
            ));
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(StorageError::io(
                "inspect transaction owner identity",
                resolved_manifest.relative(),
                error,
            ));
        }
    }

    let project_target = original_owner.join(".project/project.json");
    let identity_step = journal
        .steps
        .iter()
        .find(|step| {
            matches!(
                step.action,
                TransactionAction::Create | TransactionAction::Replace
            ) && Path::new(step.target.as_str()) == project_target
        })
        .ok_or_else(|| {
            StorageError::RecoveryRequired(
                "project manifest is missing outside a declared create or replacement window"
                    .to_owned(),
            )
        })?;
    let mut identity_evidence = 0;
    for candidate in [
        Some(Path::new(identity_step.staged.as_str())),
        identity_step
            .backup
            .as_ref()
            .map(|backup| Path::new(backup.as_str())),
    ]
    .into_iter()
    .flatten()
    {
        let candidate = remap_owned_path(candidate, original_owner, current_owner)?;
        let resolved = root.resolve(&candidate)?;
        if !resolved.as_path().exists() {
            continue;
        }
        if read_owner_id_path(&resolved, DocumentKind::Project)? != expected {
            return Err(StorageError::RecoveryRequired(
                "project replacement evidence has a different project identity".to_owned(),
            ));
        }
        identity_evidence += 1;
    }
    if identity_evidence == 0 {
        return Err(StorageError::RecoveryRequired(
            "missing project manifest has no trusted replacement evidence".to_owned(),
        ));
    }
    Ok(())
}

fn journal_owner(location: &Path) -> Result<PathBuf, StorageError> {
    let components = location.components().collect::<Vec<_>>();
    if location
        .extension()
        .is_none_or(|extension| extension != "json")
    {
        return Err(StorageError::InvalidVault(
            "transaction journals must use the JSON extension".to_owned(),
        ));
    }
    if components.len() == 3
        && components[0].as_os_str() == super::ADMIN_DIR
        && components[1].as_os_str() == "transactions"
    {
        return Ok(PathBuf::from(super::ADMIN_DIR));
    }
    if components.len() < 4
        || components[components.len() - 2].as_os_str() != "transactions"
        || components[components.len() - 3].as_os_str() != ".project"
    {
        return Err(StorageError::InvalidVault(
            "transaction journals must be direct children of the workspace or project transaction directory"
                .to_owned(),
        ));
    }
    let mut owner = PathBuf::new();
    for component in &components[..components.len() - 3] {
        owner.push(component.as_os_str());
    }
    if owner.as_os_str().is_empty() {
        return Err(StorageError::InvalidVault(
            "transaction journal has no owning project".to_owned(),
        ));
    }
    Ok(owner)
}

fn original_owner<'a>(current_owner: &'a Path, journal: &'a TransactionJournal) -> &'a Path {
    journal
        .steps
        .iter()
        .find(|step| allowed_project_move(Path::new(step.staged.as_str()), journal.purpose, step))
        .map_or(current_owner, |step| Path::new(step.staged.as_str()))
}

fn validate_project_scope(
    original_owner: &Path,
    current_owner: &Path,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    if journal.purpose == TransactionPurpose::WorkspaceLabelRemove {
        return validate_workspace_label_remove_scope(original_owner, current_owner, journal);
    }
    match journal.purpose {
        TransactionPurpose::ProjectCreate => {
            if parse_project_create_owner(original_owner) != Some(journal.id)
                || journal.steps.len() != 1
            {
                return Err(StorageError::InvalidVault(
                    "project creation requires its transaction-named staging owner and one move"
                        .to_owned(),
                ));
            }
        }
        _ if parse_project_create_owner(original_owner).is_some() => {
            return Err(StorageError::InvalidVault(
                "a project-creation staging owner requires the project_create purpose".to_owned(),
            ));
        }
        _ => {}
    }
    let rollback_owner = project_create_rollback_owner(journal.id);
    let current_is_valid = current_owner == original_owner
        || journal.steps.iter().any(|step| {
            allowed_project_move(original_owner, journal.purpose, step)
                && current_owner == Path::new(step.target.as_str())
        })
        || (journal.purpose == TransactionPurpose::ProjectCreate
            && matches!(
                journal.state,
                TransactionState::RollingBack | TransactionState::RolledBack
            )
            && current_owner == rollback_owner);
    if !current_is_valid {
        return Err(StorageError::RecoveryRequired(
            "journal location no longer matches its project move plan".to_owned(),
        ));
    }
    let transaction_prefix = original_owner.join(".project/transactions");
    let backup_prefix = original_owner.join(".project/backups");
    let mut project_move_seen = false;
    for (index, step) in journal.steps.iter().enumerate() {
        let target = Path::new(step.target.as_str());
        let staged = Path::new(step.staged.as_str());
        let project_move = allowed_project_move(original_owner, journal.purpose, step);
        if project_move {
            if project_move_seen || index + 1 != journal.steps.len() {
                return Err(StorageError::InvalidVault(
                    "a project move must be the transaction's unique final step".to_owned(),
                ));
            }
            project_move_seen = true;
        } else if step.action == TransactionAction::Move
            && (staged == original_owner || target.components().count() == 1)
        {
            return Err(StorageError::InvalidVault(
                "whole-project moves require the dedicated rename or trash purpose".to_owned(),
            ));
        }
        if !path_is_owned(staged, original_owner) {
            return Err(StorageError::InvalidVault(
                "transaction source escaped its owning project".to_owned(),
            ));
        }
        if matches!(
            step.action,
            TransactionAction::Create | TransactionAction::Replace
        ) && !staged.starts_with(&transaction_prefix)
        {
            return Err(StorageError::InvalidVault(
                "created and replacement stages must remain in project transactions".to_owned(),
            ));
        }
        if !path_is_owned(target, original_owner) && !project_move {
            return Err(StorageError::InvalidVault(
                "transaction target escaped its owning project".to_owned(),
            ));
        }
        if !project_move
            && (target.starts_with(&transaction_prefix) || target.starts_with(&backup_prefix))
        {
            return Err(StorageError::InvalidVault(
                "transaction results cannot publish into recovery administration".to_owned(),
            ));
        }
        if let Some(backup) = &step.backup {
            let backup = Path::new(backup.as_str());
            if !backup.starts_with(&backup_prefix) || backup == backup_prefix {
                return Err(StorageError::InvalidVault(
                    "transaction backup escaped its owning project backup directory".to_owned(),
                ));
            }
        }
    }
    if project_move_seen
        && journal.steps[..journal.steps.len() - 1]
            .iter()
            .any(|step| step.action != TransactionAction::Replace)
    {
        return Err(StorageError::InvalidVault(
            "steps before a whole-project move must be in-place replacements".to_owned(),
        ));
    }
    Ok(())
}

fn validate_workspace_label_remove_scope(
    original_owner: &Path,
    current_owner: &Path,
    journal: &TransactionJournal,
) -> Result<(), StorageError> {
    let admin = Path::new(super::ADMIN_DIR);
    if original_owner != admin || current_owner != admin {
        return Err(StorageError::InvalidVault(
            "workspace label removal must stay in the vault administration owner".to_owned(),
        ));
    }
    let global_stage_prefix = admin
        .join("transactions")
        .join(format!("{}.stage", journal.id));
    let global_backup_prefix = admin
        .join("backups/transactions")
        .join(journal.id.to_string());
    let labels = admin.join("labels.json");
    let view = admin.join("ui.json");
    let mut labels_seen = false;
    for step in &journal.steps {
        if step.action != TransactionAction::Replace {
            return Err(StorageError::InvalidVault(
                "workspace label removal supports replacement steps only".to_owned(),
            ));
        }
        let target = Path::new(step.target.as_str());
        labels_seen |= target == labels;
        let project_owner = project_manifest_owner(target);
        if target != labels && target != view && project_owner.is_none() {
            return Err(StorageError::InvalidVault(format!(
                "workspace label removal cannot replace `{}`",
                step.target
            )));
        }
        let (stage_prefix, backup_prefix) = if let Some(project_owner) = project_owner {
            (
                project_owner
                    .join(".project/transactions")
                    .join(format!("{}.stage", journal.id)),
                project_owner
                    .join(".project/backups/workspace-label-removals")
                    .join(journal.id.to_string()),
            )
        } else {
            (global_stage_prefix.clone(), global_backup_prefix.clone())
        };
        let staged = Path::new(step.staged.as_str());
        if !staged.starts_with(&stage_prefix) || staged == stage_prefix {
            return Err(StorageError::InvalidVault(
                "workspace label stages must remain in their transaction-named staging directory"
                    .to_owned(),
            ));
        }
        let backup = Path::new(
            step.backup
                .as_ref()
                .expect("workspace replacement backup was validated")
                .as_str(),
        );
        if !backup.starts_with(&backup_prefix) || backup == backup_prefix {
            return Err(StorageError::InvalidVault(
                "workspace label backups must remain in their transaction-named backup directory"
                    .to_owned(),
            ));
        }
    }
    if !labels_seen {
        return Err(StorageError::InvalidVault(
            "workspace label removal must replace the workspace label catalog".to_owned(),
        ));
    }
    Ok(())
}

fn project_manifest_owner(target: &Path) -> Option<PathBuf> {
    let components = target.components().collect::<Vec<_>>();
    if components.len() != 3
        || components[1].as_os_str() != ".project"
        || components[2].as_os_str() != "project.json"
    {
        return None;
    }
    let project = PathBuf::from(components[0].as_os_str());
    validate_new_project_folder(&project)
        .is_ok()
        .then_some(project)
}

fn path_is_owned(path: &Path, owner: &Path) -> bool {
    path == owner || path.starts_with(owner)
}

fn allowed_project_move(owner: &Path, purpose: TransactionPurpose, step: &TransactionStep) -> bool {
    if step.action != TransactionAction::Move || Path::new(step.staged.as_str()) != owner {
        return false;
    }
    let target = Path::new(step.target.as_str());
    match purpose {
        TransactionPurpose::ProjectCreate => {
            parse_project_create_owner(owner).is_some()
                && target != owner
                && validate_new_project_folder(target).is_ok()
        }
        TransactionPurpose::ProjectRename => {
            target.parent() == owner.parent()
                && target != owner
                && validate_new_project_folder(target).is_ok()
        }
        TransactionPurpose::TrashMove => {
            target.parent() == Some(Path::new(".trash")) && target.file_name() == owner.file_name()
        }
        _ => false,
    }
}

fn collect_journal_locations(root: &VaultRoot) -> Result<Vec<PathBuf>, StorageError> {
    let mut owners = Vec::new();
    let mut root_entries = read_sorted_directory(root.path(), "scan vault transaction owners")?;
    for entry in root_entries.drain(..) {
        let kind = entry.file_type().map_err(|error| {
            StorageError::io("inspect vault transaction owner", &entry.path(), error)
        })?;
        if kind.is_symlink() || !kind.is_dir() {
            continue;
        }
        if entry.file_name() == ".trash" {
            for trashed in read_sorted_directory(&entry.path(), "scan trashed projects")? {
                let trashed_kind = trashed.file_type().map_err(|error| {
                    StorageError::io("inspect trashed project", &trashed.path(), error)
                })?;
                if trashed_kind.is_dir() && !trashed_kind.is_symlink() {
                    owners.push(trashed.path());
                }
            }
        } else if entry.file_name() != super::ADMIN_DIR {
            owners.push(entry.path());
        }
    }
    let mut journals = Vec::new();
    collect_journals_from_directory(
        root,
        &root.path().join(super::ADMIN_DIR).join("transactions"),
        &mut journals,
    )?;
    for owner in owners {
        let manifest = owner.join(".project/project.json");
        match fs::symlink_metadata(&manifest) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err(StorageError::UnsafePath {
                    path: manifest
                        .strip_prefix(root.path())
                        .unwrap_or(&manifest)
                        .to_string_lossy()
                        .into_owned(),
                    reason: "project manifest must be a regular file".to_owned(),
                });
            }
            Ok(_) => {}
            // A process can stop after a replacement target was moved to its backup but before
            // the staged file was published. The fixed transaction directory must remain
            // discoverable even while project.json is temporarily absent.
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(StorageError::io(
                    "inspect project transaction owner",
                    &manifest,
                    error,
                ));
            }
        }
        let directory = owner.join(".project/transactions");
        collect_journals_from_directory(root, &directory, &mut journals)?;
    }
    journals.sort();
    Ok(journals)
}

fn collect_journals_from_directory(
    root: &VaultRoot,
    directory: &Path,
    journals: &mut Vec<PathBuf>,
) -> Result<(), StorageError> {
    match fs::symlink_metadata(directory) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(StorageError::UnsafePath {
                path: directory
                    .strip_prefix(root.path())
                    .unwrap_or(directory)
                    .to_string_lossy()
                    .into_owned(),
                reason: "transaction location must be a real directory".to_owned(),
            });
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(StorageError::io(
                "inspect transaction directory",
                directory,
                error,
            ));
        }
    }
    for entry in read_sorted_directory(directory, "scan transaction journals")? {
        let path = entry.path();
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let kind = entry
            .file_type()
            .map_err(|error| StorageError::io("inspect transaction journal entry", &path, error))?;
        if kind.is_symlink() || !kind.is_file() {
            return Err(StorageError::UnsafePath {
                path: path
                    .strip_prefix(root.path())
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .into_owned(),
                reason: "transaction journal must be a regular file".to_owned(),
            });
        }
        journals.push(
            path.strip_prefix(root.path())
                .map_err(|_| {
                    StorageError::RecoveryRequired(
                        "transaction journal escaped the vault".to_owned(),
                    )
                })?
                .to_path_buf(),
        );
    }
    Ok(())
}

fn read_sorted_directory(
    directory: &Path,
    operation: &'static str,
) -> Result<Vec<fs::DirEntry>, StorageError> {
    let mut entries = fs::read_dir(directory)
        .map_err(|error| StorageError::io(operation, directory, error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| StorageError::io(operation, directory, error))?;
    entries.sort_by_key(fs::DirEntry::file_name);
    Ok(entries)
}

fn read_journal(
    root: &VaultRoot,
    location: &Path,
) -> Result<(TransactionJournal, PathBuf, VersionStamp), StorageError> {
    let location = if location.starts_with(Path::new(super::ADMIN_DIR).join("transactions")) {
        reserved_managed_relative(location)?
    } else {
        portable_relative(location)?
    };
    let current_owner = journal_owner(Path::new(location.as_str()))?;
    let resolved = root.resolve(Path::new(location.as_str()))?;
    let metadata = fs::symlink_metadata(resolved.as_path()).map_err(|error| {
        StorageError::io("inspect transaction journal", resolved.relative(), error)
    })?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_JOURNAL_BYTES
    {
        return Err(StorageError::RecoveryRequired(
            "transaction journal is not a bounded regular file".to_owned(),
        ));
    }
    let bytes = fs::read(resolved.as_path()).map_err(|error| {
        StorageError::io("read transaction journal", resolved.relative(), error)
    })?;
    let header: StoredHeader = serde_json::from_slice(&bytes).map_err(|error| {
        StorageError::InvalidVault(format!("invalid transaction JSON: {error}"))
    })?;
    if header.schema_version > 1 {
        return Err(StorageError::FutureSchemaProtected {
            found: header.schema_version,
            supported: 1,
        });
    }
    let journal: TransactionJournal = serde_json::from_slice(&bytes).map_err(|error| {
        StorageError::InvalidVault(format!("invalid transaction journal: {error}"))
    })?;
    journal.validate()?;
    let expected_name = format!("{}.json", journal.id);
    let actual_name = location.as_str().rsplit('/').next().unwrap_or_default();
    if journal.is_sealed() && actual_name != expected_name {
        return Err(StorageError::RecoveryRequired(
            "sealed transaction journal filename does not match its id".to_owned(),
        ));
    }
    let original = original_owner(&current_owner, &journal);
    validate_project_scope(original, &current_owner, &journal)?;
    if journal.is_sealed() && journal.owner_project_id.is_none() {
        return Err(StorageError::RecoveryRequired(
            "sealed transaction journal has no project identity".to_owned(),
        ));
    }
    verify_recovery_project_identity(root, original, &current_owner, &journal)?;
    Ok((journal, current_owner, VersionStamp::from_bytes(&bytes)))
}

fn locate_open_journal(root: &VaultRoot, id: ObjectId) -> Result<PathBuf, StorageError> {
    let mut found = None;
    for location in collect_journal_locations(root)? {
        let (journal, _, _) = read_journal(root, &location)?;
        if journal.id == id
            && !matches!(
                journal.state,
                TransactionState::Committed | TransactionState::RolledBack
            )
            && found.replace(location).is_some()
        {
            return Err(StorageError::RecoveryRequired(
                "transaction id is ambiguous across project journals".to_owned(),
            ));
        }
    }
    found.ok_or_else(|| {
        StorageError::RecoveryRequired(format!("no open transaction `{id}` was found"))
    })
}

fn journal_bytes(journal: &TransactionJournal) -> Result<Vec<u8>, StorageError> {
    journal.validate()?;
    serde_json::to_vec_pretty(journal)
        .map_err(|error| StorageError::InvalidVault(error.to_string()))
}

fn validate_journal_bytes(bytes: &[u8]) -> Result<(), crate::domain::DomainError> {
    let decoded: TransactionJournal = serde_json::from_slice(bytes)
        .map_err(|error| crate::domain::DomainError::InvalidJson(error.to_string()))?;
    decoded
        .validate()
        .map_err(|error| crate::domain::DomainError::invalid("journal", error.to_string()))
}

fn persist_at(
    root: &VaultRoot,
    location: &Path,
    journal: &TransactionJournal,
    stamp: &mut VersionStamp,
) -> Result<(), StorageError> {
    let resolved = root.resolve(location)?;
    let bytes = journal_bytes(journal)?;
    *stamp = JsonStore::default().compare_and_swap_bytes(
        &resolved,
        stamp,
        &bytes,
        validate_journal_bytes,
    )?;
    Ok(())
}
