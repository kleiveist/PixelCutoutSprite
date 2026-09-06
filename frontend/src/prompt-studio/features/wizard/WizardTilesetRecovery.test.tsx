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

function TilesetTypeRecoveryHarness({
  onRead,
  onNotify,
}: Readonly<{
  onRead: (values: WizardCoreFormValues) => void;
  onNotify: () => void;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Konflikt-Autotile",
      category: "tileset",
      subtype: "autotile",
      tilesetType: "ground",
      tilesetSeamMode: "matchedEdges",
    },
  });
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_tileset_type_recovery",
    projectName: "Konflikt-Autotile",
    route: "wizard/category",
    currentStep: "category",
    validation: { errors: [], warnings: [] },
    savedAt: "2026-09-08T10:00:00.000Z",
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

describe("Tileset classification recovery", () => {
  it("repairs the derived type without dropping configured seam rules", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    const onNotify = vi.fn();
    render(<TilesetTypeRecoveryHarness onRead={onRead} onNotify={onNotify} />);

    await user.click(
      screen.getByRole("button", {
        name: "Tiletyp aus Untertyp wiederherstellen",
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Tiletyp aus Untertyp wiederherstellen",
      }),
    ).not.toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "tileset",
        subtype: "autotile",
        tilesetType: "autotile",
        tilesetSeamMode: "matchedEdges",
      }),
    );
  });
});
