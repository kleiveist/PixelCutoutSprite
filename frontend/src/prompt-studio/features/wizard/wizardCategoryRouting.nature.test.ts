import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type BaseProfile,
  type NatureAnswers,
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

const TIMESTAMP = "2026-09-06T10:00:00.000Z";
type NatureDraft = Extract<WizardDraft, { category: "nature" }>;

const TREE_CATEGORY_DEFAULTS = {
  plantType: "tree",
  species: "Alte Hüteeiche",
  subjectDescription: "Breiter Waldbaum mit klarer Gameplay-Silhouette",
  climate: "temperate",
  season: "autumn",
  age: "ancient",
  silhouette: "broad",
  trunkThickness: "massive",
  trunkShape: "gnarled",
  trunkDetails: "Tiefe Rindenfurchen und eine kleine Höhlung.",
  crownShape: "spreading",
  crownDensity: "dense",
  foliageDetails: "Große Blattgruppen mit lesbaren Zwischenräumen.",
  rootVisibility: "spreading",
  rootDetails: "Drei starke Wurzeln verankern den Stamm sichtbar.",
  mossCoverage: "moderate",
  mushroomGrowth: "clustered",
  snowCover: "none",
  vineGrowth: "light",
  footprint: { widthTiles: 3, depthTiles: 2 },
  grounding: "soilPatch",
  variantCount: 3,
  animationType: "wind",
  extraDetails: "Krone bewegt sich subtil, Stamm und Weltlicht bleiben stabil.",
} as const satisfies NatureAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createNatureLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "nature", subtype: "tree" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_ancient_tree",
    name: "Alte Waldbaume",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "nature-tree",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: TREE_CATEGORY_DEFAULTS,
    tags: ["Wald", "Baum"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_winter_oak",
    name: "Wintereiche am Weg",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "nature-tree",
    badgeIconIds: [],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      subjectDescription: "Wintereiche am verschneiten Waldweg",
      season: "winter",
      snowCover: "heavy",
    },
    tags: ["Winter"],
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

function linkedNatureDraft(library: ProfileLibrary): NatureDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_winter_oak");
  if (!asset || asset.category !== "nature") {
    throw new Error("Expected the Nature Asset fixture.");
  }
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_winter_oak",
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
  if (!("category" in draft) || draft.category !== "nature") {
    throw new Error("Expected a selected Nature Draft.");
  }
  return draft;
}

function unlinkedNatureDraft(
  subtype: "tree" | "mushroom" = "tree",
  answers: NatureAnswers = {},
): NatureDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_nature",
    projectName: "Waldnatur",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "nature",
    subtype,
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "nature") {
    throw new Error("Expected a selected Nature Draft.");
  }
  return draft;
}

function expectNatureDraft(draft: WizardDraft | null): asserts draft is NatureDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "nature") {
    throw new Error("Expected a selected Nature Draft.");
  }
}

describe("Nature Wizard routing integration", () => {
  it("routes Nature details before optional animation and never exposes directions", () => {
    const library = createNatureLibrary();
    const formBase = applyWizardBaseProfileToFormValues(
      { projectName: "Routing" },
      requireBase(library),
    );
    const tree = {
      ...formBase,
      category: "nature",
      subtype: "tree",
    } satisfies WizardCoreFormValues;
    const mushroom = {
      ...formBase,
      category: "nature",
      subtype: "mushroom",
    } satisfies WizardCoreFormValues;

    expect(wizardStepIsApplicable("natureDetails", tree, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", tree, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", tree, library)).toBe(false);
    expect(wizardStepIsApplicable("natureDetails", mushroom, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", mushroom, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", mushroom, library)).toBe(false);
  });

  it("projects every Nature detail plus wind while excluding direction and unrelated answers", () => {
    const library = createNatureLibrary();
    const draft = unlinkedNatureDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      naturePlantType: "tree",
      natureSpecies: "Silberweide",
      natureDescription: "Windgebeugte Weide an einem stillen Teich",
      natureClimate: "temperate",
      natureSeason: "summer",
      natureAge: "mature",
      natureSilhouette: "asymmetric",
      natureTrunkThickness: "thick",
      natureTrunkShape: "twisted",
      natureTrunkDetails: "Helle, rissige Rinde.",
      natureCrownShape: "spreading",
      natureCrownDensity: "loose",
      natureFoliageDetails: "Lange Blattgruppen mit sichtbaren Lücken.",
      natureRootVisibility: "visible",
      natureRootDetails: "Flache Wurzeln am Wasserrand.",
      natureMossCoverage: "light",
      natureMushroomGrowth: "few",
      natureSnowCover: "none",
      natureVineGrowth: "draped",
      natureFootprintWidthTiles: 3,
      natureFootprintDepthTiles: 2,
      natureGrounding: "grassPatch",
      natureVariantCount: 4,
      natureExtraDetails: "Die Krone darf den Stamm nicht verdecken.",
      animationType: "wind",
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "animation",
      context: { library },
    });
    expectNatureDraft(updated);
    expect(updated.answers).toEqual({
      plantType: "tree",
      species: "Silberweide",
      subjectDescription: "Windgebeugte Weide an einem stillen Teich",
      climate: "temperate",
      season: "summer",
      age: "mature",
      silhouette: "asymmetric",
      trunkThickness: "thick",
      trunkShape: "twisted",
      trunkDetails: "Helle, rissige Rinde.",
      crownShape: "spreading",
      crownDensity: "loose",
      foliageDetails: "Lange Blattgruppen mit sichtbaren Lücken.",
      rootVisibility: "visible",
      rootDetails: "Flache Wurzeln am Wasserrand.",
      mossCoverage: "light",
      mushroomGrowth: "few",
      snowCover: "none",
      vineGrowth: "draped",
      footprint: { widthTiles: 3, depthTiles: 2 },
      grounding: "grassPatch",
      variantCount: 4,
      extraDetails: "Die Krone darf den Stamm nicht verdecken.",
      animationType: "wind",
    });
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("materialType");
    expect(updated.answers).not.toHaveProperty("role");
  });

  it("hydrates Base to Category to Asset and stores only Asset differences", () => {
    const library = createNatureLibrary();
    const draft = linkedNatureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      naturePlantType: "tree",
      natureSpecies: "Alte Hüteeiche",
      natureDescription: "Wintereiche am verschneiten Waldweg",
      natureClimate: "temperate",
      natureSeason: "winter",
      natureSnowCover: "heavy",
      natureFootprintWidthTiles: 3,
      natureFootprintDepthTiles: 2,
      animationType: "wind",
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "natureDetails",
      context: { library },
    });
    expectNatureDraft(updated);
    expect(updated.categoryProfileId).toBe("category_ancient_tree");
    expect(updated.sourceAssetProfileId).toBe("asset_winter_oak");
    expect(updated.answers).toEqual({
      subjectDescription: "Wintereiche am verschneiten Waldweg",
      season: "winter",
      snowCover: "heavy",
    });
  });

  it("reads legacy V2 Nature fields without materializing a derived plant type", () => {
    const library = createNatureLibrary();
    const draft = unlinkedNatureDraft("tree", {
      climate: "mountain",
      season: "summer",
      age: "mature",
      footprint: { widthTiles: 2, depthTiles: 2 },
      animationType: "wind",
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);
    expect(values).toMatchObject({
      natureClimate: "mountain",
      natureSeason: "summer",
      natureAge: "mature",
      natureFootprintWidthTiles: 2,
      natureFootprintDepthTiles: 2,
      animationType: "wind",
    });
    expect(values).not.toHaveProperty("naturePlantType");
    expect(JSON.stringify(draft)).toBe(beforeHydration);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, natureMossCoverage: "light" },
      stepId: "natureDetails",
      context: { library },
    });
    expectNatureDraft(updated);
    expect(updated.answers).toEqual({
      climate: "mountain",
      season: "summer",
      age: "mature",
      footprint: { widthTiles: 2, depthTiles: 2 },
      animationType: "wind",
      mossCoverage: "light",
    });
    expect(updated.answers).not.toHaveProperty("plantType");
  });

  it("detaches inherited Nature defaults when footprint or wind is explicitly cleared", () => {
    const library = createNatureLibrary();
    const draft = linkedNatureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    for (const cleared of [
      {
        ...values,
        natureFootprintWidthTiles: undefined,
        natureFootprintDepthTiles: undefined,
      },
      { ...values, animationType: undefined },
    ]) {
      const detached = updateWizardDraftFromCoreForm({
        draft,
        values: cleared,
        stepId: "natureDetails",
        context: { library },
      });
      expectNatureDraft(detached);
      expect(detached).not.toHaveProperty("categoryProfileId");
      expect(detached).not.toHaveProperty("sourceAssetProfileId");
      expect(detached.overrides).toEqual({ tileSize: 48 });
      expect(detached.answers).toMatchObject({
        plantType: "tree",
        species: "Alte Hüteeiche",
        subjectDescription: "Wintereiche am verschneiten Waldweg",
        season: "winter",
        snowCover: "heavy",
      });
      if (cleared.animationType === undefined) {
        expect(detached.answers).not.toHaveProperty("animationType");
      } else {
        expect(detached.answers).not.toHaveProperty("footprint");
      }
    }
  });

  it("preserves effective Nature details across a Base switch and removes provenance", () => {
    const library = createNatureLibrary();
    const draft = linkedNatureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(values, nextBase),
      stepId: "baseProfile",
      context: { library },
    });
    expectNatureDraft(switched);
    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched.answers).toEqual({
      ...TREE_CATEGORY_DEFAULTS,
      subjectDescription: "Wintereiche am verschneiten Waldweg",
      season: "winter",
      snowCover: "heavy",
    } satisfies NatureAnswers);
  });

  it("purges Nature answers on subtype change and ignores animation for a mushroom", () => {
    const library = createNatureLibrary();
    const draft = linkedNatureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, subtype: "mushroom", naturePlantType: "mushroom" },
      stepId: "category",
      context: { library },
    });
    expectNatureDraft(changed);
    expect(changed).toMatchObject({
      category: "nature",
      subtype: "mushroom",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");

    const mushroom = unlinkedNatureDraft("mushroom");
    const nonanimated = updateWizardDraftFromCoreForm({
      draft: mushroom,
      values: {
        ...createWizardCoreFormValues(mushroom, null, library),
        naturePlantType: "mushroom",
        natureSpecies: "Fliegenpilz",
        animationType: "wind",
      },
      stepId: "natureDetails",
      context: { library },
    });
    expectNatureDraft(nonanimated);
    expect(nonanimated.answers).toEqual({
      plantType: "mushroom",
      species: "Fliegenpilz",
    });
  });
});
