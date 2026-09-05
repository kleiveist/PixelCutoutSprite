import type { AssetKind } from "./assets";
import type { Direction, PixelPoint, PixelSize, RevisionRef, UUID } from "./common";

export interface InventoryLabel {
  id: UUID;
  name: string;
  color: string;
}

export interface AssetUsage {
  kind: string;
  id: UUID;
  description: string;
}

export interface AssetInventoryItem {
  id: UUID;
  revision: number;
  name: string;
  original_name: string;
  asset_kind: AssetKind;
  label_ids: UUID[];
  released_revision: number;
  profile_ref: RevisionRef;
  slot_id: string;
  direction: Direction;
  variant: string;
  image_size_px: PixelSize;
  pivot_px: PixelPoint;
  content_hash: string;
  archived: boolean;
  usage: AssetUsage[];
  thumbnail_url: string;
}

export interface AssetInventory {
  area_id: UUID;
  profile_ref: RevisionRef;
  writable: boolean;
  labels: InventoryLabel[];
  items: AssetInventoryItem[];
}

export type AssetImportSource =
  { kind: "package"; path: string } | { kind: "loose_pngs"; paths: string[] };

export type SizeHandling = "keep_original" | "pad_transparent" | "rescale_nearest";

export interface ImportSlotOption {
  id: string;
  size_px: PixelSize;
  pivot_px: PixelPoint;
}

export interface AssetImportPreviewEntry {
  entry_index: number;
  name: string;
  source_name: string;
  asset_kind: AssetKind;
  declared_slot_id: string | null;
  declared_direction: Direction | null;
  suggested_slot_id: string | null;
  suggested_direction: Direction | null;
  variant: string;
  image_size_px: PixelSize;
  effective_size_px: PixelSize;
  pivot_px: PixelPoint;
  content_hash: string;
  size_warning: string | null;
  size_options: SizeHandling[];
  duplicate_asset_id: UUID | null;
}

export interface AssetImportInspection {
  area_id: UUID;
  profile_ref: RevisionRef;
  source: AssetImportSource;
  slots: ImportSlotOption[];
  entries: AssetImportPreviewEntry[];
}

export interface ImportDecision {
  entry_index: number;
  slot_id: string;
  direction: Direction;
  size_handling: SizeHandling;
}

export interface ConfirmAssetImportRequest {
  area_id: UUID;
  source: AssetImportSource;
  decisions: ImportDecision[];
}
