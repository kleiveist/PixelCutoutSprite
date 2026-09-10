# P40 · PNG-Teile, Manifest und kanonisches Schnittprojekt

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: 10. September 2026, Linux-Docker, auf Basis von
`f85e24d41197fe74dd64a9d8e2670c382b3f65b8` mit uncommitteten P37–P40-Änderungen.
Node 24.19.0, npm 11.17.0, Rust 1.97.1. Kein Commit, Push oder Release.

## Ergebnis und Prüftor

- [x] Alle 15 Standardnamen und die optionalen Slots 16/17/18 folgen dem zentralen Register.
- [x] Einzel-PNGs erhalten Quell-RGBA innerhalb der Maske; außerhalb ist Alpha 0.
- [x] Halb-offene Crop-Rechtecke, begrenztes Padding und Originalpositionsformel sind geprüft.
- [x] Unterbrochene Generationen sind nicht als fertiges Set ladbar; Recovery stellt einen vollständigen Stand her.
- [x] Wiedererzeugen schützt fremde/geänderte Dateien und verändert eine vorhandene Szene nicht.
- [x] Das kanonische Schnittprojekt und ein kopierter Teileordner lassen sich ohne ursprünglichen absoluten Pfad laden.

Das **Implementierungs-/Dateisystem-Prüftor von P40 ist bestanden**. Eine native
WebView-Gesamtabnahme und die plattformbezogenen Nachweise bleiben das gesonderte P43-Gate.
Browser-IPC-Fixtures werden nicht als native GUI-/Dateisystemintegration gewertet.

## Bedienung und Ausgabe

Der Editor verlangt für jeden Pflichtteil eine bestätigte sichtbare Maske oder
eine ausdrücklich begründete Auslassung. Auslassungen ergeben `complete: false`;
es entstehen keine leeren Ersatz-PNGs. Optionale Teile dürfen unmarkiert/deaktiviert
bleiben. Ein begonnenes Extra muss vor Ausgabe bestätigt oder deaktiviert werden.
Mindestens ein sichtbarer bestätigter Teil ist erforderlich.

**Ausgabe prüfen** sichert zunächst die Masken und schlägt den Teileordner neben
der Quelle unter ihrem Stammnamen vor. Ein bereits belegter fremder Ordner wird
nicht übernommen, auch nicht über einen Groß-/Kleinschreibungsalias. Stattdessen
erscheint ein stabiler `-cutout-<ID-Hash>`-Alternativname, bei weiteren Kollisionen
ein zusätzlicher Zähler. Erst **PNG-Teile jetzt erzeugen** bestätigt dieses konkrete Ziel.

Der Zubehörselektor verwendet genau einen Slot: `17_belt_accessory.png` oder
`17_sword.png`. Ein Variantenwechsel übernimmt bewusst die vorhandene Slot-Maske;
die alte Varianten-History wird verworfen, nicht die Maske. Cape und Haare bleiben
`16_cape.png` und `18_hair.png`, unabhängig von ausgelassenen Nachbarn.

Padding ist eine ausdrückliche Ausgabeoption von 0–64 Quellpixeln, Standard 0;
es wird an den Bildgrenzen begrenzt. Für identische Ausgabe müssen dieselben Masken
und derselbe Paddingwert verwendet werden. Es werden keine Pixel interpoliert oder
fehlenden Körperteile ergänzt. Originalfarben einschließlich unsichtbarer RGB-Werte
innerhalb ausgewählter Alpha-0-Pixel bleiben erhalten. Außerhalb der binären Maske
wird transparentes Schwarz geschrieben. Überlappungen bleiben unabhängig.

Das Manifest enthält stabile Set-ID, neue Generation-ID, Cutout-Revision,
Original-/Snapshot-Hashes und -Größe, tatsächliche Dateien/Hashes, Crop-Rechtecke,
Pivot, Originalposition, Standard-Z, Elternverweise und begründete Auslassungen.
Die Positionsformel ist `defaultPosition = sourceRect.origin + pivot`.
Der initiale Pivot ist das ganzzahlige lokale Crop-Zentrum. Die größere Z-Zahl
zeichnet später vorne; Z wird aus einer eigenen, zwischen Rust und TypeScript
geteilten Reihenfolge gelesen, nicht aus der PNG-Nummer abgeleitet.

## Eine kanonische Ablage und sichere Veröffentlichung

Die [native Generierung](../../../src-tauri/src/cutout/generation.rs) schreibt PNGs,
`.source/original.png`, `.masks/<partId>.json`, `cutout.project.json` und zuletzt
`sprite.parts.json` über denselben [Transaktionswriter](../../../src-tauri/src/workspace/mod.rs).
Beim ersten Erzeugen werden die eigenen Recovery-Projektdateien innerhalb dieser
Transaktion hashgeprüft entfernt und durch einen kleinen `location.json`-Verweis
auf das kanonische Projekt ersetzt. Es bleibt keine zweite aktive Projektkopie.
Unbekannte Dateien im Recovery-Kontext werden nicht angefasst.

Der Writer prüft alle Schreib-/Löschziele vor der ersten Veröffentlichung.
Löschungen benötigen den Hash der bisher verwalteten Datei; alte Bytes bleiben
bis zum Gesamtcommit in Transaktionsbackups. Ein vorbereitetes, noch nicht
veröffentlichtes Staging kann nach Abbruch verworfen werden. Eine begonnene
Veröffentlichung wird per Journal fortgesetzt. Bereits abgeschlossene Schritte
werden bei Wiederaufnahme erneut auf Fremdänderungen geprüft. Stage-/Backup-Pfade,
Journal-Ort, doppelte Ziele und Transaktions-ID werden strikt validiert.

Solange ein verwalteter Dateisatz offen ist, melden Set-/Projektloader einen
Konflikt, auch wenn identische PNG-Hashes noch zum alten Manifest passen würden.
Erfolg wird erst nach Gesamtcommit und erneutem Lesen/Validieren von Set und
Schnittprojekt gemeldet. Diese Ladbarkeitsgarantie gilt für die App; beliebige
externe Programme beachten ihr Transaktionsjournal nicht automatisch.

Wiedererzeugen verwendet ausschließlich die Dateiliste und alten Hashes des
bisherigen gültigen Manifests. Abgewählte verwaltete Teile werden gezielt entfernt.
Manuell geänderte Dateien oder neue fremde Dateien mit benötigten Namen blockieren
den Vorgang. Unbekannte Nachbardateien und `sprite.scene.json` bleiben bytegleich.
Masken-Autosave entfernt beim Zubehörwechsel ebenfalls nur die bisherige eigene,
hashgeprüfte Variantendatei. Die ursprüngliche Quelle wird vor/nach Kodierung geprüft
und niemals geändert.

Die Grenzen bleiben 16 MiB je verwalteter Datei, 16 Megapixel/8192 px je Quellachse,
64 MiB summierte Ausgabe-PNGs und 32 Megapixel summierte Ausschnitte. Überschreitungen
ergeben eine Fehlermeldung vor Veröffentlichung. Erzeugen läuft außerhalb des UI-Threads;
Maskenbedienung ist währenddessen gesperrt. Ein eigener Ausgabe-Cancel ist nicht vorgesehen;
Abbruch-/Crash-Recovery ist getestet.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis, Exit-Code 0 |
| --- | --- |
| `npm --prefix frontend run test` | 720 Tests, 137 Dateien, 115,28 s |
| `npm --prefix frontend run test:e2e` mit Produktionsbuild | 14 Tests, 28,5 s |
| Typecheck, ESLint, Prettier | bestanden |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | 111 Tests: 80 Library, 1 Composition, 18 Recovery, 12 Vault |
| Clippy mit `-D warnings`, rustfmt | bestanden |
| Quell-/Toolingregression | 108 Tests bestanden |
| `python tools/control.py quality architecture` | bestanden, 390 TypeScript-Quelldateien |

Die neun [nativen Generierungstests](../../../src-tauri/src/cutout/generation_tests.rs)
prüfen alle Namen und Pixel/Alpha/Hashes, die Positionsformel unabhängig vom Generator,
Maskenüberlappung, Auslassungen, leere/pending Sets, Fremdordner, Case-Aliase,
fremde/geänderte PNGs, erhaltene Szenenbytes, Gürtel→Schwert→Gürtel, fehlende Extras,
portable Kopien sowie Erstgenerierung und Wiederöffnung. Acht Fault-Injection-Punkte
(Schritte 1/19/20/21/54/55/56/57 der 57-Schritt-Fixture) umfassen Recovery-Löschungen,
PNG-Veröffentlichung, Locator, Projekt und Manifest. Ein eigener Wiedererzeugungstest
prüft die Sperre bei unveränderten PNG-Hashes und ausstehendem Manifestcommit.

Drei zusätzliche Writer-Tests prüfen unvollständiges Prepared-Staging, manipulierte
Journalpfade/Fremdänderungen nach Crash und das Lösch-Backup-Fenster vor Cursorpersistenz.
Der erweiterte [Command-Test](../../../src-tauri/src/commands/cutout.rs) führt
Speichern→Zielprüfung→Generieren→Set-Wiederöffnung über echte native Commands aus
und weist Generierung in einer Read-only-Sitzung ab.
Vier [Frontendtests](../../../frontend/src/cutout-studio/generation.test.ts) prüfen
Flush, explizite Bestätigung, Variantenwahl, Konflikte, Read-only und gesperrte Bedienung.
Der [Browsertest](../../../frontend/e2e/p40-parts-generation.spec.ts) bedient alle
15 Pflichtteile plus Schwert, bestätigt die Ausgabe und öffnet den gespeicherten
kanonischen Zustand nach Browserneustart wieder. Seine Dateiantworten sind kontrollierte
Fixtures; native Datei- und Pixelbeweise stammen aus den Rust-Tests.

Ein Writer-Randfall bei direkt im Vault liegenden Zieldateien wurde durch den neuen
Lösch-Recovery-Test gefunden und behoben. Ein anfänglich falscher Erwartungsname im
Browsertest wurde auf den tatsächlichen Katalogtext „Schwert-Zubehör“ korrigiert.
Der abschließende vollständige Lauf besteht. jsdom meldet im Gesamtlauf weiterhin
fehlendes Canvas-`getContext`; die Canvas-Pfade werden zusätzlich im realen Browser geprüft.

[P40-checks.json](P40-checks.json) enthält Loghashes und den Quellinventarhash.
Flüchtige Logs, Traces und Screenshots liegen in `/tmp/p38-p43-validation.Xozjjs/`;
Bildbeispiel: `p40-browser-final/.../p40-complete-generation.png`.
Keine Änderungen an `tools/`, `docs/toolingdocs/`, Lockdateien, Abhängigkeiten,
Tauri-CSP oder Capabilities.

Offen für die nachfolgenden Phasen: Sprite-Loader/Assembly (P41), Szenenbearbeitung
(P42), explizite Auflösung eines extern geänderten/fehlenden Originals bei weiter
vorhandenem Snapshot sowie native Desktop-/Plattform-Gesamtnachweise (P43).

Anforderungen: R-D05, R-D06, R-D09, R-C09, R-C10, R-C11, R-C13, R-C14, R-S06.
