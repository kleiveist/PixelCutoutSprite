<!-- AUTO-GENERATED:backlink START -->
[← Back](developer.md)
<!-- AUTO-GENERATED:backlink END -->
# Repository inventory for PixelCutoutSprite Studio

**Captured:** 2026-09-05
**Branch:** `main`
**Starting revision:** `e709b853f0bf2bcfb95da7e7113cf18e43c4fc57`
**Remote relation:** `main` matched `origin/main` before implementation.

## Actual starting point

The checkout is Template Tooling 0.4.0, not the Forge2D/Godot repository described by the
imported planning bundle. It contains the portable Python tooling, its tests, hosted CI and
Tauri-aware `desktop-local` profile. It does not contain an application scaffold, `game/`,
`frontend/`, `src-tauri/`, `AGENTS.md`, `.agent/PLANS.md` or the cited `config/*.toml` files.

The user-supplied planning bundle was present as untracked documentation. Its copy of the
portable documentation had been moved byte-for-byte from `docs/toolingdocs/` to
`docs/.toolingdocs/`; P00 restored the required portable path without changing those bytes.
`WORKFLOW-HANDOFF.md` had been removed as part of turning the source-only template into a
product repository. That removal is retained and the stale README link is removed.

## Ownership boundaries

| Boundary | State and decision |
|---|---|
| `tools/` | Portable integration tooling. Keep its public command contracts and payload boundary. |
| `docs/toolingdocs/` | Portable tooling documentation. It stays at the path required by the manifest. |
| `frontend/` | Product-owned Vite/React/TypeScript UI, introduced from P01 onward. |
| `src-tauri/` | Product-owned Tauri/Rust desktop host and trusted local-file boundary. |
| `docs/developer/` | Product specification, decisions, execution plan and acceptance evidence. |
| Vaults | User-selected external directories. Never fixtures inside production paths and never bundled. |

The Template Tooling adapters are deliberately conservative and do not scaffold product
trees. Creating `frontend/` and `src-tauri/` is therefore product implementation, not a change
to the portable tooling ownership contract.

## Assumptions found and disposition

| Imported assumption | Actual finding | Disposition |
|---|---|---|
| Existing Godot desktop application | No product application exists. | Replaced by ADR-001: Tauri 2 desktop application. |
| Godot/GDScript is the studio runtime | The template ships first-class Tauri tooling. | TypeScript UI and Rust application core; no browser product. |
| Godot 4.7.2 is required to run the studio | Godot is available only as a consumer target. | Used in P17 to validate exported packages, not by end users of the studio. |
| Touch/mobile/web product targets exist | No product targets exist. | Desktop-only Tauri bundles; Vite dev server is development infrastructure only. |
| Python is an application runtime | Python powers repository tooling. | Native bundles do not spawn or require Python. |
| Backend/database may be present | Neither exists; SQL is prohibited by the product scope. | `desktop-local`, no optional features and no database dependency. |

## Workspace and environment baseline

The Codex process runs inside a Flatpak SDK. Host tools are reachable through
`flatpak-spawn --host`: Node.js 26.7.0, npm 12.0.2, Rust 1.97.1 and Godot 4.7.2 were observed.
The sandbox itself initially exposed Python 3.13.15 and no Node, npm, Rust or WebKit pkg-config
entry. Platform-sensitive native results must identify whether they ran inside the SDK or on
the host.

The central tooling support contract specifies Node 24.19.0, Rust 1.97.1 and Python 3.13.
Rust matches exactly. The available Node 26 host is newer than the CI baseline, so CI retains
the pinned Node 24 check while local frontend tests may also run on Node 26.

## Baseline checks

| Check | Result before product implementation |
|---|---|
| Portable core/adapter/integration pytest suite | PASS — 443 passed, 2 skipped. |
| Source packaging/workflow policy tests | PASS — 16 passed. |
| `python tools/control.py integrate --check --json` | Expected failure: no product profile or product roots yet. |
| `python tools/control.py tooling verify` | Expected failure before P00 configuration; generated ignored `__pycache__` was also detected and removed. |
| Documentation navigation check | Expected failure on the unintegrated planning bundle and moved portable docs. P00 integrates its navigation. |
| Full portable tooling suite after selecting `desktop-local` | Interrupted after 7m35s: 6 passed and 11 acceptance cases failed because npm is not exposed inside the Flatpak SDK; this is environment evidence, not a passing gate. |
| Native application test | Not applicable before P01; there was no application. |
| Windows/macOS native smoke | Not run on this Linux workstation; CI evidence is required in P20. |

## Reusable parts

- The `desktop-local` profile already models Vite, TypeScript, Tauri and Rust.
- `python tools/control.py` already supports installation, tests, quality, Tauri development
  and native build dispatch.
- Hosted workflows and the support matrix provide the starting point for P20.
- Existing path, transaction, sanitization and quality code is tooling-owned reference
  material, not an application storage layer. Product services remain under `src-tauri/`.

No game demo or studio editor was reusable because neither existed in this checkout.
