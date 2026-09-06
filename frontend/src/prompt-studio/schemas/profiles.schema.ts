import { z } from "zod";
import {
  ASSET_CAPABILITY_IDS,
  ASSET_SUBTYPES,
  resolveCapabilities,
  type AssetCapabilities,
  type AssetCategory,
  type AssetSubtype,
} from "../domain/assets";
import {
  ArtworkAnswersSchema,
  BuildingAnswersSchema,
  CharacterAnswersSchema,
  ItemAnswersSchema,
  MovingObjectAnswersSchema,
  NatureAnswersSchema,
  StaticObjectAnswersSchema,
  TextureAnswersSchema,
  TilesetAnswersSchema,
} from "./categoryData.schema";
import { validateCategoryDataCapabilities } from "./categoryData.refinement";
import {
  AssetCapabilitiesSchema,
  BaseProfileLocksSchema,
  BaseProfileOverridesSchema,
  BaseProfileValuesSchema,
  IconIdSchema,
  IsoDateTimeSchema,
  LegacyDataSchema,
  MigratedFromVersionSchema,
  ProfileNameSchema,
  SchemaVersionSchema,
  StableIdSchema,
  TagsSchema,
} from "./common.schema";

export const BaseProfileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("baseProfile"),
  id: StableIdSchema,
  name: ProfileNameSchema,
  iconId: IconIdSchema,
  values: BaseProfileValuesSchema,
  locks: BaseProfileLocksSchema,
  migratedFromVersion: MigratedFromVersionSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

const CategoryProfileCommonSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("categoryProfile"),
  id: StableIdSchema,
  name: ProfileNameSchema,
  baseProfileId: StableIdSchema,
  iconId: IconIdSchema,
  capabilities: AssetCapabilitiesSchema,
  overrides: BaseProfileOverridesSchema,
  tags: TagsSchema,
  migratedFromVersion: MigratedFromVersionSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

const CategoryProfileUnionSchema = z.discriminatedUnion("category", [
  CategoryProfileCommonSchema.extend({
    category: z.literal("character"),
    subtype: z.enum(ASSET_SUBTYPES.character),
    defaults: CharacterAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("movingObject"),
    subtype: z.enum(ASSET_SUBTYPES.movingObject),
    defaults: MovingObjectAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("staticObject"),
    subtype: z.enum(ASSET_SUBTYPES.staticObject),
    defaults: StaticObjectAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("texture"),
    subtype: z.enum(ASSET_SUBTYPES.texture),
    defaults: TextureAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("nature"),
    subtype: z.enum(ASSET_SUBTYPES.nature),
    defaults: NatureAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("building"),
    subtype: z.enum(ASSET_SUBTYPES.building),
    defaults: BuildingAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("tileset"),
    subtype: z.enum(ASSET_SUBTYPES.tileset),
    defaults: TilesetAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("item"),
    subtype: z.enum(ASSET_SUBTYPES.item),
    defaults: ItemAnswersSchema,
  }),
  CategoryProfileCommonSchema.extend({
    category: z.literal("artwork"),
    subtype: z.enum(ASSET_SUBTYPES.artwork),
    defaults: ArtworkAnswersSchema,
  }),
]);

const AssetProfileCommonSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("assetProfile"),
  id: StableIdSchema,
  name: ProfileNameSchema,
  baseProfileId: StableIdSchema,
  categoryProfileId: StableIdSchema.optional(),
  compatibilityKey: z.string().trim().min(1).max(500),
  iconId: IconIdSchema,
  badgeIconIds: z.array(IconIdSchema).max(12).readonly(),
  capabilities: AssetCapabilitiesSchema,
  overrides: BaseProfileOverridesSchema,
  tags: TagsSchema,
  favorite: z.boolean(),
  migratedFromVersion: MigratedFromVersionSchema.optional(),
  legacyData: LegacyDataSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

const AssetProfileUnionSchema = z.discriminatedUnion("category", [
  AssetProfileCommonSchema.extend({
    category: z.literal("character"),
    subtype: z.enum(ASSET_SUBTYPES.character),
    answers: CharacterAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("movingObject"),
    subtype: z.enum(ASSET_SUBTYPES.movingObject),
    answers: MovingObjectAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("staticObject"),
    subtype: z.enum(ASSET_SUBTYPES.staticObject),
    answers: StaticObjectAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("texture"),
    subtype: z.enum(ASSET_SUBTYPES.texture),
    answers: TextureAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("nature"),
    subtype: z.enum(ASSET_SUBTYPES.nature),
    answers: NatureAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("building"),
    subtype: z.enum(ASSET_SUBTYPES.building),
    answers: BuildingAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("tileset"),
    subtype: z.enum(ASSET_SUBTYPES.tileset),
    answers: TilesetAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("item"),
    subtype: z.enum(ASSET_SUBTYPES.item),
    answers: ItemAnswersSchema,
  }),
  AssetProfileCommonSchema.extend({
    category: z.literal("artwork"),
    subtype: z.enum(ASSET_SUBTYPES.artwork),
    answers: ArtworkAnswersSchema,
  }),
]);

interface CapabilityBoundData {
  readonly category: AssetCategory;
  readonly subtype: AssetSubtype;
  readonly capabilities: AssetCapabilities;
}

function validateResolvedCapabilities(value: CapabilityBoundData, context: z.RefinementCtx): void {
  const resolved = resolveCapabilities(value.category, value.subtype);

  for (const capability of ASSET_CAPABILITY_IDS) {
    if (value.capabilities[capability] !== resolved[capability]) {
      context.addIssue({
        code: "custom",
        path: ["capabilities", capability],
        message: `Capability "${capability}" does not match category "${value.category}" and subtype "${value.subtype}".`,
      });
    }
  }
}

export const CategoryProfileSchema = CategoryProfileUnionSchema.superRefine((value, context) => {
  validateResolvedCapabilities(value, context);
  validateCategoryDataCapabilities(value, "defaults", context);
});

export const AssetProfileSchema = AssetProfileUnionSchema.superRefine((value, context) => {
  validateResolvedCapabilities(value, context);
  validateCategoryDataCapabilities(value, "answers", context);
  if ((value.migratedFromVersion === 1) !== (value.legacyData !== undefined)) {
    context.addIssue({
      code: "custom",
      path: value.legacyData === undefined ? ["legacyData"] : ["migratedFromVersion"],
      message: "Migrated asset profiles require both migratedFromVersion and legacyData.",
    });
  }
});

export function parseBaseProfile(input: unknown): BaseProfile {
  return BaseProfileSchema.parse(input);
}

export function parseCategoryProfile(input: unknown): CategoryProfile {
  return CategoryProfileSchema.parse(input);
}

export function parseAssetProfile(input: unknown): AssetProfile {
  return AssetProfileSchema.parse(input);
}

export type BaseProfile = z.infer<typeof BaseProfileSchema>;
export type CategoryProfile = z.infer<typeof CategoryProfileSchema>;
export type AssetProfile = z.infer<typeof AssetProfileSchema>;
