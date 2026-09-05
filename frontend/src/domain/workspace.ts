import type {
  ContractHeader,
  Direction,
  MutableDocument,
  PixelPoint,
  PixelSize,
  RevisionRef,
  UUID,
  UtcTimestamp,
} from "./common";

export interface Vault extends ContractHeader<"vault"> {
  id: UUID;
  format: "pixel-cutout-sprite-vault";
  created_at: UtcTimestamp;
}

export type LabelScope = "workspace" | "project";

export interface Label extends MutableDocument<"label"> {
  scope: LabelScope;
  project_id: UUID | null;
  name: string;
  color: string;
}

export interface Project extends MutableDocument<"project"> {
  name: string;
  status: "active" | "archived";
  workspace_label_ids: UUID[];
}

export interface Area extends MutableDocument<"area"> {
  project_id: UUID;
  name: string;
  object_type: "humanoid";
  profile_ref: RevisionRef;
  reference_height_px: number;
  direction_model: "eight_way";
  directions: Direction[];
  default_frame_size_px: PixelSize;
  default_ground_origin_px: PixelPoint;
  label_ids: UUID[];
}
