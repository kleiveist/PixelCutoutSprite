# Cutout-Studio: Bildauswahl und manuelle Masken

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: P43 · 10. September 2026.

1. Wähle im Header **PixelCutoutSprite**.
2. Klicke auf **Choose vault** oder auf einen zuletzt verwendeten Vault. Ein leerer Ordner
   kann initialisiert werden; ein nicht leerer fremder Ordner benötigt eine zusätzliche
   ausdrückliche Bestätigung. Vorhandene Dateien bleiben erhalten.
3. Öffne **Dateien**. Im großen Fenster ist die gemeinsame Dateinavigation angedockt,
   im kleinen Fenster öffnet **Dateien öffnen** einen Drawer.
4. Navigiere per Klick oder Pfeiltasten. Wähle ein PNG-, JPEG- oder WebP-Originalbild
   per Klick oder Enter. Das Bild öffnet den Maskeneditor in Originalauflösung.
5. Die Auswahl bleibt bei einem Wechsel zu Prompt oder Sprite erhalten. Beim Vault-Wechsel
   wird sie zurückgesetzt, damit keine Auswahl aus einem anderen Vault weiterverwendet wird.

## Körperteile markieren

Wähle eine der sechs Körperteilgruppen und anschließend einen der drei Untereinträge.
Links/rechts meint die anatomische Seite der Figur. Ziehe ein Rechteck oder Lasso;
ergänze mit **Pinsel +**, entferne mit **Pinsel −**. Einpassen, Zoom und Verschieben
ändern nur die Ansicht. Alternativ lässt sich ein Rechteck über X/Y/Breite/Höhe in
Quellpixeln eingeben.

**Auswahl bestätigen** speichert die aktuelle Auswahl als bestätigte Maske. Jeder
Teil behält seine eigene Maske: Eine Hand darf bewusst in den Unterarm hineinragen.
Der aktive Entwurf ist violett, die letzte Bestätigung blasser blau. **Rückgängig**
und **Wiederholen** gelten für den aktiven Teil. Escape verwirft einen laufenden Strich.
Ein Fenstergrößenwechsel verwirft ebenfalls nur den noch laufenden Strich, nicht vorhandene Masken.
Für einen nicht sichtbaren Pflichtteil ist eine Begründung erforderlich; Extras
können deaktiviert werden.

Entwürfe, Bestätigungen und aktiver Teil werden automatisch im geöffneten Vault
gespeichert und beim erneuten Auswählen des Bildes geladen. Die Statuszeile im Editor
meldet den Speicherstand. Originaldateien bleiben unverändert. Animierte Bilder,
mehr als 16 Megapixel, mehr als 8192 px je Achse oder über 16 MiB große Quelldateien/
normalisierte PNGs werden mit einer Fehlermeldung abgewiesen.

## Auswahl lokal verfeinern

Markiere zunächst einen ungefähren Bereich mit Rechteck oder Lasso. **Auswahl verfeinern**
entfernt transparenten Hintergrund. Bei mehreren Inseln oder schwierigen inneren
Grenzen setze grüne positive und rote negative Pinselmarkierungen. Farbtoleranz,
Alpha-Schwelle und Kantengewicht lassen sich pro Teil einstellen.

**Überlappung schützen** markiert Anschlussbereiche goldfarben. Diese bewusst
ergänzten sichtbaren Pixel bleiben bei erneuter Automatik erhalten, auch außerhalb
der ROI. Negative Markierungen entfernen sie wieder. Die Automatik ist eine Hilfe,
keine sichere anatomische Erkennung: Ergebnis und Hinweise prüfen, bei Bedarf manuell
korrigieren und erst dann bestätigen. Parameter, Seeds und Schutzbereiche werden gespeichert.

Während der Berechnung bleibt die Ansicht bedienbar. **Auswahlhilfe abbrechen** beendet
den Auftrag ohne Maskenänderung. Eine Handkorrektur oder ein Teil-/Modulwechsel macht
alte Ergebnisse ebenfalls ungültig. Die Berechnung erfolgt lokal ohne Upload oder Modelldownload.

## PNG-Teile erzeugen

Schließe alle 15 Pflichtteile ab: bestätigen oder mit Begründung als nicht vorhanden
markieren. Extras sind optional; angefangene Extras bitte bestätigen oder deaktivieren.
Der Zubehörslot bietet Gürtel/Zubehör oder Schwert; die vorhandene Slot-Maske bleibt
beim Variantenwechsel erhalten. Fehlende Extras führen nicht zu neuen Dateinummern.

Stelle das transparente Padding bewusst ein (0–64 Quellpixel, Standard 0).
**Ausgabe prüfen** zeigt das Ziel neben dem Originalbild. Ein fremder gleichnamiger
Ordner bleibt erhalten; gegebenenfalls wird ein alternativer Name angeboten.
**PNG-Teile jetzt erzeugen** bestätigt den angezeigten Ordner. Erfolg erscheint erst,
wenn PNGs, Snapshot, Masken, Schnittprojekt und Manifest vollständig geprüft sind.
Bewusste Auslassungen bleiben als „unvollständig“ sichtbar; es gibt keine Leer-PNGs.

Aktualisiere anschließend die Dateiliste. Der Teileordner enthält das kanonische
Schnittprojekt und lässt sich im Cutout-Studio wieder öffnen. Auch eine erneute
Originalauswahl findet über den Recovery-Verweis denselben Stand. Beim Wiedererzeugen
werden nur unveränderte eigene Ausgaben ersetzt/entfernt. Fremde Dateien und eine
vorhandene Szene bleiben erhalten; Hashkonflikte müssen zuerst geklärt werden.
Nach einem Ausgabeabbruch den Vault erneut öffnen, damit die Dateisatz-Recovery läuft.

Originalfarben und Alpha pro PNG bleiben unverändert. Überlappende halbtransparente
Teile können bei späterer Source-over-Zusammensetzung deckender wirken. Im
[Sprite-Editor](sprite-studio.md) lädt der Teileordner die ursprüngliche Anordnung automatisch.
Es gibt keine versteckten alten Editorseiten und keinen bisherigen
NPC-/Godot-Export mehr.

## Bestehende Vaults

Frühere Projekt-, Area-, Motion-, NPC-, Export-, Quellen- und Backup-Dateien bleiben
an ihrem Ort. Sie werden nicht automatisch umgeschrieben oder in einen Papierkorb verschoben.
Normale Bilder sind über die Dateinavigation zugänglich. **Technische Ordner anzeigen**
macht ausgeblendete Altordner sichtbar, hebt aber die P36-Quellensperre für geschützte
technische Pfade wie `.source` nicht auf. Die App kopiert solche Quellen nicht automatisch.

Beim ersten Öffnen darf Studio seine neuen `.PixelStudio/`- und `.PixelPrompt/`-Metadaten
und den persistenten OS-Lock-Guard anlegen. Das ist keine Migration alter Projektinhalte.
Unterbrochene alte Transaktionsjournale führen weiterhin in den exklusiven Recovery-Dialog.
Resume/Rollback werden nur nach ausdrücklicher Auswahl ausgeführt.

Ist bereits ein Writer aktiv, bleibt der zweite Zugriff schreibgeschützt.
Eine aktive Sperre nicht löschen. Orphan-Recovery verlangt eine überprüfte Bestätigung.
Fehlgeschlagenes Speichern blockiert den Studio-/Vault-Wechsel. **Vault schließen**
sichert ausstehende Arbeiten und gibt die Sitzung frei.

## Fehlende oder extern veränderte Quelle

Eine veränderte Originaldatei wird nicht still mit alten Masken kombiniert. Bei einem
Speicherfehler bleibt der geladene Arbeitsstand erhalten. **Mit gespeichertem Snapshot
weiterarbeiten …** bietet eine ausdrückliche Fortsetzung mit dem geprüften Snapshot an.
Erst die Bestätigung löst die Originalverknüpfung und speichert auch ausstehende Masken.
Ein beschädigter Snapshot oder ein Projektkonflikt wird dadurch nicht umgangen.

Ein vorhandener Teileordner bleibt das Ziel. Vor der allerersten Teileerzeugung wird ohne
Originalverknüpfung ein freier Ordner mit der Schnittprojekt-ID direkt im Vault angeboten.
Die Originaldatei wird weder wiederhergestellt noch ersetzt. Neue Originalpixel müssen als
neue Quelle bearbeitet werden. Kopiere portable Sets immer einschließlich `.source`, `.masks`,
`cutout.project.json` und `sprite.parts.json`, nicht nur einzelne PNGs.

[Prompt-Anleitung](prompt-generator.md) ·
[P40-Abnahme](../developer/acceptance/P40-png_teile_und_manifest.md)
