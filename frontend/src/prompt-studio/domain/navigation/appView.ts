export const PROMPT_VIEW_IDS = Object.freeze([
  "dashboard",
  "profiles",
  "wizard",
  "output",
  "settings",
] as const);

export type PromptView = (typeof PROMPT_VIEW_IDS)[number];
export const APP_VIEW_IDS = PROMPT_VIEW_IDS;
export type AppView = PromptView;

const promptViews = new Set<string>(PROMPT_VIEW_IDS);

export function isPromptView(value: unknown): value is PromptView {
  return typeof value === "string" && promptViews.has(value);
}

export const isAppView = isPromptView;
