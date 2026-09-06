import { describe, expect, it } from "vitest";
import {
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type BaseProfile,
  type TilesetAnswers,
} from "../../schemas";
import { resolveCapabilities } from "../assets";
import { createTilesetTechnicalSpecification, getDefaultTilesetType } from "../tilesets";
import { resolveProfile } from "./index";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";

function createBaseProfile(): BaseProfile {
  return parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_tileset_world",
    name: "Tileset world",
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
        notes: "Keep world-space light stable.",
      },
    },
    locks: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
}

describe("Tileset profile resolution", () => {
  it("merges Tileset defaults and Asset answers before calculating technical Atlas output", () => {
    const base = createBaseProfile();
    const category = parseCategoryProfile({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_tileset_autotile",
      name: "Terrain Autotiles",
      baseProfileId: base.id,
      category: "tileset",
      subtype: "autotile",
      iconId: "tileset-autotile",
      capabilities: resolveCapabilities("tileset", "autotile"),
      overrides: { tileSize: 48, paletteMode: "desaturated" },
      defaults: {
        tilesetType: "autotile",
        tileUsage: "transition",
        edgeSet: "cardinalAndDiagonal",
        cornerSet: "innerAndOuter",
        transitionMode: "bidirectional",
        sourceMaterial: "grass",
        targetMaterial: "earth",
        seamMode: "matchedEdges",
        tileableAxes: "both",
        repeatMode: "randomized",
        variantCount: 4,
        variantKinds: ["clean", "damaged"],
        atlasLayout: "fixedColumns",
        atlasTileCount: 47,
        atlasColumns: 8,
        atlasGutterPixels: 1,
        atlasMarginPixels: 2,
      } satisfies TilesetAnswers,
      tags: ["tileset", "terrain"],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_tileset_meadow",
      name: "Meadow to earth",
      baseProfileId: base.id,
      categoryProfileId: category.id,
      compatibilityKey: "stale-tileset-key",
      category: "tileset",
      subtype: "autotile",
      iconId: "tileset-autotile",
      badgeIconIds: [],
      capabilities: resolveCapabilities("tileset", "autotile"),
      overrides: { outlineStyle: "minimal" },
      answers: {
        subjectDescription: "Sparse cool grass over compact soil.",
        variantCount: 6,
        variantKinds: ["clean", "damaged", "decorated", "decal"],
      } satisfies TilesetAnswers,
      tags: ["mapping", "meadow"],
      favorite: false,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });

    const result = resolveProfile({
      baseProfile: base,
      categoryProfile: category,
      assetProfile: asset,
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved" || result.profile.categoryData.category !== "tileset") {
      throw new Error("Expected a resolved Tileset profile.");
    }
    expect(result.profile.categoryData.answers).toMatchObject({
      tilesetType: "autotile",
      tileUsage: "transition",
      subjectDescription: "Sparse cool grass over compact soil.",
      edgeSet: "cardinalAndDiagonal",
      cornerSet: "innerAndOuter",
      transitionMode: "bidirectional",
      sourceMaterial: "grass",
      targetMaterial: "earth",
      seamMode: "matchedEdges",
      tileableAxes: "both",
      repeatMode: "randomized",
      variantCount: 6,
      variantKinds: ["clean", "damaged", "decorated", "decal"],
      atlasLayout: "fixedColumns",
      atlasTileCount: 47,
      atlasColumns: 8,
    });
    expect(result.profile.values).toMatchObject({
      tileSize: 48,
      pixelDensity: "modernHd",
      outlineStyle: "minimal",
      paletteMode: "desaturated",
    });
    expect(result.profile.values).not.toHaveProperty("characterHeight");
    expect(result.profile.capabilities).toMatchObject({
      tileable: true,
      gridBound: true,
      modular: true,
      animated: false,
      directional: false,
      scaledCharacter: false,
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");

    const specification = createTilesetTechnicalSpecification({
      tileSizePixels: result.profile.values.tileSize,
      tileCount: result.profile.categoryData.answers.atlasTileCount ?? 1,
      layout: result.profile.categoryData.answers.atlasLayout ?? "automatic",
      ...(result.profile.categoryData.answers.atlasColumns === undefined
        ? {}
        : { fixedColumns: result.profile.categoryData.answers.atlasColumns }),
      ...(result.profile.categoryData.answers.atlasGutterPixels === undefined
        ? {}
        : {
            gutterPixels: result.profile.categoryData.answers.atlasGutterPixels,
          }),
      ...(result.profile.categoryData.answers.atlasMarginPixels === undefined
        ? {}
        : {
            marginPixels: result.profile.categoryData.answers.atlasMarginPixels,
          }),
    });
    expect(specification.metrics).toMatchObject({
      columns: 8,
      rows: 6,
      atlasWidthPixels: 395,
      atlasHeightPixels: 297,
      tileCount: 47,
      unusedCells: 1,
    });
  });

  it.each(["groundTile", "animatedTile"] as const)(
    "resolves %s on the Tile grid without character scale or directions",
    (subtype) => {
      const base = createBaseProfile();
      const capabilities = resolveCapabilities("tileset", subtype);
      const asset = parseAssetProfile({
        schemaVersion: 2,
        kind: "assetProfile",
        id: `asset_tileset_${subtype.toLowerCase()}`,
        name: `Tileset ${subtype}`,
        baseProfileId: base.id,
        compatibilityKey: "stale-tileset-key",
        category: "tileset",
        subtype,
        iconId: "tileset",
        badgeIconIds: [],
        capabilities,
        overrides: {},
        answers: {
          tilesetType: getDefaultTilesetType(subtype),
          tileUsage: "floor",
          tileableAxes: "both",
          ...(capabilities.animated ? { animationType: "water" } : {}),
        },
        tags: [],
        favorite: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      });

      const result = resolveProfile({ baseProfile: base, assetProfile: asset });

      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") {
        throw new Error(`Expected a resolved ${subtype} Tileset profile.`);
      }
      expect(result.profile.values.tileSize).toBe(32);
      expect(result.profile.values).not.toHaveProperty("characterHeight");
      expect(result.profile.capabilities.directional).toBe(false);
      expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
      expect(result.profile.compatibilityKey).not.toContain("__char-");
    },
  );
});
