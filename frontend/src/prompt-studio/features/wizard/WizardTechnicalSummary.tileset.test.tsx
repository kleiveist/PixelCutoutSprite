import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

describe("WizardTechnicalSummary Tileset facts", () => {
  it("shows compact rules and calculated tile metrics without directions or prose", () => {
    const longDescription = "Ausführliche Tileset-Beschreibung ".repeat(90);
    const longDetails = "Ausführliches Kanten- und Seam-Detail ".repeat(15);
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_tileset_summary",
      projectName: "Waldweg-Autotile",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-08T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Waldweg-Autotile",
      category: "tileset",
      subtype: "autotile",
      tileSize: 32,
      tilesetType: "autotile",
      tilesetUsage: "transition",
      tilesetDescription: longDescription,
      tilesetEdgeSet: "cardinalAndDiagonal",
      tilesetEdgeDetails: longDetails,
      tilesetCornerSet: "innerAndOuter",
      tilesetTransitionMode: "bidirectional",
      tilesetSourceMaterial: "Waldgras",
      tilesetTargetMaterial: "Steinweg",
      tilesetSeamMode: "matchedEdges",
      tilesetSeamDetails: longDetails,
      tileableAxes: "both",
      tilesetRepeatMode: "randomized",
      tilesetVariantCount: 3,
      tilesetVariantKinds: ["clean", "damaged", "decorated"],
      tilesetAtlasLayout: "fixedColumns",
      tilesetAtlasTileCount: 47,
      tilesetAtlasColumns: 8,
      tilesetAtlasGutterPixels: 1,
      tilesetAtlasMarginPixels: 2,
      tilesetExtraDetails: longDescription,
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="tileset"
        activeSubtype="autotile"
        selection={{
          category: "tileset",
          subtype: "autotile",
          capabilities: resolveCapabilities("tileset", "autotile"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    for (const value of [
      "Regelbasiertes Autotile",
      "Übergang / Anschluss",
      "Kardinal- und Diagonalkanten",
      "Innen- und Außenecken",
      "Beidseitig",
      "Waldgras → Steinweg",
      "Passende Randpixel",
      "Horizontal und vertikal",
      "Kontrolliert variiert",
      "3",
      "sauber, beschädigt, dekoriert",
      "Feste Spaltenzahl",
      "8 × 6 Zellen · 267 × 201 px · 47/48 Slots",
    ]) {
      expect(within(summary).getByText(value)).toBeVisible();
    }
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Figurenhöhe")).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDescription)).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDetails)).not.toBeInTheDocument();
  });

  it("derives a legacy-compatible visible tile type without writing it", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_tileset_summary_legacy",
      projectName: "Altes Bodentile",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-08T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Altes Bodentile",
      category: "tileset",
      subtype: "groundTile",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="tileset"
        activeSubtype="groundTile"
        selection={{
          category: "tileset",
          subtype: "groundTile",
          capabilities: resolveCapabilities("tileset", "groundTile"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Boden")).toBeVisible();
    expect(within(summary).queryByText("Animation")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(values).not.toHaveProperty("tilesetType");
  });
});
