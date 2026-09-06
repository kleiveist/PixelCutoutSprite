import { createPromptModuleResult, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildNegativeRulesModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const data = profile.categoryData;
  const negative: string[] = [
    localize(
      language,
      "photorealism, smooth vector rendering, or painterly brushwork",
      "Fotorealismus, glatte Vektorgrafik oder malerische Pinselstriche",
    ),
    localize(
      language,
      "watermark, signature, caption, logo, or interface text",
      "Wasserzeichen, Signatur, Bildunterschrift, Logo oder Oberflächentext",
    ),
    localize(
      language,
      "direct imitation of a named game, brand, franchise, character, artwork, or artist",
      "direkte Imitation eines namentlich genannten Spiels, einer Marke, Reihe, Figur, eines Werks oder Kunstschaffenden",
    ),
  ];

  if (profile.values.outlineStyle === "softSelective") {
    negative.push(
      localize(
        language,
        "uniform thick black outlines around every internal detail",
        "gleichmäßig dicke schwarze Konturen um jedes Innendetail",
      ),
    );
  }

  switch (data.category) {
    case "character":
      negative.push(
        localize(
          language,
          "unreadable silhouette, fused limbs, or inconsistent costume details",
          "unlesbare Silhouette, verschmolzene Gliedmaßen oder inkonsistente Kostümdetails",
        ),
      );
      break;
    case "movingObject":
      negative.push(
        localize(
          language,
          "mechanism detached from the body or impossible ground contact",
          "vom Körper gelöste Mechanik oder unmöglicher Bodenkontakt",
        ),
      );
      break;
    case "staticObject":
      negative.push(
        localize(
          language,
          "floating object, ambiguous base, or unreadable interaction state",
          "schwebendes Objekt, unklare Standfläche oder unlesbarer Interaktionszustand",
        ),
      );
      break;
    case "texture":
      negative.push(
        localize(
          language,
          "recognizable standalone props embedded in the material",
          "erkennbare freistehende Objekte im Material",
        ),
        localize(
          language,
          "uneven baked lighting that prevents reuse",
          "ungleichmäßiges eingebackenes Licht, das Wiederverwendung verhindert",
        ),
      );
      if (data.answers.seamless === true) {
        negative.push(
          localize(
            language,
            "visible tiling seam or unmatched opposite edges",
            "sichtbare Kachelnaht oder unpassende gegenüberliegende Kanten",
          ),
        );
      }
      break;
    case "nature":
      negative.push(
        localize(
          language,
          "cut-off crown, floating roots, or mechanically repeated foliage",
          "abgeschnittene Krone, schwebende Wurzeln oder mechanisch wiederholtes Laub",
        ),
      );
      break;
    case "building":
      negative.push(
        localize(
          language,
          "inconsistent floor scale, impossible roof joins, or unreadable entrance",
          "inkonsistenter Stockwerkmaßstab, unmögliche Dachanschlüsse oder unlesbarer Eingang",
        ),
      );
      break;
    case "tileset":
      negative.push(
        localize(
          language,
          "inconsistent tile scale, clipped transition pixels, or mismatched atlas cells",
          "inkonsistenter Tile-Maßstab, abgeschnittene Übergangspixel oder unpassende Atlaszellen",
        ),
      );
      break;
    case "item":
      negative.push(
        localize(
          language,
          "muddy silhouette, illegible function, or excessive micro-detail",
          "verwaschene Silhouette, unlesbare Funktion oder übermäßige Mikrodetails",
        ),
      );
      break;
    case "artwork":
      negative.push(
        localize(
          language,
          "game interface chrome, inventory slot, or forced production-grid framing",
          "Spieloberflächen-Rahmen, Inventarslot oder erzwungene Produktionsraster-Komposition",
        ),
      );
      break;
  }

  return createPromptModuleResult("negativeRules", { negative });
};
