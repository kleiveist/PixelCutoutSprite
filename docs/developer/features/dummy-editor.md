<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Reusable dummy motion editor

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md).

P08 replaces the dummy placeholder with the real motion-template editor. Opening a card loads its
mutable draft together with the exact immutable profile revision pinned by that draft, even when
the area's current profile has since changed. The route keeps project, area and template context
in the desktop shell and becomes read-only when the Vault session does.

The centre viewport shows the frame boundary, pixel grid, ground line and the PNG produced by the
shared Rust `PixelCompositor`. Sixteen labelled, colour-coded selection outlines, pivot markers
and focus rings form a separate HTML overlay, so editor aids cannot enter the RGBA output. The
frame dimensions and ground origin come from the draft rather than being confused with profile
height. Zoom, pan and a 1:1 reset preserve nearest-neighbour presentation.

Every slot is selectable from both the layer list and viewport. Ctrl/Cmd adds to the selection;
pointer drag and numeric X/Y inputs edit offsets, while the inspector edits rotation, visibility
and the local editor lock. Pixel snapping and optional 15-degree angle snapping are explicit.
The overlay composes the same parent/profile/motion hierarchy as the compositor, so attached child
handles follow a moved or rotated parent without a rig-construction step.

Each direction owns an independent command history. A completed drag commits exactly one command;
Undo and Redo restore complete poses. The selected direction's frame-zero pose is converted to
sparse typed motion tracks, preserving tracks for every other direction and non-pose properties.
Manual save and the two-second autosave call the P03/P06 CAS-backed draft service. Dirty, saving,
saved and failure states remain visible, and a failed write does not discard the edited pose.
P09 extends this selected-pose foundation to a complete sampled timeline.

Native preview commands reload the pinned profile from the Vault, reject mismatched identities,
render through `render_dummy`, and return a decodable PNG data URL plus clipping notices. Tests
cover parent attachment, one-step drag history, multi-selection, snapping, helper separation,
PNG decoding, CAS persistence and reopening after the area's active profile changes.
