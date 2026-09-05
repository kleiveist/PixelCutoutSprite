<!-- AUTO-GENERATED:backlink START -->
[← Back](features.md)
<!-- AUTO-GENERATED:backlink END -->
# Deterministic pixel compositor

P07 introduces the single Rust `PixelCompositor` used by later editor previews and exports. Its
input is already resolved for one direction: a frame canvas and ground origin plus ordered cutout
parts containing the profile placement, sampled motion, NPC fitting, binding-local override,
pivot, visibility, layer and RGBA8 bitmap. Editor grids, handles and other overlays are not part
of this contract and therefore cannot leak into exported pixels.

Transforms are composed in double precision and rounded only at final sampling. A child receives
its parent's world transform before its own profile and motion transforms. The image-local fitting
and binding override then apply, followed by translation around the declared bitmap pivot. Pixel
centres use half-integer coordinates; inverse nearest-neighbour sampling selects the containing
source texel with `floor`, including for negative coordinates. No antialiasing or mesh deformation
is performed.

Unrotated parts at integer offsets use a direct clipped blit. Other transforms inverse-sample only
the transformed integer bounding box. Source-over blending uses straight RGBA input with explicit
integer rounding, opaque and transparent fast paths, and stable layer/index ordering. Bitmap
mirroring reverses source columns exactly. Any transformed bounds outside the canvas produce a
per-slot clipping notice without changing the clipping rule.

The compositor rejects zero-sized frames, empty visible bitmaps, duplicate or orphan slots,
parent cycles, and non-finite transforms or pivots. Source-controlled full-frame RGBA golden
assertions cover layer overlap, half alpha, hierarchy plus fitting, a non-zero rotation pivot,
negative coordinates, clipping, exact mirroring and double mirroring. Repeated renders compare
byte-for-byte.

The focused debug-build measurement rendered two simple 128×128 reference frames in about
0.33 ms on the Linux development host on 5 September 2026. This is diagnostic evidence for that
fixture only, not a general performance promise; P19 performs the representative workload audit.
The `image` dependency disables default codecs and enables PNG only, preserving the product's
PNG/JSON boundary.
