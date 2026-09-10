# PixelStudio · Nachweisindex P28–P33

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

Stand: 2026-09-09
Ausgangs-HEAD: `9efa821bc21b0099dc2f0d51895e472fc02b737f` (`main`)

Planquelle: [`START_HERE.md`](../../-PixelStudio_Implementierungsplan_2026-09-09/START_HERE.md)

- [P28 · Bestandsaufnahme und Verträge](P28-bestandsaufnahme_und_vertraege.md)
- [P28 · Baseline](P28-baseline.md)
- [P28 · vollständiges Wizard-/Ausgabeinventar](P28-wizard-inventory.md)
- [P29 · gemeinsame Shell, Dialoge und Responsive](P29-gemeinsame_shell_dialoge_responsive.md)
- [P30 · Vault-Core und sichere Dateien](P30-vault_core_und_sichere_dateien.md)
- [P31 · globale Settings und Legacy-Vorbereitung](P31-globale_settings_und_legacy_vorbereitung.md)
- [P32 · Prompt-Vault, Autosave und Migration](P32-prompt_vault_persistenz_autosave_migration.md)
- [P33 · Vault-Profil und Basisprofil-Popup](P33-vault_profile_und_basisprofil_popup.md)

Die Phasen wurden auf ausdrücklichen Wunsch gemeinsam ausgeführt. Deshalb bildet der Arbeitsbaum
nach P33 bereits produktive Speicherpfade ab, obwohl der historische P28-Zwischenstand diese noch
nicht aktivieren durfte.

## Abschlussgates

- Vitest: 160/160 Testdateien und 806/806 Tests bestanden.
- TypeScript, ESLint, Prettier und Produktions-Build: Exit 0.
- Playwright: kein Teststart, weil das Chromium-Binary in der Sitzung fehlt.
- Rust: kein Teststart, weil `cargo` und `rustc` in der Sitzung fehlen.
