<!-- AUTO-GENERATED:backlink START -->

[← Back](plans.md)
<!-- AUTO-GENERATED:backlink END -->

# PixelPromptStudio in PixelCutoutSprite integrieren

**Planungsstand:** 6. September 2026
**Status:** P23–P26 abgeschlossen; P27 freigegeben und als abschließende Abnahme als Nächstes
**Zielrepository:** `kleiveist/PixelCutoutSprite`
**Quellrepository:** `kleiveist/PixelForgeStudio`

Dieser Plan erweitert die abgeschlossene PixelCutoutSprite-Basisserie P00–P22 um die fünf
aufeinander aufbauenden Phasen P23–P27. P23 stellt den isolierten Prompt-Namensraum bereit, P24
die gemeinsame Shell und P25 die produktive Prompt-Oberfläche. P26 ergänzt native Persistenz,
Import/Export und Cutout-Handoff; die Gesamtabnahme folgt in P27. Ausgeführte Nachweise werden im
[lebenden ExecPlan](pixelcutoutsprite-execplan.md) geführt.

## Verifizierte Ausgangsbasis

Die Planung wurde gegen die beiden sauberen lokalen `main`-Checkouts geprüft:

| Repository          | Revision am 6. September 2026              | Rolle                                     |
| ------------------- | ------------------------------------------ | ----------------------------------------- |
| `PixelCutoutSprite` | `55cddf385f87b65eea8887ede3e6380c65e7dd97` | Ziel und alleinige gemeinsame Desktop-App |
| `PixelForgeStudio`  | `a4784cbb3b991c37cb5e87855f2025c0565cc4ff` | Read-only-Quelle für den Prompt-Bereich   |

Der Port verwendet diese primäre Quellrevision. Für die letzte reine Prompt-V2-Grenze und den
Ausgangspunkt der Testsuite wurde zusätzlich
`d253e7a948dc80ce766fe5e7ca76440f1f418c85` verwendet. Herkunft, Anpassungen und MIT-Hinweis
stehen in `frontend/src/prompt-studio/PROVENANCE.md`.

Der sichtbare Modulname in der Ziel-App lautet **PixelPromptStudio**. Persistierte
Kompatibilitätskennungen und importierte V2-Daten aus PixelForgeStudio werden nicht allein wegen
des neuen sichtbaren Namens umgeschrieben.

## Zielbild

Der Prompt-Generator wird als React-Bereich in derselben Tauri-App ausgeführt. Es gibt weder
iframe noch externe Webseite, zweiten Prozess, zweite App-Shell oder zweiten Header.

```text
AppHeader
├── PixelCutoutSprite / STUDIO
├── PixelPromptStudio / GENERATOR
├── LOCAL DESKTOP
└── Hilfe

StudioMode
├── cutout
│   └── bestehende WorkspaceRoute
└── prompt
    └── eigene PromptView
```

Die beiden Studiobuttons sind gleich groß, per Tastatur bedienbar und weisen ihren Zustand mit
`aria-pressed` aus. Der Generator verwendet einen grünen Akzent. Beim Wechsel zurück bleiben
Vault, Projekt, Area, Route sowie ausgewählte Template-, NPC- und Binding-IDs erhalten.
Vor einem Wechsel greifen die vorhandenen Guards für Dirty-Editoren und laufende Mutationen.

## Architekturgrenze

Die vorhandene `WorkspaceRoute` bleibt die Navigation des zusammenhängenden Cutout-Workflows.
Der Prompt-Generator wird nicht als weiterer Wert in diesen Routentyp eingefügt. Darüber entsteht
eine getrennte Ebene:

```ts
export type StudioMode = "cutout" | "prompt";

export type PromptView =
  "dashboard" | "profiles" | "wizard" | "output" | "settings";
```

Der integrierte Prompt-Navigationsadapter verwaltet nur `PromptView` und verändert weder
Browser-History noch Query-Parameter des Cutout-Bereichs:

```ts
export interface PromptNavigationAdapter {
  readView(): PromptView;
  navigate(view: PromptView): void;
  subscribe(listener: () => void): () => void;
}
```

Der neue Namensraum liegt vollständig unter `frontend/src/prompt-studio/`:

```text
prompt-studio/
├── app/
├── components/
├── domain/
├── features/
├── schemas/
├── services/
├── store/
├── styles/
└── test/
```

### Zu übernehmender Quellumfang

| Funktion              | Verifizierter Quellbereich in PixelForgeStudio                            |
| --------------------- | ------------------------------------------------------------------------- |
| Dashboard             | `src/features/dashboard/`                                                 |
| Profile               | `src/features/profiles/`, `src/domain/profiles/`, `src/store/profiles/`   |
| Wizard und Recovery   | `src/features/wizard/`, `src/store/wizard/`, `src/domain/guided-answers/` |
| Prompt-Erzeugung      | `src/domain/prompt-engine/` einschließlich der getrennten Module          |
| Ausgabeprüfung        | `src/features/review-output/`                                             |
| Einstellungen         | `src/features/settings/`, `src/store/settings/`                           |
| Prompt-Schemas        | nur die tatsächlich benötigten Dateien aus `src/schemas/`                 |
| Adapter und Transfers | benötigte Prompt-Pfade aus `src/services/`                                |

Prompt-spezifische Barrel-Dateien exportieren nur diese Module. Insbesondere darf das gemeinsame
PixelForgeStudio-`schemas/index.ts` nicht ungeprüft kopiert werden, weil es Prompt- und
Animationsschemas zusammenführt.

### Ausdrücklich ausgeschlossen

- PixelForgeStudio-Startseite und Gesamtheader
- `StudioSwitcher` aus PixelForgeStudio
- `AnimationProjectProvider`
- `AnimationStudioShell` und sämtliche Animation-Editoren
- PixelForgeStudio-Footer und eigenes `main.tsx`
- direkte Abhängigkeiten des Prompt-Wizards von Cutout-Editoren

Die Abhängigkeitsgrenze wird in P23 durch Import-/Architekturtests abgesichert. React 19 und Vite
8 sind bereits kompatibel. `@hookform/resolvers`, `react-hook-form` und `zod` werden in der
tatsächlich benötigten Version ergänzt. `fflate` kommt nur hinzu, wenn der portierte
Profilpaketpfad es wirklich verwendet. Die TypeScript-Toolchain des Zielprojekts bleibt zunächst
unverändert.

## Gemeinsame Shell und Layout

`AppHeader` erhält `activeStudio`, `onOpenCutoutStudio`, `onOpenPromptStudio` und den vorhandenen
`onHelp`-Callback. Der bisherige `brand-lockup` wird ein echter Button; daneben steht der gleich
große grüne Generator-Button. `LOCAL DESKTOP` und Hilfe bleiben rechts bestehen.

Im Cutout-Modus bleiben `WorkspaceNav`, Breadcrumbs, zweispaltiger Arbeitsbereich und Statusbar
unverändert. Im Prompt-Modus werden Cutout-Navigation und -Seitenleiste ausgeblendet. Die
Prompt-Unternavigation und der Generator belegen die volle Arbeitsbreite, während dieselbe
Statusbar erhalten bleibt.

Prompt-Tokens werden auf `.prompt-generator-root` begrenzt. PixelForgeStudio-Regeln für `:root`,
`html`, `body` oder `#root` werden nicht direkt importiert. Der Prompt-Arbeitsbereich scrollt
intern und darf weder das feste App-Grid noch die Cutout-Editoren verändern.

## Prompt-Workspace

Der integrierte Root setzt nur die Prompt-relevanten Provider zusammen: Einstellungen,
Profilbibliothek, Prompt-Navigation und Wizard-Session. Dashboard, Profilbibliothek, vollständiger
geführter Wizard, Wiederaufnahme aktiver Drafts, Review/Ausgabe und Einstellungen bleiben als
zusammenhängender Workflow erhalten. Eine vereinfachte Ersatzform ist nicht ausreichend.

Funktional umfasst die Portierung insbesondere:

- neuen Entwurf und Kategorieauswahl,
- alle geführten Kategoriefragen,
- Animation, Richtung und technische Parameter,
- Profilauflösung und Profilbibliothek,
- Positiv-, Negativ- und technischen Prompt,
- Draft-Speichern, Recovery und Fortsetzen,
- Ausgabeprüfung, Kopieren und Exportvorbereitung,
- Prompt-Einstellungen.

## Native Persistenz und Cutout-Übergabe

Produktiv speichert der Generator über einen Tauri-Adapter im App-Datenverzeichnis und ist damit
auch ohne geöffnete Vault verfügbar:

```text
App-Datenverzeichnis/
└── prompt-studio/
    ├── settings.json
    ├── profiles.json
    ├── draft.json
    └── migration-backup.json
```

Ein In-Memory- oder LocalStorage-Adapter bleibt nur für Tests und Browserentwicklung. Das
Frontend validiert unbekannte Daten mit den übernommenen Zod-Schemas. Rust begrenzt zusätzlich
Pfade, Dateigrößen und erlaubte Speicherorte und veröffentlicht JSON erst nach temporärem,
atomarem Schreiben.

Die Übergabe in PixelCutoutSprite verwendet einen stabilen Vertrag statt direkter Wizard-/Editor-
Abhängigkeiten:

```ts
export interface PromptHandoff {
  schemaVersion: number;
  category: string;
  prompt: string;
  negativePrompt: string;
  technicalPrompt: string;
  profileReferences: readonly string[];
  createdAt: string;
}
```

Ohne Vault bleiben Kopieren und Datei-Export verfügbar. Die Übergabe wird nur mit schreibbarer
Vault und gewählter Area aktiviert; eine Read-only-Vault deaktiviert sie. Der ursprüngliche Prompt
bleibt als JSON-Referenz nachvollziehbar. Nach erfolgreicher Übergabe kann die App kontrolliert in
den vorherigen Cutout-Kontext zurückkehren.

## Phasenfolge

| Phase                                     | Ergebnis                                                                | Status                                | Vorgeschlagener Commit                                |
| ----------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| [P23](../prompts/pixelcutoutsprite/23.md) | Integrationsgrenze, isolierter Prompt-Namensraum und Abhängigkeiten     | Abgeschlossen; Phase-1-Gate bestanden | `🧭 Define prompt generator integration boundary`     |
| [P24](../prompts/pixelcutoutsprite/24.md) | gemeinsamer Header, StudioMode und sicherer Wechsel                     | Abgeschlossen; Phase-2-Gate bestanden | `🧩 Add shared studio header switcher`                |
| [P25](../prompts/pixelcutoutsprite/25.md) | vollständige Prompt-Oberfläche, Provider, Navigation und CSS-Isolierung | Abgeschlossen; Phase-3-Gate bestanden | `🧬 Port PixelPromptStudio generator`                 |
| [P26](../prompts/pixelcutoutsprite/26.md) | native Persistenz, Import/Export und Cutout-Handoff                     | Abgeschlossen; Phase-4-Gate bestanden | `💾 Add native prompt persistence and cutout handoff` |
| [P27](../prompts/pixelcutoutsprite/27.md) | Regression, E2E, native Abnahme und Dokumentation                       | Freigegeben; als Nächstes              | `✅ Verify integrated studio workflows`               |

Die Commitzeilen sind Vorschläge, keine Erlaubnis für automatische Commits oder Pushes. Eine Phase
beginnt erst, wenn das Gate ihrer Vorgängerphase belegt ist.

## Betroffene Kernbereiche

| Bereich                                 | Umsetzung                                          |
| --------------------------------------- | -------------------------------------------------- |
| `frontend/package.json` und Lockfile    | ausschließlich erforderliche Prompt-Abhängigkeiten |
| `frontend/src/app/App.tsx`              | `StudioMode`, Umschaltung und gemeinsames Layout   |
| `frontend/src/components/AppHeader.tsx` | zwei gleich große Studio-Buttons                   |
| `frontend/src/styles/global.css`        | Headerzustände und Prompt-Flächenlayout            |
| `frontend/src/prompt-studio/`           | isolierter vollständiger Prompt-Bereich            |
| `frontend/src/main.tsx`                 | produktiven nativen Prompt-Adapter zusammensetzen  |
| `src-tauri/src/commands/`               | Prompt-Storage-, Import- und Export-Commands       |
| `src-tauri/src/storage/`                | atomare App-Daten-Speicherung                      |
| `src-tauri/src/domain/`                 | native Prompt-Grenzen und Handoff-Datentypen       |
| `src-tauri/src/lib.rs`                  | Commands registrieren                              |
| Frontend-, Rust- und E2E-Tests          | Studio-Wechsel und vollständiger Prompt-Workflow   |

## Definition of Done

Die Erweiterung ist abgeschlossen, wenn Nutzer im vorhandenen Header zwischen
PixelCutoutSprite Studio und PixelPromptStudio Generator wechseln können, ohne eine zweite App
oder Webseite zu öffnen; der vollständige Prompt-Workflow einschließlich Profile, Drafts,
Ausgabe und Einstellungen funktioniert; Prompt-Daten nativ und atomar gespeichert werden; der
Cutout-Kontext erhalten bleibt; und gültige Prompts kontrolliert an eine schreibbare Area
übergeben werden können.

## Aktueller Umsetzungsnachweis

P23 enthält den isolierten Prompt-Namensraum mit Prompt-spezifischen Barrels, den benötigten
React-/Zod-Abhängigkeiten, den puren Domain-/Schema-/Storage- und Transferverträgen sowie der
portierten Prompt-Oberflächenbasis. Ein Importgrenzentest schließt PixelForge-Startseite,
Gesamtshell, Animation Studio, Worker und eigenes `main.tsx` aus. Herkunft, Quellrevisionen und
Lizenz sind direkt im Namensraum dokumentiert.

P24 führt `StudioMode` getrennt von `WorkspaceRoute` ein und macht den bisherigen Brand-Lockup
zusammen mit dem grünen PixelPromptStudio-Lockup zu zwei gleich großen, zugänglichen Buttons. Der
Wechsel verwendet die vorhandenen Recovery-, Mutations- und Dirty-Editor-Guards, bewahrt den
Cutout-Kontext und wartet beim Verlassen des Prompt-Modus auf dessen Lifecycle-Flush. Der
Prompt-Modus besitzt bereits die volle Shell-Breite.

P25 ersetzt den temporären Mount-Punkt durch `PromptGeneratorRoot`. Der Root setzt ausschließlich
Einstellungen, Profilbibliothek, integrierte Prompt-Navigation und Wizard-Session zusammen.
Dashboard, Profile, vollständiger Neun-Kategorien-Wizard, Ausgabeprüfung und Einstellungen laufen
innerhalb derselben Tauri-Shell. Die Navigation hält `PromptView` ausschließlich im App-Zustand und
verändert die Browser-History nicht. Ein schmutziger Wizard blockiert den Studiowechsel, bis sein
gültiger Autosave abgeschlossen ist; danach wird der bestehende Lifecycle-Flush abgewartet.
Design-Tokens, Resetregeln, Fokus- und Auswahlregeln sind unter `.prompt-generator-root` gekapselt,
und nur der innere Prompt-Arbeitsbereich scrollt.

P26 initialisiert im Produktions-Bootstrap den nativen Tauri-Adapter und speichert Einstellungen,
Profile, Draft und Migrationsbackup unter dem App-Datenpfad `prompt-studio/`. Feste Dateitypen,
Größenlimits, gestufte atomare Writes und Recovery werden zusätzlich in Rust erzwungen. Import und
Markdown-/JSON-Export laufen über native Dialoge. Der versionierte Handoff schreibt nur nach einer
ausdrücklichen Aktion und nur mit schreibbarer Vault plus gewählter Area eine JSON-Referenz unter
`prompt-references/`; ohne gültigen Kontext bleibt er begründet deaktiviert, während Kopieren und
Export verfügbar bleiben. P27 bleibt die freigegebene abschließende Gesamtprüfung und
Dokumentation.

Zusätzlich gelten:

- Frontend-Typecheck, Lint, Format, Tests und Build bestehen.
- Rust-Tests sowie die verfügbaren nativen Run-/Build-/Smoke-Gates bestehen oder sind mit einem
  konkreten Plattformblocker dokumentiert.
- Der Generator funktioniert offline.
- Prompt-Styles beeinflussen keinen Cutout-Arbeitsbereich.
- Bestehende Vaults werden ohne ausdrückliche Übergabe weder migriert noch verändert.
- Herkunft, Quell-Commit und Lizenz der übernommenen PixelForgeStudio-Dateien sind dokumentiert.
- Alte PixelForgeStudio-Profilpakete werden validiert importiert.
- Markdown- und JSON-Ausgaben lassen sich über den nativen Speicherdialog sichern.
