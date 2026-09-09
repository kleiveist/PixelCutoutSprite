# P31 · Globale Einstellungen und Legacy-Migrationsvorbereitung

**Auftrag:** Darstellung aus PromptStudio herauslösen und eine sichere, noch nicht heimlich angewandte Legacy-Übernahme vorbereiten.

**Voraussetzungen:** P30. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/10_ENTSCHEIDUNGEN_UND_RISIKEN.md`

## Datei-Anker

`frontend/src/prompt-studio/store/settings/`, `frontend/src/prompt-studio/features/settings/`, `frontend/src/prompt-studio/services/promptWorkspaceStorage.ts`, `src-tauri/src/storage/prompt_workspace.rs`, `src-tauri/src/storage/device_settings.rs`, `frontend/src/shared/settings/ (neu)`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Implementiere globale Geräteeinstellungen mit einer eigenen, klar begrenzten Datei. Übernimm sinnvolle allgemeine Settings-Felder aus dem Bestand; schließe aktive Basisprofil-ID, Profile, Antworten und Output-Inhalte ausdrücklich aus.

2. Binde den Header-Dialog an die globale Persistenz an. Theme und Dichte gelten in allen drei Modulen. Entferne die fachlich unabhängige Prompt-Theme-Quelle und halte nur erforderliche Scoped-Styles.

3. Implementiere ein nachvollziehbares Formularverhalten: Speichern validiert und persistiert; X/Escape/Außenklick schließen ohne heimliches Commit. Ein ungespeicherter Dialogentwurf kann für dieselbe Sitzung erhalten bleiben.

4. Isoliere einen read-only Legacy-Adapter für die in P28 ermittelten nativen Dateien und erreichbaren Browser-Schlüssel. Keine produktiven Writes auf den alten zentralen Profilbestand mehr vorbereiten. Verhindere eine Startmigration ohne gewählten Ziel-Vault.

5. Baue Migrationsinventar, Vorschau und einen reinen Konverter mit stabiler Quell-ID-/Hash-Zuordnung. Mehrere inkompatible Basisprofile und alte Kategorie-Overrides müssen als Konflikt erscheinen; keine zufällige Auswahl des ersten Profils.

6. Erzeuge noch keine erfolgreich abgeschlossene Migration in der UI. Die bestätigte Veröffentlichung wird in P32 an den neuen Prompt-Writer angeschlossen. Prüfe hier Konvertierung, Namenszuordnung, Duplikaterkennung und die Nichtveränderung der Quelle.

7. Entferne den Prompt-Menüpunkt Einstellungen aus den tatsächlich verwendeten Konfigurationen oder leite verbleibende interne Aufrufe kontrolliert zum globalen Dialog. Ein unbekannter Prompt-View darf nicht mehr still die alte Settings-Seite rendern.

## Prüftor

- [ ] Theme-Wechsel gilt für Prompt, Cutout und Sprite; ein App-Neustart behält nur die globalen Werte.
- [ ] Die globale Einstellungsdatei enthält nachweislich keine fachlichen Profile oder Drafts.
- [ ] Legacy-Dry-run ist ohne Seiteneffekte wiederholbar.
- [ ] Mehrere Basisprofile und kollidierende Namen erscheinen verständlich in der Vorschau.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Noch keine Legacy-Daten löschen und keine unvollständige Migrationsvorschau als angewandte Migration melden.

## Abschluss

Erwartetes Ergebnis: Globaler Settings-Service/-Dialog, isolierter Legacy-Leser und getesteter Migrationsplan/Konverter.

Zugeordnete Anforderungen: R-G01, R-D02, R-D07.

Lege den Bericht unter `docs/developer/acceptance/P31-globale_settings_und_legacy_vorbereitung.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
