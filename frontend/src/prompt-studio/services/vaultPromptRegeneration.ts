import type { ResolvedProfile } from "../domain/profiles";
import type { VaultBaseProfile, VaultPromptProfile } from "../schemas";
import { generateVaultPromptSnapshot, markVaultPromptOutputsStale } from "./vaultPromptGenerator";
import type { StoredVaultDocument, VaultPromptRepository } from "./vaultPromptRepository";

export interface RegenerationFailure {
  readonly profileId: string;
  readonly profileName: string;
  readonly message: string;
}

export interface RegenerationState {
  readonly status: "idle" | "running" | "complete" | "error";
  readonly total: number;
  readonly completed: number;
  readonly failures: readonly RegenerationFailure[];
}

export type ResolveVaultProfile = (
  profile: VaultPromptProfile,
  base: VaultBaseProfile,
) => ResolvedProfile | null;

/** Persists stale state first, then regenerates each valid profile through the shared writer. */
export class VaultPromptRegenerationQueue {
  private state: RegenerationState = {
    status: "idle",
    total: 0,
    completed: 0,
    failures: [],
  };

  constructor(
    private readonly repository: VaultPromptRepository,
    private readonly resolveProfile: ResolveVaultProfile,
    private readonly onState: (state: RegenerationState) => void = () => undefined,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get current(): RegenerationState {
    return this.state;
  }

  async regenerateAfterBaseChange(
    base: VaultBaseProfile,
    profiles: readonly StoredVaultDocument<VaultPromptProfile>[],
  ): Promise<void> {
    const targets = profiles.filter(
      ({ value }) =>
        value.status === "ready" &&
        value.baseProfileId === base.id &&
        value.outputs.generatedFrom?.baseRevision !== base.revision,
    );
    this.update({ status: "running", total: targets.length, completed: 0, failures: [] });
    const failures: RegenerationFailure[] = [];
    let completed = 0;
    for (const stored of targets) {
      try {
        const stale = markVaultPromptOutputsStale(stored.value, this.now);
        const staleStored = await this.repository.saveProfile(stale, stored.sha256);
        const resolved = this.resolveProfile(staleStored.value, base);
        if (!resolved) {
          throw new Error("Das Profil ist fachlich nicht vollständig und bleibt veraltet.");
        }
        const snapshot = await generateVaultPromptSnapshot({
          profile: staleStored.value,
          resolvedProfile: resolved,
          baseRevision: base.revision,
          now: this.now,
        });
        await this.repository.saveGeneration(
          snapshot.profile,
          snapshot.outputs,
          staleStored.sha256,
        );
      } catch (reason) {
        failures.push({
          profileId: stored.value.id,
          profileName: stored.value.name,
          message: reason instanceof Error ? reason.message : String(reason),
        });
      }
      completed += 1;
      this.update({
        status: failures.length > 0 ? "error" : "running",
        total: targets.length,
        completed,
        failures: [...failures],
      });
    }
    this.update({
      status: failures.length > 0 ? "error" : "complete",
      total: targets.length,
      completed,
      failures,
    });
  }

  private update(state: RegenerationState): void {
    this.state = state;
    this.onState(state);
  }
}
