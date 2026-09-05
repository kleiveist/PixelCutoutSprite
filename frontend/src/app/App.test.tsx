import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProjectClient } from "../api/project-client";
import type { OpenVault, VaultClient, VaultInspection } from "../api/vault-client";
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

  it("shows the real project dashboard immediately after a vault opens", async () => {
    const vaultApi: VaultClient = {
      chooseDirectory: vi.fn(async () => "/vault"),
      inspect: vi.fn(async (): Promise<VaultInspection> => ({
        state: "valid",
        path: "/vault",
        vault_id: "vault",
        writer_present: false,
      })),
      initialize: vi.fn(),
      open: vi.fn(async (): Promise<OpenVault> => ({
        session_id: "session",
        vault_id: "vault",
        path: "/vault",
        mode: "read_write",
        indexed_objects: 1,
        notice: null,
      })),
      close: vi.fn(async () => undefined),
      recent: vi.fn(async () => []),
    };
    const projectsApi = {
      dashboard: vi.fn(async () => ({
        projects: [],
        labels: [],
        writable: true,
        view: {
          schema_version: 1,
          kind: "project_view",
          revision: 1,
          search: "",
          label_ids: [],
          label_match: "any",
          status: "any",
          sort: "updated_desc",
          updated_at: "2026-09-05T12:00:00Z",
        },
      })),
    } as unknown as ProjectClient;

    render(<App vaultApi={vaultApi} projectsApi={projectsApi} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });
});
