import { WizardCoreFormSchema } from "../../features/wizard/wizardSteps";
import {
  WIZARD_BASE_CONTEXT_FIELD_PATHS,
  WIZARD_CATALOG_PAGES,
  type WizardCatalogStepId,
} from "../../features/wizard/wizardCatalog";

export type CatalogPageId = WizardCatalogStepId | "context/base-profile";

const assignments = new Map<string, CatalogPageId>([
  ["projectName", "identity"],
  ["category", "identity"],
  ["subtype", "identity"],
  ...WIZARD_BASE_CONTEXT_FIELD_PATHS.map((field) => [field, "context/base-profile"] as const),
]);

for (const page of WIZARD_CATALOG_PAGES) {
  for (const field of page.fieldPaths) {
    if (assignments.has(field)) {
      throw new Error(`Wizard field ${field} is assigned to more than one V3 page.`);
    }
    assignments.set(field, page.id);
  }
}

for (const field of Object.keys(WizardCoreFormSchema.shape)) {
  if (!assignments.has(field)) {
    throw new Error(`Wizard field ${field} has no stable V3 catalog page.`);
  }
}

/** Executable inventory: adding a form field without a stable page fails module evaluation/tests. */
export const WIZARD_FIELD_PAGE_MAP = Object.freeze(
  Object.fromEntries(
    Object.keys(WizardCoreFormSchema.shape).map((field) => [field, assignments.get(field)!]),
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
