<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio requirement ledger

This is the implementation ledger for the forty mandatory requirements in the product
specification. P00 establishes the rows; later phases replace `Planned` with component and test
evidence. A phase checkbox or file name alone is not evidence.

| ID | Requirement | Primary phases | Implementation evidence |
|---|---|---|---|
| RQ-01 | Pixel-art RPG animation focus | P07–P11 | Planned |
| RQ-02 | Native desktop app; no mobile or web product | P01, P20 | P01: native Tauri 2 shell starts on Linux; only bundled WebView content and `core:default`; packaging matrix remains P20 |
| RQ-03 | Project dashboard after opening a vault | P03–P04 | P03: successful native vault open routes to the Projects workspace; project cards follow in P04 |
| RQ-04 | Projects are folders | P03–P04 | P03: `VaultLayout` reserves project `.project` ownership and safe object folders; CRUD follows in P04 |
| RQ-05 | User-defined labels | P04 | Planned |
| RQ-06 | Every structured filter uses a dropdown | P04–P06, P12, P15, P19 | Planned |
| RQ-07 | User-defined areas | P05 | Planned |
| RQ-08 | Area-level size and body profile | P02, P05 | P02: `Area` pins a profile revision, 16–512 px height, eight-way model, frame size and ground origin; concrete humanoid generator remains P05 |
| RQ-09 | Animations are actionable cards | P06 | Planned |
| RQ-10 | Cards show real motion previews | P06, P11 | Planned |
| RQ-11 | New animation opens the dummy editor | P06, P08 | Planned |
| RQ-12 | Released animation opens outfitting | P06, P13 | Planned |
| RQ-13 | Dummy remains directly accessible | P06, P08 | Planned |
| RQ-14 | Grid and predefined body sizes | P05, P07–P08 | Planned |
| RQ-15 | Three-part limbs and two-part torso | P05, P08 | Planned |
| RQ-16 | Head and optional hair, no eye layer | P05, P08, P13 | Planned |
| RQ-17 | Recognizable dummy parts and handles | P08, P19 | Planned |
| RQ-18 | Frame count, FPS and frame surface | P06, P09 | Planned |
| RQ-19 | Sparse keyframes generate samples | P09, P11 | Planned |
| RQ-20 | Eight directions with controlled reuse | P10 | Planned |
| RQ-21 | Walk, sprint, jump and more motions | P11 | Planned |
| RQ-22 | Inventory for source sprites | P12 | Planned |
| RQ-23 | Metadata-based slot suggestions | P12–P13 | Planned |
| RQ-24 | Inventory, Dress and Fine-tune modes | P13 | Planned |
| RQ-25 | Adjustable dummy outline guide | P13 | Planned |
| RQ-26 | Armour, accessories and equipment | P14 | Planned |
| RQ-27 | Equipment visibility/follow/own motion | P14 | Planned |
| RQ-28 | Motion and fitting errors stay distinct | P13, P15 | Planned |
| RQ-29 | Running preview and frame stepping | P09, P13 | Planned |
| RQ-30 | Name and label an outfitted NPC | P13, P15 | Planned |
| RQ-31 | Multiple motions belong to one NPC | P15 | Planned |
| RQ-32 | Switch Animation and NPC views in context | P06, P15 | Planned |
| RQ-33 | User-selected local vault | P03 | P03: native directory dialog, inspect/confirm/initialize/open/close/recent commands and temporary-filesystem integration tests |
| RQ-34 | `.pixelforge-studio` stores global data only | P02–P03, P18 | P03: `VaultLayout::global_path_allows` and integration tests restrict global data to manifest/labels/UI/runtime; journals are project-scoped; recovery audit remains P18 |
| RQ-35 | No SQL or SQLite | P02–P03, P22 | P03: production `JsonStore`, JSON journal/index and dependency manifests contain no database runtime; final audit remains P22 |
| RQ-36 | Project/area/NPC/animation filesystem hierarchy | P03, P15–P16 | P03: filesystem ownership resolver establishes `.project`, `.area`, character and derived-export scopes; concrete NPC/export trees follow P15–P16 |
| RQ-37 | Compact PNG sheets; loose frames optional | P16 | Planned |
| RQ-38 | Generic integration and Godot output | P16–P17 | Planned |
| RQ-39 | No required manual bone/skeleton setup | P05, P08, P22 | Planned |
| RQ-40 | Complete plan and executable phase prompts | P00–P22 | P00–P03 implemented and gated; P04 is next |
