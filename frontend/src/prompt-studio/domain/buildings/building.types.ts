import type { AssetSubtypeByCategory } from "../assets";

export const BUILDING_TYPE_IDS = Object.freeze([
  "residential",
  "commercial",
  "workshop",
  "hospitality",
  "tower",
  "gate",
  "sacred",
  "ruin",
  "fortification",
  "dungeonModule",
] as const);

export const BUILDING_SIZE_IDS = Object.freeze([
  "compact",
  "small",
  "medium",
  "large",
  "monumental",
] as const);

export const BUILDING_PLAN_SHAPE_IDS = Object.freeze([
  "rectangular",
  "lShaped",
  "round",
  "courtyard",
  "modular",
  "asymmetric",
  "irregular",
  "custom",
] as const);

export const BUILDING_MATERIAL_IDS = Object.freeze([
  "wood",
  "stone",
  "clay",
  "brick",
  "plaster",
  "metal",
  "timberFrame",
  "mixed",
  "custom",
] as const);

export const BUILDING_ROOF_SHAPE_IDS = Object.freeze([
  "gable",
  "hipped",
  "flat",
  "shed",
  "conical",
  "domed",
  "collapsed",
  "none",
  "custom",
] as const);

export const BUILDING_ROOF_PITCH_IDS = Object.freeze([
  "low",
  "medium",
  "steep",
  "variable",
] as const);

export const BUILDING_ROOF_MATERIAL_IDS = Object.freeze([
  "thatch",
  "woodShingle",
  "slate",
  "tile",
  "metal",
  "stone",
  "earth",
  "mixed",
  "none",
  "custom",
] as const);

export const BUILDING_ROOF_CONDITION_IDS = Object.freeze([
  "intact",
  "weathered",
  "damaged",
  "collapsed",
  "overgrown",
] as const);

export const BUILDING_FACADE_STYLE_IDS = Object.freeze([
  "timberFrame",
  "plastered",
  "masonry",
  "brick",
  "fortified",
  "carved",
  "ruined",
  "mixed",
  "custom",
] as const);

export const BUILDING_DOOR_TYPE_IDS = Object.freeze([
  "single",
  "double",
  "arched",
  "reinforced",
  "portcullis",
  "openPassage",
  "custom",
] as const);

export const BUILDING_DOOR_STATE_IDS = Object.freeze([
  "open",
  "closed",
  "ajar",
  "blocked",
  "broken",
] as const);

export const BUILDING_WINDOW_SHAPE_IDS = Object.freeze([
  "square",
  "rectangular",
  "arched",
  "round",
  "narrowSlit",
  "irregular",
  "none",
] as const);

export const BUILDING_WINDOW_LIGHTING_IDS = Object.freeze([
  "dark",
  "neutral",
  "warmLit",
  "coolLit",
  "mixed",
  "boarded",
] as const);

export const BUILDING_CONDITION_IDS = Object.freeze([
  "maintained",
  "used",
  "weathered",
  "damaged",
  "abandoned",
  "overgrown",
] as const);

export const BUILDING_OCCUPANCY_IDS = Object.freeze([
  "inhabited",
  "active",
  "vacant",
  "abandoned",
] as const);

export const BUILDING_ENVIRONMENT_IDS = Object.freeze([
  "village",
  "city",
  "forest",
  "snow",
  "swamp",
  "ruin",
  "dungeon",
  "neutral",
] as const);

export const BUILDING_MAPPING_MODE_IDS = Object.freeze([
  "freestanding",
  "mapIntegrated",
  "tileAligned",
  "modularSet",
] as const);

export const BUILDING_COLLISION_MODE_IDS = Object.freeze([
  "fullyBlocking",
  "walkableEntrance",
  "walkableInterior",
  "mixed",
] as const);

export const BUILDING_LIGHTING_IDS = Object.freeze([
  "worldAligned",
  "warmInterior",
  "darkInterior",
  "neutralInterior",
  "visibleSources",
  "emissive",
  "custom",
] as const);

export const BUILDING_ANIMATION_TYPE_IDS = Object.freeze(["openClose", "custom"] as const);

export type BuildingSubtype = AssetSubtypeByCategory["building"];
export type BuildingType = (typeof BUILDING_TYPE_IDS)[number];
export type BuildingSize = (typeof BUILDING_SIZE_IDS)[number];
export type BuildingPlanShape = (typeof BUILDING_PLAN_SHAPE_IDS)[number];
export type BuildingMaterial = (typeof BUILDING_MATERIAL_IDS)[number];
export type BuildingRoofShape = (typeof BUILDING_ROOF_SHAPE_IDS)[number];
export type BuildingRoofPitch = (typeof BUILDING_ROOF_PITCH_IDS)[number];
export type BuildingRoofMaterial = (typeof BUILDING_ROOF_MATERIAL_IDS)[number];
export type BuildingRoofCondition = (typeof BUILDING_ROOF_CONDITION_IDS)[number];
export type BuildingFacadeStyle = (typeof BUILDING_FACADE_STYLE_IDS)[number];
export type BuildingDoorType = (typeof BUILDING_DOOR_TYPE_IDS)[number];
export type BuildingDoorState = (typeof BUILDING_DOOR_STATE_IDS)[number];
export type BuildingWindowShape = (typeof BUILDING_WINDOW_SHAPE_IDS)[number];
export type BuildingWindowLighting = (typeof BUILDING_WINDOW_LIGHTING_IDS)[number];
export type BuildingCondition = (typeof BUILDING_CONDITION_IDS)[number];
export type BuildingOccupancy = (typeof BUILDING_OCCUPANCY_IDS)[number];
export type BuildingEnvironment = (typeof BUILDING_ENVIRONMENT_IDS)[number];
export type BuildingMappingMode = (typeof BUILDING_MAPPING_MODE_IDS)[number];
export type BuildingCollisionMode = (typeof BUILDING_COLLISION_MODE_IDS)[number];
export type BuildingLighting = (typeof BUILDING_LIGHTING_IDS)[number];
export type BuildingAnimationType = (typeof BUILDING_ANIMATION_TYPE_IDS)[number];

export const BUILDING_TYPE_BY_SUBTYPE = Object.freeze({
  house: "residential",
  hut: "residential",
  shop: "commercial",
  workshop: "workshop",
  inn: "hospitality",
  tower: "tower",
  gate: "gate",
  temple: "sacred",
  ruin: "ruin",
  fortification: "fortification",
  dungeonModule: "dungeonModule",
} as const satisfies Readonly<Record<BuildingSubtype, BuildingType>>);

export function getDefaultBuildingType(subtype: BuildingSubtype): BuildingType {
  return BUILDING_TYPE_BY_SUBTYPE[subtype];
}
