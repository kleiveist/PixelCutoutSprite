use std::collections::{HashMap, HashSet};

use super::{
    AnimationBinding, Appearance, Area, Asset, AssetRevision, Character, DomainDocument,
    DomainError, ExportManifest, Label, LabelScope, MotionRevision, MotionTemplate, ObjectId,
    OutfitDraft, ProfileRevision, Project, RevisionRef, Vault,
};

#[derive(Debug, Clone, Default)]
pub struct DomainCatalog {
    pub vaults: Vec<Vault>,
    pub labels: Vec<Label>,
    pub projects: Vec<Project>,
    pub areas: Vec<Area>,
    pub profiles: Vec<ProfileRevision>,
    pub templates: Vec<MotionTemplate>,
    pub motions: Vec<MotionRevision>,
    pub assets: Vec<Asset>,
    pub asset_revisions: Vec<AssetRevision>,
    pub outfit_drafts: Vec<OutfitDraft>,
    pub characters: Vec<Character>,
    pub appearances: Vec<Appearance>,
    pub bindings: Vec<AnimationBinding>,
    pub exports: Vec<ExportManifest>,
}

impl DomainCatalog {
    pub fn from_documents(documents: Vec<DomainDocument>) -> Self {
        let mut catalog = Self::default();
        for document in documents {
            catalog.push(document);
        }
        catalog
    }

    pub fn push(&mut self, document: DomainDocument) {
        match document {
            DomainDocument::Vault(value) => self.vaults.push(value),
            DomainDocument::Label(value) => self.labels.push(value),
            DomainDocument::Project(value) => self.projects.push(value),
            DomainDocument::Area(value) => self.areas.push(value),
            DomainDocument::ProfileRevision(value) => self.profiles.push(value),
            DomainDocument::MotionTemplate(value) => self.templates.push(value),
            DomainDocument::MotionRevision(value) => self.motions.push(value),
            DomainDocument::Asset(value) => self.assets.push(value),
            DomainDocument::AssetRevision(value) => self.asset_revisions.push(value),
            DomainDocument::OutfitDraft(value) => self.outfit_drafts.push(value),
            DomainDocument::Character(value) => self.characters.push(value),
            DomainDocument::Appearance(value) => self.appearances.push(value),
            DomainDocument::AnimationBinding(value) => self.bindings.push(value),
            DomainDocument::ExportManifest(value) => self.exports.push(value),
        }
    }

    pub fn validate(&self) -> Result<(), DomainError> {
        self.validate_local_documents()?;
        self.validate_unique_identities()?;
        let index = CatalogIndex::new(self)?;
        self.validate_workspace_references(&index)?;
        self.validate_motion_references(&index)?;
        self.validate_asset_references(&index)?;
        self.validate_character_references(&index)?;
        self.validate_export_references(&index)
    }

    fn validate_local_documents(&self) -> Result<(), DomainError> {
        if self.vaults.len() != 1 {
            return Err(DomainError::invalid(
                "catalog.vaults",
                "must contain exactly one vault manifest",
            ));
        }
        validate_each(&self.vaults, Vault::validate)?;
        validate_each(&self.labels, Label::validate)?;
        validate_each(&self.projects, Project::validate)?;
        validate_each(&self.areas, Area::validate)?;
        validate_each(&self.profiles, ProfileRevision::validate)?;
        validate_each(&self.templates, MotionTemplate::validate)?;
        validate_each(&self.motions, |value| value.validate(None))?;
        validate_each(&self.assets, Asset::validate)?;
        validate_each(&self.asset_revisions, AssetRevision::validate)?;
        validate_each(&self.outfit_drafts, OutfitDraft::validate)?;
        validate_each(&self.characters, Character::validate)?;
        validate_each(&self.appearances, Appearance::validate)?;
        validate_each(&self.bindings, AnimationBinding::validate)?;
        validate_each(&self.exports, ExportManifest::validate)?;
        Ok(())
    }

    fn validate_unique_identities(&self) -> Result<(), DomainError> {
        let mut ids = HashSet::new();
        for (kind, id) in self.root_identities() {
            if !ids.insert(id) {
                return Err(DomainError::DuplicateId(format!("{kind}:{id}")));
            }
        }
        let mut profiles = HashSet::new();
        for profile in &self.profiles {
            if !profiles.insert(profile.reference()) {
                return Err(DomainError::DuplicateId(format!(
                    "profile_revision:{}:{}",
                    profile.profile_id, profile.revision
                )));
            }
        }
        let mut motions = HashSet::new();
        for motion in &self.motions {
            if !motions.insert(motion.reference()) {
                return Err(DomainError::DuplicateId(format!(
                    "motion_revision:{}:{}",
                    motion.template_id, motion.revision
                )));
            }
        }
        let mut asset_revisions = HashSet::new();
        for revision in &self.asset_revisions {
            if !asset_revisions.insert(revision.reference()) {
                return Err(DomainError::DuplicateId(format!(
                    "asset_revision:{}:{}",
                    revision.asset_id, revision.revision
                )));
            }
        }
        Ok(())
    }

    fn root_identities(&self) -> Vec<(&'static str, ObjectId)> {
        let groups: [(&str, Vec<ObjectId>); 10] = [
            ("vault", self.vaults.iter().map(|item| item.id).collect()),
            ("label", self.labels.iter().map(|item| item.id).collect()),
            (
                "project",
                self.projects.iter().map(|item| item.id).collect(),
            ),
            ("area", self.areas.iter().map(|item| item.id).collect()),
            (
                "template",
                self.templates.iter().map(|item| item.id).collect(),
            ),
            ("asset", self.assets.iter().map(|item| item.id).collect()),
            (
                "outfit",
                self.outfit_drafts.iter().map(|item| item.id).collect(),
            ),
            (
                "character",
                self.characters.iter().map(|item| item.id).collect(),
            ),
            (
                "appearance",
                self.appearances.iter().map(|item| item.id).collect(),
            ),
            (
                "binding",
                self.bindings.iter().map(|item| item.id).collect(),
            ),
        ];
        groups
            .into_iter()
            .flat_map(|(kind, ids)| ids.into_iter().map(move |id| (kind, id)))
            .chain(self.exports.iter().map(|item| ("export", item.id)))
            .chain(
                self.profiles
                    .iter()
                    .map(|item| ("profile", item.profile_id)),
            )
            .collect()
    }

    fn validate_workspace_references(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        for label in &self.labels {
            if let Some(project_id) = label.project_id {
                require(&index.projects, project_id, "label.project_id")?;
            }
        }
        for project in &self.projects {
            for label_id in &project.workspace_label_ids {
                let label = require(&index.labels, *label_id, "project.workspace_label_ids")?;
                if label.scope != LabelScope::Workspace {
                    return incompatible(
                        "project.workspace_label_ids",
                        "label is not workspace-scoped",
                    );
                }
            }
        }
        for area in &self.areas {
            require(&index.projects, area.project_id, "area.project_id")?;
            let profile = require_revision(&index.profiles, area.profile_ref, "area.profile_ref")?;
            if profile.area_id != area.id || profile.reference_height_px != area.reference_height_px
            {
                return incompatible(
                    "area.profile_ref",
                    "profile must belong to the area and match its reference height",
                );
            }
            for label_id in &area.label_ids {
                let label = require(&index.labels, *label_id, "area.label_ids")?;
                if label.project_id != Some(area.project_id) {
                    return incompatible("area.label_ids", "label belongs to another project");
                }
            }
        }
        Ok(())
    }

    fn validate_motion_references(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        for template in &self.templates {
            require(&index.areas, template.area_id, "motion_template.area_id")?;
            for revision in &template.released_revisions {
                require_revision(
                    &index.motions,
                    RevisionRef {
                        id: template.id,
                        revision: *revision,
                    },
                    "motion_template.released_revisions",
                )?;
            }
        }
        for motion in &self.motions {
            let template = require(
                &index.templates,
                motion.template_id,
                "motion_revision.template_id",
            )?;
            let profile = require_revision(
                &index.profiles,
                motion.profile_ref,
                "motion_revision.profile_ref",
            )?;
            if profile.area_id != template.area_id {
                return incompatible(
                    "motion_revision.profile_ref",
                    "profile and template belong to different areas",
                );
            }
            let slots = profile.slots.iter().map(|slot| slot.id.clone()).collect();
            motion.validate(Some(&slots))?;
        }
        Ok(())
    }

    fn validate_asset_references(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        for asset in &self.assets {
            require(&index.areas, asset.area_id, "asset.area_id")?;
            for revision in &asset.released_revisions {
                require_revision(
                    &index.asset_revisions,
                    RevisionRef {
                        id: asset.id,
                        revision: *revision,
                    },
                    "asset.released_revisions",
                )?;
            }
        }
        for revision in &self.asset_revisions {
            let asset = require(&index.assets, revision.asset_id, "asset_revision.asset_id")?;
            let profile = require_revision(
                &index.profiles,
                revision.profile_ref,
                "asset_revision.profile_ref",
            )?;
            if profile.area_id != asset.area_id
                || !profile.slots.iter().any(|slot| slot.id == revision.slot_id)
            {
                return incompatible(
                    "asset_revision.profile_ref",
                    "profile must belong to the asset area and contain its slot",
                );
            }
        }
        for draft in &self.outfit_drafts {
            require(&index.areas, draft.area_id, "outfit_draft.area_id")?;
            let motion = require_revision(
                &index.motions,
                draft.template_ref,
                "outfit_draft.template_ref",
            )?;
            if motion.profile_ref != draft.profile_ref {
                return incompatible("outfit_draft.profile_ref", "must match the motion profile");
            }
            for selected in &draft.selected_assets {
                require_asset_revision(
                    &index.asset_revisions,
                    selected.asset_id,
                    selected.revision,
                )?;
            }
        }
        Ok(())
    }

    fn validate_character_references(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        for character in &self.characters {
            let area = require(&index.areas, character.area_id, "character.area_id")?;
            if area.profile_ref != character.profile_ref {
                return incompatible(
                    "character.profile_ref",
                    "must match the character area profile",
                );
            }
            let appearance = require(
                &index.appearances,
                character.default_appearance_id,
                "character.default_appearance_id",
            )?;
            if appearance.character_id != character.id
                || appearance.profile_ref != character.profile_ref
            {
                return incompatible(
                    "character.default_appearance_id",
                    "appearance must belong to the character and use its profile",
                );
            }
        }
        for appearance in &self.appearances {
            let character = require(
                &index.characters,
                appearance.character_id,
                "appearance.character_id",
            )?;
            if character.profile_ref != appearance.profile_ref {
                return incompatible("appearance.profile_ref", "must match the character profile");
            }
            self.validate_appearance_assets(appearance, index)?;
        }
        self.validate_bindings(index)
    }

    fn validate_appearance_assets(
        &self,
        appearance: &Appearance,
        index: &CatalogIndex<'_>,
    ) -> Result<(), DomainError> {
        let profile = require_revision(
            &index.profiles,
            appearance.profile_ref,
            "appearance.profile_ref",
        )?;
        let slots = profile
            .slots
            .iter()
            .map(|slot| &slot.id)
            .collect::<HashSet<_>>();
        for assigned in &appearance.slots {
            if !slots.contains(&assigned.slot_id) {
                return missing("appearance.slots.slot_id", assigned.slot_id.to_string());
            }
            let revision = require_asset_revision(
                &index.asset_revisions,
                assigned.asset.asset_id,
                assigned.asset.revision,
            )?;
            if revision.profile_ref != appearance.profile_ref {
                return incompatible("appearance.slots.asset", "asset profile is incompatible");
            }
        }
        for equipment in &appearance.equipment {
            if !slots.contains(&equipment.anchor_slot) {
                return missing(
                    "appearance.equipment.anchor_slot",
                    equipment.anchor_slot.to_string(),
                );
            }
            require_asset_revision(
                &index.asset_revisions,
                equipment.asset.asset_id,
                equipment.asset.revision,
            )?;
        }
        Ok(())
    }

    fn validate_bindings(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        let mut active_actions = HashSet::new();
        for binding in &self.bindings {
            let character = require(
                &index.characters,
                binding.character_id,
                "binding.character_id",
            )?;
            let appearance = require(
                &index.appearances,
                binding.appearance_id,
                "binding.appearance_id",
            )?;
            let motion =
                require_revision(&index.motions, binding.template_ref, "binding.template_ref")?;
            if appearance.character_id != character.id
                || appearance.profile_ref != character.profile_ref
                || motion.profile_ref != character.profile_ref
            {
                return incompatible(
                    "binding",
                    "character, appearance, and template revision must share one profile",
                );
            }
            if !active_actions.insert((binding.character_id, binding.action_key.as_str())) {
                return Err(DomainError::DuplicateId(format!(
                    "binding:{}:{}",
                    binding.character_id, binding.action_key
                )));
            }
        }
        Ok(())
    }

    fn validate_export_references(&self, index: &CatalogIndex<'_>) -> Result<(), DomainError> {
        for export in &self.exports {
            require(
                &index.characters,
                export.character_id,
                "export.character_id",
            )?;
            require_revision(
                &index.profiles,
                export.sources.profile,
                "export.sources.profile",
            )?;
            for reference in &export.sources.motion {
                require_revision(&index.motions, *reference, "export.sources.motion")?;
            }
            for reference in &export.sources.assets {
                require_asset_revision(&index.asset_revisions, reference.id, reference.revision)?;
            }
            for reference in &export.sources.appearances {
                require(
                    &index.appearances,
                    reference.id,
                    "export.sources.appearances",
                )?;
            }
            for reference in &export.sources.bindings {
                require(&index.bindings, reference.id, "export.sources.bindings")?;
            }
            for action in &export.actions {
                require(
                    &index.bindings,
                    action.binding_ref.id,
                    "export.actions.binding_ref",
                )?;
            }
        }
        Ok(())
    }
}

struct CatalogIndex<'a> {
    labels: HashMap<ObjectId, &'a Label>,
    projects: HashMap<ObjectId, &'a Project>,
    areas: HashMap<ObjectId, &'a Area>,
    profiles: HashMap<RevisionRef, &'a ProfileRevision>,
    templates: HashMap<ObjectId, &'a MotionTemplate>,
    motions: HashMap<RevisionRef, &'a MotionRevision>,
    assets: HashMap<ObjectId, &'a Asset>,
    asset_revisions: HashMap<RevisionRef, &'a AssetRevision>,
    characters: HashMap<ObjectId, &'a Character>,
    appearances: HashMap<ObjectId, &'a Appearance>,
    bindings: HashMap<ObjectId, &'a AnimationBinding>,
}

impl<'a> CatalogIndex<'a> {
    fn new(catalog: &'a DomainCatalog) -> Result<Self, DomainError> {
        Ok(Self {
            labels: collect_by_id(&catalog.labels, |item| item.id)?,
            projects: collect_by_id(&catalog.projects, |item| item.id)?,
            areas: collect_by_id(&catalog.areas, |item| item.id)?,
            profiles: collect_by_id(&catalog.profiles, ProfileRevision::reference)?,
            templates: collect_by_id(&catalog.templates, |item| item.id)?,
            motions: collect_by_id(&catalog.motions, MotionRevision::reference)?,
            assets: collect_by_id(&catalog.assets, |item| item.id)?,
            asset_revisions: collect_by_id(&catalog.asset_revisions, AssetRevision::reference)?,
            characters: collect_by_id(&catalog.characters, |item| item.id)?,
            appearances: collect_by_id(&catalog.appearances, |item| item.id)?,
            bindings: collect_by_id(&catalog.bindings, |item| item.id)?,
        })
    }
}

fn collect_by_id<K, T, F>(values: &[T], identity: F) -> Result<HashMap<K, &T>, DomainError>
where
    K: Copy + Eq + std::hash::Hash + ToString,
    F: Fn(&T) -> K,
{
    let mut index = HashMap::new();
    for value in values {
        let id = identity(value);
        if index.insert(id, value).is_some() {
            return Err(DomainError::DuplicateId(id.to_string()));
        }
    }
    Ok(index)
}

fn validate_each<T, F>(values: &[T], validate: F) -> Result<(), DomainError>
where
    F: Fn(&T) -> Result<(), DomainError>,
{
    for value in values {
        validate(value)?;
    }
    Ok(())
}

fn require<'a, K, T>(index: &'a HashMap<K, T>, target: K, path: &str) -> Result<&'a T, DomainError>
where
    K: Copy + Eq + std::hash::Hash + ToString,
{
    index
        .get(&target)
        .ok_or_else(|| DomainError::MissingReference {
            path: path.to_owned(),
            target: target.to_string(),
        })
}

fn require_revision<'a, T>(
    index: &'a HashMap<RevisionRef, T>,
    target: RevisionRef,
    path: &str,
) -> Result<&'a T, DomainError> {
    index
        .get(&target)
        .ok_or_else(|| DomainError::MissingReference {
            path: path.to_owned(),
            target: format!("{}:r{}", target.id, target.revision),
        })
}

fn require_asset_revision<'a>(
    revisions: &'a HashMap<RevisionRef, &AssetRevision>,
    id: ObjectId,
    revision: u32,
) -> Result<&'a super::AssetRevision, DomainError> {
    revisions
        .get(&RevisionRef { id, revision })
        .copied()
        .ok_or_else(|| DomainError::MissingReference {
            path: "asset_revision.revision".to_owned(),
            target: format!("{id}:r{revision}"),
        })
}

fn incompatible<T>(path: &str, message: &str) -> Result<T, DomainError> {
    Err(DomainError::IncompatibleReference {
        path: path.to_owned(),
        message: message.to_owned(),
    })
}

fn missing<T>(path: &str, target: String) -> Result<T, DomainError> {
    Err(DomainError::MissingReference {
        path: path.to_owned(),
        target,
    })
}
