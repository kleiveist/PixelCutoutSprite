import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DirectionDefinition } from "../../domain/motion";
import { DirectionEditor } from "./DirectionEditor";

function definitions(): DirectionDefinition[] {
  return [
    { direction: "n", mode: "explicit", source: null },
    { direction: "ne", mode: "explicit", source: null },
    { direction: "e", mode: "explicit", source: null },
    { direction: "se", mode: "explicit", source: null },
    { direction: "s", mode: "explicit", source: null },
    { direction: "sw", mode: "mirrored", source: "se" },
    { direction: "w", mode: "mirrored", source: "e" },
    { direction: "nw", mode: "missing", source: null },
  ];
}

describe("DirectionEditor", () => {
  it("shows all eight origins and visible release gaps", () => {
    render(
      <DirectionEditor
        definitions={definitions()}
        issues={{ nw: ["Left glove sprite is missing"] }}
        onChange={vi.fn()}
        onDetach={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("7 of 8 available");
    expect(screen.getAllByRole("combobox", { name: / mode$/i })).toHaveLength(8);
    expect(screen.getByText("Missing · release blocked")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Left glove sprite is missing");
    expect(screen.getByRole("combobox", { name: "W mirror source" })).toHaveValue("e");
  });

  it("edits direction mode through a structured dropdown", () => {
    const onChange = vi.fn();
    render(<DirectionEditor definitions={definitions()} onChange={onChange} onDetach={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "NW mode" }), {
      target: { value: "mirrored" },
    });
    const next = onChange.mock.calls[0][0] as DirectionDefinition[];
    expect(next.find((definition) => definition.direction === "nw")).toEqual({
      direction: "nw",
      mode: "mirrored",
      source: "ne",
    });
  });

  it("requests one atomic detach action for a mirrored direction", () => {
    const onDetach = vi.fn();
    render(<DirectionEditor definitions={definitions()} onChange={vi.fn()} onDetach={onDetach} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Detach as explicit" })[1]);
    expect(onDetach).toHaveBeenCalledOnce();
    expect(onDetach).toHaveBeenCalledWith("w");
  });

  it("does not offer front or back as horizontal mirror targets", () => {
    render(<DirectionEditor definitions={definitions()} onChange={vi.fn()} onDetach={vi.fn()} />);

    const north = screen.getByRole("combobox", { name: "N mode" });
    const south = screen.getByRole("combobox", { name: "S mode" });
    expect(north.querySelector('option[value="mirrored"]')).toBeDisabled();
    expect(south.querySelector('option[value="mirrored"]')).toBeDisabled();
  });
});
