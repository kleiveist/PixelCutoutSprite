import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { parseWizardDraft } from "../../schemas";
import { createV2StorageAdapter } from "../../services";
import { MemoryStorage } from "../../test/memoryStorage";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { GuidedWizardEngine } from "./GuidedWizardEngine";
import { WIZARD_CORE_FLOW } from "./WizardCoreStepContent";
import { createWizardCoreFormValues } from "./wizardCategoryRouting";

const NOW = "2026-09-06T10:00:00.000Z";

describe("Nature Wizard recovery", () => {
  it("routes a derived plant-type mismatch to the focusable subtype repair", async () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles.find((candidate) => candidate.id === "base_world_80");
    if (base === undefined) throw new Error("Expected the world Base fixture.");
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_nature_recovery",
      projectName: "Konfliktbaum",
      route: "wizard/editor",
      currentStep: "natureDetails",
      baseProfileId: base.id,
      category: "nature",
      subtype: "tree",
      answers: { plantType: "tree", species: "Hüteeiche" },
      validation: { errors: [], warnings: [] },
      savedAt: NOW,
    });
    const baselineValues = createWizardCoreFormValues(draft, null, library);
    const initialValues = {
      ...baselineValues,
      naturePlantType: "mushroom" as const,
    };
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    const user = userEvent.setup();

    render(
      <GuidedWizardEngine
        baselineDraft={draft}
        baselineValues={baselineValues}
        context={{ categoryHint: null, library }}
        draft={draft}
        draftPersisted
        flow={WIZARD_CORE_FLOW}
        initialDirty
        initialStepId="natureDetails"
        initialValues={initialValues}
        now={() => NOW}
        onDraftEdited={vi.fn()}
        onDraftSaved={vi.fn()}
        storageAdapter={adapter}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Pflanze und Natur" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Bildart" })).toBeVisible(),
    );
    const subtype = screen.getByRole("combobox", { name: /Untertyp/ });
    expect(subtype).toHaveFocus();
    expect(screen.getByText(/Der abgeleitete Pflanzentyp passt nicht/)).toBeVisible();
    expect(storage.mutations).toEqual([]);

    await user.click(
      screen.getByRole("button", {
        name: "Pflanzentyp aus Untertyp wiederherstellen",
      }),
    );
    expect(subtype).toHaveFocus();
    expect(
      screen.queryByRole("button", {
        name: "Pflanzentyp aus Untertyp wiederherstellen",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Bitte korrigiere das markierte Pflichtfeld."),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/Der abgeleitete Pflanzentyp passt nicht/)).not.toBeInTheDocument(),
    );
    await waitFor(() => {
      const stored = adapter.readDraft();
      expect(stored.status).toBe("valid");
      if (stored.status !== "valid" || !("category" in stored.value)) {
        throw new Error("Expected the repaired Nature Draft to be stored.");
      }
      expect(stored.value.answers).toMatchObject({
        plantType: "tree",
        species: "Hüteeiche",
      });
    });
  });
});
