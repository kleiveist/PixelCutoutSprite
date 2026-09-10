<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# P37 — Cutout-Altbasis entfernen und Willkommen

Stand: 2026-09-10. Ausgangsbasis: `f85e24d41197fe74dd64a9d8e2670c382b3f65b8` (P36).
Der Arbeitsbaum war vor Beginn sauber. Kein Commit, Push, Release oder GitHub-Workflow wurde ausgelöst.

Ergebnis: Die vier P37-Prüftore sind im unten beschriebenen automatisierten Umfang erfüllt:
produktiver Rückbau, neue Willkommen-Seite, Prompt-Regression und Datenerhalt.
Das ist **keine vollständige plattformübergreifende Desktop-/P43-Abnahme**. Native GUI und
globale Dokumentationsprüfung sind unten mit ihren tatsächlich beobachteten Grenzen getrennt
ausgewiesen. P38–P43 wurden nicht implementiert.

## Anforderungen und Nachweise

| Anforderung | P37-Ergebnis | Ausgeführter Nachweis |
| --- | --- | --- |
| R-G03 | Dieselbe Navigation-Row auch auf der Cutout-Willkommen-Seite; gemeinsame Datei-Toolbar | App-/Navigationstests sowie P36-/P37-Browsertests, genau eine Navigation je Modul |
| R-G05 | Gemeinsame App mit Prompt, Cutout und Sprite-Rahmen; Vault-/SaveQueue-Kontext bleibt gemeinsam | Studio-Wechsel-, Flush-/Dirty- und Prompt-Vault-Regression; keine Zusage der erst für P40/P41 vorgesehenen PNG-Erzeugung/Komposition |
| R-C01 / T20 | Alte Fachseiten, Clients, Modelle, Services und Handler tatsächlich entfernt | Statischer Source-/Importtest und 72 abgewiesene Aufrufe am tatsächlich zusammengesetzten Rust-Handler; Browsernavigation einschließlich alter URL-/History-Zustände |
| R-C02 / T20 | Neue Willkommen-Seite mit Vault-Auswahl, Originalbildauswahl, Pfad/Größe und kurzer Ablaufanleitung | App-Integration, gemeinsamer P36-Dateiadapter und P37-Browsertests; Markieren/Erzeugen sind ausdrücklich als spätere Schritte beschrieben |

Quellen: [P37-Auftrag](../../-PixelStudio_Implementierungsplan_2026-09-09/prompts/P37_Cutout_Altbasis_entfernen_Willkommen.md),
[Anforderungen](../../-PixelStudio_Implementierungsplan_2026-09-09/docs/02_ANFORDERUNGEN.md),
[Teststrategie](../../-PixelStudio_Implementierungsplan_2026-09-09/docs/09_ABNAHME_TESTS.md).

## Entfernen und Bewahren

Das [vollständige Inventar](P37-removed-paths.txt) enthält 235 entfernte ursprüngliche
Quellpfade (136 Frontend, 99 Rust/Native), einschließlich der unten genannten
Verschiebungen. Es bedeutet nicht, dass ebenso viele unabhängige Funktionen oder Nutzerdateien
gelöscht wurden. Alle ursprünglichen Dateien sind im genannten Git-Ausgangscommit wiederherstellbar.

| Bereich | Entfernt / Änderung | Bewahrt / neuer Eigentümer |
| --- | --- | --- |
| Shell | Alte Projekt-/Area-/Animations-/NPC-/Outfit-/Inventar-/Export-Routen; Dummy/Timeline/Direction-Editor; Breadcrumbs/WorkspaceNav und alte Acceptance-Probe | [App](../../../frontend/src/app/App.tsx), gemeinsame ModuleNavigationRow, ModalHost, globale Settings und Status |
| Frontend-Fachbasis | Alte API-Clients, gesamtes bisheriges `frontend/src/domain`, alte Feature-Verzeichnisse und zugehöriges CSS einschließlich `styles/projects.css` | Prompt-eigene Modelle/Kataloge, gemeinsamer Dateibaum und Bildprüfung, generische Tastatur-/Viewport-Primitives |
| Cutout | Der dünne alte CutoutDataWorkspace-Wrapper | [CutoutWelcome](../../../frontend/src/cutout-studio/CutoutWelcome.tsx) direkt in DataFolderWorkspace; gemeinsame Bildauswahl |
| Vault-/Recovery-UI | Alter Eigentümer `features/vault`, editorbezogene Recovery-Copy-Aktionen, Beispielgenerator | [VaultWelcome](../../../frontend/src/shared/vault/VaultWelcome.tsx), [RecoveryPanel](../../../frontend/src/shared/vault/RecoveryPanel.tsx), gemeinsame native Fehlerklassifikation |
| Gemeinsame Primitives | Bisherige generische Vault-Client-/Modal-Fokus-Pfade und rückwärts gerichtete Shared-Imports | Client einschließlich Test unter `shared/vault/`, Fokus-Hook einschließlich Test unter `shared/dialogs/`, StudioMode bei der gemeinsamen Navigation; Funktionen bewahrt |
| Rust-Fachbasis | Project/Area/Asset/Motion/Outfit/NPC/Export-Commands und -Services; `animation`, `asset_io`, `directions`, `editor`, `exports`, `render`; alter Index und Beispielgenerator | [VaultService](../../../src-tauri/src/application/vault_service.rs), Workspace-/Prompt-Vault-Services, sichere Pfade, Decoder, OS-Writer-Locks und Journal-Recovery |
| Prompt-Handoff | `PromptHandoff`, Review-Handoff, App-Handoff, `handoff_prompt_to_area`, alter Paketimport/Ausgabeexport sowie unbenutzter App-Data-Client | Vault-Autosave, gemeinsame Dateien, explizit bestätigte Legacy-Übernahme; Legacy-Quelle wird ausschließlich gelesen |
| Allgemeines Schreiben | Produktiver PromptWorkspaceStorage-App-Data-Writer | [atomic_file.rs](../../../src-tauri/src/storage/atomic_file.rs), darunter getestete generische Schreibprimitive; alte Storage-Fixtures nur unter `cfg(test)` |
| CI / Berechtigungen | Fachliche NPC-/Godot-Smokes und unbenutztes `dialog:allow-save` | Tatsächlicher P37-Handler-/Datenerhalt-Smoke plus Storage-/Recovery-Suites; Frontend-Build vor Rust-Asset-Einbettung; CSP unverändert |
| Unabhängiges Tooling | Nichts | Alle **388** getrackten Dateien in `tools/` und `docs/toolingdocs/` bytegleich zur Ausgangsbasis; auch Cargo-/npm-Lockdateien unverändert |

Der produktive Handler enthält noch 25 Commands einschließlich `desktop_identity`.
69 vorher registrierte Fachcommands wurden entfernt. Der
[native Negativtest](../../../src-tauri/src/p37_tests.rs) prüft zusätzlich drei schon zuvor
abgemeldete App-Data-Namen, insgesamt also 72. Seine positive Kontrolle ruft
`desktop_identity` erfolgreich auf; jeder verbotene Name muss ausdrücklich
`Command … not found` zurückgeben. Ein bloßer Argumentvalidierungsfehler genügt nicht.

Die [Source-Policy](../../../tests/source/test_studio_final_architecture.py) prüft fehlende
Altdirectories/-clients und verbotene produktive Imports sowie die tatsächlich registrierten
Command-Namen. Die Suche nach Project/Area/NPC/Motion ergibt noch gewollte historische
Dateipfad-/Journal-Discriminators, Fixtures und Prompt-Katalogbegriffe. Das sind keine
erreichbaren alten Fachservices. Insbesondere bleiben `DocumentKind`, Layout-/Scope-Prüfung
und projektlokale Transaktionsbelege als **passive Recovery-Verträge** bestehen. Ein
`StoredJson`-Projektmodell existiert nur im Integrationstest, nicht in der Anwendung.

## Nachweis: alter Vault bleibt erhalten

[opening_an_actual_legacy_vault_preserves_every_original_file_hash](../../../src-tauri/src/p37_tests.rs)
erstellt einen echten temporären Vault aus den ursprünglichen Vertragsfixtures, nicht aus
einem neuen Projektservice. Vorhanden sind 19 Dateien: alte Vault-Identität, Projekt/Labels,
Area/Profile, Motion, NPC/Appearance/Binding, Outfit, Export, Prompt-Referenz, Quelldatei,
Backup, beschädigte/fremde JSON, alte und zukünftige Projektversion sowie unabgeschlossener
Projekt-Staging-Ordner.

Für **jede** ursprüngliche Datei werden relativer Pfad und SHA-256 erfasst. Der Test öffnet
schreibbar, zusätzlich mit einem zweiten read-only Service, schließt und öffnet erneut.
An jeder kontrollierten Stelle bleiben die ursprünglichen Pfade und Bytes erhalten.
Neu erlaubt sind nur die P30/P32-Namensräume `.PixelStudio/`, `.PixelPrompt/` und die
konkrete persistente OS-Guard-Datei `.pixelforge-studio/runtime/writer.lock.json.os-lock`.
Die eigentliche Writer-Metadatei wird beim Schließen freigegeben.

Der Vault-Service baut keinen alten Fachindex auf, migriert alte Projekte nicht und
quarantänisiert keine verwaisten Projekt-Erstellungen beim Öffnen. `indexed_objects` bleibt
ein DTO-Kompatibilitätsfeld: 1 validierte Vault-Identität, bei ausstehender Recovery 0;
es ist kein wieder eingeführter Projektindex. Unterbrochene bestätigte Transaktionen bleiben
sichtbar und erfordern eine ausdrückliche Resume-/Rollback-Entscheidung.
Die neuen Workspace-/Prompt-Namensräume behalten ihre vorhandene Crash-Recovery.

Die zusätzlichen Recovery-Tests beweisen unveränderte kaputte, zukünftige und unbekannte
Altdokumente sowie den Erhalt verwaister Staging-Daten **am ursprünglichen Ort**.
Originalbilder in technischen Altordnern werden nicht gelöscht; ihre Auswahl unterliegt
weiter der P36-Quellenprüfung. Der Test benutzt ausschließlich selbst angelegte temporäre
Vaults, keine persönlichen Nutzerdaten.

## Prompt- und Session-Regression

Die komplette Frontend-Suite enthält weiterhin P32–P36: Vault-Autosave, Draft-Rohzustände,
Basisprofil, Migration, Wizard-Seiten, Ausgaben und Datei-Toolbar. Zwei wichtige
Integrationsdetails sind im neuen App-Einstieg gesichert:

- Dialog-Callbacks für Basisprofil/Legacy-Übernahme bleiben referenzstabil. Eine zunächst
  aufgetretene Autosave-Unterbrechung durch wechselnde Callback-Identitäten wurde behoben
  und durch den P35-Vault-Workflow erneut geprüft.
- Vault-Wechsel/-Schließen und Studio-Wechsel flushen dieselbe SaveQueue. Fehler/ungespeicherte
  Entwürfe halten den bisherigen Kontext offen. Fehlgeschlagene Aktivierung schließt eine
  neu angelegte Sitzung wieder. Verspätete native Recovery-Antworten dürfen keinen anderen
  Vault-Kontext überschreiben. Native Close-Flush- und Writer-Heartbeat-Primitives bleiben.

Nachweise: [App-Studio-Wechsel](../../../frontend/src/app/App.studio-switch.test.tsx),
[App-Recovery](../../../frontend/src/app/App.recovery.test.tsx),
[P35-Workflow](../../../frontend/src/prompt-studio/app/P35VaultWorkflow.test.tsx),
[SaveQueue](../../../frontend/src/shared/storage/SaveQueue.test.ts),
[NativeCloseFlush](../../../frontend/src/shared/storage/nativeCloseFlush.test.ts).

## Testzuordnung nach dem Rückbau

Die kleinere Testanzahl ist eine Folge der explizit entfernten Fachbasis, kein stilles
Überspringen fehlgeschlagener Tests. Das Pfadinventar enthält auch alle entfernten Testdateien.
Historische RQ-01–RQ-40 beschreiben den Vorgänger und sind nicht pauschal weiterhin erfüllt.

| Frühere Testgruppe / Anforderungen | Entscheidung und heutiger Nachweis |
| --- | --- |
| Projekt-/Area-Dashboard, Labels, alte Domain-Verknüpfungen (u. a. RQ-03–09, RQ-36) | Fachtests zusammen mit den Modellen entfernt; R-C01 prüft stattdessen Unerreichbarkeit und unveränderte alte Dateien. Generische Schema-/UUID-/Namen-/Pfadvalidierung in `p37_tests` und `vault_storage` weiterhin ausgeführt. |
| Dummy, Richtungen, Motion, Timeline, Rendering, Outfit/NPC/Bindings (RQ-10–20, RQ-23–32) | Keine produktiven Funktionen mehr, daher deren UI-/Service-/Pixeltests entfernt; keine Behauptung, der P38/P41-Editor sei bereits getestet. |
| Asset-Inventar/Import und Performance-Sonderläufe (RQ-21–23) | Alter Batchimport/-index entfernt. Gemeinsames P36-Listing, Cursor-/Suchgrenzen, Decoderbudget, Symlinkschutz, Thumbnail- und Bildprüfung bleiben in den Workspace-Tests. |
| Alter Export, Atlas, Godot, Export-Jobs/-Recovery (RQ-37/38) | Fachliche Exportprofile, `current.json`-Publikation, NPC-Manifest- und Godot-Tests mit dem Exporter entfernt. Allgemeines staged-write/CAS, Journal-Resume/-Rollback und konsistente neue Datei-Sets bleiben in Storage, Workspace und Prompt-Vault geprüft. P40 benötigt eigene Pixel-/PNG-Set-Abnahme. |
| VaultWelcome / RecoveryPanel (RQ-33) | Zwei Frontend-Testdateien verschoben und angepasst, nicht ersatzlos gelöscht. Beispiel-/editorbezogene Fälle entfallen, Lock-, Foreign-Vault-, Bestätigungs- und Recovery-Tests bleiben. |
| App-Handoff / Review-Handoff / unbenutzter Prompt-App-Data-Adapter | Explizit entfernte Aktionspfade; produktiver Prompt wird über P32–P35 Vault-/Autosave-/Wizard-Tests geprüft. Test-only LegacyPromptTestRoot erhält seine historischen Generatorverträge. |
| Allgemeine Storage-/Sicherheitsregression (RQ-33–35 und T04/T08/T09/T13) | **12 vault_storage + 18 recovery_integrity** bleiben. Nur Erwartungen für automatische Altmigration, alten Fachindex und Staging-Quarantäne werden in Datenerhalt-Erwartungen geändert. Sieben bisherige Atomic-Storage-Regressionen sind unter `atomic_file_tests.rs` bewahrt. Drei native Legacy-Lesetests sichern Größen-/Versions-/Symlinkgrenzen und unveränderte Quelle. |
| Distribution/Architektur und Tooling | SQL-/Python-/Sidecar-Verbot, native Targets und minimale Capabilities bleiben. Nur obsolete Godot-Quellverträge werden durch P37-Rückbauverträge ersetzt. Tooling-Tests wurden nicht geändert oder gelöscht. |

Die CI-Studio-Matrix ruft jetzt `cargo test --lib p37_tests` sowie
`vault_storage`/`recovery_integrity` auf. Das sind definierte zukünftige Runnerprüfungen,
**kein** Nachweis eines hier ausgeführten Windows-/macOS-CI-Laufs.

## Tatsächlich ausgeführte Prüfungen

Linux x86_64, Node **24.19.0**, npm **11.17.0**, Rust **1.97.1**, Python 3.11.2.
Node/Rust entsprechend den Repository-Pins; Archive wurden SHA-256-geprüft.
GTK/WebKit-Buildabhängigkeiten, Compiler, Browser und Python-Testwerkzeuge wurden unter
`/tmp/p37-validation.qSyRWN` eingerichtet; keine Änderung der Produktabhängigkeiten.
Die Ergebnisse beziehen sich auf den uncommitteten P37-Arbeitsbaum, nicht auf einen Release.

| Befehl / Umfang | Tatsächliches Ergebnis |
| --- | --- |
| `npm --prefix frontend test -- --run` | **695 / 695**, 133 Dateien; einschließlich vollständiger Prompt-Regression |
| `npm --prefix frontend run typecheck` | Bestanden |
| `npm --prefix frontend run lint` | Bestanden |
| `npm --prefix frontend run format:check` | Bestanden |
| `npm --prefix frontend run build` | Bestanden, 348 Module |
| `npm --prefix frontend run test:e2e` | **9 / 9**; reale Chromium-UI, kontrollierte native Adapter |
| `cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check` | Bestanden |
| `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Bestanden |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets --all-features` | **78** Tests bestanden, keine ignoriert: 47 Library + 1 Composition + 18 Recovery + 12 Storage; der zusätzlich gestartete Lock-Helper-Prozess wird nicht doppelt gezählt |
| `cargo build --locked --manifest-path src-tauri/Cargo.toml` | Tatsächliches Linux-Debug-Binary mit eingebettetem Frontend gebaut |
| `python tools/control.py tauri test --cargo` | Bestanden: zentraler Cargo-Check/-Test-Einstieg |
| Fokussierte Python-Source-/Tooling-Suite (Befehl unten) | **108 / 108** |
| `python tools/control.py quality architecture` | Bestanden, TypeScript-AST über 372 Quelldateien; keine Layerfehler/unterdrückten Findings |
| SHA-256-/Bytevergleich von `tools/` und `docs/toolingdocs/` mit Ausgangscommit | **388 / 388 unverändert** |
| Lokale Markdown-Linkziele in den 45 geänderten Dokumentationsseiten | **271 / 271 vorhanden**; unabhängig vom globalen Indexmarker-Checker geprüft |
| Native GUI unter Xvfb/DBus | **Nicht bestanden / Containerblocker**, siehe unten |
| `python tools/control.py docs check --docs-dir docs` und Standard-`docs check` | **Nicht bestanden**, bereits bestehender Indexmarker-Konflikt, siehe unten |

Die zugehörigen Testprogramme sind
[P37 Browser](../../../frontend/e2e/p37-cutout-welcome.spec.ts),
[P36 Browser](../../../frontend/e2e/p36-data-folder.spec.ts),
[P35 Browser](../../../frontend/e2e/p35-vault-workflow.spec.ts),
[Native P37](../../../src-tauri/src/p37_tests.rs),
[Storage](../../../src-tauri/tests/vault_storage.rs) und
[Recovery](../../../src-tauri/tests/recovery_integrity.rs).
Das [maschinenlesbare Prüfprotokoll](P37-checks.json) hält konkrete Log-Auszüge und Hashes fest.
Die vollständigen lokalen Laufprotokolle und Browser-Screenshots liegen nur in der aktuellen
Sitzung unter `/tmp/p37-validation.qSyRWN` und sind keine dauerhaft veröffentlichten Artefakte.

Fokussierter Python-Befehl:

```sh
python -m pytest -q -p no:cacheprovider \
  tests/source/test_studio_final_architecture.py \
  tests/source/test_studio_distribution_policy.py \
  tools/tests/test_tauri_control.py tools/tests/test_control_help.py \
  tools/tests/test_configuration.py tools/tests/test_control_test_reporting.py
```

Die Ausgangsbasis wurde ebenfalls ausgeführt: Rust **288 bestanden, 4 ignorierte
fachliche Sonderläufe**; Frontend zunächst **846 bestanden, ein 20-s-Wizard-Timeout**
(847 insgesamt). Der gezielte Originaltest bestand bei Wiederholung.
Der originale Frontend-Build bestand. Es wird also keine vollständig grüne
erste Frontend-Baseline erfunden.

## Layout und Grenzen der Zusatznachweise

[P37 Browser](../../../frontend/e2e/p37-cutout-welcome.spec.ts) prüft 1920×1080, 1440×900,
960×540, 720×450, 640×480 und 480×360. Die Vault-Schaltfläche und Ablaufanleitung bleiben
erreichbar; keine globale horizontale Überbreite. Für 200 % wird ein
480×360-CSS-Viewport bei DPR 2 (960×720 Gerätepixel) als **Layoutäquivalent** geprüft und
fotografiert. Ein zunächst verwendetes CSS-`zoom` wurde verworfen, weil es
Media-Query-Breakpoints nicht wie echter Browserzoom verändert.
Das ersetzt weder native OS-DPI-Abnahme noch ein echtes Zoom-/Resize-Szenario mit
P38-Pinsel oder P41-Ebenenliste.

Der echte Linux-Start wurde mit extrahierten GTK/WebKit-Bibliotheken, Xvfb, DBus und
AT-SPI versucht. X11 (1440×900) sowie Accessibility-Bus/-Registry starten; der tatsächliche
WebKit-Unterprozess beendet sich jedoch sofort:

```text
readPIDFromPeer: Unexpected short read from PID socket.
(This usually means the auxiliary process crashed immediately. Investigate that instead!)
```

Auch getrennte Versuche mit reiner Softwaredarstellung, deaktiviertem PRoot-Seccomp und
der nur im Testprozess gesetzten WebKit-Sandbox-Ausnahme halfen nicht. Namespace-Erzeugung
scheitert im Container mit `unshare: Operation not permitted`. Weder Sandbox-Ausnahme
noch sonstige Abschwächung wurden in Produktcode, Capabilities, CSP oder Startskripte
übernommen. Daher **keine Behauptung eines erfolgreichen nativen Welcome-, Dialog-,
Resize-, Close- oder Dateimanager-Smokes**. Dafür ist eine funktionierende native
Desktop-Testumgebung nötig. Der gebaute Produktcode, echte native Dateisystemtests und
Browser-UI-Tests bleiben getrennte, tatsächlich bestandene Nachweise.

Der globale Dokumentationschecker verlangt `AUTO-GENERATED:backlink/docs-index`,
während bereits vor P37 viele Produkt- und Tooling-Seiten `PYGINDEX:…` verwenden oder
keine Marker besitzen. Außerdem erwartet er benannte Verzeichnisübersichten statt der
vorhandenen `index.md`-Seiten. Derselbe Befehl scheitert auch in einer vollständigen Kopie des
unveränderten Ausgangscommits. Dieses unabhängige Tooling-/Dokumentationsformat wurde
nicht gegen den P37-Auftrag umgebaut. Aktuelle Einstiegseiten/Anleitungen und
Historienhinweise wurden dagegen aktualisiert; der historische Verweis auf die
entfernte CutoutDataWorkspace-Datei zeigt auf den damaligen Git-Commit.

Weiterhin separat offen: Windows/macOS-Laufzeit und Dateimanager, reale OS-Skalierung,
native Close-Requests, vollständige manuelle Barrierefreiheit und P43-Gesamtdurchlauf.
P38 (Masken), P39 (Assistenz), P40 (Teile), P41/P42 (Komposition/Szene) bleiben eigene
Aufträge. Kein Release-/Bundle-/Signierungsnachweis wird aus dem Debug-Build abgeleitet.

## Abweichungen und Abschluss

Die neuen Namen `CutoutWelcome` und `shared/vault/{VaultWelcome,RecoveryPanel}` passen
die Zielanker an die bereits bestehende gemeinsame P30/P36-Infrastruktur an.
Der zusätzliche Architekturcheck fand nach Installation seines WASI-Testwerkzeugs noch
Rückwärtsimporte der gemeinsamen UI in `api`, `app` und `components`. Der generische
Vault-Client, StudioMode und Modal-Fokus-Hook wurden mitsamt ihren Tests der Shared-Schicht
zugeordnet. Der anschließende Architekturcheck besteht ohne Ausnahme oder Regelabschwächung.
Statt generische Storage-/Recovery-Funktionen zu entfernen, wurden die letzten
Altdomain-Kopplungen durch ein schmales validierbares `StoredJson` ersetzt.
Ein von aktuellem Clippy gemeldeter doppelter Bedingungszweig im Workspace-Writer wurde
logisch gleichwertig zusammengeführt; keine Warnungsunterdrückung wurde eingeführt.

- [x] Cutout zeigt den neuen Welcome-/Editor-Rahmen, keine alte Fachroute.
- [x] Alte Fachcommands sind aus dem produktiven Handler entfernt.
- [x] PromptStudio inklusive Vault-Autosave besteht die aktuelle vollständige Regression.
- [x] Alte Fixture-Nutzerdateien und unabhängiges Tooling bleiben unverändert.

P37 endet hier. Die oben genannten Zusatznachweise bleiben ausdrücklich offen; sie
werden nicht als erfüllte Desktop-/P43-Abnahme mitgeführt.
