import { z } from "zod";
import { profileValuesEqual, resolveProfile } from "../domain/profiles";
import { AppSettingsSchema } from "./appSettings.schema";
import { IsoDateTimeSchema, SchemaVersionSchema, StableIdSchema } from "./common.schema";
import {
  AssetProfileSchema,
  BaseProfileSchema,
  CategoryProfileSchema,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
} from "./profiles.schema";
import { WizardDraftSchema } from "./wizardDraft.schema";

export const BaseProfileCollectionSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("baseProfileCollection"),
  profiles: z.array(BaseProfileSchema).max(500).readonly(),
});

export const CategoryProfileCollectionSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("categoryProfileCollection"),
  profiles: z.array(CategoryProfileSchema).max(2000).readonly(),
});

export const AssetProfileCollectionSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("assetProfileCollection"),
  profiles: z.array(AssetProfileSchema).max(10_000).readonly(),
});

interface ProfileGraph {
  readonly baseProfiles: readonly BaseProfile[];
  readonly categoryProfiles: readonly CategoryProfile[];
  readonly assetProfiles: readonly AssetProfile[];
}

function addDuplicateIdIssues(
  profiles: readonly { readonly id: string }[],
  path: "baseProfiles" | "categoryProfiles" | "assetProfiles",
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();

  profiles.forEach((profile, index) => {
    if (seen.has(profile.id)) {
      context.addIssue({
        code: "custom",
        path: [path, index, "id"],
        message: `Duplicate ${path} id "${profile.id}".`,
      });
    }
    seen.add(profile.id);
  });
}

export function validateProfileGraph(value: ProfileGraph, context: z.RefinementCtx): void {
  addDuplicateIdIssues(value.baseProfiles, "baseProfiles", context);
  addDuplicateIdIssues(value.categoryProfiles, "categoryProfiles", context);
  addDuplicateIdIssues(value.assetProfiles, "assetProfiles", context);

  const baseProfiles = new Map(value.baseProfiles.map((profile) => [profile.id, profile]));
  const categoryProfiles = new Map(value.categoryProfiles.map((profile) => [profile.id, profile]));

  value.categoryProfiles.forEach((profile, index) => {
    const baseProfile = baseProfiles.get(profile.baseProfileId);
    if (!baseProfile) {
      context.addIssue({
        code: "custom",
        path: ["categoryProfiles", index, "baseProfileId"],
        message: `Missing base profile "${profile.baseProfileId}".`,
      });
      return;
    }

    for (const key of Object.keys(profile.overrides) as Array<keyof typeof profile.overrides>) {
      const attemptedValue = profile.overrides[key];
      const inheritedValue = baseProfile.values[key];
      if (
        attemptedValue !== undefined &&
        baseProfile.locks[key] === true &&
        !profileValuesEqual(attemptedValue, inheritedValue)
      ) {
        context.addIssue({
          code: "custom",
          path: ["categoryProfiles", index, "overrides", key],
          message: `Category override conflicts with locked Base value "${key}".`,
        });
      }
    }

    const effectiveCharacterHeight =
      profile.overrides.characterHeight ?? baseProfile.values.characterHeight;
    if (profile.capabilities.scaledCharacter && effectiveCharacterHeight === undefined) {
      context.addIssue({
        code: "custom",
        path: ["categoryProfiles", index, "baseProfileId"],
        message: "Scaled-character Category profile requires an effective characterHeight.",
      });
    }
  });

  value.assetProfiles.forEach((profile, index) => {
    const baseProfile = baseProfiles.get(profile.baseProfileId);
    const categoryProfile = profile.categoryProfileId
      ? categoryProfiles.get(profile.categoryProfileId)
      : undefined;

    if (!baseProfile) {
      context.addIssue({
        code: "custom",
        path: ["assetProfiles", index, "baseProfileId"],
        message: `Missing base profile "${profile.baseProfileId}".`,
      });
    }

    if (profile.categoryProfileId && !categoryProfile) {
      context.addIssue({
        code: "custom",
        path: ["assetProfiles", index, "categoryProfileId"],
        message: `Missing category profile "${profile.categoryProfileId}".`,
      });
    }

    if (!baseProfile || (profile.categoryProfileId && !categoryProfile)) return;

    const resolution = resolveProfile({ baseProfile, categoryProfile, assetProfile: profile });
    if (resolution.status === "conflict") {
      for (const conflict of resolution.conflicts) {
        context.addIssue({
          code: "custom",
          path: ["assetProfiles", index],
          message: `Profile resolution conflict "${conflict.code}".`,
        });
      }
      return;
    }

    if (profile.compatibilityKey !== resolution.profile.compatibilityKey) {
      context.addIssue({
        code: "custom",
        path: ["assetProfiles", index, "compatibilityKey"],
        message: "Stored compatibility key does not match the resolved profile values.",
      });
    }
  });
}

export const ProfileLibrarySchema = z
  .strictObject({
    baseProfiles: z.array(BaseProfileSchema).max(500).readonly(),
    categoryProfiles: z.array(CategoryProfileSchema).max(2000).readonly(),
    assetProfiles: z.array(AssetProfileSchema).max(10_000).readonly(),
  })
  .superRefine(validateProfileGraph);

const MigrationBackupSourceSchema = z.strictObject({
  key: z.enum(["pixelart-prompt-studio:autosave:v1", "pixelart-prompt-studio:presets:v1"]),
  rawValue: z.string(),
  fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
});

const MigrationBackupCommonSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("migrationBackup"),
  migrationVersion: z.literal(1),
  startedAt: IsoDateTimeSchema,
  sources: z.array(MigrationBackupSourceSchema).min(1).max(2).readonly(),
});

export const MigrationBackupSchema = z
  .discriminatedUnion("status", [
    MigrationBackupCommonSchema.extend({ status: z.literal("prepared") }),
    MigrationBackupCommonSchema.extend({
      status: z.literal("completed"),
      completedAt: IsoDateTimeSchema,
      warnings: z.array(z.string().min(1).max(2000)).max(100).readonly(),
      createdIds: z
        .strictObject({
          baseProfileIds: z.array(StableIdSchema).max(500).readonly(),
          categoryProfileIds: z.array(StableIdSchema).max(2000).readonly(),
          assetProfileIds: z.array(StableIdSchema).max(10_000).readonly(),
        })
        .readonly(),
    }),
  ])
  .superRefine((backup, context) => {
    const keys = new Set<string>();
    backup.sources.forEach((source, index) => {
      if (keys.has(source.key)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "key"],
          message: `Duplicate migration source "${source.key}".`,
        });
      }
      keys.add(source.key);
    });
  });

export const WizardDraftCollectionSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    kind: z.literal("wizardDraftCollection"),
    drafts: z.array(WizardDraftSchema).max(100).readonly(),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.drafts.forEach((draft, index) => {
      if (seen.has(draft.draftId)) {
        context.addIssue({
          code: "custom",
          path: ["drafts", index, "draftId"],
          message: `Duplicate wizard draft id "${draft.draftId}".`,
        });
      }
      seen.add(draft.draftId);
    });
  });

export const PersistedAppSettingsSchema = AppSettingsSchema;

export type ProfileLibrary = z.infer<typeof ProfileLibrarySchema>;
export type MigrationBackup = z.infer<typeof MigrationBackupSchema>;
export type WizardDraftCollection = z.infer<typeof WizardDraftCollectionSchema>;
