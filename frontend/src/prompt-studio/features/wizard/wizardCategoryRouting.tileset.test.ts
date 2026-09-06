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
  type TilesetAnswers,
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
type TilesetDraft = Extract<WizardDraft, { category: "tileset" }>;

const AUTOTILE_CATEGORY_DEFAULTS = {
  tilesetType: "autotile",
  tileUsage: "transition",
  subjectDescription: "Wiesenboden mit Übergängen zu festgetretener Erde",
  edgeSet: "cardinalAndDiagonal",
  edgeDetails: "Acht Nachbarschaftszustände in stabiler Slotreihenfolge.",
  cornerSet: "innerAndOuter",
  transitionMode: "bidirectional",
  sourceMaterial: "kurzes Wiesengras",
  targetMaterial: "festgetretene Erde",
  seamMode: "matchedEdges",
  seamDetails: "Gegenkanten verwenden identische Pixelreihen.",
  tileableAxes: "both",
  repeatMode: "randomized",
  variantCount: 4,
  variantKinds: ["clean", "damaged", "decal"],
  atlasLayout: "fixedColumns",
  atlasTileCount: 47,
  atlasColumns: 8,
  atlasGutterPixels: 1,
  atlasMarginPixels: 2,
  extraDetails: "Keine diagonale Kameradrehung in einzelnen Slots.",
} as const satisfies TilesetAnswers;

function requireBase(library: ProfileLibrary, id = "base_world_80"): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === id);
  if (!base) throw new Error(`Expected Base-profile fixture "${id}".`);
  return base;
}

function createTilesetLibrary(): ProfileLibrary {
  const fixture = createProfileLibraryFixture();
  const base = requireBase(fixture);
  const selection = { category: "tileset", subtype: "autotile" } as const;
  const category = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_meadow_autotile",
    name: "Wiesen-Autotiles",
    baseProfileId: base.id,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "tileset-autotile",
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: { tileSize: 48 },
    defaults: AUTOTILE_CATEGORY_DEFAULTS,
    tags: ["Wiese", "Mapping"],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const asset = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_meadow_autotile",
    name: "Nordwiesen-Autotile",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey({ ...base.values, tileSize: 48 }, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "tileset-autotile",
    badgeIconIds: [],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      subjectDescription: "Kühles Nordwiesengras mit dunkler Erde",
      variantCount: 6,
      seamDetails: "Nord- und Südrand erhalten zusätzliche Grasbüschel.",
    },
    tags: ["Nordwiese"],
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

function linkedTilesetDraft(library: ProfileLibrary): TilesetDraft {
  const asset = library.assetProfiles.find((profile) => profile.id === "asset_meadow_autotile");
  if (!asset || asset.category !== "tileset") {
    throw new Error("Expected the Tileset Asset fixture.");
  }
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_meadow_autotile",
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
  if (!("category" in draft) || draft.category !== "tileset") {
    throw new Error("Expected a selected Tileset Draft.");
  }
  return draft;
}

function unlinkedTilesetDraft(
  subtype: "autotile" | "groundTile" | "animatedTile" = "autotile",
  answers: TilesetAnswers = {},
): TilesetDraft {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_tileset",
    projectName: "Kartenelemente",
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: "base_world_80",
    category: "tileset",
    subtype,
    answers,
    validation: { errors: [], warnings: [] },
    savedAt: TIMESTAMP,
  });
  if (!("category" in draft) || draft.category !== "tileset") {
    throw new Error("Expected a selected Tileset Draft.");
  }
  return draft;
}

function expectTilesetDraft(draft: WizardDraft | null): asserts draft is TilesetDraft {
  expect(draft).not.toBeNull();
  if (draft === null || !("category" in draft) || draft.category !== "tileset") {
    throw new Error("Expected a selected Tileset Draft.");
  }
}

describe("Tileset Wizard routing integration", () => {
  it("routes all Tilesets through details, only animated Tiles through animation, and none through directions", () => {
    const library = createTilesetLibrary();
    const formBase = applyWizardBaseProfileToFormValues(
      { projectName: "Routing" },
      requireBase(library),
    );
    const autotile = {
      ...formBase,
      category: "tileset",
      subtype: "autotile",
    } satisfies WizardCoreFormValues;
    const animatedTile = {
      ...formBase,
      category: "tileset",
      subtype: "animatedTile",
    } satisfies WizardCoreFormValues;

    expect(wizardStepIsApplicable("tilesetDetails", autotile, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", autotile, library)).toBe(false);
    expect(wizardStepIsApplicable("directions", autotile, library)).toBe(false);
    expect(wizardStepIsApplicable("tileability", autotile, library)).toBe(false);
    expect(wizardStepIsApplicable("tilesetDetails", animatedTile, library)).toBe(true);
    expect(wizardStepIsApplicable("animation", animatedTile, library)).toBe(true);
    expect(wizardStepIsApplicable("directions", animatedTile, library)).toBe(false);
  });

  it("projects the full Tileset model without direction or duplicated Grid answers", () => {
    const library = createTilesetLibrary();
    const draft = unlinkedTilesetDraft();
    const values: WizardCoreFormValues = {
      ...createWizardCoreFormValues(draft, null, library),
      tilesetType: "autotile",
      tilesetUsage: "transition",
      tilesetDescription: "Wiesenboden mit Übergängen zu festgetretener Erde",
      tilesetEdgeSet: "cardinalAndDiagonal",
      tilesetEdgeDetails: "Acht Nachbarschaftszustände in stabiler Slotreihenfolge.",
      tilesetCornerSet: "innerAndOuter",
      tilesetTransitionMode: "bidirectional",
      tilesetSourceMaterial: "kurzes Wiesengras",
      tilesetTargetMaterial: "festgetretene Erde",
      tilesetSeamMode: "matchedEdges",
      tilesetSeamDetails: "Gegenkanten verwenden identische Pixelreihen.",
      tileableAxes: "both",
      tilesetRepeatMode: "randomized",
      tilesetVariantCount: 4,
      tilesetVariantKinds: ["clean", "damaged", "decal"],
      tilesetAtlasLayout: "fixedColumns",
      tilesetAtlasTileCount: 47,
      tilesetAtlasColumns: 8,
      tilesetAtlasGutterPixels: 1,
      tilesetAtlasMarginPixels: 2,
      tilesetExtraDetails: "Keine diagonale Kameradrehung in einzelnen Slots.",
      directionCount: 8,
    };

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "tilesetDetails",
      context: { library },
    });
    expectTilesetDraft(updated);
    expect(updated.answers).toEqual(AUTOTILE_CATEGORY_DEFAULTS);
    expect(updated.answers).not.toHaveProperty("directionCount");
    expect(updated.answers).not.toHaveProperty("tileSize");
    expect(updated.answers).not.toHaveProperty("pixelDensity");
  });

  it("hydrates Base to Category to Asset and persists only Asset differences", () => {
    const library = createTilesetLibrary();
    const draft = linkedTilesetDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    expect(values).toMatchObject({
      tileSize: 48,
      tilesetType: "autotile",
      tilesetUsage: "transition",
      tilesetDescription: "Kühles Nordwiesengras mit dunkler Erde",
      tilesetEdgeSet: "cardinalAndDiagonal",
      tilesetCornerSet: "innerAndOuter",
      tilesetTransitionMode: "bidirectional",
      tileableAxes: "both",
      tilesetVariantCount: 6,
      tilesetAtlasLayout: "fixedColumns",
      tilesetAtlasTileCount: 47,
      tilesetAtlasColumns: 8,
    });

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values,
      stepId: "tilesetDetails",
      context: { library },
    });
    expectTilesetDraft(updated);
    expect(updated.categoryProfileId).toBe("category_meadow_autotile");
    expect(updated.sourceAssetProfileId).toBe("asset_meadow_autotile");
    expect(updated.answers).toEqual({
      subjectDescription: "Kühles Nordwiesengras mit dunkler Erde",
      variantCount: 6,
      seamDetails: "Nord- und Südrand erhalten zusätzliche Grasbüschel.",
    });
  });

  it("reads older V2 Tileset answers without materializing the derived type", () => {
    const library = createTilesetLibrary();
    const draft = unlinkedTilesetDraft("groundTile", {
      tileUsage: "floor",
      tileableAxes: "both",
      variantCount: 3,
      subjectDescription: "Alte Steinbodentiles",
    });
    const beforeHydration = JSON.stringify(draft);

    const values = createWizardCoreFormValues(draft, null, library);
    expect(values).toMatchObject({
      tilesetUsage: "floor",
      tileableAxes: "both",
      tilesetVariantCount: 3,
      tilesetDescription: "Alte Steinbodentiles",
    });
    expect(values).not.toHaveProperty("tilesetType");
    expect(JSON.stringify(draft)).toBe(beforeHydration);

    const updated = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, tilesetSeamMode: "seamless" },
      stepId: "tilesetDetails",
      context: { library },
    });
    expectTilesetDraft(updated);
    expect(updated.answers).toEqual({
      tileUsage: "floor",
      tileableAxes: "both",
      variantCount: 3,
      subjectDescription: "Alte Steinbodentiles",
      seamMode: "seamless",
    });
    expect(updated.answers).not.toHaveProperty("tilesetType");
  });

  it("detaches inherited defaults when a field or Atlas configuration is explicitly cleared", () => {
    const library = createTilesetLibrary();
    const draft = linkedTilesetDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const clearedValues = [
      { ...values, tilesetSourceMaterial: undefined },
      { ...values, tileableAxes: undefined },
      {
        ...values,
        tilesetAtlasLayout: undefined,
        tilesetAtlasColumns: undefined,
      },
    ];

    for (const cleared of clearedValues) {
      const detached = updateWizardDraftFromCoreForm({
        draft,
        values: cleared,
        stepId: "tilesetDetails",
        context: { library },
      });
      expectTilesetDraft(detached);
      expect(detached).not.toHaveProperty("categoryProfileId");
      expect(detached).not.toHaveProperty("sourceAssetProfileId");
      expect(detached.overrides).toEqual({ tileSize: 48 });
      if (cleared.tilesetSourceMaterial === undefined) {
        expect(detached.answers).not.toHaveProperty("sourceMaterial");
      }
      if (cleared.tileableAxes === undefined) {
        expect(detached.answers).not.toHaveProperty("tileableAxes");
      }
      if (cleared.tilesetAtlasLayout === undefined) {
        expect(detached.answers).not.toHaveProperty("atlasLayout");
        expect(detached.answers).not.toHaveProperty("atlasColumns");
      }
    }
  });

  it("preserves effective Tileset answers across a Base switch and removes provenance", () => {
    const library = createTilesetLibrary();
    const draft = linkedTilesetDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);
    const nextBase = requireBase(library, "base_world_96");

    const switched = updateWizardDraftFromCoreForm({
      draft,
      values: applyWizardBaseProfileToFormValues(values, nextBase),
      stepId: "baseProfile",
      context: { library },
    });
    expectTilesetDraft(switched);
    expect(switched.baseProfileId).toBe(nextBase.id);
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched.answers).toEqual({
      ...AUTOTILE_CATEGORY_DEFAULTS,
      subjectDescription: "Kühles Nordwiesengras mit dunkler Erde",
      variantCount: 6,
      seamDetails: "Nord- und Südrand erhalten zusätzliche Grasbüschel.",
    } satisfies TilesetAnswers);
  });

  it("purges old connections on subtype change and keeps animated Tiles directionless", () => {
    const library = createTilesetLibrary();
    const draft = linkedTilesetDraft(library);
    const values = createWizardCoreFormValues(draft, null, library);

    const changed = updateWizardDraftFromCoreForm({
      draft,
      values: { ...values, subtype: "groundTile", tilesetType: "ground" },
      stepId: "category",
      context: { library },
    });
    expectTilesetDraft(changed);
    expect(changed).toMatchObject({
      category: "tileset",
      subtype: "groundTile",
      answers: {},
    });
    expect(changed).not.toHaveProperty("categoryProfileId");

    const animated = unlinkedTilesetDraft("animatedTile");
    const animatedResult = updateWizardDraftFromCoreForm({
      draft: animated,
      values: {
        ...createWizardCoreFormValues(animated, null, library),
        tilesetType: "animated",
        tilesetUsage: "floor",
        tilesetEdgeSet: "cardinal",
        tilesetCornerSet: "outer",
        tilesetTransitionMode: "oneWay",
        animationType: "water",
        directionCount: 8,
      },
      stepId: "animation",
      context: { library },
    });
    expectTilesetDraft(animatedResult);
    expect(animatedResult.answers).toEqual({
      tilesetType: "animated",
      tileUsage: "floor",
      animationType: "water",
    });
    expect(animatedResult.answers).not.toHaveProperty("directionCount");
    expect(animatedResult.answers).not.toHaveProperty("edgeSet");
    expect(animatedResult.answers).not.toHaveProperty("cornerSet");
    expect(animatedResult.answers).not.toHaveProperty("transitionMode");
  });
});
