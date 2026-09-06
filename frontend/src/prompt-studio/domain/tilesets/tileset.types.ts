import type { AssetSubtypeByCategory } from "../assets";

export const TILESET_TYPE_IDS = Object.freeze([
  "ground",
  "wall",
  "roof",
  "transition",
  "corner",
  "edge",
  "autotile",
  "decal",
  "animated",
] as const);

export const TILESET_USAGE_IDS = Object.freeze([
  "floor",
  "wall",
  "roof",
  "transition",
  "decor",
] as const);

export const TILESET_EDGE_SET_IDS = Object.freeze([
  "none",
  "cardinal",
  "cardinalAndDiagonal",
  "custom",
] as const);

export const TILESET_CORNER_SET_IDS = Object.freeze([
  "none",
  "outer",
  "inner",
  "innerAndOuter",
  "custom",
] as const);

export const TILESET_TRANSITION_MODE_IDS = Object.freeze([
  "none",
  "oneWay",
  "bidirectional",
  "multiMaterial",
  "custom",
] as const);

export const TILESET_SEAM_MODE_IDS = Object.freeze([
  "seamless",
  "matchedEdges",
  "intentionalBoundary",
  "overlap",
  "custom",
] as const);

export const TILESET_REPEAT_MODE_IDS = Object.freeze([
  "strict",
  "staggered",
  "randomized",
  "nonRepeating",
] as const);

export const TILESET_TILEABLE_AXES_IDS = Object.freeze([
  "horizontal",
  "vertical",
  "both",
  "none",
] as const);

export const TILESET_VARIANT_KIND_IDS = Object.freeze([
  "clean",
  "damaged",
  "decorated",
  "decal",
  "seasonal",
  "randomized",
] as const);

export const TILESET_ATLAS_LAYOUT_IDS = Object.freeze([
  "automatic",
  "singleRow",
  "singleColumn",
  "fixedColumns",
] as const);

export const TILESET_ANIMATION_TYPE_IDS = Object.freeze([
  "water",
  "lava",
  "magic",
  "custom",
] as const);

export type TilesetSubtype = AssetSubtypeByCategory["tileset"];
export type TilesetType = (typeof TILESET_TYPE_IDS)[number];
export type TilesetUsage = (typeof TILESET_USAGE_IDS)[number];
export type TilesetEdgeSet = (typeof TILESET_EDGE_SET_IDS)[number];
export type TilesetCornerSet = (typeof TILESET_CORNER_SET_IDS)[number];
export type TilesetTransitionMode = (typeof TILESET_TRANSITION_MODE_IDS)[number];
export type TilesetSeamMode = (typeof TILESET_SEAM_MODE_IDS)[number];
export type TilesetRepeatMode = (typeof TILESET_REPEAT_MODE_IDS)[number];
export type TilesetTileableAxes = (typeof TILESET_TILEABLE_AXES_IDS)[number];
export type TilesetVariantKind = (typeof TILESET_VARIANT_KIND_IDS)[number];
export type TilesetAtlasLayout = (typeof TILESET_ATLAS_LAYOUT_IDS)[number];
export type TilesetAnimationType = (typeof TILESET_ANIMATION_TYPE_IDS)[number];

export const TILESET_TYPE_BY_SUBTYPE = Object.freeze({
  groundTile: "ground",
  wallTile: "wall",
  roofPart: "roof",
  transition: "transition",
  corner: "corner",
  edge: "edge",
  autotile: "autotile",
  decal: "decal",
  animatedTile: "animated",
} as const satisfies Readonly<Record<TilesetSubtype, TilesetType>>);

export const TILESET_EDGE_SUBTYPES = Object.freeze([
  "transition",
  "corner",
  "edge",
  "autotile",
] as const satisfies readonly TilesetSubtype[]);

export const TILESET_CORNER_SUBTYPES = Object.freeze([
  "corner",
  "autotile",
] as const satisfies readonly TilesetSubtype[]);

export const TILESET_TRANSITION_SUBTYPES = Object.freeze([
  "transition",
  "autotile",
] as const satisfies readonly TilesetSubtype[]);

function includesSubtype(subtypes: readonly TilesetSubtype[], subtype: TilesetSubtype): boolean {
  return subtypes.includes(subtype);
}

export function getDefaultTilesetType(subtype: TilesetSubtype): TilesetType {
  return TILESET_TYPE_BY_SUBTYPE[subtype];
}

export function tilesetSubtypeSupportsEdges(subtype: TilesetSubtype): boolean {
  return includesSubtype(TILESET_EDGE_SUBTYPES, subtype);
}

export function tilesetSubtypeSupportsCorners(subtype: TilesetSubtype): boolean {
  return includesSubtype(TILESET_CORNER_SUBTYPES, subtype);
}

export function tilesetSubtypeSupportsTransitions(subtype: TilesetSubtype): boolean {
  return includesSubtype(TILESET_TRANSITION_SUBTYPES, subtype);
}
