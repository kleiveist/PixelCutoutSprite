# P35 · Dashboard, Profil-Popups, Ausgabe und Dateimanager

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

Datum: 2026-09-10. Ausgangsstand: `7b4cc01` (P34).

Status: **Implementierung und automatisierte Frontend-/Rust-/Chromium-Prüfungen bestanden.**
Die native Dateimanager-/Fensterabnahme auf Windows, macOS und Linux bleibt ausdrücklich offen.
Zum Abschluss von P35 war P36 noch nicht begonnen. Die danach beauftragte Fortsetzung ist im
[P36-Bericht](P36-gemeinsame_datafoldertoolbar.md) dokumentiert.

Anforderungen: R-G01, R-G02, R-G08, R-D08, R-P01, R-P02, R-P07, R-P08, R-P09, R-P10.

## Ergebnis und Prüftor

| Bereich | Umsetzung / Nachweis | Bewertung |
| --- | --- | --- |
| Dashboard | Neun Icon-Karten, Profilanzahl und Namensvorschauen aus dem aktiven Vault-Scan; leere Kategorien bleiben nutzbar. MD-Dateien werden nicht gezählt. | Automatisiert geprüft |
| Kategorie-Popup | Gemeinsamer Modal-Host, Untertypgruppen, Suche, Änderungsdatum und Status. Laden wartet auf Flush und prüft das vollständige Profil vor dem Sitzungswechsel. | Automatisiert geprüft |
| Wizard-Roundtrip | Antworten, unvollständige Rohwerte und gespeicherte Katalogposition werden hydratisiert, nicht nur Prompttexte. Ein Scan-/Ladefehler erhält die bisherige Sitzung. | Automatisiert geprüft |
| Ausgabe | Persistierte Generation mit 2 Stilen × 2 Sprachen × 4 Teilen; Text und relativer Dateipfad stammen aus demselben hashgeprüften Dateisatz. Kein Export notwendig. | Frontend und echtes temporäres Dateisystem geprüft |
| Entfernte Aktionen | Produktive Seiten haben keine Export-/Download-/Copy-/JSON-Export-/Area-Handoff-Buttons und keine Prompt-Settings-Route oder Legacy-Seiten-Fallbacks. Normale Textauswahl bleibt möglich. | UI-/Routen-Negativtests bestanden |
| Dateimanager | Native Sitzung inklusive Generation, geprüfter relativer Pfad, vorhandenes reguläres Ziel, offizielle Opener-Funktion. | Zielvalidierung und IPC-Vertrag geprüft; sichtbare native Öffnung offen |
| Neue Explorer-Fensterinstanz | Fensterzahl und ausgewähltes Ziel müssen auf Windows vor/nach der Aktion beobachtet werden. | **Nicht ausgeführt, nicht als bestanden gewertet** |

## Umsetzung

- [`VaultDashboardView.tsx`](../../../frontend/src/prompt-studio/features/dashboard/VaultDashboardView.tsx)
  ersetzt den produktiven V2-Dashboard-Pfad. Die `.module.css` verwendet vorhandene UI-Tokens und
  ergänzt im Portal die nötigen Abstände. Es gibt keine zusätzliche zentrale Profilbibliothek.
- [`AppShell.tsx`](../../../frontend/src/prompt-studio/app/AppShell.tsx) verwendet ausschließlich
  Vault-Dashboard, Vault-Profilseite, Wizard und Vault-Ausgabe. Eine neue Sitzung wird erst nach
  erfolgreichem Flush angefordert; ein Profil erst nach erneutem Scan und Hydrationsprüfung.
- [`VaultPromptProvider.tsx`](../../../frontend/src/prompt-studio/store/vault/VaultPromptProvider.tsx)
  stellt `flush`, `prepareProfile`, `readGeneration` und `revealPath` bereit. Die standardmäßige
  Uhrfunktion hat jetzt eine stabile Referenz, damit Renderzyklen keine Autosave-/Scan-Neuanlage
  auslösen. Verspätete Generierungsergebnisse dürfen keinen inzwischen gewechselten Repository-
  Kontext veröffentlichen. Ein manueller Scan verwirft weder Index noch Wizard-Sitzung bei Fehlern.
- [`VaultReviewOutputWorkspace.tsx`](../../../frontend/src/prompt-studio/features/review-output/VaultReviewOutputWorkspace.tsx)
  zeigt die gespeicherten Markdown-Inhalte. Alle Stil-/Sprach-/Teil-Auswahlen bestimmen auch das
  tatsächliche MD-Reveal-Ziel. JSON und Profilordner sind gesonderte Ziele. Bei Aktualisierung
  werden Markdown-Prüfsummen auch dann erneut geprüft, wenn die Profil-JSON unverändert blieb.
- [`vaultOutputStatus.ts`](../../../frontend/src/prompt-studio/services/vaultOutputStatus.ts)
  berücksichtigt Profilstatus, Basis-ID/-Revision, Draft-Revision und Generatorversion. Laufende
  Saves, Generierung, Scan- oder Lesefehler werden nicht als frische Ausgabe dargestellt.
- [`vaultPromptRepository.ts`](../../../frontend/src/prompt-studio/services/vaultPromptRepository.ts)
  serialisiert Scan, Lesen und Reveal mit der sitzungsgebundenen Save-Queue. Native Ergebnisse
  werden nach Rückkehr erneut auf die aktive Sitzung geprüft. Beschädigte einzelne V3-Dokumente
  erscheinen als Scan-Issues; sie verhindern nicht das Anzeigen gültiger Nachbarprofile.
- [`prompt_vault/mod.rs`](../../../src-tauri/src/prompt_vault/mod.rs) liest mit
  `read_generation` eine konkrete Profilrevision samt Manifest. Profil-ID und erwarteter Hash,
  Dateipfade, Typ-/Stil-/Sprach-/Teil-Zuordnung, Dateityp, UTF-8 und MD-Hashes werden geprüft. Ein
  erneuter Profilbeleg nach dem Lesen verhindert das Mischen zweier Profilgenerationen. Das Lesen
  ist auf 16 MiB je MD und 64 MiB je Generation begrenzt. Fehlende/abweichende MDs und doppelte IDs
  werden abgewiesen. Ein Neustart braucht keinen zuvor gehaltenen Dashboard-Index.
- [`commands/workspace.rs`](../../../src-tauri/src/commands/workspace.rs) implementiert
  `reveal_workspace_path(session_id, session_generation, relative_path)`. Der Vault-Service-Lock
  bleibt während Sitzungsprüfung und nativer Übergabe gehalten. Absolute Pfade, Traversal,
  nichtportable Namen, Symlinks und fehlende/nichtreguläre Ziele werden abgelehnt. Auch der
  ausgewählte Root wird erneut aufgelöst. Es wird kein Shell-String zusammengesetzt.
- [`useModalFocus.ts`](https://github.com/kleiveist/PixelCutoutSprite/blob/f85e24d41197fe74dd64a9d8e2670c382b3f65b8/frontend/src/components/useModalFocus.ts) stellt den Fokus bei
  gemeinsamem Modal-Hintergrund erst nach dessen `inert`-Aufhebung wieder her. Die echte
  Chromium-Prüfung hatte den vorherigen Fokusverlust nach Escape/Schließen sichtbar gemacht.
- Die [Nutzeranleitung](../../guides/prompt-generator.md) beschreibt den neuen Ablauf und ersetzt
  die inzwischen ungültigen Hinweise auf Export, Prompt-Settings und Area-Übergabe.

Die neuen `Vault…`-Dateinamen folgen dem bestehenden P33-Muster. Alte V2-Komponenten bleiben für
Kompatibilitäts-/Konvertertests erhalten, sind aber keine produktiven Router-Fallbacks.
[`LegacyPromptTestRoot.tsx`](../../../frontend/src/prompt-studio/test/LegacyPromptTestRoot.tsx)
isoliert diese bestehenden Tests ausdrücklich. Es wurden keine Tests gelöscht oder zur
Kaschierung der Routing-Änderung deaktiviert. Produktives Routing wird separat geprüft.

## Gemeldeten Cargo-Fehler behoben

`compose<R: Runtime>` registriert dieselben Commands für den Desktop- und den Test-Runtime.
`read_legacy_prompt_workspace` hatte jedoch `AppHandle` ohne Typparameter, also den voreingestellten
Desktop-Runtime. Deshalb konnte der generische Handler `CommandArg<'_, R>` nicht erfüllen
(`E0277`). Der Command verwendet jetzt konsistent `read_legacy_prompt_workspace<R: Runtime>` und
`AppHandle<R>`. Die Produktionskomposition mit Mock-Runtime wird weiterhin gebaut und getestet.

Zusätzlich wurde ein IPC-Vertragsfehler in `save_prompt_vault_profile` korrigiert: Das Frontend
sendet `value`; der Rust-Parameter hieß bisher `profile`. Der Parameter heißt jetzt ebenfalls
`value`, und ein Repository-Test sichert den gesendeten Schlüssel ab.

## Abhängigkeit und Berechtigungen

Neu ist ausschließlich die direkte Rust-Abhängigkeit `tauri-plugin-opener = "=2.5.5"` samt
aufgelöster transitiver Abhängigkeiten in `Cargo.lock`. Lizenz: MIT oder Apache-2.0.
Verwendet wird die native
[`reveal_item_in_dir`-Funktion](https://docs.rs/tauri-plugin-opener/2.5.5/tauri_plugin_opener/fn.reveal_item_in_dir.html)
des [offiziellen Tauri-Plugins](https://v2.tauri.app/plugin/opener/). Es wurde kein JavaScript-
Opener-Paket installiert, keine allgemeine Open-Path-/Shell-Permission erteilt und keine
CSP-/Capability-Prüfung abgeschaltet. Plugin-Dokumentation und Mocks beweisen keine neue
Explorer-Fensterinstanz.

## Automatisierte Testnachweise

- [`P35VaultWorkflow.test.tsx`](../../../frontend/src/prompt-studio/app/P35VaultWorkflow.test.tsx):
  sieben produktive UI-Integrationsfälle, darunter neun Kategorien, Untertypsuche, vollständiges
  Laden, kaputtes Profil, Flush vor Scan, Erhalt bearbeiteter Antworten bei Scanfehler, alle 16
  gespeicherten Ausgaben, korrekte MD-/JSON-Ziele und veraltete/fehlerhafte Ausgabezustände.
- [`vaultPromptRepository.test.ts`](../../../frontend/src/prompt-studio/services/vaultPromptRepository.test.ts):
  vier native IPC-Adapterfälle für isolierte Dokumentfehler, Save-Argument, verspätete
  Sitzungsantwort und relative Reveal-Ziele. Die native Grenze ist hier bewusst gemockt.
- [`navigationAdapter.test.ts`](../../../frontend/src/prompt-studio/services/navigationAdapter.test.ts)
  verweigert die entfernte Settings-Route auch bei einem ungültigen Laufzeitwert.
- [`tests_p35.rs`](../../../src-tauri/src/prompt_vault/tests_p35.rs): fünf Tests mit echten
  temporären Vault-Dateien für alle 16 MDs nach Wiederöffnung, veränderte/fehlende MDs, CAS,
  Basisrevision/Stale, beschädigte Profile, doppelte IDs, Symlinks und fremde Manifestziele.
  Zwei weitere Rust-Tests in `commands/workspace.rs` prüfen erlaubte Reveal-Ziele und
  Traversal/absolute Pfade/Gerätenamen/Symlinks.
- [`p35-vault-workflow.spec.ts`](../../../frontend/e2e/p35-vault-workflow.spec.ts): echter Chromium-
  Browser mit kontrolliertem IPC-Fixture. Kategorie-Popup, Antworten, Escape/X/Backdrop,
  Fokusrückgabe und Layout bei 960×540 sowie 480×360. Die vier vorhandenen Browserfälle prüfen
  weiterhin gemeinsame Shell, Einstellungen und kleine Fenster. **Kein nativer Explorer-Test.**

## Ausgeführte Abschlussbefehle

| Befehl | Ergebnis am 2026-09-10 |
| --- | --- |
| `python tools/control.py test --suite frontend` | Exit 0, Gesamtstatus OK, 74,87 s; nach den zwei letzten zusätzlichen Regressionstests folgte der vollständige direkte Lauf unten. |
| `npm test --prefix frontend` | Exit 0, **164 Testdateien / 834 Tests bestanden**, normale Datei-Isolation, 99,91 s. |
| `python tools/control.py tauri test --cargo` | Exit 0, Strukturprüfung, Cargo check und Rust-Tests bestanden. |
| `cargo test --locked --all-targets --all-features --manifest-path src-tauri/Cargo.toml` | Erneut Exit 0: **278 Tests bestanden**, vier bereits vorhandene explizit ignorierte native/hardwarespezifische Fälle. Ein Crash-Test startet zusätzlich einen erfolgreichen separaten Testprozess. |
| `npm --prefix frontend run typecheck` | Exit 0. |
| `npm --prefix frontend run lint` | Exit 0. |
| `npm --prefix frontend run format:check` | Exit 0. |
| `npm --prefix frontend run test:e2e` | Vorgeschalteter TypeScript-/Vite-Produktionsbuild bestanden; **5/5 Chromium-Tests bestanden**, 4,5 s. |
| `rustfmt --edition 2021 --check --config skip_children=true …` für die sieben berührten Rust-Dateien | Exit 0. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Nicht grün: vorhandene Formatabweichungen in `src/commands/settings.rs` und `src/workspace/mod.rs` bleiben außerhalb von P35 unverändert. Kein Compile-/Testfehler. |

Ausführungsumgebung: Linux/Docker, Node.js 22.23.2, npm 10.9.8, Python 3.11.2,
Rust/Cargo 1.97.1. Node/npm liegen unter den in `package.json` empfohlenen Pins; die genannten
Prüfungen wurden dennoch in genau dieser Umgebung erfolgreich ausgeführt. Rust-Toolchain und
fehlende native Linux-/Chromium-Bibliotheken wurden ausschließlich in einem temporären
Testverzeichnis bereitgestellt. Der fehlende `python`-Alias wurde nur dort auf `python3` abgebildet.
Es wurden keine GitHub-Anmeldedaten erzeugt oder verschoben.

Die vier ignorierten Rust-Fälle sind bestehende P19-Hardwaremessungen/ein expliziter nativer
Walkthrough-Fixture-Generator sowie die Godot-4.7.2-Editorintegration. Sie sind nicht als bestanden
gezählt. Die temporären Konsolenlogs sind keine dauerhaft versionierten Testartefakte; die oben
verlinkten Tests und Befehle sind die reproduzierbaren Nachweise.

## Offene native Abnahme und lokaler Test

In dieser Sitzung stand kein nutzbarer grafischer Desktop zur Verfügung. Ein temporärer
Xvfb-Start scheiterte bereits am XKB-Keymap-Compiler. Daher wurden weder ein interaktiver
Tauri-Fensterdurchlauf noch eine tatsächliche Dateimanager-Öffnung oder Linux-Paketinstallation
als bestanden bewertet. Windows-/macOS-Laufzeit und Windows-Junction-/Explorer-Fensterverhalten
wurden hier nicht ausgeführt. Die bestandenen Rust-Dateisystemtests ersetzen diese UI-Gates nicht.

Auf dem lokalen Desktop aus dem Repository-Root:

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri test --cargo
python tools/control.py tauri run --foreground
```

Voraussetzung für `--skip-system-deps`: die nativen Tauri-Systembibliotheken sind bereits
installiert. Für den manuellen P35-Durchlauf einen Test-Vault verwenden: Basis anlegen, Asset bis
Review vervollständigen, Autosave abwarten, alle Stil-/Sprachvarianten öffnen, MD/JSON/Ordner im
Dateimanager prüfen, App neu starten und das Profil erneut über das Kategorie-Popup laden.
Auf Windows Fensterzahl und Dateiauswahl vor/nach jeder Reveal-Aktion protokollieren. Unter Linux
und macOS das jeweilige System-Dateimanager-Ziel prüfen; 200-%-Zoom und native Tastaturbedienung
separat abhaken. Diese manuellen Ergebnisse dürfen erst danach ergänzt werden.

P35 endet mit diesem Bericht. Die gemeinsame DataFolderToolbar (P36) ist ein eigener Auftrag.

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->
