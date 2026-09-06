import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import { WizardSessionProvider, useWizardSession } from "./index";

const draft = parseWizardDraft({
  schemaVersion: 2,
  kind: "wizardDraft",
  draftId: "draft_provider_001",
  projectName: "Provider-Test",
  route: "wizard/project",
  currentStep: "project",
  validation: { errors: [], warnings: [] },
  savedAt: "2026-09-02T12:00:00.000Z",
});

const editedDraft = parseWizardDraft({
  ...draft,
  projectName: "Provider-Test geändert",
  savedAt: "2026-09-02T12:05:00.000Z",
});

const invalidProjectName = "x".repeat(121);

function SessionConsumer() {
  const {
    activateDraft,
    activeDraft,
    baselineDraft,
    captureRawCoreFormValues,
    draftDirty,
    draftPersisted,
    rawCoreFormValues,
    requestNewAsset,
    sessionRevision,
    startIntent,
  } = useWizardSession();

  return (
    <>
      <button type="button" onClick={() => activateDraft(draft, "hydrate-transient")}>
        Flüchtigen Entwurf aktivieren
      </button>
      <button type="button" onClick={() => activateDraft(draft, "hydrate-persisted")}>
        Gespeicherten Entwurf aktivieren
      </button>
      <button type="button" onClick={() => activateDraft(editedDraft, "edit")}>
        Entwurf ändern
      </button>
      <button type="button" onClick={() => activateDraft(editedDraft, "saved")}>
        Entwurf speichern
      </button>
      <button
        type="button"
        onClick={() => captureRawCoreFormValues({ projectName: invalidProjectName })}
      >
        Ungültigen Rohwert erfassen
      </button>
      <button type="button" onClick={() => requestNewAsset("texture")}>
        Textur starten
      </button>
      <output data-testid="session-state">
        {JSON.stringify({
          activeProject: activeDraft?.projectName ?? null,
          baselineProject: baselineDraft?.projectName ?? null,
          rawProject: rawCoreFormValues?.projectName ?? null,
          draftDirty,
          draftPersisted,
          sessionRevision,
          startIntent,
        })}
      </output>
    </>
  );
}

function RemountHarness() {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setMounted((value) => !value)}>
        Wizard umschalten
      </button>
      {mounted ? <SessionConsumer /> : null}
    </>
  );
}

function expectSessionState(expected: Readonly<Record<string, unknown>>) {
  expect(screen.getByTestId("session-state")).toHaveTextContent(JSON.stringify(expected));
}

describe("WizardSessionProvider", () => {
  it("preserves an unsaved dirty draft while the Wizard consumer remounts", async () => {
    const user = userEvent.setup();
    render(
      <WizardSessionProvider>
        <RemountHarness />
      </WizardSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Flüchtigen Entwurf aktivieren" }));
    expectSessionState({
      activeProject: "Provider-Test",
      baselineProject: "Provider-Test",
      rawProject: null,
      draftDirty: false,
      draftPersisted: false,
      sessionRevision: 0,
      startIntent: null,
    });

    await user.click(screen.getByRole("button", { name: "Entwurf ändern" }));
    expectSessionState({
      activeProject: "Provider-Test geändert",
      baselineProject: "Provider-Test",
      rawProject: null,
      draftDirty: true,
      draftPersisted: false,
      sessionRevision: 0,
      startIntent: null,
    });

    const remountButton = screen.getByRole("button", { name: "Wizard umschalten" });
    await user.click(remountButton);
    expect(screen.queryByTestId("session-state")).not.toBeInTheDocument();
    await user.click(remountButton);

    expectSessionState({
      activeProject: "Provider-Test geändert",
      baselineProject: "Provider-Test",
      rawProject: null,
      draftDirty: true,
      draftPersisted: false,
      sessionRevision: 0,
      startIntent: null,
    });

    await user.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    expectSessionState({
      activeProject: "Provider-Test geändert",
      baselineProject: "Provider-Test geändert",
      rawProject: null,
      draftDirty: false,
      draftPersisted: true,
      sessionRevision: 0,
      startIntent: null,
    });
  });

  it("keeps a persisted baseline through edits and resets both drafts on every start", async () => {
    const user = userEvent.setup();
    render(
      <WizardSessionProvider>
        <SessionConsumer />
      </WizardSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Gespeicherten Entwurf aktivieren" }));
    await user.click(screen.getByRole("button", { name: "Entwurf ändern" }));
    expectSessionState({
      activeProject: "Provider-Test geändert",
      baselineProject: "Provider-Test",
      rawProject: null,
      draftDirty: true,
      draftPersisted: true,
      sessionRevision: 0,
      startIntent: null,
    });

    const startButton = screen.getByRole("button", { name: "Textur starten" });
    await user.click(startButton);
    await user.click(startButton);
    expectSessionState({
      activeProject: null,
      baselineProject: null,
      rawProject: null,
      draftDirty: false,
      draftPersisted: false,
      sessionRevision: 2,
      startIntent: { kind: "newAsset", category: "texture" },
    });
  });

  it("preserves invalid raw form values across a consumer remount and clears them on activation", async () => {
    const user = userEvent.setup();
    render(
      <WizardSessionProvider>
        <RemountHarness />
      </WizardSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Gespeicherten Entwurf aktivieren" }));
    await user.click(screen.getByRole("button", { name: "Ungültigen Rohwert erfassen" }));
    expectSessionState({
      activeProject: "Provider-Test",
      baselineProject: "Provider-Test",
      rawProject: invalidProjectName,
      draftDirty: true,
      draftPersisted: true,
      sessionRevision: 0,
      startIntent: null,
    });

    const remountButton = screen.getByRole("button", { name: "Wizard umschalten" });
    await user.click(remountButton);
    await user.click(remountButton);

    expectSessionState({
      activeProject: "Provider-Test",
      baselineProject: "Provider-Test",
      rawProject: invalidProjectName,
      draftDirty: true,
      draftPersisted: true,
      sessionRevision: 0,
      startIntent: null,
    });

    await user.click(screen.getByRole("button", { name: "Entwurf ändern" }));
    expectSessionState({
      activeProject: "Provider-Test geändert",
      baselineProject: "Provider-Test",
      rawProject: null,
      draftDirty: true,
      draftPersisted: true,
      sessionRevision: 0,
      startIntent: null,
    });
  });
});
