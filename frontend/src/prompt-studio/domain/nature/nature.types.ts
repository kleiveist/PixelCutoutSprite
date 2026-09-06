import type { AssetSubtypeByCategory } from "../assets";

export const NATURE_PLANT_TYPE_IDS = Object.freeze([
  "tree",
  "bush",
  "grass",
  "mushroom",
  "root",
  "treeStump",
  "vine",
] as const);

export const NATURE_CLIMATE_IDS = Object.freeze([
  "temperate",
  "mountain",
  "snow",
  "swamp",
  "dry",
  "dark",
  "magical",
] as const);

export const NATURE_SEASON_IDS = Object.freeze([
  "spring",
  "summer",
  "autumn",
  "winter",
  "timeless",
] as const);

export const NATURE_AGE_IDS = Object.freeze(["young", "mature", "ancient", "dead"] as const);

export const NATURE_SILHOUETTE_IDS = Object.freeze([
  "broad",
  "narrow",
  "asymmetric",
  "gnarled",
  "upright",
  "spreading",
  "compact",
] as const);

export const NATURE_TRUNK_THICKNESS_IDS = Object.freeze([
  "thin",
  "medium",
  "thick",
  "massive",
] as const);

export const NATURE_TRUNK_SHAPE_IDS = Object.freeze([
  "straight",
  "tapered",
  "twisted",
  "gnarled",
  "split",
  "hollow",
] as const);

export const NATURE_CROWN_SHAPE_IDS = Object.freeze([
  "round",
  "tall",
  "tiered",
  "spreading",
  "conical",
  "irregular",
  "damaged",
  "bare",
] as const);

export const NATURE_CROWN_DENSITY_IDS = Object.freeze([
  "sparse",
  "loose",
  "medium",
  "dense",
  "bare",
] as const);

export const NATURE_ROOT_VISIBILITY_IDS = Object.freeze([
  "hidden",
  "visible",
  "spreading",
  "rockWrapping",
  "exposed",
] as const);

export const NATURE_MOSS_COVERAGE_IDS = Object.freeze([
  "none",
  "light",
  "moderate",
  "heavy",
] as const);

export const NATURE_MUSHROOM_GROWTH_IDS = Object.freeze([
  "none",
  "few",
  "clustered",
  "abundant",
] as const);

export const NATURE_SNOW_COVER_IDS = Object.freeze([
  "none",
  "dusting",
  "partial",
  "covered",
  "heavy",
] as const);

export const NATURE_VINE_GROWTH_IDS = Object.freeze([
  "none",
  "light",
  "draped",
  "entangled",
] as const);

export const NATURE_GROUNDING_IDS = Object.freeze([
  "natural",
  "soilPatch",
  "grassPatch",
  "rocky",
  "snowy",
  "swampy",
  "freestanding",
] as const);

export const NATURE_ANIMATION_TYPE_IDS = Object.freeze(["wind", "magic", "custom"] as const);

export type NatureSubtype = AssetSubtypeByCategory["nature"];
export type NaturePlantType = (typeof NATURE_PLANT_TYPE_IDS)[number];
export type NatureClimate = (typeof NATURE_CLIMATE_IDS)[number];
export type NatureSeason = (typeof NATURE_SEASON_IDS)[number];
export type NatureAge = (typeof NATURE_AGE_IDS)[number];
export type NatureSilhouette = (typeof NATURE_SILHOUETTE_IDS)[number];
export type NatureTrunkThickness = (typeof NATURE_TRUNK_THICKNESS_IDS)[number];
export type NatureTrunkShape = (typeof NATURE_TRUNK_SHAPE_IDS)[number];
export type NatureCrownShape = (typeof NATURE_CROWN_SHAPE_IDS)[number];
export type NatureCrownDensity = (typeof NATURE_CROWN_DENSITY_IDS)[number];
export type NatureRootVisibility = (typeof NATURE_ROOT_VISIBILITY_IDS)[number];
export type NatureMossCoverage = (typeof NATURE_MOSS_COVERAGE_IDS)[number];
export type NatureMushroomGrowth = (typeof NATURE_MUSHROOM_GROWTH_IDS)[number];
export type NatureSnowCover = (typeof NATURE_SNOW_COVER_IDS)[number];
export type NatureVineGrowth = (typeof NATURE_VINE_GROWTH_IDS)[number];
export type NatureGrounding = (typeof NATURE_GROUNDING_IDS)[number];
export type NatureAnimationType = (typeof NATURE_ANIMATION_TYPE_IDS)[number];

export const NATURE_PLANT_TYPE_BY_SUBTYPE = Object.freeze({
  tree: "tree",
  deciduousTree: "tree",
  conifer: "tree",
  witheredTree: "tree",
  magicTree: "tree",
  bush: "bush",
  grassTuft: "grass",
  mushroom: "mushroom",
  root: "root",
  treeStump: "treeStump",
  vine: "vine",
} as const satisfies Readonly<Record<NatureSubtype, NaturePlantType>>);

const NATURE_SUBTYPES_WITH_TRUNK = Object.freeze([
  "tree",
  "deciduousTree",
  "conifer",
  "witheredTree",
  "magicTree",
  "treeStump",
] as const satisfies readonly NatureSubtype[]);

const NATURE_SUBTYPES_WITH_CROWN = Object.freeze([
  "tree",
  "deciduousTree",
  "conifer",
  "witheredTree",
  "magicTree",
  "bush",
] as const satisfies readonly NatureSubtype[]);

const NATURE_SUBTYPES_WITH_ROOTS = Object.freeze([
  "tree",
  "deciduousTree",
  "conifer",
  "witheredTree",
  "magicTree",
  "bush",
  "root",
  "treeStump",
] as const satisfies readonly NatureSubtype[]);

function natureSubtypeListIncludes(
  subtypes: readonly NatureSubtype[],
  subtype: NatureSubtype,
): boolean {
  return subtypes.includes(subtype);
}

export function getDefaultNaturePlantType(subtype: NatureSubtype): NaturePlantType {
  return NATURE_PLANT_TYPE_BY_SUBTYPE[subtype];
}

export function natureSubtypeHasTrunk(subtype: NatureSubtype): boolean {
  return natureSubtypeListIncludes(NATURE_SUBTYPES_WITH_TRUNK, subtype);
}

export function natureSubtypeHasCrown(subtype: NatureSubtype): boolean {
  return natureSubtypeListIncludes(NATURE_SUBTYPES_WITH_CROWN, subtype);
}

export function natureSubtypeHasRoots(subtype: NatureSubtype): boolean {
  return natureSubtypeListIncludes(NATURE_SUBTYPES_WITH_ROOTS, subtype);
}
