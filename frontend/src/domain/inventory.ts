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
}

export interface AssetInventoryPage {
  area_id: UUID;
  profile_ref: RevisionRef;
  writable: boolean;
  labels: InventoryLabel[];
  facets: AssetInventoryFacets;
  items: AssetInventoryItem[];
  total_items: number;
  next_cursor: string | null;
}

export type AssetInventoryUsageFilter = "any" | "used" | "unused";
export type AssetInventorySort = "name_asc" | "name_desc" | "updated_newest" | "updated_oldest";

export interface AssetInventoryQuery {
  search: string;
  slot_id: string | null;
  direction: Direction | null;
  asset_kind: AssetKind | null;
  profile_ref: RevisionRef | null;
  label_id: UUID | null;
  usage: AssetInventoryUsageFilter;
  sort: AssetInventorySort;
}

export interface AssetInventoryFacets {
  slot_ids: string[];
  directions: Direction[];
  asset_kinds: AssetKind[];
  profile_refs: RevisionRef[];
  label_ids: UUID[];
  has_used: boolean;
  has_unused: boolean;
}

export interface AssetThumbnail {
  asset_id: UUID;
  revision: number;
  width_px: number;
  height_px: number;
  data_url: string;
}

export type AssetImportJobState = "queued" | "running" | "completed" | "cancelled" | "failed";

export interface AssetImportProgress {
  stage: string;
  completed: number;
  total: number;
  message: string;
}

export interface AssetImportJobView {
  job_id: UUID;
  session_id: UUID;
  area_id: UUID;
  state: AssetImportJobState;
  progress: AssetImportProgress;
  result: { imported_assets: AssetInventoryItem[]; warning?: string } | null;
  error: string | null;
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
  inspection_fingerprint: string;
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
  inspection_fingerprint: string;
  source: AssetImportSource;
  decisions: ImportDecision[];
}
