import { describe, expect, it } from "vitest";
import {
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type BaseProfile,
  type BuildingAnswers,
} from "../../schemas";
import { resolveCapabilities } from "../assets";
import { getDefaultBuildingType } from "../buildings";
import { resolveProfile } from "./index";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";

function createBaseProfile(): BaseProfile {
  return parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_architecture_world",
    name: "Architecture world",
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

describe("Building profile resolution", () => {
  it("merges architecture defaults and Asset answers while inheriting world geometry", () => {
    const base = createBaseProfile();
    const category = parseCategoryProfile({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_building_gate",
      name: "Fortified gates",
      baseProfileId: base.id,
      category: "building",
      subtype: "gate",
      iconId: "building-gate",
      capabilities: resolveCapabilities("building", "gate"),
      overrides: { tileSize: 48, paletteMode: "desaturated" },
      defaults: {
        buildingType: "gate",
        purpose: "Protected city access",
        planShape: "rectangular",
        size: "large",
        footprint: { widthTiles: 4, depthTiles: 2 },
        floors: 2,
        primaryMaterial: "stone",
        secondaryMaterial: "wood",
        roofShape: "gable",
        roofMaterial: "slate",
        facadeStyle: "fortified",
        doorCount: 1,
        doorType: "reinforced",
        doorState: "closed",
        windowCount: 4,
        windowShape: "narrowSlit",
        windowLighting: "warmLit",
        condition: "weathered",
        occupancy: "active",
        mappingMode: "modularSet",
        collisionMode: "walkableEntrance",
        modular: true,
        lighting: "visibleSources",
        animationType: "openClose",
      } satisfies BuildingAnswers,
      tags: ["building", "gate"],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_building_gate",
      name: "Northern city gate",
      baseProfileId: base.id,
      categoryProfileId: category.id,
      compatibilityKey: "stale-building-key",
      category: "building",
      subtype: "gate",
      iconId: "building-gate",
      badgeIconIds: ["material-stone", "material-wood"],
      capabilities: resolveCapabilities("building", "gate"),
      overrides: { outlineStyle: "minimal" },
      answers: {
        subjectDescription: "A gatehouse with a bright heraldic shield.",
        doorState: "open",
        condition: "used",
        lightSourceDetails: "Two warm lanterns flank the passage.",
      } satisfies BuildingAnswers,
      tags: ["architecture", "city"],
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
    if (result.status !== "resolved" || result.profile.categoryData.category !== "building") {
      throw new Error("Expected a resolved Building profile.");
    }
    expect(result.profile.categoryData.answers).toMatchObject({
      buildingType: "gate",
      purpose: "Protected city access",
      subjectDescription: "A gatehouse with a bright heraldic shield.",
      footprint: { widthTiles: 4, depthTiles: 2 },
      primaryMaterial: "stone",
      roofShape: "gable",
      facadeStyle: "fortified",
      doorState: "open",
      windowLighting: "warmLit",
      condition: "used",
      mappingMode: "modularSet",
      collisionMode: "walkableEntrance",
      modular: true,
      lighting: "visibleSources",
      lightSourceDetails: "Two warm lanterns flank the passage.",
      animationType: "openClose",
    });
    expect(Object.isFrozen(result.profile.categoryData.answers)).toBe(true);
    expect(Object.isFrozen(result.profile.categoryData.answers.footprint)).toBe(true);
    expect(result.profile.values).toMatchObject({
      tileSize: 48,
      perspectiveType: "threeQuarter",
      cameraAngle: 60,
      projectionType: "orthographic",
      outlineStyle: "minimal",
      paletteMode: "desaturated",
    });
    expect(result.profile.values).not.toHaveProperty("characterHeight");
    expect(result.profile.valueSources).toMatchObject({
      tileSize: "category",
      perspectiveType: "base",
      outlineStyle: "asset",
    });
    expect(result.profile.capabilities).toMatchObject({
      footprint: true,
      modular: true,
      animated: true,
      directional: false,
      scaledCharacter: false,
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
  });

  it.each(["house", "gate", "fortification", "dungeonModule"] as const)(
    "resolves %s without directions or character scale",
    (subtype) => {
      const base = createBaseProfile();
      const capabilities = resolveCapabilities("building", subtype);
      const asset = parseAssetProfile({
        schemaVersion: 2,
        kind: "assetProfile",
        id: `asset_building_${subtype.toLowerCase()}`,
        name: `Building ${subtype}`,
        baseProfileId: base.id,
        compatibilityKey: "stale-building-key",
        category: "building",
        subtype,
        iconId: "building",
        badgeIconIds: [],
        capabilities,
        overrides: {},
        answers: {
          buildingType: getDefaultBuildingType(subtype),
          footprint: { widthTiles: 3, depthTiles: 2 },
          ...(capabilities.modular ? { modular: true } : {}),
          ...(capabilities.animated ? { animationType: "openClose" } : {}),
        },
        tags: [],
        favorite: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      });

      const result = resolveProfile({ baseProfile: base, assetProfile: asset });

      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") {
        throw new Error(`Expected a resolved ${subtype} Building profile.`);
      }
      expect(result.profile.capabilities.directional).toBe(false);
      expect(result.profile.capabilities.scaledCharacter).toBe(false);
      expect(result.profile.values).not.toHaveProperty("characterHeight");
      expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
      expect(result.profile.compatibilityKey).not.toContain("__char-");
    },
  );
});
