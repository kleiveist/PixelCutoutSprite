import { describe, expect, it } from "vitest";
import * as navigation from "./navigation";
describe("P37 module navigation", () => {
  it("exports only the four current prompt destinations, no legacy Cutout route table", () => {
    expect(Object.keys(navigation)).toEqual(["promptNavigationItems"]);
    expect(navigation.promptNavigationItems.map((item) => item.id)).toEqual([
      "dashboard",
      "profiles",
      "wizard",
      "output",
    ]);
  });
});
