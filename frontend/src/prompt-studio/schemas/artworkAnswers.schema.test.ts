import { describe, expect, it } from "vitest";
import { ArtworkAnswersSchema, AssetCategoryDataSchema } from "./index";

const completeAnswers = {
  purpose: "productionReference",
  motif: "environment",
  subjectDescription: "An ancient observatory above a stormy valley.",
  sceneDescription: "A lone researcher approaches through wind-bent grass.",
  composition: "scene",
  compositionDetails: "Observatory in the upper third, figure as a small scale reference.",
  format: "landscape",
  background: "complete",
  backgroundDetails: "Layered mountains and distant lightning.",
  focus: "scale",
  lightingDrama: "gloomy",
  lightingDetails: "Cool ambient light with one warm doorway accent.",
  detailLevel: "productionConcept",
  extraDetails: "No title, lettering, watermark, or interface elements.",
} as const;

describe("ArtworkAnswersSchema", () => {
  it("parses the complete free-composition answer set", () => {
    const answers = ArtworkAnswersSchema.parse(completeAnswers);
    const data = AssetCategoryDataSchema.parse({
      category: "artwork",
      subtype: "environmentConcept",
      answers: completeAnswers,
    });

    expect(data.answers).toEqual(answers);
    expect(answers).toEqual(completeAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
  });

  it("keeps the previous Schema-V2 Artwork contract readable without defaults", () => {
    const legacyAnswers = {
      purpose: "concept",
      composition: "singleSubject",
      format: "portrait",
      background: "simple",
      focus: "form",
      subjectDescription: "A cloak silhouette study.",
    } as const;

    expect(ArtworkAnswersSchema.parse(legacyAnswers)).toEqual(legacyAnswers);
    expect(ArtworkAnswersSchema.parse({})).toEqual({});
    expect(ArtworkAnswersSchema.parse(legacyAnswers)).not.toHaveProperty("motif");
  });

  it("rejects invalid detail values and game-asset fields", () => {
    expect(ArtworkAnswersSchema.safeParse({ lightingDrama: "studioFlash" }).success).toBe(false);
    expect(ArtworkAnswersSchema.safeParse({ sceneDescription: "x".repeat(1001) }).success).toBe(
      false,
    );
    expect(
      ArtworkAnswersSchema.safeParse({
        tileSize: 32,
        directionCount: 8,
        animationType: "idle",
        footprint: { widthTiles: 1, depthTiles: 1 },
      }).success,
    ).toBe(false);
  });
});
