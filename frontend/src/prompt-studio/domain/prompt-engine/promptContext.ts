import { DEFAULT_CHARACTER_ANIMATION_FRAMES } from "../characters";
import { DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES } from "../moving-objects";
import type { ResolvedProfile } from "../profiles";
import { getDefaultArtworkType } from "../artworks";
import { getDefaultBuildingType } from "../buildings";
import { getDefaultItemClass } from "../items";
import { getDefaultMovingObjectClass } from "../moving-objects";
import { getDefaultNaturePlantType } from "../nature";
import { getDefaultStaticObjectClass } from "../static-objects";
import { getDefaultTextureMaterialType } from "../textures";
import { getDefaultTilesetType } from "../tilesets";
import { labelValue, localize } from "./promptFormatting";
import type { PromptBuildContext, PromptLanguage } from "./promptEngine.types";

const CATEGORY_LABELS = Object.freeze({
  character: { en: "character", de: "Charakter" },
  movingObject: { en: "moving object", de: "bewegliches Objekt" },
  staticObject: { en: "static object", de: "statisches Objekt" },
  texture: { en: "texture / material", de: "Textur / Material" },
  nature: { en: "nature asset", de: "Natur-Asset" },
  building: { en: "building / architecture", de: "Gebäude / Architektur" },
  tileset: { en: "tileset / map element", de: "Tileset / Kartenelement" },
  item: { en: "item / equipment", de: "Item / Ausrüstung" },
  artwork: { en: "artwork / concept image", de: "Artwork / Konzeptbild" },
} as const);

export interface PromptAnimationEntry {
  readonly name: string;
  readonly frames?: number;
}

export function getCategoryLabel(profile: ResolvedProfile, language: PromptLanguage): string {
  return CATEGORY_LABELS[profile.categoryData.category][language];
}

export function getSubtypeLabel(profile: ResolvedProfile, language: PromptLanguage): string {
  return labelValue(profile.categoryData.subtype, language);
}

export function getEffectiveTypeLabel(profile: ResolvedProfile, language: PromptLanguage): string {
  const data = profile.categoryData;
  switch (data.category) {
    case "character":
      return labelValue(data.subtype, language);
    case "movingObject":
      return labelValue(
        data.answers.objectClass ?? getDefaultMovingObjectClass(data.subtype),
        language,
      );
    case "staticObject":
      return labelValue(
        data.answers.objectClass ?? getDefaultStaticObjectClass(data.subtype),
        language,
      );
    case "texture":
      return labelValue(
        data.answers.materialType ?? getDefaultTextureMaterialType(data.subtype),
        language,
      );
    case "nature":
      return labelValue(
        data.answers.plantType ?? getDefaultNaturePlantType(data.subtype),
        language,
      );
    case "building":
      return labelValue(
        data.answers.buildingType ?? getDefaultBuildingType(data.subtype),
        language,
      );
    case "tileset":
      return labelValue(data.answers.tilesetType ?? getDefaultTilesetType(data.subtype), language);
    case "item":
      return labelValue(data.answers.itemClass ?? getDefaultItemClass(data.subtype), language);
    case "artwork":
      return labelValue(getDefaultArtworkType(data.subtype), language);
  }
}

export function getDirectionCount(profile: ResolvedProfile): 4 | 8 | null {
  if (!profile.capabilities.directional) return null;
  const data = profile.categoryData;
  switch (data.category) {
    case "character":
    case "movingObject":
      return data.answers.directionCount ?? 8;
    case "staticObject":
    case "texture":
    case "nature":
    case "building":
    case "tileset":
    case "item":
    case "artwork":
      return 8;
  }
}

export function getAnimationEntries(context: PromptBuildContext): readonly PromptAnimationEntry[] {
  if (!context.profile.capabilities.animated) return Object.freeze([]);
  const data = context.profile.categoryData;
  switch (data.category) {
    case "character": {
      if (data.answers.animationActions !== undefined) {
        return Object.freeze(
          data.answers.animationActions.map(({ action, frames }) =>
            Object.freeze({ name: labelValue(action, context.language), frames }),
          ),
        );
      }
      if (data.answers.animationAction === undefined) return Object.freeze([]);
      return Object.freeze([
        Object.freeze({
          name: labelValue(data.answers.animationAction, context.language),
          frames:
            data.answers.framesPerDirection ??
            DEFAULT_CHARACTER_ANIMATION_FRAMES[data.answers.animationAction],
        }),
      ]);
    }
    case "movingObject": {
      if (data.answers.animationSequences !== undefined) {
        return Object.freeze(
          data.answers.animationSequences.map(({ type, frames }) =>
            Object.freeze({ name: labelValue(type, context.language), frames }),
          ),
        );
      }
      if (data.answers.animationType === undefined) return Object.freeze([]);
      return Object.freeze([
        Object.freeze({
          name: labelValue(data.answers.animationType, context.language),
          frames:
            data.answers.framesPerDirection ??
            DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES[data.answers.animationType],
        }),
      ]);
    }
    case "staticObject":
    case "nature":
    case "building":
    case "tileset":
      return data.answers.animationType === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              name: labelValue(data.answers.animationType, context.language),
            }),
          ]);
    case "texture":
    case "item":
    case "artwork":
      return Object.freeze([]);
  }
}

export function usesWorldCamera(profile: ResolvedProfile): boolean {
  const data = profile.categoryData;
  switch (data.category) {
    case "character":
    case "movingObject":
    case "staticObject":
    case "nature":
    case "building":
      return true;
    case "item":
      return data.answers.presentation === "worldAsset";
    case "texture":
    case "tileset":
    case "artwork":
      return false;
  }
}

export function usesTileGrid(profile: ResolvedProfile): boolean {
  const data = profile.categoryData;
  switch (data.category) {
    case "artwork":
      return false;
    case "item":
      return data.answers.presentation === "worldAsset";
    case "character":
    case "movingObject":
    case "staticObject":
    case "texture":
    case "nature":
    case "building":
    case "tileset":
      return true;
  }
}

export function getDirectionalFrameSize(profile: ResolvedProfile): number | null {
  if (!profile.capabilities.directional) return null;
  const { tileSize, alphaPadding, characterHeight } = profile.values;
  const padding = profile.values.backgroundMode === "transparent" ? alphaPadding : 0;
  const data = profile.categoryData;
  let subjectWidth = tileSize;
  let subjectHeight = tileSize;

  if (data.category === "character") {
    subjectHeight = characterHeight ?? 80;
  } else if (data.category === "movingObject") {
    subjectWidth = (data.answers.footprint?.widthTiles ?? 1) * tileSize;
    subjectHeight = Math.max(
      (data.answers.footprint?.depthTiles ?? 1) * tileSize,
      data.answers.heightPixels ?? tileSize,
    );
  }

  const requiredSize = Math.max(128, subjectWidth + padding * 2, subjectHeight + padding * 2);
  return Math.ceil(requiredSize / tileSize) * tileSize;
}

export function getBackgroundLabel(context: PromptBuildContext): string {
  const data = context.profile.categoryData;
  if (data.category === "artwork" && data.answers.background !== undefined) {
    return labelValue(data.answers.background, context.language);
  }
  return labelValue(context.profile.values.backgroundMode, context.language);
}

export function formatAnimationEntry(
  entry: PromptAnimationEntry,
  language: PromptLanguage,
): string {
  return entry.frames === undefined
    ? entry.name
    : localize(
        language,
        `${entry.name} (${String(entry.frames)} frames)`,
        `${entry.name} (${String(entry.frames)} Frames)`,
      );
}
