# P35 · Dashboard, Profil-Popups, Ausgabe und Dateimanager

**Auftrag:** Den fertigen dateibasierten Prompt-Workflow ohne manuelle Export-/Kopierstrecke schließen.

**Voraussetzungen:** P34. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/09_ABNAHME_TESTS.md`
- `docs/11_QUELLEN.md`

## Datei-Anker

`frontend/src/prompt-studio/features/dashboard/`, `frontend/src/prompt-studio/features/review-output/`, `frontend/src/prompt-studio/app/AppShell.tsx`, `frontend/src/prompt-studio/app/appViewConfig.ts`, `frontend/src/api/prompt-studio-client.ts`, `src-tauri/src/lib.rs`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Baue Dashboard-Zählungen und Namensvorschauen aus dem aktiven Vault-Scan. Zeige alle neun Typkarten mit Icon; leere Kategorien bleiben nutzbar. Zähle Profile, nicht vier MD-Dateien pro Profil.

2. Ein Kartenklick öffnet ein gemeinsames Kategorie-Popup mit nach Untertyp gruppierten Namen, Suche, Status und Laden. Lade bei Laden das vollständige Profil, sichere vorher die aktive Sitzung, schließe das Popup und gehe zum Wizard.

3. Erhalte alle vorhandenen Ausgabearten und Varianten anhand des P28-Generatorinventars. Zeige Inhalte und tatsächliche gespeicherte Dateireferenzen aus derselben Generation. Veraltete oder fehlgeschlagene Ausgaben dürfen nicht als frisch erscheinen.

4. Entferne Export-, Download-, Kopier-, JSON-Export- und alten Area-Handoff-Buttons aus den produktiven Prompt-Seiten. Entferne verbleibende Settings-Route/Fallbacks. Normale Textauswahl bleibt möglich.

5. Implementiere einen nativen reveal_workspace_path-Adapter mit Sitzung und geprüftem relativen Pfad. Nutze die offizielle Opener-Funktion ohne Shell-String-Zusammenbau; füge nur tatsächlich benötigte Abhängigkeiten/Permissions hinzu.

6. Prüfe unter Windows gesondert, ob das Öffnen eine neue Explorer-Ansicht erzeugt. Die Plugin-Dokumentation allein belegt keine neue Fensterinstanz. Melde Plattformgrenzen ausdrücklich; macOS/Linux sollen den jeweiligen System-Dateimanager benutzen.

7. Ergänze Negativtests auf entfernte Buttons/Routen, Popup-Dismiss, beschädigte Profile, Scan während Generierung und MD-/JSON-Zielauswahl.

## Prüftor

- [ ] Kategorie-Popup lädt Antworten statt nur Prompttext.
- [ ] Alle Ausgaben sind ohne Exporthandlung bereits im Vault vorhanden.
- [ ] Kein produktiver Prompt-Settings-/Export-/Copy-/Area-Handoff-Button bleibt übrig.
- [ ] Dateimanager erhält nur validierte Ziele aus dem aktiven Vault; native Fensteranforderung separat dokumentiert.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine neue zentrale Profilbibliothek hinter dem Dashboard und kein unvalidiertes Ausführen eines vom Frontend gelieferten absoluten Pfads.

## Abschluss

Erwartetes Ergebnis: Vollständiger Prompt-End-to-End-Ablauf, Datei-Reveal und UI-/Native-Abnahmetests.

Zugeordnete Anforderungen: R-G01, R-G02, R-G08, R-D08, R-P01, R-P02, R-P07, R-P08, R-P09, R-P10.

Lege den Bericht unter `docs/developer/acceptance/P35-dashboard_popups_ausgabe_explorer.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
