<!-- AUTO-GENERATED:backlink START -->

[← Back](developer.md)
<!-- AUTO-GENERATED:backlink END -->

# PixelPromptStudio integration architecture

## Runtime boundary

PixelPromptStudio is an embedded React module in the existing Tauri window. `StudioMode` sits
above the established Cutout route; the two state machines do not share route values:

```text
App
├── AppHeader
├── StudioMode: cutout
│   └── WorkspaceRoute + vault/project/area/editor selections
└── StudioMode: prompt
    └── PromptView: dashboard | profiles | wizard | output | settings
```

Only the active studio subtree is mounted. The host keeps the Cutout route, Vault, project, Area
and editor-selection identifiers outside that conditional subtree, while the Prompt providers
rehydrate their validated settings, profiles and Draft when mounted. The last `PromptView` is host
state as well. This preserves both navigation contexts without retaining hidden editor trees or
paying the Prompt initialization cost during a Cutout-only launch.

`frontend/src/prompt-studio/` is the only imported PixelForge-derived namespace. Its
`PROVENANCE.md` records the upstream revisions and MIT notice. A static import-boundary test
rejects application-shell and Animation Studio imports. Prompt barrels deliberately export only
prompt schemas, domains, and services.

## Navigation and provider graph

The integrated `PromptNavigationAdapter` is an external-store adapter over React host state. It
does not read or mutate `window.history`, URLs, or Cutout routes.

```text
PromptGeneratorRoot
└── SettingsProvider
    └── ProfileLibraryProvider
        └── NavigationProvider
            └── WizardSessionProvider
                ├── PromptStudioNavigation
                └── PromptStudioShell
```

`PromptGeneratorRoot` reports Wizard dirtiness to `App`. Leaving Cutout reuses the established
recovery, import, export, release, NPC mutation and editor-navigation guards. Leaving Prompt is
allowed only after the Wizard is clean and the native storage queue has flushed successfully.

## Persistence adapters

The prompt feature code retains its synchronous validated V2 adapter contract. Production wraps
that contract in a memory mirror backed by an ordered asynchronous Tauri write queue:

```text
Prompt providers
  → V2 Zod adapter / in-memory mirror
  → ordered flush queue
  → Tauri commands
  → PromptWorkspaceStorage
  → appDataDir/prompt-studio/*.json
```

The browser adapter remains available only when `isTauri()` is false. Production initialization
hydrates the mirror before rendering the app. Mutations enter the queue only after full Zod
validation; `flushPromptStorage` surfaces delayed native failures before a studio switch.

Native commands are registered in `src-tauri/src/lib.rs`:

| Command                  | Boundary                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `read_prompt_workspace`  | Read and recover the four fixed app-data namespaces                      |
| `write_prompt_workspace` | Validate kind/shape/size and atomically replace one namespace            |
| `remove_prompt_draft`    | Remove draft plus interrupted-write artifacts                            |
| `read_prompt_package`    | Read a bounded, regular UTF-8 JSON file selected by the user             |
| `save_prompt_output`     | Atomically save bounded Markdown or parsed JSON to the selected path     |
| `handoff_prompt_to_area` | Validate the DTO and writable Area context, then retain a JSON reference |

Writes use a same-directory `.pending` file, flush its bytes, validate the staged representation,
and rename it into place. The Windows replacement fallback preserves `.previous`; startup
recovery publishes a valid pending file or restores a valid previous file when the pending bytes
are damaged. The fixed app-data root, selected import file, direct output parent and output target
are checked for symlinks or unexpected file types before use.

## Cutout handoff

The prompt UI knows only `PromptHandoff` and availability, not Vault or editor services. `App`
derives availability from its current Vault/Area state. The Rust command then independently
requires a known read-write session, resolves the Area by stable ID, rejects unsupported category
or malformed timestamp/size fields, and writes:

```text
<area-folder>/prompt-references/prompt--<uuid>.json
```

The schema-version-1 DTO contains category, main/negative/technical text, profile references and
creation time. It is intentionally outside managed `.area` domain JSON, so no existing Area
schema or Vault index is silently migrated.

## Styling and layout

PixelForge global `:root`, `html`, `body` and `#root` rules are not imported. Prompt design tokens
are rooted at `.prompt-generator-root`, including the dark-theme override. The module owns an
internal scrolling viewport; the host `.prompt-workspace` spans both Cutout grid columns. A
boundary test and Playwright measurements cover the single header, 196 × 46 px buttons, green
active accent, focus state, full-width prompt layout, internal overflow and restored navigation.

## Production bundle boundary

Vite groups Prompt domain, features and store into one deliberate production chunk. Do not add a
`maxSize` split to this group without repeating the native WebKitGTK custom-protocol gate. Such a
forced split previously produced a cyclic schema/domain module graph: Chromium happened to
initialize its enum exports first, while WebKitGTK passed an uninitialized export to Zod and
stopped at `Object.values`. The accepted build trades a 575.08 kB uncompressed (154.24 kB gzip)
Prompt chunk for deterministic cross-engine initialization. React, form/schema dependencies and
other vendors remain separate cacheable chunks.

## Verification surface

- Ported prompt tests cover schemas, all nine categories, profile resolution/library, Wizard
  routing/lifecycle/recovery, storage/migration, prompt modules/output, settings data and editors.
- Host tests cover header semantics, state restoration, failed native flush and handoff
  availability/DTO shape.
- Rust unit tests cover workspace validation, atomic writes, interrupted-write recovery, symlink
  refusal, import corruption, output formats and handoff validation; the composition test covers
  command registration.
- Five Playwright system scenarios cover the shared shell, navigation/style isolation, a real
  PixelForge V2 transfer, profile-backed Wizard/output/export/reload and no-Vault/read-only/
  writable Handoff behavior at 1440 × 900.
- A visible Tauri/WebKitGTK custom-protocol run covers both studios, native draft publication and
  process-restart recovery. The final Linux DEB repeats the visible offline path and the bounded
  installer-payload smoke.

Exact commands, package digest and host limits are recorded in the
[P27 integration acceptance](acceptance/prompt-studio-integration.md).
