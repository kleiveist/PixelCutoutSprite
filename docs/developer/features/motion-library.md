<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Motion library and release routing

P06 adds the first complete area-level animation workflow. A template is a stable, mutable
catalog object, `draft.json` is its recoverable working copy, and every file under `revisions/`
is an immutable released `MotionRevision`. Editing after release leaves the old release valid and
marks the card as having unpublished changes.

The creation dialog inherits the area's exact profile revision, default frame canvas, and ground
origin. Profile height is displayed and stored by the area; it is never inferred from frame width
or height. Frame count is limited to 1–1024 and FPS to 1–120 before either frontend or Rust accepts
the request. Each new draft starts with eight explicit direction records and no hidden pose data.

Cards expose name, action key, timing, loop mode, direction coverage, status, and a reserved
preview surface. P11 replaces that reserved surface with compositor output. Search is text input;
direction, release status, profile, and sort order are native dropdowns. Duplicate creates a new
template UUID. Archive is reversible. Remove moves an unreferenced template to project trash and
refuses to break an NPC binding.

Normal card activation is state dependent:

- a template without a release opens its dummy draft;
- a released template opens an explicit outfit/NPC chooser;
- a caller may pass an NPC UUID, in which case an existing matching binding opens directly;
- multiple compatible NPCs are returned as choices and never reduced to an arbitrary one.

The dummy is also reachable through a permanently visible card button and a keyboard-dismissible
right-click menu. The main navigation keeps the selected project and area in its breadcrumb and
does not enter animation or NPC views without area context. P08 replaces the clearly marked dummy
editor interim, P13 replaces outfitting, and P15 replaces the NPC interim.

`MotionService` performs filesystem discovery by IDs, validates safe area-owned paths, rejects
read-only mutations and external SHA-256 conflicts, and publishes draft/template saves and new
release revisions with project-owned sealed journals. Injected process-level interruption tests
reopen the Vault and prove both resume and rollback. Removal moves an unreferenced template into
project trash through the same recovery service. These guarantees are ordered and recoverable; no
cross-file atomicity claim is made.
