import { describe, expect, it } from "vitest";
import { BaseProfileLocksSchema, BaseProfileValuesSchema } from "../../schemas";
import {
  DEFAULT_BASE_PROFILE_VALUES,
  createDefaultBaseProfileLocks,
  createDefaultBaseProfileValues,
} from "./baseProfileDefaults";

describe("base profile defaults", () => {
  it("exposes the documented V2 production baseline through fresh mutable copies", () => {
    const first = createDefaultBaseProfileValues();
    const second = createDefaultBaseProfileValues();

    expect(BaseProfileValuesSchema.parse(first)).toMatchObject({
      pixelDensity: "modernHd",
      tileSize: 32,
      characterHeight: 80,
      perspectiveType: "threeQuarter",
      cameraAngle: 60,
      projectionType: "orthographic",
      outlineStyle: "softSelective",
      backgroundMode: "transparent",
      lightingDefaults: { policy: "adaptive" },
    });
    expect(first).not.toBe(DEFAULT_BASE_PROFILE_VALUES);
    expect(first.lightingDefaults).not.toBe(DEFAULT_BASE_PROFILE_VALUES.lightingDefaults);
    expect(second.lightingDefaults).not.toBe(first.lightingDefaults);
    expect(BaseProfileLocksSchema.parse(createDefaultBaseProfileLocks())).toEqual({});
  });
});
