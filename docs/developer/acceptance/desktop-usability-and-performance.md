<!-- PYGINDEX:NAVIGATION START -->
[Zur Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# P19 — Desktop-Usability und Leistung

**Stand:** 5. September 2026

**Ergebnis:** Das P19-Gate ist auf dem unten benannten Linux-Referenzgerät erfüllt. Native
Windows-/macOS-Pakete und deren Plattform-Smokes gehören weiterhin zu P20.

## Evidenzgrenze

P19 kombiniert drei bewusst getrennte Nachweisarten:

- Ein realer nativer Tauri-/WebView-Durchlauf prüft Layout, sichtbare Aktionen, Fokus, AT-SPI,
  Offline-Betrieb und die tatsächlich gemeldete Display-Skalierung.
- DOM- und Unit-Tests prüfen vollständige Tastaturregeln, Modal-Fokus, Reduced Motion und die
  mathematische Abbildung auf ganze physische Pixel.
- Explizit gestartete Rust-Release-Messungen prüfen Compositor, Cache, Export, Vault-Öffnen,
  Inventarseiten, Thumbnails sowie Import und Abbruch ohne Debug-Build-Verzerrung.

Der native Referenzlauf verwendete einen lokalen Entwicklungsbuild. Der abschließende
Post-Review-Lauf verwendete das aktuelle, nicht gebündelte Release-Executable. Keiner der beiden
Läufe ist ein installierbares P20-Artefakt. Die Werte sind reproduzierbare Messpunkte des
Referenzrechners, keine allgemeine FPS-, Hardware- oder Plattformzusage. Insbesondere wird aus
einer einzelnen CPU-Zeit kein UI-FPS-Wert hochgerechnet.

## Referenzgerät

| Bestandteil | Tatsächliche Umgebung |
|---|---|
| Betriebssystem/Desktop | Linux, KDE unter Wayland |
| Prozessor | AMD Ryzen 7 3700X |
| Arbeitsspeicher | 62 GiB |
| Grafik | Radeon-RX-9070-Klasse |
| Reale native Fenster | 1280 × 720 und 1440 × 900 logische Pixel |
| Reale native Skalierung | DPR 2 |
| Zusätzlich berechnet | DPR 1,25 ausschließlich als Geometrie-Unit-Test, nicht als nativer Lauf |

## Nativer Bedien- und Layoutdurchlauf

Die App lief mit einem erzeugten Bestand von 100 Projekten und 1000 Asset-Metadatensätzen in
beiden Pflichtgrößen. Zentrale Navigation, Bereichs- und Bewegungskarten, Inventar, Editor-
Panels, Timeline, Dialoge, Dropdowns, Statusmeldungen und primäre Alternativen zu Kontextmenüs
blieben erreichbar. Kleine Höhen verwenden scrollbare Dialogflächen; die Pixelansichten passen
sich getrennt vom übrigen Layout an.

Nach der letzten Review-Härtung wurde dieser Großdatenpfad mit dem aktuellen Release-Executable
erneut durchlaufen. Die gespeicherte serverseitige Projektsuche öffnete `Scale Project 000`, die
erste Inventarseite lud ihre sichtbaren Thumbnails, und die explizite Pagination erhöhte den
sichtbaren Bestand von 50 auf 100 von 1000 Datensätzen. `Asset 0999` ließ sich ohne erneutes
Fokussieren vollständig in das Suchfeld eingeben und wurde trotz seiner Lage außerhalb der ersten
Seite gefunden. Die strukturierte Sortierung wurde per fokussiertem Dropdown und Tastatur auf
`Name Z–A` gestellt. Damit dieser Textpfad während einer laufenden Serverabfrage stabil bleibt,
behält die Oberfläche die aktuelle Inventaransicht bis zur gültigen Antwort montiert; ein
Regressionstest sichert Fokus und Elementidentität ab.

Dieser Post-Review-Lauf fand zusätzlich zum unten benannten Referenzgerät in einer flüchtigen
Debian-12-Containerumgebung mit dem echten Tauri-/WebKitGTK-Prozess und einem virtuellen
X11-Display statt. Das Fenster wurde dort exakt auf 1280 × 720 und 1440 × 900 gesetzt. Er bestätigt
den aktuellen Binär- und Großdatenpfad, ersetzt aber weder die physische KDE-/Wayland-, DPR-2-
noch die AT-SPI-Evidenz des Referenzlaufs.

Die tatsächliche WebView meldete DPR 2. Dummy- und Outfit-Vorschau bilden jeden Quellpixel auf eine
ganze Zahl physischer Pixel ab, richten Pan-Werte am Gerätepixelraster aus und behalten
Nearest-Neighbour-Darstellung. Der zusätzliche DPR-1,25-Fall ist nur durch
`PixelViewport.test.ts` belegt: Er prüft ganzzahlige physische Skalierung und Gerätepixel-Snapping
mathematisch. Daraus wird kein nicht ausgeführter nativer 125-%-Test abgeleitet.

Der AT-SPI-Baum lieferte zugängliche Namen und Flächen für sichtbare Bedienelemente. Benannte
Aktionen wurden über die AT-SPI-Action-Schnittstelle ausgelöst und der danach gemeldete Fokus
kontrolliert. Ein verlässlicher globaler, synthetisch injizierter Tab-Durchlauf wurde nicht
behauptet. Stattdessen belegen DOM-Tests die Tab-Schleife in Modaldialogen, Anfangs- und
Rückgabefokus, Escape, Enter/Formularverhalten, Kurzbefehle sowie den Schutz von Eingabe-, Select-
und editierbaren Elementen. Sichtbare Fokusrahmen und Text beziehungsweise Form ergänzen
farbliche Zustände. Reduced Motion begrenzt Kartenvorschauen auf ein statisches Bild.

Der Kernlauf wurde zusätzlich in einem mit `unshare` isolierten Netzwerk-Namespace ausgeführt, in
dem nur Loopback verfügbar war. Vault-, Editor-, Inventar- und Exportfunktionen benötigen dabei
weder Login noch Laufzeitnetzwerk. Dies ist ein Linux-Offlinenachweis, kein allgemeiner
Firewall- oder Plattformtest.

`NativeAcceptanceProbe` ist ausschließlich opt-in über `VITE_P19_ACCEPTANCE_PROBE=1`. Der
normale Frontend-Produktionsbuild enthält weder die Probeausgabe noch den Marker
`P19_FRAME_PROBE`; die Debug-Fenstergröße ist ebenfalls nur über die ausdrücklich gesetzte
P19-Acceptance-Umgebung steuerbar. Es wird daher keine Messinstrumentierung an Nutzer ausgeliefert.
Im Post-Review-Lauf wurde die Probe ausdrücklich erst nach dem Laden und Filtern des
1000-Asset-Inventars gestartet. Je 120 Intervalle ergaben bei beiden Fenstergrößen p50 16,00 ms,
p95 17,00 ms und maximal 17,00 ms bei DPR 1 des virtuellen Displays. Diese Frameintervalle sind
nur ein Laufzeit-Sanity-Check der konkreten Container-WebView und keine FPS- oder DPR-2-Messung.

## Release-Messungen

Die Hardwareläufe verwenden nearest-rank-Perzentile. Der Rasterfall enthält 16 Grundteile und
vier Equipmentteile auf 128 × 128 px. Der Export enthält zwei Aktionen mit je zwölf Frames und
acht Richtungen, insgesamt 192 Frames. Inventarwerte umfassen alle zehn 100er-Seiten; nur 16
sichtbare 48-px-Thumbnails werden separat angefordert.

| Messfall | Stichproben | p50 | p95 | Maximum |
|---|---:|---:|---:|---:|
| Raster, kalt, 128 × 128 px, 20 Teile | 360 | 0,038 ms | 0,045 ms | 0,121 ms |
| Derselbe RGBA-Frame, warmer Cachezugriff | 360 | 0,000 ms | 0,000 ms | 0,000 ms |
| Export, 192 Frames | 7 | 95,497 ms | 99,926 ms | 99,926 ms |
| Vault öffnen, 100 Projekte / 1000 Assets | 7 | 147,898 ms | 150,962 ms | 150,962 ms |
| Inventar vollständig servergefiltert und seitenweise lesen, 1000 Assets | 7 | 620,117 ms | 631,689 ms | 631,689 ms |
| Sichtbares Thumbnail, maximale Kante 48 px | 16 | 5,560 ms | 6,577 ms | 6,577 ms |
| Import-Worker, Batch mit vier PNGs | 7 | 7,164 ms | 8,649 ms | 8,649 ms |
| Import einschließlich Schließen, Reopen und Indexrefresh | 7 | 155,005 ms | 170,314 ms | 170,314 ms |
| Bereits angeforderter Importabbruch | 15 | 5,556 ms | 6,627 ms | 6,627 ms |

Der gemessene Peak-RSS im Rasterlauf betrug 18.604 KiB. Bei den kurzen Stichprobenreihen fällt
das nearest-rank-p95 auf den Maximalwert. Die auf drei Nachkommastellen gerundeten warmen
Cachewerte waren vollständig 0,000 ms. Die Mess-Tests wurden in der flüchtigen
Containerumgebung zusätzlich funktional wiederholt; deren andere CPU- und Overlay-Dateisystemwerte
ersetzen die hier protokollierte Referenzhardware ausdrücklich nicht.

Die Messungen sind keine Microbenchmark-Bibliothek und kein Cross-Platform-Vergleich. Funktionale
Assertions prüfen bei jedem Lauf vollständige Exporte, identische Rasterpixel, Seitenvollständigkeit,
erfolgreiches Reopen und den erwarteten terminalen Abbruchzustand. Die hardwareabhängigen Tests
bleiben deshalb standardmäßig `ignored` und werden für ein neues Referenzprotokoll ausdrücklich
mit `--release --ignored --nocapture` gestartet.

## Begrenzte Arbeitsspeicher- und Jobpfade

Der native gemeinsame Preview-Cache besitzt ein festes Budget von 256 MiB. Er zählt dekodierte
RGBA-Bytes sowie kodierte Preview-Data-URLs, verwirft least-recently-used Inhalte, teilt
unveränderliche Bitmaps über `Arc`, fasst gleiche gleichzeitige Misses zusammen und hält den
globalen Cache-Mutex nicht während Dekodierung, Rendering oder PNG-Encoding. Motionänderungen
invalidieren ihre Kartenvorschauen; das Schließen einer Vault leert sämtliche Preview- und
Quellbilddaten. Tests prüfen Bytezähler, Eviction, Oversize-Ablehnung, Invalidierung,
gleichzeitige Misses und vollständige Freigabe beim Schließen. Ein stabiler Prozess-RSS-Wert wird
nicht als portables Budget ausgegeben.

Das Inventar liefert standardmäßig 50 und höchstens 100 reine Metadatenzeilen pro Seite. Bildbytes
kommen ausschließlich über getrennte, hash- und dimensionsgeprüfte Thumbnails mit maximal 48 px
Kantenlänge. Die Oberfläche fordert sie erst nahe dem sichtbaren Bereich an und begrenzt ihren
lokalen Requestcache auf 256 Einträge.

Ein Importjob akzeptiert 1 bis 64 Einträge, höchstens 32 MiB kodiert und 64 MiB dekodiert je PNG
sowie 128 MiB kodiert und 256 MiB dekodiert insgesamt. Inspektion und Import laufen außerhalb
einer lang gehaltenen UI-/Vault-Sperre; Fortschritt ist sichtbar und Abbruch wird bis zum nativen
Endzustand verfolgt. Schließen bleibt während eines aktiven Import- oder Exportjobs blockiert.

## Wiederholbare Prüfpfade

Die beiden Messläufe sind getrennt von der normalen Suite aufzurufen:

```sh
cargo test --release --locked --manifest-path src-tauri/Cargo.toml \
  --test performance_acceptance representative_raster_and_export_measurement \
  -- --ignored --nocapture
cargo test --release --locked --manifest-path src-tauri/Cargo.toml \
  --test asset_scalability inventory_and_import_cancellation_measurement \
  -- --ignored --nocapture
```

Die nicht hardwareabhängigen Grenztests sind Teil der normalen Rust- und Frontendsuite. Der
native AT-SPI-Prüfer liegt in `src-tauri/tests/native_accessibility_probe.py`; er benötigt eine
laufende App und die reale `AT_SPI_BUS_ADDRESS` der Desktop-Sitzung.

## Abschließende Gates

Der P19-Abschlussstand wurde mit Rust 1.97.1 sowie Node 24.19.0/npm 11.17.0 erneut geprüft:

- `cargo fmt --check`, `cargo check --locked --all-targets` und
  `cargo clippy --locked --all-targets -- -D warnings`: bestanden.
- `cargo test --locked`: 241 bestanden, vier ausdrücklich separate Sonderläufe ignoriert.
- Fokussierte Preview-Cache-Regressionen: 13 von 13 bestanden.
- `npm test -- --run`: 177 bestanden in 40 Dateien, einschließlich des neuen
  Suchfokus-Regressionsfalls.
- TypeScript-Typecheck, ESLint, Prettier und normaler Vite-Produktionsbuild: bestanden; der Build
  umfasst 118 Module und enthält keinen `P19_FRAME_PROBE`-Marker.
- Dokumentations-, Architektur- und Integrationsprüfung sowie `git diff --check`: bestanden.

## Gate und verbleibende Grenzen

P19 gilt als abgeschlossen: Der Linux-Workflow ist mit Maus und den geprüften Tastaturpfaden
bedienbar, Pflichtinformationen sind nicht nur farblich oder ausschließlich per Rechtsklick
erreichbar, beide Layoutgrößen bestehen, der Pixelpfad bleibt exakt, große Metadatenbestände sind
seitenweise und ohne Fokusverlust filterbar, Cache und Import sind hart begrenzt, Abbruch reagiert
und der Kernworkflow läuft im isolierten Offline-Namespace.

Nicht durch P19 belegt sind native Windows-/macOS-Läufe, installierbare oder signierte Pakete,
globale OS-Tab-Synthese und ein realer DPR-1,25-Desktop. Diese Punkte werden nicht als bestanden
dargestellt; Plattformartefakte und deren Smokes sind der nächste Schritt P20.
