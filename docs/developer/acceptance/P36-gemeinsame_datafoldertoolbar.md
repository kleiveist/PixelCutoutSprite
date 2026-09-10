# P36 · Gemeinsame DataFolderToolbar und Dateinavigation

Datum: 2026-09-10. Ausgangsstand: P35 im Arbeitsverzeichnis, aufbauend auf `7b4cc01` (P34).

Status: **Implementierung und abschließende Frontend-/Rust-/Chromium-Prüfungen bestanden.**
Native grafische Windows-/macOS-/Linux-Abnahmen bleiben ausdrücklich offen. P37 wurde nicht
begonnen. Die bereits vorhandenen P35-Änderungen sind die Voraussetzung dieser Phase; deren
[eigener Abnahmebericht](P35-dashboard_popups_ausgabe_explorer.md) bleibt erhalten.

Anforderungen: R-G04, R-D09, R-D10, R-C03, R-S02.

## Ergebnis und Prüftor

| Prüftor | Umsetzung / Nachweis | Bewertung |
| --- | --- | --- |
| Gemeinsamer Kern | Cutout und Sprite verwenden denselben Provider, `DataFolderWorkspace`, `DataFolderToolbar` und nativen Adapter. | Produktive Routen im Chromium-Test geprüft |
| Vaultgebundene Auswahl | Bild-/Set-Auswahl enthält relative Ziele und erfasste Session-ID/Generation. Native Commands prüfen die Sitzung vor und nach der Arbeit. | IPC-, Lebenszyklus-, UI- und echte Rust-Dateisystemtests |
| Begrenzte große Ordner | Direkte Metadaten, stabile Sortierung, Seiten-/Cursorvertrag, explizite Gesamtgrenze, begrenzte Thumbnails und Worker. Kein rekursives Dekodieren beim Listing. | 1.100 Dateien und 20.001-Eintrags-Grenze nativ; Seitenwechsel und Fehler-Cache im Frontend |
| Tastatur und Drawer | Baumsteuerung, Auswahlstatus, Register, fokuserhaltender Modal-Host; Dock ab 800 px, darunter Drawer. | Chromium bei 720×450 und 480×360 bestanden |
| Externe Änderungen | Neu-/Umbenennung/Löschung nach Refresh, Rückkehr-Fokus als automatischer Fallback; geänderte Cursor werden abgewiesen. | Frontend-Fixtures und echte temporäre Rust-Verzeichnisse geprüft |
| Unfertige Sets | Manifestkandidat ist noch keine Freigabe; Prüfung aller erklärten Teile vor Set-Event. Fehler bewahren die letzte gültige Auswahl. | Hash-/Fehlteil-/Symlink-/Schema-Negativfälle geprüft |

R-D10 ist hier hinsichtlich Erkennung und Refresh-Fallback umgesetzt, nicht als abgeschlossene
plattformübergreifende Watcher-/Release-Abnahme. Auch R-C03 und R-S02 erhalten in P36 nur die
Dateiauswahl; die Editorloader bleiben P38 beziehungsweise P41 vorbehalten.

## Komponenten und native Grenze

- [`shared/data-folder/`](../../../frontend/src/shared/data-folder/) enthält den gemeinsamen
  Zod-geprüften IPC-Adapter, die sitzungsgebundene Lese-/Thumbnail-Schicht, Provider, Browserzustand,
  Toolbar und Responsive-Hülle. Es gibt keine zwei kopierten Datei-Browser.
- [`CutoutDataWorkspace.tsx`](../../../frontend/src/cutout-studio/CutoutDataWorkspace.tsx)
  umschließt vorerst den bestehenden Cutout-Inhalt; die produktive Integration erfolgt in
  [`App.tsx`](../../../frontend/src/app/App.tsx). Während Vault-Recovery wird keine zusätzliche
  Dateinavigation über den bestehenden Recovery-Ablauf gelegt.
- [`SpriteStudioWelcome.tsx`](../../../frontend/src/sprite-studio/SpriteStudioWelcome.tsx)
  verwendet dieselbe Hülle und das `DataFolderViewSlot`-Interface. Dateien-/View-Panels bleiben
  beim Registerwechsel montiert, der Editor ist davon getrennt. Modulbezogene Auswahlbelege
  leben im Provider, nicht in LocalStorage. Der View-Slot zeigt derzeit nur geprüfte Set-Metadaten.
- [`useModalFocus.ts`](../../../frontend/src/components/useModalFocus.ts) ignoriert nun auch
  Bedienelemente innerhalb ausgeblendeter/inert gesetzter Vorfahren. Sonst könnten versteckte
  Registerinhalte den Fokuszyklus des Drawers verfälschen. Die P35-Fokusrückgabe bleibt erhalten.
- [`workspace/data_folder/mod.rs`](../../../src-tauri/src/workspace/data_folder/mod.rs)
  implementiert Listing, Aktivierung und Thumbnail-Lesen ohne Project-/Area-Inventarmodell.
  Der Ausgangspfad stammt ausschließlich aus der aktiven Vault-Sitzung. Portable relative Pfade,
  reguläre Dateien, Symlinks und unter Windows Reparse-Points werden geprüft. Unix-Lesebelege
  vergleichen zusätzlich Device/Inode; Pfade und Dateimetadaten werden nach dem Lesen erneut
  geprüft. Unbekannte Dateien werden weder an eine Shell noch an einen externen Öffner übergeben.
- [`commands/workspace.rs`](../../../src-tauri/src/commands/workspace.rs) registriert drei neue
  generische Tauri-Commands. Die begrenzte blockierende Arbeit läuft außerhalb des Vault-Service-
  Locks; ein RAII-Permit wird auch bei Fehlern freigegeben. Session-ID und Generation werden nach
  Abschluss nochmals geprüft. CSP, allgemeine Dateisystemrechte und Capabilities wurden nicht
  erweitert. Der in P35 behobene generische `AppHandle<R>`-Vertrag bleibt kompilierbar.
- [`manifest.rs`](../../../src-tauri/src/workspace/data_folder/manifest.rs) prüft das P28-
  `spriteParts`-Format: IDs, Version, normierte PNG-Namen, Koordinaten, Elternzyklen, Pflichtteile,
  ausdrückliche Auslassungen und SHA-256. Alle erklärten PNGs werden begrenzt gelesen/dekodiert,
  ihre Abmessungen verglichen und am Ende die Dateibelege sowie das Manifest erneut geprüft.
  Quellbild-/Snapshot-Pfade werden strukturell geprüft, deren Inhalte hier noch nicht als
  Editorquelle geladen. Diese Aufgabe bleibt beim späteren Loader.

Der neue Kern setzt keine alte Area-Pflichtstruktur voraus. Die bisherige Cutout-Oberfläche wird
in dieser Phase bewusst noch nicht entfernt; ihr Umbau ist P37. Die vorgeschlagenen neuen
Datei-Anker wurden übernommen, mit einer kleinen `CutoutDataWorkspace`-Adapterkomponente.

### IPC-Vertrag

| Command | Eingabe zusätzlich zu `sessionId` / `sessionGeneration` | Ergebnis |
| --- | --- | --- |
| `list_workspace_entries` | `query`: relativer Ordner, Suche, Filter, technische Sichtbarkeit, Limit, Cursor | Direkte Einträge mit Fingerprint/Typ, nächster Cursor, Treffer- und Auslassungszahl |
| `inspect_workspace_entry` | Relativer Eintrag, erwarteter Metadaten-Fingerprint | `image`, validiertes `sprite_set` oder `directory` mit `ordinary` / `in_progress` / `invalid` |
| `read_workspace_thumbnail` | Relativer Bildeintrag, erwarteter Fingerprint | Begrenztes PNG-Data-URI und Quell-SHA-256 |

Nur ein tatsächlich geprüftes Bild/Set erzeugt `DataFolderSelection`; ein normaler Ordner
expandiert. Ein Set-Kandidat expandiert ebenfalls, wird aber erst nach erfolgreicher Prüfung
zum Set-Event. Ausstehende Saves werden vor Aktivierung/Refresh geflusht. Eine misslungene Prüfung
ersetzt keinen vorherigen Auswahlbeleg. Nach externen Änderungen bleibt dieser ausdrücklich
**Letzte geprüfte Auswahl**, nicht eine Behauptung über den aktuellen Dateizustand.

### Begrenzungen

| Ressource | Grenze |
| --- | --- |
| Verzeichnis | 20.000 direkte Einträge; darüber erklärter Fehler statt stiller Teilliste |
| Seite | Frontend 50, native API 1–100; veränderte oder fremde Cursor ungültig |
| Baumzustand | 12 gleichzeitig aufgeklappte Ordner, 24 gecachte Ordnerseiten einschließlich Fehlerseiten |
| Suche / Pfad / Cursor | 120 Zeichen / 1.024 native Bytes / 512 Bytes; zusätzliche portable Segmentregeln |
| Native Dateiarbeit | Höchstens vier gleichzeitig zugelassene Jobs; keine unbeschränkte Wartequeue |
| Thumbnail | Höchstens 96×96 px; zwei aktive Anfragen, 64 wartende, 32 Cache-Einträge je Sitzung |
| Einzelbild | 16 MiB kodiert, 8.192 px je Achse, 16.777.216 Pixel, 64 MiB dekodierter Bildpuffer; Decoder-Limit 128 MiB |
| Set-Aktivierung | Manifest 1 MiB; 1–18 erklärte PNG-Teile; zusammen 64 MiB kodiert / 33.554.432 erklärte Pixel |

Das Listing liest Namen und Metadaten, keinen kompletten Bildinhalt. Sortiert wird nach Ordnern
zuerst, kleingeschriebenem Namen und Originalnamen als deterministischem Tie-Breaker. Je
ausgegebenem Ordner wird höchstens ein Manifest-Metadatenkandidat geprüft. Seiten ersetzen
einander im Baum; sie werden nicht zu einer unbegrenzten Liste angehängt. Der Cursor enthält
Abfrage- und Metadaten-Snapshot-Hashes. Er ist kein Sicherheits- oder Authentisierungstoken.

Thumbnails starten bei Sichtbarkeit und können abgeschaltet werden. Refresh und Vault-Wechsel
verwerfen Caches und noch wartende Aufgaben. Bereits laufende native Reads enden innerhalb ihrer
Grenzen; veraltete Antworten werden verworfen, nicht als neue Auswahl veröffentlicht. Fokus-/
Sichtbarkeitslistener, Timer und IntersectionObserver werden beim Abbau freigegeben. Der Provider
ist auch unter React-StrictMode-Effektwiederholung geprüft.

## Entscheidungen und Abweichungen

- **P36-D01 – Suche ohne Vollscan:** Suche/Filter gelten pro direkt gelesenem Ordner. Breadcrumbs
  und „Diesen Ordner durchsuchen“ wechseln den Ausgangspfad. Keine rekursive Volltextsuche und
  kein vorausgesetzter persistenter Dateibaumindex. Das begrenzt Arbeit und hält externe Pfade
  transparent; die Oberfläche benennt den Suchbereich.
- **P36-D02 – Refresh-Fallback:** Externe Änderungen werden ausdrücklich per Refresh und nach
  Fensterfokus/Sichtbarkeit neu eingelesen (200-ms-Zusammenfassung). Kein neuer OS-Watcher und
  kein dauerhaftes Polling. Die native Plattformabnahme von Dateisystemereignissen bleibt offen.
- **P36-D03 – Fertig gegenüber absichtlich unvollständig:** Fehlende Hash-Dateien und veränderte
  Generationen geben `in_progress`, ungültige Manifeste `invalid` zurück. `complete: false`
  mit ausdrücklich begründeten Auslassungen und sämtlichen erklärten, konsistenten PNGs ist ein
  auswählbares, sichtbar unvollständiges Set; es ist kein halb publizierter Dateisatz.
- **P36-D04 – ADR-18-Bildeingaben:** PNG, JPEG und WebP verwenden denselben begrenzten Decoderweg.
  Die bestehende `image`-Version bleibt unverändert im Lockfile; neu aktiviert sind `jpeg` und
  `webp`. Dazu kommen genau `image-webp 0.2.4`, `quick-error 2.0.1`, `zune-core 0.5.3` und
  `zune-jpeg 0.5.15`. Teile und Vorschaubilder bleiben PNG. Die zusätzlichen Opener-Abhängigkeiten
  im gemeinsamen Diff gehören zu P35, nicht zu dieser Formatfreigabe.
- **P36-D05 – Sichtbare Phasengrenze:** Auswahlen sind vorläufige Loader-Eingaben, kein Ersatz
  für P38/P41. Editor-/View-Zustand bleibt beim Registerwechsel erhalten. Die UI behauptet
  ausdrücklich noch keine Cutout-Neuanlage oder Sprite-Komposition.

Technische Punktverzeichnisse (außer `.PixelPrompt`), `node_modules` und `target` sind
standardmäßig ausgeblendet. Auch bei eingeschalteter technischer Sichtbarkeit können sie nicht
als Originalbildquelle aktiviert werden. Es wurden keine Dateischreib-/Löschaktionen ergänzt.
Für Leser gibt es eine [Bedienanleitung](../../guides/data-folder-navigation.md).

## Testnachweise

- [`DataFolderWorkflow.test.tsx`](../../../frontend/src/shared/data-folder/DataFolderWorkflow.test.tsx):
  acht UI-Fälle: gemeinsamer Kern unter StrictMode, Session-Belege, keine LocalStorage-Schreibungen,
  erhaltene Editor-/View-Werte, Seitenwechsel, externe Neu-/Umbenennung/Löschung, technische und
  unfertige Auswahl, Flush vor Aktivierung/Refresh, spätes Listing nach Vault-Wechsel, Fokus-
  Refresh, Fehlererhalt, begrenzter Cache auch bei ausschließlich fehlgeschlagenen Unterordnern,
  Listener-Cleanup und Drawer-Fokusrückgabe.
- [`dataFolderClient.test.ts`](../../../frontend/src/shared/data-folder/dataFolderClient.test.ts):
  fünf Adapter-/Lebenszyklusfälle für IPC-Schlüssel, fremde/unsichere Antworten, alte Sitzung,
  Refresh-Epoche, Thumbnail-Parallelität und Cache-/Queue-Abbau.
- [`useModalFocus.test.tsx`](../../../frontend/src/components/useModalFocus.test.tsx): zwei
  bestehende Regressionstests, ergänzt um versteckte Register-Bedienelemente im Fokuszyklus.
- [`workspace/data_folder/tests.rs`](../../../src-tauri/src/workspace/data_folder/tests.rs):
  neun Tests mit echten temporären Dateien, darunter stabile Seiten, echte externe Änderungen,
  Traversal/Symlinks/technische Pfade, beschädigte und übergroße Bilder, PNG/JPEG/WebP inklusive
  Inhalts-/Endungsabweichung, Set-Prüfsummen, fehlende Teile und ausdrückliche Auslassungen.
  Ein weiterer Command-Test in `commands/workspace.rs` prüft Produktionskomposition mit
  Mock-Runtime, Session-Generation, geschlossene Sitzung, vier Jobs und Permit-Freigabe.
- [`p36-data-folder.spec.ts`](../../../frontend/e2e/p36-data-folder.spec.ts): zwei neue echte
  Chromium-Durchläufe gegen Produktionsbuild und Router mit explizitem IPC-Fixture. Beide
  Modulrouten, Auswahl, Breadcrumb/Refresh, View-Register, Drawer bei 720×450 und 480×360,
  Pfeiltasten/Enter/Escape, vollständig sichtbares X und Fokus-Rückgabe. Das sind **keine nativen
  Dateisystem-/Fenstertests**. Die fünf P35-/Shell-Browserfälle bestehen weiterhin.

Die drei P36-Screenshots werden reproduzierbar unter `frontend/test-results/` erzeugt. Dock sowie
beide Drawergrößen wurden visuell geprüft. Temporäre Screenshots und Konsolenlogs sind nicht
als dauerhafte Repository-Artefakte vorgesehen; verlinkte Testquellen und Befehle sind die
reproduzierbaren Nachweise. Kein Test wurde gelöscht oder neu ignoriert.

### Abschlussbefehle, ausgeführt am 2026-09-10

| Befehl | Ergebnis |
| --- | --- |
| `npm --prefix frontend test -- --run src/shared/data-folder/DataFolderWorkflow.test.tsx src/shared/data-folder/dataFolderClient.test.ts src/components/useModalFocus.test.tsx` | Exit 0, 3 Dateien / 15 Tests bestanden, 10,90 s |
| `python tools/control.py test --suite frontend` | Exit 0, Gesamtsuite mit **166 Dateien / 847 Tests** bestanden, 106,83 s; unveränderte Standard-Isolation und vier Worker |
| `cargo check --locked --all-targets --all-features --manifest-path src-tauri/Cargo.toml` | Exit 0 mit den finalen Bilddecoder-Features |
| `cargo test --locked --all-targets --all-features --manifest-path src-tauri/Cargo.toml` | Exit 0, **288 Tests bestanden**, vier bestehende explizit ignorierte native/hardwarespezifische Fälle; ein zusätzlicher erfolgreicher Crash-Test-Unterprozess nicht doppelt gezählt |
| `python tools/control.py tauri test --cargo` | Erneut Exit 0 nach den finalen Decoder-Features: Strukturprüfung, Cargo check und Rust-Tests bestanden |
| `npm --prefix frontend run typecheck` / `run lint` / `run format:check` | Jeweils Exit 0 |
| `npm --prefix frontend run test:e2e` | Exit 0 einschließlich TypeScript-/Vite-Produktionsbuild, 7/7 Chromium-Tests bestanden, 8,2 s |
| `rustfmt --edition 2021 --check --config skip_children=true …` für die zehn neuen/geänderten Rust-Dateien außer dem unten genannten Altbestand | Exit 0 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Nicht grün: bereits vorhandene Formatabweichungen in `src/commands/settings.rs` und `src/workspace/mod.rs`; außerhalb des neuen Moduls nicht umformatiert |
| Prüfung der relativen Links in beiden Phasenberichten, der neuen Anleitung und ihren Indizes | Alle verlinkten lokalen Ziele vorhanden |

Ein vorheriger kompletter Frontend-Lauf meldete 846 bestandene Tests und einen Fehler im
bestehenden Recovery-Test: Er erwartete den ersten Heartbeat unmittelbar nach Sichtbarkeit der
Überschrift, obwohl dieser in einem nachgelagerten React-Effekt startet. Der
[`Recovery-Test`](../../../frontend/src/app/App.recovery.test.tsx) wartet nun ausdrücklich auf
genau diesen ersten Aufruf; Anzahl und nachfolgende Exklusivitätsprüfungen bleiben unverändert.
Es wurde dafür weder der produktive Heartbeat geändert noch ein Test deaktiviert.
Der anschließende gezielte Recovery-Lauf bestand mit 4/4 Tests. Die vier ignorierten Rust-Fälle
sind bestehende P19-Hardware-/native Walkthrough-Gates sowie die Godot-4.7.2-Editorintegration;
sie sind ausdrücklich nicht als bestanden gezählt.

Der darauf folgende Frontend-Gesamtlauf parallel zur Rust-Suite meldete zwei Fehler in den
unveränderten V2-`WizardView`-Kompatibilitätsfällen (unerwartete zweite Draft-Schreibung und
fehlender `materialType` im erwarteten gespeicherten Holztextur-Draft). Die P36-Fälle bestanden.
Der separate Abschlusslauf ohne parallele Rust-Last bestand vollständig. Damit sind diese
Legacy-Fehler im letzten Lauf nicht reproduziert, ihre Ursache aber nicht als behoben bewiesen;
Last-/Timing-Empfindlichkeit bleibt ein dokumentierter Restbefund. Globale Test-Timeouts,
Workerzahl und Prüfungen wurden nicht gelockert.

Umgebung: Linux/Docker; Node.js 22.23.2, npm 10.9.8, Python 3.11.2, Rust/Cargo 1.97.1.
Node/npm liegen unter den Repository-Empfehlungen. Die Prüfungen fanden dennoch in genau dieser
Umgebung statt. Die in P35 temporär bereitgestellte Rust-Toolchain und Linux-/Chromium-
Systembibliotheken wurden weiterverwendet. Es wurden keine GitHub-Anmeldedaten erzeugt oder
in dauerhafte Pfade kopiert.

## Offene native Gates und manuelle Nachprüfung

Ein grafischer nativer Desktop ist in dieser Docker-Sitzung weiterhin nicht verfügbar. Offen
sind Windows-/macOS-Laufzeit, echte Windows-Junctions, native Linux-Fensterbedienung, 200-%-Zoom
und Plattform-Dateisystemereignisse. Linux-Pfadtests, Mock-Runtime und Chromium ersetzen diese
Gates nicht. Die bestehende plattformübergreifende P30-Race-/Dateisystemabnahme bleibt relevant;
Metadaten-/Hash-Nachprüfungen sind keine Behauptung einer vollständig descriptorbasierten,
plattformübergreifend race-freien Dateisystemauflösung. Die offenen P35-Dateimanager-/Explorer-
Fensterprüfungen gelten unverändert weiter.

Auf einem Desktop mit installierten nativen Tauri-Systembibliotheken:

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri test --cargo
python tools/control.py tauri run --foreground
```

Mit einem Test-Vault beide Bildmodule öffnen, ein Bild und einen vorhandenen gültigen P28-
Teileordner auswählen, mit Pfeiltasten und Enter navigieren sowie Dateien/View wechseln. Das
Fenster auf 720×450 verkleinern; Drawer mit Escape, X und Hintergrund schließen, Fokus prüfen.
Extern ein Bild anlegen, umbenennen und löschen, zur App zurückkehren und zusätzlich Refresh
testen. Eine fehlende oder veränderte Set-PNG darf keine neue gültige Set-Auswahl erzeugen.
Vault wechseln, während eine Anfrage läuft: keine alten Zeilen, Vorschauen oder Auswahlevents
dürfen im neuen Vault erscheinen. Danach native Ergebnisse und Plattformdetails protokollieren.

P36 endet mit diesem Bericht. P37 ist der nächste, separat zu beauftragende Abschnitt.

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->
