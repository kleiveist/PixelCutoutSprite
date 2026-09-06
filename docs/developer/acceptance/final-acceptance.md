<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->
# P22 — Gesamtabnahme

**Stand:** 6. September 2026

**Ergebnis:** P22 ist abgeschlossen. Der vollständige lokale Produktionsweg von einer leeren
Vault bis zu Reopen, PNG/JSON-Export und portablem Godot-Paket ist automatisiert belegt. Alle 256
Mira-Frames werden an jedem Sampleindex und in allen acht Richtungen pixelgenau zwischen dem
produktiven Outfit-Previewpfad und den tatsächlich dekodierten Atlasrechtecken verglichen. Loop-
Aktionen besitzen genau `0..N-1`, ein persistiertes deaktiviertes Equipment erreicht weder Pixel
noch Manifestquellen, und Mira/Borin verwenden dieselben drei Motion-Freigaben mit getrennten
Appearances und unterschiedlichen Ausgabepixeln.

Die funktionale Erstversion und alle Phasen P00–P22 sind damit im belegten lokalen/Linux-Umfang
abgeschlossen. RQ-02 bleibt hinsichtlich einer **realen Windows- und macOS-Laufzeitabnahme
offen**: deren eingecheckte native NSIS-/DMG-Matrix wurde auf Nutzerwunsch nicht über GitHub-CI
gestartet. Das ist kein Plattform-PASS. Signierung, Notarisierung, Veröffentlichung und Push waren
nicht Teil von P22.

## Durchgehender Produktionsnachweis

`src-tauri/tests/example_vault.rs::lichterhain_uses_production_services_reopens_copies_and_exports`
beginnt in einem leeren temporären Ordner und verwendet den öffentlich registrierten
`generate_example_vault`-Tauri-Command. Damit durchläuft er dieselben Vault-, Projekt-, Bereichs-,
Import-, Motion-, Outfit-, NPC-, Binding- und Exportservices wie die Desktop-App. Der Test belegt:

- Projekt „Lichterhain“, Bereich „Dorf-NPCs“, 80-px-Humanoidprofil mit 16 Slots;
- 272 überprüfte RGBA8-Assetrevisionen in fünf normalen, begrenzten Importbatches;
- Walk, Sprint und Jump als unveränderliche gemeinsame Freigaben mit 12, 8 und 12 Frames;
- Mira und Borin als getrennte Characters/Appearances mit eigenen Sprites, Equipment und lokalen
  Bindingkorrekturen;
- vollständige Exporte mit 3 Aktionen, 8 Richtungen, 24 Animationsnamen und 256 Frames je NPC;
- 256/256 dekodierte Mira-Atlasframes bytegleich zur produktiven Preview, nicht nur gleiche
  Metadaten oder Hashbehauptungen;
- für Walk und Sprint je Richtung genau die Indizes `0..N-1`, keinen zusätzlichen Index `N` und
  kein als Endframe wiederholtes erstes Bild;
- ein zusätzlich auf Mira persistiertes, deaktiviertes Borin-Schild: die aktivierte transiente
  Kontrollvorschau unterscheidet sich sichtbar, die deaktivierte Vorschau und der erneute Export
  bleiben dagegen in allen 256 Frames pixelgleich zum Ausgangsexport; alle zugehörigen
  Assetrevisionen fehlen in `sources.assets` und den effektiven Manifestquellen;
- unveränderte Profil-, Motion- und Asset-Revisionsdateien vor und nach dem Export;
- nach dem Schließen ausschließlich Vault-global zulässige Dateien unter
  `.pixelforge-studio`, keine fachlichen Projektquellen oder PNGs;
- Reopen, rekursive Kopie nach `Kopie mit Leerzeichen ü`, erneutes Öffnen und vollständigen
  Einzelbildexport aus der Kopie.

Die fokussierten Import-/Revisionsfälle
`a_described_png_package_imports_reproducibly_without_touching_the_external_source`,
`sheet_rectangles_create_a_derived_crop_and_retain_the_original_sheet` und
`adding_a_revision_preserves_the_previous_release_and_updates_the_manifest` ergänzen den
Produktionslauf um bytegleiche externe Quellen, erhaltene Original-Sheets und unveränderliche
frühere Revisionen. Die Binding-/Outfit-Suite belegt zusätzlich, dass neue Releases gepinnte NPCs
nicht automatisch umstellen und archivierte Asset- sowie ältere Profilrevisionen referenzierbar
bleiben.

## Frischer Godot-4.7.2-Import

Der bewusst ignorierte Sondertest
`godot_4_7_2_imports_and_loads_the_package_before_and_after_relocation` wurde in P22 ausdrücklich
ausgeführt. Verwendet wurde das offizielle Linux-x86_64-Archiv
`Godot_v4.7.2-stable_linux.x86_64.zip`; sein vor dem Entpacken geprüftes SHA-256 lautet
`cadd3204e728a35d3f13adb7fd0d7902636b79f6b95c40c265eb73b6c35329e4`. Die Binärdatei meldete
`4.7.2.stable.official.ed1daf0bf`.

Der Harness erzeugt Lichterhain neu, kopiert Miras vollständiges 3-Aktions-/256-Frame-Paket in ein
frisches Godot-Projekt und löscht anschließend die gesamte Quell-Vault. Godot importiert jedes im
Manifest beschriebene Atlasrechteck, FPS, Loop-/Once-Verhalten, `SpriteFrames` und die optionale
Szene. Danach werden Importcache und `.import`-Zustand entfernt, das Paket in einen anderen Pfad
mit Leerzeichen und Unicode verschoben und erneut importiert. Der rekursive Szenencheck erlaubt
nur den sicheren `Node2D`-/`AnimatedSprite2D`-Aufbau und verwirft Script, CollisionObject2D,
CollisionShape2D, Bone2D, Skeleton2D, MeshInstance2D und Polygon2D.

## Anforderungen RQ-01 bis RQ-40

Die ausführlichen historischen Nachweise bleiben im [Requirement ledger](requirements.md). Diese
Abschlussmatrix nennt pro Muss-Anforderung die produktive Hauptkomponente und tatsächlich
ausgeführte Test- oder manuelle Evidenz.

| ID | Status | Hauptkomponente | Ausgeführte Evidenz |
|---|---|---|---|
| RQ-01 | PASS | `render::PixelCompositor`, `animation::motion_presets` | `pixel_compositor.rs`, `motion_presets.rs`, vollständiger P22-Preview-/Exportvergleich |
| RQ-02 | **Linux PASS; Windows/macOS offen** | Tauri `lib.rs`, React `App`, native Bundlekonfiguration | `composition_smoke.rs`, P19-Linux-WebView/Offline-Abnahme, P20-DEB-Start; NSIS/DMG nur als geprüfter CI-Vertrag, kein Runnerlauf |
| RQ-03 | PASS | `App`, `ProjectDashboard` | `App.test.tsx`, `ProjectDashboard.test.tsx`, P22-Lichterhain-Reopen |
| RQ-04 | PASS | `ProjectService`, Vaultlayout | `project_dashboard.rs`, P22 normaler Projektordner/Reopen |
| RQ-05 | PASS | `LabelService` | `project_dashboard.rs`, `ProjectDashboard.test.tsx`, P22 Workspace-/Projektlabels |
| RQ-06 | PASS | Projekt-, Bereichs-, Motion-, Inventar- und NPC-Filtermodelle | zugehörige Frontend-Dashboardtests; P19 DOM- und AT-SPI-Namensbeleg |
| RQ-07 | PASS | `AreaService` | `area_profiles.rs`, `AreaDashboard.test.tsx`, P22 „Dorf-NPCs“ |
| RQ-08 | PASS | `ProfileRevision`, Humanoidgenerator | `area_profiles.rs`, Humanoid-Unittests, P22 80 px/16 Slots |
| RQ-09 | PASS | `MotionService`, `AnimationDashboard` | `motion_library.rs`, `AnimationDashboard.test.tsx` |
| RQ-10 | PASS | Live-Preview und `PreviewCache` | Preview-Cache-Unittests, `LiveMotionCardPreview.test.tsx`, P19-Nativbeleg |
| RQ-11 | PASS | Motion-Erstellungsdialog und Dummyroute | `AnimationDashboard.test.tsx`, `MotionDummyEditorRoute.test.tsx` |
| RQ-12 | PASS | freigegebene Karte, Outfit-Zielwahl | `App.test.tsx`, `AnimationDashboard.test.tsx`, `OutfitEditor.test.tsx` |
| RQ-13 | PASS | direkte Dummy-Navigation | `AnimationDashboard.test.tsx`, `MotionDummyEditorRoute.test.tsx` |
| RQ-14 | PASS | Humanoidprofil, Compositor, `PixelViewport` | `pixel_compositor.rs`, `PixelViewport.test.ts`, P19 DPR-2-Lauf und begrenzter DPR-1,25-Geometrietest |
| RQ-15 | PASS | Humanoid-v1-Slots | Humanoid-Unittests und `area_profiles.rs` |
| RQ-16 | PASS | strikter Humanoid-v1-Validator | Humanoid-Unittests und Outfit-Vollständigkeitsfälle; kein Augen-Slot |
| RQ-17 | PASS | Dummyteile, SVG-Guides und Handles | `editor_commands.rs`, `DummyEditorPage.test.tsx`, P19 native Sicht-/Fokusevidenz |
| RQ-18 | PASS | `MotionRevision`, Timeline | `motion_library.rs`, `TimelinePanel.test.tsx` |
| RQ-19 | PASS | `AnimationSampler` | `animation_sampler.rs`, `timeline-operations.test.ts`, P22 alle Sampleindizes |
| RQ-20 | PASS | `DirectionResolver` | `direction_resolver.rs`, `DirectionEditor.test.tsx`, P22 alle acht Richtungen |
| RQ-21 | PASS | sechs Motion-Presets | `motion_presets.rs`; P22 Walk/Sprint/Jump als reale gemeinsame Releases |
| RQ-22 | PASS | `AssetService`, paginiertes Inventar | `asset_inventory.rs`, `asset_scalability.rs`, `InventoryPage.test.tsx`; P22 272 Assets |
| RQ-23 | PASS | zweistufiger Paket-/PNG-Importer | `asset_import.rs`, `asset_inventory.rs`, P22 fünf Produktions-Importbatches |
| RQ-24 | PASS | Outfit Inventory/Dress/Fine-tune | `OutfitEditor.test.tsx`, `outfit-state.test.ts`, `outfit_workflow.rs` |
| RQ-25 | PASS | getrennte Preview-Guides | `editor_commands.rs`, `outfit_workflow_cases/guides_and_save.rs`, P22 `guides_included == false` |
| RQ-26 | PASS | `Equipment`/`EquipmentPart` | `outfit_workflow/equipment.rs`, `equipment-state.test.ts` |
| RQ-27 | PASS | persistierte Equipment-Gates und gemeinsamer Renderer | Equipmenttests plus P22 deaktivierter Schild: Kontrollpreview, 256 unveränderte Frames, keine Manifestquelle |
| RQ-28 | PASS | getrennte Motion-/Appearance-/Binding-Scopes | `outfit_workflow/bindings.rs`, `OutfitEditor.test.tsx`, `NpcWorkspace.test.tsx` |
| RQ-29 | PASS | Playback, Steps und zentrale Shortcuts | `animation_sampler.rs`, `TimelinePanel.test.tsx`, `shortcuts.test.ts`, P19 Fokus-/AT-SPI-Grenze |
| RQ-30 | PASS | `AppearanceService`, NPC-Identität und Recovery | Outfit-Workflowfälle, `recovery_integrity.rs`, `NpcWorkspace.test.tsx`, P22 Mira/Borin-Reopen |
| RQ-31 | PASS | `BindingService` | `outfit_workflow/bindings.rs`, P22 je drei getrennte Bindings pro NPC |
| RQ-32 | PASS | kontextgebundene App-/NPC-Navigation | `App.test.tsx`, `navigation.test.ts`, `NpcWorkspace.test.tsx` |
| RQ-33 | PASS | `VaultService`, OS-Writer-Lock | `vault_storage.rs`, `recovery_integrity.rs`, `VaultWelcome.test.tsx`, P22 leerer Ordner bis Reopen |
| RQ-34 | PASS | globales Vaultlayout und projektlokale Quellen | `vault_storage.rs`, Recovery-Scopefälle, P22 rekursive Prüfung des geschlossenen `.pixelforge-studio` |
| RQ-35 | PASS | JSON/PNG-Dateispeicher | `domain_contracts.rs` und 4/4 `test_studio_final_architecture.py`; keine DB-/SQLite-/Python-Runtime |
| RQ-36 | PASS | Vault-/Projekt-/Area-/NPC-/Binding-Hierarchie | Storage-, Projekt-, Outfit-, Export- und Recoverytests; P22 kompletter realer Baum |
| RQ-37 | PASS | `AtlasBuilder`, `ExportService` | `export_atlas.rs`, `export_service.rs`, P22 dekodierte 256 Atlasrechtecke plus Einzelbild-Reexport |
| RQ-38 | PASS | `NpcExportService`, `GodotExporter` | Export-/Godottests und expliziter frischer P22-Godot-4.7.2-Produktionsimport |
| RQ-39 | PASS | vordefinierte Cutout-Hierarchie, rigfreier Godotexport | P22 Source-Policy und realer Szenenbaum gegen Bone/Skeleton/Mesh/Polygon |
| RQ-40 | PASS | Spezifikation, ExecPlan und P00–P22-Prompts | Dokumentations-/Linkgate, dieses Abschlussprotokoll und fortgeschriebener ExecPlan |

## Ende-zu-Ende-Abnahme A bis J

| Fall | Status | Nachweis |
|---|---|---|
| A — Vault, Projekt, Organisation | PASS | Leerer Ordner → initialisierte Vault → „Lichterhain“, Workspace-/Projektlabel, Dashboard und Reopen im Produktions-E2E |
| B — Bereich und Körperprofil | PASS | „Dorf-NPCs“, 80 px, 16 vordefinierte Slots, acht Richtungen und gepinnte Profilrevision im selben Lauf |
| C — Dummy, Timeline, Vorschau/Export | PASS | deterministischer Sampler; Walk/Sprint/Jump; 256/256 Preview-/Atlasframes bytegleich; Loops exakt `0..N-1` ohne dupliziertes Endbild |
| D — Acht Richtungen | PASS | fünf explizite plus drei kontrolliert gespiegelte Richtungen, vollständige Releaseabdeckung und Export in `direction_resolver.rs` sowie P22 |
| E — sichtbare Bedienwege | PASS im belegten Linux-Umfang | DOM-Klick-/Tastaturtests für Dashboard, Karten, Dummy, Outfit, NPC und Export; P19 realer WebView-/AT-SPI-Lauf bei beiden Mindestgrößen |
| F — Import, Outfit, Equipment | PASS | 272 echte Importe, Fitting, lokaler Override, statisches Equipment; persistierter Disabled-Fall erreicht weder Preview/Atlas noch Manifestquellen |
| G — NPC-Sammlung und Wiederverwendung | PASS | Mira/Borin pinnen dieselben drei Motion-Revisionen, besitzen verschiedene Appearance-IDs/Assets und nachweislich unterschiedliche Exportpixel |
| H — Änderungen und Revisionen | PASS | frühere Asset-/Profil-/Motionrevisionen bleiben erhalten und gepinnt; neue Releases werden nie automatisch adoptiert; unveränderte externe Quellen und Revisionsdateien geprüft |
| I — PNG/JSON und Godot | PASS | vollständige Manifeste, Atlanten, optional 256 Einzelbilder; offizielles Godot 4.7.2 lädt Lichterhain frisch ohne Quell-Vault und nach cachefreier Relocation |
| J — Robustheit und Portabilität | PASS im lokalen/Linux-Umfang | Writer-Lock, CAS, Recovery, Abbruch, Kopie/Reopen unter Unicode/Leerzeichen, Offline-WebView sowie sichere relative Godotressourcen; Windows/macOS-Laufzeit bleibt offen |

## Negativarchitektur

`tests/source/test_studio_final_architecture.py` liest strukturierte Cargo-/npm-/Tauri-Daten und
prüft die Produktquellen gezielt, ohne transitive Plattformpakete oder harmlose Dokumenttexte als
Fehlalarm zu behandeln.

| Verbotene Abweichung | Ergebnis |
|---|---|
| SQL, SQLite oder andere Datenbanklaufzeit | nicht vorhanden; direkte Rust-/npm-Abhängigkeiten und Produktpfad geprüft |
| Python als Endnutzer-/Sidecar-Laufzeit | nicht vorhanden; keine Prozess-/Sidecar-API und keine Shell-Capability |
| Web- oder Mobile-Produktausgabe | nicht vorhanden; eingebettetes `frontendDist`, keine Android/iOS/Web-Projektbäume oder Electron/Capacitor/React-Native/PWA-Abhängigkeit |
| erforderliches Skelett, Bones, Mesh oder Skinning | nicht vorhanden; Source-Policy und realer Godot-Szenenwalk prüfen die verbotenen Knotentypen |
| fachliche Projektquellen unter `.pixelforge-studio` | nicht vorhanden; Produktions-Vault nach Close rekursiv geprüft |

## Ausgeführte Abschlussgates

| Gate | Ergebnis |
|---|---|
| fokussierter P22-Produktions-E2E | **PASS:** 1/1; finaler Lauf 116,20 s |
| expliziter Godot-4.7.2-Sonderlauf | **PASS:** 1/1; 59,33 s |
| finale Negativarchitektur-Policy | **PASS:** 4/4 |
| vollständige Rust-Suite | **PASS:** 243 bestanden; 4 begründete Hardware-/Godot-Sonderläufe im normalen Lauf ignoriert |
| vollständige Frontendsuite, Typecheck, ESLint, Prettier, Vite-Build | **PASS:** 179/179 in 40 Dateien; Build mit 118 Modulen |
| vollständige Python-/Source-Suite | **PASS:** 1.276 bestanden, 4 begründete profilabhängige Skips; 818,18 s |
| Quality, Architektur, Docs, Integration, Patchformat | **PASS:** Lint/Compiler ohne Befund, 142 TypeScript-Quelldateien, 150 Dokumentseiten, Desktopprofil `INTEGRATED`, sauberer Patch |

Der erste Python-Vollaufruf hatte bei 1.271 bestandenen Tests und 5 Skips vier
Infrastrukturfehler gemeldet, weil sein Start-PATH den flüchtigen Cargo-Pfad nicht enthielt. Nur
die vier isolierten Profil-Integrationsfälle waren betroffen. Der oben ausgewiesene vollständige
Wiederholungslauf exportierte den gepinnten Rust-/Node-PATH und bestand alle 1.276 ausführbaren
Tests; der erste Aufruf wird nicht als Produkt-PASS gewertet.

## Ehrliche Restgrenzen und nächster Schritt

Es verbleibt **keine weitere Implementierungsphase**. Die folgenden Punkte sind betriebliche oder
plattformgebundene Nachweise und werden nicht als erledigt ausgegeben:

- GitHub-CI wurde gemäß Nutzerwunsch nicht gestartet; insbesondere fehlen reale Windows-NSIS- und
  macOS-DMG-Build-/Startresultate.
- P22 wiederholt keinen neuen manuellen nativen Fensterwalkthrough; die reale Linux-WebView-,
  AT-SPI-, Offline-, Dialog- und Paket-Evidenz stammt weiterhin aus P19/P20. Der neue P22-Beleg ist
  der vollständige Produktionsservice- und reale Godot-Lauf.
- Windows-/macOS-Endnutzerabnahmen, Codesignatur, Notarisierung, Release, Tag und Push benötigen
  eigene Hosts, Zugangsdaten und ausdrückliche Freigaben.

Der nächste fachlich sinnvolle Schritt ist daher kein P23, sondern zuerst der schreibgeschützte
Lauf der eingecheckten Studio-CI-Matrix und die Bewertung ihrer Windows-/macOS-Artefakte. Erst
danach sollte separat über signierte Veröffentlichung entschieden werden.
