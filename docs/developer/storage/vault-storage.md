<!-- AUTO-GENERATED:backlink START -->
[← Back](storage.md)
<!-- AUTO-GENERATED:backlink END -->
# Vault and safe file storage

PixelCutoutSprite Studio owns only explicitly named JSON and PNG sources inside a user-selected
vault. The native directory dialog returns a path to Rust. An empty directory can be initialized
immediately. A non-empty directory is inspected twice and needs a current confirmation token
before Studio creates `.pixelforge-studio`. Existing entries are not replaced. A malformed
administration directory or `vault.json` is reported as damaged and is never treated as empty.

## Ownership

| Scope | Location | Examples |
|---|---|---|
| Vault global | `.pixelforge-studio/` | `vault.json`, global labels, UI state, runtime lock |
| Project | `<project>/.project/` | project manifest, project journals and backups |
| Area | `<area>/.area/` | profiles, assets, templates and outfit drafts |
| Character | normal NPC subdirectories | character, appearance and animation bindings |
| Derived | named export/cache directories | reproducible output, never authoritative input |

Device-local recent paths are stored through Tauri's application configuration directory, not in
the vault. The product has no SQL or SQLite persistence layer.

## Write protocol

`VaultRoot` canonicalizes the selected root. `ResolvedPath` rejects absolute paths, traversal,
symbolic-link components and any existing component whose canonical target leaves the root.
`JsonStore` serializes to a sibling temporary file, flushes it, reads and validates the staged
bytes again, and only then requests replacement. Compare-and-swap uses a SHA-256 version stamp so
an external change becomes a conflict instead of being overwritten. Replacement errors remove
the staged file and preserve the previous valid target.

The writer lock is created with operating-system `create_new` semantics and carries a session ID
and heartbeat. A second instance opens read-only and cannot remove the writer's lock. Permission
errors are surfaced with the attempted path; data is not redirected to another location.

Multi-file work has a validated project-scoped JSON journal with prepared/committed states,
explicit target, staged file, optional backup and expected digest. P03 establishes this durable
format; operation-specific resume/rollback policies and stale-lock recovery are completed in P18.

P05 creates a complete area tree below `<project>/.project/transactions/<transaction-id>/staged/`,
validates both `area.json` and the first profile snapshot, writes the move journal, and then
publishes the directory into the project with one same-filesystem rename. Transaction trees are
excluded from the object index, so an interrupted staged copy cannot shadow a published object.
A later height change creates `rNNNN.json` with create-only semantics before the area manifest is
advanced by SHA-256 compare-and-swap; a failed conflict removes only that newly staged revision.
Crash-window reconciliation and general rollback remain explicitly assigned to P18.

P13 applies that boundary to first-time NPC creation and to changes on an existing NPC. A
project-scoped journal records four ordered file replacements for a first save: Character,
`appearances/default.json`, the first Animation Binding, and the CAS-pinned outfit draft transition
from `in_progress` to `assigned`. Validated bytes are staged below the matching
`<project>/.project/transactions/outfit-save--<transaction-id>/` tree and each target file is
published in journal order; existing targets use project-scoped backups. The journal advances
through Prepared, Applying, Committed, RolledBack, or NeedsRecovery instead of claiming a
filesystem-wide directory rename. A failure before any target is published cleans the prepared
staging tree; an interruption after partial publication deliberately leaves an Applying or
NeedsRecovery journal for the P18 recovery workflow. The referenced MotionRevision and imported
PNGs are never copied into the NPC folder.

Existing-NPC apply uses the same protocol but includes only scopes that actually changed, plus the
draft assignment. Before staging, it compares the pinned object revision and SHA-256 stamp of the
Character, shared Appearance, and optional existing Binding. An external same-revision edit is
therefore a conflict rather than an overwrite, and an approval-only Appearance change is not lost.

Unnamed work is an authoritative mutable source at
`<area>/.area/drafts/outfit--<draft-id>.json`. Every completed editor command makes the UI dirty;
after two idle seconds the native autosave validates exact asset references and compares the
loaded document stamp before incrementing its revision. Saving does not clear the session's
Undo/Redo history, and a failed or conflicting write retains the current in-memory edits.

P14 includes the complete equipment graph in that same CAS-protected draft payload: logical
objects, rigid subparts, direction images and optional transform tracks are not sidecar state.
Asset references must resolve to compatible area-owned armour/accessory/equipment revisions.
Disabled pieces and tracks remain serialized unchanged. First-time NPC save copies this authored
equipment into the Default Appearance while leaving every imported PNG in its area asset folder;
it creates no extra anatomy, database row or equipment-specific file tree. The future P16 export
must consume this persisted Appearance through the same compositor used by preview.

## Durability boundary

The staged-write ordering and failure behavior are exercised on Linux. No cross-platform atomic
replacement guarantee is claimed: filesystem, Windows and macOS replacement behavior must be
validated on their actual targets in P18/P20. Autosave state already distinguishes clean, dirty,
saving, saved and failed states and applies a two-second idle policy; editors consume it in P08.

The integration suite uses temporary directories only. It covers initialization and reopen,
foreign/damaged directories, concurrent writers, injected replacement failure, external-change
conflict, journal scope, global ownership, device recents, permission failure and Unix symlink
escape prevention.

## Project and label persistence

`ProjectService` discovers projects from their own `.project/project.json` manifests rather than
from a hidden database or authoritative global index. Creation writes the complete project
administration skeleton before exposing the card. Rename preserves the UUID; duplication creates
a fresh UUID and carries only valid Workspace-label references. Archive is a reversible manifest
state. Controlled removal renames the complete folder into the Vault-root `.trash` directory and
does not permanently delete user content.

Workspace labels live in `.pixelforge-studio/labels.json`; the empty project-label foundation lives
in each `.project/labels.json`. Both catalogs retain stable label UUIDs, colors and revisions and
reject Unicode-normalized sibling collisions. Workspace-label removal first strips every project
reference and the persisted filter selection, then removes the label, so a partial failure cannot
leave a dangling reference or delete a project. Project dashboard preferences live at the matching
Workspace scope in `.pixelforge-studio/ui.json`.

P05 adds area creation/reopen, project-label scope, a committed creation journal, read-only
browsing and byte-identical preservation of the previous profile revision.

## Area asset sources

P12 stores each imported image beneath
`<area>/.area/assets/<name>--<id-prefix>/rNNNN/`. `original.png` is a byte-for-byte copy of the
selected external file or full sheet; `source.png` is the effective immutable image used by the
compositor and may be an explicitly reviewed crop, transparent pad, or nearest-neighbour rescale.
`revision.json` records its SHA-256 and portable area-relative path, while `asset.json` owns the
stable ID, metadata and released revision list. External chooser/drop paths never become saved
references.

Inspection decodes and validates every package source without writing. Confirmation repeats the
checks before copying, and read-only sessions cannot import or archive. The object index is rebuilt
after a successful mutation and again on Vault reopen. Archive advances the mutable asset manifest
but retains numbered image revisions needed by appearances or drafts; the inventory lists those
uses before confirmation. Multi-file crash-window recovery remains covered by the general P18
transaction hardening rather than a false filesystem-wide atomicity claim here.
