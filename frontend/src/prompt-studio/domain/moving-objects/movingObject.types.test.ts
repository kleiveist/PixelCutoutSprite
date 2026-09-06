import { describe, expect, it } from "vitest";
import {
  DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES,
  MOVING_OBJECT_ANCHOR_MODE_IDS,
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  MOVING_OBJECT_CLASS_BY_SUBTYPE,
  MOVING_OBJECT_CLASS_IDS,
  MOVING_OBJECT_CONDITION_IDS,
  MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS,
  MOVING_OBJECT_MATERIAL_IDS,
  MOVING_OBJECT_MECHANISM_IDS,
  MOVING_OBJECT_MOVEMENT_TYPE_IDS,
  MOVING_OBJECT_SHADOW_MODE_IDS,
  getDefaultMovingObjectClass,
} from "./index";

describe("moving-object taxonomy", () => {
  it("publishes immutable canonical value catalogs", () => {
    const catalogs = [
      MOVING_OBJECT_CLASS_IDS,
      MOVING_OBJECT_MOVEMENT_TYPE_IDS,
      MOVING_OBJECT_ANIMATION_TYPE_IDS,
      MOVING_OBJECT_ANCHOR_MODE_IDS,
      MOVING_OBJECT_MECHANISM_IDS,
      MOVING_OBJECT_MATERIAL_IDS,
      MOVING_OBJECT_CONDITION_IDS,
      MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS,
      MOVING_OBJECT_SHADOW_MODE_IDS,
    ];

    expect(catalogs.every(Object.isFrozen)).toBe(true);
    expect(MOVING_OBJECT_MOVEMENT_TYPE_IDS).toEqual([
      "roll",
      "slide",
      "hover",
      "walk",
      "crawl",
      "fly",
      "rotate",
    ]);
    expect(MOVING_OBJECT_ANIMATION_TYPE_IDS).toEqual([
      "idle",
      "move",
      "rotate",
      "interact",
      "openClose",
      "pulse",
    ]);
  });

  it("provides bounded animation defaults for deliberate sequence activation", () => {
    expect(
      MOVING_OBJECT_ANIMATION_TYPE_IDS.every((type) => {
        const frames = DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES[type];
        return frames >= 1 && frames <= 16;
      }),
    ).toBe(true);
    expect(Object.isFrozen(DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES)).toBe(true);
  });

  it("maps every moving-object subtype to a stable default object class", () => {
    expect(Object.isFrozen(MOVING_OBJECT_CLASS_BY_SUBTYPE)).toBe(true);
    expect(getDefaultMovingObjectClass("cart")).toBe("cart");
    expect(getDefaultMovingObjectClass("floatingCrystal")).toBe("floatingObject");
    expect(getDefaultMovingObjectClass("nonHumanoidUnit")).toBe("nonHumanoidUnit");
  });
});
