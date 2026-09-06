import { invoke } from "@tauri-apps/api/core";

import type { PromptHandoff } from "../prompt-studio/domain/handoff";

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
