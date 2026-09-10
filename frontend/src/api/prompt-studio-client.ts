import { invoke } from "@tauri-apps/api/core";

import type { PromptHandoff } from "../prompt-studio/domain/handoff";
import type { SessionIdentity } from "../shared/storage";
import { VaultRelativePathSchema } from "../prompt-studio/schemas";

export function revealWorkspacePath(session: SessionIdentity, relativePath: string): Promise<void> {
  return invoke<void>("reveal_workspace_path", {
    sessionId: session.sessionId,
    sessionGeneration: session.generation,
    relativePath: VaultRelativePathSchema.parse(relativePath),
  });
}

export interface PromptHandoffReceipt {
  relative_path: string;
}

export interface PromptStudioClient {
  handoff(sessionId: string, areaId: string, handoff: PromptHandoff): Promise<PromptHandoffReceipt>;
}

export const promptStudioClient: PromptStudioClient = {
  handoff(sessionId, areaId, handoff) {
    return invoke<PromptHandoffReceipt>("handoff_prompt_to_area", {
      sessionId,
      areaId,
      handoff,
    });
  },
};
