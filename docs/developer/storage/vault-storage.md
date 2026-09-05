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

## Durability boundary

The staged-write ordering and failure behavior are exercised on Linux. No cross-platform atomic
replacement guarantee is claimed: filesystem, Windows and macOS replacement behavior must be
validated on their actual targets in P18/P20. Autosave state already distinguishes clean, dirty,
saving, saved and failed states and applies a two-second idle policy; editors consume it in P08.

The integration suite uses temporary directories only. It covers initialization and reopen,
foreign/damaged directories, concurrent writers, injected replacement failure, external-change
conflict, journal scope, global ownership, device recents, permission failure and Unix symlink
escape prevention.
