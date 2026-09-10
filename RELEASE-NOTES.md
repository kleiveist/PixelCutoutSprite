# Unreleased — Vault, Cutout und Sprite (P37–P43)

Datum: 10. September 2026.

- Alte Projekt-/Area-/Motion-/Dummy-/Outfit-/NPC-/Export-Fachbasis und 69 native Commands entfernt.
- Neue Cutout-Willkommen-Seite mit gemeinsamer Navigation, Vault- und geprüfter Bildauswahl.
- Vault-Locks, sichere Dateioperationen, Recovery und Prompt-Vault-Autosave erhalten.
- Alter Area-Handoff und nicht mehr verwendete native Prompt-AppData-/Exportadapter entfernt.
- Bestehende Nutzerdateien bleiben unverändert; keine automatische Projektmigration oder Quarantäne beim Öffnen.
- P37-Negativtests, Hashnachweis und aktualisierte CI-/Testzuordnung ergänzt.
- Neue manuelle Masken mit per-Teil Undo/Redo, Überlappungsschutz und lokaler, abbrechbarer Auswahlhilfe.
- Hashgeprüfte PNG-Teile, kanonisches Schnittprojekt, Snapshot und Positionsmanifest; keine Leer-PNGs.
- Sprite-Autoload, Originalanordnung, View-Ebenen, Transformationen, Szenen-Autosave und ausdrücklicher Generationsabgleich.
- P43: explizite Snapshot-Fortsetzung bei fehlender/geänderter Quelle, Resize-Abbruch, ressourcenschonender Szenen-Autosave und gehärtete Dateisatz-Recovery.
- P43-Abschlusskorrekturen: native Close-/Zoom-Berechtigungen, verlustfreie Begründung beim schnellen Teilwechsel und stabile Profil-ID bei Weiterbearbeitung aus dem Dashboard.
- Native Close-/Flush-Berechtigung gezielt für das Hauptfenster ergänzt; CSP und Datei-/Shell-Berechtigungen nicht geöffnet.

[Nachweise und Grenzen](docs/developer/acceptance/P37-cutout_altbasis_entfernen_willkommen.md).
[P43-Prüfstand und offene Plattformnachweise](docs/developer/acceptance/P43-gesamtabnahme_haertung_dokumentation.md).
Keine Veröffentlichung, kein Tag, keine Signierung und kein Push.

# Historisch — PixelPromptStudio integration (P23–P27)

Date: 6 September 2026

- Added an isolated `frontend/src/prompt-studio/` boundary containing the prompt-facing domain,
  schemas, profiles, Wizard, recovery, engine, review/output and settings foundations.
- Added prompt-only barrel exports and an import-boundary test excluding PixelForge's start page,
  outer shell, Animation Studio, workers and own application entry point.
- Added the required React Hook Form and Zod dependencies without adopting `fflate` or changing
  the existing TypeScript toolchain.
- Recorded upstream PixelForgeStudio revisions and the MIT notice in
  `frontend/src/prompt-studio/PROVENANCE.md`.
- Added two equal, keyboard-operable studio buttons to the existing app header, including the green
  PixelPromptStudio accent and explicit active states.
- Added a guarded `StudioMode` above the unchanged Cutout `WorkspaceRoute`; switching preserves
  Vault, project, area, route and detailed selection state and waits for the Prompt lifecycle flush
  before returning.
- Added a full-width Prompt mount point while retaining exactly one app header and one status bar.
- Replaced that mount point with the complete embedded Prompt dashboard, profile library, guided
  nine-category Wizard, review/output workspace and settings view.
- Added host-state Prompt navigation, browser-development persistence and output adapters, dirty
  draft switch protection, and Prompt-root-scoped design tokens and reset rules.
- Ported the Prompt component, provider, category-editor, Wizard and recovery test coverage.
- Added native, restart-safe app-data persistence for Prompt settings, profiles, the active draft
  and migration backup with fixed file namespaces, byte limits, atomic publication and recovery.
- Added native JSON package import and Markdown/JSON save dialogs while retaining LocalStorage and
  in-memory adapters only for browser development and tests.
- Added a versioned Prompt handoff that is enabled only for a selected writable Cutout Area,
  preserves the source as a JSON reference and returns to the retained Cutout context.
- Added five Playwright system scenarios for the shared header, isolated navigation/styles, legacy
  PixelForge V2 import, persisted prompt workflow and all three handoff availability states.
- Kept the Prompt schema/domain feature graph in one WebKit-safe production chunk after native
  acceptance exposed a cyclic forced-split initialization that Chromium did not reproduce.
- Verified the exact Node 24.19.0 and Rust 1.97.1 gates, visible Tauri/WebKitGTK restart and offline
  recovery, a Linux DEB, its SHA-256 manifest and the native installer-payload smoke.

P23–P27 are complete in the local repository. This unreleased work does not imply a push,
publication, signing or Windows/macOS runtime acceptance.

# Template Tooling 0.4.0

Release date: 28 August 2026
Release tag: `tooling-v0.4.0`

This is the first published release of the portable, profile-driven Template Tooling.
It is designed to be copied into an existing project without taking ownership of that
project's product source, arbitrary configuration, Git history, or runtime state.

## Highlights

- A strict portable boundary containing only `tools/` and `docs/toolingdocs/`.
- Five built-in profiles: `web-only`, `web-cloud`, `desktop-local`,
  `desktop-cloud`, and `full-platform`.
- Read-only project detection and planning with `integrate --check`.
- Transactional `integrate --full-fix` with preimage checks, staging,
  verification, backup, atomic publication, and rollback.
- Preservation of unknown files, product-owned content, and foreign keys in
  structured files.
- Deterministic export with a self-validating payload manifest.
- Direct migrations from tooling `0.1.0`, `0.2.0`, and `0.3.0` to `0.4.0`.
- Reproducible German and English case-study sources and documentation checks.
- Hosted Linux, Windows, and macOS acceptance, including a complete Windows
  copy matrix and real historical migration fixtures.

## Supported release environment

The centrally pinned release matrix uses:

- Python 3.11 through 3.13, with Python 3.13 as the primary runtime;
- Node.js 24.19.0;
- Rust 1.97.1;
- Ubuntu 24.04, Windows 2025, and macOS 15 runners;
- TeX Live 2026 for the bilingual PDF evidence.

The exact support contract travels in
`tools/resources/config/support-matrix.toml`.

## Release assets and authenticity

The GitHub Release contains:

- `Template-Tooling-0.4.0.tar.gz` — the deterministic portable archive;
- `SHA256SUMS` — the external archive checksum;
- `Template-Tooling-0.4.0.intoto.jsonl` — the Sigstore provenance bundle.

The archive contains one top-level `Template-Tooling-0.4.0/` directory and,
below it, only `tools/` and `docs/toolingdocs/`. GitHub also records the build
provenance as an artifact attestation associated with this public repository.

Verify a downloaded release before extracting it:

```sh
gh release download tooling-v0.4.0 --repo kleiveist/Template-Tooling
sha256sum --check SHA256SUMS
gh attestation verify Template-Tooling-0.4.0.tar.gz \
  --repo kleiveist/Template-Tooling
tar -xzf Template-Tooling-0.4.0.tar.gz
```

The included `tools/PORTABLE-PAYLOAD.json` then verifies the files inside the
extracted payload. The payload manifest proves internal consistency; the
external checksum and GitHub attestation establish the distribution chain.

## Installation and upgrade

For a new integration, copy both managed trees into the target project and
inspect the proposed plan before allowing a mutation:

```sh
python tools/control.py integrate --check
python tools/control.py integrate --full-fix
python tools/control.py tooling verify
```

For an existing installation, back up the project, replace `tools/` and
`docs/toolingdocs/` together from this release, and run:

```sh
python tools/control.py tooling migrate --check
python tools/control.py tooling migrate
python tools/control.py tooling verify
```

Keep `project-tooling.toml`, `.tooling-state/`, and all product-owned files in
place. Never mix the two managed trees or the manifest from different releases.

## Release evidence

- [Portable tooling completion and CI expansion](https://github.com/kleiveist/Template-Tooling/pull/10)
- [Full-history acceptance and hosted Windows budgets](https://github.com/kleiveist/Template-Tooling/pull/11)

The tag-triggered Release workflow repeats Gate 0, historical upgrades,
documentation builds, the full portable acceptance matrix, deterministic export,
archive checksum verification, and release-contract tests against the exact tag
before publishing any asset.

## Known boundaries

- Built-in adapters do not scaffold missing product trees and do not silently
  add dependency declarations.
- Explicit live install, test, build, or publish commands can execute product
  behavior and remain operator-controlled operations outside Full-Fix rollback.
- The release validates portable fixtures and historical payloads. A controlled
  pilot in a real product repository is still recommended before organization-wide
  rollout because no generic fixture can represent every customer policy.
