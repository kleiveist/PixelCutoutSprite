import { describe, expect, it } from "vitest";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseBaseProfile,
  parseWizardDraft,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type ProfileLibrary,
  type StableId,
  type WizardDraft,
} from "../../schemas";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import {
  createBlankWizardDraft,
  createWizardDraftFromAssetProfile,
  resolveWizardCoreStep,
  resolveWizardDraftSnapshot,
  updateWizardDraft,
  validateWizardResume,
} from "./wizardLifecycle";

const draftId = "draft_wizard_011" as StableId;

interface PortableOverrideFixture {
  readonly base: BaseProfile;
  readonly category: CategoryProfile;
  readonly draft: WizardDraft;
  readonly library: ProfileLibrary;
  readonly source: AssetProfile;
}

function portableOverrideFixture(): PortableOverrideFixture {
  const library = createProfileLibraryFixture();
  const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  const base = library.baseProfiles.find((profile) => profile.id === source?.baseProfileId);
  const category = library.categoryProfiles.find(
    (profile) => profile.id === source?.categoryProfileId,
  );
  if (!source || !base || !category) {
    throw new Error("Expected a complete portable override fixture.");
  }

  const overriddenSource = parseAssetProfile({
    ...source,
    id: "asset_portable_source",
    compatibilityKey: "stale-but-schema-valid",
    overrides: {
      tileSize: 48,
      lightingDefaults: {
        policy: "warmInterior",
        notes: "Portable forge lighting.",
      },
    },
  });
  const created = createWizardDraftFromAssetProfile({
    draftId,
    savedAt: PROFILE_FIXTURE_TIMESTAMP,
    assetProfile: overriddenSource,
    baseProfile: base,
    categoryProfile: category,
  });
  if (created.status !== "created") {
    throw new Error("Expected a portable selected Draft.");
  }

  return {
    base,
    category,
    draft: created.draft,
    library,
    source: overriddenSource,
  };
}

describe("wizard draft lifecycle", () => {
  it("creates a blank project draft without inventing category state", () => {
    const draft = createBlankWizardDraft({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(draft).toEqual({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId,
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(draft).not.toHaveProperty("category");
    expect(draft).not.toHaveProperty("baseProfileId");
  });

  it("starts from the current resolved profile chain without losing source data", () => {
    const library = createProfileLibraryFixture();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
    const base = library.baseProfiles.find((profile) => profile.id === source?.baseProfileId);
    const category = library.categoryProfiles.find(
      (profile) => profile.id === source?.categoryProfileId,
    );
    if (source === undefined || base === undefined || category === undefined) {
      throw new Error("Expected complete smith fixture chain.");
    }

    const profile = parseAssetProfile({
      ...source,
      id: "asset_smith_override",
      compatibilityKey: "stale-but-schema-valid",
      overrides: {
        tileSize: 48,
        lightingDefaults: {
          policy: "warmInterior",
          notes: "Forge light stays stable.",
        },
      },
    });
    const result = createWizardDraftFromAssetProfile({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
      assetProfile: profile,
      baseProfile: base,
      categoryProfile: category,
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("Expected a profile draft.");
    expect(result.draft).toMatchObject({
      route: "wizard/profile",
      currentStep: "category",
      projectName: profile.name,
      sourceAssetProfileId: profile.id,
      baseProfileId: profile.baseProfileId,
      categoryProfileId: profile.categoryProfileId,
      category: profile.category,
      subtype: profile.subtype,
      answers: profile.answers,
      overrides: profile.overrides,
    });
    expect(result.notices.some((notice) => notice.code === "staleCompatibilityKey")).toBe(true);
  });

  it("returns structured profile-resolution conflicts instead of a partial draft", () => {
    const library = createProfileLibraryFixture();
    const profile = library.assetProfiles[0];
    if (profile === undefined) throw new Error("Expected an asset fixture.");

    const result = createWizardDraftFromAssetProfile({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
      assetProfile: profile,
    });

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") throw new Error("Expected a conflict result.");
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missingReference", reference: "baseProfile" }),
      ]),
    );
  });

  it("updates navigation and project values without mutating the source draft", () => {
    const source = createBlankWizardDraft({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    const updated = updateWizardDraft({
      draft: source,
      projectName: "Winterwald",
      currentStep: "category",
      savedAt: "2026-09-02T13:00:00.000Z",
    });

    expect(source.projectName).toBe("");
    expect(source.route).toBe("wizard/project");
    expect(updated).toMatchObject({
      projectName: "Winterwald",
      route: "wizard/category",
      currentStep: "category",
      savedAt: "2026-09-02T13:00:00.000Z",
    });
  });

  it("resumes only the exact requested draft and validates its references", () => {
    const library = createProfileLibraryFixture();
    const profile = library.assetProfiles[0];
    const base = library.baseProfiles.find((candidate) => candidate.id === profile?.baseProfileId);
    const category = library.categoryProfiles.find(
      (candidate) => candidate.id === profile?.categoryProfileId,
    );
    if (profile === undefined || base === undefined || category === undefined) {
      throw new Error("Expected complete profile fixtures.");
    }
    const created = createWizardDraftFromAssetProfile({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
      assetProfile: profile,
      baseProfile: base,
      categoryProfile: category,
    });
    if (created.status !== "created") throw new Error("Expected a profile draft.");

    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: created.draft,
        profileLibrary: library,
      }),
    ).toMatchObject({ status: "ready", draft: { draftId } });

    expect(
      validateWizardResume({
        requestedDraftId: "draft_other",
        draft: created.draft,
        profileLibrary: library,
      }),
    ).toMatchObject({
      status: "recovery",
      issues: [{ code: "draftIdMismatch", actualDraftId: draftId }],
    });

    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: created.draft,
        profileLibrary: { ...library, baseProfiles: [] },
      }),
    ).toMatchObject({
      status: "recovery",
      issues: expect.arrayContaining([expect.objectContaining({ code: "missingBaseProfile" })]),
    });

    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: created.draft,
        profileLibrary: { ...library, categoryProfiles: [] },
      }),
    ).toMatchObject({
      status: "recovery",
      issues: expect.arrayContaining([expect.objectContaining({ code: "missingCategoryProfile" })]),
    });
  });

  it("treats profile provenance as portable metadata, not a hard resume reference", () => {
    const library = createProfileLibraryFixture();
    const profile = library.assetProfiles[0];
    const base = library.baseProfiles.find((candidate) => candidate.id === profile?.baseProfileId);
    const category = library.categoryProfiles.find(
      (candidate) => candidate.id === profile?.categoryProfileId,
    );
    if (profile === undefined || base === undefined || category === undefined) {
      throw new Error("Expected complete profile fixtures.");
    }
    const created = createWizardDraftFromAssetProfile({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
      assetProfile: profile,
      baseProfile: base,
      categoryProfile: category,
    });
    if (created.status !== "created") throw new Error("Expected a profile draft.");

    const withoutSourceProfile = {
      ...library,
      assetProfiles: library.assetProfiles.filter((candidate) => candidate.id !== profile.id),
    };
    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: created.draft,
        profileLibrary: withoutSourceProfile,
      }),
    ).toMatchObject({ status: "ready" });
  });

  it("resolves the portable Draft override snapshot after its source Asset was removed", () => {
    const fixture = portableOverrideFixture();
    const withoutSourceProfile = ProfileLibrarySchema.parse({
      ...fixture.library,
      assetProfiles: fixture.library.assetProfiles.filter(
        (profile) => profile.id !== fixture.source.id,
      ),
    });

    expect(
      withoutSourceProfile.assetProfiles.some((profile) => profile.id === fixture.source.id),
    ).toBe(false);
    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: fixture.draft,
        profileLibrary: withoutSourceProfile,
      }),
    ).toMatchObject({ status: "ready" });

    const resolution = resolveWizardDraftSnapshot(fixture.draft, withoutSourceProfile);
    expect(resolution).toMatchObject({
      status: "resolved",
      profile: {
        values: {
          tileSize: 48,
          lightingDefaults: {
            policy: "warmInterior",
            notes: "Portable forge lighting.",
          },
        },
        normalizedOverrides: {
          asset: {
            tileSize: 48,
            lightingDefaults: {
              policy: "warmInterior",
              notes: "Portable forge lighting.",
            },
          },
        },
      },
    });
  });

  it("fails closed when current Base locks reject a portable Draft override", () => {
    const fixture = portableOverrideFixture();
    const lockedBase = parseBaseProfile({
      ...fixture.base,
      locks: { ...fixture.base.locks, tileSize: true },
      updatedAt: "2026-09-02T13:00:00.000Z",
    });
    const currentLibrary = ProfileLibrarySchema.parse({
      ...fixture.library,
      baseProfiles: fixture.library.baseProfiles.map((profile) =>
        profile.id === lockedBase.id ? lockedBase : profile,
      ),
      assetProfiles: fixture.library.assetProfiles.filter(
        (profile) => profile.id !== fixture.source.id,
      ),
    });

    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: fixture.draft,
        profileLibrary: currentLibrary,
      }),
    ).toMatchObject({
      status: "recovery",
      issues: [
        {
          code: "profileResolutionConflict",
          conflict: {
            code: "lockedOverride",
            source: "asset",
            field: "tileSize",
            profileId: draftId,
            inheritedValue: 32,
            attemptedValue: 48,
          },
        },
      ],
    });
  });

  it("falls back safely from unknown persisted steps without changing savedAt", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId,
      projectName: "Alte Sitzung",
      route: "wizard/category",
      currentStep: "removed-step",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    const library = createProfileLibraryFixture();

    expect(resolveWizardCoreStep(draft)).toEqual({
      stepId: "category",
      usedFallback: true,
      unknownStep: "removed-step",
    });
    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft,
        profileLibrary: library,
      }),
    ).toEqual({
      status: "ready",
      draft: { ...draft, currentStep: "category" },
      notices: [
        {
          code: "unknownCurrentStep",
          unknownStep: "removed-step",
          fallbackStep: "category",
        },
      ],
    });
  });

  it("falls back from a capability step that is not valid for the selected subtype", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId,
      projectName: "Eichenplanken",
      route: "wizard/profile",
      currentStep: "directions",
      category: "texture",
      subtype: "wood",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(draft)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "directions",
    });
  });

  it("resumes a selected pre-base Draft on the profile route", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId,
      projectName: "Windbaum",
      route: "wizard/profile",
      currentStep: "animation",
      category: "nature",
      subtype: "tree",
      answers: { animationType: "wind" },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    const library = createProfileLibraryFixture();

    expect(resolveWizardDraftSnapshot(draft, library)).toBeNull();
    expect(resolveWizardCoreStep(draft)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "animation",
    });
    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft,
        profileLibrary: library,
      }),
    ).toEqual({
      status: "ready",
      draft: { ...draft, currentStep: "baseProfile" },
      notices: [
        {
          code: "unknownCurrentStep",
          unknownStep: "animation",
          fallbackStep: "baseProfile",
        },
      ],
    });
  });

  it("resumes the Character-details step only for a based Character draft", () => {
    const library = createProfileLibraryFixture();
    const profile = library.assetProfiles.find((candidate) => candidate.id === "asset_smith_80");
    const base = library.baseProfiles.find((candidate) => candidate.id === profile?.baseProfileId);
    const category = library.categoryProfiles.find(
      (candidate) => candidate.id === profile?.categoryProfileId,
    );
    if (!profile || !base || !category) {
      throw new Error("Expected a complete Character profile chain.");
    }
    const created = createWizardDraftFromAssetProfile({
      draftId,
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
      assetProfile: profile,
      baseProfile: base,
      categoryProfile: category,
    });
    if (created.status !== "created") {
      throw new Error("Expected a Character profile draft.");
    }
    const characterDraft = parseWizardDraft({
      ...created.draft,
      route: "wizard/editor",
      currentStep: "characterDetails",
      answers: {
        role: "blacksmith",
        age: "adult",
        bodyBuild: "sturdy",
        materials: "worn leather and dark iron",
        directionCount: 8,
        animationActions: [
          { action: "idle", frames: 4 },
          { action: "walk", frames: 5 },
          { action: "use", frames: 5 },
        ],
      },
    });

    expect(resolveWizardCoreStep(characterDraft)).toEqual({
      stepId: "characterDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: draftId,
        draft: characterDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: characterDraft, notices: [] });

    const textureDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_character_step",
      projectName: "Eichenplanken",
      route: "wizard/editor",
      currentStep: "characterDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "wood",
      answers: { seamless: true },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(textureDraft)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "characterDetails",
    });
    expect(
      validateWizardResume({
        requestedDraftId: textureDraft.draftId,
        draft: textureDraft,
        profileLibrary: library,
      }),
    ).toMatchObject({
      status: "ready",
      draft: { currentStep: "baseProfile" },
      notices: [
        {
          unknownStep: "characterDetails",
          fallbackStep: "baseProfile",
        },
      ],
    });
  });

  it("resumes the dedicated Texture-details step and rejects duplicate tileability routing", () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles[0];
    if (!base) throw new Error("Expected a Base-profile fixture.");
    const textureDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_details",
      projectName: "Eichenplanken",
      route: "wizard/editor",
      currentStep: "textureDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "wood",
      answers: {
        materialType: "wood",
        seamless: true,
        surface: "planked",
      },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(textureDraft)).toEqual({
      stepId: "textureDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: textureDraft.draftId,
        draft: textureDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: textureDraft, notices: [] });

    const obsoleteTileabilityDraft = parseWizardDraft({
      ...textureDraft,
      currentStep: "tileability",
    });
    expect(resolveWizardCoreStep(obsoleteTileabilityDraft)).toEqual({
      stepId: "textureDetails",
      usedFallback: true,
      unknownStep: "tileability",
    });
    expect(
      validateWizardResume({
        requestedDraftId: obsoleteTileabilityDraft.draftId,
        draft: obsoleteTileabilityDraft,
        profileLibrary: library,
      }),
    ).toMatchObject({
      status: "ready",
      draft: { currentStep: "textureDetails" },
      notices: [
        {
          unknownStep: "tileability",
          fallbackStep: "textureDetails",
        },
      ],
    });
  });

  it("resumes Nature details for a based tree while keeping wind separate and directionless", () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles[0];
    if (!base) throw new Error("Expected a Base-profile fixture.");
    const natureDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_nature_details",
      projectName: "Windbaum",
      route: "wizard/editor",
      currentStep: "natureDetails",
      baseProfileId: base.id,
      category: "nature",
      subtype: "tree",
      answers: {
        plantType: "tree",
        species: "Eiche",
        footprint: { widthTiles: 3, depthTiles: 2 },
        animationType: "wind",
      },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(natureDraft)).toEqual({
      stepId: "natureDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: natureDraft.draftId,
        draft: natureDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: natureDraft, notices: [] });

    const wrongCategory = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_nature_step",
      projectName: "Stein",
      route: "wizard/editor",
      currentStep: "natureDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "stone",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(resolveWizardCoreStep(wrongCategory)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "natureDetails",
    });
  });

  it("resumes static-object details while keeping animation separate and directionless", () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles[0];
    if (!base) throw new Error("Expected a Base-profile fixture.");
    const staticDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_static_object_details",
      projectName: "Kartentruhe",
      route: "wizard/editor",
      currentStep: "staticObjectDetails",
      baseProfileId: base.id,
      category: "staticObject",
      subtype: "chest",
      answers: {
        objectClass: "container",
        purpose: "interactive",
        footprint: { widthTiles: 2, depthTiles: 1 },
        animationType: "openClose",
      },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(staticDraft)).toEqual({
      stepId: "staticObjectDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: staticDraft.draftId,
        draft: staticDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: staticDraft, notices: [] });

    const wrongCategory = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_static_step",
      projectName: "Stein",
      route: "wizard/editor",
      currentStep: "staticObjectDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "stone",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(resolveWizardCoreStep(wrongCategory)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "staticObjectDetails",
    });
  });

  it("resumes Building details while keeping gate animation separate and directionless", () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles[0];
    if (!base) throw new Error("Expected a Base-profile fixture.");
    const buildingDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_building_details",
      projectName: "Nordtor",
      route: "wizard/editor",
      currentStep: "buildingDetails",
      baseProfileId: base.id,
      category: "building",
      subtype: "gate",
      answers: {
        buildingType: "gate",
        purpose: "Bewachter Eingang",
        footprint: { widthTiles: 4, depthTiles: 2 },
        mappingMode: "modularSet",
        modular: true,
        animationType: "openClose",
      },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(buildingDraft)).toEqual({
      stepId: "buildingDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: buildingDraft.draftId,
        draft: buildingDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: buildingDraft, notices: [] });

    const wrongCategory = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_building_step",
      projectName: "Stein",
      route: "wizard/editor",
      currentStep: "buildingDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "stone",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(resolveWizardCoreStep(wrongCategory)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "buildingDetails",
    });
  });

  it("resumes Tileset details and redirects the obsolete Tileability step", () => {
    const library = createProfileLibraryFixture();
    const base = library.baseProfiles[0];
    if (!base) throw new Error("Expected a Base-profile fixture.");
    const tilesetDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_tileset_details",
      projectName: "Wiesen-Autotile",
      route: "wizard/editor",
      currentStep: "tilesetDetails",
      baseProfileId: base.id,
      category: "tileset",
      subtype: "autotile",
      answers: {
        tilesetType: "autotile",
        edgeSet: "cardinalAndDiagonal",
        cornerSet: "innerAndOuter",
        transitionMode: "bidirectional",
        tileableAxes: "both",
        atlasLayout: "fixedColumns",
        atlasTileCount: 47,
        atlasColumns: 8,
      },
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });

    expect(resolveWizardCoreStep(tilesetDraft)).toEqual({
      stepId: "tilesetDetails",
      usedFallback: false,
    });
    expect(
      validateWizardResume({
        requestedDraftId: tilesetDraft.draftId,
        draft: tilesetDraft,
        profileLibrary: library,
      }),
    ).toEqual({ status: "ready", draft: tilesetDraft, notices: [] });

    const obsoleteTileabilityDraft = parseWizardDraft({
      ...tilesetDraft,
      currentStep: "tileability",
    });
    expect(resolveWizardCoreStep(obsoleteTileabilityDraft)).toEqual({
      stepId: "tilesetDetails",
      usedFallback: true,
      unknownStep: "tileability",
    });
    expect(
      validateWizardResume({
        requestedDraftId: obsoleteTileabilityDraft.draftId,
        draft: obsoleteTileabilityDraft,
        profileLibrary: library,
      }),
    ).toMatchObject({
      status: "ready",
      draft: { currentStep: "tilesetDetails" },
      notices: [
        {
          unknownStep: "tileability",
          fallbackStep: "tilesetDetails",
        },
      ],
    });

    const wrongCategory = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_tileset_step",
      projectName: "Stein",
      route: "wizard/editor",
      currentStep: "tilesetDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "stone",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(resolveWizardCoreStep(wrongCategory)).toEqual({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "tilesetDetails",
    });
  });

  it("rejects malformed resume payloads before lifecycle handling", () => {
    const result = validateWizardResume({
      requestedDraftId: draftId,
      draft: { schemaVersion: 2, kind: "wizardDraft" },
      profileLibrary: createProfileLibraryFixture(),
    });

    expect(result).toMatchObject({
      status: "recovery",
      issues: [expect.objectContaining({ code: "invalidDraft" })],
    });
  });
});
