import type { TilesetAtlasLayout } from "./tileset.types";

export interface ResolveTilesetAtlasMetricsInput {
  readonly tileSizePixels: number;
  readonly tileCount: number;
  readonly layout?: TilesetAtlasLayout;
  readonly fixedColumns?: number;
  readonly gutterPixels?: number;
  readonly marginPixels?: number;
}

export interface TilesetAtlasMetrics {
  readonly tileSizePixels: number;
  readonly tileCount: number;
  readonly layout: TilesetAtlasLayout;
  readonly columns: number;
  readonly rows: number;
  readonly capacity: number;
  readonly unusedCells: number;
  readonly gutterPixels: number;
  readonly marginPixels: number;
  readonly atlasWidthPixels: number;
  readonly atlasHeightPixels: number;
}

export interface TilesetTechnicalSpecification {
  readonly metrics: TilesetAtlasMetrics;
  readonly lines: readonly [string, string, string, string, string];
}

function assertIntegerInRange(value: number, name: string, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be an integer between ${String(minimum)} and ${String(maximum)}.`,
    );
  }
}

function resolveColumns(
  tileCount: number,
  layout: TilesetAtlasLayout,
  fixedColumns: number | undefined,
): number {
  switch (layout) {
    case "automatic":
      return Math.ceil(Math.sqrt(tileCount));
    case "singleRow":
      return tileCount;
    case "singleColumn":
      return 1;
    case "fixedColumns":
      if (fixedColumns === undefined) {
        throw new RangeError("fixedColumns is required when the atlas layout is fixedColumns.");
      }
      assertIntegerInRange(fixedColumns, "fixedColumns", 1, 64);
      return fixedColumns;
  }
}

export function resolveTilesetAtlasMetrics(
  input: ResolveTilesetAtlasMetricsInput,
): TilesetAtlasMetrics {
  assertIntegerInRange(input.tileSizePixels, "tileSizePixels", 1, 8192);
  assertIntegerInRange(input.tileCount, "tileCount", 1, 256);

  const layout = input.layout ?? "automatic";
  const gutterPixels = input.gutterPixels ?? 0;
  const marginPixels = input.marginPixels ?? 0;
  assertIntegerInRange(gutterPixels, "gutterPixels", 0, 64);
  assertIntegerInRange(marginPixels, "marginPixels", 0, 64);

  if (layout !== "fixedColumns" && input.fixedColumns !== undefined) {
    throw new RangeError("fixedColumns is only valid when the atlas layout is fixedColumns.");
  }

  const columns = resolveColumns(input.tileCount, layout, input.fixedColumns);
  const rows = Math.ceil(input.tileCount / columns);
  const capacity = columns * rows;
  const atlasWidthPixels =
    columns * input.tileSizePixels + Math.max(0, columns - 1) * gutterPixels + marginPixels * 2;
  const atlasHeightPixels =
    rows * input.tileSizePixels + Math.max(0, rows - 1) * gutterPixels + marginPixels * 2;

  return Object.freeze({
    tileSizePixels: input.tileSizePixels,
    tileCount: input.tileCount,
    layout,
    columns,
    rows,
    capacity,
    unusedCells: capacity - input.tileCount,
    gutterPixels,
    marginPixels,
    atlasWidthPixels,
    atlasHeightPixels,
  });
}

export function createTilesetTechnicalSpecification(
  input: ResolveTilesetAtlasMetricsInput,
): TilesetTechnicalSpecification {
  const metrics = resolveTilesetAtlasMetrics(input);
  const lines = Object.freeze([
    `TILE GRID: ${String(metrics.tileSizePixels)} × ${String(metrics.tileSizePixels)} px`,
    `ATLAS GRID: ${String(metrics.columns)} × ${String(metrics.rows)} cells`,
    `ATLAS CANVAS: ${String(metrics.atlasWidthPixels)} × ${String(metrics.atlasHeightPixels)} px`,
    `SLOTS: ${String(metrics.tileCount)} occupied, ${String(metrics.unusedCells)} empty`,
    `SPACING: ${String(metrics.gutterPixels)} px gutter, ${String(metrics.marginPixels)} px margin`,
  ] as const);

  return Object.freeze({ metrics, lines });
}
