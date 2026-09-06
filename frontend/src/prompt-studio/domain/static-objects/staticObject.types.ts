import type { AssetSubtypeByCategory } from "../assets";

export const STATIC_OBJECT_CLASS_IDS = Object.freeze([
  "furniture",
  "container",
  "door",
  "well",
  "sign",
  "pillar",
  "altar",
  "decoration",
  "workTool",
  "interactiveObject",
] as const);

export const STATIC_OBJECT_PURPOSE_IDS = Object.freeze([
  "decorative",
  "interactive",
  "walkable",
  "blocking",
] as const);

export const STATIC_OBJECT_BASIC_SHAPE_IDS = Object.freeze([
  "boxy",
  "cylindrical",
  "round",
  "planar",
  "arched",
  "stepped",
  "organic",
  "irregular",
  "custom",
] as const);

export const STATIC_OBJECT_PROPORTION_IDS = Object.freeze([
  "compact",
  "balanced",
  "tall",
  "wide",
  "low",
  "slender",
  "massive",
] as const);

export const STATIC_OBJECT_SYMMETRY_IDS = Object.freeze([
  "bilateral",
  "radial",
  "asymmetric",
  "none",
] as const);

export const STATIC_OBJECT_MATERIAL_IDS = Object.freeze([
  "wood",
  "stone",
  "metal",
  "ceramic",
  "glass",
  "fabric",
  "leather",
  "rope",
  "bone",
  "organic",
  "magic",
  "mixed",
  "custom",
] as const);

export const STATIC_OBJECT_CONDITION_IDS = Object.freeze([
  "clean",
  "used",
  "weathered",
  "damaged",
  "overgrown",
] as const);

export const STATIC_OBJECT_INTERACTION_IDS = Object.freeze([
  "none",
  "open",
  "tilt",
  "glow",
  "break",
] as const);

export const STATIC_OBJECT_ANIMATION_TYPE_IDS = Object.freeze([
  "openClose",
  "glow",
  "break",
  "custom",
] as const);

export const STATIC_OBJECT_SHADOW_MODE_IDS = Object.freeze(["none", "contact"] as const);

export type StaticObjectSubtype = AssetSubtypeByCategory["staticObject"];
export type StaticObjectClass = (typeof STATIC_OBJECT_CLASS_IDS)[number];
export type StaticObjectPurpose = (typeof STATIC_OBJECT_PURPOSE_IDS)[number];
export type StaticObjectBasicShape = (typeof STATIC_OBJECT_BASIC_SHAPE_IDS)[number];
export type StaticObjectProportion = (typeof STATIC_OBJECT_PROPORTION_IDS)[number];
export type StaticObjectSymmetry = (typeof STATIC_OBJECT_SYMMETRY_IDS)[number];
export type StaticObjectMaterial = (typeof STATIC_OBJECT_MATERIAL_IDS)[number];
export type StaticObjectCondition = (typeof STATIC_OBJECT_CONDITION_IDS)[number];
export type StaticObjectInteraction = (typeof STATIC_OBJECT_INTERACTION_IDS)[number];
export type StaticObjectAnimationType = (typeof STATIC_OBJECT_ANIMATION_TYPE_IDS)[number];
export type StaticObjectShadowMode = (typeof STATIC_OBJECT_SHADOW_MODE_IDS)[number];

export const STATIC_OBJECT_CLASS_BY_SUBTYPE = Object.freeze({
  furniture: "furniture",
  container: "container",
  barrel: "container",
  crate: "container",
  chest: "container",
  door: "door",
  well: "well",
  sign: "sign",
  pillar: "pillar",
  altar: "altar",
  decoration: "decoration",
  workTool: "workTool",
  interactiveObject: "interactiveObject",
} as const satisfies Readonly<Record<StaticObjectSubtype, StaticObjectClass>>);

export function getDefaultStaticObjectClass(subtype: StaticObjectSubtype): StaticObjectClass {
  return STATIC_OBJECT_CLASS_BY_SUBTYPE[subtype];
}
