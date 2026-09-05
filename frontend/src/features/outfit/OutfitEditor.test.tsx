import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetClient } from "../../api/asset-client";
import type {
  OutfitClient,
  OutfitEditorContext,
  OutfitLaunchContext,
  OutfitPreviewFrame,
  SavedNpc,
} from "../../api/outfit-client";
import type { Direction, OutfitFitting, SlotRef } from "../../domain";
import type { AssetImportInspection, AssetInventory } from "../../domain/inventory";
import { OutfitEditor } from "./OutfitEditor";

const ids = {
  area: "22222222-2222-4222-8222-222222222222",
  profile: "33333333-3333-4333-8333-333333333333",
  template: "44444444-4444-4444-8444-444444444444",
  asset: "55555555-5555-4555-8555-555555555555",
  character: "66666666-6666-4666-8666-666666666666",
  appearance: "77777777-7777-4777-8777-777777777777",
  draft: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  importedAsset: "99999999-9999-4999-8999-999999999999",
};

const allDirections: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function assetRef(direction: Direction): SlotRef {
  const suffix = String(allDirections.indexOf(direction) + 1).padStart(12, "0");
  return {
    asset_id: direction === "s" ? ids.asset : `00000000-0000-4000-8000-${suffix}`,
    revision: 1,
    slot_id: "hand_l",
  };
}

function fitting(direction: Direction = "s"): OutfitFitting {
  return {
    slot_id: "hand_l",
    direction,
    asset: assetRef(direction),
    pivot_px: [1, 1],
    variant_fittings: [],
    transform: { offset_px: [0, 0], rotation_deg: 0 },
    visible: true,
    layer_delta: 0,
  };
}

function editorContext(withFitting = false): OutfitEditorContext {
  const fittings = withFitting ? [fitting()] : [];
  return {
    draft: {
      schema_version: 1,
      kind: "outfit_draft",
      id: ids.draft,
      revision: 1,
      area_id: ids.area,
      template_ref: { id: ids.template, revision: 1 },
      profile_ref: { id: ids.profile, revision: 1 },
      character_id: null,
      appearance_id: null,
      base_character_revision: null,
      base_character_sha256: null,
      base_appearance_revision: null,
      base_appearance_sha256: null,
      base_binding_ref: null,
      base_binding_sha256: null,
      status: "in_progress",
      selected_assets: withFitting ? [assetRef("s")] : [],
      asset_fallback_approvals: [],
      fittings,
      local_overrides: [],
      created_at: "2026-09-05T09:00:00Z",
      updated_at: "2026-09-05T09:00:00Z",
    },
    template: {
      schema_version: 1,
      kind: "motion_template",
      id: ids.template,
      revision: 2,
      area_id: ids.area,
      name: "Walk",
      action_key: "walk",
      status: "active",
      label_ids: [],
      draft_revision: 2,
      draft_base_release: 1,
      released_revisions: [1],
      created_at: "2026-09-05T09:00:00Z",
      updated_at: "2026-09-05T09:00:00Z",
    },
    motion: {
      schema_version: 1,
      kind: "motion_revision",
      template_id: ids.template,
      revision: 1,
      profile_ref: { id: ids.profile, revision: 1 },
      frame_size_px: [4, 4],
      ground_origin_px: [2, 3],
      frame_count: 2,
      fps: 8,
      loop_mode: "loop",
      directions: allDirections.map((direction) => ({ direction, mode: "explicit", source: null })),
      tracks: [],
      published_at: "2026-09-05T09:00:00Z",
    },
    profile: {
      schema_version: 1,
      kind: "profile_revision",
      profile_id: ids.profile,
      revision: 1,
      area_id: ids.area,
      name: "Humanoid test",
      reference_height_px: 80,
      slots: [
        {
          id: "hand_l",
          parent_id: null,
          optional: false,
          size_px: [2, 2],
          pivot_px: [1, 1],
          base_transform: { offset_px: [0, -1], rotation_deg: 0 },
        },
      ],
      views: [],
      mirror_pairs: [],
      published_at: "2026-09-05T09:00:00Z",
    },
    inventory: allDirections.map((direction) => ({
      asset: assetRef(direction),
      name: `Hand ${direction.toUpperCase()}`,
      asset_kind: "body",
      direction,
      variant: "base",
      assignable: true,
      sprite_mirroring_allowed: true,
      pivot_px: [1, 1],
      image_size_px: [2, 2],
      source_file: `.area/assets/${direction}/source.png`,
    })),
    available_labels: [
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", name: "Villagers", color: "#ffcc66" },
    ],
    affected_binding_count: withFitting ? 1 : 0,
    missing_required_slots: [],
    save_state: "saved",
  };
}

function launchContext(): OutfitLaunchContext {
  const context = editorContext();
  return {
    template: context.template,
    motion: context.motion,
    profile: context.profile,
    inventory: context.inventory,
    available_labels: context.available_labels,
    compatible_characters: [
      { id: ids.character, name: "Villager 01", appearance_id: ids.appearance },
    ],
    resumable_drafts: [
      { id: ids.draft, revision: 3, character_id: null, updated_at: "2026-09-05T09:11:00Z" },
    ],
  };
}

function preview(frame = 0): OutfitPreviewFrame {
  return {
    direction: "s",
    frame_index: frame,
    width: 4,
    height: 4,
    rgba: Array.from({ length: 64 }, () => 0),
    clipping: [],
    guides: [
      {
        slot_id: "hand_l",
        dummy_transform: [1, 0, 0, 1, 2, 2],
        image_transform: [1, 0, 0, 1, 2, 2],
        slot_size_px: [2, 2],
        slot_pivot_px: [1, 1],
      },
    ],
    guides_included: false,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const importInspection: AssetImportInspection = {
  area_id: ids.area,
  profile_ref: { id: ids.profile, revision: 1 },
  source: { kind: "loose_pngs", paths: ["/tmp/hand_l__s__imported.png"] },
  slots: [{ id: "hand_l", size_px: [2, 2], pivot_px: [1, 1] }],
  entries: [
    {
      entry_index: 0,
      name: "Imported hand",
      source_name: "hand_l__s__imported.png",
      asset_kind: "body",
      declared_slot_id: null,
      declared_direction: null,
      suggested_slot_id: "hand_l",
      suggested_direction: "s",
      variant: "base",
      image_size_px: [2, 2],
      effective_size_px: [2, 2],
      pivot_px: [1, 1],
      content_hash: "e".repeat(64),
      size_warning: null,
      size_options: ["keep_original"],
      duplicate_asset_id: null,
    },
  ],
};

const importedInventory: AssetInventory = {
  area_id: ids.area,
  profile_ref: { id: ids.profile, revision: 1 },
  writable: true,
  labels: [],
  items: [
    {
      id: ids.importedAsset,
      revision: 1,
      name: "Imported hand",
      original_name: "hand_l__s__imported.png",
      asset_kind: "body",
      label_ids: [],
      released_revision: 1,
      profile_ref: { id: ids.profile, revision: 1 },
      slot_id: "hand_l",
      direction: "s",
      variant: "base",
      image_size_px: [2, 2],
      pivot_px: [1, 1],
      content_hash: "e".repeat(64),
      archived: false,
      usage: [],
      thumbnail_url: "data:image/png;base64,cG5n",
    },
  ],
};

function mockAssetsClient(overrides: Partial<AssetClient> = {}): AssetClient {
  return {
    chooseSources: vi.fn(async () => ["/tmp/hand_l__s__imported.png"]),
    listenForDrops: vi.fn(async () => () => undefined),
    inventory: vi.fn(async () => importedInventory),
    inspect: vi.fn(async () => importInspection),
    import: vi.fn(async () => importedInventory),
    archive: vi.fn(async () => importedInventory),
    ...overrides,
  };
}

function mockClient(context = editorContext()): OutfitClient {
  return {
    launch: vi.fn().mockResolvedValue(launchContext()),
    start: vi.fn().mockResolvedValue(context),
    resume: vi.fn().mockResolvedValue(context),
    autosave: vi.fn(async (_session, _area, _draft, revision, edits) => ({
      ...context,
      draft: { ...context.draft, ...edits, revision: revision + 1 },
    })),
    autoAssign: vi.fn(async (_session, _area, _draft, revision, assets) => ({
      ...context,
      draft: {
        ...context.draft,
        revision: revision + 1,
        fittings: assets.map((asset: SlotRef) => fittingForAsset(asset, context)),
      },
    })),
    preview: vi.fn(async (_session, _area, _draft, _direction, frame) => preview(frame)),
    saveAsNpc: vi.fn().mockResolvedValue({
      character: { name: "Mara" },
      binding: { action_key: "walk", template_ref: { id: ids.template, revision: 1 } },
      character_folder: "game/npcs/mara--1234",
    } as SavedNpc),
    applyToNpc: vi.fn().mockResolvedValue({
      character: { name: "Villager 01" },
      binding: { action_key: "walk", template_ref: { id: ids.template, revision: 1 } },
      character_folder: "game/npcs/villager--1234",
    } as SavedNpc),
  };
}

function fittingForAsset(asset: SlotRef, context: OutfitEditorContext): OutfitFitting {
  const option = context.inventory.find(
    (item) => item.asset.asset_id === asset.asset_id && item.asset.revision === asset.revision,
  )!;
  return { ...fitting(option.direction), asset: { ...asset }, pivot_px: [...option.pivot_px] };
}

async function openNew(
  client: OutfitClient,
  options: {
    assetsClient?: AssetClient;
    autosaveDelayMs?: number;
    onDirtyChange?: (dirty: boolean) => void;
  } = {},
): Promise<void> {
  render(
    <OutfitEditor
      sessionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      areaId={ids.area}
      templateRef={{ id: ids.template, revision: 1 }}
      client={client}
      assetsClient={options.assetsClient}
      autosaveDelayMs={options.autosaveDelayMs ?? 1}
      onDirtyChange={options.onDirtyChange}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /New NPC outfit/i }));
  await screen.findByRole("tab", { name: "Dress" });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
        }),
        putImageData: vi.fn(),
      }) as never,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OutfitEditor", () => {
  it("requires an explicit new or existing NPC choice and offers persisted drafts", async () => {
    const client = mockClient();
    render(
      <OutfitEditor
        sessionId="session"
        areaId={ids.area}
        templateRef={{ id: ids.template, revision: 1 }}
        client={client}
      />,
    );
    expect(await screen.findByText(/never guesses/i)).toBeInTheDocument();
    expect(client.start).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Draft r3/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Equip Villager 01/i }));
    await waitFor(() =>
      expect(client.start).toHaveBeenCalledWith(
        "session",
        ids.area,
        { id: ids.template, revision: 1 },
        { kind: "existing_npc", character_id: ids.character },
      ),
    );
  });

  it("keeps a read-only vault inspectable without exposing outfit writes", async () => {
    const client = mockClient();
    render(
      <OutfitEditor
        sessionId="session"
        areaId={ids.area}
        templateRef={{ id: ids.template, revision: 1 }}
        client={client}
        writable={false}
      />,
    );
    expect(await screen.findByText(/vault is read-only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New NPC outfit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Equip Villager 01/i })).toBeDisabled();
    const resume = screen.getByRole("button", { name: /Draft r3/i });
    expect(resume).toBeEnabled();
    fireEvent.click(resume);

    expect(await screen.findByText(/Read-only inspection/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Outfit editing controls" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save as NPC/i })).toBeDisabled();
    expect(client.autosave).not.toHaveBeenCalled();
  });

  it("keeps inventory selection across all three visible editor modes", async () => {
    const client = mockClient();
    await openNew(client);
    for (const tab of ["Inventory", "Dress", "Fine tune"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    const hand = screen.getByRole("checkbox", { name: "Select Hand S (S)" });
    fireEvent.click(hand);
    fireEvent.click(screen.getByRole("tab", { name: "Dress" }));
    expect(screen.getByRole("checkbox", { name: "Select Hand S (S)" })).toBeChecked();
    expect(screen.getByText(/Missing required parts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Auto-assign selected/i }));
    await waitFor(() => expect(client.autoAssign).toHaveBeenCalledTimes(1));
  });

  it("keeps a pinned archived image named and fine-tunable without offering a new assignment", async () => {
    const base = editorContext(true);
    const context: OutfitEditorContext = {
      ...base,
      inventory: base.inventory.map((item) =>
        item.direction === "s" ? { ...item, assignable: false } : item,
      ),
    };
    const client = mockClient(context);
    await openNew(client);

    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    expect(screen.getByRole("checkbox", { name: "Select Hand S (S)" })).toBeDisabled();
    expect(screen.getByText(/pinned \(not assignable\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Fine tune" }));
    const image = screen.getByRole("combobox", { name: "Image" });
    expect(image).toBeEnabled();
    expect(image).toHaveValue(`${ids.asset}:1:hand_l`);
    expect(screen.getByRole("option", { name: /Hand S · r1 · pinned/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Local offset X" }), {
      target: { value: "2" },
    });
    await waitFor(() => expect(client.autosave).toHaveBeenCalled());
  });

  it("fine-tunes shared and binding-local coordinates with undo, redo, autosave, and frame steps", async () => {
    const client = mockClient();
    await openNew(client);
    fireEvent.click(screen.getByRole("tab", { name: "Fine tune" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Image" }), {
      target: { value: `${ids.asset}:1:hand_l` },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Local offset X" }), {
      target: { value: "3" },
    });
    await waitFor(() => expect(client.autosave).toHaveBeenCalled());
    expect(
      vi.mocked(client.autosave).mock.calls.at(-1)?.[4].fittings[0].transform.offset_px,
    ).toEqual([3, 0]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("spinbutton", { name: "Local offset X" })).toHaveValue(0);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByRole("spinbutton", { name: "Local offset X" })).toHaveValue(3);

    fireEvent.change(screen.getByRole("combobox", { name: "Edit scope" }), {
      target: { value: "binding" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Local offset X" }), {
      target: { value: "4" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(client.autosave).mock.calls.at(-1)?.[4].local_overrides[0].transform.offset_px,
      ).toEqual([4, 0]),
    );

    expect(screen.getByLabelText(/Dummy outline \(preview only\)/)).toHaveAttribute(
      "data-exported",
      "false",
    );
    expect(screen.getByLabelText(/Selection handle \(preview only\)/)).toHaveAttribute(
      "data-exported",
      "false",
    );
    expect(screen.getByLabelText(/Local axes and pivot \(preview only\)/)).toHaveAttribute(
      "data-exported",
      "false",
    );
    const outline = screen.getByRole("slider", { name: /Dummy outline/i });
    expect(outline).toHaveValue("0.22");
    fireEvent.change(outline, { target: { value: "0.6" } });
    expect(outline).toHaveValue("0.6");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(screen.getByText("Frame 2 / 2")).toBeInTheDocument();
  });

  it("maps and fine-tunes every sprite variant named by the released motion", async () => {
    const base = editorContext(true);
    const context: OutfitEditorContext = {
      ...base,
      motion: {
        ...base.motion,
        tracks: [
          {
            direction: "s",
            slot_id: "hand_l",
            property: "sprite_variant",
            interpolation: "hold",
            keys: [
              { frame: 0, value: "base" },
              { frame: 1, value: "open" },
            ],
          },
        ],
      },
      inventory: [
        ...base.inventory,
        {
          asset: { asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" },
          name: "Hand Open",
          asset_kind: "body",
          direction: "s",
          variant: "open",
          assignable: true,
          sprite_mirroring_allowed: true,
          pivot_px: [2, 1],
          image_size_px: [3, 2],
          source_file: ".area/assets/open/source.png",
        },
      ],
    };
    const client = mockClient(context);
    await openNew(client);
    fireEvent.click(screen.getByRole("tab", { name: "Fine tune" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Sprite variant" }), {
      target: { value: "open" },
    });
    expect(screen.getByText(/Sprite variant.*open.*has no image/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Image" }), {
      target: { value: `${ids.importedAsset}:1:hand_l` },
    });
    await waitFor(() =>
      expect(
        vi.mocked(client.autosave).mock.calls.at(-1)?.[4].fittings[0].variant_fittings,
      ).toEqual([
        {
          variant: "open",
          asset: { asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" },
          pivot_px: [2, 1],
        },
      ]),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Pivot X" }), {
      target: { value: "4" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(client.autosave).mock.calls.at(-1)?.[4].fittings[0].variant_fittings[0].pivot_px,
      ).toEqual([4, 1]),
    );
  });

  it("persists an explicit mirror approval and then counts the target direction as complete", async () => {
    const base = editorContext();
    const west = fitting("w");
    const context: OutfitEditorContext = {
      ...base,
      draft: {
        ...base.draft,
        selected_assets: [{ ...west.asset }],
        fittings: [west],
      },
    };
    const client = mockClient(context);
    await openNew(client);

    const approval = screen.getByRole("button", { name: "Allow E mirror from W" });
    fireEvent.click(approval);
    expect(screen.queryByRole("button", { name: "Allow E mirror from W" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(client.autosave).mock.calls.at(-1)?.[4].asset_fallback_approvals).toEqual([
        {
          slot_id: "hand_l",
          target_direction: "e",
          source_direction: "w",
          variant: "base",
        },
      ]),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Fine tune" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), {
      target: { value: "e" },
    });
    const targetOffset = screen.getByRole("spinbutton", { name: "Local offset X" });
    expect(targetOffset).toBeEnabled();
    fireEvent.change(targetOffset, { target: { value: "5" } });
    await waitFor(() =>
      expect(
        vi
          .mocked(client.autosave)
          .mock.calls.at(-1)?.[4]
          .fittings.find((fit) => fit.direction === "e")?.transform.offset_px,
      ).toEqual([5, 0]),
    );
  });

  it("reviews a PNG inside the editor and auto-assigns its unambiguous slot metadata", async () => {
    const context = editorContext();
    const refreshed: OutfitEditorContext = {
      ...context,
      inventory: [
        ...context.inventory,
        {
          asset: { asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" },
          name: "Imported hand",
          asset_kind: "body",
          direction: "s",
          variant: "base",
          assignable: true,
          sprite_mirroring_allowed: false,
          pivot_px: [1, 1],
          image_size_px: [2, 2],
          source_file: ".area/assets/imported/source.png",
        },
      ],
    };
    const client = mockClient(context);
    vi.mocked(client.resume).mockResolvedValue(refreshed);
    vi.mocked(client.autoAssign).mockImplementation(async (_session, _area, _draft, revision) => ({
      ...refreshed,
      draft: {
        ...refreshed.draft,
        revision: revision + 1,
        selected_assets: [{ asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" }],
        fittings: [
          {
            ...fitting("s"),
            asset: { asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" },
          },
        ],
      },
    }));
    const assets = mockAssetsClient();
    await openNew(client, { assetsClient: assets });

    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    fireEvent.click(screen.getByRole("button", { name: /Import PNG or package/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Imported hand");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and copy into vault" }));

    await waitFor(() =>
      expect(client.autoAssign).toHaveBeenCalledWith(expect.any(String), ids.area, ids.draft, 1, [
        { asset_id: ids.importedAsset, revision: 1, slot_id: "hand_l" },
      ]),
    );
    expect(assets.import).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ area_id: ids.area }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("flushes edits made during an in-flight autosave before creating the NPC", async () => {
    const context = editorContext(true);
    const firstSave = deferred<void>();
    const client = mockClient(context);
    let saveCount = 0;
    client.autosave = vi.fn(async (_session, _area, _draft, revision, edits) => {
      saveCount += 1;
      if (saveCount === 1) await firstSave.promise;
      return {
        ...context,
        draft: { ...context.draft, ...edits, revision: revision + 1 },
      };
    });
    const dirty = vi.fn();
    await openNew(client, { onDirtyChange: dirty });
    fireEvent.click(screen.getByRole("tab", { name: "Fine tune" }));
    const offset = screen.getByRole("spinbutton", { name: "Local offset X" });
    fireEvent.change(offset, { target: { value: "3" } });
    await waitFor(() => expect(client.autosave).toHaveBeenCalledTimes(1));
    fireEvent.change(offset, { target: { value: "4" } });

    fireEvent.click(screen.getByRole("button", { name: /Save as NPC/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Latest Mara" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create NPC" }));
    expect(client.saveAsNpc).not.toHaveBeenCalled();

    await act(async () => firstSave.resolve(undefined));
    await waitFor(() => expect(client.autosave).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(client.saveAsNpc).toHaveBeenCalledWith(
        expect.any(String),
        ids.area,
        ids.draft,
        3,
        expect.objectContaining({ name: "Latest Mara" }),
      ),
    );
    expect(
      vi.mocked(client.autosave).mock.calls.at(-1)?.[4].fittings[0].transform.offset_px,
    ).toEqual([4, 0]);
    expect(dirty).toHaveBeenCalledWith(true);
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  });

  it("coalesces a slow 120 FPS preview to the latest frame and stops a once clip", async () => {
    const base = editorContext(true);
    const context: OutfitEditorContext = {
      ...base,
      motion: { ...base.motion, frame_count: 4, fps: 120, loop_mode: "once" },
    };
    const firstPreview = deferred<OutfitPreviewFrame>();
    const client = mockClient(context);
    let previewCount = 0;
    client.preview = vi.fn(async (_session, _area, _draft, _direction, frame) => {
      previewCount += 1;
      if (previewCount === 1) return firstPreview.promise;
      return preview(frame);
    });
    await openNew(client);
    await waitFor(() => expect(client.preview).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    for (let index = 0; index < 4; index += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(16));
    }
    expect(screen.getByText("Frame 4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

    await act(async () => firstPreview.resolve(preview(0)));
    await act(async () => Promise.resolve());
    expect(client.preview).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.preview).mock.calls.at(-1)?.[4]).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText("Frame 1 / 4")).toBeInTheDocument();
  });

  it("collects name and project labels before creating stable NPC documents", async () => {
    const context = editorContext(true);
    const client = mockClient(context);
    await openNew(client);
    fireEvent.click(screen.getByRole("button", { name: /Save as NPC/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Mara" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Villagers/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create NPC" }));
    await waitFor(() =>
      expect(client.saveAsNpc).toHaveBeenCalledWith(expect.any(String), ids.area, ids.draft, 1, {
        name: "Mara",
        description: "",
        label_ids: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"],
      }),
    );
    expect(await screen.findByText(/Character, Default appearance/)).toBeInTheDocument();
  });

  it("applies a completed existing-NPC draft instead of leaving it resumable forever", async () => {
    const base = editorContext(true);
    const context: OutfitEditorContext = {
      ...base,
      affected_binding_count: 2,
      draft: {
        ...base.draft,
        character_id: ids.character,
        appearance_id: ids.appearance,
        base_character_revision: 1,
        base_character_sha256: "a".repeat(64),
        base_appearance_revision: 1,
        base_appearance_sha256: "b".repeat(64),
        base_binding_ref: { id: "88888888-8888-4888-8888-888888888888", revision: 1 },
        base_binding_sha256: "c".repeat(64),
      },
    };
    const client = mockClient(context);
    render(
      <OutfitEditor
        sessionId="session"
        areaId={ids.area}
        templateRef={{ id: ids.template, revision: 1 }}
        client={client}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Equip Villager 01/i }));
    fireEvent.click(await screen.findByRole("tab", { name: "Fine tune" }));
    expect(screen.getByText(/affect 2 animation bindings/i)).toBeInTheDocument();
    const apply = await screen.findByRole("button", { name: "Apply to NPC" });
    fireEvent.click(apply);

    await waitFor(() =>
      expect(client.applyToNpc).toHaveBeenCalledWith("session", ids.area, ids.draft, 1),
    );
    expect(await screen.findByText("NPC updated")).toBeInTheDocument();
  });
});
