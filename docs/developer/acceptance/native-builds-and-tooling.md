<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->
# P20 — Native Builds, Tooling und Codespaces

**Stand:** 6. September 2026

**Ergebnis:** P20 ist mit einem tatsächlich gebauten und gestarteten Linux-DEB sowie offen
benannten Windows-, macOS- und Devcontainer-Hostblockern abgeschlossen. Windows und macOS sind
damit vorbereitet, aber ausdrücklich nicht laufzeitabgenommen. Es erfolgten weder Push,
Veröffentlichung, Tagging, Signierung noch Notarisierung.

## Evidenzgrenze

P20 trennt drei Nachweisarten:

- Der Linux-Pfad baut, prüft und startet ein wirkliches DEB aus dem aktuellen Quellstand. Ein
  realer nativer GTK-Ordnerdialog sowie ein gespeicherter Multi-Action-Export wurden zusätzlich
  ausgeführt.
- Die Windows- und macOS-Pfade besitzen native, runnergebundene Build-, Artefakt- und Start-Smokes
  im Studio-CI-Workflow. In der aktuellen Linux-Sitzung wurden nur deren Befehlspläne und
  Quellverträge geprüft. Ohne Windows-/macOS-Host und ohne autorisierten Push gab es keinen
  tatsächlichen Runnerlauf; beide Plattformen bleiben deshalb nicht abgenommen.
- Der Devcontainer ist als reproduzierbare Linux-Quell- und Headless-Umgebung definiert. Diese
  Sitzung stellt weder Docker noch Podman bereit, daher wurde das Image hier nicht gebaut.
  Codespaces-Portweiterleitung ist keine native Desktop-GUI-Evidenz.

Diese Abgrenzung entspricht dem P20-Gate: Jede Plattform hat entweder ein tatsächliches Ergebnis
oder einen konkreten Blocker. Ein Blocker wird nicht als Plattform-PASS umgedeutet.

## Reproduzierbar festgelegter Stack

Die zentralen Werte stehen in `tools/resources/config/support-matrix.toml`; direkte
Produktabhängigkeiten sind zusätzlich exakt in den jeweiligen Manifests festgelegt und
transitive Abhängigkeiten bleiben gelockt.

| Bestandteil | Festgelegte Version | Durchsetzung |
|---|---:|---|
| Node.js | 24.19.0 | `.node-version`, `package.json`, Supportmatrix, CI und Devcontainer |
| npm | 11.17.0 | `packageManager`, Engine, Supportmatrix, Setup-Action und Devcontainer |
| Rust | 1.97.1 | `rust-toolchain.toml`, Supportmatrix, CI und Devcontainer |
| Tauri CLI | 2.10.1 | exakte Frontend-Abhängigkeit und Supportmatrix |
| Tauri Core | 2.11.5 | exakte Cargo-Abhängigkeit und Supportmatrix |
| `tauri-build` | 2.6.3 | exakte Cargo-Buildabhängigkeit und Supportmatrix |
| Dialog-Plugin, Rust und npm | 2.7.3 | beide direkte Abhängigkeiten und Supportmatrix |

Der Dialog-Versionsversatz 2.7.3 zu 2.6.0 ist damit beseitigt. `bundle.active` ist aktiviert und
die für Linux, Windows und macOS benötigten PNG-, ICO- und ICNS-Symbole werden explizit gebündelt.
Das zentrale Quality-Tooling ignoriert seinen eigenen Laufzeitzustand `.tooling-state` sowie den
repositorylokalen Buildbaum `.build` und ruft Clippy mit `-D warnings` statt dem inkompatiblen
`-F warnings` auf. Aktualisierte Source-Tests prüfen die tatsächliche Tauri-Capability und die
aktuelle ESLint-Flat-Config. Studio-CI und Devcontainer installieren außerdem `libdbus-1-dev`
ausdrücklich, damit auch ein frischer All-Features-Build der opt-in Accessibility-Probe nicht von
alten Cargo-Artefakten abhängt.

## Linux-Artefakt und nativer Lauf

Der finale lokale P20-Build erzeugte:

| Feld | Wert |
|---|---|
| Paket | `.build/p20/target/release/bundle/deb/PixelCutoutSprite Studio_0.1.0_amd64.deb` |
| Größe | 5.432.744 Bytes |
| SHA-256 | `1e8d763e8bccfefd37f58d180804c4884004d84816c89a74366f67f79b1ce15d` |
| Signaturstatus | unsignierter Testkandidat |

Der Builder schrieb zusätzlich `linux-bundles.json` und `SHA256SUMS` unter dem ignorierten
`.dist/desktop/linux/`-Baum. `sha256sum --check` bestand. Eine Inhaltsprüfung des DEB fand das
18.896.408 Byte große Produktionsprogramm, den Desktop-Eintrag und 32-, 128- sowie
256-Pixel-Symbole. Sie fand weder Python-/Godot-Laufzeiten noch Vault-, Projekt- oder
`.pixelforge-studio`-Nutzerdaten. Die Paketabhängigkeiten beschränken sich auf die native
WebKitGTK- und GTK-Laufzeit.

`python tools/control.py tauri smoke --target linux --startup-seconds 5` extrahierte genau dieses
DEB in ein temporäres Verzeichnis, startete das enthaltene Programm mit einem neuen isolierten
HOME/XDG-Zustand und beobachtete es 5,045 Sekunden. Der Prozess wurde danach erwartungsgemäß vom
Smoke beendet. Unter einem virtuellen X11-Display öffnete dieselbe Paketbinärdatei ein echtes
1440 × 900 großes Studiofenster. Die Aktion „Choose vault“ öffnete den nativen GTK-Dialog
„Choose a PixelCutoutSprite vault“ mit 1096 × 822 Pixeln.

Der kleine Produktionsservice-Durchlauf
`authoritative_npc_export_renders_multiple_actions_and_current_pointer_controls_freshness`
bestand. Er speichert einen NPC mit mehreren Aktionen, exportiert dessen Frames und prüft den
autoritativen Aktualitätspointer. Die Endnutzerbinärdatei benötigt dafür weder Python-Sidecar noch
Godot-Editor.

## Plattformmatrix

| Plattform | Build-/Paketpfad | Start, Dialog, Speichern/Export | Abnahmestatus |
|---|---|---|---|
| Linux x86_64 | echtes DEB gebaut; Manifest und SHA-256 geprüft | Paketpayload gestartet; nativer GTK-Dialog geöffnet; Produktionsservice-Test bestanden | **PASS** im dokumentierten Container-/X11-Umfang |
| Windows x86_64 | nativer NSIS-Build samt Manifest-/SHA-Prüfung in `windows-2025`-CI definiert; exakter lokaler Befehlsplan bestanden | CI startet das erzeugte `.exe`; Dialogadapter und Produktionsservice sind vorgeschaltet | **BLOCKIERT / nicht abgenommen:** kein Windows-Host und kein autorisierter Workflowlauf |
| macOS | nativer DMG-Build samt Manifest-/SHA-Prüfung in `macos-15`-CI definiert; exakter lokaler Befehlsplan bestanden | CI startet das erzeugte `.app`; Dialogadapter und Produktionsservice sind vorgeschaltet | **BLOCKIERT / nicht abgenommen:** kein macOS-Host und kein autorisierter Workflowlauf |

Die beiden Blocker sind keine Implementierungslücke des Buildpfads, aber reale Laufzeitabnahmen
bleiben ausstehend, bis der eingecheckte Workflow auf den jeweiligen GitHub-Runners ausgeführt
und sein Ergebnis bewertet wurde. Auch ein erfolgreicher CI-Lauf ersetzt keine spätere manuelle
Endnutzerabnahme auf repräsentativer Windows-/macOS-Hardware.

## Studio-CI und Artefaktsicherheit

`.github/workflows/ci-studio.yml` besitzt nur `contents: read`. Ein Quality-Job prüft die
festgelegten Toolchainversionen, Rust, Frontend, Architektur, Integration, Dokumentation und
Source-Policies. Eine native Matrix verwendet explizit `ubuntu-24.04`, `windows-2025` und
`macos-15`; sie baut DEB, NSIS beziehungsweise DMG, prüft Manifest und SHA-256 und startet den
Paketpayload auf demselben Betriebssystem. Die Kandidaten werden höchstens sieben Tage als
`unsigned-test-candidate` hochgeladen. Der Workflow erzeugt weder Release noch Tag und besitzt
keine Schreibberechtigung.

Die Artefaktwerkzeuge akzeptieren nur reguläre, frisch erzeugte Dateien innerhalb des
Repository-Buildbaums, lehnen Symlinks und fremde Pfade ab und schreiben Manifest und
`SHA256SUMS` atomar. Der Start-Smoke entfernt GitHub- und Tauri-Signierungsvariablen und verwendet
isolierte temporäre Nutzerverzeichnisse. Es werden keine Vault und keine Zugangsdaten gesammelt.

## Devcontainer und Codespaces

`.devcontainer/` definiert Debian Bookworm über einen unveränderlichen Basisimage-Digest,
prüft die offiziellen Node-/Rust-Archive mit SHA-256 und installiert die native Linux-
Buildumgebung. Der `postCreateCommand` legt Python-Abhängigkeiten unter `.tooling-state` an und
installiert den Frontend-Lock. Geeignet sind Quellarbeit, Python-/Rust-/Frontendtests,
Architektur-/Integrationsgates und ein Linux-DEB-Smoke unter Xvfb.

**BLOCKIERT / nicht in dieser Sitzung ausgeführt:** Weder Docker noch Podman ist verfügbar; ein
tatsächlicher Image-Build kann deshalb hier nicht behauptet werden. Codespaces hat außerdem
keine native Windows-, Linux- oder macOS-Desktopsitzung. Ein weitergeleiteter Vite-Port zeigt nur
ein Entwicklungsdetail der eingebetteten WebView und gilt weder als Webausgabe noch als native
GUI-Abnahme. Die konkreten Befehle und Grenzen stehen in `.devcontainer/README.md`.

## Signierung und Veröffentlichung

Die Pakete sind absichtlich unsignierte Testkandidaten. Windows-Codesignatur, macOS-Signierung
und -Notarisierung sowie Linux-Paketsignatur benötigen eigene Schlüsselverwaltung, Zielkonten und
eine ausdrückliche Releasefreigabe. P20 speichert keine Zertifikate, privaten Schlüssel,
Zugriffstoken oder erzeugten Anmeldedateien. Es erfolgten kein Push, kein Tag und kein Release.

Die Umsetzung folgt den offiziellen Hinweisen zu
[Tauri-Distribution](https://v2.tauri.app/distribute/),
[GitHub-Actions-Pipelines](https://v2.tauri.app/distribute/pipelines/github/) und
[Devcontainer-Unterstützung](https://containers.dev/supporting.html). Signierung bleibt dabei
bewusst ein eigener Freigabeschritt.

## Prüfungen

Vor den vollständigen Repository-Gates bestanden 141 fokussierte Python-Vertrags- und
Regressionstests; zwei profilabhängige Fälle wurden mit dokumentiertem Grund übersprungen. Darin
enthalten sind Plattformdispatch, frische/sichere Artefakte, Manifest/Hash, nativer Start-Smoke,
Supportmatrix, CI-/Devcontainer-Policies, Capability, ESLint und die korrigierten Quality-Adapter.

Die vollständige Python-/Source-Suite bestand mit 1.272 Tests und vier erwarteten
profilabhängigen Skips. Rustfmt, `cargo check --locked --all-targets --all-features`, Clippy mit
`-D warnings` sowie `cargo test --locked` bestanden; die Rust-Suite umfasst 241 bestandene und
vier bewusst ignorierte Sonderläufe. Im Frontend bestanden 177 Tests in 40 Dateien, Typecheck,
ESLint, Prettier und der Produktionsbuild mit 118 Modulen. Zentrales `quality lint`, die
Architekturprüfung über 142 TypeScript-Quelldateien, der Check von 146 Dokumentseiten,
`git diff --check` sowie die Integration aus dem sauberen Commitzustand waren ebenfalls grün. Der
zentrale Quality-Lauf wurde dabei mit einem frischen Cargo-Zielverzeichnis wiederholt; in dieser
rootlosen Sitzung lieferte ein flüchtiger Debian-Sysroot die gleiche explizit in CI und
Devcontainer installierte D-Bus-Entwicklungsabhängigkeit.

Der nächste ausführbare Schritt ist P21: Nutzeranleitung und die nachvollziehbare Beispiel-Vault
„Lichterhain“ über echte Produktionsservices erzeugen.
