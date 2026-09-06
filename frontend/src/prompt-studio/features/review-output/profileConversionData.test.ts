import { describe, expect, it } from "vitest";
import { duplicateBaseProfile } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  StableIdSchema,
  parseBaseProfile,
  parseWizardDraft,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import { createWizardDraftFromAssetProfile, resolveWizardDraftSnapshot } from "../wizard";
import {
  compatibleBaseProfilePlans,
  createConversionBaseDefinition,
  createProfileConversionPlan,
  prepareProfileConversion,
  type ReadyProfileConversion,
} from "./profileConversionData";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

function draftFromAsset(library: ProfileLibrary, assetProfileId: string): SelectedWizardDraft {
  const assetProfile = library.assetProfiles.find((profile) => profile.id === assetProfileId);
  if (!assetProfile) throw new Error("Expected the requested Asset fixture.");
  const baseProfile = library.baseProfiles.find(
    (profile) => profile.id === assetProfile.baseProfileId,
  );
  const categoryProfile = library.categoryProfiles.find(
    (profile) => profile.id === assetProfile.categoryProfileId,
  );
  const created = createWizardDraftFromAssetProfile({
    draftId: StableIdSchema.parse(`draft_conversion_${assetProfileId}`),
    savedAt: PROFILE_FIXTURE_TIMESTAMP,
    assetProfile,
    ...(baseProfile === undefined ? {} : { baseProfile }),
    ...(categoryProfile === undefined ? {} : { categoryProfile }),
  });
  if (created.status !== "created" || !("category" in created.draft)) {
    throw new Error("Expected a selected Wizard draft.");
  }
  return created.draft;
}

function characterHeightConflict(): Readonly<{
  library: ProfileLibrary;
  draft: SelectedWizardDraft;
  preparation: ReadyProfileConversion;
}> {
  const fixture = createProfileLibraryFixture();
  const draft = draftFromAsset(fixture, "asset_smith_80");
  const library = ProfileLibrarySchema.parse({
    ...fixture,
    categoryProfiles: fixture.categoryProfiles.map((profile) =>
      profile.id === draft.categoryProfileId
        ? {
            ...profile,
            defaults: { ...profile.defaults, bodyBuild: "sturdy" },
          }
        : profile,
    ),
    baseProfiles: fixture.baseProfiles.map((profile) =>
      profile.id === draft.baseProfileId
        ? {
            ...profile,
            locks: { ...profile.locks, characterHeight: true },
          }
        : profile,
    ),
  });
  const conflictedDraft = parseWizardDraft({
    ...draft,
    overrides: { ...draft.overrides, characterHeight: 96 },
  });
  if (!("category" in conflictedDraft)) {
    throw new Error("Expected a selected conflicted Draft.");
  }
  const resolution = resolveWizardDraftSnapshot(conflictedDraft, library);
  if (
    resolution === null ||
    resolution.status !== "conflict" ||
    resolution.partialProfile === undefined
  ) {
    throw new Error("Expected a conflict with a partial profile.");
  }
  const preparation = prepareProfileConversion({
    draft: conflictedDraft,
    library,
    partialProfile: resolution.partialProfile,
    conflicts: resolution.conflicts,
  });
  if (preparation.status !== "ready") {
    throw new Error("Expected a ready conversion preparation.");
  }
  return { library, draft: conflictedDraft, preparation };
}

describe("profile conversion planning", () => {
  it("previews the deterministic Compatibility-Key change and converts to an exact existing family", () => {
    const { library, preparation } = characterHeightConflict();

    expect(preparation.changes).toEqual([
      expect.objectContaining({
        field: "characterHeight",
        previousValue: 80,
        desiredValue: 96,
      }),
    ]);
    expect(preparation.compatibilityChanged).toBe(true);
    expect(preparation.currentCompatibilityKey).toContain("char-80");
    expect(preparation.desiredCompatibilityKey).toContain("char-96");

    const plans = compatibleBaseProfilePlans(preparation, library.baseProfiles);
    expect(plans[0]?.targetBase.id).toBe("base_world_96");
    const exactPlan = plans.find((plan) => plan.targetBase.id === "base_world_96");
    expect(exactPlan).toMatchObject({
      status: "ready",
      compatibilityChanged: true,
      exactTechnicalMatch: true,
      overrideFields: [],
    });
    if (!exactPlan) throw new Error("Expected the 96 px production family.");
    expect(exactPlan.draft).not.toHaveProperty("categoryProfileId");
    expect(exactPlan.draft).not.toHaveProperty("sourceAssetProfileId");
    expect(exactPlan.draft).not.toHaveProperty("overrides");
    expect(exactPlan.draft.answers).toEqual(preparation.partialProfile.categoryData.answers);
    expect(exactPlan.draft.answers).toMatchObject({ bodyBuild: "sturdy" });

    const convertedResolution = resolveWizardDraftSnapshot(exactPlan.draft, library);
    expect(convertedResolution).toMatchObject({
      status: "resolved",
      profile: {
        values: { characterHeight: 96 },
        compatibilityKey: preparation.desiredCompatibilityKey,
      },
    });
  });

  it("duplicates only the Base family, applies the intended locked value, and leaves all original descendants untouched", () => {
    const { library, preparation } = characterHeightConflict();
    const originalSnapshot = JSON.stringify(library);
    const definition = createConversionBaseDefinition(
      preparation,
      "duplicate",
      "Weltfamilie 96 px · sichere Kopie",
    );

    expect(definition.values.characterHeight).toBe(96);
    expect(definition.locks.characterHeight).toBe(true);
    const change = duplicateBaseProfile(
      library,
      preparation.sourceBase.id,
      StableIdSchema.parse("base_world_96_conversion"),
      "2026-09-03T23:45:00.000Z",
      definition,
    );
    expect(change.status).toBe("changed");
    if (change.status !== "changed") {
      throw new Error("Expected a duplicated Base family.");
    }

    expect(JSON.stringify(library)).toBe(originalSnapshot);
    expect(
      change.library.baseProfiles.find((profile) => profile.id === preparation.sourceBase.id)
        ?.values.characterHeight,
    ).toBe(80);
    expect(
      change.library.categoryProfiles.find((profile) => profile.id === "category_npc_80")
        ?.baseProfileId,
    ).toBe(preparation.sourceBase.id);
    expect(
      change.library.assetProfiles.find((profile) => profile.id === "asset_smith_80")
        ?.baseProfileId,
    ).toBe(preparation.sourceBase.id);

    const plan = createProfileConversionPlan(preparation, change.profile, change.profile.updatedAt);
    expect(plan).toMatchObject({
      status: "ready",
      exactTechnicalMatch: true,
      overrideFields: [],
    });
  });

  it("rejects a target family when its locks contradict the requested configuration", () => {
    const { library, preparation } = characterHeightConflict();
    const source = library.baseProfiles.find((profile) => profile.id === "base_unused");
    if (!source) throw new Error("Expected the unused Base fixture.");
    const lockedTarget = parseBaseProfile({
      ...source,
      locks: { ...source.locks, characterHeight: true },
    });

    expect(
      createProfileConversionPlan(preparation, lockedTarget, "2026-09-03T23:45:00.000Z"),
    ).toMatchObject({
      status: "incompatible",
      targetBase: { id: "base_unused" },
      lockedFields: ["characterHeight"],
    });
  });

  it("moves a 32 px texture into a 48 px tile family without carrying an irrelevant character height", () => {
    const fixture = createProfileLibraryFixture();
    const draft = draftFromAsset(fixture, "asset_oak_wood");
    const library = ProfileLibrarySchema.parse({
      ...fixture,
      baseProfiles: fixture.baseProfiles.map((profile) =>
        profile.id === draft.baseProfileId
          ? { ...profile, locks: { ...profile.locks, tileSize: true } }
          : profile,
      ),
    });
    const conflictedDraft = parseWizardDraft({
      ...draft,
      overrides: { ...draft.overrides, tileSize: 48 },
    });
    const resolution = resolveWizardDraftSnapshot(conflictedDraft, library);
    if (
      resolution === null ||
      resolution.status !== "conflict" ||
      resolution.partialProfile === undefined
    ) {
      throw new Error("Expected a texture lock conflict.");
    }
    const preparation = prepareProfileConversion({
      draft: conflictedDraft,
      library,
      partialProfile: resolution.partialProfile,
      conflicts: resolution.conflicts,
    });
    if (preparation.status !== "ready") {
      throw new Error("Expected a ready texture conversion.");
    }
    const targetSource = library.baseProfiles.find((profile) => profile.id === "base_world_96");
    if (!targetSource) throw new Error("Expected the 96 px Base fixture.");
    const target = parseBaseProfile({
      ...targetSource,
      id: "base_texture_48",
      name: "Texturfamilie 48 px",
      values: {
        ...targetSource.values,
        tileSize: 48,
        characterHeight: 96,
      },
      locks: { tileSize: true },
    });
    const plan = createProfileConversionPlan(preparation, target, "2026-09-03T23:45:00.000Z");

    expect(preparation.currentCompatibilityKey).toContain("tile-32");
    expect(preparation.desiredCompatibilityKey).toContain("tile-48");
    expect(preparation.desiredCompatibilityKey).not.toContain("char-");
    expect(plan).toMatchObject({
      status: "ready",
      exactTechnicalMatch: true,
      overrideFields: [],
    });
    if (plan.status !== "ready") throw new Error("Expected a ready plan.");
    const convertedLibrary = ProfileLibrarySchema.parse({
      ...library,
      baseProfiles: [...library.baseProfiles, target],
    });
    const resolved = resolveWizardDraftSnapshot(plan.draft, convertedLibrary);
    expect(resolved).toMatchObject({
      status: "resolved",
      profile: { values: { tileSize: 48 } },
    });
    if (resolved === null || resolved.status !== "resolved") {
      throw new Error("Expected a resolved converted texture.");
    }
    expect(resolved.profile.values).not.toHaveProperty("characterHeight");
  });
});
