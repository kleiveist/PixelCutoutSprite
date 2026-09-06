import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileLibrarySchema, StableIdSchema, type ProfileLibrary } from "../../schemas";
import type { AssetProfileSaveDefinition, BaseProfileDefinition } from "../../domain/profiles";
import {
  V2_STORAGE_KEYS,
  createV2StorageAdapter,
  type StorageMutationResult,
  type StorageReadResult,
} from "../../services";
import { MemoryStorage } from "../../test/memoryStorage";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  ProfileLibraryProvider,
  useProfileLibrary,
  type ProfileActionResult,
  type ProfileLibraryContextValue,
  type ProfileLibraryProviderProps,
  type ProfileLibraryStorage,
} from "./index";

const SOURCE_PROFILE_ID = StableIdSchema.parse("asset_smith_80");
const DUPLICATE_PROFILE_ID = "asset_smith_copy";
const CREATED_BASE_PROFILE_ID = "base_created_family";
const DUPLICATE_BASE_PROFILE_ID = "base_world_copy";
const DUPLICATE_TIMESTAMP = "2026-09-02T20:30:00.000Z";

function ContextCapture({
  onRender,
}: Readonly<{
  onRender: (value: ProfileLibraryContextValue) => void;
}>) {
  onRender(useProfileLibrary());
  return null;
}

function renderProvider(
  storageAdapter: ProfileLibraryStorage,
  overrides: Readonly<{
    now?: () => string;
    createProfileId?: () => string;
    createBaseProfileId?: () => string;
  }> = {},
) {
  let context: ProfileLibraryContextValue | null = null;
  const optionalProps: Omit<ProfileLibraryProviderProps, "children" | "storageAdapter"> = {
    ...(overrides.now ? { now: overrides.now } : {}),
    ...(overrides.createProfileId ? { createProfileId: overrides.createProfileId } : {}),
    ...(overrides.createBaseProfileId
      ? { createBaseProfileId: overrides.createBaseProfileId }
      : {}),
  };

  render(
    <ProfileLibraryProvider storageAdapter={storageAdapter} {...optionalProps}>
      <ContextCapture
        onRender={(value) => {
          context = value;
        }}
      />
    </ProfileLibraryProvider>,
  );

  return {
    getContext(): ProfileLibraryContextValue {
      if (!context) throw new Error("Expected the profile library context.");
      return context;
    },
  };
}

function findSourceProfile(library: ProfileLibrary) {
  const profile = library.assetProfiles.find((candidate) => candidate.id === SOURCE_PROFILE_ID);
  if (!profile) throw new Error("Expected the source profile fixture.");
  return profile;
}

function baseDefinition(
  library: ProfileLibrary,
  changes: Partial<BaseProfileDefinition> = {},
): BaseProfileDefinition {
  const source = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!source) throw new Error("Expected the source Base profile fixture.");

  return {
    name: changes.name ?? source.name,
    iconId: changes.iconId ?? source.iconId,
    values: changes.values ?? source.values,
    locks: changes.locks ?? source.locks,
  };
}

function contextLibrary(context: ProfileLibraryContextValue): ProfileLibrary {
  if (context.libraryResult.status !== "valid") {
    throw new Error("Expected a valid profile library context.");
  }
  return context.libraryResult.value;
}

function populatedStorage() {
  const library = createProfileLibraryFixture();
  const storage = new MemoryStorage();
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  storage.mutations.splice(0);
  return { adapter, library, storage };
}

function validStorageWithMutation(library: ProfileLibrary, mutation: StorageMutationResult) {
  const writeProfileLibrary = vi.fn(() => mutation);
  const storageAdapter: ProfileLibraryStorage = {
    readProfileLibrary: () => ({ status: "valid", value: library }),
    writeProfileLibrary,
  };
  return { storageAdapter, writeProfileLibrary };
}

describe("ProfileLibraryProvider", () => {
  it("writes the complete graph for a favorite change and preserves updatedAt", () => {
    const { adapter, library, storage } = populatedStorage();
    const source = findSourceProfile(library);
    const rendered = renderProvider(adapter);
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().toggleFavorite(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        id: SOURCE_PROFILE_ID,
        favorite: false,
        updatedAt: source.updatedAt,
      },
    });
    expect(storage.mutations).toEqual([
      { operation: "set", key: V2_STORAGE_KEYS.baseProfiles },
      { operation: "set", key: V2_STORAGE_KEYS.categoryProfiles },
      { operation: "set", key: V2_STORAGE_KEYS.assetProfiles },
    ]);

    const persisted = adapter.readProfileLibrary();
    expect(persisted.status).toBe("valid");
    if (persisted.status !== "valid") {
      throw new Error("Expected the changed library in storage.");
    }
    expect(persisted.value.baseProfiles).toEqual(library.baseProfiles);
    expect(persisted.value.categoryProfiles).toEqual(library.categoryProfiles);
    expect(findSourceProfile(persisted.value)).toMatchObject({
      favorite: false,
      updatedAt: source.updatedAt,
    });
    expect(rendered.getContext().mutation).toMatchObject({
      status: "saved",
      operation: "favorite",
      profileId: SOURCE_PROFILE_ID,
    });
  });

  it("uses injected identity and time for a persisted duplicate", () => {
    const { adapter, library } = populatedStorage();
    const rendered = renderProvider(adapter, {
      createProfileId: () => DUPLICATE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().duplicateProfile(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        id: DUPLICATE_PROFILE_ID,
        createdAt: DUPLICATE_TIMESTAMP,
        updatedAt: DUPLICATE_TIMESTAMP,
      },
    });
    const current = contextLibrary(rendered.getContext());
    expect(current.assetProfiles).toHaveLength(library.assetProfiles.length + 1);
    expect(current.assetProfiles.some((profile) => profile.id === DUPLICATE_PROFILE_ID)).toBe(true);
  });

  it("persists a reviewed new Asset profile with injected identity and time", () => {
    const { adapter, library } = populatedStorage();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_oak_wood");
    if (!source || source.category !== "texture") {
      throw new Error("Expected the Texture profile fixture.");
    }
    const definition: AssetProfileSaveDefinition = {
      name: "Review-Holz",
      baseProfileId: source.baseProfileId,
      compatibilityKey: source.compatibilityKey,
      capabilities: source.capabilities,
      overrides: source.overrides,
      category: source.category,
      subtype: source.subtype,
      answers: source.answers,
    };
    const rendered = renderProvider(adapter, {
      createProfileId: () => "asset_review_saved",
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().saveAssetProfile(definition);
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        id: "asset_review_saved",
        name: "Review-Holz",
        createdAt: DUPLICATE_TIMESTAMP,
        updatedAt: DUPLICATE_TIMESTAMP,
      },
    });
    expect(contextLibrary(rendered.getContext()).assetProfiles).toHaveLength(
      library.assetProfiles.length + 1,
    );
    expect(rendered.getContext().mutation).toMatchObject({
      status: "saved",
      operation: "save",
      profileId: "asset_review_saved",
    });
  });

  it("creates the first Base profile from an empty library through one full-graph write", () => {
    const writeProfileLibrary = vi.fn((input: unknown) => {
      void input;
      return { status: "ok" as const };
    });
    const storageAdapter: ProfileLibraryStorage = {
      readProfileLibrary: () => ({ status: "empty" }),
      writeProfileLibrary,
    };
    const definition: BaseProfileDefinition = {
      name: "Neue Weltfamilie",
      iconId: "world-grid",
      values: {
        pixelDensity: "modernHd",
        styleProfile: "both",
        tileSize: 32,
        characterHeight: 80,
        perspectiveType: "threeQuarter",
        cameraAngle: 60,
        cameraDirection: "southToNorth",
        projectionType: "orthographic",
        outlineStyle: "softSelective",
        paletteMode: "byProfile",
        backgroundMode: "transparent",
        alphaPadding: 8,
        nearestNeighbor: true,
        lightingDefaults: {
          policy: "adaptive",
          notes: "Keep world light stable.",
        },
      },
      locks: { tileSize: true, characterHeight: true },
    };
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => CREATED_BASE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(definition);
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        id: CREATED_BASE_PROFILE_ID,
        ...definition,
        createdAt: DUPLICATE_TIMESTAMP,
        updatedAt: DUPLICATE_TIMESTAMP,
      },
    });
    expect(writeProfileLibrary).toHaveBeenCalledTimes(1);
    const candidate = ProfileLibrarySchema.parse(writeProfileLibrary.mock.calls[0]?.[0]);
    expect(candidate.baseProfiles).toHaveLength(1);
    expect(candidate.categoryProfiles).toEqual([]);
    expect(candidate.assetProfiles).toEqual([]);
    expect(contextLibrary(rendered.getContext())).toEqual(candidate);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "saved",
      operation: "createBase",
      profileId: CREATED_BASE_PROFILE_ID,
    });
  });

  it("returns the canonical Base entity adopted from the validated graph", () => {
    const library = createProfileLibraryFixture();
    const source = library.baseProfiles[0];
    if (!source) throw new Error("Expected a Base profile fixture.");
    const { storageAdapter } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => CREATED_BASE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(
        baseDefinition(library, {
          name: "  Kanonische Familie  ",
          values: {
            ...source.values,
            lightingDefaults: {
              ...source.values.lightingDefaults,
              notes: "  Stable world light.  ",
            },
          },
        }),
      );
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        name: "Kanonische Familie",
        values: {
          lightingDefaults: { notes: "Stable world light." },
        },
      },
    });
    const canonical = contextLibrary(rendered.getContext()).baseProfiles.find(
      (profile) => profile.id === CREATED_BASE_PROFILE_ID,
    );
    expect(result?.status === "ok" ? result.profile : null).toEqual(canonical);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "saved",
      profileName: "Kanonische Familie",
    });
  });

  it("duplicates a Base with a proposed complete definition and leaves descendants on the source", () => {
    const { adapter, library } = populatedStorage();
    const source = library.baseProfiles.find((profile) => profile.id === "base_world_80");
    if (!source) throw new Error("Expected the source Base profile fixture.");
    const proposed = baseDefinition(library, {
      name: "Weltfamilie 48 px / Figuren 96 px",
      values: {
        ...source.values,
        tileSize: 48,
        characterHeight: 96,
        lightingDefaults: { ...source.values.lightingDefaults },
      },
      locks: { ...source.locks, tileSize: true, characterHeight: true },
    });
    const rendered = renderProvider(adapter, {
      createBaseProfileId: () => DUPLICATE_BASE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ReturnType<ProfileLibraryContextValue["duplicateBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().duplicateBaseProfile(source.id, proposed);
    });

    expect(result).toMatchObject({
      status: "ok",
      profile: {
        id: DUPLICATE_BASE_PROFILE_ID,
        ...proposed,
        createdAt: DUPLICATE_TIMESTAMP,
        updatedAt: DUPLICATE_TIMESTAMP,
      },
    });
    const current = contextLibrary(rendered.getContext());
    expect(current.baseProfiles).toHaveLength(library.baseProfiles.length + 1);
    expect(current.baseProfiles.find((profile) => profile.id === source.id)).toEqual(source);
    expect(
      current.categoryProfiles.every(
        (profile) => profile.baseProfileId !== DUPLICATE_BASE_PROFILE_ID,
      ),
    ).toBe(true);
    expect(
      current.assetProfiles.every((profile) => profile.baseProfileId !== DUPLICATE_BASE_PROFILE_ID),
    ).toBe(true);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "saved",
      operation: "duplicateBase",
      profileId: DUPLICATE_BASE_PROFILE_ID,
    });
  });

  it("does not adopt a Base when the complete graph write fails", () => {
    const library = createProfileLibraryFixture();
    const definition = baseDefinition(library, { name: "Nicht gespeichert" });
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "unavailable",
      key: V2_STORAGE_KEYS.baseProfiles,
      message: "Storage is unavailable.",
    });
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => CREATED_BASE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(definition);
    });

    expect(result).toMatchObject({ status: "unavailable" });
    expect(writeProfileLibrary).toHaveBeenCalledTimes(1);
    expect(contextLibrary(rendered.getContext())).toBe(library);
    expect(
      contextLibrary(rendered.getContext()).baseProfiles.some(
        (profile) => profile.id === CREATED_BASE_PROFILE_ID,
      ),
    ).toBe(false);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "unavailable",
      operation: "createBase",
    });
  });

  it("rejects an invalid injected Base identity before writing", () => {
    const library = createProfileLibraryFixture();
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => "INVALID BASE ID",
    });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(baseDefinition(library));
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(contextLibrary(rendered.getContext())).toBe(library);
  });

  it("rejects a conflicting injected Base identity before writing", () => {
    const library = createProfileLibraryFixture();
    const existingBase = library.baseProfiles[0];
    if (!existingBase) throw new Error("Expected a Base profile fixture.");
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => existingBase.id,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(baseDefinition(library));
    });

    expect(result).toMatchObject({ status: "idConflict" });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(contextLibrary(rendered.getContext())).toBe(library);
  });

  it("rejects an invalid prospective Base graph before writing", () => {
    const library = createProfileLibraryFixture();
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createBaseProfileId: () => CREATED_BASE_PROFILE_ID,
      now: () => DUPLICATE_TIMESTAMP,
    });
    const invalidDefinition = baseDefinition(library, { name: "   " });
    let result: ReturnType<ProfileLibraryContextValue["createBaseProfile"]> | undefined;

    act(() => {
      result = rendered.getContext().createBaseProfile(invalidDefinition);
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(contextLibrary(rendered.getContext())).toBe(library);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "invalid",
      operation: "createBase",
    });
  });

  it.each([
    {
      label: "invalid",
      mutation: {
        status: "invalid",
        key: "pixelforge:v2:profile-library",
        message: "Prospective graph is invalid.",
        issues: [],
      } satisfies StorageMutationResult,
    },
    {
      label: "unavailable",
      mutation: {
        status: "unavailable",
        key: V2_STORAGE_KEYS.baseProfiles,
        message: "Storage is unavailable.",
      } satisfies StorageMutationResult,
    },
  ])("fails closed when a $label write is reported", ({ mutation }) => {
    const library = createProfileLibraryFixture();
    const source = findSourceProfile(library);
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, mutation);
    const rendered = renderProvider(storageAdapter);
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().toggleFavorite(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({ status: mutation.status });
    expect(writeProfileLibrary).toHaveBeenCalledTimes(1);
    expect(findSourceProfile(contextLibrary(rendered.getContext()))).toMatchObject({
      favorite: source.favorite,
      updatedAt: source.updatedAt,
    });
    expect(rendered.getContext().mutation.status).toBe(mutation.status);
  });

  it("keeps state and all namespaces unchanged when a full write fails midway", () => {
    const { adapter, library, storage } = populatedStorage();
    const beforeValues = new Map(storage.values);
    storage.failSetOnAttempt = {
      key: V2_STORAGE_KEYS.categoryProfiles,
      attempt: 2,
    };
    const rendered = renderProvider(adapter);
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().toggleFavorite(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({ status: "unavailable" });
    expect(storage.values).toEqual(beforeValues);
    expect(contextLibrary(rendered.getContext())).toEqual(library);
    expect(rendered.getContext().mutation).toMatchObject({
      status: "unavailable",
      operation: "favorite",
    });
  });

  it.each([
    {
      label: "an existing id",
      generatedId: SOURCE_PROFILE_ID,
      expectedStatus: "idConflict" as const,
    },
    {
      label: "an invalid id",
      generatedId: "NOT A STABLE ID",
      expectedStatus: "invalid" as const,
    },
  ])("does not write a duplicate generated with $label", ({ generatedId, expectedStatus }) => {
    const library = createProfileLibraryFixture();
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createProfileId: () => generatedId,
      now: () => DUPLICATE_TIMESTAMP,
    });
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().duplicateProfile(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({ status: expectedStatus });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(contextLibrary(rendered.getContext())).toBe(library);
    expect(rendered.getContext().mutation.status).toBe(expectedStatus);
  });

  it("fails closed when the injected clock throws during duplication", () => {
    const library = createProfileLibraryFixture();
    const { storageAdapter, writeProfileLibrary } = validStorageWithMutation(library, {
      status: "ok",
    });
    const rendered = renderProvider(storageAdapter, {
      createProfileId: () => DUPLICATE_PROFILE_ID,
      now: () => {
        throw new Error("Clock unavailable");
      },
    });
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().duplicateProfile(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("gültigen Zeitstempel"),
    });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(contextLibrary(rendered.getContext())).toBe(library);
  });

  it.each([
    {
      label: "invalid",
      readResult: {
        status: "invalid",
        key: V2_STORAGE_KEYS.assetProfiles,
        reason: "schemaValidation",
        message: "Stored graph is invalid.",
        issues: [],
      } satisfies StorageReadResult<ProfileLibrary>,
      expectedStatus: "invalid" as const,
    },
    {
      label: "unavailable",
      readResult: {
        status: "unavailable",
        key: V2_STORAGE_KEYS.baseProfiles,
        message: "Storage is unavailable.",
      } satisfies StorageReadResult<ProfileLibrary>,
      expectedStatus: "unavailable" as const,
    },
  ])("does not write over an initially $label library", ({ readResult, expectedStatus }) => {
    const writeProfileLibrary = vi.fn((input: unknown) => {
      void input;
      return { status: "ok" as const };
    });
    const storageAdapter: ProfileLibraryStorage = {
      readProfileLibrary: () => readResult,
      writeProfileLibrary,
    };
    const rendered = renderProvider(storageAdapter);
    let result: ProfileActionResult | undefined;

    act(() => {
      result = rendered.getContext().deleteProfile(SOURCE_PROFILE_ID);
    });

    expect(result).toMatchObject({ status: expectedStatus });
    expect(writeProfileLibrary).not.toHaveBeenCalled();
    expect(rendered.getContext().libraryResult).toBe(readResult);
    expect(rendered.getContext().mutation).toMatchObject({
      status: expectedStatus,
      operation: "delete",
    });
  });

  it("uses the latest committed library for rapid consecutive actions", () => {
    const library = createProfileLibraryFixture();
    const writeProfileLibrary = vi.fn((input: unknown) => {
      void input;
      return { status: "ok" as const };
    });
    const storageAdapter: ProfileLibraryStorage = {
      readProfileLibrary: () => ({ status: "valid", value: library }),
      writeProfileLibrary,
    };
    const rendered = renderProvider(storageAdapter);
    const actions = rendered.getContext();

    act(() => {
      actions.toggleFavorite(SOURCE_PROFILE_ID);
      actions.toggleFavorite(SOURCE_PROFILE_ID);
    });

    expect(writeProfileLibrary).toHaveBeenCalledTimes(2);
    const firstCandidate = ProfileLibrarySchema.parse(writeProfileLibrary.mock.calls[0]?.[0]);
    const secondCandidate = ProfileLibrarySchema.parse(writeProfileLibrary.mock.calls[1]?.[0]);
    expect(findSourceProfile(firstCandidate).favorite).toBe(false);
    expect(findSourceProfile(secondCandidate).favorite).toBe(true);
    expect(findSourceProfile(contextLibrary(rendered.getContext())).favorite).toBe(true);
  });
});
