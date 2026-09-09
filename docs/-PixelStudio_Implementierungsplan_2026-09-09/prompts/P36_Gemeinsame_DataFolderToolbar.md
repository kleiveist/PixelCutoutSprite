# P36 · Gemeinsame DataFolderToolbar und Dateinavigation

**Auftrag:** Eine tatsächlich gemeinsam genutzte lokale Datei-/Ordnernavigation für beide Bildmodule aufbauen.

**Voraussetzungen:** P35. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/shared/data-folder/ (neu)`, `src-tauri/src/workspace/ (P30)`, `frontend/src/cutout-studio/ (neu)`, `frontend/src/sprite-studio/ (neu)`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Implementiere den nativen begrenzten Verzeichnis-Lister mit stabiler Sortierung, Cursor/Seitenlimit, Dateityperkennung und keinen rekursiven Symlink-Verfolgungen. Ein unbekannter Dateityp wird nicht automatisch als ausführbarer Inhalt geöffnet.

2. Baue eine gemeinsame DataFolderToolbar mit Breadcrumb, Baum, Suche/Filter, Aktualisieren, Auswahl und definierter Aktivierung per Klick/Enter. Verwende sie in Cutout und Sprite statt zweier kopierter Implementierungen.

3. Lege Auswahl-Events für Bilddateien und erkannte Teileordner fest. Ein normaler Ordner expandiert; ein gültiger Manifestordner meldet eine Sprite-Set-Auswahl. Die eigentlichen Editorloader folgen in P38 bzw. P41.

4. Unterstütze Dateien- und optional View-Register über ein Erweiterungsinterface. Cutout benötigt Dateien; Sprite erhält den View-Slot. Editorzustand darf beim Registerwechsel nicht verloren gehen.

5. Führe technische Verzeichnisse standardmäßig nicht als Originalbildquellen auf. Thumbnails werden begrenzt und bei Bedarf geladen; ein großer Vault darf nicht durch einen unbegrenzten Vollscan aller Pixel blockieren.

6. Baue Responsive-Docking und Drawer-Verhalten. Führe Dateibaum-Tastatursteuerung, Fokus-Rückgabe und Auswahlstatus ein. Schließe Listener/Caches beim Vault-Wechsel.

7. Prüfe externe Neuanlage, Umbenennung, Löschung und eine explizite Refresh-Fallback-Aktion. Noch nicht fertig erzeugte Sets werden als in Arbeit bzw. ungültig erkannt, nicht halb geladen.

## Prüftor

- [ ] Beide Bildmodule verwenden denselben Komponenten-/Servicekern.
- [ ] Bild-/Ordnerklicks liefern korrekte, vaultgebundene Auswahlevents.
- [ ] Große Ordner werden begrenzt und reagieren weiter auf Eingaben.
- [ ] Dateibaum funktioniert mit Tastatur und als Drawer bei 720×450.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine Wiederverwendung des alten Area-Inventarmodells als versteckte Pflichtstruktur und keine unbeschränkten Dateisystemrechte.

## Abschluss

Erwartetes Ergebnis: Gemeinsame Datei-Toolbar, sichere Listing-API, Responsive-/Tastatur- und Dateiereignistests.

Zugeordnete Anforderungen: R-G04, R-D09, R-D10, R-C03, R-S02.

Lege den Bericht unter `docs/developer/acceptance/P36-gemeinsame_datafoldertoolbar.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
