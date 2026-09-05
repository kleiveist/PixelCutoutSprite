<!-- AUTO-GENERATED:backlink START -->
[← Back](plans.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio — lebender ExecPlan

**Planungsstand:** 5. September 2026
**Planung:** erstellt und an tatsächlichen Checkout angepasst
**Implementierung:** P00–P17 abgeschlossen; P18 ist der nächste Schritt
**Repository:** `kleiveist/PixelCutoutSprite`

Dieses Dokument wird bei der Umsetzung fortgeschrieben. Ein hier aufgeführter Plan oder Prompt ist kein Nachweis einer implementierten Funktion.

## Purpose / Big Picture

Eine lokale Desktop-App für wiederverwendbare Pixelart-Cutout-Animationen entwickeln. Der Nutzer arbeitet von Projekt und Bereich über Dummy-Bewegung und Sprite-Ausstattung bis zum benannten NPC mit mehreren exportierbaren Animationen. Vorrangig sind humanoide RPG-NPCs mit acht Richtungen, ohne notwendige manuelle Bone-Einrichtung.

Verbindliche Spezifikation: [PixelCutoutSprite Studio](../features/pixelcutoutsprite-studio.md).
Ausführungsrahmen: [MASTERPROMPT](../prompts/pixelcutoutsprite/MASTERPROMPT.md).
Phasenindex: [P00–P22](../prompts/pixelcutoutsprite/README.md).

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

## Scope and Non-Goals

Pflichtumfang ist in der Spezifikation RQ-01 bis RQ-40 festgelegt. Besonders wichtig sind Desktop-only, JSON/PNG statt SQL, lokale Vault, globale Daten ausschließlich unter .pixelforge-studio, 16 vordefinierte Grundslots einschließlich optionaler Haare, acht Richtungen, getrennte Vorlagen/Appearance/Bindings und ein portabler Spieleexport.

Nicht Teil der ersten Version sind andere Körperformen, Augen-/Gesichtssystem, vollständiger Pixel-Painter, KI-Perspektivgenerierung, notwendige Skelette/IK, Cloud-Zusammenarbeit und mobile beziehungsweise Web-Ausgaben des Studios.

## Concrete Steps

Die folgenden Phasen werden der Reihe nach anhand ihres vollständigen Prompts umgesetzt. Eine Phase beginnt erst bei erfüllten Abhängigkeiten. Tests werden fortlaufend ergänzt, nicht erst am Ende.

| Phase | Auftrag | Status |
|---|---|---|
| [P00](../prompts/pixelcutoutsprite/00.md) | Bestand prüfen und Umsetzung verankern | Abgeschlossen |
| [P01](../prompts/pixelcutoutsprite/01.md) | Desktop-Shell und Produktidentität | Abgeschlossen |
| [P02](../prompts/pixelcutoutsprite/02.md) | Fachmodelle und JSON-Verträge | Abgeschlossen |
| [P03](../prompts/pixelcutoutsprite/03.md) | Vault und sichere Dateispeicherung | Abgeschlossen |
| [P04](../prompts/pixelcutoutsprite/04.md) | Projekt-Dashboard, Labels und Dropdown-Filter | Abgeschlossen |
| [P05](../prompts/pixelcutoutsprite/05.md) | Bereiche und humanoide Körperprofile | Abgeschlossen |
| [P06](../prompts/pixelcutoutsprite/06.md) | Animationsbibliothek und zustandsabhängige Navigation | Abgeschlossen |
| [P07](../prompts/pixelcutoutsprite/07.md) | Gemeinsamer Pixel-Rasterer | Abgeschlossen |
| [P08](../prompts/pixelcutoutsprite/08.md) | Direkt bedienbarer Dummy-Editor | Abgeschlossen |
| [P09](../prompts/pixelcutoutsprite/09.md) | Timeline, Keyframes und deterministisches Sampling | Abgeschlossen |
| [P10](../prompts/pixelcutoutsprite/10.md) | Acht Richtungen, Spiegelregeln und Schichten | Abgeschlossen |
| [P11](../prompts/pixelcutoutsprite/11.md) | Bewegungspresets und tatsächliche Kartenvorschauen | Abgeschlossen |
| [P12](../prompts/pixelcutoutsprite/12.md) | PNG-Inventar und Paketimport | Abgeschlossen |
| [P13](../prompts/pixelcutoutsprite/13.md) | Ausstattungseditor, Feinschliff und NPC-Entwürfe | Abgeschlossen |
| [P14](../prompts/pixelcutoutsprite/14.md) | Ausrüstung und optionale Eigenbewegung | Abgeschlossen |
| [P15](../prompts/pixelcutoutsprite/15.md) | NPC-Dashboard, Mehrfachanimationen und Revisionen | Abgeschlossen |
| [P16](../prompts/pixelcutoutsprite/16.md) | Generischer PNG-/JSON-Export | Abgeschlossen |
| [P17](../prompts/pixelcutoutsprite/17.md) | Portables Godot-Paket und echter Importtest | Abgeschlossen |
| [P18](../prompts/pixelcutoutsprite/18.md) | Recovery, Autosave und Datenintegrität härten | Nicht begonnen |
| [P19](../prompts/pixelcutoutsprite/19.md) | Desktop-Usability und Leistung prüfen | Nicht begonnen |
| [P20](../prompts/pixelcutoutsprite/20.md) | Native Builds, Tooling und Codespaces | Nicht begonnen |
| [P21](../prompts/pixelcutoutsprite/21.md) | Anleitung und nachvollziehbare Beispiel-Vault | Nicht begonnen |
| [P22](../prompts/pixelcutoutsprite/22.md) | Gesamtabnahme und überprüfbarer Abschluss | Nicht begonnen |

## Progress

- [x] Nutzeranforderungen in eine vollständige Produktspezifikation überführt.
- [x] Relevanten Repository-Ausgangsstand und offizielle technische Quellen gelesen.
- [x] Dateistruktur, Datenverträge, Exporte, Risiken und Abnahmefälle geplant.
- [x] Masterauftrag, Fortsetzungsauftrag und 23 Phasenprompts erstellt.
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
- [x] Meilenstein A: Grundlage, P00–P06.
- [x] Meilenstein B: Bewegungen, P07–P11.
- [x] Meilenstein C: Figuren, P12–P15.
- [x] Meilenstein D: Spieleinbindung, P16–P17.
- [ ] Meilenstein E: belastbare Desktop-Version, P18–P22.

Bei jeder Phasenänderung ergänzen: Datum, tatsächlicher Umfang, betroffene Dateien, Prüfungen und nächster Schritt. Noch nicht geprüfte Plattformen werden nicht als fertig markiert.

## Surprises & Discoveries

**2026-09-05 (durch P00 ersetzt):** Die importierte Annahme eines vorhandenen
Godot-/Python-Produkts war falsch. Der reale Checkout ist das Tauri-fähige Tooling-Template;
ADR-001 und der ausdrückliche Nutzerhinweis legen Tauri als Produktlaufzeit fest.

**2026-09-05:** Der gewünschte Workflow braucht eine Trennung zwischen Bewegungsvorlage und konkretem NPC. Eine reine Ordnerliste von unabhängigen Sprite-Sheets würde die geforderte Wiederverwendung nicht erfüllen.

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

Abweichungen während der Implementierung werden hier ergänzt, einschließlich betroffener Anforderungen, Migration, Testfolgen und erwogener Alternative.

## Validation

### Bereits in diesem Planungsauftrag geprüft

Die Planungsdateien wurden lokal auf Vollständigkeit der 23 Phasen, gültige JSON-Syntax der erklärenden Ausschnitte, geschlossene Codeblöcke, auflösbare interne Dateilinks und vollständige RQ-01–RQ-40-Abdeckung geprüft. Das genaue Dateiprüfprotokoll liegt dem Paket bei.

### Nicht in diesem Auftrag ausgeführt

Keine Repository-Installation, keine vorhandenen Projekt-Tests, keine Studio-App, kein PNG-Renderer, kein nativer Desktop-Build und kein Godot-Import des künftigen Exporters wurden ausgeführt. Die Webrecherche bestätigt API-/Versionsgrundlagen, nicht die spätere Implementierung.

### Prüflog für die Implementierung

| Datum / Phase | Befehl oder manuelle Prüfung | Umgebung | Ergebnis | Beleg / offene Punkte |
|---|---|---|---|---|
| 2026-09-05 / P00 | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tools/tests/core tools/tests/adapters tools/tests/integration` | Flatpak SDK, Python 3.13.15 | PASS: 443 passed, 2 skipped | Produktprofil war zu diesem Zeitpunkt noch nicht aktiviert. |
| 2026-09-05 / P00 | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tests/source/test_repository_packaging_policy.py tests/source/test_workflow_contracts.py` | Flatpak SDK | PASS: 16 passed | Bestehende Source-Policy intakt. |
| 2026-09-05 / P00 | `python tools/control.py integrate --check --json` | Vor Produktkonfiguration | Erwartete Ausgangsfehlermeldung | `docs/toolingdocs` war durch das eingespielte Paket verschoben; P00 stellte den Pfad wieder her. |
| 2026-09-05 / P00 | `python tools/control.py docs check --docs-dir docs` | Vor Dokumentintegration | Erwartete Ausgangsfehlermeldung: 41 Befunde | Fehlende Backlinks/Indizes werden in P00 ergänzt. |
| 2026-09-05 / P00 | `PYTHONDONTWRITEBYTECODE=1 python tools/control.py docs check --docs-dir docs` | Nach Dokumentintegration | PASS: 130 Seiten konsistent | Planpaket und portable Tooling-Dokumente sind gemeinsam indexiert. |
| 2026-09-05 / P00 | vollständiges `tools/tests` | Flatpak SDK | Nach 7m35s abgebrochen: 6 passed, 11 failed | Acceptance-Fixtures konnten ihre Build-Aktion nicht starten, weil npm im SDK-PATH fehlt; Host-Toolchain wird ab P01 kontrolliert angebunden. |
| 2026-09-05 / P00 | Native Studio-, Windows- und macOS-Tests | Nicht verfügbar | Nicht ausgeführt | Vor P01 existiert keine App; Plattformmatrix folgt in P20. |
| 2026-09-05 / P01 | `npm test`, `typecheck`, `lint`, `format:check`, `build` | Host, Node 26.7.0 / npm 12.0.2 | PASS: 7 Tests, Typecheck/Lint/Format und Vite-Produktionsbuild | Headless-Shell, Navigation, Dialog, Fokus und Shortcut-Schutz belegt. |
| 2026-09-05 / P01 | Cargo test, check, Clippy und rustfmt mit Lockfile | Linux-Host, Rust 1.97.1 | PASS: 3 Tests und alle Compiler-/Lint-Gates | Produktions-Composition-Root wird auch vom Mock-Runtime-Smoke verwendet. |
| 2026-09-05 / P01 | `tools/control.py tauri test --cargo --build-dry-run` | Linux-Host | PASS | Struktur, echtes Cargo-Gate und Linux-Buildplan über den zentralen Einstieg belegt. |
| 2026-09-05 / P01 | relevante Source- und Tauri-Tooling-Tests | Linux-Host, Python 3.14.7 | PASS: 9 passed, 2 erwartete Profil-Skips; 161 passed | AST-/ESLint-/Capability-/Dokumentationspolicy sowie portable Tauri-Verträge aktiv. |
| 2026-09-05 / P01 | `tools/control.py quality architecture` und `quality lint` | Linux-Host | PASS | TypeScript-AST, Schichten, Python/TS/Rust-Lint und Compiler grün. Das historische Gesamt-`quality` bleibt wegen bereits vorhandener Größen-/Formatbefunde im portablen Tooling offen. |
| 2026-09-05 / P01 | nativer Tauri-Start und Sichtprüfung | KDE Wayland, 125 % Skalierung | PASS bei 1440×900 und 1280×720 | Pflichtaktionen, Statusleiste und Navigation sichtbar; Screenshots liegen nur im ignorierten lokalen Prüfbericht. Windows/macOS bleiben bis P20 offen. |
| 2026-09-05 / P02 | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt | Linux-Host, Rust 1.97.1 | PASS: 11 Tests | 15 positive Fixtures für 14 Dokumentarten runden konsistent; Graph-, Zukunfts-, Zyklus-, Pfad-, Grenzwert-, Immutabilitäts- und Atlasfälle belegt. |
| 2026-09-05 / P02 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 11 Tests und alle Frontend-Gates | Vier DTO-Vertragstests belegen Header-/Versions-, UUID-, Richtungs-, Pfad-, Zustands- und Identitätsspiegelung. |
| 2026-09-05 / P02 | `tools/control.py quality architecture` und `quality lint` | Linux-Host, Python 3.14.7 | PASS | TypeScript-Schichten sowie Python-, TS- und Rust-Prüfungen bleiben intakt. |
| 2026-09-05 / P02 | `tools/control.py docs check --docs-dir docs` | Linux-Host | PASS: 132 Seiten konsistent | Formatdokumentation und Navigation sind vollständig verknüpft. |
| 2026-09-05 / P03 | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt | Linux-Host, Rust 1.97.1 | PASS: 23 Tests | 12 Vault-/Storage-Integrationstests plus bestehende Domain-/Composition-Tests; fremd/beschädigt, Lock, CAS, Write-Failure, Rechte, Journal und Symlink belegt. |
| 2026-09-05 / P03 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 14 Tests und alle Frontend-Gates | Nativer Dialogfluss, Zweitbestätigung, beschädigter Vault und App-Übergang getestet. |
| 2026-09-05 / P03 | `tools/control.py quality architecture`, `quality lint`, `integrate --check` und Docs-Check | Linux-Host, Python 3.14.7 | PASS | Speicher- und UI-Schichten bleiben in den Tooling-Grenzen; 134 Dokumentseiten konsistent. |
| 2026-09-05 / P04 | `cargo test --all-targets`, Clippy `-D warnings`, rustfmt | Linux-Host, Rust 1.97.1 | PASS: 27 Tests | Vier neue temporäre Vault-Tests belegen CRUD, Reopen, IDs, Filter, Labelreferenzen, Trash und Read-only-Schutz. |
| 2026-09-05 / P04 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 21 Tests und alle Frontend-Gates | Dashboard-Einstieg, Kartenaktionen, Suche, Dropdowns, any/all, Fokus, Reset, Labelverwaltung und Read-only-Zustand belegt. |
| 2026-09-05 / P04 | `tools/control.py quality architecture`, `tauri test --cargo --build-dry-run`, `integrate --check --json` und Docs-Check | Linux-Host | PASS | TypeScript-AST parst 41 Dateien, Architekturgrenzen bleiben intakt, der Cargo-/Tauri-Plan ist grün und 134 Dokumentseiten sind konsistent. |
| 2026-09-05 / P04 | vollständige `tests/source` und zentrales `quality lint` | Linux-Host, Python 3.13.15 | OFFEN: 30 passed, 2 skipped, 4 failed; Quality-Lint FAIL | Die Source-Suite erwartet teils noch die P01-Capability ohne den seit P03 benötigten Dialog und hat drei versionsabhängige ESLint-/AST-Fixturefehler. Der zentrale Lint scannt fälschlich `.tooling-state/venv` und nutzt für Tauri-Makros das inkompatible `-F warnings`; die direkten Produktgates ESLint, TypeScript und Clippy `-D warnings` bestehen. |
| 2026-09-05 / P05 | fokussierte Generator-, Fixture- und `area_profiles`-Tests | Linux-Host, Rust 1.97.1 | PASS: 8 P05-Tests | Referenzprofil 80 px, alle 497 erlaubten Höhen, Spiegelung, Persistenz/Reopen, Labels, Read-only und unveränderte alte Snapshot-Bytes belegt. |
| 2026-09-05 / P05 | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 31 Tests | Alle Domain-, Storage-, Composition- und neuen Bereichstests grün. |
| 2026-09-05 / P05 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 18 Tests und alle Frontend-Gates | Vier Area-Dashboard-Tests belegen 16-Slot-Vorschau, acht Richtungsoptionen, Erzeugung, Revision und fehlenden Projektkontext. |
| 2026-09-05 / P05 | `tools/control.py quality architecture`, `quality lint`, `integrate --check` und Docs-Check | Linux-Host, Python 3.13.15 | PASS im Phasenbranch | TypeScript-AST, Python/TS/Rust-Gates und Integration grün; 134 Dokumentseiten konsistent. Die Integration nach P04 wurde zusätzlich mit den Produktgates geprüft. |
| 2026-09-05 / P06 | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 39 Tests | Vier neue Bibliothekstests belegen Entwurf/Freigabe, Timinggrenzen, Duplikat/Archiv/Entfernen, Mehrfach-NPC-Auswahl und Bindungsauflösung. |
| 2026-09-05 / P06 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 29 Tests und alle Frontend-Gates | Bibliothekskarten, Dropdownfilter, Dialogvalidierung, Kontextmenü, Dummy-Einstieg und explizite Figurenwahl sind abgedeckt. |
| 2026-09-05 / P06 | `tools/control.py quality architecture`, `integrate --check` und Docs-Check | Linux-Host, Python 3.13.15 | PASS im Phasenbranch | Architektur- und Integrationsgrenzen bleiben intakt; 135 Dokumentseiten sind vollständig verknüpft. Der zentrale `quality lint` bleibt wegen seines bereits in P04 erfassten inkompatiblen Clippy-Flags `-F warnings` offen; das direkte Clippy-Gate mit `-D warnings` besteht. |
| 2026-09-05 / P07 | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 47 Tests | Acht Compositor-Goldentests prüfen vollständige RGBA-Frames, Alpha/Lagen, Hierarchie/Fitting, nichtnulligen Pivot, negative Koordinaten, Spiegelung, Clipping, Fehler und Bytewiederholung. |
| 2026-09-05 / P07 | fokussierter 128×128-Debuglauf mit `--nocapture` | Linux-Host | PASS: zwei Frames in rund 0,33 ms | Einzelne Diagnosemessung ohne allgemeines Leistungsversprechen; repräsentative Last folgt P19. |
| 2026-09-05 / P07 | Frontend-Gates, `quality architecture`, `integrate --check` und Docs-Check | Linux-Host | PASS | Bestehende 29 Frontendtests bleiben grün, Architektur und Integration sind intakt; 136 Dokumentseiten konsistent. |
| 2026-09-05 / P08 | `cargo test --all-targets --locked`, Clippy `-D warnings`, Check und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 52 Tests | Editor-History, PNG-Decodierung, Elternbindung, Helper-Trennung, CAS-Speichern und Reopen mit veraltetem aktivem Bereichsprofil belegt. |
| 2026-09-05 / P08 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 39 Tests und alle Frontend-Gates | Richtungsposen, Mehrfachauswahl, Read-only-Inspektion, Sperren, Snapping, Undo/Redo, Fehlererhalt, echte Route und persistentes Reopen belegt. |
| 2026-09-05 / P08 | `tools/control.py docs check`, `quality architecture` und `integrate --check --json` | Linux-Host, Python 3.13.15 | PASS | 137 Dokumentseiten konsistent, TypeScript-AST parst 65 Dateien und das Tauri-Desktopprofil bleibt vollständig integriert. |
| 2026-09-05 / P09 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 61 Tests und alle Compiler-/Formatgates | Sieben Sampler-Goldens sowie Editor-/Service-Tests belegen Loopdauer, Reihenfolgeunabhängigkeit, 0/1/viele Keys, Winkelsprung, diskrete Werte, Retiming, Profilvalidierung und wiederholbares Sample-PNG. |
| 2026-09-05 / P09 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 52 Tests und alle Frontend-Gates | Timeline-Datenoperationen, Ganzentwurf-History, Geometrie, Auto-Key, Onion-Skin-Route, Save-Serialisierung und Navigation sind abgedeckt. |
| 2026-09-05 / P09 | `tools/control.py docs check`, `quality architecture` und `integrate --check --json` | Linux-Host, Python 3.13.15 | PASS | 138 Dokumentseiten konsistent, TypeScript-AST parst 74 Dateien und das Desktopprofil bleibt integriert. Der zentrale `quality lint` bleibt bis zur geplanten P20-Korrektur wegen `.tooling-state`-Scan und inkompatiblem Clippy-`-F warnings` offen; direkte Produktgates bestehen. |
| 2026-09-05 / P10 | `cargo test --test direction_resolver --test editor_commands --test motion_library --locked` | Linux-Host, Rust 1.97.1 | PASS: 23 Tests | Fünf Quellen/acht Ziele, acht explizite Ziele, Zyklen, Front/Rückseite, Sampleradapter, Anatomie, Zielschichten, Hidden/Missing, Assetfehler, Detach, persistentes Release-Gate und asymmetrische RGBA-Goldens belegt. |
| 2026-09-05 / P10 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 76 Tests und alle Compiler-/Formatgates | P09-Sampler, P07-Compositor, Richtungsresolver, Vault-Services und sämtliche früheren Verträge bleiben gemeinsam grün. |
| 2026-09-05 / P10 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 60 Tests und alle Frontend-Gates | Acht Zustände, Dropdownänderung, Zyklusvermeidung, sichtbare Lücken, native Detach-Integration und abgeleitete Read-only-Bearbeitung sind abgedeckt. |
| 2026-09-05 / P10 | `tools/control.py docs check`, `quality architecture`, `integrate --check --json` und `tauri test --cargo --build-dry-run` | Linux-Host, Python 3.13.15 | PASS | 139 Dokumentseiten konsistent, TypeScript-AST parst 79 Dateien, Desktopprofil und nativer Linux-Buildplan sind intakt. Der zentrale `quality lint` bleibt bis P20 aus den in P09 dokumentierten Toolinggründen offen. |
| 2026-09-05 / P11 | `cargo test --test motion_presets --locked` | Linux-Host, Rust 1.97.1 | PASS: 9 Tests | Sechs persistente Presets, alle Zielrichtungen, anpassbares Timing, Geschwindigkeitssemantik, Helper-Bake, Sprungbodenanker, getrennter Schatten, Clippingfreiheit, Inhaltsfingerprint, Byte-LRU und pixelgleiche Karten-/Editorframes belegt. |
| 2026-09-05 / P11 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 87 Tests und alle Compiler-/Formatgates | Presets, Sampler, gemeinsamer Compositor, Richtungsauflösung, Vault- und Bewegungsservices bleiben gemeinsam grün. |
| 2026-09-05 / P11 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 66 Tests und alle Frontend-Gates | Sichtbarkeitsabhängiges Laden, reduzierte Bewegung, geführte Freigabe, Helpersteuerung, Cacheinvalidierung und die bestehende Editor-/Timelinebedienung sind abgedeckt; der Build umfasst 71 Module. |
| 2026-09-05 / P11 | `tools/control.py docs check`, `quality architecture` und `tauri test --cargo --build-dry-run` | Linux-Host, Python 3.13.15 | PASS | 140 Dokumentseiten konsistent, TypeScript-AST parst 85 Dateien und der native Linux-Buildplan bleibt intakt. Der zentrale `quality lint` bleibt bis zur P20-Toolingkorrektur wegen des `.tooling-state`-Scans und des inkompatiblen Clippy-Flags `-F warnings` offen; die direkten Produktgates bestehen. |
| 2026-09-05 / P12 | `cargo test --test asset_import --test asset_inventory --locked` | Linux-Host, Rust 1.97.1 | PASS: 9 Tests | Positives Paket, Sheet-Ausschnitt, lose PNG-Vorschläge, explizites Padding/Resampling, Revision, Alpha/Maße/Größe/Pfad-Gegenbeispiele, unverändertes externes Original, Nutzung, Archiv und vollständiges Wiederöffnen belegt. |
| 2026-09-05 / P12 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 96 Tests und alle Compiler-/Formatgates | Native Commands, Vault-/Profilauflösung, Importer, Repository und alle bisherigen Sampler-/Compositorverträge bleiben gemeinsam grün. |
| 2026-09-05 / P12 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 70 Tests in 24 Dateien und alle Frontend-Gates | Nativer Dialogadapter, Tauri-Drop, sichtbare Zuordnung, sechs Dropdownfilter, Größenwahl, Usage-Dialog, Archiv und Bereichseinstieg sind abgedeckt; der Build umfasst 82 Module. |
| 2026-09-05 / P12 | `tools/control.py docs check`, `quality architecture`, `integrate --check --json` und `tauri test --cargo --build-dry-run` | Linux-Host, Python 3.13.15 | PASS | 141 Dokumentseiten konsistent, TypeScript-AST parst 93 Dateien, Desktopprofil und nativer Linux-Buildplan sind intakt. Der zentrale `quality lint` bleibt bis P20 aus den bereits dokumentierten Toolinggründen offen. |
| 2026-09-05 / P13 | fokussierte Outfit-, Domain-, Inventar- und Richtungsresolver-Tests | Linux-Host, Rust 1.97.1 | PASS: 42 Tests | 16 echte Outfit-Workflows, 12 Dokumentverträge, drei Inventarfälle und elf Richtungsfälle belegen Entwurf/Wiederaufnahme, exakte Release- und Profil-Pins, Varianten, genehmigte Assetspiegelung, Vorschau, Transaktionssave, konfliktgeschütztes Apply und unveränderte ältere Referenzen. |
| 2026-09-05 / P13 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 118 Tests und alle Compiler-/Formatgates | Die Outfitfälle wurden ohne Logikänderung in kleine Include-Dateien getrennt, damit auch der begrenzte portable WASI-Analyzer den realen Integrationsumfang zuverlässig verarbeitet. |
| 2026-09-05 / P13 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 88 Tests in 26 Dateien und alle Frontend-Gates | Explizite Zielwahl, wiederaufnehmbare Entwürfe, Archiv-Pins, Basis- und Variantenfitting, Undo/Redo, serialisiertes Autosave, Read-only und die Übergabe der exakt gewählten Release-Revision sind abgedeckt; der Build umfasst 92 Module. |
| 2026-09-05 / P13 | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests | Linux-Host, Python 3.13.15 | PASS | 141 Dokumentseiten konsistent, TypeScript-AST parst 105 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier schon seit P04 dokumentierten, versionsabhängigen Gesamt-Suite-Fixtureabweichungen bleiben bis zur P20-Toolingphase offen. |
| 2026-09-05 / P14 | `cargo test --test outfit_workflow --locked` und `cargo test --lib --locked animation::equipment` | Linux-Host, Rust 1.97.1 | PASS: 22 Workflow- und 3 Samplertests | Sechs Equipment-Workflows belegen segmentiertes Oberteil, statischen Handschuh, Root-Mitführen, optionales Nachschwingen, verlustfreie deaktivierte Zustände, acht Richtungen, Asymmetrie/Überdeckung, Save-Vollständigkeit sowie Motion-Variante bis Appearance und Reopen. |
| 2026-09-05 / P14 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 127 Tests und alle Compiler-/Formatgates | Equipment bleibt ein starrer Compositor-Layer ohne Mesh-/Skinning-Abhängigkeit; P13-Resolver, Varianten, Fallback-Freigaben, Ground Shadow, Pins und Transaktionen bleiben gemeinsam grün. |
| 2026-09-05 / P14 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 94 Tests in 27 Dateien und alle Frontend-Gates | Vier Equipment-State- und 14 Outfit-Editor-Fälle decken mehrteilige Erzeugung, Additivvarianten, Assignability, getrennte Zustände, deaktivierte Track-Bedienung, Undo/Autosave und die bestehenden drei Modi ab; der Build umfasst 95 Module. |
| 2026-09-05 / P14 | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests | Linux-Host, Python 3.13.15 | PASS | 141 Dokumentseiten konsistent, TypeScript-AST parst 108 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier bekannten Gesamt-Suite-Fixtureabweichungen bleiben planmäßig bis P20 offen. |
| 2026-09-05 / P15 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 137 Tests und alle Compiler-/Formatgates | Zehn fokussierte Binding-Fälle sind in der Gesamtsuite enthalten und belegen Walk/Sprint/Jump, getrennte IDs, lokale Overrides, kompatible und inkompatible Revisionsangebote, tatsächliche Verzeichnisjournale, sichere Exportinventur, Duplikat, Rename und Reopen. |
| 2026-09-05 / P15 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 103 Tests in 28 Dateien und alle Frontend-Gates | NPC-Dashboard, sechs strukturierte Dropdownfilter, gezielte Motion-/Richtungswahl, per-Binding-Drafts, Revisionsvergleich, Duplicate-Schutz und kontexttreue NPC-/Animationsnavigation sind abgedeckt; der Build umfasst 103 Module. |
| 2026-09-05 / P15 | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests | Linux-Host, Python 3.13.15 | PASS | 141 Dokumentseiten konsistent, TypeScript-AST parst 116 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die vier bekannten Gesamt-Suite-Fixtureabweichungen bleiben planmäßig bis P20 offen. |
| 2026-09-05 / P16 | fokussierte Atlas-, Export-, Robustheits-, Profil- und echte NPC-Exporttests | Linux-Host, Rust 1.97.1 | PASS: 17 Tests | Regelmäßige Mehrseitenatlanten, Extrusion, Budgets, gemeinsame Geometrie, Fingerprint, optionale Einzelbilder, atomarer Pointer, Abbruch, Profile sowie ein gespeicherter Multi-Action-/Acht-Richtungs-NPC sind belegt. |
| 2026-09-05 / P16 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 156 Tests und alle Compiler-/Formatgates | Derselbe gespeicherte Outfit-/Equipment-Renderpfad speist Vorschau und Export; aktuelle/incomplete/korrupte Builds, reale PNG-Verifikation und Jobguards sind in der Gesamtsuite enthalten. |
| 2026-09-05 / P16 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 122 Tests in 32 Dateien und alle Frontend-Gates | Exportprofile, native Jobereignisse plus Polling, genau ein Abbruch, persistente Auswahl, Read-only, Navigation und Ausgabezustände sind abgedeckt; der Build umfasst 109 Module. |
| 2026-09-05 / P16 | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests | Linux-Host, Python 3.13.15 | PASS | 142 Dokumentseiten konsistent, TypeScript-AST parst 125 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. Die breite Migration einer lokal neueren PyGitIndex-Version wurde nicht übernommen; nur der bestehende dokumentierte Indexvertrag wurde ergänzt. |
| 2026-09-05 / P17 | fokussierte Godot-, Profil- und echte NPC-/Outfit-Tests | Linux-Host, Rust 1.97.1 | PASS: 45 Tests | Sechs Paketfälle und 36 reale Outfit-/NPC-Fälle belegen portable Ressourcen, optionale Szene, Byte-Reuse, Mutations-/Dateitypschutz, Abbruch, alten Pointer, Retry und den vollständigen P15→Godot-Pfad; drei Profilfälle belegen strikte neue Requests und lesbare alte Speicherstände. |
| 2026-09-05 / P17 | cachefreier Engine-Import über `flatpak-spawn --host /usr/bin/godot` | Linux-Host, Godot `4.7.2.stable.arch_linux.ed1daf0bf` | PASS: 1 Test in 8.22 s | Isolierte HOME-/XDG-Pfade, Loop und Once, Scene und Resources-only, Namen, Frames, FPS, Atlasrechtecke, externe PNGs, sicherer Szenenbaum, Leerzeichen/Unicode sowie erneuter Import nach Verschieben und Cachelöschung sind tatsächlich geladen. |
| 2026-09-05 / P17 | `cargo test --all-targets --locked`, Clippy `-D warnings` und rustfmt | Linux-Host, Rust 1.97.1 | PASS: 167 Tests, 1 explizit separat ausgeführter Godot-Test und alle Compiler-/Formatgates | Der vollständige Rust-Bestand bleibt grün; der normalerweise ignorierte Engine-Test wurde im vorigen Gate mit der exakt zugesicherten Version ausgeführt. |
| 2026-09-05 / P17 | `npm test`, Typecheck, ESLint, Prettier und Vite-Build | Host, Node 26.7.0 / npm 12.0.2 | PASS: 126 Tests in 32 Dateien und alle Frontend-Gates | Format-/Szenenwahl, Profilroundtrip, Vollständigkeitsgate, native snake_case-Daten, Godot-Fortschritt, atomarer Abbruchhinweis, verwaltete Ausgabe und Navigation sind abgedeckt; der Build umfasst 109 Module. |
| 2026-09-05 / P17 | `tools/control.py docs check`, `quality architecture`, `tauri test --cargo --build-dry-run` und stabile Source-Policytests | Linux-Host, Python 3.13.15 | PASS | Navigation für 90 vom bestehenden Index erfasste Dokumentseiten konsistent, TypeScript-AST parst 125 Dateien, Desktopprofil/Cargo/native Dry-Run sind intakt und 16 Repository-Vertragstests bestehen. |

Die vorhandenen Repository-Gates, insbesondere python tools/control.py style und python tools/control.py check, werden in der Implementierung entsprechend ihrer tatsächlichen Verfügbarkeit verwendet. Änderungen an ihren Verträgen werden begründet dokumentiert.

## Recovery / Idempotence

Vor Arbeitsbeginn aktuellen Git-Status und Nutzeränderungen prüfen. Keine destruktiven Git-Befehle, unbeauftragten Pushes oder Releases. Tests verwenden temporäre Vaults. Produktionsdaten werden niemals als Wegwerf-Fixture benutzt.

Wiederaufnahme beginnt mit dem aktuellen Code und diesem Plan, nicht allein mit Chat-Kontext. Die erste unvollständige Phase und ihr Gate werden erneut geprüft. Mehrteilige Nutzerdatenänderungen erhalten in der App Journale und Sicherungen; ein fehlgeschlagener Export ersetzt keinen letzten gültigen Build.

**Nächster ausführbarer Schritt:** P18 für Recovery, Autosave und Datenintegrität auf der
realen Bearbeitungs- und Exportkette ausführen.

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
Nach jeder Phase werden reale Ergebnisse, erkannte Grenzen und notwendige Planänderungen ergänzt.
Ein Abschlussstatus wird erst nach der belegten Gesamtabnahme P22 vergeben.
