import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OpenVault, VaultClient, VaultInspection } from "../../api/vault-client";
import { VaultWelcome } from "./VaultWelcome";

const opened: OpenVault = {
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  path: "/vault",
  mode: "read_write",
  indexed_objects: 1,
  notice: null,
};

function client(overrides: Partial<VaultClient>): VaultClient {
  return {
    chooseDirectory: vi.fn(async () => "/vault"),
    inspect: vi.fn(async (): Promise<VaultInspection> => ({ state: "empty", path: "/vault" })),
    initialize: vi.fn(async () => opened),
    open: vi.fn(async () => opened),
    close: vi.fn(async () => undefined),
    recent: vi.fn(async () => []),
    ...overrides,
  };
}

describe("VaultWelcome", () => {
  it("initializes an explicitly selected empty directory", async () => {
    const onOpened = vi.fn();
    const api = client({});
    render(<VaultWelcome client={api} onOpened={onOpened} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await waitFor(() => expect(api.initialize).toHaveBeenCalledWith("/vault"));
    expect(onOpened).toHaveBeenCalledWith(opened);
  });

  it("requires a second explicit action for a foreign directory", async () => {
    const onOpened = vi.fn();
    const api = client({
      inspect: vi.fn(async (): Promise<VaultInspection> => ({
        state: "foreign",
        path: "/vault",
        entry_count: 2,
        confirmation_token: "snapshot-token",
      })),
    });
    render(<VaultWelcome client={api} onOpened={onOpened} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(await screen.findByText(/2 existing entries/)).toBeInTheDocument();
    expect(api.initialize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Initialize without replacing/ }));
    await waitFor(() => expect(api.initialize).toHaveBeenCalledWith("/vault", "snapshot-token"));
    expect(onOpened).toHaveBeenCalledWith(opened);
  });

  it("reports a damaged vault without trying to initialize it", async () => {
    const api = client({
      inspect: vi.fn(async (): Promise<VaultInspection> => ({
        state: "damaged",
        path: "/vault",
        message: "invalid vault.json",
      })),
    });
    render(<VaultWelcome client={api} onOpened={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("needs repair");
    expect(api.initialize).not.toHaveBeenCalled();
  });
});
