import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type VaultInspection =
  | { state: "empty"; path: string }
  | { state: "foreign"; path: string; entry_count: number; confirmation_token: string }
  | {
      state: "valid";
      path: string;
      vault_id: string;
      writer_present: boolean;
      lock_recovery: LockRecovery | null;
    }
  | { state: "damaged"; path: string; message: string };

export interface LockOwner {
  schema_version: number;
  instance_id: string;
  process_id: number;
  acquired_at: string;
  heartbeat_at: string;
  writer_token: string;
}

export interface LockRecovery {
  owner: LockOwner | null;
  damaged: boolean;
  confirmation_token: string;
}

export type TransactionPurpose =
  | "general"
  | "project_create"
  | "project_rename"
  | "workspace_label_remove"
  | "character_rename"
  | "asset_import"
  | "release_revision"
  | "export_completion"
  | "trash_move"
  | "migration";

export interface RecoveryCandidate {
  transaction_id: string;
  project: string;
  journal: string;
  purpose: TransactionPurpose;
  state: "prepared" | "applying" | "rolling_back" | "needs_recovery";
  completed_steps: number;
  total_steps: number;
  can_resume: boolean;
  can_rollback: boolean;
  issue: string | null;
}

export interface RecoveryStatus {
  recovery: RecoveryCandidate[];
  mode: "read_write" | "read_only";
  recovery_writable: boolean;
  indexed_objects: number;
}

export interface OpenVault {
  session_id: string;
  session_generation?: number;
  vault_id: string;
  path: string;
  mode: "read_write" | "read_only";
  indexed_objects: number;
  notice: string | null;
  recovery: RecoveryCandidate[];
  recovery_writable: boolean;
  lock_recovery: LockRecovery | null;
}

export interface VaultClient {
  chooseDirectory(): Promise<string | null>;
  inspect(path: string): Promise<VaultInspection>;
  initialize(path: string, confirmationToken?: string): Promise<OpenVault>;
  open(path: string): Promise<OpenVault>;
  close(sessionId: string): Promise<void>;
  recent(): Promise<string[]>;
  recover(
    sessionId: string,
    transactionId: string,
    choice: "resume" | "rollback",
  ): Promise<RecoveryStatus>;
  listRecovery(sessionId: string): Promise<RecoveryStatus>;
  recoverOrphanedLock(path: string, confirmationToken: string): Promise<void>;
  heartbeat(sessionId: string): Promise<void>;
}

export const vaultClient: VaultClient = {
  async chooseDirectory() {
    const selected = await open({
      title: "Choose a PixelCutoutSprite vault",
      directory: true,
      multiple: false,
      canCreateDirectories: true,
    });
    return typeof selected === "string" ? selected : null;
  },
  inspect(path) {
    return invoke<VaultInspection>("inspect_vault", { path });
  },
  initialize(path, confirmationToken) {
    return invoke<OpenVault>("initialize_vault", {
      path,
      confirmationToken: confirmationToken ?? null,
    });
  },
  open(path) {
    return invoke<OpenVault>("open_vault", { path });
  },
  close(sessionId) {
    return invoke<void>("close_vault", { sessionId });
  },
  recent() {
    return invoke<string[]>("recent_vaults");
  },
  recover(sessionId, transactionId, choice) {
    return invoke<RecoveryStatus>("recover_transaction", { sessionId, transactionId, choice });
  },
  listRecovery(sessionId) {
    return invoke<RecoveryStatus>("list_recovery", { sessionId });
  },
  recoverOrphanedLock(path, confirmationToken) {
    return invoke<void>("recover_orphaned_lock", { path, confirmationToken });
  },
  heartbeat(sessionId) {
    return invoke<void>("heartbeat_vault", { sessionId });
  },
};
