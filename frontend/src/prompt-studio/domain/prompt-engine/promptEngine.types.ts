import type { ResolvedProfile } from "../profiles";

export const PROMPT_LANGUAGE_IDS = Object.freeze(["en", "de"] as const);
export const PROMPT_STYLE_VARIANT_IDS = Object.freeze(["classic", "dark"] as const);

export const PROMPT_MODULE_IDS = Object.freeze([
  "baseProfile",
  "styleProfile",
  "category",
  "subject",
  "materials",
  "setting",
  "lighting",
  "motion",
  "animation",
  "composition",
  "negativeRules",
  "technicalSpec",
] as const);

export type PromptLanguage = (typeof PROMPT_LANGUAGE_IDS)[number];
export type PromptStyleVariant = (typeof PROMPT_STYLE_VARIANT_IDS)[number];
export type PromptModuleId = (typeof PROMPT_MODULE_IDS)[number];

export interface PromptBuildContext {
  readonly profile: ResolvedProfile;
  readonly language: PromptLanguage;
  readonly styleProfile: PromptStyleVariant;
}

export interface PromptMainSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface PromptModuleResult {
  readonly id: PromptModuleId;
  readonly main?: PromptMainSection;
  readonly negative: readonly string[];
  readonly technical: readonly string[];
}

export interface PromptPackage {
  readonly id: string;
  readonly language: PromptLanguage;
  readonly languageLabel: string;
  readonly styleProfile: PromptStyleVariant;
  readonly styleProfileLabel: string;
  readonly main: string;
  readonly negative: string;
  readonly technical: string;
  readonly combined: string;
}

export interface BuildPromptPackagesOptions {
  readonly languages?: readonly PromptLanguage[];
}

export type PromptModuleBuilder = (context: PromptBuildContext) => PromptModuleResult;
