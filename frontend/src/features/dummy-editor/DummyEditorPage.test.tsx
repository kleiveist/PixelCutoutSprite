import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DummyEditorPage, type EditorSlot } from "./DummyEditorPage";
import { neutralTransform } from "./editor-state";

const slots: EditorSlot[] = [
  {
    id: "torso",
    label: "Upper torso",
    parentId: null,
    x: 52,
    y: 40,
    width: 24,
    height: 20,
    color: "#e8ff68",
  },
  {
    id: "hand_l",
    label: "Left hand",
    parentId: "torso",
    x: 38,
    y: 62,
    width: 8,
    height: 6,
    color: "#ff795e",
  },
];

describe("DummyEditorPage", () => {
  it("supports multiselect numeric edits and one-step undo", () => {
    render(
      <DummyEditorPage
        templateName="Walk"
        slots={slots}
        initialPose={{ torso: neutralTransform(), hand_l: neutralTransform() }}
        onSave={vi.fn(async () => undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /02 · Left hand/ }), { ctrlKey: true });
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "4" } });
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("X offset")).toHaveValue(0);
  });

  it("surfaces save failures and keeps the edited pose", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("disk is full");
    });
    render(
      <DummyEditorPage
        templateName="Jump"
        slots={slots}
        initialPose={{ torso: neutralTransform() }}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rotation"), { target: { value: "20" } });
    expect(screen.getByLabelText("Rotation")).toHaveValue(15);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/disk is full/)).toBeInTheDocument());
    expect(screen.getByLabelText("Rotation")).toHaveValue(15);
  });

  it("keeps editor helpers separate from the compositor image", () => {
    render(
      <DummyEditorPage
        templateName="Idle"
        slots={slots}
        initialPose={{ torso: neutralTransform() }}
        renderedFrameUrl="rendered.png"
        onSave={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByAltText("Reference compositor output")).toHaveAttribute(
      "src",
      "rendered.png",
    );
    expect(screen.getByLabelText("Selection overlay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1:1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pan down" })).toBeInTheDocument();
  });

  it("keeps an attached child handle aligned when its parent moves", () => {
    render(
      <DummyEditorPage
        templateName="Walk"
        slots={slots}
        initialPose={{ torso: neutralTransform(), hand_l: neutralTransform() }}
        groundOrigin={[0, 0]}
        onSave={vi.fn(async () => undefined)}
      />,
    );
    const child = screen.getByRole("button", { name: "Select Left hand" });
    const before = child.style.transform;
    fireEvent.click(screen.getByRole("button", { name: /01 · Upper torso/ }));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "5" } });
    expect(child.style.transform).not.toBe(before);
    expect(child.style.transform).toContain(",95,");
  });

  it("allows inspection but blocks mutation in a read-only vault", () => {
    render(
      <DummyEditorPage
        templateName="Walk"
        slots={slots}
        initialPose={{ torso: neutralTransform(), hand_l: neutralTransform() }}
        readOnly
        onSave={vi.fn(async () => undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /02 · Left hand/ }));
    expect(screen.getByText("Attached to torso")).toBeInTheDocument();
    expect(screen.getByLabelText("X offset")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
