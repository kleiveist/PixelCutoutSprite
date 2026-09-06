import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

describe("AppHeader studio switcher", () => {
  it("renders equal, accessible studio buttons and keeps desktop actions", async () => {
    const user = userEvent.setup();
    const onOpenCutoutStudio = vi.fn();
    const onOpenPromptStudio = vi.fn();
    const onHelp = vi.fn();

    render(
      <AppHeader
        activeStudio="cutout"
        onOpenCutoutStudio={onOpenCutoutStudio}
        onOpenPromptStudio={onOpenPromptStudio}
        onHelp={onHelp}
      />,
    );

    const cutout = screen.getByRole("button", {
      name: "PixelCutoutSprite Studio öffnen",
    });
    const prompt = screen.getByRole("button", {
      name: "PixelPromptStudio Generator öffnen",
    });

    expect(cutout).toHaveAttribute("type", "button");
    expect(prompt).toHaveAttribute("type", "button");
    expect(cutout).toHaveClass("studio-switch-button");
    expect(prompt).toHaveClass("studio-switch-button");
    expect(cutout).toHaveAttribute("aria-pressed", "true");
    expect(prompt).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("LOCAL DESKTOP")).toBeInTheDocument();

    await user.click(prompt);
    expect(onOpenPromptStudio).toHaveBeenCalledOnce();

    cutout.focus();
    await user.keyboard("{Enter}");
    expect(onOpenCutoutStudio).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Open shortcut help" }));
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("marks the prompt generator as active", () => {
    render(
      <AppHeader
        activeStudio="prompt"
        onOpenCutoutStudio={() => undefined}
        onOpenPromptStudio={() => undefined}
        onHelp={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
