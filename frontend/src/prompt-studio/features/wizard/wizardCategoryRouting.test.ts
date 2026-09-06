import { describe, expect, it } from "vitest";
import { CHARACTER_ANIMATION_ACTION_IDS } from "../../domain/characters";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  StableIdSchema,
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type CharacterAnswers,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { createWizardDraftFromAssetProfile } from "./wizardLifecycle";
import {
  WizardBaseProfileProjectionError,
  applyWizardBaseProfileToFormValues,
  createWizardCoreFormValues,
  getWizardAssetSelection,
  resolveWizardCapabilities,
  updateWizardDraftFromCoreForm,
  wizardStepIsApplicable,
} from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";

const TIMESTAMP = "2026-09-04T10:00:00.000Z";

const COMPLETE_CHARACTER_DETAILS = {
  role: "blacksmith",
  subjectDescription: "A village craftsperson with an immediately readable role.",
  variantCount: 3,
  genderPresentation: "androgynous",
  age: "adult",
  relativeHeight: "average",
  bodyBuild: "sturdy",
  posture: "upright",
  faceShape: "angular",
  skinTone: "warm brown",
  eyeVisibility: "clear",
  hair: "dark brown, shoulder length",
  hairstyle: "tied back",
  beard: "short boxed beard",
  hat: "none",
  headwearCondition: "used",
  scarf: "short wool scarf",
  outerwear: "heavy leather apron over a linen shirt",
  lowerwear: "dark work trousers",
  clothingLayers: "shirt, vest, apron",
  gloves: "single reinforced work glove",
  handPose: "hammer held low in the right hand",
  shoes: "robust leather boots",
  beltBags: "broad belt with two tool pouches",
  accessories: "iron key ring and small guild pendant",
  backItem: "rolled protective cloak",
  equipment: "smithing hammer and long tongs",
  materials: "linen, worn leather, dark iron and wool",
  characterPaletteSource: "local",
  primaryColor: "charcoal brown",
  secondaryColor: "muted ochre",
  accentColor: "dull forge red",
  condition: "used",
  expression: "serious",
  silhouette: "broad apron, hammer and raised shoulder line",
  pose: "stable working stance",
  professionReadable: true,
  socialRole: "trusted village craftsperson",
  wealth: "comfortable",
  culturalFunction: "maintains tools for the surrounding farming community",
  typicalActivity: "checks a newly forged hinge",
  conversationGesture: "rests the hammer against one shoulder",
  everydayTool: "smithing hammer",
  frontBackDetails: "apron buckle visible in front, crossed straps visible from behind",
  extraDetails: "Keep asymmetric tools consistent in every view.",
} as const satisfies CharacterAnswers;

const CHARACTER_ANIMATION_FRAMES = {
  special: 8,
  hurt: 2,
  interact: 3,
  talk: 4,
  use: 5,
  attack: 7,
  run: 6,
  walk: 5,
  idle: 4,
} as const satisfies NonNullable<WizardCoreFormValues["characterAnimationFrames"]>;

const CANONICAL_CHARACTER_ANIMATIONS = [
  { action: "idle", frames: 4 },
  { action: "walk", frames: 5 },
  { action: "run", frames: 6 },
  { action: "attack", frames: 7 },
  { action: "use", frames: 5 },
  { action: "talk", frames: 4 },
  { action: "interact", frames: 3 },
  { action: "hurt", frames: 2 },
  { action: "special", frames: 8 },
] as const;

function context(library: ProfileLibrary | null = createProfileLibraryFixture()) {
  return { library } as const;
}

function baseProfileValues(library: ProfileLibrary, baseProfileId = "base_world_80") {
  const base = library.baseProfiles.find((profile) => profile.id === baseProfileId);
  if (!base) throw new Error("Expected a Base-profile fixture.");
  return {
    base,
    values: applyWizardBaseProfileToFormValues({ projectName: "" }, base),
  };
}

function blankDraft(): WizardDraft {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_routing_test",
    projectName: "Routing-Test",
    route: "wizard/category",
    currentStep: "category",
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
}

function smithDraft(): Extract<WizardDraft, { category: unknown }> {
  const library = createProfileLibraryFixture();
  const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  const base = library.baseProfiles.find((profile) => profile.id === source?.baseProfileId);
  const category = library.categoryProfiles.find(
    (profile) => profile.id === source?.categoryProfileId,
  );
  if (!source || !base || !category) {
    throw new Error("Expected a complete smith fixture.");
  }

  const result = createWizardDraftFromAssetProfile({
    draftId: StableIdSchema.parse("draft_routing_smith"),
    savedAt: TIMESTAMP,
    assetProfile: source,
    baseProfile: base,
    categoryProfile: category,
  });
  if (result.status !== "created" || !("category" in result.draft)) {
    throw new Error("Expected a selected smith Draft.");
  }
  return result.draft;
}

function detailedSmithDraft(): Extract<WizardDraft, { category: unknown }> {
  const draft = parseWizardDraft({
    ...smithDraft(),
    route: "wizard/editor",
    currentStep: "characterDetails",
    answers: {
      ...COMPLETE_CHARACTER_DETAILS,
      directionCount: 8,
      animationActions: CANONICAL_CHARACTER_ANIMATIONS,
    },
  });
  if (!("category" in draft)) {
    throw new Error("Expected a selected detailed smith Draft.");
  }
  return draft;
}

describe("wizard category routing", () => {
  it("accepts only category-matching selections before resolving capabilities", () => {
    expect(getWizardAssetSelection({ category: "character", subtype: "npc" })).toEqual({
      category: "character",
      subtype: "npc",
    });
    expect(getWizardAssetSelection({ category: "texture", subtype: "npc" })).toBeNull();
    expect(getWizardAssetSelection({ category: "texture" })).toBeNull();
    expect(resolveWizardCapabilities({ category: "texture", subtype: "npc" })).toBeNull();
  });

  it("routes NPC, wood, and wind-tree questions from capabilities only", () => {
    const library = createProfileLibraryFixture();
    const { values: technicalValues } = baseProfileValues(library);
    const npc = {
      ...technicalValues,
      projectName: "NPC",
      category: "character" as const,
      subtype: "npc" as const,
    };
    expect(wizardStepIsApplicable("baseProfile", npc, library)).toBe(true);
    expect(wizardStepIsApplicable("characterDetails", npc, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", npc, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", npc, library)).toBe(true);
    expect(wizardStepIsApplicable("tileability", npc, library)).toBe(false);

    const wood = {
      ...technicalValues,
      projectName: "Holz",
      category: "texture" as const,
      subtype: "wood" as const,
    };
    expect(wizardStepIsApplicable("characterDetails", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("textureDetails", wood, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("animation", wood, library)).toBe(false);
    expect(wizardStepIsApplicable("tileability", wood, library)).toBe(false);

    const tree = {
      ...technicalValues,
      projectName: "Windbaum",
      category: "nature" as const,
      subtype: "tree" as const,
    };
    expect(wizardStepIsApplicable("characterDetails", tree, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", tree, library)).toBe(false);
    expect(wizardStepIsApplicable("animation", tree, library)).toBe(true);
    expect(wizardStepIsApplicable("tileability", tree, library)).toBe(false);

    expect(
      wizardStepIsApplicable(
        "characterDetails",
        {
          projectName: "Noch ohne Basis",
          category: "character",
          subtype: "npc",
        },
        library,
      ),
    ).toBe(false);
    expect(
      wizardStepIsApplicable(
        "directions",
        {
          ...technicalValues,
          projectName: "Möbel",
          category: "staticObject",
          subtype: "furniture",
        },
        library,
      ),
    ).toBe(false);
    expect(
      wizardStepIsApplicable(
        "directions",
        {
          ...technicalValues,
          projectName: "Stadttor",
          category: "building",
          subtype: "gate",
        },
        library,
      ),
    ).toBe(false);
    expect(
      wizardStepIsApplicable(
        "animation",
        {
          ...technicalValues,
          projectName: "Stadttor",
          category: "building",
          subtype: "gate",
        },
        library,
      ),
    ).toBe(true);

    expect(
      wizardStepIsApplicable(
        "directions",
        {
          projectName: "Noch ohne Basis",
          category: "character",
          subtype: "npc",
        },
        library,
      ),
    ).toBe(false);
  });

  it("hydrates the legacy single-action shape and projects it canonically", () => {
    const library = createProfileLibraryFixture();
    const draft = smithDraft();
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      projectName: draft.projectName,
      category: "character",
      subtype: "npc",
      directionCount: 8,
      characterAnimationFrames: { walk: 5 },
    });
    expect(values).not.toHaveProperty("animationAction");

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "directions",
      context: context(library),
    });
    expect(updated).toMatchObject({
      sourceAssetProfileId: draft.sourceAssetProfileId,
      categoryProfileId: draft.categoryProfileId,
      answers: {
        role: "blacksmith",
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(updated).not.toHaveProperty("answers.animationAction");
    expect(updated).not.toHaveProperty("answers.framesPerDirection");
    expect(updated).not.toHaveProperty("overrides");
  });

  it("round-trips the complete Character/NPC form and canonical action frames", () => {
    const library = createProfileLibraryFixture();
    const draft = smithDraft();
    const values = {
      ...createWizardCoreFormValues(draft, null, library),
      ...COMPLETE_CHARACTER_DETAILS,
      directionCount: 8 as const,
      characterAnimationFrames: CHARACTER_ANIMATION_FRAMES,
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "characterDetails",
      savedAt: "2026-09-04T10:04:00.000Z",
      context: context(library),
    });
    if (updated === null || !("category" in updated)) {
      throw new Error("Expected a selected Character Draft.");
    }
    if (updated.category !== "character") {
      throw new Error("Expected Character answers after the round-trip.");
    }

    expect(updated).toMatchObject({
      route: "wizard/editor",
      currentStep: "characterDetails",
      category: "character",
      subtype: "npc",
      answers: {
        ...COMPLETE_CHARACTER_DETAILS,
        animationActions: CANONICAL_CHARACTER_ANIMATIONS,
      },
    });
    expect(updated.answers.animationActions?.map(({ action }) => action)).toEqual(
      CHARACTER_ANIMATION_ACTION_IDS,
    );
    expect(updated.answers).not.toHaveProperty("animationAction");
    expect(updated.answers).not.toHaveProperty("framesPerDirection");
    expect(updated.answers).not.toHaveProperty("characterHeight");

    const hydrated = createWizardCoreFormValues(updated, null, library);
    expect(hydrated).toMatchObject({
      ...COMPLETE_CHARACTER_DETAILS,
      characterHeight: 80,
      directionCount: 8,
      characterAnimationFrames: CHARACTER_ANIMATION_FRAMES,
    });
    expect(hydrated).not.toHaveProperty("animationAction");
  });

  it("hydrates Category Character defaults and materializes them before changing Base families", () => {
    const originalLibrary = createProfileLibraryFixture();
    const originalCategory = originalLibrary.categoryProfiles.find(
      (profile) => profile.id === "category_npc_80",
    );
    if (originalCategory?.category !== "character") {
      throw new Error("Expected the NPC Category-profile fixture.");
    }
    const categoryWithEditorDefaults = parseCategoryProfile({
      ...originalCategory,
      defaults: {
        ...originalCategory.defaults,
        hat: "weathered felt hat",
        materials: "wool, leather and dark iron",
        expression: "friendly",
      },
    });
    const library = ProfileLibrarySchema.parse({
      ...originalLibrary,
      categoryProfiles: originalLibrary.categoryProfiles.map((profile) =>
        profile.id === categoryWithEditorDefaults.id ? categoryWithEditorDefaults : profile,
      ),
    });
    const draft = smithDraft();
    const hydrated = createWizardCoreFormValues(draft, null, library);

    expect(hydrated).toMatchObject({
      role: "blacksmith",
      hat: "weathered felt hat",
      materials: "wool, leather and dark iron",
      expression: "friendly",
      directionCount: 8,
      characterAnimationFrames: { walk: 5 },
    });

    const nextBase = baseProfileValues(library, "base_world_96").base;
    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(hydrated, nextBase),
      stepId: "baseProfile",
      context: context(library),
    });

    expect(changed).toMatchObject({
      baseProfileId: "base_world_96",
      answers: {
        role: "blacksmith",
        hat: "weathered felt hat",
        materials: "wool, leather and dark iron",
        expression: "friendly",
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");

    const withoutInheritedHat = updateWizardDraftFromCoreForm({
      draft,
      values: { ...hydrated, hat: undefined },
      stepId: "characterDetails",
      context: context(library),
    });
    expect(withoutInheritedHat).toMatchObject({
      answers: {
        role: "blacksmith",
        materials: "wool, leather and dark iron",
        expression: "friendly",
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(withoutInheritedHat).not.toHaveProperty("answers.hat");
    expect(withoutInheritedHat).not.toHaveProperty("categoryProfileId");
    expect(withoutInheritedHat).not.toHaveProperty("sourceAssetProfileId");
  });

  it("detaches Character parents when inherited directions or animations are explicitly cleared", () => {
    const originalLibrary = createProfileLibraryFixture();
    const originalCategory = originalLibrary.categoryProfiles.find(
      (profile) => profile.id === "category_npc_80",
    );
    if (originalCategory?.category !== "character") {
      throw new Error("Expected the NPC Category-profile fixture.");
    }
    const categoryWithTechnicalOverride = parseCategoryProfile({
      ...originalCategory,
      overrides: { ...originalCategory.overrides, tileSize: 48 },
    });
    const originalAsset = originalLibrary.assetProfiles.find(
      (profile) => profile.id === "asset_smith_80",
    );
    const originalBase = originalLibrary.baseProfiles.find(
      (profile) => profile.id === originalAsset?.baseProfileId,
    );
    if (originalAsset?.category !== "character" || originalBase === undefined) {
      throw new Error("Expected the smith Asset and Base-profile fixtures.");
    }
    const compatibleAsset = parseAssetProfile({
      ...originalAsset,
      compatibilityKey: createCompatibilityKey(
        { ...originalBase.values, tileSize: 48 },
        { category: "character", subtype: originalAsset.subtype },
      ),
    });
    const library = ProfileLibrarySchema.parse({
      ...originalLibrary,
      categoryProfiles: originalLibrary.categoryProfiles.map((profile) =>
        profile.id === categoryWithTechnicalOverride.id ? categoryWithTechnicalOverride : profile,
      ),
      assetProfiles: originalLibrary.assetProfiles.map((profile) =>
        profile.id === compatibleAsset.id ? compatibleAsset : profile,
      ),
    });
    const draft = smithDraft();
    const hydrated = createWizardCoreFormValues(draft, null, library);
    expect(hydrated).toMatchObject({
      tileSize: 48,
      directionCount: 8,
      characterAnimationFrames: { walk: 5 },
    });

    const withoutDirections = updateWizardDraftFromCoreForm({
      draft,
      values: { ...hydrated, directionCount: undefined },
      stepId: "directions",
      context: context(library),
    });
    if (withoutDirections === null) {
      throw new Error("Expected a Character Draft without directions.");
    }
    expect(withoutDirections).toMatchObject({
      overrides: { tileSize: 48 },
      answers: {
        role: "blacksmith",
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(withoutDirections).not.toHaveProperty("categoryProfileId");
    expect(withoutDirections).not.toHaveProperty("sourceAssetProfileId");
    expect(withoutDirections).not.toHaveProperty("answers.directionCount");
    expect(createWizardCoreFormValues(withoutDirections, null, library)).toMatchObject({
      tileSize: 48,
      characterAnimationFrames: { walk: 5 },
    });

    const withoutAnimations = updateWizardDraftFromCoreForm({
      draft,
      values: { ...hydrated, characterAnimationFrames: undefined },
      stepId: "animation",
      context: context(library),
    });
    if (withoutAnimations === null) {
      throw new Error("Expected a Character Draft without animations.");
    }
    expect(withoutAnimations).toMatchObject({
      overrides: { tileSize: 48 },
      answers: { role: "blacksmith", directionCount: 8 },
    });
    expect(withoutAnimations).not.toHaveProperty("categoryProfileId");
    expect(withoutAnimations).not.toHaveProperty("sourceAssetProfileId");
    expect(withoutAnimations).not.toHaveProperty("answers.animationActions");
    expect(createWizardCoreFormValues(withoutAnimations, null, library)).toMatchObject({
      tileSize: 48,
      directionCount: 8,
    });
    expect(createWizardCoreFormValues(withoutAnimations, null, library)).not.toHaveProperty(
      "characterAnimationFrames",
    );
  });

  it("rebuilds answers and provenance when the main category changes", () => {
    const library = createProfileLibraryFixture();
    const parsedDraft = parseWizardDraft({
      ...detailedSmithDraft(),
      overrides: { tileSize: 48, characterHeight: 96 },
    });
    if (!("category" in parsedDraft)) {
      throw new Error("Expected a selected Draft after adding overrides.");
    }
    const draft = parsedDraft;
    const currentValues = createWizardCoreFormValues(parsedDraft, null, library);
    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...currentValues,
        projectName: "Eichenboden",
        category: "texture",
        subtype: "wood",
        seamless: true,
      },
      stepId: "textureDetails",
      savedAt: "2026-09-04T10:05:00.000Z",
      context: context(library),
    });

    expect(changed).toMatchObject({
      route: "wizard/editor",
      currentStep: "textureDetails",
      category: "texture",
      subtype: "wood",
      answers: {},
      baseProfileId: draft.baseProfileId,
      overrides: { tileSize: 48 },
      validation: { errors: [], warnings: [] },
    });
    expect(changed).not.toHaveProperty("sourceAssetProfileId");
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("answers.directionCount");
    expect(changed).not.toHaveProperty("answers.framesPerDirection");
    expect(changed).not.toHaveProperty("answers.animationAction");
    expect(changed).not.toHaveProperty("answers.animationActions");
    expect(changed).not.toHaveProperty("answers.role");
    expect(changed).not.toHaveProperty("answers.hair");
    expect(changed).not.toHaveProperty("answers.materials");
    expect(changed).not.toHaveProperty("answers.professionReadable");
    expect(changed).not.toHaveProperty("overrides.characterHeight");
  });

  it("purges stale Character answers when the Character subtype changes", () => {
    const library = createProfileLibraryFixture();
    const draft = detailedSmithDraft();
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: {
        ...values,
        subtype: "animal",
      },
      stepId: "category",
      context: context(library),
    });

    expect(changed).toMatchObject({
      route: "wizard/profile",
      currentStep: "category",
      category: "character",
      subtype: "animal",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");
    expect(changed).not.toHaveProperty("answers.animationActions");
    expect(changed).not.toHaveProperty("answers.directionCount");
    expect(changed).not.toHaveProperty("answers.role");
    expect(changed).not.toHaveProperty("answers.materials");
    expect(changed).not.toHaveProperty("answers.professionReadable");
  });

  it("does not reserialize hidden NPC or humanoid wardrobe fields for animals", () => {
    const library = createProfileLibraryFixture();
    const source = detailedSmithDraft();
    const {
      categoryProfileId: _categoryProfileId,
      sourceAssetProfileId: _sourceAssetProfileId,
      ...portableSource
    } = source;
    void _categoryProfileId;
    void _sourceAssetProfileId;
    const animal = parseWizardDraft({
      ...portableSource,
      subtype: "animal",
      answers: {
        ...COMPLETE_CHARACTER_DETAILS,
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    if (!("category" in animal) || animal.category !== "character") {
      throw new Error("Expected an animal Character Draft.");
    }

    const changed = updateWizardDraftFromCoreForm({
      draft: animal,
      values: createWizardCoreFormValues(animal, null, library),
      stepId: "characterDetails",
      context: context(library),
    });

    expect(changed).toMatchObject({
      answers: {
        role: "blacksmith",
        materials: "linen, worn leather, dark iron and wool",
        equipment: "smithing hammer and long tongs",
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(changed).not.toHaveProperty("answers.outerwear");
    expect(changed).not.toHaveProperty("answers.shoes");
    expect(changed).not.toHaveProperty("answers.socialRole");
    expect(changed).not.toHaveProperty("answers.professionReadable");
  });

  it("defers Draft projection while a selected classification is incomplete", () => {
    const draft = smithDraft();

    expect(
      updateWizardDraftFromCoreForm({
        draft,
        values: {
          projectName: "Eichenboden",
          category: "texture",
        },
        stepId: "category",
        context: context(),
      }),
    ).toBeNull();
  });

  it("starts a new classification clean, then stores its capability data", () => {
    const values = {
      projectName: "Windbaum",
      category: "nature" as const,
      subtype: "tree" as const,
      animationType: "wind" as const,
    };
    const classified = updateWizardDraftFromCoreForm({
      draft: blankDraft(),
      values,
      stepId: "baseProfile",
      context: context(),
    });

    expect(classified).toMatchObject({
      route: "wizard/profile",
      category: "nature",
      subtype: "tree",
      answers: {},
    });
    if (classified === null) {
      throw new Error("Expected a selected Nature Draft.");
    }

    const updated = updateWizardDraftFromCoreForm({
      draft: classified,
      values,
      stepId: "baseProfile",
      context: context(),
    });
    expect(updated).toMatchObject({ answers: { animationType: "wind" } });
    expect(updated).not.toHaveProperty("answers.directionCount");
    expect(updated).not.toHaveProperty("baseProfileId");
  });

  it("hydrates all effective technical fields and normalizes unlocked overrides", () => {
    const library = createProfileLibraryFixture();
    const draft = smithDraft();
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      baseProfileId: "base_world_80",
      pixelDensity: "modernHd",
      tileSize: 32,
      characterHeight: 80,
      cameraAngle: 60,
      nearestNeighbor: true,
      lightingPolicy: "adaptive",
      lightingNotes: "Keep world light stable.",
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, tileSize: 48 },
      stepId: "baseProfile",
      context: context(library),
    });
    expect(updated).toMatchObject({
      route: "wizard/profile",
      baseProfileId: "base_world_80",
      overrides: { tileSize: 48 },
    });
    expect(updated).not.toHaveProperty("overrides.pixelDensity");
  });

  it("keeps an explicit Asset override that returns a Category value to its Base value", () => {
    const sourceLibrary = createProfileLibraryFixture();
    const categoryProfile = sourceLibrary.categoryProfiles.find(
      (profile) => profile.id === "category_npc_80",
    );
    const baseProfile = sourceLibrary.baseProfiles.find(
      (profile) => profile.id === "base_world_80",
    );
    const assetProfile = sourceLibrary.assetProfiles.find(
      (profile) => profile.id === "asset_smith_80",
    );
    if (!categoryProfile || !baseProfile || !assetProfile) {
      throw new Error("Expected the complete NPC profile chain.");
    }
    const inheritedCategoryProfile = parseCategoryProfile({
      ...categoryProfile,
      overrides: { ...categoryProfile.overrides, tileSize: 48 },
    });
    const library = ProfileLibrarySchema.parse({
      baseProfiles: [baseProfile],
      categoryProfiles: [inheritedCategoryProfile],
      assetProfiles: [
        parseAssetProfile({
          ...assetProfile,
          compatibilityKey: createCompatibilityKey(
            { ...baseProfile.values, tileSize: 48 },
            { category: "character", subtype: "npc" },
          ),
        }),
      ],
    });
    const draft = smithDraft();
    const inheritedValues = createWizardCoreFormValues(draft, null, library);
    expect(inheritedValues.tileSize).toBe(48);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...inheritedValues, tileSize: 32 },
      stepId: "baseProfile",
      context: context(library),
    });

    expect(updated).toMatchObject({ overrides: { tileSize: 32 } });
  });

  it("drops hidden world-geometry overrides for free compositions", () => {
    const library = createProfileLibraryFixture();
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_free_composition",
      projectName: "Freies Key Art",
      route: "wizard/profile",
      currentStep: "baseProfile",
      baseProfileId: "base_world_80",
      category: "artwork",
      subtype: "promoArtwork",
      overrides: {
        tileSize: 64,
        perspectiveType: "isometric",
        cameraAngle: 45,
        cameraDirection: "swToNe",
        projectionType: "mildPerspective",
      },
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: TIMESTAMP,
    });
    const values = createWizardCoreFormValues(draft, null, library);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "baseProfile",
      context: context(library),
    });

    expect(updated).not.toHaveProperty("overrides.tileSize");
    expect(updated).not.toHaveProperty("overrides.perspectiveType");
    expect(updated).not.toHaveProperty("overrides.cameraAngle");
    expect(updated).not.toHaveProperty("overrides.cameraDirection");
    expect(updated).not.toHaveProperty("overrides.projectionType");
  });

  it("allows an unlocked character height to complete a Base family that does not define one", () => {
    const sourceLibrary = createProfileLibraryFixture();
    const sourceBase = sourceLibrary.baseProfiles.find((profile) => profile.id === "base_unused");
    if (!sourceBase) throw new Error("Expected the unused Base profile.");
    const { characterHeight: omittedCharacterHeight, ...valuesWithoutCharacterHeight } =
      sourceBase.values;
    void omittedCharacterHeight;
    const base = parseBaseProfile({
      ...sourceBase,
      values: valuesWithoutCharacterHeight,
    });
    const library = ProfileLibrarySchema.parse({
      ...sourceLibrary,
      baseProfiles: sourceLibrary.baseProfiles.map((profile) =>
        profile.id === base.id ? base : profile,
      ),
    });
    const draft = parseWizardDraft({
      ...blankDraft(),
      route: "wizard/profile",
      currentStep: "baseProfile",
      category: "character",
      subtype: "npc",
      answers: {},
    });
    const values = {
      ...applyWizardBaseProfileToFormValues(createWizardCoreFormValues(draft, null, library), base),
      characterHeight: 80,
    };

    expect(wizardStepIsApplicable("directions", values, library)).toBe(true);
    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "baseProfile",
      context: context(library),
    });

    expect(updated).toMatchObject({
      baseProfileId: base.id,
      overrides: { characterHeight: 80 },
    });
  });

  it("fails closed for locked, missing, and unavailable Base profiles", () => {
    const sourceLibrary = createProfileLibraryFixture();
    const draft = smithDraft();
    const sourceBase = sourceLibrary.baseProfiles.find(
      (profile) => profile.id === draft.baseProfileId,
    );
    if (!sourceBase) throw new Error("Expected the smith Base profile.");
    const lockedBase = parseBaseProfile({
      ...sourceBase,
      locks: { ...sourceBase.locks, tileSize: true },
    });
    const library = ProfileLibrarySchema.parse({
      ...sourceLibrary,
      baseProfiles: sourceLibrary.baseProfiles.map((profile) =>
        profile.id === lockedBase.id ? lockedBase : profile,
      ),
    });
    const values = createWizardCoreFormValues(draft, null, library);

    expect(() =>
      updateWizardDraftFromCoreForm({
        draft,
        values: { ...values, tileSize: 48 },
        stepId: "baseProfile",
        context: context(library),
      }),
    ).toThrow(WizardBaseProfileProjectionError);
    expect(() =>
      updateWizardDraftFromCoreForm({
        draft,
        values: { ...values, baseProfileId: "base_missing" },
        stepId: "baseProfile",
        context: context(library),
      }),
    ).toThrow(/missingBaseProfile/);
    expect(() =>
      updateWizardDraftFromCoreForm({
        draft,
        values,
        stepId: "baseProfile",
        context: context(null),
      }),
    ).toThrow(/profileLibraryUnavailable/);
  });

  it("adopts a switched Base while clearing parent links and overrides only", () => {
    const library = createProfileLibraryFixture();
    const draft = parseWizardDraft({
      ...detailedSmithDraft(),
      overrides: { tileSize: 48 },
    });
    if (!("category" in draft)) throw new Error("Expected a selected Draft.");
    const nextBase = baseProfileValues(library, "base_world_96").base;
    const values = applyWizardBaseProfileToFormValues(
      createWizardCoreFormValues(draft, null, library),
      nextBase,
    );

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "baseProfile",
      context: context(library),
    });

    expect(changed).toMatchObject({
      route: "wizard/profile",
      baseProfileId: "base_world_96",
      answers: {
        ...COMPLETE_CHARACTER_DETAILS,
        directionCount: 8,
        animationActions: CANONICAL_CHARACTER_ANIMATIONS,
      },
    });
    expect(changed).not.toHaveProperty("answers.characterHeight");
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("sourceAssetProfileId");
    expect(changed).not.toHaveProperty("overrides");
  });
});
