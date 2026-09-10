import { z } from "zod";
import { Sha256Schema, SpritePartIdSchema, V3DocumentIdSchema } from "../shared/image/contracts";
import { MaskSchema, type Mask } from "./masks";
import type { PartId } from "../shared/image/contracts";

export const SelectionParametersSchema = z.strictObject({
  alphaThreshold: z.number().int().min(1).max(255),
  tolerance: z.number().int().min(0).max(255),
  edgeWeight: z.number().int().min(0).max(8),
});
export type SelectionParameters = z.infer<typeof SelectionParametersSchema>;
export const DEFAULT_SELECTION_PARAMETERS: SelectionParameters = {
  alphaThreshold: 1,
  tolerance: 40,
  edgeWeight: 4,
};
export interface RefineRequest {
  readonly jobId: string;
  readonly projectPath: string;
  readonly sourceHash: string;
  readonly partId: PartId;
  readonly maskRevision: number;
  readonly mask: Mask;
  readonly parameters: SelectionParameters;
}
export const RefineJobSchema = z.strictObject({
  jobId: V3DocumentIdSchema,
  sourceHash: Sha256Schema,
  partId: SpritePartIdSchema,
  maskRevision: z.number().int().nonnegative(),
  progress: z.number().int().min(0).max(100),
  status: z.enum(["running", "cancelling", "completed", "cancelled", "failed"]),
  result: z
    .strictObject({
      draft: MaskSchema.shape.draft.nullable(),
      advice: z.string().max(2000),
      uncertain: z.boolean(),
      selectedPixels: z.number().int().nonnegative(),
      examinedPixels: z.number().int().nonnegative(),
      elapsedMs: z.number().int().nonnegative(),
      estimatedWorkingBytes: z.number().int().nonnegative(),
    })
    .nullable(),
  error: z.string().max(2000).nullable(),
});
export type RefineJobSnapshot = z.infer<typeof RefineJobSchema>;
