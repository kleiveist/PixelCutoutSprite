import type { AssetSubtypeByCategory } from "../assets";

export const MOVING_OBJECT_CLASS_IDS = Object.freeze([
  "cart",
  "rollingObject",
  "floatingObject",
  "slidingObject",
  "mechanicalConstruct",
  "boat",
  "platform",
  "magicObject",
  "nonHumanoidUnit",
] as const);

export const MOVING_OBJECT_MOVEMENT_TYPE_IDS = Object.freeze([
  "roll",
  "slide",
  "hover",
  "walk",
  "crawl",
  "fly",
  "rotate",
] as const);

export const MOVING_OBJECT_ANIMATION_TYPE_IDS = Object.freeze([
  "idle",
  "move",
  "rotate",
  "interact",
  "openClose",
  "pulse",
] as const);

export const MOVING_OBJECT_ANCHOR_MODE_IDS = Object.freeze([
  "automatic",
  "bottomCenter",
  "footprintCenter",
  "canvasCenter",
] as const);

export const MOVING_OBJECT_MECHANISM_IDS = Object.freeze([
  "none",
  "wheels",
  "joints",
  "wings",
  "rails",
  "magicDrive",
  "mixed",
] as const);

export const MOVING_OBJECT_MATERIAL_IDS = Object.freeze([
  "wood",
  "metal",
  "fabric",
  "stone",
  "magic",
  "mixed",
] as const);

export const MOVING_OBJECT_CONDITION_IDS = Object.freeze([
  "new",
  "used",
  "damaged",
  "improvised",
] as const);

export const MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS = Object.freeze([
  "neutral",
  "emissive",
  "warm",
  "cool",
  "diffuse",
] as const);

export const MOVING_OBJECT_SHADOW_MODE_IDS = Object.freeze([
  "none",
  "contact",
  "motionAdjusted",
] as const);

export type MovingObjectSubtype = AssetSubtypeByCategory["movingObject"];
export type MovingObjectClass = (typeof MOVING_OBJECT_CLASS_IDS)[number];
export type MovingObjectMovementType = (typeof MOVING_OBJECT_MOVEMENT_TYPE_IDS)[number];
export type MovingObjectAnimationType = (typeof MOVING_OBJECT_ANIMATION_TYPE_IDS)[number];
export type MovingObjectAnchorMode = (typeof MOVING_OBJECT_ANCHOR_MODE_IDS)[number];
export type MovingObjectMechanism = (typeof MOVING_OBJECT_MECHANISM_IDS)[number];
export type MovingObjectMaterial = (typeof MOVING_OBJECT_MATERIAL_IDS)[number];
export type MovingObjectCondition = (typeof MOVING_OBJECT_CONDITION_IDS)[number];
export type MovingObjectLightingBehavior = (typeof MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS)[number];
export type MovingObjectShadowMode = (typeof MOVING_OBJECT_SHADOW_MODE_IDS)[number];

export const DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES = Object.freeze({
  idle: 4,
  move: 4,
  rotate: 4,
  interact: 4,
  openClose: 4,
  pulse: 4,
} as const satisfies Readonly<Record<MovingObjectAnimationType, number>>);

export const MOVING_OBJECT_CLASS_BY_SUBTYPE = Object.freeze({
  cart: "cart",
  rollingObject: "rollingObject",
  floatingObject: "floatingObject",
  floatingCrystal: "floatingObject",
  slidingObject: "slidingObject",
  mechanicalConstruct: "mechanicalConstruct",
  boat: "boat",
  platform: "platform",
  magicObject: "magicObject",
  nonHumanoidUnit: "nonHumanoidUnit",
} as const satisfies Readonly<Record<MovingObjectSubtype, MovingObjectClass>>);

export function getDefaultMovingObjectClass(subtype: MovingObjectSubtype): MovingObjectClass {
  return MOVING_OBJECT_CLASS_BY_SUBTYPE[subtype];
}
