# P38 · Manueller Cutout-Maskeneditor

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: 10. September 2026. P38 baut auf dem uncommitteten P37-Arbeitsstand auf
(Repository-HEAD `f85e24d41197fe74dd64a9d8e2670c382b3f65b8`).
Auftrag: die verbleibenden Phasen umsetzen; nach diesem Prüftor folgt daher P39.
Kein Commit, Push oder Release wurde vorgenommen.

## Ergebnis und Prüftor

- [x] Bildklick öffnet den bedienbaren Editor ohne alten Projekt-/Area-Workflow.
- [x] 15 Pflichtteile und drei optionale Slots stammen aus dem gemeinsamen Register.
  Sechs horizontale Icon-Gruppen besitzen jeweils genau drei Untereinträge.
- [x] Jede Part-ID besitzt unabhängige Entwurfs-/Bestätigungsmasken; Überlappungen
  sind erlaubt. Teilbezogenes Undo verändert keine Nachbarmaske.
- [x] Resize, Zoom, Pan, DPR und Wiederöffnung verändern keine Quellpixelkoordinaten.
- [x] Frontend-, native Datei-/IPC-, Browser- und Architekturprüfungen ausgeführt.

Die native **GUI-Gesamtabnahme** ist damit nicht behauptet. Die in P37 belegte
WebKitGTK-/Container-Startblockade bleibt für P43 gesondert nachzuweisen.

## Implementierung

[CutoutStudio](../../../frontend/src/cutout-studio/CutoutStudio.tsx) verbindet die
P36-Dateiauswahl mit dem neuen Editor. Rechteck, Lasso, positiver/negativer Pinsel,
Bestätigung, Löschen des Entwurfs, begründetes „nicht vorhanden“ und deaktivierte
Extras sind bedienbar. Zusätzlich gibt es vollständig tastaturbedienbare numerische
Rechteckkoordinaten. Escape verwirft laufende Strokes; Enter bestätigt im Canvas;
Strg+Z und Strg+Umschalt+Z unterstützen Undo/Redo.

[MaskCanvas](../../../frontend/src/cutout-studio/MaskCanvas.tsx) verwendet CSS-Pixel
für Fit/Pan/Pointerinversion und DPR ausschließlich für den Canvas-Backing-Store.
Ein im Browser gefundener Rahmenfehler wurde korrigiert: Fit und Pointer verwenden
dieselbe tatsächliche Canvas-Innenfläche, nicht die größere Host-Rahmenbox.
Bildressourcen werden beim Austausch/Unmount freigegeben. Originalfarben werden
nicht mit Overlayfarben gespeichert. Violett markiert den aktiven Entwurf; die
letzte Bestätigung erscheint blasser grün und zusätzlich als Textstatus.

[Maskenmodell](../../../frontend/src/cutout-studio/masks.ts): sortierte,
disjunkte, halb offene RLE-Läufe in der normalisierten Quellpixelmatrix. Ein
vollständig markiertes 4096×4096-Bild benötigt einen Lauf statt eines Bitmaps je
Teil. Pro Teil gibt es `draft`, `confirmed`, `roi`, `positive`, `negative` und
`protected`; letztere Kanäle bilden die Datenbasis für P39. History: höchstens
48 Schritte und konservativ berechnete 1 MiB je Teil, insgesamt höchstens 18 MiB.
Pro Maske höchstens 500.000 Kanal-Läufe, pro Projekt eine Million.

Die gemeinsamen Bildverträge und der Teilekatalog liegen unter
[`shared/image`](../../../frontend/src/shared/image/contracts.ts) statt des im Plan
vorgeschlagenen `shared/canvas`: neben Koordinaten gehören auch Dokumentverträge
und Part-IDs dazu. Prompt reexportiert die bisherigen P28-Verträge, ohne dass
Cutout oder Shared vom Prompt-Modul abhängen. Rust liest dasselbe eingebettete
[Katalog-JSON](../../../frontend/src/shared/image/sprite-parts.catalog.json).

## Persistenz und Schutzgrenzen

[Native Repository-Implementierung](../../../src-tauri/src/cutout/repository.rs):

- PNG, JPEG und statisches WebP; APNG/animiertes WebP werden ausdrücklich abgewiesen.
  EXIF-Orientierung wird normalisiert und im asymmetrischen JPEG-Test geprüft.
- Originalpfad/-hash und normalisierter Snapshot-Hash bleiben getrennt. Kein Resize
  der Quelle; die ursprüngliche Datei wird niemals überschrieben.
- Der erste Arbeitsstand liegt unter
  `.PixelStudio/recovery/cutout/<id>/cutout.project.json`, mit
  `.source/original.png` und `.masks/<partId>.json` daneben. Erst P40 veröffentlicht
  den kanonischen Ausgabeordner.
- Speicherungen verwenden den bestehenden `WorkspaceWriter`, atomare
  Mehrdatei-Journale, Revisions-/SHA-CAS und die gemeinsame `SaveQueue`. Der native
  Worker hält die Writer-Lease bis zum Ende. Veraltete Sessions, Read-only und
  konkurrierende Writes werden geprüft, bevor geschrieben wird.
- Entwürfe und bestätigte Masken werden nach 500 ms bzw. vor Modul-/Vault-Wechsel
  gespeichert. Fehler lassen den Arbeitsstand bestehen und blockieren den Flush.
  Spät abgeschlossene Saves ersetzen keine neueren Bearbeitungen.
- Hashabweichungen, manipulierte Masken/Snapshots und Symlinks werden abgewiesen.
  Die Quellauswahl muss nach einer externen Originaländerung erneuert werden.
- Bildtransport über `read_cutout_pixels` ist binäres RGBA, kein Base64-JSON.
  Ein Test ruft dafür den tatsächlichen produktiven Tauri-Handler auf.

Bewusste Grenze: Die bestehende 16-MiB-Dateigrenze gilt weiterhin für Eingabe und
normalisiertes PNG, zusätzlich zu 8192 px je Achse, 16 Megapixeln und 64 MiB RGBA.
Das ist strenger als der 64-MiB-Datei-Zielrahmen im Plan. Überschreitungen erhalten
eine Fehlermeldung; es gibt weder stilles Downsampling noch einen zweiten Store.

## Ausgeführte Nachweise

Alle Befehle verwendeten Node 24.19.0, npm 11.17.0 und Rust 1.97.1 aus der
flüchtigen P37-Prüfumgebung. Abhängigkeiten und Lockdateien wurden nicht verändert.

| Prüfung | Ergebnis |
| --- | --- |
| `npm --prefix frontend run test` | 709 Tests / 135 Dateien bestanden |
| gezielte Masken-/Controller-Nachprüfung | 14 Tests bestanden |
| Typecheck, ESLint, Prettier | bestanden |
| `npm --prefix frontend run test:e2e` einschließlich Produktionsbuild | 12 Browsertests bestanden; 359 Build-Module |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | 88 Tests bestanden; ein Recovery-Unterprozess wird nicht doppelt gezählt |
| Clippy aller Targets/Features mit `-D warnings`, rustfmt | bestanden |
| Quell-/Toolingregression | 108 Tests bestanden |
| `tools/control.py quality architecture` | bestanden; 385 TypeScript-Quelldateien |

Reproduzierbare Prüffälle:
[Koordinaten/Masken/History](../../../frontend/src/cutout-studio/masks.test.ts),
[Autosave/Isolation/Konflikte](../../../frontend/src/cutout-studio/controller.test.ts),
[native Dateien/Decoder/Recovery](../../../src-tauri/src/cutout/tests.rs),
[native Session-/IPC-Gates](../../../src-tauri/src/commands/cutout.rs),
[Browserbedienung](../../../frontend/e2e/p38-mask-editor.spec.ts).

Der Browser prüft 1920×1080, 1440×900, 960×540, 720×450, 640×480 und 480×360,
Flyout-Kollisionen, Fokus, Pointer-Strichabbruch, Überlappungen, Reload sowie
exakte Quellpixel nach Zoom/Pan bei DPR 1,25 und 2. Das ersetzt keine OS-DPI-Abnahme.

Reale Speicher-/Laufzeitstichprobe im nativen Debug-Test: 8192×2048 halbtransparente
Pixel, 327.292 Byte PNG, 67.108.864 Byte binäres RGBA. Erzeugen, normalisieren und
erneut lesen: **7345 ms**, kompletter Testprozess **7,873 s**, gemessener maximaler
RSS **156.700 KiB**. Es ist eine gleichfarbige, gut komprimierbare Grenzfallquelle,
kein repräsentativer Qualitäts-/Performance-Nachweis für beliebige Motive.

Die flüchtigen vollständigen Logs, Browser-Traces und Screenshots liegen unter
`/tmp/p38-p43-validation.Xozjjs/`; der portable Nachweis ist
[P38-checks.json](P38-checks.json) mit Befehlen, Ergebnissen und Hashes.
`tools/`, `docs/toolingdocs/` und beide Lockdateien sind unverändert.

## Zuordnung und verbleibende Folgearbeiten

R-G06/R-D04: responsive gemeinsame Dateiauswahl und direktes Öffnen;
R-C03/C04/C05: vollständiger Teilkatalog und manuelle Auswahl;
R-C07/C08: Bestätigung, unabhängige Masken und Überlappung;
R-C11/C12/C13/C14: begrenzte Ressourcen, sichere lokale Entwürfe, History und Wiederöffnung.
Für die vollständige übergreifende Abnahme bleiben die zugehörigen P39–P43-Gates maßgeblich.

P39 ergänzt die lokale Auswahlhilfe und das bedienbare Schutzwerkzeug. P40 ergänzt
PNG-Erzeugung, kanonischen Ausgabeort und den umschaltbaren Zubehör-/Schwert-Slot;
in P38 ist dieser optionale Slot mit Gürtel/Zubehör belegt. P41/P42 implementieren
Sprite-Lader und Szenenbearbeitung. Keine automatische semantische Erkennung oder
Sprite-Ausgabe wird durch diesen P38-Bericht als bereits implementiert ausgegeben.
