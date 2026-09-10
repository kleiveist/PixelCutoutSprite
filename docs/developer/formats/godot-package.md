<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Godot package integration

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](../acceptance/P37-cutout_altbasis_entfernen_willkommen.md).

PixelCutoutSprite Studio can derive a portable Godot package from a validated generic
PNG/JSON build. The compatibility gate currently covers exactly Godot **4.7.2**; no other
engine version is claimed without its own import run.

## Package contents

```text
character-package/
├── animation.json
├── sheet-0.png
├── sheet-1.png                 # when another atlas page is needed
├── sprite_frames.tres
├── character.tscn              # optional
├── GODOT_IMPORT.md
└── frames/                     # only when loose PNG output was requested
```

`animation.json` remains the engine-neutral authority. `sprite_frames.tres` adds one
`SpriteFrames` animation per `action_direction`, such as `walk_s` or `sprint_ne`. Every frame is
an `AtlasTexture` whose region equals the JSON rectangle. Animation speed and loop mode come from
the matching action; a version-1 frame has duration `1.0`, or one tick at that FPS.

The `.tres` file links its PNG pages with paths relative to itself. The optional scene links the
`.tres` in the same way. Copy or move the complete package directory anywhere below a Godot
project's `res://`; do not separate the resources from their PNG pages.

The native export job stores packages below the selected NPC or binding export root as
`godot-packages/build-<source-fingerprint>-scene` or
`godot-packages/build-<source-fingerprint>-resources`. A byte-identical, fully revalidated package
may be reused. A changed, missing, linked, socket, or otherwise non-regular package entry blocks
reuse. The generic `current.json` pointer changes only after the generic build and complete Godot
package have both validated. Cancellation can therefore leave safe, content-addressed orphan
artifacts for a later retry, but it never makes them current.

## Using the resources

Assign the generated library to an existing `AnimatedSprite2D`, then select the required
action/direction name:

```gdscript
var frames := load("res://characters/merchant/sprite_frames.tres") as SpriteFrames
$AnimatedSprite2D.sprite_frames = frames
$AnimatedSprite2D.play(&"walk_s")
```

Alternatively instantiate `character.tscn`. Its origin is the common exported ground point. The
sprite is not centered, applies the negative ground anchor as its offset, and uses Nearest texture
filtering. The scene intentionally has no script, autoplay, controls, collision, or skeleton.

Read each action's `jump_mode` and `root_motion_mode` in `animation.json`. When a mode is `baked`,
the matching displacement is already in the rendered frames and must not be applied a second time
by the game. An `external` mode leaves that displacement to game logic.

## Portability and verification

The exporter copies only the manifest and its declared PNG artifacts; arbitrary scripts or engine
resources found beside a generic build are not copied. Generated Godot text is rejected if it
contains an absolute/Vault path, `uid://` link, script assignment, embedded `ImageTexture`, or
packed image bytes.

The opt-in integration test builds scene and resources-only packages, copies them into a fresh
temporary project, removes both source outputs, isolates `HOME` and all XDG state, runs the Godot
importer, and checks names, counts, FPS, loop and one-shot modes, frame durations, exact atlas
rectangles, PNG resource paths, deterministic initial animation, identity transforms, ground
offset and the exact safe scene tree. Paths contain spaces and Unicode. It then moves the scene
package to a differently named nested directory, deletes every `.godot`/`.import` state, and
repeats the import and load checks:

```sh
PIXELCUTOUT_GODOT_RUNNER=/usr/bin/flatpak-spawn \
PIXELCUTOUT_GODOT_RUNNER_ARGS=--host \
PIXELCUTOUT_GODOT_BIN=/usr/bin/godot \
  cargo test --locked --manifest-path src-tauri/Cargo.toml \
  --test godot_headless -- --ignored
```

That exact host run reported `4.7.2.stable.arch_linux.ed1daf0bf` and passed one integration test
in 8.22 seconds on 5 September 2026. A directly available Godot binary can omit the two runner
variables. No compatibility claim is made for another Godot version or operating system here.

See the [generic JSON contract](json-contracts.md#export-builds-and-publication) and the
[Godot export specification](../features/pixelcutoutsprite-studio.md#17-godot-export-und-einbindung-in-spiele)
for the complete source and rendering rules.
