use super::*;
use crate::workspace::ensure_workspace;
use serde_json::json;
use tempfile::TempDir;

fn fixture() -> (
    TempDir,
    PromptVaultRepository,
    Value,
    Vec<GeneratedOutputWrite>,
    WriteReceipt,
) {
    let directory = TempDir::new().unwrap();
    let root = VaultRoot::open(directory.path()).unwrap();
    ensure_workspace(&root, "vault-p35").unwrap();
    let repository = PromptVaultRepository::new(root);
    repository
        .save_base_profile(
            json!({
                "schemaVersion": 3, "kind": "vaultBaseProfile", "id": "base-p35", "revision": 1,
                "values": {}, "locks": {}
            }),
            None,
        )
        .unwrap();
    let mut profile = json!({
        "schemaVersion": 3, "kind": "vaultPromptProfile", "id": "profile-p35", "revision": 1,
        "draftRevision": 1, "name": "Kleif", "folderName": "Kleif", "category": "character",
        "subtype": "hero", "baseProfileId": "base-p35", "catalogVersion": "v3.0", "status": "ready",
        "answers": {"role": "guardian"}, "wizard": {"currentStepId": "review", "completedStepIds": ["identity", "review"]},
        "outputSelection": {"styles": ["classic", "dark"], "languages": ["de", "en"]},
        "outputs": {"status": "none", "generatedFrom": null, "files": []}
    });
    let saved = repository
        .save_profile_without_outputs(profile.clone(), None)
        .unwrap();
    let mut outputs = Vec::new();
    let mut files = Vec::new();
    for style in ["classic", "dark"] {
        for language in ["de", "en"] {
            for part in ["main", "negative", "technical", "combined"] {
                let path =
                    format!(".PixelPrompt/Charakter/Held/Kleif/Kleif-{style}-{language}-{part}.md");
                let contents = format!("Persisted {style} {language} {part}\n");
                files.push(json!({"relativePath": path, "style": style, "language": language, "part": part, "sha256": digest(contents.as_bytes())}));
                outputs.push(GeneratedOutputWrite {
                    relative_path: path,
                    contents,
                });
            }
        }
    }
    profile["revision"] = json!(2);
    profile["outputs"] = json!({
        "status": "fresh", "generatedFrom": {"draftRevision": 1, "baseRevision": 1, "generatorVersion": "prompt-engine-v2/vault-envelope-v3"}, "files": files
    });
    let receipts = repository
        .save_profile_generation(profile.clone(), outputs.clone(), Some(saved.sha256))
        .unwrap();
    let receipt = receipts
        .into_iter()
        .find(|receipt| receipt.revision == Some(2))
        .unwrap();
    (directory, repository, profile, outputs, receipt)
}

#[test]
fn reads_all_sixteen_persisted_parts_after_reopening_without_an_index() {
    let (directory, _, profile, outputs, receipt) = fixture();
    let reopened = PromptVaultRepository::new(VaultRoot::open(directory.path()).unwrap());
    assert_eq!(reopened.scan().unwrap().profiles.len(), 1);
    let read = reopened
        .read_generation("profile-p35", &receipt.sha256)
        .unwrap();
    assert_eq!(read.profile.value, profile);
    assert_eq!(read.outputs.len(), 16);
    for (actual, expected) in read.outputs.iter().zip(outputs) {
        assert_eq!(actual.relative_path, expected.relative_path);
        assert_eq!(actual.contents, expected.contents);
    }
    assert!(read.fresh);
}

#[test]
fn modified_or_missing_markdown_and_stale_profile_receipts_are_rejected() {
    let (directory, repository, _, outputs, receipt) = fixture();
    assert!(repository
        .read_generation("profile-p35", &"0".repeat(64))
        .is_err());
    let path = directory.path().join(&outputs[0].relative_path);
    fs::write(&path, "external change").unwrap();
    assert!(repository
        .read_generation("profile-p35", &receipt.sha256)
        .is_err());
    fs::remove_file(path).unwrap();
    assert!(repository
        .read_generation("profile-p35", &receipt.sha256)
        .is_err());
}

#[test]
fn an_updated_base_makes_the_same_saved_generation_stale() {
    let (_directory, repository, _, _, receipt) = fixture();
    let current = repository.scan().unwrap().base_profile.unwrap();
    let mut updated = current.value;
    updated["revision"] = json!(2);
    repository
        .save_base_profile(updated, Some(current.sha256))
        .unwrap();
    let read = repository
        .read_generation("profile-p35", &receipt.sha256)
        .unwrap();
    assert!(!read.fresh);
    assert_eq!(read.base_revision, Some(2));
    assert_eq!(read.outputs.len(), 16);
}

#[test]
fn corrupt_profiles_are_isolated_and_duplicate_ids_cannot_be_loaded() {
    let (directory, repository, profile, _, receipt) = fixture();
    let parent = directory.path().join(".PixelPrompt/Charakter/Held/Bad");
    fs::create_dir(&parent).unwrap();
    fs::write(parent.join("Bad-profile.json"), "{broken").unwrap();
    let index = repository.scan().unwrap();
    assert_eq!(index.profiles.len(), 1);
    assert!(index
        .issues
        .iter()
        .any(|issue| issue.code == "unreadable_document"));
    fs::write(
        parent.join("Bad-profile.json"),
        serde_json::to_vec(&profile).unwrap(),
    )
    .unwrap();
    assert!(repository
        .scan()
        .unwrap()
        .issues
        .iter()
        .any(|issue| issue.code == "duplicate_profile_id"));
    assert!(repository
        .read_generation("profile-p35", &receipt.sha256)
        .is_err());
}

#[cfg(unix)]
#[test]
fn symlinked_outputs_and_foreign_manifest_paths_are_not_read() {
    use std::os::unix::fs::symlink;
    let (directory, repository, mut profile, outputs, receipt) = fixture();
    let foreign = TempDir::new().unwrap();
    fs::write(foreign.path().join("private.md"), &outputs[0].contents).unwrap();
    let path = directory.path().join(&outputs[0].relative_path);
    fs::remove_file(&path).unwrap();
    symlink(foreign.path().join("private.md"), path).unwrap();
    assert!(repository
        .read_generation("profile-p35", &receipt.sha256)
        .is_err());
    profile["outputs"]["files"][0]["relativePath"] = json!("../private.md");
    profile["revision"] = json!(3);
    assert!(repository
        .save_profile_generation(profile, outputs, Some(receipt.sha256))
        .is_err());
}
