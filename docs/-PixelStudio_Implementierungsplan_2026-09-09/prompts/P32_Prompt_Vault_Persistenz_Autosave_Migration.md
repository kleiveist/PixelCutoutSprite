# P32 · Prompt-Dateirepository, Autosave und bestätigte Migration

**Auftrag:** Die neue dateibasierte Prompt-Persistenz als einzige produktive Quelle der Wahrheit aktivieren.

**Voraussetzungen:** P30, P31. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/04_DATENVERTRAEGE.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/prompt-studio/services/`, `frontend/src/prompt-studio/store/profiles/`, `frontend/src/prompt-studio/store/wizard/`, `frontend/src/prompt-studio/schemas/`, `src-tauri/src/prompt_vault/ (neu)`, `src-tauri/src/lib.rs`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Implementiere VaultPromptRepository für Basisprofil, einzelne Assetprofile, Drafts und Index-Scan. Ersetze produktive zentrale V2-Collections und Browser-Storage-Fallbacks durch asynchrone, sitzungsgebundene Zugriffe.

2. Baue die Pfadableitung .PixelPrompt/<Typ>/<Untertyp>/<Name> und die sichere Namensreservierung. Name/Typ/Untertyp-Wechsel müssen Dateien und Referenzen konsistent umbenennen. ID-Kollisionen, case-insensitive Namen und fremde Dateien verursachen keinen stillen Datenersatz.

3. Autosave darf rohe Zwischenstände sichern. Vor gültiger Identität nutze .drafts/<draftId>.json; nach Identitätsfestlegung die kanonische Profildatei. Bei später ungültigem Namen bleibt der letzte gültige Pfad erhalten, der Rohzustand wird im Draft-Journal geschützt.

4. Kapsle die vorhandene reine Prompt-Generierung zu einem einheitlichen Snapshot-Generator. Erzeuge alle tatsächlich unterstützten Stil-/Sprachvarianten und die vier MD-Arten. Profil und MDs erhalten gemeinsam die Generierungsreferenz, Dateiliste und Hashes.

5. Implementiere Debounce, Flush, fachliche Validierung, stale/fresh-Outputstatus und CAS. Ungültige Antworten dürfen keine gültigen alten Ausgaben mit leeren Texten überschreiben. Ein Basisprofil-Revisionswechsel markiert und regeneriert betroffene valide Profile automatisch.

6. Schließe die bestätigte Migration aus P31 an denselben Writer an. Sichere ausgewählte Herkunftsdaten im Ziel-Vault, prüfe Wiederlesen und Wiederholbarkeit. Mehrbasis-Konflikte müssen vor Publikation gelöst sein; die Quellbestände bleiben unverändert.

7. Entferne produktive App-Data-Prompt-Initialisierung und die alten Write-Commands aus dem neuen Laufzeitpfad. Teste Neustart, Vault-Kopie, gleichen Assetnamen in zwei Vaults, Fehler-Flush, externe Änderungen und unterbrochene Migration.

## Prüftor

- [ ] Vollständige Profile und MDs entstehen ohne Export-/Speicherbutton im vorgeschriebenen Vault-Pfad.
- [ ] Ein echter Neustart lädt Antworten aus Dateien statt aus einem alten Memory-/Browser-Cache.
- [ ] Keine neuen fachlichen Dateien in App-Data; Legacy-Lesezugriff ist klar isoliert.
- [ ] Ungültige Eingaben gehen nicht verloren und geben sich nicht als aktuelle Ausgabe aus.
- [ ] Ein wiederholter Migrationslauf erzeugt keine Duplikate.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine parallele zentrale Profilbibliothek, keine automatische Auswahl einer beliebigen alten Basis und kein stiller Fallback bei IO-Fehlern.

## Abschluss

Erwartetes Ergebnis: V3-Prompt-Writer/-Reader, Autosave/Generator-Queue, Migration-Apply und Dateisystemintegrationstests.

Zugeordnete Anforderungen: R-D01, R-D02, R-D03, R-D04, R-D05, R-D06, R-D07, R-D10, R-P02, R-P09, R-P11, R-P12.

Lege den Bericht unter `docs/developer/acceptance/P32-prompt_vault_persistenz_autosave_migration.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
