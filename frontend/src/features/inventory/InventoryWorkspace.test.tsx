import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AssetClient } from "../../api/asset-client";
import type {
  AssetImportInspection,
  AssetImportJobView,
  AssetInventoryItem,
  AssetInventoryPage,
  AssetInventoryQuery,
} from "../../domain/inventory";
import { InventoryWorkspace } from "./InventoryWorkspace";

const profile = {
  id: "33333333-3333-4333-8333-333333333333",
  revision: 1,
};

const defaultQuery = {
  search: "",
  slot_id: null,
  direction: null,
  asset_kind: null,
  profile_ref: null,
  label_id: null,
  usage: "any",
  sort: "name_asc",
} as const;

const emptyInventory: AssetInventoryPage = {
  area_id: "22222222-2222-4222-8222-222222222222",
  profile_ref: profile,
  writable: true,
  labels: [],
  facets: {
    slot_ids: [],
    directions: [],
    asset_kinds: [],
    profile_refs: [],
    label_ids: [],
    has_used: false,
    has_unused: true,
  },
  items: [],
  total_items: 0,
  next_cursor: null,
};

const completedImport: AssetImportJobView = {
  job_id: "55555555-5555-4555-8555-555555555555",
  session_id: "66666666-6666-4666-8666-666666666666",
  area_id: emptyInventory.area_id,
  state: "completed",
  progress: { stage: "complete", completed: 1, total: 1, message: "Import complete" },
  result: { imported_assets: [] },
  error: null,
};

const inventoryItem = (id: string, name: string): AssetInventoryItem => ({
  id,
  revision: 1,
  name,
  original_name: `${name}.png`,
  asset_kind: "body",
  label_ids: [],
  released_revision: 1,
  profile_ref: profile,
  slot_id: "hand_l",
  direction: "s",
  variant: "base",
  image_size_px: [8, 8],
  pivot_px: [4, 4],
  content_hash: id.padEnd(64, "a").slice(0, 64),
  archived: false,
  usage: [],
});

const inspection: AssetImportInspection = {
  area_id: emptyInventory.area_id,
  profile_ref: profile,
  inspection_fingerprint: "inspection-fingerprint",
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
    expect(client.inspect).toHaveBeenCalledWith(
      "session",
      emptyInventory.area_id,
      ["/tmp/hand_l__s__base.png"],
      expect.any(String),
    );
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

  it("pages metadata and requests only bounded thumbnails separately", async () => {
    const first = {
      ...inventoryItem("asset-a", "First hand"),
      revision: 7,
      released_revision: 3,
    };
    const second = inventoryItem("asset-b", "Second hand");
    const inventory = vi.fn(async (_session: string, _area: string, cursor?: string | null) =>
      cursor
        ? { ...emptyInventory, items: [second], total_items: 2, next_cursor: null }
        : { ...emptyInventory, items: [first], total_items: 2, next_cursor: "asset-a" },
    );
    const client = fakeClient({ inventory });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );

    expect(await screen.findByText("First hand")).toBeInTheDocument();
    await waitFor(() =>
      expect(client.thumbnail).toHaveBeenCalledWith(
        "session",
        emptyInventory.area_id,
        first.id,
        first.released_revision,
        48,
      ),
    );
    expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more assets" }));
    expect(await screen.findByText("Second hand")).toBeInTheDocument();
    expect(inventory).toHaveBeenLastCalledWith(
      "session",
      emptyInventory.area_id,
      "asset-a",
      50,
      defaultQuery,
    );
  });

  it("queries the complete server inventory so Asset 999 is discoverable outside page one", async () => {
    const inventory = vi.fn(
      async (
        _session: string,
        _area: string,
        _cursor?: string | null,
        _limit?: number | null,
        query?: AssetInventoryQuery | null,
      ) =>
        query?.search === "Asset 999"
          ? {
              ...emptyInventory,
              items: [inventoryItem("asset-999", "Asset 999")],
              total_items: 1,
            }
          : { ...emptyInventory, total_items: 999, next_cursor: "page-2" },
    );
    const client = fakeClient({ inventory });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    await screen.findByRole("heading", { name: "PNG inventory" });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Asset 999" } });
    expect(await screen.findByText("Asset 999")).toBeInTheDocument();
    expect(inventory).toHaveBeenLastCalledWith("session", emptyInventory.area_id, null, 50, {
      ...defaultQuery,
      search: "Asset 999",
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() =>
      expect(inventory).toHaveBeenLastCalledWith(
        "session",
        emptyInventory.area_id,
        null,
        50,
        defaultQuery,
      ),
    );
  });

  it("keeps search mounted and focused while a server query reloads", async () => {
    const filteredPage = deferred<AssetInventoryPage>();
    const inventory = vi.fn(
      async (
        _session: string,
        _area: string,
        _cursor?: string | null,
        _limit?: number | null,
        query?: AssetInventoryQuery | null,
      ) => (query?.search ? filteredPage.promise : emptyInventory),
    );
    render(
      <InventoryWorkspace
        areaId={emptyInventory.area_id}
        client={fakeClient({ inventory })}
        sessionId="session"
      />,
    );
    const search = await screen.findByRole("searchbox");
    search.focus();

    fireEvent.change(search, { target: { value: "A" } });
    expect(screen.getByRole("searchbox")).toBe(search);
    expect(search).toHaveFocus();

    fireEvent.change(search, { target: { value: "Asset 999" } });
    expect(screen.getByRole("searchbox")).toBe(search);
    expect(search).toHaveFocus();

    await act(async () =>
      filteredPage.resolve({
        ...emptyInventory,
        items: [inventoryItem("asset-999", "Asset 999")],
        total_items: 1,
      }),
    );
    expect(await screen.findByText("Asset 999")).toBeInTheDocument();
  });

  it("discards a load-more page when the server query changes while it is in flight", async () => {
    const stalePage = deferred<AssetInventoryPage>();
    const inventory = vi.fn(
      async (
        _session: string,
        _area: string,
        cursor?: string | null,
        _limit?: number | null,
        query?: AssetInventoryQuery | null,
      ) => {
        if (cursor) return stalePage.promise;
        if (query?.search) return emptyInventory;
        return {
          ...emptyInventory,
          items: [inventoryItem("asset-first", "First page")],
          total_items: 2,
          next_cursor: "page-2",
        };
      },
    );
    render(
      <InventoryWorkspace
        areaId={emptyInventory.area_id}
        client={fakeClient({ inventory })}
        sessionId="session"
      />,
    );
    await screen.findByText("First page");
    fireEvent.click(screen.getByRole("button", { name: "Load more assets" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "different" } });
    await act(async () =>
      stalePage.resolve({
        ...emptyInventory,
        items: [inventoryItem("asset-stale", "Stale second page")],
        total_items: 2,
      }),
    );
    await waitFor(() => expect(screen.queryByText("Stale second page")).toBeNull());
  });

  it("ignores a stale first page when area context changes", async () => {
    const firstPage = deferred<AssetInventoryPage>();
    const secondPage = deferred<AssetInventoryPage>();
    const firstArea = "22222222-2222-4222-8222-222222222221";
    const secondArea = "22222222-2222-4222-8222-222222222222";
    const inventory = vi.fn((_session: string, area: string) =>
      area === firstArea ? firstPage.promise : secondPage.promise,
    );
    const client = fakeClient({ inventory });
    const view = render(
      <InventoryWorkspace areaId={firstArea} client={client} sessionId="session" />,
    );
    await waitFor(() =>
      expect(inventory).toHaveBeenCalledWith("session", firstArea, null, 50, defaultQuery),
    );

    view.rerender(<InventoryWorkspace areaId={secondArea} client={client} sessionId="session" />);
    await waitFor(() =>
      expect(inventory).toHaveBeenCalledWith("session", secondArea, null, 50, defaultQuery),
    );
    await act(async () =>
      secondPage.resolve({
        ...emptyInventory,
        area_id: secondArea,
        items: [inventoryItem("asset-new", "Current area asset")],
        total_items: 1,
      }),
    );
    expect(await screen.findByText("Current area asset")).toBeInTheDocument();

    await act(async () =>
      firstPage.resolve({
        ...emptyInventory,
        area_id: firstArea,
        items: [inventoryItem("asset-old", "Stale area asset")],
        total_items: 1,
      }),
    );
    expect(screen.queryByText("Stale area asset")).not.toBeInTheDocument();
    expect(screen.getByText("Current area asset")).toBeInTheDocument();
  });

  it("shows native import progress and offers cancellation", async () => {
    const queued: AssetImportJobView = {
      ...completedImport,
      state: "queued",
      progress: { stage: "queued", completed: 0, total: 1, message: "Waiting to import" },
      result: null,
    };
    const cancelled: AssetImportJobView = {
      ...queued,
      state: "cancelled",
      progress: { ...queued.progress, stage: "cancelled", message: "Import cancelled" },
    };
    const client = fakeClient({
      import: vi.fn(async () => queued),
      importJob: vi.fn(async () => cancelled),
      cancelImport: vi.fn(async () => cancelled),
    });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    await screen.findByRole("heading", { name: "PNG inventory" });
    fireEvent.click(screen.getByRole("button", { name: "Import PNG or package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and copy into vault" }));
    expect(await screen.findByRole("region", { name: "Asset import progress" })).toHaveTextContent(
      "Waiting to import",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
    await waitFor(() => expect(client.cancelImport).toHaveBeenCalledWith("session", queued.job_id));
  });

  it("offers native cancellation while source inspection is still running", async () => {
    const inspect = vi.fn<AssetClient["inspect"]>(
      () => new Promise<AssetImportInspection>(() => undefined),
    );
    const cancelInspection = vi.fn(async () => true);
    const client = fakeClient({ inspect, cancelInspection });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    await screen.findByRole("heading", { name: "PNG inventory" });
    fireEvent.click(screen.getByRole("button", { name: "Import PNG or package" }));
    const cancel = await screen.findByRole("button", { name: "Cancel inspection" });
    fireEvent.click(cancel);
    await waitFor(() => expect(cancelInspection).toHaveBeenCalledTimes(1));
    expect(cancelInspection).toHaveBeenCalledWith("session", inspect.mock.calls[0][3]);
    expect(inspect.mock.calls[0][3]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("does not dismiss import review while confirmation is in flight", async () => {
    const start = deferred<AssetImportJobView>();
    const client = fakeClient({ import: vi.fn(() => start.promise) });
    render(
      <InventoryWorkspace areaId={emptyInventory.area_id} client={client} sessionId="session" />,
    );
    await screen.findByRole("heading", { name: "PNG inventory" });
    fireEvent.click(screen.getByRole("button", { name: "Import PNG or package" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and copy into vault" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => start.resolve(completedImport));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

function fakeClient(overrides: Partial<AssetClient> = {}): AssetClient {
  return {
    chooseSources: vi.fn(async () => ["/tmp/hand_l__s__base.png"]),
    listenForDrops: vi.fn(async () => () => undefined),
    inventory: vi.fn(async () => emptyInventory),
    thumbnail: vi.fn(async (_session, _area, assetId, revision) => ({
      asset_id: assetId,
      revision,
      width_px: 1,
      height_px: 1,
      data_url: "data:image/png;base64,cG5n",
    })),
    inspect: vi.fn(async () => inspection),
    cancelInspection: vi.fn(async () => true),
    import: vi.fn(async () => completedImport),
    importJob: vi.fn(async () => completedImport),
    cancelImport: vi.fn(async (): Promise<AssetImportJobView> => ({
      ...completedImport,
      state: "cancelled",
    })),
    archive: vi.fn(async () => {
      throw new Error("No item to archive");
    }),
    ...overrides,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
