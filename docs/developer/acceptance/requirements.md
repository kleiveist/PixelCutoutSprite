<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio requirement ledger

This is the implementation ledger for the forty mandatory requirements in the product
specification. P00 establishes the rows; later phases replace `Planned` with component and test
evidence. A phase checkbox or file name alone is not evidence.

| ID | Requirement | Primary phases | Implementation evidence |
|---|---|---|---|
| RQ-01 | Pixel-art RPG animation focus | P07–P11 | P07: PNG-only RGBA8 compositor preserves hard pixel edges with nearest sampling and no mesh deformation; editors and presets follow |
| RQ-02 | Native desktop app; no mobile or web product | P01, P20 | P01: native Tauri 2 shell starts on Linux; only bundled WebView content and `core:default`; packaging matrix remains P20 |
| RQ-03 | Project dashboard after opening a vault | P03–P04 | P04: `App` routes an opened Vault directly to `ProjectDashboard`; app and dashboard tests cover the transition, empty state and cards |
| RQ-04 | Projects are folders | P03–P04 | P04: `ProjectService` creates a distinct safe folder and `.project/{project.json,labels.json,cache,transactions,backups,trash}`; filesystem integration tests cover reopen, rename, copy and trash |
| RQ-05 | User-defined labels | P04 | P04: `LabelService` persists workspace/project label catalogs with name/color/revision validation; deletion removes references while retaining projects |
| RQ-06 | Every structured filter uses a dropdown | P04–P06, P12, P15, P19 | P04 project filters and P06 animation direction/status/profile/sort filters use accessible single/multi dropdowns; later dashboards remain assigned to their phases |
| RQ-07 | User-defined areas | P05 | P05: `AreaService` creates freely named filesystem areas, lists cards per project and reopens them; `area_profiles` proves the `NPCs` round trip |
| RQ-08 | Area-level size and body profile | P02, P05 | P05: each area stores height, exact humanoid profile revision, eight-way model, default frame/ground origin and project-label IDs; size changes publish and pin a new snapshot |
| RQ-09 | Animations are actionable cards | P06 | P06: `AnimationDashboard` cards expose open, duplicate, release, archive, trash and timing/coverage state; DOM and Vault tests exercise the actions |
| RQ-10 | Cards show real motion previews | P06, P11 | P06 reserves a bounded preview surface; actual sampled compositor previews remain P11 |
| RQ-11 | New animation opens the dummy editor | P06, P08 | P06 creation persists a draft and routes directly to the selected template's dummy target; P08 supplies the full editor |
| RQ-12 | Released animation opens outfitting | P06, P13 | P06 routing sends a released revision to an explicit outfit/NPC chooser; P13 supplies the editor |
| RQ-13 | Dummy remains directly accessible | P06, P08 | P06 cards expose both a visible Dummy button and a right-click menu item; neither is the sole access path |
| RQ-14 | Grid and predefined body sizes | P05, P07–P08 | P05 supplies deterministic profiles; P07 renders their resolved integer geometry into an explicit frame canvas with pixel-centre sampling and clipping notices; the editable grid follows in P08 |
| RQ-15 | Three-part limbs and two-part torso | P05, P08 | P05: fixed profile contains upper arm/forearm/hand and thigh/shin/foot on both sides plus upper/lower torso, with parents and six mirror pairs |
| RQ-16 | Head and optional hair, no eye layer | P05, P08, P13 | P05: head is required, hair is the sole optional sixteenth slot, and the strict humanoid-v1 validator rejects any extra eye slot |
| RQ-17 | Recognizable dummy parts and handles | P08, P19 | Planned |
| RQ-18 | Frame count, FPS and frame surface | P06, P09 | P06 stores and validates frame count, FPS, loop, frame canvas and ground origin independently from inherited profile height; P09 adds timeline retiming |
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
| RQ-32 | Switch Animation and NPC views in context | P06, P15 | P06 provides area-context tabs/navigation and refuses contextless entry; P15 replaces the explicit NPC interim with its dashboard |
| RQ-33 | User-selected local vault | P03 | P03: native directory dialog, inspect/confirm/initialize/open/close/recent commands and temporary-filesystem integration tests |
| RQ-34 | `.pixelforge-studio` stores global data only | P02–P03, P18 | P03: `VaultLayout::global_path_allows` and integration tests restrict global data to manifest/labels/UI/runtime; journals are project-scoped; recovery audit remains P18 |
| RQ-35 | No SQL or SQLite | P02–P03, P22 | P03: production `JsonStore`, JSON journal/index and dependency manifests contain no database runtime; final audit remains P22 |
| RQ-36 | Project/area/NPC/animation filesystem hierarchy | P03, P15–P16 | P03: filesystem ownership resolver establishes `.project`, `.area`, character and derived-export scopes; concrete NPC/export trees follow P15–P16 |
| RQ-37 | Compact PNG sheets; loose frames optional | P16 | Planned |
| RQ-38 | Generic integration and Godot output | P16–P17 | Planned |
| RQ-39 | No required manual bone/skeleton setup | P05, P08, P22 | P05: all parent links, pivots, base positions, view transforms and layer orders are generated; no rig-creation input exists |
| RQ-40 | Complete plan and executable phase prompts | P00–P22 | P00–P07 implemented in order and gated; P08 is next |
