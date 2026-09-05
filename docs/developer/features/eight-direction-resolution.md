<!-- AUTO-GENERATED:backlink START -->
[← Back](features.md)
<!-- AUTO-GENERATED:backlink END -->
# Eight-direction resolution

P10 makes `n`, `ne`, `e`, `se`, `s`, `sw`, `w` and `nw` explicit data rather than presentation
aliases. A direction definition is editable, horizontally derived or deliberately missing. New
motions start with five sources (`n/ne/e/se/s`) and three controlled mirrors (`sw/w/nw`), while
all eight sources may be made independent. Front and back can never be horizontal mirrors, mirror
cycles and non-opposite sources fail validation, and an incomplete definition blocks release
before an immutable revision is written.

The dummy workspace exposes all eight modes, their origins and release gaps through structured
dropdowns. Derived directions remain playable and inspectable but cannot acquire ignored local
keys. “Detach as explicit” asks the native direction adapter to copy and anatomically mirror the
source tracks as one whole-draft history operation; the normal serialized autosave then persists
the result. A draft that changes while this request is running is not overwritten.

`DirectionResolver` receives the P09 sampler's resolved source pose and applies three independent
rules: anatomical pose mirroring, the target profile view and the target view's base layer order.
Left/right profile pairs swap identities, horizontal offsets and rotations change sign, and
visibility, sprite variant and discrete layer delta follow the corresponding anatomical part.
Hidden parts remain present with `visible=false`; an absent part is an error. The compositor
preview now consumes this resolved pose, so its source direction, mirror parity, PNG and editor
handles agree.

Per-asset mirroring is a separate `AssetResolver` decision. An exact target-direction asset wins.
A source bitmap is eligible only for the same target slot and variant when both its metadata and
an explicit slot/direction approval permit mirroring; wrong-hand, incompatible-profile,
ambiguous, missing and non-mirrorable assets are blocking results. Whole-frame mirroring is a
third opt-in API and is never invoked by either resolver.

Golden tests take an asymmetric one-sided glove through all eight targets and the shared pixel
compositor. Further tests cover five-source and eight-source setups, double mirror invariants,
front/back protection, cycles, anatomical swapping, stable target layers, hidden versus missing,
asset fallback approvals, atomic detachment and the persistent release gate.
