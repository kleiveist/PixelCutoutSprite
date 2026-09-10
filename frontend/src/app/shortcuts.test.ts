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
    expect(resolveShortcut(input(" "))).toBeNull();
  });

  it("does not trigger editor actions from text fields", () => {
    const field = document.createElement("input");
    expect(resolveShortcut(input("s", { ctrlKey: true, target: field }))).toBeNull();
    expect(resolveShortcut(input(" ", { target: field }))).toBeNull();
    expect(resolveShortcut(input("Escape", { target: field }))).toBe("dismiss");
  });

  it("leaves Space with native and ARIA controls but keeps command shortcuts available", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.append(icon);
    const link = document.createElement("a");
    link.href = "#target";
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    for (const target of [button, icon, link, slider]) {
      expect(resolveShortcut(input(" ", { target }))).toBeNull();
      expect(resolveShortcut(input("s", { ctrlKey: true, target }))).toBe("save");
    }
  });

  it("treats non-text inputs as controls rather than text editors", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(resolveShortcut(input("s", { ctrlKey: true, target: checkbox }))).toBe("save");
    expect(resolveShortcut(input(" ", { target: checkbox }))).toBeNull();
  });
});
