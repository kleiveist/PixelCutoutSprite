import { describe, expect, it, vi } from "vitest";
import { createBrowserOutputWorkspaceAdapter } from "./outputWorkspaceAdapter";

describe("browser output workspace adapter", () => {
  it("forwards clipboard text through the injected browser boundary", async () => {
    const writeText = vi.fn(async () => undefined);
    const browserWindow = {
      navigator: { clipboard: { writeText } },
    } as unknown as Window;
    const adapter = createBrowserOutputWorkspaceAdapter(browserWindow, document, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });

    await adapter.copyText("HAUPTPROMPT\nTest");

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("HAUPTPROMPT\nTest");
  });

  it("creates, clicks, removes, and revokes a local text download", async () => {
    const anchor = document.createElement("a");
    const click = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((
      tagName: string,
    ) => {
      if (tagName.toLowerCase() === "a") return anchor;
      throw new Error(`Unexpected element: ${tagName}`);
    }) as typeof document.createElement);
    const createObjectURL = vi.fn(() => "blob:prompt-output");
    const revokeObjectURL = vi.fn(() => undefined);
    const browserWindow = {
      navigator: { clipboard: { writeText: vi.fn() } },
    } as unknown as Window;
    const adapter = createBrowserOutputWorkspaceAdapter(browserWindow, document, {
      createObjectURL,
      revokeObjectURL,
    });

    await adapter.downloadTextFile({
      filename: "prompt.md",
      contents: "# Prompt\n\nPrompt content\n",
      mimeType: "text/markdown;charset=utf-8",
    });

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor).toHaveAttribute("download", "prompt.md");
    expect(anchor).toHaveAttribute("href", "blob:prompt-output");
    expect(click).toHaveBeenCalledOnce();
    expect(document.body.contains(anchor)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:prompt-output");
    createElement.mockRestore();
  });

  it("fails explicitly when clipboard or object URLs are unavailable", async () => {
    const browserWindow = { navigator: {} } as unknown as Window;
    const adapter = createBrowserOutputWorkspaceAdapter(browserWindow, document, {
      createObjectURL: undefined as never,
      revokeObjectURL: undefined as never,
    });

    await expect(adapter.copyText("test")).rejects.toThrow("Clipboard API");
    await expect(
      adapter.downloadTextFile({
        filename: "prompt.md",
        contents: "test",
        mimeType: "text/markdown;charset=utf-8",
      }),
    ).rejects.toThrow("download API");
  });
});
