# 06 · Auswahlhilfe, Schnitt und Sprite-Zusammensetzung

## Fachliches Ziel

Der Nutzer markiert einen Körperteil ungefähr. Die Software verkleinert die Auswahl anhand sichtbarer Bildinformation auf den gewünschten Vordergrund. Bereits bearbeitete Teile bleiben sichtbar, und dieselben Quellpixel dürfen mehreren Teilmasken angehören. Das ist wichtig für Anschlussbereiche, beispielsweise Hand plus ein Stück Unterarm.

Die Funktion ist **assistierte Bildsegmentierung**, keine pauschale semantische Erkennung sämtlicher Körperteile. Berühren sich gleichfarbige Flächen ohne erkennbaren Rand, ist die Grenze aus Farbe und Transparenz nicht eindeutig ableitbar. Dann benötigt der Nutzer Vordergrund-/Hintergrund-Markierungen oder eine manuelle Korrektur. OpenCV beschreibt vergleichbare Korrekturschritte für GrabCut; siehe T04. Die nachstehende konkrete Pipeline ist ein Zielentwurf, keine Aussage über schon vorhandene Funktionen.

## Feste Teilezuordnung

Links/rechts meint die anatomische Seite der dargestellten Figur, nicht die Bildschirmseite. Bei einer Vorderansicht kann die rechte Figurenseite links im Bild stehen. Dieser Hinweis muss im Editor erreichbar sein.

| Gruppe in der Werkzeugleiste | Unterteil | Part-ID | Ausgabedatei |
|---|---|---|---|
| Körper | Kopf | `head` | `01_head.png` |
| Körper | Torso | `torso` | `02_torso.png` |
| Körper | Becken | `pelvis` | `03_pelvis.png` |
| Linker Arm | Oberarm | `upper_arm_l` | `04_upper_arm_l.png` |
| Linker Arm | Unterarm | `forearm_l` | `05_forearm_l.png` |
| Linker Arm | Hand | `hand_l` | `06_hand_l.png` |
| Rechter Arm | Oberarm | `upper_arm_r` | `07_upper_arm_r.png` |
| Rechter Arm | Unterarm | `forearm_r` | `08_forearm_r.png` |
| Rechter Arm | Hand | `hand_r` | `09_hand_r.png` |
| Rechtes Bein | Oberschenkel | `thigh_r` | `10_thigh_r.png` |
| Rechtes Bein | Unterschenkel | `shin_r` | `11_shin_r.png` |
| Rechtes Bein | Fuß | `foot_r` | `12_foot_r.png` |
| Linkes Bein | Oberschenkel | `thigh_l` | `13_thigh_l.png` |
| Linkes Bein | Unterschenkel | `shin_l` | `14_shin_l.png` |
| Linkes Bein | Fuß | `foot_l` | `15_foot_l.png` |
| Extras | Cape | `cape` | `16_cape.png` |
| Extras | Zubehör: Gürtel oder Schwert | `belt_accessory` oder `sword` | `17_belt_accessory.png` oder `17_sword.png` |
| Extras | Haare | `hair` | `18_hair.png` |

Die Werkzeuggruppen stehen in der vom Nutzer gewünschten Reihenfolge: Körper, rechter Arm, linker Arm, rechtes Bein, linkes Bein, Extras. Die Dateinummerierung bleibt davon unabhängig exakt wie oben. Der Zubehörslot hat höchstens eine aktive Variante. Kein Renummerieren nach Weglassen optionaler Teile.

Die JSON-Version dieses Registers liegt in `vertraege/sprite-parts.catalog.json`. Dass 18 optionale Plätze möglich sind, ist die transparente Auflösung des Widerspruchs zwischen „drei Extras“ und der ursprünglich nur bis 17 reichenden Dateiliste.

## Eingabe, Bildraum und Leistungsgrenzen

Pflichtformat ist PNG einschließlich Alphakanal. JPEG und nicht animiertes WebP werden als zusätzliche geplante Eingabeformate kontrolliert unterstützt; dafür sind die derzeit PNG-beschränkten Decoderfeatures aus S18 zu erweitern und nativ zu testen. Animierte Dateien, SVG und beliebige Archive werden nicht als Bildquelle ausgeführt. JPEG-Orientierung wird vor der Koordinatenvergabe normalisiert.

Das Quelldokument arbeitet in unveränderter Originalauflösung. Die Ansicht kann verkleinert werden, die gespeicherten Masken bleiben in Quellpixeln. Für PNG wird die Quellalpha unverändert erhalten. JPEGs besitzen keine transparente Außenfläche; dort ist die Farb-/Kantenhilfe bzw. manuelle Auswahl besonders wichtig.

Anfangsgrenzen als überprüfbare Produktkonfiguration: maximal 16 Megapixel, maximal 8192 Pixel pro Kante und 64 MiB kodierte Eingabedatei; alle Grenzen gelten gleichzeitig. Kleinere Grenzen auf speicherarmen Systemen sind zulässig, müssen aber vor dem Laden sichtbar begründet werden. Masken nur für benötigte Teile halten, History als begrenzte Deltas/komprimierte Kacheln organisieren. Große RGBA-Bilder nicht wiederholt als Base64-Strings über mehrere React-Zustände kopieren.

P39 erfasst reale Laufzeit, Speicherbedarf und Abbruchlatenz auf einer dokumentierten Referenzmaschine. Keine nicht gemessenen Millisekunden-Versprechen. Fortschrittsanzeige und Cancel dürfen nicht durch einen synchronen Hauptthread-Job blockiert werden.

## Maskenmodell

Jede Maske ist unabhängig. Ein Pixel darf gleichzeitig in `hand_l` und `forearm_l` liegen. Ein globales exklusives Labelbild mit genau einer Part-ID pro Pixel ist deshalb ungeeignet.

Pro Teil werden Entwurfsmaske, bestätigte Maske, positive/negative Seeds, manuelle Korrekturen, optionaler Überlappungsbereich, Auswahlparameter und Revision gespeichert. Im Pixelmodus sind Masken binär. Die Ausgabe verwendet die originale Bildalpha innerhalb der Maske und Alpha 0 außerhalb. Graue Anzeige-Overlays sind keine Änderungen an den Originalfarben.

Zustände je Pflichtteil: `unmarked`, `editing`, `confirmed`, `not_present`. Optionalen Teilen ist zusätzlich `disabled` erlaubt. `not_present` ist eine bewusste Benutzerentscheidung für verdeckte/fehlende Bildteile; dadurch wird ein unvollständiges, aber eindeutig beschriebenes Set möglich. Ein leeres `confirmed` ist ungültig. Die Entscheidung wird im Manifest vermerkt und später nicht als Ladefehler fehlinterpretiert.

## Lokale Auswahlpipeline

### 1. Grobe Auswahl und eindeutiger Startpunkt

Rechteck oder geschlossenes Lasso definiert eine Region of Interest (ROI). Ein Klick bzw. kurzer positiver Strich im gewünschten Teil liefert einen Vordergrundseed. Wenn eine ROI genau eine eindeutige sichtbare Komponente enthält, darf die Software den Startpunkt selbst vorschlagen; mehrere Kandidaten werden nicht still vereinigt. Außerhalb der ROI wird nicht automatisch gesammelt.

### 2. Transparenz nutzen

Bei Bildern mit Alpha werden Pixel unterhalb eines einstellbaren Alpha-Schwellwerts als Hintergrund ausgeschlossen. Ein zusammenhängender Vordergrund im erlaubten Bereich liefert eine schnelle erste Kontur. Das kann transparente Außenränder exakt zurücknehmen, aber keinen vollständig zusammenhängenden Arm vom gleichfarbigen Torso semantisch unterscheiden.

### 3. Farbe und Kanten als Hilfe

Für undurchsichtige oder verbundene Flächen wird eine seeded Auswahl innerhalb der ROI berechnet. Eine umsetzbare Baseline ist eine deterministische, mehrquellige geodätische Regionenzuordnung: positive und negative Seeds, Distanz zu Seed-Farben in einem geeigneten Farbraum, Kantenkosten und Pfadlänge. Hohe Gradienten erschweren das Überschreiten sichtbarer Ränder. Negative Seeds sind harte Ausschlüsse. Grenzwerte und Gewichtungen werden über Fixtures abgestimmt, nicht als magische Konstanten versteckt.

Diese Baseline kann in Rust oder einem isolierten Worker implementiert werden. Vor Integration schwerer externer Bibliotheken wird sie gegen die vereinbarten Beispiele geprüft. GrabCut ist eine mögliche geprüfte Erweiterung, aber kein unbegründeter Pflicht-Download und kein Ersatz für den manuellen Modus. Die native Paketierbarkeit und Lizenzprüfung einer zusätzlichen Bibliothek wären Teil derselben Phase.

### 4. Korrigieren und bewusst überlappen

„Hinzufügen“ setzt Vordergrund, „Abziehen“ setzt Hintergrund. Ein eigener Überlappungsmodus markiert Anschlusszonen, die von späteren automatischen Verfeinerungen nicht wieder entfernt werden dürfen. Die Verfeinerung verändert nur die aktive Maske. Eine bestehende Nachbarmaske wird weder subtrahiert noch abgeschwächt.

Eine optionale Anschlusszugabe von wenigen Quellpixeln darf nur in einem ausgewählten Gelenkbereich entlang benachbarter sichtbarer Vordergrundpixel wachsen. Kein pauschales Dilatieren in Hintergrund oder fremde Körperteile. Der Nutzer sieht und korrigiert die tatsächliche Zugabe. Die Markierung einer Hand darf bewusst einen Teil des Arms enthalten, obwohl die reine automatische Handkontur kleiner wäre.

### 5. Bestätigen und Undo

Bestätigen erzeugt einen stabilen Maskensnapshot und Autosave. Undo/Redo betrifft die aktive Bearbeitung mit klaren Aktionen; ein Teilwechsel löscht keine History anderer Teile. Asynchrone Antworten tragen `sourceHash`, `partId`, `maskRevision`, `jobId`; veraltete Ergebnisse werden verworfen. Source-Hash-Änderungen stoppen die Weiterverwendung alter Masken, bis ein bewusstes Neuabgleichen erfolgt.

## Erzeugen der Einzelteile

Für jedes bestätigte Teil wird die Begrenzung seiner belegten Maske ermittelt. Gewünschtes transparentes Padding wird an den Bildgrenzen begrenzt und im `sourceRect` mitgeführt. Die Original-RGBA-Werte werden in den Ausschnitt kopiert; außerhalb der Maske ist Alpha 0. Es werden keine fehlenden Pixel erfunden und keine Gliedmaßen generativ ergänzt.

Die Quelldatei wird nicht verändert. PNGs, Quellsnapshot, Masken, `cutout.project.json` und `sprite.parts.json` werden als eine crash-sicher wiederherstellbare Generation geschrieben. Das Manifest enthält die tatsächlich erzeugten Teile und bewusste Auslassungen. Es werden keine leeren Dateien für nicht ausgewählte Extras angelegt.

Bei erneutem Erzeugen darf die App nur Dateien ihrer vorherigen, bestätigten Generation ersetzen oder gezielt entfernen. Aus der Manifest-Dateiliste verschwundene optionale Dateien werden nur dann entfernt, wenn ihr bisheriger Hash noch passt. Fremde PNGs oder manuell geänderte Dateien bleiben erhalten und verursachen gegebenenfalls einen Konflikt. Ein existierender fremder Ordner `Kleif/` wird nicht einfach übernommen; angeboten wird ein sicherer alternativer Stammname mit stabilem Suffix.

## Manifestgestützte Rekonstruktion

Ein Teileordner gilt als automatisch ladbar, wenn `sprite.parts.json` strukturell gültig ist, die Pfade im Ordner bleiben und alle laut Manifest vorhandenen Dateien samt Dimensionen/Hashes passen. Das Studio verwendet genau diese Liste, nicht ein unkontrolliertes `*.png`-Glob. So wird eine versehentlich liegen gebliebene alte Extra-Datei nicht wieder eingebaut.

Die Autoanordnung verwendet `defaultPosition` und `pivot`. Ein Startvorschlag für Z-Reihenfolge ist Cape hinten, dahinterliegende Gliedmaßen, Körper, vordere Gliedmaßen, Zubehör und Kopf/Haare. Die Ansicht und der Nutzer können eine andere Reihenfolge verlangen; daher bleibt View editierbar und die Standardreihenfolge steht explizit im Manifest.

Ohne Manifest kann ein Ordner mit den bekannten Namen als **Legacy-Teilesatz** erkannt werden. Dann sind Typzuordnung und Reihenfolge möglich, aber bei eng zugeschnittenen PNGs fehlen die ursprünglichen Offsets. Nur gleich große, unveränderte Vollbildteile können zuverlässig deckungsgleich übereinandergelegt werden. Sonst zeigt die App einen manuellen Ausrichtmodus und keine erfundene „korrekte“ Autoanordnung. Neu erzeugte Sets besitzen immer das Manifest.

## Transparente Überlappungen

Jede Einzel-PNG muss Quellfarben und Quellalpha erhalten. Bei normaler Source-over-Komposition können überlappende halbtransparente Randpixel in der Gesamtansicht deckender werden. Deshalb wird eine pixelidentische Rekonstruktion der gesamten Originalalpha nicht generell versprochen.

Die Abnahme prüft exakte Originalpositionen, pixelidentische Ausschnitte und korrekte Alpha pro Teil. Eine Gleichheit des Gesamtbilds wird für vollständig deckende, lückenlos abgedeckte Fixtures geprüft. Halbtransparente Überlappungen erhalten einen eigenen Test mit dem dokumentierten Source-over-Ergebnis. Ein späterer quellidentitätsbewusster Compositor wäre eine getrennte Erweiterung, nicht unbemerkt Teil dieses Umbaus.
