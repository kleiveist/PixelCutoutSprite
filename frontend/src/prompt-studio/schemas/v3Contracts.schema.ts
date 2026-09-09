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

export const SPRITE_PART_IDS = Object.freeze([
  "head",
  "torso",
  "pelvis",
  "upper_arm_l",
  "forearm_l",
  "hand_l",
  "upper_arm_r",
  "forearm_r",
  "hand_r",
  "thigh_r",
  "shin_r",
  "foot_r",
  "thigh_l",
  "shin_l",
  "foot_l",
  "cape",
  "belt_accessory",
  "sword",
  "hair",
] as const);

export const REQUIRED_SPRITE_PART_IDS = Object.freeze(SPRITE_PART_IDS.slice(0, 15));
export const SpritePartIdSchema = z.enum(SPRITE_PART_IDS);

const SourceImageSchema = z.strictObject({
  originalPath: VaultRelativePathSchema.optional(),
  originalSha256: Sha256Schema.optional(),
  snapshotPath: VaultRelativePathSchema,
  sha256: Sha256Schema,
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
});

const PointSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() });
const SourceRectSchema = z.strictObject({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

function addUniquePartIssues(
  values: readonly { readonly partId: string }[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.partId)) {
      context.addIssue({
        code: "custom",
        path: [index, "partId"],
        message: `Part ${value.partId} occurs more than once.`,
      });
    }
    seen.add(value.partId);
  });
  if (seen.has("belt_accessory") && seen.has("sword")) {
    context.addIssue({
      code: "custom",
      message: "The accessory slot accepts a belt accessory or a sword, not both.",
    });
  }
}

const CutoutPartSchema = z
  .strictObject({
    partId: SpritePartIdSchema,
    status: z.enum(["unmarked", "editing", "confirmed", "not_present", "disabled"]),
    maskRevision: z.number().int().min(0),
    maskPath: VaultRelativePathSchema.nullable(),
    maskSha256: Sha256Schema.nullable(),
    protectedOverlapMaskPath: VaultRelativePathSchema.nullable().optional(),
    selectionParameters: JsonObjectSchema.optional(),
    reason: z.string().max(500).nullable().optional(),
  })
  .superRefine((part, context) => {
    if ((part.maskPath === null) !== (part.maskSha256 === null)) {
      context.addIssue({
        code: "custom",
        path: ["maskPath"],
        message: "Mask path and hash must both exist or both be null.",
      });
    }
    if (part.status === "confirmed" && part.maskPath === null) {
      context.addIssue({
        code: "custom",
        path: ["maskPath"],
        message: "A confirmed part requires a persisted mask.",
      });
    }
  });

export const CutoutProjectEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal("cutoutProject"),
    id: V3DocumentIdSchema,
    revision: RevisionSchema,
    source: SourceImageSchema,
    activePartId: SpritePartIdSchema,
    parts: z.array(CutoutPartSchema).min(15).max(18),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .superRefine((project, context) => {
    addUniquePartIssues(project.parts, context);
    const present = new Set(project.parts.map((part) => part.partId));
    for (const partId of REQUIRED_SPRITE_PART_IDS) {
      if (!present.has(partId)) {
        context.addIssue({ code: "custom", path: ["parts"], message: `Missing ${partId}.` });
      }
    }
  });

const SpritePartSchema = z.strictObject({
  partId: SpritePartIdSchema,
  file: VaultRelativePathSchema,
  sha256: Sha256Schema,
  sourceRect: SourceRectSchema,
  pivot: PointSchema,
  defaultPosition: PointSchema,
  defaultZ: z.number().int(),
  parentId: SpritePartIdSchema.nullable(),
});

export const SpritePartsEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal("spriteParts"),
    setId: V3DocumentIdSchema,
    generationId: V3DocumentIdSchema,
    cutoutRevision: RevisionSchema,
    source: SourceImageSchema,
    complete: z.boolean(),
    parts: z.array(SpritePartSchema).min(1).max(18),
    omittedParts: z
      .array(z.strictObject({ partId: SpritePartIdSchema, reason: z.string().min(1).max(500) }))
      .max(15),
    createdAt: TimestampSchema,
  })
  .superRefine((manifest, context) => {
    addUniquePartIssues(manifest.parts, context);
    const included = new Set(manifest.parts.map((part) => part.partId));
    const omitted = new Set<string>();
    for (const [index, part] of manifest.parts.entries()) {
      if (
        part.defaultPosition.x !== part.sourceRect.x + part.pivot.x ||
        part.defaultPosition.y !== part.sourceRect.y + part.pivot.y
      ) {
        context.addIssue({
          code: "custom",
          path: ["parts", index, "defaultPosition"],
          message: "Default position must equal source origin plus pivot.",
        });
      }
      if (part.parentId === part.partId) {
        context.addIssue({
          code: "custom",
          path: ["parts", index, "parentId"],
          message: "A part cannot parent itself.",
        });
      }
    }
    manifest.omittedParts.forEach((part, index) => {
      if (included.has(part.partId) || omitted.has(part.partId)) {
        context.addIssue({
          code: "custom",
          path: ["omittedParts", index, "partId"],
          message: "Omitted parts must be unique and not generated.",
        });
      }
      omitted.add(part.partId);
    });
    if (manifest.complete && REQUIRED_SPRITE_PART_IDS.some((partId) => !included.has(partId))) {
      context.addIssue({
        code: "custom",
        path: ["complete"],
        message: "A complete set contains all required parts.",
      });
    }
  });

const SpriteLayerSchema = z.strictObject({
  partId: SpritePartIdSchema,
  position: PointSchema,
  pivot: PointSchema,
  rotationDeg: z.number().finite().min(-360_000).max(360_000),
  scale: z.strictObject({
    x: z.number().finite().positive().max(100),
    y: z.number().finite().positive().max(100),
  }),
  zIndex: z.number().int(),
  visible: z.boolean(),
  locked: z.boolean(),
});

export const SpriteSceneEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal("spriteScene"),
    id: V3DocumentIdSchema,
    revision: RevisionSchema,
    setId: V3DocumentIdSchema,
    generationId: V3DocumentIdSchema,
    blendMode: z.literal("source-over"),
    pixelSnap: z.boolean(),
    layers: z.array(SpriteLayerSchema).min(1).max(18),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .superRefine((scene, context) => addUniquePartIssues(scene.layers, context));

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
export type CutoutProjectEnvelope = z.infer<typeof CutoutProjectEnvelopeSchema>;
export type SpritePartsEnvelope = z.infer<typeof SpritePartsEnvelopeSchema>;
export type SpriteSceneEnvelope = z.infer<typeof SpriteSceneEnvelopeSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
