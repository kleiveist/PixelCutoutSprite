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
    title: "Produktionsprofile sicher organisieren.",
    eyebrow: "Profilbibliothek",
    description:
      "Assetprofile erhalten hier eine kategorisierte, verlässliche Arbeitsfläche auf ihrer gültigen Profilkette.",
    nextStep: "Suche, Filter, Compatibility-Gruppen und Profilaktionen sind aktiv.",
  },
  wizard: {
    label: "Wizard",
    title: "Neue Assets geführt aufsetzen.",
    eyebrow: "Geführter Abfragekatalog",
    description:
      "Die wiederaufnehmbare Wizard Engine validiert jeden Schritt und sichert gültige Änderungen lokal.",
    nextStep: "Kategorie, Untertyp, Basisprofil und passende Fachschritte sind vollständig aktiv.",
  },
  output: {
    label: "Ausgabe",
    title: "Prompt-Pakete produktionsbereit ausgeben.",
    eyebrow: "Output Workspace",
    description:
      "Hauptprompt, Negativprompt, technische Spezifikation und kombinierte Ausgabe bekommen hier ihren festen Platz.",
    nextStep:
      "Sprach- und Stilpakete lassen sich kopieren, als Markdown oder zusammen mit dem Profil als JSON exportieren.",
  },
  settings: {
    label: "Einstellungen",
    title: "Das Studio passend konfigurieren.",
    eyebrow: "Einstellungen & Datentransfer",
    description:
      "Darstellung und Workspace-Daten bleiben lokal, kontrollierbar und als validiertes V2-JSON übertragbar.",
    nextStep:
      "Getrennte Studio-Startziele, V1-Migrationsstatus sowie vollständiger JSON-Export und -Import sind aktiv.",
  },
};

/** @deprecated Use `PROMPT_STUDIO_VIEW_DEFINITIONS`. */
export const APP_VIEW_DEFINITIONS = PROMPT_STUDIO_VIEW_DEFINITIONS;
