import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../domain/assets";
import { parseWizardDraft } from "../../schemas";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import type { WizardCoreFormValues } from "./wizardSteps";

const SAVED_AT = "2026-09-06T10:00:00.000Z";

function unclassifiedDraft() {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_nature_summary",
    projectName: "Pilzwald",
    route: "wizard/project",
    currentStep: "project",
    validation: { errors: [], warnings: [] },
    savedAt: SAVED_AT,
  });
}

describe("WizardTechnicalSummary Nature facts", () => {
  it("omits stale anatomy and long prose while retaining compact relevant facts", () => {
    const longDescription = "Ausführliche Motivbeschreibung ".repeat(80);
    const longAnatomy = "Ausführliches Anatomiedetail ".repeat(15);
    const values: WizardCoreFormValues = {
      projectName: "Pilzwald",
      category: "nature",
      subtype: "mushroom",
      naturePlantType: "mushroom",
      natureSpecies: "Leuchtender Waldpilz",
      natureDescription: longDescription,
      natureClimate: "swamp",
      natureTrunkThickness: "massive",
      natureTrunkShape: "gnarled",
      natureTrunkDetails: longAnatomy,
      natureCrownShape: "spreading",
      natureCrownDensity: "dense",
      natureFoliageDetails: longAnatomy,
      natureRootVisibility: "exposed",
      natureRootDetails: longAnatomy,
      natureMossCoverage: "light",
      natureExtraDetails: longDescription,
    };

    render(
      <WizardTechnicalSummary
        categoryHint={null}
        draft={unclassifiedDraft()}
        library={null}
        projectName={values.projectName}
        activeCategory="nature"
        activeSubtype="mushroom"
        selection={{
          category: "nature",
          subtype: "mushroom",
          capabilities: resolveCapabilities("nature", "mushroom"),
        }}
        formValues={values}
      />,
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Leuchtender Waldpilz")).toBeVisible();
    expect(within(summary).getByText("Sumpf")).toBeVisible();
    expect(within(summary).getByText("Leicht")).toBeVisible();
    for (const irrelevantLabel of [
      "Stammstärke",
      "Stammform",
      "Kronenform",
      "Kronendichte",
      "Wurzeln",
    ]) {
      expect(within(summary).queryByText(irrelevantLabel)).not.toBeInTheDocument();
    }
    expect(within(summary).queryByText(longDescription)).not.toBeInTheDocument();
    expect(within(summary).queryByText(longAnatomy)).not.toBeInTheDocument();
  });
});
