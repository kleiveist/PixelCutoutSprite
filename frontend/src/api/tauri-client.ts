import { invoke } from "@tauri-apps/api/core";

export interface DesktopIdentity {
  name: string;
  version: string;
}

export function readDesktopIdentity(): Promise<DesktopIdentity> {
  return invoke<DesktopIdentity>("desktop_identity");
}
