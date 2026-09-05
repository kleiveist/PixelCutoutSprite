import type {
  ContractHeader,
  Direction,
  MutableDocument,
  PixelPoint,
  PixelSize,
  Revision,
  RevisionRef,
  SlotRef,
  Transform2D,
  UUID,
  UtcTimestamp,
} from "./common";
import type { Equipment } from "./characters";

export type AssetKind = "body" | "clothing" | "armour" | "accessory" | "equipment";

export interface Asset extends MutableDocument<"asset"> {
  area_id: UUID;
  name: string;
  original_name: string;
  asset_kind: AssetKind;
  label_ids: UUID[];
  released_revisions: Revision[];
  origin_note: string;
  license_note: string;
  archived: boolean;
}

export interface AssetRevision extends ContractHeader<"asset_revision"> {
  asset_id: UUID;
  revision: Revision;
  profile_ref: RevisionRef;
  slot_id: string;
  direction: Direction;
  variant: string;
  source_file: string;
  image_size_px: PixelSize;
  pivot_px: PixelPoint;
  content_hash: string;
  sprite_mirroring_allowed: boolean;
  published_at: UtcTimestamp;
}

export type OutfitDraftStatus = "in_progress" | "assigned";

export interface SpriteVariantFitting {
  variant: string;
  asset: SlotRef;
  pivot_px: PixelPoint;
}

export interface OutfitFitting {
  slot_id: string;
  direction: Direction;
  asset: SlotRef;
  pivot_px: PixelPoint;
  variant_fittings: SpriteVariantFitting[];
  transform: Transform2D;
  visible: boolean;
  layer_delta: number;
}

export interface OutfitLocalOverride {
  slot_id: string;
  direction: Direction;
  transform: Transform2D;
}

export interface AssetFallbackApproval {
  slot_id: string;
  target_direction: Direction;
  source_direction: Direction;
  variant: string;
}

export interface OutfitDraft extends MutableDocument<"outfit_draft"> {
  area_id: UUID;
  template_ref: RevisionRef;
  profile_ref: RevisionRef;
  character_id: UUID | null;
  appearance_id: UUID | null;
  base_character_revision: Revision | null;
  base_character_sha256: string | null;
  base_appearance_revision: Revision | null;
  base_appearance_sha256: string | null;
  base_binding_ref: RevisionRef | null;
  base_binding_sha256: string | null;
  status: OutfitDraftStatus;
  selected_assets: SlotRef[];
  asset_fallback_approvals: AssetFallbackApproval[];
  fittings: OutfitFitting[];
  local_overrides: OutfitLocalOverride[];
  equipment: Equipment[];
}
