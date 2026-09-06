import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateCategoryDataCapabilities } from "./categoryData.refinement";
import {
  AssetCategoryDataSchema,
  MovingObjectAnimationSequencesSchema,
  MovingObjectAnswersSchema,
} from "./index";

const completeCartAnswers = {
  subjectDescription: "A compact two-wheeled supply cart.",
  extraDetails: "Keep the left-side repair brace consistent in every view.",
  objectClass: "cart",
  purpose: "Carries provisions between a village and nearby farms.",
  basicShape: "Low rectangular bed with a raised front rail.",
  heightPixels: 88,
  movementType: "roll",
  footprint: { widthTiles: 2, depthTiles: 1 },
  anchorMode: "footprintCenter",
  directionCount: 8,
  animationSequences: [
    { type: "idle", frames: 4 },
    { type: "move", frames: 6 },
    { type: "interact", frames: 3 },
  ],
  mechanism: "wheels",
  material: "mixed",
  materialDetails: "Weathered oak, dark iron wheel rims, and a canvas cover.",
  condition: "used",
  lightingBehavior: "neutral",
  shadowMode: "motionAdjusted",
} as const;

describe("MovingObjectAnswersSchema", () => {
  it("parses the complete moving-object catalog as readonly canonical data", () => {
    const answers = MovingObjectAnswersSchema.parse(completeCartAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "movingObject",
      subtype: "cart",
      answers: completeCartAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers.animationSequences).toHaveLength(3);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.footprint)).toBe(true);
    expect(Object.isFrozen(answers.animationSequences)).toBe(true);
    expect(Object.isFrozen(answers.animationSequences?.[0])).toBe(true);
  });

  it("supports animated non-directional objects through sequence-local frames", () => {
    const result = AssetCategoryDataSchema.safeParse({
      category: "movingObject",
      subtype: "floatingCrystal",
      answers: {
        objectClass: "floatingObject",
        movementType: "hover",
        animationSequences: [{ type: "pulse", frames: 8 }],
        material: "magic",
        lightingBehavior: "emissive",
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("A pulsing crystal must parse without directions.");
    if (result.data.category !== "movingObject") {
      throw new Error("Expected moving-object category data.");
    }
    expect(result.data.answers).not.toHaveProperty("directionCount");
    expect(result.data.answers.animationSequences).toEqual([{ type: "pulse", frames: 8 }]);
  });

  it("keeps the persisted object class consistent with the routing subtype", () => {
    const result = AssetCategoryDataSchema.safeParse({
      category: "movingObject",
      subtype: "floatingCrystal",
      answers: { objectClass: "cart" },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Contradicting object classes must not parse.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "objectClass"],
        message:
          'Object class "cart" does not match moving-object subtype "floatingCrystal"; expected "floatingObject".',
      }),
    );
  });

  it("keeps every previous Schema-V2 moving-object field readable", () => {
    expect(
      MovingObjectAnswersSchema.parse({
        subjectDescription: "A cargo cart.",
        extraDetails: "One repaired spoke.",
        purpose: "Transport",
        movementType: "roll",
        directionCount: 4,
        animationType: "move",
        framesPerDirection: 6,
        footprint: { widthTiles: 2, depthTiles: 1 },
      }),
    ).toMatchObject({
      purpose: "Transport",
      movementType: "roll",
      directionCount: 4,
      animationType: "move",
      framesPerDirection: 6,
      footprint: { widthTiles: 2, depthTiles: 1 },
    });
  });

  it("enforces scalar bounds and rejects unknown answer fields", () => {
    expect(MovingObjectAnswersSchema.safeParse({ basicShape: " " }).success).toBe(false);
    expect(MovingObjectAnswersSchema.safeParse({ basicShape: "x".repeat(201) }).success).toBe(
      false,
    );
    expect(MovingObjectAnswersSchema.safeParse({ heightPixels: 15 }).success).toBe(false);
    expect(MovingObjectAnswersSchema.safeParse({ heightPixels: 2049 }).success).toBe(false);
    expect(MovingObjectAnswersSchema.safeParse({ heightPixels: 80.5 }).success).toBe(false);
    expect(MovingObjectAnswersSchema.safeParse({ materialDetails: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(MovingObjectAnswersSchema.safeParse({ objectClass: "vehicle" }).success).toBe(false);
    expect(MovingObjectAnswersSchema.safeParse({ anchor: "bottomCenter" }).success).toBe(false);
  });

  it("requires unique canonical animation types with one to sixteen frames", () => {
    expect(MovingObjectAnimationSequencesSchema.safeParse([]).success).toBe(false);
    expect(
      MovingObjectAnimationSequencesSchema.safeParse([{ type: "move", frames: 0 }]).success,
    ).toBe(false);
    expect(
      MovingObjectAnimationSequencesSchema.safeParse([{ type: "move", frames: 17 }]).success,
    ).toBe(false);

    const duplicate = MovingObjectAnimationSequencesSchema.safeParse([
      { type: "pulse", frames: 4 },
      { type: "pulse", frames: 8 },
    ]);

    expect(duplicate.success).toBe(false);
    if (duplicate.success) throw new Error("Duplicate moving-object sequences must not parse.");
    expect(duplicate.error.issues).toContainEqual(
      expect.objectContaining({
        path: [1, "type"],
        message: 'Duplicate moving-object animation sequence "pulse".',
      }),
    );
  });

  it("keeps direction counts and legacy per-direction frames capability-bound", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: { directionCount: 8 },
      }).success,
    ).toBe(false);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: { animationType: "pulse", framesPerDirection: 4 },
      }).success,
    ).toBe(false);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "movingObject",
        subtype: "cart",
        answers: {
          directionCount: 8,
          animationType: "move",
          framesPerDirection: 4,
        },
      }).success,
    ).toBe(true);
  });

  it("recognizes new motion, footprint, anchor, and sequence data in capability refinement", () => {
    const issues: Array<{
      readonly path?: readonly PropertyKey[];
      readonly message?: string;
    }> = [];
    const context = {
      addIssue: (issue: (typeof issues)[number]) => issues.push(issue),
    } as unknown as z.RefinementCtx;

    validateCategoryDataCapabilities(
      {
        category: "artwork",
        subtype: "scene",
        answers: {
          movementType: "hover",
          footprint: { widthTiles: 1, depthTiles: 1 },
          anchorMode: "footprintCenter",
          animationSequences: [{ type: "pulse", frames: 4 }],
        },
      },
      "answers",
      context,
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["answers", "movementType"] }),
        expect.objectContaining({ path: ["answers", "footprint"] }),
        expect.objectContaining({ path: ["answers", "anchorMode"] }),
        expect.objectContaining({ path: ["answers", "animationSequences"] }),
      ]),
    );
  });
});
