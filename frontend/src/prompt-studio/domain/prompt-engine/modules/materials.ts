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

export const buildMaterialsModule: PromptModuleBuilder = (context) => {
  const { language } = context;
  const data = context.profile.categoryData;
  const lines: string[] = [];

  switch (data.category) {
    case "character":
      addText(lines, language, "Headwear", "Kopfbedeckung", data.answers.hat);
      addValue(
        lines,
        language,
        "Headwear condition",
        "Zustand der Kopfbedeckung",
        data.answers.headwearCondition,
      );
      addText(lines, language, "Scarf", "Schal", data.answers.scarf);
      addText(lines, language, "Outerwear", "Oberbekleidung", data.answers.outerwear);
      addText(lines, language, "Lower wear", "Unterbekleidung", data.answers.lowerwear);
      addText(
        lines,
        language,
        "Clothing layers",
        "Kleidungsschichten",
        data.answers.clothingLayers,
      );
      addText(lines, language, "Gloves", "Handschuhe", data.answers.gloves);
      addText(lines, language, "Hand pose", "Handhaltung", data.answers.handPose);
      addText(lines, language, "Shoes", "Schuhe", data.answers.shoes);
      addText(lines, language, "Belt and bags", "Gürtel und Taschen", data.answers.beltBags);
      addText(lines, language, "Accessories", "Accessoires", data.answers.accessories);
      addText(lines, language, "Back item", "Rückengegenstand", data.answers.backItem);
      addText(lines, language, "Equipment", "Ausrüstung", data.answers.equipment);
      addText(lines, language, "Materials", "Materialien", data.answers.materials);
      addValue(
        lines,
        language,
        "Palette source",
        "Palettenquelle",
        data.answers.characterPaletteSource,
      );
      addText(lines, language, "Primary color", "Primärfarbe", data.answers.primaryColor);
      addText(lines, language, "Secondary color", "Sekundärfarbe", data.answers.secondaryColor);
      addText(lines, language, "Accent color", "Akzentfarbe", data.answers.accentColor);
      break;
    case "movingObject":
      addValue(lines, language, "Material", "Material", data.answers.material);
      addText(lines, language, "Material details", "Materialdetails", data.answers.materialDetails);
      addValue(lines, language, "Condition", "Zustand", data.answers.condition);
      break;
    case "staticObject":
      addValue(lines, language, "Primary material", "Primärmaterial", data.answers.primaryMaterial);
      addValue(
        lines,
        language,
        "Secondary material",
        "Sekundärmaterial",
        data.answers.secondaryMaterial,
      );
      addText(lines, language, "Material details", "Materialdetails", data.answers.materialDetails);
      addValue(lines, language, "Condition", "Zustand", data.answers.condition);
      break;
    case "texture":
      addValue(lines, language, "Material", "Material", data.answers.materialType);
      addValue(lines, language, "Orientation", "Ausrichtung", data.answers.orientation);
      addValue(lines, language, "Structure", "Struktur", data.answers.structure);
      addValue(lines, language, "Condition", "Zustand", data.answers.condition);
      addValue(lines, language, "Surface", "Oberfläche", data.answers.surface);
      addValue(lines, language, "Moisture", "Feuchtigkeit", data.answers.moisture);
      addValue(lines, language, "Icing", "Vereisung", data.answers.icing);
      break;
    case "nature":
      addValue(lines, language, "Moss coverage", "Moosbewuchs", data.answers.mossCoverage);
      addValue(lines, language, "Mushroom growth", "Pilzbewuchs", data.answers.mushroomGrowth);
      addValue(lines, language, "Snow cover", "Schneeauflage", data.answers.snowCover);
      addValue(lines, language, "Vine growth", "Rankenbewuchs", data.answers.vineGrowth);
      break;
    case "building":
      addValue(lines, language, "Primary material", "Primärmaterial", data.answers.primaryMaterial);
      addValue(
        lines,
        language,
        "Secondary material",
        "Sekundärmaterial",
        data.answers.secondaryMaterial,
      );
      addText(lines, language, "Material details", "Materialdetails", data.answers.materialDetails);
      addValue(lines, language, "Roof shape", "Dachform", data.answers.roofShape);
      addValue(lines, language, "Roof pitch", "Dachneigung", data.answers.roofPitch);
      addValue(lines, language, "Roof material", "Dachmaterial", data.answers.roofMaterial);
      addValue(lines, language, "Roof condition", "Dachzustand", data.answers.roofCondition);
      addText(lines, language, "Roof details", "Dachdetails", data.answers.roofDetails);
      addValue(lines, language, "Building condition", "Gebäudezustand", data.answers.condition);
      break;
    case "tileset":
      addText(lines, language, "Source material", "Ausgangsmaterial", data.answers.sourceMaterial);
      addText(lines, language, "Target material", "Zielmaterial", data.answers.targetMaterial);
      break;
    case "item":
      addValue(lines, language, "Primary material", "Primärmaterial", data.answers.primaryMaterial);
      addValue(
        lines,
        language,
        "Secondary material",
        "Sekundärmaterial",
        data.answers.secondaryMaterial,
      );
      addText(lines, language, "Material details", "Materialdetails", data.answers.materialDetails);
      addValue(lines, language, "Condition", "Zustand", data.answers.condition);
      break;
    case "artwork":
      break;
  }

  return createPromptModuleResult("materials", {
    heading: localize(language, "Materials and surface", "Materialien und Oberfläche"),
    main: lines,
  });
};
