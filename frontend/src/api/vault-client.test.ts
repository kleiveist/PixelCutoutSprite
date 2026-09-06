import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: runtime.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: runtime.open }));

import { vaultClient, type RecoveryStatus } from "./vault-client";

const status: RecoveryStatus = {
  recovery: [],
  mode: "read_write",
  recovery_writable: true,
  indexed_objects: 7,
};

beforeEach(() => {
  runtime.invoke.mockReset().mockResolvedValue(status);
  runtime.open.mockReset();
});

describe("vault client", () => {
  it("generates the example only at the explicitly selected path", async () => {
    await vaultClient.generateExample("/vault/Lichterhain");

    expect(runtime.invoke).toHaveBeenCalledWith("generate_example_vault", {
      path: "/vault/Lichterhain",
    });
  });

  it("addresses recovery only by session and opaque transaction identity", async () => {
    await vaultClient.listRecovery("session-1");
    await vaultClient.recover("session-1", "transaction-1", "rollback");

    expect(runtime.invoke).toHaveBeenNthCalledWith(1, "list_recovery", {
      sessionId: "session-1",
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(2, "recover_transaction", {
      sessionId: "session-1",
      transactionId: "transaction-1",
      choice: "rollback",
    });
    expect(runtime.invoke.mock.calls.flatMap((call) => Object.keys(call[1] ?? {}))).not.toContain(
      "journal",
    );
  });

  it("heartbeats and removes a confirmed orphan lock with the exact native payloads", async () => {
    await vaultClient.heartbeat("session-1");
    await vaultClient.recoverOrphanedLock("/vault", "confirmation-1");

    expect(runtime.invoke).toHaveBeenNthCalledWith(1, "heartbeat_vault", {
      sessionId: "session-1",
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(2, "recover_orphaned_lock", {
      path: "/vault",
      confirmationToken: "confirmation-1",
    });
  });
});
