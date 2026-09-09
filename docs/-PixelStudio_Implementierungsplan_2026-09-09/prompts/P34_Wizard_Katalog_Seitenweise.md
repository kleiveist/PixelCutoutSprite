# P34 · Geführter Wizard mit Name und echten Katalogseiten

**Auftrag:** Den vollständigen vorhandenen Fragenumfang auf eine platzsparende, persistente Schrittfolge verteilen.

**Voraussetzungen:** P33. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/prompt-studio/features/wizard/WizardView.tsx`, `frontend/src/prompt-studio/features/wizard/WizardEngine.tsx`, `frontend/src/prompt-studio/features/wizard/GuidedWizardEngine.tsx`, `frontend/src/prompt-studio/features/wizard/WizardCoreStepContent.tsx`, `frontend/src/prompt-studio/schemas/wizardDraft.schema.ts`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Ersetze den alten Projekt-/Profilkernflow durch identity, katalogabhängige catalog/<sectionId>-Schritte und review. Nutze das vollständige Frage-Mapping aus P28; keine Fragen ohne dokumentierte Begründung entfernen.

2. Platziere das Pflichtfeld Name sichtbar oberhalb des geführten Abfragekatalogs. Typ und Untertyp bestimmen die passende Schrittfolge. Der Name bezeichnet das Asset; der Vault-Kontext ist schreibgeschützt.

3. Rendere jeweils nur die aktive Katalogseite. Erhalte Formularwerte bei Unmount und Rücknavigation. Persistiere stabile Step-IDs und Katalogversion, nicht nur numerische Seitenpositionen.

4. Weiter validiert die aktuelle Seite, Zurück erhält auch unvollständige Angaben. Springe bei Fehlern zum betroffenen Feld. Zeige Fortschritt, Basis-Kontext und Speicherstatus ohne großen zweiten Basisprofilabschnitt.

5. Behandle Änderungen von Typ/Untertyp kontrolliert: gemeinsame Werte bewahren, inkompatible Antworten nicht auf andere Felder umdeuten, Auswirkungen sichtbar machen und vorherigen Rohzustand lokal sichern.

6. Lade ein gespeichertes Profil als vollständige Wizard-Sitzung aus V3. Entfernte oder umbenannte alte Step-IDs werden über eine Versionsmigration auf einen nachvollziehbaren Schritt abgebildet; Antworten bleiben erhalten.

7. Prüfe jede der neun Kategorien mit mindestens einer vollständigen Testantwortfolge. Teste außerdem Teilzustände, Rücknavigation, Modul-/Vaultwechsel und Neustart. Verifiziere, dass alle in P28 inventarisierten Felder im passenden Flow erreichbar sind.

## Prüftor

- [ ] Nie alle Fragen gleichzeitig als lange Seite sichtbar.
- [ ] Name steht oben und wird dauerhaft im richtigen Profil gespeichert.
- [ ] Kein Basisprofil-Editor/-Auswahlschritt im Wizard.
- [ ] Vorwärts, zurück, neu öffnen und Profil laden erhalten alle passenden Antworten und die Schrittposition.
- [ ] Alle neun Typen besitzen einen vollständigen gültigen Weg bis zur Ausgabe.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine rein optische Paginierung einer weiterhin vollständig gerenderten Langseite und keine verlorenen unmounteten Formularwerte.

## Abschluss

Erwartetes Ergebnis: Neue Schrittdefinitionen, vollständiges Fragen-Mapping, V3-Wizard-Hydration und kategorieübergreifende Tests.

Zugeordnete Anforderungen: R-D04, R-P01, R-P04, R-P05, R-P06, R-P11.

Lege den Bericht unter `docs/developer/acceptance/P34-wizard_katalog_seitenweise.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
