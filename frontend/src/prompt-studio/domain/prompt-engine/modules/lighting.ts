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

export const buildLightingModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const data = profile.categoryData;
  const policy = labelValue(profile.values.lightingDefaults.policy, language);
  const lines: string[] = [
    localize(
      language,
      `Use ${policy}; keep form, materials, and important midtones readable.`,
      `${policy} verwenden; Form, Materialien und wichtige Mitteltöne lesbar halten.`,
    ),
  ];

  addText(
    lines,
    language,
    "Lighting notes",
    "Lichthinweise",
    profile.values.lightingDefaults.notes,
  );

  switch (data.category) {
    case "movingObject":
      addValue(
        lines,
        language,
        "Local light behavior",
        "Lokales Lichtverhalten",
        data.answers.lightingBehavior,
      );
      break;
    case "texture":
      addValue(lines, language, "Surface lighting", "Oberflächenlicht", data.answers.lighting);
      break;
    case "building":
      addValue(lines, language, "Building lighting", "Gebäudelicht", data.answers.lighting);
      addValue(lines, language, "Window lighting", "Fensterlicht", data.answers.windowLighting);
      addText(
        lines,
        language,
        "Visible light sources",
        "Sichtbare Lichtquellen",
        data.answers.lightSourceDetails,
      );
      break;
    case "item":
      addValue(lines, language, "Glow", "Leuchten", data.answers.glowMode);
      break;
    case "artwork":
      addValue(lines, language, "Lighting drama", "Lichtdramaturgie", data.answers.lightingDrama);
      addText(lines, language, "Lighting details", "Lichtdetails", data.answers.lightingDetails);
      break;
    case "character":
    case "staticObject":
    case "nature":
    case "tileset":
      break;
  }

  if (profile.capabilities.directional) {
    lines.push(
      localize(
        language,
        "Across every direction, keep the world light fixed on exactly the same side; only the subject orientation changes.",
        "In allen Richtungen bleibt das Weltlicht exakt auf derselben Seite; nur die Ausrichtung des Motivs ändert sich.",
      ),
    );
  }

  return createPromptModuleResult("lighting", {
    heading: localize(language, "Lighting", "Licht"),
    main: lines,
    negative: profile.capabilities.directional
      ? [
          localize(
            language,
            "rotating or mirrored world light between directions",
            "rotierendes oder gespiegeltes Weltlicht zwischen Richtungen",
          ),
        ]
      : [],
    technical: [
      `${localize(language, "Lighting policy", "Lichtregel")}: ${policy}`,
      ...(profile.capabilities.directional
        ? [
            localize(
              language,
              "World-light lock: fixed across the complete direction set",
              "Weltlicht-Sperre: im gesamten Richtungsset konstant",
            ),
          ]
        : []),
    ],
  });
};
