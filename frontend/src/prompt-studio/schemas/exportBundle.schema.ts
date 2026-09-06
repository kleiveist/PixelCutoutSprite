import { z } from "zod";
import { EXPORT_APPLICATION_ID } from "../config";
import { AppSettingsSchema } from "./appSettings.schema";
import { IsoDateTimeSchema, SchemaVersionSchema, StableIdSchema } from "./common.schema";
import { AssetProfileSchema, BaseProfileSchema, CategoryProfileSchema } from "./profiles.schema";
import { validateProfileGraph } from "./storage.schema";
import { WizardDraftSchema } from "./wizardDraft.schema";

export const ExportBundleSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    formatVersion: z.literal(2),
    kind: z.literal("exportBundle"),
    application: z.literal(EXPORT_APPLICATION_ID),
    bundleId: StableIdSchema,
    exportedAt: IsoDateTimeSchema,
    baseProfiles: z.array(BaseProfileSchema).max(500).readonly(),
    categoryProfiles: z.array(CategoryProfileSchema).max(2000).readonly(),
    assetProfiles: z.array(AssetProfileSchema).max(10_000).readonly(),
    appSettings: AppSettingsSchema.optional(),
    wizardDrafts: z.array(WizardDraftSchema).max(100).readonly(),
  })
  .superRefine((bundle, context) => {
    validateProfileGraph(bundle, context);

    const baseProfileIds = new Set(bundle.baseProfiles.map((profile) => profile.id));
    const categoryProfiles = new Map(
      bundle.categoryProfiles.map((profile) => [profile.id, profile]),
    );
    const draftIds = new Set<string>();

    if (
      bundle.appSettings?.activeBaseProfileId &&
      !baseProfileIds.has(bundle.appSettings.activeBaseProfileId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["appSettings", "activeBaseProfileId"],
        message: `Missing active base profile "${bundle.appSettings.activeBaseProfileId}".`,
      });
    }

    bundle.wizardDrafts.forEach((draft, index) => {
      if (draftIds.has(draft.draftId)) {
        context.addIssue({
          code: "custom",
          path: ["wizardDrafts", index, "draftId"],
          message: `Duplicate wizard draft id "${draft.draftId}".`,
        });
      }
      draftIds.add(draft.draftId);

      if ("baseProfileId" in draft && draft.baseProfileId) {
        if (!baseProfileIds.has(draft.baseProfileId)) {
          context.addIssue({
            code: "custom",
            path: ["wizardDrafts", index, "baseProfileId"],
            message: `Missing base profile "${draft.baseProfileId}".`,
          });
        }
      }

      if ("categoryProfileId" in draft && draft.categoryProfileId) {
        const categoryProfile = categoryProfiles.get(draft.categoryProfileId);
        if (!categoryProfile) {
          context.addIssue({
            code: "custom",
            path: ["wizardDrafts", index, "categoryProfileId"],
            message: `Missing category profile "${draft.categoryProfileId}".`,
          });
        } else if (
          "category" in draft &&
          (categoryProfile.category !== draft.category || categoryProfile.subtype !== draft.subtype)
        ) {
          context.addIssue({
            code: "custom",
            path: ["wizardDrafts", index, "categoryProfileId"],
            message: "Wizard draft classification does not match its category profile.",
          });
        } else if (
          "baseProfileId" in draft &&
          draft.baseProfileId &&
          categoryProfile.baseProfileId !== draft.baseProfileId
        ) {
          context.addIssue({
            code: "custom",
            path: ["wizardDrafts", index, "categoryProfileId"],
            message:
              "Wizard draft Base and Category profile references do not share a profile chain.",
          });
        }
      }
    });
  });

export function parseExportBundle(input: unknown): ExportBundle {
  return ExportBundleSchema.parse(input);
}

export type ExportBundle = z.infer<typeof ExportBundleSchema>;
