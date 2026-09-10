<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Timeline and deterministic sampling

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md).

P09 turns the single-pose editor into a complete data-backed animation workspace. The timeline
shows the selected direction's typed tracks and keyframes, supports scrubbing, playback, frame
steps, range selection, copy/paste, duplication, movement, deletion and interpolation changes.
Track rows can be collapsed and the horizontally scrollable ruler can be zoomed for longer clips.
Auto-key is explicit: without it, an edit changes only a key that already exists at the current
frame; the separate pose-key action intentionally creates the selected slots' transform keys.

Frame count, stored FPS, preview speed, frame surface and profile height remain independent.
Changing preview speed never mutates the draft. A frame-count change first presents the keys that
would be clipped and requires explicit confirmation; retained keys can be kept in place or
distributed across the new duration. A looping clip exposes exactly indices `0..N-1`, while the
sampler may interpolate from its last key toward the conceptual start at `N` without emitting a
duplicate closing frame.

The Rust `AnimationSampler` is a pure function of draft data, direction and sample index. It
supports hold, linear and ease-in-out interpolation, uses a stable shortest-path rule for angles,
and treats visibility, variant and layer changes as discrete values. Zero, one and multiple key
cases, loop boundaries, mirroring metadata, retiming and repeated out-of-order evaluation are
covered by deterministic tests. The same sampled pose is handed directly to the P07 compositor;
the native preview command returns both that exact pose and its PNG so later exporters can share
the same path.

The editor can overlay the adjacent sampled frames as translucent onion skins. Its world-space
selection geometry now uses the same profile rotations and parent transforms as the compositor;
moving a selected parent and child does not apply the delta twice, and screen-space dragging below
a rotated parent is converted back into the correct local delta. Middle-button panning, command-
wheel zoom, a rotation handle and numeric snapping complete the direct manipulation tools.

Undo and Redo store the whole motion draft, so timeline and viewport edits travel together.
Manual and two-second automatic saves are serialized against the persisted CAS revision. If an
edit arrives while an older write is in flight, the older response cannot mark it saved and a
newer write is queued. Dirty state spans all directions, failed writes stay visible, navigation
and window close warn before abandoning edits, and the backend rejects tracks that do not belong
to the draft's pinned profile.
