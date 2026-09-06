import { WEARABLE_SUBTYPES, type AssetSubtypeByCategory } from "../assets";

export const ITEM_CLASS_IDS = Object.freeze([
  "weapon",
  "tool",
  "clothing",
  "armor",
  "bag",
  "jewelry",
  "consumable",
  "keyItem",
  "questItem",
  "collectible",
] as const);

export const ITEM_PURPOSE_IDS = Object.freeze([
  "practical",
  "decorative",
  "wearable",
  "usable",
] as const);

export const ITEM_PRESENTATION_IDS = Object.freeze(["icon", "worldAsset", "equipped"] as const);

export const ITEM_WEAR_POSITION_IDS = Object.freeze([
  "head",
  "neck",
  "hand",
  "body",
  "back",
  "belt",
] as const);

export const ITEM_MATERIAL_IDS = Object.freeze([
  "wood",
  "metal",
  "leather",
  "fabric",
  "glass",
  "ceramic",
  "stone",
  "bone",
  "organic",
  "liquid",
  "magic",
  "mixed",
  "custom",
] as const);

export const ITEM_CONDITION_IDS = Object.freeze([
  "new",
  "used",
  "worn",
  "damaged",
  "ancient",
  "magicallyAltered",
] as const);

export const ITEM_SIGNIFICANCE_IDS = Object.freeze([
  "common",
  "valuable",
  "rare",
  "ceremonial",
  "magical",
  "questCritical",
] as const);

export const ITEM_SIZE_IDS = Object.freeze([
  "tiny",
  "small",
  "medium",
  "large",
  "oversized",
] as const);

export const ITEM_READABILITY_IDS = Object.freeze([
  "silhouetteFirst",
  "balanced",
  "detailRich",
] as const);

export const ITEM_GLOW_MODE_IDS = Object.freeze(["none", "subtle", "emissive"] as const);

export const ITEM_SHADOW_MODE_IDS = Object.freeze(["none", "contact"] as const);

export type ItemSubtype = AssetSubtypeByCategory["item"];
export type ItemClass = (typeof ITEM_CLASS_IDS)[number];
export type ItemPurpose = (typeof ITEM_PURPOSE_IDS)[number];
export type ItemPresentation = (typeof ITEM_PRESENTATION_IDS)[number];
export type ItemWearPosition = (typeof ITEM_WEAR_POSITION_IDS)[number];
export type ItemMaterial = (typeof ITEM_MATERIAL_IDS)[number];
export type ItemCondition = (typeof ITEM_CONDITION_IDS)[number];
export type ItemSignificance = (typeof ITEM_SIGNIFICANCE_IDS)[number];
export type ItemSize = (typeof ITEM_SIZE_IDS)[number];
export type ItemReadability = (typeof ITEM_READABILITY_IDS)[number];
export type ItemGlowMode = (typeof ITEM_GLOW_MODE_IDS)[number];
export type ItemShadowMode = (typeof ITEM_SHADOW_MODE_IDS)[number];

export const ITEM_CLASS_BY_SUBTYPE = Object.freeze({
  weapon: "weapon",
  tool: "tool",
  clothing: "clothing",
  armorPiece: "armor",
  bag: "bag",
  jewelry: "jewelry",
  consumable: "consumable",
  keyItem: "keyItem",
  questItem: "questItem",
  collectible: "collectible",
} as const satisfies Readonly<Record<ItemSubtype, ItemClass>>);

export const WEARABLE_ITEM_SUBTYPES = WEARABLE_SUBTYPES.item;

export function getDefaultItemClass(subtype: ItemSubtype): ItemClass {
  return ITEM_CLASS_BY_SUBTYPE[subtype];
}

export function itemSubtypeSupportsWearPosition(subtype: ItemSubtype): boolean {
  const wearableSubtypes: readonly ItemSubtype[] = WEARABLE_ITEM_SUBTYPES;
  return wearableSubtypes.includes(subtype);
}
