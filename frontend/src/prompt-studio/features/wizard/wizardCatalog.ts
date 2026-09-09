import { z } from "zod";

import {
  isHumanoidCharacterSubtype,
  isNpcContextSubtype,
  type CharacterSubtype,
} from "../../domain/characters";
import {
  natureSubtypeHasCrown,
  natureSubtypeHasRoots,
  natureSubtypeHasTrunk,
  type NatureSubtype,
} from "../../domain/nature";
import { V3_CATALOG_VERSION } from "../../domain/catalog/v3Catalog";
import type { AssetCategory } from "../../domain/assets";
import { parseWizardDraft, type ProfileLibrary, type WizardDraft } from "../../schemas";
import {
  WizardAnimationStepSchema,
  WizardArtworkDetailsStepSchema,
  WizardBuildingDetailsStepSchema,
  WizardCategoryStepSchema,
  WizardCharacterDetailsStepSchema,
  WizardCoreFormSchema,
  WizardDirectionStepSchema,
  WizardItemDetailsStepSchema,
  WizardMovingObjectDetailsStepSchema,
  WizardNatureDetailsStepSchema,
  WizardStaticObjectDetailsStepSchema,
  WizardTextureDetailsStepSchema,
  WizardTilesetDetailsStepSchema,
  type WizardCoreFieldPath,
  type WizardCoreFormValues,
  type WizardCoreStepId,
} from "./wizardSteps";
import { resolveWizardCapabilities, updateWizardDraftFromCoreForm } from "./wizardCategoryRouting";

export const WIZARD_CATALOG_VERSION = V3_CATALOG_VERSION;

export type WizardCatalogSectionId =
  | "character/identity"
  | "character/body"
  | "character/wardrobe"
  | "character/equipment"
  | "character/palette"
  | "character/npc-context"
  | "moving-object/core"
  | "moving-object/scale"
  | "moving-object/motion"
  | "moving-object/material"
  | "moving-object/lighting"
  | "moving-object/details"
  | "texture/material"
  | "texture/grid"
  | "texture/surface"
  | "texture/weather-light"
  | "texture/details"
  | "nature/identity"
  | "nature/trunk"
  | "nature/crown"
  | "nature/roots"
  | "nature/weather"
  | "nature/footprint"
  | "nature/details"
  | "static-object/core"
  | "static-object/material"
  | "static-object/interaction"
  | "static-object/footprint"
  | "static-object/details"
  | "building/core"
  | "building/footprint"
  | "building/material"
  | "building/openings"
  | "building/environment"
  | "building/details"
  | "tileset/grid"
  | "tileset/connections"
  | "tileset/seams"
  | "tileset/variants"
  | "tileset/atlas"
  | "tileset/details"
  | "item/core"
  | "item/material"
  | "item/readability"
  | "item/output"
  | "artwork/motif"
  | "artwork/composition"
  | "artwork/background"
  | "artwork/lighting"
  | "capabilities/directions"
  | "capabilities/animation";

export type WizardCatalogStepId = "identity" | `catalog/${WizardCatalogSectionId}` | "review";

export interface WizardCatalogPage {
  readonly sectionId: WizardCatalogSectionId;
  readonly id: `catalog/${WizardCatalogSectionId}`;
  readonly category: AssetCategory | "capability";
  readonly title: string;
  readonly description: string;
  readonly fieldPaths: readonly WizardCoreFieldPath[];
}

const page = (
  sectionId: WizardCatalogSectionId,
  category: WizardCatalogPage["category"],
  title: string,
  description: string,
  fieldPaths: readonly WizardCoreFieldPath[],
): WizardCatalogPage =>
  Object.freeze({
    sectionId,
    id: `catalog/${sectionId}`,
    category,
    title,
    description,
    fieldPaths,
  });

export const WIZARD_BASE_CONTEXT_FIELD_PATHS = Object.freeze([
  "baseProfileId",
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

export const WIZARD_CATALOG_PAGES = Object.freeze([
  page(
    "character/identity",
    "character",
    "Identität und Varianten",
    "Rolle, Motiv und Varianten der Figur.",
    ["role", "subjectDescription", "variantCount", "genderPresentation"],
  ),
  page(
    "character/body",
    "character",
    "Körper und Ausdruck",
    "Körper, Gesicht, Haltung und lesbare Silhouette.",
    [
      "age",
      "relativeHeight",
      "bodyBuild",
      "posture",
      "faceShape",
      "skinTone",
      "hair",
      "hairstyle",
      "beard",
      "eyeVisibility",
      "expression",
      "silhouette",
      "pose",
      "extraDetails",
    ],
  ),
  page(
    "character/wardrobe",
    "character",
    "Kleidung",
    "Kopfbedeckung, Kleidungsschichten und asymmetrische Details.",
    [
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
    ],
  ),
  page(
    "character/equipment",
    "character",
    "Ausrüstung und Material",
    "Accessoires, Werkzeuge, Materialien und Zustand.",
    ["accessories", "equipment", "materials", "condition"],
  ),
  page(
    "character/palette",
    "character",
    "Figurenpalette",
    "Lokale Haupt-, Neben- und Akzentfarben.",
    ["characterPaletteSource", "primaryColor", "secondaryColor", "accentColor"],
  ),
  page(
    "character/npc-context",
    "character",
    "NPC-Kontext",
    "Soziale Funktion, Tätigkeit und richtungsabhängige Details.",
    [
      "professionReadable",
      "socialRole",
      "wealth",
      "culturalFunction",
      "typicalActivity",
      "conversationGesture",
      "everydayTool",
      "frontBackDetails",
    ],
  ),
  page(
    "moving-object/core",
    "movingObject",
    "Objektkern",
    "Funktion, Grundform und Motiv des beweglichen Objekts.",
    [
      "movingObjectClass",
      "movingObjectPurpose",
      "movingObjectBasicShape",
      "movingObjectDescription",
    ],
  ),
  page(
    "moving-object/scale",
    "movingObject",
    "Maßstab und Anker",
    "Footprint, Höhe und Ausrichtungsanker.",
    [
      "movingObjectFootprintWidthTiles",
      "movingObjectFootprintDepthTiles",
      "movingObjectHeightPixels",
      "movingObjectAnchorMode",
    ],
  ),
  page(
    "moving-object/motion",
    "movingObject",
    "Bewegung und Mechanik",
    "Fortbewegungsart und sichtbarer Antrieb.",
    ["movementType", "movingObjectMechanism"],
  ),
  page(
    "moving-object/material",
    "movingObject",
    "Material und Zustand",
    "Materialgruppen, Oberfläche und Abnutzung.",
    ["movingObjectMaterial", "movingObjectMaterialDetails", "movingObjectCondition"],
  ),
  page(
    "moving-object/lighting",
    "movingObject",
    "Licht und Bodenkontakt",
    "Lokales Leuchtverhalten und Schatten.",
    ["movingObjectLightingBehavior", "movingObjectShadowMode"],
  ),
  page(
    "moving-object/details",
    "movingObject",
    "Weitere Objektdetails",
    "Zusätzliche produktionsrelevante Angaben.",
    ["movingObjectExtraDetails"],
  ),
  page(
    "texture/material",
    "texture",
    "Material und Verwendung",
    "Materialart, Einsatz und gewünschte Wirkung.",
    ["textureMaterialType", "textureUsage", "textureDescription"],
  ),
  page(
    "texture/grid",
    "texture",
    "Kachel und Raster",
    "Nahtlose Wiederholung im geerbten Tile-Raster.",
    ["seamless"],
  ),
  page(
    "texture/surface",
    "texture",
    "Struktur und Oberfläche",
    "Struktur, Ausrichtung und Zustand der Oberfläche.",
    ["textureStructure", "textureSurface", "textureOrientation", "textureCondition"],
  ),
  page(
    "texture/weather-light",
    "texture",
    "Wetter und Licht",
    "Feuchtigkeit, Vereisung und Materialbeleuchtung.",
    ["textureMoisture", "textureIcing", "textureLighting"],
  ),
  page(
    "texture/details",
    "texture",
    "Weitere Materialdetails",
    "Farben, Elemente und Randregeln.",
    ["textureExtraDetails"],
  ),
  page(
    "nature/identity",
    "nature",
    "Pflanze und Umgebung",
    "Art, Klima, Saison, Alter und Silhouette.",
    [
      "naturePlantType",
      "natureSpecies",
      "natureDescription",
      "natureClimate",
      "natureSeason",
      "natureAge",
      "natureSilhouette",
    ],
  ),
  page("nature/trunk", "nature", "Stamm und Rinde", "Stammform, Rindenstruktur und Verzweigung.", [
    "natureTrunkThickness",
    "natureTrunkShape",
    "natureTrunkDetails",
  ]),
  page("nature/crown", "nature", "Krone und Blattmasse", "Kronenform, Dichte und Blattcluster.", [
    "natureCrownShape",
    "natureCrownDensity",
    "natureFoliageDetails",
  ]),
  page("nature/roots", "nature", "Wurzeln und Fußpunkt", "Sichtbarkeit und Verlauf der Wurzeln.", [
    "natureRootVisibility",
    "natureRootDetails",
  ]),
  page("nature/weather", "nature", "Bewuchs und Wetterauflage", "Moos, Pilze, Schnee und Ranken.", [
    "natureMossCoverage",
    "natureMushroomGrowth",
    "natureSnowCover",
    "natureVineGrowth",
  ]),
  page(
    "nature/footprint",
    "nature",
    "Standfläche und Varianten",
    "Footprint, Bodenanschluss und Varianten.",
    [
      "natureFootprintWidthTiles",
      "natureFootprintDepthTiles",
      "natureGrounding",
      "natureVariantCount",
    ],
  ),
  page(
    "nature/details",
    "nature",
    "Weitere Naturdetails",
    "Zusätzliche Natur- und Witterungsmerkmale.",
    ["natureExtraDetails"],
  ),
  page(
    "static-object/core",
    "staticObject",
    "Funktion und Grundform",
    "Spielzweck, Form, Proportion und Silhouette.",
    [
      "staticObjectClass",
      "staticObjectPurpose",
      "staticObjectBasicShape",
      "staticObjectProportion",
      "staticObjectSymmetry",
      "staticObjectDescription",
    ],
  ),
  page(
    "static-object/material",
    "staticObject",
    "Material und Zustand",
    "Materialflächen, Abnutzung und lesbare Details.",
    [
      "staticObjectPrimaryMaterial",
      "staticObjectSecondaryMaterial",
      "staticObjectMaterialDetails",
      "staticObjectCondition",
      "staticObjectDetailElements",
    ],
  ),
  page(
    "static-object/interaction",
    "staticObject",
    "Inhalt und Interaktion",
    "Sichtbarer Inhalt, Interaktion und Schatten.",
    ["staticObjectContents", "staticObjectInteraction", "staticObjectShadowMode"],
  ),
  page(
    "static-object/footprint",
    "staticObject",
    "Standfläche und Varianten",
    "Footprint und verwandte Objektvarianten.",
    [
      "staticObjectFootprintWidthTiles",
      "staticObjectFootprintDepthTiles",
      "staticObjectVariantCount",
    ],
  ),
  page(
    "static-object/details",
    "staticObject",
    "Weitere Objektdetails",
    "Zusätzliche Angaben zu Kontext und Lesbarkeit.",
    ["staticObjectExtraDetails"],
  ),
  page(
    "building/core",
    "building",
    "Nutzung und Baukörper",
    "Funktion, Grundriss, Größe und vertikale Staffelung.",
    [
      "buildingType",
      "buildingPurpose",
      "buildingDescription",
      "buildingPlanShape",
      "buildingSize",
      "buildingHeightPixels",
      "buildingFloors",
    ],
  ),
  page(
    "building/footprint",
    "building",
    "Footprint und Mapping",
    "Standfläche, Mapping, Kollision und Modularität.",
    [
      "buildingFootprintWidthTiles",
      "buildingFootprintDepthTiles",
      "buildingMappingMode",
      "buildingCollisionMode",
      "buildingModular",
    ],
  ),
  page(
    "building/material",
    "building",
    "Material, Dach und Fassade",
    "Konstruktion, Dachform und Fassadenaufbau.",
    [
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
    ],
  ),
  page(
    "building/openings",
    "building",
    "Türen und Fenster",
    "Öffnungen, Position, Zustand und Fensterlicht.",
    [
      "buildingDoorCount",
      "buildingDoorType",
      "buildingDoorPosition",
      "buildingDoorState",
      "buildingWindowCount",
      "buildingWindowShape",
      "buildingWindowLighting",
      "buildingWindowDetails",
    ],
  ),
  page(
    "building/environment",
    "building",
    "Zustand und Licht",
    "Belegung, Umgebung und lokale Lichtquellen.",
    [
      "buildingCondition",
      "buildingOccupancy",
      "buildingEnvironment",
      "buildingLighting",
      "buildingLightSourceDetails",
    ],
  ),
  page(
    "building/details",
    "building",
    "Weitere Architekturdetails",
    "Zusätzliche Produktions- und Anschlussangaben.",
    ["buildingExtraDetails"],
  ),
  page(
    "tileset/grid",
    "tileset",
    "Grid und Tiletyp",
    "Tiletyp, Mappingeinsatz und Materialbeschreibung.",
    ["tilesetType", "tilesetUsage", "tilesetDescription"],
  ),
  page(
    "tileset/connections",
    "tileset",
    "Kanten und Übergänge",
    "Kanten-, Ecken- und Materialübergänge.",
    [
      "tilesetEdgeSet",
      "tilesetEdgeDetails",
      "tilesetCornerSet",
      "tilesetTransitionMode",
      "tilesetSourceMaterial",
      "tilesetTargetMaterial",
    ],
  ),
  page(
    "tileset/seams",
    "tileset",
    "Seams und Wiederholung",
    "Kachelachsen, Randpixel und Wiederholungsmuster.",
    ["tileableAxes", "tilesetSeamMode", "tilesetSeamDetails", "tilesetRepeatMode"],
  ),
  page("tileset/variants", "tileset", "Varianten", "Anzahl und Art wiederholungsarmer Varianten.", [
    "tilesetVariantCount",
    "tilesetVariantKinds",
  ]),
  page(
    "tileset/atlas",
    "tileset",
    "Atlaslayout",
    "Slotzahl, Spalten, Zwischenraum und Außenrand.",
    [
      "tilesetAtlasLayout",
      "tilesetAtlasTileCount",
      "tilesetAtlasColumns",
      "tilesetAtlasGutterPixels",
      "tilesetAtlasMarginPixels",
    ],
  ),
  page(
    "tileset/details",
    "tileset",
    "Weitere Tileset-Details",
    "Zusätzliche Mapping- und Produktionshinweise.",
    ["tilesetExtraDetails"],
  ),
  page("item/core", "item", "Itemkern und Funktion", "Klasse, Zweck, Darstellung und Motiv.", [
    "itemClass",
    "itemPurpose",
    "itemPresentation",
    "itemWearPosition",
    "itemDescription",
    "itemFunctionDetails",
  ]),
  page(
    "item/material",
    "item",
    "Material und Zustand",
    "Materialien, Verarbeitung, Zustand und Leuchteffekt.",
    [
      "itemPrimaryMaterial",
      "itemSecondaryMaterial",
      "itemMaterialDetails",
      "itemCondition",
      "itemGlowMode",
    ],
  ),
  page(
    "item/readability",
    "item",
    "Bedeutung und Lesbarkeit",
    "Symbolik, Detaildichte und Silhouette.",
    ["itemSignificance", "itemMeaningDetails", "itemSilhouette", "itemReadability"],
  ),
  page(
    "item/output",
    "item",
    "Größe und Ausgabe",
    "Größe, Varianten, Schatten und weitere Vorgaben.",
    ["itemIconSize", "itemSize", "itemShadowMode", "itemVariantCount", "itemExtraDetails"],
  ),
  page("artwork/motif", "artwork", "Artwork-Ziel und Motiv", "Zweck, Motivart und Bildidee.", [
    "artworkPurpose",
    "artworkMotif",
    "artworkDescription",
  ]),
  page(
    "artwork/composition",
    "artwork",
    "Szene und Komposition",
    "Bildraum, Fokus und Blickführung.",
    ["artworkSceneDescription", "artworkComposition", "artworkCompositionDetails", "artworkFocus"],
  ),
  page(
    "artwork/background",
    "artwork",
    "Format und Hintergrund",
    "Bildformat, Hintergrundart und Tiefe.",
    ["artworkFormat", "artworkBackground", "artworkBackgroundDetails"],
  ),
  page(
    "artwork/lighting",
    "artwork",
    "Licht und Detailgrad",
    "Lichtdramaturgie, Detailgrad und Zusatzangaben.",
    ["artworkLightingDrama", "artworkLightingDetails", "artworkDetailLevel", "artworkExtraDetails"],
  ),
  page(
    "capabilities/directions",
    "capability",
    "Richtungen",
    "Vier oder acht logisch ausgerichtete Ansichten.",
    ["directionCount"],
  ),
  page(
    "capabilities/animation",
    "capability",
    "Bewegung und Animation",
    "Zeitliche Bewegung getrennt von Richtungsansichten.",
    ["animationAction", "animationType", "characterAnimationFrames", "movingObjectAnimationFrames"],
  ),
] as const satisfies readonly WizardCatalogPage[]);

export function catalogPageForStep(stepId: string): WizardCatalogPage | null {
  return WIZARD_CATALOG_PAGES.find((candidate) => candidate.id === stepId) ?? null;
}

export function isCatalogPageApplicable(
  candidate: WizardCatalogPage,
  values: Pick<WizardCoreFormValues, "category" | "subtype">,
): boolean {
  const capabilities = resolveWizardCapabilities(values);
  if (!values.category || !values.subtype || !capabilities) return false;
  if (candidate.category !== "capability" && candidate.category !== values.category) return false;

  if (candidate.sectionId === "capabilities/directions") return capabilities.directional;
  if (candidate.sectionId === "capabilities/animation") return capabilities.animated;
  if (candidate.sectionId === "character/wardrobe") {
    return (
      values.category === "character" &&
      isHumanoidCharacterSubtype(values.subtype as CharacterSubtype)
    );
  }
  if (candidate.sectionId === "character/npc-context") {
    return (
      values.category === "character" && isNpcContextSubtype(values.subtype as CharacterSubtype)
    );
  }
  if (values.category === "nature") {
    const subtype = values.subtype as NatureSubtype;
    if (candidate.sectionId === "nature/trunk") return natureSubtypeHasTrunk(subtype);
    if (candidate.sectionId === "nature/crown") return natureSubtypeHasCrown(subtype);
    if (candidate.sectionId === "nature/roots") return natureSubtypeHasRoots(subtype);
  }
  return candidate.category === values.category;
}

export function getWizardCatalogStepIds(
  values: Pick<WizardCoreFormValues, "category" | "subtype">,
): readonly WizardCatalogStepId[] {
  return Object.freeze([
    "identity",
    ...WIZARD_CATALOG_PAGES.filter((candidate) => isCatalogPageApplicable(candidate, values)).map(
      ({ id }) => id,
    ),
    ...(values.category && values.subtype ? (["review"] as const) : []),
  ]);
}

const LEGACY_STEP_SECTIONS: Readonly<Record<string, WizardCatalogSectionId | "identity">> = {
  project: "identity",
  category: "identity",
  baseProfile: "identity",
  characterDetails: "character/identity",
  movingObjectDetails: "moving-object/core",
  textureDetails: "texture/material",
  natureDetails: "nature/identity",
  staticObjectDetails: "static-object/core",
  buildingDetails: "building/core",
  tilesetDetails: "tileset/grid",
  itemDetails: "item/core",
  artworkDetails: "artwork/motif",
  directions: "capabilities/directions",
  animation: "capabilities/animation",
  tileability: "tileset/seams",
};

export function migrateWizardCatalogStepId(
  requestedStepId: string,
  values: Pick<WizardCoreFormValues, "category" | "subtype">,
): WizardCatalogStepId {
  const applicable = getWizardCatalogStepIds(values);
  if (applicable.includes(requestedStepId as WizardCatalogStepId)) {
    return requestedStepId as WizardCatalogStepId;
  }
  const legacy =
    requestedStepId === "tileability"
      ? values.category === "texture"
        ? "texture/grid"
        : values.category === "tileset"
          ? "tileset/seams"
          : undefined
      : LEGACY_STEP_SECTIONS[requestedStepId];
  const migrated =
    legacy === "identity" ? "identity" : legacy ? (`catalog/${legacy}` as const) : null;
  if (migrated && applicable.includes(migrated)) return migrated;
  return applicable[0] ?? "identity";
}

function schemaForPage(candidate: WizardCatalogPage) {
  switch (candidate.category) {
    case "character":
      return WizardCharacterDetailsStepSchema;
    case "movingObject":
      return WizardMovingObjectDetailsStepSchema;
    case "texture":
      return WizardTextureDetailsStepSchema;
    case "nature":
      return WizardNatureDetailsStepSchema;
    case "staticObject":
      return WizardStaticObjectDetailsStepSchema;
    case "building":
      return WizardBuildingDetailsStepSchema;
    case "tileset":
      return WizardTilesetDetailsStepSchema;
    case "item":
      return WizardItemDetailsStepSchema;
    case "artwork":
      return WizardArtworkDetailsStepSchema;
    case "capability":
      return candidate.sectionId === "capabilities/directions"
        ? WizardDirectionStepSchema
        : WizardAnimationStepSchema;
  }
}

function copyScopedIssues(
  result: ReturnType<typeof WizardCoreFormSchema.safeParse>,
  allowed: ReadonlySet<string>,
  context: z.RefinementCtx,
): void {
  if (result.success) return;
  for (const issue of result.error.issues) {
    const first = issue.path[0];
    if (typeof first !== "string" || !allowed.has(first)) continue;
    context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
}

function scopedSchema(
  fieldPaths: readonly WizardCoreFieldPath[],
  sourceSchema: z.ZodType<WizardCoreFormValues, WizardCoreFormValues>,
): z.ZodType<WizardCoreFormValues, WizardCoreFormValues> {
  const allowed = new Set<string>([
    "projectName",
    "category",
    "subtype",
    ...WIZARD_BASE_CONTEXT_FIELD_PATHS,
    ...fieldPaths,
  ]);
  return z
    .custom<WizardCoreFormValues>((value) => typeof value === "object" && value !== null)
    .superRefine((values, context) =>
      copyScopedIssues(sourceSchema.safeParse(values), allowed, context),
    );
}

export const WizardCatalogIdentitySchema = scopedSchema(
  ["projectName", "category", "subtype"],
  WizardCategoryStepSchema,
);

export function schemaForCatalogPage(
  candidate: WizardCatalogPage,
): z.ZodType<WizardCoreFormValues, WizardCoreFormValues> {
  return scopedSchema(candidate.fieldPaths, schemaForPage(candidate));
}

export function schemaForCatalogReview(
  values: Pick<WizardCoreFormValues, "category">,
): z.ZodType<WizardCoreFormValues, WizardCoreFormValues> {
  const candidate = WIZARD_CATALOG_PAGES.find((page) => page.category === values.category);
  const source = candidate ? schemaForPage(candidate) : WizardCategoryStepSchema;
  return scopedSchema(Object.keys(WizardCoreFormSchema.shape) as WizardCoreFieldPath[], source);
}

export const WizardCatalogReviewSchema = z
  .custom<WizardCoreFormValues>((value) => typeof value === "object" && value !== null)
  .superRefine((values, context) => {
    const result = schemaForCatalogReview(values).safeParse(values);
    copyScopedIssues(result, new Set(Object.keys(WizardCoreFormSchema.shape)), context);
  });

function legacyStepForCatalogStep(
  stepId: WizardCatalogStepId,
  values: Pick<WizardCoreFormValues, "category">,
): WizardCoreStepId {
  if (stepId === "identity") return "category";
  if (stepId === "review") {
    switch (values.category) {
      case "character":
        return "characterDetails";
      case "movingObject":
        return "movingObjectDetails";
      case "texture":
        return "textureDetails";
      case "nature":
        return "natureDetails";
      case "staticObject":
        return "staticObjectDetails";
      case "building":
        return "buildingDetails";
      case "tileset":
        return "tilesetDetails";
      case "item":
        return "itemDetails";
      case "artwork":
        return "artworkDetails";
      default:
        return "category";
    }
  }

  const candidate = catalogPageForStep(stepId);
  if (candidate?.sectionId === "capabilities/directions") return "directions";
  if (candidate?.sectionId === "capabilities/animation") return "animation";
  switch (candidate?.category) {
    case "character":
      return "characterDetails";
    case "movingObject":
      return "movingObjectDetails";
    case "texture":
      return "textureDetails";
    case "nature":
      return "natureDetails";
    case "staticObject":
      return "staticObjectDetails";
    case "building":
      return "buildingDetails";
    case "tileset":
      return "tilesetDetails";
    case "item":
      return "itemDetails";
    case "artwork":
      return "artworkDetails";
    default:
      return "category";
  }
}

function jsonRecord(values: WizardCoreFormValues): Record<string, z.infer<typeof z.json>> {
  return JSON.parse(JSON.stringify(values)) as Record<string, z.infer<typeof z.json>>;
}

export interface UpdateWizardDraftFromCatalogFormInput {
  readonly draft: WizardDraft;
  readonly values: WizardCoreFormValues;
  readonly stepId: WizardCatalogStepId;
  readonly completedStepIds?: readonly WizardCatalogStepId[];
  readonly selectionSnapshot?: WizardCoreFormValues;
  readonly savedAt?: string;
  readonly context: Readonly<{ library: ProfileLibrary | null }>;
}

export function updateWizardDraftFromCatalogForm(
  input: UpdateWizardDraftFromCatalogFormInput,
): WizardDraft | null {
  const projected = updateWizardDraftFromCoreForm({
    draft: input.draft,
    values: input.values,
    stepId: legacyStepForCatalogStep(input.stepId, input.values),
    ...(input.savedAt ? { savedAt: input.savedAt } : {}),
    context: input.context,
  });
  if (!projected) return null;

  const applicable = new Set(getWizardCatalogStepIds(input.values));
  const completedStepIds = (input.completedStepIds ?? projected.completedStepIds ?? []).filter(
    (stepId): stepId is WizardCatalogStepId => applicable.has(stepId as WizardCatalogStepId),
  );
  const selectionChanged =
    input.selectionSnapshot !== undefined &&
    (input.selectionSnapshot.category !== input.values.category ||
      input.selectionSnapshot.subtype !== input.values.subtype);
  const selectionHistory = selectionChanged
    ? [
        ...(projected.selectionHistory ?? []),
        {
          category: input.selectionSnapshot?.category ?? null,
          subtype: input.selectionSnapshot?.subtype ?? null,
          rawValues: jsonRecord(input.selectionSnapshot),
          capturedAt: input.savedAt ?? projected.savedAt,
        },
      ].slice(-8)
    : projected.selectionHistory;
  const hasSelection = "category" in projected;
  const route = hasSelection
    ? input.stepId === "review"
      ? "wizard/review"
      : projected.baseProfileId
        ? "wizard/editor"
        : "wizard/profile"
    : "wizard/category";

  return parseWizardDraft({
    ...projected,
    route,
    currentStep: input.stepId,
    catalogVersion: WIZARD_CATALOG_VERSION,
    completedStepIds,
    ...(selectionHistory ? { selectionHistory } : {}),
  });
}
