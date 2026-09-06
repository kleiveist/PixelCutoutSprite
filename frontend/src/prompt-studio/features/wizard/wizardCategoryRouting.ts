import {
  ASSET_SUBTYPES,
  resolveCapabilities,
  type AssetCapabilities,
  type AssetCategory,
  type AssetSelection,
  type AssetSubtype,
} from "../../domain/assets";
import {
  CHARACTER_ANIMATION_ACTION_IDS,
  isHumanoidCharacterSubtype,
  isNpcContextSubtype,
  type CharacterAnimationActionId,
} from "../../domain/characters";
import { jsonValuesEqual } from "../../domain/json";
import {
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  type MovingObjectAnimationType,
} from "../../domain/moving-objects";
import { profileValuesEqual, type ProfileResolutionConflict } from "../../domain/profiles";
import {
  tilesetSubtypeSupportsCorners,
  tilesetSubtypeSupportsEdges,
  tilesetSubtypeSupportsTransitions,
} from "../../domain/tilesets";
import {
  parseWizardDraft,
  type ArtworkAnswers,
  type BaseProfile,
  type BaseProfileOverrides,
  type BaseProfileValues,
  type BuildingAnswers,
  type CharacterAnimationActionConfig,
  type CharacterAnswers,
  type ItemAnswers,
  type MovingObjectAnimationSequenceConfig,
  type MovingObjectAnswers,
  type NatureAnswers,
  type ProfileLibrary,
  type StaticObjectAnswers,
  type TextureAnswers,
  type TilesetAnswers,
  type WizardDraft,
} from "../../schemas";
import { resolveWizardDraftSnapshot } from "./wizardLifecycle";
import type { WizardCoreFormValues, WizardCoreStepId } from "./wizardSteps";
import { WIZARD_CHARACTER_DETAIL_FIELD_PATHS, parseWizardTechnicalFormValues } from "./wizardSteps";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;
type MutableWizardCoreFormValues = {
  -readonly [Key in keyof WizardCoreFormValues]: WizardCoreFormValues[Key];
};
type MutableBaseProfileOverrides = {
  -readonly [Key in keyof BaseProfileOverrides]: BaseProfileOverrides[Key];
};
type MutableBaseProfileValues = {
  -readonly [Key in keyof BaseProfileValues]: BaseProfileValues[Key];
};

const CORE_CONTROLLED_ANSWER_KEYS = new Set([
  "directionCount",
  "animationAction",
  "animationType",
  "movementType",
  "seamless",
  "tileableAxes",
]);

const CHARACTER_NPC_ANSWER_KEYS = new Set<keyof CharacterAnswers>([
  "professionReadable",
  "socialRole",
  "wealth",
  "culturalFunction",
  "typicalActivity",
  "conversationGesture",
  "everydayTool",
  "frontBackDetails",
]);

const CHARACTER_HUMANOID_ANSWER_KEYS = new Set<keyof CharacterAnswers>([
  "hat",
  "headwearCondition",
  "scarf",
  "outerwear",
  "lowerwear",
  "clothingLayers",
  "gloves",
  "handPose",
  "shoes",
  "beltBags",
  "backItem",
]);

const CHARACTER_CONTROLLED_ANSWER_KEYS = new Set<string>([
  ...WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
  "animationActions",
  "animationAction",
  "framesPerDirection",
]);

const MOVING_OBJECT_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "objectClass",
  "purpose",
  "basicShape",
  "subjectDescription",
  "footprint",
  "heightPixels",
  "anchorMode",
  "movementType",
  "mechanism",
  "material",
  "materialDetails",
  "condition",
  "lightingBehavior",
  "shadowMode",
  "extraDetails",
  "animationSequences",
  "animationType",
  "framesPerDirection",
  "directionCount",
]);

const TEXTURE_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "materialType",
  "usage",
  "subjectDescription",
  "seamless",
  "structure",
  "condition",
  "surface",
  "moisture",
  "icing",
  "lighting",
  "orientation",
  "extraDetails",
]);

const NATURE_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "plantType",
  "species",
  "subjectDescription",
  "climate",
  "season",
  "age",
  "silhouette",
  "trunkThickness",
  "trunkShape",
  "trunkDetails",
  "crownShape",
  "crownDensity",
  "foliageDetails",
  "rootVisibility",
  "rootDetails",
  "mossCoverage",
  "mushroomGrowth",
  "snowCover",
  "vineGrowth",
  "footprint",
  "grounding",
  "variantCount",
  "animationType",
  "extraDetails",
]);

const STATIC_OBJECT_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "objectClass",
  "purpose",
  "basicShape",
  "proportion",
  "symmetry",
  "subjectDescription",
  "primaryMaterial",
  "secondaryMaterial",
  "materialDetails",
  "condition",
  "detailElements",
  "contents",
  "interaction",
  "animationType",
  "shadowMode",
  "footprint",
  "variantCount",
  "extraDetails",
]);

const BUILDING_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "buildingType",
  "purpose",
  "subjectDescription",
  "planShape",
  "size",
  "footprint",
  "heightPixels",
  "floors",
  "primaryMaterial",
  "secondaryMaterial",
  "materialDetails",
  "roofShape",
  "roofPitch",
  "roofMaterial",
  "roofCondition",
  "roofDetails",
  "facadeStyle",
  "facadeDetails",
  "doorCount",
  "doorType",
  "doorPosition",
  "doorState",
  "windowCount",
  "windowShape",
  "windowLighting",
  "windowDetails",
  "condition",
  "occupancy",
  "environment",
  "mappingMode",
  "collisionMode",
  "modular",
  "lighting",
  "lightSourceDetails",
  "animationType",
  "extraDetails",
]);

const TILESET_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "tilesetType",
  "tileUsage",
  "subjectDescription",
  "edgeSet",
  "edgeDetails",
  "cornerSet",
  "transitionMode",
  "sourceMaterial",
  "targetMaterial",
  "seamMode",
  "seamDetails",
  "tileableAxes",
  "repeatMode",
  "variantCount",
  "variantKinds",
  "atlasLayout",
  "atlasTileCount",
  "atlasColumns",
  "atlasGutterPixels",
  "atlasMarginPixels",
  "animationType",
  "extraDetails",
]);

const ITEM_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "itemClass",
  "purpose",
  "presentation",
  "wearPosition",
  "iconSize",
  "size",
  "subjectDescription",
  "primaryMaterial",
  "secondaryMaterial",
  "materialDetails",
  "condition",
  "functionDetails",
  "significance",
  "meaningDetails",
  "silhouette",
  "readability",
  "glowMode",
  "shadowMode",
  "variantCount",
  "extraDetails",
]);

const ARTWORK_CONTROLLED_ANSWER_KEYS = new Set<string>([
  "purpose",
  "motif",
  "subjectDescription",
  "sceneDescription",
  "composition",
  "compositionDetails",
  "format",
  "background",
  "backgroundDetails",
  "focus",
  "lightingDrama",
  "lightingDetails",
  "detailLevel",
  "extraDetails",
]);

const MOVING_OBJECT_SIMPLE_FIELD_MAPPINGS = Object.freeze([
  ["movingObjectClass", "objectClass"],
  ["movingObjectPurpose", "purpose"],
  ["movingObjectBasicShape", "basicShape"],
  ["movingObjectDescription", "subjectDescription"],
  ["movingObjectHeightPixels", "heightPixels"],
  ["movingObjectAnchorMode", "anchorMode"],
  ["movementType", "movementType"],
  ["movingObjectMechanism", "mechanism"],
  ["movingObjectMaterial", "material"],
  ["movingObjectMaterialDetails", "materialDetails"],
  ["movingObjectCondition", "condition"],
  ["movingObjectLightingBehavior", "lightingBehavior"],
  ["movingObjectShadowMode", "shadowMode"],
  ["movingObjectExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof MovingObjectAnswers])[]);

const TEXTURE_FIELD_MAPPINGS = Object.freeze([
  ["textureMaterialType", "materialType"],
  ["textureUsage", "usage"],
  ["textureDescription", "subjectDescription"],
  ["seamless", "seamless"],
  ["textureStructure", "structure"],
  ["textureCondition", "condition"],
  ["textureSurface", "surface"],
  ["textureMoisture", "moisture"],
  ["textureIcing", "icing"],
  ["textureLighting", "lighting"],
  ["textureOrientation", "orientation"],
  ["textureExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof TextureAnswers])[]);

const NATURE_FIELD_MAPPINGS = Object.freeze([
  ["naturePlantType", "plantType"],
  ["natureSpecies", "species"],
  ["natureDescription", "subjectDescription"],
  ["natureClimate", "climate"],
  ["natureSeason", "season"],
  ["natureAge", "age"],
  ["natureSilhouette", "silhouette"],
  ["natureTrunkThickness", "trunkThickness"],
  ["natureTrunkShape", "trunkShape"],
  ["natureTrunkDetails", "trunkDetails"],
  ["natureCrownShape", "crownShape"],
  ["natureCrownDensity", "crownDensity"],
  ["natureFoliageDetails", "foliageDetails"],
  ["natureRootVisibility", "rootVisibility"],
  ["natureRootDetails", "rootDetails"],
  ["natureMossCoverage", "mossCoverage"],
  ["natureMushroomGrowth", "mushroomGrowth"],
  ["natureSnowCover", "snowCover"],
  ["natureVineGrowth", "vineGrowth"],
  ["natureGrounding", "grounding"],
  ["natureVariantCount", "variantCount"],
  ["natureExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof NatureAnswers])[]);

const STATIC_OBJECT_FIELD_MAPPINGS = Object.freeze([
  ["staticObjectClass", "objectClass"],
  ["staticObjectPurpose", "purpose"],
  ["staticObjectBasicShape", "basicShape"],
  ["staticObjectProportion", "proportion"],
  ["staticObjectSymmetry", "symmetry"],
  ["staticObjectDescription", "subjectDescription"],
  ["staticObjectPrimaryMaterial", "primaryMaterial"],
  ["staticObjectSecondaryMaterial", "secondaryMaterial"],
  ["staticObjectMaterialDetails", "materialDetails"],
  ["staticObjectCondition", "condition"],
  ["staticObjectDetailElements", "detailElements"],
  ["staticObjectContents", "contents"],
  ["staticObjectInteraction", "interaction"],
  ["staticObjectShadowMode", "shadowMode"],
  ["staticObjectVariantCount", "variantCount"],
  ["staticObjectExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof StaticObjectAnswers])[]);

const BUILDING_FIELD_MAPPINGS = Object.freeze([
  ["buildingType", "buildingType"],
  ["buildingPurpose", "purpose"],
  ["buildingDescription", "subjectDescription"],
  ["buildingPlanShape", "planShape"],
  ["buildingSize", "size"],
  ["buildingHeightPixels", "heightPixels"],
  ["buildingFloors", "floors"],
  ["buildingPrimaryMaterial", "primaryMaterial"],
  ["buildingSecondaryMaterial", "secondaryMaterial"],
  ["buildingMaterialDetails", "materialDetails"],
  ["buildingRoofShape", "roofShape"],
  ["buildingRoofPitch", "roofPitch"],
  ["buildingRoofMaterial", "roofMaterial"],
  ["buildingRoofCondition", "roofCondition"],
  ["buildingRoofDetails", "roofDetails"],
  ["buildingFacadeStyle", "facadeStyle"],
  ["buildingFacadeDetails", "facadeDetails"],
  ["buildingDoorCount", "doorCount"],
  ["buildingDoorType", "doorType"],
  ["buildingDoorPosition", "doorPosition"],
  ["buildingDoorState", "doorState"],
  ["buildingWindowCount", "windowCount"],
  ["buildingWindowShape", "windowShape"],
  ["buildingWindowLighting", "windowLighting"],
  ["buildingWindowDetails", "windowDetails"],
  ["buildingCondition", "condition"],
  ["buildingOccupancy", "occupancy"],
  ["buildingEnvironment", "environment"],
  ["buildingMappingMode", "mappingMode"],
  ["buildingCollisionMode", "collisionMode"],
  ["buildingModular", "modular"],
  ["buildingLighting", "lighting"],
  ["buildingLightSourceDetails", "lightSourceDetails"],
  ["buildingExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof BuildingAnswers])[]);

const TILESET_FIELD_MAPPINGS = Object.freeze([
  ["tilesetType", "tilesetType"],
  ["tilesetUsage", "tileUsage"],
  ["tilesetDescription", "subjectDescription"],
  ["tilesetEdgeSet", "edgeSet"],
  ["tilesetEdgeDetails", "edgeDetails"],
  ["tilesetCornerSet", "cornerSet"],
  ["tilesetTransitionMode", "transitionMode"],
  ["tilesetSourceMaterial", "sourceMaterial"],
  ["tilesetTargetMaterial", "targetMaterial"],
  ["tilesetSeamMode", "seamMode"],
  ["tilesetSeamDetails", "seamDetails"],
  ["tileableAxes", "tileableAxes"],
  ["tilesetRepeatMode", "repeatMode"],
  ["tilesetVariantCount", "variantCount"],
  ["tilesetVariantKinds", "variantKinds"],
  ["tilesetAtlasLayout", "atlasLayout"],
  ["tilesetAtlasTileCount", "atlasTileCount"],
  ["tilesetAtlasColumns", "atlasColumns"],
  ["tilesetAtlasGutterPixels", "atlasGutterPixels"],
  ["tilesetAtlasMarginPixels", "atlasMarginPixels"],
  ["tilesetExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof TilesetAnswers])[]);

const ITEM_FIELD_MAPPINGS = Object.freeze([
  ["itemClass", "itemClass"],
  ["itemPurpose", "purpose"],
  ["itemPresentation", "presentation"],
  ["itemWearPosition", "wearPosition"],
  ["itemIconSize", "iconSize"],
  ["itemSize", "size"],
  ["itemDescription", "subjectDescription"],
  ["itemPrimaryMaterial", "primaryMaterial"],
  ["itemSecondaryMaterial", "secondaryMaterial"],
  ["itemMaterialDetails", "materialDetails"],
  ["itemCondition", "condition"],
  ["itemFunctionDetails", "functionDetails"],
  ["itemSignificance", "significance"],
  ["itemMeaningDetails", "meaningDetails"],
  ["itemSilhouette", "silhouette"],
  ["itemReadability", "readability"],
  ["itemGlowMode", "glowMode"],
  ["itemShadowMode", "shadowMode"],
  ["itemVariantCount", "variantCount"],
  ["itemExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof ItemAnswers])[]);

const ARTWORK_FIELD_MAPPINGS = Object.freeze([
  ["artworkPurpose", "purpose"],
  ["artworkMotif", "motif"],
  ["artworkDescription", "subjectDescription"],
  ["artworkSceneDescription", "sceneDescription"],
  ["artworkComposition", "composition"],
  ["artworkCompositionDetails", "compositionDetails"],
  ["artworkFormat", "format"],
  ["artworkBackground", "background"],
  ["artworkBackgroundDetails", "backgroundDetails"],
  ["artworkFocus", "focus"],
  ["artworkLightingDrama", "lightingDrama"],
  ["artworkLightingDetails", "lightingDetails"],
  ["artworkDetailLevel", "detailLevel"],
  ["artworkExtraDetails", "extraDetails"],
] as const satisfies readonly (readonly [keyof WizardCoreFormValues, keyof ArtworkAnswers])[]);

const PROFILE_VALUE_KEYS = Object.freeze([
  "pixelDensity",
  "styleProfile",
  "tileSize",
  "characterHeight",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
  "outlineStyle",
  "paletteMode",
  "backgroundMode",
  "alphaPadding",
  "nearestNeighbor",
  "lightingDefaults",
] as const satisfies readonly (keyof BaseProfileValues)[]);

const WORLD_GEOMETRY_PROFILE_VALUE_KEYS = Object.freeze([
  "tileSize",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
] as const satisfies readonly (keyof BaseProfileOverrides)[]);

export interface WizardCoreDraftContext {
  readonly library: ProfileLibrary | null;
}

function subtypeIsKnownForCategory(category: AssetCategory, subtype: AssetSubtype): boolean {
  const knownSubtypes: readonly string[] = ASSET_SUBTYPES[category];
  return knownSubtypes.includes(subtype);
}

export function getWizardAssetSelection(
  values: Pick<WizardCoreFormValues, "category" | "subtype">,
): AssetSelection | null {
  const { category, subtype } = values;
  if (
    category === undefined ||
    subtype === undefined ||
    !subtypeIsKnownForCategory(category, subtype)
  ) {
    return null;
  }

  switch (category) {
    case "character":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.character)[number] };
    case "movingObject":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.movingObject)[number] };
    case "staticObject":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.staticObject)[number] };
    case "texture":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.texture)[number] };
    case "nature":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.nature)[number] };
    case "building":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.building)[number] };
    case "tileset":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.tileset)[number] };
    case "item":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.item)[number] };
    case "artwork":
      return { category, subtype: subtype as (typeof ASSET_SUBTYPES.artwork)[number] };
  }
}

export function resolveWizardCapabilities(
  values: Pick<WizardCoreFormValues, "category" | "subtype">,
): AssetCapabilities | null {
  const selection = getWizardAssetSelection(values);
  if (!selection) return null;

  switch (selection.category) {
    case "character":
      return resolveCapabilities("character", selection.subtype);
    case "movingObject":
      return resolveCapabilities("movingObject", selection.subtype);
    case "staticObject":
      return resolveCapabilities("staticObject", selection.subtype);
    case "texture":
      return resolveCapabilities("texture", selection.subtype);
    case "nature":
      return resolveCapabilities("nature", selection.subtype);
    case "building":
      return resolveCapabilities("building", selection.subtype);
    case "tileset":
      return resolveCapabilities("tileset", selection.subtype);
    case "item":
      return resolveCapabilities("item", selection.subtype);
    case "artwork":
      return resolveCapabilities("artwork", selection.subtype);
  }
}

export function wizardStepIsApplicable(
  stepId: WizardCoreStepId,
  values: WizardCoreFormValues,
  library: ProfileLibrary | null = null,
): boolean {
  if (stepId === "project" || stepId === "category") return true;

  const selection = getWizardAssetSelection(values);
  if (stepId === "baseProfile") return selection !== null;

  const capabilities = resolveWizardCapabilities(values);
  if (!capabilities) return false;
  const baseProfile = library?.baseProfiles.find((profile) => profile.id === values.baseProfileId);
  if (!baseProfile) return false;
  if (capabilities.scaledCharacter && values.characterHeight === undefined) {
    return false;
  }

  switch (stepId) {
    case "characterDetails":
      return selection?.category === "character";
    case "movingObjectDetails":
      return selection?.category === "movingObject";
    case "textureDetails":
      return selection?.category === "texture";
    case "natureDetails":
      return selection?.category === "nature";
    case "staticObjectDetails":
      return selection?.category === "staticObject";
    case "buildingDetails":
      return selection?.category === "building";
    case "tilesetDetails":
      return selection?.category === "tileset";
    case "itemDetails":
      return selection?.category === "item";
    case "artworkDetails":
      return selection?.category === "artwork";
    case "directions":
      return capabilities.directional;
    case "animation":
      return capabilities.animated;
    case "tileability":
      return (
        capabilities.tileable &&
        selection?.category !== "texture" &&
        selection?.category !== "tileset"
      );
  }
}

function withoutTechnicalFormValues(values: WizardCoreFormValues): WizardCoreFormValues {
  const {
    baseProfileId: _baseProfileId,
    pixelDensity: _pixelDensity,
    styleProfile: _styleProfile,
    tileSize: _tileSize,
    characterHeight: _characterHeight,
    perspectiveType: _perspectiveType,
    cameraAngle: _cameraAngle,
    cameraDirection: _cameraDirection,
    projectionType: _projectionType,
    outlineStyle: _outlineStyle,
    paletteMode: _paletteMode,
    backgroundMode: _backgroundMode,
    alphaPadding: _alphaPadding,
    nearestNeighbor: _nearestNeighbor,
    lightingPolicy: _lightingPolicy,
    lightingNotes: _lightingNotes,
    ...remainingValues
  } = values;
  void [
    _baseProfileId,
    _pixelDensity,
    _styleProfile,
    _tileSize,
    _characterHeight,
    _perspectiveType,
    _cameraAngle,
    _cameraDirection,
    _projectionType,
    _outlineStyle,
    _paletteMode,
    _backgroundMode,
    _alphaPadding,
    _nearestNeighbor,
    _lightingPolicy,
    _lightingNotes,
  ];
  return remainingValues;
}

export function applyWizardBaseProfileToFormValues(
  values: WizardCoreFormValues,
  baseProfile: BaseProfile,
  effectiveValues: BaseProfileValues = baseProfile.values,
): WizardCoreFormValues {
  return {
    ...withoutTechnicalFormValues(values),
    baseProfileId: baseProfile.id,
    pixelDensity: effectiveValues.pixelDensity,
    styleProfile: effectiveValues.styleProfile,
    tileSize: effectiveValues.tileSize,
    ...(effectiveValues.characterHeight === undefined
      ? {}
      : { characterHeight: effectiveValues.characterHeight }),
    perspectiveType: effectiveValues.perspectiveType,
    cameraAngle: effectiveValues.cameraAngle,
    cameraDirection: effectiveValues.cameraDirection,
    projectionType: effectiveValues.projectionType,
    outlineStyle: effectiveValues.outlineStyle,
    paletteMode: effectiveValues.paletteMode,
    backgroundMode: effectiveValues.backgroundMode,
    alphaPadding: effectiveValues.alphaPadding,
    nearestNeighbor: effectiveValues.nearestNeighbor,
    lightingPolicy: effectiveValues.lightingDefaults.policy,
    lightingNotes: effectiveValues.lightingDefaults.notes,
  };
}

function addDefinedValue<Key extends keyof MutableWizardCoreFormValues>(
  target: MutableWizardCoreFormValues,
  key: Key,
  value: MutableWizardCoreFormValues[Key],
): void {
  if (value !== undefined) target[key] = value;
}

function optionalJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return jsonValuesEqual(left, right);
}

type CharacterAnimationFrameMap = NonNullable<WizardCoreFormValues["characterAnimationFrames"]>;

function characterAnimationFramesFromAnswers(
  answers: CharacterAnswers,
): CharacterAnimationFrameMap | undefined {
  const frames: Partial<Record<CharacterAnimationActionId, number>> = {};

  if (answers.animationActions !== undefined) {
    for (const animation of answers.animationActions) {
      frames[animation.action] = animation.frames;
    }
  } else if (answers.animationAction !== undefined) {
    frames[answers.animationAction] = answers.framesPerDirection ?? 1;
  }

  return Object.keys(frames).length === 0 ? undefined : Object.freeze(frames);
}

function characterAnimationActionsFromForm(
  frames: WizardCoreFormValues["characterAnimationFrames"],
  legacyAction: WizardCoreFormValues["animationAction"],
  previousAnswers: CharacterAnswers,
): readonly CharacterAnimationActionConfig[] | undefined {
  const effectiveFrames =
    frames ??
    (legacyAction === undefined
      ? undefined
      : { [legacyAction]: previousAnswers.framesPerDirection ?? 1 });
  if (effectiveFrames === undefined) return undefined;

  const actions = CHARACTER_ANIMATION_ACTION_IDS.flatMap((action) => {
    const frameCount = effectiveFrames[action];
    return frameCount === undefined
      ? []
      : [{ action, frames: frameCount } satisfies CharacterAnimationActionConfig];
  });
  return actions.length === 0 ? undefined : Object.freeze(actions);
}

function clearsInheritedCharacterDefault(
  values: WizardCoreFormValues,
  defaults: CharacterAnswers,
): boolean {
  for (const key of WIZARD_CHARACTER_DETAIL_FIELD_PATHS) {
    if (defaults[key] !== undefined && values[key] === undefined) return true;
  }

  if (defaults.directionCount !== undefined && values.directionCount === undefined) {
    return true;
  }

  const inheritedAnimations = characterAnimationFramesFromAnswers(defaults);
  const selectedAnimations = characterAnimationActionsFromForm(
    values.characterAnimationFrames,
    values.animationAction,
    {},
  );
  return inheritedAnimations !== undefined && selectedAnimations === undefined;
}

type MovingObjectAnimationFrameMap = NonNullable<
  WizardCoreFormValues["movingObjectAnimationFrames"]
>;

function movingObjectAnimationFramesFromAnswers(
  answers: MovingObjectAnswers,
): MovingObjectAnimationFrameMap | undefined {
  const frames: Partial<Record<MovingObjectAnimationType, number>> = {};

  if (answers.animationSequences !== undefined) {
    for (const type of MOVING_OBJECT_ANIMATION_TYPE_IDS) {
      const sequence = answers.animationSequences.find((candidate) => candidate.type === type);
      if (sequence !== undefined) frames[type] = sequence.frames;
    }
  } else if (answers.animationType !== undefined) {
    frames[answers.animationType] = answers.framesPerDirection ?? 1;
  }

  return Object.keys(frames).length === 0 ? undefined : Object.freeze(frames);
}

function movingObjectAnimationSequencesFromForm(
  frames: WizardCoreFormValues["movingObjectAnimationFrames"],
  legacyType: WizardCoreFormValues["animationType"],
  previousAnswers: MovingObjectAnswers,
): readonly MovingObjectAnimationSequenceConfig[] | undefined {
  const movingLegacyType =
    legacyType !== undefined &&
    MOVING_OBJECT_ANIMATION_TYPE_IDS.includes(legacyType as MovingObjectAnimationType)
      ? (legacyType as MovingObjectAnimationType)
      : undefined;
  const effectiveFrames =
    frames ??
    (movingLegacyType === undefined
      ? undefined
      : {
          [movingLegacyType]: previousAnswers.framesPerDirection ?? 1,
        });
  if (effectiveFrames === undefined) return undefined;

  const sequences = MOVING_OBJECT_ANIMATION_TYPE_IDS.flatMap((type) => {
    const frameCount = effectiveFrames[type];
    return frameCount === undefined
      ? []
      : [{ type, frames: frameCount } satisfies MovingObjectAnimationSequenceConfig];
  });
  return sequences.length === 0 ? undefined : Object.freeze(sequences);
}

function movingObjectFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function movingObjectAnswerValue(
  answers: MovingObjectAnswers,
  answerField: keyof MovingObjectAnswers,
): unknown {
  return answers[answerField];
}

function clearsInheritedMovingObjectDefault(
  values: WizardCoreFormValues,
  defaults: MovingObjectAnswers,
): boolean {
  for (const [formField, answerField] of MOVING_OBJECT_SIMPLE_FIELD_MAPPINGS) {
    if (
      movingObjectAnswerValue(defaults, answerField) !== undefined &&
      movingObjectFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }

  if (
    defaults.footprint !== undefined &&
    values.movingObjectFootprintWidthTiles === undefined &&
    values.movingObjectFootprintDepthTiles === undefined
  ) {
    return true;
  }

  if (defaults.directionCount !== undefined && values.directionCount === undefined) {
    return true;
  }

  const inheritedAnimations = movingObjectAnimationFramesFromAnswers(defaults);
  const selectedAnimations = movingObjectAnimationSequencesFromForm(
    values.movingObjectAnimationFrames,
    values.animationType,
    {},
  );
  return inheritedAnimations !== undefined && selectedAnimations === undefined;
}

function textureFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function textureAnswerValue(answers: TextureAnswers, answerField: keyof TextureAnswers): unknown {
  return answers[answerField];
}

function clearsInheritedTextureDefault(
  values: WizardCoreFormValues,
  defaults: TextureAnswers,
): boolean {
  return TEXTURE_FIELD_MAPPINGS.some(
    ([formField, answerField]) =>
      textureAnswerValue(defaults, answerField) !== undefined &&
      textureFormValue(values, formField) === undefined,
  );
}

function natureFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function natureAnswerValue(answers: NatureAnswers, answerField: keyof NatureAnswers): unknown {
  return answers[answerField];
}

function clearsInheritedNatureDefault(
  values: WizardCoreFormValues,
  defaults: NatureAnswers,
): boolean {
  for (const [formField, answerField] of NATURE_FIELD_MAPPINGS) {
    if (
      natureAnswerValue(defaults, answerField) !== undefined &&
      natureFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }

  if (
    defaults.footprint !== undefined &&
    values.natureFootprintWidthTiles === undefined &&
    values.natureFootprintDepthTiles === undefined
  ) {
    return true;
  }

  return defaults.animationType !== undefined && values.animationType === undefined;
}

function staticObjectFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function staticObjectAnswerValue(
  answers: StaticObjectAnswers,
  answerField: keyof StaticObjectAnswers,
): unknown {
  return answers[answerField];
}

function clearsInheritedStaticObjectDefault(
  values: WizardCoreFormValues,
  defaults: StaticObjectAnswers,
): boolean {
  for (const [formField, answerField] of STATIC_OBJECT_FIELD_MAPPINGS) {
    if (
      staticObjectAnswerValue(defaults, answerField) !== undefined &&
      staticObjectFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }

  if (
    defaults.footprint !== undefined &&
    values.staticObjectFootprintWidthTiles === undefined &&
    values.staticObjectFootprintDepthTiles === undefined
  ) {
    return true;
  }

  return defaults.animationType !== undefined && values.animationType === undefined;
}

function buildingFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function buildingAnswerValue(
  answers: BuildingAnswers,
  answerField: keyof BuildingAnswers,
): unknown {
  return answers[answerField];
}

function clearsInheritedBuildingDefault(
  values: WizardCoreFormValues,
  defaults: BuildingAnswers,
): boolean {
  for (const [formField, answerField] of BUILDING_FIELD_MAPPINGS) {
    if (
      buildingAnswerValue(defaults, answerField) !== undefined &&
      buildingFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }

  if (
    defaults.footprint !== undefined &&
    values.buildingFootprintWidthTiles === undefined &&
    values.buildingFootprintDepthTiles === undefined
  ) {
    return true;
  }

  return defaults.animationType !== undefined && values.animationType === undefined;
}

function tilesetFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function tilesetAnswerValue(answers: TilesetAnswers, answerField: keyof TilesetAnswers): unknown {
  return answers[answerField];
}

function clearsInheritedTilesetDefault(
  values: WizardCoreFormValues,
  defaults: TilesetAnswers,
): boolean {
  for (const [formField, answerField] of TILESET_FIELD_MAPPINGS) {
    if (
      tilesetAnswerValue(defaults, answerField) !== undefined &&
      tilesetFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }

  return defaults.animationType !== undefined && values.animationType === undefined;
}

function itemFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function itemAnswerValue(answers: ItemAnswers, answerField: keyof ItemAnswers): unknown {
  return answers[answerField];
}

function clearsInheritedItemDefault(values: WizardCoreFormValues, defaults: ItemAnswers): boolean {
  for (const [formField, answerField] of ITEM_FIELD_MAPPINGS) {
    if (
      itemAnswerValue(defaults, answerField) !== undefined &&
      itemFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }
  return false;
}

function artworkFormValue(
  values: WizardCoreFormValues,
  formField: keyof WizardCoreFormValues,
): unknown {
  return values[formField];
}

function artworkAnswerValue(answers: ArtworkAnswers, answerField: keyof ArtworkAnswers): unknown {
  return answers[answerField];
}

function clearsInheritedArtworkDefault(
  values: WizardCoreFormValues,
  defaults: ArtworkAnswers,
): boolean {
  for (const [formField, answerField] of ARTWORK_FIELD_MAPPINGS) {
    if (
      artworkAnswerValue(defaults, answerField) !== undefined &&
      artworkFormValue(values, formField) === undefined
    ) {
      return true;
    }
  }
  return false;
}

export function createWizardCoreFormValues(
  draft: WizardDraft,
  categoryHint: AssetCategory | null = null,
  library: ProfileLibrary | null = null,
): WizardCoreFormValues {
  let values: MutableWizardCoreFormValues = {
    projectName: draft.projectName,
  };
  let resolvedCharacterAnswers: CharacterAnswers | undefined;
  let resolvedMovingObjectAnswers: MovingObjectAnswers | undefined;
  let resolvedTextureAnswers: TextureAnswers | undefined;
  let resolvedNatureAnswers: NatureAnswers | undefined;
  let resolvedStaticObjectAnswers: StaticObjectAnswers | undefined;
  let resolvedBuildingAnswers: BuildingAnswers | undefined;
  let resolvedTilesetAnswers: TilesetAnswers | undefined;
  let resolvedItemAnswers: ItemAnswers | undefined;
  let resolvedArtworkAnswers: ArtworkAnswers | undefined;

  if (!("category" in draft)) {
    if (categoryHint !== null) values.category = categoryHint;
    return values;
  }

  values.category = draft.category;
  values.subtype = draft.subtype;

  if (draft.baseProfileId !== undefined) {
    values.baseProfileId = draft.baseProfileId;
    const baseProfile = library?.baseProfiles.find((profile) => profile.id === draft.baseProfileId);
    const resolution = library ? resolveWizardDraftSnapshot(draft, library) : null;
    if (baseProfile && resolution?.status === "resolved") {
      values = applyWizardBaseProfileToFormValues(values, baseProfile, resolution.profile.values);
      if (resolution.profile.categoryData.category === "character") {
        resolvedCharacterAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "movingObject") {
        resolvedMovingObjectAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "texture") {
        resolvedTextureAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "nature") {
        resolvedNatureAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "staticObject") {
        resolvedStaticObjectAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "building") {
        resolvedBuildingAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "tileset") {
        resolvedTilesetAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "item") {
        resolvedItemAnswers = resolution.profile.categoryData.answers;
      } else if (resolution.profile.categoryData.category === "artwork") {
        resolvedArtworkAnswers = resolution.profile.categoryData.answers;
      }
    }
  }

  switch (draft.category) {
    case "character": {
      const answers = resolvedCharacterAnswers ?? draft.answers;
      for (const key of WIZARD_CHARACTER_DETAIL_FIELD_PATHS) {
        const value = answers[key];
        if (value !== undefined) {
          (values as Record<string, unknown>)[key] = value;
        }
      }
      addDefinedValue(values, "directionCount", answers.directionCount);
      const characterAnimationFrames = characterAnimationFramesFromAnswers(answers);
      if (characterAnimationFrames !== undefined) {
        values.characterAnimationFrames = characterAnimationFrames;
      }
      break;
    }
    case "movingObject": {
      const answers = resolvedMovingObjectAnswers ?? draft.answers;
      for (const [formField, answerField] of MOVING_OBJECT_SIMPLE_FIELD_MAPPINGS) {
        const value = movingObjectAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      if (answers.footprint !== undefined) {
        values.movingObjectFootprintWidthTiles = answers.footprint.widthTiles;
        values.movingObjectFootprintDepthTiles = answers.footprint.depthTiles;
      }
      addDefinedValue(values, "directionCount", answers.directionCount);
      const movingObjectAnimationFrames = movingObjectAnimationFramesFromAnswers(answers);
      if (movingObjectAnimationFrames !== undefined) {
        values.movingObjectAnimationFrames = movingObjectAnimationFrames;
      }
      break;
    }
    case "staticObject": {
      const answers = resolvedStaticObjectAnswers ?? draft.answers;
      for (const [formField, answerField] of STATIC_OBJECT_FIELD_MAPPINGS) {
        const value = staticObjectAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      if (answers.footprint !== undefined) {
        values.staticObjectFootprintWidthTiles = answers.footprint.widthTiles;
        values.staticObjectFootprintDepthTiles = answers.footprint.depthTiles;
      }
      addDefinedValue(values, "animationType", answers.animationType);
      break;
    }
    case "texture":
      for (const [formField, answerField] of TEXTURE_FIELD_MAPPINGS) {
        const value = textureAnswerValue(resolvedTextureAnswers ?? draft.answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      break;
    case "nature": {
      const answers = resolvedNatureAnswers ?? draft.answers;
      for (const [formField, answerField] of NATURE_FIELD_MAPPINGS) {
        const value = natureAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      if (answers.footprint !== undefined) {
        values.natureFootprintWidthTiles = answers.footprint.widthTiles;
        values.natureFootprintDepthTiles = answers.footprint.depthTiles;
      }
      addDefinedValue(values, "animationType", answers.animationType);
      break;
    }
    case "building": {
      const answers = resolvedBuildingAnswers ?? draft.answers;
      for (const [formField, answerField] of BUILDING_FIELD_MAPPINGS) {
        const value = buildingAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      if (answers.footprint !== undefined) {
        values.buildingFootprintWidthTiles = answers.footprint.widthTiles;
        values.buildingFootprintDepthTiles = answers.footprint.depthTiles;
      }
      addDefinedValue(values, "animationType", answers.animationType);
      break;
    }
    case "tileset": {
      const answers = resolvedTilesetAnswers ?? draft.answers;
      for (const [formField, answerField] of TILESET_FIELD_MAPPINGS) {
        const value = tilesetAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      addDefinedValue(values, "animationType", answers.animationType);
      break;
    }
    case "item": {
      const answers = resolvedItemAnswers ?? draft.answers;
      for (const [formField, answerField] of ITEM_FIELD_MAPPINGS) {
        const value = itemAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      break;
    }
    case "artwork": {
      const answers = resolvedArtworkAnswers ?? draft.answers;
      for (const [formField, answerField] of ARTWORK_FIELD_MAPPINGS) {
        const value = artworkAnswerValue(answers, answerField);
        if (value !== undefined) {
          (values as Record<string, unknown>)[formField] = value;
        }
      }
      break;
    }
  }

  return values;
}

function selectionsMatch(
  draft: WizardDraft,
  selection: AssetSelection,
): draft is SelectedWizardDraft {
  return (
    "category" in draft &&
    draft.category === selection.category &&
    draft.subtype === selection.subtype
  );
}

function sanitizeOverrides(
  overrides: BaseProfileOverrides | undefined,
  capabilities: AssetCapabilities,
): BaseProfileOverrides | undefined {
  if (overrides === undefined) return undefined;

  const relevantOverrides: MutableBaseProfileOverrides = { ...overrides };
  if (!capabilities.scaledCharacter) delete relevantOverrides.characterHeight;
  if (capabilities.freeComposition) {
    for (const key of WORLD_GEOMETRY_PROFILE_VALUE_KEYS) {
      delete relevantOverrides[key];
    }
  }
  return relevantOverrides;
}

export type WizardBaseProfileProjectionIssue =
  | Readonly<{ code: "profileLibraryUnavailable" }>
  | Readonly<{ code: "baseProfileRequired" }>
  | Readonly<{ code: "missingBaseProfile"; baseProfileId: string }>
  | Readonly<{
      code: "incompatibleBaseProfile";
      baseProfileId: string;
      field: "characterHeight";
    }>
  | Readonly<{ code: "incompleteTechnicalValues" }>
  | Readonly<{
      code: "profileResolutionConflict";
      conflicts: readonly [ProfileResolutionConflict, ...ProfileResolutionConflict[]];
    }>;

export class WizardBaseProfileProjectionError extends Error {
  readonly issue: WizardBaseProfileProjectionIssue;

  constructor(issue: WizardBaseProfileProjectionIssue) {
    super(`Wizard Base-profile projection failed: ${issue.code}.`);
    this.name = "WizardBaseProfileProjectionError";
    this.issue = issue;
  }
}

function setOverrideValue<Key extends keyof BaseProfileOverrides>(
  overrides: MutableBaseProfileOverrides,
  key: Key,
  value: Exclude<BaseProfileOverrides[Key], undefined>,
): void {
  overrides[key] = value;
}

function technicalOverridesFromForm(
  values: WizardCoreFormValues,
  inheritedValues: BaseProfileValues,
  capabilities: AssetCapabilities,
): BaseProfileOverrides {
  const technicalValues = parseWizardTechnicalFormValues(values);
  if (!technicalValues) {
    throw new WizardBaseProfileProjectionError({
      code: "incompleteTechnicalValues",
    });
  }
  const overrides: MutableBaseProfileOverrides = {};
  for (const key of PROFILE_VALUE_KEYS) {
    if (key === "characterHeight" && !capabilities.scaledCharacter) continue;
    if (
      capabilities.freeComposition &&
      WORLD_GEOMETRY_PROFILE_VALUE_KEYS.includes(
        key as (typeof WORLD_GEOMETRY_PROFILE_VALUE_KEYS)[number],
      )
    ) {
      continue;
    }
    const attemptedValue = technicalValues[key];
    if (attemptedValue === undefined) continue;
    const inheritedValue = inheritedValues[key];
    if (inheritedValue !== undefined && profileValuesEqual(inheritedValue, attemptedValue)) {
      continue;
    }
    setOverrideValue(overrides, key, attemptedValue);
  }
  return overrides;
}

function resolveInheritedTechnicalValues(
  draft: WizardDraft,
  library: ProfileLibrary,
  baseProfile: BaseProfile,
  capabilities: AssetCapabilities,
): BaseProfileValues {
  const inheritedValues: MutableBaseProfileValues = {
    ...baseProfile.values,
    lightingDefaults: { ...baseProfile.values.lightingDefaults },
  };
  if (!("category" in draft) || draft.categoryProfileId === undefined) {
    return inheritedValues;
  }

  const categoryProfile = library.categoryProfiles.find(
    (profile) =>
      profile.id === draft.categoryProfileId &&
      profile.baseProfileId === baseProfile.id &&
      profile.category === draft.category &&
      profile.subtype === draft.subtype,
  );
  if (!categoryProfile) return inheritedValues;

  for (const key of PROFILE_VALUE_KEYS) {
    const value = categoryProfile.overrides[key];
    if (value === undefined || baseProfile.locks[key] === true) continue;
    if (key === "characterHeight" && !capabilities.scaledCharacter) continue;
    setOverrideValue(inheritedValues, key, value);
  }
  return inheritedValues;
}

function controlledAnswers(
  draft: WizardDraft,
  values: WizardCoreFormValues,
  selection: AssetSelection,
  capabilities: AssetCapabilities,
  inheritedCharacterDefaults: CharacterAnswers | undefined,
  inheritedMovingObjectDefaults: MovingObjectAnswers | undefined,
  inheritedTextureDefaults: TextureAnswers | undefined,
  inheritedNatureDefaults: NatureAnswers | undefined,
  inheritedStaticObjectDefaults: StaticObjectAnswers | undefined,
  inheritedBuildingDefaults: BuildingAnswers | undefined,
  inheritedTilesetDefaults: TilesetAnswers | undefined,
  inheritedItemDefaults: ItemAnswers | undefined,
  inheritedArtworkDefaults: ArtworkAnswers | undefined,
): Record<string, unknown> {
  const sameSelection = selectionsMatch(draft, selection);
  if (!sameSelection) return {};

  const previousAnswers = draft.answers as Readonly<Record<string, unknown>>;
  const answers = Object.fromEntries(
    Object.entries(previousAnswers).filter(
      ([key, value]) =>
        !CORE_CONTROLLED_ANSWER_KEYS.has(key) &&
        (selection.category !== "character" || !CHARACTER_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "movingObject" || !MOVING_OBJECT_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "texture" || !TEXTURE_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "nature" || !NATURE_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "staticObject" || !STATIC_OBJECT_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "building" || !BUILDING_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "tileset" || !TILESET_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "item" || !ITEM_CONTROLLED_ANSWER_KEYS.has(key)) &&
        (selection.category !== "artwork" || !ARTWORK_CONTROLLED_ANSWER_KEYS.has(key)) &&
        value !== undefined,
    ),
  );

  if (
    capabilities.directional &&
    values.directionCount !== undefined &&
    !optionalJsonValuesEqual(
      values.directionCount,
      selection.category === "character"
        ? inheritedCharacterDefaults?.directionCount
        : selection.category === "movingObject"
          ? inheritedMovingObjectDefaults?.directionCount
          : undefined,
    )
  ) {
    answers.directionCount = values.directionCount;
  }

  switch (selection.category) {
    case "character":
      for (const key of WIZARD_CHARACTER_DETAIL_FIELD_PATHS) {
        if (
          (CHARACTER_NPC_ANSWER_KEYS.has(key) && !isNpcContextSubtype(selection.subtype)) ||
          (CHARACTER_HUMANOID_ANSWER_KEYS.has(key) &&
            !isHumanoidCharacterSubtype(selection.subtype))
        ) {
          continue;
        }
        const value = values[key];
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(value, inheritedCharacterDefaults?.[key])
        ) {
          answers[key] = value;
        }
      }
      if (capabilities.animated) {
        const previousCharacterAnswers: CharacterAnswers =
          draft.category === "character" ? draft.answers : {};
        const animationActions = characterAnimationActionsFromForm(
          values.characterAnimationFrames,
          values.animationAction,
          previousCharacterAnswers,
        );
        const inheritedAnimationActions =
          inheritedCharacterDefaults === undefined
            ? undefined
            : characterAnimationActionsFromForm(
                characterAnimationFramesFromAnswers(inheritedCharacterDefaults),
                undefined,
                {},
              );
        if (
          animationActions !== undefined &&
          !optionalJsonValuesEqual(animationActions, inheritedAnimationActions)
        ) {
          answers.animationActions = animationActions;
        }
      }
      break;
    case "movingObject": {
      for (const [formField, answerField] of MOVING_OBJECT_SIMPLE_FIELD_MAPPINGS) {
        const value = movingObjectFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedMovingObjectDefaults === undefined
              ? undefined
              : movingObjectAnswerValue(inheritedMovingObjectDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }

      if (
        capabilities.footprint &&
        values.movingObjectFootprintWidthTiles !== undefined &&
        values.movingObjectFootprintDepthTiles !== undefined
      ) {
        const footprint = {
          widthTiles: values.movingObjectFootprintWidthTiles,
          depthTiles: values.movingObjectFootprintDepthTiles,
        };
        if (!optionalJsonValuesEqual(footprint, inheritedMovingObjectDefaults?.footprint)) {
          answers.footprint = footprint;
        }
      }

      if (capabilities.animated) {
        const previousMovingObjectAnswers: MovingObjectAnswers =
          draft.category === "movingObject" ? draft.answers : {};
        const animationSequences = movingObjectAnimationSequencesFromForm(
          values.movingObjectAnimationFrames,
          values.animationType,
          previousMovingObjectAnswers,
        );
        const inheritedAnimationSequences =
          inheritedMovingObjectDefaults === undefined
            ? undefined
            : movingObjectAnimationSequencesFromForm(
                movingObjectAnimationFramesFromAnswers(inheritedMovingObjectDefaults),
                undefined,
                {},
              );
        if (
          animationSequences !== undefined &&
          !optionalJsonValuesEqual(animationSequences, inheritedAnimationSequences)
        ) {
          answers.animationSequences = animationSequences;
        }
      }
      break;
    }
    case "staticObject": {
      for (const [formField, answerField] of STATIC_OBJECT_FIELD_MAPPINGS) {
        const value = staticObjectFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedStaticObjectDefaults === undefined
              ? undefined
              : staticObjectAnswerValue(inheritedStaticObjectDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }

      if (
        capabilities.footprint &&
        values.staticObjectFootprintWidthTiles !== undefined &&
        values.staticObjectFootprintDepthTiles !== undefined
      ) {
        const footprint = {
          widthTiles: values.staticObjectFootprintWidthTiles,
          depthTiles: values.staticObjectFootprintDepthTiles,
        };
        if (!optionalJsonValuesEqual(footprint, inheritedStaticObjectDefaults?.footprint)) {
          answers.footprint = footprint;
        }
      }

      if (
        capabilities.animated &&
        values.animationType !== undefined &&
        !optionalJsonValuesEqual(values.animationType, inheritedStaticObjectDefaults?.animationType)
      ) {
        answers.animationType = values.animationType;
      }
      break;
    }
    case "tileset": {
      const supportsEdges = tilesetSubtypeSupportsEdges(selection.subtype);
      const supportsCorners = tilesetSubtypeSupportsCorners(selection.subtype);
      const supportsTransitions = tilesetSubtypeSupportsTransitions(selection.subtype);

      for (const [formField, answerField] of TILESET_FIELD_MAPPINGS) {
        if (
          (!supportsEdges && (answerField === "edgeSet" || answerField === "edgeDetails")) ||
          (!supportsCorners && answerField === "cornerSet") ||
          (!supportsTransitions &&
            (answerField === "transitionMode" ||
              answerField === "sourceMaterial" ||
              answerField === "targetMaterial")) ||
          (answerField === "atlasColumns" && values.tilesetAtlasLayout !== "fixedColumns")
        ) {
          continue;
        }

        const value = tilesetFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedTilesetDefaults === undefined
              ? undefined
              : tilesetAnswerValue(inheritedTilesetDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }

      if (
        capabilities.animated &&
        values.animationType !== undefined &&
        !optionalJsonValuesEqual(values.animationType, inheritedTilesetDefaults?.animationType)
      ) {
        answers.animationType = values.animationType;
      }
      break;
    }
    case "nature": {
      for (const [formField, answerField] of NATURE_FIELD_MAPPINGS) {
        const value = natureFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedNatureDefaults === undefined
              ? undefined
              : natureAnswerValue(inheritedNatureDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }

      if (
        capabilities.footprint &&
        values.natureFootprintWidthTiles !== undefined &&
        values.natureFootprintDepthTiles !== undefined
      ) {
        const footprint = {
          widthTiles: values.natureFootprintWidthTiles,
          depthTiles: values.natureFootprintDepthTiles,
        };
        if (!optionalJsonValuesEqual(footprint, inheritedNatureDefaults?.footprint)) {
          answers.footprint = footprint;
        }
      }

      if (
        capabilities.animated &&
        values.animationType !== undefined &&
        !optionalJsonValuesEqual(values.animationType, inheritedNatureDefaults?.animationType)
      ) {
        answers.animationType = values.animationType;
      }
      break;
    }
    case "texture":
      for (const [formField, answerField] of TEXTURE_FIELD_MAPPINGS) {
        const value = textureFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedTextureDefaults === undefined
              ? undefined
              : textureAnswerValue(inheritedTextureDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }
      break;
    case "building": {
      for (const [formField, answerField] of BUILDING_FIELD_MAPPINGS) {
        const value = buildingFormValue(values, formField);
        if (
          !capabilities.modular &&
          (answerField === "modular" ||
            (answerField === "mappingMode" && value === "modularSet") ||
            (answerField === "planShape" && value === "modular"))
        ) {
          continue;
        }
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedBuildingDefaults === undefined
              ? undefined
              : buildingAnswerValue(inheritedBuildingDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }

      if (
        capabilities.footprint &&
        values.buildingFootprintWidthTiles !== undefined &&
        values.buildingFootprintDepthTiles !== undefined
      ) {
        const footprint = {
          widthTiles: values.buildingFootprintWidthTiles,
          depthTiles: values.buildingFootprintDepthTiles,
        };
        if (!optionalJsonValuesEqual(footprint, inheritedBuildingDefaults?.footprint)) {
          answers.footprint = footprint;
        }
      }

      if (
        capabilities.animated &&
        values.animationType !== undefined &&
        !optionalJsonValuesEqual(values.animationType, inheritedBuildingDefaults?.animationType)
      ) {
        answers.animationType = values.animationType;
      }
      break;
    }
    case "item":
      for (const [formField, answerField] of ITEM_FIELD_MAPPINGS) {
        if (answerField === "wearPosition" && !capabilities.wearable) continue;
        if (
          !capabilities.wearable &&
          ((answerField === "purpose" && values.itemPurpose === "wearable") ||
            (answerField === "presentation" && values.itemPresentation === "equipped"))
        ) {
          continue;
        }
        const value = itemFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedItemDefaults === undefined
              ? undefined
              : itemAnswerValue(inheritedItemDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }
      break;
    case "artwork":
      for (const [formField, answerField] of ARTWORK_FIELD_MAPPINGS) {
        const value = artworkFormValue(values, formField);
        if (
          value !== undefined &&
          !optionalJsonValuesEqual(
            value,
            inheritedArtworkDefaults === undefined
              ? undefined
              : artworkAnswerValue(inheritedArtworkDefaults, answerField),
          )
        ) {
          answers[answerField] = value;
        }
      }
      break;
  }

  if (selection.category !== "character") {
    const framesPerDirection = answers.framesPerDirection;
    const hasAnimation = answers.animationType !== undefined;
    if (
      !capabilities.directional ||
      values.directionCount === undefined ||
      (typeof framesPerDirection === "number" && framesPerDirection > 1 && !hasAnimation)
    ) {
      delete answers.framesPerDirection;
    }
  }

  return answers;
}

export interface UpdateWizardDraftFromCoreFormInput {
  readonly draft: WizardDraft;
  readonly values: WizardCoreFormValues;
  readonly stepId: WizardCoreStepId;
  readonly savedAt?: string;
  readonly context: WizardCoreDraftContext;
}

function selectedDraftRoute(
  stepId: WizardCoreStepId,
  hasBaseProfile: boolean,
): "wizard/profile" | "wizard/editor" {
  if (
    stepId === "characterDetails" ||
    stepId === "movingObjectDetails" ||
    stepId === "textureDetails" ||
    stepId === "natureDetails" ||
    stepId === "staticObjectDetails" ||
    stepId === "buildingDetails" ||
    stepId === "tilesetDetails" ||
    stepId === "itemDetails" ||
    stepId === "artworkDetails" ||
    stepId === "directions" ||
    stepId === "animation" ||
    stepId === "tileability"
  ) {
    if (!hasBaseProfile) {
      throw new WizardBaseProfileProjectionError({
        code: "baseProfileRequired",
      });
    }
    return "wizard/editor";
  }
  return "wizard/profile";
}

function parseSelectedDraft(
  selection: AssetSelection,
  common: Readonly<Record<string, unknown>>,
): SelectedWizardDraft {
  switch (selection.category) {
    case "character":
      return parseWizardDraft({
        ...common,
        category: "character",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "movingObject":
      return parseWizardDraft({
        ...common,
        category: "movingObject",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "staticObject":
      return parseWizardDraft({
        ...common,
        category: "staticObject",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "texture":
      return parseWizardDraft({
        ...common,
        category: "texture",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "nature":
      return parseWizardDraft({
        ...common,
        category: "nature",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "building":
      return parseWizardDraft({
        ...common,
        category: "building",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "tileset":
      return parseWizardDraft({
        ...common,
        category: "tileset",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "item":
      return parseWizardDraft({
        ...common,
        category: "item",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
    case "artwork":
      return parseWizardDraft({
        ...common,
        category: "artwork",
        subtype: selection.subtype,
      }) as SelectedWizardDraft;
  }
}

export function updateWizardDraftFromCoreForm(
  input: UpdateWizardDraftFromCoreFormInput,
): WizardDraft | null {
  const selection = getWizardAssetSelection(input.values);
  if (!selection) {
    if ("category" in input.draft) return null;

    const route = input.stepId === "project" ? "wizard/project" : "wizard/category";
    return parseWizardDraft({
      ...input.draft,
      projectName: input.values.projectName,
      route,
      currentStep: input.stepId,
      ...(input.savedAt === undefined ? {} : { savedAt: input.savedAt }),
    });
  }

  const sameSelection = selectionsMatch(input.draft, selection);
  const capabilities = resolveWizardCapabilities(input.values);
  if (!capabilities) {
    throw new RangeError("A valid wizard selection must resolve capabilities.");
  }
  const previousBaseProfileId =
    "baseProfileId" in input.draft ? input.draft.baseProfileId : undefined;
  const baseProfileId = input.values.baseProfileId;
  const baseProfileChanged = previousBaseProfileId !== baseProfileId;
  const profileLinksCanBeRetained = sameSelection && !baseProfileChanged;
  const baseProfile =
    baseProfileId === undefined
      ? undefined
      : input.context.library?.baseProfiles.find((profile) => profile.id === baseProfileId);
  if (baseProfileId !== undefined && input.context.library === null) {
    throw new WizardBaseProfileProjectionError({
      code: "profileLibraryUnavailable",
    });
  }
  if (baseProfileId !== undefined && baseProfile === undefined) {
    throw new WizardBaseProfileProjectionError({
      code: "missingBaseProfile",
      baseProfileId,
    });
  }

  const linkedCategoryProfileId =
    profileLinksCanBeRetained && "categoryProfileId" in input.draft
      ? input.draft.categoryProfileId
      : undefined;
  const linkedCategoryProfile =
    linkedCategoryProfileId === undefined
      ? undefined
      : input.context.library?.categoryProfiles.find(
          (profile) => profile.id === linkedCategoryProfileId,
        );
  const detachCharacterCategoryProfile =
    selection.category === "character" &&
    linkedCategoryProfile?.category === "character" &&
    clearsInheritedCharacterDefault(input.values, linkedCategoryProfile.defaults);
  const detachMovingObjectCategoryProfile =
    selection.category === "movingObject" &&
    linkedCategoryProfile?.category === "movingObject" &&
    clearsInheritedMovingObjectDefault(input.values, linkedCategoryProfile.defaults);
  const detachTextureCategoryProfile =
    selection.category === "texture" &&
    linkedCategoryProfile?.category === "texture" &&
    clearsInheritedTextureDefault(input.values, linkedCategoryProfile.defaults);
  const detachNatureCategoryProfile =
    selection.category === "nature" &&
    linkedCategoryProfile?.category === "nature" &&
    clearsInheritedNatureDefault(input.values, linkedCategoryProfile.defaults);
  const detachStaticObjectCategoryProfile =
    selection.category === "staticObject" &&
    linkedCategoryProfile?.category === "staticObject" &&
    clearsInheritedStaticObjectDefault(input.values, linkedCategoryProfile.defaults);
  const detachBuildingCategoryProfile =
    selection.category === "building" &&
    linkedCategoryProfile?.category === "building" &&
    clearsInheritedBuildingDefault(input.values, linkedCategoryProfile.defaults);
  const detachTilesetCategoryProfile =
    selection.category === "tileset" &&
    linkedCategoryProfile?.category === "tileset" &&
    clearsInheritedTilesetDefault(input.values, linkedCategoryProfile.defaults);
  const detachItemCategoryProfile =
    selection.category === "item" &&
    linkedCategoryProfile?.category === "item" &&
    clearsInheritedItemDefault(input.values, linkedCategoryProfile.defaults);
  const detachArtworkCategoryProfile =
    selection.category === "artwork" &&
    linkedCategoryProfile?.category === "artwork" &&
    clearsInheritedArtworkDefault(input.values, linkedCategoryProfile.defaults);
  const detachCategoryProfile =
    detachCharacterCategoryProfile ||
    detachMovingObjectCategoryProfile ||
    detachTextureCategoryProfile ||
    detachNatureCategoryProfile ||
    detachStaticObjectCategoryProfile ||
    detachBuildingCategoryProfile ||
    detachTilesetCategoryProfile ||
    detachItemCategoryProfile ||
    detachArtworkCategoryProfile;
  const retainedProfileLinks = profileLinksCanBeRetained && !detachCategoryProfile;

  let overrides = baseProfileChanged
    ? undefined
    : sanitizeOverrides(
        "overrides" in input.draft ? input.draft.overrides : undefined,
        capabilities,
      );
  if (baseProfile && sameSelection && input.context.library !== null) {
    overrides = technicalOverridesFromForm(
      input.values,
      baseProfileChanged || detachCategoryProfile
        ? baseProfile.values
        : resolveInheritedTechnicalValues(
            input.draft,
            input.context.library,
            baseProfile,
            capabilities,
          ),
      capabilities,
    );
  }

  const retainedCategoryProfile = retainedProfileLinks ? linkedCategoryProfile : undefined;
  const inheritedCharacterDefaults =
    selection.category === "character" && retainedCategoryProfile?.category === "character"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedMovingObjectDefaults =
    selection.category === "movingObject" && retainedCategoryProfile?.category === "movingObject"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedTextureDefaults =
    selection.category === "texture" && retainedCategoryProfile?.category === "texture"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedNatureDefaults =
    selection.category === "nature" && retainedCategoryProfile?.category === "nature"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedStaticObjectDefaults =
    selection.category === "staticObject" && retainedCategoryProfile?.category === "staticObject"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedBuildingDefaults =
    selection.category === "building" && retainedCategoryProfile?.category === "building"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedTilesetDefaults =
    selection.category === "tileset" && retainedCategoryProfile?.category === "tileset"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedItemDefaults =
    selection.category === "item" && retainedCategoryProfile?.category === "item"
      ? retainedCategoryProfile.defaults
      : undefined;
  const inheritedArtworkDefaults =
    selection.category === "artwork" && retainedCategoryProfile?.category === "artwork"
      ? retainedCategoryProfile.defaults
      : undefined;
  const common = {
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: input.draft.draftId,
    projectName: input.values.projectName,
    route: selectedDraftRoute(input.stepId, baseProfileId !== undefined),
    currentStep: input.stepId,
    ...(baseProfileId === undefined ? {} : { baseProfileId }),
    ...(retainedProfileLinks && input.draft.categoryProfileId !== undefined
      ? { categoryProfileId: input.draft.categoryProfileId }
      : {}),
    ...(retainedProfileLinks && input.draft.sourceAssetProfileId !== undefined
      ? { sourceAssetProfileId: input.draft.sourceAssetProfileId }
      : {}),
    ...(overrides === undefined ? {} : { overrides }),
    validation: retainedProfileLinks ? input.draft.validation : { errors: [], warnings: [] },
    savedAt: input.savedAt ?? input.draft.savedAt,
    answers: controlledAnswers(
      input.draft,
      input.values,
      selection,
      capabilities,
      inheritedCharacterDefaults,
      inheritedMovingObjectDefaults,
      inheritedTextureDefaults,
      inheritedNatureDefaults,
      inheritedStaticObjectDefaults,
      inheritedBuildingDefaults,
      inheritedTilesetDefaults,
      inheritedItemDefaults,
      inheritedArtworkDefaults,
    ),
  } as const;

  let candidate = parseSelectedDraft(selection, common);
  if (baseProfileId !== undefined && input.context.library !== null) {
    const resolution = resolveWizardDraftSnapshot(candidate, input.context.library);
    if (!resolution) {
      throw new WizardBaseProfileProjectionError({
        code: "incompatibleBaseProfile",
        baseProfileId,
        field: "characterHeight",
      });
    }
    if (resolution.status === "conflict") {
      throw new WizardBaseProfileProjectionError({
        code: "profileResolutionConflict",
        conflicts: resolution.conflicts,
      });
    }
    const normalizedOverrides = resolution.profile.normalizedOverrides.asset;
    const { overrides: _unresolvedOverrides, ...withoutOverrides } = candidate;
    void _unresolvedOverrides;
    candidate = parseSelectedDraft(selection, {
      ...withoutOverrides,
      ...(Object.keys(normalizedOverrides).length === 0 ? {} : { overrides: normalizedOverrides }),
    });
  }

  return candidate;
}
