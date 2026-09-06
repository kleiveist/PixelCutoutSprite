import { resolveCapabilities, type AssetSelection } from "../assets";
import type { BaseProfileValues } from "../../schemas";

const PIXEL_DENSITY_SLUGS = {
  classicHd: "classic-hd",
  modernHd: "modern-hd",
  ultraHd: "ultra-hd",
} satisfies Record<BaseProfileValues["pixelDensity"], string>;

const PERSPECTIVE_SLUGS = {
  topdown: "top-down",
  threeQuarter: "three-quarter",
  isometric: "isometric",
  side: "side",
} satisfies Record<BaseProfileValues["perspectiveType"], string>;

const PROJECTION_SLUGS = {
  orthographic: "orthographic",
  mildPerspective: "mild-perspective",
} satisfies Record<BaseProfileValues["projectionType"], string>;

const OUTLINE_SLUGS = {
  dark: "dark",
  softSelective: "soft-selective",
  minimal: "minimal",
} satisfies Record<BaseProfileValues["outlineStyle"], string>;

const CAMERA_DIRECTION_SLUGS = {
  southToNorth: "south-to-north",
  swToNe: "southwest-to-northeast",
  seToNw: "southeast-to-northwest",
} satisfies Record<BaseProfileValues["cameraDirection"], string>;

const PALETTE_SLUGS = {
  natural: "natural",
  vivid: "vivid",
  desaturated: "desaturated",
  byProfile: "by-profile",
} satisfies Record<BaseProfileValues["paletteMode"], string>;

const LIGHTING_POLICY_SLUGS = {
  adaptive: "adaptive",
  neutralDay: "neutral-day",
  warmInterior: "warm-interior",
  gloomyDiffuse: "gloomy-diffuse",
  neutralNight: "neutral-night",
  coolNight: "cool-night",
  custom: "custom",
} satisfies Record<BaseProfileValues["lightingDefaults"]["policy"], string>;

const FNV_64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const FNV_64_MASK = 0xffffffffffffffffn;

export function normalizeCompatibilityText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .split("\n")
    .map((line) => line.trim().replace(/[^\S\n]+/gu, " "))
    .join("\n")
    .trim();
}

// FNV-1a is a compact deterministic fingerprint, not a security boundary.
function hashCompatibilityText(value: string): string {
  let hash = FNV_64_OFFSET_BASIS;

  for (const byte of new TextEncoder().encode(normalizeCompatibilityText(value))) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_64_PRIME) & FNV_64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

/**
 * Builds the stable V2 production-family key from effective profile values.
 * Display metadata, stored keys, locks, answers, and irrelevant dimensions are
 * deliberately excluded.
 *
 * @throws {RangeError} when a scaled-character selection has no effective
 * character height. Callers resolving profile chains should use
 * `resolveProfile()`, which reports that condition as a structured conflict.
 */
export function createCompatibilityKey(
  values: Readonly<BaseProfileValues>,
  selection: AssetSelection,
): string {
  const capabilities = resolveCapabilities(selection.category, selection.subtype);
  const segments: string[] = ["pf2-compat-v1", PIXEL_DENSITY_SLUGS[values.pixelDensity]];

  if (!capabilities.freeComposition) {
    segments.push(`tile-${values.tileSize}`);
  }

  if (capabilities.scaledCharacter) {
    if (values.characterHeight === undefined) {
      throw new RangeError("A compatibility key for a scaled character requires characterHeight.");
    }
    segments.push(`char-${values.characterHeight}`);
  }

  if (!capabilities.freeComposition) {
    segments.push(
      `${PERSPECTIVE_SLUGS[values.perspectiveType]}-${values.cameraAngle}`,
      PROJECTION_SLUGS[values.projectionType],
    );
  }

  segments.push(`outline-${OUTLINE_SLUGS[values.outlineStyle]}`);

  if (!capabilities.freeComposition) {
    segments.push(`camera-${CAMERA_DIRECTION_SLUGS[values.cameraDirection]}`);
  }

  segments.push(
    `style-${values.styleProfile}`,
    `palette-${PALETTE_SLUGS[values.paletteMode]}`,
    `nearest-neighbor-${values.nearestNeighbor ? "on" : "off"}`,
  );

  if (capabilities.transparent) {
    segments.push(`background-${values.backgroundMode}`);
    if (values.backgroundMode === "transparent") {
      segments.push(`alpha-padding-${values.alphaPadding}`);
    }
  }

  const normalizedLightingNotes = normalizeCompatibilityText(values.lightingDefaults.notes);
  segments.push(
    `light-${LIGHTING_POLICY_SLUGS[values.lightingDefaults.policy]}`,
    `light-notes-${normalizedLightingNotes.length}-${hashCompatibilityText(normalizedLightingNotes)}`,
  );

  return segments.join("__");
}
