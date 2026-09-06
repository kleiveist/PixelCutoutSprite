import type {
  LegacyAssetType,
  LegacyEnvironment,
  LegacyOutputMode,
  LegacyV1State,
} from "./legacyV1.types";

export const LEGACY_V1_DEFAULT_STATE: Readonly<LegacyV1State> = Object.freeze({
  schemaVersion: 1,

  projectName: "EtherFood",
  promptLanguage: "en",
  profileOutputMode: "both",
  selectedProfile: "classic",

  pixelDensity: "modernHd",
  styleBalance: "balanced",
  outlineStyle: "softSelective",
  paletteMode: "byProfile",
  colorBudget: "64",

  assetType: "hero",
  outputMode: "directional8",
  assetFacing: "south",
  subjectDescription:
    "A large fantasy hero with practical medieval-fantasy clothing, a distinctive readable silhouette, layered fabric and leather details, restrained equipment, and a gameplay-friendly design.",
  extraDetails:
    "Clear separation between body, clothing, hair, equipment, and limbs. Important details must remain recognizable at native gameplay size.",
  materials:
    "Wood, stone, leather, cloth, metal, ceramic, bone, and weathered natural surfaces with deliberate pixel clusters.",
  condition: "used",

  tileSize: 32,
  characterHeight: 80,
  footprintWidthTiles: 1,
  footprintDepthTiles: 1,
  frameSize: "128",
  sheetLayout: "4x2",

  perspectiveType: "threeQuarter",
  cameraAngle: "60",
  cameraDirection: "southToNorth",
  projectionType: "orthographic",
  lockAxes: true,
  noPerspectiveScale: true,
  noIsometricAxes: true,
  cameraNeverRotates: true,

  environment: "outdoor",
  timeOfDay: "day",
  lightingPolicy: "adaptive",
  mood: "adventure",
  lightingNotes:
    "Outside during the day use neutral daylight. Lit buildings use warm practical light. Ominous scenes use subdued diffuse light. Night interiors use neutral low-intensity ambient light unless a warm source is present.",

  backgroundMode: "transparent",
  shadowMode: "automatic",
  detailLevel: "important",
  alphaPadding: 8,
  anchorMode: "bottomCenter",
  nativeResolution: true,
  nearestNeighbor: true,
  pixelPerfectEdges: true,

  gameReadable: true,
  cleanSilhouette: true,
  preserveProportions: true,
  separateForms: true,
  noBrandRefs: true,
  productionReady: true,
  avoidOverdetail: true,
  customRules:
    "Keep proportions, camera geometry, scale, baseline, light direction, and material language consistent across the complete asset library. Do not add decorative elements that were not requested.",
});

export const LEGACY_CHARACTER_ASSET_TYPES: ReadonlySet<LegacyAssetType> = new Set([
  "hero",
  "npc",
  "enemy",
  "boss",
  "creature",
]);

export const LEGACY_INDOOR_ENVIRONMENTS: ReadonlySet<LegacyEnvironment> = new Set([
  "indoor",
  "dungeon",
  "cave",
]);

export const LEGACY_OUTPUT_MODE_DIRECTIONS: Readonly<Partial<Record<LegacyOutputMode, number>>> =
  Object.freeze({
    directional4: 4,
    directional8: 8,
  });
