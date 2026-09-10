import { vi } from "vitest";
import type { OpenVault, VaultClient, VaultInspection } from "../shared/vault/vault-client";
import type { DataFolderClient } from "../shared/data-folder";

export const testVault: OpenVault = {
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  session_generation: 1,
  vault_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  path: "/test-vault",
  mode: "read_write",
  indexed_objects: 1,
  notice: null,
  recovery: [],
  recovery_writable: false,
  lock_recovery: null,
};
export function testVaultClient(vault: OpenVault = testVault): VaultClient {
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
    recover: vi.fn(),
    recoverOrphanedLock: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => undefined),
    listRecovery: vi.fn(async () => ({
      recovery: vault.recovery,
      mode: vault.mode,
      recovery_writable: vault.recovery_writable,
      indexed_objects: vault.indexed_objects,
    })),
  };
}
export function testDataFolderClient(): DataFolderClient {
  return {
    list: vi.fn(async (_session, query) => ({
      relativePath: query.relativePath,
      entries: [
        {
          name: "hero.png",
          relativePath: "hero.png",
          kind: "image" as const,
          technical: false,
          setCandidate: false,
          fingerprint: "a".repeat(64),
        },
      ],
      nextCursor: null,
      totalMatches: 1,
      skippedEntries: 0,
    })),
    inspect: vi.fn(async () => ({
      kind: "image" as const,
      relativePath: "hero.png",
      sha256: "b".repeat(64),
      width: 64,
      height: 96,
    })),
    thumbnail: vi.fn(async () => ({
      dataUrl: "data:image/png;base64,AA==",
      sha256: "b".repeat(64),
    })),
  };
}
