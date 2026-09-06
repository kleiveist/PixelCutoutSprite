import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../test/PromptTestApp";
import {
  ProfileLibrarySchema,
  parseWizardDraft,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import {
  V2_STORAGE_KEYS,
  createV2StorageAdapter,
  parseExportBundleJson,
  type OutputWorkspaceAdapter,
} from "../../services";
import { MemoryNavigation } from "../../test/memoryNavigation";
import { MemoryStorage } from "../../test/memoryStorage";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import { createWizardDraftFromAssetProfile } from "../wizard";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

function createReviewDraft(library: ProfileLibrary, portable = false): SelectedWizardDraft {
  const assetProfile = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  if (!assetProfile) throw new Error("Expected the smith Asset fixture.");
  const baseProfile = library.baseProfiles.find(
    (profile) => profile.id === assetProfile.baseProfileId,
  );
  const categoryProfile = library.categoryProfiles.find(
    (profile) => profile.id === assetProfile.categoryProfileId,
  );
  const result = createWizardDraftFromAssetProfile({
    draftId: parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_output_workspace",
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    }).draftId,
    savedAt: PROFILE_FIXTURE_TIMESTAMP,
    assetProfile,
    ...(baseProfile ? { baseProfile } : {}),
    ...(categoryProfile ? { categoryProfile } : {}),
  });
  if (result.status !== "created") {
    throw new Error("Expected a resolvable review Draft.");
  }
  if (!("category" in result.draft)) {
    throw new Error("Expected a selected review Draft.");
  }
  if (!portable || !("sourceAssetProfileId" in result.draft)) {
    return result.draft;
  }
  const { sourceAssetProfileId: ignoredSource, ...portableDraft } = result.draft;
  void ignoredSource;
  const parsed = parseWizardDraft(portableDraft);
  if (!("category" in parsed)) {
    throw new Error("Expected a selected portable Draft.");
  }
  return parsed;
}

function createOutputAdapter() {
  const copyText = vi.fn(async (text: string) => {
    void text;
  });
  const downloadTextFile = vi.fn<OutputWorkspaceAdapter["downloadTextFile"]>();
  return {
    adapter: { copyText, downloadTextFile } satisfies OutputWorkspaceAdapter,
    copyText,
    downloadTextFile,
  };
}

function renderWorkspace(
  input: Readonly<{
    library?: ProfileLibrary;
    portableDraft?: boolean;
    outputAdapter?: OutputWorkspaceAdapter;
  }>,
) {
  const library = input.library ?? createProfileLibraryFixture();
  const draft = createReviewDraft(library, input.portableDraft);
  const memory = new MemoryStorage();
  const storageAdapter = createV2StorageAdapter(memory);
  expect(storageAdapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  expect(storageAdapter.writeDraft(draft)).toEqual({ status: "ok" });
  memory.mutations.splice(0);
  const navigation = new MemoryNavigation({ status: "valid", view: "output" });
  const output = createOutputAdapter();
  const rendered = render(
    <App
      navigationAdapter={navigation}
      storageAdapter={storageAdapter}
      outputAdapter={input.outputAdapter ?? output.adapter}
      createProfileId={() => "asset_review_created"}
      now={() => "2026-09-03T23:30:00.000Z"}
    />,
  );
  return { ...rendered, draft, library, memory, navigation, output, storageAdapter };
}

function renderCharacterHeightConflict() {
  const fixture = createProfileLibraryFixture();
  const draft = createReviewDraft(fixture);
  const library = ProfileLibrarySchema.parse({
    ...fixture,
    baseProfiles: fixture.baseProfiles.map((profile) =>
      profile.id === draft.baseProfileId
        ? {
            ...profile,
            locks: { ...profile.locks, characterHeight: true },
          }
        : profile,
    ),
  });
  const conflictDraft = parseWizardDraft({
    ...draft,
    overrides: { ...draft.overrides, characterHeight: 96 },
  });
  if (!("category" in conflictDraft)) {
    throw new Error("Expected a selected conflict Draft.");
  }
  const selectedConflictDraft: SelectedWizardDraft = conflictDraft;
  const memory = new MemoryStorage();
  const storageAdapter = createV2StorageAdapter(memory);
  expect(storageAdapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  expect(storageAdapter.writeDraft(selectedConflictDraft)).toEqual({
    status: "ok",
  });
  memory.mutations.splice(0);
  const navigation = new MemoryNavigation({ status: "valid", view: "output" });
  const rendered = render(
    <App
      navigationAdapter={navigation}
      storageAdapter={storageAdapter}
      outputAdapter={createOutputAdapter().adapter}
      createBaseProfileId={() => "base_converted_96"}
      now={() => "2026-09-03T23:45:00.000Z"}
    />,
  );
  return {
    ...rendered,
    conflictDraft: selectedConflictDraft,
    library,
    memory,
    navigation,
    storageAdapter,
  };
}

describe("ReviewOutputWorkspace", () => {
  it("restores the persisted Draft and exposes all four prompt outputs and packages", async () => {
    const user = userEvent.setup();
    renderWorkspace({});

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Prompt-Pakete produktionsbereit ausgeben.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Produktionszusammenfassung" })).toBeVisible();
    expect(screen.getByText("Dorfschmied mit Lederschürze")).toBeVisible();
    expect(screen.getByText("Charakter / Figur · NPC")).toBeVisible();
    expect(screen.queryByText("Compatibility Key")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Animationsprojekt vorbereiten" }),
    ).not.toBeInTheDocument();

    const tablist = screen.getByRole("tablist", {
      name: "Prompt-Ausgabeart",
    });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(4);
    expect(within(tablist).getByRole("tab", { name: "Kombinierte Ausgabe" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("HAUPTPROMPT");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("NEGATIVPROMPT");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("TECHNISCHE SPEZIFIKATION");

    for (const tabName of [
      "Hauptprompt",
      "Negativprompt",
      "Technische Spezifikation",
      "Kombinierte Ausgabe",
    ]) {
      await user.click(within(tablist).getByRole("tab", { name: tabName }));
      expect(screen.getByRole("tabpanel", { name: tabName })).toBeVisible();
      expect(screen.getByRole("tabpanel", { name: tabName }).textContent?.length).toBeGreaterThan(
        100,
      );
    }

    await user.selectOptions(screen.getByLabelText("Sprache"), "en");
    await user.selectOptions(screen.getByLabelText("Stilvariante"), "dark");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("MAIN PROMPT");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Dark grounded fantasy");
  });

  it("moves through output tabs with roving keyboard focus", async () => {
    const user = userEvent.setup();
    renderWorkspace({});
    const tablist = screen.getByRole("tablist", {
      name: "Prompt-Ausgabeart",
    });
    const combinedTab = within(tablist).getByRole("tab", {
      name: "Kombinierte Ausgabe",
    });

    combinedTab.focus();
    await user.keyboard("{ArrowRight}");

    const mainTab = within(tablist).getByRole("tab", { name: "Hauptprompt" });
    expect(mainTab).toHaveFocus();
    expect(mainTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Hauptprompt" })).toBeVisible();

    await user.keyboard("{End}");
    expect(combinedTab).toHaveFocus();
    expect(combinedTab).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(mainTab).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(combinedTab).toHaveFocus();
  });

  it("uses injected copy/download actions and persists a new reviewed profile", async () => {
    const user = userEvent.setup();
    const rendered = renderWorkspace({ portableDraft: true });
    const tablist = screen.getByRole("tablist", {
      name: "Prompt-Ausgabeart",
    });

    await user.click(within(tablist).getByRole("tab", { name: "Negativprompt" }));
    const expectedCopy = screen.getByRole("tabpanel").querySelector("pre")?.textContent;
    await user.click(screen.getByRole("button", { name: "Kopieren" }));

    await waitFor(() => expect(rendered.output.copyText).toHaveBeenCalledOnce());
    expect(rendered.output.copyText).toHaveBeenCalledWith(expectedCopy);
    expect(screen.getByRole("status")).toHaveTextContent("Negativprompt wurde kopiert.");

    await user.click(screen.getByRole("button", { name: "MD exportieren" }));
    expect(rendered.output.downloadTextFile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/-negative\.md$/),
        contents: expect.stringContaining("- "),
        mimeType: "text/markdown;charset=utf-8",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Profil speichern" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Assetprofil „Dorfschmied mit Lederschürze“ wurde gespeichert.",
    );
    const storedLibrary = rendered.storageAdapter.readProfileLibrary();
    expect(storedLibrary.status).toBe("valid");
    if (storedLibrary.status !== "valid") {
      throw new Error("Expected a persisted profile library.");
    }
    expect(
      storedLibrary.value.assetProfiles.find((profile) => profile.id === "asset_review_created"),
    ).toMatchObject({
      name: "Dorfschmied mit Lederschürze",
      category: "character",
      subtype: "npc",
    });
    expect(rendered.storageAdapter.readDraft()).toMatchObject({
      status: "valid",
      value: { sourceAssetProfileId: "asset_review_created" },
    });

    await user.click(screen.getByRole("button", { name: "JSON exportieren" }));
    const jsonFile = rendered.output.downloadTextFile.mock.calls.at(-1)?.[0];
    expect(jsonFile).toMatchObject({
      filename: "dorfschmied-mit-lederschurze-profile.json",
      mimeType: "application/json;charset=utf-8",
    });
    if (!jsonFile) throw new Error("Expected a JSON download.");
    const parsed = parseExportBundleJson(jsonFile.contents);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") throw new Error("Expected a valid bundle.");
    expect(parsed.bundle.assetProfiles).toHaveLength(1);
    expect(parsed.bundle.assetProfiles[0]?.id).toBe("asset_review_created");
    expect(parsed.bundle.baseProfiles).toHaveLength(1);
    expect(parsed.bundle.categoryProfiles).toHaveLength(1);
  });

  it("shows exactly four safe choices, emits no partial output, and cancels without a write", async () => {
    const user = userEvent.setup();
    const fixture = createProfileLibraryFixture();
    const draft = createReviewDraft(fixture);
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      baseProfiles: fixture.baseProfiles.map((profile) =>
        profile.id === draft.baseProfileId
          ? { ...profile, locks: { ...profile.locks, tileSize: true } }
          : profile,
      ),
    });
    const conflictDraft = parseWizardDraft({
      ...draft,
      overrides: { ...draft.overrides, tileSize: 48 },
    });
    const memory = new MemoryStorage();
    const storageAdapter = createV2StorageAdapter(memory);
    expect(storageAdapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
    expect(storageAdapter.writeDraft(conflictDraft)).toEqual({ status: "ok" });

    const navigation = new MemoryNavigation({
      status: "valid",
      view: "output",
    });
    render(
      <App
        navigationAdapter={navigation}
        storageAdapter={storageAdapter}
        outputAdapter={createOutputAdapter().adapter}
      />,
    );
    memory.mutations.splice(0);

    expect(
      screen.getByRole("heading", {
        name: "Technische Änderung kontrolliert konvertieren",
      }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Tilegröße ist im Basisprofil gesperrt");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profil speichern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kopieren" })).not.toBeInTheDocument();
    const choices = screen.getByRole("group", {
      name: "Konvertierungsoptionen",
    });
    expect(
      screen.getByRole("region", {
        name: "Technische Änderung kontrolliert konvertieren",
      }),
    ).not.toHaveTextContent("pf2-compat-v1");
    expect(within(choices).getAllByRole("button")).toHaveLength(4);
    for (const option of [
      "Abbrechen",
      "Basisprofil duplizieren",
      "Neues Basisprofil",
      "Kompatibles Profil wählen",
    ]) {
      expect(within(choices).getByRole("button", { name: option })).toBeVisible();
    }

    await user.click(within(choices).getByRole("button", { name: "Abbrechen" }));
    expect(navigation.pushedViews).toEqual(["dashboard"]);
    expect(memory.mutations).toEqual([]);
  });

  it("moves focus into every conversion mode and back to its trigger", async () => {
    const user = userEvent.setup();
    renderCharacterHeightConflict();

    const duplicateTrigger = screen.getByRole("button", {
      name: "Basisprofil duplizieren",
    });
    duplicateTrigger.focus();
    await user.keyboard("{Enter}");
    const duplicateName = screen.getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    await waitFor(() => expect(duplicateName).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Zurück zu den Optionen" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Basisprofil duplizieren" })).toHaveFocus(),
    );

    const newTrigger = screen.getByRole("button", {
      name: "Neues Basisprofil",
    });
    await user.click(newTrigger);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", {
          name: "Name der Produktionsfamilie",
        }),
      ).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Zurück zu den Optionen" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Neues Basisprofil" })).toHaveFocus(),
    );

    const existingTrigger = screen.getByRole("button", {
      name: "Kompatibles Profil wählen",
    });
    await user.click(existingTrigger);
    const existingHeading = screen.getByRole("heading", {
      name: "Kompatibles Basisprofil wählen",
    });
    await waitFor(() => expect(existingHeading).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Zurück zu den Optionen" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Kompatibles Profil wählen" })).toHaveFocus(),
    );
  });

  it("duplicates a locked 80 px family, previews 96 px, and persists an independent converted Draft", async () => {
    const user = userEvent.setup();
    const rendered = renderCharacterHeightConflict();
    const originalLibrary = JSON.stringify(rendered.library);

    await user.click(screen.getByRole("button", { name: "Basisprofil duplizieren" }));

    expect(
      screen.getByRole("heading", {
        name: /Weltfamilie 32 px \/ Figuren 80 px.*duplizieren/,
      }),
    ).toBeVisible();
    expect(screen.getByText("Neue technische Gruppe")).toBeVisible();
    expect(screen.getByText(/80 px → 96 px/)).toBeVisible();
    expect(screen.getByText(/alle bestehenden Kinder bleiben unverändert/)).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Duplikat anlegen und konvertieren",
      }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", {
        name: "Duplikat anlegen und konvertieren",
      }),
    );

    const summaryHeading = await screen.findByRole("heading", {
      name: "Produktionszusammenfassung",
    });
    expect(summaryHeading).toBeVisible();
    await waitFor(() => expect(summaryHeading).toHaveFocus());
    expect(screen.getByText("96 px")).toBeVisible();
    expect(screen.getByText(/Das Basisprofil wurde dupliziert und der Entwurf/)).toBeVisible();

    const storedLibrary = rendered.storageAdapter.readProfileLibrary();
    expect(storedLibrary.status).toBe("valid");
    if (storedLibrary.status !== "valid") {
      throw new Error("Expected a persisted converted library.");
    }
    expect(JSON.stringify(rendered.library)).toBe(originalLibrary);
    expect(storedLibrary.value.baseProfiles).toHaveLength(rendered.library.baseProfiles.length + 1);
    expect(
      storedLibrary.value.baseProfiles.find((profile) => profile.id === "base_converted_96"),
    ).toMatchObject({
      values: { characterHeight: 96 },
      locks: { characterHeight: true },
    });
    expect(
      storedLibrary.value.baseProfiles.find(
        (profile) => profile.id === rendered.conflictDraft.baseProfileId,
      )?.values.characterHeight,
    ).toBe(80);
    expect(
      storedLibrary.value.categoryProfiles.find((profile) => profile.id === "category_npc_80")
        ?.baseProfileId,
    ).toBe(rendered.conflictDraft.baseProfileId);
    expect(
      storedLibrary.value.assetProfiles.find((profile) => profile.id === "asset_smith_80")
        ?.baseProfileId,
    ).toBe(rendered.conflictDraft.baseProfileId);

    const storedDraft = rendered.storageAdapter.readDraft();
    expect(storedDraft).toMatchObject({
      status: "valid",
      value: {
        baseProfileId: "base_converted_96",
        answers: { role: "blacksmith", directionCount: 8 },
      },
    });
    if (storedDraft.status !== "valid") {
      throw new Error("Expected a persisted converted Draft.");
    }
    expect(storedDraft.value).not.toHaveProperty("categoryProfileId");
    expect(storedDraft.value).not.toHaveProperty("sourceAssetProfileId");
    expect(storedDraft.value).not.toHaveProperty("overrides");
    expect(rendered.memory.mutations.at(-1)).toEqual({
      operation: "set",
      key: V2_STORAGE_KEYS.draft,
    });
  });

  it("creates a new canonical family only after the named impact preview is confirmed", async () => {
    const user = userEvent.setup();
    const rendered = renderCharacterHeightConflict();

    await user.click(screen.getByRole("button", { name: "Neues Basisprofil" }));
    expect(screen.getByRole("heading", { name: "Kanonisches Basisprofil anlegen" })).toBeVisible();
    const name = screen.getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    await user.clear(name);
    expect(screen.getByText(/Bitte gib einen Namen mit höchstens 120 Zeichen ein/)).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Basisprofil anlegen und konvertieren",
      }),
    ).toBeDisabled();
    await user.type(name, "Eigenständige NPC-Familie 96 px");
    expect(screen.getByText(/80 px → 96 px/)).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Basisprofil anlegen und konvertieren",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Produktionszusammenfassung" }),
    ).toBeVisible();
    const storedLibrary = rendered.storageAdapter.readProfileLibrary();
    expect(storedLibrary.status).toBe("valid");
    if (storedLibrary.status !== "valid") {
      throw new Error("Expected a persisted profile library.");
    }
    expect(
      storedLibrary.value.baseProfiles.find((profile) => profile.id === "base_converted_96"),
    ).toMatchObject({
      name: "Eigenständige NPC-Familie 96 px",
      values: { characterHeight: 96 },
      locks: {},
    });
    expect(
      storedLibrary.value.baseProfiles.find(
        (profile) => profile.id === rendered.conflictDraft.baseProfileId,
      )?.values.characterHeight,
    ).toBe(80);
  });

  it("keeps a created standalone family visible but does not activate a Draft when its second write fails", async () => {
    const user = userEvent.setup();
    const rendered = renderCharacterHeightConflict();
    rendered.memory.failSetOnAttempt = {
      key: V2_STORAGE_KEYS.draft,
      attempt: 2,
    };

    await user.click(screen.getByRole("button", { name: "Basisprofil duplizieren" }));
    await user.click(
      screen.getByRole("button", {
        name: "Duplikat anlegen und konvertieren",
      }),
    );

    expect(
      await screen.findByText(
        /wurde angelegt, aber der konvertierte Entwurf konnte nicht gespeichert werden/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Technische Änderung kontrolliert konvertieren",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Produktionszusammenfassung" }),
    ).not.toBeInTheDocument();

    expect(rendered.storageAdapter.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: {
        baseProfiles: expect.arrayContaining([
          expect.objectContaining({ id: "base_converted_96" }),
        ]),
      },
    });
    expect(rendered.storageAdapter.readDraft()).toMatchObject({
      status: "valid",
      value: {
        baseProfileId: rendered.conflictDraft.baseProfileId,
        overrides: { characterHeight: 96 },
      },
    });
  });

  it("switches to an existing exact 96 px family without mutating the profile library", async () => {
    const user = userEvent.setup();
    const rendered = renderCharacterHeightConflict();
    const storedLibraryBefore = JSON.stringify(rendered.storageAdapter.readProfileLibrary());

    await user.click(screen.getByRole("button", { name: "Kompatibles Profil wählen" }));
    const target = screen.getByRole("radio", {
      name: /Weltfamilie 32 px \/ Figuren 96 px.*Exakte technische Übereinstimmung/,
    });
    await user.click(target);
    expect(screen.getByText("Neue technische Gruppe")).toBeVisible();
    expect(screen.getByText(/80 px → 96 px/)).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Mit gewähltem Profil konvertieren",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Produktionszusammenfassung" }),
    ).toBeVisible();
    expect(screen.getByText("Weltfamilie 32 px / Figuren 96 px")).toBeVisible();
    expect(JSON.stringify(rendered.storageAdapter.readProfileLibrary())).toBe(storedLibraryBefore);
    expect(rendered.storageAdapter.readDraft()).toMatchObject({
      status: "valid",
      value: { baseProfileId: "base_world_96" },
    });
    expect(
      rendered.memory.mutations.filter((mutation) => mutation.key === V2_STORAGE_KEYS.draft),
    ).toHaveLength(1);
  });

  it("reports a rejected injected clipboard operation without changing output", async () => {
    const user = userEvent.setup();
    const copyText = vi.fn(async () => {
      throw new Error("Clipboard denied");
    });
    renderWorkspace({
      outputAdapter: {
        copyText,
        downloadTextFile: vi.fn(),
      },
    });
    const content = screen.getByRole("tabpanel").textContent;

    await user.click(screen.getByRole("button", { name: "Kopieren" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "konnte nicht in die Zwischenablage kopiert werden",
    );
    expect(screen.getByRole("tabpanel").textContent).toBe(content);
  });
});
