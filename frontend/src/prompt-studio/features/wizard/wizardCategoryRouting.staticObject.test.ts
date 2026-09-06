import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type BaseProfile,
  type ProfileLibrary,
  type StaticObjectAnswers,
  type WizardDraft,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  applyWizardBaseProfileToFormValues,
  createWizardCoreFormValues,
  updateWizardDraftFromCoreForm,
  wizardStepIsApplicable,
} from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";
type StaticObjectDraft = Extract<WizardDraft, { category: "staticObject" }>;

const CHEST_CATEGORY_DEFAULTS = {
  objectClass: "container",
  purpose: "interactive",
  basicShape: "boxy",
  proportion: "compact",
  symmetry: "bilateral",
  subjectDescription: "Massive Truhe mit klar lesbarem Deckel",
  primaryMaterial: "wood",
  secondaryMaterial: "metal",
  materialDetails: "Eichenholz mit dunklen Eisenbändern.",
  condition: "weathered",
  detailElements: "Großes Schloss und verstärkte Ecken.",
  contents: "Zusammengefaltete Karten und Münzen.",
  interaction: "open",
  animationType: "openClose",
  shadowMode: "contact",
  footprint: { widthTiles: 2, depthTiles: 1 },
  variantCount: 3,
  extraDetails: "Deckel bleibt während der Animation am hinteren Scharnier.",
} as const satisfies StaticObjectAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createStaticObjectLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "staticObject", subtype: "chest" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_weathered_chest",
    name: "Verwitterte Truhen",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "static-chest",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: CHEST_CATEGORY_DEFAULTS,
    tags: ["Truhe", "Dungeon"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_map_chest",
    name: "Kartentruhe",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "static-chest",
    badgeIconIds: [],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      subjectDescription: "Kartentruhe neben dem Tisch des Archivars",
      condition: "used",
      variantCount: 2,
    },
    tags: ["Karten"],
    favorite: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });

  return ProfileLibrarySchema.parse({
    ...fixture,
    categoryProfiles: [...fixture.categoryProfiles, category],
    assetProfiles: [...fixture.assetProfiles, asset],
  });
}

function linkedStaticObjectDraft(library: ProfileLibrary): StaticObjectDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_map_chest");
  if (!asset || asset.category !== "staticObject") {
    throw new Error("Expected the static-object Asset fixture.");
  }
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_map_chest",
    projectName: asset.name,
    route: "wizard/profile",
    currentStep: "category",
    baseProfileId: asset.baseProfileId,
    categoryProfileId: asset.categoryProfileId,
    sourceAssetProfileId: asset.id,
    overrides: asset.overrides,
    category: asset.category,
    subtype: asset.subtype,
    answers: asset.answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "staticObject") {
    throw new Error("Expected a selected static-object Draft.");
  }
  return draft;
}

function unlinkedStaticObjectDraft(
  subtype: "chest" | "furniture" = "chest",
  answers: StaticObjectAnswers = {},
): StaticObjectDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_static_object",
    projectName: "Weltobjekt",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "staticObject",
    subtype,
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "staticObject") {
    throw new Error("Expected a selected static-object Draft.");
  }
  return draft;
}

function expectStaticObjectDraft(draft: WizardDraft | null): asserts draft is StaticObjectDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "staticObject") {
    throw new Error("Expected a selected static-object Draft.");
  }
}

describe("static-object Wizard routing integration", () => {
  it("routes details and optional animation but never exposes directions", () => {
    const library = createStaticObjectLibrary();
    const formBase = applyWizardBaseProfileToFormValues(
      { projectName: "Routing" },
      requireBase(library),
    );
    const chest = {
      ...formBase,
      category: "staticObject",
      subtype: "chest",
    } satisfies WizardCoreFormValues;
    const furniture = {
      ...formBase,
      category: "staticObject",
      subtype: "furniture",
    } satisfies WizardCoreFormValues;

    expect(wizardStepIsApplicable("staticObjectDetails", chest, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", chest, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", chest, library)).toBe(false);
    expect(wizardStepIsApplicable("staticObjectDetails", furniture, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", furniture, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", furniture, library)).toBe(false);
  });

  it("projects every detail plus animation without directions or unrelated answers", () => {
    const library = createStaticObjectLibrary();
    const draft = unlinkedStaticObjectDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      staticObjectClass: "container",
      staticObjectPurpose: "interactive",
      staticObjectBasicShape: "boxy",
      staticObjectProportion: "compact",
      staticObjectSymmetry: "bilateral",
      staticObjectDescription: "Kleine Reisetruhe mit gut lesbarem Deckel",
      staticObjectPrimaryMaterial: "wood",
      staticObjectSecondaryMaterial: "metal",
      staticObjectMaterialDetails: "Helles Holz mit Messingbeschlägen.",
      staticObjectCondition: "used",
      staticObjectDetailElements: "Seitliche Griffe und ein Schloss.",
      staticObjectContents: "Seile, Proviant und eine Karte.",
      staticObjectInteraction: "open",
      staticObjectFootprintWidthTiles: 2,
      staticObjectFootprintDepthTiles: 1,
      staticObjectShadowMode: "contact",
      staticObjectVariantCount: 4,
      staticObjectExtraDetails: "Deckel öffnet nach hinten.",
      animationType: "openClose",
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "animation",
      context: { library },
    });
    expectStaticObjectDraft(updated);
    expect(updated.answers).toEqual({
      objectClass: "container",
      purpose: "interactive",
      basicShape: "boxy",
      proportion: "compact",
      symmetry: "bilateral",
      subjectDescription: "Kleine Reisetruhe mit gut lesbarem Deckel",
      primaryMaterial: "wood",
      secondaryMaterial: "metal",
      materialDetails: "Helles Holz mit Messingbeschlägen.",
      condition: "used",
      detailElements: "Seitliche Griffe und ein Schloss.",
      contents: "Seile, Proviant und eine Karte.",
      interaction: "open",
      shadowMode: "contact",
      variantCount: 4,
      extraDetails: "Deckel öffnet nach hinten.",
      footprint: { widthTiles: 2, depthTiles: 1 },
      animationType: "openClose",
    });
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("movementType");
    expect(updated.answers).not.toHaveProperty("plantType");
  });

  it("hydrates Base to Category to Asset and stores only Asset differences", () => {
    const library = createStaticObjectLibrary();
    const draft = linkedStaticObjectDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      staticObjectClass: "container",
      staticObjectPurpose: "interactive",
      staticObjectDescription: "Kartentruhe neben dem Tisch des Archivars",
      staticObjectPrimaryMaterial: "wood",
      staticObjectSecondaryMaterial: "metal",
      staticObjectCondition: "used",
      staticObjectFootprintWidthTiles: 2,
      staticObjectFootprintDepthTiles: 1,
      staticObjectVariantCount: 2,
      animationType: "openClose",
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "staticObjectDetails",
      context: { library },
    });
    expectStaticObjectDraft(updated);
    expect(updated.categoryProfileId).toBe("category_weathered_chest");
    expect(updated.sourceAssetProfileId).toBe("asset_map_chest");
    expect(updated.answers).toEqual({
      subjectDescription: "Kartentruhe neben dem Tisch des Archivars",
      condition: "used",
      variantCount: 2,
    });
  });

  it("reads old V2 answers without materializing a derived object class", () => {
    const library = createStaticObjectLibrary();
    const draft = unlinkedStaticObjectDraft("chest", {
      purpose: "interactive",
      interaction: "open",
      footprint: { widthTiles: 2, depthTiles: 1 },
      animationType: "openClose",
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);
    expect(values).toMatchObject({
      staticObjectPurpose: "interactive",
      staticObjectInteraction: "open",
      staticObjectFootprintWidthTiles: 2,
      staticObjectFootprintDepthTiles: 1,
      animationType: "openClose",
    });
    expect(values).not.toHaveProperty("staticObjectClass");
    expect(JSON.stringify(draft)).toBe(beforeHydration);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, staticObjectCondition: "used" },
      stepId: "staticObjectDetails",
      context: { library },
    });
    expectStaticObjectDraft(updated);
    expect(updated.answers).toEqual({
      purpose: "interactive",
      interaction: "open",
      footprint: { widthTiles: 2, depthTiles: 1 },
      animationType: "openClose",
      condition: "used",
    });
    expect(updated.answers).not.toHaveProperty("objectClass");
  });

  it("detaches inherited defaults when a field, footprint, or animation is explicitly cleared", () => {
    const library = createStaticObjectLibrary();
    const draft = linkedStaticObjectDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const clearedValues = [
      { ...values, staticObjectPurpose: undefined },
      {
        ...values,
        staticObjectFootprintWidthTiles: undefined,
        staticObjectFootprintDepthTiles: undefined,
      },
      { ...values, animationType: undefined },
    ];

    for (const cleared of clearedValues) {
      const detached = updateWizardDraftFromCoreForm({
        draft,
        values: cleared,
        stepId: "staticObjectDetails",
        context: { library },
      });
      expectStaticObjectDraft(detached);
      expect(detached).not.toHaveProperty("categoryProfileId");
      expect(detached).not.toHaveProperty("sourceAssetProfileId");
      expect(detached.overrides).toEqual({ tileSize: 48 });
      if (cleared.staticObjectPurpose === undefined) {
        expect(detached.answers).not.toHaveProperty("purpose");
      }
      if (cleared.staticObjectFootprintWidthTiles === undefined) {
        expect(detached.answers).not.toHaveProperty("footprint");
      }
      if (cleared.animationType === undefined) {
        expect(detached.answers).not.toHaveProperty("animationType");
      }
    }
  });

  it("preserves effective details across a Base switch and removes provenance", () => {
    const library = createStaticObjectLibrary();
    const draft = linkedStaticObjectDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(values, nextBase),
      stepId: "baseProfile",
      context: { library },
    });
    expectStaticObjectDraft(switched);
    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched.answers).toEqual({
      ...CHEST_CATEGORY_DEFAULTS,
      subjectDescription: "Kartentruhe neben dem Tisch des Archivars",
      condition: "used",
      variantCount: 2,
    } satisfies StaticObjectAnswers);
  });

  it("purges answers on subtype change and ignores animation for furniture", () => {
    const library = createStaticObjectLibrary();
    const draft = linkedStaticObjectDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        subtype: "furniture",
        staticObjectClass: "furniture",
      },
      stepId: "category",
      context: { library },
    });
    expectStaticObjectDraft(changed);
    expect(changed).toMatchObject({
      category: "staticObject",
      subtype: "furniture",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");

    const furniture = unlinkedStaticObjectDraft("furniture");
    const nonanimated = updateWizardDraftFromCoreForm({
      draft: furniture,
      values: {
        ...createWizardCoreFormValues(furniture, null, library),
        staticObjectClass: "furniture",
        staticObjectPurpose: "decorative",
        animationType: "openClose",
      },
      stepId: "staticObjectDetails",
      context: { library },
    });
    expectStaticObjectDraft(nonanimated);
    expect(nonanimated.answers).toEqual({
      objectClass: "furniture",
      purpose: "decorative",
    });
    expect(nonanimated.answers).not.toHaveProperty("directionCount");
  });
});
