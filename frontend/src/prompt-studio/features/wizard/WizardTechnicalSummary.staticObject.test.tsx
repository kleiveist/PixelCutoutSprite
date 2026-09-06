import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

describe("WizardTechnicalSummary static-object facts", () => {
  it("shows compact configured facts and animation without directions or long prose", () => {
    const longDescription = "Ausführliche Objektbeschreibung ".repeat(90);
    const longDetails = "Ausführliches Materialdetail ".repeat(20);
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_static_summary",
      projectName: "Kartentruhe",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-07T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Kartentruhe",
      category: "staticObject",
      subtype: "chest",
      staticObjectClass: "container",
      staticObjectPurpose: "interactive",
      staticObjectBasicShape: "boxy",
      staticObjectProportion: "compact",
      staticObjectSymmetry: "bilateral",
      staticObjectDescription: longDescription,
      staticObjectPrimaryMaterial: "wood",
      staticObjectSecondaryMaterial: "metal",
      staticObjectMaterialDetails: longDetails,
      staticObjectCondition: "weathered",
      staticObjectDetailElements: longDetails,
      staticObjectContents: longDetails,
      staticObjectInteraction: "open",
      staticObjectFootprintWidthTiles: 2,
      staticObjectFootprintDepthTiles: 1,
      staticObjectShadowMode: "contact",
      staticObjectVariantCount: 3,
      staticObjectExtraDetails: longDescription,
      animationType: "openClose",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="staticObject"
        activeSubtype="chest"
        selection={{
          category: "staticObject",
          subtype: "chest",
          capabilities: resolveCapabilities("staticObject", "chest"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    for (const value of [
      "Behälter",
      "Interaktiv",
      "Kastenförmig",
      "Kompakt",
      "Bilateral",
      "Holz",
      "Metall",
      "Verwittert",
      "2 × 1 Tiles",
      "Öffnen",
      "Kontaktschatten",
      "3",
      "Öffnen / Schließen",
    ]) {
      expect(within(summary).getByText(value)).toBeVisible();
    }
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDescription)).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDetails)).not.toBeInTheDocument();
  });

  it("derives the visible class without materializing an old missing field", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_static_summary_legacy",
      projectName: "Alte Säule",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-07T10:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Alte Säule",
      category: "staticObject",
      subtype: "pillar",
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="staticObject"
        activeSubtype="pillar"
        selection={{
          category: "staticObject",
          subtype: "pillar",
          capabilities: resolveCapabilities("staticObject", "pillar"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Säule")).toBeVisible();
    expect(within(summary).queryByText("Animation")).not.toBeInTheDocument();
    expect(values).not.toHaveProperty("staticObjectClass");
  });
});
