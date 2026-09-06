<!-- AUTO-GENERATED:docs-index START -->

## 📄 Files

- 🚀 [Start PixelCutoutSprite Studio implementation](START_HERE.md)

# DOCS

- 📚 [Docs Home](docs/index.md)

## 📁 Toolingdocs

- 🗂️ [Overview](docs/toolingdocs/toolingdocs.md)

<!-- AUTO-GENERATED:docs-index END -->

# PixelCutoutSprite Studio

PixelCutoutSprite Studio is an offline-first Tauri desktop application for building reusable,
deterministic pixel-art cutout animations. It combines a React workspace with a Rust core and
stores product data as ordinary JSON and PNG files in a user-selected local vault. Godot is an
optional export target, not the application runtime.

P00 through P22 provide the completed native Cutout application, deterministic export path,
recovery and desktop hardening, reproducible native build tooling, the production-generated
Lichterhain example vault, and the final requirement/E2E acceptance. P23 adds the isolated
PixelPromptStudio source boundary, P24 the shared accessible studio header and guarded switch, and
P25 the complete embedded Prompt workspace, P26 native app-data persistence, dialog-based
import/export and the controlled Cutout handoff, and P27 the integrated browser/native acceptance.
The complete P00–P27 implementation series is locally finished.
Start and validate the application through the repository's existing control entry point:

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri test --cargo
python tools/control.py tauri run --foreground
```

Create and start the current host's unsigned native test candidate with the same entry point. On
Linux, for example:

```sh
python tools/control.py tauri build --target linux --bundles deb
python tools/control.py tauri smoke --target linux
```

The product requirements, implementation phases, and current evidence are linked from
[START_HERE.md](START_HERE.md). Product code lives in `frontend/` and `src-tauri/`; the reusable
integration tooling remains deliberately separate.

The [P20 native-build report](docs/developer/acceptance/native-builds-and-tooling.md) records the
exact Linux package evidence and the honest Windows, macOS, signing, and Codespaces boundaries.
The German [first-steps and Lichterhain guide](docs/guides/erste-schritte-und-lichterhain.md)
explains the complete user workflow, storage/recovery rules, and Godot integration. In the
packaged app, **Create Lichterhain example** creates and opens the complete sample in a selected
empty folder without developer tools. The corresponding
[P21 acceptance report](docs/developer/acceptance/example-vault-and-user-guide.md) records the
production-service, reopen, Unicode-copy, and export evidence.

The [P22 final acceptance](docs/developer/acceptance/final-acceptance.md) maps RQ-01–RQ-40 and
E2E A–J to implementation and executed evidence, including pixel-exact preview/export comparison
and a fresh Godot 4.7.2 import.

The [P27 PixelPromptStudio acceptance](docs/developer/acceptance/prompt-studio-integration.md)
records the exact Node 24/Rust 1.97 gates, five Playwright system scenarios, visible WebKitGTK
restart/offline evidence and the verified Linux DEB. The German
[Prompt Generator guide](docs/guides/prompt-generator.md) explains profile import, drafts, native
exports, recovery and the controlled handoff into a writable Cutout Area.

The [PixelPromptStudio integration plan](docs/developer/plans/prompt-studio-integration.md)
records phases P23–P27. P23 ports only the prompt-facing PixelForgeStudio modules and documents
their source revisions and license. It does not add the PixelForge start page, application shell,
Animation Studio, footer, or a second executable. P24 supplies two equal studio buttons above the
unchanged Cutout router and protects editor state before switching. P25 embeds Dashboard, Profile,
Wizard, Output and Settings with local Prompt navigation and scoped styles. P26 stores settings,
profiles, the active draft and migration backup under the native app-data directory, uses native
import/export dialogs and writes a versioned prompt reference only after an explicit handoff into
a writable selected Area. P27 completes the cross-workflow regression, native package and
documentation acceptance; no second app, outer PixelForge shell or external web page is included.

## Embedded Template Tooling

> **Repository-only documentation.** This README is not included in any portable export.
> A copied payload consists only of `tools/` and `docs/toolingdocs/`.

Template Tooling is profile-driven integration tooling for existing projects. It detects a
project, compares the observed files with a selected portable profile, and produces a bounded
plan. It is not a full-stack application template, a project generator, or an owner of product
source code.

## Portable boundary

The portable payload owns two trees:

- `tools/` contains the runtime, packaged profiles, adapters, tests, and payload metadata.
- `docs/toolingdocs/` contains the documentation that travels with the runtime.

The target project continues to own application source, business logic, data, UI, arbitrary
configuration, and unknown files. Integration may change only tooling-managed files and
explicitly allowlisted structured keys. Existing foreign keys and product content are
preserved.

Runtime state, dependency environments, reports, and build output live outside `tools/`, for
example under `.tooling-state/` and `.dist/`. They are not portable payload content.

## Start with a copied payload

From the target project root, inspect the proposed integration first:

```sh
python tools/control.py integrate --check
```

Review the detected profile, paths, conflicts, and operations. When local `.git` metadata
exists, its resolved top-level must equal the project root and the worktree must be clean; a
target without local `.git` follows the explicit non-repository safety path:

```sh
python tools/control.py integrate --full-fix
python tools/control.py tooling verify
```

`--check` is read-only. `--full-fix` stages its planned changes, verifies them, and either
publishes the complete transaction or rolls it back. The built-in adapters are conservative:
they do not scaffold missing product trees and currently do not add dependency declarations.

For a Full-Fix, planned dependency validation, quality checks, tooling tests, and declared build
commands run in the isolated staging tree before publication; a failed action leaves the live
target unchanged. Direct lifecycle commands can still execute product code and should be used
only with the relevant guide and project-owner approval.

## Documentation

- [Portable documentation](docs/toolingdocs/index.md)
- [Installation](docs/toolingdocs/guides/install.md)
- [Tests](docs/toolingdocs/guides/tests.md)
- [Builds](docs/toolingdocs/guides/builds.md)
- [Releases](docs/toolingdocs/guides/releases.md)
- [Folder replacement and migration](docs/toolingdocs/guides/folder-replacement.md)
- [Development](docs/toolingdocs/development/development.md)
- [Security boundaries](docs/toolingdocs/development/security-boundaries.md)
- [Acceptance](docs/toolingdocs/acceptance/acceptance.md)

## Current status

The integration and migration commands fail closed on unsupported plans, unsafe paths, payload
inconsistency, or an unsafe/dirty Git preflight when Git metadata exists. The payload manifest
proves internal consistency of the copied files against the included manifest; it is not an
external authenticity or release signature.

`python tools/control.py tooling export` creates a deterministic
`Template-Tooling-<version>/` directory in the current directory. Pass `--output PATH` to select
an existing output parent. The command fails closed instead of merging with or replacing an
existing package and writes only `tools/` plus `docs/toolingdocs/`, including a manifest of the
exported bytes. Build artifacts under `.dist/` are product outputs, not portable exports.

The source-only tests under `tests/source/`, this README, repository metadata, the source marker
and the workflow handoff are deliberately absent from the package. The manifest proves internal
self-consistency; obtain the export from a trusted revision because it is not a publisher
signature.

Official `tooling-v*` releases add a deterministic tar archive, `SHA256SUMS`, and GitHub
Sigstore provenance outside that payload boundary. See the
[0.4.0 release notes](RELEASE-NOTES.md) for download, verification, installation, and migration
commands.

## Hosted CI

The source repository has a portable GitHub Actions CI under `.github/workflows/`. Its support
matrix is centrally defined in `tools/resources/config/support-matrix.toml`; jobs create their
virtual environments under the runner temporary directory, never under `tools/`. The CI keeps
source-repository policy checks separate from portable payload checks, then proves copied
check/fix/verify/idempotence, export reproducibility, historical migration, system behavior, and
the bilingual documentation build on the appropriate runners.

Acceptance, nightly, and release workflows begin with Gate 0: concrete adapter, transactional
action, and rollback tests plus `python -m tools.ci_gate --require-ready`. A missing runtime
capability therefore blocks downstream acceptance instead of producing a synthetic success.
The quality workflow also audits every pytest skip site for a visible technical reason and blocks
unreviewed growth beyond the recorded baseline.

Existing workflows in a customer project remain customer-owned and are not replaced by the
tooling. Source-only tests under `tests/source/` are CI evidence for this repository, not a
customer-facing proof bundled with an export.

PixelCutoutSprite Studio additionally has a read-only-permission native matrix in
`.github/workflows/ci-studio.yml`. It uses pinned Linux, Windows, and macOS runners to create and
start short-lived unsigned test candidates; it does not publish, tag, sign, or notarize them.
The `.devcontainer/` setup supports source work and suitable Linux/headless checks, but a
forwarded Vite port is not a native desktop preview.

For repository work, follow the [contribution guide](docs/toolingdocs/development/contribution.md)
and keep changes small, tested, and ownership-aware.
