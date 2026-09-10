import { invoke } from "@tauri-apps/api/core";

import type { SessionIdentity } from "../shared/storage";
import { VaultRelativePathSchema } from "../prompt-studio/schemas";

export function revealWorkspacePath(session: SessionIdentity, relativePath: string): Promise<void> {
  return invoke<void>("reveal_workspace_path", {
    sessionId: session.sessionId,
    sessionGeneration: session.generation,
    relativePath: VaultRelativePathSchema.parse(relativePath),
  });
}
