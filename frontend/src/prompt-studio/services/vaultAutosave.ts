import type { VaultPromptDraft, VaultPromptProfile } from "../schemas/v3Contracts.schema";
import type { StoredVaultDocument, VaultPromptRepository } from "./vaultPromptRepository";

export type VaultAutosaveState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "scheduled" }>
  | Readonly<{ status: "saving" }>
  | Readonly<{ status: "saved"; revision: number }>
  | Readonly<{ status: "error"; message: string }>;

type PendingSave =
  | Readonly<{ kind: "draft"; value: VaultPromptDraft; expectedSha256?: string }>
  | Readonly<{ kind: "profile"; value: VaultPromptProfile; expectedSha256?: string }>;

type AutosaveDocument = VaultPromptDraft | VaultPromptProfile;
type StoredAutosaveDocument = StoredVaultDocument<AutosaveDocument>;
type StoredCallback = (
  kind: PendingSave["kind"],
  stored: StoredAutosaveDocument,
) => Promise<StoredAutosaveDocument | void>;

/** 400 ms autosave with explicit flush; raw drafts and canonical profiles stay distinct. */
export class VaultPromptAutosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: PendingSave | null = null;
  private active: Promise<StoredAutosaveDocument> | null = null;
  private state: VaultAutosaveState = { status: "idle" };
  private readonly drafts = new Map<string, StoredVaultDocument<VaultPromptDraft>>();
  private readonly profiles = new Map<string, StoredVaultDocument<VaultPromptProfile>>();

  constructor(
    private readonly repository: VaultPromptRepository,
    private readonly onState: (state: VaultAutosaveState) => void = () => undefined,
    private readonly delayMs = 400,
    private readonly onStored: StoredCallback = async () => undefined,
  ) {}

  seed(
    drafts: readonly StoredVaultDocument<VaultPromptDraft>[],
    profiles: readonly StoredVaultDocument<VaultPromptProfile>[],
  ): void {
    this.drafts.clear();
    this.profiles.clear();
    for (const draft of drafts) this.drafts.set(draft.value.draftId, draft);
    for (const profile of profiles) this.profiles.set(profile.value.id, profile);
  }

  scheduleDraft(value: VaultPromptDraft, expectedSha256?: string): void {
    this.schedule({ kind: "draft", value, ...(expectedSha256 ? { expectedSha256 } : {}) });
  }

  scheduleProfile(value: VaultPromptProfile, expectedSha256?: string): void {
    this.schedule({ kind: "profile", value, ...(expectedSha256 ? { expectedSha256 } : {}) });
  }

  async flush(): Promise<void> {
    await this.commitPending();
    await this.repository.flush();
  }

  /** Publishes the debounce buffer without recursively flushing its SaveQueue. */
  async commitPending(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) await this.start();
    if (this.active) await this.active;
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(pending: PendingSave): void {
    this.pending = pending;
    if (this.timer !== null) clearTimeout(this.timer);
    this.update({ status: "scheduled" });
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.start().catch(() => undefined);
    }, this.delayMs);
  }

  private async start(): Promise<void> {
    if (this.active) {
      await this.active.catch(() => undefined);
      if (this.pending) return this.start();
      return;
    }
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.update({ status: "saving" });
    const prepared = this.prepare(pending);
    const operation = (async (): Promise<StoredAutosaveDocument> => {
      const stored =
        prepared.kind === "draft"
          ? await this.repository.saveDraft(prepared.value, prepared.expectedSha256)
          : await this.repository.saveProfile(prepared.value, prepared.expectedSha256);
      const replacement = await this.onStored(prepared.kind, stored);
      return replacement ?? stored;
    })();
    this.active = operation;
    try {
      const stored = await operation;
      this.remember(prepared.kind, stored);
      this.update({ status: "saved", revision: stored.revision });
    } catch (reason) {
      if (!this.pending) this.pending = pending;
      this.update({
        status: "error",
        message: reason instanceof Error ? reason.message : String(reason),
      });
      throw reason;
    } finally {
      this.active = null;
    }
    if (this.pending && this.state.status !== "error") await this.start();
  }

  private update(state: VaultAutosaveState): void {
    this.state = state;
    this.onState(state);
  }

  private prepare(pending: PendingSave): PendingSave {
    if (pending.kind === "draft") {
      const current = this.drafts.get(pending.value.draftId);
      return {
        ...pending,
        value: {
          ...pending.value,
          revision: current ? current.revision + 1 : 1,
        },
        ...(current
          ? { expectedSha256: current.sha256 }
          : pending.expectedSha256
            ? { expectedSha256: pending.expectedSha256 }
            : {}),
      };
    }
    const current = this.profiles.get(pending.value.id);
    return {
      ...pending,
      value: {
        ...pending.value,
        revision: current ? current.revision + 1 : 1,
        draftRevision: current ? current.value.draftRevision + 1 : pending.value.draftRevision,
      },
      ...(current
        ? { expectedSha256: current.sha256 }
        : pending.expectedSha256
          ? { expectedSha256: pending.expectedSha256 }
          : {}),
    };
  }

  private remember(kind: PendingSave["kind"], stored: StoredAutosaveDocument): void {
    if (kind === "draft" && stored.value.kind === "vaultPromptDraft") {
      this.drafts.set(stored.value.draftId, stored as StoredVaultDocument<VaultPromptDraft>);
    }
    if (kind === "profile" && stored.value.kind === "vaultPromptProfile") {
      this.profiles.set(stored.value.id, stored as StoredVaultDocument<VaultPromptProfile>);
    }
  }
}
