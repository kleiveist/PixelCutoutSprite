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

export interface AtlasPage {
  id: string;
  file: string;
  size_px: PixelSize;
}

export interface ExportAction {
  action_key: string;
  binding_ref: RevisionRef;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  directions: Direction[];
}

export interface ExportFrame {
  action_key: string;
  direction: Direction;
  sample_index: number;
  page_id: string;
  rect_px: readonly [number, number, number, number];
  mirrored_from: Direction | null;
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
  character_id: UUID;
  source_fingerprint: string;
  sources: ExportSources;
  actions: ExportAction[];
  pages: AtlasPage[];
  frames: ExportFrame[];
  checks: ExportCheck[];
  created_at: UtcTimestamp;
}
