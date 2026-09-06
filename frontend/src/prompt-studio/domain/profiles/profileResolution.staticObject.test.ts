import { describe, expect, it } from "vitest";
import {
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type BaseProfile,
  type StaticObjectAnswers,
} from "../../schemas";
import { resolveCapabilities } from "../assets";
import { getDefaultStaticObjectClass } from "../static-objects";
import { resolveProfile } from "./index";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";

function createBaseProfile(): BaseProfile {
  return parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_static_world",
    name: "Static world objects",
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

describe("static-object profile resolution", () => {
  it("merges expanded Category defaults with Asset answers while resolving central technical values", () => {
    const base = createBaseProfile();
    const category = parseCategoryProfile({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_static_chest",
      name: "Storage chests",
      baseProfileId: base.id,
      category: "staticObject",
      subtype: "chest",
      iconId: "static-chest",
      capabilities: resolveCapabilities("staticObject", "chest"),
      overrides: {
        tileSize: 48,
        paletteMode: "desaturated",
      },
      defaults: {
        objectClass: "container",
        purpose: "interactive",
        basicShape: "boxy",
        proportion: "compact",
        symmetry: "bilateral",
        subjectDescription: "A readable storage chest.",
        primaryMaterial: "wood",
        secondaryMaterial: "metal",
        materialDetails: "Oak boards with dark iron straps.",
        condition: "weathered",
        detailElements: "Hinges, corner bands, and a centered latch.",
        contents: "Folded cloth and sealed jars.",
        interaction: "open",
        animationType: "openClose",
        shadowMode: "contact",
        footprint: { widthTiles: 2, depthTiles: 1 },
        variantCount: 2,
        extraDetails: "Keep the hinge side stable.",
      } satisfies StaticObjectAnswers,
      tags: ["static", "container"],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_static_chest",
      name: "Damaged iron-bound chest",
      baseProfileId: base.id,
      categoryProfileId: category.id,
      compatibilityKey: "stale-static-key",
      category: "staticObject",
      subtype: "chest",
      iconId: "static-chest",
      badgeIconIds: ["material-wood", "material-metal"],
      capabilities: resolveCapabilities("staticObject", "chest"),
      overrides: {
        outlineStyle: "minimal",
      },
      answers: {
        primaryMaterial: "ceramic",
        condition: "damaged",
        contents: "A single sealed map case.",
        detailElements: "A broken corner band and off-center latch.",
        variantCount: 4,
      } satisfies StaticObjectAnswers,
      tags: ["static", "chest"],
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
    if (result.status !== "resolved" || result.profile.categoryData.category !== "staticObject") {
      throw new Error("Expected a resolved static-object profile.");
    }

    expect(result.profile.categoryData.answers).toEqual({
      objectClass: "container",
      purpose: "interactive",
      basicShape: "boxy",
      proportion: "compact",
      symmetry: "bilateral",
      subjectDescription: "A readable storage chest.",
      primaryMaterial: "ceramic",
      secondaryMaterial: "metal",
      materialDetails: "Oak boards with dark iron straps.",
      condition: "damaged",
      detailElements: "A broken corner band and off-center latch.",
      contents: "A single sealed map case.",
      interaction: "open",
      animationType: "openClose",
      shadowMode: "contact",
      footprint: { widthTiles: 2, depthTiles: 1 },
      variantCount: 4,
      extraDetails: "Keep the hinge side stable.",
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
      animated: true,
      directional: false,
      scaledCharacter: false,
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
  });

  it.each(["chest", "door"] as const)(
    "resolves an animated %s without direction or character scale",
    (subtype) => {
      const base = createBaseProfile();
      const asset = parseAssetProfile({
        schemaVersion: 2,
        kind: "assetProfile",
        id: `asset_static_${subtype}`,
        name: `Animated ${subtype}`,
        baseProfileId: base.id,
        compatibilityKey: "stale-static-key",
        category: "staticObject",
        subtype,
        iconId: "static-object",
        badgeIconIds: [],
        capabilities: resolveCapabilities("staticObject", subtype),
        overrides: {},
        answers: {
          objectClass: getDefaultStaticObjectClass(subtype),
          interaction: "open",
          animationType: "openClose",
        },
        tags: [],
        favorite: false,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      });

      const result = resolveProfile({ baseProfile: base, assetProfile: asset });

      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") {
        throw new Error(`Expected a resolved ${subtype} profile.`);
      }
      expect(result.profile.capabilities.animated).toBe(true);
      expect(result.profile.capabilities.directional).toBe(false);
      expect(result.profile.capabilities.scaledCharacter).toBe(false);
      expect(result.profile.values).not.toHaveProperty("characterHeight");
      expect(result.profile.categoryData.answers).toMatchObject({
        interaction: "open",
        animationType: "openClose",
      });
      expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
      expect(result.profile.compatibilityKey).not.toContain("__char-");
    },
  );
});
