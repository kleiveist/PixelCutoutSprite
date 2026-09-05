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

The writer lease uses an operating-system exclusive lock on the persistent
`.pixelforge-studio/writer-lock.json.os-lock` guard. `writer-lock.json` is diagnostic metadata with
an instance ID, an unguessable writer token and a heartbeat; it is not the exclusivity primitive.
A second process cannot take over an active OS lock and may inspect the Vault read-only. A stale or
damaged metadata file is recoverable only after the guard can be locked and the caller repeats the
exact content-derived confirmation token. Permission errors are surfaced with the attempted path;
data is never redirected outside the selected test or user Vault.

Multi-file work uses a validated and sealed JSON journal. Every step names an explicit target,
existing staged source, optional project-owned backup and, for replacement or guarded moves, an
expected SHA-256. The journal records its immutable plan digest, each result digest, current cursor
and one of Prepared, Applying, Committed, RollingBack, RolledBack or NeedsRecovery. Resume and
rollback reconcile the actual filesystem state before moving the cursor, making another recovery
attempt safe after a second interruption. Terminal journals, transaction stages and transaction
backups are cleaned only after their outcome has been verified.

P05 creates a complete area tree below `<project>/.project/transactions/<transaction-id>/staged/`,
validates both `area.json` and the first profile snapshot, writes the move journal, and then
publishes the directory into the project with one same-filesystem rename. Transaction trees are
excluded from the object index, so an interrupted staged copy cannot shadow a published object.
A later height change creates `rNNNN.json` with create-only semantics before the area manifest is
advanced together with its new profile through the project journal. Crash-window tests reopen the
Vault and exercise both resume and rollback.

P13 applies that boundary to first-time NPC creation and to changes on an existing NPC. A
project-scoped journal records four ordered file replacements for a first save: Character,
`appearances/default.json`, the first Animation Binding, and the CAS-pinned outfit draft transition
from `in_progress` to `assigned`. Validated bytes are staged below the matching
`<project>/.project/transactions/<transaction-id>.stage/` tree and each target file is
published in journal order; existing targets use project-scoped backups. The journal advances
through Prepared, Applying, Committed, RolledBack, or NeedsRecovery instead of claiming a
filesystem-wide directory rename. A failure before any target is published cleans the prepared
staging tree; an interruption after partial publication deliberately leaves an open journal for
the recovery screen. The referenced MotionRevision and imported PNGs are never copied into the
NPC folder.

Existing-NPC apply uses the same protocol but includes only scopes that actually changed, plus the
draft assignment. Before staging, it compares the pinned object revision and SHA-256 stamp of the
Character, shared Appearance, and optional existing Binding. An external same-revision edit is
therefore a conflict rather than an overwrite, and an approval-only Appearance change is not lost.

Unnamed work is an authoritative mutable source at
`<area>/.area/drafts/outfit--<draft-id>.json`. Every completed editor command makes the UI dirty;
after two idle seconds the native autosave validates exact asset references and compares the
loaded document stamp before incrementing its revision. Motion drafts use the same serialized
save queue and refresh their SHA-256 baseline from the successful native response. Saving does not
clear either editor's Undo/Redo history. A failed or conflicting write retains the current
in-memory edits, blocks unsafe navigation, and offers a local recovery-copy download; reload is an
explicit discard action.

P14 includes the complete equipment graph in that same CAS-protected draft payload: logical
objects, rigid subparts, direction images and optional transform tracks are not sidecar state.
Asset references must resolve to compatible area-owned armour/accessory/equipment revisions.
Disabled pieces and tracks remain serialized unchanged. First-time NPC save copies this authored
equipment into the Default Appearance while leaving every imported PNG in its area asset folder;
it creates no extra anatomy, database row or equipment-specific file tree. P16 export consumes
this persisted Appearance through the same compositor used by preview.

## Durability boundary

The staged-write ordering, injected crash windows and recovery behavior are exercised on Linux.
No filesystem-wide or cross-platform multi-file atomicity guarantee is claimed: each publication
is an individually checked rename and the durable journal is what makes the sequence recoverable.
Windows and macOS replacement behavior still has to pass the native P20 matrix. Autosave state
distinguishes clean, dirty, saving, saved, conflict and failed outcomes and applies a two-second
idle policy.

The integration suite uses temporary directories only. It covers initialization and reopen,
foreign/damaged directories, two real processes competing for the writer lease, explicit orphan
recovery, injected write and occupied-target failures, external-change conflicts, journal
tampering and scope, migration backups, global/project ownership, a relocated copied Vault,
device recents, permission failure and Unix symlink escape prevention. See
[Recovery and data integrity](recovery.md) for the operator flow and tested boundaries.

## Project and label persistence

`ProjectService` discovers projects from their own `.project/project.json` manifests rather than
from a hidden database or authoritative global index. Creation writes the complete project
administration skeleton before exposing the card. Rename preserves the UUID; duplication creates
a fresh UUID and carries only valid Workspace-label references. Archive is a reversible manifest
state. Controlled removal renames the complete folder into the Vault-root `.trash` directory and
does not permanently delete user content.

Workspace labels live in `.pixelforge-studio/labels.json`; the empty project-label foundation lives
in each `.project/labels.json`. Both catalogs retain stable label UUIDs, colors and revisions,
reject Unicode-normalized sibling collisions, and use SHA-256 compare-and-swap for create and
update. Workspace-label removal is globally coordinated because it replaces the workspace catalog,
optional UI selection and every affected project manifest. Only the coordinator journal and global
document stages/backups live under `.pixelforge-studio`; every project manifest stage and backup
stays below that project's `.project` administration tree. Resume or rollback therefore cannot
leave a dangling reference while `.pixelforge-studio` remains global-only.

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
checks before copying, and read-only sessions cannot import or archive. The configured review path,
including crop/pad/nearest-resize decisions, publishes all selected assets through the same injected
transaction service tested for interruption, reopen, resume and rollback. The object index is
rebuilt after a successful mutation and again on Vault reopen. Archive advances the mutable asset
manifest but retains numbered image revisions needed by appearances or drafts; the inventory lists
those uses before confirmation. Export-profile deletion and unreferenced Motion deletion move their
source into project-owned trash through a recoverable transaction instead of unlinking it.

Directory trash moves pin a type-tagged digest of the observed managed source tree before their
last reference checks. `TransactionService::prepare` recomputes that digest, so a project or Motion
tree changed during the decision window produces a conflict instead of silently widening the move.
Motion removal repeats its area-wide Binding scan immediately before and after journal preparation;
a newly observed reference rolls the still-unapplied journal back.
