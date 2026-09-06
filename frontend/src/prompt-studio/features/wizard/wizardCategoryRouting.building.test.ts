import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type BaseProfile,
  type BuildingAnswers,
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
import type { WizardCoreFormValues } from "./wizardSteps";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";
type BuildingDraft = Extract<WizardDraft, { category: "building" }>;

const GATE_CATEGORY_DEFAULTS = {
  buildingType: "gate",
  purpose: "Bewachter Zugang zur nördlichen Stadtmauer",
  subjectDescription: "Massiver Torbau mit klar lesbarem Durchgang",
  planShape: "rectangular",
  size: "large",
  footprint: { widthTiles: 4, depthTiles: 2 },
  heightPixels: 192,
  floors: 2,
  primaryMaterial: "stone",
  secondaryMaterial: "wood",
  materialDetails: "Heller Kalkstein und dunkle Eichenbohlen.",
  roofShape: "gable",
  roofPitch: "steep",
  roofMaterial: "slate",
  roofCondition: "weathered",
  roofDetails: "Zwei kleine Giebel über dem Wehrgang.",
  facadeStyle: "fortified",
  facadeDetails: "Mauerzinnen und hervortretende Pfeiler.",
  doorCount: 1,
  doorType: "reinforced",
  doorPosition: "Zentral im unteren Fassadendrittel.",
  doorState: "closed",
  windowCount: 4,
  windowShape: "narrowSlit",
  windowLighting: "warmLit",
  windowDetails: "Paarweise über dem Torbogen.",
  condition: "weathered",
  occupancy: "active",
  environment: "city",
  mappingMode: "modularSet",
  collisionMode: "walkableEntrance",
  modular: true,
  lighting: "visibleSources",
  lightSourceDetails: "Zwei warme Laternen flankieren den Durchgang.",
  animationType: "openClose",
  extraDetails: "Weltlicht und Kamera bleiben über alle Torphasen stabil.",
} as const satisfies BuildingAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createBuildingLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "building", subtype: "gate" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_north_gate",
    name: "Befestigte Stadttore",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "building-gate",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: GATE_CATEGORY_DEFAULTS,
    tags: ["Tor", "Stadtmauer"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_north_gate",
    name: "Nordtor",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "building-gate",
    badgeIconIds: ["material-stone", "material-wood"],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      subjectDescription: "Nordtor mit Wappen über dem Torbogen",
      condition: "used",
      doorState: "open",
    },
    tags: ["Nordtor"],
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

function linkedBuildingDraft(library: ProfileLibrary): BuildingDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_north_gate");
  if (!asset || asset.category !== "building") {
    throw new Error("Expected the Building Asset fixture.");
  }
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_north_gate",
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
  if (!("category" in draft) || draft.category !== "building") {
    throw new Error("Expected a selected Building Draft.");
  }
  return draft;
}

function unlinkedBuildingDraft(
  subtype: "gate" | "house" = "gate",
  answers: BuildingAnswers = {},
): BuildingDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_building",
    projectName: "Architektur",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "building",
    subtype,
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "building") {
    throw new Error("Expected a selected Building Draft.");
  }
  return draft;
}

function expectBuildingDraft(draft: WizardDraft | null): asserts draft is BuildingDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "building") {
    throw new Error("Expected a selected Building Draft.");
  }
}

describe("Building Wizard routing integration", () => {
  it("routes every Building through details, gates through animation, and none through directions", () => {
    const library = createBuildingLibrary();
    const formBase = applyWizardBaseProfileToFormValues(
      { projectName: "Routing" },
      requireBase(library),
    );
    const gate = {
      ...formBase,
      category: "building",
      subtype: "gate",
    } satisfies WizardCoreFormValues;
    const house = {
      ...formBase,
      category: "building",
      subtype: "house",
    } satisfies WizardCoreFormValues;

    expect(wizardStepIsApplicable("buildingDetails", gate, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", gate, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", gate, library)).toBe(false);
    expect(wizardStepIsApplicable("buildingDetails", house, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", house, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", house, library)).toBe(false);
  });

  it("projects the full architecture model without direction or character-scale answers", () => {
    const library = createBuildingLibrary();
    const draft = unlinkedBuildingDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      buildingType: "gate",
      buildingPurpose: "Bewachter Zugang zur nördlichen Stadtmauer",
      buildingDescription: "Massiver Torbau mit klar lesbarem Durchgang",
      buildingPlanShape: "rectangular",
      buildingSize: "large",
      buildingFootprintWidthTiles: 4,
      buildingFootprintDepthTiles: 2,
      buildingHeightPixels: 192,
      buildingFloors: 2,
      buildingPrimaryMaterial: "stone",
      buildingSecondaryMaterial: "wood",
      buildingMaterialDetails: "Heller Kalkstein und dunkle Eichenbohlen.",
      buildingRoofShape: "gable",
      buildingRoofPitch: "steep",
      buildingRoofMaterial: "slate",
      buildingRoofCondition: "weathered",
      buildingRoofDetails: "Zwei kleine Giebel über dem Wehrgang.",
      buildingFacadeStyle: "fortified",
      buildingFacadeDetails: "Mauerzinnen und hervortretende Pfeiler.",
      buildingDoorCount: 1,
      buildingDoorType: "reinforced",
      buildingDoorPosition: "Zentral im unteren Fassadendrittel.",
      buildingDoorState: "closed",
      buildingWindowCount: 4,
      buildingWindowShape: "narrowSlit",
      buildingWindowLighting: "warmLit",
      buildingWindowDetails: "Paarweise über dem Torbogen.",
      buildingCondition: "weathered",
      buildingOccupancy: "active",
      buildingEnvironment: "city",
      buildingMappingMode: "modularSet",
      buildingCollisionMode: "walkableEntrance",
      buildingModular: true,
      buildingLighting: "visibleSources",
      buildingLightSourceDetails: "Zwei warme Laternen flankieren den Durchgang.",
      buildingExtraDetails: "Weltlicht und Kamera bleiben über alle Torphasen stabil.",
      animationType: "openClose",
      directionCount: 8,
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "animation",
      context: { library },
    });
    expectBuildingDraft(updated);
    expect(updated.answers).toEqual(GATE_CATEGORY_DEFAULTS);
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("characterHeight");
  });

  it("hydrates Base to Category to Asset and persists only Asset differences", () => {
    const library = createBuildingLibrary();
    const draft = linkedBuildingDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      buildingType: "gate",
      buildingPurpose: "Bewachter Zugang zur nördlichen Stadtmauer",
      buildingDescription: "Nordtor mit Wappen über dem Torbogen",
      buildingFootprintWidthTiles: 4,
      buildingFootprintDepthTiles: 2,
      buildingPrimaryMaterial: "stone",
      buildingDoorState: "open",
      buildingMappingMode: "modularSet",
      buildingLighting: "visibleSources",
      animationType: "openClose",
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "buildingDetails",
      context: { library },
    });
    expectBuildingDraft(updated);
    expect(updated.categoryProfileId).toBe("category_north_gate");
    expect(updated.sourceAssetProfileId).toBe("asset_north_gate");
    expect(updated.answers).toEqual({
      subjectDescription: "Nordtor mit Wappen über dem Torbogen",
      condition: "used",
      doorState: "open",
    });
  });

  it("reads legacy-compatible V2 Building answers without materializing the derived type", () => {
    const library = createBuildingLibrary();
    const draft = unlinkedBuildingDraft("house", {
      purpose: "Wohnhaus",
      floors: 2,
      footprint: { widthTiles: 3, depthTiles: 2 },
      condition: "maintained",
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);
    expect(values).toMatchObject({
      buildingPurpose: "Wohnhaus",
      buildingFloors: 2,
      buildingFootprintWidthTiles: 3,
      buildingFootprintDepthTiles: 2,
      buildingCondition: "maintained",
    });
    expect(values).not.toHaveProperty("buildingType");
    expect(JSON.stringify(draft)).toBe(beforeHydration);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, buildingPrimaryMaterial: "wood" },
      stepId: "buildingDetails",
      context: { library },
    });
    expectBuildingDraft(updated);
    expect(updated.answers).toEqual({
      purpose: "Wohnhaus",
      floors: 2,
      footprint: { widthTiles: 3, depthTiles: 2 },
      condition: "maintained",
      primaryMaterial: "wood",
    });
    expect(updated.answers).not.toHaveProperty("buildingType");
  });

  it("detaches inherited defaults when a field, footprint, or gate animation is explicitly cleared", () => {
    const library = createBuildingLibrary();
    const draft = linkedBuildingDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const clearedValues = [
      { ...values, buildingPurpose: undefined },
      {
        ...values,
        buildingFootprintWidthTiles: undefined,
        buildingFootprintDepthTiles: undefined,
      },
      { ...values, animationType: undefined },
    ];

    for (const cleared of clearedValues) {
      const detached = updateWizardDraftFromCoreForm({
        draft,
        values: cleared,
        stepId: "buildingDetails",
        context: { library },
      });
      expectBuildingDraft(detached);
      expect(detached).not.toHaveProperty("categoryProfileId");
      expect(detached).not.toHaveProperty("sourceAssetProfileId");
      expect(detached.overrides).toEqual({ tileSize: 48 });
      if (cleared.buildingPurpose === undefined) {
        expect(detached.answers).not.toHaveProperty("purpose");
      }
      if (cleared.buildingFootprintWidthTiles === undefined) {
        expect(detached.answers).not.toHaveProperty("footprint");
      }
      if (cleared.animationType === undefined) {
        expect(detached.answers).not.toHaveProperty("animationType");
      }
    }
  });

  it("preserves effective architecture across a Base switch and removes provenance", () => {
    const library = createBuildingLibrary();
    const draft = linkedBuildingDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(values, nextBase),
      stepId: "baseProfile",
      context: { library },
    });
    expectBuildingDraft(switched);
    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched.answers).toEqual({
      ...GATE_CATEGORY_DEFAULTS,
      subjectDescription: "Nordtor mit Wappen über dem Torbogen",
      condition: "used",
      doorState: "open",
    } satisfies BuildingAnswers);
  });

  it("purges architecture on subtype change and ignores modularity and animation for a house", () => {
    const library = createBuildingLibrary();
    const draft = linkedBuildingDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, subtype: "house", buildingType: "residential" },
      stepId: "category",
      context: { library },
    });
    expectBuildingDraft(changed);
    expect(changed).toMatchObject({
      category: "building",
      subtype: "house",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");

    const house = unlinkedBuildingDraft("house");
    const nonmodular = updateWizardDraftFromCoreForm({
      draft: house,
      values: {
        ...createWizardCoreFormValues(house, null, library),
        buildingType: "residential",
        buildingPurpose: "Wohnhaus",
        buildingPlanShape: "modular",
        buildingModular: true,
        buildingMappingMode: "modularSet",
        animationType: "openClose",
      },
      stepId: "buildingDetails",
      context: { library },
    });
    expectBuildingDraft(nonmodular);
    expect(nonmodular.answers).toEqual({
      buildingType: "residential",
      purpose: "Wohnhaus",
    });
    expect(nonmodular.answers).not.toHaveProperty("animationType");
    expect(nonmodular.answers).not.toHaveProperty("directionCount");
  });
});
