import { describe, expect, it } from "vitest";

import { resolveProfile } from "../domain/profiles";
import { VaultPromptProfileEnvelopeSchema } from "../schemas";
import { createProfileLibraryFixture } from "../test/profileLibraryFixtures";
import { generateVaultPromptSnapshot, markVaultPromptOutputsStale } from "./vaultPromptGenerator";

const timestamp = "2026-09-09T12:00:00.000Z";

function fixture() {
  const library = createProfileLibraryFixture();
  const assetProfile = library.assetProfiles[0]!;
  const baseProfile = library.baseProfiles.find(
    (candidate) => candidate.id === assetProfile.baseProfileId,
  )!;
  const categoryProfile = library.categoryProfiles.find(
    (candidate) => candidate.id === assetProfile.categoryProfileId,
  );
  const resolution = resolveProfile({ assetProfile, baseProfile, categoryProfile });
  if (resolution.status !== "resolved") throw new Error("Fixture must resolve.");
  const profile = VaultPromptProfileEnvelopeSchema.parse({
    schemaVersion: 3,
    kind: "vaultPromptProfile",
    id: assetProfile.id,
    revision: 3,
    draftRevision: 2,
    name: assetProfile.name,
    folderName: assetProfile.name,
    category: assetProfile.category,
    subtype: assetProfile.subtype,
    baseProfileId: baseProfile.id,
    catalogVersion: "v3.0",
    status: "ready",
    answers: assetProfile.answers,
    wizard: { currentStepId: "animation", completedStepIds: ["identity"] },
    outputSelection: { styles: ["classic", "dark"], languages: ["en", "de"] },
    outputs: { status: "none", generatedFrom: null, files: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { baseProfile, profile, resolvedProfile: resolution.profile };
}

describe("Vault prompt generation snapshot", () => {
  it("produces every selected style/language and all four hashed Markdown parts", async () => {
    const { baseProfile, profile, resolvedProfile } = fixture();
    const snapshot = await generateVaultPromptSnapshot({
      profile,
      resolvedProfile,
      baseRevision: 7,
      now: () => timestamp,
    });

    expect(snapshot.outputs).toHaveLength(16);
    expect(new Set(snapshot.profile.outputs.files.map((file) => file.part))).toEqual(
      new Set(["main", "negative", "technical", "combined"]),
    );
    expect(snapshot.profile.outputs).toMatchObject({
      status: "fresh",
      generatedFrom: { draftRevision: 2, baseRevision: 7 },
    });
    expect(snapshot.profile.revision).toBe(4);
    expect(snapshot.profile.outputs.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(
      true,
    );
    expect(baseProfile.id).toBe(snapshot.profile.baseProfileId);
  });

  it("marks old output references stale without blanking their files", async () => {
    const { profile, resolvedProfile } = fixture();
    const generated = await generateVaultPromptSnapshot({
      profile,
      resolvedProfile,
      baseRevision: 1,
      now: () => timestamp,
    });
    const stale = markVaultPromptOutputsStale(generated.profile, () => timestamp);

    expect(stale.outputs.status).toBe("stale");
    expect(stale.outputs.files).toEqual(generated.profile.outputs.files);
    expect(stale.revision).toBe(generated.profile.revision + 1);
  });
});
