# P33 · Profile-Seite mit genau einem Vault-Basisprofil

**Auftrag:** Die neue kompakte Vault-/Basisprofil-Bedienung ohne separate Profilbibliothek umsetzen.

**Voraussetzungen:** P32. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/prompt-studio/features/profiles/`, `frontend/src/prompt-studio/app/PromptGeneratorRoot.tsx`, `frontend/src/prompt-studio/schemas/common.schema.ts`, `frontend/src/shared/dialogs/Modal.tsx (P29)`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Ersetze die bisherige Profile-Bibliotheksansicht durch den aktuellen Vault-Namen, dessen Kontext und einen großen Basisprofil-Button. Kein frei bearbeitbarer Projektname und keine zusätzliche Projektanlage.

2. Öffne das Basisprofil in der gemeinsamen modalen Komponente. Übernimm sämtliche fachlichen Werte aus dem P28-Feldinventar, nicht nur die vier Werte der Button-Zusammenfassung.

3. Speichern schreibt ausschließlich .PixelPrompt/basisprofil.json mit stabiler ID und erhöhter Revision. Eine Neuanlage ist nur erlaubt, wenn dort noch keine aktive Basis existiert. Für eine zweite konkurrierende Datei oder externe Änderung zeige einen Konflikt.

4. Zeige nach erfolgreichem Speichern die wesentlichen Werte direkt im Button. Ungültige Pflichtfelder bleiben im Popup sichtbar. X/Escape/Außenklick schließen entsprechend dem gemeinsamen Vertrag ohne ungewollte Basisänderung.

5. Binde Basisänderungen an die P32-Regenerierungswarteschlange. Die UI macht ausstehende oder fehlgeschlagene Aktualisierungen bestehender Prompts sichtbar, während die eine neue Basis bereits eindeutig feststeht.

6. Sorge für klare Zustände ohne Vault, ohne Basis, bei read-only und bei beschädigter Basisdatei. Defekte Daten nicht durch Defaults ersetzen. Der Wizard darf zur Basis-Seite verlinken, aber keinen zweiten Basis-Editor anbieten.

## Prüftor

- [ ] Pro Vault existiert genau ein aktiver Basis-Pfad und keine globale Active-Base-ID.
- [ ] Die Zusammenfassung im großen Button entspricht dem tatsächlich gespeicherten Inhalt.
- [ ] Ein Basiswechsel in Vault A verändert Basis und Ausgaben von Vault B nicht.
- [ ] Ein Abbruch des Popups bestätigt keine ungespeicherten Formularwerte.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine Sammlung mehrerer aktiver Basisprofile, kein Duplizieren einer Basis und kein erneut eingebetteter Basis-Wizard.

## Abschluss

Erwartetes Ergebnis: Neue Profile-Seite, vollständiger kompakter Basisdialog und Tests für die Singleton-Invariante.

Zugeordnete Anforderungen: R-G02, R-D03, R-P03, R-P06, R-P12.

Lege den Bericht unter `docs/developer/acceptance/P33-vault_profile_und_basisprofil_popup.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
