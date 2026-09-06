export type LegacyPromptLanguage = "en" | "de" | "both";
export type LegacyOutputLanguage = Exclude<LegacyPromptLanguage, "both">;
export type LegacyStyleProfile = "classic" | "dark";
export type LegacyProfileOutputMode = "both" | "selected";
export type LegacyPixelDensity = "classicHd" | "modernHd" | "ultraHd";
export type LegacyStyleBalance = "retro" | "balanced" | "modern";
export type LegacyOutlineStyle = "dark" | "softSelective" | "minimal";
export type LegacyPaletteMode = "natural" | "vivid" | "desaturated" | "byProfile";
export type LegacyColorBudget = "adaptive" | "32" | "48" | "64" | "96" | "unlimited";

export type LegacyAssetType =
  | "hero"
  | "npc"
  | "enemy"
  | "boss"
  | "creature"
  | "building"
  | "interiorObject"
  | "outdoorObject"
  | "plant"
  | "tree"
  | "rock"
  | "ruin"
  | "weapon"
  | "armor"
  | "consumable"
  | "questItem"
  | "groundTile"
  | "wallElement";

export type LegacyOutputMode =
  "single" | "directional4" | "directional8" | "assetSet" | "spriteSheet" | "tileset" | "concept";

export type LegacyFacing =
  "south" | "southwest" | "west" | "northwest" | "north" | "northeast" | "east" | "southeast";

export type LegacyCondition =
  | "new"
  | "maintained"
  | "used"
  | "weathered"
  | "damaged"
  | "overgrown"
  | "repaired"
  | "abandoned"
  | "magical";

export type LegacyFrameSize = "auto" | "96" | "128" | "160" | "192" | "256";
export type LegacySheetLayout = "auto" | "4x2" | "8x1" | "2x4" | "4x1" | "2x2";
export type LegacyPerspective = "topdown" | "threeQuarter" | "isometric" | "side";
export type LegacyCameraAngle = "30" | "45" | "60";
export type LegacyCameraDirection = "southToNorth" | "swToNe" | "seToNw";
export type LegacyProjection = "orthographic" | "mildPerspective";

export type LegacyEnvironment =
  | "outdoor"
  | "indoor"
  | "forest"
  | "village"
  | "town"
  | "ruinArea"
  | "dungeon"
  | "cave"
  | "mountain"
  | "snow"
  | "swamp"
  | "desert"
  | "magicArea";

export type LegacyTimeOfDay =
  "day" | "night" | "dawn" | "dusk" | "interiorLit" | "interiorDark" | "notApplicable";

export type LegacyLightingPolicy =
  | "adaptive"
  | "neutralDay"
  | "warmInterior"
  | "gloomyDiffuse"
  | "neutralNight"
  | "coolNight"
  | "custom";

export type LegacyMood =
  "neutral" | "adventure" | "cozy" | "ominous" | "melancholic" | "magical" | "hostile";

export type LegacyBackgroundMode = "transparent" | "scene";
export type LegacyShadowMode = "automatic" | "none" | "contact";
export type LegacyDetailLevel = "normal" | "important" | "heroic";
export type LegacyAnchorMode = "automatic" | "bottomCenter" | "footprintCenter" | "canvasCenter";

export interface LegacyV1State extends Record<string, unknown> {
  schemaVersion: 1;
  projectName: string;
  promptLanguage: LegacyPromptLanguage;
  profileOutputMode: LegacyProfileOutputMode;
  selectedProfile: LegacyStyleProfile;
  pixelDensity: LegacyPixelDensity;
  styleBalance: LegacyStyleBalance;
  outlineStyle: LegacyOutlineStyle;
  paletteMode: LegacyPaletteMode;
  colorBudget: LegacyColorBudget;
  assetType: LegacyAssetType;
  outputMode: LegacyOutputMode;
  assetFacing: LegacyFacing;
  subjectDescription: string;
  extraDetails: string;
  materials: string;
  condition: LegacyCondition;
  tileSize: number;
  characterHeight: number;
  footprintWidthTiles: number;
  footprintDepthTiles: number;
  frameSize: LegacyFrameSize;
  sheetLayout: LegacySheetLayout;
  perspectiveType: LegacyPerspective;
  cameraAngle: LegacyCameraAngle;
  cameraDirection: LegacyCameraDirection;
  projectionType: LegacyProjection;
  lockAxes: boolean;
  noPerspectiveScale: boolean;
  noIsometricAxes: boolean;
  cameraNeverRotates: boolean;
  environment: LegacyEnvironment;
  timeOfDay: LegacyTimeOfDay;
  lightingPolicy: LegacyLightingPolicy;
  mood: LegacyMood;
  lightingNotes: string;
  backgroundMode: LegacyBackgroundMode;
  shadowMode: LegacyShadowMode;
  detailLevel: LegacyDetailLevel;
  alphaPadding: number;
  anchorMode: LegacyAnchorMode;
  nativeResolution: boolean;
  nearestNeighbor: boolean;
  pixelPerfectEdges: boolean;
  gameReadable: boolean;
  cleanSilhouette: boolean;
  preserveProportions: boolean;
  separateForms: boolean;
  noBrandRefs: boolean;
  productionReady: boolean;
  avoidOverdetail: boolean;
  customRules: string;
}

export type LegacyV1StateInput = Readonly<Record<string, unknown>>;

export interface LegacyFrameLayout {
  columns: number;
  rows: number;
}

export interface LegacyResolvedMetrics extends LegacyFrameLayout {
  frame: number;
  canvasWidth: number;
  canvasHeight: number;
  directionCount: number;
}

export interface LegacyValidationResult {
  errors: string[];
  warnings: string[];
  valid: boolean;
}

export interface LegacyPromptOutput {
  id: string;
  profile: LegacyStyleProfile;
  profileLabel: string;
  language: LegacyOutputLanguage;
  languageLabel: string;
  main: string;
  negative: string;
  technical: string;
  combined: string;
}

export type LegacyLocalizedLabel = Readonly<Record<LegacyOutputLanguage, string>>;
