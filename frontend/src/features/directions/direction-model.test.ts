import { describe, expect, it } from "vitest";

import { DIRECTION_ORDER, horizontalMirror, withDirectionMode } from "./direction-model";

describe("direction model", () => {
  it("restores every direction after two horizontal mirror operations", () => {
    for (const direction of DIRECTION_ORDER) {
      expect(horizontalMirror(horizontalMirror(direction))).toBe(direction);
    }
  });

  it("refuses to turn front or back into horizontal mirror derivations", () => {
    expect(() => withDirectionMode([], "n", "mirrored")).toThrow(/cannot be derived/);
    expect(() => withDirectionMode([], "s", "mirrored")).toThrow(/cannot be derived/);
  });

  it("keeps horizontal pairs acyclic when the source was itself derived", () => {
    const westDerived = withDirectionMode([], "w", "mirrored");
    const eastDerived = withDirectionMode(westDerived, "e", "mirrored");
    expect(eastDerived.find((definition) => definition.direction === "w")).toEqual({
      direction: "w",
      mode: "explicit",
      source: null,
    });
    expect(eastDerived.find((definition) => definition.direction === "e")?.source).toBe("w");
  });
});
