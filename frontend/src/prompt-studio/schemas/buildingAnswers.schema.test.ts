import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../domain/assets";
import { AssetCategoryDataSchema, BuildingAnswersSchema, CategoryProfileSchema } from "./index";

const completeGateAnswers = {
  buildingType: "gate",
  purpose: "A fortified entrance controlling access to the inner ward.",
  subjectDescription: "A broad stone gatehouse with a central portcullis.",
  planShape: "rectangular",
  size: "large",
  footprint: { widthTiles: 8, depthTiles: 4 },
  heightPixels: 384,
  floors: 3,
  primaryMaterial: "stone",
  secondaryMaterial: "wood",
  materialDetails: "Large masonry blocks with restrained timber bracing.",
  roofShape: "gable",
  roofPitch: "steep",
  roofMaterial: "slate",
  roofCondition: "weathered",
  roofDetails: "Two small guard-room roofs and a centered ridge.",
  facadeStyle: "fortified",
  facadeDetails: "Buttresses, crenellations, and readable gate framing.",
  doorCount: 1,
  doorType: "portcullis",
  doorPosition: "Centered on the south footprint edge.",
  doorState: "closed",
  windowCount: 4,
  windowShape: "narrowSlit",
  windowLighting: "warmLit",
  windowDetails: "Two aligned openings on each upper floor.",
  condition: "used",
  occupancy: "active",
  environment: "city",
  mappingMode: "modularSet",
  collisionMode: "walkableEntrance",
  modular: true,
  lighting: "warmInterior",
  lightSourceDetails: "Restrained amber guard-room light.",
  animationType: "openClose",
  extraDetails: "Keep the gate opening aligned to the same map cells.",
} as const;

describe("BuildingAnswersSchema", () => {
  it("parses a complete architecture answer set as readonly canonical data", () => {
    const answers = BuildingAnswersSchema.parse(completeGateAnswers);
    const categoryData = AssetCategoryDataSchema.parse({
      category: "building",
      subtype: "gate",
      answers: completeGateAnswers,
    });

    expect(categoryData.answers).toEqual(answers);
    expect(answers).toEqual(completeGateAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.footprint)).toBe(true);
  });

  it("keeps every previous Schema-V2 building field readable without eager defaults", () => {
    const previousAnswers = {
      subjectDescription: "A small village house.",
      extraDetails: "A readable south-facing entrance.",
      purpose: "Home for one family.",
      floors: 2,
      condition: "maintained",
      modular: false,
      footprint: { widthTiles: 4, depthTiles: 3 },
    } as const;

    expect(BuildingAnswersSchema.parse(previousAnswers)).toEqual(previousAnswers);
    expect(BuildingAnswersSchema.parse({})).toEqual({});

    const categoryData = AssetCategoryDataSchema.parse({
      category: "building",
      subtype: "house",
      answers: previousAnswers,
    });
    expect(categoryData.answers).not.toHaveProperty("buildingType");
    expect(categoryData.answers).not.toHaveProperty("roofShape");
  });

  it("keeps an explicitly stored building type consistent with the subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "building",
        subtype: "hut",
        answers: { buildingType: "residential" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "building",
      subtype: "hut",
      answers: { buildingType: "tower" },
    });
    expect(mismatch.success).toBe(false);
    if (mismatch.success) throw new Error("Contradicting building types must fail.");
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "buildingType"],
        message:
          'Building type "tower" does not match building subtype "hut"; expected "residential".',
      }),
    );

    const mismatchedDefaults = CategoryProfileSchema.safeParse({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_building_hut",
      name: "Hut defaults",
      baseProfileId: "base_building_world",
      category: "building",
      subtype: "hut",
      iconId: "building-hut",
      capabilities: resolveCapabilities("building", "hut"),
      overrides: {},
      defaults: { buildingType: "tower" },
      tags: [],
      createdAt: "2026-09-03T10:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    });
    expect(mismatchedDefaults.success).toBe(false);
    if (mismatchedDefaults.success) {
      throw new Error("Contradicting building defaults must fail.");
    }
    expect(mismatchedDefaults.error.issues).toContainEqual(
      expect.objectContaining({ path: ["defaults", "buildingType"] }),
    );
  });

  it("allows gate animation and modular mapping without admitting directions", () => {
    const gate = AssetCategoryDataSchema.safeParse({
      category: "building",
      subtype: "gate",
      answers: {
        buildingType: "gate",
        mappingMode: "modularSet",
        modular: true,
        animationType: "openClose",
      },
    });
    expect(gate.success).toBe(true);
    if (!gate.success) throw new Error("An animated modular gate must parse.");
    expect(gate.data.answers).not.toHaveProperty("directionCount");

    for (const answers of [
      { animationType: "openClose" },
      { modular: true },
      { mappingMode: "modularSet" },
      { planShape: "modular" },
    ]) {
      expect(
        AssetCategoryDataSchema.safeParse({
          category: "building",
          subtype: "house",
          answers,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces architecture text, size, floor, opening, and footprint bounds", () => {
    expect(BuildingAnswersSchema.safeParse({ facadeDetails: " " }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ roofDetails: "x".repeat(501) }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ heightPixels: 15 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ heightPixels: 8193 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ floors: 0 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ floors: 21 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ doorCount: -1 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ doorCount: 65 }).success).toBe(false);
    expect(BuildingAnswersSchema.safeParse({ windowCount: 257 }).success).toBe(false);
    expect(
      BuildingAnswersSchema.safeParse({
        footprint: { widthTiles: 0, depthTiles: 1 },
      }).success,
    ).toBe(false);
    expect(
      BuildingAnswersSchema.safeParse({
        footprint: { widthTiles: 1, depthTiles: 65 },
      }).success,
    ).toBe(false);
  });

  it("does not admit character, direction, or duplicated technical fields", () => {
    const result = BuildingAnswersSchema.safeParse({
      directionCount: 8,
      framesPerDirection: 4,
      tileSize: 32,
      characterHeight: 80,
      perspectiveType: "threeQuarter",
      projectionType: "orthographic",
      role: "merchant",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Irrelevant building fields must fail.");
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: expect.arrayContaining([
          "directionCount",
          "framesPerDirection",
          "tileSize",
          "characterHeight",
          "perspectiveType",
          "projectionType",
          "role",
        ]),
      }),
    );
  });
});
