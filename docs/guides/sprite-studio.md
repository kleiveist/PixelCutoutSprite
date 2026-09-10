# Sprite-Sets zusammensetzen und bearbeiten

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: P42. Öffne einen Vault, wechsle zu **PixelSpriteStudio** und wähle im
Dateien-Register den gewünschten Teileordner. Ein gültiges `sprite.parts.json`
lädt genau die darin genannten PNGs an ihren ursprünglichen Positionen. Eine
vorhandene gespeicherte Szene hat Vorrang. Unbekannte oder defekte Dateien werden
nicht still durch Standardwerte ersetzt.

## View und Ebenen

Im Register **View** steht die vorderste Ebene oben. Die Liste zeigt Vorschaubild,
Name, Z-Wert, Sichtbarkeit und Sperre. Wähle eine Ebene in der Liste oder klicke
einen ihrer sichtbaren Pixel im Canvas. **Nach vorn / Nach hinten** funktioniert
auch per Tastatur. Alternativ verschiebt Drag-and-drop eine Ebene an die
Listenposition eines anderen Eintrags. Größere Z-Werte werden später gezeichnet.

Die Sperre verhindert direktes Verschieben, Transformieren und Umordnen dieser
Ebene. Sichtbarkeit und Sperre selbst bleiben bedienbar. Andere Ebenen können
weiter vor oder hinter der gesperrten Ebene angeordnet werden.

## Position, Pivot und freie Transformationen

Ziehen verschiebt eine entsperrte Ebene. Im fokussierten Canvas bewegen Pfeiltasten
sie um 1 Quellpixel, mit Umschalt um 10 Pixel. Mittlere Maustaste oder
Umschalt+Ziehen verschiebt ausschließlich die Ansicht. **Figur einpassen** und
die Zoom-Buttons ändern keine gespeicherten Koordinaten. Escape, Pointer-Abbruch
oder Fenster-Resize verwirft einen noch laufenden Verschiebezug.

Die Zahlenfelder bearbeiten Position und lokalen Pivot unabhängig vom Canvas-Zoom.
Pixel-Snap rundet Positionsänderungen auf ganze Pixel. **Freie Transformationen
aktivieren** erlaubt Bruchpixel, Rotation und Skalierung. Nearest-Neighbor bleibt
aktiv; die Skalierung ist auf 0,01–100 pro Achse begrenzt. Es gibt keine Timeline
oder Animation. Ein ungültiges Zahlenfeld muss korrigiert oder mit seinem
Zurücksetzen-Button verworfen werden; es blockiert Speichern und Modulwechsel.

Ein lokaler Pixel wird durch
`Position + Rotation × Skalierung × (Pixel − Pivot)` im Quellraum platziert.
Der Pivot ist der Dreh-/Skalierungsanker, nicht zwingend die Bildmitte.
Halbtransparente Überlappungen folgen Source-over und können dadurch deckender
werden als im ursprünglichen Gesamtbild.

## Speichern und Rückgängig

Änderungen werden nach 500 ms Ruhe automatisch im Vault gesichert. Der Status
**Szene gespeichert** erscheint erst nach erfolgreicher nativer Bestätigung.
**Szene jetzt sichern** fordert sofortiges Speichern an. Modul-/Vaultwechsel und
natives App-Schließen fordern ebenfalls einen Flush an. Bei Fehlern bleiben
lokale Änderungen erhalten und der Wechsel kann blockiert werden.

Die Dateien `sprite.scene.json` und `.scene/basis.json` liegen im Teileordner.
Der zweite, technische Beleg hält die bisherige Geometrie für einen späteren
Generationsabgleich fest. Beide Dateien werden gemeinsam mit Revisionen und
Hashprüfung veröffentlicht. Teile-PNGs, Originalbild und `sprite.parts.json`
werden durch Szenenbearbeitung nicht verändert. Keine Szene wird in App-Data
oder Browser-Storage gespeichert.

**Szene rückgängig / Szene wiederholen** und Strg/Cmd+Z bzw. Umschalt+Strg/Cmd+Z
im Canvas arbeiten mit bis zu 48 lokalen Szenenständen, begrenzt auf 1 MiB History.
Ein Verschiebezug ist ein Undo-Schritt. Nach App-Neustart beginnt die History neu;
die gespeicherte Szene bleibt erhalten.

**Originalanordnung wiederherstellen** verlangt eine Bestätigung und setzt
Positionen, Pivots, Rotation, Skalierung, Z, Sichtbarkeit und Sperren auf die
aktuellen Manifest-Defaults. Dies ist rückgängig machbar. Bloßes Öffnen oder
Wechseln zwischen Dateien/View führt diese Aktion nicht aus.

## Neue Teilegeneration und Konflikte

Nach erneutem Erzeugen im Cutout-Studio verwende **Teile erneut prüfen**. Diese
Prüfung funktioniert auch bei noch ungespeicherten Szenenänderungen. Der Abgleich
zeigt neue und entfernte Part-IDs sowie geänderte Ausschnitte. Bei identischer
Quelle wird eine Verschiebung des Crop-Ursprungs durch den lokalen Pivot
kompensiert; Position, Rotation, Skalierung und weitere Ebeneneinstellungen bleiben
erhalten. Entfernte Extras werden nicht aus übrig gebliebenen PNGs wieder eingebaut.

Bei anderer Quelle oder fehlendem alten Geometriebeleg sind keine passenden
anatomischen Offsets garantiert. Die Zahlenwerte werden erhalten und als zu
prüfen gekennzeichnet. Erst **Abgleich bestätigen und speichern** übernimmt die
neue Generation dauerhaft; dabei beginnt eine neue Undo-History. Abbrechen
schreibt keine Datei. Auch ein geänderter Manifest-Hash bei gleicher Generation-ID
wird erkannt, sofern ein passender Geometriebeleg existiert.

Extern geänderte Szenen verursachen einen Konflikt. Stelle bei Bedarf die
erwarteten Dateien wieder her und sichere erneut. Alternativ kann **Lokale
Änderungen verwerfen und Dateistand laden** nach einer zweiten ausdrücklichen
Bestätigung den externen Stand übernehmen. Dieser Vorgang löscht die lokale
Bearbeitung, überschreibt aber keine externe Datei. Bei unterbrochener
Mehrdatei-Speicherung zuerst die angebotene Recovery abschließen.

## Legacy und kleine Fenster

Bekannte Teilenamen ohne Manifest ergeben einen **manuellen Ausrichtmodus**.
Ihre Startpositionen sind keine behauptete Rekonstruktion. Auch dort ist
Szenenbearbeitung möglich; **Originalanordnung** bedeutet lediglich die manuellen
Startpositionen. Ein vorhandenes defektes Manifest wird nicht als Legacy umgangen.

In kleinen Fenstern öffnet **Dateien / View öffnen** die gemeinsame Seitenleiste
als Drawer. Alle Kernaktionen bleiben über beschriftete Buttons erreichbar.
Ein schreibgeschützter Vault erlaubt Ansicht und Auswahl, aber keine Bearbeitung
oder Bestätigung eines neuen Generationsabgleichs.
