import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InventoryPage } from "./InventoryPage";
import type { InventoryItem } from "./inventory-filter";

const items: InventoryItem[] = [
  {
    id: "a",
    revision: 1,
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
  it("keeps text search separate and exposes every structured filter as a dropdown", () => {
    render(
      <InventoryPage
        items={items}
        onChoosePackage={vi.fn()}
        onDropFiles={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    for (const name of ["Slot", "Direction", "Type", "Profile", "Labels", "Usage"])
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Usage" }), {
      target: { value: "unused" },
    });
    expect(screen.queryByText("Left glove")).not.toBeInTheDocument();
    expect(screen.getByText("Head base")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(screen.getByText(/No assets match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("Left glove")).toBeInTheDocument();
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
});
