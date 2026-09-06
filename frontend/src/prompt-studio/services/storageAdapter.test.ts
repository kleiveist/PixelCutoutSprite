import { describe, expect, it } from "vitest";
import { parseAppSettings, parseWizardDraft } from "../schemas";
import { MemoryStorage } from "../test/memoryStorage";
import { V2_STORAGE_KEYS, createV2StorageAdapter } from "./index";

const timestamp = "2026-09-02T12:00:00.000Z";

describe("V2 storage adapter", () => {
  it("roundtrips settings and the active wizard draft through canonical namespaces", () => {
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    const settings = parseAppSettings({
      schemaVersion: 2,
      kind: "appSettings",
      theme: "system",
      locale: "de",
      startView: "dashboard",
      activeBaseProfileId: null,
      updatedAt: timestamp,
    });
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft-storage-001",
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: timestamp,
    });

    expect(adapter.writeSettings(settings)).toEqual({ status: "ok" });
    expect(adapter.writeDraft(draft)).toEqual({ status: "ok" });
    expect(adapter.readSettings()).toEqual({ status: "valid", value: settings });
    expect(adapter.readDraft()).toEqual({ status: "valid", value: draft });
    expect(storage.values.has("pixelforge:v2:workspace")).toBe(false);
    expect(storage.values.has(V2_STORAGE_KEYS.draft)).toBe(true);
  });

  it("returns empty or structured invalid results instead of throwing", () => {
    const storage = new MemoryStorage({
      [V2_STORAGE_KEYS.settings]: "{broken-json",
    });
    const adapter = createV2StorageAdapter(storage);

    expect(adapter.readDraft()).toEqual({ status: "empty" });
    expect(adapter.readSettings()).toMatchObject({
      status: "invalid",
      key: V2_STORAGE_KEYS.settings,
      reason: "invalidJson",
    });
    expect(storage.getItem(V2_STORAGE_KEYS.settings)).toBe("{broken-json");

    storage.values.set(
      V2_STORAGE_KEYS.settings,
      JSON.stringify({ schemaVersion: 1, kind: "appSettings" }),
    );
    expect(adapter.readSettings()).toMatchObject({
      status: "invalid",
      reason: "schemaValidation",
    });
  });

  it("isolates unavailable browser storage on reads and writes", () => {
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    storage.failGetFor = "*";
    expect(adapter.readSettings()).toMatchObject({ status: "unavailable" });

    storage.failGetFor = null;
    storage.failSetFor = "*";
    expect(
      adapter.writeSettings({
        schemaVersion: 2,
        kind: "appSettings",
        theme: "dark",
        locale: "de",
        startView: "dashboard",
        activeBaseProfileId: null,
        updatedAt: timestamp,
      }),
    ).toMatchObject({ status: "unavailable" });
    expect(createV2StorageAdapter(null).readSettings()).toMatchObject({
      status: "unavailable",
    });
  });
});
