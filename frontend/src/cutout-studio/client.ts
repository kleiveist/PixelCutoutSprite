import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  CutoutProjectEnvelopeSchema,
  Sha256Schema,
  VaultRelativePathSchema,
  type PartId,
} from "../shared/image/contracts";
import type { SessionIdentity } from "../shared/storage";
import { MaskSchema, validateRuns, type Mask } from "./masks";
import {
  RefineJobSchema,
  type RefineJobSnapshot,
  type RefineRequest,
  type SelectionParameters,
} from "./assistance";

export const LoadedCutoutSchema = z
  .strictObject({
    projectPath: VaultRelativePathSchema,
    project: CutoutProjectEnvelopeSchema,
    sha256: Sha256Schema,
    masks: z.record(z.string(), MaskSchema),
    persisted: z.boolean(),
  })
  .superRefine((loaded, context) => {
    const pixels = loaded.project.source.width * loaded.project.source.height;
    let count = 0;
    for (const part of loaded.project.parts) {
      const mask = loaded.masks[part.partId];
      if (!mask) {
        context.addIssue({ code: "custom", message: `Fehlende Maske: ${part.partId}` });
        continue;
      }
      for (const runs of [
        mask.draft,
        mask.confirmed,
        mask.roi,
        mask.positive,
        mask.negative,
        mask.protected,
      ]) {
        count += runs.length;
        if (!validateRuns(runs, pixels))
          context.addIssue({ code: "custom", message: "Ungültige Maskenläufe." });
      }
    }
    if (
      pixels > 16 * 1024 * 1024 ||
      count > 1_000_000 ||
      Object.keys(loaded.masks).length !== loaded.project.parts.length
    )
      context.addIssue({
        code: "custom",
        message: "Projekt überschreitet das Bild-/Maskenbudget.",
      });
  });
export type LoadedCutout = z.infer<typeof LoadedCutoutSchema>;
export interface PartEdit {
  readonly partId: PartId;
  readonly status: LoadedCutout["project"]["parts"][number]["status"];
  readonly reason: string | null;
  readonly mask: Mask;
  readonly selectionParameters: SelectionParameters;
}
export interface SaveCutoutRequest {
  readonly projectPath: string;
  readonly expectedRevision: number;
  readonly expectedSha256: string;
  readonly activePartId: PartId;
  readonly detachOriginal?: boolean;
  readonly parts: readonly PartEdit[];
}
export interface CutoutClient {
  openSet(
    session: SessionIdentity,
    directory: string,
    manifestSha256: string,
  ): Promise<LoadedCutout>;
  previewGeneration(
    session: SessionIdentity,
    projectPath: string,
    expectedSha256: string,
  ): Promise<GenerationTarget>;
  generate(session: SessionIdentity, request: GenerateRequest): Promise<GeneratedCutout>;
  open(
    session: SessionIdentity,
    relativePath: string,
    expectedSha256: string,
    writable: boolean,
  ): Promise<LoadedCutout>;
  pixels(session: SessionIdentity, loaded: LoadedCutout): Promise<Uint8ClampedArray>;
  save(session: SessionIdentity, request: SaveCutoutRequest): Promise<LoadedCutout>;
  startRefine(session: SessionIdentity, request: RefineRequest): Promise<string>;
  refineProgress(session: SessionIdentity, jobId: string): Promise<RefineJobSnapshot>;
  cancelRefine(session: SessionIdentity, jobId: string): Promise<void>;
}
export const GenerationTargetSchema = z.strictObject({
  directory: VaultRelativePathSchema,
  alternative: z.boolean(),
  existing: z.boolean(),
});
export type GenerationTarget = z.infer<typeof GenerationTargetSchema>;
export const GeneratedCutoutSchema = z.strictObject({
  loaded: LoadedCutoutSchema,
  directory: VaultRelativePathSchema,
  manifestSha256: Sha256Schema,
  generationId: z.string().min(3),
  complete: z.boolean(),
  partCount: z.number().int().min(1).max(18),
});
export type GeneratedCutout = z.infer<typeof GeneratedCutoutSchema>;
export interface GenerateRequest {
  readonly projectPath: string;
  readonly expectedRevision: number;
  readonly expectedSha256: string;
  readonly directory: string;
  readonly padding: number;
}
const args = (session: SessionIdentity) => ({
  sessionId: session.sessionId,
  sessionGeneration: session.generation,
});
export const nativeCutoutClient: CutoutClient = {
  openSet: async (session, directory, expectedManifestSha256) =>
    LoadedCutoutSchema.parse(
      await invoke("open_cutout_set", { ...args(session), directory, expectedManifestSha256 }),
    ),
  previewGeneration: async (session, projectPath, expectedSha256) =>
    GenerationTargetSchema.parse(
      await invoke("preview_cutout_generation", { ...args(session), projectPath, expectedSha256 }),
    ),
  generate: async (session, request) =>
    GeneratedCutoutSchema.parse(
      await invoke("generate_cutout_parts", { ...args(session), request }),
    ),
  open: async (session, relativePath, expectedSha256, writable) =>
    LoadedCutoutSchema.parse(
      await invoke("open_cutout_source", {
        ...args(session),
        relativePath,
        expectedSha256,
        writable,
      }),
    ),
  pixels: async (session, loaded) => {
    const result = await invoke<ArrayBuffer | number[]>("read_cutout_pixels", {
      ...args(session),
      relativePath: loaded.persisted
        ? loaded.project.source.snapshotPath
        : loaded.project.source.originalPath,
      expectedSha256: loaded.persisted
        ? loaded.project.source.sha256
        : loaded.project.source.originalSha256,
      projectPath: loaded.persisted ? loaded.projectPath : null,
    });
    const bytes = new Uint8ClampedArray(result);
    if (bytes.length !== loaded.project.source.width * loaded.project.source.height * 4)
      throw new Error("Die Bilddaten sind unvollständig.");
    return bytes;
  },
  save: async (session, request) =>
    LoadedCutoutSchema.parse(await invoke("save_cutout_project", { ...args(session), request })),
  startRefine: (session, request) => invoke("start_cutout_refine", { ...args(session), request }),
  refineProgress: async (session, jobId) =>
    RefineJobSchema.parse(await invoke("get_cutout_refine_progress", { ...args(session), jobId })),
  cancelRefine: (session, jobId) => invoke("cancel_cutout_refine", { ...args(session), jobId }),
};
