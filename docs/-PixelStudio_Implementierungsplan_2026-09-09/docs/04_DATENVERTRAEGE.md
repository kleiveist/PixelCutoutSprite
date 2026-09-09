# 04 · Datenverträge und Dateistruktur

## Normative Ordnerstruktur

```text
VaultProjekt1/
├── .PixelStudio/
│   ├── vault.json
│   ├── transactions/          # unterbrochene Mehrdatei-Operationen
│   ├── recovery/              # ausschließlich lokale Rettungskopien
│   └── migration/             # bestätigte Legacy-Übernahme und Nachweis
├── .PixelPrompt/
│   ├── basisprofil.json       # genau ein aktives Basisprofil
│   ├── .drafts/               # noch unbenannte/unvollständige Entwürfe
│   ├── Charakter/
│   │   └── Held/
│   │       └── Kleif/
│   │           ├── Kleif-classic-de-main.md
│   │           ├── Kleif-classic-de-negative.md
│   │           ├── Kleif-classic-de-technical.md
│   │           ├── Kleif-classic-de-combined.md
│   │           └── Kleif-profile.json
│   └── Natur/
│       └── Baum/
│           └── AlteEiche/
│               └── ...
└── Bilder/
    ├── Kleif.png              # Original bleibt unverändert
    └── Kleif/                # Ausgabeordner = Stammname der Quelldatei
        ├── 01_head.png
        ├── ...
        ├── 15_foot_l.png
        ├── 16_cape.png        # optional
        ├── 17_belt_accessory.png # alternativ 17_sword.png
        ├── 18_hair.png        # optional
        ├── sprite.parts.json
        ├── cutout.project.json
        ├── sprite.scene.json  # entsteht beim Arbeiten im SpriteStudio
        ├── .masks/
        └── .source/original.png
```

`.PixelStudio` ist eine neu vorgeschlagene, modulübergreifende Metadatenablage. Sie enthält keine zweite Profilbibliothek. `.source/original.png` ist eine normalisierte, unveränderte Arbeitskopie in Originalauflösung; die eigentliche Benutzerdatei wird nicht überschrieben. Damit kann der gesamte Teileordner später auch ohne den ursprünglichen Bildpfad wieder bearbeitet werden. Für eine reine Zusammensetzung reichen Manifest und Teile-PNGs; ein fehlender Quellsnapshot blockiert nur die erneute Segmentierung.

Neue Schnittprojekte werden zunächst unter `.PixelStudio/recovery/cutout/<projectId>/` autosaved. Beim ersten erfolgreichen Erzeugen wird der kanonische Projektstand mit Masken und Quellsnapshot in den Teileordner überführt. Danach ist `cutout.project.json` dort die Quelle der Wahrheit. Ein Recovery-Eintrag ist dann nur ein Journal, kein konkurrierendes Projekt.

## Was ist maßgeblich?

`basisprofil.json` bestimmt die einzige gültige Vault-Basis. `<Name>-profile.json` enthält den vollständigen Wizard-Zustand, nicht nur den fertig formulierten Prompt. MD-Dateien sind abgeleitete, aber dauerhaft sichtbare Ausgaben. `cutout.project.json` und seine Masken beschreiben die Schnittarbeit. `sprite.parts.json` beschreibt genau eine erfolgreich erzeugte Teilegeneration. `sprite.scene.json` enthält ausschließlich die Zusammenstellung/Ebenen-Änderungen des Studios und verändert die Teile-PNGs nicht.

Ein Index ist optional und wiederaufbaubar. Beim Öffnen des Vaults muss ein Scan ohne vorhandenen Index alle Profile finden können. Ein Ordner mit bekanntem Namen ist nicht allein deshalb ein gültiges Profil: JSON-Schema, IDs und Dateibeziehungen müssen passen.

## Versionierung

Neue Prompt-Dokumente verwenden `schemaVersion: 3` und eindeutige `kind`-Werte. Die neue Workspace-, Schnitt- und Szenenfamilie beginnt jeweils mit `schemaVersion: 1`; Versionszahlen verschiedener Dokumentfamilien werden nicht miteinander verglichen. Alte V1-/V2-Formate werden ausschließlich über explizite Adapter eingelesen. Unbekannte neuere Versionen werden nicht mit leeren Standardwerten überschrieben.

Die beigefügten JSON-Schemas validieren neue Dateihüllen und zentrale strukturelle Felder. Kategorieantworten benötigen zusätzlich die vorhandenen bzw. angepassten Zod-/Rust-Fachvalidatoren. Bei `status=ready` ist diese tiefe Validierung zwingend. Die Beispiele sind keine erschöpfenden fachlichen Testfixtures.

## Basisprofil

Es gibt genau einen festen Dateipfad und eine stabile Basisprofil-ID. Änderungen erhöhen `revision`, erzeugen aber kein zweites wählbares Basisprofil. Gespeichert werden die bisherigen fachlichen Werte aus `BaseProfileValuesSchema` einschließlich bestehender optionaler Werte; die Zusammenfassung im Button zeigt beispielsweise Stil, Pixeldichte, Tilegröße und Perspektive.

Das Setzen einer Basis ist ein bewusstes Speichern im Popup. Änderungen an dieser einzigen Basis machen bisherige Ausgaben mit älterer Basisrevision erkennbar veraltet. Eine vaultgebundene Warteschlange berechnet alle betroffenen, vollständig validen Profile automatisch neu. Ein Profil bleibt bis zum erfolgreichen Commit als veraltet markiert. Unvollständige Entwürfe werden nicht fälschlich als fertig ausgegeben. Die UI zeigt den Gesamtfortschritt und einzelne Fehler; App-Neustart setzt die Arbeit aus den gespeicherten Revisionen fort.

Historische Werte in Migrations-Backups sind keine zusätzlichen aktiven Basisprofile. Neue Wizard-Eingaben dürfen keine zweite Basis oder versteckte Basis-Overrides erzeugen.

## Prompt-Profil und Ausgabe

Ein Profil enthält mindestens stabile ID, Revision, Draft-Revision, Anzeigename, tatsächlichen Ordnernamen, Typ-ID, Untertyp-ID, Basisprofil-ID, Katalogversion, Antworten, Validierungsstatus, aktuelle Schritt-ID, bearbeitete Schritte, Ausgabekonfiguration und Ausgabemetadaten. Zeitstempel stehen in UTC. Absolute Vault-Pfade gehören nicht in das Dokument.

Pro vorhandener Generator-Stil-/Sprachkombination werden die vier Ausgabeteile `main`, `negative`, `technical`, `combined` geschrieben:

`<Dateiname>-<Stil>-<Sprache>-<Ausgabeteil>.md`

Das Beispiel `classic-de` ist kein Anlass, andere bisher unterstützte Ausgabevarianten zu entfernen. `styleProfile=both` muss beide tatsächlich unterstützten Stilvarianten berücksichtigen. Ein zentrales Generator-Register bestimmt erlaubte Kombinationen. `combined` wird aus denselben Ausgabebausteinen erzeugt, nicht durch einen zweiten, abweichenden Generator.

`outputs.generatedFrom` speichert Draft-Revision, Basisrevision und Generatorversion. Die Dateiliste enthält Pfad, Variante und SHA-256. Die Anzeige „Gespeichert“ folgt erst auf ein bestätigtes Commit dieser Generation. UI und MD müssen aus demselben unveränderlichen Generierungssnapshot stammen.

## Autosave ohne Export- oder Kopierpflicht

Nach Änderungen wird ein Entwurf mit vorgeschlagenen 400 ms Debounce dauerhaft im Vault gesichert; auf Schrittwechsel, Profilwechsel, Modulwechsel und App-Schließen wird ein Flush angefordert. Der Wert ist ein zu prüfender UX-Startwert, keine gemessene Leistungszusage.

Vor einem gültigen Namen/Typ/Untertyp wird unter `.PixelPrompt/.drafts/<draftId>.json` gespeichert. Der erste gültige Identitätssatz reserviert den Zielordner und übernimmt den Entwurf transaktional. Bei später temporär ungültigen Namenseingaben bleibt der zuletzt gültige kanonische Pfad bestehen; der Rohzustand wird separat im lokalen Draft-Journal gesichert. Kein Verzeichnis `undefined`, kein leerer Name und kein unbeabsichtigtes Umbenennen bei jedem Tastendruck.

Unvollständige Antworten sind speicherbar, vollständige Ausgabe ist davon getrennt. Der letzte erfolgreiche Ausgabesatz bleibt bestehen und wird als veraltet markiert. Sobald die Eingaben wieder valide sind, erfolgt die Neugenerierung automatisch. Es gibt keine Export-, Kopier-, Download- oder JSON-Export-Schaltflächen im produktiven Prompt-Ablauf.

## Dateinamen und Konflikte

Die neun Typen besitzen feste Ordnersegmente, zum Beispiel UI „Charakter / Figur“ → `Charakter`. Der Slash aus einer UI-Bezeichnung darf kein zusätzliches Pfadsegment erzeugen. Anzeigename und Dateisystemsegment sind getrennte Felder. Unicode wird nach NFC normalisiert; Umlaute dürfen erhalten bleiben. Verbotene Zeichen, Windows-Gerätenamen, abschließende Leerzeichen/Punkte und Längenbegrenzungen werden plattformübergreifend geprüft.

Gleiche Anzeigenamen dürfen nicht zu stillen Überschreibungen führen. Bei einer echten Neuanlage mit kollidierendem Pfad wird ein kurzer stabiler ID-Suffix vorgeschlagen und im tatsächlichen `folderName` gespeichert. `Kleif` bleibt ohne Kollision exakt `Kleif`. Vergleiche müssen auch auf case-insensitiven Dateisystemen sicher sein. Profil-ID, nicht Dateipfad, ist Identität.

Eine Änderung von Name, Typ oder Untertyp wird beim bestätigten Identitätswechsel bzw. Verlassen des Feldes übernommen: Quelle flushen, Ziel prüfen, neue Dateinamen/Hashes vorbereiten, Transaktion durchführen und UI aktualisieren. Fremde Dateien werden nicht gelöscht. Ein externer Rename wird über Scan und IDs erkannt; doppelte IDs in zwei Ordnern erzeugen einen Konflikt statt zufälliger Auswahl.

## Mehrdatei-Transaktion und Recovery

Einzeldatei-Rename ist nicht gleich atomare Veröffentlichung eines ganzen Profils. Verwendet wird ein Journal mit `prepared`, `publishing`, `committed`, erwarteten alten Hashes und neuer Generation. Dateien werden auf demselben Dateisystem vorbereitet, begrenzt gelesen und validiert. Anwendungsinterne Leser sehen erst eine vollständig bestätigte Generation; fehlende oder abweichende Hashes führen zu Recovery statt zu einer gemischten Ansicht.

Das Journal wird vor Veröffentlichung dauerhaft geschrieben. Alte Dateien bleiben bis zur gesicherten neuen Generation wiederherstellbar. Vor jedem Ersatz werden Eigentum und ursprünglicher Hash geprüft. Die Manifest-/Profildatei wird als Commit-Bezug zuletzt publiziert. Nach einem Absturz erfolgt anhand des Journals kontrolliertes Fertigstellen oder Rückrollen. Ein externer Dateimanager kann während der einzelnen Renames kurz einen Zwischenstand sehen; dafür wird keine Betriebssystem-weite Atomizität behauptet.

Bei Stromverlust, vollem Datenträger, Rechteentzug, externer Änderung, anderem Mount oder gesperrter Datei darf kein positiver Speicherstatus entstehen. Änderungen fremder Programme werden als Konflikt gemeldet; automatisch generierte MDs werden dann ebenfalls nicht blind überschrieben. Ein zweiter App-Prozess erhält höchstens einen Read-only-Vault, bis der Writer-Lock frei ist.

## Teilemanifest und Szenenvertrag

Jeder erzeugte Teil referenziert `partId`, festen Dateinamen, SHA-256, `sourceRect`, `pivot`, `defaultPosition` und `defaultZ`. Koordinaten sind Pixel im normalisierten Quellbild mit Ursprung links oben. Rechtecke sind halb offen: `[x,x+width) × [y,y+height)`. Die PNG-Größe entspricht exakt `sourceRect.width/height`; transparentes Padding ist darin enthalten.

`pivot` liegt im lokalen Ausschnitt, `defaultPosition` bezeichnet denselben Punkt im Quellraum. Deshalb gilt in Originalanordnung: `defaultPosition = (sourceRect.x, sourceRect.y) + pivot`. Bei Rotation 0 und Skalierung 1 wird ein Teil dadurch wieder exakt an seinem ursprünglichen Ort platziert. Parent-Verknüpfungen sind Metadaten, keine Einführung eines Animationssystems.

Das Szenenmodell speichert pro Teil Position, Pivot, Rotation, Skalierung, Sichtbarkeit, Sperre und Z-Wert sowie die referenzierte Teilegeneration. Kleinere Z-Werte liegen hinten. Die UI listet die vorderste Ebene oben. Dateinummern sind IDs/Sortierhilfe, nicht automatisch die richtige Zeichenreihenfolge.

Neue Schnittgenerationen dürfen eine angepasste Szene nicht still zurücksetzen. Das Studio erkennt eine neue Generation, bietet eine geprüfte Übernahme nach stabilen `partId`s an und erhält vorhandene benutzerdefinierte Transformationen soweit geometrisch sinnvoll. Fehlende Teile werden als Konflikt angezeigt. Erst ein bewusstes „Originalanordnung wiederherstellen“ setzt Platzierung und Ebenen auf Manifestwerte zurück.
