import { describe, expect, it } from "vitest";
import { AssetCategoryDataSchema, NatureAnswersSchema } from "./index";

const completeDeciduousTreeAnswers = {
  plantType: "tree",
  species: "Old field oak",
  subjectDescription: "A broad deciduous tree with a readable game silhouette.",
  climate: "temperate",
  season: "autumn",
  age: "ancient",
  silhouette: "broad",
  trunkThickness: "massive",
  trunkShape: "gnarled",
  trunkDetails: "Forked low branches, coarse bark, and one shallow hollow.",
  crownShape: "spreading",
  crownDensity: "dense",
  foliageDetails: "Large clustered leaves with restrained amber variation.",
  rootVisibility: "spreading",
  rootDetails: "Wide roots settle into the ground without hiding the footprint.",
  mossCoverage: "moderate",
  mushroomGrowth: "few",
  snowCover: "none",
  vineGrowth: "light",
  footprint: { widthTiles: 3, depthTiles: 2 },
  grounding: "grassPatch",
  variantCount: 4,
  animationType: "wind",
  extraDetails: "Keep the trunk base fixed throughout the wind loop.",
} as const;

describe("NatureAnswersSchema", () => {
  it("parses a complete tree answer set as readonly canonical data", () => {
    const answers = NatureAnswersSchema.parse(completeDeciduousTreeAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "nature",
      subtype: "deciduousTree",
      answers: completeDeciduousTreeAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers).toEqual(completeDeciduousTreeAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.footprint)).toBe(true);
  });

  it("keeps previous Schema-V2 nature data readable without eager defaults", () => {
    const previousAnswers = {
      climate: "snow",
      season: "winter",
      age: "mature",
      animationType: "wind",
      footprint: { widthTiles: 2, depthTiles: 2 },
    } as const;

    expect(NatureAnswersSchema.parse(previousAnswers)).toEqual(previousAnswers);
    expect(NatureAnswersSchema.parse({})).toEqual({});

    const categoryData = AssetCategoryDataSchema.parse({
      category: "nature",
      subtype: "conifer",
      answers: previousAnswers,
    });
    expect(categoryData.answers).not.toHaveProperty("plantType");
  });

  it("keeps an explicitly stored plant type consistent with the nature subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "nature",
        subtype: "grassTuft",
        answers: { plantType: "grass" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "nature",
      subtype: "grassTuft",
      answers: { plantType: "bush" },
    });

    expect(mismatch.success).toBe(false);
    if (mismatch.success) throw new Error("Contradicting nature plant types must not parse.");
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "plantType"],
        message: 'Plant type "bush" does not match nature subtype "grassTuft"; expected "grass".',
      }),
    );
  });

  it("allows anatomy fields only for subtypes that possess that anatomy", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "nature",
        subtype: "bush",
        answers: {
          crownShape: "round",
          crownDensity: "dense",
          foliageDetails: "Small leaf clusters.",
          rootVisibility: "hidden",
          rootDetails: "Compact roots.",
        },
      }).success,
    ).toBe(true);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "nature",
        subtype: "treeStump",
        answers: {
          trunkThickness: "thick",
          trunkShape: "split",
          trunkDetails: "Freshly split heartwood.",
          rootVisibility: "exposed",
          rootDetails: "Short exposed roots.",
        },
      }).success,
    ).toBe(true);

    const irrelevant = AssetCategoryDataSchema.safeParse({
      category: "nature",
      subtype: "grassTuft",
      answers: {
        trunkThickness: "thin",
        crownShape: "round",
        rootVisibility: "visible",
      },
    });

    expect(irrelevant.success).toBe(false);
    if (irrelevant.success) throw new Error("Grass must not admit tree anatomy.");
    expect(irrelevant.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["answers", "trunkThickness"] }),
        expect.objectContaining({ path: ["answers", "crownShape"] }),
        expect.objectContaining({ path: ["answers", "rootVisibility"] }),
      ]),
    );
  });

  it("allows wind animation without directions and rejects animation on static subtypes", () => {
    const animatedTree = AssetCategoryDataSchema.safeParse({
      category: "nature",
      subtype: "tree",
      answers: { plantType: "tree", animationType: "wind" },
    });

    expect(animatedTree.success).toBe(true);
    if (!animatedTree.success) throw new Error("A wind-animated tree must parse.");
    expect(animatedTree.data.answers).not.toHaveProperty("directionCount");

    const animatedMushroom = AssetCategoryDataSchema.safeParse({
      category: "nature",
      subtype: "mushroom",
      answers: { plantType: "mushroom", animationType: "wind" },
    });
    expect(animatedMushroom.success).toBe(false);
    if (animatedMushroom.success) {
      throw new Error("A nonanimated nature subtype must reject animation data.");
    }
    expect(animatedMushroom.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "animationType"],
        message: "Animation data is only valid for animated asset subtypes.",
      }),
    );
  });

  it("enforces scalar bounds and public nature catalogs", () => {
    expect(NatureAnswersSchema.safeParse({ species: " " }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ species: "x".repeat(201) }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ trunkDetails: "x".repeat(501) }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ variantCount: 0 }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ variantCount: 13 }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ variantCount: 1.5 }).success).toBe(false);
    expect(
      NatureAnswersSchema.safeParse({
        footprint: { widthTiles: 0, depthTiles: 1 },
      }).success,
    ).toBe(false);
    expect(
      NatureAnswersSchema.safeParse({
        footprint: { widthTiles: 1, depthTiles: 65 },
      }).success,
    ).toBe(false);
    expect(NatureAnswersSchema.safeParse({ climate: "tropical" }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ crownDensity: "solid" }).success).toBe(false);
    expect(NatureAnswersSchema.safeParse({ grounding: "floating" }).success).toBe(false);
  });

  it("does not admit duplicated technical, direction, character, or clothing fields", () => {
    const result = NatureAnswersSchema.safeParse({
      tileSize: 32,
      directionCount: 8,
      framesPerDirection: 4,
      characterHeight: 80,
      role: "merchant",
      outerwear: "coat",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Irrelevant nature fields must not parse.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: expect.arrayContaining([
          "tileSize",
          "directionCount",
          "framesPerDirection",
          "characterHeight",
          "role",
          "outerwear",
        ]),
      }),
    );
  });
});
