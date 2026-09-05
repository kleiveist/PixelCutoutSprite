import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryPage } from "./InventoryPage";
import { emptyInventoryFilter, type InventoryItem } from "./inventory-filter";

afterEach(() => vi.unstubAllGlobals());

const items: InventoryItem[] = [
  {
    id: "a",
    revision: 1,
    thumbnailRevision: 1,
    name: "Left glove",
    slotId: "hand_l",
    direction: "s",
    kind: "equipment",
    profile: "Humanoid r1",
    labels: ["winter"],
    usageCount: 2,
    usageDescriptions: ["Default appearance · slot hand_l"],
    thumbnailUrl: "glove.png",
    archived: false,
  },
  {
    id: "b",
    revision: 1,
    thumbnailRevision: 1,
    name: "Head base",
    slotId: "head",
    direction: "n",
    kind: "body",
    profile: "Humanoid r1",
    labels: ["base"],
    usageCount: 0,
    usageDescriptions: [],
    thumbnailUrl: "head.png",
    archived: false,
  },
];

describe("InventoryPage", () => {
  it("delegates every query control and reset to the server-backed workspace", () => {
    const onFilterChange = vi.fn();
    render(
      <InventoryPage
        filter={emptyInventoryFilter()}
        items={items}
        onChoosePackage={vi.fn()}
        onDropFiles={vi.fn()}
        onArchive={vi.fn()}
        onFilterChange={onFilterChange}
      />,
    );
    for (const name of ["Slot", "Direction", "Type", "Profile", "Labels", "Usage", "Sort"])
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Usage" }), {
      target: { value: "unused" },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ usage: "unused" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ query: "missing" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(onFilterChange).toHaveBeenLastCalledWith(emptyInventoryFilter());
  });

  it("shows every usage and archives without breaking referenced revisions", () => {
    const onArchive = vi.fn();
    render(
      <InventoryPage
        items={items}
        onChoosePackage={vi.fn()}
        onDropFiles={vi.fn()}
        onArchive={onArchive}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Archive…" })[0]);
    expect(screen.getByText(/Used by 2 saved assignment/)).toBeInTheDocument();
    expect(screen.getByText(/Default appearance/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive asset" }));
    expect(onArchive).toHaveBeenCalledWith(items[0]);
  });

  it("fully disables importing, dropping, and archiving in read-only mode", () => {
    const onChoosePackage = vi.fn();
    const onDropFiles = vi.fn();
    const onArchive = vi.fn();
    render(
      <InventoryPage
        items={items}
        onChoosePackage={onChoosePackage}
        onDropFiles={onDropFiles}
        onArchive={onArchive}
        writable={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Import PNG or package" })).toBeDisabled();
    expect(screen.getByText(/file drops are disabled/i)).toHaveAttribute("aria-disabled", "true");
    fireEvent.drop(screen.getByText(/file drops are disabled/i), {
      dataTransfer: { files: [new File(["png"], "sprite.png", { type: "image/png" })] },
    });
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Archive…" })[0]).toBeDisabled();
    expect(onChoosePackage).not.toHaveBeenCalled();
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("releases decoded thumbnail state offscreen and reacquires it when visible again", async () => {
    let notify: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
    class Observer {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    const request = vi.fn(async () => "data:image/png;base64,cG5n");
    render(
      <InventoryPage
        items={[{ ...items[0], thumbnailUrl: undefined }]}
        onChoosePackage={vi.fn()}
        onDropFiles={vi.fn()}
        onArchive={vi.fn()}
        onThumbnailRequest={request}
      />,
    );

    expect(request).not.toHaveBeenCalled();
    await act(async () => notify?.([{ isIntersecting: true }]));
    expect(await screen.findByRole("img", { name: /Left glove source thumbnail/ })).toBeVisible();
    await act(async () => notify?.([{ isIntersecting: false }]));
    await waitFor(() =>
      expect(screen.queryByRole("img", { name: /Left glove source thumbnail/ })).toBeNull(),
    );
    await act(async () => notify?.([{ isIntersecting: true }]));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
