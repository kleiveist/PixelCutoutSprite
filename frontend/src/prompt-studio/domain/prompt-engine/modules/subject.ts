import { getEffectiveTypeLabel } from "../promptContext";
import {
  createPromptModuleResult,
  detailLine,
  formatBoolean,
  labelValue,
  localize,
} from "../promptFormatting";
import type { PromptLanguage, PromptModuleBuilder } from "../promptEngine.types";

function addText(
  lines: string[],
  language: PromptLanguage,
  englishLabel: string,
  germanLabel: string,
  value: string | number | undefined,
): void {
  const line = detailLine(language, englishLabel, germanLabel, value);
  if (line !== null) lines.push(line);
}

function addValue(
  lines: string[],
  language: PromptLanguage,
  englishLabel: string,
  germanLabel: string,
  value: string | undefined,
): void {
  addText(
    lines,
    language,
    englishLabel,
    germanLabel,
    value === undefined ? undefined : labelValue(value, language),
  );
}

export const buildSubjectModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const data = profile.categoryData;
  const lines: string[] = [
    localize(
      language,
      `Primary subject: ${getEffectiveTypeLabel(profile, language)}.`,
      `Hauptmotiv: ${getEffectiveTypeLabel(profile, language)}.`,
    ),
  ];

  addText(lines, language, "Description", "Beschreibung", data.answers.subjectDescription);

  switch (data.category) {
    case "character":
      addText(lines, language, "Role", "Rolle", data.answers.role);
      addValue(
        lines,
        language,
        "Gender presentation",
        "Geschlechtspräsentation",
        data.answers.genderPresentation,
      );
      addValue(lines, language, "Age", "Alter", data.answers.age);
      addValue(lines, language, "Relative height", "Relative Größe", data.answers.relativeHeight);
      addValue(lines, language, "Body build", "Körperbau", data.answers.bodyBuild);
      addValue(lines, language, "Posture", "Haltung", data.answers.posture);
      addText(lines, language, "Face shape", "Gesichtsform", data.answers.faceShape);
      addText(lines, language, "Skin tone", "Hautton", data.answers.skinTone);
      addValue(lines, language, "Eye visibility", "Augensichtbarkeit", data.answers.eyeVisibility);
      addText(lines, language, "Hair", "Haare", data.answers.hair);
      addText(lines, language, "Hairstyle", "Frisur", data.answers.hairstyle);
      addText(lines, language, "Beard", "Bart", data.answers.beard);
      addValue(lines, language, "Condition", "Zustand", data.answers.condition);
      addValue(lines, language, "Expression", "Ausdruck", data.answers.expression);
      addText(lines, language, "Silhouette", "Silhouette", data.answers.silhouette);
      addText(lines, language, "Pose", "Pose", data.answers.pose);
      if (data.answers.professionReadable !== undefined) {
        addText(
          lines,
          language,
          "Profession readable at a glance",
          "Beruf auf einen Blick lesbar",
          formatBoolean(data.answers.professionReadable, language),
        );
      }
      addText(lines, language, "Social role", "Soziale Rolle", data.answers.socialRole);
      addValue(lines, language, "Wealth", "Wohlstand", data.answers.wealth);
      addText(
        lines,
        language,
        "Cultural function",
        "Kulturelle Funktion",
        data.answers.culturalFunction,
      );
      addText(
        lines,
        language,
        "Typical activity",
        "Typische Tätigkeit",
        data.answers.typicalActivity,
      );
      addText(
        lines,
        language,
        "Conversation gesture",
        "Gesprächsgeste",
        data.answers.conversationGesture,
      );
      addText(lines, language, "Everyday tool", "Alltagswerkzeug", data.answers.everydayTool);
      addText(
        lines,
        language,
        "Front/back distinctions",
        "Vorder-/Rückseitenmerkmale",
        data.answers.frontBackDetails,
      );
      break;
    case "movingObject":
      addValue(lines, language, "Object class", "Objektklasse", data.answers.objectClass);
      addText(lines, language, "Purpose", "Funktion", data.answers.purpose);
      addText(lines, language, "Basic shape", "Grundform", data.answers.basicShape);
      addText(
        lines,
        language,
        "Height",
        "Höhe",
        data.answers.heightPixels === undefined
          ? undefined
          : `${String(data.answers.heightPixels)} px`,
      );
      break;
    case "staticObject":
      addValue(lines, language, "Object class", "Objektklasse", data.answers.objectClass);
      addValue(lines, language, "Purpose", "Funktion", data.answers.purpose);
      addValue(lines, language, "Basic shape", "Grundform", data.answers.basicShape);
      addValue(lines, language, "Proportion", "Proportion", data.answers.proportion);
      addValue(lines, language, "Symmetry", "Symmetrie", data.answers.symmetry);
      addText(lines, language, "Detail elements", "Detailelemente", data.answers.detailElements);
      addText(lines, language, "Contents", "Inhalt", data.answers.contents);
      addValue(lines, language, "Interaction", "Interaktion", data.answers.interaction);
      break;
    case "texture":
      addValue(lines, language, "Usage", "Verwendung", data.answers.usage);
      break;
    case "nature":
      addValue(lines, language, "Plant type", "Pflanzentyp", data.answers.plantType);
      addText(lines, language, "Species", "Art", data.answers.species);
      addValue(lines, language, "Age", "Alter", data.answers.age);
      addValue(lines, language, "Silhouette", "Silhouette", data.answers.silhouette);
      addValue(lines, language, "Trunk thickness", "Stammdicke", data.answers.trunkThickness);
      addValue(lines, language, "Trunk shape", "Stammform", data.answers.trunkShape);
      addText(lines, language, "Trunk details", "Stammdetails", data.answers.trunkDetails);
      addValue(lines, language, "Crown shape", "Kronenform", data.answers.crownShape);
      addValue(lines, language, "Crown density", "Kronendichte", data.answers.crownDensity);
      addText(lines, language, "Foliage details", "Laubdetails", data.answers.foliageDetails);
      addValue(
        lines,
        language,
        "Root visibility",
        "Wurzelsichtbarkeit",
        data.answers.rootVisibility,
      );
      addText(lines, language, "Root details", "Wurzeldetails", data.answers.rootDetails);
      break;
    case "building":
      addValue(lines, language, "Building type", "Gebäudetyp", data.answers.buildingType);
      addText(lines, language, "Purpose", "Funktion", data.answers.purpose);
      addValue(lines, language, "Plan shape", "Grundriss", data.answers.planShape);
      addValue(lines, language, "Size", "Größe", data.answers.size);
      addText(
        lines,
        language,
        "Height",
        "Höhe",
        data.answers.heightPixels === undefined
          ? undefined
          : `${String(data.answers.heightPixels)} px`,
      );
      addText(lines, language, "Floors", "Stockwerke", data.answers.floors);
      addValue(lines, language, "Facade style", "Fassadenstil", data.answers.facadeStyle);
      addText(lines, language, "Facade details", "Fassadendetails", data.answers.facadeDetails);
      addText(lines, language, "Doors", "Türen", data.answers.doorCount);
      addValue(lines, language, "Door type", "Türtyp", data.answers.doorType);
      addText(lines, language, "Door position", "Türposition", data.answers.doorPosition);
      addValue(lines, language, "Door state", "Türzustand", data.answers.doorState);
      addText(lines, language, "Windows", "Fenster", data.answers.windowCount);
      addValue(lines, language, "Window shape", "Fensterform", data.answers.windowShape);
      addText(lines, language, "Window details", "Fensterdetails", data.answers.windowDetails);
      break;
    case "tileset":
      addValue(lines, language, "Tileset type", "Tileset-Typ", data.answers.tilesetType);
      addValue(lines, language, "Tile usage", "Tile-Verwendung", data.answers.tileUsage);
      break;
    case "item":
      addValue(lines, language, "Item class", "Itemklasse", data.answers.itemClass);
      addValue(lines, language, "Purpose", "Funktion", data.answers.purpose);
      addValue(lines, language, "Presentation", "Darstellung", data.answers.presentation);
      addValue(lines, language, "Wear position", "Trageposition", data.answers.wearPosition);
      addValue(lines, language, "Relative size", "Relative Größe", data.answers.size);
      addText(
        lines,
        language,
        "Function details",
        "Funktionsdetails",
        data.answers.functionDetails,
      );
      addValue(lines, language, "Significance", "Bedeutung", data.answers.significance);
      addText(lines, language, "Meaning details", "Bedeutungsdetails", data.answers.meaningDetails);
      addText(lines, language, "Silhouette", "Silhouette", data.answers.silhouette);
      addValue(lines, language, "Readability", "Lesbarkeit", data.answers.readability);
      break;
    case "artwork":
      addValue(lines, language, "Purpose", "Zweck", data.answers.purpose);
      addValue(lines, language, "Motif", "Motiv", data.answers.motif);
      break;
  }

  addText(lines, language, "Additional details", "Zusätzliche Details", data.answers.extraDetails);

  return createPromptModuleResult("subject", {
    heading: localize(language, "Subject", "Motiv"),
    main: lines,
  });
};
