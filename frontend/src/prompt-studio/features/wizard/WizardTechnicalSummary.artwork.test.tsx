import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

describe("WizardTechnicalSummary Artwork facts", () => {
  it("shows free Artwork facts without Tile, camera, direction or animation output", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_artwork_summary",
      projectName: "Sturmobservatorium",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T13:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Sturmobservatorium",
      category: "artwork",
      subtype: "environmentConcept",
      artworkPurpose: "productionReference",
      artworkMotif: "environment",
      artworkDescription: "Ausführliche Motivbeschreibung ".repeat(100),
      artworkSceneDescription: "Forscherin vor einem Observatorium im Sturm",
      artworkComposition: "scene",
      artworkFormat: "landscape",
      artworkBackground: "complete",
      artworkFocus: "scale",
      artworkLightingDrama: "gloomy",
      artworkDetailLevel: "productionConcept",
      artworkExtraDetails: "Ausführliche Zusatzdetails ".repeat(100),
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="artwork"
        activeSubtype="environmentConcept"
        selection={{
          category: "artwork",
          subtype: "environmentConcept",
          capabilities: resolveCapabilities("artwork", "environmentConcept"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    for (const value of [
      "Umgebungskonzept",
      "Produktionsreferenz",
      "Umgebung",
      "Forscherin vor einem Observatorium im Sturm",
      "Gestaffelte Szene",
      "Querformat",
      "Vollständig ausgearbeitet",
      "Maßstab",
      "Düster",
      "Produktionskonzept",
    ]) {
      expect(within(summary).getAllByText(value)[0]).toBeVisible();
    }
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Animation")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Tile-Raster")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Kameraneigung")).not.toBeInTheDocument();
    expect(within(summary).queryByText(values.artworkDescription ?? "")).not.toBeInTheDocument();
    expect(within(summary).queryByText(values.artworkExtraDetails ?? "")).not.toBeInTheDocument();
  });

  it("derives a visible Artwork type without materializing it in the form", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_artwork_legacy_summary",
      projectName: "Altes Stimmungsbild",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T13:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Altes Stimmungsbild",
      category: "artwork",
      subtype: "moodPainting",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="artwork"
        activeSubtype="moodPainting"
        selection={{
          category: "artwork",
          subtype: "moodPainting",
          capabilities: resolveCapabilities("artwork", "moodPainting"),
        }}
        formValues={values}
      />,
    );

    expect(screen.getByText("Stimmungsbild")).toBeVisible();
    expect(values).not.toHaveProperty("artworkType");
  });
});
