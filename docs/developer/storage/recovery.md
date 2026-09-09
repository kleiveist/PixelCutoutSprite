<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Recovery and data integrity

P18 turns the P03 journal format into the recovery boundary used by the desktop application. It
does not pretend that a sequence of filesystem writes is one atomic database transaction. Each
step is validated and durable on its own; the sealed journal says which step may safely happen
next or be undone.

## Opening a Vault with unfinished work

On open, and again before every writer operation, `VaultService` scans all permitted global and
project transaction locations. A live journal changes the session to recovery-required mode. The
application replaces normal editing with an exclusive recovery panel and does not start normal
heartbeats or new mutations through stale cached session state.

For each opaque transaction ID the panel shows its purpose, owner, state, completed-step count and
whether resume and rollback are currently safe. The UI never accepts a caller-supplied journal
path. `Resume` reconciles already-published bytes, verifies the sealed plan and continues in order.
`Rollback` walks the completed work backwards and restores verified backups or moved sources.
Damaged, unsealed, out-of-scope or identity-mismatched journals remain visible but have both actions
disabled. Closing the Vault is always available.

The following production paths have injected interruption coverage:

- project create, rename and move to Vault trash;
- workspace-label removal across the global catalog, saved view and project manifests;
- area/profile publication, Motion create/save/release/trash and NPC rename;
- configured multi-asset import, Outfit/Appearance/Binding publication and NPC release;
- generic/Godot export completion through the final `current.json` pointer; and
- project-owned export-profile trash moves.

Tests interrupt after a real filesystem step, reopen a new `VaultRoot`, inspect the candidate and
exercise both outcomes. A second interruption can be retried because cursor advancement happens
only after the observed result matches the sealed digest. Successful recovery removes the journal
and temporary transaction material; user trash and immutable released sources remain.

## Writer and orphan-lock recovery

Exclusivity comes from the operating-system lock on
`.pixelforge-studio/runtime/writer.lock.json.os-lock`. The adjacent
`.pixelforge-studio/runtime/writer.lock.json` contains diagnostic ownership and heartbeat data. A
second application process receives a read-only session while that lock is held; deleting or
corrupting the JSON cannot grant a second writer.

After the owning process exits, stale metadata may be removed only when the OS guard can first be
locked. Inspection returns a SHA-256 confirmation token derived from the exact metadata bytes and
path. Recovery repeats that exact token, so a changed or newly acquired lock forces reinspection.
Malformed and zero-byte metadata use the same explicit flow. The UI reinspects the same selected
Vault immediately before recovery and never treats heartbeat age alone as proof that a process is
dead.

## Conflicts, failed saves and navigation

Authoritative mutable JSON is loaded with a SHA-256 `VersionStamp`. Compare-and-swap refuses an
external change even when an editor or external tool kept the same numeric revision. Multi-file
replacement steps also pin their target digest; guarded file moves pin the source digest. Unknown
future schema versions are rejected before writing.

Motion and Outfit editors serialize autosaves, keep dirty state and Undo/Redo after a failure, and
block navigation, reload and window close while a write or unsaved mutation needs a decision. A
conflict offers an explicit reload; failed or conflicting in-memory work can be downloaded as a
recovery copy. That download is outside the Vault and is never silently substituted for the
authoritative source.

## Migrations and ownership

Known historical project schema fixtures migrate only after validation. Before replacement, the
exact original bytes are copied to a versioned backup below the owning project's `.project`
directory. A failed migration leaves either the old valid source or a recoverable journal; a future
schema is preserved byte-for-byte and opened as unsupported rather than downgraded.

The object scanner recognizes documents only below anchored, validated project/area/NPC roots.
Foreign folders that happen to contain names such as `.area`, `character.json` or `appearances`
are not adopted. Transaction, backup, cache, export and trash trees are derived/administrative and
cannot shadow authoritative IDs. Project data and its recovery material remain project-owned;
`.pixelforge-studio` contains only Vault-global state and the one global coordinator journal needed
for workspace-label removal.

A copied Vault has no stored absolute source paths. Opening the copy rebuilds its index from safe
relative paths and preserves its ordinary JSON/PNG sources. Device-local recent paths may still
refer to the old location, but they are outside the Vault and are not source authority.

## Honest durability boundary

P18 verifies these rules with temporary Linux Vaults, including permission failures, occupied
targets, injected write failures, malformed journals, two processes and copied paths containing
Unicode and spaces. It establishes recoverability, not simultaneous all-file visibility. Native
Windows and macOS rename/locking/package behavior is a P20 matrix gate; until then the project makes
no blanket atomicity statement for those filesystems.

There is also no filesystem primitive that atomically proves “no arbitrary external Binding was
created” and renames an unrelated Motion directory. Studio takes the writer lease, hashes the
Motion tree, scans area Bindings immediately before and after journal preparation, rolls the
unapplied journal back if a reference appeared, and blocks its own writers as soon as the journal
exists. A hostile external process could still create a reference in the final instruction window
between that last scan and the rename. Recovery preserves all bytes, but an operator must resolve
that externally introduced reference before accepting the trash move.
