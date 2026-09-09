# P28 · Bestandsaufnahme, Zielverträge und Baseline

**Auftrag:** Ist-Zustand prüfen, neue Anforderungen verbindlich zuordnen und den sicheren Umbau vorbereiten.

**Voraussetzungen:** Aktueller Arbeitsbaum zugänglich; Master-Prompt gelesen. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/01_REPO_ANALYSE.md`
- `docs/02_ANFORDERUNGEN.md`
- `docs/04_DATENVERTRAEGE.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/10_ENTSCHEIDUNGEN_UND_RISIKEN.md`
- `docs/12_DATEI_AENDERUNGSMATRIX.md`

## Datei-Anker

`frontend/src/app/App.tsx`, `frontend/src/app/navigation.ts`, `frontend/src/prompt-studio/schemas/`, `frontend/src/prompt-studio/features/wizard/`, `src-tauri/src/lib.rs`, `src-tauri/src/storage/`, `frontend/package.json`, `src-tauri/Cargo.toml`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Prüfe Branch, HEAD und Arbeitsbaum gegen den untersuchten Commit. Lies den tatsächlichen Code der angegebenen Anker vollständig. Dokumentiere Unterschiede, ohne Nutzeränderungen zurückzusetzen oder den Branch automatisch auf den Referenzstand zu bringen.

2. Erzeuge eine Abhängigkeitsmatrix für alte Cutout-Routen, Frontend-Clients, Rust-Commands, Domain-Modelle und Storage-Helfer. Trenne reine, wiederverwendbare Infrastruktur vom zu entfernenden Projekt-/Area-/NPC-/Animations-Unterbau.

3. Inventarisiere sämtliche vorhandenen Wizard-Fragen, Verzweigungen und Generatorausgaben. Lege ein Mapping von jeder alten Frage auf eine neue Katalogseite mit stabiler Step-ID an. Kein fachliches Feld darf durch das Paging verschwinden.

4. Bestätige die neun Typ-IDs und ergänze einen Änderungsplan für fehlende Pflicht-Untertypen. Erhalte weitere vorhandene Untertypen. Übernehme das feste Teile-Register einschließlich Links-/Rechts-Konvention und drei Extra-Slots.

5. Lege neue DTO-/Schema-Tests für Basisprofil, Promptprofil, Cutoutprojekt, Teilemanifest und Szene an. Nutze die Paket-Schemas als Vertragshüllen und ergänze die vorhandene Kategorie-Fachvalidierung. Definiere partielle Entwürfe getrennt von fertigen Profilen.

6. Erfasse tatsächliche Legacy-Dateinamen und V1-/V2-Schlüssel. Definiere Migration, Eigentumsregeln für erzeugte Dateien, Revisionen und Journalzustände. Bereite Fixtures vor, ohne Nutzerdaten zu verändern.

7. Führe die verfügbaren Baseline-Gates aus und speichere Befehle, Exit-Codes und Umgebung. Erstelle docs/developer/acceptance/P28-baseline.md und einen Linkindex zum neuen Plan.

## Prüftor

- [ ] Bestehende Frontend-Tests, Typecheck und Rust-Tests ausgeführt oder konkret als nicht ausführbar dokumentiert.
- [ ] Alle neuen Anforderungen besitzen mindestens eine geplante Phase und einen Test.
- [ ] Es gibt eine vollständige Frage-/Ausgabe-Inventarliste statt einer geratenen Wizard-Neuentwicklung.
- [ ] V3-Dokumenthüllen akzeptieren gültige und verwerfen beschädigte/zu neue Beispiele; tiefere Fachprüfung ist ausdrücklich zugeordnet.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Noch keine alten Funktionsordner entfernen, keine Profile migrieren und keine neuen produktiven Speicherorte aktivieren.

## Abschluss

Erwartetes Ergebnis: Baseline-Bericht, Abhängigkeitsmatrix, Feld-/Schritt-Mapping, Vertragstests und aktualisierte Umsetzungsreferenz.

Zugeordnete Anforderungen: R-D07, R-P01, R-P09, R-C01, R-C11.

Lege den Bericht unter `docs/developer/acceptance/P28-bestandsaufnahme_und_vertraege.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
