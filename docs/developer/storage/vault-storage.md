# Vault und sichere Dateien

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: P43 · 10. September 2026.

Ein Vault ist ein explizit gewählter lokaler Ordner. `VaultService` prüft seine Identität;
fremde nicht leere Verzeichnisse erfordern eine aktuelle Bestätigung. Beschädigte
Vault-Metadaten werden weder als leer behandelt noch mit Defaults überschrieben.

| Bereich | Aktuelle Bedeutung |
| --- | --- |
| `.pixelforge-studio/vault.json` | Beibehaltene Vault-Identität auch für alte Vaults |
| `.pixelforge-studio/runtime/` | Writer-Metadaten und persistenter OS-Lock-Guard |
| `.PixelStudio/` | Neue gemeinsame Metadaten und sichere Workspace-Operationen |
| `.PixelPrompt/` | Basisprofil, Drafts, Profile und verifizierte Markdown-Generationen |
| `.PixelStudio/recovery/cutout/<id>/` | Quellsnapshot, Masken und Schnittprojekt vor der ersten Teileerzeugung; anschließend nur Weiterleitungsbeleg |
| `<Bildstamm>/` | Kanonisches Schnittprojekt, PNG-Teile, Manifest und optional bearbeitete Sprite-Szene |
| `<Bildstamm>/.scene/basis.json` | Hashgebundener Geometriebeleg für kontrollierten Teilegeneration-Abgleich |
| Alte `.project/`, `.area/`, NPC-/Motion-/Export-Bäume | Unveränderte Nutzerdateien; keine produktiven Fachservices |
| Geräte-Konfiguration außerhalb des Vaults | Nur globale UI-Einstellungen und zuletzt verwendete Pfade |

## Schutzmechanismen

`VaultRoot` und `ResolvedPath` weisen absolute Zielpfade, Traversal und erkannte Symlinks zurück.
Der neue Workspace-Writer schützt verwaltete Pfade, Revisionen und SHA-256-Baselines;
Publikation und Wiederherstellung werden anhand ihrer Dateibelege geprüft.
`JsonStore<T: StoredJson>` bietet weiterhin validierte temporäre Dateien, atomare Ersetzung
und Compare-and-swap, ohne einen Dispatcher für alte Fachmodelle.

## Aktuelles Dateilayout

```text
Vault/
├── .pixelforge-studio/                 Vault-ID und Writer-Guard
├── .PixelStudio/
│   ├── vault.json
│   ├── recovery/cutout/<id>/           vor Erzeugung: Projekt, .source, .masks
│   └── transactions/<uuid>/           nur während Publikation/Recovery
├── .PixelPrompt/
│   ├── basisprofil.json               genau eine V3-Basis
│   ├── .drafts/<id>.json
│   └── Typ/Untertyp/Name/              Profil und benannte Markdown-Varianten
├── Held.png                            unverändertes Original
└── Held/
    ├── cutout.project.json             V1; Revision und Maskenreferenzen
    ├── sprite.parts.json               V1; Generation, Ausschnitte, Pivots, Hashes
    ├── 01_head.png … 15_foot_l.png     nur bestätigte, tatsächlich vorhandene Teile
    ├── .source/original.png            normalisierter geprüfter Quellsnapshot
    ├── .masks/<partId>.json             unabhängige RLE-Maskenkanäle
    ├── sprite.scene.json               V1; nicht destruktive Szenentransformationen
    └── .scene/basis.json                Geometrie des letzten Szenen-Commits
```

Extras belegen optional die festen Nummern 16–18; Slot 17 ist Zubehör oder Schwert.
Set-relative Pfade sind keine absoluten Quellpfade. Ein vollständiges Set kann einschließlich
versteckter Unterordner kopiert werden. `source.originalPath` ist eine optionale Vault-relative
Verknüpfung; bei fehlender/geänderter Quelle ist ihre ausdrückliche Lösung im Cutout-Editor
möglich. Der Snapshot bleibt verbindlich. Die erste Ausgabe ohne Originalverknüpfung erhält
einen freien Projekt-ID-Ordner direkt im Vault statt eines nicht mehr verfügbaren Bildstamms.

PNGs werden über größen- und hashgeprüfte native Binärantworten gelesen, nicht als beliebige
globale Asset-Dateipfade. Pro Bild gelten 16 MiB und 16 Megapixel (maximal 8192 je Achse),
pro Sprite-Set insgesamt 64 MiB PNG und 32 Megapixel. Cutout-Projekte erlauben höchstens
eine Million RLE-Läufe insgesamt. Undo-Historien sind zusätzlich begrenzt.

Alle eigenen Leser warten auf einen abgeschlossenen Dateisatz. Ein Journal ist keine
Dateisystem-weite Mehrdatei-Atomizität für fremde Programme. Die Pfadprüfungen werden vor
Publikation wiederholt; sie ersetzen keine OS-Sandbox gegen einen absichtlich parallel
manipulierenden lokalen Prozess. Solche Prozesse und Netzwerk-/Cloud-Sync-Dateisysteme sind
nicht als sichere gleichzeitige Writer freigegeben. Siehe konkrete Prüfgrenzen im P43-Bericht.

Der OS-Guard `writer.lock.json.os-lock` sichert die tatsächliche Exklusivität.
`writer.lock.json` enthält Diagnose- und Heartbeat-Daten. Zweite Writer bleiben read-only.
Ein bestätigter verwaister Lock kann nur bei freiem OS-Guard mit genau passendem
Bestätigungstoken entfernt werden. Hintergrund-Leases halten den Guard bis zum letzten
Clone; Schreibzugriffe werden während konkurrierender Arbeit und Recovery abgewehrt.

## Öffnen alter Vaults ist keine Migration

P37 entfernt ObjectIndex, Projektmigration, automatisches Aufräumen alter Terminaljournale
und das Verschieben journalfreier Projekt-Stagingbäume beim Öffnen.
Alte JSON-Dateien dürfen beschädigt oder für das Vorgängermodell unbekannt versioniert sein:
Sie sind keine produktiven Dokumente mehr und bleiben unverändert.
Das lockert nicht die Prüfung neuer `.PixelStudio/`-/`.PixelPrompt/`-Daten.

Vorhandene alte Journale werden weiterhin gelesen, gegen ihre Scope-/Hash-/Owner-Regeln
geprüft und gegebenenfalls im exklusiven Recovery-Dialog angeboten. Nur ausdrücklich
bestätigte Recovery darf die dazugehörigen alten Dateien verändern. Passive
Dokument-Kind-Labels in `domain/workspace.rs` und alte Pfadklassifikationen in
`storage/layout.rs` bleiben dafür erhalten. Kein Fachmodell wird daraus erzeugt.

Der bestehende `indexed_objects`-IPC-Wert bleibt aus Kompatibilitätsgründen als
Metadatenzähler erhalten (eine geprüfte Vault-Identität, bei offener Recovery 0).
Er ist kein Projekt-/NPC-Index.

Die generischen atomaren Gerätekonfigurations-Schreiber liegen in `storage/atomic_file.rs`.
Der ehemalige AppData-Writer lebt nur noch als Testfixture in `atomic_file_tests.rs`,
damit sieben bestehende Datei-/Recovery-/Symlink-Regressionstests erhalten bleiben.
Produktiv ist für alte Prompt-Daten ausschließlich die Read-only-Migrationsquelle erreichbar.

[Recovery-Vertrag](recovery.md) ·
[P37-Tests und Hashnachweis](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md)
