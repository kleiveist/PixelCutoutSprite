import catalog from "./sprite-parts.catalog.json" with { type: "json" };
import drawOrder from "./sprite-default-z.json" with { type: "json" };
import type { PartId } from "./contracts";

export interface PartDefinition {
  partId: PartId;
  group: string;
  label: string;
  file: string;
  required: boolean;
  parentId: PartId | null;
}
export const PARTS = catalog.parts as readonly PartDefinition[];
export const PART_GROUPS = catalog.groups as readonly {
  id: string;
  label: string;
  slots: readonly (readonly PartId[])[];
}[];
export function partDefinition(id: PartId): PartDefinition {
  return PARTS.find((part) => part.partId === id)!;
}
// Draw order is explicit and is not the PNG numbering. Larger values are in front.
const BACK_TO_FRONT = drawOrder as readonly PartId[];
export const defaultZ = (id: PartId) => BACK_TO_FRONT.indexOf(id);
