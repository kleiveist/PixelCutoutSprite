import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import { ProfileLibrarySchema, parseAssetProfile, type BaseProfile } from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { resolveProfileSummary } from "./dashboardData";

describe("Item dashboard summaries", () => {
  it("surfaces Item production facts and known material badges", () => {
    const fixture = createProfileLibraryFixture();
    const base = fixture.baseProfiles.find((profile) => profile.id === "base_world_80") as
      BaseProfile | undefined;
    if (!base) throw new Error("Expected Base-profile fixture.");
    const selection = { category: "item", subtype: "armorPiece" } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_item_dashboard_armor",
      name: "Wachrüstung",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "item-armor",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers: {
        itemClass: "armor",
        purpose: "wearable",
        presentation: "equipped",
        primaryMaterial: "metal",
        secondaryMaterial: "leather",
        condition: "worn",
        size: "medium",
        readability: "silhouetteFirst",
        significance: "ceremonial",
        functionDetails: "Schützt Schulter und Oberarm",
        shadowMode: "contact",
        iconSize: 48,
        variantCount: 3,
      },
      tags: ["Stadtwache"],
      favorite: true,
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    });
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      assetProfiles: [...fixture.assetProfiles, asset],
    });

    const summary = resolveProfileSummary(asset, library);
    expect(summary).not.toBeNull();
    expect(summary?.facts).toEqual(
      expect.arrayContaining([
        "Itemklasse: Rüstung",
        "Zweck: Tragbar",
        "Darstellung: Ausgerüstet",
        "Hauptmaterial: Metall",
        "Zweitmaterial: Leder",
        "Zustand: Abgenutzt",
        "Größe: Mittel",
        "Lesbarkeit: Silhouette zuerst",
        "Bedeutung: Zeremoniell",
        "Funktion: Schützt Schulter und Oberarm",
        "Schatten: Kontaktschatten",
        "Icongröße: 48 px",
        "Varianten: 3",
      ]),
    );
    expect(summary?.facts.some((fact) => fact.includes("Richtung"))).toBe(false);
    expect(summary?.materials).toEqual(["metal", "leather"]);
  });
});
