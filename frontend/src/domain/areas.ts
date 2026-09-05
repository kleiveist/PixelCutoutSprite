import type { Direction, PixelPoint, PixelSize, RevisionRef, UUID, UtcTimestamp } from "./common";
import type { DirectionView, MirrorPair, ProfileRevision, SlotDefinition } from "./profile";
import type { Area } from "./workspace";

export interface HumanoidPreviewSlot {
  slot_id: string;
  optional: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}

export interface HumanoidDirectionPreview {
  direction: Direction;
  slots: HumanoidPreviewSlot[];
}

export interface HumanoidProfilePreview {
  preset_version: number;
  reference_height_px: number;
  measured_height_px: number;
  suggested_frame_size_px: PixelSize;
  suggested_ground_origin_px: PixelPoint;
  slots: SlotDefinition[];
  views: DirectionView[];
  mirror_pairs: MirrorPair[];
  direction_previews: HumanoidDirectionPreview[];
}

export interface AreaCard {
  id: UUID;
  revision: number;
  project_id: UUID;
  name: string;
  object_type: "humanoid";
  profile_ref: RevisionRef;
  reference_height_px: number;
  direction_model: "eight_way";
  default_frame_size_px: PixelSize;
  default_ground_origin_px: PixelPoint;
  label_ids: UUID[];
  created_at: UtcTimestamp;
  updated_at: UtcTimestamp;
}

export interface AreaDetails {
  area: Area;
  profile: ProfileRevision;
  preview: HumanoidProfilePreview;
  writable: boolean;
}

export interface AreaDashboardData {
  project_id: UUID;
  areas: AreaCard[];
  labels: AreaLabelSummary[];
  writable: boolean;
}

export interface AreaLabelSummary {
  id: UUID;
  revision: number;
  name: string;
  color: string;
}

export interface CreateAreaRequest {
  project_id: UUID;
  name: string;
  object_type: "humanoid";
  reference_height_px: number;
  default_frame_size_px: PixelSize | null;
  default_ground_origin_px: PixelPoint | null;
  label_ids: UUID[];
}

export interface ReviseAreaProfileRequest {
  area_id: UUID;
  expected_area_revision: number;
  reference_height_px: number;
  default_frame_size_px: PixelSize | null;
  default_ground_origin_px: PixelPoint | null;
}
