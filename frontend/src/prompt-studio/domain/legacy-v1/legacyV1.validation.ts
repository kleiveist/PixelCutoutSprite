import { LEGACY_CHARACTER_ASSET_TYPES, LEGACY_OUTPUT_MODE_DIRECTIONS } from "./legacyV1.defaults";
import { resolveLegacyV1FrameSize, resolveLegacyV1Layout } from "./legacyV1.metrics";
import { mergeLegacyV1State } from "./legacyV1.state";
import type { LegacyV1StateInput, LegacyValidationResult } from "./legacyV1.types";

export function validateLegacyV1State(input: LegacyV1StateInput = {}): LegacyValidationResult {
  const state = mergeLegacyV1State(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  const frame = resolveLegacyV1FrameSize(state);
  const layout = resolveLegacyV1Layout(state);
  const directionCount = LEGACY_OUTPUT_MODE_DIRECTIONS[state.outputMode] ?? 1;
  const capacity = layout.columns * layout.rows;
  const characterHeight = Number(state.characterHeight) || 0;
  const padding = Number(state.alphaPadding) || 0;

  if (!String(state.subjectDescription || "").trim()) {
    errors.push("Die Motivbeschreibung ist leer.");
  }
  if ((Number(state.tileSize) || 0) < 8) {
    errors.push("Die Tile-Größe muss mindestens 8 Pixel betragen.");
  }
  if (LEGACY_CHARACTER_ASSET_TYPES.has(state.assetType) && characterHeight < 16) {
    errors.push("Die Figurenhöhe muss mindestens 16 Pixel betragen.");
  }
  if (LEGACY_CHARACTER_ASSET_TYPES.has(state.assetType) && characterHeight + padding * 2 > frame) {
    warnings.push(
      `Die Figur (${characterHeight}px) plus Sicherheitsrand passt möglicherweise nicht in einen ${frame}px-Frame.`,
    );
  }
  if (capacity < directionCount) {
    errors.push(
      `Das gewählte Sheet-Layout bietet nur ${capacity} Frames, benötigt werden ${directionCount}.`,
    );
  }
  if (state.perspectiveType === "threeQuarter" && state.cameraDirection !== "southToNorth") {
    warnings.push("Die diagonale Kameraausrichtung weicht vom festgelegten frontalen Standard ab.");
  }
  if (state.perspectiveType === "threeQuarter" && !state.noIsometricAxes) {
    warnings.push(
      "Isometrische Achsen sind nicht ausgeschlossen; dadurch kann der Bildwinkel instabil werden.",
    );
  }
  if (
    state.outputMode === "directional8" &&
    state.sheetLayout !== "4x2" &&
    state.sheetLayout !== "8x1" &&
    state.sheetLayout !== "2x4" &&
    state.sheetLayout !== "auto"
  ) {
    warnings.push("Für acht Richtungen ist 4×2, 8×1 oder 2×4 technisch eindeutiger.");
  }

  return { errors, warnings, valid: errors.length === 0 };
}
