import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../test/PromptTestApp";
import {
  ProfileLibrarySchema,
  parseAppSettings,
  parseWizardDraft,
  type ProfileLibrary,
} from "../../schemas";
import {
  V2_STORAGE_KEYS,
  createProfileExportBundle,
  createV2StorageAdapter,
  parseExportBundleJson,
  serializeExportBundle,
  type LegacyV1StorageMigrationResult,
  type OutputWorkspaceAdapter,
} from "../../services";
import { MemoryNavigation } from "../../test/memoryNavigation";
import { MemoryStorage } from "../../test/memoryStorage";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";

const now = "2026-09-03T13:00:00.000Z";

function createOutputAdapter() {
  const downloadTextFile = vi.fn<OutputWorkspaceAdapter["downloadTextFile"]>();
  return {
    adapter: {
      copyText: vi.fn(async () => undefined),
      downloadTextFile,
    } satisfies OutputWorkspaceAdapter,
    downloadTextFile,
  };
}

function settings(library: ProfileLibrary, theme: "light" | "dark" | "system" = "light") {
  return parseAppSettings({
    schemaVersion: 2,
    kind: "appSettings",
    theme,
    locale: "de",
    startView: "dashboard",
    activeBaseProfileId: library.baseProfiles[0]?.id ?? null,
    updatedAt: now,
  });
}

function draft(draftId = "draft_workspace", savedAt = now) {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId,
    projectName: "Workspace import",
    route: "wizard/project",
    currentStep: "project",
    validation: { errors: [], warnings: [] },
    savedAt,
  });
}

function bundleJson(
  library: ProfileLibrary,
  options: Readonly<{
    theme?: "light" | "dark" | "system";
    drafts?: ReturnType<typeof draft>[];
  }> = {},
): string {
  return serializeExportBundle(
    createProfileExportBundle({
      library,
      bundleId: "bundle_workspace_test",
      exportedAt: now,
      appSettings: settings(library, options.theme ?? "dark"),
      wizardDrafts: options.drafts ?? [draft()],
    }),
  );
}

function renderSettings(
  storage: MemoryStorage,
  startupMigration: LegacyV1StorageMigrationResult = { status: "notNeeded" },
) {
  const output = createOutputAdapter();
  const adapter = createV2StorageAdapter(storage);
  const rendered = render(
    <App
      navigationAdapter={new MemoryNavigation({ status: "valid", view: "settings" })}
      outputAdapter={output.adapter}
      startupMigration={startupMigration}
      storageAdapter={adapter}
      now={() => now}
    />,
  );
  return { ...rendered, adapter, output, storage };
}

function populatedStorage(library = createProfileLibraryFixture()) {
  const storage = new MemoryStorage();
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  expect(adapter.writeSettings(settings(library))).toEqual({ status: "ok" });
  expect(adapter.writeDraft(draft())).toEqual({ status: "ok" });
  storage.mutations.splice(0);
  return storage;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settings workspace transfer", () => {
  it("persists the embedded prompt theme without changing the outer document", async () => {
    const user = userEvent.setup();
    const library = createProfileLibraryFixture();
    const rendered = renderSettings(populatedStorage(library));

    await user.click(screen.getByRole("radio", { name: "Dunkel" }));

    expect(rendered.adapter.readSettings()).toMatchObject({
      status: "valid",
      value: {
        schemaVersion: 2,
        theme: "dark",
        updatedAt: now,
      },
    });
    expect(screen.getByRole("radio", { name: "Dunkel" })).toBeChecked();
    expect(screen.getByRole("region", { name: "PixelPromptStudio Generator" })).toHaveAttribute(
      "data-theme",
      "dark",
    );
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(screen.getByText("Darstellung gespeichert.")).toBeVisible();
    expect(rendered.storage.mutations).toEqual([
      { operation: "set", key: V2_STORAGE_KEYS.settings },
    ]);
  });

  it("keeps a prompt theme for the session when persistence fails", async () => {
    const user = userEvent.setup();
    const library = createProfileLibraryFixture();
    const storage = populatedStorage(library);
    storage.failSetFor = V2_STORAGE_KEYS.settings;
    const rendered = renderSettings(storage);

    await user.click(screen.getByRole("radio", { name: "Dunkel" }));

    expect(screen.getByRole("radio", { name: "Dunkel" })).toBeChecked();
    expect(
      screen.getByText(
        "Lokales Speichern ist nicht verfügbar. Änderungen gelten für diese Sitzung.",
      ),
    ).toBeVisible();
    expect(rendered.adapter.readSettings()).toMatchObject({
      status: "valid",
      value: { theme: "light" },
    });
  });

  it("exports profiles, settings, and the local draft as one validated JSON file", async () => {
    const user = userEvent.setup();
    const library = createProfileLibraryFixture();
    const rendered = renderSettings(populatedStorage(library));

    await user.click(screen.getByRole("button", { name: "Workspace als JSON exportieren" }));

    expect(rendered.output.downloadTextFile).toHaveBeenCalledTimes(1);
    const file = rendered.output.downloadTextFile.mock.calls[0]?.[0];
    expect(file).toMatchObject({
      filename: "pixelforge-workspace-2026-09-03.json",
      mimeType: "application/json;charset=utf-8",
    });
    const parsed = parseExportBundleJson(file?.contents ?? "");
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") throw new Error("Expected valid export.");
    expect(parsed.bundle.baseProfiles).toEqual(library.baseProfiles);
    expect(parsed.bundle.assetProfiles).toEqual(library.assetProfiles);
    expect(parsed.bundle.appSettings).toMatchObject({
      theme: "light",
      startView: "dashboard",
    });
    expect(parsed.bundle.wizardDrafts).toEqual([draft()]);
    expect(screen.getByText(/workspace mit 11 profil/i)).toBeVisible();
    expect(rendered.storage.mutations).toEqual([]);
  });

  it("validates and restores an imported workspace through the real providers", async () => {
    const user = userEvent.setup();
    const incoming = createProfileLibraryFixture();
    const older = draft("draft_older", "2026-09-03T11:00:00.000Z");
    const latest = draft("draft_latest", "2026-09-03T12:00:00.000Z");
    const rendered = renderSettings(new MemoryStorage(), {
      status: "migrated",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 1 },
      warnings: [],
      issues: [],
    });
    const file = new File([bundleJson(incoming, { drafts: [older, latest] })], "workspace.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("PixelForge-V2-JSON auswählen"), file);

    expect(await screen.findByText("Importdatei vollständig validiert")).toBeVisible();
    expect(screen.getByText(/v1-daten wurden automatisch migriert/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Geprüften Workspace importieren" }));

    expect(rendered.adapter.readProfileLibrary()).toEqual({
      status: "valid",
      value: incoming,
    });
    expect(rendered.adapter.readSettings()).toMatchObject({
      status: "valid",
      value: { theme: "dark" },
    });
    expect(rendered.adapter.readDraft()).toEqual({
      status: "valid",
      value: latest,
    });
    expect(screen.getByRole("region", { name: "PixelPromptStudio Generator" })).toHaveAttribute(
      "data-theme",
      "dark",
    );
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(screen.getByText(/11 profil\(e\) importiert/i)).toBeVisible();
    expect(screen.getByText("11", { selector: "dd" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Wizard" }));
    expect(await screen.findByDisplayValue("Workspace import")).toBeVisible();
  });

  it("imports profiles without applying optional settings or draft data", async () => {
    const user = userEvent.setup();
    const incoming = createProfileLibraryFixture();
    const rendered = renderSettings(new MemoryStorage());
    const file = new File([bundleJson(incoming)], "profiles-only.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("PixelForge-V2-JSON auswählen"), file);
    await user.click(
      await screen.findByRole("checkbox", {
        name: "App-Einstellungen übernehmen",
      }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Neuesten Entwurf übernehmen" }));
    await user.click(screen.getByRole("button", { name: "Geprüften Workspace importieren" }));

    expect(rendered.adapter.readProfileLibrary()).toEqual({
      status: "valid",
      value: incoming,
    });
    expect(rendered.adapter.readSettings()).toEqual({ status: "empty" });
    expect(rendered.adapter.readDraft()).toEqual({ status: "empty" });
  });

  it("requires explicit replacement when imported profile IDs conflict", async () => {
    const user = userEvent.setup();
    const existing = createProfileLibraryFixture();
    const changed = ProfileLibrarySchema.parse({
      ...existing,
      assetProfiles: existing.assetProfiles.map((profile, index) =>
        index === 0 ? { ...profile, name: "Imported replacement" } : profile,
      ),
    });
    const rendered = renderSettings(populatedStorage(existing));
    const file = new File([bundleJson(changed)], "conflict.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("PixelForge-V2-JSON auswählen"), file);

    expect(await screen.findByText("1 ID-Konflikt(e) gefunden")).toBeVisible();
    expect(rendered.storage.mutations).toEqual([]);
    expect(
      screen.queryByRole("button", { name: "Geprüften Workspace importieren" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Konflikte ersetzen und importieren",
      }),
    );

    const stored = rendered.adapter.readProfileLibrary();
    expect(stored.status).toBe("valid");
    if (stored.status !== "valid") throw new Error("Expected valid library.");
    expect(stored.value.assetProfiles[0]?.name).toBe("Imported replacement");
    expect(screen.getByText(/1 profil\(e\) importiert/i)).toBeVisible();
  });

  it("rejects malformed JSON without mutating local data", async () => {
    const user = userEvent.setup();
    const storage = populatedStorage();
    const rendered = renderSettings(storage);
    const file = new File(["{broken"], "broken.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("PixelForge-V2-JSON auswählen"), file);

    expect(await screen.findByText("Importdatei ist ungültig")).toBeVisible();
    expect(screen.queryByRole("button", { name: /importieren/i })).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
    expect(rendered.adapter.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: { assetProfiles: expect.any(Array) },
    });
  });

  it("fails closed when a corrupt local draft would make a backup incomplete", async () => {
    const user = userEvent.setup();
    const storage = populatedStorage();
    storage.values.set(V2_STORAGE_KEYS.draft, "{invalid");
    storage.mutations.splice(0);
    const rendered = renderSettings(storage);

    await user.click(screen.getByRole("button", { name: "Workspace als JSON exportieren" }));

    expect(rendered.output.downloadTextFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/lokale entwurf ungültig/i);
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe("{invalid");
    expect(storage.mutations).toEqual([]);
  });

  it("documents a completed startup migration with preserved counts", () => {
    renderSettings(new MemoryStorage(), {
      status: "alreadyMigrated",
      counts: { baseProfiles: 2, categoryProfiles: 3, assetProfiles: 4 },
      warnings: ["A legacy value was normalized."],
    });

    expect(screen.getByText(/migration ist bereits abgeschlossen/i)).toBeVisible();
    expect(screen.getByText(/2 basis-, 3 kategorie- und 4 assetprofil/i)).toBeVisible();
    expect(screen.getByText(/1 hinweis/i)).toBeVisible();
  });
});
