import { z } from "zod";
import { LEGACY_V1_DEFAULT_STATE } from "../domain/legacy-v1";

const legacyV1StateShape = {
  schemaVersion: z.literal(1),
  projectName: z.string(),
  promptLanguage: z.enum(["en", "de", "both"]),
  profileOutputMode: z.enum(["both", "selected"]),
  selectedProfile: z.enum(["classic", "dark"]),
  pixelDensity: z.enum(["classicHd", "modernHd", "ultraHd"]),
  styleBalance: z.enum(["retro", "balanced", "modern"]),
  outlineStyle: z.enum(["dark", "softSelective", "minimal"]),
  paletteMode: z.enum(["natural", "vivid", "desaturated", "byProfile"]),
  colorBudget: z.enum(["adaptive", "32", "48", "64", "96", "unlimited"]),
  assetType: z.enum([
    "hero",
    "npc",
    "enemy",
    "boss",
    "creature",
    "building",
    "interiorObject",
    "outdoorObject",
    "plant",
    "tree",
    "rock",
    "ruin",
    "weapon",
    "armor",
    "consumable",
    "questItem",
    "groundTile",
    "wallElement",
  ]),
  outputMode: z.enum([
    "single",
    "directional4",
    "directional8",
    "assetSet",
    "spriteSheet",
    "tileset",
    "concept",
  ]),
  assetFacing: z.enum([
    "south",
    "southwest",
    "west",
    "northwest",
    "north",
    "northeast",
    "east",
    "southeast",
  ]),
  subjectDescription: z.string(),
  extraDetails: z.string(),
  materials: z.string(),
  condition: z.enum([
    "new",
    "maintained",
    "used",
    "weathered",
    "damaged",
    "overgrown",
    "repaired",
    "abandoned",
    "magical",
  ]),
  tileSize: z.number().int().min(8).max(512),
  characterHeight: z.number().int().min(16).max(1024),
  footprintWidthTiles: z.number().int().min(1).max(64),
  footprintDepthTiles: z.number().int().min(1).max(64),
  frameSize: z.enum(["auto", "96", "128", "160", "192", "256"]),
  sheetLayout: z.enum(["auto", "4x2", "8x1", "2x4", "4x1", "2x2"]),
  perspectiveType: z.enum(["topdown", "threeQuarter", "isometric", "side"]),
  cameraAngle: z.enum(["30", "45", "60"]),
  cameraDirection: z.enum(["southToNorth", "swToNe", "seToNw"]),
  projectionType: z.enum(["orthographic", "mildPerspective"]),
  lockAxes: z.boolean(),
  noPerspectiveScale: z.boolean(),
  noIsometricAxes: z.boolean(),
  cameraNeverRotates: z.boolean(),
  environment: z.enum([
    "outdoor",
    "indoor",
    "forest",
    "village",
    "town",
    "ruinArea",
    "dungeon",
    "cave",
    "mountain",
    "snow",
    "swamp",
    "desert",
    "magicArea",
  ]),
  timeOfDay: z.enum([
    "day",
    "night",
    "dawn",
    "dusk",
    "interiorLit",
    "interiorDark",
    "notApplicable",
  ]),
  lightingPolicy: z.enum([
    "adaptive",
    "neutralDay",
    "warmInterior",
    "gloomyDiffuse",
    "neutralNight",
    "coolNight",
    "custom",
  ]),
  mood: z.enum(["neutral", "adventure", "cozy", "ominous", "melancholic", "magical", "hostile"]),
  lightingNotes: z.string(),
  backgroundMode: z.enum(["transparent", "scene"]),
  shadowMode: z.enum(["automatic", "none", "contact"]),
  detailLevel: z.enum(["normal", "important", "heroic"]),
  alphaPadding: z.number().int().min(0).max(256),
  anchorMode: z.enum(["automatic", "bottomCenter", "footprintCenter", "canvasCenter"]),
  nativeResolution: z.boolean(),
  nearestNeighbor: z.boolean(),
  pixelPerfectEdges: z.boolean(),
  gameReadable: z.boolean(),
  cleanSilhouette: z.boolean(),
  preserveProportions: z.boolean(),
  separateForms: z.boolean(),
  noBrandRefs: z.boolean(),
  productionReady: z.boolean(),
  avoidOverdetail: z.boolean(),
  customRules: z.string(),
} as const;

export const LegacyV1StateSchema = z.strictObject(legacyV1StateShape);
export const LegacyV1StatePatchSchema = z.object(legacyV1StateShape).partial();

export const LegacyV1AutosaveSchema = z.object({
  savedAt: z.unknown().optional(),
  state: z.unknown(),
});

export const LegacyV1PresetSchema = z.object({
  name: z.string(),
  updatedAt: z.unknown().optional(),
  state: z.unknown(),
});

export const LegacyV1PresetsSchema = z.array(LegacyV1PresetSchema).max(10_000);

export const LegacyV1ExportSchema = z.object({
  application: z.literal("Pixelart Prompt Studio"),
  formatVersion: z.literal(1),
  exportedAt: z.unknown().optional(),
  state: z.unknown(),
  generatedOutputs: z.unknown().optional(),
});

export function parseLegacyV1State(input: unknown): ValidatedLegacyV1State {
  const patch = LegacyV1StatePatchSchema.parse(input);
  return LegacyV1StateSchema.parse({ ...LEGACY_V1_DEFAULT_STATE, ...patch });
}

export type ValidatedLegacyV1State = z.infer<typeof LegacyV1StateSchema>;
export type LegacyV1Autosave = z.infer<typeof LegacyV1AutosaveSchema>;
export type LegacyV1Preset = z.infer<typeof LegacyV1PresetSchema>;
export type LegacyV1Export = z.infer<typeof LegacyV1ExportSchema>;
