import { createPromptModuleResult, detailLine, labelValue, localize } from "../promptFormatting";
import type { PromptLanguage, PromptModuleBuilder } from "../promptEngine.types";

function addText(
  lines: string[],
  language: PromptLanguage,
  englishLabel: string,
  germanLabel: string,
  value: string | undefined,
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

export const buildSettingModule: PromptModuleBuilder = (context) => {
  const { language } = context;
  const data = context.profile.categoryData;
  const lines: string[] = [];

  switch (data.category) {
    case "nature":
      addValue(lines, language, "Climate", "Klima", data.answers.climate);
      addValue(lines, language, "Season", "Jahreszeit", data.answers.season);
      addValue(lines, language, "Grounding", "Bodeneinbindung", data.answers.grounding);
      break;
    case "building":
      addValue(lines, language, "Environment", "Umgebung", data.answers.environment);
      addValue(lines, language, "Occupancy", "Nutzung", data.answers.occupancy);
      break;
    case "artwork":
      addText(lines, language, "Scene", "Szene", data.answers.sceneDescription);
      addText(
        lines,
        language,
        "Background details",
        "Hintergrunddetails",
        data.answers.backgroundDetails,
      );
      break;
    case "character":
    case "movingObject":
    case "staticObject":
    case "texture":
    case "tileset":
    case "item":
      break;
  }

  return createPromptModuleResult("setting", {
    heading: localize(language, "Setting", "Umgebung"),
    main: lines,
  });
};
