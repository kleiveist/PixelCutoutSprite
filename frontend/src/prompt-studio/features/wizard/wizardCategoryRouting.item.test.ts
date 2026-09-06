import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import {
  ProfileLibrarySchema,
  parseCategoryProfile,
  parseWizardDraft,
  type BaseProfile,
  type ItemAnswers,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  applyWizardBaseProfileToFormValues,
  createWizardCoreFormValues,
  updateWizardDraftFromCoreForm,
  wizardStepIsApplicable,
} from "./wizardCategoryRouting";
import { WizardItemDetailsStepSchema, type WizardCoreFormValues } from "./wizardSteps";

const TIMESTAMP = "2026-09-03T12:00:00.000Z";
type ItemDraft = Extract<WizardDraft, { category: "item" }>;

const TOOL_DEFAULTS = {
  itemClass: "tool",
  purpose: "practical",
  presentation: "equipped",
  wearPosition: "hand",
  size: "medium",
  primaryMaterial: "metal",
  secondaryMaterial: "wood",
  condition: "used",
  significance: "common",
  readability: "silhouetteFirst",
  glowMode: "none",
  shadowMode: "contact",
  variantCount: 2,
} as const satisfies ItemAnswers;

function requireBase(library: ProfileLibrary): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!base) throw new Error("Expected Base-profile fixture.");
  return base;
}

function createItemLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_item_tool",
    name: "Handwerkzeuge",
    baseProfileId: base.id,
    category: "item",
    subtype: "tool",
    iconId: "item-tool",
    capabilities: resolveCapabilities("item", "tool"),
    overrides: { tileSize: 48 },
    defaults: TOOL_DEFAULTS,
    tags: ["Werkzeug"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  return ProfileLibrarySchema.parse({
    ...fixture,
    categoryProfiles: [...fixture.categoryProfiles, category],
  });
}

function itemDraft(answers: ItemAnswers = {}, linked = false): ItemDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_item_tool",
    projectName: "Schmiedehammer",
    route: "wizard/editor",
    currentStep: "itemDetails",
    baseProfileId: "base_world_80",
    ...(linked ? { categoryProfileId: "category_item_tool" } : {}),
    category: "item",
    subtype: "tool",
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "item") {
    throw new Error("Expected selected Item Draft.");
  }
  return draft;
}

describe("Item Wizard routing integration", () => {
  it("routes every Item through its details step without directions or animation", () => {
    const library = createItemLibrary();
    const baseValues = applyWizardBaseProfileToFormValues(
      { projectName: "Item routing" },
      requireBase(library),
    );
    for (const subtype of ["weapon", "clothing", "questItem"] as const) {
      const values = { ...baseValues, category: "item", subtype } satisfies WizardCoreFormValues;
      expect(wizardStepIsApplicable("itemDetails", values, library)).toBe(true);
      expect(wizardStepIsApplicable("directions", values, library)).toBe(false);
      expect(wizardStepIsApplicable("animation", values, library)).toBe(false);
      expect(wizardStepIsApplicable("tileability", values, library)).toBe(false);
    }
  });

  it("rejects Wearable form data for a non-wearable Item subtype", () => {
    const library = createItemLibrary();
    const values = {
      ...applyWizardBaseProfileToFormValues({ projectName: "Quest item" }, requireBase(library)),
      category: "item",
      subtype: "questItem",
      itemPurpose: "wearable",
      itemPresentation: "equipped",
      itemWearPosition: "body",
    } satisfies WizardCoreFormValues;

    const result = WizardItemDetailsStepSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Non-wearable Item data must fail.");
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["itemPurpose", "itemPresentation", "itemWearPosition"]),
    );
  });

  it("projects all Item answers but no duplicated technical or direction data", () => {
    const library = createItemLibrary();
    const draft = itemDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      itemClass: "tool",
      itemPurpose: "practical",
      itemPresentation: "equipped",
      itemWearPosition: "hand",
      itemIconSize: 48,
      itemSize: "medium",
      itemDescription: "A readable blacksmith hammer.",
      itemPrimaryMaterial: "metal",
      itemSecondaryMaterial: "wood",
      itemMaterialDetails: "Dark steel head and ash handle.",
      itemCondition: "used",
      itemFunctionDetails: "Forging tool with a broad striking face.",
      itemSignificance: "common",
      itemMeaningDetails: "Workshop ownership mark.",
      itemSilhouette: "Broad head and tapered handle.",
      itemReadability: "silhouetteFirst",
      itemGlowMode: "none",
      itemShadowMode: "contact",
      itemVariantCount: 2,
      itemExtraDetails: "Centered cutout.",
      directionCount: 8,
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "itemDetails",
      context: { library },
    });
    expect(updated).not.toBeNull();
    if (updated === null || !("category" in updated) || updated.category !== "item") {
      throw new Error("Expected Item Draft projection.");
    }
    expect(updated.answers).toMatchObject({
      itemClass: "tool",
      purpose: "practical",
      presentation: "equipped",
      wearPosition: "hand",
      primaryMaterial: "metal",
      condition: "used",
      functionDetails: "Forging tool with a broad striking face.",
      readability: "silhouetteFirst",
    });
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("tileSize");
    expect(updated.answers).not.toHaveProperty("backgroundMode");
  });

  it("hydrates Base to Category to Asset and persists only local differences", () => {
    const library = createItemLibrary();
    const draft = itemDraft(
      {
        condition: "damaged",
        functionDetails: "The split handle makes the hammer unreliable.",
      },
      true,
    );
    const before = JSON.stringify(draft);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      itemClass: "tool",
      itemPurpose: "practical",
      itemPresentation: "equipped",
      itemWearPosition: "hand",
      itemPrimaryMaterial: "metal",
      itemSecondaryMaterial: "wood",
      itemCondition: "damaged",
      itemFunctionDetails: "The split handle makes the hammer unreliable.",
    });
    expect(JSON.stringify(draft)).toBe(before);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "itemDetails",
      context: { library },
    });
    expect(updated).not.toBeNull();
    if (updated === null || !("category" in updated) || updated.category !== "item") {
      throw new Error("Expected Item Draft projection.");
    }
    expect(updated.categoryProfileId).toBe("category_item_tool");
    expect(updated.answers).toEqual({
      condition: "damaged",
      functionDetails: "The split handle makes the hammer unreliable.",
    });
  });

  it("treats clearing an inherited Item value as Explicit Clear", () => {
    const library = createItemLibrary();
    const draft = itemDraft({}, true);
    const values = createWizardCoreFormValues(draft, null, library);
    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, itemCondition: undefined },
      stepId: "itemDetails",
      context: { library },
    });

    expect(updated).not.toBeNull();
    if (updated === null || !("category" in updated) || updated.category !== "item") {
      throw new Error("Expected Item Draft projection.");
    }
    expect(updated.categoryProfileId).toBeUndefined();
    expect(updated.answers).not.toHaveProperty("condition");
    expect(updated.answers).toMatchObject({ itemClass: "tool", primaryMaterial: "metal" });
  });

  it("hydrates old V2 Item answers without materializing a derived class", () => {
    const library = createItemLibrary();
    const draft = itemDraft({ purpose: "usable", presentation: "icon", iconSize: 32 });
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      itemPurpose: "usable",
      itemPresentation: "icon",
      itemIconSize: 32,
    });
    expect(values.itemClass).toBeUndefined();
    expect(draft.answers).not.toHaveProperty("itemClass");
  });
});
