# P43 · Gesamtabnahme, Desktop-Härtung und aktualisierte Dokumentation

**Auftrag:** Den gesamten neuen Ablauf inklusive Daten- und Desktop-Grenzen beweisen und auslieferbar dokumentieren.

**Voraussetzungen:** P42. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/02_ANFORDERUNGEN.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/09_ABNAHME_TESTS.md`
- `docs/10_ENTSCHEIDUNGEN_UND_RISIKEN.md`

## Datei-Anker

`frontend/e2e/`, `frontend/src/app/App.*.test.tsx`, `src-tauri/`, `docs/`, `.github/workflows/ci-studio.yml`, `tools/control.py`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Führe die vollständige Anforderungsmatrix gegen automatisierte und manuelle Nachweise. Ein Häkchen braucht einen Testnamen, Befehl, Ergebnis und gegebenenfalls Screenshot-/Logpfad. Historische P00–P27-Nachweise sind kein Ersatz.

2. Prüfe den Hauptablauf: neuer Vault, Basisprofil, paginierter Wizard, automatische Dateien, Dashboard-Laden, Bild markieren mit Überlappung, Teile erzeugen, Set-Ordner öffnen, Ebenen ändern, App schließen und wieder öffnen.

3. Führe die Fehlerfälle aus: ungültige/zu neue JSONs, kaputte PNG, Read-only, fehlende Quelle, externer Rename, Schreibkonflikt, zwei Writer, unterbrochene Publikation, halbes Fenster und fehlende Basis.

4. Prüfe native Close-/Flush-Funktion, Fenstergrenzen, Dateidialog, Image-Asset-Zugriff, Offlinebetrieb und Dateimanager auf verfügbaren Zielplattformen. Dokumentiere Windows-Neufensterverhalten ausdrücklich. Browser-Mocks nicht als native Beweise ausgeben.

5. Prüfe Barrierefreiheit mit Tastatur, sichtbarem Fokus, Dialogfokus, 200 % Zoom und Masken-/Ebeneninformationen ohne alleinige Farbcodierung. Führe die gesamte Größenmatrix aus.

6. Aktualisiere README, deutschsprachige Anleitung, Speicherlayout, Migration/Recovery, bekannte Grenzen und Produktbeschreibung. Entferne neue Benutzeranweisungen für alte Area-/NPC-/Godot-Abläufe; historische Dokumente bleiben als historisch kenntlich.

7. Nutze die vorhandenen Build-/Test-Einstiege. Halte Änderungen an portablem Tooling minimal. Erstelle einen finalen Bericht mit offenen Punkten; kein Signieren, Release-Push oder Publizieren ohne gesonderten Auftrag.

## Prüftor

- [ ] Jede neue Anforderung ist bestanden oder mit konkretem offenen Blocker erfasst.
- [ ] Keine neuen fachlichen Daten außerhalb des Vaults; keine alten produktiven Fachrouten/-commands.
- [ ] Ein vollständiger Native-Roundtrip und die integrierten Browser-Tests sind nachvollziehbar dokumentiert.
- [ ] Fehlende Plattformnachweise bleiben sichtbar offen statt grün.
- [ ] Das Paket enthält aktualisierte Nutzer-/Entwicklerdokumentation für genau den neuen Funktionsumfang.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine fiktiven Testergebnisse, keine pauschalen Skips, keine automatische Veröffentlichung und keine Erfolgsbehauptung für ungeprüfte Plattformen.

## Abschluss

Erwartetes Ergebnis: Finaler Abnahmebericht, aktuelle Anleitungen, nachvollziehbare Build-Artefaktreferenzen und offene-Punkte-Liste.

Zugeordnete Anforderungen: R-G04, R-G06, R-G07, R-D05, R-D08, R-D10.

Lege den Bericht unter `docs/developer/acceptance/P43-gesamtabnahme_haertung_dokumentation.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
