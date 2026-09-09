import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { StableIdSchema } from "../../schemas";
import { createBlankWizardDraft } from "./wizardLifecycle";
import { WizardEngine } from "./WizardEngine";

const timestamp = "2026-09-09T12:00:00.000Z";

function renderCatalog() {
  const fixture = createProfileLibraryFixture();
  const library = {
    baseProfiles: fixture.baseProfiles.slice(0, 1),
    categoryProfiles: [],
    assetProfiles: [],
  };
  const draft = createBlankWizardDraft({
    draftId: StableIdSchema.parse("draft_catalog_ui"),
    savedAt: timestamp,
  });
  const writeDraft = vi.fn(() => ({ status: "ok" as const }));
  const onDraftEdited = vi.fn();
  const onDraftSaved = vi.fn();
  render(
    <WizardEngine
      baselineDraft={draft}
      categoryHint="character"
      draft={draft}
      draftPersisted={false}
      library={library}
      now={() => timestamp}
      onDraftEdited={onDraftEdited}
      onDraftSaved={onDraftSaved}
      onOpenBaseProfile={() => undefined}
      storageAdapter={{ writeDraft }}
    />,
  );
  return { onDraftSaved, writeDraft };
}

describe("P34 catalog UI flow", () => {
  it("mounts one question page, keeps name and base context visible, and preserves back navigation", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const name = screen.getByRole("textbox", { name: /Name des Assets.*Projektname/i });
    await user.type(name, "Waldhüterin");
    await user.selectOptions(screen.getByRole("combobox", { name: /Untertyp/i }), "npc");

    const progress = screen.getByRole("navigation", { name: "Wizard-Fortschritt" });
    expect(within(progress).queryByText("Basisprofil")).not.toBeInTheDocument();
    expect(screen.getByText("Schreibgeschützter Basiskontext")).toBeVisible();
    expect(screen.getAllByText("Weltfamilie 32 px / Figuren 80 px")[0]).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Identität und Varianten" }),
    ).toBeVisible();
    expect(screen.getByRole("group", { name: "Identität und Varianten" })).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Körper, Gesicht und Ausdruck" }),
    ).not.toBeInTheDocument();
    expect(name).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Rolle / Beruf" }), "__custom__");
    const partialRole = screen.getByRole("textbox", { name: "Eigene Eingabe für Rolle / Beruf" });
    await user.type(partialRole, "unfertige Waldrolle");
    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Asset und Bildart" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("textbox", { name: "Eigene Eingabe für Rolle / Beruf" })).toHaveValue(
      "unfertige Waldrolle",
    );
    expect(name).toHaveValue("Waldhüterin");
  });

  it("records the completed stable step IDs during forward navigation", async () => {
    const user = userEvent.setup();
    const { writeDraft } = renderCatalog();
    await user.type(
      screen.getByRole("textbox", { name: /Name des Assets.*Projektname/i }),
      "Katalogfigur",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: /Untertyp/i }), "hero");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    await waitFor(() =>
      expect(writeDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({
          currentStep: "catalog/character/identity",
          catalogVersion: "v3.0",
          completedStepIds: ["identity"],
        }),
      ),
    );
  });
});
