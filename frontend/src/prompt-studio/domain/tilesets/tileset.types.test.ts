import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  TILESET_CORNER_SUBTYPES,
  TILESET_EDGE_SUBTYPES,
  TILESET_TRANSITION_SUBTYPES,
  TILESET_TYPE_BY_SUBTYPE,
  getDefaultTilesetType,
  tilesetSubtypeSupportsCorners,
  tilesetSubtypeSupportsEdges,
  tilesetSubtypeSupportsTransitions,
} from "./index";

describe("Tileset catalog", () => {
  it("maps every Tileset subtype to one stable Tile type", () => {
    expect(Object.keys(TILESET_TYPE_BY_SUBTYPE)).toEqual(ASSET_SUBTYPES.tileset);
    expect(ASSET_SUBTYPES.tileset.map((subtype) => getDefaultTilesetType(subtype))).toEqual([
      "ground",
      "wall",
      "roof",
      "transition",
      "corner",
      "edge",
      "autotile",
      "decal",
      "animated",
    ]);
    expect(Object.isFrozen(TILESET_TYPE_BY_SUBTYPE)).toBe(true);
  });

  it("keeps edge, corner, and transition applicability independent", () => {
    expect(TILESET_EDGE_SUBTYPES).toEqual(["transition", "corner", "edge", "autotile"]);
    expect(TILESET_CORNER_SUBTYPES).toEqual(["corner", "autotile"]);
    expect(TILESET_TRANSITION_SUBTYPES).toEqual(["transition", "autotile"]);

    expect(tilesetSubtypeSupportsEdges("edge")).toBe(true);
    expect(tilesetSubtypeSupportsCorners("edge")).toBe(false);
    expect(tilesetSubtypeSupportsTransitions("edge")).toBe(false);

    expect(tilesetSubtypeSupportsEdges("corner")).toBe(true);
    expect(tilesetSubtypeSupportsCorners("corner")).toBe(true);
    expect(tilesetSubtypeSupportsTransitions("corner")).toBe(false);

    expect(tilesetSubtypeSupportsEdges("autotile")).toBe(true);
    expect(tilesetSubtypeSupportsCorners("autotile")).toBe(true);
    expect(tilesetSubtypeSupportsTransitions("autotile")).toBe(true);

    expect(tilesetSubtypeSupportsEdges("groundTile")).toBe(false);
    expect(tilesetSubtypeSupportsCorners("groundTile")).toBe(false);
    expect(tilesetSubtypeSupportsTransitions("groundTile")).toBe(false);
  });
});
