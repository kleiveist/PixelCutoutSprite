import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Modal } from "./Modal";
import { ModalHost } from "./ModalHost";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main data-modal-background>
        <button type="button" onClick={() => setOpen(true)}>
          Einstellungen öffnen
        </button>
      </main>
      <ModalHost>
        <Modal open={open} title="Testdialog" onClose={() => setOpen(false)}>
          <button type="button">Innenaktion</button>
          <button type="button">Letzte Aktion</button>
        </Modal>
      </ModalHost>
    </>
  );
}

function openDialog() {
  const opener = screen.getByRole("button", { name: "Einstellungen öffnen" });
  opener.focus();
  fireEvent.click(opener);
  return {
    dialog: screen.getByRole("dialog", { name: "Testdialog" }),
    opener,
  };
}

describe("Modal", () => {
  it("supports X, Escape and genuine backdrop dismissal with focus return", () => {
    render(<Harness />);

    let { dialog, opener } = openDialog();
    const background = screen.getByRole("main", { hidden: true });
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(within(dialog).getByRole("button", { name: "Dialog schließen" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Dialog schließen" }));
    expect(screen.queryByRole("dialog", { name: "Testdialog" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(background).not.toHaveAttribute("aria-hidden");

    ({ dialog, opener } = openDialog());
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Testdialog" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    openDialog();
    const backdrop = document.querySelector<HTMLElement>("[data-modal-backdrop]");
    if (!backdrop) throw new Error("Expected the modal backdrop.");
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);
    expect(screen.queryByRole("dialog", { name: "Testdialog" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("does not dismiss for inside interaction or an inside-to-backdrop drag", () => {
    render(<Harness />);
    const { dialog } = openDialog();
    const inside = within(dialog).getByRole("button", { name: "Innenaktion" });
    const backdrop = document.querySelector<HTMLElement>("[data-modal-backdrop]");
    if (!backdrop) throw new Error("Expected the modal backdrop.");

    fireEvent.click(inside);
    expect(dialog).toBeInTheDocument();
    fireEvent.pointerDown(inside);
    fireEvent.pointerUp(backdrop);
    expect(dialog).toBeInTheDocument();
  });
});
