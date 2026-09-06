import { getCategoryLabel, getEffectiveTypeLabel, getSubtypeLabel } from "../promptContext";
import { createPromptModuleResult, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildCategoryModule: PromptModuleBuilder = (context) => {
  const { language, profile } = context;
  const category = getCategoryLabel(profile, language);
  const subtype = getSubtypeLabel(profile, language);
  const effectiveType = getEffectiveTypeLabel(profile, language);

  return createPromptModuleResult("category", {
    heading: localize(language, "Production task", "Produktionsaufgabe"),
    main: [
      localize(
        language,
        `Create “${profile.name}” as ${category}; type: ${effectiveType}; subtype: ${subtype}.`,
        `„${profile.name}“ als ${category} erstellen; Typ: ${effectiveType}; Untertyp: ${subtype}.`,
      ),
    ],
    technical: [
      `${localize(language, "Category", "Kategorie")}: ${category}`,
      `${localize(language, "Subtype", "Untertyp")}: ${subtype}`,
    ],
  });
};
