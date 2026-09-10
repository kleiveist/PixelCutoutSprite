export type PromptView = "dashboard" | "profiles" | "wizard" | "output";

export const promptNavigationItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "profiles", label: "Profile" },
  { id: "wizard", label: "Wizard" },
  { id: "output", label: "Ausgabe" },
] as const satisfies readonly { readonly id: PromptView; readonly label: string }[];
