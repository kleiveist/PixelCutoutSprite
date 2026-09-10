import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { testDataFolderClient } from "./appTestFixtures";
import type {
  OpenVault,
  RecoveryCandidate,
  VaultClient,
  VaultInspection,
} from "../shared/vault/vault-client";
import { App } from "./App";

const first: RecoveryCandidate = {
  transaction_id: "11111111-1111-4111-8111-111111111111",
  project: "first-project--11111111",
  journal: "first-project--11111111/.project/transactions/11111111.json",
  purpose: "project_rename",
  state: "needs_recovery",
  completed_steps: 1,
  total_steps: 2,
  can_resume: true,
  can_rollback: true,
  issue: null,
};
const second: RecoveryCandidate = {
  transaction_id: "22222222-2222-4222-8222-222222222222",
  project: "second-project--22222222",
  journal: "second-project--22222222/.project/transactions/22222222.json",
  purpose: "asset_import",
  state: "prepared",
  completed_steps: 0,
  total_steps: 3,
  can_resume: true,
  can_rollback: true,
  issue: null,
};

describe("App vault recovery", () => {
  it("keeps two candidates exclusive to one session and mounts Welcome only after both resolve", async () => {
    const vault: OpenVault = {
      session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      path: "/vault",
      mode: "read_write",
      indexed_objects: 2,
      notice: null,
      recovery: [first, second],
      recovery_writable: true,
      lock_recovery: null,
    };
    const recover = vi
      .fn<VaultClient["recover"]>()
      .mockResolvedValueOnce({
        recovery: [second],
        mode: "read_only",
        recovery_writable: true,
        indexed_objects: 2,
      })
      .mockResolvedValueOnce({
        recovery: [],
        mode: "read_write",
        recovery_writable: true,
        indexed_objects: 3,
      });
    const vaultApi = createVaultClient(vault, recover);
    const dataFolderApi = testDataFolderClient();
    const view = render(<App vaultApi={vaultApi} dataFolderApi={dataFolderApi} />);

    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(
      await screen.findByRole("heading", { name: /Interrupted file operations/ }),
    ).toBeInTheDocument();
    // The recovery heading can render before the passive heartbeat effect has run.
    await waitFor(() => expect(vaultApi.heartbeat).toHaveBeenCalledTimes(1));
    expect(dataFolderApi.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    expect(
      screen.getByRole("heading", { name: /Interrupted file operations/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("blocked until vault recovery");

    const firstItem = screen.getByText(first.transaction_id).closest("li");
    fireEvent.click(within(firstItem!).getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(screen.queryByText(first.transaction_id)).not.toBeInTheDocument());
    expect(screen.getByText(second.transaction_id)).toBeInTheDocument();
    expect(vaultApi.close).not.toHaveBeenCalled();
    expect(vaultApi.heartbeat).toHaveBeenCalledTimes(1);
    expect(dataFolderApi.list).not.toHaveBeenCalled();

    const secondItem = screen.getByText(second.transaction_id).closest("li");
    fireEvent.click(within(secondItem!).getByRole("button", { name: "Resume" }));
    expect(
      await screen.findByRole("heading", { name: "Willkommen im Cutout-Studio" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(dataFolderApi.list).toHaveBeenCalled());
    expect(recover).toHaveBeenNthCalledWith(1, vault.session_id, first.transaction_id, "resume");
    expect(recover).toHaveBeenNthCalledWith(2, vault.session_id, second.transaction_id, "resume");
    expect(vaultApi.close).not.toHaveBeenCalled();

    view.unmount();
    await waitFor(() => expect(vaultApi.close).toHaveBeenCalledWith(vault.session_id));
  });

  it("reports a heartbeat failure without closing or replacing the open session", async () => {
    const vault: OpenVault = {
      session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      path: "/vault",
      mode: "read_write",
      indexed_objects: 2,
      notice: null,
      recovery: [],
      recovery_writable: true,
      lock_recovery: null,
    };
    const vaultApi = createVaultClient(vault, vi.fn());
    vi.mocked(vaultApi.heartbeat).mockRejectedValueOnce({
      code: "writer_lock_lost",
      message: "writer lock ownership changed",
    });

    render(<App vaultApi={vaultApi} dataFolderApi={testDataFolderClient()} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));

    await waitFor(() =>
      expect(screen.getByRole("contentinfo")).toHaveTextContent(
        "Vault heartbeat failed · writer lock ownership changed",
      ),
    );
    expect(vaultApi.close).not.toHaveBeenCalled();
    expect(vaultApi.open).toHaveBeenCalledTimes(1);
  });

  it("does not heartbeat an ordinary read-only session without recovery ownership", async () => {
    const vault: OpenVault = {
      session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      path: "/vault",
      mode: "read_only",
      indexed_objects: 2,
      notice: "Opened read-only because another writer is active",
      recovery: [],
      recovery_writable: false,
      lock_recovery: null,
    };
    const vaultApi = createVaultClient(vault, vi.fn());

    render(<App vaultApi={vaultApi} dataFolderApi={testDataFolderClient()} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));

    await screen.findByRole("region", { name: "Cutout-Arbeitsbereich" });
    expect(vaultApi.heartbeat).not.toHaveBeenCalled();
  });

  it("switches to exclusive recovery when a live client call discovers a journal", async () => {
    const vault: OpenVault = {
      session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      path: "/vault",
      mode: "read_write",
      indexed_objects: 2,
      notice: null,
      recovery: [],
      recovery_writable: true,
      lock_recovery: null,
    };
    const vaultApi = createVaultClient(vault, vi.fn());
    vi.mocked(vaultApi.listRecovery).mockResolvedValue({
      recovery: [first],
      mode: "read_only",
      recovery_writable: true,
      indexed_objects: 2,
    });
    const dataFolderApi = testDataFolderClient();
    vi.mocked(dataFolderApi.list).mockRejectedValueOnce({
      code: "recovery_required",
      message: "interrupted transaction requires recovery",
    });

    render(<App vaultApi={vaultApi} dataFolderApi={dataFolderApi} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));

    expect(
      await screen.findByRole("heading", { name: /Interrupted file operations/ }),
    ).toBeInTheDocument();
    expect(vaultApi.listRecovery).toHaveBeenCalledWith(vault.session_id);
    expect(screen.getByText(first.transaction_id)).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("require recovery");
  });
});

function createVaultClient(vault: OpenVault, recover: VaultClient["recover"]): VaultClient {
  return {
    chooseDirectory: vi.fn(async () => vault.path),
    inspect: vi.fn(async (): Promise<VaultInspection> => ({
      state: "valid",
      path: vault.path,
      vault_id: vault.vault_id,
      writer_present: false,
      lock_recovery: null,
    })),
    initialize: vi.fn(async () => vault),
    open: vi.fn(async () => vault),
    close: vi.fn(async () => undefined),
    recent: vi.fn(async () => []),
    recover,
    listRecovery: vi.fn(async () => ({
      recovery: vault.recovery,
      mode: vault.mode,
      recovery_writable: vault.recovery_writable,
      indexed_objects: vault.indexed_objects,
    })),
    recoverOrphanedLock: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => undefined),
  };
}
