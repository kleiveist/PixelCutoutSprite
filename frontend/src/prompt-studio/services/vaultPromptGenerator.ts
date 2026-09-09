import type { ResolvedProfile } from "../domain/profiles";
import {
  buildPromptPackages,
  PROMPT_LANGUAGE_IDS,
  PROMPT_STYLE_VARIANT_IDS,
  type PromptLanguage,
} from "../domain/prompt-engine";
import { profileDirectory } from "../domain/catalog";
import {
  VaultPromptProfileEnvelopeSchema,
  type PromptOutputFile,
  type VaultPromptProfile,
} from "../schemas";
import type { GeneratedOutputWrite } from "./vaultPromptRepository";

export const VAULT_PROMPT_GENERATOR_VERSION = "prompt-engine-v2/vault-envelope-v3";

export interface VaultPromptGenerationSnapshot {
  readonly profile: VaultPromptProfile;
  readonly outputs: readonly GeneratedOutputWrite[];
}

export interface GenerateVaultPromptInput {
  readonly profile: VaultPromptProfile;
  readonly resolvedProfile: ResolvedProfile;
  readonly baseRevision: number;
  readonly now?: () => string;
  readonly generatorVersion?: string;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateVaultPromptSnapshot({
  profile,
  resolvedProfile,
  baseRevision,
  now = () => new Date().toISOString(),
  generatorVersion = VAULT_PROMPT_GENERATOR_VERSION,
}: GenerateVaultPromptInput): Promise<VaultPromptGenerationSnapshot> {
  const valid = VaultPromptProfileEnvelopeSchema.parse(profile);
  if (valid.status !== "ready" || valid.baseProfileId === null) {
    throw new Error("Nur ein vollständig gültiges Profil mit Vault-Basis darf Ausgaben erzeugen.");
  }
  if (baseRevision < 1) throw new Error("Die Basisrevision muss positiv sein.");
  const languages = valid.outputSelection.languages.map((language) => {
    if (!(PROMPT_LANGUAGE_IDS as readonly string[]).includes(language)) {
      throw new Error(`Die Ausgabesprache ${language} wird vom Generator nicht unterstützt.`);
    }
    return language as PromptLanguage;
  });
  const requestedStyles = new Set(valid.outputSelection.styles);
  const packages = buildPromptPackages(resolvedProfile, { languages }).filter((entry) =>
    requestedStyles.has(entry.styleProfile),
  );
  const expectedCount = requestedStyles.size * new Set(languages).size;
  if (packages.length !== expectedCount) {
    throw new Error(
      "Die gewählten Stilvarianten stimmen nicht mit dem aufgelösten Profil überein.",
    );
  }

  const directory = profileDirectory(valid.category, valid.subtype, valid.folderName);
  const pending = packages.flatMap((entry) =>
    (["main", "negative", "technical", "combined"] as const).map((part) => ({
      style: entry.styleProfile,
      language: entry.language,
      part,
      contents: entry[part],
      relativePath: `${directory}/${valid.folderName}-${entry.styleProfile}-${entry.language}-${part}.md`,
    })),
  );
  const files: PromptOutputFile[] = await Promise.all(
    pending.map(async ({ contents, ...file }) => ({ ...file, sha256: await sha256(contents) })),
  );
  const timestamp = now();
  const generated = VaultPromptProfileEnvelopeSchema.parse({
    ...valid,
    revision: valid.revision + 1,
    outputs: {
      status: "fresh",
      generatedFrom: {
        draftRevision: valid.draftRevision,
        baseRevision,
        generatorVersion,
      },
      files,
    },
    updatedAt: timestamp,
  });
  return {
    profile: generated,
    outputs: pending.map(({ relativePath, contents }) => ({ relativePath, contents })),
  };
}

export function markVaultPromptOutputsStale(
  profile: VaultPromptProfile,
  now: () => string = () => new Date().toISOString(),
): VaultPromptProfile {
  const valid = VaultPromptProfileEnvelopeSchema.parse(profile);
  if (valid.outputs.status === "none" || valid.outputs.status === "stale") return valid;
  return VaultPromptProfileEnvelopeSchema.parse({
    ...valid,
    revision: valid.revision + 1,
    outputs: { ...valid.outputs, status: "stale" },
    updatedAt: now(),
  });
}

export const SUPPORTED_VAULT_OUTPUT_REGISTRY = Object.freeze({
  styles: PROMPT_STYLE_VARIANT_IDS,
  languages: PROMPT_LANGUAGE_IDS,
  parts: Object.freeze(["main", "negative", "technical", "combined"] as const),
});
