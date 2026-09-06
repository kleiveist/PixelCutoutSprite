import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type BaseProfile,
  type MovingObjectAnswers,
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

const TIMESTAMP = "2026-09-04T10:00:00.000Z";
type MovingObjectDraft = Extract<WizardDraft, { category: "movingObject" }>;

const CART_CATEGORY_DEFAULTS = {
  objectClass: "cart",
  purpose: "Transportiert Waren zwischen Marktständen",
  basicShape: "Breiter Kasten auf zwei großen Rädern",
  subjectDescription: "Überdachter Holzwagen mit sichtbarer Zugdeichsel",
  footprint: { widthTiles: 2, depthTiles: 1 },
  heightPixels: 96,
  anchorMode: "footprintCenter",
  movementType: "roll",
  mechanism: "wheels",
  material: "wood",
  materialDetails: "Eichenholz mit dunklen Eisenbeschlägen",
  condition: "used",
  lightingBehavior: "neutral",
  shadowMode: "contact",
  extraDetails: "Die linke Radnabe bleibt in allen Ansichten markiert.",
  directionCount: 4,
  animationSequences: [
    { type: "idle", frames: 2 },
    { type: "move", frames: 6 },
  ],
} as const satisfies MovingObjectAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createMovingObjectLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "movingObject", subtype: "cart" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_cart_production",
    name: "Handelswagen",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "moving-cart",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: CART_CATEGORY_DEFAULTS,
    tags: ["Wagen"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_market_cart",
    name: "Marktwagen",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "moving-cart",
    badgeIconIds: ["material-wood"],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: { purpose: "Mobiler Marktstand" },
    tags: ["Markt"],
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

function linkedCartDraft(library: ProfileLibrary): WizardDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_market_cart");
  if (!asset || asset.category !== "movingObject") {
    throw new Error("Expected the moving-object Asset fixture.");
  }

  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_market_cart",
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
}

function unlinkedMovingObjectDraft(
  subtype: "cart" | "floatingCrystal",
  answers: MovingObjectAnswers = {},
): MovingObjectDraft {
  const draftSuffix = subtype === "floatingCrystal" ? "floating_crystal" : subtype;
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: `draft_${draftSuffix}`,
    projectName: subtype === "cart" ? "Produktionswagen" : "Pulsierender Kristall",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "movingObject",
    subtype,
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "movingObject") {
    throw new Error("Expected a selected moving-object Draft fixture.");
  }
  return draft;
}

function context(library: ProfileLibrary) {
  return { library } as const;
}

function expectSelectedMovingObject(draft: WizardDraft | null): asserts draft is MovingObjectDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "movingObject") {
    throw new Error("Expected a selected moving-object Draft.");
  }
}

describe("moving-object Wizard routing integration", () => {
  it("routes the detail step only to moving objects and keeps cart directions separate from crystal animation", () => {
    const library = createMovingObjectLibrary();
    const base = requireBase(library);
    const formBase = applyWizardBaseProfileToFormValues({ projectName: "Routing" }, base);
    const cart = {
      ...formBase,
      category: "movingObject" as const,
      subtype: "cart" as const,
    };
    const crystal = {
      ...formBase,
      category: "movingObject" as const,
      subtype: "floatingCrystal" as const,
    };
    const npc = {
      ...formBase,
      category: "character" as const,
      subtype: "npc" as const,
    };

    expect(wizardStepIsApplicable("movingObjectDetails", cart, library)).toBe(true);
    expect(wizardStepIsApplicable("characterDetails", cart, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", cart, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", cart, library)).toBe(true);

    expect(wizardStepIsApplicable("movingObjectDetails", crystal, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", crystal, library)).toBe(false);
    expect(wizardStepIsApplicable("animation", crystal, library)).toBe(true);

    expect(wizardStepIsApplicable("movingObjectDetails", npc, library)).toBe(false);
    expect(wizardStepIsApplicable("characterDetails", npc, library)).toBe(true);
  });

  it("maps every detail, a complete footprint, directions, and canonically ordered animations into the Draft", () => {
    const library = createMovingObjectLibrary();
    const draft = unlinkedMovingObjectDraft("cart");
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      movingObjectClass: "cart",
      movingObjectPurpose: "Belagerungsnachschub",
      movingObjectBasicShape: "Niedriger Kasten mit hohem Stoffverdeck",
      movingObjectDescription: "Robuster Versorgungswagen mit asymmetrischer Deichsel",
      movingObjectFootprintWidthTiles: 3,
      movingObjectFootprintDepthTiles: 2,
      movingObjectHeightPixels: 112,
      movingObjectAnchorMode: "bottomCenter",
      movementType: "roll",
      movingObjectMechanism: "mixed",
      movingObjectMaterial: "mixed",
      movingObjectMaterialDetails: "Holz, Eisen und grober Leinenstoff",
      movingObjectCondition: "damaged",
      movingObjectLightingBehavior: "warm",
      movingObjectShadowMode: "motionAdjusted",
      movingObjectExtraDetails: "Das linke Hinterrad ist mit einem Seil repariert.",
      directionCount: 8,
      movingObjectAnimationFrames: { pulse: 3, move: 6, idle: 2 },
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "movingObjectDetails",
      savedAt: "2026-09-04T10:05:00.000Z",
      context: context(library),
    });
    expectSelectedMovingObject(updated);

    expect(updated).toMatchObject({
      route: "wizard/editor",
      currentStep: "movingObjectDetails",
      answers: {
        objectClass: "cart",
        purpose: "Belagerungsnachschub",
        basicShape: "Niedriger Kasten mit hohem Stoffverdeck",
        subjectDescription: "Robuster Versorgungswagen mit asymmetrischer Deichsel",
        footprint: { widthTiles: 3, depthTiles: 2 },
        heightPixels: 112,
        anchorMode: "bottomCenter",
        movementType: "roll",
        mechanism: "mixed",
        material: "mixed",
        materialDetails: "Holz, Eisen und grober Leinenstoff",
        condition: "damaged",
        lightingBehavior: "warm",
        shadowMode: "motionAdjusted",
        extraDetails: "Das linke Hinterrad ist mit einem Seil repariert.",
        directionCount: 8,
        animationSequences: [
          { type: "idle", frames: 2 },
          { type: "move", frames: 6 },
          { type: "pulse", frames: 3 },
        ],
      },
    });
    expect(updated.answers).not.toHaveProperty("animationType");
    expect(updated.answers).not.toHaveProperty("framesPerDirection");
  });

  it("hydrates a legacy animation without changing it and writes only the canonical representation after an edit", () => {
    const library = createMovingObjectLibrary();
    const draft = unlinkedMovingObjectDraft("cart", {
      objectClass: "cart",
      movementType: "roll",
      directionCount: 4,
      animationType: "move",
      framesPerDirection: 6,
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      movingObjectClass: "cart",
      movementType: "roll",
      directionCount: 4,
      movingObjectAnimationFrames: { move: 6 },
    });
    expect(values).not.toHaveProperty("animationType");
    expect(JSON.stringify(draft)).toBe(beforeHydration);
    expect(draft.answers).toMatchObject({
      animationType: "move",
      framesPerDirection: 6,
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        movingObjectPurpose: "Bewusste Nutzeränderung",
      },
      stepId: "animation",
      context: context(library),
    });
    expectSelectedMovingObject(updated);
    expect(updated.answers).toMatchObject({
      purpose: "Bewusste Nutzeränderung",
      animationSequences: [{ type: "move", frames: 6 }],
    });
    expect(updated.answers).not.toHaveProperty("animationType");
    expect(updated.answers).not.toHaveProperty("framesPerDirection");
  });

  it("hydrates Category defaults, then detaches and materializes all remaining effective values after an explicit clear", () => {
    const library = createMovingObjectLibrary();
    const draft = linkedCartDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      movingObjectClass: "cart",
      movingObjectPurpose: "Mobiler Marktstand",
      movingObjectBasicShape: CART_CATEGORY_DEFAULTS.basicShape,
      movingObjectFootprintWidthTiles: 2,
      movingObjectFootprintDepthTiles: 1,
      movingObjectMaterial: "wood",
      directionCount: 4,
      movingObjectAnimationFrames: { idle: 2, move: 6 },
    });

    const detached = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        movingObjectMaterial: undefined,
        movingObjectMaterialDetails: undefined,
      },
      stepId: "movingObjectDetails",
      context: context(library),
    });
    expectSelectedMovingObject(detached);

    expect(detached).not.toHaveProperty("categoryProfileId");
    expect(detached).not.toHaveProperty("sourceAssetProfileId");
    expect(detached.overrides).toEqual({ tileSize: 48 });
    expect(detached.answers).toMatchObject({
      objectClass: "cart",
      purpose: "Mobiler Marktstand",
      basicShape: CART_CATEGORY_DEFAULTS.basicShape,
      footprint: { widthTiles: 2, depthTiles: 1 },
      heightPixels: 96,
      anchorMode: "footprintCenter",
      movementType: "roll",
      mechanism: "wheels",
      condition: "used",
      lightingBehavior: "neutral",
      shadowMode: "contact",
      directionCount: 4,
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "move", frames: 6 },
      ],
    });
    expect(detached.answers).not.toHaveProperty("material");
    expect(detached.answers).not.toHaveProperty("materialDetails");

    const resumedValues = createWizardCoreFormValues(detached, null, library);
    expect(resumedValues).not.toHaveProperty("movingObjectMaterial");
    expect(resumedValues).not.toHaveProperty("movingObjectMaterialDetails");
    expect(resumedValues).toMatchObject({
      movingObjectPurpose: "Mobiler Marktstand",
      movingObjectAnimationFrames: { idle: 2, move: 6 },
    });
  });

  it("detaches inherited directions and does not restore them on the next hydration", () => {
    const library = createMovingObjectLibrary();
    const draft = linkedCartDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const detached = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, directionCount: undefined },
      stepId: "directions",
      context: context(library),
    });
    expectSelectedMovingObject(detached);

    expect(detached).not.toHaveProperty("categoryProfileId");
    expect(detached).not.toHaveProperty("sourceAssetProfileId");
    expect(detached.answers).not.toHaveProperty("directionCount");
    expect(detached.answers).toMatchObject({
      purpose: "Mobiler Marktstand",
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "move", frames: 6 },
      ],
    });

    const resumedValues = createWizardCoreFormValues(detached, null, library);
    expect(resumedValues).not.toHaveProperty("directionCount");
    expect(resumedValues.movingObjectAnimationFrames).toEqual({
      idle: 2,
      move: 6,
    });
  });

  it("detaches inherited animations and does not restore them on the next hydration", () => {
    const library = createMovingObjectLibrary();
    const draft = linkedCartDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const detached = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, movingObjectAnimationFrames: undefined },
      stepId: "animation",
      context: context(library),
    });
    expectSelectedMovingObject(detached);

    expect(detached).not.toHaveProperty("categoryProfileId");
    expect(detached).not.toHaveProperty("sourceAssetProfileId");
    expect(detached.answers).toMatchObject({
      purpose: "Mobiler Marktstand",
      directionCount: 4,
    });
    expect(detached.answers).not.toHaveProperty("animationSequences");
    expect(detached.answers).not.toHaveProperty("animationType");
    expect(detached.answers).not.toHaveProperty("framesPerDirection");

    const resumedValues = createWizardCoreFormValues(detached, null, library);
    expect(resumedValues).not.toHaveProperty("movingObjectAnimationFrames");
    expect(resumedValues.directionCount).toBe(4);
  });

  it("materializes effective moving-object values while switching Base families and drops old provenance", () => {
    const library = createMovingObjectLibrary();
    const draft = linkedCartDraft(library);
    const inheritedValues = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");
    const switchedValues = applyWizardBaseProfileToFormValues(inheritedValues, nextBase);

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: switchedValues,
      stepId: "baseProfile",
      context: context(library),
    });
    expectSelectedMovingObject(switched);

    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched).not.toHaveProperty("overrides");
    expect(switched.answers).toMatchObject({
      objectClass: "cart",
      purpose: "Mobiler Marktstand",
      basicShape: CART_CATEGORY_DEFAULTS.basicShape,
      footprint: { widthTiles: 2, depthTiles: 1 },
      material: "wood",
      directionCount: 4,
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "move", frames: 6 },
      ],
    });
  });

  it("purges every moving-object answer and profile link on category or subtype changes", () => {
    const library = createMovingObjectLibrary();
    const draft = linkedCartDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const texture = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        projectName: "Eichenboden",
        category: "texture",
        subtype: "wood",
      },
      stepId: "category",
      context: context(library),
    });
    expect(texture).toMatchObject({
      category: "texture",
      subtype: "wood",
      answers: {},
    });
    expect(texture).not.toHaveProperty("categoryProfileId");
    expect(texture).not.toHaveProperty("sourceAssetProfileId");

    const crystal = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        projectName: "Neuer Kristall",
        subtype: "floatingCrystal",
      },
      stepId: "category",
      context: context(library),
    });
    expectSelectedMovingObject(crystal);
    expect(crystal).toMatchObject({
      subtype: "floatingCrystal",
      answers: {},
    });
    expect(crystal).not.toHaveProperty("categoryProfileId");
    expect(crystal).not.toHaveProperty("sourceAssetProfileId");
  });

  it("persists a pulsating floating crystal without inventing direction data", () => {
    const library = createMovingObjectLibrary();
    const draft = unlinkedMovingObjectDraft("floatingCrystal");
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      movingObjectClass: "floatingObject",
      movementType: "hover",
      movingObjectFootprintWidthTiles: 1,
      movingObjectFootprintDepthTiles: 1,
      movingObjectAnimationFrames: { pulse: 4 },
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "animation",
      context: context(library),
    });
    expectSelectedMovingObject(updated);
    expect(updated.answers).toEqual({
      objectClass: "floatingObject",
      movementType: "hover",
      footprint: { widthTiles: 1, depthTiles: 1 },
      animationSequences: [{ type: "pulse", frames: 4 }],
    });
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("framesPerDirection");
  });
});
