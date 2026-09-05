import type {
  ContractHeader,
  Direction,
  MutableDocument,
  PixelPoint,
  PixelSize,
  Revision,
  RevisionRef,
  UUID,
  UtcTimestamp,
} from "./common";

export type TemplateStatus = "active" | "archived";
export type LoopMode = "loop" | "once";
export type DirectionMode = "explicit" | "mirrored" | "missing";

export interface MotionTemplate extends MutableDocument<"motion_template"> {
  area_id: UUID;
  name: string;
  action_key: string;
  status: TemplateStatus;
  label_ids: UUID[];
  draft_revision: Revision;
  draft_base_release: Revision | null;
  released_revisions: Revision[];
}

export interface DirectionDefinition {
  direction: Direction;
  mode: DirectionMode;
  source?: Direction | null;
}

export type TrackProperty =
  "offset_x_px" | "offset_y_px" | "rotation_deg" | "visible" | "sprite_variant" | "layer_delta";
export type Interpolation = "linear" | "hold" | "ease_in_out";
export type TrackValue = number | boolean | string;
export type MotionPresetKind = "idle" | "walk" | "sprint" | "jump" | "interact" | "attack";
export type RootMotionMode = "in_place";
export type JumpHeightMode = "not_applicable" | "baked_into_frames" | "external_game_motion";
export type HelperKind = "body_bob" | "body_sway" | "jump_height" | "follow_through";

export interface MotionHelperChannel {
  kind: HelperKind;
  slot_id: string;
  property: "offset_x_px" | "offset_y_px" | "rotation_deg";
  amplitude: number;
  cycles: number;
  phase: number;
  enabled: boolean;
}

export interface MotionSemantics {
  preset: MotionPresetKind;
  root_motion: RootMotionMode;
  recommended_speed_px_per_second: number | null;
  jump_height_mode: JumpHeightMode;
  ground_shadow?: GroundShadow | null;
  helpers: MotionHelperChannel[];
}

export interface GroundShadow {
  enabled: boolean;
  width_px: number;
  height_px: number;
  opacity: number;
}

export interface Keyframe {
  frame: number;
  value: TrackValue;
}

export interface MotionTrack {
  direction: Direction;
  slot_id: string;
  property: TrackProperty;
  interpolation: Interpolation;
  keys: Keyframe[];
}

export interface MotionRevision extends ContractHeader<"motion_revision"> {
  template_id: UUID;
  revision: Revision;
  profile_ref: RevisionRef;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  directions: DirectionDefinition[];
  tracks: MotionTrack[];
  semantics?: MotionSemantics | null;
  published_at: UtcTimestamp;
}
