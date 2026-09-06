import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  TEXTURE_CONDITION_IDS,
  TEXTURE_ICING_IDS,
  TEXTURE_LIGHTING_IDS,
  TEXTURE_MATERIAL_TYPE_BY_SUBTYPE,
  TEXTURE_MATERIAL_TYPE_IDS,
  TEXTURE_MOISTURE_IDS,
  TEXTURE_ORIENTATION_IDS,
  TEXTURE_STRUCTURE_IDS,
  TEXTURE_SURFACE_IDS,
  TEXTURE_USAGE_IDS,
  getDefaultTextureMaterialType,
} from "./index";

describe("texture domain catalogs", () => {
  it("covers every texture subtype with one deterministic material type", () => {
    expect(TEXTURE_MATERIAL_TYPE_IDS).toBe(ASSET_SUBTYPES.texture);
    expect(Object.keys(TEXTURE_MATERIAL_TYPE_BY_SUBTYPE)).toEqual(ASSET_SUBTYPES.texture);

    for (const subtype of ASSET_SUBTYPES.texture) {
      expect(getDefaultTextureMaterialType(subtype)).toBe(subtype);
    }
  });

  it("publishes stable readonly catalogs for each focused editor question", () => {
    expect(TEXTURE_USAGE_IDS).toEqual(["floor", "wall", "roof", "surface", "clothing", "decor"]);
    expect(TEXTURE_ORIENTATION_IDS).toEqual([
      "horizontal",
      "vertical",
      "radial",
      "unordered",
      "grainAligned",
    ]);
    expect(TEXTURE_STRUCTURE_IDS).toEqual(["fine", "medium", "coarse"]);
    expect(TEXTURE_CONDITION_IDS).toContain("frosted");
    expect(TEXTURE_SURFACE_IDS).toContain("woven");
    expect(TEXTURE_MOISTURE_IDS).toEqual(["dry", "damp", "wet"]);
    expect(TEXTURE_ICING_IDS).toEqual(["none", "lightFrost", "frosted", "iceCrusted"]);
    expect(TEXTURE_LIGHTING_IDS).toEqual(["neutralEven", "contextual", "worldAligned"]);

    expect(Object.isFrozen(TEXTURE_MATERIAL_TYPE_BY_SUBTYPE)).toBe(true);
    expect(Object.isFrozen(TEXTURE_USAGE_IDS)).toBe(true);
    expect(Object.isFrozen(TEXTURE_SURFACE_IDS)).toBe(true);
  });
});
