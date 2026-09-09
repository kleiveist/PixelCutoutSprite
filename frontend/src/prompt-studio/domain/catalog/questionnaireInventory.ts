import { WizardCoreFormSchema } from "../../features/wizard/wizardSteps";
import { CharacterAnswersSchema } from "../../schemas/categoryData.schema";

export type CatalogPageId =
  | "identity"
  | "base"
  | "capabilities:conditional"
  | "character:details"
  | "character:animation"
  | "movingObject:details"
  | "movingObject:animation"
  | "texture:details"
  | "nature:details"
  | "staticObject:details"
  | "building:details"
  | "tileset:details"
  | "item:details"
  | "artwork:details";

const BASE_FIELDS = new Set([
  "baseProfileId",
  "pixelDensity",
  "styleProfile",
  "tileSize",
  "characterHeight",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
  "outlineStyle",
  "paletteMode",
  "backgroundMode",
  "alphaPadding",
  "nearestNeighbor",
  "lightingPolicy",
  "lightingNotes",
]);
const CHARACTER_FIELDS = new Set(Object.keys(CharacterAnswersSchema.unwrap().shape));
const CONDITIONAL_CAPABILITY_FIELDS = new Set([
  "directionCount",
  "animationAction",
  "animationType",
  "movementType",
  "seamless",
  "tileableAxes",
]);

function pageForField(field: string): CatalogPageId {
  if (field === "projectName" || field === "category" || field === "subtype") return "identity";
  if (BASE_FIELDS.has(field)) return "base";
  if (CONDITIONAL_CAPABILITY_FIELDS.has(field)) return "capabilities:conditional";
  if (field.startsWith("characterAnimation")) return "character:animation";
  if (field.startsWith("character")) return "character:details";
  if (CHARACTER_FIELDS.has(field)) return "character:details";
  if (field.startsWith("movingObjectAnimation")) return "movingObject:animation";
  if (field.startsWith("movingObject")) return "movingObject:details";
  for (const prefix of [
    "texture",
    "nature",
    "staticObject",
    "building",
    "tileset",
    "item",
    "artwork",
  ] as const) {
    if (field.startsWith(prefix)) return `${prefix}:details`;
  }
  throw new Error(`Wizard field ${field} has no stable V3 catalog page.`);
}

/** Executable inventory: adding a form field without a stable page fails module evaluation/tests. */
export const WIZARD_FIELD_PAGE_MAP = Object.freeze(
  Object.fromEntries(
    Object.keys(WizardCoreFormSchema.shape).map((field) => [field, pageForField(field)]),
  ) as Readonly<Record<keyof typeof WizardCoreFormSchema.shape, CatalogPageId>>,
);

export const WIZARD_OUTPUT_PARTS = Object.freeze([
  "main",
  "negative",
  "technical",
  "combined",
] as const);
export const WIZARD_OUTPUT_STYLES = Object.freeze(["classic", "dark"] as const);
export const WIZARD_OUTPUT_LANGUAGES = Object.freeze(["de", "en"] as const);
