import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("desktop shell", () => {
  it("boots the production shell with all structural regions", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toHaveTextContent("PixelCutoutSprite");
    expect(screen.getByRole("navigation", { name: "Studio sections" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Cutout animation");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Ready");
  });

  it("navigates to an explicitly marked placeholder", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Animations/ }));

    expect(screen.getByRole("heading", { name: "Animations" })).toBeInTheDocument();
    expect(screen.getByText(/intentionally marked as a placeholder/i)).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("opens and dismisses the shortcut dialog from the keyboard", () => {
    render(<App />);
    const help = screen.getByRole("button", { name: "Open shortcut help" });
    help.focus();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Studio shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close shortcut help" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Studio shortcuts" })).not.toBeInTheDocument();
    expect(help).toHaveFocus();
  });
});
