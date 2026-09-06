import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  type BaseProfile,
  type BuildingAnswers,
  type ProfileLibrary,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { resolveProfileSummary } from "./dashboardData";

const TIMESTAMP = "2026-09-07T10:00:00.000Z";

function requireBase(library: ProfileLibrary): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!base) throw new Error("Expected the world Base-profile fixture.");
  return base;
}

describe("Building dashboard projection", () => {
  it("surfaces compact architecture facts without character scale or directions", () => {
    const fixture = createProfileLibraryFixture();
    const base = requireBase(fixture);
    const selection = { category: "building", subtype: "gate" } as const;
    const answers = {
      buildingType: "gate",
      size: "large",
      footprint: { widthTiles: 4, depthTiles: 2 },
      heightPixels: 192,
      floors: 2,
      primaryMaterial: "stone",
      roofShape: "gable",
      roofMaterial: "slate",
      facadeStyle: "fortified",
      doorCount: 1,
      windowCount: 4,
      condition: "weathered",
      occupancy: "active",
      mappingMode: "modularSet",
      collisionMode: "walkableEntrance",
      modular: true,
      lighting: "visibleSources",
      animationType: "openClose",
    } as const satisfies BuildingAnswers;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_dashboard_gate",
      name: "Nordtor",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "building-gate",
      badgeIconIds: ["material-stone", "material-wood"],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers,
      tags: ["Stadt", "Tor"],
      favorite: true,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      assetProfiles: [...fixture.assetProfiles, asset],
    });

    const summary = resolveProfileSummary(asset, library);

    expect(summary).not.toBeNull();
    expect(summary?.facts).toEqual(
      expect.arrayContaining([
        "32 px Tile",
        "3/4-RPG",
        "Gebäudetyp: Torbau",
        "Größe: Groß",
        "Standfläche: 4 × 2 Tiles",
        "Geschosse: 2",
        "Gebäudehöhe: 192 px",
        "Hauptmaterial: Stein",
        "Dachform: Satteldach",
        "Dachmaterial: Schiefer",
        "Fassade: Befestigt",
        "Türen: 1",
        "Fenster: 4",
        "Zustand: Verwittert",
        "Belegung: Aktiv genutzt",
        "Mapping: Modularer Bauteilsatz",
        "Kollision: Begehbarer Eingang",
        "Modular",
        "Gebäudelicht: Sichtbare lokale Lichtquellen",
        "Animation: Öffnen / Schließen",
      ]),
    );
    expect(summary?.facts.join(" ")).not.toMatch(/Richtung|Figur/);
    expect(summary?.materials).toEqual(["wood", "stone"]);
  });

  it("derives the display type for an older V2 house without mutating answers", () => {
    const fixture = createProfileLibraryFixture();
    const base = requireBase(fixture);
    const selection = { category: "building", subtype: "house" } as const;
    const answers = { purpose: "Wohnhaus", floors: 2 } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_dashboard_house",
      name: "Altes Wohnhaus",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "building-house",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers,
      tags: [],
      favorite: false,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      assetProfiles: [...fixture.assetProfiles, asset],
    });

    const summary = resolveProfileSummary(asset, library);

    expect(summary?.facts).toContain("Gebäudetyp: Wohngebäude");
    expect(asset.answers).not.toHaveProperty("buildingType");
  });
});
