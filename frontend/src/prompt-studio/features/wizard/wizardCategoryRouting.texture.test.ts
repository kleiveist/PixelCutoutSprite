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
  type TextureAnswers,
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

const TIMESTAMP = "2026-09-05T10:00:00.000Z";
type TextureDraft = Extract<WizardDraft, { category: "texture" }>;

const WOOD_CATEGORY_DEFAULTS = {
  materialType: "wood",
  usage: "floor",
  subjectDescription: "Breite Eichenplanken mit ruhiger natürlicher Wirkung",
  seamless: true,
  structure: "medium",
  condition: "old",
  surface: "planked",
  moisture: "dry",
  icing: "none",
  lighting: "neutralEven",
  orientation: "grainAligned",
  extraDetails: "Unregelmäßige Knoten ohne auffälliges Wiederholungsmuster.",
} as const satisfies TextureAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createTextureLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "texture", subtype: "wood" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_wood_floor",
    name: "Nahtlose Holzböden",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "texture-wood",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: WOOD_CATEGORY_DEFAULTS,
    tags: ["Holz", "Boden"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_worn_oak_floor",
    name: "Abgenutzter Eichenboden",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "texture-wood",
    badgeIconIds: ["material-wood"],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      subjectDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      condition: "damaged",
    },
    tags: ["Eiche"],
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

function linkedTextureDraft(library: ProfileLibrary): TextureDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_worn_oak_floor");
  if (!asset || asset.category !== "texture") {
    throw new Error("Expected the Texture Asset fixture.");
  }

  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_worn_oak_floor",
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
  if (!("category" in draft) || draft.category !== "texture") {
    throw new Error("Expected a selected Texture Draft.");
  }
  return draft;
}

function unlinkedTextureDraft(answers: TextureAnswers = {}): TextureDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_texture",
    projectName: "Materialtextur",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "texture",
    subtype: "wood",
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "texture") {
    throw new Error("Expected a selected Texture Draft.");
  }
  return draft;
}

function expectTextureDraft(draft: WizardDraft | null): asserts draft is TextureDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "texture") {
    throw new Error("Expected a selected Texture Draft.");
  }
}

describe("Texture Wizard routing integration", () => {
  it("routes one focused Texture step after Base without direction, animation, or duplicate tileability", () => {
    const library = createTextureLibrary();
    const formBase = applyWizardBaseProfileToFormValues(
      { projectName: "Routing" },
      requireBase(library),
    );
    const wood: WizardCoreFormValues = {
      ...formBase,
      category: "texture",
      subtype: "wood",
    };
    const npc: WizardCoreFormValues = {
      ...formBase,
      category: "character",
      subtype: "npc",
    };

    expect(wizardStepIsApplicable("textureDetails", wood, library)).toBe(true);
    expect(wizardStepIsApplicable("tileability", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("animation", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("characterDetails", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("movingObjectDetails", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("textureDetails", npc, library)).toBe(false);
  });

  it("projects every Texture field but never duplicates tile size or unrelated category data in answers", () => {
    const library = createTextureLibrary();
    const draft = unlinkedTextureDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      textureMaterialType: "wood",
      textureUsage: "wall",
      textureDescription: "Handbehauene Eichenbretter mit ruhiger Maserung",
      seamless: true,
      textureStructure: "coarse",
      textureCondition: "old",
      textureSurface: "jointed",
      textureMoisture: "damp",
      textureIcing: "lightFrost",
      textureLighting: "worldAligned",
      textureOrientation: "vertical",
      textureExtraDetails: "Dunkle Fugen, wenige Knoten und dezente Farbvariation.",
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "textureDetails",
      savedAt: "2026-09-05T10:05:00.000Z",
      context: { library },
    });
    expectTextureDraft(updated);

    expect(updated).toMatchObject({
      route: "wizard/editor",
      currentStep: "textureDetails",
      category: "texture",
      subtype: "wood",
      answers: {
        materialType: "wood",
        usage: "wall",
        subjectDescription: "Handbehauene Eichenbretter mit ruhiger Maserung",
        seamless: true,
        structure: "coarse",
        condition: "old",
        surface: "jointed",
        moisture: "damp",
        icing: "lightFrost",
        lighting: "worldAligned",
        orientation: "vertical",
        extraDetails: "Dunkle Fugen, wenige Knoten und dezente Farbvariation.",
      },
    });
    expect(updated.answers).not.toHaveProperty("tileSize");
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("animationType");
    expect(updated.answers).not.toHaveProperty("role");
    expect(updated.answers).not.toHaveProperty("objectClass");
  });

  it("reads existing V2 Texture fields without mutation and keeps them on the next deliberate edit", () => {
    const library = createTextureLibrary();
    const draft = unlinkedTextureDraft({
      usage: "floor",
      seamless: true,
      orientation: "horizontal",
      structure: "fine",
      condition: "polished",
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      textureUsage: "floor",
      seamless: true,
      textureOrientation: "horizontal",
      textureStructure: "fine",
      textureCondition: "polished",
    });
    expect(values).not.toHaveProperty("textureMaterialType");
    expect(JSON.stringify(draft)).toBe(beforeHydration);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, textureSurface: "planked" },
      stepId: "textureDetails",
      context: { library },
    });
    expectTextureDraft(updated);
    expect(updated.answers).toEqual({
      usage: "floor",
      seamless: true,
      orientation: "horizontal",
      structure: "fine",
      condition: "polished",
      surface: "planked",
    });
  });

  it("hydrates Base to Category to Asset and stores only Asset-level differences while links remain", () => {
    const library = createTextureLibrary();
    const draft = linkedTextureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      textureMaterialType: "wood",
      textureUsage: "floor",
      textureDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      seamless: true,
      textureStructure: "medium",
      textureCondition: "damaged",
      textureSurface: "planked",
      textureMoisture: "dry",
      textureIcing: "none",
      textureLighting: "neutralEven",
      textureOrientation: "grainAligned",
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "textureDetails",
      context: { library },
    });
    expectTextureDraft(updated);
    expect(updated.categoryProfileId).toBe("category_wood_floor");
    expect(updated.sourceAssetProfileId).toBe("asset_worn_oak_floor");
    expect(updated.answers).toEqual({
      subjectDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      condition: "damaged",
    });
  });

  it("detaches an inherited Texture default on explicit clear and materializes every remaining effective value", () => {
    const library = createTextureLibrary();
    const draft = linkedTextureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const detached = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, textureSurface: undefined },
      stepId: "textureDetails",
      context: { library },
    });
    expectTextureDraft(detached);

    expect(detached).not.toHaveProperty("categoryProfileId");
    expect(detached).not.toHaveProperty("sourceAssetProfileId");
    expect(detached.overrides).toEqual({ tileSize: 48 });
    expect(detached.answers).toMatchObject({
      materialType: "wood",
      usage: "floor",
      subjectDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      seamless: true,
      structure: "medium",
      condition: "damaged",
      moisture: "dry",
      icing: "none",
      lighting: "neutralEven",
      orientation: "grainAligned",
      extraDetails: WOOD_CATEGORY_DEFAULTS.extraDetails,
    });
    expect(detached.answers).not.toHaveProperty("surface");

    const resumedValues = createWizardCoreFormValues(detached, null, library);
    expect(resumedValues).not.toHaveProperty("textureSurface");
    expect(resumedValues).toMatchObject({
      textureMaterialType: "wood",
      textureDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      textureCondition: "damaged",
    });
  });

  it("preserves effective Texture details across a Base switch but removes old provenance", () => {
    const library = createTextureLibrary();
    const draft = linkedTextureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(values, nextBase),
      stepId: "baseProfile",
      context: { library },
    });
    expectTextureDraft(switched);

    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched.answers).toEqual({
      ...WOOD_CATEGORY_DEFAULTS,
      subjectDescription: "Abgenutzte Eichenplanken mit geflickten Fugen",
      condition: "damaged",
    } satisfies TextureAnswers);
  });

  it("purges every Texture answer and old provenance when subtype changes", () => {
    const library = createTextureLibrary();
    const draft = linkedTextureDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, subtype: "stone" },
      stepId: "category",
      context: { library },
    });
    expectTextureDraft(changed);

    expect(changed).toMatchObject({
      category: "texture",
      subtype: "stone",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");
    expect(changed.answers).not.toHaveProperty("materialType");
    expect(changed.answers).not.toHaveProperty("seamless");
  });
});
