import { describe, expect, it, vi } from "vitest";

import {
  classifyNativeError,
  guardEditorNavigation,
  type EditorController,
  type EditorControllerState,
} from "./editor-controller";

function controller(state: EditorControllerState): EditorController {
  return {
    id: "test-editor",
    label: "test draft",
    getState: () => state,
    save: vi.fn(async () => undefined),
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

const clean: EditorControllerState = {
  saveState: "saved",
  status: "Saved locally",
  dirty: false,
  mutationInFlight: false,
  writable: true,
  canUndo: false,
  canRedo: false,
};

describe("editor navigation guard", () => {
  it("never asks to unmount an editor while a native mutation is in flight", () => {
    const confirm = vi.fn(() => true);
    const result = guardEditorNavigation(
      controller({ ...clean, saveState: "saving", dirty: true, mutationInFlight: true }),
      confirm,
    );

    expect(result).toMatchObject({ allowed: false, reason: "mutation_in_flight" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("distinguishes discardable dirty state from an in-flight operation", () => {
    const confirm = vi.fn(() => false);
    const blocked = guardEditorNavigation(
      controller({ ...clean, saveState: "dirty", dirty: true, canUndo: true }),
      confirm,
    );
    expect(blocked).toMatchObject({ allowed: false, reason: "discard_cancelled" });
    expect(confirm).toHaveBeenCalledWith("Discard the unsaved test draft changes?");

    expect(guardEditorNavigation(controller(clean), confirm)).toMatchObject({ allowed: true });
  });
});

describe("native error classification", () => {
  it("classifies string and structured optimistic-write conflicts", () => {
    expect(classifyNativeError("document changed since it was loaded").kind).toBe("conflict");
    expect(
      classifyNativeError({ code: "write_conflict", message: "revision 2 is current" }),
    ).toEqual({
      code: "write_conflict",
      kind: "conflict",
      message: "revision 2 is current",
    });
  });

  it("separates recovery, migration, and read-only failures", () => {
    expect(classifyNativeError("transaction needs explicit recovery").kind).toBe(
      "recovery_required",
    );
    expect(classifyNativeError({ code: "migration_required", message: "upgrade first" }).kind).toBe(
      "migration_required",
    );
    expect(classifyNativeError("vault is read-only").kind).toBe("read_only");
  });
});
