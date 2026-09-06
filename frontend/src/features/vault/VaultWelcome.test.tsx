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
  recovery: [],
  recovery_writable: true,
  lock_recovery: null,
};

function client(overrides: Partial<VaultClient>): VaultClient {
  return {
    chooseDirectory: vi.fn(async () => "/vault"),
    inspect: vi.fn(async (): Promise<VaultInspection> => ({ state: "empty", path: "/vault" })),
    generateExample: vi.fn(async () => ({
      vault_path: "/vault",
      project_id: "project",
      area_id: "area",
      profile_ref: { id: "profile", revision: 1 },
      generated_asset_count: 272,
      motions: [],
      npcs: [],
    })),
    initialize: vi.fn(async () => opened),
    open: vi.fn(async () => opened),
    close: vi.fn(async () => undefined),
    recent: vi.fn(async () => []),
    recover: vi.fn(async () => ({
      recovery: [],
      mode: "read_write" as const,
      recovery_writable: true,
      indexed_objects: 1,
    })),
    listRecovery: vi.fn(async () => ({
      recovery: [],
      mode: "read_write" as const,
      recovery_writable: true,
      indexed_objects: 1,
    })),
    recoverOrphanedLock: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => undefined),
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

  it("generates and opens Lichterhain through the packaged-app action", async () => {
    const onOpened = vi.fn();
    const api = client({});
    render(<VaultWelcome client={api} onOpened={onOpened} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Lichterhain example" }));

    await waitFor(() => expect(api.generateExample).toHaveBeenCalledWith("/vault"));
    expect(api.open).toHaveBeenCalledWith("/vault");
    expect(api.inspect).not.toHaveBeenCalled();
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

  it("requires a separate final confirmation before removing a recorded writer lock", async () => {
    const locked: VaultInspection = {
      state: "valid",
      path: "/vault",
      vault_id: "vault",
      writer_present: true,
      lock_recovery: {
        owner: {
          schema_version: 1,
          instance_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          process_id: 42,
          acquired_at: "2026-09-05T10:00:00Z",
          heartbeat_at: "2026-09-05T10:00:01Z",
          writer_token: "writer-token",
        },
        damaged: false,
        confirmation_token: "lock-token",
      },
    };
    const api = client({ inspect: vi.fn(async () => locked) });
    const onOpened = vi.fn();
    render(<VaultWelcome client={api} onOpened={onOpened} />);

    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(await screen.findByText(/process 42/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /I verified the previous app stopped/ }));
    expect(api.recoverOrphanedLock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Remove recorded lock and open/ }));

    await waitFor(() =>
      expect(api.recoverOrphanedLock).toHaveBeenCalledWith("/vault", "lock-token"),
    );
    expect(api.open).toHaveBeenCalledWith("/vault");
    expect(onOpened).toHaveBeenCalledWith(opened);
  });

  it("re-inspects a lock after a stale confirmation token fails", async () => {
    const locked: VaultInspection = {
      state: "valid",
      path: "/vault",
      vault_id: "vault",
      writer_present: true,
      lock_recovery: {
        owner: null,
        damaged: true,
        confirmation_token: "stale-token",
      },
    };
    const refreshed: VaultInspection = {
      ...locked,
      lock_recovery: { ...locked.lock_recovery!, confirmation_token: "fresh-token" },
    };
    const inspect = vi.fn().mockResolvedValueOnce(locked).mockResolvedValueOnce(refreshed);
    const api = client({
      inspect,
      recoverOrphanedLock: vi.fn(async () => {
        throw new Error("lock changed since inspection");
      }),
    });
    render(<VaultWelcome client={api} onOpened={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    await screen.findByText(/metadata is damaged/i);
    fireEvent.click(screen.getByRole("button", { name: /I verified the previous app stopped/ }));
    fireEvent.click(screen.getByRole("button", { name: /Remove recorded lock and open/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("current lock state was refreshed");
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(api.open).not.toHaveBeenCalled();
  });

  it("re-inspects the same path when the current session is read-only", async () => {
    const readOnly = { ...opened, mode: "read_only" as const, recovery_writable: false };
    const api = client({
      inspect: vi.fn(async (): Promise<VaultInspection> => ({
        state: "valid",
        path: "/vault",
        vault_id: opened.vault_id,
        writer_present: false,
        lock_recovery: null,
      })),
    });
    const onOpened = vi.fn();
    render(<VaultWelcome client={api} currentVault={readOnly} onOpened={onOpened} />);

    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));

    await waitFor(() => expect(api.inspect).toHaveBeenCalledWith("/vault"));
    expect(api.open).toHaveBeenCalledWith("/vault");
    expect(onOpened).toHaveBeenCalledWith(opened);
  });
});
