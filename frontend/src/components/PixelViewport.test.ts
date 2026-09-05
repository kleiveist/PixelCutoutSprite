import { describe, expect, it } from "vitest";

import { dprSafePixelScale, fittedPixelScale, snapToDevicePixel } from "./PixelViewport";

describe("pixel viewport geometry", () => {
  it("maps source pixels to whole physical pixels at fractional desktop DPI", () => {
    const scale = dprSafePixelScale(3, 1.25);
    expect(scale.deviceScale).toBe(4);
    expect(scale.cssScale * 1.25).toBe(4);
    expect(snapToDevicePixel(3.37, 1.25)).toBe(3.2);
  });

  it("fits without fractional physical-pixel scaling", () => {
    const scale = fittedPixelScale(128, 128, 400, 300, 1.25);
    expect(scale.deviceScale).toBe(2);
    expect(scale.cssScale).toBe(1.6);
  });
});
