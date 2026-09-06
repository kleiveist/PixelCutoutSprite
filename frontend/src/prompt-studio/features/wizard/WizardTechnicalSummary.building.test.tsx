import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

describe("WizardTechnicalSummary Building facts", () => {
  it("shows compact architecture, mapping, light, and gate animation without directions or long prose", () => {
    const longDescription = "Ausführliche Gebäudebeschreibung ".repeat(90);
    const longDetails = "Ausführliches Architekturdetail ".repeat(15);
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_building_summary",
      projectName: "Nordtor",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-07T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Nordtor",
      category: "building",
      subtype: "gate",
      buildingType: "gate",
      buildingPurpose: "Bewachter Stadteingang",
      buildingDescription: longDescription,
      buildingSize: "large",
      buildingFootprintWidthTiles: 4,
      buildingFootprintDepthTiles: 2,
      buildingHeightPixels: 192,
      buildingFloors: 2,
      buildingPrimaryMaterial: "stone",
      buildingSecondaryMaterial: "wood",
      buildingMaterialDetails: longDetails,
      buildingRoofShape: "gable",
      buildingRoofMaterial: "slate",
      buildingRoofDetails: longDetails,
      buildingFacadeStyle: "fortified",
      buildingFacadeDetails: longDetails,
      buildingDoorCount: 1,
      buildingDoorType: "reinforced",
      buildingDoorState: "closed",
      buildingWindowCount: 4,
      buildingWindowShape: "narrowSlit",
      buildingWindowLighting: "warmLit",
      buildingCondition: "weathered",
      buildingOccupancy: "active",
      buildingMappingMode: "modularSet",
      buildingCollisionMode: "walkableEntrance",
      buildingModular: true,
      buildingLighting: "visibleSources",
      buildingLightSourceDetails: longDetails,
      buildingExtraDetails: longDescription,
      animationType: "openClose",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="building"
        activeSubtype="gate"
        selection={{
          category: "building",
          subtype: "gate",
          capabilities: resolveCapabilities("building", "gate"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    for (const value of [
      "Torbau",
      "Bewachter Stadteingang",
      "Groß",
      "4 × 2 Tiles",
      "2",
      "192 px",
      "Stein",
      "Holz",
      "Satteldach",
      "Schiefer",
      "Befestigt",
      "1 · Verstärktes Tor · Geschlossen",
      "4 · Schmale Schießscharte · Warm beleuchtet",
      "Verwittert",
      "Aktiv genutzt",
      "Modularer Bauteilsatz",
      "Begehbarer Eingang",
      "Modular",
      "Sichtbare lokale Lichtquellen",
      "Öffnen / Schließen",
    ]) {
      expect(within(summary).getByText(value)).toBeVisible();
    }
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Figurenhöhe")).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDescription)).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDetails)).not.toBeInTheDocument();
  });

  it("derives a legacy-compatible visible Building type without writing it", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_building_summary_legacy",
      projectName: "Altes Wohnhaus",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-07T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Altes Wohnhaus",
      category: "building",
      subtype: "house",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="building"
        activeSubtype="house"
        selection={{
          category: "building",
          subtype: "house",
          capabilities: resolveCapabilities("building", "house"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Wohngebäude")).toBeVisible();
    expect(within(summary).queryByText("Animation")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Modularität")).not.toBeInTheDocument();
    expect(values).not.toHaveProperty("buildingType");
  });
});
