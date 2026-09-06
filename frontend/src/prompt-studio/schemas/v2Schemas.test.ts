import { describe, expect, it } from "vitest";
import {
  AssetCategoryDataSchema,
  AssetProfileSchema,
  ProfileLibrarySchema,
  parseAppSettings,
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  parseExportBundle,
  parseWizardDraft,
} from "./index";

const timestamp = "2026-09-02T12:00:00.000Z";

const baseProfileInput = {
  schemaVersion: 2,
  kind: "baseProfile",
  id: "base_world_32_80",
  name: "Weltassets 32 px / Figuren 80 px",
  iconId: "world-grid",
  values: {
    pixelDensity: "modernHd",
    styleProfile: "both",
    tileSize: 32,
    characterHeight: 80,
    perspectiveType: "threeQuarter",
    cameraAngle: 60,
    cameraDirection: "southToNorth",
    projectionType: "orthographic",
    outlineStyle: "softSelective",
    paletteMode: "byProfile",
    backgroundMode: "transparent",
    alphaPadding: 8,
    nearestNeighbor: true,
    lightingDefaults: {
      policy: "adaptive",
      notes: "Keep the world-space light direction stable.",
    },
  },
  locks: {
    pixelDensity: true,
    styleProfile: true,
    tileSize: true,
    characterHeight: true,
    perspectiveType: true,
    cameraAngle: true,
    projectionType: true,
    outlineStyle: true,
  },
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;

const npcCapabilities = {
  movable: true,
  directional: true,
  animated: true,
  transparent: true,
  scaledCharacter: true,
} as const;

const categoryProfileInput = {
  schemaVersion: 2,
  kind: "categoryProfile",
  id: "category_npc_80",
  name: "NPCs 80 px",
  baseProfileId: "base_world_32_80",
  category: "character",
  subtype: "npc",
  iconId: "character-npc",
  capabilities: npcCapabilities,
  overrides: {},
  defaults: {
    role: "villager",
    directionCount: 8,
    animationAction: "walk",
    framesPerDirection: 5,
  },
  tags: ["npc", "80px"],
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;

const assetProfileInput = {
  schemaVersion: 2,
  kind: "assetProfile",
  id: "asset_npc_blacksmith_001",
  name: "Dorfschmied mit Lederschürze",
  baseProfileId: "base_world_32_80",
  categoryProfileId: "category_npc_80",
  compatibilityKey:
    "pf2-compat-v1__modern-hd__tile-32__char-80__three-quarter-60__orthographic__outline-soft-selective__camera-south-to-north__style-both__palette-by-profile__nearest-neighbor-on__background-transparent__alpha-padding-8__light-adaptive__light-notes-44-6bbb7cc7c856862a",
  category: "character",
  subtype: "npc",
  iconId: "character-npc",
  badgeIconIds: ["profession-craft", "material-leather"],
  capabilities: npcCapabilities,
  overrides: {},
  answers: {
    role: "blacksmith",
    hat: "none",
    scarf: "short",
    outerwear: "leather-apron",
    animationAction: "walk",
    directionCount: 8,
    framesPerDirection: 5,
  },
  tags: ["npc", "village", "craft", "leather", "80px"],
  favorite: false,
  createdAt: timestamp,
  updatedAt: timestamp,
} as const;

const appSettingsInput = {
  schemaVersion: 2,
  kind: "appSettings",
  theme: "system",
  locale: "de",
  startView: "dashboard",
  activeBaseProfileId: "base_world_32_80",
  updatedAt: timestamp,
} as const;

const wizardDraftInput = {
  schemaVersion: 2,
  kind: "wizardDraft",
  draftId: "draft_blacksmith_001",
  projectName: "Dorfschmied",
  route: "wizard/editor",
  currentStep: "character-motion",
  baseProfileId: "base_world_32_80",
  categoryProfileId: "category_npc_80",
  category: "character",
  subtype: "npc",
  answers: {
    role: "blacksmith",
    animationAction: "walk",
    directionCount: 8,
  },
  validation: { errors: [], warnings: [] },
  savedAt: timestamp,
} as const;

const exportBundleInput = {
  schemaVersion: 2,
  formatVersion: 2,
  kind: "exportBundle",
  application: "PixelForge Prompt Studio",
  bundleId: "bundle_profiles_001",
  exportedAt: timestamp,
  baseProfiles: [baseProfileInput],
  categoryProfiles: [categoryProfileInput],
  assetProfiles: [assetProfileInput],
  appSettings: appSettingsInput,
  wizardDrafts: [wizardDraftInput],
} as const;

describe("V2-Zod-Verträge", () => {
  it("parst alle sechs V2-Verträge aus unknown", () => {
    const unknownBaseProfile: unknown = baseProfileInput;
    const unknownCategoryProfile: unknown = categoryProfileInput;
    const unknownAssetProfile: unknown = assetProfileInput;
    const unknownSettings: unknown = appSettingsInput;
    const unknownDraft: unknown = wizardDraftInput;

    const baseProfile = parseBaseProfile(unknownBaseProfile);
    const categoryProfile = parseCategoryProfile(unknownCategoryProfile);
    const assetProfile = parseAssetProfile(unknownAssetProfile);
    const settings = parseAppSettings(unknownSettings);
    const draft = parseWizardDraft(unknownDraft);
    const bundle = parseExportBundle(exportBundleInput);

    expect(baseProfile.values.tileSize).toBe(32);
    expect(categoryProfile.category).toBe("character");
    expect(assetProfile.category).toBe("character");
    if (assetProfile.category !== "character") {
      throw new Error("Expected the fixture to parse as a character profile.");
    }
    expect(assetProfile.answers.role).toBe("blacksmith");
    expect(settings.theme).toBe("system");
    expect(draft.currentStep).toBe("character-motion");
    expect(bundle.assetProfiles).toHaveLength(1);
  });

  it("parst jede der neun kategorienabhängigen Antwortvarianten", () => {
    const categoryData = [
      {
        category: "character",
        subtype: "npc",
        answers: { directionCount: 8, animationAction: "walk", framesPerDirection: 5 },
      },
      {
        category: "movingObject",
        subtype: "cart",
        answers: {
          purpose: "wearable",
          directionCount: 4,
          animationType: "move",
          framesPerDirection: 4,
        },
      },
      { category: "staticObject", subtype: "door", answers: { animationType: "openClose" } },
      { category: "texture", subtype: "wood", answers: { seamless: true } },
      { category: "nature", subtype: "tree", answers: { animationType: "wind" } },
      { category: "building", subtype: "gate", answers: { modular: true } },
      {
        category: "tileset",
        subtype: "animatedTile",
        answers: { animationType: "water" },
      },
      { category: "item", subtype: "clothing", answers: { wearPosition: "body" } },
      { category: "artwork", subtype: "scene", answers: { composition: "scene" } },
    ] as const;

    expect(categoryData.map((data) => AssetCategoryDataSchema.parse(data).category)).toEqual([
      "character",
      "movingObject",
      "staticObject",
      "texture",
      "nature",
      "building",
      "tileset",
      "item",
      "artwork",
    ]);
  });

  it("speichert frühe Wizard-Schritte ohne vorweggenommene Profil- oder Kategorieauswahl", () => {
    const earlyDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_new_project_001",
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: timestamp,
    });

    expect(earlyDraft.route).toBe("wizard/project");
    expect(earlyDraft).not.toHaveProperty("baseProfileId");
    expect(earlyDraft).not.toHaveProperty("category");
    expect(() => parseWizardDraft({ ...wizardDraftInput, projectName: "" })).toThrow();
    expect(() => parseWizardDraft({ ...wizardDraftInput, baseProfileId: undefined })).toThrow();
  });

  it("bewahrt optionale technische Asset-Overrides in ausgewählten Drafts", () => {
    const draft = parseWizardDraft({
      ...wizardDraftInput,
      sourceAssetProfileId: "asset_blacksmith_001",
      overrides: {
        tileSize: 48,
        lightingDefaults: {
          policy: "warmInterior",
          notes: "Warm light from the forge.",
        },
      },
    });

    expect(draft).toMatchObject({
      sourceAssetProfileId: "asset_blacksmith_001",
      overrides: {
        tileSize: 48,
        lightingDefaults: {
          policy: "warmInterior",
          notes: "Warm light from the forge.",
        },
      },
    });
    expect(parseWizardDraft(wizardDraftInput)).not.toHaveProperty("overrides");
    expect(() =>
      parseWizardDraft({
        ...wizardDraftInput,
        overrides: { tileSize: 2 },
      }),
    ).toThrow();
  });

  it("behandelt die Quellprofil-ID im Export als portable Provenienz", () => {
    const bundle = parseExportBundle({
      ...exportBundleInput,
      assetProfiles: [],
      wizardDrafts: [
        {
          ...wizardDraftInput,
          sourceAssetProfileId: "asset_not_in_bundle",
          overrides: { tileSize: 48 },
        },
      ],
    });

    expect(bundle.wizardDrafts[0]).toMatchObject({
      sourceAssetProfileId: "asset_not_in_bundle",
      overrides: { tileSize: 48 },
    });
  });

  it("hält stabile IDs unabhängig von umbenennbaren Anzeigenamen", () => {
    const original = parseBaseProfile(baseProfileInput);
    const renamed = parseBaseProfile({ ...baseProfileInput, name: "Umbenanntes Weltprofil" });

    expect(renamed.id).toBe(original.id);
    expect(renamed.name).not.toBe(original.name);
    expect(() =>
      parseBaseProfile({ ...baseProfileInput, id: "Weltprofil aus Anzeigename" }),
    ).toThrow();
  });

  it("weist fehlende Pflichtfelder zurück", () => {
    const withoutName = Object.fromEntries(
      Object.entries(baseProfileInput).filter(([key]) => key !== "name"),
    );
    const incompleteBundle = {
      schemaVersion: 2,
      formatVersion: 2,
      kind: "exportBundle",
      application: "PixelForge Prompt Studio",
      bundleId: "bundle_incomplete_001",
      exportedAt: timestamp,
    };

    expect(() => parseBaseProfile(withoutName)).toThrow();
    expect(() => parseExportBundle(incompleteBundle)).toThrow();
  });

  it("weist unbekannte Kategorien und unpassende Untertypen zurück", () => {
    expect(() =>
      parseAssetProfile({ ...assetProfileInput, category: "vehicle", subtype: "cart" }),
    ).toThrow();
    expect(() =>
      parseAssetProfile({ ...assetProfileInput, category: "texture", subtype: "npc" }),
    ).toThrow();
    expect(() =>
      parseCategoryProfile({ ...categoryProfileInput, category: "vehicle", subtype: "cart" }),
    ).toThrow();
    expect(() =>
      parseWizardDraft({ ...wizardDraftInput, category: "vehicle", subtype: "cart" }),
    ).toThrow();
    expect(() =>
      parseExportBundle({
        ...exportBundleInput,
        assetProfiles: [{ ...assetProfileInput, category: "vehicle", subtype: "cart" }],
      }),
    ).toThrow();
  });

  it("weist inkompatible Schema- und Formatversionen zurück", () => {
    expect(() => parseBaseProfile({ ...baseProfileInput, schemaVersion: 1 })).toThrow();
    expect(() => parseCategoryProfile({ ...categoryProfileInput, schemaVersion: 1 })).toThrow();
    expect(() => parseAssetProfile({ ...assetProfileInput, schemaVersion: 1 })).toThrow();
    expect(() => parseAppSettings({ ...appSettingsInput, schemaVersion: 1 })).toThrow();
    expect(() => parseWizardDraft({ ...wizardDraftInput, schemaVersion: 1 })).toThrow();
    expect(() => parseExportBundle({ ...exportBundleInput, schemaVersion: 1 })).toThrow();
    expect(() =>
      parseExportBundle({
        schemaVersion: 2,
        formatVersion: 1,
        kind: "exportBundle",
        application: "PixelForge Prompt Studio",
        bundleId: "bundle_old_001",
        exportedAt: timestamp,
        baseProfiles: [],
        categoryProfiles: [],
        assetProfiles: [],
        wizardDrafts: [],
      }),
    ).toThrow();
  });

  it("blockiert Richtungsdaten für einen nicht-directional schwebenden Kristall", () => {
    const crystalProfile = {
      ...assetProfileInput,
      id: "asset_floating_crystal_001",
      name: "Pulsierender Kristall",
      categoryProfileId: undefined,
      category: "movingObject",
      subtype: "floatingCrystal",
      iconId: "moving-crystal",
      badgeIconIds: [],
      capabilities: {
        movable: true,
        animated: true,
        transparent: true,
        footprint: true,
      },
      answers: {
        movementType: "hover",
        animationType: "pulse",
        directionCount: 8,
      },
      tags: ["crystal"],
    };

    expect(() => parseAssetProfile(crystalProfile)).toThrow(
      "Direction counts are only valid for directional asset subtypes.",
    );
  });

  it("verhindert kategoriefremde Antworten durch die discriminated union", () => {
    expect(() =>
      AssetCategoryDataSchema.parse({
        category: "texture",
        subtype: "wood",
        answers: { seamless: true, directionCount: 8 },
      }),
    ).toThrow();
  });

  it("prüft Capability-abhängige Antworten an jeder öffentlichen Kategoriegrenze", () => {
    const invalidCategoryData = [
      {
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: { directionCount: 8 },
      },
      {
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: { framesPerDirection: 4 },
      },
      {
        category: "movingObject",
        subtype: "cart",
        answers: { directionCount: 4, framesPerDirection: 4 },
      },
      { category: "staticObject", subtype: "barrel", answers: { animationType: "openClose" } },
      { category: "item", subtype: "questItem", answers: { wearPosition: "body" } },
      { category: "building", subtype: "house", answers: { modular: true } },
    ];

    for (const data of invalidCategoryData) {
      expect(AssetCategoryDataSchema.safeParse(data).success).toBe(false);
    }

    const crystalCapabilities = {
      movable: true,
      animated: true,
      transparent: true,
      footprint: true,
    };
    expect(() =>
      parseCategoryProfile({
        ...categoryProfileInput,
        id: "category_floating_crystal",
        category: "movingObject",
        subtype: "floatingCrystal",
        capabilities: crystalCapabilities,
        defaults: { directionCount: 8 },
      }),
    ).toThrow();
    expect(() =>
      parseWizardDraft({
        ...wizardDraftInput,
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: { directionCount: 8 },
      }),
    ).toThrow();
  });

  it("weist manipulierte Capability-Snapshots zurück", () => {
    const result = AssetProfileSchema.safeParse({
      ...assetProfileInput,
      capabilities: { ...npcCapabilities, directional: false },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Manipulated capabilities must not parse.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["capabilities", "directional"],
        message: expect.stringContaining('Capability "directional" does not match'),
      }),
    );
    expect(() => parseAssetProfile({ ...assetProfileInput, compatibilityKey: "   " })).toThrow();
  });

  it("validiert Locks und Pflichtwerte auch für noch unreferenzierte Kategorieprofile", () => {
    expect(
      ProfileLibrarySchema.safeParse({
        baseProfiles: [baseProfileInput],
        categoryProfiles: [{ ...categoryProfileInput, overrides: { tileSize: 64 } }],
        assetProfiles: [],
      }).success,
    ).toBe(false);

    expect(
      ProfileLibrarySchema.safeParse({
        baseProfiles: [
          {
            ...baseProfileInput,
            values: {
              ...baseProfileInput.values,
              lightingDefaults: { policy: "custom", notes: "alpha  beta" },
            },
            locks: { lightingDefaults: true },
          },
        ],
        categoryProfiles: [
          {
            ...categoryProfileInput,
            overrides: {
              lightingDefaults: { policy: "custom", notes: "alpha beta" },
            },
          },
        ],
        assetProfiles: [],
      }).success,
    ).toBe(true);

    const baseWithoutCharacterHeight = {
      ...baseProfileInput,
      id: "base_without_character_height",
      values: Object.fromEntries(
        Object.entries(baseProfileInput.values).filter(([key]) => key !== "characterHeight"),
      ),
      locks: {},
    };
    expect(
      ProfileLibrarySchema.safeParse({
        baseProfiles: [baseWithoutCharacterHeight],
        categoryProfiles: [
          {
            ...categoryProfileInput,
            id: "category_without_character_height",
            baseProfileId: baseWithoutCharacterHeight.id,
          },
        ],
        assetProfiles: [],
      }).success,
    ).toBe(false);
  });
});
