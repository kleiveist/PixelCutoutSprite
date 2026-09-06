<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->
# P21 — Beispiel-Vault und Nutzeranleitung

**Stand:** 6. September 2026

**Ergebnis:** P21 ist im belegten lokalen Umfang abgeschlossen. Die native App kann über
**„Create Lichterhain example“** in einem ausgewählten leeren Ordner eine vollständige Vault mit
echten Produktionsservices erzeugen und anschließend öffnen. Ein reproduzierbarer CLI-Einstieg,
die deutsche Schritt-für-Schritt-Anleitung und ein durchgehender Reopen-/Kopie-/Reexport-Test
ergänzen denselben Weg. Es erfolgten weder Push, Veröffentlichung, Signierung noch ein
GitHub-CI-Lauf.

## Lieferumfang

`ExampleVaultService` komponiert ausschließlich die vorhandenen Vault-, Projekt-, Label-,
Bereichs-, Asset-, Motion-, Appearance-, Binding-, Exportprofil- und Exportservices. Der
asynchrone Tauri-Command läuft außerhalb des UI-Threads. Die Startseite bietet ihn direkt über
den nativen Ordnerdialog an; sie öffnet die fertige Vault nach Erfolg. Nichtleere Ziele,
Dateiziele und symbolische Links werden vor jeder Initialisierung abgewiesen und nie ersetzt.

Für Quellcheckouts steht zusätzlich folgendes, funktional gleiches Werkzeug bereit:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --locked \
  --example generate_lichterhain -- --output "/absoluter/Pfad/Leere Vault"
```

Die [deutsche Nutzeranleitung](../../guides/erste-schritte-und-lichterhain.md) deckt den
Schnellstart sowie den manuellen Weg vom leeren Ordner bis zur Godot-Einbindung ab. Sie erklärt
Projekt/Bereich/Motion/NPC/Binding, Figuren- gegenüber Framegröße, Freigaben, Asset-
Spiegelgenehmigungen, Quellen/Exports, Writer-Lock und Recovery. Ebenso nennt sie die tatsächlich
geprüften Versionen, Plattformgrenzen und einen datensparsamen Fehlerbericht.

## Nachvollziehbarer Inhalt

| Bestandteil | Erzeugter Zustand |
|---|---|
| Projekt und Bereich | „Lichterhain“; „Dorf-NPCs“; 80-px-Humanoidprofil r1 mit 16 Slots und acht Richtungen |
| Gemeinsame Motions | Walk r1, Sprint r1 und Jump r1; beide NPCs pinnen dieselben drei Revisionen |
| Assets | 272 eindeutige, selbst erzeugte RGBA8-PNG-Revisionen; fünf normale Importbatches mit höchstens 64 Einträgen |
| Mira | eigene Palette/Assets, statische Handlaterne, Appearance-Fittingkorrektur und lokaler Walk-Override |
| Borin | andere Palette/Assets, statischer Unterarmschild, andere Appearance-Fittingkorrektur und lokaler Sprint-Override |
| Export je NPC | vollständiger generischer PNG/JSON-Build und portables Godot-4.7.2-Paket mit Szene, 24 Animationsnamen und 256 Frames |

Die Vault enthält `LICHTERHAIN-README.md` und `LICHTERHAIN-LICENSE.txt`. Jedes Asset nennt als
Herkunft die programmgesteuerte lokale Geometrieerzeugung ohne externe Quelle und verweist auf
die MIT-Lizenz. Es wurden keine fremden Bilder, Downloads oder Netzdienste verwendet.

## Produktionsservice- und Portabilitätsnachweis

Der P21-Integrationstest startet den öffentlich registrierten Tauri-Command in einem frischen
temporären Ordner. Danach prüft er:

- genau ein Projekt und einen 80-px-Bereich samt 16-Slot-Profil;
- 272 aktive Assetrevisionen und deren Herkunfts-/Lizenznotizen;
- drei freigegebene gemeinsame Motion-Referenzen in beiden NPCs;
- unterschiedliche Appearances, je ein aktiviertes Slot-Follow-Equipment ohne Eigenbewegung und
  je eine lokale Bindingkorrektur;
- reviewed Bindings und Characters, drei Aktionen und acht Richtungen;
- vollständige generische Manifeste und Godot-Pakete mit ausschließlich relativen Ressourcen;
- Schließen und erneutes Öffnen der erzeugten Vault;
- rekursive Kopie nach `Kopie mit Leerzeichen ü`, erneutes Öffnen und neuen vollständigen Export
  mit 256 Einzelbildern;
- unveränderten Sentinel und keinerlei Studio-Metadaten bei einem nichtleeren Zielordner.

Der Lauf benötigt kein Netzwerk, keine vorgefertigte Vault und keinen Godot-Prozess. UUIDs und
Zeitstempel werden wie bei normaler Produktbedienung neu erzeugt; der nachvollziehbare Vertrag
liegt in identischen Services, Revisionen, Hashes, Zählwerten und validierten Exporten, nicht in
fest verdrahteten Fixture-IDs.

## Lokale Prüfungen

| Prüfung | Ergebnis |
|---|---|
| fokussierter Tauri-Command-/Lichterhain-E2E und Schutz nichtleerer Ziele | **PASS:** 2/2 Tests; vollständiger Reopen-/Unicode-/Reexport-Lauf 69,24 s |
| `cargo test --locked --all-targets` | **PASS:** 243 Tests; 4 bereits begründete Hardware-/Godot-Sonderläufe ignoriert |
| `cargo fmt --check`, `cargo check --locked --all-targets --all-features`, Clippy `-D warnings` | **PASS** |
| vollständige Frontendsuite | **PASS:** 179 Tests in 40 Dateien |
| TypeScript-Typecheck, ESLint, Prettier | **PASS** |
| Vite-Produktionsbuild | **PASS:** 118 Module |
| `quality lint` und `quality architecture --format json` | **PASS:** Python-, TypeScript- und Rust-Gates ohne Befund; 142 TypeScript-Quelldateien geparst |
| `docs check --docs-dir docs`, `integrate --check --json` und `git diff --check` | **PASS:** 149 Dokumentseiten konsistent; Desktopprofil `INTEGRATED` ohne ausstehende Operation; Patchformat sauber |
| Linux-DEB-Build und SHA-256-Prüfung | **PASS:** 5.492.410 Bytes; `16a36b6199154625ebb9cab53c7eb9bc68035178591add7ef4b2083a1297e727` |

Das neu gebaute unsignierte DEB enthält das 19.126.016 Byte große Produktionsprogramm, den
Desktop-Eintrag und drei Icongrößen. Seine einzigen deklarierten Laufzeitabhängigkeiten sind
`libwebkit2gtk-4.1-0` und `libgtk-3-0`; Python, Node, Rust und Godot sind keine
Endnutzerabhängigkeiten. Die Binärprüfung findet den registrierten
`generate_example_vault`-Command im finalen Releaseprogramm.

## Bewusst nicht als neuer Nachweis ausgegeben

Der erste Paketstart in dieser Docker-Sitzung traf auf kein Display. Der anschließend versuchte
Xvfb-Start blieb vor dem Studio an der unvollständigen Container-XKB-Installation hängen: Der
Sysroot-X-Server erwartet `/usr/bin/xkbcomp`, dieser unveränderliche Pfad ist in der Sitzung nicht
vorhanden. Deshalb wird **kein neuer nativer P21-Fensterlauf** behauptet. Der P20-Nachweis eines
tatsächlich gestarteten Linux-DEB samt nativem GTK-Dialog bleibt gültig; P21 ergänzt dazu den
neu gebauten Paketinhalt, den Tauri-Command-E2E, den UI-/IPC-Test und den vollständigen
Produktionsservice-Datenlauf.

Auf ausdrücklichen Nutzerwunsch wurde GitHub-CI nicht gestartet und nicht als Gate verlangt. Die
CI-Konfiguration wurde für P21 nicht verändert. Windows und macOS bleiben wie in P20 vorbereitet,
aber nicht real laufzeitabgenommen. Der existierende echte Godot-4.7.2-Importnachweis aus P17
wurde nicht als neuer P21-Lauf wiederholt; P21 validiert die neu erzeugten Pakete strukturell und
inhaltlich. P22 verlangt die explizite erneute Engine- und Gesamtabnahme.

## Nächster Schritt

P22 führt die produktionsweite Gesamtabnahme aus: leerer Vault bis Reopen/Export,
Preview-/Exportframevergleich, Loop-Enden, deaktiviertes Equipment, zwei NPCs mit gemeinsamer
Motion sowie abschließende RQ-01–RQ-40- und E2E-A–J-Bewertung.
