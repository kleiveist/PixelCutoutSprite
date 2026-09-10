# P28 · Bestandsaufnahme, Zielverträge und Baseline

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

Datum: 2026-09-09
Status: umgesetzt; native Kompilierung mangels Rust-Toolchain nicht ausgeführt
Anforderungen: R-D07, R-P01, R-P09, R-C01, R-C11

## Ergebnis

Die Bestandsaufnahme ist als ausführbarer Katalog statt als lose UI-Liste umgesetzt. Alle 230
Wizard-Felder und alle 16 möglichen Generatorausgaben sind im
[Wizard-Inventar](P28-wizard-inventory.md) dokumentiert und durch einen Vollständigkeitstest
abgesichert. Die [Baseline](P28-baseline.md) hält Ausgangs-HEAD, schmutzigen Arbeitsbaum,
Werkzeugversionen und nicht ausführbare Gates fest.

## Abhängigkeitsmatrix

| Bestand | Anker | Einordnung für den Umbau |
| --- | --- | --- |
| Cutout-Routen und Host | `frontend/src/app/App.tsx`, `frontend/src/app/navigation.ts` | Host/Shell wird geteilt; Projekt-/Area-/NPC-/Animations-Routen bleiben bis P37 bestehen und sind nicht neue Prompt-Persistenz. |
| Prompt-UI | `frontend/src/prompt-studio/features/**` | Fachfragen, Validierung und reine Generatorlogik bleiben; V2-Bibliothek dient im produktiven Pfad nur noch als sitzungsinterne UI-Kompatibilität. |
| Cutout-Clients | `frontend/src/api/{project,area,motion,npc,outfit,asset,export}-client.ts` | Alter Fachunterbau, Rückbau erst P37; keine Abhängigkeit des neuen Prompt-Vaults. |
| Vault-Client | `frontend/src/api/vault-client.ts` | Wiederverwendbare Infrastruktur; um `session_generation` ergänzt. |
| Native Fachcommands | `src-tauri/src/commands/{projects,area,motion,npc,outfit,exports}.rs` | Alter Cutout-Fachunterbau, Rückbau erst P37. |
| Native Vault-/Storage-Kern | `VaultRoot`, `VaultLock`, `JsonStore`, `TransactionService` | Nach Grenzprüfung wiederverwendet; P30 ergänzt einen engeren Workspace-Writer. |
| Alte Prompt-App-Data-Ablage | `storage/prompt_workspace.rs`, frühere Read-/Write-Commands | Nur isolierte Read-only-Quelle für Preview; produktive Registrierung der Write-Commands entfällt ab P32. |
| Domain-Grundtypen | `ObjectId`, Revisionen, SHA-256, Pfadvalidierung | Reine Infrastruktur bleibt erhalten. Projekt, Area, Motion und NPC sind keine Voraussetzung für neue Prompt-Vaults. |

## Verträge

[`v3Contracts.schema.ts`](../../../frontend/src/prompt-studio/schemas/v3Contracts.schema.ts)
enthält strikte Hüllen für Vault-Metadaten, partiellen Prompt-Draft, fertiges/unfertiges
Promptprofil, Basisprofil, Cutoutprojekt, Teilemanifest, Szene und globale UI-Settings. Die
Promptprofil-Fachprüfung koppelt Kategorie und Untertyp; Drafts bleiben davon bewusst getrennt.
Unbekannte Felder, falsche/futuristische Schema-Versionen, Pfadfluchten, doppelte Teile und
inkonsistente Output-Manifeste werden verworfen.

Die Paketverträge wurden nach TypeScript/Zod übertragen, während die vorhandenen tieferen
Kategorie-Schemas weiter die Antworten prüfen. Der Katalog in
[`v3Catalog.ts`](../../../frontend/src/prompt-studio/domain/catalog/v3Catalog.ts) bewahrt alle
vorhandenen Untertypen und ergänzt die Pflicht-Untertypen.

## Legacy-Inventar und Eigentum

- V1-Browser-Schlüssel: `pixelart-prompt-studio:autosave:v1`,
  `pixelart-prompt-studio:presets:v1`.
- V2-Browser-Schlüssel: `pixelforge:v2:settings`, `base-profiles`, `category-profiles`,
  `asset-profiles`, `draft`, `migration-backup`.
- Native Altdateien unter App-Data `prompt-studio/`: `settings.json`, `profiles.json`,
  `draft.json`, `migration-backup.json`.
- Neue erzeugte Promptdateien gehören ausschließlich dem aktuellen Vault. Profilmanifeste führen
  Revision, Generierungsreferenz, relative Pfade und Hashes. Fremde Dateien werden weder
  beansprucht noch still ersetzt.

## Nachweise

- [`v3Contracts.schema.test.ts`](../../../frontend/src/prompt-studio/schemas/v3Contracts.schema.test.ts)
- [`v3Catalog.test.ts`](../../../frontend/src/prompt-studio/domain/catalog/v3Catalog.test.ts)
- Gesamter Frontend-Testlauf und Gates: siehe P33-Abschlussbericht.

## Abweichungen/Blocker

Der Ausgangsarbeitsbaum entsprach nicht einem sauberen Referenz-Checkout; die vorhandenen
Nutzeränderungen blieben erhalten. `cargo`, `rustc`, Playwright-Chromium, `pytest` und `jsonschema`
fehlen in der Sitzung. Native und Browser-Gates werden deshalb nicht grün behauptet.
