import { LEGACY_CHARACTER_ASSET_TYPES, LEGACY_OUTPUT_MODE_DIRECTIONS } from "./legacyV1.defaults";
import { mergeLegacyV1State } from "./legacyV1.state";
import type {
  LegacyFrameLayout,
  LegacyResolvedMetrics,
  LegacyV1State,
  LegacyV1StateInput,
} from "./legacyV1.types";

export function resolveLegacyV1FrameSize(state: LegacyV1State): number {
  if (state.frameSize !== "auto") {
    const parsed = Number.parseInt(state.frameSize, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if (LEGACY_CHARACTER_ASSET_TYPES.has(state.assetType)) return 128;
  if (["weapon", "armor", "consumable", "questItem", "plant"].includes(state.assetType)) return 96;
  if (["building", "ruin"].includes(state.assetType)) return 256;
  if (state.assetType === "groundTile") return Number(state.tileSize) || 32;
  return 128;
}

export function resolveLegacyV1Layout(state: LegacyV1State): LegacyFrameLayout {
  if (state.sheetLayout !== "auto") {
    const [columns, rows] = state.sheetLayout.split("x").map((value) => Number.parseInt(value, 10));
    if (
      columns !== undefined &&
      rows !== undefined &&
      Number.isFinite(columns) &&
      Number.isFinite(rows)
    ) {
      return { columns, rows };
    }
  }

  if (state.outputMode === "directional8") return { columns: 4, rows: 2 };
  if (state.outputMode === "directional4") return { columns: 4, rows: 1 };
  return { columns: 1, rows: 1 };
}

export function getLegacyV1ResolvedMetrics(input: LegacyV1StateInput = {}): LegacyResolvedMetrics {
  const state = mergeLegacyV1State(input);
  const frame = resolveLegacyV1FrameSize(state);
  const layout = resolveLegacyV1Layout(state);
  return {
    frame,
    columns: layout.columns,
    rows: layout.rows,
    canvasWidth: frame * layout.columns,
    canvasHeight: frame * layout.rows,
    directionCount: LEGACY_OUTPUT_MODE_DIRECTIONS[state.outputMode] ?? 1,
  };
}
