import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type VaultInspection =
  | { state: "empty"; path: string }
  | { state: "foreign"; path: string; entry_count: number; confirmation_token: string }
  | { state: "valid"; path: string; vault_id: string; writer_present: boolean }
  | { state: "damaged"; path: string; message: string };

export interface OpenVault {
  session_id: string;
  vault_id: string;
  path: string;
  mode: "read_write" | "read_only";
  indexed_objects: number;
  notice: string | null;
}

export interface VaultClient {
  chooseDirectory(): Promise<string | null>;
  inspect(path: string): Promise<VaultInspection>;
  initialize(path: string, confirmationToken?: string): Promise<OpenVault>;
  open(path: string): Promise<OpenVault>;
  close(sessionId: string): Promise<void>;
  recent(): Promise<string[]>;
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
};
