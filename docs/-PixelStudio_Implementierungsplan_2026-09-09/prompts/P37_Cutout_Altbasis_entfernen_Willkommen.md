# P37 · Alte Cutout-Fachbasis entfernen und Willkommen neu aufbauen

**Auftrag:** Den ausdrücklich gewünschten fachlichen Neustart von PixelCutoutSprite durchführen, ohne Nutzerdaten oder gemeinsame Infrastruktur zu zerstören.

**Voraussetzungen:** P36. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/01_REPO_ANALYSE.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/12_DATEI_AENDERUNGSMATRIX.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/app/App.tsx`, `frontend/src/app/navigation.ts`, `frontend/src/features/`, `src-tauri/src/lib.rs`, `src-tauri/src/application/`, `src-tauri/src/animation/`, `src-tauri/src/exports/`, `frontend/src/cutout-studio/ (neu)`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Nutze den P28-Graph und die inzwischen extrahierten Dienste. Entferne produktive Cutout-Routen für Projekte, Areas, Animationen, Dummy-Editor, Outfit, NPCs und alten Export. Eine versteckte alte Seite ist keine Entfernung.

2. Entferne nicht mehr gebrauchte Frontend-Clients, fachliche DTOs, Stores und CSS. Bewahre oder migriere nur ausdrücklich benötigte generische Fehler-/Navigation-/Recovery-Primitives in den gemeinsamen Bereich.

3. Entferne alte registrierte Rust-Fachcommands, Export-/Importregistries und obsolete fachliche Module nach Abhängigkeitsprüfung. Neuer Vault-Service, sichere Dateioperationen und PromptStudio bleiben funktionsfähig.

4. Baue eine neue Cutout-Willkommen-Seite mit Vault-/Bildauswahl und kurzer Anleitung zum Markieren und Erzeugen. Verwende gemeinsame Navigation-Row und DataFolderToolbar auch in diesem Zustand.

5. Entferne den alten Prompt-Handoff in Areas aus allen produktiven Aufrufern und Commands. Die gemeinsame Dateistruktur ist künftig die Verbindung der Module.

6. Aktualisiere produktbezogene Dokumentation und Testzuordnung. Historische Akzeptanzberichte als historisch kennzeichnen. Allgemeine Storage-/Sicherheits- und Tooling-Tests nicht pauschal löschen.

7. Führe einen negativen Erreichbarkeitstest sowie eine Suche nach alten produktiven Projekt-/Area-/NPC-/Motion-Abhängigkeiten aus. Öffne einen alten Test-Vault und beweise, dass dessen Dateien nicht gelöscht werden.

## Prüftor

- [ ] Cutout zeigt nur den neuen Welcome-/Editor-Rahmen, keine alte Fachfunktion bleibt erreichbar.
- [ ] Alte Fachcommands sind nicht nur unbenutzt, sondern aus dem produktiven Handler entfernt.
- [ ] PromptStudio inklusive Vault-Autosave besteht seine Regressionstests.
- [ ] Alte Nutzerdateien und unabhängiges tools/-Tooling bleiben unverändert.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine rekursive Löschung von Nutzer-Vaults und kein pauschales Entfernen des gesamten Tauri-/Storage-Fundaments.

## Abschluss

Erwartetes Ergebnis: Bereinigter produktiver Cutout-Unterbau, neue Willkommen-Seite und dokumentierter Entfernen-/Bewahren-Nachweis.

Zugeordnete Anforderungen: R-G03, R-G05, R-C01, R-C02.

Lege den Bericht unter `docs/developer/acceptance/P37-cutout_altbasis_entfernen_willkommen.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
