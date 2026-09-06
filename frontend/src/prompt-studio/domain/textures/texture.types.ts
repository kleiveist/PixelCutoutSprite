import { ASSET_SUBTYPES, type AssetSubtypeByCategory } from "../assets";

export const TEXTURE_MATERIAL_TYPE_IDS = ASSET_SUBTYPES.texture;

export const TEXTURE_USAGE_IDS = Object.freeze([
  "floor",
  "wall",
  "roof",
  "surface",
  "clothing",
  "decor",
] as const);

export const TEXTURE_ORIENTATION_IDS = Object.freeze([
  "horizontal",
  "vertical",
  "radial",
  "unordered",
  "grainAligned",
] as const);

export const TEXTURE_STRUCTURE_IDS = Object.freeze(["fine", "medium", "coarse"] as const);

export const TEXTURE_CONDITION_IDS = Object.freeze([
  "new",
  "polished",
  "rough",
  "old",
  "wet",
  "frosted",
  "damaged",
  "dirty",
] as const);

export const TEXTURE_SURFACE_IDS = Object.freeze([
  "continuous",
  "planked",
  "jointed",
  "cracked",
  "granular",
  "layered",
  "woven",
  "organic",
] as const);

export const TEXTURE_MOISTURE_IDS = Object.freeze(["dry", "damp", "wet"] as const);

export const TEXTURE_ICING_IDS = Object.freeze([
  "none",
  "lightFrost",
  "frosted",
  "iceCrusted",
] as const);

export const TEXTURE_LIGHTING_IDS = Object.freeze([
  "neutralEven",
  "contextual",
  "worldAligned",
] as const);

export type TextureSubtype = AssetSubtypeByCategory["texture"];
export type TextureMaterialType = (typeof TEXTURE_MATERIAL_TYPE_IDS)[number];
export type TextureUsage = (typeof TEXTURE_USAGE_IDS)[number];
export type TextureOrientation = (typeof TEXTURE_ORIENTATION_IDS)[number];
export type TextureStructure = (typeof TEXTURE_STRUCTURE_IDS)[number];
export type TextureCondition = (typeof TEXTURE_CONDITION_IDS)[number];
export type TextureSurface = (typeof TEXTURE_SURFACE_IDS)[number];
export type TextureMoisture = (typeof TEXTURE_MOISTURE_IDS)[number];
export type TextureIcing = (typeof TEXTURE_ICING_IDS)[number];
export type TextureLighting = (typeof TEXTURE_LIGHTING_IDS)[number];

export const TEXTURE_MATERIAL_TYPE_BY_SUBTYPE = Object.freeze({
  wood: "wood",
  stone: "stone",
  snow: "snow",
  ice: "ice",
  earth: "earth",
  sand: "sand",
  grass: "grass",
  moss: "moss",
  metal: "metal",
  fabric: "fabric",
  leather: "leather",
  brick: "brick",
  paving: "paving",
  clay: "clay",
  ceramic: "ceramic",
  customMaterial: "customMaterial",
} as const satisfies Readonly<Record<TextureSubtype, TextureMaterialType>>);

export function getDefaultTextureMaterialType(subtype: TextureSubtype): TextureMaterialType {
  return TEXTURE_MATERIAL_TYPE_BY_SUBTYPE[subtype];
}
