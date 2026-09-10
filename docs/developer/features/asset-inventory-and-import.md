<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Area PNG inventory and reviewed imports

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md).

P12 turns the Outfit workspace into an area-owned PNG inventory. An area card opens the inventory,
and the same view is available from the persistent desktop navigation while that area remains in
context. `InventoryWorkspace` loads the saved Rust inventory, opens the native Tauri file chooser,
and listens to the native webview drag-and-drop event. Browser `File` objects are not treated as
portable paths; Rust always receives a path selected or dropped by the desktop runtime.

## Import review

The chooser accepts either one package JSON or one or more loose PNG files. The backend decodes and
checks every source before the confirmation dialog opens. No file is copied during inspection. A
package entry may declare a slot and direction together. Loose names following
`slot__direction__variant.png` only prefill a visible suggestion; a missing or ambiguous suggestion
keeps the confirmation button disabled until the user chooses both dropdowns.

The review shows kind, source/effective dimensions, pivot, duplicate-content hints, and any profile
slot size difference. Each differing image has explicit choices:

- keep the original pixels and dimensions;
- transparently pad to the selected slot while aligning pivots;
- deliberately rescale to the slot with nearest-neighbour sampling; or
- cancel and choose another variant.

Padding fails if it would crop a source pixel. Rescaling is never selected silently. The unchanged
external PNG is copied as `original.png`; a crop, padding result, or rescale is stored separately as
the authoritative revision `source.png`.

## Package contract

The companion file uses strict JSON with no unknown fields:

```json
{
  "format": "pixel-cutout-asset-package",
  "format_version": 1,
  "profile_ref": {
    "id": "33333333-3333-4333-8333-333333333333",
    "revision": 1
  },
  "entries": [
    {
      "name": "Left hand glove",
      "source": "hand_l__s__base.png",
      "asset_kind": "equipment",
      "slot_id": "hand_l",
      "direction": "s",
      "variant": "base",
      "image_size_px": [4, 4],
      "pivot_px": [2, 1],
      "sheet_rect_px": null,
      "sprite_mirroring_allowed": false,
      "origin_note": "Created for the demo",
      "license_note": "CC0"
    }
  ]
}
```

`profile_ref` must equal the area's exact active profile revision. A sheet repeats the same source
for each regularly gridded cell and supplies `[x, y, width, height]` in `sheet_rect_px`; this makes
cell size, margin and spacing explicit through the resulting rectangles without heuristic slicing.
The declared full image size must match the decoded PNG. Every cell must be positive, inside that
image and at most 1024 px per axis.

Encoded files are limited to 32 MiB, decoded images to 64 MiB of RGBA pixels and package images to
4096 px per axis. Loose single assets remain within the 1024 px asset contract. Only actual PNG data
with alpha is accepted. Absolute, traversal and symbolic-link package sources are rejected against
the real filesystem; package entries cannot mix a slot without a direction. External originals are
read-only inputs and are checked again when confirmation arrives. P19 additionally bounds a single
job to 64 entries, 128 MiB of encoded source data and 256 MiB of decoded RGBA data in aggregate.

## Persistence and safe removal

`AssetRepository` gives every imported item a stable UUID and immutable numbered revisions. Each
revision records the exact profile, slot, direction, variant, dimensions, pivot, relative source path
and SHA-256 of the effective PNG. The inventory is rebuilt from ordinary manifests after reopening
the Vault; its in-memory index is only a cache.

Cards show labels and every appearance, equipment or outfit-draft use. The structured slot,
direction, kind, profile, label and usage conditions are dropdowns and combine with the separate
text search. “Remove” is implemented as recoverable archive: the dialog lists saved uses and keeps
their exact image revision available, so it never creates a hidden broken NPC reference.

## P19 scale and cancellation

The inventory command now returns deterministic metadata-only pages: 50 rows by default and no
more than 100 per request. PNG bytes and data URLs are absent from those rows. A separate native
command revalidates the requested released revision, source hash and dimensions before producing a
nearest-neighbour thumbnail with at most a 48 px edge. The React workspace requests thumbnails only
when their cards enter or approach the viewport, keeps at most 256 outstanding/cached request
identities and exposes an explicit “Load more” action for the next metadata page. Query refreshes
keep the controlled filter controls mounted while the native page request is pending, so continuous
typing retains focus; stale responses remain guarded by context, query and request generation.

Confirmed imports run as native jobs with visible stage/progress state, polling fallback and an
explicit cancel action in both Inventory and Outfit flows. A cancelled job reports its terminal
native state; closing the Vault remains blocked while an import or export job is active. The
100-project/1000-asset fixture proves stable ten-page traversal without embedded image payloads and
requests only 16 visible thumbnails. Its release measurements, four-image import/reopen timings and
15 cancellation samples are recorded in the
[P19 desktop acceptance](../acceptance/desktop-usability-and-performance.md).

Committed positive and path-traversal fixtures live under
`src-tauri/tests/fixtures/import/`. `asset_import`, `asset_inventory`, and the inventory component
tests cover package/crop validation, loose review, explicit resizing, unchanged originals, native
drop handling, usage reporting, archive and full close/reopen persistence. P18 additionally runs
the configured desktop import path with both Nearest-rescale and transparent-padding decisions,
interrupts after the first of two real publications, closes the app, and verifies Resume and
Rollback without altering either external source file. P19 adds page/cursor, bounded-thumbnail,
aggregate-budget, asynchronous job, cancellation and large-fixture coverage.
