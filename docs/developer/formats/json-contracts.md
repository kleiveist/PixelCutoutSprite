<!-- AUTO-GENERATED:backlink START -->
[← Back](formats.md)
<!-- AUTO-GENERATED:backlink END -->
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
| `outfit_draft` | draft UUID + object revision | Area, exact motion/profile and selected assets |
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
- Atlas rectangles are positive and fully contained in a declared page. Frame action, page,
  direction, and sample references must exist.

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
<area>/.area/assets/<asset-id>/asset.json
<area>/.area/assets/<asset-id>/revisions/rNNNN.json
<area>/.area/drafts/outfit--<draft-id>.json
<area>/<character-name>--<id>/character.json
<character>/appearances/<appearance-id>.json
<character>/<action-key>--<binding-id>/binding.json
<export-build>/manifest.json
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

## Fixtures and compatibility gate

Complete positive fixtures live in `src-tauri/tests/fixtures/contracts/valid/`; deliberate future,
type, traversal, graph, and atlas failures live beside them under `invalid/`. The
`domain_contracts` integration test loads every positive file, validates it, serializes it, reads
it again, and validates the connected catalog. It also proves shared-template use and distinct
template/appearance/binding identities. These fixtures are the version-1 compatibility examples;
the shorter JSON excerpts in the product specification remain explanatory only. P05 adds
`src-tauri/tests/fixtures/profiles/humanoid-v1-80-reference.json`; a generator test compares its
slot dimensions, parents, pivots, mirror pairs, frame/anchor and every view layer order.
