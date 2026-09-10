import { z } from "zod";

import { ASSET_CATEGORY_IDS, ASSET_SUBTYPES } from "../domain/assets";
import { BaseProfileLocksSchema, BaseProfileValuesSchema } from "./common.schema";

export const V3_SCHEMA_VERSION = 3 as const;

export const V3DocumentIdSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

export const VaultRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:/.test(value) &&
      !value.includes("\\") &&
      !value.includes("\0") &&
      value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "Expected a portable path relative to the active vault.",
  );

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const TimestampSchema = z.iso.datetime();
const RevisionSchema = z.number().int().min(1);
const JsonObjectSchema = z.record(z.string(), z.json());

export const PixelStudioVaultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("pixelStudioVault"),
  vaultId: V3DocumentIdSchema,
  createdAt: TimestampSchema,
});

export const VaultBaseProfileSchema = z.strictObject({
  schemaVersion: z.literal(V3_SCHEMA_VERSION),
  kind: z.literal("vaultBaseProfile"),
  id: V3DocumentIdSchema,
  revision: RevisionSchema,
  name: z.string().trim().min(1).max(120),
  values: BaseProfileValuesSchema,
  locks: BaseProfileLocksSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const WizardPositionSchema = z.strictObject({
  currentStepId: z.string().min(1).max(100),
  completedStepIds: z
    .array(z.string().min(1).max(100))
    .max(256)
    .refine((values) => new Set(values).size === values.length, "Step IDs must be unique."),
});

export const VaultPromptDraftSchema = z.strictObject({
  schemaVersion: z.literal(V3_SCHEMA_VERSION),
  kind: z.literal("vaultPromptDraft"),
  draftId: V3DocumentIdSchema,
  profileId: V3DocumentIdSchema.nullable(),
  revision: RevisionSchema,
  identity: z.strictObject({
    name: z.string().max(1000),
    category: z.enum(ASSET_CATEGORY_IDS).nullable(),
    subtype: z.string().max(1000).nullable(),
  }),
  rawValues: JsonObjectSchema,
  wizard: WizardPositionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const PromptOutputFileSchema = z.strictObject({
  relativePath: VaultRelativePathSchema,
  style: z.enum(["classic", "dark"]),
  language: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  part: z.enum(["main", "negative", "technical", "combined"]),
  sha256: Sha256Schema,
});

export const VaultPromptProfileEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(V3_SCHEMA_VERSION),
    kind: z.literal("vaultPromptProfile"),
    id: V3DocumentIdSchema,
    revision: RevisionSchema,
    draftRevision: RevisionSchema,
    name: z.string().trim().min(1).max(120),
    folderName: z
      .string()
      .min(1)
      .max(120)
      .refine((value) => !/[\\/\0]/.test(value), "Folder names may not contain separators."),
    category: z.enum(ASSET_CATEGORY_IDS),
    subtype: z.string().trim().min(1).max(80),
    baseProfileId: V3DocumentIdSchema.nullable(),
    catalogVersion: z.string().min(1).max(80),
    status: z.enum(["incomplete", "ready"]),
    answers: JsonObjectSchema,
    /**
     * Lossless wizard state. `answers` remains the canonical, validated domain
     * snapshot while this object keeps incomplete form input recoverable.
     */
    rawValues: JsonObjectSchema.optional(),
    wizard: WizardPositionSchema,
    outputSelection: z.strictObject({
      styles: z
        .array(z.enum(["classic", "dark"]))
        .min(1)
        .max(2)
        .refine((values) => new Set(values).size === values.length, "Styles must be unique."),
      languages: z
        .array(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/))
        .min(1)
        .max(16)
        .refine((values) => new Set(values).size === values.length, "Languages must be unique."),
    }),
    outputs: z.strictObject({
      status: z.enum(["none", "fresh", "stale", "error"]),
      generatedFrom: z
        .strictObject({
          draftRevision: RevisionSchema,
          baseRevision: RevisionSchema,
          generatorVersion: z.string().min(1).max(80),
        })
        .nullable(),
      files: z.array(PromptOutputFileSchema).max(256),
    }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .superRefine((profile, context) => {
    if (!(ASSET_SUBTYPES[profile.category] as readonly string[]).includes(profile.subtype)) {
      context.addIssue({
        code: "custom",
        path: ["subtype"],
        message: `Subtype ${profile.subtype} does not belong to ${profile.category}.`,
      });
    }
    if (profile.status === "ready" && profile.baseProfileId === null) {
      context.addIssue({
        code: "custom",
        path: ["baseProfileId"],
        message: "A ready profile requires the vault base profile.",
      });
    }
    if (profile.outputs.status === "fresh" && profile.outputs.generatedFrom === null) {
      context.addIssue({
        code: "custom",
        path: ["outputs", "generatedFrom"],
        message: "Fresh outputs require a generation reference.",
      });
    }
    const outputKeys = profile.outputs.files.map(
      (file) => `${file.style}:${file.language}:${file.part}`,
    );
    if (new Set(outputKeys).size !== outputKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["outputs", "files"],
        message: "Every output tuple must be unique.",
      });
    }
  });

export {
  SPRITE_PART_IDS,
  REQUIRED_SPRITE_PART_IDS,
  SpritePartIdSchema,
  CutoutProjectEnvelopeSchema,
  SpritePartsEnvelopeSchema,
  SpriteSceneEnvelopeSchema,
  type CutoutProjectEnvelope,
  type SpritePartsEnvelope,
  type SpriteSceneEnvelope,
} from "../../shared/image/contracts";

export const GlobalSettingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("globalSettings"),
  theme: z.enum(["system", "light", "dark"]),
  uiLanguage: z.enum(["de", "en"]),
  density: z.enum(["compact", "comfortable"]),
  windowState: z
    .strictObject({ width: z.number().int().min(480), height: z.number().int().min(360) })
    .optional(),
});

export type PixelStudioVault = z.infer<typeof PixelStudioVaultSchema>;
export type VaultBaseProfile = z.infer<typeof VaultBaseProfileSchema>;
export type VaultPromptDraft = z.infer<typeof VaultPromptDraftSchema>;
export type VaultPromptProfile = z.infer<typeof VaultPromptProfileEnvelopeSchema>;
export type PromptOutputFile = z.infer<typeof PromptOutputFileSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
