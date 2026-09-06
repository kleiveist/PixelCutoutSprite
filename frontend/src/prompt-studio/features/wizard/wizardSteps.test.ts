import { describe, expect, it } from "vitest";
import {
  WIZARD_CORE_STEPS,
  WIZARD_ARTWORK_DETAIL_FIELD_PATHS,
  WIZARD_BUILDING_DETAIL_FIELD_PATHS,
  WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
  WIZARD_ITEM_DETAIL_FIELD_PATHS,
  WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS,
  WIZARD_NATURE_DETAIL_FIELD_PATHS,
  WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS,
  WIZARD_TILESET_DETAIL_FIELD_PATHS,
  WIZARD_TEXTURE_DETAIL_FIELD_PATHS,
  WizardAnimationStepSchema,
  WizardArtworkDetailsStepSchema,
  WizardBaseProfileStepSchema,
  WizardBuildingDetailsStepSchema,
  WizardCategoryStepSchema,
  WizardCharacterDetailsStepSchema,
  WizardDirectionStepSchema,
  WizardItemDetailsStepSchema,
  WizardMovingObjectDetailsStepSchema,
  WizardNatureDetailsStepSchema,
  WizardProjectStepSchema,
  WizardStaticObjectDetailsStepSchema,
  WizardTilesetDetailsStepSchema,
  WizardTextureDetailsStepSchema,
  WizardTileabilityStepSchema,
  getWizardCoreFallbackStepId,
  getWizardCoreStep,
  getWizardCoreStepIndex,
} from "./wizardSteps";

describe("wizard core steps", () => {
  const technicalValues = {
    baseProfileId: "base_world_80",
    pixelDensity: "modernHd" as const,
    styleProfile: "both" as const,
    tileSize: 32,
    characterHeight: 80,
    perspectiveType: "threeQuarter" as const,
    cameraAngle: 60 as const,
    cameraDirection: "southToNorth" as const,
    projectionType: "orthographic" as const,
    outlineStyle: "softSelective" as const,
    paletteMode: "byProfile" as const,
    backgroundMode: "transparent" as const,
    alphaPadding: 8,
    nearestNeighbor: true,
    lightingPolicy: "adaptive" as const,
    lightingNotes: "Keep world light stable.",
  };

  it("declares category-first core steps and capability-owned field paths", () => {
    expect(WIZARD_CORE_STEPS.map((step) => step.id)).toEqual([
      "project",
      "category",
      "baseProfile",
      "characterDetails",
      "movingObjectDetails",
      "textureDetails",
      "natureDetails",
      "staticObjectDetails",
      "buildingDetails",
      "tilesetDetails",
      "itemDetails",
      "artworkDetails",
      "directions",
      "animation",
      "tileability",
    ]);
    expect(getWizardCoreStep("project").fieldPaths).toEqual(["projectName"]);
    expect(getWizardCoreStep("category").fieldPaths).toEqual(["category", "subtype"]);
    expect(getWizardCoreStep("baseProfile").fieldPaths).toEqual(
      expect.arrayContaining(["baseProfileId", "tileSize", "lightingPolicy"]),
    );
    expect(getWizardCoreStep("characterDetails").fieldPaths).toBe(
      WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
    );
    expect(getWizardCoreStep("characterDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Figur und Rolle",
    });
    expect(getWizardCoreStep("movingObjectDetails").fieldPaths).toBe(
      WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS,
    );
    expect(getWizardCoreStep("movingObjectDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Objekt und Bewegung",
    });
    expect(getWizardCoreStep("textureDetails").fieldPaths).toBe(WIZARD_TEXTURE_DETAIL_FIELD_PATHS);
    expect(getWizardCoreStep("textureDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Textur und Material",
    });
    expect(getWizardCoreStep("natureDetails").fieldPaths).toBe(WIZARD_NATURE_DETAIL_FIELD_PATHS);
    expect(getWizardCoreStep("natureDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Pflanze und Natur",
    });
    expect(getWizardCoreStep("staticObjectDetails").fieldPaths).toBe(
      WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS,
    );
    expect(getWizardCoreStep("staticObjectDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Statisches Weltobjekt",
    });
    expect(getWizardCoreStep("buildingDetails").fieldPaths).toBe(
      WIZARD_BUILDING_DETAIL_FIELD_PATHS,
    );
    expect(getWizardCoreStep("buildingDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Gebäude und Architektur",
    });
    expect(getWizardCoreStep("tilesetDetails").fieldPaths).toBe(WIZARD_TILESET_DETAIL_FIELD_PATHS);
    expect(getWizardCoreStep("tilesetDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Tileset und Kartenelement",
    });
    expect(getWizardCoreStep("itemDetails").fieldPaths).toBe(WIZARD_ITEM_DETAIL_FIELD_PATHS);
    expect(getWizardCoreStep("itemDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Item und Ausrüstung",
    });
    expect(getWizardCoreStep("artworkDetails").fieldPaths).toBe(WIZARD_ARTWORK_DETAIL_FIELD_PATHS);
    expect(getWizardCoreStep("artworkDetails")).toMatchObject({
      route: "wizard/editor",
      title: "Artwork und Konzeptbild",
    });
    expect(getWizardCoreStep("directions").fieldPaths).toEqual(["directionCount"]);
    expect(getWizardCoreStep("animation").fieldPaths).toEqual([
      "animationAction",
      "animationType",
      "characterAnimationFrames",
      "movingObjectAnimationFrames",
    ]);
    expect(getWizardCoreStep("tileability").fieldPaths).toEqual(["tileableAxes"]);
    expect(getWizardCoreStepIndex("project")).toBe(0);
    expect(getWizardCoreStepIndex("category")).toBe(1);
    expect(getWizardCoreStepIndex("baseProfile")).toBe(2);
    expect(getWizardCoreStepIndex("characterDetails")).toBe(3);
    expect(getWizardCoreStepIndex("movingObjectDetails")).toBe(4);
    expect(getWizardCoreStepIndex("textureDetails")).toBe(5);
    expect(getWizardCoreStepIndex("natureDetails")).toBe(6);
    expect(getWizardCoreStepIndex("staticObjectDetails")).toBe(7);
    expect(getWizardCoreStepIndex("buildingDetails")).toBe(8);
    expect(getWizardCoreStepIndex("tilesetDetails")).toBe(9);
    expect(getWizardCoreStepIndex("itemDetails")).toBe(10);
    expect(getWizardCoreStepIndex("artworkDetails")).toBe(11);
    expect(getWizardCoreStepIndex("directions")).toBe(12);
  });

  it("owns the free Artwork boundary without game-asset fields", () => {
    expect(WIZARD_ARTWORK_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_ARTWORK_DETAIL_FIELD_PATHS).not.toContain("tileSize");
    expect(WIZARD_ARTWORK_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_ARTWORK_DETAIL_FIELD_PATHS).not.toContain("animationType");
    expect(
      WizardArtworkDetailsStepSchema.safeParse({
        projectName: "Artwork",
        category: "artwork",
        subtype: "scene",
      }).success,
    ).toBe(false);
  });

  it("owns the complete Item boundary without technical or direction fields", () => {
    expect(WIZARD_ITEM_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_ITEM_DETAIL_FIELD_PATHS).not.toContain("tileSize");
    expect(WIZARD_ITEM_DETAIL_FIELD_PATHS).not.toContain("backgroundMode");
    expect(WIZARD_ITEM_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(
      WizardItemDetailsStepSchema.safeParse({
        projectName: "Item",
        category: "item",
        subtype: "weapon",
      }).success,
    ).toBe(false);
  });

  it("owns the complete Tileset boundary without duplicated Grid or directions", () => {
    expect(WIZARD_TILESET_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_TILESET_DETAIL_FIELD_PATHS).not.toContain("tileSize");
    expect(WIZARD_TILESET_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_TILESET_DETAIL_FIELD_PATHS).not.toContain("animationType");
  });

  it("owns the complete Building boundary without technical scale or directions", () => {
    expect(WIZARD_BUILDING_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_BUILDING_DETAIL_FIELD_PATHS).not.toContain("characterHeight");
    expect(WIZARD_BUILDING_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_BUILDING_DETAIL_FIELD_PATHS).not.toContain("tileSize");
    expect(WIZARD_BUILDING_DETAIL_FIELD_PATHS).not.toContain("animationType");
  });

  it("owns the complete static-object boundary without animation or directions", () => {
    expect(WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS).not.toContain("animationType");
    expect(WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS).not.toContain("tileSize");
  });

  it("owns the complete Nature detail boundary without animation or directions", () => {
    expect(WIZARD_NATURE_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_NATURE_DETAIL_FIELD_PATHS).not.toContain("animationType");
    expect(WIZARD_NATURE_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_NATURE_DETAIL_FIELD_PATHS).not.toContain("tileSize");
  });

  it("owns the complete Texture answer boundary without duplicating technical tile size", () => {
    expect(WIZARD_TEXTURE_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_TEXTURE_DETAIL_FIELD_PATHS).not.toContain("tileSize");
    expect(WIZARD_TEXTURE_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_TEXTURE_DETAIL_FIELD_PATHS).not.toContain("animationType");
  });

  it("declares the complete moving-object detail boundary without direction or animation fields", () => {
    expect(WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS).not.toContain("movingObjectAnimationFrames");
  });

  it("declares the complete Character/NPC answer paths without duplicating technical height", () => {
    expect(WIZARD_CHARACTER_DETAIL_FIELD_PATHS).toEqual([
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
    ]);
    expect(WIZARD_CHARACTER_DETAIL_FIELD_PATHS).not.toContain("characterHeight");
    expect(WIZARD_CHARACTER_DETAIL_FIELD_PATHS).not.toContain("directionCount");
    expect(WIZARD_CHARACTER_DETAIL_FIELD_PATHS).not.toContain("characterAnimationFrames");
  });

  it("validates the required project name at each navigation boundary", () => {
    expect(WizardProjectStepSchema.safeParse({ projectName: "" }).success).toBe(false);
    expect(WizardCategoryStepSchema.safeParse({ projectName: "   " }).success).toBe(false);
    expect(WizardProjectStepSchema.parse({ projectName: "  Winterwald  " })).toEqual({
      projectName: "Winterwald",
    });
  });

  it("requires a category-matching subtype before capability routing", () => {
    expect(
      WizardCategoryStepSchema.safeParse({
        projectName: "Winterwald",
        category: "character",
      }).success,
    ).toBe(false);
    expect(
      WizardCategoryStepSchema.safeParse({
        projectName: "Winterwald",
        category: "character",
        subtype: "wood",
      }).success,
    ).toBe(false);

    const npc = {
      projectName: "Winterwald",
      category: "character" as const,
      subtype: "npc" as const,
      ...technicalValues,
    };
    expect(WizardCategoryStepSchema.safeParse(npc).success).toBe(true);
    expect(WizardBaseProfileStepSchema.safeParse(npc).success).toBe(true);
    expect(WizardDirectionStepSchema.safeParse(npc).success).toBe(true);
    expect(WizardAnimationStepSchema.safeParse(npc).success).toBe(true);
    expect(WizardTileabilityStepSchema.safeParse(npc).success).toBe(false);

    const wood = {
      projectName: "Holzboden",
      category: "texture" as const,
      subtype: "wood" as const,
      ...technicalValues,
      seamless: true,
    };
    expect(WizardDirectionStepSchema.safeParse(wood).success).toBe(false);
    expect(WizardAnimationStepSchema.safeParse(wood).success).toBe(false);
    expect(WizardTileabilityStepSchema.safeParse(wood).success).toBe(true);

    expect(
      WizardAnimationStepSchema.safeParse({
        projectName: "Windbaum",
        category: "nature",
        subtype: "tree",
        ...technicalValues,
        animationType: "lava",
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        projectName: "Windbaum",
        category: "nature",
        subtype: "tree",
        ...technicalValues,
        animationType: "wind",
      }).success,
    ).toBe(true);

    expect(
      WizardBaseProfileStepSchema.safeParse({
        projectName: "Basis fehlt",
        category: "character",
        subtype: "npc",
      }).success,
    ).toBe(false);
    expect(
      WizardBaseProfileStepSchema.safeParse({
        projectName: "Figurenhöhe fehlt",
        category: "character",
        subtype: "npc",
        ...technicalValues,
        characterHeight: undefined,
      }).success,
    ).toBe(false);
  });

  it("validates Nature subtype derivation, paired footprint, and anatomy at the step boundary", () => {
    const tree = {
      projectName: "Windbaum",
      category: "nature" as const,
      subtype: "tree" as const,
      ...technicalValues,
      naturePlantType: "tree" as const,
      natureTrunkThickness: "massive" as const,
      natureCrownShape: "spreading" as const,
      natureRootVisibility: "visible" as const,
      natureFootprintWidthTiles: 3,
      natureFootprintDepthTiles: 2,
    };
    expect(WizardNatureDetailsStepSchema.safeParse(tree).success).toBe(true);
    const mismatchedPlantType = WizardNatureDetailsStepSchema.safeParse({
      ...tree,
      naturePlantType: "mushroom",
    });
    expect(mismatchedPlantType.success).toBe(false);
    if (mismatchedPlantType.success) {
      throw new Error("A mismatched derived plant type must not parse.");
    }
    expect(mismatchedPlantType.error.issues).toContainEqual(
      expect.objectContaining({ path: ["subtype"] }),
    );
    expect(
      WizardNatureDetailsStepSchema.safeParse({
        ...tree,
        natureFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardNatureDetailsStepSchema.safeParse({
        ...tree,
        subtype: "mushroom",
        naturePlantType: "mushroom",
        natureTrunkThickness: "thin",
        natureCrownShape: undefined,
        natureRootVisibility: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardNatureDetailsStepSchema.safeParse({
        ...tree,
        category: "texture",
        subtype: "wood",
        naturePlantType: undefined,
        natureTrunkThickness: undefined,
        natureCrownShape: undefined,
        natureRootVisibility: undefined,
        natureFootprintWidthTiles: undefined,
        natureFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
  });

  it("validates static-object class derivation and paired footprint at the step boundary", () => {
    const chest = {
      projectName: "Alte Truhe",
      category: "staticObject" as const,
      subtype: "chest" as const,
      ...technicalValues,
      staticObjectClass: "container" as const,
      staticObjectPurpose: "interactive" as const,
      staticObjectBasicShape: "boxy" as const,
      staticObjectFootprintWidthTiles: 2,
      staticObjectFootprintDepthTiles: 1,
      staticObjectInteraction: "open" as const,
    };

    expect(WizardStaticObjectDetailsStepSchema.safeParse(chest).success).toBe(true);
    const mismatchedClass = WizardStaticObjectDetailsStepSchema.safeParse({
      ...chest,
      staticObjectClass: "furniture",
    });
    expect(mismatchedClass.success).toBe(false);
    if (mismatchedClass.success) {
      throw new Error("A mismatched derived object class must not parse.");
    }
    expect(mismatchedClass.error.issues).toContainEqual(
      expect.objectContaining({ path: ["subtype"] }),
    );
    expect(
      WizardStaticObjectDetailsStepSchema.safeParse({
        ...chest,
        staticObjectFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardStaticObjectDetailsStepSchema.safeParse({
        ...chest,
        category: "nature",
        subtype: "tree",
        staticObjectClass: undefined,
        staticObjectFootprintWidthTiles: undefined,
        staticObjectFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardDirectionStepSchema.safeParse({
        ...chest,
        directionCount: 8,
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...chest,
        animationType: "openClose",
      }).success,
    ).toBe(true);
  });

  it("validates Building type, footprint, modularity, and independent gate animation", () => {
    const gate = {
      projectName: "Nordtor",
      category: "building" as const,
      subtype: "gate" as const,
      ...technicalValues,
      buildingType: "gate" as const,
      buildingPurpose: "Bewachter Stadteingang",
      buildingFootprintWidthTiles: 4,
      buildingFootprintDepthTiles: 2,
      buildingFloors: 2,
      buildingMappingMode: "modularSet" as const,
      buildingModular: true,
      buildingLighting: "worldAligned" as const,
    };

    expect(WizardBuildingDetailsStepSchema.safeParse(gate).success).toBe(true);
    const mismatchedType = WizardBuildingDetailsStepSchema.safeParse({
      ...gate,
      buildingType: "residential",
    });
    expect(mismatchedType.success).toBe(false);
    if (mismatchedType.success) {
      throw new Error("A mismatched derived Building type must not parse.");
    }
    expect(mismatchedType.error.issues).toContainEqual(
      expect.objectContaining({ path: ["subtype"] }),
    );
    expect(
      WizardBuildingDetailsStepSchema.safeParse({
        ...gate,
        buildingFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardBuildingDetailsStepSchema.safeParse({
        ...gate,
        subtype: "house",
        buildingType: "residential",
        buildingMappingMode: "modularSet",
        buildingModular: true,
      }).success,
    ).toBe(false);
    expect(
      WizardDirectionStepSchema.safeParse({
        ...gate,
        directionCount: 8,
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...gate,
        animationType: "openClose",
      }).success,
    ).toBe(true);
  });

  it("validates Tileset connections, repetition, and Atlas layout at its own boundary", () => {
    const autotile = {
      projectName: "Wiesen-Autotile",
      category: "tileset" as const,
      subtype: "autotile" as const,
      ...technicalValues,
      tilesetType: "autotile" as const,
      tilesetUsage: "transition" as const,
      tilesetEdgeSet: "cardinalAndDiagonal" as const,
      tilesetCornerSet: "innerAndOuter" as const,
      tilesetTransitionMode: "bidirectional" as const,
      tilesetSourceMaterial: "Gras",
      tilesetTargetMaterial: "Erde",
      tilesetSeamMode: "matchedEdges" as const,
      tileableAxes: "both" as const,
      tilesetRepeatMode: "randomized" as const,
      tilesetVariantCount: 6,
      tilesetVariantKinds: ["clean", "damaged"] as const,
      tilesetAtlasLayout: "fixedColumns" as const,
      tilesetAtlasTileCount: 47,
      tilesetAtlasColumns: 8,
      tilesetAtlasGutterPixels: 1,
      tilesetAtlasMarginPixels: 2,
    };

    expect(WizardTilesetDetailsStepSchema.safeParse(autotile).success).toBe(true);
    expect(
      WizardTilesetDetailsStepSchema.safeParse({
        ...autotile,
        tilesetType: "edge",
      }).success,
    ).toBe(false);
    expect(
      WizardTilesetDetailsStepSchema.safeParse({
        ...autotile,
        subtype: "groundTile",
        tilesetType: "ground",
      }).success,
    ).toBe(false);
    expect(
      WizardTilesetDetailsStepSchema.safeParse({
        ...autotile,
        tilesetAtlasColumns: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardTilesetDetailsStepSchema.safeParse({
        ...autotile,
        tilesetRepeatMode: "nonRepeating",
        tileableAxes: "both",
      }).success,
    ).toBe(false);
    expect(
      WizardDirectionStepSchema.safeParse({
        ...autotile,
        directionCount: 8,
      }).success,
    ).toBe(false);
  });

  it("scopes the Character-details boundary to a classified character with a Base profile", () => {
    const npc = {
      projectName: "Dorfschmied",
      category: "character" as const,
      subtype: "npc" as const,
      ...technicalValues,
      role: "blacksmith",
      age: "adult" as const,
      bodyBuild: "sturdy" as const,
      materials: "worn leather and dark iron",
      expression: "serious" as const,
      silhouette: "broad apron and hammer",
    };

    expect(WizardCharacterDetailsStepSchema.safeParse(npc).success).toBe(true);
    expect(
      WizardCharacterDetailsStepSchema.safeParse({
        ...npc,
        category: "texture",
        subtype: "wood",
      }).success,
    ).toBe(false);
    expect(
      WizardCharacterDetailsStepSchema.safeParse({
        projectName: "Noch ohne Basis",
        category: "character",
        subtype: "npc",
        role: "blacksmith",
      }).success,
    ).toBe(false);
  });

  it("validates canonical Character actions and their independent frame counts", () => {
    const npc = {
      projectName: "Animierter Schmied",
      category: "character" as const,
      subtype: "npc" as const,
      ...technicalValues,
      characterAnimationFrames: {
        idle: 4,
        walk: 5,
        run: 6,
        attack: 7,
        use: 5,
        talk: 4,
        interact: 3,
        hurt: 2,
        special: 8,
      },
    };

    expect(WizardAnimationStepSchema.safeParse(npc).success).toBe(true);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...npc,
        characterAnimationFrames: { walk: 0 },
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...npc,
        characterAnimationFrames: { walk: 9 },
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...npc,
        category: "nature",
        subtype: "tree",
        characterHeight: undefined,
        animationType: "wind",
      }).success,
    ).toBe(false);
  });

  it("validates cart details and a directionless floating-crystal animation at their separate boundaries", () => {
    const cart = {
      projectName: "Händlerwagen",
      category: "movingObject" as const,
      subtype: "cart" as const,
      ...technicalValues,
      movingObjectClass: "cart" as const,
      movingObjectPurpose: "Transport",
      movingObjectFootprintWidthTiles: 2,
      movingObjectFootprintDepthTiles: 1,
      movementType: "roll" as const,
      directionCount: 8 as const,
      movingObjectAnimationFrames: { move: 6 },
    };
    const crystal = {
      projectName: "Pulsierender Kristall",
      category: "movingObject" as const,
      subtype: "floatingCrystal" as const,
      ...technicalValues,
      movingObjectClass: "floatingObject" as const,
      movementType: "hover" as const,
      movingObjectAnimationFrames: { pulse: 4 },
    };

    expect(WizardMovingObjectDetailsStepSchema.safeParse(cart).success).toBe(true);
    expect(WizardDirectionStepSchema.safeParse(cart).success).toBe(true);
    expect(WizardAnimationStepSchema.safeParse(cart).success).toBe(true);
    expect(WizardMovingObjectDetailsStepSchema.safeParse(crystal).success).toBe(true);
    expect(WizardAnimationStepSchema.safeParse(crystal).success).toBe(true);
    expect(WizardDirectionStepSchema.safeParse(crystal).success).toBe(false);

    expect(
      WizardMovingObjectDetailsStepSchema.safeParse({
        ...cart,
        movingObjectFootprintDepthTiles: undefined,
      }).success,
    ).toBe(false);
    expect(
      WizardMovingObjectDetailsStepSchema.safeParse({
        ...cart,
        movingObjectClass: "floatingObject",
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...crystal,
        directionCount: 4,
      }).success,
    ).toBe(false);
    expect(
      WizardAnimationStepSchema.safeParse({
        ...crystal,
        movingObjectAnimationFrames: { pulse: 17 },
      }).success,
    ).toBe(false);
  });

  it("validates Texture details against their material subtype without directions or animation", () => {
    const wood = {
      projectName: "Eichenplanken",
      category: "texture" as const,
      subtype: "wood" as const,
      ...technicalValues,
      textureMaterialType: "wood" as const,
      textureUsage: "floor" as const,
      textureDescription: "Breite Eichenplanken mit ruhiger Maserung",
      seamless: true,
      textureStructure: "medium" as const,
      textureCondition: "old" as const,
      textureSurface: "planked" as const,
      textureMoisture: "dry" as const,
      textureIcing: "none" as const,
      textureLighting: "neutralEven" as const,
      textureOrientation: "grainAligned" as const,
    };

    expect(WizardTextureDetailsStepSchema.safeParse(wood).success).toBe(true);
    expect(
      WizardTextureDetailsStepSchema.safeParse({
        ...wood,
        textureMaterialType: "stone",
      }).success,
    ).toBe(false);
    expect(
      WizardTextureDetailsStepSchema.safeParse({
        ...wood,
        category: "character",
        subtype: "npc",
        characterHeight: 80,
      }).success,
    ).toBe(false);
    expect(
      WizardTextureDetailsStepSchema.safeParse({
        ...wood,
        directionCount: 8,
      }).success,
    ).toBe(false);
    expect(
      WizardTextureDetailsStepSchema.safeParse({
        ...wood,
        animationType: "glow",
      }).success,
    ).toBe(false);
  });

  it("derives safe fallbacks from persisted routes", () => {
    expect(getWizardCoreFallbackStepId("wizard/project")).toBe("project");
    expect(getWizardCoreFallbackStepId("wizard/category")).toBe("category");
    expect(getWizardCoreFallbackStepId("wizard/profile")).toBe("baseProfile");
    expect(getWizardCoreFallbackStepId("wizard/editor")).toBe("baseProfile");
  });
});
