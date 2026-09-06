import type { AssetSubtypeByCategory } from "../assets";

export const CHARACTER_GENDER_PRESENTATION_IDS = Object.freeze([
  "feminine",
  "masculine",
  "androgynous",
  "neutral",
] as const);

export const CHARACTER_AGE_IDS = Object.freeze(["young", "adult", "older", "veryOld"] as const);

export const CHARACTER_RELATIVE_HEIGHT_IDS = Object.freeze(["short", "average", "tall"] as const);

export const CHARACTER_BODY_BUILD_IDS = Object.freeze([
  "slim",
  "average",
  "sturdy",
  "broad",
] as const);

export const CHARACTER_POSTURE_IDS = Object.freeze([
  "upright",
  "relaxed",
  "hunched",
  "dynamic",
] as const);

export const CHARACTER_EYE_VISIBILITY_IDS = Object.freeze(["clear", "subtle", "obscured"] as const);

export const CHARACTER_HEADWEAR_CONDITION_IDS = Object.freeze([
  "clean",
  "used",
  "weathered",
  "damaged",
] as const);

export const CHARACTER_CONDITION_IDS = Object.freeze([
  "clean",
  "used",
  "weathered",
  "damaged",
] as const);

export const CHARACTER_EXPRESSION_IDS = Object.freeze([
  "neutral",
  "friendly",
  "serious",
  "tired",
  "mysterious",
] as const);

export const CHARACTER_PALETTE_SOURCE_IDS = Object.freeze(["profile", "local"] as const);

export const CHARACTER_WEALTH_IDS = Object.freeze([
  "poor",
  "modest",
  "comfortable",
  "wealthy",
] as const);

export const CHARACTER_ANIMATION_ACTION_IDS = Object.freeze([
  "idle",
  "walk",
  "run",
  "attack",
  "use",
  "talk",
  "interact",
  "hurt",
  "special",
] as const);

export type CharacterSubtype = AssetSubtypeByCategory["character"];
export type CharacterGenderPresentation = (typeof CHARACTER_GENDER_PRESENTATION_IDS)[number];
export type CharacterAge = (typeof CHARACTER_AGE_IDS)[number];
export type CharacterRelativeHeight = (typeof CHARACTER_RELATIVE_HEIGHT_IDS)[number];
export type CharacterBodyBuild = (typeof CHARACTER_BODY_BUILD_IDS)[number];
export type CharacterPosture = (typeof CHARACTER_POSTURE_IDS)[number];
export type CharacterEyeVisibility = (typeof CHARACTER_EYE_VISIBILITY_IDS)[number];
export type CharacterHeadwearCondition = (typeof CHARACTER_HEADWEAR_CONDITION_IDS)[number];
export type CharacterCondition = (typeof CHARACTER_CONDITION_IDS)[number];
export type CharacterExpression = (typeof CHARACTER_EXPRESSION_IDS)[number];
export type CharacterPaletteSource = (typeof CHARACTER_PALETTE_SOURCE_IDS)[number];
export type CharacterWealth = (typeof CHARACTER_WEALTH_IDS)[number];
export type CharacterAnimationActionId = (typeof CHARACTER_ANIMATION_ACTION_IDS)[number];

export const DEFAULT_CHARACTER_ANIMATION_FRAMES = Object.freeze({
  idle: 1,
  walk: 5,
  run: 4,
  attack: 4,
  use: 4,
  talk: 4,
  interact: 4,
  hurt: 4,
  special: 4,
} as const satisfies Readonly<Record<CharacterAnimationActionId, number>>);

export const NPC_CONTEXT_CHARACTER_SUBTYPES = Object.freeze([
  "npc",
  "merchant",
  "villager",
  "artisan",
  "guard",
  "scholar",
  "religiousFigure",
] as const satisfies readonly CharacterSubtype[]);

export const NON_HUMANOID_CHARACTER_SUBTYPES = Object.freeze([
  "animal",
  "creature",
] as const satisfies readonly CharacterSubtype[]);

export function isNpcContextSubtype(
  subtype: CharacterSubtype,
): subtype is (typeof NPC_CONTEXT_CHARACTER_SUBTYPES)[number] {
  const npcSubtypes: readonly CharacterSubtype[] = NPC_CONTEXT_CHARACTER_SUBTYPES;
  return npcSubtypes.includes(subtype);
}

export function isHumanoidCharacterSubtype(subtype: CharacterSubtype): boolean {
  const nonHumanoidSubtypes: readonly CharacterSubtype[] = NON_HUMANOID_CHARACTER_SUBTYPES;
  return !nonHumanoidSubtypes.includes(subtype);
}
