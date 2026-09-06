import { describe, expect, it } from "vitest";
import { AssetCategoryDataSchema, TextureAnswersSchema } from "./index";

const completeWoodTextureAnswers = {
  subjectDescription: "Quarter-sawn oak planks with restrained knots.",
  extraDetails: "Keep plank widths varied without a recognizable repeat.",
  materialType: "wood",
  usage: "floor",
  seamless: true,
  orientation: "grainAligned",
  structure: "medium",
  condition: "old",
  surface: "planked",
  moisture: "damp",
  icing: "none",
  lighting: "neutralEven",
} as const;

describe("TextureAnswersSchema", () => {
  it("parses the focused material catalog as readonly texture data", () => {
    const answers = TextureAnswersSchema.parse(completeWoodTextureAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "texture",
      subtype: "wood",
      answers: completeWoodTextureAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers).toEqual(completeWoodTextureAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
  });

  it("keeps every previous Schema-V2 texture field readable without materializing defaults", () => {
    const previousAnswers = {
      subjectDescription: "A reusable stone wall surface.",
      extraDetails: "Sparse cracks only.",
      usage: "wall",
      seamless: false,
      orientation: "horizontal",
      structure: "coarse",
      condition: "rough",
    } as const;

    expect(TextureAnswersSchema.parse(previousAnswers)).toEqual(previousAnswers);
    expect(TextureAnswersSchema.parse({})).toEqual({});
  });

  it("keeps an explicitly stored material type consistent with the texture subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "texture",
        subtype: "snow",
        answers: { materialType: "snow", moisture: "wet", icing: "frosted" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "texture",
      subtype: "snow",
      answers: { materialType: "wood" },
    });

    expect(mismatch.success).toBe(false);
    if (mismatch.success) throw new Error("Contradicting texture materials must not parse.");
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "materialType"],
        message: 'Material type "wood" does not match texture subtype "snow"; expected "snow".',
      }),
    );
  });

  it("rejects values outside the public texture catalogs", () => {
    expect(TextureAnswersSchema.safeParse({ materialType: "timber" }).success).toBe(false);
    expect(TextureAnswersSchema.safeParse({ surface: "glossy" }).success).toBe(false);
    expect(TextureAnswersSchema.safeParse({ moisture: "soaked" }).success).toBe(false);
    expect(TextureAnswersSchema.safeParse({ icing: "frozenSolid" }).success).toBe(false);
    expect(TextureAnswersSchema.safeParse({ lighting: "dramatic" }).success).toBe(false);
  });

  it("does not admit technical tile size or character and direction fields", () => {
    const result = TextureAnswersSchema.safeParse({
      tileSize: 32,
      directionCount: 8,
      role: "merchant",
      outerwear: "coat",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Irrelevant texture fields must not parse.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: expect.arrayContaining(["tileSize", "directionCount", "role", "outerwear"]),
      }),
    );
  });
});
