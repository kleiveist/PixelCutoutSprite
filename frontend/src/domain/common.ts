export const SCHEMA_VERSION = 1 as const;
export const VAULT_FORMAT = "pixel-cutout-sprite-vault" as const;
export const RESERVED_ADMIN_DIRECTORY = ".pixelforge-studio" as const;

export type UUID = string;
export type UtcTimestamp = string;
export type Revision = number;
export type PixelSize = readonly [number, number];
export type PixelPoint = readonly [number, number];
export type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type DocumentKind =
  | "vault"
  | "label"
  | "project"
  | "area"
  | "profile_revision"
  | "motion_template"
  | "motion_revision"
  | "asset"
  | "asset_revision"
  | "outfit_draft"
  | "character"
  | "appearance"
  | "animation_binding"
  | "export_manifest";

export interface ContractHeader<K extends DocumentKind> {
  schema_version: typeof SCHEMA_VERSION;
  kind: K;
}

export interface MutableDocument<K extends DocumentKind> extends ContractHeader<K> {
  id: UUID;
  revision: Revision;
  created_at: UtcTimestamp;
  updated_at: UtcTimestamp;
}

export interface RevisionRef {
  id: UUID;
  revision: Revision;
}

export interface Transform2D {
  offset_px: PixelPoint;
  rotation_deg: number;
}

export interface SlotRef {
  asset_id: UUID;
  revision: Revision;
  slot_id: string;
}
