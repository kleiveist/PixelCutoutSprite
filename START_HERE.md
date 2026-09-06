# PixelCutoutSprite Studio — Einstieg

**Stand:** 6. September 2026 · **Inhalt:** funktional abgeschlossene Cutout-Basis P00–P22 und
abgeschlossene PixelPromptStudio-Phasen P23–P24; P25–P27 sind offen.

## Anwendung starten

Die native React-/Tauri-Shell ist seit P01 vorhanden. Abhängigkeiten, Tests und Entwicklungslauf
bleiben über den vorbereiteten Tooling-Einstieg erreichbar:

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri run --foreground
```

Das Studio ist ein lokales Desktop-Produkt. Die von Vite erzeugte Seite wird nur in die Tauri-
WebView gebündelt und nicht als eigenständiges Webprodukt ausgeliefert.

## Dateien

| Datei                                                                                   | Zweck                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Produktspezifikation](docs/developer/features/pixelcutoutsprite-studio.md)             | Vollständige Anforderungen, Bedienung, Datenstruktur, Exporte, Architektur und Abnahmen.           |
| [Lebender ExecPlan](docs/developer/plans/pixelcutoutsprite-execplan.md)                 | Tatsächlicher Fortschritt, Entscheidungen und Tests während der Umsetzung.                         |
| [P19-Desktop-Abnahme](docs/developer/acceptance/desktop-usability-and-performance.md)   | Ehrlich abgegrenzte Linux-Usability-, Offline-, DPI- und Leistungsevidenz.                         |
| [P20-Build-Abnahme](docs/developer/acceptance/native-builds-and-tooling.md)             | Native Build-, Paket-, CI-, Devcontainer- und Plattformnachweise samt Blockern.                    |
| [P21-Beispiel-Abnahme](docs/developer/acceptance/example-vault-and-user-guide.md)       | Produktionsnah erzeugte Beispiel-Vault „Lichterhain“ und deutsche Nutzeranleitung.                 |
| [P22-Gesamtabnahme](docs/developer/acceptance/final-acceptance.md)                      | Abschlussmatrix für RQ-01–RQ-40 und E2E A–J mit ausgeführten Tests und ehrlichen Plattformgrenzen. |
| [PixelPromptStudio-Integrationsplan](docs/developer/plans/prompt-studio-integration.md) | Architekturgrenze, fünf neue Phasen, native Persistenz und Cutout-Handoff.                         |
| [Phasenindex](docs/developer/prompts/pixelcutoutsprite/README.md)                       | P00–P27 mit aktuellem Umsetzungs- und Prüfstatus.                                                  |
| [Masterauftrag](docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md)               | Übergeordneter Arbeitsauftrag einschließlich Serienmodus.                                          |
| [Fortsetzungsauftrag](docs/developer/prompts/pixelcutoutsprite/FORTSETZEN.md)           | Wiederaufnahme in einer neuen Arbeitssitzung.                                                      |

## Ablage im Repository

Die Verzeichnisstruktur unter docs/developer ist für das bestehende Repository vorbereitet. Vorhandene gleichnamige Dateien gegebenenfalls vergleichen und zusammenführen. Bestehende AGENTS.md, .agent/PLANS.md, Lizenz und Tooling-Regeln nicht durch neue Standarddateien ersetzen. Den Dokumentationsindex in P00 über den vorhandenen Mechanismus ergänzen.

## Abgeschlossener Funktionsstand

P00 bis P22 sind abgeschlossen. Nach dem Öffnen einer Vault führt die App vom persistenten
Projekt-Dashboard über ein exakt skaliertes humanoides Gebiet in die Animationsbibliothek.
Vorlagen, mutable `draft.json`-Arbeitsstände und unveränderliche Freigaben liegen als gewöhnliche
Dateien in ihrem Bereich. Karten besitzen Dropdown-Filter und explizite Wege zum Dummy sowie zum
Outfit-/NPC-Fluss. Ein deterministischer PNG-only-RGBA8-Compositor bildet die gemeinsame
Pixelgrundlage für Vorschau und Export. Der echte Dummy-Editor lädt den gepinnten Profilsnapshot,
zeigt das compositorgerenderte PNG unter getrennten Hilfslinien und speichert richtungsbezogene
Posen per CAS. Die vollständige Timeline bearbeitet nun spärliche Keyframes, teilt Vorschau und
Export den reinen Rust-Sampler, zeigt Nachbarposen und schützt richtungsübergreifende Änderungen
durch gemeinsame History sowie serialisierte CAS-Autosaves. Ein gemeinsamer Richtungsresolver
wertet fünf Quellansichten und drei kontrollierte Ableitungen aus, trennt Pose-, Asset- und
Gesamtbildspiegelung, löst Zielschichten auf und blockiert lückenhafte Freigaben. Sechs editierbare
Startbewegungen speichern sichtbare deterministische Hilfskanäle, auf der Stelle bleibende
Fortbewegung, Sprunghöhen-/Schattenregeln und Geschwindigkeitsmetadaten. Bibliothekskarten zeigen
dieselben gespeicherten Compositorframes wie der Editor, laden nur im Sichtbereich, respektieren
reduzierte Bewegung und führen vor einer unveränderlichen Freigabe durch die Richtungsprüfung.
Das bereichsbezogene PNG-Inventar ist über Bereichskarten und die Desktop-Navigation erreichbar:
Dateidialog und nativer Drag-and-drop öffnen eine überprüfbare Zuordnung, statt Dateinamen heimlich
zu übernehmen. Strikte Pakete, Einzel-PNGs und Sheet-Ausschnitte werden vor dem Kopieren auf Profil,
Slot, Richtung, Maße, Pivot, Alpha, Größe und sichere Pfade geprüft. Größenabweichungen bleiben
unverändert oder werden nur nach sichtbarer Wahl aufgefüllt beziehungsweise pixelgenau skaliert;
Originale, Inhalts-Hashes, Revisionen, Verwendungen und Archivstatus überleben das Wiederöffnen.
Der Outfit-Editor verbindet freigegebene Bewegungen mit richtungs- und variantenspezifischen
Sprites, getrennten lokalen Korrekturen und einer speicherbaren NPC-Identität. Mehrteilige starre
Rüstung, Accessoires und Equipment folgen wahlweise einem Körperslot oder dem Figurenursprung;
Sichtbarkeit und optionale eigene Bewegung bleiben unabhängig und verlustfrei gespeichert. Der
echte NPC-Arbeitsbereich sammelt alle gepinnten Bewegungen einer Figur, zeigt Anforderungen,
Richtungsabdeckung, Prüfung und Exportstatus, bietet lokale Binding-Korrekturen sowie ausdrückliche
Revisionsübernahme und erhält bei Duplikat oder kontrollierter Umbenennung alle stabilen
Referenzen. Der Wechsel zwischen Animationen und NPCs bewahrt Bereich, Figur und fokussierte
Zuordnung; ungespeicherte lokale Korrekturen bleiben beim Wechsel zwischen den Bewegungen erhalten,
und Revisionsangebote zeigen Framezahl, FPS, Richtungsabdeckung sowie übernommene Overrides.
Der native Export-Arbeitsbereich löst die ausgewählten NPC- und Binding-IDs erneut aus der Vault
auf und erzeugt aus demselben Sampler-/Resolver-/Compositorpfad regelmäßige PNG-Atlanten mit
vollständigem JSON-Manifest. Bereichseigene Profile steuern Seiten- und Speichergrenzen, Padding,
Extrusion, Schatten, optionale Einzelbilder und ausdrücklich markierte Testausgaben. Jeder Job
rendert zunächst in ein eigenes Staging, validiert dekodierte Pixel und Inhalts-Hashes und ersetzt
`current.json` erst nach erfolgreicher Veröffentlichung; Abbruch erhält den vorherigen guten
Pointer. Fortschritt, nativer Abbruch, Read-only-Schutz und Exportaktualität sind in der
Desktop-Oberfläche verbunden. Zusätzlich erzeugt derselbe native Job ein vollständig geprüftes,
inhaltsadressiertes Godot-Paket mit relativen PNG-Verweisen, `SpriteFrames` und optionaler
`AnimatedSprite2D`-Szene. Der generische `current.json`-Pointer wird dabei erst ersetzt, nachdem
auch das Godot-Paket validiert ist. Ein cachefreier Headless-Test mit Godot 4.7.2 lädt Loop- und
Once-Animationen, Atlasrechtecke sowie die optionale Szene aus Verzeichnissen mit Leerzeichen und
Unicode, entfernt die ursprüngliche Vault-Ausgabe und wiederholt die Prüfung nach dem Verschieben
des Pakets. P18 schützt diese gesamte Bearbeitungskette mit digest-versiegelten, eigentumsgeprüften
Journals und einer exklusiven Recovery-Oberfläche. Projekt-/NPC-Rename, konfigurierte Assetimporte,
Motion-/Outfit-/Binding-Schreibvorgänge, Freigaben, Trash und der letzte Exportpointer lassen sich
nach einem injizierten Prozessabbruch und Reopen fortsetzen oder zurückrollen. Ein echter
Betriebssystem-Lock verhindert den zweiten Writer; verwaiste Metadaten benötigen erneute Inspektion
und ein exaktes Bestätigungstoken. Motion- und Outfit-Editor bewahren fehlgeschlagene Autosaves,
blockieren unsichere Navigation und bieten eine Recovery-Kopie. Projektlokale Migrationsbackups,
Zukunftsschemaschutz und ein verschobener kopierter Vault sind durch temporäre Fixtures belegt.
P19 rundet den Linux-Desktoppfad mit gemeinsamen Modal-Fokusregeln, geschützten Tastaturkürzeln,
vollständigen Dropdownbedingungen, scrollbaren Mindesthöhen und physisch ganzzahlig skalierten
Pixelansichten ab. Große Inventare liefern reine Metadaten in Seiten und laden nur sichtbare
48-px-Thumbnails; laufende Serverfilter behalten den Eingabefokus, und Import erhält nativen
Fortschritt und Abbruch. Der gemeinsame Vorschau-/Bildcache ist auf 256 MiB begrenzt und wird beim
Schließen einer Vault geleert. Der reale Tauri-/WebView-Lauf bestand 1280 × 720 sowie 1440 × 900
bei DPR 2 und den Kernworkflow in einem isolierten Linux-Netznamespace mit nur Loopback. DPR 1,25
ist ausschließlich mathematisch getestet, und die
AT-SPI-Evidenz umfasst Aktionen und Fokus, nicht einen behaupteten global synthetischen Tab-Lauf.
Messwerte und Grenzen stehen in der P19-Desktop-Abnahme. P20 aktiviert die native Bündelung,
fixiert Node 24.19.0, npm 11.17.0, Rust 1.97.1 und den direkten Tauri-Stack, korrigiert die
zentralen Quality-Gates und ergänzt einen schreibgeschützten Studio-CI-Workflow für DEB, NSIS und
DMG. Das finale Linux-DEB wurde samt SHA-256 geprüft, aus dem Paket gestartet und mit einem
echten GTK-Vault-Dialog sowie dem Produktions-Speichern-/Exportpfad belegt. Windows und macOS
sind im Workflow vorbereitet, aber mangels passendem Host und autorisiertem Runnerlauf
ausdrücklich nicht abgenommen. Der Devcontainer dient Quellarbeit und Headless-/Linux-Tests;
Portweiterleitung ist keine native GUI-Vorschau. Die genaue Matrix steht in der
P20-Build-Abnahme. P21 ergänzt die ohne Entwicklerwerkzeuge erzeugbare Beispiel-Vault
„Lichterhain“ samt deutscher Nutzeranleitung. P22 belegt den vollständigen Produktionsweg von der
leeren Vault bis Reopen und Export, vergleicht alle 256 Mira-Previewframes pixelgenau mit dem
Atlas, schließt duplizierte Loop-Enden und deaktiviertes Equipment aus und importiert das
vollständige Paket frisch sowie nach Relocation in Godot 4.7.2. Die RQ- und E2E-Matrix steht in
der P22-Gesamtabnahme. Damit ist die Cutout-Basisserie abgeschlossen. Reale Windows- und
macOS-Laufzeitabnahmen, Signierung und Veröffentlichung bleiben ausdrücklich operative Schritte
mit eigener Freigabe.

## Erweiterung: PixelPromptStudio

P23 portiert die Prompt-Domain, Schemas, Providerbasis und Ansichten aus PixelForgeStudio in den
isolierten Namensraum `frontend/src/prompt-studio/`. Nicht übernommen werden PixelForge-Startseite,
Gesamtheader, Animation Studio, Footer oder ein eigenes `main.tsx`. P24 ergänzt im einzigen
App-Header zwei gleich große Studiobuttons, den grünen Generator-Akzent und einen geschützten
Wechsel, der den vollständigen Cutout-Kontext erhält.

P25–P27 bleiben für die vollständige Prompt-Oberfläche, native App-Daten, Export, kontrollierte
Cutout-Übergabe und Gesamtabnahme vorgesehen. Jede Phase beginnt erst nach ausdrücklicher
Freigabe und erhält einen eigenen Commit.

## Leitentscheidungen

Auf dem vorhandenen Template-Tooling und dessen Profil `desktop-local` aufbauen: Vite/React/TypeScript im Frontend und Tauri 2/Rust als native Desktop-Laufzeit. Godot ist nur zusätzliches Exportziel. Desktop-only. Normale JSON-/PNG-Dateien in einer lokalen Vault; kein SQL. Bewegungsvorlagen, NPC-Aussehen und Zuordnungen getrennt halten. Vordefinierte Cutout-Teile statt erforderlicher manueller Bone-Einrichtung. PNG-Sheets plus JSON als Standardexport, Godot-Ressourcen als zusätzliche Ausgabe.

Diese Dokumentation beschreibt den lokalen Repository-Stand. Die freigegebenen Phasen werden
separat committed; Push, Release, Signierung und Notarisierung sind nicht freigegeben. Native
Plattformabnahmen bleiben an die im ExecPlan dokumentierten Host- und Toolchain-Gates gebunden.
