# P38 · Cutout-Editor, Quellbild und manuelle Masken

**Auftrag:** Einen voll bedienbaren, korrekt koordinierten Maskeneditor als zuverlässige Grundlage der Automatik schaffen.

**Voraussetzungen:** P37. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/06_SEGMENTIERUNG_UND_SPRITES.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/cutout-studio/ (P37)`, `frontend/src/shared/canvas/ (neu)`, `frontend/src/shared/data-folder/ (P36)`, `src-tauri/src/cutout/ (neu)`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Lade per Bilddateiklick die autorisierte Quelle. Unterstütze PNG und kontrolliert JPEG/WebP mit den vereinbarten Dekodierlimits. Normalisiere Orientierung und lege einen Quellhash fest; Originaldatei und Originalauflösung bleiben unverändert.

2. Implementiere Canvas-Fit, Zoom, Pan und die invertierbare Abbildung von Pointerpositionen auf Quellpixel einschließlich Device-Pixel-Ratio. Resize darf keine Maskenkoordinaten verändern.

3. Baue die sechs Hauptgruppen als horizontale Icon-Leiste und genau drei Untereinträge je Gruppe. Das Flyout öffnet bevorzugt links und wird bei Platzmangel kollisionsfrei umpositioniert. Verwende das zentrale Teile-Register.

4. Implementiere Rechteck/Lasso, positiven Pinsel, negativen Pinsel und Bestätigen. Jede Part-ID hat eine unabhängige Maske. Farben sind lediglich Overlay, aktive Maske kräftiger, bestätigte blasser und zusätzlich beschriftet.

5. Erlaube manuelle Überlappungen von Anfang an. Kein exklusives Part-Label pro Pixel. Füge Undo/Redo mit begrenzter History, Abbruch laufender Strokes und die Zustände unmarked/editing/confirmed/not_present hinzu.

6. Sichere Schnittentwürfe und Quellbezug automatisch lokal gemäß Datenvertrag. Lade eine Sitzung nach Neustart einschließlich bestätigter Masken und aktivem Teil. Verwende zunächst den Recovery-Projektort bis zur ersten Ausgabe in P40.

7. Prüfe asymmetrische Quellen, Pixel an Bildrändern, unterschiedliche DPI, Zoom, Resize, halbtransparenten Rand, leere Maske und großen Speicherbedarf. Befreie Bildressourcen beim Wechsel.

## Prüftor

- [ ] Ein Klick auf eine Bilddatei lädt den Editor ohne alten Projekt-/Area-Workflow.
- [ ] 15 Pflichtteile und genau drei optionale Slots sind korrekt zugeordnet.
- [ ] Überlappende Masken bleiben unabhängig; Undo eines Teils löscht keinen anderen.
- [ ] Masken sind nach Resize, Zoom und Wiederöffnung an denselben Quellpixeln.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Noch keine perfekte Autoerkennung behaupten, keine Bildfarben durch Overlayfarben ersetzen und keine Quelle destruktiv ausschneiden.

## Abschluss

Erwartetes Ergebnis: Nutzbarer manueller Cutout-Editor, Quellen-/Maskenpersistenz und Koordinaten-/Historytests.

Zugeordnete Anforderungen: R-G06, R-D04, R-C03, R-C04, R-C05, R-C07, R-C08, R-C11, R-C12, R-C13, R-C14.

Lege den Bericht unter `docs/developer/acceptance/P38-cutout_editor_manuelle_masken.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
