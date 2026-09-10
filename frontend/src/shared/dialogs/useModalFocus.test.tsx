import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import { useModalFocus } from "./useModalFocus";

function Harness({ canDismiss = true }: { canDismiss?: boolean }) {
  const [open, setOpen] = useState(false);
  const initial = useRef<HTMLInputElement>(null);
  const modal = useModalFocus<HTMLDivElement>({
    canDismiss,
    initialFocus: initial,
    onEscape: () => setOpen(false),
    open,
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open settings
      </button>
      {open && (
        <div
          ref={modal.dialogRef}
          role="dialog"
          aria-label="Settings"
          onKeyDown={modal.onDialogKeyDown}
        >
          <input ref={initial} aria-label="Name" />
          <button type="button" disabled>
            Disabled
          </button>
          <button type="button">Apply</button>
          <div hidden>
            <button type="button">Hidden View control</button>
          </div>
        </div>
      )}
    </>
  );
}

describe("useModalFocus", () => {
  it("focuses the intended control, traps Tab, closes with Escape, and returns focus", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open settings" });
    opener.focus();
    fireEvent.click(opener);

    const input = screen.getByRole("textbox", { name: "Name" });
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(apply).toHaveFocus();
    fireEvent.keyDown(apply, { key: "Tab" });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("consumes Escape without dismissing while a modal operation is locked", () => {
    const { rerender } = render(<Harness canDismiss={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).toBeInTheDocument();

    rerender(<Harness canDismiss />);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Settings" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });
});
