import type { AssetSubtypeByCategory } from "../assets";

export const ARTWORK_TYPE_IDS = Object.freeze([
  "characterConcept",
  "environmentConcept",
  "buildingConcept",
  "materialStudy",
  "scene",
  "promoArtwork",
  "moodPainting",
] as const);

export const ARTWORK_PURPOSE_IDS = Object.freeze([
  "concept",
  "presentation",
  "productionReference",
] as const);

export const ARTWORK_MOTIF_IDS = Object.freeze([
  "figure",
  "object",
  "environment",
  "scene",
] as const);

export const ARTWORK_COMPOSITION_IDS = Object.freeze(["singleSubject", "group", "scene"] as const);

export const ARTWORK_FORMAT_IDS = Object.freeze([
  "square",
  "portrait",
  "landscape",
  "free",
] as const);

export const ARTWORK_BACKGROUND_IDS = Object.freeze(["transparent", "simple", "complete"] as const);

export const ARTWORK_FOCUS_IDS = Object.freeze([
  "form",
  "material",
  "mood",
  "story",
  "scale",
] as const);

export const ARTWORK_LIGHTING_DRAMA_IDS = Object.freeze([
  "neutral",
  "warm",
  "gloomy",
  "night",
  "custom",
] as const);

export const ARTWORK_DETAIL_LEVEL_IDS = Object.freeze([
  "overview",
  "productionConcept",
  "showcase",
] as const);

export type ArtworkSubtype = AssetSubtypeByCategory["artwork"];
export type ArtworkType = (typeof ARTWORK_TYPE_IDS)[number];
export type ArtworkPurpose = (typeof ARTWORK_PURPOSE_IDS)[number];
export type ArtworkMotif = (typeof ARTWORK_MOTIF_IDS)[number];
export type ArtworkComposition = (typeof ARTWORK_COMPOSITION_IDS)[number];
export type ArtworkFormat = (typeof ARTWORK_FORMAT_IDS)[number];
export type ArtworkBackground = (typeof ARTWORK_BACKGROUND_IDS)[number];
export type ArtworkFocus = (typeof ARTWORK_FOCUS_IDS)[number];
export type ArtworkLightingDrama = (typeof ARTWORK_LIGHTING_DRAMA_IDS)[number];
export type ArtworkDetailLevel = (typeof ARTWORK_DETAIL_LEVEL_IDS)[number];

export const ARTWORK_TYPE_BY_SUBTYPE = Object.freeze({
  characterConcept: "characterConcept",
  environmentConcept: "environmentConcept",
  buildingConcept: "buildingConcept",
  materialStudy: "materialStudy",
  scene: "scene",
  promoArtwork: "promoArtwork",
  moodPainting: "moodPainting",
} as const satisfies Readonly<Record<ArtworkSubtype, ArtworkType>>);

export function getDefaultArtworkType(subtype: ArtworkSubtype): ArtworkType {
  return ARTWORK_TYPE_BY_SUBTYPE[subtype];
}
