<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Deterministic pixel compositor

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md).

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

P19 retains the same raster semantics while sharing immutable `RgbaImage` storage between prepared
frames instead of cloning each source buffer. A representative 128 × 128 request with the 16 base
parts and four equipment parts was rendered cold 360 times in a Rust release test. On the named
Linux reference host it measured 0.038 ms p50, 0.045 ms p95 and 0.121 ms maximum; a warmed lookup of
the identical cached RGBA frame measured 0.000 ms p50/p95/maximum when rounded to three decimal
places. These are
hardware-specific CPU timings, not an inferred UI-FPS or cross-platform guarantee. Full setup,
method and export measurements are in the
[P19 desktop acceptance](../acceptance/desktop-usability-and-performance.md).

The dummy and outfit viewports separately map source pixels to whole physical display pixels. DPR 2
was exercised in the native Linux WebView; fractional DPR 1.25 is covered only by a geometry unit
test and is not claimed as a native run. Existing full-frame RGBA Goldens remain the semantic gate,
and no GPU or acceleration dependency was introduced. The `image` dependency disables default
codecs and enables PNG only, preserving the product's PNG/JSON boundary.
