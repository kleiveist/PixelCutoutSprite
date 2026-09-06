import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import { ProfileLibrarySchema, parseAssetProfile, type BaseProfile } from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { resolveProfileSummary } from "./dashboardData";

describe("Artwork dashboard summaries", () => {
  it("surfaces free-composition facts without Tile, camera or direction rules", () => {
    const fixture = createProfileLibraryFixture();
    const base = fixture.baseProfiles.find((profile) => profile.id === "base_world_80") as
      BaseProfile | undefined;
    if (!base) throw new Error("Expected Base-profile fixture.");
    const selection = {
      category: "artwork",
      subtype: "environmentConcept",
    } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_artwork_dashboard_observatory",
      name: "Sturmobservatorium",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "artwork-environment",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers: {
        purpose: "productionReference",
        motif: "environment",
        sceneDescription: "Forscherin vor einem Observatorium im Sturm",
        composition: "scene",
        format: "landscape",
        background: "complete",
        focus: "scale",
        lightingDrama: "gloomy",
        detailLevel: "productionConcept",
      },
      tags: ["Konzept"],
      favorite: true,
      createdAt: "2026-09-03T13:00:00.000Z",
      updatedAt: "2026-09-03T13:00:00.000Z",
    });
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      assetProfiles: [...fixture.assetProfiles, asset],
    });

    const summary = resolveProfileSummary(asset, library);
    expect(summary).not.toBeNull();
    expect(summary?.facts).toEqual(
      expect.arrayContaining([
        "Artworktyp: Umgebungskonzept",
        "Zweck: Produktionsreferenz",
        "Motiv: Umgebung",
        "Komposition: Gestaffelte Szene",
        "Format: Querformat",
        "Vollständiger Hintergrund",
        "Fokus: Maßstab",
        "Licht: Düster",
        "Detailgrad: Produktionskonzept",
        "Szene: Forscherin vor einem Observatorium im Sturm",
      ]),
    );
    expect(summary?.facts.some((fact) => /Tile|Kamera|Richtung/.test(fact))).toBe(false);
    expect(summary?.materials).toEqual([]);
  });
});
