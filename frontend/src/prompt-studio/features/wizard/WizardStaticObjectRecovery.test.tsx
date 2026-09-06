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

function ObjectClassRecoveryHarness({
  onRead,
  onNotify,
}: Readonly<{
  onRead: (values: WizardCoreFormValues) => void;
  onNotify: () => void;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Konflikttruhe",
      category: "staticObject",
      subtype: "chest",
      staticObjectClass: "furniture",
      staticObjectPrimaryMaterial: "wood",
    },
  });
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_static_class_recovery",
    projectName: "Konflikttruhe",
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

describe("static-object classification recovery", () => {
  it("repairs the derived class without dropping configured details", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    const onNotify = vi.fn();
    render(<ObjectClassRecoveryHarness onRead={onRead} onNotify={onNotify} />);

    await user.click(
      screen.getByRole("button", {
        name: "Objektklasse aus Untertyp wiederherstellen",
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Objektklasse aus Untertyp wiederherstellen",
      }),
    ).not.toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "staticObject",
        subtype: "chest",
        staticObjectClass: "container",
        staticObjectPrimaryMaterial: "wood",
      }),
    );
  });
});
