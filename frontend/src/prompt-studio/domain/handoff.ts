export const PROMPT_HANDOFF_SCHEMA_VERSION = 1 as const;

export interface PromptHandoff {
  readonly schemaVersion: typeof PROMPT_HANDOFF_SCHEMA_VERSION;
  readonly category: string;
  readonly prompt: string;
  readonly negativePrompt: string;
  readonly technicalPrompt: string;
  readonly profileReferences: readonly string[];
  readonly createdAt: string;
}

export type PromptHandoffAvailability =
  Readonly<{ available: true }> | Readonly<{ available: false; reason: string }>;
