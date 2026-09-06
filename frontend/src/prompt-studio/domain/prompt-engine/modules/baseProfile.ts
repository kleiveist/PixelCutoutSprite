import { createPromptModuleResult, formatBoolean, labelValue, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildBaseProfileModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const { values } = profile;
  const pixelStyle = labelValue(values.pixelDensity, language);
  const outline = labelValue(values.outlineStyle, language);
  const palette = labelValue(values.paletteMode, language);

  return createPromptModuleResult("baseProfile", {
    heading: localize(language, "Pixel-art foundation", "Pixelart-Grundlage"),
    main: [
      localize(
        language,
        `Render as ${pixelStyle} pixel art at the native target resolution, with deliberate pixel clusters, crisp hard-edged pixels, and controlled dithering instead of random noise.`,
        `Als ${pixelStyle}-Pixelart in nativer Zielauflösung umsetzen, mit bewusst gesetzten Pixelclustern, klaren hartkantigen Pixeln und kontrolliertem Dithering statt zufälligem Rauschen.`,
      ),
      localize(
        language,
        `Use a ${outline} outline treatment. Palette treatment: ${palette}.`,
        `Eine ${outline} Konturbehandlung verwenden. Farbbehandlung: ${palette}.`,
      ),
      ...(values.nearestNeighbor
        ? [
            localize(
              language,
              "Use nearest-neighbor resampling for every scale change; do not smooth or artificially pixelate a larger painting afterward.",
              "Bei jeder Skalierung Nearest-Neighbor verwenden; keine Glättung und keine nachträgliche künstliche Pixelisierung eines größeren Gemäldes.",
            ),
          ]
        : []),
    ],
    negative: [
      localize(
        language,
        "anti-aliased or blurred pixel edges",
        "geglättete oder unscharfe Pixelkanten",
      ),
      localize(language, "random noisy dithering", "zufälliges verrauschtes Dithering"),
      localize(
        language,
        "artificial post-process pixelation",
        "künstliche nachträgliche Pixelisierung",
      ),
    ],
    technical: [
      `${localize(language, "Pixel density", "Pixeldichte")}: ${pixelStyle}`,
      `${localize(language, "Outline", "Kontur")}: ${outline}`,
      `${localize(language, "Palette", "Farbprofil")}: ${palette}`,
      `${localize(language, "Nearest-neighbor scaling", "Nearest-Neighbor-Skalierung")}: ${formatBoolean(values.nearestNeighbor, language)}`,
    ],
  });
};
