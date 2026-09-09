# P40 · PNG-Teile, Schnittprojekt und manifestgestützte Ausgabe

**Auftrag:** Die bestätigten Masken reproduzierbar in die gewünschte PNG-Dateistruktur überführen.

**Voraussetzungen:** P39. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/06_SEGMENTIERUNG_UND_SPRITES.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`src-tauri/src/cutout/`, `frontend/src/cutout-studio/`, `src-tauri/src/workspace/`, `vertraege/sprite-parts.schema.json im Planpaket`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Validiere vor der Ausgabe alle 15 Pflichtteile. confirmed muss eine nicht leere Maske besitzen; bewusst not_present markierte Teile erzeugen einen sichtbaren Unvollständigkeitsstatus. Extras bleiben optional.

2. Erzeuge ausgeschnittene PNGs mit Originalfarben/-alpha, Halb-offen-Rechtecken, bewusstem Padding und exakt den festen Dateinamen. Kein Renummerieren fehlender Extras. Zubehör liefert entweder 17_sword.png oder 17_belt_accessory.png.

3. Lege den Teileordner neben der Quelle unter deren Stammnamen an. Schütze bestehende fremde Ordner/Dateien. Führe nur selbst verwaltete Ausgabedateien mit passenden alten Hashes weiter.

4. Erzeuge sprite.parts.json mit Generation-ID, Quellhash/-größe, Teilen, Dateien, Hashes, Crop-Rechtecken, Pivot, Originalposition, Standard-Z und bewussten Auslassungen. Prüfe die Positionsformel durch unabhängige Tests.

5. Schreibe Quellsnapshot, Masken und cutout.project.json in denselben kanonischen Set-Kontext. Migriere den anfänglichen Recovery-Projektstand hierhin, ohne zwei konkurrierende Kopien als aktiv zu hinterlassen.

6. Verwende den gemeinsamen Transaktionswriter für die gesamte Generation. Bei Wiedererzeugen entferne abgewählte alte Extras nur nach Eigentums-/Hash-Prüfung. Eine bestehende sprite.scene.json wird nicht zurückgesetzt.

7. Ergänze Pixel-/Alpha-/Hash-Tests, Teilmasken-Überlappung, Generation-Abbruch, Datei-Konflikt und einen vollständigen Neuerzeugen-/Wiederöffnen-Test. Melde Erfolg erst nach validiertem Commit.

## Prüftor

- [ ] Alle 15 Standardnamen und optionalen Extras entsprechen dem Register.
- [ ] Einzel-PNGs enthalten ausschließlich Quellpixel mit korrekter Alpha und korrekten Crop-Metadaten.
- [ ] Ein abgebrochener Export hinterlässt kein als fertig ladbares Mischset.
- [ ] Nach Wiedererzeugen werden keine fremden Dateien oder vorhandenen Szenenänderungen gelöscht.
- [ ] Der Teileordner ist mit Manifest ohne Kenntnis des ursprünglichen absoluten Pfads nutzbar.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine generative Ergänzung fehlender Körperteile und keine Ausgabe leeren Platzhalter-PNGs als echte Teile.

## Abschluss

Erwartetes Ergebnis: Produktive Teilegenerierung, vollständiges Manifest, kanonische Schnittprojektablage und Dateisystem-/Pixeltests.

Zugeordnete Anforderungen: R-D05, R-D06, R-D09, R-C09, R-C10, R-C11, R-C13, R-C14, R-S06.

Lege den Bericht unter `docs/developer/acceptance/P40-png_teile_und_manifest.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
