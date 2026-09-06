import { describe, expect, it } from "vitest";
import {
  ProfileLibrarySchema,
  StableIdSchema,
  type AssetProfile,
  type BaseProfile,
  type ProfileLibrary,
} from "../../schemas";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import {
  createBaseProfile,
  createDuplicateProfileName,
  deleteAssetProfile,
  duplicateAssetProfile,
  duplicateBaseProfile,
  saveAssetProfile,
  toggleAssetProfileFavorite,
  type AssetProfileSaveDefinition,
  type AssetProfileLibraryChange,
  type BaseProfileDefinition,
  type BaseProfileLibraryChange,
} from "./index";

function profileById(library: ProfileLibrary, id: string): AssetProfile {
  const profile = library.assetProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Expected fixture profile "${id}".`);
  return profile;
}

function baseById(library: ProfileLibrary, id: string): BaseProfile {
  const profile = library.baseProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Expected fixture Base profile "${id}".`);
  return profile;
}

function expectChanged(
  result: AssetProfileLibraryChange,
): asserts result is Extract<AssetProfileLibraryChange, { status: "changed" }> {
  expect(result.status).toBe("changed");
  if (result.status !== "changed") {
    throw new Error(`Expected a changed library, received "${result.status}".`);
  }
}

function expectBaseChanged(
  result: BaseProfileLibraryChange,
): asserts result is Extract<BaseProfileLibraryChange, { status: "changed" }> {
  expect(result.status).toBe("changed");
  if (result.status !== "changed") {
    throw new Error(`Expected a changed library, received "${result.status}".`);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value as object as Record<string, unknown>)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

describe("base profile library mutations", () => {
  it("creates a standalone production family without changing existing descendants", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const before = createProfileLibraryFixture();
    const source = baseById(library, "base_world_80");
    const profileId = StableIdSchema.parse("base_world_112");
    const timestamp = "2026-09-03T20:00:00.000Z";
    const definition: BaseProfileDefinition = {
      name: "Weltfamilie 48 px / Figuren 112 px",
      iconId: "world-grid",
      values: {
        ...source.values,
        tileSize: 48,
        characterHeight: 112,
        lightingDefaults: {
          policy: "gloomyDiffuse",
          notes: "Stable northwest world light.",
        },
      },
      locks: { tileSize: true, characterHeight: true },
    };

    const result = createBaseProfile(library, profileId, timestamp, definition);

    expectBaseChanged(result);
    expect(result.profile).toEqual({
      schemaVersion: 2,
      kind: "baseProfile",
      id: profileId,
      ...definition,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(result.profile.values).not.toBe(definition.values);
    expect(result.profile.values.lightingDefaults).not.toBe(definition.values.lightingDefaults);
    expect(result.profile.locks).not.toBe(definition.locks);
    expect(result.library.baseProfiles).toHaveLength(library.baseProfiles.length + 1);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.library.assetProfiles).toBe(library.assetProfiles);
    expect(
      result.library.categoryProfiles.every((profile) => profile.baseProfileId !== profileId),
    ).toBe(true);
    expect(
      result.library.assetProfiles.every((profile) => profile.baseProfileId !== profileId),
    ).toBe(true);
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
    expect(library).toEqual(before);
  });

  it("duplicates only the Base and drops migration provenance", () => {
    const fixture = createProfileLibraryFixture();
    const sourceId = StableIdSchema.parse("base_world_80");
    const source = baseById(fixture, sourceId);
    const migratedSource: BaseProfile = {
      ...source,
      migratedFromVersion: 1,
    };
    const library = deepFreeze(
      ProfileLibrarySchema.parse({
        ...fixture,
        baseProfiles: fixture.baseProfiles.map((profile) =>
          profile.id === sourceId ? migratedSource : profile,
        ),
      }),
    );
    const storedSource = baseById(library, sourceId);
    const duplicateId = StableIdSchema.parse("base_world_80_copy");
    const timestamp = "2026-09-03T20:15:00.000Z";

    const result = duplicateBaseProfile(library, sourceId, duplicateId, timestamp);

    expectBaseChanged(result);
    expect(result.profile).toMatchObject({
      id: duplicateId,
      name: "Weltfamilie 32 px / Figuren 80 px (Kopie)",
      iconId: storedSource.iconId,
      values: storedSource.values,
      locks: storedSource.locks,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(result.profile).not.toHaveProperty("migratedFromVersion");
    expect(result.profile.values).not.toBe(storedSource.values);
    expect(result.profile.values.lightingDefaults).not.toBe(storedSource.values.lightingDefaults);
    expect(result.profile.locks).not.toBe(storedSource.locks);
    expect(baseById(result.library, sourceId)).toBe(storedSource);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.library.assetProfiles).toBe(library.assetProfiles);
    expect(
      result.library.categoryProfiles.some((profile) => profile.baseProfileId === duplicateId),
    ).toBe(false);
    expect(
      result.library.assetProfiles.some((profile) => profile.baseProfileId === duplicateId),
    ).toBe(false);
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
  });

  it("applies a complete proposed definition to a duplicate while preserving the source", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const sourceId = StableIdSchema.parse("base_world_80");
    const source = baseById(library, sourceId);
    const duplicateId = StableIdSchema.parse("base_world_48_96");
    const definition: BaseProfileDefinition = {
      name: "Dungeonfamilie 48 px / Figuren 96 px",
      iconId: "dungeon-grid",
      values: {
        ...source.values,
        tileSize: 48,
        characterHeight: 96,
        styleProfile: "dark",
        lightingDefaults: {
          policy: "gloomyDiffuse",
          notes: "Controlled subterranean light.",
        },
      },
      locks: {
        ...source.locks,
        tileSize: true,
        characterHeight: true,
        lightingDefaults: true,
      },
    };

    const result = duplicateBaseProfile(
      library,
      sourceId,
      duplicateId,
      "2026-09-03T20:30:00.000Z",
      definition,
    );

    expectBaseChanged(result);
    expect(result.profile).toMatchObject({
      id: duplicateId,
      ...definition,
    });
    expect(baseById(result.library, sourceId)).toBe(source);
    expect(source.values.tileSize).toBe(32);
    expect(source.values.characterHeight).toBe(80);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.library.assetProfiles).toBe(library.assetProfiles);
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
  });

  it("rejects missing sources and Base-id collisions without changing the graph", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = baseById(library, "base_world_80");
    const occupiedId = StableIdSchema.parse("base_world_96");
    const missingId = StableIdSchema.parse("base_missing");
    const definition: BaseProfileDefinition = {
      name: "Nicht gespeichert",
      iconId: source.iconId,
      values: source.values,
      locks: source.locks,
    };

    expect(createBaseProfile(library, occupiedId, "2026-09-03T21:00:00.000Z", definition)).toEqual({
      status: "idConflict",
      profileId: occupiedId,
    });
    expect(
      duplicateBaseProfile(
        library,
        missingId,
        StableIdSchema.parse("base_copy"),
        "2026-09-03T21:00:00.000Z",
      ),
    ).toEqual({ status: "notFound", profileId: missingId });
    expect(
      duplicateBaseProfile(library, source.id, occupiedId, "2026-09-03T21:00:00.000Z"),
    ).toEqual({ status: "idConflict", profileId: occupiedId });
    expect(library).toEqual(createProfileLibraryFixture());
  });
});

describe("asset profile library mutations", () => {
  it("toggles a favorite immutably without treating it as a content edit", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const before = createProfileLibraryFixture();
    const source = profileById(library, "asset_smith_80");
    const untouched = profileById(library, "asset_guard_80");

    const result = toggleAssetProfileFavorite(library, source.id);

    expectChanged(result);
    expect(result.library).not.toBe(library);
    expect(result.library.assetProfiles).not.toBe(library.assetProfiles);
    expect(result.library.baseProfiles).toBe(library.baseProfiles);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.profile).toMatchObject({
      id: source.id,
      favorite: false,
      updatedAt: source.updatedAt,
    });
    expect(profileById(result.library, untouched.id)).toBe(untouched);
    expect(source.favorite).toBe(true);
    expect(library).toEqual(before);
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);

    const restored = toggleAssetProfileFavorite(result.library, source.id);
    expectChanged(restored);
    expect(restored.profile.favorite).toBe(true);
    expect(restored.profile.updatedAt).toBe(source.updatedAt);
  });

  it("duplicates a leaf with stable references and key but fresh V2 identity", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_smith_80");
    const duplicateId = StableIdSchema.parse("asset_smith_copy");
    const duplicateTimestamp = "2026-09-03T09:30:00.000Z";

    const result = duplicateAssetProfile(library, source.id, duplicateId, duplicateTimestamp);

    expectChanged(result);
    expect(result.library.assetProfiles).toHaveLength(library.assetProfiles.length + 1);
    expect(result.library.baseProfiles).toBe(library.baseProfiles);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.profile).toMatchObject({
      id: duplicateId,
      name: "Dorfschmied mit Lederschürze (Kopie)",
      baseProfileId: source.baseProfileId,
      categoryProfileId: source.categoryProfileId,
      compatibilityKey: source.compatibilityKey,
      category: source.category,
      subtype: source.subtype,
      favorite: false,
      createdAt: duplicateTimestamp,
      updatedAt: duplicateTimestamp,
    });
    expect(result.profile.answers).toEqual(source.answers);
    expect(result.profile.overrides).toEqual(source.overrides);
    expect(result.profile.tags).toEqual(source.tags);
    expect(result.profile.capabilities).toEqual(source.capabilities);
    expect(result.profile).not.toHaveProperty("migratedFromVersion");
    expect(result.profile).not.toHaveProperty("legacyData");
    expect(source).toMatchObject({
      migratedFromVersion: 1,
      legacyData: { source: "fixture" },
      createdAt: PROFILE_FIXTURE_TIMESTAMP,
      favorite: true,
    });
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
  });

  it("keeps generated copy names schema-safe and rejects an asset-id collision", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_smith_80");
    const occupiedId = profileById(library, "asset_guard_80").id;
    const maximumName = createDuplicateProfileName("x".repeat(120));

    expect(maximumName).toHaveLength(120);
    expect(maximumName).toMatch(/ \(Kopie\)$/);

    const result = duplicateAssetProfile(
      library,
      source.id,
      occupiedId,
      "2026-09-03T10:00:00.000Z",
    );

    expect(result).toEqual({ status: "idConflict", profileId: occupiedId });
    expect(library).toEqual(createProfileLibraryFixture());
  });

  it("numbers repeated copies with distinct schema-safe accessible names", () => {
    const library = createProfileLibraryFixture();
    const first = duplicateAssetProfile(
      library,
      StableIdSchema.parse("asset_smith_80"),
      StableIdSchema.parse("asset_smith_copy_1"),
      "2026-09-03T10:00:00.000Z",
    );
    expectChanged(first);

    const second = duplicateAssetProfile(
      first.library,
      StableIdSchema.parse("asset_smith_80"),
      StableIdSchema.parse("asset_smith_copy_2"),
      "2026-09-03T10:01:00.000Z",
    );
    expectChanged(second);

    const third = duplicateAssetProfile(
      second.library,
      StableIdSchema.parse("asset_smith_copy_1"),
      StableIdSchema.parse("asset_smith_copy_3"),
      "2026-09-03T10:02:00.000Z",
    );
    expectChanged(third);

    expect([first.profile.name, second.profile.name, third.profile.name]).toEqual([
      "Dorfschmied mit Lederschürze (Kopie)",
      "Dorfschmied mit Lederschürze (Kopie 2)",
      "Dorfschmied mit Lederschürze (Kopie 3)",
    ]);
    expect(ProfileLibrarySchema.safeParse(third.library).success).toBe(true);
  });

  it("creates a reviewed Asset profile with clean local metadata", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_oak_wood");
    if (source.category !== "texture") {
      throw new Error("Expected the Texture profile fixture.");
    }
    const profileId = StableIdSchema.parse("asset_reviewed_oak");
    const timestamp = "2026-09-03T22:00:00.000Z";
    const definition: AssetProfileSaveDefinition = {
      name: "Geprüfte Eichenplanken",
      baseProfileId: source.baseProfileId,
      compatibilityKey: source.compatibilityKey,
      capabilities: source.capabilities,
      overrides: source.overrides,
      category: source.category,
      subtype: source.subtype,
      answers: { ...source.answers, condition: "old" },
    };

    const result = saveAssetProfile(library, profileId, timestamp, definition);

    expectChanged(result);
    expect(result.profile).toMatchObject({
      id: profileId,
      name: definition.name,
      iconId: "wizard-draft",
      badgeIconIds: [],
      tags: [],
      favorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      answers: definition.answers,
    });
    expect(result.library.baseProfiles).toBe(library.baseProfiles);
    expect(result.library.categoryProfiles).toBe(library.categoryProfiles);
    expect(result.library.assetProfiles).toHaveLength(library.assetProfiles.length + 1);
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
  });

  it("updates a reviewed source at its stable ID and preserves library metadata", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_smith_80");
    if (source.category !== "character") {
      throw new Error("Expected the Character profile fixture.");
    }
    const timestamp = "2026-09-03T22:15:00.000Z";
    const definition: AssetProfileSaveDefinition = {
      sourceAssetProfileId: source.id,
      name: "Dorfschmied · geprüft",
      baseProfileId: source.baseProfileId,
      ...(source.categoryProfileId === undefined
        ? {}
        : { categoryProfileId: source.categoryProfileId }),
      compatibilityKey: source.compatibilityKey,
      capabilities: source.capabilities,
      overrides: source.overrides,
      category: source.category,
      subtype: source.subtype,
      answers: { ...source.answers, role: "master blacksmith" },
    };

    const result = saveAssetProfile(
      library,
      StableIdSchema.parse("asset_unused_generated_id"),
      timestamp,
      definition,
    );

    expectChanged(result);
    expect(result.library.assetProfiles).toHaveLength(library.assetProfiles.length);
    expect(result.profile).toMatchObject({
      id: source.id,
      name: definition.name,
      iconId: source.iconId,
      badgeIconIds: source.badgeIconIds,
      tags: source.tags,
      favorite: source.favorite,
      migratedFromVersion: source.migratedFromVersion,
      legacyData: source.legacyData,
      createdAt: source.createdAt,
      updatedAt: timestamp,
    });
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
    expect(library).toEqual(createProfileLibraryFixture());
  });

  it("rejects missing save sources and new Asset-id collisions", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_oak_wood");
    if (source.category !== "texture") {
      throw new Error("Expected the Texture profile fixture.");
    }
    const common = {
      name: source.name,
      baseProfileId: source.baseProfileId,
      compatibilityKey: source.compatibilityKey,
      capabilities: source.capabilities,
      overrides: source.overrides,
      category: source.category,
      subtype: source.subtype,
      answers: source.answers,
    } as const satisfies AssetProfileSaveDefinition;

    expect(saveAssetProfile(library, source.id, "2026-09-03T22:30:00.000Z", common)).toEqual({
      status: "idConflict",
      profileId: source.id,
    });
    expect(
      saveAssetProfile(library, StableIdSchema.parse("asset_new"), "2026-09-03T22:30:00.000Z", {
        ...common,
        sourceAssetProfileId: StableIdSchema.parse("asset_missing"),
      }),
    ).toEqual({
      status: "notFound",
      profileId: StableIdSchema.parse("asset_missing"),
    });
  });

  it("deletes only the requested asset leaf and preserves the complete dependency graph", () => {
    const library = deepFreeze(createProfileLibraryFixture());
    const source = profileById(library, "asset_smith_80");
    const sameCompatibilityFamily = profileById(library, "asset_guard_80");
    const baseProfiles = library.baseProfiles;
    const categoryProfiles = library.categoryProfiles;

    const result = deleteAssetProfile(library, source.id);

    expectChanged(result);
    expect(result.profile).toBe(source);
    expect(result.library.baseProfiles).toBe(baseProfiles);
    expect(result.library.categoryProfiles).toBe(categoryProfiles);
    expect(result.library.assetProfiles).toHaveLength(library.assetProfiles.length - 1);
    expect(result.library.assetProfiles.some((profile) => profile.id === source.id)).toBe(false);
    expect(profileById(result.library, sameCompatibilityFamily.id)).toBe(sameCompatibilityFamily);
    expect(
      result.library.categoryProfiles.some((profile) => profile.id === source.categoryProfileId),
    ).toBe(true);
    expect(result.library.baseProfiles.some((profile) => profile.id === source.baseProfileId)).toBe(
      true,
    );
    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
    expect(library).toEqual(createProfileLibraryFixture());

    expect(deleteAssetProfile(result.library, source.id)).toEqual({
      status: "notFound",
      profileId: source.id,
    });
  });
});
