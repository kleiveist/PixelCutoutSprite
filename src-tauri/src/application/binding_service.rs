use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::domain::{
    ActionKey, AnimationBinding, Appearance, Character, CharacterStatus, Direction, LocalOverride,
    ObjectId, RevisionRef, Sha256Digest, SlotId,
};
use crate::storage::VaultRoot;

use super::appearance_service::{AppearanceServiceError, OutfitLabelOption};
use super::{binding_write, npc_dashboard, npc_identity};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NpcCompleteness {
    Complete,
    MissingActions,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NpcExportStatus {
    NotExported,
    Current,
    Stale,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RevisionCompatibility {
    Compatible,
    Incompatible,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RevisionComparison {
    pub current_frame_count: u16,
    pub candidate_frame_count: u16,
    pub current_fps: u16,
    pub candidate_fps: u16,
    pub current_covered_directions: Vec<Direction>,
    pub candidate_covered_directions: Vec<Direction>,
    pub retained_local_override_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RevisionOffer {
    pub template_ref: RevisionRef,
    pub compatibility: RevisionCompatibility,
    pub reason: Option<String>,
    pub comparison: RevisionComparison,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct NpcBindingView {
    pub binding: AnimationBinding,
    pub template_name: String,
    pub covered_directions: Vec<Direction>,
    pub missing_directions: Vec<Direction>,
    pub effective_source_fingerprint: Sha256Digest,
    pub revision_offer: Option<RevisionOffer>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReleasedMotionOption {
    pub template_ref: RevisionRef,
    pub template_name: String,
    pub default_action_key: ActionKey,
    pub frame_count: u16,
    pub covered_directions: Vec<Direction>,
    pub missing_directions: Vec<Direction>,
    pub compatibility: RevisionCompatibility,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct NpcView {
    pub character: Character,
    pub labels: Vec<OutfitLabelOption>,
    pub bindings: Vec<NpcBindingView>,
    pub missing_actions: Vec<ActionKey>,
    pub completeness: NpcCompleteness,
    pub export_status: NpcExportStatus,
    pub effective_source_fingerprint: Sha256Digest,
    pub available_slots: Vec<SlotId>,
    pub motion_options: Vec<ReleasedMotionOption>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct NpcWorkspaceContext {
    pub area_id: ObjectId,
    pub area_name: String,
    pub available_labels: Vec<OutfitLabelOption>,
    pub npcs: Vec<NpcView>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AddBindingRequest {
    pub character_id: ObjectId,
    pub template_ref: RevisionRef,
    /// `None` uses the template action. Supplying a value is the explicit variant-key action.
    pub variant_action_key: Option<ActionKey>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateBindingOverridesRequest {
    pub binding_id: ObjectId,
    pub expected_revision: u32,
    pub local_overrides: Vec<LocalOverride>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdoptBindingRevisionRequest {
    pub binding_id: ObjectId,
    pub expected_revision: u32,
    pub template_ref: RevisionRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewBindingRequest {
    pub binding_id: ObjectId,
    pub expected_revision: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetCharacterStatusRequest {
    pub character_id: ObjectId,
    pub expected_revision: u32,
    pub status: CharacterStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DuplicateNpcRequest {
    pub character_id: ObjectId,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenameNpcRequest {
    pub character_id: ObjectId,
    pub expected_revision: u32,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DuplicatedNpc {
    pub character: Character,
    pub appearance: Appearance,
    pub bindings: Vec<AnimationBinding>,
    pub character_folder: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RenamedNpc {
    pub character: Character,
    pub character_folder: String,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct BindingService;

impl BindingService {
    pub fn workspace_context(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
    ) -> Result<NpcWorkspaceContext, AppearanceServiceError> {
        npc_dashboard::workspace_context(vault, area_path)
    }

    pub fn add_binding(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: AddBindingRequest,
    ) -> Result<AnimationBinding, AppearanceServiceError> {
        binding_write::add_binding(vault, area_path, request)
    }

    pub fn update_local_overrides(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: UpdateBindingOverridesRequest,
    ) -> Result<AnimationBinding, AppearanceServiceError> {
        binding_write::update_local_overrides(vault, area_path, request)
    }

    pub fn adopt_revision(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: AdoptBindingRevisionRequest,
    ) -> Result<AnimationBinding, AppearanceServiceError> {
        binding_write::adopt_revision(vault, area_path, request)
    }

    pub fn review_binding(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: ReviewBindingRequest,
    ) -> Result<AnimationBinding, AppearanceServiceError> {
        binding_write::review_binding(vault, area_path, request)
    }

    pub fn set_character_status(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: SetCharacterStatusRequest,
    ) -> Result<Character, AppearanceServiceError> {
        binding_write::set_character_status(vault, area_path, request)
    }

    pub fn duplicate_npc(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: DuplicateNpcRequest,
    ) -> Result<DuplicatedNpc, AppearanceServiceError> {
        npc_identity::duplicate_npc(vault, area_path, request)
    }

    pub fn rename_npc(
        &self,
        vault: &VaultRoot,
        area_path: &Path,
        request: RenameNpcRequest,
    ) -> Result<RenamedNpc, AppearanceServiceError> {
        npc_identity::rename_npc(vault, area_path, request)
    }
}
