import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GlobalSettings } from "../../prompt-studio/schemas/v3Contracts.schema";
import { ModalHost } from "../dialogs";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { GlobalSettingsProvider } from "./GlobalSettingsProvider";
import type { GlobalSettingsClient } from "./globalSettingsClient";

const initial: GlobalSettings = {
  schemaVersion: 1,
  kind: "globalSettings",
  theme: "light",
  uiLanguage: "de",
  density: "comfortable",
};

function Harness({ client }: { readonly client: GlobalSettingsClient }) {
  const [open, setOpen] = useState(false);
  return (
    <GlobalSettingsProvider client={client}>
      <main data-modal-background>
        <button type="button" onClick={() => setOpen(true)}>
          Globale Einstellungen öffnen
        </button>
      </main>
      <ModalHost>
        <GlobalSettingsDialog open={open} onClose={() => setOpen(false)} />
      </ModalHost>
    </GlobalSettingsProvider>
  );
}

describe("GlobalSettingsDialog", () => {
  it("keeps dismissed edits local and commits only an explicitly saved UI-only record", async () => {
    const save = vi.fn(async (settings: GlobalSettings) => settings);
    const client: GlobalSettingsClient = {
      load: vi.fn(async () => initial),
      save,
    };
    const rendered = render(<Harness client={client} />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
    expect(document.documentElement).toHaveAttribute("data-density", "comfortable");

    fireEvent.click(screen.getByRole("button", { name: "Globale Einstellungen öffnen" }));
    let dialog = screen.getByRole("dialog", { name: "Globale Einstellungen" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Theme" }), {
      target: { value: "dark" },
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Dichte" }), {
      target: { value: "compact" },
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Sprache der Oberfläche" }), {
      target: { value: "en" },
    });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(save).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveAttribute("data-density", "comfortable");

    fireEvent.click(screen.getByRole("button", { name: "Globale Einstellungen öffnen" }));
    dialog = screen.getByRole("dialog", { name: "Globale Einstellungen" });
    expect(within(dialog).getByRole("combobox", { name: "Theme" })).toHaveValue("dark");
    expect(within(dialog).getByRole("combobox", { name: "Dichte" })).toHaveValue("compact");
    expect(within(dialog).getByRole("combobox", { name: "Sprache der Oberfläche" })).toHaveValue(
      "en",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith({
      schemaVersion: 1,
      kind: "globalSettings",
      theme: "dark",
      uiLanguage: "en",
      density: "compact",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Globale Einstellungen" }),
      ).not.toBeInTheDocument(),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-density", "compact");
    expect(document.documentElement).toHaveAttribute("lang", "en");

    rendered.unmount();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.documentElement).not.toHaveAttribute("data-density");
  });
});
