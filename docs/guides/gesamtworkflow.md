# Vom neuen Vault zur gespeicherten Sprite-Szene

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: P43 · lokale Desktop-App. Ein Prompt erzeugt Text, kein Bild. Lege das gewünschte
PNG/JPEG/WebP selbst im Vault ab; die App lädt keine Cloudmodelle und sendet keine Bilder hoch.

1. Öffne **PixelCutoutSprite**, dann **Choose vault**. Wähle im Systemdialog einen lokalen
   Ordner. Ein leerer Ordner wird initialisiert; für einen nicht leeren fremden Ordner muss
   die zusätzliche Initialisierung ausdrücklich bestätigt werden. Vorhandene Dateien bleiben erhalten.
2. Wechsle zu **PixelPromptStudio → Profile → Basisprofil anlegen**. Prüfe Name, Raster,
   Perspektive, Palette und Sperren. **Basisprofil speichern** setzt die einzige Vault-Basis.
   X, Escape und Außenklick schließen ohne Speichern.
3. Öffne **Wizard**. Gib oben einen Namen ein, wähle Kategorie und Untertyp und bearbeite die
   einzelnen Katalogseiten mit **Weiter** und **Zurück**. Unvollständige Angaben werden als
   Entwurf gesichert. Erst der abgeschlossene Review ergibt aktuelle Ausgabedateien.
4. Unter **Ausgabe** sind die Stil-/Sprachvarianten sichtbar. Profil-JSON und Markdown entstehen
   automatisch unter `.PixelPrompt/Typ/Untertyp/Name/`. Die Schaltflächen zum Dateimanager
   zeigen bereits gespeicherte Dateien; sie exportieren keine zweite Datenkopie.
5. Im **Dashboard** öffnet eine Kategorie die Profilliste. **… laden** stellt Antworten,
   Kategorie und Wizard-Seite wieder her, nicht lediglich den fertigen Prompttext.
6. Wähle in **PixelCutoutSprite → Dateien** dein Originalbild. Markiere Körperteile mit
   Rechteck, Lasso oder Pinsel; alternativ gib Quellpixelkoordinaten ein. Jeder Teil hat seine
   eigene Maske. Anschlussbereiche dürfen sich überlappen. **Auswahl verfeinern** ist eine
   lokale, korrigierbare Hilfe, keine automatische anatomische Erkennung.
7. Bestätige alle 15 Pflichtteile oder begründe ausdrücklich „nicht vorhanden“. Extras sind
   optional. **Ausgabe prüfen** zeigt den freien oder bereits selbst verwalteten Teileordner.
   **PNG-Teile jetzt erzeugen** veröffentlicht und prüft PNGs, Masken, Snapshot und Manifest.
8. Aktualisiere die Dateiliste in **PixelSpriteStudio** und wähle den Teileordner. Das Manifest
   liefert die Originalanordnung. **View** zeigt Ebenen, Sichtbarkeit und Sperren. Verschiebe
   Ebenen, ändere Position/Pivot und bei ausgeschaltetem Pixel-Snap auch Drehung/Skalierung.
   PNGs bleiben unverändert; gespeichert wird `sprite.scene.json` im Set.
9. Prüfe die Speicheranzeige und schließe das Fenster. Native Close-Anfragen warten auf den
   gemeinsamen Flush. Nach dem Neustart den Vault und dasselbe Set auswählen: gespeicherte
   Szene, Reihenfolge, Sperren und Transformationen werden wieder geladen.

## Fehler sind keine Speicherbestätigung

Bei Schreibschutz, extern geänderten Dateien oder fehlendem Speicherplatz bleibt die letzte
gültige Ansicht erhalten. Solange ein Dirty-Stand nicht gesichert werden kann, werden Modul- und
Vault-Wechsel sowie Fenster-Schließen angehalten. Nicht durch Löschen einer aktiven Writer-Sperre
erzwingen. Sichere gegebenenfalls zuerst eine vollständige Vault-Kopie außerhalb der laufenden App.

Eine neue Teilegeneration benötigt im Sprite-Editor einen ausdrücklichen Abgleich. Vorhandene
Transformationen werden nach stabilen Teil-IDs zugeordnet; Geometrie- und Quellenänderungen
bleiben sichtbar. Ohne Manifest kann die App aus Dateinamen keine alten Ausschnittpositionen
erraten. Sie bietet stattdessen manuelles Ausrichten an.

Fehlt die Originaldatei, nutze bei einem bereits geladenen Cutout bzw. geöffneten Set die
ausdrückliche [Snapshot-Fortsetzung](cutout-willkommen.md#fehlende-oder-extern-veränderte-quelle).
Ein noch nicht erzeugtes, nur im Recovery-Bereich vorhandenes Projekt ist nach Neustart über
die unveränderte Originaldatei erreichbar; fehlt auch diese, zunächst die Originaldatei am
alten relativen Pfad wiederherstellen. Recovery-Dateien nicht blind löschen.

## Tastatur und kleine Fenster

Tab/Umschalt+Tab navigieren, Enter aktiviert; Escape schließt Dialoge bzw. verwirft einen
laufenden Strich oder Drag. Im Dateibaum funktionieren Pfeiltasten. Ein numerisches Rechteck
ersetzt das freie Zeichnen. Sprite-Ebenen können per Vor/Zurück-Tasten umgeordnet werden;
Pfeiltasten verschieben die gewählte ungesperrte Ebene, Umschalt vergrößert den Schritt.
Strg/Cmd+Z macht Änderungen rückgängig. Ungültige Zahlen zuerst korrigieren.

Die native Oberfläche lässt sich mit **Strg/Cmd und +/−** vergrößern/verkleinern;
**Strg/Cmd+0** stellt 100 % wieder her. Unter Linux/macOS sind fünf Plus-Schritte
200 %. Dieser Oberflächenzoom ist vom Quellbildzoom im Masken-/Sprite-Canvas getrennt.

Ab 480×360 bleibt die App über Scrollbereiche und **Dateien öffnen** bedienbar. Verkleinern
während eines Maskenstrichs oder Sprite-Drags verwirft die unvollendete Geste. Es verändert
keine gespeicherten Quellpixel. Vollständige Übersetzung aller älteren Vault-/Hilfetexte ist
nicht zugesichert; einzelne Schaltflächen bleiben englisch beschriftet.

[Cutout im Detail](cutout-willkommen.md) · [Sprite im Detail](sprite-studio.md) ·
[Speicherlayout](../developer/storage/vault-storage.md) ·
[Prüfergebnisse und offene Grenzen](../developer/acceptance/P43-gesamtabnahme_haertung_dokumentation.md)
