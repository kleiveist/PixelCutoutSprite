import { getDirectionCount, getDirectionalFrameSize } from "../promptContext";
import {
  createPromptModuleResult,
  formatFootprint,
  labelValue,
  localize,
} from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

function getDirectionOrder(directionCount: 4 | 8, language: "en" | "de"): string {
  if (directionCount === 4) {
    return localize(language, "S, W, N, E", "Süd, West, Nord, Ost");
  }
  return localize(
    language,
    "S, SW, W, NW, N, NE, E, SE",
    "Süd, Südwest, West, Nordwest, Nord, Nordost, Ost, Südost",
  );
}

export const buildMotionModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const data = profile.categoryData;
  const lines: string[] = [];
  const technical: string[] = [];
  let footprint: Readonly<{ widthTiles: number; depthTiles: number }> | undefined;

  switch (data.category) {
    case "movingObject":
      if (data.answers.movementType !== undefined) {
        lines.push(
          `${localize(language, "Movement", "Bewegung")}: ${labelValue(data.answers.movementType, language)}.`,
        );
      }
      if (data.answers.mechanism !== undefined) {
        lines.push(
          `${localize(language, "Mechanism", "Mechanik")}: ${labelValue(data.answers.mechanism, language)}.`,
        );
      }
      if (data.answers.anchorMode !== undefined) {
        const anchor = labelValue(data.answers.anchorMode, language);
        lines.push(`${localize(language, "Ground anchor", "Bodenanker")}: ${anchor}.`);
        technical.push(`${localize(language, "Anchor", "Anker")}: ${anchor}`);
      }
      footprint = data.answers.footprint;
      break;
    case "staticObject":
      footprint = data.answers.footprint;
      break;
    case "nature":
      footprint = data.answers.footprint;
      break;
    case "building":
      footprint = data.answers.footprint;
      break;
    case "character":
    case "texture":
    case "tileset":
    case "item":
    case "artwork":
      break;
  }

  if (profile.capabilities.footprint && footprint !== undefined) {
    const formatted = formatFootprint(footprint, language);
    lines.push(`${localize(language, "Footprint", "Standfläche")}: ${formatted}.`);
    technical.push(`${localize(language, "Footprint", "Standfläche")}: ${formatted}`);
  }

  const directionCount = getDirectionCount(profile);
  if (directionCount !== null) {
    const order = getDirectionOrder(directionCount, language);
    const frameSize = getDirectionalFrameSize(profile);
    const rows = directionCount === 8 ? 2 : 1;
    lines.push(
      localize(
        language,
        `Produce a ${String(directionCount)}-direction set in this fixed order: ${order}. Keep the camera and ground anchor unchanged and rotate only the subject.`,
        `Ein ${String(directionCount)}-Richtungsset in dieser festen Reihenfolge erzeugen: ${order}. Kamera und Bodenanker unverändert lassen und nur das Motiv drehen.`,
      ),
    );
    technical.push(
      `${localize(language, "Directions", "Richtungen")}: ${String(directionCount)} (${order})`,
      `${localize(language, "Direction layout", "Richtungslayout")}: 4 × ${String(rows)} ${localize(language, "views", "Ansichten")}`,
      ...(frameSize === null
        ? []
        : [
            `${localize(language, "Frame", "Frame")}: ${String(frameSize)} × ${String(frameSize)} px`,
            `${localize(language, "Direction canvas", "Richtungs-Canvas")}: ${String(frameSize * 4)} × ${String(frameSize * rows)} px`,
          ]),
      localize(
        language,
        "Direction-set transform: subject rotation only",
        "Richtungsset-Transformation: nur Motivrotation",
      ),
    );
    lines.push(
      localize(
        language,
        "Redraw anatomy, equipment, materials, and asymmetric details logically for each view; do not create the set from mirrored duplicates.",
        "Anatomie, Ausrüstung, Materialien und asymmetrische Details für jede Ansicht logisch neu zeichnen; das Set nicht aus gespiegelten Duplikaten erzeugen.",
      ),
    );
  }

  return createPromptModuleResult("motion", {
    heading: localize(language, "Motion and orientation", "Bewegung und Ausrichtung"),
    main: lines,
    negative:
      directionCount === null
        ? []
        : [
            localize(
              language,
              "changing camera angle or framing between directions",
              "wechselnder Kamerawinkel oder Bildausschnitt zwischen Richtungen",
            ),
            localize(
              language,
              "missing, duplicated, mirrored, or reordered directional views",
              "fehlende, doppelte, gespiegelte oder vertauschte Richtungsansichten",
            ),
          ],
    technical,
  });
};
