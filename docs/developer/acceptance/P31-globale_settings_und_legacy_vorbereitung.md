# P31 · Globale Einstellungen und Legacy-Migrationsvorbereitung

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

Datum: 2026-09-09
Status: Frontend umgesetzt und getestet; nativer Store nicht ausgeführt
Anforderungen: R-G01, R-D02, R-D07

## Ergebnis

- Globale Werte sind strikt auf `theme`, `uiLanguage`, `density` und optionalen Fensterzustand
  begrenzt. Der native Store schreibt ausschließlich `global-settings.json` im Tauri-App-
  Konfigurationsordner. Profile, aktive Basis-ID, Antworten und Ausgaben sind im Schema verboten.
- [`GlobalSettingsProvider.tsx`](../../../frontend/src/shared/settings/GlobalSettingsProvider.tsx)
  wendet Theme und Dichte am Dokument für alle drei Module an. Beim Unmount wird der zuvor
  vorhandene Dokumentzustand wiederhergestellt.
- [`GlobalSettingsDialog.tsx`](../../../frontend/src/shared/settings/GlobalSettingsDialog.tsx)
  hält einen Sitzungsentwurf. Nur „Speichern“ validiert und persistiert; X, Escape, Außenklick und
  Abbrechen committen nichts.
- Der produktive Prompt-Navigationskatalog enthält keinen Settings-Punkt mehr. Ein verbleibender
  interner `settings`-View zeigt im Vault-Pfad nur die kontrollierte Weiterleitung zum Zahnrad und
  rendert nicht still den alten Editor.
- [`legacyVaultMigration.ts`](../../../frontend/src/prompt-studio/services/legacyVaultMigration.ts)
  liest native Altdateien und erreichbare V1/V2-Browser-Schlüssel ausschließlich lesend. Preview
  und Konverter sind rein, erhalten rohe Quellen und erzeugen stabile Quellhash-/ID-Zuordnungen.
  Mehrere Basen, Kategorie-Overrides, doppelte Namen und Zielkonflikte blockieren die Anwendung.
- Der native Legacy-Command heißt `read_legacy_prompt_workspace`; alte Write-Commands sind nicht
  mehr im produktiven Tauri-Handler registriert. Ohne Ziel-Vault entsteht keine Migration.

## Nachweise

- [`GlobalSettingsDialog.test.tsx`](../../../frontend/src/shared/settings/GlobalSettingsDialog.test.tsx):
  Entwurf ohne Commit, explizites Speichern, globale Anwendung und UI-only-Payload.
- [`legacyVaultMigration.test.ts`](../../../frontend/src/prompt-studio/services/legacyVaultMigration.test.ts):
  read-only Inventar, Konflikte, stabile Konvertierung und unveränderte Quellen.
- [`v1Migration.test.ts`](../../../frontend/src/prompt-studio/services/v1Migration.test.ts):
  V1-Fixtures, beschädigte Einträge, Begrenzungen und reine Raw-Preview.
- Rust-Tests in `storage/global_settings.rs`: Rundlauf ohne Fachfelder sowie fail-closed bei
  unbekannten Feldern/zu kleinem Fenster.

## Blocker

Der Rust-Store konnte mangels Toolchain nicht kompiliert oder auf echten Tauri-Konfigurationspfaden
ausgeführt werden. Der Browser-Fallback ist absichtlich nur Sitzungsspeicher und kein fachlicher
Persistenzpfad.
