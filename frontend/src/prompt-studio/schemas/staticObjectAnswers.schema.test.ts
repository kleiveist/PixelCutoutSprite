import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../domain/assets";
import { AssetCategoryDataSchema, CategoryProfileSchema, StaticObjectAnswersSchema } from "./index";

const completeChestAnswers = {
  objectClass: "container",
  purpose: "interactive",
  basicShape: "boxy",
  proportion: "compact",
  symmetry: "bilateral",
  subjectDescription: "A compact storage chest with a clearly readable lid.",
  primaryMaterial: "wood",
  secondaryMaterial: "metal",
  materialDetails: "Weathered oak boards with restrained iron bands.",
  condition: "used",
  detailElements: "Two hinges, a centered latch, and reinforced corners.",
  contents: "Folded cloth and a few sealed supply jars.",
  interaction: "open",
  animationType: "openClose",
  shadowMode: "contact",
  footprint: { widthTiles: 2, depthTiles: 1 },
  variantCount: 3,
  extraDetails: "Keep the hinge side stable throughout the opening loop.",
} as const;

describe("StaticObjectAnswersSchema", () => {
  it("parses a complete static-object answer set as readonly canonical data", () => {
    const answers = StaticObjectAnswersSchema.parse(completeChestAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "staticObject",
      subtype: "chest",
      answers: completeChestAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers).toEqual(completeChestAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.footprint)).toBe(true);
  });

  it("keeps every previous Schema-V2 static-object field readable without eager defaults", () => {
    const previousAnswers = {
      subjectDescription: "A narrow wooden door.",
      extraDetails: "One dark iron handle.",
      purpose: "blocking",
      interaction: "open",
      animationType: "openClose",
      footprint: { widthTiles: 1, depthTiles: 1 },
    } as const;

    expect(StaticObjectAnswersSchema.parse(previousAnswers)).toEqual(previousAnswers);
    expect(StaticObjectAnswersSchema.parse({})).toEqual({});

    const categoryData = AssetCategoryDataSchema.parse({
      category: "staticObject",
      subtype: "door",
      answers: previousAnswers,
    });
    expect(categoryData.answers).not.toHaveProperty("objectClass");
    expect(categoryData.answers).not.toHaveProperty("variantCount");
  });

  it("keeps an explicitly stored object class consistent with the subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "staticObject",
        subtype: "crate",
        answers: { objectClass: "container" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "staticObject",
      subtype: "crate",
      answers: { objectClass: "furniture" },
    });

    expect(mismatch.success).toBe(false);
    if (mismatch.success) {
      throw new Error("Contradicting static-object classes must not parse.");
    }
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "objectClass"],
        message:
          'Object class "furniture" does not match static-object subtype "crate"; expected "container".',
      }),
    );

    const mismatchedDefaults = CategoryProfileSchema.safeParse({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_static_crate",
      name: "Crate defaults",
      baseProfileId: "base_static_world",
      category: "staticObject",
      subtype: "crate",
      iconId: "static-crate",
      capabilities: resolveCapabilities("staticObject", "crate"),
      overrides: {},
      defaults: { objectClass: "furniture" },
      tags: [],
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    });
    expect(mismatchedDefaults.success).toBe(false);
    if (mismatchedDefaults.success) {
      throw new Error("Contradicting category defaults must not parse.");
    }
    expect(mismatchedDefaults.error.issues).toContainEqual(
      expect.objectContaining({ path: ["defaults", "objectClass"] }),
    );
  });

  it("allows capability-bound animation without admitting directions", () => {
    const animatedChest = AssetCategoryDataSchema.safeParse({
      category: "staticObject",
      subtype: "chest",
      answers: {
        objectClass: "container",
        interaction: "open",
        animationType: "openClose",
      },
    });

    expect(animatedChest.success).toBe(true);
    if (!animatedChest.success) throw new Error("An opening chest must parse.");
    expect(animatedChest.data.answers).not.toHaveProperty("directionCount");

    const animatedPillar = AssetCategoryDataSchema.safeParse({
      category: "staticObject",
      subtype: "pillar",
      answers: { animationType: "glow" },
    });
    expect(animatedPillar.success).toBe(false);
    if (animatedPillar.success) {
      throw new Error("A nonanimated pillar must reject animation data.");
    }
    expect(animatedPillar.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "animationType"],
        message: "Animation data is only valid for animated asset subtypes.",
      }),
    );
  });

  it("enforces focused text, footprint, and variant bounds", () => {
    expect(StaticObjectAnswersSchema.safeParse({ materialDetails: " " }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ contents: "x".repeat(501) }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ detailElements: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(StaticObjectAnswersSchema.safeParse({ variantCount: 0 }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ variantCount: 13 }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ variantCount: 1.5 }).success).toBe(false);
    expect(
      StaticObjectAnswersSchema.safeParse({
        footprint: { widthTiles: 0, depthTiles: 1 },
      }).success,
    ).toBe(false);
    expect(
      StaticObjectAnswersSchema.safeParse({
        footprint: { widthTiles: 1, depthTiles: 65 },
      }).success,
    ).toBe(false);
  });

  it("rejects values outside the public static-object catalogs", () => {
    expect(StaticObjectAnswersSchema.safeParse({ basicShape: "cuboid" }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ proportion: "enormous" }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ symmetry: "mirrored" }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ primaryMaterial: "plastic" }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ condition: "pristine" }).success).toBe(false);
    expect(StaticObjectAnswersSchema.safeParse({ shadowMode: "soft" }).success).toBe(false);
  });

  it("does not admit direction, tile, character, or other technical fields", () => {
    const result = StaticObjectAnswersSchema.safeParse({
      directionCount: 8,
      framesPerDirection: 4,
      tileSize: 32,
      characterHeight: 80,
      projectionType: "orthographic",
      role: "merchant",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Irrelevant static-object fields must not parse.");
    }
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: expect.arrayContaining([
          "directionCount",
          "framesPerDirection",
          "tileSize",
          "characterHeight",
          "projectionType",
          "role",
        ]),
      }),
    );
  });
});
