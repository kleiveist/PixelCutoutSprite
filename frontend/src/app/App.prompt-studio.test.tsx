import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createV2StorageAdapter, type OutputWorkspaceAdapter } from "../prompt-studio/services";
import { MemoryStorage } from "../prompt-studio/test/memoryStorage";
import { App } from "./App";

const outputAdapter: OutputWorkspaceAdapter = {
  copyText: vi.fn(async () => undefined),
  downloadTextFile: vi.fn(async () => undefined),
};

function renderIntegratedApp(flushPromptStorage = vi.fn(async () => undefined)) {
  const storage = new MemoryStorage();
  return {
    flushPromptStorage,
    storage,
    ...render(
      <App
        promptOutputAdapter={outputAdapter}
        promptStorageAdapter={createV2StorageAdapter(storage)}
        flushPromptStorage={flushPromptStorage}
      />,
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("integrated PixelPromptStudio", () => {
  it("exposes all five prompt views in the shared shell without browser routing", async () => {
    const historyBefore = window.location.href;
    renderIntegratedApp();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    const generator = await screen.findByRole("region", {
      name: "PixelPromptStudio Generator",
    });
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Studio sections" })).not.toBeInTheDocument();
    expect(
      within(generator).getByRole("heading", {
        name: "Pixelart-Produktion beginnt mit der richtigen Asset-Art.",
      }),
    ).toBeVisible();

    const destinations = [
      ["Profile", "Produktionsprofile sicher organisieren."],
      ["Wizard", "Neue Assets geführt aufsetzen."],
      ["Ausgabe", "Prompt-Pakete produktionsbereit ausgeben."],
      ["Einstellungen", "Das Studio passend konfigurieren."],
      ["Dashboard", "Pixelart-Produktion beginnt mit der richtigen Asset-Art."],
    ] as const;

    for (const [label, heading] of destinations) {
      fireEvent.click(within(generator).getByRole("button", { name: label }));
      expect(await within(generator).findByRole("heading", { name: heading })).toBeVisible();
    }

    expect(window.location.href).toBe(historyBefore);
  });

  it("restores both the Cutout route and the independent prompt view", async () => {
    const { flushPromptStorage } = renderIntegratedApp();

    fireEvent.click(screen.getByRole("button", { name: "Areas" }));
    expect(screen.getByRole("heading", { name: "Areas" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    const generator = await screen.findByRole("region", {
      name: "PixelPromptStudio Generator",
    });
    fireEvent.click(within(generator).getByRole("button", { name: "Profile" }));
    expect(
      await within(generator).findByRole("heading", {
        name: "Produktionsprofile sicher organisieren.",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));
    await waitFor(() => expect(flushPromptStorage).toHaveBeenCalledOnce());
    expect(screen.getByRole("heading", { name: "Areas" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    expect(
      await screen.findByRole("heading", { name: "Produktionsprofile sicher organisieren." }),
    ).toBeInTheDocument();
  });

  it("blocks a studio switch until a dirty wizard draft is saved and then resumes it", async () => {
    const { flushPromptStorage } = renderIntegratedApp();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    const generator = await screen.findByRole("region", {
      name: "PixelPromptStudio Generator",
    });
    fireEvent.click(
      within(generator).getByRole("button", { name: /Figur als neues Asset erstellen/i }),
    );

    const projectName = await screen.findByRole("textbox", { name: /Projektname/i });
    fireEvent.change(projectName, { target: { value: "Waldgeist" } });
    fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));

    expect(flushPromptStorage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Studio switch blocked · wait for prompt autosave or correct the active step",
    );

    await screen.findByText("Entwurf wurde lokal gesichert.");
    fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));
    await waitFor(() => expect(flushPromptStorage).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    expect(await screen.findByRole("textbox", { name: /Projektname/i })).toHaveValue("Waldgeist");
  });
});
