import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateCategoryDataCapabilities } from "./categoryData.refinement";
import {
  AssetCategoryDataSchema,
  CharacterAnimationActionsSchema,
  CharacterAnswersSchema,
} from "./index";

const fullCharacterAnswers = {
  subjectDescription: "A village craftsperson with an immediately readable role.",
  extraDetails: "Keep asymmetric tools consistent in every view.",
  role: "blacksmith",
  variantCount: 3,
  genderPresentation: "androgynous",
  age: "adult",
  relativeHeight: "average",
  bodyBuild: "sturdy",
  posture: "upright",
  faceShape: "angular",
  skinTone: "warm brown",
  eyeVisibility: "clear",
  hair: "dark brown, shoulder length",
  hairstyle: "tied back",
  beard: "short boxed beard",
  hat: "none",
  headwearCondition: "used",
  scarf: "short wool scarf",
  outerwear: "heavy leather apron over a linen shirt",
  lowerwear: "dark work trousers",
  clothingLayers: "shirt, vest, apron",
  gloves: "single reinforced work glove",
  handPose: "hammer held low in the right hand",
  shoes: "robust leather boots",
  beltBags: "broad belt with two tool pouches",
  accessories: "iron key ring and small guild pendant",
  backItem: "rolled protective cloak",
  equipment: "smithing hammer and long tongs",
  materials: "linen, worn leather, dark iron and wool",
  characterPaletteSource: "local",
  primaryColor: "charcoal brown",
  secondaryColor: "muted ochre",
  accentColor: "dull forge red",
  condition: "used",
  expression: "serious",
  silhouette: "broad apron, hammer and raised shoulder line",
  pose: "stable working stance",
  professionReadable: true,
  socialRole: "trusted village craftsperson",
  wealth: "comfortable",
  culturalFunction: "maintains tools for the surrounding farming community",
  typicalActivity: "checks a newly forged hinge",
  conversationGesture: "rests the hammer against one shoulder",
  everydayTool: "smithing hammer",
  frontBackDetails: "apron buckle visible in front, crossed straps visible from behind",
  directionCount: 8,
  animationActions: [
    { action: "idle", frames: 4 },
    { action: "walk", frames: 5 },
    { action: "attack", frames: 6 },
    { action: "use", frames: 5 },
    { action: "talk", frames: 4 },
  ],
} as const;

describe("CharacterAnswersSchema", () => {
  it("parses the complete Character/NPC catalog as readonly canonical data", () => {
    const answers = CharacterAnswersSchema.parse(fullCharacterAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "character",
      subtype: "npc",
      answers: fullCharacterAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers.animationActions).toHaveLength(5);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.animationActions)).toBe(true);
    expect(Object.isFrozen(answers.animationActions?.[0])).toBe(true);
  });

  it("enforces text, variant and per-action frame bounds", () => {
    expect(CharacterAnswersSchema.safeParse({ role: "x".repeat(101) }).success).toBe(false);
    expect(CharacterAnswersSchema.safeParse({ faceShape: "x".repeat(201) }).success).toBe(false);
    expect(CharacterAnswersSchema.safeParse({ accessories: "x".repeat(501) }).success).toBe(false);
    expect(CharacterAnswersSchema.safeParse({ variantCount: 0 }).success).toBe(false);
    expect(CharacterAnswersSchema.safeParse({ variantCount: 6 }).success).toBe(false);
    expect(CharacterAnimationActionsSchema.safeParse([{ action: "walk", frames: 0 }]).success).toBe(
      false,
    );
    expect(CharacterAnimationActionsSchema.safeParse([{ action: "walk", frames: 9 }]).success).toBe(
      false,
    );
  });

  it("rejects duplicate canonical animation actions", () => {
    const result = CharacterAnimationActionsSchema.safeParse([
      { action: "walk", frames: 4 },
      { action: "walk", frames: 5 },
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Duplicate character actions must not parse.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: [1, "action"],
        message: 'Duplicate character animation action "walk".',
      }),
    );
  });

  it("keeps the existing single-action V2 representation readable", () => {
    expect(
      CharacterAnswersSchema.parse({
        role: "blacksmith",
        hat: "none",
        scarf: "short",
        outerwear: "leather-apron",
        animationAction: "walk",
        directionCount: 8,
        framesPerDirection: 5,
      }),
    ).toMatchObject({
      animationAction: "walk",
      directionCount: 8,
      framesPerDirection: 5,
    });
    expect(CharacterAnswersSchema.safeParse({ animationAction: "use" }).success).toBe(true);
  });

  it("does not duplicate the inherited character height in character answers", () => {
    const result = CharacterAnswersSchema.safeParse({
      role: "blacksmith",
      characterHeight: 80,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Character height must remain a Base-profile value.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["characterHeight"],
      }),
    );
  });

  it("marks canonical action lists as capability-bound animation data", () => {
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
        answers: { animationActions: [{ action: "idle", frames: 4 }] },
      },
      "answers",
      context,
    );

    expect(issues).toContainEqual({
      code: "custom",
      path: ["answers", "animationActions"],
      message: "Animation data is only valid for animated asset subtypes.",
    });
  });
});
