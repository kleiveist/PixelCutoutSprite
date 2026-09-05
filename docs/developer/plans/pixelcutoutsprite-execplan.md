<!-- AUTO-GENERATED:backlink START -->
[← Back](plans.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio — lebender ExecPlan

**Planungsstand:** 5. September 2026
**Planung:** erstellt und an tatsächlichen Checkout angepasst
**Implementierung:** P00–P01 abgeschlossen; P02 ist der nächste Schritt
**Repository:** `kleiveist/PixelCutoutSprite`

Dieses Dokument wird bei der Umsetzung fortgeschrieben. Ein hier aufgeführter Plan oder Prompt ist kein Nachweis einer implementierten Funktion.

## Purpose / Big Picture

Eine lokale Desktop-App für wiederverwendbare Pixelart-Cutout-Animationen entwickeln. Der Nutzer arbeitet von Projekt und Bereich über Dummy-Bewegung und Sprite-Ausstattung bis zum benannten NPC mit mehreren exportierbaren Animationen. Vorrangig sind humanoide RPG-NPCs mit acht Richtungen, ohne notwendige manuelle Bone-Einrichtung.

Verbindliche Spezifikation: [PixelCutoutSprite Studio](../features/pixelcutoutsprite-studio.md).
Ausführungsrahmen: [MASTERPROMPT](../prompts/pixelcutoutsprite/MASTERPROMPT.md).
Phasenindex: [P00–P22](../prompts/pixelcutoutsprite/README.md).

## Current State

P00 prüfte den tatsächlichen lokalen Checkout: Branch `main` entsprach vor Beginn `origin/main`
bei `e709b853f0bf2bcfb95da7e7113cf18e43c4fc57`. Es handelt sich um Template Tooling 0.4.0,
nicht um Forge2D. Das Repository enthält Tauri-fähiges Python-Tooling und das Profil
`desktop-local`, jedoch noch keinen Produktbaum. Die in der importierten Planung behaupteten
Dateien `AGENTS.md`, `.agent/PLANS.md`, `config/*.toml` und `game/project.godot` fehlen.

Der Nutzer bestätigte ausdrücklich das Tooling-Template als Ausgangspunkt. ADR-001 legt daher
Tauri 2 + Rust + Vite/React/TypeScript als Desktop-Architektur fest. Godot 4.7.2 bleibt nur
zusätzliches Exportziel in P17. Der vollständige Ausgangsbefund steht im
[Repository-Inventar](../repository-inventory.md).

P01 ergänzte den zuvor fehlenden Produktbaum als native Tauri-2-Anwendung. Die React-Shell hat
Header, Breadcrumbs, Desktop-Navigation, Hauptbereich, Statusleiste und einen zugänglichen
Dialog-Layer. Zentrale Shortcuts respektieren Texteingaben. Noch nicht implementierte
Arbeitsbereiche sind ausdrücklich als geplant gekennzeichnet. Rust stellt den gemeinsamen
Produktions-Composition-Root und zunächst nur einen eng begrenzten Identitäts-Command bereit.

## Scope and Non-Goals

Pflichtumfang ist in der Spezifikation RQ-01 bis RQ-40 festgelegt. Besonders wichtig sind Desktop-only, JSON/PNG statt SQL, lokale Vault, globale Daten ausschließlich unter .pixelforge-studio, 16 vordefinierte Grundslots einschließlich optionaler Haare, acht Richtungen, getrennte Vorlagen/Appearance/Bindings und ein portabler Spieleexport.

Nicht Teil der ersten Version sind andere Körperformen, Augen-/Gesichtssystem, vollständiger Pixel-Painter, KI-Perspektivgenerierung, notwendige Skelette/IK, Cloud-Zusammenarbeit und mobile beziehungsweise Web-Ausgaben des Studios.

## Concrete Steps

Die folgenden Phasen werden der Reihe nach anhand ihres vollständigen Prompts umgesetzt. Eine Phase beginnt erst bei erfüllten Abhängigkeiten. Tests werden fortlaufend ergänzt, nicht erst am Ende.

| Phase | Auftrag | Status |
|---|---|---|
| [P00](../prompts/pixelcutoutsprite/00.md) | Bestand prüfen und Umsetzung verankern | Abgeschlossen |
| [P01](../prompts/pixelcutoutsprite/01.md) | Desktop-Shell und Produktidentität | Abgeschlossen |
| [P02](../prompts/pixelcutoutsprite/02.md) | Fachmodelle und JSON-Verträge | Nicht begonnen |
| [P03](../prompts/pixelcutoutsprite/03.md) | Vault und sichere Dateispeicherung | Nicht begonnen |
| [P04](../prompts/pixelcutoutsprite/04.md) | Projekt-Dashboard, Labels und Dropdown-Filter | Nicht begonnen |
| [P05](../prompts/pixelcutoutsprite/05.md) | Bereiche und humanoide Körperprofile | Nicht begonnen |
| [P06](../prompts/pixelcutoutsprite/06.md) | Animationsbibliothek und zustandsabhängige Navigation | Nicht begonnen |
| [P07](../prompts/pixelcutoutsprite/07.md) | Gemeinsamer Pixel-Rasterer | Nicht begonnen |
| [P08](../prompts/pixelcutoutsprite/08.md) | Direkt bedienbarer Dummy-Editor | Nicht begonnen |
| [P09](../prompts/pixelcutoutsprite/09.md) | Timeline, Keyframes und deterministisches Sampling | Nicht begonnen |
| [P10](../prompts/pixelcutoutsprite/10.md) | Acht Richtungen, Spiegelregeln und Schichten | Nicht begonnen |
| [P11](../prompts/pixelcutoutsprite/11.md) | Bewegungspresets und tatsächliche Kartenvorschauen | Nicht begonnen |
| [P12](../prompts/pixelcutoutsprite/12.md) | PNG-Inventar und Paketimport | Nicht begonnen |
| [P13](../prompts/pixelcutoutsprite/13.md) | Ausstattungseditor, Feinschliff und NPC-Entwürfe | Nicht begonnen |
| [P14](../prompts/pixelcutoutsprite/14.md) | Ausrüstung und optionale Eigenbewegung | Nicht begonnen |
| [P15](../prompts/pixelcutoutsprite/15.md) | NPC-Dashboard, Mehrfachanimationen und Revisionen | Nicht begonnen |
| [P16](../prompts/pixelcutoutsprite/16.md) | Generischer PNG-/JSON-Export | Nicht begonnen |
| [P17](../prompts/pixelcutoutsprite/17.md) | Portables Godot-Paket und echter Importtest | Nicht begonnen |
| [P18](../prompts/pixelcutoutsprite/18.md) | Recovery, Autosave und Datenintegrität härten | Nicht begonnen |
| [P19](../prompts/pixelcutoutsprite/19.md) | Desktop-Usability und Leistung prüfen | Nicht begonnen |
| [P20](../prompts/pixelcutoutsprite/20.md) | Native Builds, Tooling und Codespaces | Nicht begonnen |
| [P21](../prompts/pixelcutoutsprite/21.md) | Anleitung und nachvollziehbare Beispiel-Vault | Nicht begonnen |
| [P22](../prompts/pixelcutoutsprite/22.md) | Gesamtabnahme und überprüfbarer Abschluss | Nicht begonnen |

## Progress

- [x] Nutzeranforderungen in eine vollständige Produktspezifikation überführt.
- [x] Relevanten Repository-Ausgangsstand und offizielle technische Quellen gelesen.
- [x] Dateistruktur, Datenverträge, Exporte, Risiken und Abnahmefälle geplant.
- [x] Masterauftrag, Fortsetzungsauftrag und 23 Phasenprompts erstellt.
- [x] P00: tatsächlichen Checkout, Tooling-Grenzen, Tauri-ADR, RQ-Ledger und Basistests erfasst.
- [x] P01: native React-/Tauri-Shell, Produktidentität, Navigation, Dialoge und Shortcuts erstellt.
- [ ] Meilenstein A: Grundlage, P00–P06.
- [ ] Meilenstein B: Bewegungen, P07–P11.
- [ ] Meilenstein C: Figuren, P12–P15.
- [ ] Meilenstein D: Spieleinbindung, P16–P17.
- [ ] Meilenstein E: belastbare Desktop-Version, P18–P22.

Bei jeder Phasenänderung ergänzen: Datum, tatsächlicher Umfang, betroffene Dateien, Prüfungen und nächster Schritt. Noch nicht geprüfte Plattformen werden nicht als fertig markiert.

## Surprises & Discoveries

**2026-09-05 (durch P00 ersetzt):** Die importierte Annahme eines vorhandenen
Godot-/Python-Produkts war falsch. Der reale Checkout ist das Tauri-fähige Tooling-Template;
ADR-001 und der ausdrückliche Nutzerhinweis legen Tauri als Produktlaufzeit fest.

**2026-09-05:** Der gewünschte Workflow braucht eine Trennung zwischen Bewegungsvorlage und konkretem NPC. Eine reine Ordnerliste von unabhängigen Sprite-Sheets würde die geforderte Wiederverwendung nicht erfüllen.

**2026-09-05:** „Nicht animiertes“ Equipment muss seinem Träger trotzdem folgen können. Sichtbarkeit, Mitführen und Eigenbewegung sind deshalb getrennte Eigenschaften.

**2026-09-05:** Eine native Desktop-App ist nicht automatisch per Codespaces-Portweiterleitung als GUI bedienbar. Codespaces dient in diesem Plan Codearbeit und geeigneten Headless-Tests.

**2026-09-05 / P00:** Die importierte Planung stammte aus einem anderen Repository-Kontext.
Der tatsächliche Checkout ist das reine Template Tooling. Der Nutzerhinweis und der lokale
Befund ersetzen die Godot-App-Annahme; die fachlichen Anforderungen bleiben erhalten.

**2026-09-05 / P00:** Die mitgelieferten portablen Tooling-Dokumente waren bytegleich nach
`docs/.toolingdocs` verschoben. Der manifestierte Pfad `docs/toolingdocs` wurde ohne
Inhaltsänderung wiederhergestellt, damit die vorhandenen Tooling-Gates nutzbar bleiben.

## Decision Log

| ID | Entscheidung | Begründung |
|---|---|---|
| ADR-001 | Tauri 2/Rust mit Vite/React/TypeScript auf dem vorhandenen `desktop-local`-Profil; Godot nur als Exportziel. | Entspricht dem tatsächlichen Tooling-Template und der ausdrücklichen Nutzerkorrektur. |
| ADR-002 | Vordefinierte starre Cutout-Teile mit Keyframes. | Keine manuelle Rig-Einrichtung, trotzdem wenige zu bearbeitende Posen. |
| ADR-003 | Vorlagen, NPC-Aussehen und Zuordnungen trennen. | Dieselbe Bewegung für mehrere Figuren wiederverwenden. |
| ADR-004 | JSON/PNG in gewöhnlichen Vault-Ordnern, kein SQL. | Explizite Nutzeranforderung und portable, nachvollziehbare Quellen. |
| ADR-005 | PNG-Sheets + JSON als Standard, Godot-Ressourcen zusätzlich. | Engine-unabhängige Basis und einfache Godot-Einbindung. |
| ADR-006 | Unveränderliche Freigaberevisionen und explizite Updates. | Bestehende NPCs und Exporte nicht unbemerkt verändern. |
| ADR-007 | Gemeinsamer Sampler und prüfbarer Referenz-Rasterer. | Vorschau und Ausgabe sollen dieselben Pixel ergeben. |
| ADR-008 | Workspace-Ordnername .pixelforge-studio bleibt fest. | Gewünschte globale Ablage, getrennt vom Produktbranding. |

Abweichungen während der Implementierung werden hier ergänzt, einschließlich betroffener Anforderungen, Migration, Testfolgen und erwogener Alternative.

## Validation

### Bereits in diesem Planungsauftrag geprüft

Die Planungsdateien wurden lokal auf Vollständigkeit der 23 Phasen, gültige JSON-Syntax der erklärenden Ausschnitte, geschlossene Codeblöcke, auflösbare interne Dateilinks und vollständige RQ-01–RQ-40-Abdeckung geprüft. Das genaue Dateiprüfprotokoll liegt dem Paket bei.

### Nicht in diesem Auftrag ausgeführt

Keine Repository-Installation, keine vorhandenen Projekt-Tests, keine Studio-App, kein PNG-Renderer, kein nativer Desktop-Build und kein Godot-Import des künftigen Exporters wurden ausgeführt. Die Webrecherche bestätigt API-/Versionsgrundlagen, nicht die spätere Implementierung.

### Prüflog für die Implementierung

| Datum / Phase | Befehl oder manuelle Prüfung | Umgebung | Ergebnis | Beleg / offene Punkte |
|---|---|---|---|---|
| 2026-09-05 / P00 | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tools/tests/core tools/tests/adapters tools/tests/integration` | Flatpak SDK, Python 3.13.15 | PASS: 443 passed, 2 skipped | Produktprofil war zu diesem Zeitpunkt noch nicht aktiviert. |
| 2026-09-05 / P00 | `.tooling-state/venv/bin/python -m pytest -q -p no:cacheprovider tests/source/test_repository_packaging_policy.py tests/source/test_workflow_contracts.py` | Flatpak SDK | PASS: 16 passed | Bestehende Source-Policy intakt. |
| 2026-09-05 / P00 | `python tools/control.py integrate --check --json` | Vor Produktkonfiguration | Erwartete Ausgangsfehlermeldung | `docs/toolingdocs` war durch das eingespielte Paket verschoben; P00 stellte den Pfad wieder her. |
| 2026-09-05 / P00 | `python tools/control.py docs check --docs-dir docs` | Vor Dokumentintegration | Erwartete Ausgangsfehlermeldung: 41 Befunde | Fehlende Backlinks/Indizes werden in P00 ergänzt. |
| 2026-09-05 / P00 | `PYTHONDONTWRITEBYTECODE=1 python tools/control.py docs check --docs-dir docs` | Nach Dokumentintegration | PASS: 130 Seiten konsistent | Planpaket und portable Tooling-Dokumente sind gemeinsam indexiert. |
| 2026-09-05 / P00 | vollständiges `tools/tests` | Flatpak SDK | Nach 7m35s abgebrochen: 6 passed, 11 failed | Acceptance-Fixtures konnten ihre Build-Aktion nicht starten, weil npm im SDK-PATH fehlt; Host-Toolchain wird ab P01 kontrolliert angebunden. |
| 2026-09-05 / P00 | Native Studio-, Windows- und macOS-Tests | Nicht verfügbar | Nicht ausgeführt | Vor P01 existiert keine App; Plattformmatrix folgt in P20. |
| 2026-09-05 / P01 | `npm test`, `typecheck`, `lint`, `format:check`, `build` | Host, Node 26.7.0 / npm 12.0.2 | PASS: 7 Tests, Typecheck/Lint/Format und Vite-Produktionsbuild | Headless-Shell, Navigation, Dialog, Fokus und Shortcut-Schutz belegt. |
| 2026-09-05 / P01 | Cargo test, check, Clippy und rustfmt mit Lockfile | Linux-Host, Rust 1.97.1 | PASS: 3 Tests und alle Compiler-/Lint-Gates | Produktions-Composition-Root wird auch vom Mock-Runtime-Smoke verwendet. |
| 2026-09-05 / P01 | `tools/control.py tauri test --cargo --build-dry-run` | Linux-Host | PASS | Struktur, echtes Cargo-Gate und Linux-Buildplan über den zentralen Einstieg belegt. |
| 2026-09-05 / P01 | relevante Source- und Tauri-Tooling-Tests | Linux-Host, Python 3.14.7 | PASS: 9 passed, 2 erwartete Profil-Skips; 161 passed | AST-/ESLint-/Capability-/Dokumentationspolicy sowie portable Tauri-Verträge aktiv. |
| 2026-09-05 / P01 | `tools/control.py quality architecture` und `quality lint` | Linux-Host | PASS | TypeScript-AST, Schichten, Python/TS/Rust-Lint und Compiler grün. Das historische Gesamt-`quality` bleibt wegen bereits vorhandener Größen-/Formatbefunde im portablen Tooling offen. |
| 2026-09-05 / P01 | nativer Tauri-Start und Sichtprüfung | KDE Wayland, 125 % Skalierung | PASS bei 1440×900 und 1280×720 | Pflichtaktionen, Statusleiste und Navigation sichtbar; Screenshots liegen nur im ignorierten lokalen Prüfbericht. Windows/macOS bleiben bis P20 offen. |

Die vorhandenen Repository-Gates, insbesondere python tools/control.py style und python tools/control.py check, werden in der Implementierung entsprechend ihrer tatsächlichen Verfügbarkeit verwendet. Änderungen an ihren Verträgen werden begründet dokumentiert.

## Recovery / Idempotence

Vor Arbeitsbeginn aktuellen Git-Status und Nutzeränderungen prüfen. Keine destruktiven Git-Befehle, unbeauftragten Pushes oder Releases. Tests verwenden temporäre Vaults. Produktionsdaten werden niemals als Wegwerf-Fixture benutzt.

Wiederaufnahme beginnt mit dem aktuellen Code und diesem Plan, nicht allein mit Chat-Kontext. Die erste unvollständige Phase und ihr Gate werden erneut geprüft. Mehrteilige Nutzerdatenänderungen erhalten in der App Journale und Sicherungen; ein fehlgeschlagener Export ersetzt keinen letzten gültigen Build.

**Nächster ausführbarer Schritt:** P02 ausführen: autoritative Rust-Fachmodelle, spiegelnde
TypeScript-DTOs und versionierte JSON-Vertragsfixtures mit positiven und negativen Roundtrip-
Tests anlegen.

## Outcomes & Retrospective

P00 hat die Planung in den tatsächlichen Checkout überführt. P01 liefert einen nachweislich
startfähigen, responsiven Desktop-Rahmen, ohne Vault- oder Editorfachlichkeit vorwegzunehmen.
Nach jeder Phase werden reale Ergebnisse, erkannte Grenzen und notwendige Planänderungen ergänzt.
Ein Abschlussstatus wird erst nach der belegten Gesamtabnahme P22 vergeben.
