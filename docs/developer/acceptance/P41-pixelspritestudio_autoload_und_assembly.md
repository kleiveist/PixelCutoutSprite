# P41 · Sprite-Autoload und Originalanordnung

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: 10. September 2026, Linux-Docker, Basiscommit
`f85e24d41197fe74dd64a9d8e2670c382b3f65b8`, uncommittierte P37–P41-Änderungen.
Node 24.19.0, npm 11.17.0, Rust 1.97.1. Kein Commit, Push oder Release.

## Ergebnis und Prüftor

- [x] Klick/Enter auf einen gültigen Teileordner lädt die Originalanordnung automatisch.
- [x] Manifestversion, Namen, IDs, Pfade, Hashes, Größen und Generation werden geprüft.
- [x] Asymmetrische Teile mit nicht mittigen Pivots und explizitem Z werden korrekt dargestellt.
- [x] Bekannte PNG-Namen ohne Manifest sind ausdrücklich ein manuell auszurichtendes Legacy-Set.
- [x] Defekte Dateien oder konkurrierende Änderungen lassen die vorherige valide Szene erhalten.

Das Implementierungs-Prüftor ist bestanden. Die echte native WebView-/Desktop-
Gesamtabnahme ist weiterhin das getrennte P43-Gate. Native Datei-/Commandtests
und Browser-IPC-Fixtures sind keine Behauptung eines nativen GUI-Roundtrips.

## Umsetzung

Die [Sprite-Ansicht](../../../frontend/src/sprite-studio/SpriteStudio.tsx) ersetzt
den Platzhalter, verwendet den gemeinsamen Vault-Einstieg und die gemeinsame
DataFolderToolbar mit Dateien/View. Auswahl im View und Registerwechsel bleiben
innerhalb derselben Sitzung erhalten. Die Liste zeigt die vorderste Ebene oben.
Bereits gespeicherte valide Szenen haben Vorrang vor Manifest-Defaults.

Der [native Loader](../../../src-tauri/src/sprite/repository.rs) liest ausschließlich
Manifest-Mitglieder. Zurückgebliebene, nicht gelistete Extras werden nicht geladen.
Eine absichtlich ausgelassene Pflichtkomponente erzeugt einen begründeten Hinweis;
eine laut Manifest erforderliche, fehlende PNG ist ein Ladefehler. Ein vorhandenes
defektes Manifest führt niemals zum ungeprüften Legacy-Fallback. Ohne Manifest
werden nur feste Katalognamen akzeptiert, mit höchstens einer Zubehörvariante.
Auch gleich große Legacy-PNGs werden nicht ohne Herkunftsbeweis als ursprüngliche
Anordnung bezeichnet.

Die Transformation ist unabhängig vom Canvas-Zoom:
`world = position + R(rotation) × S(scale) × (localPixel − pivot)`.
Mit Rotation 0, Skalierung 1 und `defaultPosition = sourceRect.origin + pivot`
landet jeder Ausschnitt am ursprünglichen Ort. Größeres `defaultZ` zeichnet später;
PNG-Nummern sind keine Z-Regel. Bei gleichem Z sortiert die stabile Part-ID.
Trefferprüfung verwendet die inverse Matrix und die tatsächliche Pixelalpha.
Nearest-Neighbor und Source-over sind explizit gesetzt. Halbtransparente überlappende
Pixel können deckender werden; allgemeine Originalalpha-Gleichheit wird nicht versprochen.

Die neuen APIs `open_sprite_set` und `read_sprite_pixels` binden jeden Leseauftrag
an Session-ID und Generation. Binäre RGBA-Übertragung vermeidet Base64-Kopien.
Im Frontend werden höchstens zwei Teile gleichzeitig übertragen und erst nach
abschließender Manifest-/Szenenprüfung gemeinsam aktiviert. Texturen werden bei
Wechsel/Unmount freigegeben. Rasterbudgets: 16 Megapixel pro Teil, 8192 px pro Achse,
16 MiB pro PNG, insgesamt 64 MiB kodierte PNGs und 32 Megapixel. Technische Ordner,
Symlinks, Traversal und unbegrenzte Transformationen werden nativ abgewiesen.

P41 schreibt keine Szene oder PNG. Eine gespeicherte Szene mit anderer Generation
wird ausdrücklich zurückgewiesen und nicht mit Defaults überschrieben. Der
bedienbare Generationsabgleich und die Szenenbearbeitung folgen in P42.

## Regression während der Abschlussprüfung

Der vollständige Frontend-Lauf deckte zwei Zeitfenster im gemeinsamen Wizard-
Autosave auf: vollständiges Formular-Reset konnte unmittelbar folgende Eingaben
verlieren; ein erneutes Abonnieren bei geänderten Callback-Identitäten konnte einen
ausstehenden Save abbrechen. Zwei deterministische Tests schlugen vor der Korrektur
fehl und bestehen danach. Speichern erhält jetzt Feldregistrierungen und Eingaben;
Aufräumen des Timers erfolgt bei tatsächlichem Unmount, nicht bei bloßer
Callback-Aktualisierung. Die Korrektur ändert keinen Persistenzort oder Generatorvertrag.

Außerdem wurden eine veraltete P28-Testfixture mit Vault-relativem statt
Set-relativem PNG-Namen und eine Browser-Erwartung an den abgeschafften
Sprite-Platzhalter an die tatsächlichen Verträge angepasst.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm --prefix frontend run test` | Exit 0, 729 Tests in 139 Dateien, 98,85 s |
| `npm --prefix frontend run test:e2e` einschließlich Produktionsbuild | Exit 0, 16 Tests, 35,1 s |
| Typecheck, ESLint, Prettier | Exit 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | Exit 0, 119 Tests: 88 Library, 1 Composition, 18 Recovery, 12 Vault |
| Clippy mit `-D warnings`, rustfmt | Exit 0 |
| Quell-/Toolingregression | Exit 0, 108 Tests |
| `python tools/control.py quality architecture` | Exit 0, 400 TypeScript-Quelldateien |

Die [nativen Sprite-Tests](../../../src-tauri/src/sprite/tests.rs) prüfen echte
PNG-/Manifestdateien, unabhängige Koordinatenerwartungen, vorhandene Szenen,
ungeprüfte Extras, kaputte/fehlende PNGs, fremde Generationen, Pfadmanipulation,
Symlinks und Legacy-Grenzen. Der Commandtest prüft echte Dateien, binäres IPC,
veraltete Session-Generationen und geschlossene Vaults.
Frontendtests prüfen Eigentümerschaft, späte Antworten, gebündelte Aktivierung,
Matrix/Inverse, Alpha-Treffer und Vertragsverletzungen.

Der [Browsertest](../../../frontend/e2e/p41-sprite-assembly.spec.ts) prüft wirkliche
Canvas-Pixel: opak Rot/Gelb, eine halbtransparente Grün/Blau-Überlappung, Alpha 0/91,
die Originalposition unabhängig von den Produktions-Matrixhelfern sowie View-
Reihenfolge, erhaltene Auswahl, Ladefehler und schmale Drawer. Seine IPC-Antworten
sind kontrollierte Testfixtures. jsdoms fehlendes `getContext` wird nicht als
Canvas-Beweis verwendet.

Loghashes und Quellinventar stehen in [P41-checks.json](P41-checks.json).
Flüchtige Logs/Traces/Screenshots: `/tmp/p38-p43-validation.Xozjjs/`, insbesondere
`p41-browser-resumed/`. Frühere fehlgeschlagene und abgebrochene Läufe bleiben
als solche nachvollziehbar; ausschlaggebend sind die oben aufgeführten Abschlussläufe.

Keine Änderungen an Abhängigkeiten, Lockdateien, portablem Tooling, CSP oder Capabilities.
Offen: P42-Kompositionsbearbeitung und -Autosave; P43-Native-Roundtrip, Plattformnachweise,
Gesamthärtung und vollständige Nutzerdokumentation.

Anforderungen: R-G03, R-G05, R-D09, R-S01, R-S02, R-S03, R-S06, R-S07, R-S08.
