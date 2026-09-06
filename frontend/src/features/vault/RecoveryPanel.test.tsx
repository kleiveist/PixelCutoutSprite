import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OpenVault, RecoveryCandidate, VaultClient } from "../../api/vault-client";
import { RecoveryPanel } from "./RecoveryPanel";

const candidate: RecoveryCandidate = {
  transaction_id: "11111111-1111-4111-8111-111111111111",
  project: "my-rpg--11111111",
  journal: "my-rpg--11111111/.project/transactions/11111111.json",
  purpose: "asset_import",
  state: "needs_recovery",
  completed_steps: 1,
  total_steps: 3,
  can_resume: true,
  can_rollback: true,
  issue: null,
};

function openVault(mode: OpenVault["mode"] = "read_write"): OpenVault {
  return {
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    path: "/vault",
    mode,
    indexed_objects: 4,
    notice: null,
    recovery: [candidate],
    recovery_writable: mode === "read_write",
    lock_recovery: null,
  };
}

function client(overrides: Partial<VaultClient> = {}): VaultClient {
  return {
    chooseDirectory: vi.fn(async () => null),
    inspect: vi.fn(),
    generateExample: vi.fn(),
    initialize: vi.fn(),
    open: vi.fn(),
    close: vi.fn(async () => undefined),
    recent: vi.fn(async () => []),
    recover: vi.fn(async () => ({
      recovery: [],
      mode: "read_write" as const,
      recovery_writable: true,
      indexed_objects: 4,
    })),
    listRecovery: vi.fn(async () => ({
      recovery: [candidate],
      mode: "read_only" as const,
      recovery_writable: false,
      indexed_objects: 4,
    })),
    recoverOrphanedLock: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("RecoveryPanel", () => {
  it("recovers by opaque transaction identity and forwards the refreshed candidates", async () => {
    const api = client();
    const onRecovered = vi.fn();
    render(<RecoveryPanel vault={openVault()} client={api} onRecovered={onRecovered} />);

    const item = screen.getByText(candidate.transaction_id).closest("li");
    fireEvent.click(within(item!).getByRole("button", { name: "Resume" }));

    await waitFor(() =>
      expect(api.recover).toHaveBeenCalledWith(
        openVault().session_id,
        candidate.transaction_id,
        "resume",
      ),
    );
    expect(onRecovered).toHaveBeenCalledWith({
      recovery: [],
      mode: "read_write",
      recovery_writable: true,
      indexed_objects: 4,
    });
  });

  it("keeps recovery mutations disabled in read-only sessions but allows a refresh", async () => {
    const api = client();
    const onRecovered = vi.fn();
    render(<RecoveryPanel vault={openVault("read_only")} client={api} onRecovered={onRecovered} />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore backup" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh recovery state" }));
    await waitFor(() => expect(api.listRecovery).toHaveBeenCalledWith(openVault().session_id));
    expect(onRecovered).toHaveBeenCalledWith({
      recovery: [candidate],
      mode: "read_only",
      recovery_writable: false,
      indexed_objects: 4,
    });
  });
});
