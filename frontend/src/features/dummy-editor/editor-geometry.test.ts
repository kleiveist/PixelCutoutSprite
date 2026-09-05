import { describe, expect, it } from "vitest";

import { movePoseSelection, slotMatrix, type EditorSlot } from "./editor-geometry";
import { neutralTransform } from "./editor-state";

const slots: EditorSlot[] = [
  { id: "parent", label: "Parent", parentId: null, x: 0, y: 0, width: 4, height: 4, color: "red" },
  {
    id: "child",
    label: "Child",
    parentId: "parent",
    x: 4,
    y: 0,
    width: 2,
    height: 2,
    color: "blue",
  },
];

describe("editor hierarchy geometry", () => {
  it("moves a selected parent and child only once in screen space", () => {
    const start = { parent: neutralTransform(), child: neutralTransform() };
    const moved = movePoseSelection(start, new Set(["parent", "child"]), slots, [0, 0], 5, 0, true);
    expect(moved.parent.offsetX).toBe(5);
    expect(moved.child.offsetX).toBe(0);
    expect(slotMatrix(slots[1], slots, moved, [0, 0])[4]).toBe(9);
  });

  it("converts a screen drag through the inverse rotated parent basis", () => {
    const start = {
      parent: { ...neutralTransform(), rotation: 90 },
      child: neutralTransform(),
    };
    const moved = movePoseSelection(start, new Set(["child"]), slots, [0, 0], 0, 3, false);
    expect(moved.child.offsetX).toBeCloseTo(3);
    expect(moved.child.offsetY).toBeCloseTo(0);
  });
});
