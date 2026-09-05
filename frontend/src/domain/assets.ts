import type {
  ContractHeader,
  Direction,
  MutableDocument,
  PixelPoint,
  PixelSize,
  Revision,
  RevisionRef,
  SlotRef,
  UUID,
  UtcTimestamp,
} from "./common";

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

export interface OutfitDraft extends MutableDocument<"outfit_draft"> {
  area_id: UUID;
  template_ref: RevisionRef;
  profile_ref: RevisionRef;
  character_id: UUID | null;
  appearance_id: UUID | null;
  status: OutfitDraftStatus;
  selected_assets: SlotRef[];
}
