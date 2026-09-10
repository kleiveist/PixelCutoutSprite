import { invoke, isTauri } from "@tauri-apps/api/core";
import { revealWorkspacePath } from "../../api/prompt-studio-client";

import {
  VaultBaseProfileSchema,
  VaultPromptDraftSchema,
  VaultPromptProfileEnvelopeSchema,
  type VaultBaseProfile,
  type VaultPromptDraft,
  type VaultPromptProfile,
} from "../schemas";
import { RepositoryError, type SaveQueue, type SessionIdentity } from "../../shared/storage";
import type { PromptVaultMigrationBundle } from "./legacyVaultMigration";

export interface StoredVaultDocument<Value> {
  readonly relativePath: string;
  readonly value: Value;
  readonly sha256: string;
  readonly revision: number;
}

export interface PromptVaultIssue {
  readonly code: string;
  readonly relativePath: string;
  readonly message: string;
}

export interface PromptVaultIndex {
  readonly baseProfile: StoredVaultDocument<VaultBaseProfile> | null;
  readonly profiles: readonly StoredVaultDocument<VaultPromptProfile>[];
  readonly drafts: readonly StoredVaultDocument<VaultPromptDraft>[];
  readonly issues: readonly PromptVaultIssue[];
}

export interface GeneratedOutputWrite {
  readonly relativePath: string;
  readonly contents: string;
}

export interface StoredPromptGeneration {
  readonly profile: StoredVaultDocument<VaultPromptProfile>;
  readonly outputs: readonly GeneratedOutputWrite[];
  readonly fresh: boolean;
  readonly baseRevision: number | null;
}

export interface VaultPromptRepository {
  scan(): Promise<PromptVaultIndex>;
  readGeneration(profileId: string, expectedSha256: string): Promise<StoredPromptGeneration>;
  revealPath(relativePath: string): Promise<void>;
  saveBaseProfile(
    value: VaultBaseProfile,
    expectedSha256?: string,
  ): Promise<StoredVaultDocument<VaultBaseProfile>>;
  saveDraft(
    value: VaultPromptDraft,
    expectedSha256?: string,
  ): Promise<StoredVaultDocument<VaultPromptDraft>>;
  saveProfile(
    value: VaultPromptProfile,
    expectedSha256?: string,
  ): Promise<StoredVaultDocument<VaultPromptProfile>>;
  saveGeneration(
    value: VaultPromptProfile,
    outputs: readonly GeneratedOutputWrite[],
    expectedSha256?: string,
  ): Promise<readonly { relativePath: string; sha256: string; revision: number | null }[]>;
  removeDraft(draftId: string, expectedSha256: string): Promise<void>;
  applyMigration(bundle: PromptVaultMigrationBundle): Promise<readonly VaultWriteReceipt[]>;
  flush(): Promise<void>;
}

interface NativeStoredDocument {
  readonly relativePath: string;
  readonly value: unknown;
  readonly sha256: string;
  readonly revision: number;
}

interface NativePromptVaultIndex {
  readonly baseProfile: NativeStoredDocument | null;
  readonly profiles: readonly NativeStoredDocument[];
  readonly drafts: readonly NativeStoredDocument[];
  readonly issues: readonly PromptVaultIssue[];
}

export interface VaultWriteReceipt {
  readonly relativePath: string;
  readonly sha256: string;
  readonly revision: number | null;
}

function classifyRepositoryError(reason: unknown): RepositoryError {
  if (reason instanceof RepositoryError) return reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const normalized = message.toLocaleLowerCase("en-US");
  if (normalized.includes("conflict") || normalized.includes("changed since")) {
    return new RepositoryError("write_conflict", message, reason);
  }
  if (normalized.includes("read-only") || normalized.includes("read only")) {
    return new RepositoryError("read_only", message, reason);
  }
  if (normalized.includes("invalid") || normalized.includes("schema")) {
    return new RepositoryError("invalid_data", message, reason);
  }
  return new RepositoryError("io_error", message, reason);
}

function parseDocument<Value>(
  document: NativeStoredDocument,
  parse: (value: unknown) => Value,
): StoredVaultDocument<Value> {
  return {
    relativePath: document.relativePath,
    value: parse(document.value),
    sha256: document.sha256,
    revision: document.revision,
  };
}

export class NativeVaultPromptRepository implements VaultPromptRepository {
  constructor(
    private readonly session: SessionIdentity,
    private readonly queue: SaveQueue,
  ) {}

  async scan(): Promise<PromptVaultIndex> {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        const result = await invoke<NativePromptVaultIndex>("scan_prompt_vault", {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
        });
        assertCurrent();
        const issues = [...result.issues];
        const parseOne = <Value>(
          document: NativeStoredDocument,
          parse: (value: unknown) => Value,
        ) => {
          try {
            return parseDocument(document, parse);
          } catch {
            issues.push({
              code: "invalid_document",
              relativePath: document.relativePath,
              message: "Das Dokument entspricht nicht dem vollständigen V3-Schema.",
            });
            return null;
          }
        };
        const baseProfile = result.baseProfile
          ? parseOne(result.baseProfile, (value) => VaultBaseProfileSchema.parse(value))
          : null;
        const profiles = result.profiles.flatMap((document) => {
          const valid = parseOne(document, (value) =>
            VaultPromptProfileEnvelopeSchema.parse(value),
          );
          return valid ? [valid] : [];
        });
        const drafts = result.drafts.flatMap((document) => {
          const valid = parseOne(document, (value) => VaultPromptDraftSchema.parse(value));
          return valid ? [valid] : [];
        });
        return { baseProfile, profiles, drafts, issues };
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  readGeneration(profileId: string, expectedSha256: string): Promise<StoredPromptGeneration> {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        const result = await invoke<StoredPromptGeneration>("read_prompt_vault_generation", {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
          profileId,
          expectedSha256,
        });
        assertCurrent();
        const profile = parseDocument(result.profile, (value) =>
          VaultPromptProfileEnvelopeSchema.parse(value),
        );
        if (profile.sha256 !== expectedSha256 || profile.value.id !== profileId) {
          throw new RepositoryError(
            "write_conflict",
            "Die Ausgabe gehört zu einem anderen Profilstand.",
          );
        }
        if (
          result.outputs.length !== profile.value.outputs.files.length ||
          profile.value.outputs.files.some(
            (file) =>
              result.outputs.filter((output) => output.relativePath === file.relativePath)
                .length !== 1,
          )
        ) {
          throw new RepositoryError("invalid_data", "Die Ausgabedateien sind unvollständig.");
        }
        return { ...result, profile };
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  revealPath(relativePath: string): Promise<void> {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      await revealWorkspacePath(this.session, relativePath);
      assertCurrent();
    });
  }

  saveBaseProfile(value: VaultBaseProfile, expectedSha256?: string) {
    const valid = VaultBaseProfileSchema.parse(value);
    return this.enqueueDocument("save_vault_base_profile", valid, expectedSha256, (stored) =>
      parseDocument(stored, (candidate) => VaultBaseProfileSchema.parse(candidate)),
    );
  }

  saveDraft(value: VaultPromptDraft, expectedSha256?: string) {
    const valid = VaultPromptDraftSchema.parse(value);
    return this.enqueueDocument("save_prompt_vault_draft", valid, expectedSha256, (stored) =>
      parseDocument(stored, (candidate) => VaultPromptDraftSchema.parse(candidate)),
    );
  }

  saveProfile(value: VaultPromptProfile, expectedSha256?: string) {
    const valid = VaultPromptProfileEnvelopeSchema.parse(value);
    return this.enqueueDocument("save_prompt_vault_profile", valid, expectedSha256, (stored) =>
      parseDocument(stored, (candidate) => VaultPromptProfileEnvelopeSchema.parse(candidate)),
    );
  }

  saveGeneration(
    value: VaultPromptProfile,
    outputs: readonly GeneratedOutputWrite[],
    expectedSha256?: string,
  ) {
    const profile = VaultPromptProfileEnvelopeSchema.parse(value);
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        const receipts = await invoke<VaultWriteReceipt[]>("save_prompt_vault_generation", {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
          profile,
          outputs,
          expectedProfileSha256: expectedSha256 ?? null,
        });
        assertCurrent();
        return receipts;
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  removeDraft(draftId: string, expectedSha256: string) {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        await invoke<void>("remove_prompt_vault_draft", {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
          draftId,
          expectedSha256,
        });
        assertCurrent();
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  applyMigration(bundle: PromptVaultMigrationBundle) {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        const receipts = await invoke<VaultWriteReceipt[]>("apply_prompt_vault_migration", {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
          bundle,
        });
        assertCurrent();
        return receipts;
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  flush(): Promise<void> {
    return this.queue.flush(this.session);
  }

  private enqueueDocument<Value, Stored>(
    command: string,
    value: Value,
    expectedSha256: string | undefined,
    parse: (document: NativeStoredDocument) => Stored,
  ): Promise<Stored> {
    this.assertNative();
    return this.queue.enqueue(this.session, async ({ assertCurrent }) => {
      assertCurrent();
      try {
        const receipt = await invoke<VaultWriteReceipt>(command, {
          sessionId: this.session.sessionId,
          sessionGeneration: this.session.generation,
          value,
          expectedSha256: expectedSha256 ?? null,
        });
        assertCurrent();
        return parse({
          ...receipt,
          value,
          revision: receipt.revision ?? 0,
        });
      } catch (reason) {
        throw classifyRepositoryError(reason);
      }
    });
  }

  private assertNative(): void {
    if (!isTauri()) {
      throw new RepositoryError(
        "io_error",
        "Vault prompt persistence requires the native desktop runtime; no browser fallback was used.",
      );
    }
  }
}

export function createVaultPromptRepository(
  session: SessionIdentity,
  queue: SaveQueue,
): VaultPromptRepository {
  return new NativeVaultPromptRepository(session, queue);
}
