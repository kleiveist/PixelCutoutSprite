import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../assets";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  parseAssetProfile,
  parseCategoryProfile,
  type BaseProfile,
  type ItemAnswers,
} from "../../schemas";
import { createCompatibilityKey, resolveProfile } from "./index";

const TIMESTAMP = "2026-09-03T12:00:00.000Z";

function baseFixture(): BaseProfile {
  const base = createProfileLibraryFixture().baseProfiles.find(
    (profile) => profile.id === "base_world_80",
  );
  if (!base) throw new Error("Expected Base-profile fixture.");
  return base;
}

describe("Item profile resolution", () => {
  it("merges Item defaults and Asset answers through the standard inheritance chain", () => {
    const base = baseFixture();
    const category = parseCategoryProfile({
      schemaVersion: 2,
      kind: "categoryProfile",
      id: "category_item_armor",
      name: "City watch armor",
      baseProfileId: base.id,
      category: "item",
      subtype: "armorPiece",
      iconId: "item-armor",
      capabilities: resolveCapabilities("item", "armorPiece"),
      overrides: { tileSize: 48, paletteMode: "desaturated" },
      defaults: {
        itemClass: "armor",
        purpose: "wearable",
        presentation: "equipped",
        wearPosition: "body",
        size: "medium",
        primaryMaterial: "metal",
        secondaryMaterial: "leather",
        condition: "used",
        readability: "silhouetteFirst",
        shadowMode: "contact",
      } satisfies ItemAnswers,
      tags: ["Rüstung"],
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const selection = { category: "item", subtype: "armorPiece" } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_item_watch_armor",
      name: "Wachrüstung",
      baseProfileId: base.id,
      categoryProfileId: category.id,
      compatibilityKey: createCompatibilityKey(
        { ...base.values, tileSize: 48, paletteMode: "desaturated" },
        selection,
      ),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "item-armor",
      badgeIconIds: ["material-metal", "material-leather"],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: { outlineStyle: "minimal" },
      answers: {
        condition: "damaged",
        functionDetails: "Protects the shoulder while preserving mobility.",
        significance: "ceremonial",
        meaningDetails: "The city crest marks veteran service.",
        variantCount: 3,
      } satisfies ItemAnswers,
      tags: ["Stadtwache"],
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
    if (result.status !== "resolved" || result.profile.categoryData.category !== "item") {
      throw new Error("Expected a resolved Item profile.");
    }
    expect(result.profile.categoryData.answers).toMatchObject({
      itemClass: "armor",
      purpose: "wearable",
      presentation: "equipped",
      primaryMaterial: "metal",
      condition: "damaged",
      functionDetails: "Protects the shoulder while preserving mobility.",
      significance: "ceremonial",
      variantCount: 3,
    });
    expect(result.profile.values).toMatchObject({
      tileSize: 48,
      paletteMode: "desaturated",
      outlineStyle: "minimal",
      backgroundMode: "transparent",
    });
    expect(result.profile.values).not.toHaveProperty("characterHeight");
    expect(result.profile.capabilities).toMatchObject({
      transparent: true,
      wearable: true,
      directional: false,
      animated: false,
      scaledCharacter: false,
    });
    expect(result.profile.categoryData.answers).not.toHaveProperty("directionCount");
  });
});
