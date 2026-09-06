import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  type BaseProfile,
  type ProfileLibrary,
  type TilesetAnswers,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { resolveProfileSummary } from "./dashboardData";

const TIMESTAMP = "2026-09-08T10:00:00.000Z";

function requireBase(library: ProfileLibrary): BaseProfile {
  const base = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!base) throw new Error("Expected the world Base-profile fixture.");
  return base;
}

describe("Tileset dashboard projection", () => {
  it("surfaces compact rules and calculated atlas metrics without directions", () => {
    const fixture = createProfileLibraryFixture();
    const base = requireBase(fixture);
    const selection = { category: "tileset", subtype: "autotile" } as const;
    const answers = {
      tilesetType: "autotile",
      tileUsage: "transition",
      edgeSet: "cardinalAndDiagonal",
      cornerSet: "innerAndOuter",
      transitionMode: "bidirectional",
      sourceMaterial: "Waldgras",
      targetMaterial: "Steinweg",
      seamMode: "matchedEdges",
      tileableAxes: "both",
      repeatMode: "randomized",
      variantCount: 3,
      variantKinds: ["clean", "damaged", "decorated"],
      atlasLayout: "fixedColumns",
      atlasTileCount: 47,
      atlasColumns: 8,
      atlasGutterPixels: 1,
      atlasMarginPixels: 2,
    } as const satisfies TilesetAnswers;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_dashboard_autotile",
      name: "Waldweg-Autotile",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "tileset-autotile",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers,
      tags: ["Wald", "Mapping"],
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
        "Tiletyp: Regelbasiertes Autotile",
        "Mapping-Einsatz: Übergang / Anschluss",
        "Kanten: Kardinal- und Diagonalkanten",
        "Ecken: Innen- und Außenecken",
        "Übergang: Beidseitig",
        "Materialgrenze: Waldgras → Steinweg",
        "Seam-Regel: Passende Randpixel",
        "Kachelbare Achsen: Horizontal und vertikal",
        "Wiederholung: Kontrolliert variiert",
        "Varianten pro Zustand: 3",
        "Variantenarten: sauber, beschädigt, dekoriert",
        "Atlaslayout: Feste Spaltenzahl",
        "Atlas: 8 × 6 · 267 × 201 px · 47/48 Slots",
      ]),
    );
    expect(summary?.facts.join(" ")).not.toMatch(/Richtung|Figur/);
  });

  it("derives the display type for an older V2 ground tile without writing it", () => {
    const fixture = createProfileLibraryFixture();
    const base = requireBase(fixture);
    const selection = { category: "tileset", subtype: "groundTile" } as const;
    const answers = { tileUsage: "floor", tileableAxes: "both" } as const;
    const asset = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: "asset_dashboard_ground_tile",
      name: "Alter Bodensatz",
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: selection.category,
      subtype: selection.subtype,
      iconId: "tileset-ground",
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

    expect(summary?.facts).toContain("Tiletyp: Boden");
    expect(asset.answers).not.toHaveProperty("tilesetType");
  });
});
