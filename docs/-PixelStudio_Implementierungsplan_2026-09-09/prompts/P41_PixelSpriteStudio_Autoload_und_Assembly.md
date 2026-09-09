# P41 · PixelSpriteStudio mit Ordner-Autoload und Originalanordnung

**Auftrag:** Aus einem richtigen Teileordner automatisch eine räumlich korrekte, prüfbare Zusammenstellung laden.

**Voraussetzungen:** P40. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/06_SEGMENTIERUNG_UND_SPRITES.md`

## Datei-Anker

`frontend/src/sprite-studio/ (neu/P29-Platzhalter)`, `frontend/src/shared/data-folder/`, `frontend/src/shared/canvas/`, `src-tauri/src/sprite/ (neu)`, `frontend/src/app/navigation.ts`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Ersetze den Sprite-Platzhalter durch eine neue Willkommen-/Studio-Ansicht mit gemeinsamer Navigation-Row und DataFolderToolbar. Ein ausgewählter gültiger Teileordner startet den Loader automatisch.

2. Prüfe Manifestversion, Part-IDs, Eindeutigkeit, sichere relative Pfade, Dateigrößen, Pixelabmessungen, Hashes und Generatorstatus. Lade nur die im Manifest ausgewiesenen Teile, keine veralteten zufälligen Zusatz-PNGs.

3. Rekonstruiere die Originalanordnung aus sourceRect, pivot und defaultPosition. Verwende Default-Z explizit; die Dateinummer ist nicht automatisch die Zeichenreihenfolge. Zeige eine erste View-Liste der geladenen Teile.

4. Behandle absichtlich fehlende Teile und Extras gemäß Manifest anders als defekte fehlende Dateien. Eine Ladefehlermeldung darf eine zuvor funktionierende Szene nicht kommentarlos leeren.

5. Erkenne bekannte Dateinamen ohne Manifest als Legacy-Set. Autoidentifikation der Teile ist erlaubt; eng zugeschnittene Bilder ohne Offsets benötigen einen sichtbaren manuellen Ausrichtmodus. Keine erfundenen Ursprungskoordinaten.

6. Prüfe eine bereits vorhandene sprite.scene.json und deren Generation-Bezug. Die vollständige Bearbeitung folgt in P42, aber ein bekannter inkompatibler Szenenstand darf schon jetzt nicht still überschrieben werden.

7. Ergänze Tests mit asymmetrischen Teilen, nicht mittigen Pivots, überlappenden opaken Pixeln, teiltransparenten Source-over-Rändern, fehlender PNG, Pfadmanipulation und absichtlich veralteten Extra-Dateien.

## Prüftor

- [ ] Ein normaler Klick/Enter auf den gültigen Set-Ordner erzeugt eine korrekte Originalanordnung.
- [ ] PNG-/Manifest-Abweichungen werden vor Verwendung abgefangen.
- [ ] Dateinamen ohne Positionsmetadaten führen nicht zu einer vorgetäuschten korrekten Ausrichtung.
- [ ] Ein korrumpiertes Set überschreibt weder Datei noch die bisherige valide Ansicht.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine neue Timeline, kein Rigging-/Godot-Export und keine Ableitung räumlicher Offsets aus bloßen Dateinummern.

## Abschluss

Erwartetes Ergebnis: Neues SpriteStudio, sicherer Set-Loader, automatische Platzierung und Assembly-Tests.

Zugeordnete Anforderungen: R-G03, R-G05, R-D09, R-S01, R-S02, R-S03, R-S06, R-S07, R-S08.

Lege den Bericht unter `docs/developer/acceptance/P41-pixelspritestudio_autoload_und_assembly.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
