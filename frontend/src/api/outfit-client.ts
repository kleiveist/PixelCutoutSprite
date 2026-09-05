import { invoke } from "@tauri-apps/api/core";

import type {
  AnimationBinding,
  Appearance,
  AssetFallbackApproval,
  AssetKind,
  Character,
  Direction,
  Equipment,
  MotionRevision,
  MotionTemplate,
  OutfitDraft,
  OutfitFitting,
  OutfitLocalOverride,
  PixelPoint,
  PixelSize,
  ProfileRevision,
  RevisionRef,
  SlotRef,
} from "../domain";

export type OutfitTarget = { kind: "new_npc" } | { kind: "existing_npc"; character_id: string };

export interface OutfitCharacterChoice {
  id: string;
  name: string;
  appearance_id: string;
}

export interface OutfitDraftChoice {
  id: string;
  revision: number;
  character_id: string | null;
  updated_at: string;
}

export interface OutfitAssetOption {
  asset: SlotRef;
  name: string;
  asset_kind: AssetKind;
  direction: Direction;
  variant: string;
  assignable: boolean;
  sprite_mirroring_allowed: boolean;
  pivot_px: PixelPoint;
  image_size_px: PixelSize;
  source_file: string;
}

export interface OutfitLabelOption {
  id: string;
  name: string;
  color: string;
}

export interface MissingOutfitSlot {
  slot_id: string;
  missing_directions: Direction[];
  missing_variants: MissingOutfitVariant[];
}

export interface MissingOutfitVariant {
  direction: Direction;
  variant: string;
}

export interface OutfitLaunchContext {
  template: MotionTemplate;
  motion: MotionRevision;
  profile: ProfileRevision;
  compatible_characters: OutfitCharacterChoice[];
  resumable_drafts: OutfitDraftChoice[];
  inventory: OutfitAssetOption[];
  available_labels: OutfitLabelOption[];
}

export interface OutfitEditorContext {
  draft: OutfitDraft;
  template: MotionTemplate;
  motion: MotionRevision;
  profile: ProfileRevision;
  inventory: OutfitAssetOption[];
  available_labels: OutfitLabelOption[];
  affected_binding_count: number;
  missing_required_slots: MissingOutfitSlot[];
  save_state: "clean" | "dirty" | "saving" | "saved" | "failed" | "conflict";
}

export interface OutfitDraftEdits {
  fittings: OutfitFitting[];
  asset_fallback_approvals: AssetFallbackApproval[];
  local_overrides: OutfitLocalOverride[];
  equipment: Equipment[];
}

export interface OutfitPreviewFrame {
  direction: Direction;
  frame_index: number;
  width: number;
  height: number;
  rgba: number[];
  clipping: { slot_id: string; bounds_px: [number, number, number, number] }[];
  guides: {
    slot_id: string;
    dummy_transform: [number, number, number, number, number, number];
    image_transform: [number, number, number, number, number, number];
    slot_size_px: PixelSize;
    slot_pivot_px: PixelPoint;
  }[];
  guides_included: false;
}

export interface SaveNpcRequest {
  name: string;
  description: string;
  label_ids: string[];
}

export interface SavedNpc {
  character: Character;
  appearance: Appearance;
  binding: AnimationBinding;
  draft: OutfitDraft;
  character_folder: string;
}

export interface OutfitClient {
  launch(sessionId: string, areaId: string, templateRef: RevisionRef): Promise<OutfitLaunchContext>;
  start(
    sessionId: string,
    areaId: string,
    templateRef: RevisionRef,
    target: OutfitTarget,
  ): Promise<OutfitEditorContext>;
  resume(sessionId: string, areaId: string, draftId: string): Promise<OutfitEditorContext>;
  autosave(
    sessionId: string,
    areaId: string,
    draftId: string,
    expectedRevision: number,
    edits: OutfitDraftEdits,
  ): Promise<OutfitEditorContext>;
  autoAssign(
    sessionId: string,
    areaId: string,
    draftId: string,
    expectedRevision: number,
    assets: SlotRef[],
  ): Promise<OutfitEditorContext>;
  preview(
    sessionId: string,
    areaId: string,
    draftId: string,
    direction: Direction,
    frameIndex: number,
    edits: OutfitDraftEdits,
  ): Promise<OutfitPreviewFrame>;
  saveAsNpc(
    sessionId: string,
    areaId: string,
    draftId: string,
    expectedRevision: number,
    request: SaveNpcRequest,
  ): Promise<SavedNpc>;
  applyToNpc(
    sessionId: string,
    areaId: string,
    draftId: string,
    expectedRevision: number,
  ): Promise<SavedNpc>;
}

export const outfitClient: OutfitClient = {
  launch(sessionId, areaId, templateRef) {
    return invoke<OutfitLaunchContext>("inspect_outfit_launch", {
      sessionId,
      areaId,
      templateRef,
    });
  },
  start(sessionId, areaId, templateRef, target) {
    return invoke<OutfitEditorContext>("start_outfit_draft", {
      sessionId,
      areaId,
      templateRef,
      target,
    });
  },
  resume(sessionId, areaId, draftId) {
    return invoke<OutfitEditorContext>("resume_outfit_draft", { sessionId, areaId, draftId });
  },
  autosave(sessionId, areaId, draftId, expectedRevision, edits) {
    return invoke<OutfitEditorContext>("autosave_outfit_draft", {
      sessionId,
      areaId,
      draftId,
      expectedRevision,
      edits,
    });
  },
  autoAssign(sessionId, areaId, draftId, expectedRevision, assets) {
    return invoke<OutfitEditorContext>("auto_assign_outfit", {
      sessionId,
      areaId,
      draftId,
      expectedRevision,
      assets,
    });
  },
  preview(sessionId, areaId, draftId, direction, frameIndex, edits) {
    return invoke<OutfitPreviewFrame>("render_outfit_preview", {
      sessionId,
      areaId,
      draftId,
      direction,
      frameIndex,
      edits,
    });
  },
  saveAsNpc(sessionId, areaId, draftId, expectedRevision, request) {
    return invoke<SavedNpc>("save_outfit_as_npc", {
      sessionId,
      areaId,
      draftId,
      expectedRevision,
      request,
    });
  },
  applyToNpc(sessionId, areaId, draftId, expectedRevision) {
    return invoke<SavedNpc>("apply_outfit_to_npc", {
      sessionId,
      areaId,
      draftId,
      expectedRevision,
    });
  },
};
