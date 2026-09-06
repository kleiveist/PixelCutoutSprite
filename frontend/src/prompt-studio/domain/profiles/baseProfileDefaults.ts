import type { BaseProfileLocks, BaseProfileValues } from "../../schemas";

/** Canonical V2 starting point for a newly created production family. */
export const DEFAULT_BASE_PROFILE_VALUES: Readonly<BaseProfileValues> = Object.freeze({
  pixelDensity: "modernHd",
  styleProfile: "both",
  tileSize: 32,
  characterHeight: 80,
  perspectiveType: "threeQuarter",
  cameraAngle: 60,
  cameraDirection: "southToNorth",
  projectionType: "orthographic",
  outlineStyle: "softSelective",
  paletteMode: "byProfile",
  backgroundMode: "transparent",
  alphaPadding: 8,
  nearestNeighbor: true,
  lightingDefaults: Object.freeze({
    policy: "adaptive",
    notes:
      "Use neutral controlled light for isolated assets and adapt day, night, interior, and gloomy scenes consistently.",
  }),
} satisfies BaseProfileValues);

export const DEFAULT_BASE_PROFILE_LOCKS: Readonly<BaseProfileLocks> = Object.freeze({});

export function createDefaultBaseProfileValues(): BaseProfileValues {
  return {
    ...DEFAULT_BASE_PROFILE_VALUES,
    lightingDefaults: { ...DEFAULT_BASE_PROFILE_VALUES.lightingDefaults },
  };
}

export function createDefaultBaseProfileLocks(): BaseProfileLocks {
  return { ...DEFAULT_BASE_PROFILE_LOCKS };
}
