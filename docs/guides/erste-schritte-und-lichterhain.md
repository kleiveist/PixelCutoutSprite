<!-- PYGINDEX:NAVIGATION START -->
[Zur Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# 🌲 Erste Schritte und Beispiel-Vault „Lichterhain“

**Stand:** 6. September 2026

**App-Version:** 0.1.0

**Vault-Vertrag:** JSON/PNG v1

**Geprüftes Exportziel:** Godot 4.7.2

Diese Anleitung führt von einem leeren lokalen Ordner bis zu einem vollständigen NPC-Export.
Am schnellsten lässt sich der gesamte Ablauf mit der von der App erzeugten Beispiel-Vault
„Lichterhain“ nachvollziehen. Die Bedienoberfläche ist derzeit englisch; deshalb stehen die
anklickbaren Beschriftungen in dieser Anleitung in Anführungszeichen.

## Was die App ist

PixelCutoutSprite Studio ist eine native, offline nutzbare Tauri-Desktop-App. Sie verwaltet
humanoide Cutout-Sprites, gemeinsame Bewegungen, NPC-Ausstattungen und deterministische Exporte
als normale JSON- und PNG-Dateien in einem vom Nutzer ausgewählten Ordner, der **Vault**.

Godot ist ausschließlich ein Exportziel. Zum Erstellen, Öffnen und Exportieren einer Vault sind
weder Godot noch Python, Node.js, Rust oder Entwicklerwerkzeuge erforderlich. Eine
Internetverbindung, Anmeldung oder Cloud-Synchronisierung gibt es nicht.

## Schnellstart mit „Lichterhain“

1. Starte die installierte App.
2. Wähle auf der Startseite **„Create Lichterhain example“**.
3. Wähle im nativen Ordnerdialog einen vorhandenen, vollständig leeren lokalen Ordner. Der
   Ordner darf keine Datei, kein Unterverzeichnis und kein symbolischer Link sein. Die App
   überschreibt oder vermischt keine vorhandenen Inhalte.
4. Warte, bis die Erzeugung beendet ist. Die App öffnet die neue Vault anschließend automatisch
   im Projekt-Dashboard.
5. Öffne die Projektkarte **„Lichterhain“**. Unter **„Area cards“** findest du
   **„Dorf-NPCs“**. Mit **„Open animations“**, **„Open PNG inventory“** und dem Tab
   **„NPCs“** lassen sich alle Quellen prüfen.

Die Erzeugung läuft über dieselben Rust-Produktionsservices wie die normale Bedienoberfläche:
Projekt- und Bereichsanlage, paketweiser PNG-Import mit Review-Fingerprint, unveränderliche
Motion-Freigaben, Outfit-Autosave, NPC-Bindings sowie generischer und Godot-Export. Es wird keine
Mock-Vault und kein versteckter Fixture-Ordner kopiert.

### Inhalt der Beispiel-Vault

| Inhalt | Nachvollziehbarer Zustand |
|---|---|
| Projekt | „Lichterhain“, Workspace-Label „Beispiel“ |
| Bereich | „Dorf-NPCs“, Humanoidprofil v1, 80 px Referenzhöhe, 16 Slots, 8 Richtungen |
| Gemeinsame Freigaben | Walk r1: 12 Frames bei 12 FPS, Loop; Sprint r1: 8 Frames bei 16 FPS, Loop; Jump r1: 12 Frames bei 12 FPS, einmalig |
| Mira | eigene violett-grüne Erscheinung, starre Handlaterne am rechten Handslot, lokales Walk-Fitting und korrigiertes Haar-Fitting |
| Borin | eigene blau-braune Erscheinung, starrer Unterarmschild, lokaler Sprint-Override und korrigiertes Oberkörper-Fitting |
| Spritequellen | 272 eindeutige RGBA8-PNG-Revisionen: je NPC 16 Slots × 8 Richtungen plus 8 Equipmentbilder |
| Exporte | je NPC vollständiger PNG/JSON-Build und Godot-Paket mit Szene, 3 Aktionen × 8 Richtungen = 24 Animationen und 256 Frames |

Beide NPCs pinnen exakt dieselben drei unveränderlichen Motion-Revisionen. Ihre Spritequellen,
Appearances, Equipmentteile und lokalen Bindings bleiben getrennt. Die Laterne und der Schild
folgen ihrem jeweiligen Slot, haben aber bewusst keine eigene Bewegungsspur. Damit zeigt das
Beispiel sowohl Wiederverwendung als auch lokale Abweichung, ohne Motion-Vorlagen zu kopieren.

Alle Beispiel-PNGs sind lokal erzeugte, geometrische RGBA8-Pixelgrafiken. Es wurden keine
externen Bilder oder Netzwerkquellen verwendet. Herkunft und MIT-Lizenz stehen in jedem
Asset-Dokument sowie in `LICHTERHAIN-README.md` und `LICHTERHAIN-LICENSE.txt` im Vault-Ordner.

## Einen Beispiel-NPC erneut exportieren

1. Öffne „Lichterhain“ und bei „Dorf-NPCs“ **„Open animations“**.
2. Wechsle zum Tab **„NPCs“** und wähle „Mira“ oder „Borin“.
3. Prüfe unter **„All motions“**, dass Walk, Sprint und Jump den Status `reviewed` haben.
4. Wähle **„Export NPC“**.
5. Stelle **„Animation assignment“** auf **„All assignments“** und wähle bei
   **„Format“** entweder **„PNG sheets + JSON“** oder **„Godot package + PNG/JSON“**.
6. Wähle für das nachvollziehbare Beispiel das gespeicherte Profil
   **„Lichterhain Godot 4.7.2“** und starte **„Export“**.
7. Warte auf den Abschlussstatus. Die App zeigt den verwalteten relativen Ausgabepfad. Ein
   Abbruch lässt den zuletzt gültigen Build und dessen `current.json` unverändert.

Der Beispielgenerator legt beide vollständigen Exportarten schon bei der Erzeugung an. Ein
erneuter Export ist daher eine bewusste Reproduktionsprüfung. Inhaltsgleiche Quellen dürfen den
bereits validierten, inhaltsadressierten Build wiederverwenden.

## Manuell von einer leeren Vault zum NPC

Der folgende Weg erklärt dieselben Schritte ohne Beispielgenerator.

### 1. Vault und Projekt

1. Wähle auf der Startseite **„Choose vault“** und einen leeren lokalen Ordner.
2. Die App initialisiert dort ihre Metadaten und öffnet die Vault mit einem Writer-Lock.
3. Wähle im Bereich **„Projects“** die Aktion **„New project“**, gib einen portablen Namen ein
   und bestätige **„Create project“**.
4. Öffne die neue Projektkarte. Workspace-Labels gehören zum Projekt-Dashboard;
   projektbezogene Labels für Bereiche, Motions und NPCs werden getrennt gespeichert.

### 2. Bereich und Humanoidprofil

1. Gib im Profil-Workbench einen Bereichsnamen und die Referenzhöhe ein. Für das Beispiel sind
   das „Dorf-NPCs“ und 80 px.
2. Prüfe in der Vorschau alle acht Richtungen und die 16 vorbereiteten Slots.
3. Erzeuge den Bereich. **„Open profile“** zeigt später genau die gepinnte Profilrevision.

Die **Referenzhöhe** beschreibt die gewünschte Figurenhöhe und skaliert die anatomischen
Slotflächen. Die **Framegröße** beschreibt dagegen die gesamte transparente Exportfläche. Sie
enthält zusätzlich Platz für Bewegung, Haare, Kleidung, Equipment, Sprung und Schatten. Eine
80-px-Figur liegt deshalb im Standardprofil in einem 128 × 128-px-Frame; beides ist kein
Widerspruch.

### 3. Gemeinsame Bewegung anlegen und freigeben

1. Wähle bei der Bereichskarte **„Open animations“** und dann **„New animation“**.
2. Gib Name und Action-Key an und wähle beispielsweise das Preset Walk, Sprint oder Jump.
3. Der Dummy-Editor öffnet den normalen Entwurf. Bearbeite Timeline, Slots, Ebenen, Hilfskanäle
   und Richtungen; Autosave speichert konfliktgeschützt in die Vault.
4. Prüfe vor der Freigabe jede der acht Zielrichtungen. Wähle auf der Motion-Karte
   **„Release …“** und bestätige **„Release immutable revision“**.
5. Wiederhole dies für weitere Aktionen. NPCs referenzieren später diese Freigaben, nicht eine
   veränderliche Entwurfsdatei.

Eine **Freigabe** ist ein unveränderlicher Snapshot. Weitere Bearbeitung verändert nur den
Entwurf; eine neue Freigabe erhält eine neue Revisionsnummer. So können mehrere NPCs dieselbe
Motion sicher teilen und später kontrolliert auf eine neue Revision wechseln.

### 4. PNGs importieren und prüfen

1. Öffne bei der Bereichskarte **„Open PNG inventory“**.
2. Wähle einzelne PNGs oder ein Paketmanifest. Die Inspektion liest noch nichts in die Vault.
3. Prüfe für jeden Eintrag Profil, Slot, Richtung, Variante, Pivot und Größenbehandlung. Erst die
   bestätigte Review-Ansicht startet den Import.
4. Importierte Bilder werden ausschließlich als RGBA8 verarbeitet; Original und effektives Bild
   erhalten Hash und Revision. Ein Importjob nimmt höchstens 64 Einträge und besitzt feste
   kodierte und dekodierte Bytebudgets.

Das Studio ist kein Pixelmalprogramm und zerlegt keine fertige Figur automatisch. Bereite
transparente PNG-Teile extern vor. Für ein vollständiges Humanoid-Outfit werden alle
Pflichtslots in allen benötigten Richtungen gebraucht; `hair` ist optional. Eine fehlende
horizontale Ansicht darf nur dann aus der Gegenrichtung abgeleitet werden, wenn die konkrete
Asset-Revision dies ausdrücklich erlaubt und der Fallback im Outfit bestätigt wird.

### 5. Outfit, Equipment und erster NPC

1. Öffne eine freigegebene Motion-Karte und wähle **„New NPC outfit“**.
2. Unter **„Inventory“** wählst du die bestätigten Asset-Revisionen. Unter **„Dress“** ordnet
   die App sie den Slots zu. Unter **„Fine tune“** korrigierst du Pivot, Offset, Rotation,
   Sichtbarkeit und Layer je Richtung.
3. Equipment bleibt ein eigener Bestandteil. Lege Ankerslot, Richtungsbilder und
   Mitführmodus fest. Nur wenn das Teil wirklich eine unabhängige Bewegung braucht, aktiviere
   eigene Equipment-Tracks; ein starrer Schild oder eine Laterne benötigt sie nicht.
4. Speichere mit **„Save outfit as NPC“**. Name, Beschreibung und Labels erzeugen einen Character,
   die Default-Appearance und das erste Binding zur gewählten Motion-Freigabe.

Eine Korrektur im **Appearance-Scope** gilt für alle Bindings dieser Erscheinung. Eine Korrektur
im **Binding-Scope** gilt nur für die ausgewählte NPC-/Motion-Kombination. Der sichtbare
Scope-Hinweis verhindert, dass eine lokale Ausnahme versehentlich die gemeinsame Vorlage oder
alle Animationen des NPC verändert.

### 6. Weitere gemeinsame Motions binden

1. Öffne den Tab **„NPCs“** und den gewünschten NPC.
2. Wähle unter **„Assign another motion“** eine **„Released motion“** und anschließend
   **„Assign pinned motion“**. Der optionale Variant-Key dient nur einer bewusst zusätzlichen
   Action mit eindeutigem Namen.
3. Bearbeite bei Bedarf lokale Werte und bestätige **„Save local corrections“**.
4. Prüfe jedes Binding. Sobald die Pflichtaktionen vollständig und alle Bindings reviewed sind,
   kann auch der NPC als geprüft markiert und vollständig exportiert werden.

## Begriffe und Hierarchie

```text
Vault
└── Projekt
    └── Bereich + gepinnte Profilrevision
        ├── Motion-Vorlage
        │   ├── veränderlicher Entwurf
        │   └── unveränderliche Freigabe rN
        ├── Asset
        │   └── unveränderliche PNG-Revision rN
        └── NPC (Character)
            ├── Default-Appearance + Equipment
            ├── Binding → Motion-Freigabe + lokale Overrides
            └── _exports → generischer Build und optionale Godot-Ableitung
```

Eine ID bestimmt die Identität; ein lesbarer Ordnername ist nur Teil des portablen Pfads. Ein
Rename ändert daher nicht die Referenzen. Revisionen pinnen den genauen Inhalt, während Hashes
Manipulation und veraltete Exporte erkennbar machen.

## Richtungen und Spiegelgrenzen

Das Zielmodell enthält immer N, NE, E, SE, S, SW, W und NW. Bewegungsposen können drei
horizontale Ableitungen aus fünf expliziten Quellen verwenden. Anatomisch gepaarte Slots werden
dabei bewusst getauscht. Einzelne Bitmap-Assets werden dagegen nie stillschweigend gespiegelt:
Die Revision muss Spiegelung erlauben und das Outfit muss den konkreten Fallback genehmigen.
Asymmetrische Kleidung, Schrift, Waffenhand und Equipment sollten explizite Richtungsbilder
verwenden. **„Detach“** macht eine abgeleitete Motion-Richtung zu einer eigenständig
bearbeitbaren Pose.

## Speicherort, Lock und Recovery

Die Vault ist der ausgewählte Ordner. Autoritative Inhalte liegen als lesbare JSON- und PNG-Dateien
unterhalb der Projekt- und Bereichsordner. `.pixelforge-studio` enthält den Vault-Vertrag,
Workspace-Daten, Laufzeit-Lock und Recovery-Metadaten. Projektbezogene Transaktionsjournale,
Backups und Trash bleiben im jeweiligen Projekt.

- Öffne dieselbe Vault nicht gleichzeitig in zwei schreibenden App-Prozessen. Der zweite Prozess
  öffnet sie read-only.
- Entferne einen gemeldeten Writer-Lock nur nach ausdrücklicher Prüfung, dass der frühere Prozess
  wirklich beendet ist. Zeitablauf allein beweist das nicht.
- Bei einer unterbrochenen Mehrdateioperation blockiert die App weitere Writes und bietet nur
  **Resume** oder **Rollback** für den versiegelten Journalplan an.
- Bei einem Autosave-Konflikt zuerst neu laden. **„Save recovery copy“** bewahrt den lokalen
  Editorstand separat; er überschreibt nicht die neuere autoritative Datei.
- Kopiere oder sichere eine Vault nur, wenn kein Schreibjob aktiv ist. Der kopierte Ordner darf
  Leerzeichen und Unicode enthalten und bleibt ohne Pfadnachbearbeitung portabel.

Derived Caches und `_exports` dürfen neu erzeugt werden. Lösche oder editiere dagegen keine
autoritativen JSON-Dateien, Revisions-PNGs, Journale oder Locks von Hand, solange du deren Vertrag
nicht vollständig geprüft hast.

## Quellen und Export sind bewusst getrennt

Profilrevisionen, Motion-Freigaben, Asset-Revisionen, Appearances und Bindings sind die Quellen.
Ein Export ist eine abgeleitete, inhaltsadressierte Veröffentlichung dieser genauen Revisionen.
`animation.json` nennt alle Quellen, Aktionen, Richtungen, Frames, Atlasrechtecke, Zeiten,
Spiegelursprünge, Hashes und Checks. Erst nachdem alle Dateien validiert sind, ersetzt die App
den kleinen `current.json`-Pointer. Ein unvollständiger oder abgebrochener Build wird nicht zum
aktuellen Build.

## Godot-4.7.2-Paket verwenden

Ein vollständiges Paket enthält mindestens:

- `sheet-0.png` (bei Bedarf weitere nummerierte Sheets),
- `animation.json` als engine-neutrale Wahrheit,
- `sprite_frames.tres` mit relativen PNG-Referenzen,
- optional `character.tscn`,
- `GODOT_IMPORT.md` mit paketbezogenen Hinweisen.

1. Kopiere den **Inhalt des erzeugten Godot-Paketordners** in einen Ordner deines
   Godot-4.7.2-Projekts. Die ursprüngliche Vault wird zur Laufzeit nicht benötigt.
2. Warte auf den Godot-Import der PNGs und `.tres`-Ressource.
3. Instanziiere `character.tscn` oder weise `sprite_frames.tres` einem `AnimatedSprite2D` zu.
4. Wähle eine Animation nach dem Schema `<action>_<direction>`, beispielsweise `walk_s`,
   `sprint_nw` oder `jump_e`.
5. Verwende für Pixelart Nearest-Filtering und ganzzahlige Darstellung. Gameplay-Geschwindigkeit,
   Kollision und externe Root-/Sprunghöhe bleiben Aufgaben des Spiels und sind kein versteckter
   Studio-Runtimevertrag.

Paketpfade sind relativ und wurden mit Godot 4.7.2 geprüft. Ein Paket kann deshalb an einen
anderen Ort, auch mit Leerzeichen und Unicode, verschoben und ohne Vault oder alten Importcache
geladen werden. Weitere Vertragsdetails stehen unter
[Godot package integration](../developer/formats/godot-package.md).

## Grenzen des aktuellen Produkts

- Unterstützt ist das Humanoidprofil v1 mit 16 vorbereiteten Cutout-Slots und acht Richtungen;
  freie Objekttypen sind noch nicht verfügbar.
- Es gibt keinen eingebauten Pixel- oder Vektoreditor, keine automatische Bildsegmentierung,
  keine Bones/Skelette, keine Mesh-Deformation und keine Web- oder Mobile-Ausgabe.
- Die Vault ist lokal und für genau einen Writer ausgelegt. Cloudsync, Mehrbenutzer-Merge und
  SQL-Datenbank gehören nicht zum Produkt.
- Der belastbar ausgeführte Desktopumfang ist Linux. Windows-NSIS und macOS-DMG sind in der
  nativen CI-Matrix vorbereitet, aber noch nicht real laufzeitabgenommen. Pakete sind nicht
  signiert oder notarisiert.
- Ein realer Godot-Import ist für 4.7.2 belegt. Andere Engineversionen sind keine zugesicherte
  Abnahme. Ein echter Desktoplauf bei DPR 1,25 wurde nicht behauptet; die Geometrie dafür ist
  mathematisch getestet.

## Datenschutzfreundliche Fehlermeldung

Ein hilfreicher Bericht enthält App-Version, Betriebssystem, Desktopumgebung, Skalierungsfaktor,
Schritte zur Reproduktion, erwartetes Verhalten, sichtbaren Status und die **bereinigte**
Fehlermeldung. Nenne, ob die Vault lokal, kopiert oder read-only war und ob Resume/Rollback
angeboten wurde.

Sende standardmäßig **keine** vollständige Vault, keine privaten Sprites, Screenshots mit
personenbezogenen Pfaden, `writer.lock.json`, Geräte-/Kontodaten, GitHub-Token oder andere
Zugangsdaten. Kürze Nutzernamen und absolute Pfade. Falls ein minimaler Datenfall nötig ist,
erstelle eine Kopie, entferne nicht benötigte Projekte und Assets und prüfe jede verbleibende
JSON-/PNG-Datei vor dem Teilen. Teile Originaldaten nur nach bewusster Zustimmung und über einen
dafür geeigneten vertraulichen Kanal.

## Optionaler Entwickler-Einstieg

Nur für einen Quellcheckout gibt es denselben Generator zusätzlich als CLI. Für Endnutzer ist
dieser Schritt nicht erforderlich:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --locked \
  --example generate_lichterhain -- --output "/absoluter/Pfad/Leere Vault"
```

Der Befehl verweigert nichtleere Ziele genauso wie die Desktopaktion und gibt danach eine
maschinenlesbare Zusammenfassung der erzeugten IDs und Exportpfade aus.
