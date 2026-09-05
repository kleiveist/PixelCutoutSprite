import { describe, expect, it } from "vitest";

import { resolveShortcut, type KeyboardInput } from "./shortcuts";

function input(key: string, overrides: Partial<KeyboardInput> = {}): KeyboardInput {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    ...overrides,
  };
}

describe("editor shortcuts", () => {
  it("maps platform command combinations and playback", () => {
    expect(resolveShortcut(input("s", { ctrlKey: true }))).toBe("save");
    expect(resolveShortcut(input("z", { metaKey: true }))).toBe("undo");
    expect(resolveShortcut(input("z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveShortcut(input(" "))).toBe("toggle-playback");
  });

  it("does not trigger editor actions from text fields", () => {
    const field = document.createElement("input");
    expect(resolveShortcut(input("s", { ctrlKey: true, target: field }))).toBeNull();
    expect(resolveShortcut(input(" ", { target: field }))).toBeNull();
    expect(resolveShortcut(input("Escape", { target: field }))).toBe("dismiss");
  });
});
