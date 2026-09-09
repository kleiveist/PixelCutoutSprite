<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# JSON contract version 1

PixelCutoutSprite Studio stores its editable sources as ordinary UTF-8 JSON files and imported
PNG files. Rust types under `src-tauri/src/domain/` are authoritative. Matching TypeScript DTOs
under `frontend/src/domain/` describe the desktop IPC payloads; they do not bypass Rust
validation. No SQL database, engine resource, cache, or exported atlas is an authoritative
source.

## Common envelope and identity

Every JSON source has integer `schema_version: 1` and a fixed `kind`. Mutable objects also have
a stable lowercase, hyphenated UUID `id`, a positive monotonic object `revision`, and RFC 3339
UTC `created_at`/`updated_at` values. Published profile, motion, and asset revisions are addressed
by the pair `(id, revision)` and have `published_at`; that pair is immutable. A schema version is
not an object revision.

Names are presentation data and never references. References use UUIDs and, where reproducible
content matters, an exact positive revision. Renaming therefore cannot change identity. Unknown
fields are rejected so that a successful round trip cannot discard data. A future
`schema_version` is detected from the header before normal decoding and produces the dedicated
`UnsupportedSchemaVersion` error; such bytes never enter a write path.

The fixed document kinds and their identities are:

| Kind | Mutable identity or immutable revision | Main relationships |
|---|---|---|
| `vault` | vault UUID | Format marker and creation time only |
| `label` | label UUID + object revision | Workspace scope, or exactly one project |
| `project` | project UUID + object revision | Workspace label UUIDs |
| `area` | area UUID + object revision | Project UUID and exact active profile revision |
| `profile_revision` | profile UUID + release revision | Area, slots, eight views and mirror pairs |
| `motion_template` | template UUID + object/draft revisions | Area and immutable released revision numbers |
| `motion_draft` | template UUID + mutable draft revision | Exact profile, timing, directions, tracks, optional preset semantics, and last released draft revision |
| `motion_revision` | template UUID + release revision | Exact profile, timing, directions, tracks and optional preset semantics |
| `asset` | asset UUID + object revision | Area and immutable released revision numbers |
| `asset_revision` | asset UUID + release revision | Exact profile/slot, relative PNG and SHA-256 |
| `outfit_draft` | draft UUID + object revision | Area, exact motion/profile, directional fittings, local overrides and equipment |
| `character` | NPC UUID + object revision | Area, exact profile and default appearance UUID |
| `appearance` | appearance UUID + object revision | NPC, exact profile, assets, fitting and equipment |
| `animation_binding` | binding UUID + object revision | NPC, action key, motion revision and appearance |
| `export_manifest` | build UUID | Effective sources, actions, atlas pages and frames |

Template, appearance, and animation-binding IDs are deliberately separate. Multiple characters
may reference the same released motion revision. A character may have at most one active binding
for a given lowercase `action_key`; variants use distinct keys such as `walk_carry`.

`motion_draft` is intentionally loaded by `MotionService` rather than the released-document
index: it shares the template UUID and therefore is not a second catalog identity. Its
`released_from_draft_revision` records whether the current bytes have been published. Publishing
copies validated content to a new `motion_revision`; it never changes an existing release.

## Numeric and graph rules

- Reference height is `16..=512` pixels.
- Each frame axis is `1..=1024`; frame count is `1..=1024`; FPS is `1..=120`.
- Coordinates and track values are bounded and finite. Integer JSON fields do not accept strings,
  booleans, or fractional values.
- Directions are exactly `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, and `nw`, without duplicates.
- Each profile view contains every declared slot exactly once in its layer order and base
  transforms. Slot parents must exist and form an acyclic forest. A slot can occur in at most one
  non-self mirror pair.
- A released motion lists all eight direction states. A state is explicit, mirrored from one
  existing direction, or missing. Mirror chains are acyclic and must terminate at an explicit
  direction rather than a missing one.
- Tracks are direction- and slot-specific. Keyframes are strictly increasing integer indices in
  the exported frame interval. Visibility, sprite-variant, and layer changes use hold
  interpolation; numeric offsets and rotation may also use linear or ease-in/out interpolation.
- Motion drafts and releases may carry preset semantics. Root motion is explicitly in-place;
  recommended game speed is metadata. Deterministic numeric helpers identify their slot,
  property, amplitude, cycles, phase and enabled state and may be baked to ordinary keys. Jump
  height mode and the optional bounded ground-shadow layer are separate from the fixed ground
  origin and from the sixteen anatomical profile slots.
- Atlas pages are independently limited to `1..=4096` pixels per axis. Rectangles describe the
  unpadded, fixed `1..=1024` frame surface, are positive, and remain fully inside their declared
  page. Frame action, page, direction, and sample references must exist. Every frame lasts one
  tick (`1 / fps`) in format version 1.

Local validation checks one document. `DomainCatalog::validate` then detects duplicate IDs and
revision pairs, resolves every required relationship by identity, checks project/area/profile
ownership, and rejects incompatible profiles. It never falls back to a similar name.

## Humanoid profile version 1

P05 fixes the productive v1 profile to sixteen named slots: lower/upper torso, head, optional
hair, and left/right upper arm, forearm, hand, thigh, shin and foot. Hair is the only optional
slot; there is no eye layer. Parent links, pivots, base transforms, six left/right pairs and the
back-to-front layer order are present for all eight views. `SlotDefinition.base_transform` is the
south-view fallback and is byte-for-byte equal to that view transform, not an additional offset.

The 80-px reference vertical chain is `16 + 20 + 10 + 16 + 14 + 4` for head, upper torso, lower
torso, thigh, shin and foot. Other heights use integer largest-remainder allocation in stable
segment order. Thus the neutral anatomical bounds measure exactly the requested 16–512 px while
optional hair or future equipment may extend beyond them. Widths, pivots and view offsets use
deterministic half-up integer scaling. `validate_humanoid_v1` compares stored geometry to the
generator, so missing, reordered or invented slots cannot masquerade as this preset.

## Directional outfit fitting

An outfit draft keeps one compatibility fallback in `selected_assets` per fitted slot and the
effective editable state in `fittings`. Each base fitting is keyed by `(slot_id, direction)` and
stores an immutable image revision and pivot plus the direction-wide slot-local offset, rigid
correction rotation, visibility and layer delta. Its additive `variant_fittings` list maps a unique
motion sprite-variant name to another immutable image revision and pivot; transforms remain on the
base fitting so a discrete variant key changes only bitmap and pivot. `local_overrides` is keyed by
slot and direction and contains only the binding-local transform. Duplicate targets or variants,
mismatched slots/profiles, orphaned overrides and non-finite or out-of-range transforms are
invalid.

Normally the base and variant images have the exact fitting direction. The sole exception is a
persisted `asset_fallback_approvals` entry for the same slot, target direction, horizontal source
direction and variant. The source revision must explicitly allow sprite mirroring. A materialized
target fitting stores target-local pivot and transform while retaining the approved source image;
rendering mirrors only that bitmap. A legacy fallback without a materialized target fitting also
mirrors the reused source geometry and pivot. Pose mirroring, individual bitmap mirroring and
whole-frame mirroring remain separate operations.

When a draft becomes the default Appearance, every `DirectionFit` records its direction image,
pivot and optional `variant_fittings`. The original `SlotAppearance.asset` remains the required
compatibility fallback so existing v1 documents without the additive fields remain readable. New
writes include explicit empty draft arrays. Existing pinned revisions remain renderable and
fine-tunable after archival, but an archived or no-longer-released revision cannot be newly
assigned or newly approved as a mirror source.

Existing-NPC drafts additionally pin the Character and Appearance revision plus SHA-256 content
stamp, and do the same for an existing action Binding. Apply verifies those pairs before staging
any write, preventing a same-revision external edit from being overwritten.

The editor context derives completeness rather than persisting it. Each `missing_required_slots`
entry carries absent default `missing_directions` and separate `(direction, variant)`
`missing_variants` sampled from the exact released motion, including resolved mirrored poses.
Optional slots report variant gaps only after that slot is actually worn.

Rendering uses the shared compositor contract without intermediate rounding:

```text
slot world = parent × profile view × sampled motion
image      = slot world × shared appearance fitting × binding-local override × pivot translation
```

Dummy outlines, axes, pivots and selection handles are not fields in either render request or
persisted appearance. The native preview returns resolved affine guide matrices separately from
RGBA bytes; those UI overlays therefore follow the sampled parent hierarchy without entering a
PNG/RGBA result. An enabled preset ground shadow remains a compositor part anchored to the motion
ground origin, not a profile slot or guide.

## Equipment objects and optional motion

An `Equipment` value is one logical armour, accessory or equipment object. Its existing top-level
piece remains the primary rigid piece for schema-v1 compatibility; additive `additional_parts`
carry further pieces of the same object. Every piece has its own stable UUID, presentation name,
existing profile `anchor_slot`, exact base asset revision, direction fittings, and three
independent settings:

- `enabled` decides whether the piece enters the shared compositor. Turning it off retains every
  image, fitting and key.
- `follow_mode: "slot"` parents the piece to its anatomical slot. `"root"` explicitly parents it
  to the figure origin. The provisional `"world"` value remains readable and has the same safe
  figure-root meaning; it is not a screen-space attachment.
- `own_motion_enabled` gates only the additional transform tracks. It never disables normal slot
  following.

Equipment does not add profile slots: the humanoid anatomy remains the same sixteen-slot
contract. Each direction fitting records an exact compatible armour/accessory/equipment image,
optional pivot override, additive `variant_fittings`, local offset, rigid rotation, visibility and
layer delta. A sampled sprite-variant key selects the matching equipment image without changing
the direction-wide transform. Saving an
enabled piece as an NPC requires compatible images for all eight directions. An incomplete
disabled piece may remain in the draft or Appearance so editing choices are not destroyed.

`own_motion_tracks` are keyed by direction. A track stores its own `enabled` gate, linear/hold/
ease-in-out interpolation, and strictly increasing transform keys. Draft validation bounds keys
to the active immutable MotionRevision. Sampling has no clock or random input; a hidden piece,
disabled own-motion gate, disabled track or invisible direction produces the identity delta and
cannot leak a stored key as phantom movement. The resulting rigid transform is evaluated after
the chosen slot/root attachment and before the direction fitting. Explicit target-direction
equipment images are not mirrored a second time, preserving asymmetric gloves and accessories.
No mesh, weights, skinning or new anatomical bone contract is introduced.

## Files and portable paths

The layout service introduced with the Vault phase is the only code allowed to construct managed
locations. Version 1 reserves these conventions:

```text
<vault>/.pixelforge-studio/vault.json
<vault>/.pixelforge-studio/labels/<label-id>.json
<vault>/<project-name>--<id>/.project/project.json
<project>/<area-name>--<id>/.area/area.json
<area>/.area/profiles/humanoid--<profile-id-prefix>/rNNNN.json
<area>/.area/templates/<template-id>/template.json
<area>/.area/templates/<template-id>/draft.json
<area>/.area/templates/<template-id>/revisions/rNNNN.json
<area>/.area/assets/<asset-name>--<asset-id-prefix>/asset.json
<area>/.area/assets/<asset-name>--<asset-id-prefix>/rNNNN/revision.json
<area>/.area/assets/<asset-name>--<asset-id-prefix>/rNNNN/original.png
<area>/.area/assets/<asset-name>--<asset-id-prefix>/rNNNN/source.png
<area>/.area/drafts/outfit--<draft-id>.json
<area>/<character-name>--<id>/character.json
<character>/appearances/default.json
<character>/<action-key>--<binding-id>/binding.json
<binding>/exports/current.json
<binding>/exports/build-<source-fingerprint>/animation.json
<binding>/exports/build-<source-fingerprint>/sheet-0.png
<binding>/exports/build-<source-fingerprint>/frames/<action>/<direction>/0000.png  # opt-in
```

`.pixelforge-studio` contains only vault-wide labels/settings, rebuildable index data, and runtime
coordination metadata. Project, area, profile, motion, asset, NPC, appearance, binding, backup,
and export source data stay in their owning project tree. Stored PNG paths are area-relative,
slash-separated paths. Empty paths, absolute POSIX paths, Windows drive/UNC paths, backslashes,
`.`/`..`, NUL, and the reserved administration segment are rejected lexically in P02; P03 also
checks the real filesystem and symlinks.

Readable folder names are sanitized independently and receive an ID suffix. Reserved Windows
device names, forbidden filesystem characters, trailing spaces/dots, and names colliding after
Unicode NFC normalization plus case folding are rejected. User text is never concatenated into
a path directly.

The strict external `pixel-cutout-asset-package` version 1 contract is deliberately not a domain
document: it is inspected input and is never copied into the Vault as authority. It names an exact
`profile_ref` and 1–512 entries. Each entry declares its source PNG, asset kind, variant, full image
dimensions, pivot, optional sheet rectangle, mirror permission and origin/license notes. Slot and
direction are either both present or both absent for explicit review. Unknown fields, another
format/version, profile mismatch, non-PNG data, missing alpha, wrong dimensions, an out-of-bounds
or over-1024 cell, oversized data, absolute/traversing paths and symlinks fail before import.

## Revisions, transitions, and export freshness

A template stays `active` while its current draft and zero or more published revisions coexist;
archiving does not mutate a release. Publishing writes a new revision instead of changing an old
one. An outfit draft can move from `in_progress` to `assigned`, and a binding from `draft` to
`reviewed`; these are one-way decisions. NPC review may return to draft for explicit editing, and
archived records can be deliberately restored.

Export freshness compares the manifest fingerprint to a canonical fingerprint of the sources
actually used: profile, released motion, referenced image revisions, appearance fitting, binding
overrides, export settings, and renderer version. JSON object key order and timestamps alone do
not alter this input. A newer unused release therefore does not make an old export stale; changing
an effective source does.

## Export builds and publication

The generic export manifest records generator and rasterizer versions, the effective profile,
motion, asset, appearance, and binding revisions with their content hashes, all actions in stable
action-key order, FPS/loop/root/jump modes, the fixed frame surface and ground origin, atlas page
sizes and decoded-RGBA hashes, and every frame rectangle in canonical `n` through `nw` order.
Optional padding changes cell spacing, not the rectangle or artwork size. Optional extrusion
duplicates edge pixels only into that padding. Individual PNGs are omitted by default; when
enabled, their relative paths are explicit and their decoded pixels must equal the atlas rectangle.

An ordinary export contains every sample for all eight directions. A subset or missing source is
accepted only when `allow_incomplete_test` is true; the manifest is then `complete: false` and has
an `incomplete_export` warning. Clipping blocks by default and can only continue under the saved
warning policy, with per-frame bounds retained in JSON. Different action canvases or ground
origins likewise block unless transparent geometry normalization is selected; normalization
aligns ground origins without scaling or cropping.

Frames are first rendered through the shared animation sampler and CPU compositor into a private
job directory. Atlas pages, optional loose frames, JSON, dimensions, paths, decoded-pixel hashes,
and cross-references are reread and checked there. Only then is the directory renamed to
`build-<source-fingerprint>` and `current.json` replaced. Cancellation or any validation/write
failure leaves the prior pointer intact and removes only the job's private staging directory.

The optional derived [Godot package](godot-package.md) copies this validated manifest and its
declared PNG artifacts before generating relative `SpriteFrames` and scene resources. It does not
replace the generic contract or introduce another source of animation truth.

## Fixtures and compatibility gate

Complete positive fixtures live in `src-tauri/tests/fixtures/contracts/valid/`; deliberate future,
type, traversal, graph, and atlas failures live beside them under `invalid/`. The
`domain_contracts` integration test loads every positive file, validates it, serializes it, reads
it again, and validates the connected catalog. It also proves shared-template use and distinct
template/appearance/binding identities. These fixtures are the version-1 compatibility examples;
the shorter JSON excerpts in the product specification remain explanatory only. P05 adds
`src-tauri/tests/fixtures/profiles/humanoid-v1-80-reference.json`; a generator test compares its
slot dimensions, parents, pivots, mirror pairs, frame/anchor and every view layer order.
