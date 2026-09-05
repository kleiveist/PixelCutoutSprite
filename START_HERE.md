# PixelCutoutSprite Studio — Einstieg

**Stand:** 5. September 2026 · **Inhalt:** Tauri-Desktop-App auf dem vorhandenen Tooling-Template.

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

| Datei | Zweck |
|---|---|
| [Produktspezifikation](docs/developer/features/pixelcutoutsprite-studio.md) | Vollständige Anforderungen, Bedienung, Datenstruktur, Exporte, Architektur und Abnahmen. |
| [Lebender ExecPlan](docs/developer/plans/pixelcutoutsprite-execplan.md) | Tatsächlicher Fortschritt, Entscheidungen und Tests während der Umsetzung. |
| [Phasenindex](docs/developer/prompts/pixelcutoutsprite/README.md) | 23 Phasen P00–P22 in der erforderlichen Reihenfolge. |
| [Masterauftrag](docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md) | Übergeordneter Arbeitsauftrag einschließlich Serienmodus. |
| [Fortsetzungsauftrag](docs/developer/prompts/pixelcutoutsprite/FORTSETZEN.md) | Wiederaufnahme in einer neuen Arbeitssitzung. |

## Ablage im Repository

Die Verzeichnisstruktur unter docs/developer ist für das bestehende Repository vorbereitet. Vorhandene gleichnamige Dateien gegebenenfalls vergleichen und zusammenführen. Bestehende AGENTS.md, .agent/PLANS.md, Lizenz und Tooling-Regeln nicht durch neue Standarddateien ersetzen. Den Dokumentationsindex in P00 über den vorhandenen Mechanismus ergänzen.

## Aktueller Arbeitsauftrag

P00 bis P18 sind abgeschlossen. Nach dem Öffnen einer Vault führt die App vom persistenten
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
Der nächste Schritt ist P19 für Desktop-Usability und repräsentative Leistungsnachweise.

## Leitentscheidungen

Auf dem vorhandenen Template-Tooling und dessen Profil `desktop-local` aufbauen: Vite/React/TypeScript im Frontend und Tauri 2/Rust als native Desktop-Laufzeit. Godot ist nur zusätzliches Exportziel. Desktop-only. Normale JSON-/PNG-Dateien in einer lokalen Vault; kein SQL. Bewegungsvorlagen, NPC-Aussehen und Zuordnungen getrennt halten. Vordefinierte Cutout-Teile statt erforderlicher manueller Bone-Einrichtung. PNG-Sheets plus JSON als Standardexport, Godot-Ressourcen als zusätzliche Ausgabe.

Dieses Paket wurde als Download erstellt. Es wurde nicht automatisch in das GitHub-Repository geschrieben und enthält keine nativen Studio-Builds.
