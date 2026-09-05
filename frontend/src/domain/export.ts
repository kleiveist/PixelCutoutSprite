import type {
  ContractHeader,
  Direction,
  PixelPoint,
  PixelSize,
  RevisionRef,
  UUID,
  UtcTimestamp,
} from "./common";
import type { LoopMode } from "./motion";

export interface ExportSources {
  profile: RevisionRef;
  motion: RevisionRef[];
  assets: RevisionRef[];
  appearances: RevisionRef[];
  bindings: RevisionRef[];
}

export type EffectiveSourceKind = "profile" | "motion" | "asset" | "appearance" | "binding";

export interface EffectiveSource {
  kind: EffectiveSourceKind;
  reference: RevisionRef;
  content_sha256: string;
}

export type ExportRootMotionMode = "baked" | "external";
export type ExportJumpMode = "baked" | "external";
export type ExportFormat = "png_json" | "godot_package";
export type ClippingPolicy = "block" | "warn";

export interface ExportProfileSnapshot {
  name: string;
  directions: Direction[];
  max_page_size_px: PixelSize;
  max_pages: number;
  memory_budget_bytes: number;
  padding_px: number;
  extrude_edges: boolean;
  individual_frames: boolean;
  include_shadow: boolean;
  normalize_geometry: boolean;
  clipping_policy: ClippingPolicy;
  allow_incomplete_test: boolean;
}

export interface AtlasPage {
  id: string;
  file: string;
  size_px: PixelSize;
  rgba_sha256: string;
}

export interface ExportAction {
  action_key: string;
  binding_ref: RevisionRef;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  root_motion_mode: ExportRootMotionMode;
  jump_mode: ExportJumpMode;
  directions: Direction[];
}

export interface ExportFrame {
  action_key: string;
  direction: Direction;
  sample_index: number;
  page_id: string;
  rect_px: readonly [number, number, number, number];
  ground_origin_px: PixelPoint;
  duration_ticks: 1;
  mirrored_from: Direction | null;
  individual_file: string | null;
  rgba_sha256: string;
  clipping: Array<{ slot_id: string; bounds_px: readonly [number, number, number, number] }>;
}

export interface ExportCheck {
  code: string;
  level: "passed" | "warning";
  message: string;
}

export interface ExportManifest extends ContractHeader<"export_manifest"> {
  id: UUID;
  format_version: 1;
  generator_version: string;
  rasterizer_version: string;
  character_id: UUID;
  source_fingerprint: string;
  complete: boolean;
  profile: ExportProfileSnapshot;
  sources: ExportSources;
  effective_sources: EffectiveSource[];
  actions: ExportAction[];
  pages: AtlasPage[];
  frames: ExportFrame[];
  checks: ExportCheck[];
  created_at: UtcTimestamp;
}
