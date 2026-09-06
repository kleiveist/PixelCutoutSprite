import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import { ARTWORK_TYPE_BY_SUBTYPE, ARTWORK_TYPE_IDS, getDefaultArtworkType } from ".";

describe("Artwork domain catalogs", () => {
  it("maps every Artwork subtype to one stable Artwork type", () => {
    expect(Object.keys(ARTWORK_TYPE_BY_SUBTYPE)).toEqual([...ASSET_SUBTYPES.artwork]);
    expect(Object.values(ARTWORK_TYPE_BY_SUBTYPE)).toEqual([...ARTWORK_TYPE_IDS]);

    for (const subtype of ASSET_SUBTYPES.artwork) {
      expect(getDefaultArtworkType(subtype)).toBe(ARTWORK_TYPE_BY_SUBTYPE[subtype]);
    }
  });

  it("keeps exported catalogs immutable", () => {
    expect(Object.isFrozen(ARTWORK_TYPE_IDS)).toBe(true);
    expect(Object.isFrozen(ARTWORK_TYPE_BY_SUBTYPE)).toBe(true);
  });
});
