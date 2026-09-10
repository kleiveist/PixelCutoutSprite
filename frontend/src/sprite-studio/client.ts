import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  SpritePartsEnvelopeSchema,
  SpriteSceneEnvelopeSchema,
  SpritePartIdSchema,
  Sha256Schema,
  VaultRelativePathSchema,
  type SpriteSceneEnvelope,
} from "../shared/image/contracts";
import { partDefinition } from "../shared/image/parts";
import type { SessionIdentity } from "../shared/storage";

const AssetSchema = z.strictObject({
  partId: SpritePartIdSchema,
  file: VaultRelativePathSchema,
  sha256: Sha256Schema,
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
});
export const SpriteReconciliationSchema = z.strictObject({
  previousGenerationId: z.string().min(3).max(128),
  addedParts: z.array(SpritePartIdSchema).max(18),
  removedParts: z.array(SpritePartIdSchema).max(18),
  geometryChangedParts: z.array(SpritePartIdSchema).max(18),
  sourceChanged: z.boolean(),
  geometryUnknown: z.boolean(),
});
export const LoadedSpriteSchema = z
  .strictObject({
    directory: VaultRelativePathSchema,
    sourceKind: z.enum(["manifest", "legacy"]),
    documentSha256: Sha256Schema,
    manifest: SpritePartsEnvelopeSchema.nullable(),
    assets: z.array(AssetSchema).min(1).max(18),
    scene: SpriteSceneEnvelopeSchema,
    sceneSha256: Sha256Schema.nullable(),
    basisSha256: Sha256Schema.nullable(),
    reconciliation: SpriteReconciliationSchema.nullable(),
    manualAlignment: z.boolean(),
    warnings: z.array(z.string().max(1000)).max(20),
  })
  .superRefine((loaded, context) => {
    const ids = new Set(loaded.assets.map((asset) => asset.partId));
    if (
      (loaded.sourceKind === "manifest") !== !!loaded.manifest ||
      loaded.manualAlignment !== (loaded.sourceKind === "legacy") ||
      ids.size !== loaded.assets.length ||
      (ids.has("sword") && ids.has("belt_accessory"))
    )
      context.addIssue({ code: "custom", message: "Ungültiger Sprite-Quellvertrag." });
    if (
      loaded.assets.some(
        (asset) =>
          asset.file !== partDefinition(asset.partId).file ||
          asset.width * asset.height > 16 * 1024 * 1024,
      ) ||
      loaded.assets.reduce((total, asset) => total + asset.width * asset.height, 0) >
        32 * 1024 * 1024
    )
      context.addIssue({
        code: "custom",
        message: "Ungültiger Teilenamen oder überschrittenes Bildbudget.",
      });
    if (
      loaded.scene.layers.length !== loaded.assets.length ||
      loaded.scene.layers.some(
        (layer) =>
          !ids.has(layer.partId) ||
          [layer.position.x, layer.position.y, layer.pivot.x, layer.pivot.y].some(
            (value) => Math.abs(value) > 10_000_000,
          ),
      )
    )
      context.addIssue({ code: "custom", message: "Szenenebenen passen nicht zu den Teilen." });
    const manifest = loaded.manifest;
    if (
      manifest &&
      (loaded.scene.setId !== manifest.setId ||
        loaded.scene.generationId !== manifest.generationId ||
        manifest.parts.length !== loaded.assets.length ||
        manifest.parts.some(
          (part) =>
            !loaded.assets.some(
              (asset) =>
                asset.partId === part.partId &&
                asset.file === part.file &&
                asset.sha256 === part.sha256 &&
                asset.width === part.sourceRect.width &&
                asset.height === part.sourceRect.height,
            ),
        ))
    )
      context.addIssue({
        code: "custom",
        message: "Manifest, Pixel und Szene sind nicht derselbe Stand.",
      });
  });
export type LoadedSprite = z.infer<typeof LoadedSpriteSchema>;
export type SpriteAsset = LoadedSprite["assets"][number];
export type SpriteSourceKind = LoadedSprite["sourceKind"];
export type SpritePixels = ReadonlyMap<string, Uint8ClampedArray>;
export type SpriteReconciliation = z.infer<typeof SpriteReconciliationSchema>;
export interface SaveSpriteRequest {
  readonly directory: string;
  readonly sourceKind: SpriteSourceKind;
  readonly expectedDocumentSha256: string;
  readonly expectedSceneSha256: string | null;
  readonly expectedBasisSha256: string | null;
  readonly expectedRevision: number | null;
  readonly acceptGeneration: boolean;
  readonly scene: SpriteSceneEnvelope;
}
export interface SpriteClient {
  current(
    session: SessionIdentity,
    directory: string,
    kind: SpriteSourceKind,
  ): Promise<LoadedSprite>;
  save(session: SessionIdentity, request: SaveSpriteRequest): Promise<LoadedSprite>;
  open(
    session: SessionIdentity,
    directory: string,
    kind: SpriteSourceKind,
    expectedSha256: string,
  ): Promise<LoadedSprite>;
  pixels(
    session: SessionIdentity,
    loaded: LoadedSprite,
    partId: string,
  ): Promise<Uint8ClampedArray>;
}
const args = (session: SessionIdentity) => ({
  sessionId: session.sessionId,
  sessionGeneration: session.generation,
});
export const nativeSpriteClient: SpriteClient = {
  current: async (session, directory, sourceKind) =>
    LoadedSpriteSchema.parse(
      await invoke("inspect_sprite_set", { ...args(session), directory, sourceKind }),
    ),
  save: async (session, request) =>
    LoadedSpriteSchema.parse(await invoke("save_sprite_scene", { ...args(session), request })),
  open: async (session, directory, sourceKind, expectedSha256) =>
    LoadedSpriteSchema.parse(
      await invoke("open_sprite_set", { ...args(session), directory, sourceKind, expectedSha256 }),
    ),
  pixels: async (session, loaded, partId) => {
    const bytes = await invoke<ArrayBuffer | number[]>("read_sprite_pixels", {
      ...args(session),
      directory: loaded.directory,
      sourceKind: loaded.sourceKind,
      expectedSha256: loaded.documentSha256,
      partId,
    });
    const pixels = new Uint8ClampedArray(bytes),
      asset = loaded.assets.find((asset) => asset.partId === partId);
    if (!asset || pixels.length !== asset.width * asset.height * 4)
      throw new Error("Sprite-Pixeldaten sind unvollständig.");
    return pixels;
  },
};
