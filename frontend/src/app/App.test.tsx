import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cutoutFixtureClient } from "../cutout-studio/testFixtures";
import { App } from "./App";
import { testDataFolderClient, testVault, testVaultClient } from "./appTestFixtures";
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
const removedControls =
  /^(Projects|Areas|Animations|Dummy Editor|Outfit|NPCs|Export|Inventory|Generate example vault|An Cutout übergeben)$/i;
describe("P37 Cutout restart", () => {
  it("starts with the real Welcome and shared navigation/file toolbar", () => {
    const { container } = render(<App vaultApi={testVaultClient()} />);
    expect(screen.getByRole("heading", { name: "Willkommen im Cutout-Studio" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Ablauf zum Schneiden" })).toHaveTextContent(
      "Körperteile markieren",
    );
    expect(container.querySelectorAll("[data-module-navigation]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-data-folder-toolbar]")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: removedControls })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });
  it("opens a vault, selects an image and preserves it across both other studios", async () => {
    const vaultApi = testVaultClient();
    const dataFolderApi = testDataFolderClient();
    const cutoutApi = cutoutFixtureClient().client;
    render(<App vaultApi={vaultApi} dataFolderApi={dataFolderApi} cutoutApi={cutoutApi} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    fireEvent.click(await screen.findByRole("treeitem", { name: /hero.png/ }));
    expect(await screen.findByRole("heading", { name: "hero.png" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Cutout-Maskeneditor" })).toHaveTextContent(
      "16 × 24",
    );
    for (const target of ["PixelPromptStudio Generator öffnen", "PixelSpriteStudio öffnen"]) {
      fireEvent.click(screen.getByRole("button", { name: target }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: target })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );
      expect(screen.queryByRole("button", { name: removedControls })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));
      expect(await screen.findByRole("heading", { name: "hero.png" })).toBeVisible();
    }
    expect(vaultApi.close).not.toHaveBeenCalled();
    expect(dataFolderApi.inspect).toHaveBeenCalledWith(
      { sessionId: testVault.session_id, generation: 1 },
      expect.objectContaining({ relativePath: "hero.png" }),
    );
  });
  it.each(["projects", "areas", "animations", "dummy-editor", "outfit", "npcs", "export"])(
    "does not resurrect a deleted route through history or a URL: %s",
    (route) => {
      window.history.replaceState({ route }, "", "/?route=" + route + "#" + route);
      render(<App vaultApi={testVaultClient()} />);
      fireEvent.popState(window, { state: { route } });
      expect(screen.getByRole("heading", { name: "Willkommen im Cutout-Studio" })).toBeVisible();
      expect(screen.queryByRole("button", { name: removedControls })).not.toBeInTheDocument();
    },
  );
  it("still opens and dismisses keyboard help without advertising removed playback", async () => {
    render(<App vaultApi={testVaultClient()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open shortcut help" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/playback/i)).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("leaves a read-only vault readable and clearly marked", async () => {
    const api = testVaultClient({ ...testVault, mode: "read_only" });
    render(<App vaultApi={api} dataFolderApi={testDataFolderClient()} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await screen.findByRole("treeitem", { name: /hero.png/ });
    expect(screen.getByRole("region", { name: "Cutout-Arbeitsbereich" })).toHaveTextContent(
      "schreibgeschützt",
    );
    expect(api.heartbeat).not.toHaveBeenCalled();
  });
});
