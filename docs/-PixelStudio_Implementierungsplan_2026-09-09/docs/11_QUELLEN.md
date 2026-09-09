# 11 · Quellen und Nachvollziehbarkeit

Recherche: 9. September 2026. Repository-Dateien sind auf den untersuchten Commit fixiert. Quellen dienen zur Begründung des Ist-Zustands; vorgeschlagene Neuanlagen sind keine Behauptung über schon implementierte Funktionen.

## Repository-Dateien

### S01 · README und bisherige P00–P27-Reihe

`README.md` · gelesen: vollständig.

Quelle: [README.md](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/README.md)

### S02 · Frontend-Stack und verfügbare npm-Scripts

`frontend/package.json` · gelesen: vollständig.

Quelle: [frontend/package.json](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/package.json)

### S03 · App-Composition, alte Fachabhängigkeiten, Browser-Defaults

`frontend/src/app/App.tsx` · gelesen: Zeilen 1–190.

Quelle: [frontend/src/app/App.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/app/App.tsx)

### S04 · Modi, Prompt-Views und alte Cutout-Routen

`frontend/src/app/navigation.ts` · gelesen: vollständig.

Quelle: [frontend/src/app/navigation.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/app/navigation.ts)

### S05 · Gemeinsamer Header und Hilfebutton

`frontend/src/components/AppHeader.tsx` · gelesen: vollständig.

Quelle: [frontend/src/components/AppHeader.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/components/AppHeader.tsx)

### S06 · Prompt-Router und data-module-navigation

`frontend/src/prompt-studio/app/AppShell.tsx` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/app/AppShell.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/app/AppShell.tsx)

### S07 · Prompt-Provider und Theme-Grenze

`frontend/src/prompt-studio/app/PromptGeneratorRoot.tsx` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/app/PromptGeneratorRoot.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/app/PromptGeneratorRoot.tsx)

### S08 · Prompt-Storage beim App-Start

`frontend/src/main.tsx` · gelesen: vollständig.

Quelle: [frontend/src/main.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/main.tsx)

### S09 · Native Composition, App-Data-Prompt-Root, Commands und Acceptance-Größe

`src-tauri/src/lib.rs` · gelesen: vollständig.

Quelle: [src-tauri/src/lib.rs](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/src-tauri/src/lib.rs)

### S10 · Prompt-Workspace-Persistenz und Einzeldatei-Publish

`src-tauri/src/storage/prompt_workspace.rs` · gelesen: Zeilen 1–230.

Quelle: [src-tauri/src/storage/prompt_workspace.rs](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/src-tauri/src/storage/prompt_workspace.rs)

### S11 · Native/Browser-Persistenzadapter und Migrationslogik

`frontend/src/prompt-studio/services/promptWorkspaceStorage.ts` · gelesen: Zeilen 1–210.

Quelle: [frontend/src/prompt-studio/services/promptWorkspaceStorage.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/services/promptWorkspaceStorage.ts)

### S12 · Wizard-Initialisierung, Profil-/Entwurfsbezug

`frontend/src/prompt-studio/features/wizard/WizardView.tsx` · gelesen: Zeilen 1–190.

Quelle: [frontend/src/prompt-studio/features/wizard/WizardView.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/features/wizard/WizardView.tsx)

### S13 · Vorhandene GuidedWizardEngine-Anbindung

`frontend/src/prompt-studio/features/wizard/WizardEngine.tsx` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/features/wizard/WizardEngine.tsx](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/features/wizard/WizardEngine.tsx)

### S14 · Neun Typen und vorhandene Untertyp-Anzeigen

`frontend/src/prompt-studio/features/dashboard/dashboardCatalog.ts` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/features/dashboard/dashboardCatalog.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/features/dashboard/dashboardCatalog.ts)

### S15 · Bestehende Basisprofilwerte und IDs

`frontend/src/prompt-studio/schemas/common.schema.ts` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/schemas/common.schema.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/schemas/common.schema.ts)

### S16 · V2-Wizard-Draft und bisheriger projectName

`frontend/src/prompt-studio/schemas/wizardDraft.schema.ts` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/schemas/wizardDraft.schema.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/schemas/wizardDraft.schema.ts)

### S17 · Fenstergrenzen und CSP

`src-tauri/tauri.conf.json` · gelesen: vollständig.

Quelle: [src-tauri/tauri.conf.json](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/src-tauri/tauri.conf.json)

### S18 · Native Bibliotheken und PNG-Feature

`src-tauri/Cargo.toml` · gelesen: vollständig.

Quelle: [src-tauri/Cargo.toml](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/src-tauri/Cargo.toml)

### S19 · Storage-Modulgrenzen

`src-tauri/src/storage/mod.rs` · gelesen: vollständig.

Quelle: [src-tauri/src/storage/mod.rs](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/src-tauri/src/storage/mod.rs)

### S20 · Schema-Exporte und Wiederverwendungsanker

`frontend/src/prompt-studio/schemas/index.ts` · gelesen: vollständig.

Quelle: [frontend/src/prompt-studio/schemas/index.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/prompt-studio/schemas/index.ts)

### S21 · Bisheriger Handoff-Client in eine Area

`frontend/src/api/prompt-studio-client.ts` · gelesen: vollständig.

Quelle: [frontend/src/api/prompt-studio-client.ts](https://github.com/kleiveist/PixelCutoutSprite/blob/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/api/prompt-studio-client.ts)

## Struktur und Commit

S22: Die GitHub-Verzeichnisabfrage bestätigt unter `frontend/src/features/` die Bereiche animations, areas, directions, dummy-editor, editing, export, inventory, npcs, outfit, projects, timeline und vault. Die App-/Prompt-/Services-Verzeichnisse wurden ergänzend zur Orientierung abgefragt.

[Frontend-Struktur](https://github.com/kleiveist/PixelCutoutSprite/tree/9efa821bc21b0099dc2f0d51895e472fc02b737f/frontend/src/features)

S23: [Untersuchter Commit](https://github.com/kleiveist/PixelCutoutSprite/commit/9efa821bc21b0099dc2f0d51895e472fc02b737f), Commit-Zeitstempel laut GitHub `2026-09-06T18:51:35Z`.

## Technische Primärdokumentation

**T01 · Tauri Capabilities.** Granulare Freigaben für Fenster/WebViews ersetzen keine Sicherheitsprüfung in eigenem Rust-Code. [Offizielle Dokumentation](https://v2.tauri.app/security/capabilities/). Abgerufen am 9. September 2026.

**T02 · Tauri Opener.** `revealItemInDir` zeigt ein Ziel im System-Dateimanager an. Die dokumentierte Schnittstelle verspricht nicht plattformübergreifend eine neue Fensterinstanz. [Offizielle JavaScript-Referenz](https://v2.tauri.app/reference/javascript/opener/). Abgerufen am 9. September 2026. Die konkrete native Rust-Schnittstelle ist gegen die bei Umsetzung gebundene Plugin-Version zu prüfen.

**T03 · W3C WAI-ARIA Dialog Pattern.** Fokusbegrenzung, Escape, Dialogbenennung und Fokus-Rückgabe dienen als Grundlage der gemeinsamen modalen Komponente. [Offizielle W3C-Dokumentation](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Abgerufen am 9. September 2026.

**T04 · OpenCV Interactive Foreground Extraction.** GrabCut kombiniert initiale Auswahl mit Vordergrund-/Hintergrund-Hinweisen; fehlerhafte Ergebnisse können manuelle Korrekturen benötigen. [Offizielles OpenCV-Tutorial](https://docs.opencv.org/4.13.0/d8/d83/tutorial_py_grabcut.html). Abgerufen am 9. September 2026. Die vorgeschlagene leichte Baseline in diesem Plan ist keine Behauptung, dass OpenCV schon im Repository installiert ist.

## Quellenhygiene

Das Paket verteilt keine fremden Quelltextdateien und keine Fontdateien. Es enthält eigene Planungsdokumente, Schnittstellenentwürfe und neue Beispiel-Daten. Vorhandene Bibliotheksversionen werden als Repository-Befund behandelt, nicht als Empfehlung, auf eine angeblich neueste Version umzusteigen. Tatsächlich ausgeführte App-Tests werden erst im Implementierungsprozess dokumentiert.
