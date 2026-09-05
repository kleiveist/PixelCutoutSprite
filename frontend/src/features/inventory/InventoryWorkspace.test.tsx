import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AssetClient } from "../../api/asset-client";
import type { AssetImportInspection, AssetInventory } from "../../domain/inventory";
import { InventoryWorkspace } from "./InventoryWorkspace";

const profile = {
  id: "33333333-3333-4333-8333-333333333333",
  revision: 1,
};

const emptyInventory: AssetInventory = {
  area_id: "22222222-2222-4222-8222-222222222222",
  profile_ref: profile,
  writable: true,
  labels: [],
  items: [],
};

const inspection: AssetImportInspection = {
  area_id: emptyInventory.area_id,
  profile_ref: profile,
  source: { kind: "loose_pngs", paths: ["/tmp/hand_l__s__base.png"] },
  slots: [{ id: "hand_l", size_px: [8, 8], pivot_px: [4, 4] }],
  entries: [
    {
      entry_index: 0,
      name: "Left glove",
      source_name: "hand_l__s__base.png",
      asset_kind: "equipment",
      declared_slot_id: null,
      declared_direction: null,
      suggested_slot_id: "hand_l",
      suggested_direction: "s",
      variant: "base",
      image_size_px: [4, 4],
      effective_size_px: [4, 4],
      pivot_px: [2, 4],
      content_hash: "a".repeat(64),
      size_warning: "Source is 4×4 px; profile slot is 8×8 px.",
      size_options: ["keep_original", "pad_transparent", "rescale_nearest"],
      duplicate_asset_id: null,
    },
  ],
};

describe("InventoryWorkspace", () => {
  it("uses the native chooser, reviews filename suggestions, and imports only after confirmation", async () => {
    const client = fakeClient();
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    expect(await screen.findByRole("heading", { name: "PNG inventory" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Import PNG or package" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Left glove");
    expect(screen.getByText(/Suggested from file name/)).toHaveTextContent("hand_l / s");
    fireEvent.change(screen.getByRole("combobox", { name: "Size handling for Left glove" }), {
      target: { value: "rescale_nearest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and copy into vault" }));

    await waitFor(() => expect(client.import).toHaveBeenCalledTimes(1));
    expect(client.import).toHaveBeenCalledWith(
      "session",
      expect.objectContaining({
        decisions: [
          {
            entry_index: 0,
            slot_id: "hand_l",
            direction: "s",
            size_handling: "rescale_nearest",
          },
        ],
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reviews paths delivered by the native desktop drag-and-drop event", async () => {
    let onDrop: ((paths: string[]) => void) | undefined;
    const client = fakeClient({
      listenForDrops: vi.fn(async (listener: (paths: string[]) => void) => {
        onDrop = listener;
        return () => undefined;
      }),
    });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    await screen.findByRole("heading", { name: "PNG inventory" });
    await waitFor(() => expect(client.listenForDrops).toHaveBeenCalledTimes(1));
    await act(async () => onDrop?.(["/tmp/hand_l__s__base.png"]));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(client.inspect).toHaveBeenCalledWith("session", emptyInventory.area_id, [
      "/tmp/hand_l__s__base.png",
    ]);
  });

  it("does not subscribe to native drops or expose imports for a read-only inventory", async () => {
    const client = fakeClient({
      inventory: vi.fn(async () => ({ ...emptyInventory, writable: false })),
    });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );

    expect(await screen.findByText(/file drops are disabled/i)).toBeInTheDocument();
    expect(client.listenForDrops).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import PNG or package" })).toBeDisabled();
    expect(client.chooseSources).not.toHaveBeenCalled();
    expect(client.inspect).not.toHaveBeenCalled();
    expect(client.import).not.toHaveBeenCalled();
  });
});

function fakeClient(overrides: Partial<AssetClient> = {}): AssetClient {
  return {
    chooseSources: vi.fn(async () => ["/tmp/hand_l__s__base.png"]),
    listenForDrops: vi.fn(async () => () => undefined),
    inventory: vi.fn(async () => emptyInventory),
    inspect: vi.fn(async () => inspection),
    import: vi.fn(async () => emptyInventory),
    archive: vi.fn(async () => emptyInventory),
    ...overrides,
  };
}
