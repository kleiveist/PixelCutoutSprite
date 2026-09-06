import { createTilesetTechnicalSpecification } from "../../tilesets";
import { usesTileGrid, usesWorldCamera } from "../promptContext";
import { createPromptModuleResult, labelValue, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildTechnicalSpecModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const { values } = profile;
  const data = profile.categoryData;
  const technical: string[] = [];

  if (profile.capabilities.freeComposition) {
    technical.push(
      localize(
        language,
        "Free artwork composition on an unconstrained canvas with presentation-led framing",
        "Freie Artwork-Komposition auf einem ungebundenen Canvas mit präsentationsorientiertem Bildaufbau",
      ),
    );
  } else {
    if (usesTileGrid(profile)) {
      technical.push(
        `${localize(language, "Native pixel grid", "Natives Pixelraster")}: ${String(values.tileSize)} × ${String(values.tileSize)} px ${localize(language, "tile unit", "Tile-Einheit")}`,
      );
    }
    if (usesWorldCamera(profile)) {
      technical.push(
        `${localize(language, "Perspective", "Perspektive")}: ${labelValue(values.perspectiveType, language)}`,
        `${localize(language, "Projection", "Projektion")}: ${labelValue(values.projectionType, language)}`,
        `${localize(language, "Camera", "Kamera")}: ${labelValue(values.cameraDirection, language)}, ${String(values.cameraAngle)}° ${localize(language, "down from horizontal", "abwärts von der Horizontalen")}`,
      );
    } else if (data.category === "texture") {
      technical.push(
        localize(
          language,
          "Surface mapping: flat, edge-aligned material sample",
          "Oberflächenabbildung: flaches, kantenausgerichtetes Materialmuster",
        ),
      );
    }
  }

  if (profile.capabilities.scaledCharacter && values.characterHeight !== undefined) {
    technical.push(
      `${localize(language, "Character height", "Figurenhöhe")}: ${String(values.characterHeight)} px`,
    );
  }

  switch (data.category) {
    case "movingObject":
      if (data.answers.heightPixels !== undefined)
        technical.push(
          `${localize(language, "Object height", "Objekthöhe")}: ${String(data.answers.heightPixels)} px`,
        );
      break;
    case "building":
      if (data.answers.heightPixels !== undefined)
        technical.push(
          `${localize(language, "Building height", "Gebäudehöhe")}: ${String(data.answers.heightPixels)} px`,
        );
      if (data.answers.floors !== undefined)
        technical.push(
          `${localize(language, "Floors", "Stockwerke")}: ${String(data.answers.floors)}`,
        );
      break;
    case "tileset":
      if (data.answers.atlasTileCount !== undefined) {
        const specification = createTilesetTechnicalSpecification({
          tileSizePixels: values.tileSize,
          tileCount: data.answers.atlasTileCount,
          ...(data.answers.atlasLayout === undefined ? {} : { layout: data.answers.atlasLayout }),
          ...(data.answers.atlasColumns === undefined
            ? {}
            : { fixedColumns: data.answers.atlasColumns }),
          ...(data.answers.atlasGutterPixels === undefined
            ? {}
            : { gutterPixels: data.answers.atlasGutterPixels }),
          ...(data.answers.atlasMarginPixels === undefined
            ? {}
            : { marginPixels: data.answers.atlasMarginPixels }),
        });
        const { metrics } = specification;
        technical.push(
          `${localize(language, "Atlas grid", "Atlasraster")}: ${String(metrics.columns)} × ${String(metrics.rows)} ${localize(language, "cells", "Zellen")}`,
          `${localize(language, "Atlas canvas", "Atlas-Canvas")}: ${String(metrics.atlasWidthPixels)} × ${String(metrics.atlasHeightPixels)} px`,
          `${localize(language, "Atlas slots", "Atlasplätze")}: ${String(metrics.tileCount)} ${localize(language, "occupied", "belegt")}, ${String(metrics.unusedCells)} ${localize(language, "empty", "leer")}`,
          `${localize(language, "Atlas spacing", "Atlasabstand")}: ${String(metrics.gutterPixels)} px ${localize(language, "gutter", "Zwischenraum")}, ${String(metrics.marginPixels)} px ${localize(language, "margin", "Rand")}`,
        );
      }
      break;
    case "item":
      if (data.answers.iconSize !== undefined && data.answers.presentation !== "worldAsset") {
        technical.push(
          `${localize(language, "Icon canvas", "Icon-Canvas")}: ${String(data.answers.iconSize)} × ${String(data.answers.iconSize)} px`,
        );
      }
      break;
    case "character":
    case "staticObject":
    case "texture":
    case "nature":
    case "artwork":
      break;
  }

  technical.push(
    localize(
      language,
      "Export: lossless pixel-preserving image data",
      "Export: verlustfreie pixelerhaltende Bilddaten",
    ),
    localize(
      language,
      "Consistency: preserve scale, proportions, palette, and material language across the asset family",
      "Konsistenz: Maßstab, Proportionen, Palette und Materialsprache in der Asset-Familie beibehalten",
    ),
  );

  return createPromptModuleResult("technicalSpec", { technical });
};
