import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../assets";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  parseAssetProfile,
  parseCategoryProfile,
  type ArtworkAnswers,
  type BaseProfile,
} from "../../schemas";
import { createCompatibilityKey, resolveProfile } from "./index";

const TIMESTAMP = "2026-09-03T13:00:00.000Z";

function baseFixture(): BaseProfile {
  const base = createProfileLibraryFixture().baseProfiles.find(
    (profile) => profile.id === "base_world_80",
  );
  if (!base) throw new Error("Expected Base-profile fixture.");
  return base;
}

describe("Artwork profile resolution", () => {
  it("merges free Artwork answers while omitting world geometry from compatibility", () => {
    const base = baseFixture();
    const category = parseCategoryProfile({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_artwork_environment",
      name: "Atmospheric environment concepts",
      baseProfileId: base.id,
      category: "artwork",
      subtype: "environmentConcept",
      iconId: "artwork-environment",
      capabilities: resolveCapabilities("artwork", "environmentConcept"),
      overrides: { paletteMode: "desaturated", tileSize: 64 },
      defaults: {
        purpose: "concept",
        motif: "environment",
        composition: "scene",
        format: "landscape",
        background: "complete",
        focus: "mood",
        lightingDrama: "gloomy",
        detailLevel: "overview",
      } satisfies ArtworkAnswers,
      tags: ["Konzept"],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const selection = {
      category: "artwork",
      subtype: "environmentConcept",
    } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_artwork_observatory",
      name: "Sturmobservatorium",
      baseProfileId: base.id,
      categoryProfileId: category.id,
      compatibilityKey: createCompatibilityKey(
        { ...base.values, paletteMode: "desaturated" },
        selection,
      ),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "artwork-environment",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: { outlineStyle: "minimal", perspectiveType: "side" },
      answers: {
        focus: "scale",
        sceneDescription: "A researcher approaches through high grass.",
        lightingDetails: "Warm windows against a cool storm.",
        detailLevel: "productionConcept",
      } satisfies ArtworkAnswers,
      tags: ["Umgebung"],
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
    if (result.status !== "resolved" || result.profile.categoryData.category !== "artwork") {
      throw new Error("Expected a resolved Artwork profile.");
    }

    expect(result.profile.categoryData.answers).toMatchObject({
      purpose: "concept",
      motif: "environment",
      composition: "scene",
      format: "landscape",
      background: "complete",
      focus: "scale",
      lightingDrama: "gloomy",
      lightingDetails: "Warm windows against a cool storm.",
      detailLevel: "productionConcept",
    });
    expect(result.profile.values).toMatchObject({
      tileSize: 64,
      perspectiveType: "side",
      paletteMode: "desaturated",
      outlineStyle: "minimal",
    });
    expect(result.profile.values).not.toHaveProperty("characterHeight");
    expect(result.profile.compatibilityKey).toBe(
      createCompatibilityKey(
        {
          ...result.profile.values,
          tileSize: 512,
          perspectiveType: "topdown",
          cameraAngle: 30,
          cameraDirection: "swToNe",
          projectionType: "mildPerspective",
        },
        selection,
      ),
    );
    expect(result.profile.capabilities).toMatchObject({
      freeComposition: true,
      directional: false,
      animated: false,
      tileable: false,
      gridBound: false,
      scaledCharacter: false,
    });
  });
});
