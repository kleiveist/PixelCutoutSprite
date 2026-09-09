# P42 · View-Ebenen, Transformationen und Szenen-Autosave

**Auftrag:** Die automatisch geladene Figur dauerhaft und nicht destruktiv zusammensetzen und umschichten.

**Voraussetzungen:** P41. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/04_DATENVERTRAEGE.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/06_SEGMENTIERUNG_UND_SPRITES.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/sprite-studio/`, `frontend/src/shared/data-folder/`, `frontend/src/shared/canvas/`, `src-tauri/src/sprite/`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Ergänze das View-Register mit Ebenenliste, Thumbnail, Sichtbarkeit, Sperre und Auswahl. Die vorderste Ebene steht oben, der größere Z-Wert wird später gezeichnet. Registerwechsel darf keine Szene neu initialisieren.

2. Implementiere Umordnen per Drag-and-drop und tastaturbedienbaren Nach-vorn-/Nach-hinten-Aktionen. Synchronisiere Auswahl zwischen Canvas und Ebenenliste und verhindere versehentliches Bewegen gesperrter Ebenen.

3. Füge Verschieben, Pivot, Rotation und Skalierung hinzu. Pixel-Snap, ganzzahlige Verschiebung und Nearest-Neighbor sind Standard; freie Transformationen werden bewusst aktiviert. Dokumentiere Transformation und Trefferprüfung unabhängig vom Canvas-Zoom.

4. Autosave schreibt sprite.scene.json über den gemeinsamen Revisions-/Transaktionsweg. PNGs und Teilemanifest bleiben unverändert. Ein Neustart lädt die letzte gültige Szene vorrangig vor Manifest-Defaults.

5. Implementiere Undo/Redo und eine bewusste Aktion Originalanordnung wiederherstellen. Diese Aktion setzt Default-Positionen/-Ebenen, ist rückgängig machbar und darf nicht durch bloßes Neuöffnen ausgelöst werden.

6. Bei neuer Teilegeneration gleiche stabile Part-IDs ab. Erhalte sinnvoll übertragbare Transformationen, zeige neue/fehlende Teile und geänderte Geometrie als überprüfbare Änderung. Kein stilles Zurücksetzen oder Wiedereinführen abgewählter Extras.

7. Teste Umordnen, Sichtbarkeit, Sperren, Transformationen, halbes Fenster, Szene-Neustart, Save-Konflikt und Ersatz eines Teilemanifests während geöffneter Szene.

## Prüftor

- [ ] View bestimmt sichtbar die tatsächliche Renderreihenfolge.
- [ ] Nach Neustart sind Positionen, Ebenen, Sichtbarkeit und Sperren erhalten.
- [ ] Szenenbearbeitung verändert die originalen Teile-PNGs nicht.
- [ ] Eine neue Cutout-Generation setzt die bearbeitete Szene nicht unbemerkt zurück.
- [ ] Alle zentralen View-Aktionen sind ohne Drag-and-drop per Tastatur erreichbar.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Kein Wiederaufbau der abgeschafften Animationsbasis und kein Speichern von Szenen in App-Data.

## Abschluss

Erwartetes Ergebnis: Vollständiger Kompositionseditor mit View, Transformationen, Szenenpersistenz und Reconcile-Tests.

Zugeordnete Anforderungen: R-G06, R-D02, R-S02, R-S04, R-S05, R-S07.

Lege den Bericht unter `docs/developer/acceptance/P42-view_ebenen_szenen_autosave.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
