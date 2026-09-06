import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  STATIC_OBJECT_ANIMATION_TYPE_IDS,
  STATIC_OBJECT_BASIC_SHAPE_IDS,
  STATIC_OBJECT_CLASS_BY_SUBTYPE,
  STATIC_OBJECT_CLASS_IDS,
  STATIC_OBJECT_CONDITION_IDS,
  STATIC_OBJECT_INTERACTION_IDS,
  STATIC_OBJECT_MATERIAL_IDS,
  STATIC_OBJECT_PROPORTION_IDS,
  STATIC_OBJECT_PURPOSE_IDS,
  STATIC_OBJECT_SHADOW_MODE_IDS,
  STATIC_OBJECT_SYMMETRY_IDS,
  getDefaultStaticObjectClass,
} from "./index";

const expectedClasses = {
  furniture: "furniture",
  container: "container",
  barrel: "container",
  crate: "container",
  chest: "container",
  door: "door",
  well: "well",
  sign: "sign",
  pillar: "pillar",
  altar: "altar",
  decoration: "decoration",
  workTool: "workTool",
  interactiveObject: "interactiveObject",
} as const;

describe("static-object domain catalogs", () => {
  it("maps every static-object subtype to one deterministic object class", () => {
    expect(Object.keys(STATIC_OBJECT_CLASS_BY_SUBTYPE)).toEqual(ASSET_SUBTYPES.staticObject);
    expect(STATIC_OBJECT_CLASS_BY_SUBTYPE).toEqual(expectedClasses);

    for (const subtype of ASSET_SUBTYPES.staticObject) {
      expect(getDefaultStaticObjectClass(subtype)).toBe(expectedClasses[subtype]);
    }
  });

  it("publishes stable readonly catalogs for every static-object question", () => {
    expect(STATIC_OBJECT_CLASS_IDS).toEqual([
      "furniture",
      "container",
      "door",
      "well",
      "sign",
      "pillar",
      "altar",
      "decoration",
      "workTool",
      "interactiveObject",
    ]);
    expect(STATIC_OBJECT_PURPOSE_IDS).toEqual([
      "decorative",
      "interactive",
      "walkable",
      "blocking",
    ]);
    expect(STATIC_OBJECT_BASIC_SHAPE_IDS).toEqual([
      "boxy",
      "cylindrical",
      "round",
      "planar",
      "arched",
      "stepped",
      "organic",
      "irregular",
      "custom",
    ]);
    expect(STATIC_OBJECT_PROPORTION_IDS).toEqual([
      "compact",
      "balanced",
      "tall",
      "wide",
      "low",
      "slender",
      "massive",
    ]);
    expect(STATIC_OBJECT_SYMMETRY_IDS).toEqual(["bilateral", "radial", "asymmetric", "none"]);
    expect(STATIC_OBJECT_MATERIAL_IDS).toEqual([
      "wood",
      "stone",
      "metal",
      "ceramic",
      "glass",
      "fabric",
      "leather",
      "rope",
      "bone",
      "organic",
      "magic",
      "mixed",
      "custom",
    ]);
    expect(STATIC_OBJECT_CONDITION_IDS).toEqual([
      "clean",
      "used",
      "weathered",
      "damaged",
      "overgrown",
    ]);
    expect(STATIC_OBJECT_INTERACTION_IDS).toEqual(["none", "open", "tilt", "glow", "break"]);
    expect(STATIC_OBJECT_ANIMATION_TYPE_IDS).toEqual(["openClose", "glow", "break", "custom"]);
    expect(STATIC_OBJECT_SHADOW_MODE_IDS).toEqual(["none", "contact"]);

    const catalogs = [
      STATIC_OBJECT_CLASS_IDS,
      STATIC_OBJECT_PURPOSE_IDS,
      STATIC_OBJECT_BASIC_SHAPE_IDS,
      STATIC_OBJECT_PROPORTION_IDS,
      STATIC_OBJECT_SYMMETRY_IDS,
      STATIC_OBJECT_MATERIAL_IDS,
      STATIC_OBJECT_CONDITION_IDS,
      STATIC_OBJECT_INTERACTION_IDS,
      STATIC_OBJECT_ANIMATION_TYPE_IDS,
      STATIC_OBJECT_SHADOW_MODE_IDS,
      STATIC_OBJECT_CLASS_BY_SUBTYPE,
    ];
    expect(catalogs.every(Object.isFrozen)).toBe(true);
  });
});
