import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

describe("WizardTechnicalSummary Item facts", () => {
  it("shows compact Item production facts without directions or long prose", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_item_summary",
      projectName: "Wachrüstung",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T12:00:00.000Z",
    });
    const longDescription = "Ausführliche Itembeschreibung ".repeat(90);
    const values: WizardCoreFormValues = {
      projectName: "Wachrüstung",
      category: "item",
      subtype: "armorPiece",
      itemPurpose: "wearable",
      itemPresentation: "equipped",
      itemWearPosition: "body",
      itemPrimaryMaterial: "metal",
      itemSecondaryMaterial: "leather",
      itemCondition: "worn",
      itemSize: "medium",
      itemReadability: "silhouetteFirst",
      itemSignificance: "ceremonial",
      itemFunctionDetails: "Schützt Schulter und Oberarm",
      itemMeaningDetails: "Wappen der Stadtwache",
      itemGlowMode: "none",
      itemShadowMode: "contact",
      itemIconSize: 48,
      itemVariantCount: 3,
      itemDescription: longDescription,
      itemExtraDetails: longDescription,
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="item"
        activeSubtype="armorPiece"
        selection={{
          category: "item",
          subtype: "armorPiece",
          capabilities: resolveCapabilities("item", "armorPiece"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", { name: "Technische Zusammenfassung" });
    for (const value of [
      "Rüstung",
      "Tragbar",
      "Ausgerüstet",
      "Körper",
      "Metall + Leder",
      "Abgenutzt",
      "Mittel",
      "Silhouette zuerst",
      "Zeremoniell",
      "Schützt Schulter und Oberarm",
      "Wappen der Stadtwache",
      "Kein Leuchten",
      "Kontaktschatten",
      "48 px",
      "3",
    ]) {
      expect(within(summary).getByText(value)).toBeVisible();
    }
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Animation")).not.toBeInTheDocument();
    expect(within(summary).queryByText(longDescription)).not.toBeInTheDocument();
  });

  it("derives a visible legacy-compatible Item class without writing it", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_item_legacy_summary",
      projectName: "Alter Trank",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T12:00:00.000Z",
    });
    const values: WizardCoreFormValues = {
      projectName: "Alter Trank",
      category: "item",
      subtype: "consumable",
    };
    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={draft}
        library={null}
        projectName={values.projectName}
        activeCategory="item"
        activeSubtype="consumable"
        selection={{
          category: "item",
          subtype: "consumable",
          capabilities: resolveCapabilities("item", "consumable"),
        }}
        formValues={values}
      />,
    );

    expect(screen.getByText("Verbrauchsgegenstand")).toBeVisible();
    expect(values).not.toHaveProperty("itemClass");
  });
});
