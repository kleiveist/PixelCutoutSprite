# P28 · Vollständiges Wizard- und Ausgabeinventar

Quelle der Wahrheit ist die ausführbare Zuordnung
[`questionnaireInventory.ts`](../../../frontend/src/prompt-studio/domain/catalog/questionnaireInventory.ts).
Der Test [`v3Catalog.test.ts`](../../../frontend/src/prompt-studio/domain/catalog/v3Catalog.test.ts)
vergleicht deren Schlüssel gegen sämtliche Schlüssel von `WizardCoreFormSchema`. Aktuell sind
**230 von 230 Feldern** einer stabilen Katalogseite zugeordnet.

## Stabile Seiten und Felder

- `identity`: `projectName`, `category`, `subtype`
- `base`: `baseProfileId`, `pixelDensity`, `styleProfile`, `tileSize`, `characterHeight`,
  `perspectiveType`, `cameraAngle`, `cameraDirection`, `projectionType`, `outlineStyle`,
  `paletteMode`, `backgroundMode`, `alphaPadding`, `nearestNeighbor`, `lightingPolicy`,
  `lightingNotes`
- `character:details`: `subjectDescription`, `extraDetails`, `role`, `variantCount`,
  `genderPresentation`, `age`, `relativeHeight`, `bodyBuild`, `posture`, `faceShape`, `skinTone`,
  `eyeVisibility`, `hair`, `hairstyle`, `beard`, `hat`, `headwearCondition`, `scarf`, `outerwear`,
  `lowerwear`, `clothingLayers`, `gloves`, `handPose`, `shoes`, `beltBags`, `accessories`,
  `backItem`, `equipment`, `materials`, `characterPaletteSource`, `primaryColor`,
  `secondaryColor`, `accentColor`, `condition`, `expression`, `silhouette`, `pose`,
  `professionReadable`, `socialRole`, `wealth`, `culturalFunction`, `typicalActivity`,
  `conversationGesture`, `everydayTool`, `frontBackDetails`
- `character:animation`: `characterAnimationFrames`
- `movingObject:details`: `movingObjectClass`, `movingObjectPurpose`, `movingObjectBasicShape`,
  `movingObjectDescription`, `movingObjectFootprintWidthTiles`, `movingObjectFootprintDepthTiles`,
  `movingObjectHeightPixels`, `movingObjectAnchorMode`, `movingObjectMechanism`,
  `movingObjectMaterial`, `movingObjectMaterialDetails`, `movingObjectCondition`,
  `movingObjectLightingBehavior`, `movingObjectShadowMode`, `movingObjectExtraDetails`
- `movingObject:animation`: `movingObjectAnimationFrames`
- `texture:details`: `textureMaterialType`, `textureUsage`, `textureDescription`,
  `textureStructure`, `textureCondition`, `textureSurface`, `textureMoisture`, `textureIcing`,
  `textureLighting`, `textureOrientation`, `textureExtraDetails`
- `nature:details`: `naturePlantType`, `natureSpecies`, `natureDescription`, `natureClimate`,
  `natureSeason`, `natureAge`, `natureSilhouette`, `natureTrunkThickness`, `natureTrunkShape`,
  `natureTrunkDetails`, `natureCrownShape`, `natureCrownDensity`, `natureFoliageDetails`,
  `natureRootVisibility`, `natureRootDetails`, `natureMossCoverage`, `natureMushroomGrowth`,
  `natureSnowCover`, `natureVineGrowth`, `natureFootprintWidthTiles`,
  `natureFootprintDepthTiles`, `natureGrounding`, `natureVariantCount`, `natureExtraDetails`
- `staticObject:details`: `staticObjectClass`, `staticObjectPurpose`, `staticObjectBasicShape`,
  `staticObjectProportion`, `staticObjectSymmetry`, `staticObjectDescription`,
  `staticObjectPrimaryMaterial`, `staticObjectSecondaryMaterial`, `staticObjectMaterialDetails`,
  `staticObjectCondition`, `staticObjectDetailElements`, `staticObjectContents`,
  `staticObjectInteraction`, `staticObjectFootprintWidthTiles`, `staticObjectFootprintDepthTiles`,
  `staticObjectShadowMode`, `staticObjectVariantCount`, `staticObjectExtraDetails`
- `building:details`: `buildingType`, `buildingPurpose`, `buildingDescription`,
  `buildingPlanShape`, `buildingSize`, `buildingFootprintWidthTiles`,
  `buildingFootprintDepthTiles`, `buildingHeightPixels`, `buildingFloors`,
  `buildingPrimaryMaterial`, `buildingSecondaryMaterial`, `buildingMaterialDetails`,
  `buildingRoofShape`, `buildingRoofPitch`, `buildingRoofMaterial`, `buildingRoofCondition`,
  `buildingRoofDetails`, `buildingFacadeStyle`, `buildingFacadeDetails`, `buildingDoorCount`,
  `buildingDoorType`, `buildingDoorPosition`, `buildingDoorState`, `buildingWindowCount`,
  `buildingWindowShape`, `buildingWindowLighting`, `buildingWindowDetails`, `buildingCondition`,
  `buildingOccupancy`, `buildingEnvironment`, `buildingMappingMode`, `buildingCollisionMode`,
  `buildingModular`, `buildingLighting`, `buildingLightSourceDetails`, `buildingExtraDetails`
- `tileset:details`: `tilesetType`, `tilesetUsage`, `tilesetDescription`, `tilesetEdgeSet`,
  `tilesetEdgeDetails`, `tilesetCornerSet`, `tilesetTransitionMode`, `tilesetSourceMaterial`,
  `tilesetTargetMaterial`, `tilesetSeamMode`, `tilesetSeamDetails`, `tilesetRepeatMode`,
  `tilesetVariantCount`, `tilesetVariantKinds`, `tilesetAtlasLayout`, `tilesetAtlasTileCount`,
  `tilesetAtlasColumns`, `tilesetAtlasGutterPixels`, `tilesetAtlasMarginPixels`,
  `tilesetExtraDetails`
- `item:details`: `itemClass`, `itemPurpose`, `itemPresentation`, `itemWearPosition`,
  `itemIconSize`, `itemSize`, `itemDescription`, `itemPrimaryMaterial`, `itemSecondaryMaterial`,
  `itemMaterialDetails`, `itemCondition`, `itemFunctionDetails`, `itemSignificance`,
  `itemMeaningDetails`, `itemSilhouette`, `itemReadability`, `itemGlowMode`, `itemShadowMode`,
  `itemVariantCount`, `itemExtraDetails`
- `artwork:details`: `artworkPurpose`, `artworkMotif`, `artworkDescription`,
  `artworkSceneDescription`, `artworkComposition`, `artworkCompositionDetails`, `artworkFormat`,
  `artworkBackground`, `artworkBackgroundDetails`, `artworkFocus`, `artworkLightingDrama`,
  `artworkLightingDetails`, `artworkDetailLevel`, `artworkExtraDetails`
- `capabilities:conditional`: `directionCount`, `animationAction`, `animationType`,
  `movementType`, `seamless`, `tileableAxes`

## Ausgaben

Der erhaltene Generatorraum ist das kartesische Produkt aus:

- Stilen: `classic`, `dark`
- Sprachen: `de`, `en`
- Teilen: `main`, `negative`, `technical`, `combined`

Damit erzeugt ein Profil mit beiden Stilvarianten **16 Markdown-Dateien**. Dateipfad und SHA-256
jedes Tupels werden im V3-Profilmanifest geführt.

## Typ- und Teileinventar

Die neun stabilen Typ-IDs sind `character`, `movingObject`, `staticObject`, `texture`, `nature`,
`building`, `tileset`, `item` und `artwork`. Ergänzt wurden die fehlenden Pflicht-Untertypen
`item/sword`, `item/potion` und `artwork/concept`; vorhandene zusätzliche Untertypen bleiben
erhalten.

Das Teileinventar verwendet anatomische Links-/Rechts-Sicht. Es enthält 15 Pflichtteile
(`head`, `torso`, `pelvis`, je drei Teile für beide Arme und beide Beine) und drei Extra-Slots:
`cape`, genau eines aus `belt_accessory|sword`, sowie `hair`.
