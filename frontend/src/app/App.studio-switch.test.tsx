import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { testDataFolderClient, testVault, testVaultClient } from "./appTestFixtures";
afterEach(() => vi.restoreAllMocks());
const prompt = () => screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" });
const cutout = () => screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" });
describe("shared studio lifecycle after P37", () => {
  it("keeps Prompt active when its lifecycle flush fails", async () => {
    const flush = vi.fn(async () => {
      throw new Error("disk full");
    });
    render(<App flushPromptStorage={flush} vaultApi={testVaultClient()} />);
    fireEvent.click(prompt());
    await screen.findByRole("main", { name: "PixelPromptStudio Generator" });
    fireEvent.click(cutout());
    await waitFor(() => expect(flush).toHaveBeenCalledOnce());
    expect(prompt()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Studio switch blocked · prompt data was not saved · disk full",
    );
  });
  it("serializes competing studio transitions until the save has completed", async () => {
    let finish!: () => void;
    const flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<App flushPromptStorage={flush} vaultApi={testVaultClient()} />);
    fireEvent.click(prompt());
    await screen.findByRole("main", { name: "PixelPromptStudio Generator" });
    fireEvent.click(cutout());
    fireEvent.click(screen.getByRole("button", { name: "PixelSpriteStudio öffnen" }));
    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    expect(prompt()).toHaveAttribute("aria-pressed", "true");
    await act(async () => finish());
    expect(cutout()).toHaveAttribute("aria-pressed", "true");
  });
  it("does not close the vault if the prompt flush fails, then closes it exactly once after retry", async () => {
    const api = testVaultClient();
    const flush = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const view = render(
      <App flushPromptStorage={flush} vaultApi={api} dataFolderApi={testDataFolderClient()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await screen.findByRole("treeitem", { name: /hero.png/ });
    fireEvent.click(prompt());
    await screen.findByRole("main", { name: "PixelPromptStudio Generator" });
    fireEvent.click(screen.getByRole("button", { name: "Vault schließen" }));
    await waitFor(() =>
      expect(screen.getByRole("contentinfo")).toHaveTextContent("Vault close blocked"),
    );
    expect(api.close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Vault schließen" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Vault schließen" })).not.toBeInTheDocument(),
    );
    expect(api.close).toHaveBeenCalledExactlyOnceWith(testVault.session_id);
    view.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
  it("retains the current vault and releases the new session when closing the previous vault fails", async () => {
    const api = testVaultClient();
    vi.mocked(api.close)
      .mockRejectedValueOnce(new Error("writer busy"))
      .mockResolvedValue(undefined);
    render(<App vaultApi={api} dataFolderApi={testDataFolderClient()} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await screen.findByRole("treeitem", { name: /hero.png/ });
    vi.mocked(api.chooseDirectory).mockResolvedValue("/another-vault");
    vi.mocked(api.open).mockResolvedValue({
      ...testVault,
      path: "/another-vault",
      session_id: "new-session",
      session_generation: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await screen.findByText("writer busy");
    expect(screen.getByRole("region", { name: "Cutout-Arbeitsbereich" })).toHaveTextContent(
      "/test-vault",
    );
    expect(api.close).toHaveBeenNthCalledWith(1, testVault.session_id);
    expect(api.close).toHaveBeenNthCalledWith(2, "new-session");
  });
});
