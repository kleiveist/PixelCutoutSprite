import { profileDirectory } from "../domain/catalog";
import {
  VaultBaseProfileSchema,
  VaultPromptProfileEnvelopeSchema,
  type VaultPromptProfile,
} from "../schemas";
import type { PromptVaultIndex, StoredVaultDocument } from "../services/vaultPromptRepository";
import { createProfileLibraryFixture } from "./profileLibraryFixtures";

export const VAULT_FIXTURE_TIME = "2026-09-10T12:00:00.000Z";

export function storedProfile(
  value: VaultPromptProfile,
  hash = "b".repeat(64),
): StoredVaultDocument<VaultPromptProfile> {
  return {
    value,
    relativePath: `${profileDirectory(value.category, value.subtype, value.folderName)}/${value.folderName}-profile.json`,
    revision: value.revision,
    sha256: hash,
  };
}

export function createVaultPromptFixture(): PromptVaultIndex {
  const baseV2 = createProfileLibraryFixture().baseProfiles[0]!;
  const base = VaultBaseProfileSchema.parse({
    schemaVersion: 3,
    kind: "vaultBaseProfile",
    id: baseV2.id,
    revision: 1,
    name: "Weltbasis",
    values: baseV2.values,
    locks: baseV2.locks,
    createdAt: VAULT_FIXTURE_TIME,
    updatedAt: VAULT_FIXTURE_TIME,
  });
  const profile = VaultPromptProfileEnvelopeSchema.parse({
    schemaVersion: 3,
    kind: "vaultPromptProfile",
    id: "profile_kleif",
    revision: 1,
    draftRevision: 1,
    name: "Kleif",
    folderName: "Kleif",
    category: "character",
    subtype: "npc",
    baseProfileId: base.id,
    catalogVersion: "v3.0",
    status: "ready",
    answers: {
      role: "blacksmith",
      directionCount: 8,
      animationAction: "walk",
      framesPerDirection: 5,
    },
    rawValues: { role: "Waldhüter mit unvollständiger Beschreibung" },
    wizard: { currentStepId: "catalog/character/identity", completedStepIds: ["identity"] },
    outputSelection: { styles: ["classic", "dark"], languages: ["de", "en"] },
    outputs: { status: "none", generatedFrom: null, files: [] },
    createdAt: VAULT_FIXTURE_TIME,
    updatedAt: VAULT_FIXTURE_TIME,
  });
  return {
    baseProfile: {
      relativePath: ".PixelPrompt/basisprofil.json",
      value: base,
      sha256: "a".repeat(64),
      revision: 1,
    },
    profiles: [storedProfile(profile)],
    drafts: [],
    issues: [],
  };
}
