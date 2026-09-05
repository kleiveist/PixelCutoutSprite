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

P00 bis P12 sind abgeschlossen. Nach dem Öffnen einer Vault führt die App vom persistenten
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
Der nächste Schritt ist P14 für Ausrüstung, Anheftung und optionale Eigenbewegung.

## Leitentscheidungen

Auf dem vorhandenen Template-Tooling und dessen Profil `desktop-local` aufbauen: Vite/React/TypeScript im Frontend und Tauri 2/Rust als native Desktop-Laufzeit. Godot ist nur zusätzliches Exportziel. Desktop-only. Normale JSON-/PNG-Dateien in einer lokalen Vault; kein SQL. Bewegungsvorlagen, NPC-Aussehen und Zuordnungen getrennt halten. Vordefinierte Cutout-Teile statt erforderlicher manueller Bone-Einrichtung. PNG-Sheets plus JSON als Standardexport, Godot-Ressourcen als zusätzliche Ausgabe.

Dieses Paket wurde als Download erstellt. Es wurde nicht automatisch in das GitHub-Repository geschrieben und enthält keine nativen Studio-Builds.
