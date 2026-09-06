import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import {
  ProfileLibrarySchema,
  parseCategoryProfile,
  parseWizardDraft,
  type ArtworkAnswers,
  type BaseProfile,
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

const TIMESTAMP = "2026-09-03T13:00:00.000Z";
type ArtworkDraft = Extract<WizardDraft, { category: "artwork" }>;

const ARTWORK_DEFAULTS = {
  purpose: "concept",
  motif: "environment",
  composition: "scene",
  format: "landscape",
  background: "complete",
  focus: "mood",
  lightingDrama: "gloomy",
  detailLevel: "overview",
} as const satisfies ArtworkAnswers;

function requireBase(library: ProfileLibrary): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!base) throw new Error("Expected Base-profile fixture.");
  return base;
}

function createArtworkLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_artwork_environment",
    name: "Atmospheric environment concepts",
    baseProfileId: base.id,
    category: "artwork",
    subtype: "environmentConcept",
    iconId: "artwork-environment",
    capabilities: resolveCapabilities("artwork", "environmentConcept"),
    overrides: { paletteMode: "desaturated", tileSize: 64 },
    defaults: ARTWORK_DEFAULTS,
    tags: ["Konzept"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  return ProfileLibrarySchema.parse({
    ...fixture,
    categoryProfiles: [...fixture.categoryProfiles, category],
  });
}

function artworkDraft(
  answers: ArtworkAnswers = {},
  linked = false,
  overrides: Readonly<Record<string, unknown>> = {},
): ArtworkDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_artwork_environment",
    projectName: "Sturmobservatorium",
    route: "wizard/editor",
    currentStep: "artworkDetails",
    baseProfileId: "base_world_80",
    ...(linked ? { categoryProfileId: "category_artwork_environment" } : {}),
    overrides,
    category: "artwork",
    subtype: "environmentConcept",
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "artwork") {
    throw new Error("Expected selected Artwork Draft.");
  }
  return draft;
}

describe("Artwork Wizard routing integration", () => {
  it("routes every Artwork through free details without Tile, direction or animation steps", () => {
    const library = createArtworkLibrary();
    const baseValues = applyWizardBaseProfileToFormValues(
      { projectName: "Artwork routing" },
      requireBase(library),
    );

    for (const subtype of ["characterConcept", "scene", "moodPainting"] as const) {
      const values = {
        ...baseValues,
        category: "artwork",
        subtype,
      } satisfies WizardCoreFormValues;
      expect(wizardStepIsApplicable("artworkDetails", values, library)).toBe(true);
      expect(wizardStepIsApplicable("directions", values, library)).toBe(false);
      expect(wizardStepIsApplicable("animation", values, library)).toBe(false);
      expect(wizardStepIsApplicable("tileability", values, library)).toBe(false);
    }
  });

  it("projects every Artwork answer without technical or direction data", () => {
    const library = createArtworkLibrary();
    const draft = artworkDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      artworkPurpose: "productionReference",
      artworkMotif: "environment",
      artworkDescription: "An observatory above a stormy valley.",
      artworkSceneDescription: "A researcher approaches in high wind.",
      artworkComposition: "scene",
      artworkCompositionDetails: "Three depth layers and a small scale figure.",
      artworkFormat: "landscape",
      artworkBackground: "complete",
      artworkBackgroundDetails: "Layered mountains and distant lightning.",
      artworkFocus: "scale",
      artworkLightingDrama: "gloomy",
      artworkLightingDetails: "Cool ambience with a warm doorway accent.",
      artworkDetailLevel: "productionConcept",
      artworkExtraDetails: "No embedded lettering.",
      directionCount: 8,
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "artworkDetails",
      context: { library },
    });
    if (updated === null || !("category" in updated) || updated.category !== "artwork") {
      throw new Error("Expected Artwork Draft projection.");
    }

    expect(updated.answers).toEqual({
      purpose: "productionReference",
      motif: "environment",
      subjectDescription: "An observatory above a stormy valley.",
      sceneDescription: "A researcher approaches in high wind.",
      composition: "scene",
      compositionDetails: "Three depth layers and a small scale figure.",
      format: "landscape",
      background: "complete",
      backgroundDetails: "Layered mountains and distant lightning.",
      focus: "scale",
      lightingDrama: "gloomy",
      lightingDetails: "Cool ambience with a warm doorway accent.",
      detailLevel: "productionConcept",
      extraDetails: "No embedded lettering.",
    });
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("tileSize");
    expect(updated.answers).not.toHaveProperty("perspectiveType");
  });

  it("hydrates Base to Category to Asset and persists only local differences", () => {
    const library = createArtworkLibrary();
    const draft = artworkDraft(
      {
        detailLevel: "productionConcept",
        lightingDetails: "Warm windows against a cool storm.",
      },
      true,
    );
    const before = JSON.stringify(draft);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      artworkPurpose: "concept",
      artworkMotif: "environment",
      artworkComposition: "scene",
      artworkFormat: "landscape",
      artworkBackground: "complete",
      artworkFocus: "mood",
      artworkLightingDrama: "gloomy",
      artworkDetailLevel: "productionConcept",
      artworkLightingDetails: "Warm windows against a cool storm.",
    });
    expect(JSON.stringify(draft)).toBe(before);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "artworkDetails",
      context: { library },
    });
    if (updated === null || !("category" in updated) || updated.category !== "artwork") {
      throw new Error("Expected Artwork Draft projection.");
    }
    expect(updated.categoryProfileId).toBe("category_artwork_environment");
    expect(updated.answers).toEqual({
      lightingDetails: "Warm windows against a cool storm.",
      detailLevel: "productionConcept",
    });
  });

  it("treats clearing an inherited Artwork value as Explicit Clear", () => {
    const library = createArtworkLibrary();
    const draft = artworkDraft({}, true);
    const values = createWizardCoreFormValues(draft, null, library);
    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, artworkFocus: undefined },
      stepId: "artworkDetails",
      context: { library },
    });

    if (updated === null || !("category" in updated) || updated.category !== "artwork") {
      throw new Error("Expected Artwork Draft projection.");
    }
    expect(updated.categoryProfileId).toBeUndefined();
    expect(updated.answers).not.toHaveProperty("focus");
    expect(updated.answers).toMatchObject({
      purpose: "concept",
      motif: "environment",
      lightingDrama: "gloomy",
    });
  });

  it("drops world-geometry overrides for free composition while keeping art direction", () => {
    const library = createArtworkLibrary();
    const draft = artworkDraft({}, false, {
      tileSize: 64,
      perspectiveType: "side",
      cameraAngle: 30,
      paletteMode: "vivid",
    });
    const values = createWizardCoreFormValues(draft, null, library);
    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "artworkDetails",
      context: { library },
    });

    if (updated === null || !("category" in updated) || updated.category !== "artwork") {
      throw new Error("Expected Artwork Draft projection.");
    }
    expect(updated.overrides).toEqual({ paletteMode: "vivid" });
  });

  it("hydrates old V2 Artwork answers without materializing new defaults", () => {
    const library = createArtworkLibrary();
    const draft = artworkDraft({
      purpose: "presentation",
      composition: "singleSubject",
      format: "portrait",
      background: "simple",
      focus: "form",
    });
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      artworkPurpose: "presentation",
      artworkComposition: "singleSubject",
      artworkFormat: "portrait",
      artworkBackground: "simple",
      artworkFocus: "form",
    });
    expect(values.artworkMotif).toBeUndefined();
    expect(draft.answers).not.toHaveProperty("motif");
  });
});
