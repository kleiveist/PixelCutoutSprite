import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  ITEM_CLASS_BY_SUBTYPE,
  getDefaultItemClass,
  itemSubtypeSupportsWearPosition,
} from "./item.types";

describe("item domain", () => {
  it("maps every item subtype to one stable item class", () => {
    expect(Object.keys(ITEM_CLASS_BY_SUBTYPE)).toEqual([...ASSET_SUBTYPES.item]);
    expect(getDefaultItemClass("armorPiece")).toBe("armor");
    expect(getDefaultItemClass("questItem")).toBe("questItem");
  });

  it("limits wear positions to explicitly wearable item subtypes", () => {
    expect(itemSubtypeSupportsWearPosition("clothing")).toBe(true);
    expect(itemSubtypeSupportsWearPosition("tool")).toBe(true);
    expect(itemSubtypeSupportsWearPosition("weapon")).toBe(false);
    expect(itemSubtypeSupportsWearPosition("consumable")).toBe(false);
  });
});
