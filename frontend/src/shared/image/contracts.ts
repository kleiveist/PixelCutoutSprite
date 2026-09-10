import { z } from "zod";
import catalog from "./sprite-parts.catalog.json" with { type: "json" };

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
    if (
      manifest.source.width * manifest.source.height > 16 * 1024 * 1024 ||
      !!manifest.source.originalPath !== !!manifest.source.originalSha256
    )
      context.addIssue({ code: "custom", message: "Ungültiger Quellbildvertrag." });
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
      if (
        part.file !== catalog.parts.find((entry) => entry.partId === part.partId)?.file ||
        part.sourceRect.x + part.sourceRect.width > manifest.source.width ||
        part.sourceRect.y + part.sourceRect.height > manifest.source.height
      )
        context.addIssue({
          code: "custom",
          path: ["parts", index],
          message: "Ungültiger Dateiname oder Ausschnitt außerhalb der Quelle.",
        });
    }
    manifest.omittedParts.forEach((part, index) => {
      if (
        included.has(part.partId) ||
        omitted.has(part.partId) ||
        !REQUIRED_SPRITE_PART_IDS.includes(part.partId) ||
        !part.reason.trim()
      ) {
        context.addIssue({
          code: "custom",
          path: ["omittedParts", index, "partId"],
          message: "Omitted parts must be unique and not generated.",
        });
      }
      omitted.add(part.partId);
    });
    if (
      manifest.complete !== (omitted.size === 0) ||
      REQUIRED_SPRITE_PART_IDS.some((partId) => !included.has(partId) && !omitted.has(partId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["complete"],
        message: "A complete set contains all required parts.",
      });
    }
    for (const part of manifest.parts) {
      const seen = new Set<PartId>();
      let cursor: PartId | null = part.partId;
      while (cursor) {
        if (seen.has(cursor)) {
          context.addIssue({ code: "custom", message: "Zyklischer Elternverweis." });
          break;
        }
        seen.add(cursor);
        cursor = manifest.parts.find((part) => part.partId === cursor)?.parentId ?? null;
      }
    }
  });

const SpriteLayerSchema = z.strictObject({
  partId: SpritePartIdSchema,
  position: PointSchema,
  pivot: PointSchema,
  rotationDeg: z.number().finite().min(-360_000).max(360_000),
  scale: z.strictObject({
    x: z.number().finite().min(0.01).max(100),
    y: z.number().finite().min(0.01).max(100),
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

export type PartId = z.infer<typeof SpritePartIdSchema>;
export type SourceImage = z.infer<typeof SourceImageSchema>;
export type CutoutProjectEnvelope = z.infer<typeof CutoutProjectEnvelopeSchema>;
export type SpritePartsEnvelope = z.infer<typeof SpritePartsEnvelopeSchema>;
export type SpriteSceneEnvelope = z.infer<typeof SpriteSceneEnvelopeSchema>;
