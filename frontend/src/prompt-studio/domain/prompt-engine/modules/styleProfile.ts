import { createPromptModuleResult, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildStyleProfileModule: PromptModuleBuilder = (context) => {
  const { language, styleProfile } = context;
  const classic = styleProfile === "classic";
  const styleLabel = classic
    ? localize(language, "classic grounded fantasy", "klassische geerdete Fantasy")
    : localize(language, "dark grounded fantasy", "düstere geerdete Fantasy");

  return createPromptModuleResult("styleProfile", {
    heading: localize(language, "Style direction", "Stilrichtung"),
    main: classic
      ? [
          localize(
            language,
            "Use a classic grounded-fantasy direction with natural, lightly muted colors, readable midtones, distinct materials, and restrained warm accents.",
            "Eine klassische geerdete Fantasy-Richtung mit natürlichen, leicht gedämpften Farben, lesbaren Mitteltönen, klar unterscheidbaren Materialien und zurückhaltenden warmen Akzenten verwenden.",
          ),
        ]
      : [
          localize(
            language,
            "Use a dark grounded-fantasy direction with rough aged materials, slightly desaturated color groups, controlled menace, and midtones that remain readable.",
            "Eine düstere geerdete Fantasy-Richtung mit rauen gealterten Materialien, leicht entsättigten Farbgruppen, kontrollierter Bedrohlichkeit und weiterhin lesbaren Mitteltönen verwenden.",
          ),
        ],
    negative: classic
      ? [localize(language, "overly bright candy colors", "übermäßig grelle Bonbonfarben")]
      : [localize(language, "crushed featureless blacks", "zugelaufene detailfreie Schwarztöne")],
    technical: [`${localize(language, "Style variant", "Stilvariante")}: ${styleLabel}`],
  });
};
