# P39 · Lokale Auswahlhilfe und geschützte Überlappungen

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: 10. September 2026. Auf dem uncommitteten P37/P38-Arbeitsstand tatsächlich
implementiert; kein Commit, Push, Release, Cloud-Upload oder Modelldownload.

## Ergebnis und Prüftor

- [x] Überdimensionierte ROI entfernt eindeutigen transparenten Hintergrund.
- [x] Positiv-/Negativseeds und manuelle Korrektur sind für schwierige Grenzen bedienbar.
- [x] Sichtbare geschützte Anschlusszugaben bleiben erhalten; Nachbarmasken ändern sich nicht.
- [x] Abgebrochene oder veraltete Jobs überschreiben keine neuere Bearbeitung.
- [x] Qualitäts-, Laufzeit-, Speicher- und Abbruchmessungen sind ausgeführt und unten abgegrenzt.

P39 ist eine korrigierbare lokale Baseline, **keine semantische Körperteilerkennung**.
Die native GUI-Gesamtabnahme aus P43 bleibt separat; Browser-IPC-Fixtures beweisen
keine native WebView-/Dateisystem-Gesamtabnahme.

## Algorithmus und Grenzen

Die eigene [Rust-Implementierung](../../../src-tauri/src/cutout/segmentation.rs) arbeitet
ohne zusätzliche Bibliothek oder externe Laufzeit:

1. Rechteck/Lasso definiert den erlaubten Bereich. Die automatische Suche wächst
   nicht außerhalb dieser ROI.
2. Die einstellbare Alpha-Schwelle entfernt transparenten Hintergrund; Standard 1
   erhält auch schwach sichtbare Randpixel. Genau eine sichtbare Komponente kann
   ohne zusätzlichen Seed übernommen werden. Mehrere unmarkierte Inseln verlangen
   eine positive Markierung und lassen den bisherigen Entwurf unverändert.
3. Für Seeds werden getrennte positive und negative geodätische Distanzen berechnet.
   Ein indizierter Heap besitzt höchstens einen Eintrag je ROI-Pixel. Reihenfolge
   und Gleichstände sind deterministisch; gleiche Endkosten bleiben ausgeschlossen.
4. Farbkosten verwenden ganzzahliges YCoCg. Die expliziten Parameter sind
   `alphaThreshold` 1–255, `tolerance` 0–255 und `edgeWeight` 0–8; Standard 1/40/4.
   Toleranz begrenzt die farblich erreichbaren Bereiche beider Seed-Klassen.
   Kanten-/Farbkosten ergänzen die Pfadlänge:
   `1 + edgeDifference * edgeWeight / 32 + seedColorDifference / 8`.
5. Jede Seed-Klasse verwendet höchstens 32 deterministisch gewählte Farbvertreter.
   Bei Erreichen der Grenze fordert die UI eine zusätzliche manuelle Prüfung an.
   Fehlende sichtbare Grenzen, gleiche Seed-Farben und unzureichende Seeds werden
   nicht als sicher erkannte anatomische Grenze ausgegeben.
6. Negative Markierungen sind harte Ausschlüsse. Das Werkzeug **Überlappung schützen**
   erhält bewusst ergänzte Pixel auch außerhalb der ROI, sofern die ursprüngliche
   Alpha größer 0 ist. Negative Korrekturen haben weiterhin Vorrang. Andere Teile
   besitzen unabhängige Masken und werden weder subtrahiert noch abgeschwächt.

Automatik ändert ausschließlich den aktiven **Entwurf**, nie die letzte Bestätigung.
Bestätigen bleibt eine ausdrückliche Aktion. Undo/Redo, Seeds, Schutzbereiche und
Parameter werden zusammen mit den P38-Masken wiederhergestellt. Die Overlayfarben
sind nur Anzeige: violetter Entwurf, blaue Bestätigung, grüne/rote Seeds und goldene
Schutzbereiche. Quell-RGBA werden nicht verändert.

## Worker, Abbruch und Aktualität

[CutoutJobs](../../../src-tauri/src/cutout/jobs.rs) begrenzt die App auf einen
gleichzeitig aktiven Auswahl-Worker; fertige Zustände werden beim nächsten Auftrag
ersetzt. Start/Poll verlangen eine aktuelle Vault-Sitzung. Cancel bleibt auch nach
dem Schließen genau für den erfassten Job-Eigentümer und seine Generation erlaubt,
damit eine verspätete Startantwort keinen nicht mehr abbrechbaren Altauftrag hinterlässt.
Ein fremder Vault kann weder Ergebnisse lesen noch den Auftrag eines anderen abbrechen.

Schwere Datei-/Bild-/Grapharbeit läuft außerhalb des UI-Threads. Fortschritt und
Cancel werden regelmäßig geprüft, auch während ROI- und Palettenaufbau. Ein bereits
laufender Decoderaufruf ist nicht innerhalb der Bildbibliothek unterbrechbar; nach
Rückkehr wird der Abbruch berücksichtigt. Neue Jobs während eines noch auslaufenden
Abbruchs erhalten eine nachvollziehbare Beschäftigt-Meldung statt unbegrenzter Warteschlangen.

Der [Frontend-Controller](../../../frontend/src/cutout-studio/controller.ts) sichert
zunächst den Arbeitsstand und sendet einen unveränderlichen Eingabesnapshot.
Antworten müssen `sourceHash`, `partId`, `jobId` und `maskRevision` treffen.
`maskRevision` im Job bezeichnet den logischen Bearbeitungszähler des Editor-Snapshots;
der persistierte Maskendateizähler bleibt davon getrennt. Jede Handkorrektur,
Parameteränderung, jeder Teil-/Quellwechsel oder Modul-/Vault-Flush entwertet und
beendet den alten Auftrag. Eine späte Antwort darf deshalb auch nach Undo oder
einem Sitzungswechsel keine aktuelle Maske ersetzen.

Der Worker prüft Snapshot und ursprünglichen Quellhash vor/nach der Berechnung
und schreibt selbst keine Datei. Erst eine angenommene neue Entwurfsmaske geht
durch die normale gemeinsame Autosave-/CAS-Strecke.

## Qualitäts-Fixtures

Der reproduzierbare, selbst erzeugte
[Fixture-Satz](../../../src-tauri/src/cutout/segmentation_tests.rs) enthält bewusst
auch schwierige Fälle. Die folgenden Übereinstimmungen gelten für diese synthetischen
Prüfbilder, nicht als Qualitätsquote für beliebige Fotos oder Figuren.

| Fixture | Erwartung und gemessenes Ergebnis |
| --- | --- |
| Transparente Figur, dünne Linie, Alpha 31 | exakt 94 sichtbare Pixel; keine Ausdünnung der Linie |
| Mehrere getrennte Inseln | ohne Seed kein Ergebnis; mit Seed ausschließlich die gewünschte Insel |
| Undurchsichtiger Hintergrund | exakt 528 Vordergrundpixel; zusätzlicher Test begrenzt die Suche auf eine kleinere ROI |
| Gleichfarbige berührende Teile | reproduzierbare Seed-Distanzgrenze; ausdrückliche Unsicherheitsmeldung, keine anatomische Behauptung |
| Mehrfarbiger Teil | zwei positive Farbseeds; exakt 169 Vordergrundpixel |
| Geschützte Überlappung | bewusste Anschlusszone bleibt auch jenseits der automatischen Trennlinie erhalten |
| Schutz außerhalb ROI, schwache Alpha, negative Korrektur | Alpha-7-Pixel bleiben geschützt; Alpha-0-Pixel und harte negative Seeds bleiben ausgeschlossen |
| Laufender 1024×1024-Job | tatsächlicher Thread-Abbruch, kein Ergebnis nach Cancel |

Für komplexe Farbverläufe, mehr als 32 relevante Seed-Farben, fehlenden Kontrast
oder semantisch mehrdeutige Grenzen bleiben zusätzliche Seeds, kleinere ROI und
manuelle Korrektur nötig. Es wurde keine perfekte Automatik durch einen deaktivierten
Knopf ersetzt: die produktive Auswahlhilfe ist ausführbar und der vollständige
Bedienpfad wird im Browser geprüft.

## Reale Leistungsstichprobe

Referenz: Linux-Docker-Sitzung, AMD Ryzen 7 3700X, 8 Kerne/16 Threads, Rust 1.97.1,
Debug-Testbinary. Die acht Algorithmustests wurden für die Messung sequenziell ausgeführt.

- Seeded 512×512 mit deckendem Hintergrund: exakte Sollmaske, **824 ms**;
  konservativ **5.767.168 Byte** für Quell-RGBA und Graph-Arbeitsarrays.
- Gesamter sequenzieller Algorithmustestprozess: **1,008 s**, maximaler gemessener
  RSS **32.140 KiB**. Das ist keine Speicherangabe für die gesamte native App/WebView.
- Abbruch innerhalb der laufenden 1024×1024-Berechnung: **730 µs** ab gesetztem
  Cancel-Flag. Separater echter Worker mit 512×512-Quelle: **2060 µs** von Cancel
  bis terminalem Zustand einschließlich gegebenenfalls bereits laufender Dekodierung.

Das sind Stichproben, keine zugesicherten Maximalzeiten. Insbesondere Dateisystem,
Dekodierung, Produktionshardware und größere/kompliziertere ROIs können deutlich
andere Werte ergeben. Der Array-Zähler umfasst nicht Masken-/JSON-DTOs, Decoder-
Temporärspeicher oder Frontend-Canvases; der Prozess-RSS misst dagegen den konkreten
Testprozess einschließlich seiner Laufzeitumgebung. Eingabe-/Maskenlimits aus P38 bleiben aktiv.

## Prüfbefehle und Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| `npm --prefix frontend run test` | 716 Tests / 136 Dateien bestanden |
| `npm --prefix frontend run test:e2e` mit Produktionsbuild | 13 Tests bestanden |
| Typecheck, ESLint, Prettier | bestanden |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | 99 Tests bestanden: 68 Library, 1 Composition, 18 Recovery, 12 Vault |
| Clippy `--all-targets --all-features -- -D warnings`, rustfmt | bestanden |
| Quell-/Toolingregression | 108 Tests bestanden |
| `tools/control.py quality architecture` | bestanden; 388 TypeScript-Quelldateien |

Zusätzlich zum Algorithmus prüfen
[Worker-Tests](../../../src-tauri/src/cutout/jobs.rs) und
[native Command-Tests](../../../src-tauri/src/commands/cutout_assistance.rs)
Sitzungsschutz, maximal einen Auftrag, Cancel, geänderte Quellen und unveränderte Dateien.
[Frontend-Ownershiptests](../../../frontend/src/cutout-studio/assistance.test.ts)
prüfen absichtlich verzögerte und falsch zugeordnete Antworten, Read-only, Handkorrektur,
Teilwechsel und Flush. Der
[Browsertest](../../../frontend/e2e/p39-selection-assistance.spec.ts) prüft den
bedienbaren Ablauf, geschützte Pinselzüge, Undo/Redo, Fortschritt/Cancel und Wiederöffnung.
Sein kontrolliertes IPC-Ergebnis ist ausdrücklich kein Ersatz für die native Algorithmusprüfung.

[P39-checks.json](P39-checks.json) hält Ergebnisse, Befehle und Hashes portabel fest.
Vollständige flüchtige Logs/Traces/Screenshots: `/tmp/p38-p43-validation.Xozjjs/`.
Keine Änderungen an `tools/`, `docs/toolingdocs/`, Abhängigkeiten, Lockdateien,
Tauri-CSP oder Capabilities.

Zugeordnete Anforderungen: R-G07, R-C06, R-C08, R-C12. Nächste Phase des Auftrags
„alle P“ ist P40: PNG-Teile und eine sicher veröffentlichte Manifest-Generation.
