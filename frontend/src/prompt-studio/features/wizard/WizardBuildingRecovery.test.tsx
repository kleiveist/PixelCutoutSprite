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

function BuildingTypeRecoveryHarness({
  onRead,
  onNotify,
}: Readonly<{
  onRead: (values: WizardCoreFormValues) => void;
  onNotify: () => void;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Konflikttor",
      category: "building",
      subtype: "gate",
      buildingType: "residential",
      buildingPrimaryMaterial: "stone",
    },
  });
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_building_type_recovery",
    projectName: "Konflikttor",
    route: "wizard/category",
    currentStep: "category",
    validation: { errors: [], warnings: [] },
    savedAt: "2026-09-07T10:00:00.000Z",
  });

  return (
    <>
      <CategoryStep
        context={{ categoryHint: null, library: null }}
        draft={draft}
        form={form}
        notifyProgrammaticChange={onNotify}
      />
      <button type="button" onClick={() => onRead(form.getValues())}>
        Formularwerte lesen
      </button>
    </>
  );
}

describe("Building classification recovery", () => {
  it("repairs the derived type without dropping configured architecture", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    const onNotify = vi.fn();
    render(<BuildingTypeRecoveryHarness onRead={onRead} onNotify={onNotify} />);

    await user.click(
      screen.getByRole("button", {
        name: "Gebäudetyp aus Untertyp wiederherstellen",
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Gebäudetyp aus Untertyp wiederherstellen",
      }),
    ).not.toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "building",
        subtype: "gate",
        buildingType: "gate",
        buildingPrimaryMaterial: "stone",
      }),
    );
  });
});
