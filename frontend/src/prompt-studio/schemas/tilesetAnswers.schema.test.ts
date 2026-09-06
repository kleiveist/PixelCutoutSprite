import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../domain/assets";
import { AssetCategoryDataSchema, CategoryProfileSchema, TilesetAnswersSchema } from "./index";

const completeAutotileAnswers = {
  tilesetType: "autotile",
  tileUsage: "transition",
  subjectDescription: "A grass-to-earth terrain Autotile set.",
  edgeSet: "cardinalAndDiagonal",
  edgeDetails: "All eight neighbor states retain one-pixel contour continuity.",
  cornerSet: "innerAndOuter",
  transitionMode: "bidirectional",
  sourceMaterial: "short meadow grass",
  targetMaterial: "compacted brown earth",
  seamMode: "matchedEdges",
  seamDetails: "Opposite borders share identical first and last pixel rows.",
  tileableAxes: "both",
  repeatMode: "randomized",
  variantCount: 6,
  variantKinds: ["clean", "damaged", "decorated", "decal"],
  atlasLayout: "fixedColumns",
  atlasTileCount: 47,
  atlasColumns: 8,
  atlasGutterPixels: 1,
  atlasMarginPixels: 2,
  extraDetails: "Keep every connector on the inherited world grid.",
} as const;

describe("TilesetAnswersSchema", () => {
  it("parses a complete Autotile answer set as readonly canonical data", () => {
    const answers = TilesetAnswersSchema.parse(completeAutotileAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "tileset",
      subtype: "autotile",
      answers: completeAutotileAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers).toEqual(completeAutotileAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.variantKinds)).toBe(true);
  });

  it("keeps all previous Schema-V2 Tileset fields readable without eager defaults", () => {
    const previousAnswers = {
      subjectDescription: "A compact stone floor Tile set.",
      extraDetails: "Neutral border pixels.",
      tileUsage: "floor",
      tileableAxes: "both",
      animationType: "water",
      variantCount: 4,
    } as const;

    expect(TilesetAnswersSchema.parse(previousAnswers)).toEqual(previousAnswers);
    expect(TilesetAnswersSchema.parse({})).toEqual({});

    const categoryData = AssetCategoryDataSchema.parse({
      category: "tileset",
      subtype: "animatedTile",
      answers: previousAnswers,
    });
    expect(categoryData.answers).not.toHaveProperty("tilesetType");
    expect(categoryData.answers).not.toHaveProperty("atlasLayout");
  });

  it("keeps an explicitly stored Tileset type consistent with its subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "corner",
        answers: { tilesetType: "corner", cornerSet: "innerAndOuter" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "tileset",
      subtype: "corner",
      answers: { tilesetType: "edge" },
    });
    expect(mismatch.success).toBe(false);
    if (mismatch.success) throw new Error("Contradicting Tile types must fail.");
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "tilesetType"],
        message: 'Tileset type "edge" does not match Tileset subtype "corner"; expected "corner".',
      }),
    );

    const mismatchedDefaults = CategoryProfileSchema.safeParse({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_tileset_corner",
      name: "Corner defaults",
      baseProfileId: "base_tileset_world",
      category: "tileset",
      subtype: "corner",
      iconId: "tileset-corner",
      capabilities: resolveCapabilities("tileset", "corner"),
      overrides: {},
      defaults: { tilesetType: "edge" },
      tags: [],
      createdAt: "2026-09-03T10:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    });
    expect(mismatchedDefaults.success).toBe(false);
    if (mismatchedDefaults.success) {
      throw new Error("Contradicting Tileset defaults must fail.");
    }
    expect(mismatchedDefaults.error.issues).toContainEqual(
      expect.objectContaining({ path: ["defaults", "tilesetType"] }),
    );
  });

  it("enforces subtype-specific edge, corner, and transition boundaries", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "autotile",
        answers: {
          edgeSet: "cardinal",
          cornerSet: "innerAndOuter",
          transitionMode: "bidirectional",
          sourceMaterial: "grass",
          targetMaterial: "earth",
        },
      }).success,
    ).toBe(true);

    for (const answers of [
      { edgeSet: "cardinal" },
      { edgeDetails: "North edge" },
      { cornerSet: "outer" },
      { transitionMode: "oneWay" },
      { sourceMaterial: "grass" },
      { targetMaterial: "earth" },
    ]) {
      expect(
        AssetCategoryDataSchema.safeParse({
          category: "tileset",
          subtype: "groundTile",
          answers,
        }).success,
      ).toBe(false);
    }

    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "edge",
        answers: { edgeSet: "cardinal", cornerSet: "outer" },
      }).success,
    ).toBe(false);
  });

  it("validates Atlas layout, repetition, variants, and numeric bounds", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "groundTile",
        answers: { atlasLayout: "fixedColumns" },
      }).success,
    ).toBe(false);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "groundTile",
        answers: { atlasLayout: "automatic", atlasColumns: 4 },
      }).success,
    ).toBe(false);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "groundTile",
        answers: { repeatMode: "nonRepeating", tileableAxes: "both" },
      }).success,
    ).toBe(false);
    expect(
      TilesetAnswersSchema.safeParse({
        variantKinds: ["clean", "clean"],
      }).success,
    ).toBe(false);
    expect(TilesetAnswersSchema.safeParse({ variantCount: 0 }).success).toBe(false);
    expect(TilesetAnswersSchema.safeParse({ atlasTileCount: 257 }).success).toBe(false);
    expect(TilesetAnswersSchema.safeParse({ atlasColumns: 65 }).success).toBe(false);
    expect(TilesetAnswersSchema.safeParse({ atlasGutterPixels: -1 }).success).toBe(false);
    expect(TilesetAnswersSchema.safeParse({ atlasMarginPixels: 65 }).success).toBe(false);
  });

  it("allows animation only for the animated Tile and never admits directions", () => {
    const animated = AssetCategoryDataSchema.safeParse({
      category: "tileset",
      subtype: "animatedTile",
      answers: { tilesetType: "animated", animationType: "water" },
    });
    expect(animated.success).toBe(true);
    if (!animated.success) throw new Error("Animated Tile data must parse.");
    expect(animated.data.answers).not.toHaveProperty("directionCount");

    expect(
      AssetCategoryDataSchema.safeParse({
        category: "tileset",
        subtype: "groundTile",
        answers: { animationType: "water" },
      }).success,
    ).toBe(false);
  });

  it("does not admit duplicated technical, character, or direction fields", () => {
    const result = TilesetAnswersSchema.safeParse({
      tileSize: 32,
      pixelDensity: "modernHd",
      directionCount: 8,
      framesPerDirection: 4,
      characterHeight: 80,
      perspectiveType: "threeQuarter",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Irrelevant Tileset fields must fail.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: expect.arrayContaining([
          "tileSize",
          "pixelDensity",
          "directionCount",
          "framesPerDirection",
          "characterHeight",
          "perspectiveType",
        ]),
      }),
    );
  });
});
