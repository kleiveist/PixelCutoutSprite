import { describe, expect, it } from "vitest";
import {
  ProfileLibrarySchema,
  StableIdSchema,
  type ProfileLibrary,
  type StableId,
} from "../../schemas";
import type { StorageReadResult } from "../../services";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { DEFAULT_PROFILE_LIBRARY_FILTERS, type ProfileLibraryFilters } from "../../store/profiles";
import { createProfileLibraryData, type ProfileLibraryData } from "./profileLibraryData";

function validLibrary(library: ProfileLibrary): StorageReadResult<ProfileLibrary> {
  return { status: "valid", value: library };
}

function filters(overrides: Partial<ProfileLibraryFilters> = {}): ProfileLibraryFilters {
  return { ...DEFAULT_PROFILE_LIBRARY_FILTERS, ...overrides };
}

function visibleIds(data: ProfileLibraryData): readonly StableId[] {
  return data.groups.flatMap((group) => group.profiles.map((profile) => profile.id));
}

function profileSummary(data: ProfileLibraryData, id: string) {
  const profile = data.groups
    .flatMap((group) => group.profiles)
    .find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Expected visible profile "${id}".`);
  return profile;
}

describe("profile library data", () => {
  it("offers every resolvable profile as a deterministic ready-made option", () => {
    const library = createProfileLibraryFixture();
    const result = createProfileLibraryData(
      validLibrary(library),
      filters({ profileId: StableIdSchema.parse("asset_smith_80") }),
    );

    expect(result.visibleProfileCount).toBe(1);
    expect(visibleIds(result)).toEqual(["asset_smith_80"]);
    expect(result.profileOptions).toHaveLength(6);
    expect(result.profileOptions.map((option) => option.name)).toEqual(
      [...result.profileOptions.map((option) => option.name)].sort((left, right) =>
        left.localeCompare(right, "de", { sensitivity: "base" }),
      ),
    );
    expect(result.profileOptions).toContainEqual({
      id: "asset_smith_80",
      name: "Dorfschmied mit Lederschürze",
      categoryLabel: "Charakter / Figur",
      subtypeLabel: "NPC",
    });
  });

  it("combines profile, category, base, and favorite filters with AND semantics", () => {
    const library = createProfileLibraryFixture();
    const base96 = library.baseProfiles.find((profile) => profile.id === "base_world_96");
    const base80 = library.baseProfiles.find((profile) => profile.id === "base_world_80");
    if (!base96 || !base80) throw new Error("Expected both filter bases.");

    const match = createProfileLibraryData(
      validLibrary(library),
      filters({
        profileId: StableIdSchema.parse("asset_wet_stone"),
        category: "texture",
        baseProfileId: base96.id,
        favoritesOnly: true,
      }),
    );

    expect(match.visibleProfileCount).toBe(1);
    expect(visibleIds(match)).toEqual(["asset_wet_stone"]);

    const noMatch = createProfileLibraryData(
      validLibrary(library),
      filters({
        profileId: StableIdSchema.parse("asset_wet_stone"),
        category: "texture",
        baseProfileId: base80.id,
        favoritesOnly: true,
      }),
    );
    expect(noMatch.collectionStatus).toBe("ready");
    expect(noMatch.totalProfileCount).toBe(6);
    expect(noMatch.visibleProfileCount).toBe(0);
    expect(noMatch.groups).toEqual([]);
  });

  it("creates only non-empty category groups in canonical category order", () => {
    const result = createProfileLibraryData(validLibrary(createProfileLibraryFixture()), filters());

    expect(result.groups.map((group) => group.id)).toEqual([
      "category-character",
      "category-texture",
      "category-artwork",
    ]);
    expect(result.groups.map((group) => group.profiles.map(({ id }) => id))).toEqual([
      ["asset_smith_80", "asset_guard_80", "asset_mage_96"],
      ["asset_oak_wood", "asset_wet_stone"],
      ["asset_forest_promo"],
    ]);
    expect(result).toMatchObject({
      collectionStatus: "ready",
      totalProfileCount: 6,
      visibleProfileCount: 6,
      skippedProfileCount: 0,
    });
  });

  it("groups by effective compatibility across Base ids and ignores texture character height", () => {
    const result = createProfileLibraryData(
      validLibrary(createProfileLibraryFixture()),
      filters({ groupBy: "compatibility" }),
    );
    const groupedIds = result.groups.map((group) => group.profiles.map((profile) => profile.id));

    expect(groupedIds).toEqual([
      ["asset_smith_80", "asset_guard_80"],
      ["asset_mage_96"],
      ["asset_oak_wood", "asset_wet_stone"],
      ["asset_forest_promo"],
    ]);

    const character80 = result.groups[0];
    const character96 = result.groups[1];
    const textures = result.groups[2];
    if (!character80 || !character96 || !textures) {
      throw new Error("Expected four deterministic compatibility groups.");
    }
    expect(character80.id).toContain("__char-80__");
    expect(character80.description).toContain("Weltfamilie 32 px / Figuren 80 px");
    expect(character80.description).toContain("Parallele Weltfamilie 80 px");
    expect(character96.id).toContain("__char-96__");
    expect(character96.id).not.toBe(character80.id);
    expect(textures.id).not.toContain("__char-");
    expect(textures.profiles.map((profile) => profile.baseProfileId)).toEqual([
      "base_world_80",
      "base_world_96",
    ]);
  });

  it("caps long compatibility base lists with a truthful remainder count", () => {
    const library = createProfileLibraryFixture();
    const sourceBase = library.baseProfiles.find((profile) => profile.id === "base_world_80_twin");
    const sourceProfile = library.assetProfiles.find((profile) => profile.id === "asset_guard_80");
    if (!sourceBase || !sourceProfile) {
      throw new Error("Expected the compatible source chain.");
    }

    const thirdBaseId = StableIdSchema.parse("base_world_80_third");
    const thirdAssetId = StableIdSchema.parse("asset_world_80_third");
    const expandedLibrary = ProfileLibrarySchema.parse({
      ...library,
      baseProfiles: [
        ...library.baseProfiles,
        {
          ...sourceBase,
          id: thirdBaseId,
          name: "Zusätzliche Weltfamilie mit sehr langem Namen",
        },
      ],
      assetProfiles: [
        ...library.assetProfiles,
        {
          ...sourceProfile,
          id: thirdAssetId,
          name: "Dritter kompatibler Charakter",
          baseProfileId: thirdBaseId,
        },
      ],
    });
    const result = createProfileLibraryData(
      validLibrary(expandedLibrary),
      filters({ groupBy: "compatibility" }),
    );
    const characterGroup = result.groups.find((group) =>
      group.profiles.some((profile) => profile.id === thirdAssetId),
    );

    expect(characterGroup?.profiles).toHaveLength(3);
    expect(characterGroup?.description).toContain("+ 1 weitere");
    expect(characterGroup?.description).not.toContain(
      "Zusätzliche Weltfamilie mit sehr langem Namen",
    );
  });

  it("projects capability-relevant card facts for characters, textures, and artwork", () => {
    const result = createProfileLibraryData(validLibrary(createProfileLibraryFixture()), filters());
    const character = profileSummary(result, "asset_smith_80");
    const wood = profileSummary(result, "asset_oak_wood");
    const stone = profileSummary(result, "asset_wet_stone");
    const artwork = profileSummary(result, "asset_forest_promo");

    expect(character.facts).toEqual([
      "Modern-HD",
      "32 px Tile",
      "3/4-RPG",
      "80 px Figur",
      "Transparent",
      "Rolle: blacksmith",
      "8 Richtungen",
      "Walk · 5 Frames",
      "Stil A + B",
    ]);
    expect(character.materials).toEqual(["metal", "leather"]);

    expect(wood.facts).toEqual([
      "Modern-HD",
      "32 px Tile",
      "3/4-RPG",
      "Material: Holz",
      "Einsatz: Boden",
      "Nahtlos kachelbar",
      "Stil A + B",
    ]);
    expect(stone.facts.join(" ")).not.toMatch(/96 px Figur|80 px Figur/);

    expect(artwork.facts).toEqual([
      "Modern-HD",
      "Vollständiger Hintergrund",
      "Artworktyp: Promo-Artwork",
      "Zweck: Präsentation",
      "Komposition: Gestaffelte Szene",
      "Stil A + B",
    ]);
    expect(artwork.facts.join(" ")).not.toMatch(/Tile|Figur|3\/4/);
  });
});
