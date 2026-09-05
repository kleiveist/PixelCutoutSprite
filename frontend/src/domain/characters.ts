import type { Direction, MutableDocument, RevisionRef, SlotRef, Transform2D, UUID } from "./common";

export type CharacterStatus = "draft" | "reviewed" | "archived";

export interface Character extends MutableDocument<"character"> {
  area_id: UUID;
  name: string;
  description: string;
  status: CharacterStatus;
  profile_ref: RevisionRef;
  default_appearance_id: UUID;
  label_ids: UUID[];
  required_actions: string[];
}

export interface DirectionFit {
  direction: Direction;
  transform: Transform2D;
  visible: boolean;
  layer_delta: number;
}

export interface SlotAppearance {
  slot_id: string;
  asset: SlotRef;
  fit_by_direction: DirectionFit[];
}

export interface Equipment {
  id: UUID;
  name: string;
  anchor_slot: string;
  asset: SlotRef;
  enabled: boolean;
  follow_mode: "slot" | "world";
  own_motion_enabled: boolean;
  fit_by_direction: DirectionFit[];
}

export interface Appearance extends MutableDocument<"appearance"> {
  character_id: UUID;
  profile_ref: RevisionRef;
  name: string;
  slots: SlotAppearance[];
  equipment: Equipment[];
}

export interface LocalOverride {
  slot_id: string;
  direction: Direction;
  transform: Transform2D;
}

export interface AnimationBinding extends MutableDocument<"animation_binding"> {
  character_id: UUID;
  action_key: string;
  template_ref: RevisionRef;
  appearance_id: UUID;
  local_overrides: LocalOverride[];
  review_state: "draft" | "reviewed";
}
