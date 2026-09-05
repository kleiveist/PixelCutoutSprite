import type {
  ContractHeader,
  Direction,
  PixelPoint,
  PixelSize,
  Revision,
  Transform2D,
  UUID,
  UtcTimestamp,
} from "./common";

export interface SlotDefinition {
  id: string;
  parent_id: string | null;
  optional: boolean;
  size_px: PixelSize;
  pivot_px: PixelPoint;
  base_transform: Transform2D;
}

export interface ViewTransform {
  slot_id: string;
  transform: Transform2D;
}

export interface DirectionView {
  direction: Direction;
  layer_order: string[];
  base_transforms: ViewTransform[];
}

export interface MirrorPair {
  left: string;
  right: string;
}

export interface ProfileRevision extends ContractHeader<"profile_revision"> {
  profile_id: UUID;
  revision: Revision;
  area_id: UUID;
  name: string;
  reference_height_px: number;
  slots: SlotDefinition[];
  views: DirectionView[];
  mirror_pairs: MirrorPair[];
  published_at: UtcTimestamp;
}
