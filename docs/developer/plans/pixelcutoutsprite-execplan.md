<!-- AUTO-GENERATED:backlink START -->

[← Back](plans.md)
<!-- AUTO-GENERATED:backlink END -->

# PixelCutoutSprite Studio — lebender ExecPlan

**Planungsstand:** 6. September 2026
**Planung:** erstellt und an tatsächlichen Checkout angepasst
**Implementierung:** P00–P25 abgeschlossen; P26–P27 offen und nur einzeln nach Nutzerfreigabe
**Repository:** `kleiveist/PixelCutoutSprite`

Dieses Dokument wird bei der Umsetzung fortgeschrieben. Ein hier aufgeführter Plan oder Prompt ist kein Nachweis einer implementierten Funktion.

## Purpose / Big Picture

Eine lokale Desktop-App für wiederverwendbare Pixelart-Cutout-Animationen entwickeln. Der Nutzer arbeitet von Projekt und Bereich über Dummy-Bewegung und Sprite-Ausstattung bis zum benannten NPC mit mehreren exportierbaren Animationen. Vorrangig sind humanoide RPG-NPCs mit acht Richtungen, ohne notwendige manuelle Bone-Einrichtung.

Verbindliche Spezifikation: [PixelCutoutSprite Studio](../features/pixelcutoutsprite-studio.md).
Ausführungsrahmen: [MASTERPROMPT](../prompts/pixelcutoutsprite/MASTERPROMPT.md).
Phasenindex: [P00–P27](../prompts/pixelcutoutsprite/README.md).
Neue Erweiterung: [PixelPromptStudio-Integrationsplan](prompt-studio-integration.md).

## Current State

P00 prüfte den tatsächlichen lokalen Checkout: Branch `main` entsprach vor Beginn `origin/main`
bei `e709b853f0bf2bcfb95da7e7113cf18e43c4fc57`. Es handelt sich um Template Tooling 0.4.0,
nicht um Forge2D. Das Repository enthält Tauri-fähiges Python-Tooling und das Profil
`desktop-local`, jedoch noch keinen Produktbaum. Die in der importierten Planung behaupteten
Dateien `AGENTS.md`, `.agent/PLANS.md`, `config/*.toml` und `game/project.godot` fehlen.

Der Nutzer bestätigte ausdrücklich das Tooling-Template als Ausgangspunkt. ADR-001 legt daher
Tauri 2 + Rust + Vite/React/TypeScript als Desktop-Architektur fest. Godot 4.7.2 bleibt nur
zusätzliches Exportziel in P17. Der vollständige Ausgangsbefund steht im
[Repository-Inventar](../repository-inventory.md).

P01 ergänzte den zuvor fehlenden Produktbaum als native Tauri-2-Anwendung. Die React-Shell hat
Header, Breadcrumbs, Desktop-Navigation, Hauptbereich, Statusleiste und einen zugänglichen
Dialog-Layer. Zentrale Shortcuts respektieren Texteingaben. Noch nicht implementierte
Arbeitsbereiche sind ausdrücklich als geplant gekennzeichnet. Rust stellt den gemeinsamen
Produktions-Composition-Root und zunächst nur einen eng begrenzten Identitäts-Command bereit.

P02 definiert den versionierten Quelldatenvertrag. Autoritative Rust-Modelle validieren lokale
Dokumente und den zusammenhängenden Referenzgraphen; spiegelnde TypeScript-DTOs begrenzen die
UI-/IPC-Seite. Vollständige positive Fixtures decken alle 14 Dokumentarten ab. Negative
Fixtures und Konstruktionstests belegen Zukunftsversion, Typfehler, fehlende oder doppelte
Identitäten, Eltern-/Spiegelzyklen, Zahlenlimits, Pfade, Profilinkompatibilität und Atlasgrenzen.

P03 verbindet die native Ordnerauswahl mit einer filesystem-geprüften Vault. Fremde nicht leere
Ordner benötigen eine gegen Änderungen geschützte Zweitbestätigung; beschädigte Vaults bleiben
unangetastet. Gestufte validierte JSON-Writes, SHA-256-CAS, Single-Writer-Lock, ID-Index,
projektbezogene Transaktionsjournale und Autosave-Zustände bilden die gemeinsame Speicherbasis.

P04 ersetzt den Projekt-Platzhalter durch das echte Dashboard. `ProjectService` und `LabelService`
führen alle Mutationen über validierte Vault-Pfade aus: Projektordner, Manifest, lokale
Labelgrundlage, Revisionen, Archivzustand und kontrolliertes Verschieben nach `.trash`. Workspace-
Labels und Ansichtsfilter werden im richtigen globalen Scope gespeichert. Die React-Oberfläche
bietet Karten, Suche, alle strukturierten Bedingungen als zugängliche Dropdowns sowie any/all-
Labelsemantik, Leer-/Fehler-/Read-only-Zustände und fokussierte Dialoge.

P05 implementiert den vollständigen humanoiden Profilvertrag. `AreaService` erzeugt, listet und
öffnet Bereiche im ausgewählten Projekt, validiert projektbezogene Labels und publiziert Größenänderungen als neue
unveränderliche Profilrevision. Der Generator liefert 15 anatomische Slots plus optionale Haare,
sechs Spiegelpaare und acht vollständige Ansichten. Die React-Ansicht zeigt die vom Rust-Backend
berechneten Slotflächen; Speichern wird erst mit einem gültigen Projektkontext aktiv.

P06 ersetzt den Animationsplatzhalter durch eine persistente Bibliothek. `MotionService` verwaltet
Vorlagenentwürfe, unveränderliche Freigaben, Duplikate, Archiv und sicheres Entfernen innerhalb
des gewählten Bereichs. Karten, Dropdownfilter, Erstellungsdialog und Kontextmenü bilden diese
Zustände vollständig ab. Das Öffnen einer freigegebenen Vorlage verlangt eine ausdrückliche
Figurenauswahl; bei mehreren kompatiblen NPCs wird nie stillschweigend einer gewählt.

P07 ergänzt den gemeinsamen Rust-Pixelpfad. `PixelCompositor` verbindet aufgelöste Hierarchie,
Profil, Bewegung, Fitting, lokalen Override und Pivot ohne Zwischenrundung. Ganzzahlige Blits und
begrenztes inverses Nearest-Sampling erzeugen deterministische RGBA8-Frames mit Source-over-
Überdeckung und Clipping-Hinweisen. Vorschauhilfen gehören nicht zum Rendervertrag.

P08 ersetzt den Dummy-Platzhalter durch einen gespeicherten, compositorgestützten Editor. Er lädt
den vom Bewegungsentwurf exakt gepinnten Profilsnapshot, bietet acht getrennte Posen, Teile-/
Ebenenliste, Inspector, Auswahl und Mehrfachauswahl, Drag, Zahlenfelder, Sichtbarkeit, lokale
Sperren, Raster- und Winkelraster, Zoom, Pan sowie richtungsbezogenes Undo/Redo. Änderungen werden
als spärliche Frame-0-Tracks über den CAS-Draftdienst gespeichert; Hilfslinien und profilgenaue
Pivot-/Auswahlgriffe bleiben außerhalb des gerenderten PNG.

P09 erweitert diesen Editor um eine echte, horizontal skalierbare Timeline. Spuren, Keyframes,
Scrubbing, Abspielen, Frame-Schritte, Bereichsauswahl, Zwischenablage, Verschieben, Löschen,
Interpolation, Auto-Key und bestätigtes Retiming verändern den vollständigen Bewegungsentwurf.
Ein reiner Rust-Sampler wertet jede Richtung und jeden Index unabhängig aus; dieselbe gesampelte
Pose speist die Compositorvorschau einschließlich benachbarter Onion-Skin-Frames. Timeline und
Viewport teilen eine vollständige Undo-/Redo-History. Serialisierte CAS-Autosaves verhindern,
dass eine ältere Antwort neuere Änderungen als gespeichert markiert.

P10 führt die Richtungsdefinitionen durch Sampler, Compositor, Editor und Freigabe zusammen. Fünf
Quellansichten können drei kontrollierte Horizontalableitungen speisen; acht explizite Ansichten
bleiben zulässig. Der Resolver trennt anatomische Pose-, genehmigungspflichtige Asset- und
optionale Gesamtbildspiegelung, verwendet Zielprofil und Zielschichten und unterscheidet verdeckte
von fehlenden Teilen. Der Editor zeigt Ursprung und Lücken, während eine atomare Detach-Aktion
gespiegelte Tracks in eine eigenständige Richtung kopiert.

P11 ergänzt sechs persistente Startbewegungen, deren wenige normale Keys und benannte
Hilfskanäle vollständig im Editor veränderbar sind. Walk und Sprint unterscheiden Timing, Pose
und nur als Metadaten gespeicherte Spielgeschwindigkeit; alle Bewegungen bleiben standardmäßig
auf der Stelle. Beim Sprung sind Bodenanker, deterministische Höhenkurve und abschaltbarer,
nichtanatomischer Bodenschatten getrennt. Helper lassen sich verlustfrei in normale Keys
umwandeln. Sichtbare Bibliothekskarten laden höchstens vier tatsächliche gespeicherte Frames über
denselben Sampler-/Resolver-/Compositorpfad wie der Editor, einen inhaltsadressierten Byte-LRU und
eine Reduced-Motion-Regel. Ein geführter Dialog prüft vor der unveränderlichen Freigabe alle acht
Richtungen.

P12 ergänzt das bereichsbezogene PNG-Inventar als erreichbaren Tauri-Desktopablauf. Ein nativer
Dateidialog oder WebView-Drop führt zunächst ausschließlich zur Rust-Inspektion; erst die
bestätigte Zuordnung kopiert Einzel-PNGs oder explizite Sheet-Ausschnitte in die Vault. Das
strikte Paketformat bindet Profil, Slot, Richtung, Variante, Maße, Pivot und Ausschnitt. Die
Dateinamenskonvention bleibt ein sichtbarer Vorschlag. Größenabweichungen erfordern unveränderte
Übernahme, transparentes Padding oder bewusstes Nearest-Resampling. Stabile IDs, Inhalts-Hashes,
Revisionen, Verwendungslisten und recoverbares Archivieren werden aus normalen JSON-/PNG-Dateien
auch nach dem Wiederöffnen rekonstruiert.

P13 verbindet den freigegebenen Bewegungspfad mit dem Outfit-Editor. Der
`AppearanceService` öffnet ausschließlich freigegebene Motion-Revisionen, verlangt eine
sichtbare Wahl zwischen neuem Entwurf, vorhandenem kompatiblem NPC und gespeicherter
Entwurfswiederaufnahme, ordnet bestätigte Richtungsbilder zu und persistiert Fitting sowie lokale
Overrides per CAS. Der React-Editor liefert die drei Modi Inventory, Dress und Fine tune,
Playback/Frame-Schritte, einen speicherunabhängigen Undo-/Redo-Stack, zweisekündigen Autosave und
sichtbaren Änderungs-Scope. Das Speichern erzeugt Character, Default-Appearance und erste Binding
in einem gestuften NPC-Ordner; das Binding referenziert die unveränderliche Motion-Revision. Die
P06-Routen-/Kartennavigation reicht dabei den bestehenden Bereichs- und Revisionskontext
ausdrücklich weiter.

P14 baut direkt auf P13 auf und erweitert denselben Outfit-Entwurf und
die daraus erzeugte Appearance um logische Equipmentobjekte mit mehreren starren, stabil
identifizierten Teilen. Jedes Teil kann seinem
Körperslot oder ausdrücklich dem Figurenursprung folgen; Sichtbarkeit, Mitführen und eigene
Bewegung bleiben getrennte gespeicherte Eigenschaften. Richtungsbilder, Pivot, lokale starre
Korrektur und Layer werden über alle acht Ansichten ausgewertet. Optionale Transformspuren werden
deterministisch gesampelt und liefern bei jedem deaktivierten Gate die Identität, ohne gespeicherte
Keys zu löschen. Vorschau und künftiger Export teilen weiterhin den CPU-Compositor; P14 führt
weder zusätzliche Pflichtslots noch Mesh-/Skinning-Abhängigkeiten ein.

P15 fasst alle Bindings einer Figur in einem erreichbaren NPC-Arbeitsbereich zusammen. Er zeigt
Anforderungen, Richtungsabdeckung, Review und aus effektiv gepinnten Quellen berechnete
Exportaktualität. Lokale Korrekturen verändern nur ihr Binding; neue Freigaben werden verglichen
und niemals automatisch übernommen. Zusätzliche Aktionen, Varianten, Duplikate und kontrollierte
Ordner-Renames bewahren stabile Referenzen und getrennte gemeinsame Quellen.

P16 verbindet diesen gespeicherten Zustand mit dem generischen Export. `NpcExportService` löst
stabile IDs serverseitig auf, lädt und verifiziert alle verwendeten PNG-Revisionen und reicht den
identischen Outfit-/Equipment-Renderpfad an `ExportService`. Der regelmäßige Mehrseitenatlas,
optionale Einzelbilder und das vollständige Manifest werden gegen dekodierte Pixel geprüft. Erst
ein gültiger inhaltsadressierter Build darf `current.json` ersetzen. Bereichseigene
Exportprofile, Vorprüfung, Fortschrittsereignisse, Polling-Fallback, sitzungsgebundener nativer
Abbruch und ein ausschließlich `current.json` folgender NPC-Status sind in die Tauri-App
integriert. Frei gelieferte Zielpfade werden in P16 nicht als Schreibauthority akzeptiert; der
verwaltete Vault-Baum bleibt die portable kanonische Ausgabegrenze für P17.

P17 leitet aus genau diesem validierten Build portable Godot-Ressourcen ab. Der native
`GodotExporter` erzeugt eine `SpriteFrames`-Bibliothek aus `AtlasTexture`-Rechtecken und optional
eine skript-, kollisions- und skelettfreie `AnimatedSprite2D`-Szene mit gemeinsamem Bodenursprung
und Nearest-Filter. Inhaltsadressierte Pakete werden vor Wiederverwendung bytegenau gegen Quelle
und deterministisch neu erzeugten Text geprüft; Symlinks und nicht reguläre Einträge sind verboten.
Der generische Pointer bleibt bis zur abschließenden Paketvalidierung unverändert. Godot 4.7.2
importiert Loop- und Once-Ressourcen sowie die optionale Szene im isolierten frischen Projekt aus
Unicode-/Leerzeichenpfaden und nach cachefreier Verzeichnisverschiebung.

P18 macht die reale Bearbeitungskette nach einem Prozessabbruch wiederaufnehmbar. Sealed Journale
binden Plan, projektbezogene Eigentümerschaft, erwartete Quellbytes und veröffentlichte Ergebnisse;
Resume und Rollback gleichen den tatsächlichen Dateistand idempotent ab. Projekt-/NPC-Rename,
Workspace-Label-Entfernung, Bereichs-/Motion-/Outfit-/Binding-Schreibvorgänge, der konfigurierte
Asset-Import, Freigaben, Trash-Aktionen und der letzte Exportpointer verwenden diese Grenze. Eine
echte OS-Dateisperre schützt den Writer auch vor einem zweiten Prozess, während verwaiste Metadaten
nur mit erneuter Inspektion und exaktem Bestätigungstoken übernommen werden. Motion- und
Outfit-Editor serialisieren Autosaves, bewahren Fehlerstände und Recovery-Kopien und blockieren
Navigation während ungesicherter oder laufender Mutationen. Schema-v0-Fixtures migrieren mit
projektlokalem Backup; Zukunftsschemata und fremde, nicht verankerte Bäume bleiben unangetastet.

P19 schließt die Linux-Desktopprüfung mit realen 1280×720- und 1440×900-WebView-Läufen bei DPR 2,
AT-SPI-Aktionen/Fokus, DOM-geprüfter Tastaturbedienung und einem Offline-Lauf im isolierten
Netznamespace ab. Gemeinsame Modalregeln, vollständige strukturierte Dropdownbedingungen,
scrollbare Mindesthöhen und physisch ganzzahlige Pixelansichten beseitigen die gefundenen
Bedienengpässe. Inventar-Metadaten sind seitenweise und von sichtbarkeitsgeladenen 48-px-
Thumbnails getrennt; laufende Serverfilter lassen die kontrollierten Eingaben montiert und
erhalten dadurch den Fokus. Import läuft als begrenzter abbrechbarer Job. Der gemeinsame
Vorschau- und Quellbild-LRU zählt seine Payloads gegen 256 MiB und wird beim Vault-Schließen geleert.
Hardwarebezogene Raster-, Export-, Öffnungs-, Inventar- und Importwerte sowie alle Einschränkungen
stehen in der [P19-Desktop-Abnahme](../acceptance/desktop-usability-and-performance.md).

P20 aktiviert die native Tauri-Bündelung und verankert Node, npm, Rust sowie die direkten
Tauri-Versionen in Supportmatrix, Manifests, CI und Devcontainer. Die zentrale Quality-Schicht
ignoriert ihren eigenen `.tooling-state` sowie `.build` und verwendet Clippys kompatibles
`-D warnings`. Sichere Artefaktprüfer erzeugen pro Plattform atomare Manifeste und
SHA-256-Listen; ein hostgebundener
Smoke startet ausschließlich den erzeugten Paketpayload mit isoliertem Nutzerzustand. Das finale
Linux-DEB wurde wirklich gebaut, geprüft, gestartet und bis zum nativen GTK-Ordnerdialog sowie
zum gespeicherten Produktions-Export durchlaufen. Die schreibgeschützte Studio-CI-Matrix bereitet
NSIS unter Windows und DMG unter macOS vor. Beide Plattformen bleiben mangels passendem Host und
autorisiertem Workflowlauf ausdrücklich nicht laufzeitabgenommen. Der
[P20-Buildbericht](../acceptance/native-builds-and-tooling.md) dokumentiert Artefakt, Hash,
Codespaces-Grenze, Signierungsfreigabe und alle Blocker.

P21 macht den ersten vollständigen Nutzerweg ohne Entwicklerwerkzeuge direkt auf der Startseite
erreichbar. „Create Lichterhain example“ erzeugt in einem ausgewählten leeren Ordner über die
Produktionsservices eine portable Vault mit Projekt, 80-px-Humanoidbereich, 272 geprüften
RGBA8-Assetrevisionen, drei gemeinsamen unveränderlichen Motion-Freigaben, den verschieden
ausgestatteten NPCs Mira und Borin sowie vollständigen generischen und Godot-4.7.2-Paketen. Der
Integrationstest schließt und öffnet die Vault neu, prüft gemeinsame Revisionen, lokale
Korrekturen, statisches Equipment und Herkunft/Lizenz, kopiert sie an einen Leerzeichen-/
Unicodepfad und exportiert von dort erneut. Die
[deutsche Nutzeranleitung](../../guides/erste-schritte-und-lichterhain.md) erklärt zusätzlich den
manuellen Weg, Hierarchie, Spiegelgrenzen, Recovery, Quell-/Exporttrennung und datensparsames
Fehlerreporting. Der [P21-Bericht](../acceptance/example-vault-and-user-guide.md) hält die
ausgeführten Nachweise und Grenzen fest.

P22 schließt die produktionsweite Abnahme ohne einen zweiten Render- oder Fixturepfad. Der
Lichterhain-E2E vergleicht alle 256 Mira-Frames an jedem Aktions-, Richtungs- und Sampleindex
pixelgenau zwischen Outfit-Preview und dekodiertem Atlas, prüft exakte Loopmengen, getrennte
Mira-/Borin-Appearances bei denselben drei Motion-Freigaben sowie ein persistiertes deaktiviertes
Equipment gegen Preview, Atlas und Manifestquellen. Immutable Profil-/Motion-/Assetrevisionen und
der global-only-Adminbaum bleiben unverändert. Der explizit ausgeführte Sondertest importiert das
vollständige Produktionspaket mit der SHA-256-geprüften offiziellen Godot-4.7.2-Binärdatei in ein
frisches Projekt, nachdem die Quell-Vault gelöscht wurde, und wiederholt den Import cachefrei nach
Unicode-/Leerzeichen-Relocation. Eine strukturierte Negativarchitektur-Policy schließt Datenbank-,
Python-/Sidecar-, Web-/Mobile- und Rigpfade aus. Die
[P22-Gesamtabnahme](../acceptance/final-acceptance.md) bewertet RQ-01–RQ-40 und E2E A–J. Reale
Windows-/macOS-Laufzeitresultate bleiben mangels autorisiertem CI-Lauf ausdrücklich offen.

Am 6. September 2026 wurde P00–P22 als abgeschlossene, weiterhin belegte Cutout-Basisserie
festgeschrieben. P23–P27 integrieren den Prompt-Bereich aus dem benachbarten
PixelForgeStudio-Checkout in dieselbe Tauri-App. Der Port wurde gegen
`PixelCutoutSprite@55cddf385f87b65eea8887ede3e6380c65e7dd97` und primär
`PixelForgeStudio@a4784cbb3b991c37cb5e87855f2025c0565cc4ff` umgesetzt; die letzte reine
Prompt-V2-Revision `d253e7a948dc80ce766fe5e7ca76440f1f418c85` lieferte die prompt-spezifische
Settings-/Schema- und Testgrenze. PixelForgeStudio blieb Read-only-Quelle. Herkunft und
MIT-Hinweis stehen im portierten Namensraum.

P23 isoliert den Prompt-Bereich unter `frontend/src/prompt-studio/`. Prompt-spezifische Barrels,
die benötigten React-Hook-Form-/Zod-Abhängigkeiten, die neun Kategorien, Profilauflösung,
Draft-/Recovery-Logik, Prompt Engine, Ausgabevorbereitung und Browseradapter sind vorhanden. Der
Importgrenzentest schließt die PixelForge-Gesamtshell, Startseite, das Animation Studio, Worker und
ein zweites `main.tsx` aus. Die Cutout-Shell ist in diesem Commit noch unverändert.

P24 ergänzt oberhalb der unveränderten `WorkspaceRoute` den getrennten `StudioMode` und die
`PromptView`. Der einzige App-Header enthält nun zwei exakt gleich große, per Tastatur bedienbare
Buttons; PixelPromptStudio verwendet den grünen Akzent. Der Studiowechsel läuft durch dieselben
Recovery-, Mutations- und Dirty-Editor-Guards wie die Cutout-Navigation. Route, Vault, Projekt,
Area, Template-, NPC- und Binding-Auswahl bleiben im App-Zustand und werden beim Zurückkehren
wiederhergestellt. Vor Prompt → Cutout wird eine asynchrone Lifecycle-Flush-Grenze abgewartet.

P25 ersetzt den P24-Mount-Punkt durch den vollständigen `PromptGeneratorRoot`. Dashboard,
Profilbibliothek, Neun-Kategorien-Wizard, Ausgabeprüfung und Einstellungen teilen ausschließlich
die Prompt-relevanten Provider. Der integrierte Adapter verwaltet `PromptView` im App-Zustand ohne
History-/Query-Schreibzugriff. Gültige Wizard-Änderungen werden lokal automatisch gespeichert;
solange ein Entwurf schmutzig oder ungültig ist, blockiert der Studiowechsel. Prompt-Tokens und
Resetregeln sind auf `.prompt-generator-root` begrenzt, der innere Arbeitsbereich scrollt ohne das
Cutout-Grid zu verändern. Native Persistenz und Cutout-Handoff bleiben P26 vorbehalten.

## Scope and Non-Goals

Der abgeschlossene Basisumfang ist in der Spezifikation RQ-01 bis RQ-40 festgelegt. Besonders
wichtig sind Desktop-only, JSON/PNG statt SQL, lokale Vault, globale Cutout-Daten ausschließlich
unter `.pixelforge-studio`, 16 vordefinierte Grundslots einschließlich optionaler Haare, acht
Richtungen, getrennte Vorlagen/Appearance/Bindings und ein portabler Spieleexport.

P23–P27 ergänzen den vollständigen PixelPromptStudio-Workflow als eingebetteten React-Bereich mit
eigener Navigation, nativem App-Daten-Storage und einer versionierten Übergabe an einen
schreibbaren Cutout-Kontext. Der Prompt-Bereich wird weder iframe noch externe Webseite, zweites
Programm oder weiterer `WorkspaceRoute`-Wert. PixelForgeStudios Startseite, äußere Shell,
Animationsstudio und Footer sind nicht Teil der Portierung.

Weiterhin nicht Teil des Umfangs sind andere Cutout-Körperformen, Augen-/Gesichtssystem,
vollständiger Pixel-Painter, automatische Bildgenerierung, Cloud-Zusammenarbeit und mobile oder
eigenständige Web-Ausgaben des Studios. P23–P27 ändern keine bestehende Vault ohne ausdrückliche
Prompt-Übergabe.

## Concrete Steps

P00–P22 sind abgeschlossen. P23–P25 wurden separat umgesetzt und geprüft. P26–P27 beginnen jeweils
erst nach ausdrücklicher Nutzerfreigabe und bestandenem Vorgängergate.

| Phase                                     | Auftrag                                                 | Status                     |
| ----------------------------------------- | ------------------------------------------------------- | -------------------------- |
| [P00](../prompts/pixelcutoutsprite/00.md) | Bestand prüfen und Umsetzung verankern                  | Abgeschlossen              |
| [P01](../prompts/pixelcutoutsprite/01.md) | Desktop-Shell und Produktidentität                      | Abgeschlossen              |
| [P02](../prompts/pixelcutoutsprite/02.md) | Fachmodelle und JSON-Verträge                           | Abgeschlossen              |
| [P03](../prompts/pixelcutoutsprite/03.md) | Vault und sichere Dateispeicherung                      | Abgeschlossen              |
| [P04](../prompts/pixelcutoutsprite/04.md) | Projekt-Dashboard, Labels und Dropdown-Filter           | Abgeschlossen              |
| [P05](../prompts/pixelcutoutsprite/05.md) | Bereiche und humanoide Körperprofile                    | Abgeschlossen              |
| [P06](../prompts/pixelcutoutsprite/06.md) | Animationsbibliothek und zustandsabhängige Navigation   | Abgeschlossen              |
| [P07](../prompts/pixelcutoutsprite/07.md) | Gemeinsamer Pixel-Rasterer                              | Abgeschlossen              |
| [P08](../prompts/pixelcutoutsprite/08.md) | Direkt bedienbarer Dummy-Editor                         | Abgeschlossen              |
| [P09](../prompts/pixelcutoutsprite/09.md) | Timeline, Keyframes und deterministisches Sampling      | Abgeschlossen              |
| [P10](../prompts/pixelcutoutsprite/10.md) | Acht Richtungen, Spiegelregeln und Schichten            | Abgeschlossen              |
| [P11](../prompts/pixelcutoutsprite/11.md) | Bewegungspresets und tatsächliche Kartenvorschauen      | Abgeschlossen              |
| [P12](../prompts/pixelcutoutsprite/12.md) | PNG-Inventar und Paketimport                            | Abgeschlossen              |
| [P13](../prompts/pixelcutoutsprite/13.md) | Ausstattungseditor, Feinschliff und NPC-Entwürfe        | Abgeschlossen              |
| [P14](../prompts/pixelcutoutsprite/14.md) | Ausrüstung und optionale Eigenbewegung                  | Abgeschlossen              |
| [P15](../prompts/pixelcutoutsprite/15.md) | NPC-Dashboard, Mehrfachanimationen und Revisionen       | Abgeschlossen              |
| [P16](../prompts/pixelcutoutsprite/16.md) | Generischer PNG-/JSON-Export                            | Abgeschlossen              |
| [P17](../prompts/pixelcutoutsprite/17.md) | Portables Godot-Paket und echter Importtest             | Abgeschlossen              |
| [P18](../prompts/pixelcutoutsprite/18.md) | Recovery, Autosave und Datenintegrität härten           | Abgeschlossen              |
| [P19](../prompts/pixelcutoutsprite/19.md) | Desktop-Usability und Leistung prüfen                   | Abgeschlossen              |
| [P20](../prompts/pixelcutoutsprite/20.md) | Native Builds, Tooling und Codespaces                   | Abgeschlossen              |
| [P21](../prompts/pixelcutoutsprite/21.md) | Anleitung und nachvollziehbare Beispiel-Vault           | Abgeschlossen              |
| [P22](../prompts/pixelcutoutsprite/22.md) | Gesamtabnahme und überprüfbarer Abschluss               | Abgeschlossen              |
| [P23](../prompts/pixelcutoutsprite/23.md) | Prompt-Integrationsgrenze und technische Basis          | Abgeschlossen; Gate PASS   |
| [P24](../prompts/pixelcutoutsprite/24.md) | Gemeinsamer Header und sichere Studio-Umschaltung       | Abgeschlossen; Gate PASS   |
| [P25](../prompts/pixelcutoutsprite/25.md) | Vollständige PixelPromptStudio-Oberfläche portieren     | Abgeschlossen; Gate PASS   |
| [P26](../prompts/pixelcutoutsprite/26.md) | Native Prompt-Persistenz, Export und Cutout-Handoff     | Offen                      |
| [P27](../prompts/pixelcutoutsprite/27.md) | Integrierte Studio-Workflows abnehmen und dokumentieren | Offen                      |

## Progress

- [x] Nutzeranforderungen in eine vollständige Produktspezifikation überführt.
- [x] Relevanten Repository-Ausgangsstand und offizielle technische Quellen gelesen.
- [x] Dateistruktur, Datenverträge, Exporte, Risiken und Abnahmefälle geplant.
- [x] Masterauftrag, Fortsetzungsauftrag und Phasenprompts P00–P27 erstellt.
- [x] P00: tatsächlichen Checkout, Tooling-Grenzen, Tauri-ADR, RQ-Ledger und Basistests erfasst.
- [x] P01: native React-/Tauri-Shell, Produktidentität, Navigation, Dialoge und Shortcuts erstellt.
- [x] P02: Fachmodelle, JSON-v1-Verträge, Graphvalidierung, Zustände und Vertragsfixtures erstellt.
- [x] P03: native Vault-Auswahl, sichere Pfade/Writes, Lock, Index und Journalbasis erstellt.
- [x] P04: Projekt-Dashboard, JSON-CRUD, Workspace-/Projektlabels und Dropdown-Filter erstellt.
- [x] P05: Bereichskarten, humanoides 16-Slot-Profil, exakte Skalierung, Vorschau und unveränderliche Profilrevisionen erstellt und gegatet.
- [x] P06: Animationsbibliothek, persistente Entwürfe, unveränderliche Freigaben und kontextabhängige Navigation erstellt und gegatet.
- [x] P07: gemeinsamen RGBA8-Pixelcompositor, Hierarchietransforms, Nearest-Sampling, Source-over, Spiegelung und Clipping erstellt und gegatet.
- [x] P08: echten Dummy-Editor, gepinnte Profilauflösung, Transformwerkzeuge, richtungsbezogene History, Compositorvorschau und CAS-Persistenz erstellt und gegatet.
- [x] P09: vollständige Timeline, reinen Sampler, Onion-Skin-Vorschau, Retiming, gemeinsame History und serialisierte CAS-Autosaves erstellt und gegatet.
- [x] P10: acht Richtungszustände, anatomische Spiegelung, Zielschichten, sichere Assetregeln, Detach und blockierende Freigabeabdeckung erstellt und gegatet.
- [x] P11: sechs editierbare Presets, sichtbare/bakebare Helper, getrennte Sprunghöhe/Schatten, echte Lazy-Kartenvorschauen, Inhaltscache und geführte Freigabe erstellt und gegatet.
- [x] P12: erreichbares Bereichsinventar, nativen Dialog/Drop, strikte Paket-/PNG-Prüfung, explizite Zuordnung und Größenbehandlung, Revisionen, Verwendungsnachweise und Archiv erstellt und gegatet.
- [x] P13: Outfit-Editor, AppearanceService, wiederaufnehmbare Entwürfe und erste NPC-Erzeugung erstellt, in den Area-/Motion-Router eingebunden und gegatet.
- [x] P14: mehrteilige starre Ausrüstung, getrennte Zustände, optionale Transformspuren und Acht-Richtungs-Rendering erstellt und gegatet.
- [x] P15: NPC-Dashboard/-Detail, Mehrfachbindungen, Freigaben, explizite Revisionsübernahme, lokale Overrides sowie Duplizieren/Umbenennen erstellt und gegatet.
- [x] P16: gemeinsamen Multi-Action-PNG-/JSON-Export, Atlanten, optionale Einzelbilder, Profile, Fingerprint, validierte Veröffentlichung und native Jobs erstellt und gegatet.
- [x] P17: portable Godot-`SpriteFrames`, optionale sichere Szene, deterministische Paketwiederverwendung, atomaren Jobabschluss und echten cachefreien Godot-4.7.2-Import erstellt und gegatet.
- [x] P18: Recovery-UI, idempotente Resume-/Rollback-Journale, OS-Writer-Lock, CAS-Autosaves,
      Migrationen, Scope-/Eigentumsschutz und echte Unterbrechungstests über Bearbeitung, Import,
      Freigabe, Trash und Export erstellt und gegatet.
- [x] P19: Desktop-Layout und DPI-Pixelpfad, Modal-/Tastaturbedienung, vollständige Dropdowns,
      seitenweises Inventar, sichtbarkeitsgeladene Thumbnails, begrenzten gemeinsamen Bildcache,
      fokuserhaltende Serverfilter, abbrechbare Importjobs sowie Linux-/Offline-/Leistungsmessungen
      erstellt und gegatet.
- [x] P20: reproduzierbar gepinnte Toolchains, aktive native Bündelung, sichere
      Manifest-/SHA-256-Artefaktprüfung, hostgebundene Paket-Smokes, Studio-CI-Matrix,
      Devcontainergrenze und ein tatsächlich geprüftes Linux-DEB erstellt und gegatet; Windows und
      macOS bleiben mit offenem Host-/Workflowblocker ausdrücklich nicht abgenommen.
- [x] P21: produktionsservicebasierten Lichterhain-Generator in Desktop-App und CLI, vollständige
      Beispiel-Vault, Reopen-/Unicode-Kopie-/Reexport-Test sowie deutsche Nutzer- und
      Godot-Integrationsanleitung erstellt und gegatet.
- [x] P22: Produktions-E2E von leerer Vault bis Reopen/Export, vollständige pixelgenaue
      Preview-/Atlasprüfung, Loop-/Disabled-Equipment-/Shared-Motion-Regressionsbelege, finale
      Negativarchitektur, echten Godot-4.7.2-Import und RQ-/E2E-Abschlussmatrix ausgeführt und gegatet.
- [x] P00–P22 als abgeschlossene Basisserie mit unveränderter Abnahmeevidenz festgeschrieben.
- [x] Integrationsgrenze und ausführbare Aufgaben für die neue Serie P23–P27 dokumentiert.
- [x] P23: Prompt-Integrationsgrenze im Zielcode umsetzen, Quellrevision festhalten und
      Prompt-Abhängigkeiten isolieren.
- [x] P24: gemeinsamen Studiowechsler, Prompt-Lifecycle-Flush und zustandserhaltenden
      Navigationsschutz umsetzen, prüfen und separat committen.
- [x] P25: vollständige Prompt-Oberfläche, Provider, Navigation und isolierte Styles portieren.
- [ ] P26: native Prompt-Persistenz, Import/Export und versionierten Cutout-Handoff umsetzen.
- [ ] P27: integrierte Frontend-, Rust- und Browserworkflows abnehmen und dokumentieren.
- [x] Meilenstein A: Grundlage, P00–P06.
- [x] Meilenstein B: Bewegungen, P07–P11.
- [x] Meilenstein C: Figuren, P12–P15.
- [x] Meilenstein D: Spieleinbindung, P16–P17.
- [x] Meilenstein E: belastbare Desktop-Version, P18–P22; Windows/macOS-Laufzeitevidenz bleibt
      als ausdrücklich offener betrieblicher Plattformnachweis dokumentiert.
- [ ] Meilenstein F: PixelPromptStudio vollständig einbetten und abnehmen; P23–P25 sind
      abgeschlossen, P26–P27 bleiben offen.

Bei jeder Phasenänderung ergänzen: Datum, tatsächlicher Umfang, betroffene Dateien, Prüfungen und nächster Schritt. Noch nicht geprüfte Plattformen werden nicht als fertig markiert.

## Surprises & Discoveries

**2026-09-05 (durch P00 ersetzt):** Die importierte Annahme eines vorhandenen
Godot-/Python-Produkts war falsch. Der reale Checkout ist das Tauri-fähige Tooling-Template;
ADR-001 und der ausdrückliche Nutzerhinweis legen Tauri als Produktlaufzeit fest.

**2026-09-05:** Der gewünschte Workflow braucht eine Trennung zwischen Bewegungsvorlage und konkretem NPC. Eine reine Ordnerliste von unabhängigen Sprite-Sheets würde die geforderte Wiederverwendung nicht erfüllen.

**2026-09-06 / P23:** PixelForgeStudios gemeinsame Schema- und Service-Barrels ziehen Prompt- und
Animationsverträge zusammen. Der Port verwendet deshalb eigene Prompt-Barrels und einen statischen
Importgrenzentest. `fflate` wird im übernommenen Promptpfad nicht importiert und wurde folglich
nicht als Abhängigkeit ergänzt.

**2026-09-06 / P23:** Der eingecheckte `.tooling-state/bin/node` ist in dieser Umgebung nur ein
`flatpak-spawn`-Wrapper; `flatpak-spawn` fehlt. Die Phase wurde deshalb mit dem verfügbaren Node
22.22.2/npm 10.9.7 geprüft. Das erzeugt wegen des bestehenden exakten Engine-Pins eine Warnung,
Typecheck, Lint, Tests und Build bestehen jedoch. Ein Node-24-Wiederholungslauf bleibt für die
abschließende P27-Toolchain-Abnahme sinnvoll.

**2026-09-06 / P24:** Der Cutout-Arbeitsbereich wird nach bestandenem Navigationsguard beim Wechsel
ausgehängt und bei der Rückkehr aus den erhaltenen stabilen IDs wieder geöffnet. Ein bloßes
Verstecken hätte nach einer bestätigten Verwerfen-Abfrage den ungespeicherten Kindzustand weiter im
Speicher gehalten und den Dirty-Status widersprüchlich gelöscht. Der übergeordnete App-Zustand
erhält weiterhin Route, Vault, Projekt, Area, Template, NPC und Binding.

**2026-09-06 / P25:** PixelForgeStudios Prompt-Theme war ursprünglich über `:root`, `html`, `body`
und `#root` definiert. P25 überführt ausschließlich die benötigten Tokens und Resetregeln unter
`.prompt-generator-root`; auch der Themezustand liegt als lokales `data-theme` am Prompt-Bereich.
Dadurch bleiben das 1280-px-Cutout-Grid, sein Overflow und seine Editorregeln unverändert.

**2026-09-06 / P25:** Der portierte Wizard speichert gültige Änderungen verzögert, verwirft aber
beim Unmount bewusst keinen ungültigen Zwischenstand. Der Shell-Wechsel blockiert deshalb bei
`draftDirty`, bis Autosave oder Korrektur den Zustand sauber gemacht haben, und wartet erst danach
auf die P24-Lifecycle-Flush-Grenze. Prompt-interne Ansichtswechsel erhalten die Wizard-Session im
Providerbaum; ein App-Wechsel hängt den Prompt-Baum erst im sauberen Zustand aus.

**2026-09-06 / P25:** Der sichtbare Autosave-Status und der Dirty-Guard der äußeren Shell dürfen
keinen Renderzyklus auseinanderliegen. Die Dirty-Rückmeldung läuft deshalb als Layout-Effekt vor
dem Paint. Außerdem löst das ausdrückliche Löschen der gerade gewählten Produktionsfamilie deren
Referenz sofort aus einem gültigen partiellen Draft und persistiert diese Änderung, damit kein
Autosave auf ein inzwischen fehlendes Profil zeigt.

**2026-09-06 / P25:** Die erstmals erreichbare vollständige Prompt-Oberfläche erhöht den
Produktionsgraphen von 119 auf 398 transformierte Module. Ein einzelner ungegliederter Buildchunk
lag bei rund 1,17 MB. Die bereits in PixelForgeStudio bewährte Rolldown-Gruppierung wurde auf den
isolierten Zielpfad angepasst; React, Formular-/Schemaabhängigkeiten, sonstige Vendoren und
Prompt-Funktionen liegen nun in getrennten Chunks, deren größter unkomprimierter JavaScriptanteil
im P25-Build rund 262 kB misst.

**2026-09-05:** „Nicht animiertes“ Equipment muss seinem Träger trotzdem folgen können. Sichtbarkeit, Mitführen und Eigenbewegung sind deshalb getrennte Eigenschaften.

**2026-09-05:** Eine native Desktop-App ist nicht automatisch per Codespaces-Portweiterleitung als GUI bedienbar. Codespaces dient in diesem Plan Codearbeit und geeigneten Headless-Tests.

**2026-09-05 / P00:** Die importierte Planung stammte aus einem anderen Repository-Kontext.
Der tatsächliche Checkout ist das reine Template Tooling. Der Nutzerhinweis und der lokale
Befund ersetzen die Godot-App-Annahme; die fachlichen Anforderungen bleiben erhalten.

**2026-09-05 / P00:** Die mitgelieferten portablen Tooling-Dokumente waren bytegleich nach
`docs/.toolingdocs` verschoben. Der manifestierte Pfad `docs/toolingdocs` wurde ohne
Inhaltsänderung wiederhergestellt, damit die vorhandenen Tooling-Gates nutzbar bleiben.

**2026-09-05 / P02:** Serde-`deny_unknown_fields` ist Teil des v1-Vertrags. Damit kann ein
erfolgreicher Roundtrip keine unbekannten Felder verlieren. Eine Zukunftsversion wird schon am
kleinen Dokumentkopf erkannt und erreicht weder normalen Decoder noch späteren Schreibpfad.

**2026-09-05 / P02:** Template-Katalogstatus und Freigabestatus wurden bewusst getrennt. Eine
aktive Vorlage kann gleichzeitig einen neuen Entwurf und mehrere unveränderliche Freigaben
besitzen; die Erstellung eines Entwurfs setzt eine veröffentlichte Revision nicht zurück.

**2026-09-05 / P03:** Dateiaustausch ist bewusst als gestuftes, vor und nach dem Schreiben
validiertes Verfahren beschrieben. Die Linux-Fehlerfälle sind belegt; eine allgemeine
plattformübergreifende Atomaritätszusage wäre ohne reale Windows-/macOS-Prüfung falsch.

**2026-09-05 / P03:** Ein belegter Writer führt zu einer sichtbaren Read-only-Sitzung. Andere
Schreibfehler werden gemeldet und niemals durch eine Ersatzablage kaschiert.

**2026-09-05 / P04:** `labels.json` ist ein versionierter Katalog mit stabilen Label-Objekten.
Beim Entfernen eines Workspace-Labels werden Projekt- und Filterreferenzen vor dem Katalogeintrag
bereinigt; Projekte selbst werden weder gelöscht noch über sichtbare Namen referenziert.

**2026-09-05 / P05:** Ansichts-Transforms sind lokale, richtungsbezogene Grundposen. Das
`base_transform` eines Slots ist ausschließlich der identische Südansicht-Fallback; Renderer
dürfen beide Werte nicht addieren. Dieser Vertrag verhindert schon vor P07 doppelte Offsets.

**2026-09-05 / P05:** Ganzzahlige Skalierung allein garantiert keine exakte Figurenhöhe. Die
sechs vertikalen anatomischen Segmente verteilen deshalb Abrundungsreste stabil nach größtem
Rest. Die Tests prüfen jede erlaubte Höhe von 16 bis 512 px; Haare bleiben bewusst außerhalb der
gemessenen anatomischen Höhe.

**2026-09-05 / P06:** Der Katalogstatus einer Vorlage reicht nicht aus, um unpublizierte Arbeit
anzuzeigen. Der Entwurf speichert deshalb zusätzlich die zuletzt freigegebene Entwurfsrevision;
spätere Bearbeitungen lassen die bestehende unveränderliche Freigabe intakt und markieren die
Karte wieder nachvollziehbar als Entwurf.

**2026-09-05 / P06:** Mehrere kompatible NPCs sind ein normaler Zustand. Die Auflösung liefert
alle Kandidaten an die Oberfläche und öffnet nur bei einer ausdrücklich gewählten Figur eine
bestehende Bindung; der Dummy bleibt immer als sichtbarer, deterministischer Weg erreichbar.

**2026-09-05 / P07:** Die Profil-/Bewegungshierarchie und bildlokales Fitting sind getrennte
Transformstufen. Nur Profil und gesampelte Bewegung werden an Kinder vererbt; Fitting und lokaler
Binding-Override verändern das konkrete Sprite. Dadurch bleibt dieselbe Bewegung für verschieden
zugeschnittene NPC-Teile wiederverwendbar.

**2026-09-05 / P07:** Pixelzentren liegen auf halben Koordinaten. Erst das inverse Sampling des
fertigen Welttransforms verwendet `floor`; auch negative Koordinaten werden deshalb ohne
stufenweise Rundungsdrift reproduzierbar abgeschnitten.

**2026-09-05 / P08:** Ein Bereich kann nach dem Anlegen einer Bewegung bereits eine neuere
Profilrevision besitzen. Der Editor darf deshalb nicht das aktive Bereichsprofil verwenden,
sondern löst immer exakt `draft.profile_ref` auf; ein Reopen-Test belegt den unveränderten Snapshot.

**2026-09-05 / P08:** Auswahlgriffe müssen dieselbe Elternmatrix wie der Compositor verwenden,
aber die inverse Pivotverschiebung als lokale Overlay-Geometrie behandeln. So folgen Kinder ihrem
bewegten Elternteil, während Raster, Namen, Fokus und Pivotmarker garantiert keine Nutzpixel sind.

**2026-09-05 / P08:** Der zunächst einzelne Pose-Arbeitsstand wird als spärliche Frame-0-Tracks
gespeichert. Richtungen und nicht vom Pose-Inspector bearbeitete Trackeigenschaften bleiben beim
Roundtrip erhalten; P09 erweitert denselben Vertrag auf eine vollständige Timeline.

**2026-09-05 / P09:** Ein Loop besitzt weiterhin genau `N` ausgebbare Frames. Der Sampler darf
am letzten Index zum gedachten Anfang bei `N` interpolieren, erzeugt aber nie ein dupliziertes
Abschlussbild. Halten, kontinuierliche Werte und diskrete Eigenschaften bleiben getrennt.

**2026-09-05 / P09:** Richtungswechsel und Timeline-Aktionen dürfen keine getrennten
Speicherinseln bilden. Die History umfasst deshalb den vollständigen Entwurf; ein einziger
serialisierter Save-Drain vergleicht Inhalte aller Richtungen und reiht Änderungen ein, die
während eines laufenden CAS-Writes entstehen.

**2026-09-05 / P09:** Bildschirmpixel sind unter einem gedrehten Elternteil keine lokalen
Bewegungspixel. Der Overlay-Editor invertiert dessen lineare Weltbasis und bewegt bei gemeinsam
ausgewähltem Eltern-/Kind-Paar nur die oberste Auswahlwurzel, damit die Compositormatrix erhalten
bleibt.

**2026-09-05 / P10:** Der P09-Sampler liefert absichtlich die explizite Quellpose, bevor P10
Anatomie, Zielprofil und Zielschichten auflöst. Damit existiert genau eine richtungsbezogene
Integrationsgrenze: Vorschau und spätere Exporte adaptieren den Sampler auf `DirectionalPose` und
lassen alle Spiegelentscheidungen vom `DirectionResolver` treffen.

**2026-09-05 / P10:** Ein Asset-Fallback darf nicht aus der Pose-Spiegelung abgeleitet werden.
Selbst bei einer gespiegelten Pose gewinnt ein exaktes Zielasset. Das Spiegeln eines Quellassets
benötigt eine slot-, richtungs- und variantenspezifische Freigabe sowie das Asset-Metadatum
`sprite_mirroring_allowed`. Die persistente Ablage solcher Freigaben wird mit den gerichteten
Appearance-Zuordnungen in P12/P13 verbunden.

**2026-09-05 / P10:** Abgeleitete Richtungen bleiben abspielbar, dürfen aber keine wirkungslosen
Zieltracks sammeln. Die Oberfläche sperrt deren Pose-/Timeline-Mutationen, bis der native
Detach-Adapter alle Quelltracks in einer gemeinsamen History-Aktion anatomisch gespiegelt hat.

**2026-09-05 / P11:** Ein prozeduraler Helper ist gespeicherte Quelldaten, kein unsichtbarer
Vorschau-Effekt. Der Sampler addiert ihn deterministisch auf normale Tracks; das Baking sampelt
alle Ausgabeindizes in die fünf expliziten Quellen und entfernt erst danach den Helper. Dadurch
bleiben auch die drei P10-Ableitungen pixelgleich und der Vorgang ist normal per History umkehrbar.

**2026-09-05 / P11:** Der Schatten ist keine erfundene siebzehnte Anatomiekomponente. Er wird als
eigene optionale Presetsemantik hinter den Körper compositiert und ausschließlich am Bodenanker
positioniert. Externe Sprunghöhe deaktiviert die Kurve für das Bild, bewahrt sie aber als
Metadatum; so kann das Zielspiel sie verwenden, ohne den Versatz doppelt anzuwenden.

**2026-09-05 / P11:** Eine Kartenminiatur darf weder einen zweiten Renderer noch eine dauerhafte
Bibliotheks-Tickschleife einführen. Sichtbarkeit löst eine begrenzte Sampleanforderung aus; der
Cache-Key enthält kanonische effektive Daten statt Zeitstempel. Hover/Fokus takten nur bereits
geladene PNGs, Reduced Motion fordert genau ein statisches Sample an.

**2026-09-05 / P12:** Ein DOM-`File` ist in einer gebündelten WebView keine belastbare portable
Dateisystemreferenz. Der produktive Drop-Pfad verwendet deshalb das native Tauri-WebView-Ereignis
mit explizit gewählten lokalen Pfaden. Die UI darf diese nur zur Inspektion weiterreichen; weder
externe Pfade noch das Importpaket werden als autoritative Referenz gespeichert.

**2026-09-05 / P12:** „Original erhalten“ und „Bild unverändert verwenden“ sind zwei getrennte
Aussagen. Jede Revision bewahrt die ausgewählte Datei beziehungsweise das vollständige Sheet
bytegleich als `original.png`; `source.png` bleibt bei normaler Übernahme bytegleich oder ist ein
ausdrücklich bestätigter Ausschnitt, transparentes Padding oder Nearest-Resampling. Nur dessen
Hash gehört zur effektiv verwendeten Assetrevision.

**2026-09-05 / P13:** Eine richtungsspezifische `AssetRevision` kann mit dem bisherigen einzelnen
`SlotAppearance.asset` weder Bildwahl noch Pivot für alle acht Ansichten ausdrücken. Der v1-Vertrag
wurde deshalb additiv erweitert: `OutfitDraft.fittings` speichert Slot, Richtung, Bild, Pivot,
Fitting, Sichtbarkeit und Layer; `DirectionFit` kann Bild und Pivot pro Richtung überschreiben.
Eine `variant_fittings`-Liste hält weitere durch diskrete Motion-Keys gewählte Bilder und Pivots,
ohne den richtungsweiten Transform doppelt zu speichern. Alte Dokumente bleiben durch
Serde-Defaults lesbar.

**2026-09-05 / P13:** Eine ausdrücklich genehmigte horizontale Asset-Spiegelung wird als
`asset_fallback_approvals` persistiert. Ein materialisiertes Ziel-Fitting enthält bereits
zielrichtungsbezogene Geometrie; deshalb spiegelt der Renderer dort nur das Quellbitmap. Nur alte
Fallbacks ohne Ziel-Fitting spiegeln zusätzlich Quellpivot und -transform. Neu zugewiesene oder
neu freigegebene Quellen müssen aktiv und veröffentlicht sein; bestehende Pins bleiben nach einer
Archivierung benannt, renderbar und feinjustierbar.

**2026-09-05 / P13:** Dummy-Kontur und Auswahlgriff sind DOM-/SVG-Overlays über dem RGBA-Canvas.
Der native Preview-Command liefert die aus derselben Eltern-/Motionmatrix berechneten Guide-
Matrizen getrennt von den RGBA-Bytes und bestätigt `guides_included: false`; dadurch können
Editorhilfen nicht versehentlich Teil der Renderausgabe werden. Der fachliche P11-Bodenschatten
bleibt dagegen ein am Bodenursprung verankerter Compositor-Part in der Outfit-Vorschau.

**2026-09-05 / P13:** Erster NPC-Save und Existing-NPC-Apply verwenden keine behauptete
Verzeichnisatomarität. Sie validieren und stagen einzelne JSON-Dokumente, pinnen vorhandene
Revisionen zusätzlich per SHA-256, veröffentlichen nur die tatsächlich geänderten Scopes in
Journalreihenfolge und markieren partielle Crashfenster für die P18-Recovery.

**2026-09-05 / P14:** Der provisorische v1-Vertrag hatte bereits ein einzelnes Equipmentstück auf
der obersten Ebene. Mehrteilige Objekte wurden deshalb additiv als `additional_parts` modelliert;
das oberste Stück bleibt das Primärteil. Alte v1-Dateien bleiben lesbar, während jedes neue starre
Teil eine eigene stabile Identität, Richtungsausstattung und Bewegungsfreigabe besitzt.

**2026-09-05 / P14:** Ein gespeicherter Bewegungstrack ist nicht gleich wirksame Bewegung. Teil,
Richtung, Eigenbewegung und Track besitzen getrennte Gates; der Sampler gibt bei jedem inaktiven
Gate die Identität zurück. Dadurch bleiben Werte für spätere Reaktivierung erhalten, ohne im
Renderer Phantomversätze zu erzeugen.

**2026-09-05 / P15:** P14-Equipment lebt im gemeinsam verwendeten Aussehen, seine optionalen
Bewegungsschlüssel beziehen sich aber auf konkrete Frameindizes. Bei mehreren Bindings kann eine
kürzere Motionrevision deshalb nicht ohne semantische Entscheidung übernommen werden. P15 lehnt
solche Zuordnungen und Updates sichtbar ab; es gibt weder Abschneiden noch automatische
Zeitachsenumrechnung.

**2026-09-05 / P15:** Revisions- und Prüfmetadaten sind nicht automatisch visuelle Quellen. Der
vorbereitete Export-Fingerabdruck enthält nur festgehaltene Profile, Motion- und Bildrevisionen,
Fittings, Equipment sowie lokale Overrides. Eine neue ungenutzte Vorlagenrevision oder eine reine
Freigabeaktion macht einen vorhandenen Export daher nicht fälschlich veraltet.

**2026-09-05 / P16:** Ein Verzeichnis mit dem neuesten Zeitstempel ist keine verlässliche
Exportquelle. Das Dashboard folgt ausschließlich einem vollständig validierten `current.json`,
prüft Manifest, Artefakte und den aus den derzeit effektiv verwendeten Quellen neu berechneten
Fingerabdruck. Verwaiste oder beschädigte Builds können dadurch weder `Current` noch `Stale`
vortäuschen.

**2026-09-05 / P16:** Ein ausdrücklich unvollständiger Testexport ist kein alter vollständiger
Build. Fehlende Richtungen, Bilder oder Quellteile werden normalisiert in Fingerabdruck und
Manifest aufgenommen, `complete` bleibt falsch und der NPC-Status bleibt `Stale`. Hash-,
Decodierungs- und Maßfehler werden niemals als bloß fehlend herabgestuft.

**2026-09-05 / P16:** UI-Abbruch allein beendet keinen nativen CPU-Job. Eine sitzungsgebundene
Registry besitzt deshalb das Cancellation-Flag und hält den terminalen Zustand sowohl für frühe
Desktop-Ereignisse als auch für Polling bereit. Navigation wartet auf die native Bestätigung,
statt nur den Dialog zu schließen.

**2026-09-05 / P17:** Ein bereits vorhandenes Verzeichnis mit passendem Fingerabdruck ist noch
kein wiederverwendbares Godot-Paket. Manifest, deklarierte PNGs, `SpriteFrames`, optionale Szene
und Einbindungsanleitung werden erneut gelesen und bytegenau gegen die deterministische Ableitung
geprüft; Links, Sockets und fremde Dateien schließen Wiederverwendung aus.

**2026-09-05 / P17:** Der Flatpak-Sandbox-`/tmp` ist für einen per `flatpak-spawn --host`
gestarteten Godot-Prozess nicht derselbe Pfadraum. Der Wegwerftest liegt deshalb unterhalb des
Checkouts, isoliert trotzdem HOME/XDG vollständig und entfernt seine Daten beim Testende. So prüft
derselbe Harness sowohl einen direkten Binary-Aufruf als auch den tatsächlichen Host-Runner.

**2026-09-05 / P18:** Eine Lockdatei mit Zeitstempel ist keine Writer-Exklusivität. Der dauerhafte
Sibling-Guard hält deshalb einen echten exklusiven Betriebssystem-Lock; die JSON-Datei ist nur
diagnostische, tokengebundene Metadaten. Erst ein erfolgreich gelockter Guard beweist, dass eine
verwaiste oder beschädigte Metadatendatei überhaupt zur Übernahme angeboten werden darf.

**2026-09-05 / P18:** Ein Journalcursor allein beweist nach einem Prozessabbruch nicht, ob der
vorherige Rename bereits erfolgt ist. Plan- und Ergebnisdigests, Besitzeridentität und eine
Filesystem-Reconciliation entscheiden deshalb vor jeder Cursorbewegung. So bleiben Resume und
Rollback auch dann wiederholbar, wenn die Recovery selbst erneut unterbrochen wird.

**2026-09-05 / P18:** Workspace-Label-Entfernung ist fachlich global, verändert aber auch
Projektmanifeste. Ein globaler Koordinator darf die Reihenfolge festhalten; die tatsächlichen
Stages und Backups der Projektdateien müssen trotzdem unter dem jeweiligen `.project`-Eigentümer
liegen. Dadurch bleibt `.pixelforge-studio` global-only, ohne eine halb entfernte Labelreferenz zu
riskieren.

**2026-09-05 / P19:** Ein global synthetisch injiziertes Tab-Ereignis ist unter der geprüften
Wayland-/AT-SPI-Sitzung kein belastbarer Ende-zu-Ende-Nachweis. Der native Befund wird deshalb auf
tatsächlich beobachtete AT-SPI-Aktionen, Namen, Flächen und Fokus begrenzt. Fokusfalle,
Rückgabefokus, Escape, Shortcuts und Texteingabeschutz bleiben vollständig durch DOM-Tests belegt;
ein globaler Tab-Lauf wird nicht erfunden.

**2026-09-05 / P19:** Desktop-DPI und Pixelart-Skalierung brauchen getrennte Koordinatensysteme.
Der native Linux-Lauf belegt DPR 2; DPR 1,25 belegt nur die reine Geometrie für ganzzahlige
physische Pixel. Ohne einen zweiten nativen Lauf wäre eine weitergehende 125-%-Aussage falsch.

**2026-09-05 / P19:** 1000 eingebettete Data-URL-Thumbnails würden den IPC- und React-Bestand
unnötig aufblasen. Cursor-seitige Metadaten, getrennte hashgeprüfte 48-px-Thumbnails, sichtbare
Anforderung und gemeinsam gezählte `Arc`-Bitmaps halten Übersicht und Vorschau begrenzt, ohne die
RGBA-Golden-Semantik des Referenzcompositors zu verändern.

**2026-09-05 / P19:** Das Leeren der gesamten Inventarseite bei jedem Querywechsel ließ im realen
WebView das Suchfeld nach dem ersten Zeichen den Fokus verlieren. Die letzte gültige Metadatenseite
bleibt deshalb während der nächsten nativen Anfrage montiert; Kontext-, Query- und
Generationsprüfungen verhindern weiterhin, dass eine alte Antwort übernommen wird. Ein fokussierter
DOM-Test und kontinuierliche native Eingabe bis `Asset 0999` belegen die Korrektur.

**2026-09-05 / P20:** Ein erfolgreiches Tauri-Release-Executable beweist noch kein
Installationspaket. Erst der Paketinhalt des finalen DEB zeigte, dass die zunächst implizite
Iconauswahl die Linux-Symbole nicht vollständig enthielt. Eine explizite plattformübergreifende
Iconliste und der erneute Build schließen diese Lücke; Manifest, SHA-256 und Start-Smoke beziehen
sich nur auf das neu erzeugte Paket.

**2026-09-05 / P20:** Ein plattformübergreifender Befehlsplan ist keine native
Windows-/macOS-Abnahme. Die Matrix führt Build und Paketstart auf expliziten Betriebssystemrunnern
aus, doch ohne Push oder passende lokale Hosts bleiben diese Resultate blockiert und werden nicht
als PASS bezeichnet. Dasselbe gilt für den Devcontainer-Quellvertrag ohne verfügbaren
Docker-/Podman-Daemon.

**2026-09-06 / P21:** Der erste reale Durchlauf aus freigegebenen Motions in die Outfit-Erzeugung
deckte auf, dass der Snapshot-Scanner unterstützende `motion_draft`-JSON irrtümlich als
DomainDocument behandelte und Projektlabels nur in ihrem Katalog, nicht als einzelne Dateien
vorliegen. Die gemeinsame Storage-Pfadklassifizierung überspringt nun Supportdokumente; der
Outfitpfad lädt und validiert den projektbezogenen Labelkatalog ausdrücklich. Der vollständige
Lichterhain-Test schützt beide zuvor von isolierten Fixtures verdeckten Übergänge.

**2026-09-06 / P21:** 272 Beispielassets überschreiten absichtlich das harte Limit von 64
Einträgen pro Import. Der Generator zerlegt deshalb sein eigenes geprüftes Paket in fünf normale
Inspect-/Confirm-/Importläufe. Damit bleibt der Beispielweg innerhalb derselben Mengen- und
Bytegrenzen wie eine manuelle Desktopoperation, statt eine privilegierte Fixture-Abkürzung zu
verwenden.

**2026-09-06 / P22:** Ein Manifest-Hash allein wäre kein unabhängiger Nachweis, dass die
Desktopvorschau dieselben Pixel wie der Export zeigt. Der Abschluss-E2E dekodiert deshalb die
tatsächlich publizierten Atlas-PNGs, schneidet jedes deklarierte Rechteck aus und vergleicht alle
256 RGBA-Payloads mit dem öffentlichen Outfit-Previewservice. Der gleiche Lauf verwendet ein
fremdes, sichtbar wirksames Equipment als aktivierte Kontrolle und persistiert es anschließend
deaktiviert; so ist seine Abwesenheit in Pixeln und Manifestquellen positiv überprüfbar.

**2026-09-06 / P22:** Transitive Tauri-Locks enthalten plattformübergreifende Android-/WASM-
Pakete, und Systembibliotheken können harmlose SQLite-Texte enthalten. Eine rohe Repository- oder
Binärwortsuche würde daher falsche Architekturverstöße melden. Die finale Policy parst direkte
Cargo-/npm-Abhängigkeiten und Tauri-Konfiguration strukturiert und sucht in Produktquellen nur nach
ausführbaren Prozess-/Sidecar- und konkret emittierten Godot-Konstrukten.

## Decision Log

| ID | Entscheidung | Begründung |
| ADR-001 | Tauri 2/Rust mit Vite/React/TypeScript auf dem vorhandenen `desktop-local`-Profil; Godot nur als Exportziel. | Entspricht dem tatsächlichen Tooling-Template und der ausdrücklichen Nutzerkorrektur. |
| ADR-002 | Vordefinierte starre Cutout-Teile mit Keyframes. | Keine manuelle Rig-Einrichtung, trotzdem wenige zu bearbeitende Posen. |
| ADR-003 | Vorlagen, NPC-Aussehen und Zuordnungen trennen. | Dieselbe Bewegung für mehrere Figuren wiederverwenden. |
| ADR-004 | JSON/PNG in gewöhnlichen Vault-Ordnern, kein SQL. | Explizite Nutzeranforderung und portable, nachvollziehbare Quellen. |
| ADR-005 | PNG-Sheets + JSON als Standard, Godot-Ressourcen zusätzlich. | Engine-unabhängige Basis und einfache Godot-Einbindung. |
| ADR-006 | Unveränderliche Freigaberevisionen und explizite Updates. | Bestehende NPCs und Exporte nicht unbemerkt verändern. |
| ADR-007 | Gemeinsamer Sampler und prüfbarer Referenz-Rasterer. | Vorschau und Ausgabe sollen dieselben Pixel ergeben. |
| ADR-008 | Workspace-Ordnername .pixelforge-studio bleibt fest. | Gewünschte globale Ablage, getrennt vom Produktbranding. |
| ADR-009 | Rust-JSON-Vertrag v1 ist autoritativ; TypeScript spiegelt DTOs, und unbekannte Felder werden abgewiesen. | Verhindert konkurrierende Validatoren und verlustbehaftete Roundtrips; Zukunftsversionen bleiben unangetastet. |
| ADR-010 | Humanoid v1 wird deterministisch aus Referenzhöhe und festen Ansichtsrezepten generiert; jede publizierte Größe ist ein neuer Snapshot. | Exakte ganzzahlige Geometrie ist reproduzierbar, benötigt kein manuelles Skelett und verändert gepinnte Bewegungen nicht rückwirkend. |
| ADR-011 | Pose-, einzelnes Asset- und Gesamtbild-Spiegeln sind drei getrennte APIs; Asset-Fallbacks benötigen eine ausdrückliche Freigabe. | Bewahrt anatomische Links-/Rechts-Identität und verhindert, dass asymmetrische Ausstattung still die Hand oder Richtung wechselt. |
| ADR-012 | Preset-Helper sind versionierte additive Quelldaten; Kartenvorschauen verwenden gespeicherte Samples und einen inhaltsadressierten Byte-LRU. | Helper bleiben sichtbar, abschaltbar und bakebar, während Karten und Editor nach Änderungen denselben Pixelpfad zeigen, ohne alle Karten permanent zu rendern. |
| ADR-013 | Asset-Import ist ein zweistufiger Inspect/Confirm-Vorgang; externe Originale und effektive Revisionsbilder sind getrennt. | Dateinamensvorschläge bleiben überprüfbar, Größenänderungen nie still, und die Vault speichert ausschließlich portable Bereichspfade plus Inhalts-Hashes. |
| ADR-014 | Richtungsbild und Pivot werden im Outfit-Fitting und optional in `DirectionFit` gespeichert; `SlotAppearance.asset` bleibt kompatibler Basis-Fallback. | P12 importiert ein Bild je Slot und Richtung. Nur ein richtungsfähiger Vertrag kann Bildwahl und Feinschliff ohne stille Kopien persistieren. |
| ADR-015 | Diskrete Spritevarianten ergänzen ein Richtungs-Fitting additiv um variantenspezifisches Bild und Pivot; Transform, Sichtbarkeit und Layer bleiben richtungsweit. | Ein Motion-Key muss das importierte Variantenbild tatsächlich wechseln, ohne die deterministische Defaultwahl oder alte v1-Dokumente aufzubrechen. |
| ADR-016 | Outfit-Mutationen halten den nativen Vault-Writer-Lock über Lesen, Prüfen und die vollständige journalisierte Veröffentlichung; Existing-NPC-Basen pinnen Revision und Inhalts-Hash. | Ein nur pro Einzelwrite gehaltener Lock ließe konkurrierende Befehle zwischen Prüfung und CAS eintreten; gleiche Revision mit extern geänderten Bytes darf ebenfalls nicht überschrieben werden. |
| ADR-017 | Ein Equipmentobjekt behält sein Primärteil und ergänzt weitere starre Teile additiv; `slot` und Figuren-`root` sind die einzigen wirksamen Mitführmodi. | Bewahrt schema-v1-Lesbarkeit, lässt große Kleidung ehrlich segmentieren und vermeidet neue Anatomieslots oder unkontrollierte Weltkoordinaten. |
| ADR-018 | Binding-Revisionen werden nur ausdrücklich übernommen; vorhandene Equipment-Keys müssen vollständig in den Ziel-Framebereich passen. | Bewahrt reproduzierbare NPCs und verhindert stilles Abschneiden oder ungefragtes Retiming gemeinsam genutzter Ausrüstung. |
| ADR-019 | Exportaktualität wird aus einem kanonischen Fingerabdruck der effektiv festgehaltenen Quellen abgeleitet, nicht aus dem jeweils neuesten Katalogstand oder Prüfmetadaten. | Ungenutzte Releases und reine Freigaben dürfen einen visuell unveränderten Build nicht als veraltet markieren. |
| ADR-020 | Generische Builds werden in einem inhaltsadressierten, verwalteten NPC-/Binding-Ziel veröffentlicht; nur ein validiertes `current.json` bezeichnet den aktuellen Stand. | Verhindert beliebige IPC-Schreibpfade, verwaiste Build-Auswahl und die Beschädigung des letzten guten Exports durch Abbruch oder einen fehlerhaften neuen Build. |
| ADR-021 | Ein Godot-Job baut zuerst den unveränderlichen generischen Build und das vollständige abgeleitete Paket; erst danach darf derselbe Job `current.json` publizieren. | Ein fehlgeschlagenes oder abgebrochenes Engine-Paket darf keinen nur teilweise erfolgreichen Gesamtzustand als aktuell markieren; sichere inhaltsadressierte Orphans bleiben wiederverwendbar. |
| ADR-022 | Mehrdatei-Mutationen verwenden einen eigentumsgeprüften, digest-versiegelten Journalplan; Writer-Exklusivität kommt aus einer OS-Dateisperre, nicht aus Alter oder Existenz der JSON-Metadaten. | Verhindert falsche Atomaritätszusagen, stille Übernahme aktiver Vaults und unprüfbare Recovery nach einem Rename-vor-Cursor-Crashfenster. |
| ADR-023 | Große Inventare liefern cursorbasierte Metadatenseiten und getrennte sichtbarkeitsgeladene Thumbnails; Vorschau und Quellbitmaps teilen einen exakt gezählten 256-MiB-LRU, Importjobs besitzen harte Mengen-/Bytebudgets und einen nativen Abbruchzustand. | Verhindert unbegrenzte IPC-/React-Payloads und gleichzeitig dekodierte Bilder, ohne einen zweiten Rasterer oder eine neue Beschleunigungsabhängigkeit einzuführen. |
| ADR-024 | Native Pakete sind zunächst unsignierte, kurzlebige Testkandidaten; jeder Host baut frisch, prüft reguläre repositorygebundene Artefakte, schreibt SHA-256-Evidenz und startet den Paketpayload mit isoliertem Nutzerzustand. | Trennt reproduzierbare technische Abnahme von Schlüsseln, Notarisierung und Veröffentlichung und verhindert, dass alte, fremde oder nutzerbehaftete Dateien als neuer Build gelten. |
| ADR-025 | Die Beispiel-Vault wird lokal in einem ausdrücklich leeren Ordner durch Komposition der Produktionsservices erzeugt und über dieselbe Tauri-Aktion auch der paketierten App angeboten; es wird keine mutable Binär-/Fixture-Vault eingecheckt. | Hält Pfad-, Import-, Revisions-, Lock-, Export- und Lizenzregeln im Lernweg wirksam, verhindert stille Überschreibung und macht den vollständigen Einstieg ohne Entwicklerwerkzeuge reproduzierbar. |
| ADR-026 | Die Endabnahme vergleicht öffentliche Previewframes mit dekodierten publizierten Atlasrechtecken und prüft Negativarchitektur über strukturierte direkte Verträge; Plattformbelege werden separat bewertet. | Verhindert zirkuläre Hashbelege und Fehlalarme aus transitiven Locks, während fehlende Windows-/macOS-Laufzeiten sichtbar offen bleiben. |
| ADR-027 | `StudioMode` liegt oberhalb der bestehenden `WorkspaceRoute`; der Prompt-Bereich besitzt mit `PromptView` eine getrennte Navigation. | Der Cutout-Router bildet einen kontextabhängigen Vault-Workflow ab. Prompt-Dashboard, Profile, Wizard, Ausgabe und Einstellungen sind ein unabhängiger App-Bereich und dürfen diesen Zustand nicht zurücksetzen. |
| ADR-028 | Der PixelForgeStudio-Prompt-Bereich wird in `frontend/src/prompt-studio/` isoliert portiert; äußere PixelForge-Shell und Animationsstudio bleiben ausgeschlossen. | Ermöglicht genau einen Tauri-Header und verhindert, dass gemeinsame Barrels oder globale Styles unnötige Animationsmodule und konkurrierende App-Wurzeln einziehen. |
| ADR-029 | Prompt-Arbeitsdaten liegen hinter einem Adapter nativ im Tauri-App-Datenverzeichnis; die Cutout-Übergabe verwendet einen versionierten DTO und eine ausdrückliche Nutzeraktion. | Der Generator muss ohne Vault funktionieren, während bestehende Vaults unverändert bleiben und Wizard sowie Cutout-Editoren nicht direkt voneinander abhängen. |
| ADR-030 | Der Cutout-View-Baum wird erst nach erfolgreichem Studio-Guard ausgehängt; seine stabilen Auswahl-IDs bleiben im App-Zustand. | Entspricht der bestehenden Verwerfen-Semantik der Editor-Guards, ohne Route, Vault, Projekt, Area oder Detailauswahl beim Wechsel zu verlieren. |
| ADR-031 | Der eingebettete Prompt-Root verwendet nur Settings-, Profil-, Navigations- und Wizard-Provider; Prompt-Theme und Reset leben ausschließlich unter `.prompt-generator-root`, und ein schmutziger Draft blockiert das Aushängen. | Verhindert eine zweite Anwendungshülle, globale CSS-Kollisionen und den Verlust eines noch nicht gültig autospeicherbaren Formularzustands. Native Adapter bleiben bewusst P26. |

Abweichungen während der Implementierung werden hier ergänzt, einschließlich betroffener Anforderungen, Migration, Testfolgen und erwogener Alternative.

## Validation

### Historischer Ausgangsstand vor P00

Die Planungsdateien wurden vor der Implementierung lokal auf Vollständigkeit der 23 Phasen,
gültige JSON-Syntax der erklärenden Ausschnitte, geschlossene Codeblöcke, auflösbare interne
Dateilinks und vollständige RQ-01–RQ-40-Abdeckung geprüft.

### Zu Beginn nicht ausgeführt

Zu diesem historischen Ausgangszeitpunkt waren weder Repository-Installation noch Produkttests,
Studio-App, PNG-Renderer, nativer Desktop-Build oder Godot-Import vorhanden. Das nachfolgende
Prüflog ersetzt diesen Anfangsbefund mit den tatsächlich ausgeführten Ergebnissen P00–P22.

### Prüflog für die Implementierung

| Datum / Phase                | Befehl oder manuelle Prüfung                                                                                                                                                                                                                 | Umgebung                                                                                                                                                                         | Ergebnis                                                                                                                                         | Beleg / offene Punkte                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-05 / P00             | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tools/tests/core tools/tests/adapters tools/tests/integration`                                                                                                              | Flatpak SDK, Python 3.13.15                                                                                                                                                      | PASS: 443 passed, 2 skipped                                                                                                                      | Produktprofil war zu diesem Zeitpunkt noch nicht aktiviert.                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-05 / P00             | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tests/source/test_repository_packaging_policy.py tests/source/test_workflow_contracts.py`                                                                                   | Flatpak SDK                                                                                                                                                                      | PASS: 16 passed                                                                                                                                  | Bestehende Source-Policy intakt.                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-05 / P00             | `python tools/control.py integrate --check --json`                                                                                                                                                                                           | Vor Produktkonfiguration                                                                                                                                                         | Erwartete Ausgangsfehlermeldung                                                                                                                  | `docs/toolingdocs` war durch das eingespielte Paket verschoben; P00 stellte den Pfad wieder her.                                                                                                                                                                                                                                                                                                                  |
| 2026-09-05 / P00             | `python tools/control.py docs check --docs-dir docs`                                                                                                                                                                                         | Vor Dokumentintegration                                                                                                                                                          | Erwartete Ausgangsfehlermeldung: 41 Befunde                                                                                                      | Fehlende Backlinks/Indizes werden in P00 ergänzt.                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-05 / P00             | `PYTHONDONTWRITEBYTECODE=1 python tools/control.py docs check --docs-dir docs`                                                                                                                                                               | Nach Dokumentintegration                                                                                                                                                         | PASS: 130 Seiten konsistent                                                                                                                      | Planpaket und portable Tooling-Dokumente sind gemeinsam indexiert.                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-05 / P00             | vollständiges `tools/tests`                                                                                                                                                                                                                  | Flatpak SDK                                                                                                                                                                      | Nach 7m35s abgebrochen: 6 passed, 11 failed                                                                                                      | Acceptance-Fixtures konnten ihre Build-Aktion nicht starten, weil npm im SDK-PATH fehlt; Host-Toolchain wird ab P01 kontrolliert angebunden.                                                                                                                                                                                                                                                                      |
| 2026-09-05 / P00             | Native Studio-, Windows- und macOS-Tests                                                                                                                                                                                                     | Nicht verfügbar                                                                                                                                                                  | Nicht ausgeführt                                                                                                                                 | Vor P01 existiert keine App; Plattformmatrix folgt in P20.                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-05 / P01             | `npm test`, `typecheck`, `lint`, `format:check`, `build`                                                                                                                                                                                     | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 7 Tests, Typecheck/Lint/Format und Vite-Produktionsbuild                                                                                   | Headless-Shell, Navigation, Dialog, Fokus und Shortcut-Schutz belegt.                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-05 / P01             | Cargo test, check, Clippy und rustfmt mit Lockfile                                                                                                                                                                                           | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 3 Tests und alle Compiler-/Lint-Gates                                                                                                      | Produktions-Composition-Root wird auch vom Mock-Runtime-Smoke verwendet.                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-05 / P01             | `tools/control.py tauri test --cargo --build-dry-run`                                                                                                                                                                                        | Linux-Host                                                                                                                                                                       | PASS                                                                                                                                             | Struktur, echtes Cargo-Gate und Linux-Buildplan über den zentralen Einstieg belegt.                                                                                                                                                                                                                                                                                                                               |
| 2026-09-05 / P01             | relevante Source- und Tauri-Tooling-Tests                                                                                                                                                                                                    | Linux-Host, Python 3.14.7                                                                                                                                                        | PASS: 9 passed, 2 erwartete Profil-Skips; 161 passed                                                                                             | AST-/ESLint-/Capability-/Dokumentationspolicy sowie portable Tauri-Verträge aktiv.                                                                                                                                                                                                                                                                                                                                |
| 2026-09-05 / P01             | `tools/control.py quality architecture` und `quality lint`                                                                                                                                                                                   | Linux-Host                                                                                                                                                                       | PASS                                                                                                                                             | TypeScript-AST, Schichten, Python/TS/Rust-Lint und Compiler grün. Das historische Gesamt-`quality` bleibt wegen bereits vorhandener Größen-/Formatbefunde im portablen Tooling offen.                                                                                                                                                                                                                             |
| 2026-09-05 / P01             | nativer Tauri-Start und Sichtprüfung                                                                                                                                                                                                         | KDE Wayland, 125 % Skalierung                                                                                                                                                    | PASS bei 1440×900 und 1280×720                                                                                                                   | Pflichtaktionen, Statusleiste und Navigation sichtbar; Screenshots liegen nur im ignorierten lokalen Prüfbericht. Windows/macOS bleiben bis P20 offen.                                                                                                                                                                                                                                                            |
| 2026-09-05 / P02             | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt                                                                                                                                                                                    | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 11 Tests                                                                                                                                   | 15 positive Fixtures für 14 Dokumentarten runden konsistent; Graph-, Zukunfts-, Zyklus-, Pfad-, Grenzwert-, Immutabilitäts- und Atlasfälle belegt.                                                                                                                                                                                                                                                                |
| 2026-09-05 / P02             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 11 Tests und alle Frontend-Gates                                                                                                           | Vier DTO-Vertragstests belegen Header-/Versions-, UUID-, Richtungs-, Pfad-, Zustands- und Identitätsspiegelung.                                                                                                                                                                                                                                                                                                   |
| 2026-09-05 / P02             | `tools/control.py quality architecture` und `quality lint`                                                                                                                                                                                   | Linux-Host, Python 3.14.7                                                                                                                                                        | PASS                                                                                                                                             | TypeScript-Schichten sowie Python-, TS- und Rust-Prüfungen bleiben intakt.                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-05 / P02             | `tools/control.py docs check --docs-dir docs`                                                                                                                                                                                                | Linux-Host                                                                                                                                                                       | PASS: 132 Seiten konsistent                                                                                                                      | Formatdokumentation und Navigation sind vollständig verknüpft.                                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-05 / P03             | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt                                                                                                                                                                                    | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 23 Tests                                                                                                                                   | 12 Vault-/Storage-Integrationstests plus bestehende Domain-/Composition-Tests; fremd/beschädigt, Lock, CAS, Write-Failure, Rechte, Journal und Symlink belegt.                                                                                                                                                                                                                                                    |
| 2026-09-05 / P03             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 14 Tests und alle Frontend-Gates                                                                                                           | Nativer Dialogfluss, Zweitbestätigung, beschädigter Vault und App-Übergang getestet.                                                                                                                                                                                                                                                                                                                              |
| 2026-09-05 / P03             | `tools/control.py quality architecture`, `quality lint`, `integrate --check` und Docs-Check                                                                                                                                                  | Linux-Host, Python 3.14.7                                                                                                                                                        | PASS                                                                                                                                             | Speicher- und UI-Schichten bleiben in den Tooling-Grenzen; 134 Dokumentseiten konsistent.                                                                                                                                                                                                                                                                                                                         |
| 2026-09-05 / P04             | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt                                                                                                                                                                                    | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 27 Tests                                                                                                                                   | Vier neue temporäre Vault-Tests belegen CRUD, Reopen, IDs, Filter, Labelreferenzen, Trash und Read-only-Schutz.                                                                                                                                                                                                                                                                                                   |
| 2026-09-05 / P04             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 21 Tests und alle Frontend-Gates                                                                                                           | Dashboard-Einstieg, Kartenaktionen, Suche, Dropdowns, any/all, Fokus, Reset, Labelverwaltung und Read-only-Zustand belegt.                                                                                                                                                                                                                                                                                        |
| 2026-09-05 / P04             | `tools/control.py quality architecture`, `tauri test --cargo --build-dry-run`, `integrate --check --json` und Docs-Check                                                                                                                     | Linux-Host                                                                                                                                                                       | PASS                                                                                                                                             | TypeScript-AST parst 41 Dateien, Architekturgrenzen bleiben intakt, der Cargo-/Tauri-Plan ist grün und 134 Dokumentseiten sind konsistent.                                                                                                                                                                                                                                                                        |
| 2026-09-05 / P04             | vollständige `tests/source` und zentrales `quality lint`                                                                                                                                                                                     | Linux-Host, Python 3.13.15                                                                                                                                                       | OFFEN: 30 passed, 2 skipped, 4 failed; Quality-Lint FAIL                                                                                         | Die Source-Suite erwartet teils noch die P01-Capability ohne den seit P03 benötigten Dialog und hat drei versionsabhängige ESLint-/AST-Fixturefehler. Der zentrale Lint scannt fälschlich `.tooling-state/venv` und nutzt für Tauri-Makros das inkompatible `-F warnings`; die direkten Produktgates ESLint, TypeScript und Clippy `-D warnings` bestehen.                                                        |
| 2026-09-05 / P05             | fokussierte Generator-, Fixture- und `area_profiles`-Tests                                                                                                                                                                                   | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 8 P05-Tests                                                                                                                                | Referenzprofil 80 px, alle 497 erlaubten Höhen, Spiegelung, Persistenz/Reopen, Labels, Read-only und unveränderte alte Snapshot-Bytes belegt.                                                                                                                                                                                                                                                                     |
| 2026-09-05 / P05             | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt                                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 31 Tests                                                                                                                                   | Alle Domain-, Storage-, Composition- und neuen Bereichstests grün.                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-05 / P05             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 18 Tests und alle Frontend-Gates                                                                                                           | Vier Area-Dashboard-Tests belegen 16-Slot-Vorschau, acht Richtungsoptionen, Erzeugung, Revision und fehlenden Projektkontext.                                                                                                                                                                                                                                                                                     |
| 2026-09-05 / P05             | `tools/control.py quality architecture`, `quality lint`, `integrate --check` und Docs-Check                                                                                                                                                  | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS im Phasenbranch                                                                                                                             | TypeScript-AST, Python/TS/Rust-Gates und Integration grün; 134 Dokumentseiten konsistent. Die Integration nach P04 wurde zusätzlich mit den Produktgates geprüft.                                                                                                                                                                                                                                                 |
| 2026-09-05 / P06             | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt                                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 39 Tests                                                                                                                                   | Vier neue Bibliothekstests belegen Entwurf/Freigabe, Timinggrenzen, Duplikat/Archiv/Entfernen, Mehrfach-NPC-Auswahl und Bindungsauflösung.                                                                                                                                                                                                                                                                        |
| 2026-09-05 / P06             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 29 Tests und alle Frontend-Gates                                                                                                           | Bibliothekskarten, Dropdownfilter, Dialogvalidierung, Kontextmenü, Dummy-Einstieg und explizite Figurenwahl sind abgedeckt.                                                                                                                                                                                                                                                                                       |
| 2026-09-05 / P06             | `tools/control.py quality architecture`, `integrate --check` und Docs-Check                                                                                                                                                                  | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS im Phasenbranch                                                                                                                             | Architektur- und Integrationsgrenzen bleiben intakt; 135 Dokumentseiten sind vollständig verknüpft. Der zentrale `quality lint` bleibt wegen seines bereits in P04 erfassten inkompatiblen Clippy-Flags `-F warnings` offen; das direkte Clippy-Gate mit `-D warnings` besteht.                                                                                                                                   |
| 2026-09-05 / P07             | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt                                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 47 Tests                                                                                                                                   | Acht Compositor-Goldentests prüfen vollständige RGBA-Frames, Alpha/Lagen, Hierarchie/Fitting, nichtnulligen Pivot, negative Koordinaten, Spiegelung, Clipping, Fehler und Bytewiederholung.                                                                                                                                                                                                                       |
| 2026-09-05 / P07             | fokussierter 128×128-Debuglauf mit `--nocapture`                                                                                                                                                                                             | Linux-Host                                                                                                                                                                       | PASS: zwei Frames in rund 0,33 ms                                                                                                                | Einzelne Diagnosemessung ohne allgemeines Leistungsversprechen; repräsentative Last folgt P19.                                                                                                                                                                                                                                                                                                                    |
| 2026-09-05 / P07             | Frontend-Gates, `quality architecture`, `integrate --check` und Docs-Check                                                                                                                                                                   | Linux-Host                                                                                                                                                                       | PASS                                                                                                                                             | Bestehende 29 Frontendtests bleiben grün, Architektur und Integration sind intakt; 136 Dokumentseiten konsistent.                                                                                                                                                                                                                                                                                                 |
| 2026-09-05 / P08             | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt                                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 52 Tests                                                                                                                                   | Editor-History, PNG-Decodierung, Elternbindung, Helper-Trennung, CAS-Speichern und Reopen mit veraltetem aktivem Bereichsprofil belegt.                                                                                                                                                                                                                                                                           |
| 2026-09-05 / P08             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 39 Tests und alle Frontend-Gates                                                                                                           | Richtungsposen, Mehrfachauswahl, Read-only-Inspektion, Sperren, Snapping, Undo/Redo, Fehlererhalt, echte Route und persistentes Reopen belegt.                                                                                                                                                                                                                                                                    |
| 2026-09-05 / P08             | `tools/control.py docs check`, `quality architecture` und `integrate --check --json`                                                                                                                                                         | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 137 Dokumentseiten konsistent, TypeScript-AST parst 65 Dateien und das Tauri-Desktopprofil bleibt vollständig integriert.                                                                                                                                                                                                                                                                                         |
| 2026-09-05 / P09             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 61 Tests und alle Compiler-/Formatgates                                                                                                    | Sieben Sampler-Goldens sowie Editor-/Service-Tests belegen Loopdauer, Reihenfolgeunabhängigkeit, 0/1/viele Keys, Winkelsprung, diskrete Werte, Retiming, Profilvalidierung und wiederholbares Sample-PNG.                                                                                                                                                                                                         |
| 2026-09-05 / P09             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 52 Tests und alle Frontend-Gates                                                                                                           | Timeline-Datenoperationen, Ganzentwurf-History, Geometrie, Auto-Key, Onion-Skin-Route, Save-Serialisierung und Navigation sind abgedeckt.                                                                                                                                                                                                                                                                         |
| 2026-09-05 / P09             | `tools/control.py docs check`, `quality architecture` und `integrate --check --json`                                                                                                                                                         | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 138 Dokumentseiten konsistent, TypeScript-AST parst 74 Dateien und das Desktopprofil bleibt integriert. Der zentrale `quality lint` bleibt bis zur geplanten P20-Korrektur wegen `.tooling-state`-Scan und inkompatiblem Clippy-`-F warnings` offen; direkte Produktgates bestehen.                                                                                                                               |
| 2026-09-05 / P10             | `cargo test --test direction_resolver --test editor_commands --test motion_library --locked`                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 23 Tests                                                                                                                                   | Fünf Quellen/acht Ziele, acht explizite Ziele, Zyklen, Front/Rückseite, Sampleradapter, Anatomie, Zielschichten, Hidden/Missing, Assetfehler, Detach, persistentes Release-Gate und asymmetrische RGBA-Goldens belegt.                                                                                                                                                                                            |
| 2026-09-05 / P10             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 76 Tests und alle Compiler-/Formatgates                                                                                                    | P09-Sampler, P07-Compositor, Richtungsresolver, Vault-Services und sämtliche früheren Verträge bleiben gemeinsam grün.                                                                                                                                                                                                                                                                                            |
| 2026-09-05 / P10             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 60 Tests und alle Frontend-Gates                                                                                                           | Acht Zustände, Dropdownänderung, Zyklusvermeidung, sichtbare Lücken, native Detach-Integration und abgeleitete Read-only-Bearbeitung sind abgedeckt.                                                                                                                                                                                                                                                              |
| 2026-09-05 / P10             | `tools/control.py docs check`, `quality architecture`, `integrate --check --json` und `tauri test --cargo --build-dry-run`                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 139 Dokumentseiten konsistent, TypeScript-AST parst 79 Dateien, Desktopprofil und nativer Linux-Buildplan sind intakt. Der zentrale `quality lint` bleibt bis P20 aus den in P09 dokumentierten Toolinggründen offen.                                                                                                                                                                                             |
| 2026-09-05 / P11             | `cargo test --test motion_presets --locked`                                                                                                                                                                                                  | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 9 Tests                                                                                                                                    | Sechs persistente Presets, alle Zielrichtungen, anpassbares Timing, Geschwindigkeitssemantik, Helper-Bake, Sprungbodenanker, getrennter Schatten, Clippingfreiheit, Inhaltsfingerprint, Byte-LRU und pixelgleiche Karten-/Editorframes belegt.                                                                                                                                                                    |
| 2026-09-05 / P11             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 87 Tests und alle Compiler-/Formatgates                                                                                                    | Presets, Sampler, gemeinsamer Compositor, Richtungsauflösung, Vault- und Bewegungsservices bleiben gemeinsam grün.                                                                                                                                                                                                                                                                                                |
| 2026-09-05 / P11             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 66 Tests und alle Frontend-Gates                                                                                                           | Sichtbarkeitsabhängiges Laden, reduzierte Bewegung, geführte Freigabe, Helpersteuerung, Cacheinvalidierung und die bestehende Editor-/Timelinebedienung sind abgedeckt; der Build umfasst 71 Module.                                                                                                                                                                                                              |
| 2026-09-05 / P11             | `tools/control.py docs check`, `quality architecture` und `tauri test --cargo --build-dry-run`                                                                                                                                               | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 140 Dokumentseiten konsistent, TypeScript-AST parst 85 Dateien und der native Linux-Buildplan bleibt intakt. Der zentrale `quality lint` bleibt bis zur P20-Toolingkorrektur wegen des `.tooling-state`-Scans und des inkompatiblen Clippy-Flags `-F warnings` offen; die direkten Produktgates bestehen.                                                                                                         |
| 2026-09-05 / P12             | `cargo test --test asset_import --test asset_inventory --locked`                                                                                                                                                                             | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 9 Tests                                                                                                                                    | Positives Paket, Sheet-Ausschnitt, lose PNG-Vorschläge, explizites Padding/Resampling, Revision, Alpha/Maße/Größe/Pfad-Gegenbeispiele, unverändertes externes Original, Nutzung, Archiv und vollständiges Wiederöffnen belegt.                                                                                                                                                                                    |
| 2026-09-05 / P12             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 96 Tests und alle Compiler-/Formatgates                                                                                                    | Native Commands, Vault-/Profilauflösung, Importer, Repository und alle bisherigen Sampler-/Compositorverträge bleiben gemeinsam grün.                                                                                                                                                                                                                                                                             |
| 2026-09-05 / P12             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 70 Tests in 24 Dateien und alle Frontend-Gates                                                                                             | Nativer Dialogadapter, Tauri-Drop, sichtbare Zuordnung, sechs Dropdownfilter, Größenwahl, Usage-Dialog, Archiv und Bereichseinstieg sind abgedeckt; der Build umfasst 82 Module.                                                                                                                                                                                                                                  |
| 2026-09-05 / P12             | `tools/control.py docs check`, `quality architecture`, `integrate --check --json` und `tauri test --cargo --build-dry-run`                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 141 Dokumentseiten konsistent, TypeScript-AST parst 93 Dateien, Desktopprofil und nativer Linux-Buildplan sind intakt. Der zentrale `quality lint` bleibt bis P20 aus den bereits dokumentierten Toolinggründen offen.                                                                                                                                                                                            |
| 2026-09-05 / P13             | fokussierte Outfit-, Domain-, Inventar- und Richtungsresolver-Tests                                                                                                                                                                          | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 42 Tests                                                                                                                                   | 16 echte Outfit-Workflows, 12 Dokumentverträge, drei Inventarfälle und elf Richtungsfälle belegen Entwurf/Wiederaufnahme, exakte Release- und Profil-Pins, Varianten, genehmigte Assetspiegelung, Vorschau, Transaktionssave, konfliktgeschütztes Apply und unveränderte ältere Referenzen.                                                                                                                       |
| 2026-09-05 / P13             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 118 Tests und alle Compiler-/Formatgates                                                                                                   | Die Outfitfälle wurden ohne Logikänderung in kleine Include-Dateien getrennt, damit auch der begrenzte portable WASI-Analyzer den realen Integrationsumfang zuverlässig verarbeitet.                                                                                                                                                                                                                              |
| 2026-09-05 / P13             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 88 Tests in 26 Dateien und alle Frontend-Gates                                                                                             | Explizite Zielwahl, wiederaufnehmbare Entwürfe, Archiv-Pins, Basis- und Variantenfitting, Undo/Redo, serialisiertes Autosave, Read-only und die Übergabe der exakt gewählten Release-Revision sind abgedeckt; der Build umfasst 92 Module.                                                                                                                                                                        |
| 2026-09-05 / P13             | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 141 Dokumentseiten konsistent, TypeScript-AST parst 105 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier schon seit P04 dokumentierten, versionsabhängigen Gesamt-Suite-Fixtureabweichungen bleiben bis zur P20-Toolingphase offen.                                                                                                                     |
| 2026-09-05 / P14             | `cargo test --test outfit_workflow --locked` und `cargo test --lib --locked animation::equipment`                                                                                                                                            | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 22 Workflow- und 3 Samplertests                                                                                                            | Sechs Equipment-Workflows belegen segmentiertes Oberteil, statischen Handschuh, Root-Mitführen, optionales Nachschwingen, verlustfreie deaktivierte Zustände, acht Richtungen, Asymmetrie/Überdeckung, Save-Vollständigkeit sowie Motion-Variante bis Appearance und Reopen.                                                                                                                                      |
| 2026-09-05 / P14             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 127 Tests und alle Compiler-/Formatgates                                                                                                   | Equipment bleibt ein starrer Compositor-Layer ohne Mesh-/Skinning-Abhängigkeit; P13-Resolver, Varianten, Fallback-Freigaben, Ground Shadow, Pins und Transaktionen bleiben gemeinsam grün.                                                                                                                                                                                                                        |
| 2026-09-05 / P14             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 94 Tests in 27 Dateien und alle Frontend-Gates                                                                                             | Vier Equipment-State- und 14 Outfit-Editor-Fälle decken mehrteilige Erzeugung, Additivvarianten, Assignability, getrennte Zustände, deaktivierte Track-Bedienung, Undo/Autosave und die bestehenden drei Modi ab; der Build umfasst 95 Module.                                                                                                                                                                    |
| 2026-09-05 / P14             | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 141 Dokumentseiten konsistent, TypeScript-AST parst 108 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier bekannten Gesamt-Suite-Fixtureabweichungen bleiben planmäßig bis P20 offen.                                                                                                                                                                    |
| 2026-09-05 / P15             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 137 Tests und alle Compiler-/Formatgates                                                                                                   | Zehn fokussierte Binding-Fälle sind in der Gesamtsuite enthalten und belegen Walk/Sprint/Jump, getrennte IDs, lokale Overrides, kompatible und inkompatible Revisionsangebote, tatsächliche Verzeichnisjournale, sichere Exportinventur, Duplikat, Rename und Reopen.                                                                                                                                             |
| 2026-09-05 / P15             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 103 Tests in 28 Dateien und alle Frontend-Gates                                                                                            | NPC-Dashboard, sechs strukturierte Dropdownfilter, gezielte Motion-/Richtungswahl, per-Binding-Drafts, Revisionsvergleich, Duplicate-Schutz und kontexttreue NPC-/Animationsnavigation sind abgedeckt; der Build umfasst 103 Module.                                                                                                                                                                              |
| 2026-09-05 / P15             | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 141 Dokumentseiten konsistent, TypeScript-AST parst 116 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier bekannten Gesamt-Suite-Fixtureabweichungen bleiben planmäßig bis P20 offen.                                                                                                                                                                    |
| 2026-09-05 / P16             | fokussierte Atlas-, Export-, Robustheits-, Profil- und echte NPC-Exporttests                                                                                                                                                                 | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 17 Tests                                                                                                                                   | Regelmäßige Mehrseitenatlanten, Extrusion, Budgets, gemeinsame Geometrie, Fingerprint, optionale Einzelbilder, atomarer Pointer, Abbruch, Profile sowie ein gespeicherter Multi-Action-/Acht-Richtungs-NPC sind belegt.                                                                                                                                                                                           |
| 2026-09-05 / P16             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 156 Tests und alle Compiler-/Formatgates                                                                                                   | Derselbe gespeicherte Outfit-/Equipment-Renderpfad speist Vorschau und Export; aktuelle/incomplete/korrupte Builds, reale PNG-Verifikation und Jobguards sind in der Gesamtsuite enthalten.                                                                                                                                                                                                                       |
| 2026-09-05 / P16             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 122 Tests in 32 Dateien und alle Frontend-Gates                                                                                            | Exportprofile, native Jobereignisse plus Polling, genau ein Abbruch, persistente Auswahl, Read-only, Navigation und Ausgabezustände sind abgedeckt; der Build umfasst 109 Module.                                                                                                                                                                                                                                 |
| 2026-09-05 / P16             | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | 142 Dokumentseiten konsistent, TypeScript-AST parst 125 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die breite Migration einer lokal neueren PyGitIndex-Version wurde nicht übernommen; nur der bestehende dokumentierte Indexvertrag wurde ergänzt.                                                                                                        |
| 2026-09-05 / P17             | fokussierte Godot-, Profil- und echte NPC-/Outfit-Tests                                                                                                                                                                                      | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 45 Tests                                                                                                                                   | Sechs Paketfälle und 36 reale Outfit-/NPC-Fälle belegen portable Ressourcen, optionale Szene, Byte-Reuse, Mutations-/Dateitypschutz, Abbruch, alten Pointer, Retry und den vollständigen P15→Godot-Pfad; drei Profilfälle belegen strikte neue Requests und lesbare alte Speicherstände.                                                                                                                          |
| 2026-09-05 / P17             | cachefreier Engine-Import über `flatpak-spawn --host /usr/bin/godot`                                                                                                                                                                         | Linux-Host, Godot `4.7.2.stable.arch_linux.ed1daf0bf`                                                                                                                            | PASS: 1 Test in 8.22 s                                                                                                                           | Isolierte HOME-/XDG-Pfade, Loop und Once, Scene und Resources-only, Namen, Frames, FPS, Atlasrechtecke, externe PNGs, sicherer Szenenbaum, Leerzeichen/Unicode sowie erneuter Import nach Verschieben und Cachelöschung sind tatsächlich geladen.                                                                                                                                                                 |
| 2026-09-05 / P17             | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt                                                                                                                                                                        | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 167 Tests, 1 explizit separat ausgeführter Godot-Test und alle Compiler-/Formatgates                                                       | Der vollständige Rust-Bestand bleibt grün; der normalerweise ignorierte Engine-Test wurde im vorigen Gate mit der exakt zugesicherten Version ausgeführt.                                                                                                                                                                                                                                                         |
| 2026-09-05 / P17             | `npm test`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                       | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 126 Tests in 32 Dateien und alle Frontend-Gates                                                                                            | Format-/Szenenwahl, Profilroundtrip, Vollständigkeitsgate, native snake_case-Daten, Godot-Fortschritt, atomarer Abbruchhinweis, verwaltete Ausgabe und Navigation sind abgedeckt; der Build umfasst 109 Module.                                                                                                                                                                                                   |
| 2026-09-05 / P17             | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests                                                                                                                   | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | Navigation für 90 vom bestehenden Index erfasste Dokumentseiten konsistent, TypeScript-AST parst 125 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen.                                                                                                                                                                                                            |
| 2026-09-05 / P18             | fokussierte Recovery-, Lock-, Migration-, Producer-, Konflikt- und Eigentumstests                                                                                                                                                            | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS                                                                                                                                             | Echte Servicepfade für Projekt-/NPC-Rename, Projekt-/Motion-Trash, Workspace-Label, Bereich/Profil, Motion-Save/Freigabe, konfigurierten Zwei-Asset-Import, Outfit/Binding, Exportprofil und finalen Exportpointer werden zwischen Filesystemschritten unterbrochen, neu geöffnet und per Resume sowie Rollback geprüft; ein echter Kindprozess belegt den zweiten Writer.                                        |
| 2026-09-05 / P18             | `cargo test --all-targets --locked`, `cargo check`, Clippy `-D warnings` und rustfmt                                                                                                                                                         | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 212 Tests, 1 vorgesehener Godot-Test ignoriert, alle Compiler-/Formatgates                                                                 | Sealed Plan-/Ergebnisdigests, idempotente Reconciliation, Scope-/Owner-Tampering, CAS, belegte Ziele, exakte Migrationsbackups, Zukunftsschema, fremde Bäume, Projektanlage-vor-Journal, Trash, Cache-Neuaufbau und verschobener kopierter Vault bleiben gemeinsam grün.                                                                                                                                          |
| 2026-09-05 / P18             | `npm test -- --run`, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                              | Host, Node 26.7.0 / npm 12.0.2                                                                                                                                                   | PASS: 150 Tests in 36 Dateien und alle Frontend-Gates                                                                                            | Exklusive Recovery-Ansicht, Opaque-ID-Aktionen, Orphan-Bestätigung, Live-Barriere, Recovery-Kopien, serialisierte Motion-/Outfit-Autosaves, Konflikt-Reload, Undo/Redo, Navigations-/Window-Gates und Freigabe-Blocking sind abgedeckt; der Build umfasst 112 Module.                                                                                                                                             |
| 2026-09-05 / P18             | `integrate --full-fix`, `integrate --check --json`, `docs check` und `quality architecture --format json`                                                                                                                                    | Linux-Host, Python 3.13.15                                                                                                                                                       | PASS                                                                                                                                             | Das Desktopprofil ist ohne offene Operation integriert, die Navigation für 90 Dokumentseiten ist konsistent und die TypeScript-AST-Prüfung parst 132 Dateien. Das bekannte vollständige `quality`-Toolingproblem mit dem Scan von `.tooling-state` sowie historischen Formatterbefunden bleibt wie geplant Gegenstand von P20; die direkten Produktgates sind grün.                                               |
| 2026-09-05 / P19             | reale native Desktop-/AT-SPI-Durchläufe bei 1280×720 und 1440×900 sowie Offline-Wiederholung                                                                                                                                                 | Ryzen 7 3700X, 62 GiB, RX-9070-Klasse, KDE Wayland, DPR 2; `unshare`-Netznamespace nur mit Loopback                                                                              | PASS im belegten Linux-Umfang                                                                                                                    | Pflichtaktionen und Status bleiben sichtbar, benannte AT-SPI-Aktionen/Fokus funktionieren und der lokale Kernworkflow benötigt kein Netzwerk. DPR 1,25 ist nur mathematisch getestet; globale synthetische Tab-Reihenfolge und Windows/macOS werden nicht behauptet. Der opt-in Frame-Probe fehlt im Default-Build.                                                                                               |
| 2026-09-05 / P19             | abschließender Post-Review-Großdatenlauf des aktuellen Release-Executables                                                                                                                                                                   | flüchtiger Debian-12-Container, echter Tauri-/WebKitGTK-Prozess, virtuelles X11-Display, DPR 1                                                                                   | PASS bei 1280×720 und 1440×900                                                                                                                   | 100 Projekte/1000 Assets/2103 Indexobjekte; Projektquery, sichtbare Thumbnails, Pagination 50→100, kontinuierlich fokussierte Suche nach `Asset 0999` und Dropdownsortierung `Name Z–A` funktionieren. Die erst auf der geladenen Zielansicht gestartete opt-in Probe meldet je 120 Samples mit p50 16,00 ms und p95/max 17,00 ms. Dieser Ergänzungslauf ersetzt keine Referenzhost-, AT-SPI- oder DPR-2-Evidenz. |
| 2026-09-05 / P19             | `performance_acceptance` explizit als Rust-Release-Hardwarelauf                                                                                                                                                                              | gleiches Referenzgerät                                                                                                                                                           | PASS                                                                                                                                             | 128×128/20 Teile, 360 kalte Raster: p50 0,038 ms, p95 0,045 ms, max 0,121 ms; 360 warme Cachezugriffe: p50/p95/max gerundet 0,000 ms; sieben vollständige 192-Frame-Exporte: p50 95,497 ms, p95/max 99,926 ms. Peak-RSS im Rasterlauf: 18.604 KiB. Keine daraus abgeleitete FPS-Zusage.                                                                                                                           |
| 2026-09-05 / P19             | `asset_scalability` mit 100 Projekten/1000 Assets explizit als Rust-Release-Hardwarelauf                                                                                                                                                     | gleiches Referenzgerät                                                                                                                                                           | PASS                                                                                                                                             | Öffnen p50/p95 147,898/150,962 ms; vollständige servergefilterte Inventarpagination 620,117/631,689 ms; 48-px-Thumbnails 5,560/6,577 ms; Viererimport 7,164/8,649 ms; Import plus Reopen/Index 155,005/170,314 ms; Abbruch 5,556/6,627 ms. Bei diesen Stichprobenzahlen entspricht p95 dem Maximum.                                                                                                               |
| 2026-09-05 / P19             | `cargo test --locked`, `cargo check --locked --all-targets`, Clippy `-D warnings` und rustfmt                                                                                                                                                | Abschluss-Container, Rust 1.97.1                                                                                                                                                 | PASS: 241 Tests, 4 vorgesehene Sonderläufe ignoriert und alle Compiler-/Formatgates                                                              | Zwei Hardwaremessungen, der gehaltene native Walkthrough-Fixturegenerator und der echte Godot-Test bleiben explizit separat; Cache-/Bytebudgets, Pagination, Jobabbruch, Pixel-Goldens und alle früheren Rust-Verträge sind in der normalen Suite grün.                                                                                                                                                           |
| 2026-09-05 / P19             | `npm test -- --run`, Typecheck, ESLint, Prettier und normaler Vite-Build                                                                                                                                                                     | Abschluss-Container, Node 24.19.0 / npm 11.17.0                                                                                                                                  | PASS: 177 Tests in 40 Dateien und alle Frontend-Gates                                                                                            | Der neue Fokusfall ergänzt Modalfokus, Shortcut-/Texteingabeschutz, Dropdownmodelle, Mindestlayout, Reduced Motion, DPR-Geometrie, Metadatenseiten, sichtbare Thumbnails sowie Importfortschritt/-abbruch; der Build umfasst 118 Module und keinen Probe-Marker.                                                                                                                                                  |
| 2026-09-05 / P19             | `tools/control.py docs check`, `quality architecture --format json`, `integrate --check --json` und `git diff --check`                                                                                                                       | Abschluss-Container                                                                                                                                                              | PASS                                                                                                                                             | 145 Dokumentseiten sind konsistent, die TypeScript-AST-Prüfung parst 142 Quelldateien, das Desktopprofil ist ohne offene Operation integriert und das Patchformat ist sauber. Die bekannten zentralen Toolingkorrekturen bleiben ausdrücklich P20.                                                                                                                                                                |
| 2026-09-05 / P20             | `tauri build --target linux --bundles deb`, SHA-256-/Inhaltsprüfung und `tauri smoke --target linux --startup-seconds 5`                                                                                                                     | flüchtiger Debian-12-Container, Linux x86_64, virtuelles X11                                                                                                                     | PASS: finales DEB mit 5.432.744 Bytes und SHA-256 `1e8d763e8bccfefd37f58d180804c4884004d84816c89a74366f67f79b1ce15d`; Paketpayload 5,045 s aktiv | DEB enthält Programm, Desktopdatei und drei Icongrößen, aber keine Vault, Secrets, Python- oder Godot-Laufzeit. Der Smoke extrahiert den Paketpayload und isoliert HOME/XDG.                                                                                                                                                                                                                                      |
| 2026-09-05 / P20             | finalen DEB-Payload bei 1440×900 starten und „Choose vault“ auslösen                                                                                                                                                                         | gleicher Container, Xvfb/Software-Rendering                                                                                                                                      | PASS im belegten Linux-Umfang                                                                                                                    | Das echte Studiofenster öffnet den nativen GTK-Dialog „Choose a PixelCutoutSprite vault“ bei 1096×822. Der Nachweis ist kein Windows-/macOS-Dialogtest.                                                                                                                                                                                                                                                           |
| 2026-09-05 / P20             | Produktions-Speichern-/Export-Smoke `authoritative_npc_export_renders_multiple_actions_and_current_pointer_controls_freshness`                                                                                                               | Linux-Host, Rust 1.97.1                                                                                                                                                          | PASS: 1 Test                                                                                                                                     | Ein gespeicherter NPC mit mehreren Aktionen durchläuft den Produktionsservice bis zum Export und aktuellen Pointer; Endnutzer benötigen keinen Python- oder Godot-Prozess.                                                                                                                                                                                                                                        |
| 2026-09-05 / P20             | native Windows-NSIS-/macOS-DMG-Befehlspläne und Studio-CI-Verträge                                                                                                                                                                           | Linux-Host ohne Windows/macOS; kein Push autorisiert                                                                                                                             | BLOCKIERT / nicht abgenommen                                                                                                                     | Exakte Dry-runs und 141 fokussierte Python-Vertragstests bestehen; tatsächliche Pakete, Starts und Dialoge warten auf die eingecheckte `windows-2025`-/`macos-15`-Matrix.                                                                                                                                                                                                                                         |
| 2026-09-05 / P20             | Devcontainer-/Codespaces-Quellvertrag                                                                                                                                                                                                        | Abschluss-Container ohne Docker/Podman                                                                                                                                           | BLOCKIERT für Image-Build; Quelltests PASS                                                                                                       | Gepinnter Linux-Container und geeignete Headless-Gates sind definiert. Codespaces-Portweiterleitung wird ausdrücklich nicht als native GUI-Vorschau ausgegeben.                                                                                                                                                                                                                                                   |
| 2026-09-06 / P20             | vollständige `tools/tests`- und `tests/source`-Suite                                                                                                                                                                                         | Abschluss-Container, Python 3.11.2                                                                                                                                               | PASS: 1.272 Tests, 4 erwartete profilabhängige Skips                                                                                             | Portable Tooling-, Quality-, Profil-, CI-, Artefakt-, Capability-, ESLint- und Produktverträge bestehen gemeinsam; keine zuvor offene Source-Fixtureabweichung bleibt übrig.                                                                                                                                                                                                                                      |
| 2026-09-06 / P20             | rustfmt, `cargo check --locked --all-targets --all-features`, Clippy `-D warnings`, `cargo test --locked` sowie alle Frontend-Gates                                                                                                          | Abschluss-Container, Rust 1.97.1, Node 24.19.0, npm 11.17.0                                                                                                                      | PASS: 241 Rusttests, 4 Sonderläufe ignoriert; 177 Frontendtests in 40 Dateien; Build mit 118 Modulen                                             | Direkter Produktcode, exakt ausgerichteter Tauri-Dialogstack, Compiler, Lints, Typen, Formatierung und Produktionsbundle bleiben nach der Toolingänderung grün.                                                                                                                                                                                                                                                   |
| 2026-09-06 / P20             | `quality lint`, `quality architecture --format json`, `docs check`, `integrate --full-fix`, `integrate --check --json` und `git diff --check`                                                                                                | sauberer P20-Commitzustand; Quality zusätzlich mit frischem Cargo-Ziel und flüchtigem Debian-Sysroot                                                                             | PASS                                                                                                                                             | Zentrale Python-/TypeScript-/Rust-Gates, 142 TypeScript-Quelldateien, 146 Dokumentseiten und das vollständig integrierte Desktopprofil sind ohne getrackte Nachkorrektur grün; CI und Devcontainer installieren die für den All-Features-Build benötigte D-Bus-Entwicklungsabhängigkeit ausdrücklich.                                                                                                             |
| 2026-09-06 / P21             | fokussierter `example_vault`-Integrationstest über den öffentlichen Tauri-Command                                                                                                                                                            | Abschluss-Container, Rust 1.97.1                                                                                                                                                 | PASS: 2 Tests; vollständiger Generieren-/Reopen-/Unicodekopie-/Reexport-Lauf 69,24 s                                                             | Der Produktionsservice erzeugt Lichterhain in einem leeren Ordner; gemeinsame Releases, getrennte NPCs, lokale Korrekturen, statisches Equipment, vollständige Exporte und der Schutz eines nichtleeren Ziels sind belegt.                                                                                                                                                                                        |
| 2026-09-06 / P21             | `cargo test --locked --all-targets`, rustfmt, Check, Clippy `-D warnings` sowie Frontendtests, Typecheck, ESLint, Prettier und Vite-Build                                                                                                    | Abschluss-Container, Rust 1.97.1, Node 24.19.0, npm 11.17.0                                                                                                                      | PASS: 243 Rusttests, 4 begründete Sonderläufe ignoriert; 179 Frontendtests in 40 Dateien; Build mit 118 Modulen                                  | Generator, Tauri-IPC und paketierte Startseitenaktion nutzen denselben Vertrag; eine zeitabhängige bestehende Polling-Assertion wartet nun auf den zuständigen React-Effekt.                                                                                                                                                                                                                                      |
| 2026-09-06 / P21             | `quality lint`, `quality architecture --format json`, `docs check --docs-dir docs`, `integrate --check --json` und `git diff --check`                                                                                                        | Abschluss-Container                                                                                                                                                              | PASS                                                                                                                                             | Python-/TypeScript-/Rust-Gates ohne Befund, 142 TypeScript-Quelldateien, 149 konsistente Dokumentseiten, sauberes Patchformat und Desktopprofil `INTEGRATED` ohne ausstehende Operation. GitHub-CI wurde auf ausdrücklichen Nutzerwunsch nicht gestartet.                                                                                                                                                         |
| 2026-09-06 / P21             | aktuelles Linux-DEB bauen, SHA-256 und Payloadinhalt prüfen                                                                                                                                                                                  | flüchtiger Debian-12-Container, Linux x86_64                                                                                                                                     | PASS: 5.492.410 Bytes; SHA-256 `16a36b6199154625ebb9cab53c7eb9bc68035178591add7ef4b2083a1297e727`                                                | Das Paket enthält den registrierten Generator und keine Entwicklerlaufzeit. Ein neuer Fensterstart ist wegen fehlendem Display und unvollständigem XKB im Container nicht belegt; der reale P20-Paketstart bleibt der native Laufnachweis.                                                                                                                                                                        |
| 2026-09-06 / P22             | erweiterter `example_vault`-Produktions-E2E über den öffentlichen Tauri-Command                                                                                                                                                              | Abschluss-Container, Rust 1.97.1                                                                                                                                                 | PASS: 1 Test im finalen Lauf in 116,20 s                                                                                                         | Leere Vault bis Reopen/Unicodekopie/Reexport; alle 256 Mira-Previewframes stimmen bytegleich mit dekodierten Atlasrechtecken überein, Loopmengen besitzen kein doppeltes Ende, Mira/Borin teilen dieselben Releases bei getrennten Appearances/Pixeln, deaktiviertes Equipment fehlt in Pixeln und Manifestquellen, immutable Revisionen und global-only-Ablage bleiben intakt.                                   |
| 2026-09-06 / P22             | `godot_4_7_2_imports_and_loads_the_package_before_and_after_relocation` ausdrücklich mit `--ignored --exact`                                                                                                                                 | flüchtiger Abschluss-Container; offizielle Godot-Binärdatei `4.7.2.stable.official.ed1daf0bf`, Archiv-SHA-256 `cadd3204e728a35d3f13adb7fd0d7902636b79f6b95c40c265eb73b6c35329e4` | PASS: 1 Test in 59,33 s                                                                                                                          | Vollständiges Lichterhain/Mira-Paket mit 3 Aktionen/8 Richtungen/256 Frames lädt in frischem Projekt nach Löschen der Vault und erneut cachefrei nach Unicode-/Leerzeichen-Relocation; Szene bleibt frei von Script, Collision, Bone, Skeleton, Mesh und Polygon.                                                                                                                                                 |
| 2026-09-06 / P22             | `test_studio_final_architecture.py`                                                                                                                                                                                                          | Abschluss-Container, Python 3.11.2                                                                                                                                               | PASS: 4 Tests                                                                                                                                    | Strukturierte direkte Cargo-/npm-/Tauri-Verträge schließen Datenbank-/SQLite-, Python-/Sidecar-, Web-/Mobile- und Rigarchitektur ohne transitive Fehlalarme aus.                                                                                                                                                                                                                                                  |
| 2026-09-06 / P22             | `cargo test --locked --all-targets`                                                                                                                                                                                                          | Abschluss-Container, Rust 1.97.1                                                                                                                                                 | PASS: 243 Tests, 4 begründete Sonderläufe im normalen Lauf ignoriert                                                                             | Alle früheren Produkt-, Storage-, Recovery-, Import-, Render- und Exportverträge bleiben gemeinsam grün; der Godot-Sonderlauf wurde separat bestanden.                                                                                                                                                                                                                                                            |
| 2026-09-06 / P22             | erster vollständiger `pytest tools/tests tests/source`-Aufruf                                                                                                                                                                                | Abschluss-Container, Python 3.11.2; flüchtiger Cargo-Pfad versehentlich nicht exportiert                                                                                         | INFRA-FAIL: 1.271 bestanden, 5 erwartete Skips, 4 fehlgeschlagen                                                                                 | Ausschließlich die vier portablen Profil-Integrationsfälle meldeten im isolierten Staging „cargo is unavailable“; der vollständige Lauf wird mit dem gepinnten Rust-/Node-PATH wiederholt und nicht als Produkt-PASS gezählt.                                                                                                                                                                                     |
| 2026-09-06 / P22             | vollständiger `pytest tools/tests tests/source`-Wiederholungslauf mit gepinntem Rust-/Node-PATH                                                                                                                                              | Abschluss-Container, Python 3.11.2                                                                                                                                               | PASS: 1.276 Tests, 4 begründete profilabhängige Skips in 818,18 s                                                                                | Alle portablen Tooling-, Profil-, Transaktions-, Quality-, Source- und neuen P22-Architekturverträge bestehen gemeinsam.                                                                                                                                                                                                                                                                                          |
| 2026-09-06 / P22             | Frontendtests, Typecheck, ESLint, Prettier und Vite-Build                                                                                                                                                                                    | Abschluss-Container, Node 24.19.0, npm 11.17.0                                                                                                                                   | PASS: 179 Tests in 40 Dateien; Build mit 118 Modulen                                                                                             | Die unveränderte Desktopoberfläche und alle bisherigen Bedien-/IPC-Verträge bleiben grün.                                                                                                                                                                                                                                                                                                                         |
| 2026-09-06 / P22             | `quality lint`, `quality architecture --format json`, `docs check --docs-dir docs`, `integrate --check --json` und `git diff --check`                                                                                                        | Abschluss-Container                                                                                                                                                              | PASS                                                                                                                                             | Python-/TypeScript-/Rust-Lint und Compiler ohne Befund; 142 TypeScript-Quelldateien, 150 konsistente Dokumentseiten, Desktopprofil `INTEGRATED` und sauberes Patchformat. GitHub-CI wurde auf Nutzerwunsch nicht gestartet.                                                                                                                                                                                       |
| 2026-09-06 / Planung P23–P27 | `.venv/bin/python tools/control.py docs index --docs-dir docs --dry-run`                                                                                                                                                                     | aktueller Workspace                                                                                                                                                              | INFRA-BLOCKER                                                                                                                                    | Der optionale externe `PyGitIndex` ist nicht installiert. Die sechs neuen Backlinks und vier betroffenen generierten Indexblöcke wurden deshalb kontrolliert manuell ergänzt; es wurde keine Abhängigkeit nachinstalliert.                                                                                                                                                                                        |
| 2026-09-06 / Planung P23–P27 | `.venv/bin/python tools/control.py docs check --docs-dir docs`, `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tests/source/test_repository_documentation.py`, `git diff --check` und Leerzeichenprüfung der neuen Dateien | aktueller Workspace, Python 3.11.2 für Pytest                                                                                                                                    | PASS: 156 Dokumentseiten konsistent; 3 Tests bestanden                                                                                           | P00–P22 sind als abgeschlossene Basis abgegrenzt, P23–P27 vollständig verlinkt und P23 als nächster Schritt ausgewiesen. Produktcode wurde nicht geändert; Frontend-, Rust-, Run-, Build- und Smoke-Gates waren für diesen reinen Planungsauftrag nicht erforderlich und wurden nicht erneut ausgeführt.                                                                                                          |
| 2026-09-06 / P23             | `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- src/prompt-studio`                                                                                                                                                 | isolierter Staging-Worktree, Node 22.22.2, npm 10.9.7                                                                                                                            | PASS: 74 Dateien / 389 Prompt-Tests                                                                                                              | Der noch nicht mit der App-Shell verdrahtete Prompt-Namensraum kompiliert; Format, Lint, Prompt-Domain, Schemas, Migration, Profile, Drafts und Importgrenze sind grün.                                                                                                                                                                                                                                           |
| 2026-09-06 / P23             | `npm test`, `npm run build`, `tools/control.py test --suite frontend`                                                                                                                                                                        | isolierter Staging-Worktree, Node 22.22.2, npm 10.9.7                                                                                                                            | PASS: 114 Dateien / 568 Tests; Vite-Build mit 118 Modulen; Control-Gate OK                                                                       | Alle bestehenden Cutout-Tests bleiben zusammen mit der portierten puren Prompt-Testbasis grün. Der Prompt-Code ist in P23 noch nicht Teil des sichtbaren App-Bundles.                                                                                                                                                                                                                                             |
| 2026-09-06 / P23             | `tools/control.py docs check --docs-dir docs`, `pytest tests/source/test_repository_documentation.py`, `git diff --cached --check`                                                                                                           | isolierter Staging-Worktree, Python 3.11.2                                                                                                                                       | PASS: 156 Dokumentseiten; 3 Tests; sauberes Patchformat                                                                                          | Phasenstatus, Herkunft, Lizenz, Scope und nächste Freigabe P24 sind konsistent dokumentiert.                                                                                                                                                                                                                                                                                                                      |
| 2026-09-06 / P23             | `.tooling-state/bin/node --version`                                                                                                                                                                                                          | aktueller Host                                                                                                                                                                   | INFRA-BLOCKER: `flatpak-spawn` fehlt                                                                                                             | Der repositorylokale Node-24-Wrapper ist hier nicht startfähig; die oben genannten erfolgreichen Gates liefen mit dem verfügbaren Node 22.22.2.                                                                                                                                                                                                                                                                   |
| 2026-09-06 / P24             | `npm test -- src/components/AppHeader.test.tsx src/app/App.studio-switch.test.tsx src/app/navigation.test.ts`                                                                                                                                | isolierter Phasen-Worktree, Node 22.22.2, npm 10.9.7                                                                                                                             | PASS: 3 Dateien / 8 Tests                                                                                                                        | Buttonsemantik, Enter-Aktivierung, `aria-pressed`, Hilfe, vollständige Cutout-Kontextwiederherstellung, Prompt-Flush, Dirty-Editor- und Importguard sind abgedeckt.                                                                                                                                                                                                                                               |
| 2026-09-06 / P24             | `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `tools/control.py test --suite frontend`                                                                                                           | isolierter Phasen-Worktree, Node 22.22.2, npm 10.9.7                                                                                                                             | PASS: 116 Dateien / 574 Tests; Vite-Build mit 119 Modulen; Control-Gate OK                                                                       | Bestehende Cutout- und isolierte Prompt-Basis bleiben zusammen grün. Der exakte Node-24-Pin bleibt wegen des in P23 dokumentierten Wrapperblockers für P27 zu wiederholen.                                                                                                                                                                                                                                        |
| 2026-09-06 / P24             | Headless-Chrome-Messung bei 1280×720 mit Enter und Leertaste                                                                                                                                                                                 | Chrome for Testing 153.0.8010.12                                                                                                                                                 | PASS: beide Buttons 196×46 px; Prompt-Inhalt 1280 px breit                                                                                       | Inaktives Prompt-Label, Unterzeile und SVG messen `rgb(145, 232, 117)`; aktiv ist derselbe grüne Hintergrund gesetzt. Genau ein Banner und eine Statusbar bleiben sichtbar, die Cutout-Navigation ist im Prompt-Modus nicht vorhanden.                                                                                                                                                                            |
| 2026-09-06 / P24             | `tools/control.py docs check --docs-dir docs`, `pytest tests/source/test_repository_documentation.py`, `git diff --check`                                                                                                                    | isolierter Phasen-Worktree, Python 3.11.2                                                                                                                                        | PASS: 156 Dokumentseiten; 3 Tests; sauberes Patchformat                                                                                          | P24 ist nachvollziehbar abgeschlossen; P25 bleibt bis zur ausdrücklichen Nutzerfreigabe offen.                                                                                                                                                                                                                                                                                                                    |
| 2026-09-06 / P25             | `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `python3 tools/control.py test --suite frontend`                                                                                                  | isolierter Phasen-Worktree, Node 22.22.2, npm 10.9.7                                                                                                                             | PASS: 146 Dateien / 761 Tests; Vite-Build mit 398 Modulen; Control-Gate OK                                                                        | Dashboard, Profile, vollständiger Neun-Kategorien-Wizard, Ausgabe und Einstellungen bestehen zusammen mit allen Cutout-Regressionen. Der größte unkomprimierte JavaScriptchunk misst 261,79 kB; der Node-24-Wrapperblocker bleibt wie in P23 dokumentiert für P27 sichtbar.                                                                                                                                           |
| 2026-09-06 / P25             | Headless-Chrome-Lauf bei 1280×720 durch alle fünf Prompt-Ansichten sowie statische Import- und CSS-Grenzprüfung                                                                                                                              | Chrome for Testing 153.0.8010.12; isolierter Phasen-Worktree                                                                                                                     | PASS: genau ein Header und eine Statusbar; interner Prompt-Scroll ohne Seitenüberlauf                                                             | Prompt-Root und App-Frame messen 1280 px, der Wizard läuft ohne horizontalen Überlauf, das Theme bleibt lokal am Prompt-Root und keine PixelForge-Gesamtshell, Animationsstudio-, History-, Tauri- oder Handoff-Abhängigkeit wird eingezogen.                                                                                                                                                                       |
| 2026-09-06 / P25             | `python3 tools/control.py docs check --docs-dir docs`, `pytest tests/source/test_repository_documentation.py`, `git diff --check`                                                                                                           | isolierter Phasen-Worktree, Python 3.11.2                                                                                                                                        | PASS: 156 Dokumentseiten; 3 Tests; sauberes Patchformat                                                                                          | P25 ist nachvollziehbar abgeschlossen; native Persistenz, Cutout-Handoff und P27-Abnahme bleiben bis zu ihren ausdrücklichen Nutzerfreigaben offen.                                                                                                                                                                                                                                                               |

Die vorhandenen Repository-Gates wurden während der Implementierung entsprechend ihrer
tatsächlichen Verfügbarkeit verwendet; Änderungen an ihren Verträgen sind im Prüflog und in den
jeweiligen Abnahmeberichten begründet.

## Recovery / Idempotence

Vor Arbeitsbeginn aktuellen Git-Status und Nutzeränderungen prüfen. Keine destruktiven Git-Befehle, unbeauftragten Pushes oder Releases. Tests verwenden temporäre Vaults. Produktionsdaten werden niemals als Wegwerf-Fixture benutzt.

Wiederaufnahme beginnt mit dem aktuellen Code und diesem Plan, nicht allein mit Chat-Kontext. Die erste unvollständige Phase und ihr Gate werden erneut geprüft. Mehrteilige Nutzerdatenänderungen erhalten in der App Journale und Sicherungen; ein fehlgeschlagener Export ersetzt keinen letzten gültigen Build.

**Nächster Implementierungsschritt:** Auf die ausdrückliche Nutzerfreigabe für P26 warten. Danach
nur native Prompt-Persistenz, nativen Import/Export und den versionierten Cutout-Handoff umsetzen,
prüfen und separat committen. P27 darf nicht vor einer weiteren Freigabe beginnen. Reale
Windows-/macOS-Abnahmen, Signierung, Notarisierung, Tag, Release und Push bleiben getrennte Schritte
mit eigener Freigabe.

## Outcomes & Retrospective

P00 hat die Planung in den tatsächlichen Checkout überführt. P01 liefert einen nachweislich
startfähigen, responsiven Desktop-Rahmen. P02 verankert die getrennten Identitäten und den
portablen JSON-v1-Vertrag, auf dem die Dateispeicherung in P03 aufbaut. P03 liefert diese
Dateispeicherung samt nativer Auswahl, Pfadgrenze, Konflikt- und Lock-Verhalten. P04 macht die
Grundlage erstmals als persistentes Projekt- und Label-Dashboard produktiv bedienbar. P05 ergänzt
die erste echte projektbezogene Fachressource mit reproduzierbarer Profilgeometrie,
unveränderlichen Revisionen und visueller Slotprüfung.
P06 ergänzt die persistente Bewegungsbibliothek mit belastbaren Entwurfs-/Freigabezuständen,
vollständigen Kartenaktionen und einer Navigation, die Projekt, Bereich, Vorlage und optionale
Figurenbindung ausdrücklich statt implizit auflöst.
P07 schafft den UI-unabhängigen, deterministischen RGBA8-Renderpfad, den Vorschau und Export
gemeinsam verwenden können; Golden-Assertions sichern dabei auch Rand- und Rundungsregeln.
P08 macht diesen Pfad als direkt bedienbaren, wiederverwendbaren Bewegungseditor sichtbar und
speichert jede Richtung konfliktgeschützt zurück in den bestehenden Entwurf, ohne Profil oder
andere Trackdaten stillschweigend umzuschreiben.
P09 verbindet diesen Editor mit einer vollständigen Timeline und einem reinen Sampler. Vorschau,
späterer Export, Nachbarposen und gespeicherte Keyframes verwenden nun denselben Datenpfad;
gemeinsame History und serialisierte CAS-Schreibvorgänge halten auch schnelle richtungs- und
frameübergreifende Bearbeitung konsistent.
Nach jeder Phase werden reale Ergebnisse, erkannte Grenzen und notwendige Planänderungen ergänzt.
P10 löst alle acht Richtungszustände im laufenden Editor auf: kontrollierte Horizontalspiegelung,
anatomische Slot-Paarung, Zielprofil-Layer, getrennte Bitmap- und Gesamtbildoperationen, ein
atomarer Detach-Übergang und eine nicht umgehbare Freigabeprüfung. Eine einseitige Handschuh-
Fixture durchläuft Resolver, Assetwahl und den P07-Compositor gegen feste RGBA-Goldens.
P11 macht die Bewegungsbibliothek zu einem vollständigen ersten Demoablauf: Ein Preset wird als
normaler Entwurf erzeugt, seine benannten Helper können deaktiviert oder in Keys umgewandelt
werden, und eine unveränderliche Freigabe behält dieselben Semantiken und Samples. Jump hält
Bodenanker, Höhenkanal und Schatten getrennt. Karten zeigen faul geladene, inhaltsgecachte
Compositorframes und der Freigabedialog macht jede Richtungslücke vor dem Backend-Gate sichtbar.
P12 führt echte Spritequellen in diesen Ablauf ein: Paket- und lose PNG-Inspektion teilen die
gleichen Rust-Grenzen, Vorschläge werden erst durch bestätigte Dropdownzuordnung wirksam, und
Original/effektives Bild bleiben nachvollziehbar getrennt. Das aus der Vault neu aufgebaute
Inventar zeigt Revision, Profil, Slot, Richtung, Labels und konkrete Verwendungen; Archivierung
erhält bereits referenzierte Bytes.
P13 ergänzt den ersten vollständigen Figurenübergang von einer freigegebenen Motion über
richtungsspezifisches Outfit-Fitting bis zum stabil identifizierten NPC und seiner ersten
Animationszuordnung.
P14 ergänzt darauf mehrteilige Rüstung, Accessoires und Equipment mit klar getrenntem Ein-/Aus,
Slot-/Root-Mitführen und optionaler eigener Bewegung. Inaktive Zustände bleiben verlustfrei, alle
acht Richtungen nutzen explizite Assets/Pivots/Layer, und dieselbe starre Renderstrecke deckt
segmentierte Kleidung, asymmetrische Handschuhe und kontrolliertes Nachschwingen ab.
P15 fasst Figuren in einem filterbaren NPC-Arbeitsbereich zusammen und macht ihre vollständige
Motionmenge, Richtungsabdeckung, Anforderungen, Prüfung und Exportaktualität sichtbar. Zusätzliche
Bindings bleiben action-eindeutig und revisionsfest; lokale Änderungen, Duplikate und
Ordner-Renames bewahren die getrennten Identitäten und unveränderlichen gemeinsamen Quellen.
P16 bäckt diese Quellen in deterministische, regelmäßig gepackte PNG-Sheets und ein vollständiges
engine-neutrales JSON-Manifest. Der Desktopdialog speichert bereichseigene Profile, prüft echte
NPC-Bindings, meldet native Jobfortschritte und wartet bei Abbruch auf Rust. Inhaltsadressierte
Builds, vollständige Artefaktprüfung und der zuletzt ersetzte `current.json` halten Wiederholung,
Aktualität, unvollständige Tests und Fehlerzustände voneinander getrennt.
P17 ergänzt darauf eine kontrollierte Godot-Ableitung, ohne das generische Manifest zur zweiten
Wahrheit zu machen. Relative Atlasressourcen, optionaler sicherer Szenenbaum, exakte Reuse-
Prüfung und die verzögerte gemeinsame Pointer-Veröffentlichung sind im nativen Desktopjob
verbunden. Der reale Godot-4.7.2-Harness beweist den Import ohne Vault, alte Caches oder stabile
Ausgabepfade und wiederholt ihn nach einer Unicode-Verzeichnisverschiebung.
P18 schließt die zuvor markierten Crashfenster ohne Datenbank- oder Verzeichnisatomaritätsfiktion.
Die App erkennt offene Journale vor jedem weiteren Write, bietet ausschließlich verifizierbare
Resume-/Rollback-Aktionen an und hält fehlerhafte Editorstände als explizite Recovery-Kopie. Reale
Produktionsproducer, ein konkurrierender Kindprozess, Migrations- und Zukunftsschemafixtures,
projektlokale Sicherungen und ein an einen neuen Pfad kopierter Vault belegen die Grenze. Native
Windows-/macOS-Dateisystemsemantik bleibt bewusst Bestandteil von P20.
P19 belegt die vollständige Linux-Desktopbedienung in beiden Zielgrößen, trennt native
AT-SPI-Evidenz sauber von DOM-Tastaturtests und hält die Pixeloberfläche bei DPR 2 auf dem
physischen Raster. Repräsentative Release-Messungen, cursorbasierte 1000-Asset-Inventare,
sichtbarkeitsgeladene Thumbnails, fokuserhaltende Serverfilter, native Importabbrüche und ein
gemeinsamer 256-MiB-LRU schließen die Performance- und Speicherziele ohne geänderte Golden-Pixel
oder neue Beschleunigungsabhängigkeit. Der Post-Review-Lauf des aktuellen Release-Executables
bestätigt Projektquery, Pagination, Vollbestandssuche, Dropdownsortierung und Frame-Probe auf dem
erzeugten 100/1000-Bestand in beiden Pflichtgrößen.
P20 macht daraus einen reproduzierbaren nativen Distributionspfad: exakte Toolchainverträge,
aktive Tauri-Bündelung, sichere frische Artefaktmanifeste, ein Paketpayload-Smoke und eine
schreibgeschützte Drei-Plattform-CI-Matrix. Das tatsächlich neu gebaute Linux-DEB besteht Hash-,
Inhalts-, Start-, Dialog- und Produktionsserviceprüfungen ohne eingebettete Nutzerdaten oder
zusätzliche Python-/Godot-Laufzeit. Windows, macOS und der Devcontainer-Imagebuild bleiben nicht
beschönigt: Ihre Implementierungen und Runnerpfade sind eingecheckt, ihre in dieser Sitzung nicht
verfügbaren Laufzeitergebnisse sind als konkrete Blocker protokolliert. Signierung und
Veröffentlichung bleiben getrennte Freigabeschritte.
P21 liefert die nachvollziehbare Produktbelegung dazu: Die installierte App kann in einem leeren
Ordner selbst eine rechtlich klare Lichterhain-Vault erzeugen. Mira und Borin teilen Walk,
Sprint und Jump als unveränderliche Freigaben, verwenden getrennte Sprites und starres Equipment
und demonstrieren lokale Korrekturen ohne Vorlagenkopie. Vollständige PNG-/JSON- und
Godot-Pakete, Reopen, Kopie an einen Unicodepfad und erneuter Export werden durch einen
Produktionsservice-E2E-Test abgesichert; die deutsche Anleitung führt denselben Ablauf manuell
und erklärt die betrieblichen Grenzen ohne unbelegte Plattform- oder Signierungszusagen.
P22 schließt den Plan mit einer überprüfbaren, nicht zirkulären Abnahme. Der reale Previewpfad und
dekodierte publizierte Atlanten stimmen für alle 256 Frames überein; Loopmengen, deaktiviertes
Equipment, gemeinsame Motion-Freigaben bei verschiedenen Appearances, immutable Quellen und die
global-only-Ablage sind im selben Produktionslauf belegt. Das vollständige Lichterhain-Paket lädt
mit der offiziellen Godot-4.7.2-Binärdatei frisch ohne seine Vault sowie erneut nach cachefreier
Unicode-Relocation. RQ-01–RQ-40 und E2E A–J sind in der Abschlussmatrix bewertet; nur die reale
Windows-/macOS-Laufzeitevidenz bleibt ausdrücklich offen und wird nicht als PASS ausgegeben.

Die Dokumentationsfortschreibung vom 6. September 2026 verändert diesen Abschluss nicht. Sie
behandelt P00–P22 als abgeschlossene Basis und eröffnet mit P23–P27 einen neuen
Erweiterungsmeilenstein. P23 liefert dessen isolierte Prompt-Codebasis, P24 die geprüfte gemeinsame
Shell und sichere Umschaltung und P25 die vollständige browserentwicklungsfähige Prompt-
Oberfläche. P26–P27 bleiben bis zur jeweiligen Nutzerfreigabe offen.
