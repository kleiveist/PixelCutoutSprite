import { getBackgroundLabel } from "../promptContext";
import {
  createPromptModuleResult,
  formatBoolean,
  formatList,
  labelValue,
  localize,
} from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildCompositionModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const data = profile.categoryData;
  const lines: string[] = [];
  const technical: string[] = [];
  const negative: string[] = [];
  const background = getBackgroundLabel(context);
  const artworkBackground = data.category === "artwork" ? data.answers.background : undefined;
  const supportsBackground = profile.capabilities.transparent;
  const transparent =
    supportsBackground &&
    (artworkBackground === "transparent" ||
      (artworkBackground === undefined && profile.values.backgroundMode === "transparent"));

  if (transparent) {
    lines.push(
      localize(
        language,
        "Isolate the asset on genuine transparency with clean hard alpha edges and no painted backdrop.",
        "Das Asset auf echter Transparenz mit sauberen harten Alphakanten und ohne gemalten Hintergrund freistellen.",
      ),
    );
    technical.push(
      `${localize(language, "Background", "Hintergrund")}: ${background}`,
      `${localize(language, "Transparent safety padding", "Transparenter Sicherheitsrand")}: ${String(profile.values.alphaPadding)} px`,
      localize(
        language,
        "Alpha edges: hard, without semi-transparent fringe pixels",
        "Alphakanten: hart, ohne halbtransparente Randpixel",
      ),
    );
    negative.push(
      localize(
        language,
        "checkerboard baked into the image",
        "in das Bild eingebackenes Schachbrettmuster",
      ),
      localize(
        language,
        "sky, horizon, scenery, or decorative pedestal behind the isolated asset",
        "Himmel, Horizont, Landschaft oder dekorativer Sockel hinter dem freigestellten Asset",
      ),
      localize(language, "semi-transparent fringe pixels", "halbtransparente Randpixel"),
    );
  } else if (supportsBackground) {
    lines.push(`${localize(language, "Background", "Hintergrund")}: ${background}.`);
    technical.push(`${localize(language, "Background", "Hintergrund")}: ${background}`);
  }

  switch (data.category) {
    case "character":
      if (data.answers.variantCount !== undefined) {
        lines.push(
          `${localize(language, "Distinct variants", "Unterscheidbare Varianten")}: ${String(data.answers.variantCount)}.`,
        );
        technical.push(
          `${localize(language, "Variant count", "Variantenanzahl")}: ${String(data.answers.variantCount)}`,
        );
      }
      break;
    case "movingObject":
      if (data.answers.shadowMode !== undefined) {
        lines.push(
          `${localize(language, "Shadow", "Schatten")}: ${labelValue(data.answers.shadowMode, language)}.`,
        );
      }
      break;
    case "staticObject":
      if (data.answers.shadowMode !== undefined) {
        lines.push(
          `${localize(language, "Shadow", "Schatten")}: ${labelValue(data.answers.shadowMode, language)}.`,
        );
      }
      if (data.answers.variantCount !== undefined) {
        lines.push(
          `${localize(language, "Distinct variants", "Unterscheidbare Varianten")}: ${String(data.answers.variantCount)}.`,
        );
      }
      break;
    case "texture":
      if (data.answers.seamless !== undefined) {
        lines.push(
          localize(
            language,
            data.answers.seamless
              ? "Make the texture seamlessly tileable, with matching opposite edges and no visible repetition seam."
              : "Keep the texture as a deliberate non-seamless material sample.",
            data.answers.seamless
              ? "Die Textur nahtlos kachelbar anlegen, mit passenden gegenüberliegenden Kanten und ohne sichtbare Wiederholungsnaht."
              : "Die Textur als bewusst nicht nahtloses Materialmuster anlegen.",
          ),
        );
        technical.push(
          `${localize(language, "Seamless", "Nahtlos")}: ${formatBoolean(data.answers.seamless, language)}`,
        );
      }
      negative.push(
        localize(
          language,
          "perspective-distorted material plane",
          "perspektivisch verzerrte Materialfläche",
        ),
      );
      break;
    case "nature":
      if (data.answers.variantCount !== undefined) {
        lines.push(
          `${localize(language, "Natural variants", "Natürliche Varianten")}: ${String(data.answers.variantCount)}.`,
        );
      }
      break;
    case "building":
      if (data.answers.mappingMode !== undefined) {
        lines.push(
          `${localize(language, "Map integration", "Kartenintegration")}: ${labelValue(data.answers.mappingMode, language)}.`,
        );
      }
      if (data.answers.collisionMode !== undefined) {
        lines.push(
          `${localize(language, "Collision/readability", "Kollision/Lesbarkeit")}: ${labelValue(data.answers.collisionMode, language)}.`,
        );
      }
      if (data.answers.modular !== undefined) {
        lines.push(
          `${localize(language, "Modular construction", "Modulare Konstruktion")}: ${formatBoolean(data.answers.modular, language)}.`,
        );
      }
      break;
    case "tileset":
      if (data.answers.edgeSet !== undefined)
        lines.push(
          `${localize(language, "Edges", "Kanten")}: ${labelValue(data.answers.edgeSet, language)}.`,
        );
      if (data.answers.edgeDetails !== undefined)
        lines.push(
          `${localize(language, "Edge details", "Kantendetails")}: ${data.answers.edgeDetails}.`,
        );
      if (data.answers.cornerSet !== undefined)
        lines.push(
          `${localize(language, "Corners", "Ecken")}: ${labelValue(data.answers.cornerSet, language)}.`,
        );
      if (data.answers.transitionMode !== undefined)
        lines.push(
          `${localize(language, "Transitions", "Übergänge")}: ${labelValue(data.answers.transitionMode, language)}.`,
        );
      if (data.answers.seamMode !== undefined)
        lines.push(
          `${localize(language, "Seams", "Nähte")}: ${labelValue(data.answers.seamMode, language)}.`,
        );
      if (data.answers.seamDetails !== undefined)
        lines.push(
          `${localize(language, "Seam details", "Nahtdetails")}: ${data.answers.seamDetails}.`,
        );
      if (data.answers.tileableAxes !== undefined)
        lines.push(
          `${localize(language, "Tileable axes", "Kachelbare Achsen")}: ${labelValue(data.answers.tileableAxes, language)}.`,
        );
      if (data.answers.repeatMode !== undefined)
        lines.push(
          `${localize(language, "Repeat mode", "Wiederholungsmodus")}: ${labelValue(data.answers.repeatMode, language)}.`,
        );
      if (data.answers.variantCount !== undefined)
        lines.push(
          `${localize(language, "Tile variants", "Tile-Varianten")}: ${String(data.answers.variantCount)}.`,
        );
      if (data.answers.variantKinds !== undefined)
        lines.push(
          `${localize(language, "Variant kinds", "Variantenarten")}: ${formatList(data.answers.variantKinds, language)}.`,
        );
      negative.push(
        localize(
          language,
          "misaligned tile edges, broken corners, or visible seams",
          "versetzte Tile-Kanten, gebrochene Ecken oder sichtbare Nähte",
        ),
      );
      break;
    case "item":
      if (data.answers.shadowMode !== undefined)
        lines.push(
          `${localize(language, "Shadow", "Schatten")}: ${labelValue(data.answers.shadowMode, language)}.`,
        );
      if (data.answers.variantCount !== undefined)
        lines.push(
          `${localize(language, "Item variants", "Item-Varianten")}: ${String(data.answers.variantCount)}.`,
        );
      break;
    case "artwork":
      if (data.answers.composition !== undefined)
        lines.push(
          `${localize(language, "Composition", "Komposition")}: ${labelValue(data.answers.composition, language)}.`,
        );
      if (data.answers.compositionDetails !== undefined)
        lines.push(
          `${localize(language, "Composition details", "Kompositionsdetails")}: ${data.answers.compositionDetails}.`,
        );
      if (data.answers.format !== undefined) {
        lines.push(
          `${localize(language, "Format", "Format")}: ${labelValue(data.answers.format, language)}.`,
        );
        technical.push(
          `${localize(language, "Artwork format", "Artwork-Format")}: ${labelValue(data.answers.format, language)}`,
        );
      }
      if (data.answers.focus !== undefined)
        lines.push(
          `${localize(language, "Visual focus", "Visueller Fokus")}: ${labelValue(data.answers.focus, language)}.`,
        );
      if (data.answers.detailLevel !== undefined)
        lines.push(
          `${localize(language, "Detail level", "Detailgrad")}: ${labelValue(data.answers.detailLevel, language)}.`,
        );
      negative.push(
        localize(
          language,
          "cropped primary motif or unclear visual hierarchy",
          "abgeschnittenes Hauptmotiv oder unklare visuelle Hierarchie",
        ),
      );
      break;
  }

  return createPromptModuleResult("composition", {
    heading: localize(language, "Composition and output", "Komposition und Ausgabe"),
    main: lines,
    negative,
    technical,
  });
};
