import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultAppSettings } from "../store/settings";
import { V2_STORAGE_KEYS } from "./storageAdapter";
import { initializePromptStudioRuntime } from "./promptWorkspaceStorage";

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  isTauri: native.isTauri,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: native.open,
  save: native.save,
}));

const EMPTY_SNAPSHOT = Object.freeze({
  settings: null,
  profiles: null,
  draft: null,
  migrationBackup: null,
});

const SETTINGS = createDefaultAppSettings("2026-09-06T12:00:00.000Z");

beforeEach(() => {
  window.localStorage.clear();
  native.invoke.mockReset();
  native.isTauri.mockReset();
  native.open.mockReset();
  native.save.mockReset();
  native.isTauri.mockReturnValue(true);
  native.invoke.mockImplementation(async (command: string) => {
    if (command === "read_prompt_workspace") return EMPTY_SNAPSHOT;
    return undefined;
  });
});

describe("native Prompt workspace runtime", () => {
  it("hydrates a validated synchronous mirror and flushes writes in order", async () => {
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "read_prompt_workspace") {
        return { ...EMPTY_SNAPSHOT, settings: SETTINGS };
      }
      return undefined;
    });
    const runtime = await initializePromptStudioRuntime();

    expect(runtime.storageAdapter.readSettings()).toEqual({
      status: "valid",
      value: SETTINGS,
    });
    expect(runtime.storageAdapter.writeSettings({ ...SETTINGS, theme: "dark" })).toEqual({
      status: "ok",
    });
    expect(runtime.storageAdapter.removeDraft()).toEqual({ status: "ok" });

    await runtime.flushStorage();

    expect(native.invoke.mock.calls.slice(1)).toEqual([
      [
        "write_prompt_workspace",
        {
          kind: "settings",
          value: { ...SETTINGS, theme: "dark" },
        },
      ],
      ["remove_prompt_draft"],
    ]);
  });

  it("does not queue invalid values and retains failed writes until a successful retry", async () => {
    let failWrites = true;
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "read_prompt_workspace") return EMPTY_SNAPSHOT;
      if (command === "write_prompt_workspace" && failWrites) throw new Error("disk full");
      return undefined;
    });
    const runtime = await initializePromptStudioRuntime();

    expect(runtime.storageAdapter.writeSettings({ kind: "wrong" }).status).toBe("invalid");
    expect(runtime.storageAdapter.writeSettings(SETTINGS)).toEqual({ status: "ok" });
    await expect(runtime.flushStorage()).rejects.toThrow("disk full");
    await expect(runtime.flushStorage()).rejects.toThrow("disk full");
    failWrites = false;
    await expect(runtime.flushStorage()).resolves.toBeUndefined();
    expect(
      native.invoke.mock.calls.filter(([command]) => command === "write_prompt_workspace"),
    ).toHaveLength(3);
  });

  it("migrates valid browser data only when the native workspace is empty", async () => {
    window.localStorage.setItem(V2_STORAGE_KEYS.settings, JSON.stringify(SETTINGS));

    const runtime = await initializePromptStudioRuntime();

    expect(runtime.migration.status).toBe("notNeeded");
    expect(native.invoke).toHaveBeenCalledWith("write_prompt_workspace", {
      kind: "settings",
      value: SETTINGS,
    });
    expect(runtime.storageAdapter.readSettings()).toEqual({
      status: "valid",
      value: SETTINGS,
    });
  });

  it("uses native dialogs and bounded Rust commands for JSON import and output", async () => {
    native.save.mockResolvedValue("/tmp/prompt.md");
    native.open.mockResolvedValue("/tmp/profiles.json");
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "read_prompt_workspace") return EMPTY_SNAPSHOT;
      if (command === "read_prompt_package") return '{"schemaVersion":2}';
      return undefined;
    });
    const runtime = await initializePromptStudioRuntime();

    await runtime.outputAdapter.downloadTextFile({
      filename: "prompt.md",
      contents: "# Prompt",
      mimeType: "text/markdown;charset=utf-8",
    });
    await expect(runtime.outputAdapter.selectJsonFile?.()).resolves.toEqual({
      filename: "profiles.json",
      contents: '{"schemaVersion":2}',
    });

    expect(native.invoke).toHaveBeenCalledWith("save_prompt_output", {
      path: "/tmp/prompt.md",
      contents: "# Prompt",
      format: "markdown",
    });
    expect(native.invoke).toHaveBeenCalledWith("read_prompt_package", {
      path: "/tmp/profiles.json",
    });
  });

  it("keeps LocalStorage as the browser-development adapter", async () => {
    native.isTauri.mockReturnValue(false);
    const runtime = await initializePromptStudioRuntime();

    expect(runtime.storageAdapter.writeSettings(SETTINGS)).toEqual({ status: "ok" });
    expect(window.localStorage.getItem(V2_STORAGE_KEYS.settings)).toBe(JSON.stringify(SETTINGS));
    expect(native.invoke).not.toHaveBeenCalled();
  });
});
