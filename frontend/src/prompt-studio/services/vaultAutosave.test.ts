import { afterEach, describe, expect, it, vi } from "vitest";

import { VaultPromptDraftSchema, type VaultPromptDraft } from "../schemas";
import { VaultPromptAutosave } from "./vaultAutosave";
import type { StoredVaultDocument, VaultPromptRepository } from "./vaultPromptRepository";

const timestamp = "2026-09-09T12:00:00.000Z";

function draft(revision = 1, name = "Zwischenstand"): VaultPromptDraft {
  return VaultPromptDraftSchema.parse({
    schemaVersion: 3,
    kind: "vaultPromptDraft",
    draftId: "draft_autosave",
    profileId: null,
    revision,
    identity: { name, category: null, subtype: null },
    rawValues: { projectName: name },
    wizard: { currentStepId: "project", completedStepIds: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function repository(saveDraft: VaultPromptRepository["saveDraft"]): VaultPromptRepository {
  return {
    scan: vi.fn(async () => ({ baseProfile: null, profiles: [], drafts: [], issues: [] })),
    saveBaseProfile: vi.fn(),
    saveDraft,
    saveProfile: vi.fn(),
    saveGeneration: vi.fn(async () => []),
    removeDraft: vi.fn(async () => undefined),
    applyMigration: vi.fn(async () => []),
    flush: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("VaultPromptAutosave", () => {
  it("debounces for 400 ms and persists only the newest raw state", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn(async (value: VaultPromptDraft) => ({
      relativePath: `.PixelPrompt/.drafts/${value.draftId}.json`,
      value,
      revision: value.revision,
      sha256: "a".repeat(64),
    }));
    const controller = new VaultPromptAutosave(repository(saveDraft));

    controller.scheduleDraft(draft(1, "Alt"));
    controller.scheduleDraft(draft(1, "Neu"));
    await vi.advanceTimersByTimeAsync(399);
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(saveDraft).toHaveBeenCalledOnce();
    expect(saveDraft.mock.calls[0]?.[0].identity.name).toBe("Neu");
  });

  it("rebases queued revisions on the last stored or generated receipt", async () => {
    const saves: Array<Readonly<{ revision: number; expected?: string }>> = [];
    const saveDraft = vi.fn(async (value: VaultPromptDraft, expected?: string) => {
      saves.push({ revision: value.revision, ...(expected ? { expected } : {}) });
      return {
        relativePath: `.PixelPrompt/.drafts/${value.draftId}.json`,
        value,
        revision: value.revision,
        sha256: "b".repeat(64),
      };
    });
    const controller = new VaultPromptAutosave(
      repository(saveDraft),
      () => undefined,
      400,
      async (_kind, stored) => ({ ...stored, revision: 6, sha256: "c".repeat(64) }),
    );
    controller.seed(
      [
        {
          relativePath: ".PixelPrompt/.drafts/draft_autosave.json",
          value: draft(4),
          revision: 4,
          sha256: "a".repeat(64),
        },
      ],
      [],
    );

    controller.scheduleDraft(draft());
    await controller.commitPending();
    controller.scheduleDraft(draft());
    await controller.commitPending();

    expect(saves).toEqual([
      { revision: 5, expected: "a".repeat(64) },
      { revision: 7, expected: "c".repeat(64) },
    ]);
  });

  it("keeps a failed write pending for an explicit retry", async () => {
    let attempt = 0;
    const saveDraft = vi.fn(async (value: VaultPromptDraft) => {
      attempt += 1;
      if (attempt === 1) throw new Error("disk full");
      return {
        relativePath: `.PixelPrompt/.drafts/${value.draftId}.json`,
        value,
        revision: value.revision,
        sha256: "d".repeat(64),
      } satisfies StoredVaultDocument<VaultPromptDraft>;
    });
    const states: string[] = [];
    const controller = new VaultPromptAutosave(repository(saveDraft), (state) =>
      states.push(state.status),
    );

    controller.scheduleDraft(draft());
    await expect(controller.commitPending()).rejects.toThrow("disk full");
    await controller.commitPending();

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(states).toContain("error");
    expect(states.at(-1)).toBe("saved");
  });
});
