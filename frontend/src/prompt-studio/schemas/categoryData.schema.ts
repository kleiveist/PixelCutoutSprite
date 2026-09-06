import { z } from "zod";
import { ASSET_SUBTYPES } from "../domain/assets";
import {
  ARTWORK_BACKGROUND_IDS,
  ARTWORK_COMPOSITION_IDS,
  ARTWORK_DETAIL_LEVEL_IDS,
  ARTWORK_FOCUS_IDS,
  ARTWORK_FORMAT_IDS,
  ARTWORK_LIGHTING_DRAMA_IDS,
  ARTWORK_MOTIF_IDS,
  ARTWORK_PURPOSE_IDS,
} from "../domain/artworks";
import {
  CHARACTER_AGE_IDS,
  CHARACTER_ANIMATION_ACTION_IDS,
  CHARACTER_BODY_BUILD_IDS,
  CHARACTER_CONDITION_IDS,
  CHARACTER_EXPRESSION_IDS,
  CHARACTER_EYE_VISIBILITY_IDS,
  CHARACTER_GENDER_PRESENTATION_IDS,
  CHARACTER_HEADWEAR_CONDITION_IDS,
  CHARACTER_PALETTE_SOURCE_IDS,
  CHARACTER_POSTURE_IDS,
  CHARACTER_RELATIVE_HEIGHT_IDS,
  CHARACTER_WEALTH_IDS,
} from "../domain/characters";
import {
  BUILDING_ANIMATION_TYPE_IDS,
  BUILDING_COLLISION_MODE_IDS,
  BUILDING_CONDITION_IDS,
  BUILDING_DOOR_STATE_IDS,
  BUILDING_DOOR_TYPE_IDS,
  BUILDING_ENVIRONMENT_IDS,
  BUILDING_FACADE_STYLE_IDS,
  BUILDING_LIGHTING_IDS,
  BUILDING_MAPPING_MODE_IDS,
  BUILDING_MATERIAL_IDS,
  BUILDING_OCCUPANCY_IDS,
  BUILDING_PLAN_SHAPE_IDS,
  BUILDING_ROOF_CONDITION_IDS,
  BUILDING_ROOF_MATERIAL_IDS,
  BUILDING_ROOF_PITCH_IDS,
  BUILDING_ROOF_SHAPE_IDS,
  BUILDING_SIZE_IDS,
  BUILDING_TYPE_IDS,
  BUILDING_WINDOW_LIGHTING_IDS,
  BUILDING_WINDOW_SHAPE_IDS,
} from "../domain/buildings";
import {
  ITEM_CLASS_IDS,
  ITEM_CONDITION_IDS,
  ITEM_GLOW_MODE_IDS,
  ITEM_MATERIAL_IDS,
  ITEM_PRESENTATION_IDS,
  ITEM_PURPOSE_IDS,
  ITEM_READABILITY_IDS,
  ITEM_SHADOW_MODE_IDS,
  ITEM_SIGNIFICANCE_IDS,
  ITEM_SIZE_IDS,
  ITEM_WEAR_POSITION_IDS,
} from "../domain/items";
import {
  MOVING_OBJECT_ANCHOR_MODE_IDS,
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  MOVING_OBJECT_CLASS_IDS,
  MOVING_OBJECT_CONDITION_IDS,
  MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS,
  MOVING_OBJECT_MATERIAL_IDS,
  MOVING_OBJECT_MECHANISM_IDS,
  MOVING_OBJECT_MOVEMENT_TYPE_IDS,
  MOVING_OBJECT_SHADOW_MODE_IDS,
} from "../domain/moving-objects";
import {
  NATURE_AGE_IDS,
  NATURE_ANIMATION_TYPE_IDS,
  NATURE_CLIMATE_IDS,
  NATURE_CROWN_DENSITY_IDS,
  NATURE_CROWN_SHAPE_IDS,
  NATURE_GROUNDING_IDS,
  NATURE_MOSS_COVERAGE_IDS,
  NATURE_MUSHROOM_GROWTH_IDS,
  NATURE_PLANT_TYPE_IDS,
  NATURE_ROOT_VISIBILITY_IDS,
  NATURE_SEASON_IDS,
  NATURE_SILHOUETTE_IDS,
  NATURE_SNOW_COVER_IDS,
  NATURE_TRUNK_SHAPE_IDS,
  NATURE_TRUNK_THICKNESS_IDS,
  NATURE_VINE_GROWTH_IDS,
} from "../domain/nature";
import {
  STATIC_OBJECT_ANIMATION_TYPE_IDS,
  STATIC_OBJECT_BASIC_SHAPE_IDS,
  STATIC_OBJECT_CLASS_IDS,
  STATIC_OBJECT_CONDITION_IDS,
  STATIC_OBJECT_INTERACTION_IDS,
  STATIC_OBJECT_MATERIAL_IDS,
  STATIC_OBJECT_PROPORTION_IDS,
  STATIC_OBJECT_PURPOSE_IDS,
  STATIC_OBJECT_SHADOW_MODE_IDS,
  STATIC_OBJECT_SYMMETRY_IDS,
} from "../domain/static-objects";
import {
  TEXTURE_CONDITION_IDS,
  TEXTURE_ICING_IDS,
  TEXTURE_LIGHTING_IDS,
  TEXTURE_MATERIAL_TYPE_IDS,
  TEXTURE_MOISTURE_IDS,
  TEXTURE_ORIENTATION_IDS,
  TEXTURE_STRUCTURE_IDS,
  TEXTURE_SURFACE_IDS,
  TEXTURE_USAGE_IDS,
} from "../domain/textures";
import {
  TILESET_ANIMATION_TYPE_IDS,
  TILESET_ATLAS_LAYOUT_IDS,
  TILESET_CORNER_SET_IDS,
  TILESET_EDGE_SET_IDS,
  TILESET_REPEAT_MODE_IDS,
  TILESET_SEAM_MODE_IDS,
  TILESET_TILEABLE_AXES_IDS,
  TILESET_TRANSITION_MODE_IDS,
  TILESET_TYPE_IDS,
  TILESET_USAGE_IDS,
  TILESET_VARIANT_KIND_IDS,
} from "../domain/tilesets";
import { validateCategoryDataCapabilities } from "./categoryData.refinement";
import { DirectionCountSchema, FootprintSchema } from "./common.schema";

const sharedAnswersShape = {
  subjectDescription: z.string().trim().min(1).max(4000).optional(),
  extraDetails: z.string().trim().max(4000).optional(),
} as const;

const CharacterDescriptorSchema = z.string().trim().min(1).max(200);
const CharacterDetailSchema = z.string().trim().min(1).max(500);
const NatureDescriptorSchema = z.string().trim().min(1).max(200);
const NatureDetailSchema = z.string().trim().min(1).max(500);
const StaticObjectDetailSchema = z.string().trim().min(1).max(500);
const BuildingDetailSchema = z.string().trim().min(1).max(500);
const TilesetDescriptorSchema = z.string().trim().min(1).max(200);
const TilesetDetailSchema = z.string().trim().min(1).max(500);
const ItemDetailSchema = z.string().trim().min(1).max(500);
const ArtworkDetailSchema = z.string().trim().min(1).max(1000);

export const CharacterAnimationActionSchema = z
  .strictObject({
    action: z.enum(CHARACTER_ANIMATION_ACTION_IDS),
    frames: z.number().int().min(1).max(8),
  })
  .readonly();

export const CharacterAnimationActionsSchema = z
  .array(CharacterAnimationActionSchema)
  .min(1)
  .max(CHARACTER_ANIMATION_ACTION_IDS.length)
  .superRefine((actions, context) => {
    const seen = new Set<string>();
    actions.forEach((entry, index) => {
      if (seen.has(entry.action)) {
        context.addIssue({
          code: "custom",
          path: [index, "action"],
          message: `Duplicate character animation action "${entry.action}".`,
        });
      }
      seen.add(entry.action);
    });
  })
  .readonly();

export const CharacterAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    role: z.string().trim().min(1).max(100).optional(),
    variantCount: z.number().int().min(1).max(5).optional(),
    genderPresentation: z.enum(CHARACTER_GENDER_PRESENTATION_IDS).optional(),
    age: z.enum(CHARACTER_AGE_IDS).optional(),
    relativeHeight: z.enum(CHARACTER_RELATIVE_HEIGHT_IDS).optional(),
    bodyBuild: z.enum(CHARACTER_BODY_BUILD_IDS).optional(),
    posture: z.enum(CHARACTER_POSTURE_IDS).optional(),
    faceShape: CharacterDescriptorSchema.optional(),
    skinTone: CharacterDescriptorSchema.optional(),
    eyeVisibility: z.enum(CHARACTER_EYE_VISIBILITY_IDS).optional(),
    hair: CharacterDescriptorSchema.optional(),
    hairstyle: CharacterDescriptorSchema.optional(),
    beard: CharacterDescriptorSchema.optional(),
    hat: z.string().trim().min(1).max(100).optional(),
    headwearCondition: z.enum(CHARACTER_HEADWEAR_CONDITION_IDS).optional(),
    scarf: z.string().trim().min(1).max(100).optional(),
    outerwear: z.string().trim().min(1).max(120).optional(),
    lowerwear: CharacterDescriptorSchema.optional(),
    clothingLayers: CharacterDetailSchema.optional(),
    gloves: CharacterDescriptorSchema.optional(),
    handPose: CharacterDescriptorSchema.optional(),
    shoes: CharacterDescriptorSchema.optional(),
    beltBags: CharacterDetailSchema.optional(),
    accessories: CharacterDetailSchema.optional(),
    backItem: CharacterDescriptorSchema.optional(),
    equipment: CharacterDetailSchema.optional(),
    materials: CharacterDetailSchema.optional(),
    characterPaletteSource: z.enum(CHARACTER_PALETTE_SOURCE_IDS).optional(),
    primaryColor: CharacterDescriptorSchema.optional(),
    secondaryColor: CharacterDescriptorSchema.optional(),
    accentColor: CharacterDescriptorSchema.optional(),
    condition: z.enum(CHARACTER_CONDITION_IDS).optional(),
    expression: z.enum(CHARACTER_EXPRESSION_IDS).optional(),
    silhouette: CharacterDetailSchema.optional(),
    pose: CharacterDescriptorSchema.optional(),
    professionReadable: z.boolean().optional(),
    socialRole: CharacterDescriptorSchema.optional(),
    wealth: z.enum(CHARACTER_WEALTH_IDS).optional(),
    culturalFunction: CharacterDetailSchema.optional(),
    typicalActivity: CharacterDetailSchema.optional(),
    conversationGesture: CharacterDetailSchema.optional(),
    everydayTool: CharacterDescriptorSchema.optional(),
    frontBackDetails: CharacterDetailSchema.optional(),
    animationActions: CharacterAnimationActionsSchema.optional(),
    animationAction: z.enum(CHARACTER_ANIMATION_ACTION_IDS).optional(),
    directionCount: DirectionCountSchema.optional(),
    framesPerDirection: z.number().int().min(1).max(8).optional(),
  })
  .readonly();

export const MovingObjectAnimationSequenceSchema = z
  .strictObject({
    type: z.enum(MOVING_OBJECT_ANIMATION_TYPE_IDS),
    frames: z.number().int().min(1).max(16),
  })
  .readonly();

export const MovingObjectAnimationSequencesSchema = z
  .array(MovingObjectAnimationSequenceSchema)
  .min(1)
  .max(MOVING_OBJECT_ANIMATION_TYPE_IDS.length)
  .superRefine((sequences, context) => {
    const seen = new Set<string>();
    sequences.forEach((sequence, index) => {
      if (seen.has(sequence.type)) {
        context.addIssue({
          code: "custom",
          path: [index, "type"],
          message: `Duplicate moving-object animation sequence "${sequence.type}".`,
        });
      }
      seen.add(sequence.type);
    });
  })
  .readonly();

export const MovingObjectAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    objectClass: z.enum(MOVING_OBJECT_CLASS_IDS).optional(),
    purpose: z.string().trim().min(1).max(200).optional(),
    basicShape: z.string().trim().min(1).max(200).optional(),
    heightPixels: z.number().int().min(16).max(2048).optional(),
    movementType: z.enum(MOVING_OBJECT_MOVEMENT_TYPE_IDS).optional(),
    footprint: FootprintSchema.optional(),
    anchorMode: z.enum(MOVING_OBJECT_ANCHOR_MODE_IDS).optional(),
    directionCount: DirectionCountSchema.optional(),
    animationSequences: MovingObjectAnimationSequencesSchema.optional(),
    animationType: z.enum(MOVING_OBJECT_ANIMATION_TYPE_IDS).optional(),
    framesPerDirection: z.number().int().min(1).max(16).optional(),
    mechanism: z.enum(MOVING_OBJECT_MECHANISM_IDS).optional(),
    material: z.enum(MOVING_OBJECT_MATERIAL_IDS).optional(),
    materialDetails: z.string().trim().min(1).max(500).optional(),
    condition: z.enum(MOVING_OBJECT_CONDITION_IDS).optional(),
    lightingBehavior: z.enum(MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS).optional(),
    shadowMode: z.enum(MOVING_OBJECT_SHADOW_MODE_IDS).optional(),
  })
  .readonly();

export const StaticObjectAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    objectClass: z.enum(STATIC_OBJECT_CLASS_IDS).optional(),
    purpose: z.enum(STATIC_OBJECT_PURPOSE_IDS).optional(),
    basicShape: z.enum(STATIC_OBJECT_BASIC_SHAPE_IDS).optional(),
    proportion: z.enum(STATIC_OBJECT_PROPORTION_IDS).optional(),
    symmetry: z.enum(STATIC_OBJECT_SYMMETRY_IDS).optional(),
    primaryMaterial: z.enum(STATIC_OBJECT_MATERIAL_IDS).optional(),
    secondaryMaterial: z.enum(STATIC_OBJECT_MATERIAL_IDS).optional(),
    materialDetails: StaticObjectDetailSchema.optional(),
    condition: z.enum(STATIC_OBJECT_CONDITION_IDS).optional(),
    detailElements: StaticObjectDetailSchema.optional(),
    contents: StaticObjectDetailSchema.optional(),
    interaction: z.enum(STATIC_OBJECT_INTERACTION_IDS).optional(),
    animationType: z.enum(STATIC_OBJECT_ANIMATION_TYPE_IDS).optional(),
    shadowMode: z.enum(STATIC_OBJECT_SHADOW_MODE_IDS).optional(),
    footprint: FootprintSchema.optional(),
    variantCount: z.number().int().min(1).max(12).optional(),
  })
  .readonly();

export const TextureAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    materialType: z.enum(TEXTURE_MATERIAL_TYPE_IDS).optional(),
    usage: z.enum(TEXTURE_USAGE_IDS).optional(),
    seamless: z.boolean().optional(),
    orientation: z.enum(TEXTURE_ORIENTATION_IDS).optional(),
    structure: z.enum(TEXTURE_STRUCTURE_IDS).optional(),
    condition: z.enum(TEXTURE_CONDITION_IDS).optional(),
    surface: z.enum(TEXTURE_SURFACE_IDS).optional(),
    moisture: z.enum(TEXTURE_MOISTURE_IDS).optional(),
    icing: z.enum(TEXTURE_ICING_IDS).optional(),
    lighting: z.enum(TEXTURE_LIGHTING_IDS).optional(),
  })
  .readonly();

export const NatureAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    plantType: z.enum(NATURE_PLANT_TYPE_IDS).optional(),
    species: NatureDescriptorSchema.optional(),
    climate: z.enum(NATURE_CLIMATE_IDS).optional(),
    season: z.enum(NATURE_SEASON_IDS).optional(),
    age: z.enum(NATURE_AGE_IDS).optional(),
    silhouette: z.enum(NATURE_SILHOUETTE_IDS).optional(),
    trunkThickness: z.enum(NATURE_TRUNK_THICKNESS_IDS).optional(),
    trunkShape: z.enum(NATURE_TRUNK_SHAPE_IDS).optional(),
    trunkDetails: NatureDetailSchema.optional(),
    crownShape: z.enum(NATURE_CROWN_SHAPE_IDS).optional(),
    crownDensity: z.enum(NATURE_CROWN_DENSITY_IDS).optional(),
    foliageDetails: NatureDetailSchema.optional(),
    rootVisibility: z.enum(NATURE_ROOT_VISIBILITY_IDS).optional(),
    rootDetails: NatureDetailSchema.optional(),
    mossCoverage: z.enum(NATURE_MOSS_COVERAGE_IDS).optional(),
    mushroomGrowth: z.enum(NATURE_MUSHROOM_GROWTH_IDS).optional(),
    snowCover: z.enum(NATURE_SNOW_COVER_IDS).optional(),
    vineGrowth: z.enum(NATURE_VINE_GROWTH_IDS).optional(),
    footprint: FootprintSchema.optional(),
    grounding: z.enum(NATURE_GROUNDING_IDS).optional(),
    variantCount: z.number().int().min(1).max(12).optional(),
    animationType: z.enum(NATURE_ANIMATION_TYPE_IDS).optional(),
  })
  .readonly();

export const BuildingAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    buildingType: z.enum(BUILDING_TYPE_IDS).optional(),
    purpose: z.string().trim().min(1).max(200).optional(),
    planShape: z.enum(BUILDING_PLAN_SHAPE_IDS).optional(),
    size: z.enum(BUILDING_SIZE_IDS).optional(),
    heightPixels: z.number().int().min(16).max(8192).optional(),
    floors: z.number().int().min(1).max(20).optional(),
    primaryMaterial: z.enum(BUILDING_MATERIAL_IDS).optional(),
    secondaryMaterial: z.enum(BUILDING_MATERIAL_IDS).optional(),
    materialDetails: BuildingDetailSchema.optional(),
    roofShape: z.enum(BUILDING_ROOF_SHAPE_IDS).optional(),
    roofPitch: z.enum(BUILDING_ROOF_PITCH_IDS).optional(),
    roofMaterial: z.enum(BUILDING_ROOF_MATERIAL_IDS).optional(),
    roofCondition: z.enum(BUILDING_ROOF_CONDITION_IDS).optional(),
    roofDetails: BuildingDetailSchema.optional(),
    facadeStyle: z.enum(BUILDING_FACADE_STYLE_IDS).optional(),
    facadeDetails: BuildingDetailSchema.optional(),
    doorCount: z.number().int().min(0).max(64).optional(),
    doorType: z.enum(BUILDING_DOOR_TYPE_IDS).optional(),
    doorPosition: BuildingDetailSchema.optional(),
    doorState: z.enum(BUILDING_DOOR_STATE_IDS).optional(),
    windowCount: z.number().int().min(0).max(256).optional(),
    windowShape: z.enum(BUILDING_WINDOW_SHAPE_IDS).optional(),
    windowLighting: z.enum(BUILDING_WINDOW_LIGHTING_IDS).optional(),
    windowDetails: BuildingDetailSchema.optional(),
    condition: z.enum(BUILDING_CONDITION_IDS).optional(),
    occupancy: z.enum(BUILDING_OCCUPANCY_IDS).optional(),
    environment: z.enum(BUILDING_ENVIRONMENT_IDS).optional(),
    mappingMode: z.enum(BUILDING_MAPPING_MODE_IDS).optional(),
    collisionMode: z.enum(BUILDING_COLLISION_MODE_IDS).optional(),
    modular: z.boolean().optional(),
    footprint: FootprintSchema.optional(),
    lighting: z.enum(BUILDING_LIGHTING_IDS).optional(),
    lightSourceDetails: BuildingDetailSchema.optional(),
    animationType: z.enum(BUILDING_ANIMATION_TYPE_IDS).optional(),
  })
  .readonly();

export const TilesetAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    tilesetType: z.enum(TILESET_TYPE_IDS).optional(),
    tileUsage: z.enum(TILESET_USAGE_IDS).optional(),
    edgeSet: z.enum(TILESET_EDGE_SET_IDS).optional(),
    edgeDetails: TilesetDetailSchema.optional(),
    cornerSet: z.enum(TILESET_CORNER_SET_IDS).optional(),
    transitionMode: z.enum(TILESET_TRANSITION_MODE_IDS).optional(),
    sourceMaterial: TilesetDescriptorSchema.optional(),
    targetMaterial: TilesetDescriptorSchema.optional(),
    seamMode: z.enum(TILESET_SEAM_MODE_IDS).optional(),
    seamDetails: TilesetDetailSchema.optional(),
    tileableAxes: z.enum(TILESET_TILEABLE_AXES_IDS).optional(),
    repeatMode: z.enum(TILESET_REPEAT_MODE_IDS).optional(),
    variantCount: z.number().int().min(1).max(64).optional(),
    variantKinds: z
      .array(z.enum(TILESET_VARIANT_KIND_IDS))
      .min(1)
      .max(TILESET_VARIANT_KIND_IDS.length)
      .superRefine((variants, context) => {
        const seen = new Set<string>();
        variants.forEach((variant, index) => {
          if (seen.has(variant)) {
            context.addIssue({
              code: "custom",
              path: [index],
              message: `Duplicate Tileset variant kind "${variant}".`,
            });
          }
          seen.add(variant);
        });
      })
      .readonly()
      .optional(),
    atlasLayout: z.enum(TILESET_ATLAS_LAYOUT_IDS).optional(),
    atlasTileCount: z.number().int().min(1).max(256).optional(),
    atlasColumns: z.number().int().min(1).max(64).optional(),
    atlasGutterPixels: z.number().int().min(0).max(64).optional(),
    atlasMarginPixels: z.number().int().min(0).max(64).optional(),
    animationType: z.enum(TILESET_ANIMATION_TYPE_IDS).optional(),
  })
  .readonly();

export const ItemAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    itemClass: z.enum(ITEM_CLASS_IDS).optional(),
    purpose: z.enum(ITEM_PURPOSE_IDS).optional(),
    presentation: z.enum(ITEM_PRESENTATION_IDS).optional(),
    wearPosition: z.enum(ITEM_WEAR_POSITION_IDS).optional(),
    iconSize: z.number().int().min(8).max(512).optional(),
    size: z.enum(ITEM_SIZE_IDS).optional(),
    primaryMaterial: z.enum(ITEM_MATERIAL_IDS).optional(),
    secondaryMaterial: z.enum(ITEM_MATERIAL_IDS).optional(),
    materialDetails: ItemDetailSchema.optional(),
    condition: z.enum(ITEM_CONDITION_IDS).optional(),
    functionDetails: ItemDetailSchema.optional(),
    significance: z.enum(ITEM_SIGNIFICANCE_IDS).optional(),
    meaningDetails: ItemDetailSchema.optional(),
    silhouette: ItemDetailSchema.optional(),
    readability: z.enum(ITEM_READABILITY_IDS).optional(),
    glowMode: z.enum(ITEM_GLOW_MODE_IDS).optional(),
    shadowMode: z.enum(ITEM_SHADOW_MODE_IDS).optional(),
    variantCount: z.number().int().min(1).max(12).optional(),
  })
  .readonly();

export const ArtworkAnswersSchema = z
  .strictObject({
    ...sharedAnswersShape,
    purpose: z.enum(ARTWORK_PURPOSE_IDS).optional(),
    motif: z.enum(ARTWORK_MOTIF_IDS).optional(),
    sceneDescription: ArtworkDetailSchema.optional(),
    composition: z.enum(ARTWORK_COMPOSITION_IDS).optional(),
    compositionDetails: ArtworkDetailSchema.optional(),
    format: z.enum(ARTWORK_FORMAT_IDS).optional(),
    background: z.enum(ARTWORK_BACKGROUND_IDS).optional(),
    backgroundDetails: ArtworkDetailSchema.optional(),
    focus: z.enum(ARTWORK_FOCUS_IDS).optional(),
    lightingDrama: z.enum(ARTWORK_LIGHTING_DRAMA_IDS).optional(),
    lightingDetails: ArtworkDetailSchema.optional(),
    detailLevel: z.enum(ARTWORK_DETAIL_LEVEL_IDS).optional(),
  })
  .readonly();

export const CharacterCategoryDataSchema = z.strictObject({
  category: z.literal("character"),
  subtype: z.enum(ASSET_SUBTYPES.character),
  answers: CharacterAnswersSchema,
});

export const MovingObjectCategoryDataSchema = z.strictObject({
  category: z.literal("movingObject"),
  subtype: z.enum(ASSET_SUBTYPES.movingObject),
  answers: MovingObjectAnswersSchema,
});

export const StaticObjectCategoryDataSchema = z.strictObject({
  category: z.literal("staticObject"),
  subtype: z.enum(ASSET_SUBTYPES.staticObject),
  answers: StaticObjectAnswersSchema,
});

export const TextureCategoryDataSchema = z.strictObject({
  category: z.literal("texture"),
  subtype: z.enum(ASSET_SUBTYPES.texture),
  answers: TextureAnswersSchema,
});

export const NatureCategoryDataSchema = z.strictObject({
  category: z.literal("nature"),
  subtype: z.enum(ASSET_SUBTYPES.nature),
  answers: NatureAnswersSchema,
});

export const BuildingCategoryDataSchema = z.strictObject({
  category: z.literal("building"),
  subtype: z.enum(ASSET_SUBTYPES.building),
  answers: BuildingAnswersSchema,
});

export const TilesetCategoryDataSchema = z.strictObject({
  category: z.literal("tileset"),
  subtype: z.enum(ASSET_SUBTYPES.tileset),
  answers: TilesetAnswersSchema,
});

export const ItemCategoryDataSchema = z.strictObject({
  category: z.literal("item"),
  subtype: z.enum(ASSET_SUBTYPES.item),
  answers: ItemAnswersSchema,
});

export const ArtworkCategoryDataSchema = z.strictObject({
  category: z.literal("artwork"),
  subtype: z.enum(ASSET_SUBTYPES.artwork),
  answers: ArtworkAnswersSchema,
});

export const AssetCategoryDataSchema = z
  .discriminatedUnion("category", [
    CharacterCategoryDataSchema,
    MovingObjectCategoryDataSchema,
    StaticObjectCategoryDataSchema,
    TextureCategoryDataSchema,
    NatureCategoryDataSchema,
    BuildingCategoryDataSchema,
    TilesetCategoryDataSchema,
    ItemCategoryDataSchema,
    ArtworkCategoryDataSchema,
  ])
  .superRefine((value, context) => {
    validateCategoryDataCapabilities(value, "answers", context);
  });

export type CharacterAnswers = z.infer<typeof CharacterAnswersSchema>;
export type CharacterAnimationActionConfig = z.infer<typeof CharacterAnimationActionSchema>;
export type MovingObjectAnimationSequenceConfig = z.infer<
  typeof MovingObjectAnimationSequenceSchema
>;
export type MovingObjectAnswers = z.infer<typeof MovingObjectAnswersSchema>;
export type StaticObjectAnswers = z.infer<typeof StaticObjectAnswersSchema>;
export type TextureAnswers = z.infer<typeof TextureAnswersSchema>;
export type NatureAnswers = z.infer<typeof NatureAnswersSchema>;
export type BuildingAnswers = z.infer<typeof BuildingAnswersSchema>;
export type TilesetAnswers = z.infer<typeof TilesetAnswersSchema>;
export type ItemAnswers = z.infer<typeof ItemAnswersSchema>;
export type ArtworkAnswers = z.infer<typeof ArtworkAnswersSchema>;
export type AssetCategoryData = z.infer<typeof AssetCategoryDataSchema>;
