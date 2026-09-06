import { z } from "zod";
import type { AssetCapability } from "../domain/assets";

export const V2_SCHEMA_VERSION = 2 as const;
export const SchemaVersionSchema = z.literal(V2_SCHEMA_VERSION);

export const StableIdSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "IDs may contain lowercase letters, digits, underscores, and hyphens only.",
  )
  .brand<"StableId">();

export const IsoDateTimeSchema = z.iso.datetime();
export const ProfileNameSchema = z.string().trim().min(1).max(120);
export const IconIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

const capabilityShape = {
  movable: z.boolean().default(false),
  directional: z.boolean().default(false),
  animated: z.boolean().default(false),
  tileable: z.boolean().default(false),
  gridBound: z.boolean().default(false),
  transparent: z.boolean().default(false),
  scaledCharacter: z.boolean().default(false),
  footprint: z.boolean().default(false),
  wearable: z.boolean().default(false),
  modular: z.boolean().default(false),
  freeComposition: z.boolean().default(false),
} satisfies Record<AssetCapability, z.ZodType>;

export const AssetCapabilitiesSchema = z.strictObject(capabilityShape).readonly();

const baseProfileValuesShape = {
  pixelDensity: z.enum(["classicHd", "modernHd", "ultraHd"]),
  styleProfile: z.enum(["classic", "dark", "both"]),
  tileSize: z.number().int().min(8).max(512),
  characterHeight: z.number().int().min(16).max(1024).optional(),
  perspectiveType: z.enum(["topdown", "threeQuarter", "isometric", "side"]),
  cameraAngle: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  cameraDirection: z.enum(["southToNorth", "swToNe", "seToNw"]),
  projectionType: z.enum(["orthographic", "mildPerspective"]),
  outlineStyle: z.enum(["dark", "softSelective", "minimal"]),
  paletteMode: z.enum(["natural", "vivid", "desaturated", "byProfile"]),
  backgroundMode: z.enum(["transparent", "scene"]),
  alphaPadding: z.number().int().min(0).max(256),
  nearestNeighbor: z.boolean(),
  lightingDefaults: z
    .strictObject({
      policy: z.enum([
        "adaptive",
        "neutralDay",
        "warmInterior",
        "gloomyDiffuse",
        "neutralNight",
        "coolNight",
        "custom",
      ]),
      notes: z.string().trim().max(2000),
    })
    .readonly(),
} as const;

export const BaseProfileValuesSchema = z.strictObject(baseProfileValuesShape).readonly();
export const BaseProfileOverridesSchema = z
  .strictObject(baseProfileValuesShape)
  .partial()
  .readonly();

const baseProfileLocksShape = {
  pixelDensity: z.boolean(),
  styleProfile: z.boolean(),
  tileSize: z.boolean(),
  characterHeight: z.boolean(),
  perspectiveType: z.boolean(),
  cameraAngle: z.boolean(),
  cameraDirection: z.boolean(),
  projectionType: z.boolean(),
  outlineStyle: z.boolean(),
  paletteMode: z.boolean(),
  backgroundMode: z.boolean(),
  alphaPadding: z.boolean(),
  nearestNeighbor: z.boolean(),
  lightingDefaults: z.boolean(),
} as const;

export const BaseProfileLocksSchema = z.strictObject(baseProfileLocksShape).partial().readonly();

export const DirectionCountSchema = z.union([z.literal(4), z.literal(8)]);

export const FootprintSchema = z
  .strictObject({
    widthTiles: z.number().int().min(1).max(64),
    depthTiles: z.number().int().min(1).max(64),
  })
  .readonly();

export const TagsSchema = z.array(z.string().trim().min(1).max(48)).max(32).readonly();

export const ValidationMessagesSchema = z
  .strictObject({
    errors: z.array(z.string().min(1).max(500)).max(100),
    warnings: z.array(z.string().min(1).max(500)).max(100),
  })
  .readonly();

export const MigratedFromVersionSchema = z.literal(1);
export const LegacyDataSchema = z.record(z.string(), z.json()).readonly();

export type StableId = z.infer<typeof StableIdSchema>;
export type AssetCapabilitiesData = z.infer<typeof AssetCapabilitiesSchema>;
export type BaseProfileValues = z.infer<typeof BaseProfileValuesSchema>;
export type BaseProfileOverrides = z.infer<typeof BaseProfileOverridesSchema>;
export type BaseProfileLocks = z.infer<typeof BaseProfileLocksSchema>;
export type LegacyData = z.infer<typeof LegacyDataSchema>;
