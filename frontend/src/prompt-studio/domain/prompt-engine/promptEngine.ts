import {
  PROMPT_LANGUAGE_IDS,
  type BuildPromptPackagesOptions,
  type PromptLanguage,
  type PromptMainSection,
  type PromptModuleResult,
  type PromptPackage,
  type PromptStyleVariant,
} from "./promptEngine.types";
import { localize, normalizePromptText } from "./promptFormatting";
import { buildPromptModules } from "./promptModules";
import type { ResolvedProfile } from "../profiles";

const DEFAULT_LANGUAGES = Object.freeze(["en"] as const);

function resolveLanguages(
  requested: readonly PromptLanguage[] | undefined,
): readonly PromptLanguage[] {
  const source = requested ?? DEFAULT_LANGUAGES;
  const requestedSet = new Set<PromptLanguage>(source);
  const languages = PROMPT_LANGUAGE_IDS.filter((language) => requestedSet.has(language));
  return languages.length === 0 ? DEFAULT_LANGUAGES : Object.freeze(languages);
}

function resolveStyleVariants(profile: ResolvedProfile): readonly PromptStyleVariant[] {
  switch (profile.values.styleProfile) {
    case "classic":
      return Object.freeze(["classic"]);
    case "dark":
      return Object.freeze(["dark"]);
    case "both":
      return Object.freeze(["classic", "dark"]);
  }
}

function uniqueLines(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const rawValue of values) {
    const value = normalizePromptText(rawValue);
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    lines.push(value);
  }
  return Object.freeze(lines);
}

function renderMainSection(section: PromptMainSection): string {
  return `${section.heading.toUpperCase()}\n${section.lines.join("\n")}`;
}

function renderMain(modules: readonly PromptModuleResult[]): string {
  return modules
    .flatMap((moduleResult) =>
      moduleResult.main === undefined ? [] : [renderMainSection(moduleResult.main)],
    )
    .join("\n\n");
}

function renderList(lines: readonly string[]): string {
  return uniqueLines(lines)
    .map((line) => `- ${line}`)
    .join("\n");
}

function createPromptPackage(
  profile: ResolvedProfile,
  language: PromptLanguage,
  styleProfile: PromptStyleVariant,
): PromptPackage {
  const modules = buildPromptModules({ profile, language, styleProfile });
  const main = renderMain(modules);
  const negative = renderList(modules.flatMap((moduleResult) => moduleResult.negative));
  const technical = renderList(modules.flatMap((moduleResult) => moduleResult.technical));
  const mainHeading = localize(language, "MAIN PROMPT", "HAUPTPROMPT");
  const negativeHeading = localize(language, "NEGATIVE PROMPT", "NEGATIVPROMPT");
  const technicalHeading = localize(
    language,
    "TECHNICAL SPECIFICATION",
    "TECHNISCHE SPEZIFIKATION",
  );
  const styleProfileLabel =
    styleProfile === "classic"
      ? localize(language, "Classic grounded fantasy", "Klassische geerdete Fantasy")
      : localize(language, "Dark grounded fantasy", "Düstere geerdete Fantasy");

  return Object.freeze({
    id: `${profile.assetProfileId}:${styleProfile}:${language}`,
    language,
    languageLabel: localize(language, "English", "Deutsch"),
    styleProfile,
    styleProfileLabel,
    main,
    negative,
    technical,
    combined: `${mainHeading}\n${main}\n\n${negativeHeading}\n${negative}\n\n${technicalHeading}\n${technical}`,
  });
}

/**
 * Builds deterministic prompt packages from an already validated and resolved
 * V2 profile. The function has no UI or storage dependencies.
 */
export function buildPromptPackages(
  profile: ResolvedProfile,
  options: BuildPromptPackagesOptions = {},
): readonly PromptPackage[] {
  const packages = resolveStyleVariants(profile).flatMap((styleProfile) =>
    resolveLanguages(options.languages).map((language) =>
      createPromptPackage(profile, language, styleProfile),
    ),
  );
  return Object.freeze(packages);
}
