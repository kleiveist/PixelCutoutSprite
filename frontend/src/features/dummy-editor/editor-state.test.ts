import { describe, expect, it } from "vitest";

import {
  commitPose,
  createHistory,
  moveSelection,
  neutralTransform,
  redo,
  snapAngle,
  transformSelection,
  undo,
} from "./editor-state";

describe("editor command state", () => {
  it("records a complete drag as one undoable command", () => {
    const start = { hand_l: neutralTransform() };
    const previewOne = moveSelection(start, new Set(["hand_l"]), 1.2, 0, true);
    const previewTwo = moveSelection(start, new Set(["hand_l"]), 4.7, 2.2, true);
    expect(previewOne.hand_l.offsetX).toBe(1);
    const committed = commitPose(createHistory(start), previewTwo, "Move hand");
    expect(committed.past).toHaveLength(1);
    expect(committed.present.hand_l.offsetX).toBe(5);
    expect(undo(committed).present).toEqual(start);
    expect(redo(undo(committed)).present).toEqual(previewTwo);
  });

  it("keeps locked parts fixed and supports visibility and angle snapping", () => {
    const pose = { hand_l: { ...neutralTransform(), locked: true } };
    expect(moveSelection(pose, new Set(["hand_l"]), 9, 9, true)).toEqual(pose);
    expect(transformSelection(pose, new Set(["hand_l"]), { visible: false }).hand_l.visible).toBe(
      true,
    );
    expect(transformSelection(pose, new Set(["hand_l"]), { locked: false }).hand_l.locked).toBe(
      false,
    );
    expect(snapAngle(22, true)).toBe(15);
    expect(snapAngle(22, false)).toBe(22);
  });
});
