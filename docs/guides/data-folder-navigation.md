# Dateien in Cutout und Sprite auswählen

Stand: P36, 2026-09-10. Beide Bildmodule verwenden dieselbe Dateinavigation im geöffneten
Vault. Dafür ist keine GitHub-Anmeldung nötig. Ohne native Desktop-App steht kein echtes
Dateisystem-Listing zur Verfügung.

## Ordner und Bilder

1. Einen Vault öffnen und zu **PixelCutoutSprite Studio** oder **PixelSpriteStudio** wechseln.
2. Links den Bereich **Dateien** verwenden. Bei schmalen Fenstern öffnet **Dateien öffnen**
   beziehungsweise **Dateien / View öffnen** einen Drawer.
3. Ein Ordnerklick klappt dessen direkte Inhalte auf. **Diesen Ordner durchsuchen** setzt den
   ausgewählten Ordner als neuen Ausgangspunkt. Die Pfadschaltflächen darüber führen zurück.
4. **Suchen** wendet den eingegebenen Namen auf das jeweilige Listing an. Es gibt keinen
   rekursiven Vollscan: Für eine Suche innerhalb eines Unterordners diesen zunächst als
   Ausgangspunkt öffnen. Der Filter bietet alle Dateien, Bilder mit Ordnern oder nur Ordner.
5. PNG, JPEG (`.jpg`/`.jpeg`) und WebP werden bei Klick oder Enter erneut auf Inhalt,
   Abmessungen und zwischenzeitliche Änderungen geprüft. Eine erfolgreiche Auswahl erscheint
   unter **Letzte geprüfte Bildauswahl**. Unbekannte Dateitypen werden nicht ausgeführt.

Diese Phase liefert die geprüfte Auswahl an das jeweilige Modul. Sie lädt noch kein Bild in
einen neuen Cutout-Editor und baut noch keine Sprite-Komposition auf. Die tatsächlichen
Editorloader folgen in P38 und P41; der Cutout-Umbau beginnt zuvor mit P37.

## Teileordner und View

Ein Ordner mit `sprite.parts.json` erscheint zunächst nur als **Teile-Set · beim Öffnen prüfen**.
Erst wenn Manifest, benannte PNG-Teile, Prüfsummen und Abmessungen zusammenpassen, entsteht eine
Set-Auswahl. Ein unfertiger Schreibvorgang oder ein defektes Set liefert eine Meldung; die letzte
gültige Auswahl bleibt erhalten. Absichtlich ausgelassene Pflichtteile sind nur mit expliziter
Dokumentation im Manifest zulässig und werden als unvollständiges Set gekennzeichnet.

Sprite bietet zusätzlich das Register **View**. In P36 zeigt es Informationen zum gewählten
Set, noch keine interaktive Komposition. Ein Wechsel zwischen Dateien und View setzt den
Editorzustand nicht zurück. Die letzte geprüfte Auswahl bleibt während dieser Vault-Sitzung
pro Modul erhalten; beim Vault-Wechsel wird sie verworfen.

## Aktualisieren und Grenzen

- Nach externem Kopieren, Umbenennen oder Löschen **Dateien aktualisieren** drücken. Auch beim
  Zurückkehren ins App-Fenster wird nach kurzer Verzögerung neu gelesen. Es gibt in P36 keinen
  dauernden Betriebssystem-Dateiwatcher.
- Vor Aktivierung und Refresh wird ausstehendes Speichern abgewartet. Bei einem Speicherfehler
  bleibt der bisherige Stand sichtbar. Ein ungültiger Seitencursor verlangt erneutes Einlesen.
- **Letzte geprüfte Auswahl** ist ein Beleg der letzten Prüfung, keine Zusage, dass eine extern
  geänderte Datei noch unverändert existiert. Zur erneuten Prüfung wieder auswählen.
- Ordner zeigen jeweils 50 Einträge; **Weiter** und **Zurück** wechseln die Seite. Bis zu zwölf
  Ordner können gleichzeitig aufgeklappt bleiben. Mehr als 20.000 direkte Einträge in einem
  Ordner führen zu einer erklärten Grenze; solche Sammlungen in Unterordner aufteilen.
- Technische Verzeichnisse wie `.source`, `.history`, `.git`, `node_modules` und `target` sind
  standardmäßig ausgeblendet. **Technische Ordner anzeigen** macht sie sichtbar, erlaubt aber
  keine Verwendung als Originalbildquelle. `.PixelPrompt` bleibt regulär sichtbar.
- Vorschauen entstehen nur bei Sichtbarkeit, sind klein und lassen sich abschalten. Bilder
  sind auf 16 MiB Dateigröße, 8.192 Pixel je Achse und 16.777.216 Pixel insgesamt begrenzt;
  zusätzlich gilt eine Grenze für dekodierten Speicher. Symlinks und unsichere Pfade werden
  nicht als Quellen verfolgt.
- Die Navigation liest Dateien; sie legt keine Arbeitsstände an und benennt, verschiebt oder
  löscht nichts. Laufende Autosaves gehören zur bestehenden Speicherwarteschlange.

## Tastatur

| Taste | Funktion |
| --- | --- |
| Tab / Umschalt+Tab | Zwischen Bedienelementen wechseln; der Baum hat einen gemeinsamen Tab-Einstieg. |
| Pfeil hoch / runter, Pos1 / Ende | Im sichtbaren Dateibaum navigieren. |
| Pfeil rechts | Ordner aufklappen, beim nächsten Drücken zum ersten Kind gehen. |
| Pfeil links | Ordner schließen oder zum übergeordneten Baumknoten gehen. |
| Enter / Leertaste | Fokussierten Eintrag auswählen und prüfen. |
| Pfeil links / rechts auf Register | Zwischen Dateien und View wechseln. |
| Escape im Drawer | Schließen; Fokus kehrt zur auslösenden Schaltfläche zurück. |

Auch das X und ein Klick auf den abgedunkelten Hintergrund schließen den Drawer. Bei kleinen
Fenstern scrollt dessen Inhalt; die Überschrift und die Schließen-Schaltfläche bleiben erreichbar.

Technische Nachweise und offene native Plattformprüfungen stehen im
[P36-Abnahmebericht](../developer/acceptance/P36-gemeinsame_datafoldertoolbar.md).

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->
