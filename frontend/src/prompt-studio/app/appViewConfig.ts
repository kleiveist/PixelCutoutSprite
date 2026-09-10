import type { AppView } from "../domain/navigation";

export interface AppViewDefinition {
  readonly label: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly nextStep: string;
}

export const PROMPT_STUDIO_VIEW_DEFINITIONS: Readonly<Record<AppView, AppViewDefinition>> = {
  dashboard: {
    label: "Dashboard",
    title: "Pixelart-Produktion beginnt mit der richtigen Asset-Art.",
    eyebrow: "Produktionszentrale",
    description:
      "Dein Einstieg in Profile, geführte Asset-Erstellung und konsistente Prompt-Pakete.",
    nextStep: "Wähle eine Kategorie oder setze ein vorhandenes Profil fort.",
  },
  profiles: {
    label: "Profile",
    title: "Ein Basisprofil für deinen Vault.",
    eyebrow: "Vault-Profil",
    description:
      "Die gemeinsame Basis bestimmt die Produktionsregeln aller Assets im aktiven Vault.",
    nextStep: "Basisprofil anlegen oder bearbeiten.",
  },
  wizard: {
    label: "Wizard",
    title: "Neue Assets geführt aufsetzen.",
    eyebrow: "Geführter Abfragekatalog",
    description:
      "Die wiederaufnehmbare Wizard Engine validiert jeden Schritt und sichert gültige Änderungen lokal.",
    nextStep: "Name, Kategorie und die passenden Katalogseiten ausfüllen.",
  },
  output: {
    label: "Ausgabe",
    title: "Prompt-Pakete produktionsbereit ausgeben.",
    eyebrow: "Output Workspace",
    description:
      "Hauptprompt, Negativprompt, technische Spezifikation und kombinierte Ausgabe bekommen hier ihren festen Platz.",
    nextStep: "Sprach- und Stilpakete werden automatisch als Markdown im Vault gespeichert.",
  },
};

/** @deprecated Use `PROMPT_STUDIO_VIEW_DEFINITIONS`. */
export const APP_VIEW_DEFINITIONS = PROMPT_STUDIO_VIEW_DEFINITIONS;
