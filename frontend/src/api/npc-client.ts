import { invoke } from "@tauri-apps/api/core";

import type {
  AnimationBinding,
  Appearance,
  Character,
  CharacterStatus,
  Direction,
  LocalOverride,
  RevisionRef,
} from "../domain";
import type { OutfitLabelOption } from "./outfit-client";

export type NpcCompleteness = "complete" | "missing_actions";
export type NpcExportStatus = "not_exported" | "current" | "stale";
export type RevisionCompatibility = "compatible" | "incompatible";

export interface RevisionComparison {
  current_frame_count: number;
  candidate_frame_count: number;
  current_fps: number;
  candidate_fps: number;
  current_covered_directions: Direction[];
  candidate_covered_directions: Direction[];
  retained_local_override_count: number;
}

export interface RevisionOffer {
  template_ref: RevisionRef;
  compatibility: RevisionCompatibility;
  reason: string | null;
  comparison: RevisionComparison;
}

export interface NpcBindingView {
  binding: AnimationBinding;
  template_name: string;
  covered_directions: Direction[];
  missing_directions: Direction[];
  effective_source_fingerprint: string;
  revision_offer: RevisionOffer | null;
}

export interface ReleasedMotionOption {
  template_ref: RevisionRef;
  template_name: string;
  default_action_key: string;
  frame_count: number;
  covered_directions: Direction[];
  missing_directions: Direction[];
  compatibility: RevisionCompatibility;
  reason: string | null;
}

export interface NpcView {
  character: Character;
  labels: OutfitLabelOption[];
  bindings: NpcBindingView[];
  missing_actions: string[];
  completeness: NpcCompleteness;
  export_status: NpcExportStatus;
  effective_source_fingerprint: string;
  available_slots: string[];
  motion_options: ReleasedMotionOption[];
}

export interface NpcWorkspaceContext {
  area_id: string;
  area_name: string;
  available_labels: OutfitLabelOption[];
  npcs: NpcView[];
}

export interface AddBindingRequest {
  character_id: string;
  template_ref: RevisionRef;
  variant_action_key: string | null;
}

export interface UpdateBindingOverridesRequest {
  binding_id: string;
  expected_revision: number;
  local_overrides: LocalOverride[];
}

export interface DuplicatedNpc {
  character: Character;
  appearance: Appearance;
  bindings: AnimationBinding[];
  character_folder: string;
}

export interface RenamedNpc {
  character: Character;
  character_folder: string;
}

export interface NpcClient {
  inspect(sessionId: string, areaId: string): Promise<NpcWorkspaceContext>;
  addBinding(
    sessionId: string,
    areaId: string,
    request: AddBindingRequest,
  ): Promise<AnimationBinding>;
  updateOverrides(
    sessionId: string,
    areaId: string,
    request: UpdateBindingOverridesRequest,
  ): Promise<AnimationBinding>;
  adoptRevision(
    sessionId: string,
    areaId: string,
    bindingId: string,
    expectedRevision: number,
    templateRef: RevisionRef,
  ): Promise<AnimationBinding>;
  reviewBinding(
    sessionId: string,
    areaId: string,
    bindingId: string,
    expectedRevision: number,
  ): Promise<AnimationBinding>;
  setStatus(
    sessionId: string,
    areaId: string,
    characterId: string,
    expectedRevision: number,
    status: CharacterStatus,
  ): Promise<Character>;
  duplicate(
    sessionId: string,
    areaId: string,
    characterId: string,
    name: string,
  ): Promise<DuplicatedNpc>;
  rename(
    sessionId: string,
    areaId: string,
    characterId: string,
    expectedRevision: number,
    name: string,
  ): Promise<RenamedNpc>;
}

export const npcClient: NpcClient = {
  inspect(sessionId, areaId) {
    return invoke<NpcWorkspaceContext>("inspect_npc_workspace", { sessionId, areaId });
  },
  addBinding(sessionId, areaId, request) {
    return invoke<AnimationBinding>("add_npc_binding", { sessionId, areaId, request });
  },
  updateOverrides(sessionId, areaId, request) {
    return invoke<AnimationBinding>("update_npc_binding_overrides", {
      sessionId,
      areaId,
      request,
    });
  },
  adoptRevision(sessionId, areaId, bindingId, expectedRevision, templateRef) {
    return invoke<AnimationBinding>("adopt_npc_binding_revision", {
      sessionId,
      areaId,
      request: {
        binding_id: bindingId,
        expected_revision: expectedRevision,
        template_ref: templateRef,
      },
    });
  },
  reviewBinding(sessionId, areaId, bindingId, expectedRevision) {
    return invoke<AnimationBinding>("review_npc_binding", {
      sessionId,
      areaId,
      request: { binding_id: bindingId, expected_revision: expectedRevision },
    });
  },
  setStatus(sessionId, areaId, characterId, expectedRevision, status) {
    return invoke<Character>("set_npc_status", {
      sessionId,
      areaId,
      request: {
        character_id: characterId,
        expected_revision: expectedRevision,
        status,
      },
    });
  },
  duplicate(sessionId, areaId, characterId, name) {
    return invoke<DuplicatedNpc>("duplicate_npc", {
      sessionId,
      areaId,
      request: { character_id: characterId, name },
    });
  },
  rename(sessionId, areaId, characterId, expectedRevision, name) {
    return invoke<RenamedNpc>("rename_npc", {
      sessionId,
      areaId,
      request: { character_id: characterId, expected_revision: expectedRevision, name },
    });
  },
};
