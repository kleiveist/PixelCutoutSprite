import { describe, expect, it } from "vitest";
import { LEGACY_V1_DEFAULT_STATE } from "../legacy-v1";
import { parseLegacyV1State, ProfileLibrarySchema } from "../../schemas";
import {
  LEGACY_V1_ASSET_SELECTIONS,
  transformLegacyV1Sources,
  type LegacyV1MigrationSource,
} from "./index";

const migratedAt = "2026-09-02T12:00:00.000Z";

describe("legacy V1 profile transformation", () => {
  it("maps every V1 asset type explicitly and never leaks directions to static assets", () => {
    const sources = Object.keys(LEGACY_V1_ASSET_SELECTIONS).map(
      (assetType, sourceIndex): LegacyV1MigrationSource => ({
        sourceKind: "jsonImport",
        sourceStorageKey: "synthetic-v1-import",
        sourceIndex,
        state: parseLegacyV1State({
          ...LEGACY_V1_DEFAULT_STATE,
          assetType,
          projectName: `Synthetic ${assetType}`,
        }),
      }),
    );

    const result = transformLegacyV1Sources(sources, migratedAt);

    expect(ProfileLibrarySchema.safeParse(result.library).success).toBe(true);
    expect(result.library.assetProfiles).toHaveLength(18);
    for (const profile of result.library.assetProfiles) {
      const legacyData = profile.legacyData as {
        normalizedState: { assetType: keyof typeof LEGACY_V1_ASSET_SELECTIONS };
      };
      const expected = LEGACY_V1_ASSET_SELECTIONS[legacyData.normalizedState.assetType];
      expect({ category: profile.category, subtype: profile.subtype }).toEqual(expected);
      if (profile.category === "character") {
        expect(profile.answers.directionCount).toBe(8);
      } else {
        expect(profile.answers).not.toHaveProperty("directionCount");
      }
      expect(profile.migratedFromVersion).toBe(1);
    }

    const weapon = result.library.assetProfiles.find((profile) => {
      const legacyData = profile.legacyData as { normalizedState: { assetType: string } };
      return legacyData.normalizedState.assetType === "weapon";
    });
    expect(weapon).toMatchObject({ category: "item", subtype: "weapon" });
  });

  it("derives deterministic ids from technical values and source slots, not display names", () => {
    const first = transformLegacyV1Sources(
      [
        {
          sourceKind: "preset",
          sourceStorageKey: "synthetic-slot",
          sourceIndex: 3,
          displayName: "First visible name",
          state: parseLegacyV1State(LEGACY_V1_DEFAULT_STATE),
        },
      ],
      migratedAt,
    );
    const renamed = transformLegacyV1Sources(
      [
        {
          sourceKind: "preset",
          sourceStorageKey: "synthetic-slot",
          sourceIndex: 3,
          displayName: "Renamed later",
          state: parseLegacyV1State(LEGACY_V1_DEFAULT_STATE),
        },
      ],
      migratedAt,
    );

    expect(renamed.library.assetProfiles[0]?.id).toBe(first.library.assetProfiles[0]?.id);
    expect(renamed.library.assetProfiles[0]?.name).not.toBe(first.library.assetProfiles[0]?.name);
    expect(first.library.baseProfiles[0]?.locks).toEqual({});
  });

  it("maps global production values exactly and isolates the complete legacy state", () => {
    const state = parseLegacyV1State({
      ...LEGACY_V1_DEFAULT_STATE,
      profileOutputMode: "selected",
      selectedProfile: "dark",
      pixelDensity: "ultraHd",
      tileSize: 64,
      characterHeight: 96,
      perspectiveType: "isometric",
      cameraAngle: "45",
      cameraDirection: "swToNe",
      projectionType: "mildPerspective",
      outlineStyle: "minimal",
      paletteMode: "desaturated",
      backgroundMode: "scene",
      alphaPadding: 12,
      nearestNeighbor: false,
      lightingPolicy: "coolNight",
      lightingNotes: "Stable moonlight.",
    });
    const result = transformLegacyV1Sources(
      [
        {
          sourceKind: "autosave",
          sourceStorageKey: "global-mapping",
          sourceIndex: 0,
          state,
        },
      ],
      migratedAt,
    );

    expect(result.library.baseProfiles[0]?.values).toEqual({
      pixelDensity: "ultraHd",
      styleProfile: "dark",
      tileSize: 64,
      characterHeight: 96,
      perspectiveType: "isometric",
      cameraAngle: 45,
      cameraDirection: "swToNe",
      projectionType: "mildPerspective",
      outlineStyle: "minimal",
      paletteMode: "desaturated",
      backgroundMode: "scene",
      alphaPadding: 12,
      nearestNeighbor: false,
      lightingDefaults: { policy: "coolNight", notes: "Stable moonlight." },
    });
    const legacyData = result.library.assetProfiles[0]?.legacyData as {
      normalizedState: Record<string, unknown>;
    };
    expect(Object.keys(legacyData.normalizedState).sort()).toEqual(
      Object.keys(LEGACY_V1_DEFAULT_STATE).sort(),
    );
  });
});
