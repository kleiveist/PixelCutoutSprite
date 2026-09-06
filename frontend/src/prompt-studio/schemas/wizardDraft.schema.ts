import { z } from "zod";
import { ASSET_SUBTYPES } from "../domain/assets";
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
  BaseProfileOverridesSchema,
  IsoDateTimeSchema,
  SchemaVersionSchema,
  StableIdSchema,
  ValidationMessagesSchema,
} from "./common.schema";

const WizardDraftMetadataSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("wizardDraft"),
  draftId: StableIdSchema,
  projectName: z.string().trim().max(120),
  currentStep: z.string().min(1).max(100),
  validation: ValidationMessagesSchema,
  savedAt: IsoDateTimeSchema,
});

const EarlyWizardDraftSchema = WizardDraftMetadataSchema.extend({
  route: z.enum(["wizard/project", "wizard/category"]),
});

const SelectedWizardDraftCommonSchema = WizardDraftMetadataSchema.extend({
  route: z.enum(["wizard/profile", "wizard/editor", "wizard/review"]),
  baseProfileId: StableIdSchema.optional(),
  categoryProfileId: StableIdSchema.optional(),
  sourceAssetProfileId: StableIdSchema.optional(),
  overrides: BaseProfileOverridesSchema.optional(),
});

const SelectedWizardDraftSchema = z.discriminatedUnion("category", [
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("character"),
    subtype: z.enum(ASSET_SUBTYPES.character),
    answers: CharacterAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("movingObject"),
    subtype: z.enum(ASSET_SUBTYPES.movingObject),
    answers: MovingObjectAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("staticObject"),
    subtype: z.enum(ASSET_SUBTYPES.staticObject),
    answers: StaticObjectAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("texture"),
    subtype: z.enum(ASSET_SUBTYPES.texture),
    answers: TextureAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("nature"),
    subtype: z.enum(ASSET_SUBTYPES.nature),
    answers: NatureAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("building"),
    subtype: z.enum(ASSET_SUBTYPES.building),
    answers: BuildingAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("tileset"),
    subtype: z.enum(ASSET_SUBTYPES.tileset),
    answers: TilesetAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("item"),
    subtype: z.enum(ASSET_SUBTYPES.item),
    answers: ItemAnswersSchema,
  }),
  SelectedWizardDraftCommonSchema.extend({
    category: z.literal("artwork"),
    subtype: z.enum(ASSET_SUBTYPES.artwork),
    answers: ArtworkAnswersSchema,
  }),
]);

export const WizardDraftSchema = z
  .union([EarlyWizardDraftSchema, SelectedWizardDraftSchema])
  .superRefine((value, context) => {
    if (!("category" in value)) return;

    validateCategoryDataCapabilities(value, "answers", context);
    if (!value.projectName) {
      context.addIssue({
        code: "custom",
        path: ["projectName"],
        message: "A project name is required after category selection.",
      });
    }
    if (value.route !== "wizard/profile" && value.baseProfileId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["baseProfileId"],
        message: "Editor and review drafts require a base profile.",
      });
    }
  });

export function parseWizardDraft(input: unknown): WizardDraft {
  return WizardDraftSchema.parse(input);
}

export type WizardDraft = z.infer<typeof WizardDraftSchema>;
