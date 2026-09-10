<!-- PYGINDEX:NAVIGATION START -->
[Zur Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# P27 — PixelPromptStudio-Integrationsabnahme

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

**Stand:** 6. September 2026
**Ergebnis:** PASS im belegten Linux-Umfang; P23–P27 abgeschlossen

## Abgenommener Produktweg

PixelPromptStudio läuft als React-Bereich im einzigen Fenster der PixelCutoutSprite-Tauri-App.
Playwright baut vor dem Lauf die Vite-Produktionsausgabe und bedient sie bei 1440 × 900. Belegt
sind:

- zwei per Tastatur erreichbare Studiobuttons mit exakt 196 × 46 px, korrektem `aria-pressed`,
  sichtbarem Fokus und grünem Prompt-Aktivzustand;
- genau einen App-Header, Prompt-Vollbreite, internes Scrollen und unveränderte globale
  Cutout-Styles nach wiederholtem Studiowechsel;
- unabhängige, erhaltene Cutout- und Prompt-Navigation;
- validierten Import eines echten PixelForgeStudio-V2-Workspace, Profilduplikat,
  profilgestützten Character-Wizard, Prompt-Ausgabe, Markdown-/JSON-Export sowie
  Draft-/Profilwiederherstellung nach Reload;
- deaktivierten Handoff ohne Vault und im Read-only-Vault sowie einen erfolgreichen Handoff in
  eine ausgewählte schreibbare Area mit Rückkehr in deren unveränderten Animationskontext.

Die beiden Handoff-Systemfälle laufen über den produktiven Tauri-Adapterzweig der App. Der
Playwright-Harness ersetzt nur die IPC-Gegenstelle durch deterministische Antworten. Die echte
Rust-Gegenstelle wird separat mit temporären Vaults geprüft und schreibt die versionierte
JSON-Referenz ausschließlich unter `prompt-references/` der gewählten Area.

## Native Linux- und Offline-Evidenz

Der offizielle `tools/control.py tauri run --foreground`-Pfad wurde auf einem isolierten
X11-Display mit WebKitGTK sichtbar gestartet und nach der Beobachtung kontrolliert beendet. Ein
gesonderter Tauri-Dev-Lauf in derselben Umgebung öffnete beide Studios, speicherte einen Draft bis
`wizard/category`, beendete die App vollständig und startete sie mit demselben isolierten
App-Datenpfad neu. Das Dashboard bot den Draft danach wieder an und öffnete ihn erneut. Der weiter
unten beschriebene endgültige DEB-Lauf wiederholte diesen Restart als **Offline restart proof**.

Das endgültige, unsignierte Linux-DEB wurde mit dem zentralen Buildpfad erstellt:

| Eigenschaft | Wert |
| --- | --- |
| Artefakt | `PixelCutoutSprite Studio_0.1.0_amd64.deb` |
| Größe | 5.689.148 Byte |
| SHA-256 | `16e896d09abfcfefe42484dde6773e42f3dbf7de26081953f522e79c229a2997` |
| Smoke | Installer-Payload 3,052 s aktiv; isolierter Nutzerzustand |

Für den Offline-Lauf wurden `HTTP_PROXY`, `HTTPS_PROXY` und `ALL_PROXY` auf den nicht belegten
Loopback-Port `127.0.0.1:9` gesetzt; nur Loopback und das eingebettete `tauri.localhost`-Protokoll
waren von der Proxyumleitung ausgenommen. Direkt aus dem extrahierten DEB ließen sich Cutout und
Prompt sichtbar öffnen, ein Draft nativ speichern und nach einem vollständigen Prozessneustart
wiederherstellen. Der Prompt-Quellbereich enthält keinen externen Fetch-/WebSocket-Endpunkt. Eine
echte Kernel-Netznamespace-Sperre war im unprivilegierten Container nicht verfügbar; der Nachweis
behauptet deshalb keine stärkere Isolation als diesen paketierten Proxy-/Quellpfad.

## Produktionsbundle-Korrektur

Die native Prüfung fand einen Fehler, den Chromium nicht gezeigt hatte: Die frühere erzwungene
`maxSize`-Teilung erzeugte zwischen zwei Prompt-Chunks einen zyklischen Schema-/Domain-Import.
WebKitGTK wertete dabei einen noch nicht initialisierten Enum-Export aus; Zod brach beim Start mit
`Object.values` auf `undefined` ab. Der Prompt-Domain-/Feature-/Store-Bereich bleibt deshalb als
ein einzelner Chunk mit 575,08 kB unkomprimiert beziehungsweise 154,24 kB gzip zusammen. Der
erneute Custom-Protocol-Lauf und das neu gebaute DEB rendern danach fehlerfrei.

## Ausgeführte Gates

| Prüfung | Umgebung | Ergebnis |
| --- | --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | Node 24.19.0, npm 11.17.0 | PASS |
| `npm test` | Node 24.19.0 | PASS: 149 Dateien, 771 Tests |
| `npm run build` | Vite 8.2.2 | PASS: 401 Module |
| `npm run test:e2e` | Playwright, Chromium, 1440 × 900 | PASS: 5 Szenarien |
| `python3 tools/control.py test --suite frontend` | zentraler Repository-Einstieg | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Rust 1.97.1 | PASS |
| `python3 tools/control.py tauri test --cargo` | Rust 1.97.1, Linux-Sysroot | PASS |
| `python3 tools/control.py tauri run --foreground` | X11/WebKitGTK, 1440 × 900 | sichtbar gestartet; kontrolliert beendet |
| `python3 tools/control.py tauri build --target linux --bundles deb` | Linux x86_64 | PASS |
| `python3 tools/control.py tauri smoke --target linux` | extrahierter DEB-Payload | PASS |

Die Rust-Suite belegt zusätzlich feste Dateinamensräume und Größenlimits, Schemafehler,
atomare Veröffentlichung, Pending-/Previous-Recovery, Symlinkablehnung, beschädigte Importe,
Markdown-/JSON-Ausgabe, schreibbaren Handoff, Read-only-Ablehnung und Commandregistrierung.
Alle Test-Vaults und App-Daten lagen in temporären Verzeichnissen; keine Nutzer-Vault wurde
migriert oder als Fixture verwendet.

## Herkunft und Grenzen

`frontend/src/prompt-studio/PROVENANCE.md` nennt die verwendeten PixelForgeStudio-Revisionen
`a4784cbb3b991c37cb5e87855f2025c0565cc4ff` und
`d253e7a948dc80ce766fe5e7ca76440f1f418c85` sowie den MIT-Hinweis. Startseite, Gesamtheader,
Animation Studio, Footer und eigenes `main.tsx` wurden nicht übernommen.

Windows- und macOS-Laufzeiten, Signierung, Notarisierung, Veröffentlichung und Push wurden in P27
nicht ausgeführt. Die vorhandenen CI-/Paketpfade bleiben vorbereitet, gelten ohne passenden Host
beziehungsweise gesonderte Freigabe aber nicht als neu abgenommen.
