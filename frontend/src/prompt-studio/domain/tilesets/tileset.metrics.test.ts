import { describe, expect, it } from "vitest";
import { createTilesetTechnicalSpecification, resolveTilesetAtlasMetrics } from "./index";

describe("Tileset atlas metrics", () => {
  it("creates a balanced automatic atlas on the inherited Tile grid", () => {
    expect(resolveTilesetAtlasMetrics({ tileSizePixels: 32, tileCount: 10 })).toEqual({
      tileSizePixels: 32,
      tileCount: 10,
      layout: "automatic",
      columns: 4,
      rows: 3,
      capacity: 12,
      unusedCells: 2,
      gutterPixels: 0,
      marginPixels: 0,
      atlasWidthPixels: 128,
      atlasHeightPixels: 96,
    });
  });

  it.each([
    ["singleRow", 8, undefined, 8, 1],
    ["singleColumn", 8, undefined, 1, 8],
    ["fixedColumns", 10, 3, 3, 4],
  ] as const)(
    "resolves %s layout deterministically",
    (layout, tileCount, fixedColumns, columns, rows) => {
      const metrics = resolveTilesetAtlasMetrics({
        tileSizePixels: 16,
        tileCount,
        layout,
        ...(fixedColumns === undefined ? {} : { fixedColumns }),
      });

      expect(metrics).toMatchObject({ layout, columns, rows });
      expect(Object.isFrozen(metrics)).toBe(true);
    },
  );

  it("includes gutter and outer margin in exact Canvas dimensions", () => {
    expect(
      resolveTilesetAtlasMetrics({
        tileSizePixels: 32,
        tileCount: 10,
        layout: "fixedColumns",
        fixedColumns: 4,
        gutterPixels: 2,
        marginPixels: 4,
      }),
    ).toMatchObject({
      columns: 4,
      rows: 3,
      atlasWidthPixels: 142,
      atlasHeightPixels: 108,
      capacity: 12,
      unusedCells: 2,
    });
  });

  it("builds a deterministic technical specification from the metrics", () => {
    const specification = createTilesetTechnicalSpecification({
      tileSizePixels: 32,
      tileCount: 10,
      layout: "fixedColumns",
      fixedColumns: 4,
      gutterPixels: 2,
      marginPixels: 4,
    });

    expect(specification.lines).toEqual([
      "TILE GRID: 32 × 32 px",
      "ATLAS GRID: 4 × 3 cells",
      "ATLAS CANVAS: 142 × 108 px",
      "SLOTS: 10 occupied, 2 empty",
      "SPACING: 2 px gutter, 4 px margin",
    ]);
    expect(Object.isFrozen(specification)).toBe(true);
    expect(Object.isFrozen(specification.lines)).toBe(true);
  });

  it.each([
    [{ tileSizePixels: 0, tileCount: 1 }, "tileSizePixels"],
    [{ tileSizePixels: 32, tileCount: 0 }, "tileCount"],
    [
      {
        tileSizePixels: 32,
        tileCount: 4,
        layout: "fixedColumns" as const,
      },
      "fixedColumns",
    ],
    [
      {
        tileSizePixels: 32,
        tileCount: 4,
        layout: "automatic" as const,
        fixedColumns: 2,
      },
      "only valid",
    ],
    [{ tileSizePixels: 32, tileCount: 4, gutterPixels: 65 }, "gutterPixels"],
  ] as const)("rejects invalid metric input containing %s", (input, message) => {
    expect(() => resolveTilesetAtlasMetrics(input)).toThrow(message);
  });
});
