import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { parseWizardDraft } from "../../schemas";
import { WIZARD_CORE_FLOW } from "./WizardCoreStepContent";
import type { WizardCoreFormValues } from "./wizardSteps";

const categoryStep = WIZARD_CORE_FLOW.steps.find((step) => step.id === "category");

if (categoryStep === undefined) {
  throw new Error("The Wizard must expose its category step.");
}

const CategoryStep = categoryStep.Component;

function PlantTypeRecoveryHarness({
  onRead,
}: Readonly<{ onRead: (values: WizardCoreFormValues) => void }>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Konfliktbaum",
      category: "nature",
      subtype: "tree",
      naturePlantType: "mushroom",
      natureSpecies: "Hüteeiche",
    },
  });
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_plant_type_recovery",
    projectName: "Konfliktbaum",
    route: "wizard/category",
    currentStep: "category",
    validation: { errors: [], warnings: [] },
    savedAt: "2026-09-06T10:00:00.000Z",
  });

  return (
    <>
      <CategoryStep
        context={{ categoryHint: null, library: null }}
        draft={draft}
        form={form}
        notifyProgrammaticChange={() => undefined}
      />
      <button type="button" onClick={() => onRead(form.getValues())}>
        Formularwerte lesen
      </button>
    </>
  );
}

describe("Nature classification recovery", () => {
  it("repairs a derived plant-type mismatch without dropping Nature details", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(<PlantTypeRecoveryHarness onRead={onRead} />);

    await user.click(
      screen.getByRole("button", {
        name: "Pflanzentyp aus Untertyp wiederherstellen",
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Pflanzentyp aus Untertyp wiederherstellen",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "nature",
        subtype: "tree",
        naturePlantType: "tree",
        natureSpecies: "Hüteeiche",
      }),
    );
  });
});
