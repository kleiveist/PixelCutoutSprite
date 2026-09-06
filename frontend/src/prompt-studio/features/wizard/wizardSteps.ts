import { z } from "zod";
import {
  ASSET_CATEGORY_IDS,
  ASSET_SUBTYPES,
  resolveCapabilities,
  type AssetCapabilities,
  type AssetCategory,
  type AssetSubtype,
} from "../../domain/assets";
import { CHARACTER_ANIMATION_ACTION_IDS } from "../../domain/characters";
import { getDefaultBuildingType, type BuildingSubtype } from "../../domain/buildings";
import { getDefaultItemClass, type ItemSubtype } from "../../domain/items";
import {
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  getDefaultMovingObjectClass,
} from "../../domain/moving-objects";
import { getDefaultTextureMaterialType, type TextureSubtype } from "../../domain/textures";
import {
  getDefaultNaturePlantType,
  natureSubtypeHasCrown,
  natureSubtypeHasRoots,
  natureSubtypeHasTrunk,
  type NatureSubtype,
} from "../../domain/nature";
import { getDefaultStaticObjectClass, type StaticObjectSubtype } from "../../domain/static-objects";
import {
  getDefaultTilesetType,
  tilesetSubtypeSupportsCorners,
  tilesetSubtypeSupportsEdges,
  tilesetSubtypeSupportsTransitions,
  type TilesetSubtype,
} from "../../domain/tilesets";
import {
  BaseProfileValuesSchema,
  ArtworkAnswersSchema,
  BuildingAnswersSchema,
  CharacterAnswersSchema,
  ItemAnswersSchema,
  MovingObjectAnswersSchema,
  NatureAnswersSchema,
  StaticObjectAnswersSchema,
  TextureAnswersSchema,
  TilesetAnswersSchema,
  type BaseProfileValues,
} from "../../schemas";

const ProjectNameSchema = z.string().trim().min(1, "Bitte gib einen Projektnamen ein.").max(120);

const AssetSubtypeSchema = z.union([
  z.enum(ASSET_SUBTYPES.character),
  z.enum(ASSET_SUBTYPES.movingObject),
  z.enum(ASSET_SUBTYPES.staticObject),
  z.enum(ASSET_SUBTYPES.texture),
  z.enum(ASSET_SUBTYPES.nature),
  z.enum(ASSET_SUBTYPES.building),
  z.enum(ASSET_SUBTYPES.tileset),
  z.enum(ASSET_SUBTYPES.item),
  z.enum(ASSET_SUBTYPES.artwork),
]);

const AnimationTypeSchema = z.enum([
  "idle",
  "move",
  "rotate",
  "interact",
  "openClose",
  "pulse",
  "glow",
  "break",
  "wind",
  "magic",
  "water",
  "lava",
  "custom",
]);

const {
  animationAction: _legacyCharacterAnimationAction,
  animationActions: _characterAnimationActions,
  directionCount: _characterDirectionCount,
  framesPerDirection: _legacyCharacterFrames,
  ...characterDetailFormShape
} = CharacterAnswersSchema.unwrap().shape;
void _legacyCharacterAnimationAction;
void _characterAnimationActions;
void _characterDirectionCount;
void _legacyCharacterFrames;

const CharacterAnimationFramesSchema = z
  .partialRecord(z.enum(CHARACTER_ANIMATION_ACTION_IDS), z.number().int().min(1).max(8))
  .optional();

const movingObjectAnswerShape = MovingObjectAnswersSchema.unwrap().shape;

const MovingObjectAnimationFramesSchema = z
  .partialRecord(z.enum(MOVING_OBJECT_ANIMATION_TYPE_IDS), z.number().int().min(1).max(16))
  .optional();

const textureAnswerShape = TextureAnswersSchema.unwrap().shape;
const natureAnswerShape = NatureAnswersSchema.unwrap().shape;
const staticObjectAnswerShape = StaticObjectAnswersSchema.unwrap().shape;
const buildingAnswerShape = BuildingAnswersSchema.unwrap().shape;
const tilesetAnswerShape = TilesetAnswersSchema.unwrap().shape;
const itemAnswerShape = ItemAnswersSchema.unwrap().shape;
const artworkAnswerShape = ArtworkAnswersSchema.unwrap().shape;

export const WizardCoreFormSchema = z.strictObject({
  projectName: ProjectNameSchema,
  category: z.enum(ASSET_CATEGORY_IDS).optional(),
  subtype: AssetSubtypeSchema.optional(),
  baseProfileId: z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9_-]*$/)
    .optional(),
  pixelDensity: z.enum(["classicHd", "modernHd", "ultraHd"]).optional(),
  styleProfile: z.enum(["classic", "dark", "both"]).optional(),
  tileSize: z.number().int().min(8).max(512).optional(),
  characterHeight: z.number().int().min(16).max(1024).optional(),
  perspectiveType: z.enum(["topdown", "threeQuarter", "isometric", "side"]).optional(),
  cameraAngle: z.union([z.literal(30), z.literal(45), z.literal(60)]).optional(),
  cameraDirection: z.enum(["southToNorth", "swToNe", "seToNw"]).optional(),
  projectionType: z.enum(["orthographic", "mildPerspective"]).optional(),
  outlineStyle: z.enum(["dark", "softSelective", "minimal"]).optional(),
  paletteMode: z.enum(["natural", "vivid", "desaturated", "byProfile"]).optional(),
  backgroundMode: z.enum(["transparent", "scene"]).optional(),
  alphaPadding: z.number().int().min(0).max(256).optional(),
  nearestNeighbor: z.boolean().optional(),
  lightingPolicy: z
    .enum([
      "adaptive",
      "neutralDay",
      "warmInterior",
      "gloomyDiffuse",
      "neutralNight",
      "coolNight",
      "custom",
    ])
    .optional(),
  lightingNotes: z.string().trim().max(2000).optional(),
  ...characterDetailFormShape,
  characterAnimationFrames: CharacterAnimationFramesSchema,
  movingObjectClass: movingObjectAnswerShape.objectClass,
  movingObjectPurpose: movingObjectAnswerShape.purpose,
  movingObjectBasicShape: movingObjectAnswerShape.basicShape,
  movingObjectDescription: movingObjectAnswerShape.subjectDescription,
  movingObjectFootprintWidthTiles: z.number().int().min(1).max(64).optional(),
  movingObjectFootprintDepthTiles: z.number().int().min(1).max(64).optional(),
  movingObjectHeightPixels: movingObjectAnswerShape.heightPixels,
  movingObjectAnchorMode: movingObjectAnswerShape.anchorMode,
  movingObjectMechanism: movingObjectAnswerShape.mechanism,
  movingObjectMaterial: movingObjectAnswerShape.material,
  movingObjectMaterialDetails: movingObjectAnswerShape.materialDetails,
  movingObjectCondition: movingObjectAnswerShape.condition,
  movingObjectLightingBehavior: movingObjectAnswerShape.lightingBehavior,
  movingObjectShadowMode: movingObjectAnswerShape.shadowMode,
  movingObjectExtraDetails: movingObjectAnswerShape.extraDetails,
  movingObjectAnimationFrames: MovingObjectAnimationFramesSchema,
  textureMaterialType: textureAnswerShape.materialType,
  textureUsage: textureAnswerShape.usage,
  textureDescription: textureAnswerShape.subjectDescription,
  textureStructure: textureAnswerShape.structure,
  textureCondition: textureAnswerShape.condition,
  textureSurface: textureAnswerShape.surface,
  textureMoisture: textureAnswerShape.moisture,
  textureIcing: textureAnswerShape.icing,
  textureLighting: textureAnswerShape.lighting,
  textureOrientation: textureAnswerShape.orientation,
  textureExtraDetails: textureAnswerShape.extraDetails,
  naturePlantType: natureAnswerShape.plantType,
  natureSpecies: natureAnswerShape.species,
  natureDescription: natureAnswerShape.subjectDescription,
  natureClimate: natureAnswerShape.climate,
  natureSeason: natureAnswerShape.season,
  natureAge: natureAnswerShape.age,
  natureSilhouette: natureAnswerShape.silhouette,
  natureTrunkThickness: natureAnswerShape.trunkThickness,
  natureTrunkShape: natureAnswerShape.trunkShape,
  natureTrunkDetails: natureAnswerShape.trunkDetails,
  natureCrownShape: natureAnswerShape.crownShape,
  natureCrownDensity: natureAnswerShape.crownDensity,
  natureFoliageDetails: natureAnswerShape.foliageDetails,
  natureRootVisibility: natureAnswerShape.rootVisibility,
  natureRootDetails: natureAnswerShape.rootDetails,
  natureMossCoverage: natureAnswerShape.mossCoverage,
  natureMushroomGrowth: natureAnswerShape.mushroomGrowth,
  natureSnowCover: natureAnswerShape.snowCover,
  natureVineGrowth: natureAnswerShape.vineGrowth,
  natureFootprintWidthTiles: z.number().int().min(1).max(64).optional(),
  natureFootprintDepthTiles: z.number().int().min(1).max(64).optional(),
  natureGrounding: natureAnswerShape.grounding,
  natureVariantCount: natureAnswerShape.variantCount,
  natureExtraDetails: natureAnswerShape.extraDetails,
  staticObjectClass: staticObjectAnswerShape.objectClass,
  staticObjectPurpose: staticObjectAnswerShape.purpose,
  staticObjectBasicShape: staticObjectAnswerShape.basicShape,
  staticObjectProportion: staticObjectAnswerShape.proportion,
  staticObjectSymmetry: staticObjectAnswerShape.symmetry,
  staticObjectDescription: staticObjectAnswerShape.subjectDescription,
  staticObjectPrimaryMaterial: staticObjectAnswerShape.primaryMaterial,
  staticObjectSecondaryMaterial: staticObjectAnswerShape.secondaryMaterial,
  staticObjectMaterialDetails: staticObjectAnswerShape.materialDetails,
  staticObjectCondition: staticObjectAnswerShape.condition,
  staticObjectDetailElements: staticObjectAnswerShape.detailElements,
  staticObjectContents: staticObjectAnswerShape.contents,
  staticObjectInteraction: staticObjectAnswerShape.interaction,
  staticObjectFootprintWidthTiles: z.number().int().min(1).max(64).optional(),
  staticObjectFootprintDepthTiles: z.number().int().min(1).max(64).optional(),
  staticObjectShadowMode: staticObjectAnswerShape.shadowMode,
  staticObjectVariantCount: staticObjectAnswerShape.variantCount,
  staticObjectExtraDetails: staticObjectAnswerShape.extraDetails,
  buildingType: buildingAnswerShape.buildingType,
  buildingPurpose: buildingAnswerShape.purpose,
  buildingDescription: buildingAnswerShape.subjectDescription,
  buildingPlanShape: buildingAnswerShape.planShape,
  buildingSize: buildingAnswerShape.size,
  buildingFootprintWidthTiles: z.number().int().min(1).max(64).optional(),
  buildingFootprintDepthTiles: z.number().int().min(1).max(64).optional(),
  buildingHeightPixels: buildingAnswerShape.heightPixels,
  buildingFloors: buildingAnswerShape.floors,
  buildingPrimaryMaterial: buildingAnswerShape.primaryMaterial,
  buildingSecondaryMaterial: buildingAnswerShape.secondaryMaterial,
  buildingMaterialDetails: buildingAnswerShape.materialDetails,
  buildingRoofShape: buildingAnswerShape.roofShape,
  buildingRoofPitch: buildingAnswerShape.roofPitch,
  buildingRoofMaterial: buildingAnswerShape.roofMaterial,
  buildingRoofCondition: buildingAnswerShape.roofCondition,
  buildingRoofDetails: buildingAnswerShape.roofDetails,
  buildingFacadeStyle: buildingAnswerShape.facadeStyle,
  buildingFacadeDetails: buildingAnswerShape.facadeDetails,
  buildingDoorCount: buildingAnswerShape.doorCount,
  buildingDoorType: buildingAnswerShape.doorType,
  buildingDoorPosition: buildingAnswerShape.doorPosition,
  buildingDoorState: buildingAnswerShape.doorState,
  buildingWindowCount: buildingAnswerShape.windowCount,
  buildingWindowShape: buildingAnswerShape.windowShape,
  buildingWindowLighting: buildingAnswerShape.windowLighting,
  buildingWindowDetails: buildingAnswerShape.windowDetails,
  buildingCondition: buildingAnswerShape.condition,
  buildingOccupancy: buildingAnswerShape.occupancy,
  buildingEnvironment: buildingAnswerShape.environment,
  buildingMappingMode: buildingAnswerShape.mappingMode,
  buildingCollisionMode: buildingAnswerShape.collisionMode,
  buildingModular: buildingAnswerShape.modular,
  buildingLighting: buildingAnswerShape.lighting,
  buildingLightSourceDetails: buildingAnswerShape.lightSourceDetails,
  buildingExtraDetails: buildingAnswerShape.extraDetails,
  tilesetType: tilesetAnswerShape.tilesetType,
  tilesetUsage: tilesetAnswerShape.tileUsage,
  tilesetDescription: tilesetAnswerShape.subjectDescription,
  tilesetEdgeSet: tilesetAnswerShape.edgeSet,
  tilesetEdgeDetails: tilesetAnswerShape.edgeDetails,
  tilesetCornerSet: tilesetAnswerShape.cornerSet,
  tilesetTransitionMode: tilesetAnswerShape.transitionMode,
  tilesetSourceMaterial: tilesetAnswerShape.sourceMaterial,
  tilesetTargetMaterial: tilesetAnswerShape.targetMaterial,
  tilesetSeamMode: tilesetAnswerShape.seamMode,
  tilesetSeamDetails: tilesetAnswerShape.seamDetails,
  tilesetRepeatMode: tilesetAnswerShape.repeatMode,
  tilesetVariantCount: tilesetAnswerShape.variantCount,
  tilesetVariantKinds: tilesetAnswerShape.variantKinds,
  tilesetAtlasLayout: tilesetAnswerShape.atlasLayout,
  tilesetAtlasTileCount: tilesetAnswerShape.atlasTileCount,
  tilesetAtlasColumns: tilesetAnswerShape.atlasColumns,
  tilesetAtlasGutterPixels: tilesetAnswerShape.atlasGutterPixels,
  tilesetAtlasMarginPixels: tilesetAnswerShape.atlasMarginPixels,
  tilesetExtraDetails: tilesetAnswerShape.extraDetails,
  itemClass: itemAnswerShape.itemClass,
  itemPurpose: itemAnswerShape.purpose,
  itemPresentation: itemAnswerShape.presentation,
  itemWearPosition: itemAnswerShape.wearPosition,
  itemIconSize: itemAnswerShape.iconSize,
  itemSize: itemAnswerShape.size,
  itemDescription: itemAnswerShape.subjectDescription,
  itemPrimaryMaterial: itemAnswerShape.primaryMaterial,
  itemSecondaryMaterial: itemAnswerShape.secondaryMaterial,
  itemMaterialDetails: itemAnswerShape.materialDetails,
  itemCondition: itemAnswerShape.condition,
  itemFunctionDetails: itemAnswerShape.functionDetails,
  itemSignificance: itemAnswerShape.significance,
  itemMeaningDetails: itemAnswerShape.meaningDetails,
  itemSilhouette: itemAnswerShape.silhouette,
  itemReadability: itemAnswerShape.readability,
  itemGlowMode: itemAnswerShape.glowMode,
  itemShadowMode: itemAnswerShape.shadowMode,
  itemVariantCount: itemAnswerShape.variantCount,
  itemExtraDetails: itemAnswerShape.extraDetails,
  artworkPurpose: artworkAnswerShape.purpose,
  artworkMotif: artworkAnswerShape.motif,
  artworkDescription: artworkAnswerShape.subjectDescription,
  artworkSceneDescription: artworkAnswerShape.sceneDescription,
  artworkComposition: artworkAnswerShape.composition,
  artworkCompositionDetails: artworkAnswerShape.compositionDetails,
  artworkFormat: artworkAnswerShape.format,
  artworkBackground: artworkAnswerShape.background,
  artworkBackgroundDetails: artworkAnswerShape.backgroundDetails,
  artworkFocus: artworkAnswerShape.focus,
  artworkLightingDrama: artworkAnswerShape.lightingDrama,
  artworkLightingDetails: artworkAnswerShape.lightingDetails,
  artworkDetailLevel: artworkAnswerShape.detailLevel,
  artworkExtraDetails: artworkAnswerShape.extraDetails,
  directionCount: z.union([z.literal(4), z.literal(8)]).optional(),
  animationAction: z.enum(CHARACTER_ANIMATION_ACTION_IDS).optional(),
  animationType: AnimationTypeSchema.optional(),
  movementType: movingObjectAnswerShape.movementType,
  seamless: textureAnswerShape.seamless,
  tileableAxes: tilesetAnswerShape.tileableAxes,
});

export type WizardCoreFormValues = z.infer<typeof WizardCoreFormSchema>;
export type WizardCoreFieldPath = keyof WizardCoreFormValues;
export type WizardCoreStepId =
  | "project"
  | "category"
  | "baseProfile"
  | "characterDetails"
  | "movingObjectDetails"
  | "textureDetails"
  | "natureDetails"
  | "staticObjectDetails"
  | "buildingDetails"
  | "tilesetDetails"
  | "itemDetails"
  | "artworkDetails"
  | "directions"
  | "animation"
  | "tileability";

function subtypeMatchesCategory(category: AssetCategory, subtype: AssetSubtype): boolean {
  const knownSubtypes: readonly string[] = ASSET_SUBTYPES[category];
  return knownSubtypes.includes(subtype);
}

interface WizardCoreSelection {
  readonly category: AssetCategory;
  readonly subtype: AssetSubtype;
  readonly capabilities: AssetCapabilities;
}

export const WIZARD_TECHNICAL_FIELD_PATHS = Object.freeze([
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
  "lightingPolicy",
  "lightingNotes",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_CHARACTER_DETAIL_FIELD_PATHS = Object.freeze([
  "role",
  "subjectDescription",
  "variantCount",
  "genderPresentation",
  "age",
  "relativeHeight",
  "bodyBuild",
  "posture",
  "faceShape",
  "skinTone",
  "eyeVisibility",
  "hair",
  "hairstyle",
  "beard",
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
  "accessories",
  "backItem",
  "equipment",
  "materials",
  "characterPaletteSource",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "condition",
  "expression",
  "silhouette",
  "pose",
  "professionReadable",
  "socialRole",
  "wealth",
  "culturalFunction",
  "typicalActivity",
  "conversationGesture",
  "everydayTool",
  "frontBackDetails",
  "extraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS = Object.freeze([
  "movingObjectClass",
  "movingObjectPurpose",
  "movingObjectBasicShape",
  "movingObjectDescription",
  "movingObjectFootprintWidthTiles",
  "movingObjectFootprintDepthTiles",
  "movingObjectHeightPixels",
  "movingObjectAnchorMode",
  "movementType",
  "movingObjectMechanism",
  "movingObjectMaterial",
  "movingObjectMaterialDetails",
  "movingObjectCondition",
  "movingObjectLightingBehavior",
  "movingObjectShadowMode",
  "movingObjectExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_TEXTURE_DETAIL_FIELD_PATHS = Object.freeze([
  "textureMaterialType",
  "textureUsage",
  "textureDescription",
  "seamless",
  "textureStructure",
  "textureCondition",
  "textureSurface",
  "textureMoisture",
  "textureIcing",
  "textureLighting",
  "textureOrientation",
  "textureExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_NATURE_DETAIL_FIELD_PATHS = Object.freeze([
  "naturePlantType",
  "natureSpecies",
  "natureDescription",
  "natureClimate",
  "natureSeason",
  "natureAge",
  "natureSilhouette",
  "natureTrunkThickness",
  "natureTrunkShape",
  "natureTrunkDetails",
  "natureCrownShape",
  "natureCrownDensity",
  "natureFoliageDetails",
  "natureRootVisibility",
  "natureRootDetails",
  "natureMossCoverage",
  "natureMushroomGrowth",
  "natureSnowCover",
  "natureVineGrowth",
  "natureFootprintWidthTiles",
  "natureFootprintDepthTiles",
  "natureGrounding",
  "natureVariantCount",
  "natureExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS = Object.freeze([
  "staticObjectClass",
  "staticObjectPurpose",
  "staticObjectBasicShape",
  "staticObjectProportion",
  "staticObjectSymmetry",
  "staticObjectDescription",
  "staticObjectPrimaryMaterial",
  "staticObjectSecondaryMaterial",
  "staticObjectMaterialDetails",
  "staticObjectCondition",
  "staticObjectDetailElements",
  "staticObjectContents",
  "staticObjectInteraction",
  "staticObjectFootprintWidthTiles",
  "staticObjectFootprintDepthTiles",
  "staticObjectShadowMode",
  "staticObjectVariantCount",
  "staticObjectExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_BUILDING_DETAIL_FIELD_PATHS = Object.freeze([
  "buildingType",
  "buildingPurpose",
  "buildingDescription",
  "buildingPlanShape",
  "buildingSize",
  "buildingFootprintWidthTiles",
  "buildingFootprintDepthTiles",
  "buildingHeightPixels",
  "buildingFloors",
  "buildingPrimaryMaterial",
  "buildingSecondaryMaterial",
  "buildingMaterialDetails",
  "buildingRoofShape",
  "buildingRoofPitch",
  "buildingRoofMaterial",
  "buildingRoofCondition",
  "buildingRoofDetails",
  "buildingFacadeStyle",
  "buildingFacadeDetails",
  "buildingDoorCount",
  "buildingDoorType",
  "buildingDoorPosition",
  "buildingDoorState",
  "buildingWindowCount",
  "buildingWindowShape",
  "buildingWindowLighting",
  "buildingWindowDetails",
  "buildingCondition",
  "buildingOccupancy",
  "buildingEnvironment",
  "buildingMappingMode",
  "buildingCollisionMode",
  "buildingModular",
  "buildingLighting",
  "buildingLightSourceDetails",
  "buildingExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_TILESET_DETAIL_FIELD_PATHS = Object.freeze([
  "tilesetType",
  "tilesetUsage",
  "tilesetDescription",
  "tilesetEdgeSet",
  "tilesetEdgeDetails",
  "tilesetCornerSet",
  "tilesetTransitionMode",
  "tilesetSourceMaterial",
  "tilesetTargetMaterial",
  "tilesetSeamMode",
  "tilesetSeamDetails",
  "tileableAxes",
  "tilesetRepeatMode",
  "tilesetVariantCount",
  "tilesetVariantKinds",
  "tilesetAtlasLayout",
  "tilesetAtlasTileCount",
  "tilesetAtlasColumns",
  "tilesetAtlasGutterPixels",
  "tilesetAtlasMarginPixels",
  "tilesetExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_ITEM_DETAIL_FIELD_PATHS = Object.freeze([
  "itemClass",
  "itemPurpose",
  "itemPresentation",
  "itemWearPosition",
  "itemIconSize",
  "itemSize",
  "itemDescription",
  "itemPrimaryMaterial",
  "itemSecondaryMaterial",
  "itemMaterialDetails",
  "itemCondition",
  "itemFunctionDetails",
  "itemSignificance",
  "itemMeaningDetails",
  "itemSilhouette",
  "itemReadability",
  "itemGlowMode",
  "itemShadowMode",
  "itemVariantCount",
  "itemExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

export const WIZARD_ARTWORK_DETAIL_FIELD_PATHS = Object.freeze([
  "artworkPurpose",
  "artworkMotif",
  "artworkDescription",
  "artworkSceneDescription",
  "artworkComposition",
  "artworkCompositionDetails",
  "artworkFormat",
  "artworkBackground",
  "artworkBackgroundDetails",
  "artworkFocus",
  "artworkLightingDrama",
  "artworkLightingDetails",
  "artworkDetailLevel",
  "artworkExtraDetails",
] as const satisfies readonly WizardCoreFieldPath[]);

const ANIMATION_TYPES_BY_CATEGORY: Readonly<Partial<Record<AssetCategory, readonly string[]>>> =
  Object.freeze({
    movingObject: Object.freeze(["idle", "move", "rotate", "interact", "openClose", "pulse"]),
    staticObject: Object.freeze(["openClose", "glow", "break", "custom"]),
    nature: Object.freeze(["wind", "magic", "custom"]),
    building: Object.freeze(["openClose", "custom"]),
    tileset: Object.freeze(["water", "lava", "magic", "custom"]),
  });

function resolveCoreCapabilities(
  category: AssetCategory,
  subtype: AssetSubtype,
): AssetCapabilities {
  switch (category) {
    case "character":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.character)[number]);
    case "movingObject":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.movingObject)[number]);
    case "staticObject":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.staticObject)[number]);
    case "texture":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.texture)[number]);
    case "nature":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.nature)[number]);
    case "building":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.building)[number]);
    case "tileset":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.tileset)[number]);
    case "item":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.item)[number]);
    case "artwork":
      return resolveCapabilities(category, subtype as (typeof ASSET_SUBTYPES.artwork)[number]);
  }
}

function requireSelection(
  values: WizardCoreFormValues,
  context: z.RefinementCtx,
): WizardCoreSelection | null {
  if (values.category === undefined) {
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: "Bitte wähle zuerst eine Asset-Kategorie.",
    });
    return null;
  }

  if (values.subtype === undefined) {
    context.addIssue({
      code: "custom",
      path: ["subtype"],
      message: "Bitte wähle einen Untertyp.",
    });
    return null;
  }

  if (!subtypeMatchesCategory(values.category, values.subtype)) {
    context.addIssue({
      code: "custom",
      path: ["subtype"],
      message: "Der Untertyp gehört nicht zur gewählten Asset-Kategorie.",
    });
    return null;
  }

  return {
    category: values.category,
    subtype: values.subtype,
    capabilities: resolveCoreCapabilities(values.category, values.subtype),
  };
}

function addFieldIssue(
  context: z.RefinementCtx,
  field: WizardCoreFieldPath,
  message: string,
): void {
  context.addIssue({ code: "custom", path: [field], message });
}

export function parseWizardTechnicalFormValues(
  values: WizardCoreFormValues,
): BaseProfileValues | null {
  const result = BaseProfileValuesSchema.safeParse({
    pixelDensity: values.pixelDensity,
    styleProfile: values.styleProfile,
    tileSize: values.tileSize,
    ...(values.characterHeight === undefined ? {} : { characterHeight: values.characterHeight }),
    perspectiveType: values.perspectiveType,
    cameraAngle: values.cameraAngle,
    cameraDirection: values.cameraDirection,
    projectionType: values.projectionType,
    outlineStyle: values.outlineStyle,
    paletteMode: values.paletteMode,
    backgroundMode: values.backgroundMode,
    alphaPadding: values.alphaPadding,
    nearestNeighbor: values.nearestNeighbor,
    lightingDefaults: {
      policy: values.lightingPolicy,
      notes: values.lightingNotes,
    },
  });

  return result.success ? result.data : null;
}

function validateCapabilityFields(
  values: WizardCoreFormValues,
  selection: WizardCoreSelection,
  context: z.RefinementCtx,
): void {
  const { capabilities, category } = selection;

  if (values.directionCount !== undefined && !capabilities.directional) {
    addFieldIssue(
      context,
      "directionCount",
      "Richtungen sind für diesen Untertyp nicht verfügbar.",
    );
  }
  if (
    values.animationAction !== undefined &&
    (category !== "character" || !capabilities.animated)
  ) {
    addFieldIssue(
      context,
      "animationAction",
      "Figurenaktionen sind für diesen Untertyp nicht verfügbar.",
    );
  }
  if (
    values.characterAnimationFrames !== undefined &&
    (category !== "character" || !capabilities.animated)
  ) {
    addFieldIssue(
      context,
      "characterAnimationFrames",
      "Figurenaktionen sind für diesen Untertyp nicht verfügbar.",
    );
  }
  for (const field of WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "movingObject") {
      addFieldIssue(
        context,
        field,
        "Bewegungsobjekt-Daten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_TEXTURE_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "texture") {
      addFieldIssue(
        context,
        field,
        "Textur- und Materialdaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_NATURE_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "nature") {
      addFieldIssue(
        context,
        field,
        "Natur- und Pflanzendaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "staticObject") {
      addFieldIssue(
        context,
        field,
        "Daten für statische Weltobjekte gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_BUILDING_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "building") {
      addFieldIssue(
        context,
        field,
        "Gebäude- und Architekturdaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_TILESET_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "tileset") {
      addFieldIssue(
        context,
        field,
        "Tileset- und Mappingdaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_ITEM_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "item") {
      addFieldIssue(
        context,
        field,
        "Item- und Ausrüstungsdaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  for (const field of WIZARD_ARTWORK_DETAIL_FIELD_PATHS) {
    if (values[field] !== undefined && category !== "artwork") {
      addFieldIssue(
        context,
        field,
        "Artwork- und Konzeptdaten gehören nicht zur gewählten Asset-Kategorie.",
      );
    }
  }
  if (
    values.movingObjectAnimationFrames !== undefined &&
    (category !== "movingObject" || !capabilities.animated)
  ) {
    addFieldIssue(
      context,
      "movingObjectAnimationFrames",
      "Bewegungsobjekt-Sequenzen sind für diesen Untertyp nicht verfügbar.",
    );
  }
  if (values.movementType !== undefined && (category !== "movingObject" || !capabilities.movable)) {
    addFieldIssue(
      context,
      "movementType",
      "Diese Bewegungsart gehört nicht zum gewählten Untertyp.",
    );
  }
  if (category === "movingObject") {
    const width = values.movingObjectFootprintWidthTiles;
    const depth = values.movingObjectFootprintDepthTiles;
    if (width !== undefined && depth === undefined) {
      addFieldIssue(
        context,
        "movingObjectFootprintDepthTiles",
        "Ergänze zur Breite auch die Tiefe der Standfläche.",
      );
    }
    if (depth !== undefined && width === undefined) {
      addFieldIssue(
        context,
        "movingObjectFootprintWidthTiles",
        "Ergänze zur Tiefe auch die Breite der Standfläche.",
      );
    }
    if (
      values.movingObjectClass !== undefined &&
      values.movingObjectClass !==
        getDefaultMovingObjectClass(
          selection.subtype as (typeof ASSET_SUBTYPES.movingObject)[number],
        )
    ) {
      addFieldIssue(
        context,
        "movingObjectClass",
        "Die Objektklasse passt nicht zum gewählten Untertyp.",
      );
    }
  }
  if (
    category === "texture" &&
    values.textureMaterialType !== undefined &&
    values.textureMaterialType !==
      getDefaultTextureMaterialType(selection.subtype as TextureSubtype)
  ) {
    addFieldIssue(
      context,
      "textureMaterialType",
      "Der Materialtyp passt nicht zum gewählten Textur-Untertyp.",
    );
  }
  if (category === "nature") {
    const natureSubtype = selection.subtype as NatureSubtype;
    const width = values.natureFootprintWidthTiles;
    const depth = values.natureFootprintDepthTiles;
    if (width !== undefined && depth === undefined) {
      addFieldIssue(
        context,
        "natureFootprintDepthTiles",
        "Ergänze zur Breite auch die Tiefe der Standfläche.",
      );
    }
    if (depth !== undefined && width === undefined) {
      addFieldIssue(
        context,
        "natureFootprintWidthTiles",
        "Ergänze zur Tiefe auch die Breite der Standfläche.",
      );
    }
    if (
      values.naturePlantType !== undefined &&
      values.naturePlantType !== getDefaultNaturePlantType(natureSubtype)
    ) {
      addFieldIssue(
        context,
        "subtype",
        "Der abgeleitete Pflanzentyp passt nicht zum gewählten Natur-Untertyp. Bitte bestätige oder korrigiere den Untertyp.",
      );
    }
    if (!natureSubtypeHasTrunk(natureSubtype)) {
      for (const field of [
        "natureTrunkThickness",
        "natureTrunkShape",
        "natureTrunkDetails",
      ] as const) {
        if (values[field] !== undefined) {
          addFieldIssue(
            context,
            field,
            "Stammdaten sind für diesen Natur-Untertyp nicht verfügbar.",
          );
        }
      }
    }
    if (!natureSubtypeHasCrown(natureSubtype)) {
      for (const field of [
        "natureCrownShape",
        "natureCrownDensity",
        "natureFoliageDetails",
      ] as const) {
        if (values[field] !== undefined) {
          addFieldIssue(
            context,
            field,
            "Kronendaten sind für diesen Natur-Untertyp nicht verfügbar.",
          );
        }
      }
    }
    if (!natureSubtypeHasRoots(natureSubtype)) {
      for (const field of ["natureRootVisibility", "natureRootDetails"] as const) {
        if (values[field] !== undefined) {
          addFieldIssue(
            context,
            field,
            "Wurzeldaten sind für diesen Natur-Untertyp nicht verfügbar.",
          );
        }
      }
    }
  }
  if (category === "staticObject") {
    const staticObjectSubtype = selection.subtype as StaticObjectSubtype;
    const width = values.staticObjectFootprintWidthTiles;
    const depth = values.staticObjectFootprintDepthTiles;
    if (width !== undefined && depth === undefined) {
      addFieldIssue(
        context,
        "staticObjectFootprintDepthTiles",
        "Ergänze zur Breite auch die Tiefe der Standfläche.",
      );
    }
    if (depth !== undefined && width === undefined) {
      addFieldIssue(
        context,
        "staticObjectFootprintWidthTiles",
        "Ergänze zur Tiefe auch die Breite der Standfläche.",
      );
    }
    if (
      values.staticObjectClass !== undefined &&
      values.staticObjectClass !== getDefaultStaticObjectClass(staticObjectSubtype)
    ) {
      addFieldIssue(
        context,
        "subtype",
        "Die abgeleitete Objektklasse passt nicht zum gewählten Untertyp. Bitte bestätige oder korrigiere den Untertyp.",
      );
    }
  }
  if (category === "building") {
    const buildingSubtype = selection.subtype as BuildingSubtype;
    const width = values.buildingFootprintWidthTiles;
    const depth = values.buildingFootprintDepthTiles;
    if (width !== undefined && depth === undefined) {
      addFieldIssue(
        context,
        "buildingFootprintDepthTiles",
        "Ergänze zur Breite auch die Tiefe des Gebäude-Footprints.",
      );
    }
    if (depth !== undefined && width === undefined) {
      addFieldIssue(
        context,
        "buildingFootprintWidthTiles",
        "Ergänze zur Tiefe auch die Breite des Gebäude-Footprints.",
      );
    }
    if (
      values.buildingType !== undefined &&
      values.buildingType !== getDefaultBuildingType(buildingSubtype)
    ) {
      addFieldIssue(
        context,
        "subtype",
        "Der abgeleitete Gebäudetyp passt nicht zum gewählten Untertyp. Bitte bestätige oder korrigiere den Untertyp.",
      );
    }
    if (
      (values.buildingModular === true ||
        values.buildingMappingMode === "modularSet" ||
        values.buildingPlanShape === "modular") &&
      !selection.capabilities.modular
    ) {
      addFieldIssue(
        context,
        values.buildingModular === true
          ? "buildingModular"
          : values.buildingPlanShape === "modular"
            ? "buildingPlanShape"
            : "buildingMappingMode",
        "Ein modularer Gebäudesatz ist für diesen Untertyp nicht verfügbar.",
      );
    }
  }
  if (category === "tileset") {
    const tilesetSubtype = selection.subtype as TilesetSubtype;
    if (
      values.tilesetType !== undefined &&
      values.tilesetType !== getDefaultTilesetType(tilesetSubtype)
    ) {
      addFieldIssue(
        context,
        "subtype",
        "Der abgeleitete Tiletyp passt nicht zum gewählten Tileset-Untertyp. Bitte bestätige oder korrigiere den Untertyp.",
      );
    }

    const rejectIrrelevantFields = (
      fields: readonly WizardCoreFieldPath[],
      relevant: boolean,
      message: string,
    ): void => {
      if (relevant) return;
      for (const field of fields) {
        if (values[field] !== undefined) {
          addFieldIssue(context, field, message);
        }
      }
    };

    rejectIrrelevantFields(
      ["tilesetEdgeSet", "tilesetEdgeDetails"],
      tilesetSubtypeSupportsEdges(tilesetSubtype),
      "Kantensets sind für diesen Tileset-Untertyp nicht verfügbar.",
    );
    rejectIrrelevantFields(
      ["tilesetCornerSet"],
      tilesetSubtypeSupportsCorners(tilesetSubtype),
      "Innen-/Außenecken sind für diesen Tileset-Untertyp nicht verfügbar.",
    );
    rejectIrrelevantFields(
      ["tilesetTransitionMode", "tilesetSourceMaterial", "tilesetTargetMaterial"],
      tilesetSubtypeSupportsTransitions(tilesetSubtype),
      "Materialübergänge sind für diesen Tileset-Untertyp nicht verfügbar.",
    );

    if (values.tilesetAtlasLayout === "fixedColumns" && values.tilesetAtlasColumns === undefined) {
      addFieldIssue(
        context,
        "tilesetAtlasColumns",
        "Gib für das feste Atlaslayout eine Spaltenzahl an.",
      );
    }
    if (values.tilesetAtlasColumns !== undefined && values.tilesetAtlasLayout !== "fixedColumns") {
      addFieldIssue(
        context,
        "tilesetAtlasColumns",
        "Eine feste Spaltenzahl ist nur beim entsprechenden Atlaslayout gültig.",
      );
    }
    if (
      values.tilesetRepeatMode === "nonRepeating" &&
      values.tileableAxes !== undefined &&
      values.tileableAxes !== "none"
    ) {
      addFieldIssue(
        context,
        "tileableAxes",
        "Ein nicht wiederholendes Tileset kann auf keiner Achse kachelbar sein.",
      );
    }
  }
  if (
    category === "item" &&
    values.itemClass !== undefined &&
    values.itemClass !== getDefaultItemClass(selection.subtype as ItemSubtype)
  ) {
    addFieldIssue(
      context,
      "subtype",
      "Die abgeleitete Itemklasse passt nicht zum gewählten Untertyp. Bitte bestätige oder korrigiere den Untertyp.",
    );
  }
  if (category === "item" && !capabilities.wearable) {
    if (values.itemWearPosition !== undefined) {
      addFieldIssue(
        context,
        "itemWearPosition",
        "Eine Trageposition ist nur für tragbare Item-Untertypen verfügbar.",
      );
    }
    if (values.itemPurpose === "wearable") {
      addFieldIssue(
        context,
        "itemPurpose",
        "Der Zweck „tragbar“ ist für diesen Item-Untertyp nicht verfügbar.",
      );
    }
    if (values.itemPresentation === "equipped") {
      addFieldIssue(
        context,
        "itemPresentation",
        "Eine ausgerüstete Darstellung ist nur für tragbare Item-Untertypen verfügbar.",
      );
    }
  }
  if (values.animationType !== undefined) {
    const allowedAnimationTypes = ANIMATION_TYPES_BY_CATEGORY[category];
    if (
      !capabilities.animated ||
      allowedAnimationTypes === undefined ||
      !allowedAnimationTypes.includes(values.animationType)
    ) {
      addFieldIssue(
        context,
        "animationType",
        "Diese Animationsart gehört nicht zum gewählten Untertyp.",
      );
    }
  }
  if (values.seamless !== undefined && category === "texture" && !capabilities.tileable) {
    addFieldIssue(
      context,
      "seamless",
      "Nahtlose Wiederholung ist für diesen Untertyp nicht verfügbar.",
    );
  }
  if (values.tileableAxes !== undefined && category === "tileset" && !capabilities.tileable) {
    addFieldIssue(
      context,
      "tileableAxes",
      "Kachelbare Achsen gehören nicht zum gewählten Untertyp.",
    );
  }
}

function refineSelectedValues(
  values: WizardCoreFormValues,
  context: z.RefinementCtx,
  requiredCapability?: "directional" | "animated" | "tileable",
  requireBaseProfile = false,
): void {
  const selection = requireSelection(values, context);
  if (!selection) return;

  validateCapabilityFields(values, selection, context);
  if (requireBaseProfile) {
    if (values.baseProfileId === undefined) {
      addFieldIssue(
        context,
        "baseProfileId",
        "Bitte wähle ein Basisprofil oder lege eine neue Produktionsfamilie an.",
      );
    }
    if (parseWizardTechnicalFormValues(values) === null) {
      addFieldIssue(
        context,
        "baseProfileId",
        "Das Basisprofil benötigt vollständige gültige Produktionswerte.",
      );
    }
    if (selection.capabilities.scaledCharacter && values.characterHeight === undefined) {
      addFieldIssue(
        context,
        "characterHeight",
        "Für Figuren und figurähnliche Assets ist eine Figurenhöhe erforderlich.",
      );
    }
  }
  if (requiredCapability !== undefined && !selection.capabilities[requiredCapability]) {
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: `Dieser Untertyp unterstützt den Schritt „${requiredCapability}“ nicht.`,
    });
  }
}

export const WizardProjectStepSchema = WizardCoreFormSchema;
export const WizardCategoryStepSchema = WizardCoreFormSchema.superRefine((values, context) =>
  refineSelectedValues(values, context),
);
export const WizardBaseProfileStepSchema = WizardCoreFormSchema.superRefine((values, context) =>
  refineSelectedValues(values, context, undefined, true),
);
export const WizardCharacterDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "character") {
      addFieldIssue(context, "category", "Der Figuren-Editor ist nur für Charaktere verfügbar.");
    }
  },
);
export const WizardMovingObjectDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "movingObject") {
      addFieldIssue(
        context,
        "category",
        "Der Bewegungsobjekt-Editor ist nur für bewegliche Objekte verfügbar.",
      );
    }
  },
);
export const WizardTextureDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "texture") {
      addFieldIssue(
        context,
        "category",
        "Der Textur-Editor ist nur für Texturen und Materialien verfügbar.",
      );
    }
  },
);
export const WizardNatureDetailsStepSchema = WizardCoreFormSchema.superRefine((values, context) => {
  refineSelectedValues(values, context, undefined, true);
  if (values.category !== undefined && values.category !== "nature") {
    addFieldIssue(
      context,
      "category",
      "Der Natur-Editor ist nur für Pflanzen und Natur-Assets verfügbar.",
    );
  }
});
export const WizardStaticObjectDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "staticObject") {
      addFieldIssue(
        context,
        "category",
        "Der Objekt-Editor ist nur für statische Weltobjekte verfügbar.",
      );
    }
  },
);
export const WizardBuildingDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "building") {
      addFieldIssue(
        context,
        "category",
        "Der Gebäudeeditor ist nur für Gebäude und Architektur verfügbar.",
      );
    }
  },
);
export const WizardTilesetDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "tileset") {
      addFieldIssue(
        context,
        "category",
        "Der Tileset-Editor ist nur für Tilesets und Kartenelemente verfügbar.",
      );
    }
  },
);
export const WizardItemDetailsStepSchema = WizardCoreFormSchema.superRefine((values, context) => {
  refineSelectedValues(values, context, undefined, true);
  if (values.category !== undefined && values.category !== "item") {
    addFieldIssue(
      context,
      "category",
      "Der Item-Editor ist nur für Items und Ausrüstung verfügbar.",
    );
  }
});
export const WizardArtworkDetailsStepSchema = WizardCoreFormSchema.superRefine(
  (values, context) => {
    refineSelectedValues(values, context, undefined, true);
    if (values.category !== undefined && values.category !== "artwork") {
      addFieldIssue(
        context,
        "category",
        "Der Artwork-Editor ist nur für Konzeptbilder und Artworks verfügbar.",
      );
    }
  },
);
export const WizardDirectionStepSchema = WizardCoreFormSchema.superRefine((values, context) =>
  refineSelectedValues(values, context, "directional", true),
);
export const WizardAnimationStepSchema = WizardCoreFormSchema.superRefine((values, context) =>
  refineSelectedValues(values, context, "animated", true),
);
export const WizardTileabilityStepSchema = WizardCoreFormSchema.superRefine((values, context) =>
  refineSelectedValues(values, context, "tileable", true),
);

export interface WizardCoreStep {
  readonly id: WizardCoreStepId;
  readonly route: "wizard/project" | "wizard/category" | "wizard/profile" | "wizard/editor";
  readonly title: string;
  readonly description: string;
  readonly fieldPaths: readonly WizardCoreFieldPath[];
  readonly schema: z.ZodType<WizardCoreFormValues, WizardCoreFormValues>;
}

export const WIZARD_CORE_STEPS = Object.freeze([
  Object.freeze({
    id: "project",
    route: "wizard/project",
    title: "Projekt",
    description: "Benenne den Entwurf, damit du ihn später eindeutig wiederfindest.",
    fieldPaths: Object.freeze(["projectName"] as const),
    schema: WizardProjectStepSchema,
  }),
  Object.freeze({
    id: "category",
    route: "wizard/category",
    title: "Bildart",
    description: "Wähle zuerst die Hauptkategorie und danach genau den passenden Untertyp.",
    fieldPaths: Object.freeze(["category", "subtype"] as const),
    schema: WizardCategoryStepSchema,
  }),
  Object.freeze({
    id: "baseProfile",
    route: "wizard/profile",
    title: "Basisprofil",
    description:
      "Wähle die globale Produktionsfamilie und prüfe geerbte technische Werte sowie Locks.",
    fieldPaths: Object.freeze(["baseProfileId", ...WIZARD_TECHNICAL_FIELD_PATHS] as const),
    schema: WizardBaseProfileStepSchema,
  }),
  Object.freeze({
    id: "characterDetails",
    route: "wizard/editor",
    title: "Figur und Rolle",
    description:
      "Beschreibe Identität, Körper, Kleidung, Ausrüstung und die lesbare Silhouette der Figur.",
    fieldPaths: WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
    schema: WizardCharacterDetailsStepSchema,
  }),
  Object.freeze({
    id: "movingObjectDetails",
    route: "wizard/editor",
    title: "Objekt und Bewegung",
    description:
      "Beschreibe Objektklasse, Maßstab, Anker, Mechanik, Material und Zustand des beweglichen Assets.",
    fieldPaths: WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS,
    schema: WizardMovingObjectDetailsStepSchema,
  }),
  Object.freeze({
    id: "textureDetails",
    route: "wizard/editor",
    title: "Textur und Material",
    description:
      "Beschreibe Material, Einsatz, Kachelbarkeit, Oberfläche, Zustand und Beleuchtung der Textur.",
    fieldPaths: WIZARD_TEXTURE_DETAIL_FIELD_PATHS,
    schema: WizardTextureDetailsStepSchema,
  }),
  Object.freeze({
    id: "natureDetails",
    route: "wizard/editor",
    title: "Pflanze und Natur",
    description:
      "Beschreibe Art, Klima, Silhouette, Stamm, Krone, Wurzeln, Bewuchs und Standfläche des Natur-Assets.",
    fieldPaths: WIZARD_NATURE_DETAIL_FIELD_PATHS,
    schema: WizardNatureDetailsStepSchema,
  }),
  Object.freeze({
    id: "staticObjectDetails",
    route: "wizard/editor",
    title: "Statisches Weltobjekt",
    description:
      "Beschreibe Funktion, Form, Material, Zustand, Standfläche und Interaktion des statischen Weltobjekts.",
    fieldPaths: WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS,
    schema: WizardStaticObjectDetailsStepSchema,
  }),
  Object.freeze({
    id: "buildingDetails",
    route: "wizard/editor",
    title: "Gebäude und Architektur",
    description:
      "Beschreibe Bauform, Footprint, Materialien, Dach, Fassade, Öffnungen, Mapping und Licht des Gebäudes.",
    fieldPaths: WIZARD_BUILDING_DETAIL_FIELD_PATHS,
    schema: WizardBuildingDetailsStepSchema,
  }),
  Object.freeze({
    id: "tilesetDetails",
    route: "wizard/editor",
    title: "Tileset und Kartenelement",
    description:
      "Definiere Grid, Verbindungen, Seam-Regeln, Wiederholung, Varianten und das berechnete Atlaslayout.",
    fieldPaths: WIZARD_TILESET_DETAIL_FIELD_PATHS,
    schema: WizardTilesetDetailsStepSchema,
  }),
  Object.freeze({
    id: "itemDetails",
    route: "wizard/editor",
    title: "Item und Ausrüstung",
    description:
      "Beschreibe Klasse, Material, Zustand, Funktion, Bedeutung, Größe und Lesbarkeit des freigestellten Items.",
    fieldPaths: WIZARD_ITEM_DETAIL_FIELD_PATHS,
    schema: WizardItemDetailsStepSchema,
  }),
  Object.freeze({
    id: "artworkDetails",
    route: "wizard/editor",
    title: "Artwork und Konzeptbild",
    description:
      "Beschreibe Motiv, Szene, Komposition, Format, Hintergrund, Fokus, Lichtdramaturgie und Detailgrad frei.",
    fieldPaths: WIZARD_ARTWORK_DETAIL_FIELD_PATHS,
    schema: WizardArtworkDetailsStepSchema,
  }),
  Object.freeze({
    id: "directions",
    route: "wizard/editor",
    title: "Richtungen",
    description:
      "Lege nur für richtungsabhängig bewegliche Assets ein 4- oder 8-Richtungsset fest.",
    fieldPaths: Object.freeze(["directionCount"] as const),
    schema: WizardDirectionStepSchema,
  }),
  Object.freeze({
    id: "animation",
    route: "wizard/editor",
    title: "Bewegung und Animation",
    description:
      "Beschreibe zeitliche Bewegung, ohne Animation automatisch mit Richtungen gleichzusetzen.",
    fieldPaths: Object.freeze([
      "animationAction",
      "animationType",
      "characterAnimationFrames",
      "movingObjectAnimationFrames",
    ] as const),
    schema: WizardAnimationStepSchema,
  }),
  Object.freeze({
    id: "tileability",
    route: "wizard/editor",
    title: "Kachelbarkeit",
    description: "Definiere die Wiederholbarkeit nur für Assets mit Tileability-Capability.",
    fieldPaths: Object.freeze(["tileableAxes"] as const),
    schema: WizardTileabilityStepSchema,
  }),
] as const satisfies readonly WizardCoreStep[]);

export function isWizardCoreStepId(value: string): value is WizardCoreStepId {
  return WIZARD_CORE_STEPS.some((step) => step.id === value);
}

export function getWizardCoreStep(stepId: WizardCoreStepId): WizardCoreStep {
  const step = WIZARD_CORE_STEPS.find((candidate) => candidate.id === stepId);
  if (step === undefined) {
    throw new Error(`Unknown wizard core step "${stepId}".`);
  }
  return step;
}

export function getWizardCoreStepIndex(stepId: WizardCoreStepId): number {
  return WIZARD_CORE_STEPS.findIndex((step) => step.id === stepId);
}

export function getWizardCoreFallbackStepId(route: string): WizardCoreStepId {
  if (route === "wizard/project") return "project";
  if (route === "wizard/category") return "category";
  return "baseProfile";
}
