<!-- AUTO-GENERATED:backlink START -->
[← Back](features.md)
<!-- AUTO-GENERATED:backlink END -->
# Motion presets and stored card previews

P11 adds six editable starting motions: Idle, Walk, Sprint, Jump, Interact and Attack. They are
ordinary motion drafts built from five explicit source directions and the three controlled P10
mirrors. Each preset contains a small number of visible pose keys and, where useful, an explicit
deterministic helper channel. They do not use AI, a skeleton library, IK, skinning or hidden
random simulation, and they are starting points rather than a promise of finished art quality.

Walk and Sprint use different poses, frame counts and stored FPS values. Both are in-place; the
48 px/s and 88 px/s recommendations are metadata for the target game, not root translation.
A faster sprint remains the same editable basis with a deliberately increased stored FPS. Idle
uses body bob, Sprint combines bob and sway, Jump has a height curve, and Attack has a small
follow-through. Interact is intentionally neutral.

## Helpers, jump height and shadow

Preset semantics live in the draft and immutable release beside the normal tracks. The timeline
shows every helper, its target slot/property and amplitude. A helper can be disabled or converted
into normal per-frame keys. Conversion samples the same pure P09 sampler at every output index,
preserves the exact resulting pose for all eight directions and removes only the converted helper.

The Jump preset keeps three independent values:

- `ground_origin_px` remains the fixed world contact point;
- the visible body-height curve targets the root torso and therefore moves its descendants;
- `ground_shadow` is a non-anatomical, optional compositor layer fixed to the ground origin.

“Baked into frames” enables the height helper. “External game motion” retains the deterministic
curve as disabled metadata so the target game can apply it without receiving the same displacement
twice. The shadow has its own toggle and never becomes a humanoid slot. The bundled 80 px Jump is
rendered at every frame and direction in tests; no frame clips, its ground anchor is unchanged and
the sampled shadow pixels stay fixed at the anchor while the body rises. Any later edit that clips
is surfaced by the existing editor warning and by card-preview clipping metadata.

## Real card previews

Animation cards request frames from the saved draft only after an `IntersectionObserver` reports
that the card is in or near the viewport. The backend selects at most four stored sample indices,
runs the same sampler → direction resolver → pixel compositor path as the dummy editor, and encodes
those frames as PNG data URLs. The UI advances them only on hover, keyboard focus or explicit
activation. With reduced-motion preference it requests and displays one static frame.

The native preview cache is a 32 MiB byte-limited LRU keyed by canonical effective motion content,
renderer version, direction, sample and render options. Timestamps do not invalidate it; any
effective timing, key, helper, shadow or direction change does. Cached and editor frames are tested
as identical encoded pixels. No library-wide clock or permanent full render loop exists.

Before publication, the release dialog summarizes the pinned profile, timing, preset/export
semantics and all eight resolved directions. Missing coverage disables confirmation, while the
backend remains the authoritative release gate and creates a new immutable revision only after
validation.
