# P42 · View, Transformationen und Szenen-Autosave

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: 10. September 2026, Linux-Docker, Basiscommit
`f85e24d41197fe74dd64a9d8e2670c382b3f65b8` mit uncommittierten P37–P42-Änderungen.
Node 24.19.0, npm 11.17.0, Rust 1.97.1. Kein Commit, Push oder Release.

## Ergebnis und Prüftor

- [x] View-Reihenfolge verändert die tatsächlich gerenderten Canvas-Pixel.
- [x] Position, Pivot, Rotation, Skalierung, Z, Sichtbarkeit und Sperren überleben Wiederöffnung.
- [x] Szenenspeicherung verändert weder Teile-PNGs noch Manifest oder Originalbild.
- [x] Neue Teilegenerationen verlangen einen ausdrücklichen, überprüfbaren Abgleich.
- [x] Ebenenwahl, Sichtbarkeit, Sperren, Reihenfolge und Transformationen sind ohne Drag-and-drop erreichbar.

Das Implementierungs-/Dateisystem-Prüftor von P42 ist bestanden. Die vollständige
native GUI-/Offline-Gesamtabnahme und die Zielplattformmatrix bleiben P43.

## Umsetzung und Bedienung

[SpriteLayers](../../../frontend/src/sprite-studio/SpriteLayers.tsx) zeigt
Pixel-Thumbnails, Name, Z, Auswahl, Sichtbarkeit und Sperre. Größere Z-Werte liegen
vorne und oben in der Liste. Drag-and-drop und Nach-vorn-/Nach-hinten-Buttons
verwenden dieselbe Umordnungsoperation. Eine Sperre schützt vor direkten
Transformationen und direktem Umordnen; andere Ebenen dürfen weiterhin darüber
oder darunter angeordnet werden. Verdeckte Pixel werden nicht getroffen.

[SpriteCanvas](../../../frontend/src/sprite-studio/SpriteCanvas.tsx) unterstützt
Verschiebezüge, Pfeiltasten mit 1 bzw. Umschalt+Pfeiltasten mit 10 Quellpixeln,
Pan, Fit, Zoom und Undo/Redo. Pointerpositionen werden aus dem tatsächlichen
CSS-Rechteck in Quellpixel umgerechnet; DPR beeinflusst nur die Zeichnung.
Resize, verlorener Pointer-Capture oder Escape verwirft einen laufenden Zug.
Ein Zug erzeugt genau einen History-Eintrag. Eine verspätete Autosave-Antwort
überschreibt keine aktive Verschiebe-Vorschau.

Zahlenfelder bearbeiten Position/Pivot. Rotation und Skalierung werden erst
durch **Freie Transformationen aktivieren** freigegeben. Positionsänderungen
sind standardmäßig ganzzahlig, Nearest-Neighbor bleibt in beiden Modi aktiv.
Skalierung 0,01–100, Rotation ±360000 Grad und Position/Pivot ±10 Millionen
Quellpixel werden begrenzt; negative/ungültige Skalierung wird abgewiesen.
Ungültige Zwischeneingaben blockieren Flush und Modulwechsel statt als
gespeichert zu gelten. Ein eigener Zurücksetzen-Button erhält die Bedienbarkeit.

Die Transformation und Alpha-Trefferprüfung folgen weiterhin der in P41
dokumentierten Matrix `position + R × S × (pixel − pivot)` unabhängig vom Zoom.
**Originalanordnung wiederherstellen** verlangt eine Modalbestätigung, setzt
alle Ebeneneinstellungen auf aktuelle Defaults und ist rückgängig machbar.
Bloßer Registerwechsel oder Wiederöffnung löst keinen Reset aus.

History bleibt im RAM: höchstens 48 kleine Szenensnapshots, zusätzlich ein
1-MiB-Schätzbudget anhand der UTF-16-JSON-Darstellung, kein gemessener Heap-Grenzwert.
PNG-/RGBA-Puffer werden nicht in die History kopiert. Neustart und bestätigter
Generationswechsel beginnen eine neue History. Szenendateien bleiben erhalten.

## Persistenz und bewusster Generationsabgleich

Die neuen APIs `save_sprite_scene` und `inspect_sprite_set` ergänzen die P41-Lese-APIs.
Alle Commands prüfen Session-ID/Generation; Schreiben erfordert einen gültigen
Writer-Lease. Native Validierung erfolgt unabhängig von der UI. Der gemeinsame
SaveQueue-Flush veröffentlicht auch ausstehende 500-ms-Debounces vor Navigation
oder Close. Mehrere Änderungen während eines langsamen Saves werden anschließend
mit der bestätigten Revision nachgesichert. Konflikte behalten die lokale Szene.

Gespeichert werden `sprite.scene.json` und der neue technische Beleg
`.scene/basis.json` im Teileordner. **Diese Zusatzdatei ist die begründete
Erweiterung des geplanten Speicherlayouts:** Der strikte Szenenvertrag bleibt
unverändert, während die alte Crop-Geometrie und ihr Szenen-/Dokumenthash einen
korrekten Abgleich auch nach Neustart ermöglichen. Der Beleg ist niemals die
aktive PNG-Dateiliste und erzeugt keine zweite kanonische Teilegeneration.

Der Writer veröffentlicht Beleg und Szene gemeinsam über das bestehende Journal,
mit Szene zuletzt, alten Hashes, Revision und Create-only bei Neuanlage. Offene
Transaktionen blockieren Leser bis zur Recovery. Ein fremder/beschädigter Beleg,
eine externe Szenenänderung oder unerwartete Revision wird nicht überschrieben.
Die gespeicherte Szene wird nach Commit erneut validiert. Die erste Speicherung
erzeugt Revision 1, jede weitere erhöht sie. Teilemanifest und PNGs bleiben bytegleich.

Ein neuer Stand wird vor Übernahme vollständig geladen/geprüft. Er zeigt neue,
entfernte und geometrisch geänderte Part-IDs. Vorhandene Transformationen,
Sichtbarkeit, Sperren und Z bleiben über stabile IDs erhalten. Abgewählte Extras
werden nicht aus übrig gebliebenen Dateien ergänzt. Bei identischer Quelle gilt
`neuerPivot = alterPivot + alterCropUrsprung − neuerCropUrsprung`; damit behält
derselbe Quellpixel auch bei Rotation/Skalierung seine Weltposition.

Bei anderer Quelle bleibt die numerische Transformation erhalten, aber ihre
geometrische Eignung wird ausdrücklich nicht zugesagt. Fehlt ein passender alter
Beleg, wird dies als unbekannte Geometrie mit Prüfbedarf angezeigt. Auch eine
Manifeständerung mit wiederverwendeter Generation-ID wird anhand des passenden
Belegs erkannt. Ohne alten Beleg kann eine solche unmarkierte historische
Änderung nicht nachträglich bewiesen werden.

**Teile erneut prüfen** kann einen Abgleich aus noch ungespeicherter lokaler
Bearbeitung vorbereiten, ohne zuerst einen ohnehin veralteten Save zu erzwingen.
Bis **Abgleich bestätigen und speichern** bleibt die alte Szene erhalten.
Eine externe Szenenänderung wird separat als Konflikt behandelt. Erst der
ausdrücklich bestätigte Verwerfen-/Neuladen-Ablauf darf die lokale Bearbeitung
verwerfen; keine externe Datei wird dabei verändert.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis, Exit 0 |
| --- | --- |
| `npm --prefix frontend run test` | 738 Tests, 140 Dateien, 100,66 s |
| `npm --prefix frontend run test:e2e` einschließlich Produktionsbuild | 19 Tests, 45,5 s |
| Typecheck, ESLint, Prettier | bestanden |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | 126 Tests: 95 Library, 1 Composition, 18 Recovery, 12 Vault |
| Clippy mit `-D warnings`, rustfmt | bestanden |
| Quell-/Toolingregression | 108 Tests bestanden |
| `python tools/control.py quality architecture` | bestanden, 405 TypeScript-Quelldateien |

Sieben neue [native Szenentests](../../../src-tauri/src/sprite/scene_tests.rs) prüfen
Dateiroundtrip mit sämtlichen Transformationen, unveränderte PNG-/Manifestbytes,
Hash-/Revisionskonflikte, fremde Belege, Dimensionswechsel bei Legacy-Sets,
Generationsabgleich und Recovery nach beiden Publish-Schritten. Der erweiterte
Commandtest weist Saves bei veralteter Generation, Read-only und geschlossener
Sitzung ab und liest eine erfolgreich gespeicherte Szene über echte Commands erneut.

Neun neue [Frontendtests](../../../frontend/src/sprite-studio/editing.test.ts)
prüfen Debounce, slow-save plus spätere Änderung, aktive Zug-Vorschau während
Save-Bestätigung, Locks, Ein-Schritt-Zug-History, Reset/Undo/Redo, 48-Schritt-Grenze,
Neuladen, expliziten Generationsabgleich inklusive ungesicherter Transformationen,
Konflikte, Read-only und ungültige Zahleneingaben. Bestehende Ownership-Tests
warten jetzt auf den nach vorgeschaltetem Flush beginnenden Leseauftrag.

Drei neue [Browsertests](../../../frontend/e2e/p42-scene-editor.spec.ts) prüfen
wirkliche Source-over-Pixel nach Z-Änderung, Tastatur- und Drag-and-drop-Reihenfolge,
Sichtbarkeit/Sperren, Zahlenfelder, Neustart, Reset/Undo, Pointer bei DPR 1,5,
Resize während eines Zuges, 480×360, blockierten Modulwechsel bei ungültigem Feld,
Schreibkonflikt und ersetztes Manifest. Die simulierten IPC-Dateien bleiben
ausdrücklich Browserfixtures; der echte Dateinachweis stammt aus Rust.

Bei Testentwicklung wurden eine Fixture-Aliasreferenz zwischen Manifest-Default
und Szenenposition sowie ein zu früh aufgerufener Test-Release korrigiert.
Die Produktionskorrektur zur späten Save-Antwort hält aktive Canvas-Vorschauen
intakt. Die endgültigen Läufe oben enthalten diese Änderungen.

Loghashes und Quellinventar: [P42-checks.json](P42-checks.json).
Flüchtige Artefakte: `/tmp/p38-p43-validation.Xozjjs/`, insbesondere
`p42-browser-final/` mit Szenen-, 480×360- und Generationsvergleich-Screenshots.
Die [deutsche Sprite-Anleitung](../../guides/sprite-studio.md) beschreibt Bedienung,
Speicherlayout, Transformationen, Konflikte und Grenzen.

Zusätzlicher Infrastrukturfortschritt: Eine echte Tauri-WebView startet inzwischen
unter Xvfb im Container. Ein temporärer Helper-/Bibliothekspfad-Adapter vermeidet
den bisherigen proot/WebKit-Prozessfehler; explizite Mesa-Pfade ermöglichen Software-
Rendering. Der Bootstrap-Screenshot liegt in `/tmp/p42-native-gui.Fmdl9A/welcome.png`.
Dies ist noch kein vollständiger Native-Roundtrip. Keine produktive CSP-/Capability-
Änderung oder neue Dependency wurde dafür vorgenommen. Native Gesamtabnahme,
Offline-Gate, Paketierung und fehlende Windows-/macOS-Nachweise bleiben P43.

Anforderungen: R-G06, R-D02, R-S02, R-S04, R-S05, R-S07.
