import { describe, expect, it } from "vitest";
import {
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type BaseProfileLocks,
  type BaseProfileOverrides,
  type BaseProfileValues,
  type CharacterAnswers,
  type MovingObjectAnswers,
  type TextureAnswers,
} from "../../schemas";
import { resolveCapabilities } from "../assets";
import {
  createCompatibilityKey,
  resolveProfile,
  type ProfileResolutionResult,
  type SuccessfulProfileResolution,
} from "./index";

const timestamp = "2026-09-02T12:00:00.000Z";
const defaultNpcCompatibilityKey = [
  "pf2-compat-v1",
  "modern-hd",
  "tile-32",
  "char-80",
  "three-quarter-60",
  "orthographic",
  "outline-soft-selective",
  "camera-south-to-north",
  "style-both",
  "palette-by-profile",
  "nearest-neighbor-on",
  "background-transparent",
  "alpha-padding-8",
  "light-adaptive",
  "light-notes-44-6bbb7cc7c856862a",
].join("__");

const baseValues = {
  pixelDensity: "modernHd",
  styleProfile: "both",
  tileSize: 32,
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
} as const;

interface BaseFixtureOptions {
  readonly id?: string;
  readonly characterHeight?: number | null;
  readonly locks?: BaseProfileLocks;
  readonly values?: Partial<BaseProfileValues>;
}

function createBaseProfile(options: BaseFixtureOptions = {}) {
  const characterHeight = options.characterHeight === undefined ? 80 : options.characterHeight;

  return parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: options.id ?? "base_world_32_80",
    name: `World family ${characterHeight ?? "without character scale"}`,
    iconId: "world-grid",
    values: {
      ...baseValues,
      ...(characterHeight === null ? {} : { characterHeight }),
      ...options.values,
    },
    locks: options.locks ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

interface NpcCategoryFixtureOptions {
  readonly id?: string;
  readonly baseProfileId?: string;
  readonly overrides?: BaseProfileOverrides;
  readonly defaults?: CharacterAnswers;
}

function createNpcCategoryProfile(options: NpcCategoryFixtureOptions = {}) {
  return parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: options.id ?? "category_npc_80",
    name: "NPC family",
    baseProfileId: options.baseProfileId ?? "base_world_32_80",
    category: "character",
    subtype: "npc",
    iconId: "character-npc",
    capabilities: resolveCapabilities("character", "npc"),
    overrides: options.overrides ?? {},
    defaults: options.defaults ?? {
      role: "villager",
      directionCount: 8,
      animationAction: "walk",
      framesPerDirection: 5,
    },
    tags: ["npc"],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

interface NpcAssetFixtureOptions {
  readonly id?: string;
  readonly name?: string;
  readonly baseProfileId?: string;
  readonly categoryProfileId?: string | null;
  readonly compatibilityKey?: string;
  readonly overrides?: BaseProfileOverrides;
  readonly answers?: CharacterAnswers;
  readonly tags?: readonly string[];
}

function createNpcAssetProfile(options: NpcAssetFixtureOptions = {}) {
  const categoryProfileId =
    options.categoryProfileId === undefined ? "category_npc_80" : options.categoryProfileId;

  return parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: options.id ?? "asset_npc_blacksmith_001",
    name: options.name ?? "Village blacksmith",
    baseProfileId: options.baseProfileId ?? "base_world_32_80",
    ...(categoryProfileId === null ? {} : { categoryProfileId }),
    compatibilityKey: options.compatibilityKey ?? "stale-imported-key",
    category: "character",
    subtype: "npc",
    iconId: "character-npc",
    badgeIconIds: ["profession-craft"],
    capabilities: resolveCapabilities("character", "npc"),
    overrides: options.overrides ?? {},
    answers: options.answers ?? { role: "blacksmith" },
    tags: options.tags ?? ["npc", "craft"],
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

interface TextureCategoryFixtureOptions {
  readonly id: string;
  readonly baseProfileId: string;
  readonly overrides?: BaseProfileOverrides;
  readonly defaults?: TextureAnswers;
}

function createTextureCategoryProfile(options: TextureCategoryFixtureOptions) {
  return parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: options.id,
    name: "Wood textures",
    baseProfileId: options.baseProfileId,
    category: "texture",
    subtype: "wood",
    iconId: "texture-wood",
    capabilities: resolveCapabilities("texture", "wood"),
    overrides: options.overrides ?? {},
    defaults: options.defaults ?? { seamless: true, structure: "medium" },
    tags: ["texture", "wood"],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

interface TextureAssetFixtureOptions {
  readonly id: string;
  readonly baseProfileId: string;
  readonly categoryProfileId: string;
  readonly compatibilityKey?: string;
  readonly overrides?: BaseProfileOverrides;
  readonly answers?: TextureAnswers;
}

function createTextureAssetProfile(options: TextureAssetFixtureOptions) {
  return parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: options.id,
    name: "Oak boards",
    baseProfileId: options.baseProfileId,
    categoryProfileId: options.categoryProfileId,
    compatibilityKey: options.compatibilityKey ?? "stale-texture-key",
    category: "texture",
    subtype: "wood",
    iconId: "texture-wood",
    badgeIconIds: [],
    capabilities: resolveCapabilities("texture", "wood"),
    overrides: options.overrides ?? {},
    answers: options.answers ?? { seamless: true, structure: "fine" },
    tags: ["texture", "wood"],
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function createCartCategoryProfile(baseProfileId: string) {
  return parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_cart",
    name: "Carts",
    baseProfileId,
    category: "movingObject",
    subtype: "cart",
    iconId: "moving-cart",
    capabilities: resolveCapabilities("movingObject", "cart"),
    overrides: {},
    defaults: {
      movementType: "roll",
      directionCount: 4,
      animationType: "move",
      framesPerDirection: 4,
      footprint: { widthTiles: 2, depthTiles: 1 },
    } satisfies MovingObjectAnswers,
    tags: ["cart"],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function createCartAssetProfile(baseProfileId: string) {
  return parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_cart_001",
    name: "Merchant cart",
    baseProfileId,
    categoryProfileId: "category_cart",
    compatibilityKey: "stale-cart-key",
    category: "movingObject",
    subtype: "cart",
    iconId: "moving-cart",
    badgeIconIds: [],
    capabilities: resolveCapabilities("movingObject", "cart"),
    overrides: {},
    answers: { purpose: "merchant transport" },
    tags: ["cart"],
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;

  for (const nestedValue of Object.values(value as object as Record<string, unknown>)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
}

function expectResolved(
  result: ProfileResolutionResult,
): asserts result is SuccessfulProfileResolution {
  expect(result.status).toBe("resolved");
  if (result.status !== "resolved") {
    throw new Error("Expected a successful profile resolution.");
  }
}

describe("profile resolution", () => {
  it("groups technically identical 80px NPCs and separates a 96px family", () => {
    const base80 = createBaseProfile();
    const category80 = createNpcCategoryProfile();
    const first80 = createNpcAssetProfile();
    const second80 = createNpcAssetProfile({
      id: "asset_npc_guard_002",
      name: "Night guard",
      compatibilityKey: "another-untrusted-key",
      answers: { role: "guard", directionCount: 4, animationAction: "idle" },
      tags: ["guard", "night"],
    });
    const base96 = createBaseProfile({ id: "base_world_32_96", characterHeight: 96 });
    const category96 = createNpcCategoryProfile({
      id: "category_npc_96",
      baseProfileId: base96.id,
    });
    const asset96 = createNpcAssetProfile({
      id: "asset_npc_guard_096",
      baseProfileId: base96.id,
      categoryProfileId: category96.id,
    });

    const firstResult = resolveProfile({
      baseProfile: base80,
      categoryProfile: category80,
      assetProfile: first80,
    });
    const secondResult = resolveProfile({
      baseProfile: base80,
      categoryProfile: category80,
      assetProfile: second80,
    });
    const result96 = resolveProfile({
      baseProfile: base96,
      categoryProfile: category96,
      assetProfile: asset96,
    });

    expectResolved(firstResult);
    expectResolved(secondResult);
    expectResolved(result96);
    expect(firstResult.conflicts).toEqual([]);
    expect(firstResult.profile.values.characterHeight).toBe(80);
    expect(result96.profile.values.characterHeight).toBe(96);
    expect(firstResult.profile.compatibilityKey).toBe(secondResult.profile.compatibilityKey);
    expect(firstResult.profile.compatibilityKey).toBe(defaultNpcCompatibilityKey);
    expect(firstResult.profile.compatibilityKey).toContain("__char-80__");
    expect(result96.profile.compatibilityKey).toContain("__char-96__");
    expect(result96.profile.compatibilityKey).not.toBe(firstResult.profile.compatibilityKey);
    expect(
      createCompatibilityKey(
        {
          ...base80.values,
          lightingDefaults: {
            ...base80.values.lightingDefaults,
            notes: "  Keep  the world-space light direction stable.  ",
          },
        },
        { category: "character", subtype: "npc" },
      ),
    ).toBe(defaultNpcCompatibilityKey);
  });

  it("ignores characterHeight for texture resolution and compatibility", () => {
    const base80 = createBaseProfile({ id: "base_texture_height_80", characterHeight: 80 });
    const base96 = createBaseProfile({ id: "base_texture_height_96", characterHeight: 96 });
    const category80 = createTextureCategoryProfile({
      id: "category_wood_height_80",
      baseProfileId: base80.id,
    });
    const category96 = createTextureCategoryProfile({
      id: "category_wood_height_96",
      baseProfileId: base96.id,
    });
    const asset80 = createTextureAssetProfile({
      id: "asset_wood_height_80",
      baseProfileId: base80.id,
      categoryProfileId: category80.id,
      overrides: { characterHeight: 160 },
    });
    const asset96 = createTextureAssetProfile({
      id: "asset_wood_height_96",
      baseProfileId: base96.id,
      categoryProfileId: category96.id,
    });

    const result80 = resolveProfile({
      baseProfile: base80,
      categoryProfile: category80,
      assetProfile: asset80,
    });
    const result96 = resolveProfile({
      baseProfile: base96,
      categoryProfile: category96,
      assetProfile: asset96,
    });

    expectResolved(result80);
    expectResolved(result96);
    expect(result80.profile.values).not.toHaveProperty("characterHeight");
    expect(result96.profile.values).not.toHaveProperty("characterHeight");
    expect(result80.profile.compatibilityKey).not.toContain("char-");
    expect(result80.profile.compatibilityKey).toBe(result96.profile.compatibilityKey);
    expect(result80.profile.normalizedOverrides.asset).not.toHaveProperty("characterHeight");
    expect(result80.notices).toContainEqual(
      expect.objectContaining({
        code: "irrelevantOverride",
        source: "asset",
        field: "characterHeight",
        attemptedValue: 160,
      }),
    );
  });

  it("keeps free-composition artwork independent from world geometry", () => {
    const values = createBaseProfile().values;
    const selection = { category: "artwork", subtype: "scene" } as const;
    const baselineKey = createCompatibilityKey(values, selection);
    const changedGeometryKey = createCompatibilityKey(
      {
        ...values,
        tileSize: 512,
        characterHeight: 1024,
        perspectiveType: "side",
        cameraAngle: 30,
        cameraDirection: "seToNw",
        projectionType: "mildPerspective",
      },
      selection,
    );
    const changedOutlineKey = createCompatibilityKey(
      { ...values, outlineStyle: "minimal" },
      selection,
    );
    const maximumLengthKey = createCompatibilityKey(
      {
        ...values,
        lightingDefaults: { policy: "custom", notes: "x".repeat(2000) },
      },
      selection,
    );

    expect(changedGeometryKey).toBe(baselineKey);
    expect(changedOutlineKey).not.toBe(baselineKey);
    expect(maximumLengthKey.length).toBeLessThanOrEqual(500);
  });

  it("blocks locked category and asset overrides with structured conflicts", () => {
    const baseProfile = createBaseProfile({ locks: { tileSize: true } });
    const categoryProfile = createNpcCategoryProfile({ overrides: { tileSize: 48 } });
    const assetProfile = createNpcAssetProfile({ overrides: { tileSize: 64 } });

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict" || result.partialProfile === undefined) {
      throw new Error("Expected a conflicted resolution with a partial profile.");
    }
    expect(result.partialProfile.values.tileSize).toBe(32);
    expect(result.partialProfile.valueSources.tileSize).toBe("base");
    expect(result.partialProfile.normalizedOverrides.category).not.toHaveProperty("tileSize");
    expect(result.partialProfile.normalizedOverrides.asset).not.toHaveProperty("tileSize");
    expect(result.conflicts).toEqual([
      {
        code: "lockedOverride",
        source: "category",
        field: "tileSize",
        profileId: categoryProfile.id,
        inheritedValue: 32,
        attemptedValue: 48,
      },
      {
        code: "lockedOverride",
        source: "asset",
        field: "tileSize",
        profileId: assetProfile.id,
        inheritedValue: 32,
        attemptedValue: 64,
      },
    ]);
  });

  it("applies base, category, and asset values in hierarchy order", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile({
      overrides: { tileSize: 48, paletteMode: "vivid" },
      defaults: {
        role: "villager",
        hat: "wool cap",
        directionCount: 8,
        animationAction: "walk",
        framesPerDirection: 5,
      },
    });
    const assetOverride = createNpcAssetProfile({
      overrides: { tileSize: 64 },
      answers: { role: "blacksmith", hat: undefined },
    });
    const categoryFallback = createNpcAssetProfile({
      id: "asset_npc_category_fallback",
      answers: { role: "merchant" },
    });

    const overridden = resolveProfile({
      baseProfile,
      categoryProfile,
      assetProfile: assetOverride,
    });
    const inherited = resolveProfile({
      baseProfile,
      categoryProfile,
      assetProfile: categoryFallback,
    });

    expectResolved(overridden);
    expectResolved(inherited);
    expect(overridden.profile.values.tileSize).toBe(64);
    expect(overridden.profile.values.paletteMode).toBe("vivid");
    expect(overridden.profile.values.outlineStyle).toBe("softSelective");
    expect(overridden.profile.valueSources).toMatchObject({
      tileSize: "asset",
      paletteMode: "category",
      outlineStyle: "base",
    });
    expect(overridden.profile.normalizedOverrides.category).toMatchObject({
      tileSize: 48,
      paletteMode: "vivid",
    });
    expect(overridden.profile.normalizedOverrides.asset).toEqual({ tileSize: 64 });
    expect(overridden.profile.categoryData.answers).toMatchObject({
      role: "blacksmith",
      hat: "wool cap",
      directionCount: 8,
      animationAction: "walk",
      framesPerDirection: 5,
    });
    expect(inherited.profile.values.tileSize).toBe(48);
    expect(inherited.profile.valueSources.tileSize).toBe("category");
  });

  it("lets an asset legacy character animation replace inherited canonical actions", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile({
      defaults: {
        role: "villager",
        directionCount: 8,
        animationActions: [
          { action: "idle", frames: 2 },
          { action: "walk", frames: 5 },
        ],
      },
    });
    const assetProfile = createNpcAssetProfile({
      answers: {
        role: "guard",
        directionCount: 8,
        animationAction: "attack",
        framesPerDirection: 4,
      },
    });

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expectResolved(result);
    expect(result.profile.categoryData.answers).toMatchObject({
      role: "guard",
      directionCount: 8,
      animationAction: "attack",
      framesPerDirection: 4,
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("animationActions");
  });

  it("lets canonical asset actions replace inherited and same-level legacy animation data", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile({
      defaults: {
        role: "villager",
        directionCount: 8,
        animationAction: "walk",
        framesPerDirection: 5,
      },
    });
    const assetProfile = createNpcAssetProfile({
      answers: {
        role: "guard",
        directionCount: 8,
        animationActions: [
          { action: "idle", frames: 2 },
          { action: "run", frames: 6 },
        ],
        animationAction: "attack",
        framesPerDirection: 8,
      },
    });

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expectResolved(result);
    expect(result.profile.categoryData.answers).toMatchObject({
      role: "guard",
      directionCount: 8,
      animationActions: [
        { action: "idle", frames: 2 },
        { action: "run", frames: 6 },
      ],
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("animationAction");
    expect(result.profile.categoryData.answers).not.toHaveProperty("framesPerDirection");
  });

  it("prefers canonical character actions over legacy fields within category defaults", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile({
      defaults: {
        role: "villager",
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
        animationAction: "idle",
        framesPerDirection: 2,
      },
    });
    const assetProfile = createNpcAssetProfile({ answers: { role: "guard" } });

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expectResolved(result);
    expect(result.profile.categoryData.answers).toMatchObject({
      role: "guard",
      directionCount: 8,
      animationActions: [{ action: "walk", frames: 5 }],
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("animationAction");
    expect(result.profile.categoryData.answers).not.toHaveProperty("framesPerDirection");
  });

  it("treats canonical equal locked values as redundant instead of conflicting", () => {
    const baseProfile = createBaseProfile({
      locks: { alphaPadding: true, lightingDefaults: true },
      values: {
        alphaPadding: 0,
        lightingDefaults: {
          policy: "custom",
          notes: "North key\nlight",
        },
      },
    });
    const categoryProfile = createNpcCategoryProfile({
      overrides: {
        alphaPadding: -0,
        lightingDefaults: {
          policy: "custom",
          notes: "  North  key\r\nlight  ",
        },
      },
    });
    const assetProfile = createNpcAssetProfile();

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expectResolved(result);
    expect(result.profile.values.alphaPadding).toBe(0);
    expect(result.profile.normalizedOverrides.category).toEqual({});
    expect(result.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "redundantOverride", field: "alphaPadding" }),
        expect.objectContaining({ code: "redundantOverride", field: "lightingDefaults" }),
      ]),
    );
  });

  it("allows an asset override to deliberately return to the base value", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile({ overrides: { tileSize: 48 } });
    const assetProfile = createNpcAssetProfile({ overrides: { tileSize: 32 } });

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expectResolved(result);
    expect(result.profile.values.tileSize).toBe(32);
    expect(result.profile.valueSources.tileSize).toBe("asset");
    expect(result.profile.normalizedOverrides.category).toEqual({ tileSize: 48 });
    expect(result.profile.normalizedOverrides.asset).toEqual({ tileSize: 32 });
    expect(result.notices).not.toContainEqual(
      expect.objectContaining({
        code: "redundantOverride",
        source: "asset",
        field: "tileSize",
      }),
    );
  });

  it("rejects scaled-character families without an effective characterHeight", () => {
    const baseProfile = createBaseProfile({ characterHeight: null });
    const categoryProfile = createNpcCategoryProfile();
    const assetProfile = createNpcAssetProfile();

    const result = resolveProfile({ baseProfile, categoryProfile, assetProfile });

    expect(result.status).toBe("conflict");
    expect(result.conflicts).toContainEqual({
      code: "missingRequiredValue",
      source: "base",
      field: "characterHeight",
      profileId: baseProfile.id,
      category: "character",
      subtype: "npc",
    });
    expect(result).not.toHaveProperty("partialProfile");
    expect(() =>
      createCompatibilityKey(baseProfile.values, { category: "character", subtype: "npc" }),
    ).toThrow("requires characterHeight");
  });

  it("computes compatibility keys deterministically instead of trusting stored keys", () => {
    const baseProfile = createBaseProfile();
    const categoryProfile = createNpcCategoryProfile();
    const firstAsset = createNpcAssetProfile({ compatibilityKey: "forged-import-key" });
    const secondAsset = createNpcAssetProfile({
      id: "asset_npc_same_technical_family",
      name: "Different display metadata",
      compatibilityKey: "different-forged-key",
      answers: { role: "scholar" },
      tags: ["scholar"],
    });

    const firstResult = resolveProfile({
      baseProfile,
      categoryProfile,
      assetProfile: firstAsset,
    });
    const repeatedResult = resolveProfile({
      assetProfile: firstAsset,
      categoryProfile,
      baseProfile,
    });
    const secondResult = resolveProfile({
      baseProfile,
      categoryProfile,
      assetProfile: secondAsset,
    });

    expectResolved(firstResult);
    expectResolved(repeatedResult);
    expectResolved(secondResult);
    expect(firstResult).toEqual(repeatedResult);
    expect(firstResult.profile.compatibilityKey).toBe(secondResult.profile.compatibilityKey);
    expect(firstResult.profile.compatibilityKey).not.toBe(firstAsset.compatibilityKey);
    expect(firstResult.notices).toContainEqual({
      code: "staleCompatibilityKey",
      source: "asset",
      profileId: firstAsset.id,
      storedKey: "forged-import-key",
      computedKey: firstResult.profile.compatibilityKey,
    });
    expect(firstAsset.compatibilityKey).toBe("forged-import-key");
  });

  it("reports invalid hierarchy references without applying unrelated category data", () => {
    const baseProfile = createBaseProfile();
    const requestedCategory = createNpcCategoryProfile();
    const assetProfile = createNpcAssetProfile();

    const missingBase = resolveProfile({ assetProfile });
    expect(missingBase.status).toBe("conflict");
    expect(missingBase.conflicts).toContainEqual({
      code: "missingReference",
      source: "asset",
      reference: "baseProfile",
      profileId: assetProfile.id,
      requestedId: baseProfile.id,
    });
    expect(missingBase).not.toHaveProperty("partialProfile");

    const missingCategory = resolveProfile({ baseProfile, assetProfile });
    expect(missingCategory.status).toBe("conflict");
    expect(missingCategory.conflicts).toContainEqual({
      code: "missingReference",
      source: "asset",
      reference: "categoryProfile",
      profileId: assetProfile.id,
      requestedId: requestedCategory.id,
    });

    const unexpectedCategory = resolveProfile({
      baseProfile,
      categoryProfile: requestedCategory,
      assetProfile: createNpcAssetProfile({
        id: "asset_without_category_reference",
        categoryProfileId: null,
      }),
    });
    expect(unexpectedCategory.conflicts).toContainEqual(
      expect.objectContaining({ code: "unexpectedCategoryReference", source: "asset" }),
    );

    const actualCategory = createNpcCategoryProfile({ id: "category_npc_actual" });
    const categoryIdMismatch = resolveProfile({
      baseProfile,
      categoryProfile: actualCategory,
      assetProfile,
    });
    expect(categoryIdMismatch.conflicts).toContainEqual({
      code: "referenceIdMismatch",
      source: "asset",
      reference: "categoryProfile",
      profileId: assetProfile.id,
      expectedId: requestedCategory.id,
      actualId: actualCategory.id,
    });

    const baseIdMismatch = resolveProfile({
      baseProfile,
      categoryProfile: requestedCategory,
      assetProfile: createNpcAssetProfile({
        id: "asset_wrong_base_reference",
        baseProfileId: "base_wrong_reference",
      }),
    });
    expect(baseIdMismatch.conflicts).toContainEqual(
      expect.objectContaining({
        code: "referenceIdMismatch",
        source: "asset",
        reference: "baseProfile",
        expectedId: "base_wrong_reference",
        actualId: baseProfile.id,
      }),
    );

    const categoryBaseMismatch = resolveProfile({
      baseProfile,
      categoryProfile: createNpcCategoryProfile({
        baseProfileId: "base_expected_by_category",
      }),
      assetProfile,
    });
    expect(categoryBaseMismatch.conflicts).toContainEqual(
      expect.objectContaining({
        code: "referenceIdMismatch",
        source: "category",
        reference: "baseProfile",
        expectedId: "base_expected_by_category",
        actualId: baseProfile.id,
      }),
    );

    const merchantCategory = parseCategoryProfile({
      ...requestedCategory,
      id: "category_merchant_classification",
      name: "Merchant family",
      subtype: "merchant",
    });
    const subtypeMismatch = resolveProfile({
      baseProfile,
      categoryProfile: merchantCategory,
      assetProfile: createNpcAssetProfile({
        id: "asset_wrong_subtype",
        categoryProfileId: merchantCategory.id,
      }),
    });
    expect(subtypeMismatch.conflicts).toEqual([
      expect.objectContaining({
        code: "classificationMismatch",
        field: "subtype",
        expectedValue: "npc",
        actualValue: "merchant",
      }),
    ]);

    const textureCategory = createTextureCategoryProfile({
      id: "category_texture_classification",
      baseProfileId: baseProfile.id,
      overrides: { tileSize: 128 },
    });
    const classificationMismatch = resolveProfile({
      baseProfile,
      categoryProfile: textureCategory,
      assetProfile: createNpcAssetProfile({
        id: "asset_wrong_classification",
        categoryProfileId: textureCategory.id,
      }),
    });
    expect(classificationMismatch.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "classificationMismatch",
          field: "category",
          expectedValue: "character",
          actualValue: "texture",
        }),
        expect.objectContaining({
          code: "classificationMismatch",
          field: "subtype",
          expectedValue: "npc",
          actualValue: "wood",
        }),
      ]),
    );
    expect(classificationMismatch).not.toHaveProperty("partialProfile");
    expect(classificationMismatch.notices).toEqual([]);
  });

  it("does not mutate even deeply frozen profile inputs", () => {
    const input = deepFreeze({
      baseProfile: createBaseProfile(),
      categoryProfile: createNpcCategoryProfile({
        overrides: { lightingDefaults: { policy: "neutralDay", notes: "Northwest key light" } },
      }),
      assetProfile: createNpcAssetProfile({
        compatibilityKey: "keep-this-input-unchanged",
        answers: { role: "blacksmith", directionCount: 8 },
      }),
    });
    const before = structuredClone(input);

    const firstResult = resolveProfile(input);
    const secondResult = resolveProfile(input);

    expect(firstResult).toEqual(secondResult);
    expect(input).toEqual(before);
    expect(input.assetProfile.compatibilityKey).toBe("keep-this-input-unchanged");
  });

  it("returns deeply frozen profiles, collections, nested values, answers, and diagnostics", () => {
    const baseProfile = createBaseProfile({ locks: { tileSize: true } });
    const cartCategory = createCartCategoryProfile(baseProfile.id);
    const cartAsset = createCartAssetProfile(baseProfile.id);
    const resolved = resolveProfile({
      baseProfile,
      categoryProfile: cartCategory,
      assetProfile: cartAsset,
    });
    const conflicted = resolveProfile({
      baseProfile,
      categoryProfile: createNpcCategoryProfile({ overrides: { tileSize: 48 } }),
      assetProfile: createNpcAssetProfile(),
    });

    expectResolved(resolved);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.profile)).toBe(true);
    expect(Object.isFrozen(resolved.profile.categoryData)).toBe(true);
    expect(Object.isFrozen(resolved.profile.categoryData.answers)).toBe(true);
    if (resolved.profile.categoryData.category !== "movingObject") {
      throw new Error("Expected resolved cart category data.");
    }
    const footprint = resolved.profile.categoryData.answers.footprint;
    expect(footprint).toEqual({ widthTiles: 2, depthTiles: 1 });
    expect(Object.isFrozen(footprint)).toBe(true);
    expect(Object.isFrozen(resolved.profile.capabilities)).toBe(true);
    expect(Object.isFrozen(resolved.profile.values)).toBe(true);
    expect(Object.isFrozen(resolved.profile.values.lightingDefaults)).toBe(true);
    expect(Object.isFrozen(resolved.profile.valueSources)).toBe(true);
    expect(Object.isFrozen(resolved.profile.normalizedOverrides)).toBe(true);
    expect(Object.isFrozen(resolved.profile.normalizedOverrides.category)).toBe(true);
    expect(Object.isFrozen(resolved.profile.normalizedOverrides.asset)).toBe(true);
    expect(Object.isFrozen(resolved.conflicts)).toBe(true);
    expect(Object.isFrozen(resolved.notices)).toBe(true);
    expect(resolved.notices.length).toBeGreaterThan(0);
    expect(resolved.notices.every((notice) => Object.isFrozen(notice))).toBe(true);
    expect(conflicted.conflicts.length).toBeGreaterThan(0);
    expect(conflicted.conflicts.every((conflict) => Object.isFrozen(conflict))).toBe(true);
  });
});
