import { describe, expect, it } from "vitest";
import { LEGACY_V1_DEFAULT_STATE } from "../domain/legacy-v1";
import { transformLegacyV1Sources } from "../domain/migration";
import {
  ProfileLibrarySchema,
  parseAppSettings,
  parseLegacyV1State,
  parseWizardDraft,
  type ProfileLibrary,
} from "../schemas";
import { MemoryStorage } from "../test/memoryStorage";
import {
  createProfileExportBundle,
  createV2StorageAdapter,
  importProfileBundle,
  inspectProfileImport,
  parseExportBundleJson,
  serializeExportBundle,
} from "./index";

const timestamp = "2026-09-02T12:00:00.000Z";

function createLibrary(): ProfileLibrary {
  return transformLegacyV1Sources(
    [
      {
        sourceKind: "jsonImport",
        sourceStorageKey: "test-import-slot",
        sourceIndex: 0,
        state: parseLegacyV1State(LEGACY_V1_DEFAULT_STATE),
      },
    ],
    timestamp,
  ).library;
}

function createBundle(library: ProfileLibrary) {
  const baseProfileId = library.baseProfiles[0]?.id;
  const categoryProfileId = library.categoryProfiles[0]?.id;
  if (!baseProfileId || !categoryProfileId) throw new Error("Expected profile dependencies.");
  return createProfileExportBundle({
    library,
    bundleId: "bundle-roundtrip-001",
    exportedAt: timestamp,
    appSettings: parseAppSettings({
      schemaVersion: 2,
      kind: "appSettings",
      theme: "system",
      locale: "de",
      startView: "dashboard",
      activeBaseProfileId: baseProfileId,
      updatedAt: timestamp,
    }),
    wizardDrafts: [
      parseWizardDraft({
        schemaVersion: 2,
        kind: "wizardDraft",
        draftId: "draft-transfer-001",
        projectName: "Imported hero",
        route: "wizard/editor",
        currentStep: "character-motion",
        baseProfileId,
        categoryProfileId,
        category: "character",
        subtype: "hero",
        answers: { directionCount: 8 },
        validation: { errors: [], warnings: [] },
        savedAt: timestamp,
      }),
    ],
  });
}

describe("V2 profile JSON transfer", () => {
  it("roundtrips a validated bundle and imports it into empty storage", () => {
    const library = createLibrary();
    const bundle = createBundle(library);
    const json = serializeExportBundle(bundle);

    expect(parseExportBundleJson(json)).toEqual({ status: "valid", bundle });

    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(importProfileBundle(adapter, json)).toMatchObject({
      status: "imported",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 1 },
      workspaceData: {
        appSettings: { theme: "system" },
        wizardDrafts: [{ draftId: "draft-transfer-001" }],
      },
    });
    expect(adapter.readProfileLibrary()).toEqual({ status: "valid", value: library });

    const mutationsBeforeIdempotentImport = storage.mutations.length;
    expect(importProfileBundle(adapter, json)).toMatchObject({
      status: "imported",
      counts: { baseProfiles: 0, categoryProfiles: 0, assetProfiles: 0 },
    });
    const stored = adapter.readProfileLibrary();
    expect(stored.status === "valid" ? stored.value.assetProfiles : []).toHaveLength(1);
    expect(storage.mutations).toHaveLength(mutationsBeforeIdempotentImport);
  });

  it("includes Base and Category dependencies in a single-asset export", () => {
    const library = createLibrary();
    const assetProfile = library.assetProfiles[0];
    if (!assetProfile) throw new Error("Expected test asset profile.");

    const bundle = createProfileExportBundle({
      library,
      bundleId: "bundle-single-asset-001",
      exportedAt: timestamp,
      selection: { assetProfileIds: [assetProfile.id] },
    });

    expect(bundle.assetProfiles).toHaveLength(1);
    expect(bundle.categoryProfiles.map((profile) => profile.id)).toEqual([
      assetProfile.categoryProfileId,
    ]);
    expect(bundle.baseProfiles.map((profile) => profile.id)).toEqual([assetProfile.baseProfileId]);
  });

  it("reports invalid JSON, duplicate ids, broken references, and stale keys", () => {
    const bundle = createBundle(createLibrary());
    expect(parseExportBundleJson("{broken")).toMatchObject({
      status: "invalid",
      reason: "invalidJson",
    });

    expect(
      parseExportBundleJson(
        JSON.stringify({
          ...bundle,
          assetProfiles: [bundle.assetProfiles[0], bundle.assetProfiles[0]],
        }),
      ),
    ).toMatchObject({ status: "invalid", reason: "schemaValidation" });

    const secondBase = {
      ...bundle.baseProfiles[0],
      id: "base-draft-mismatch",
      name: "Draft mismatch base",
    };
    expect(
      parseExportBundleJson(
        JSON.stringify({
          ...bundle,
          baseProfiles: [...bundle.baseProfiles, secondBase],
          wizardDrafts: bundle.wizardDrafts.map((draft) => ({
            ...draft,
            baseProfileId: secondBase.id,
          })),
        }),
      ),
    ).toMatchObject({ status: "invalid", reason: "schemaValidation" });
    expect(parseExportBundleJson(JSON.stringify({ ...bundle, baseProfiles: [] }))).toMatchObject({
      status: "invalid",
      reason: "schemaValidation",
    });
    expect(
      parseExportBundleJson(
        JSON.stringify({
          ...bundle,
          assetProfiles: bundle.assetProfiles.map((profile) => ({
            ...profile,
            compatibilityKey: "stale-imported-key",
          })),
        }),
      ),
    ).toMatchObject({ status: "invalid", reason: "schemaValidation" });
  });

  it("surfaces same-id conflicts and performs no write by default", () => {
    const existingLibrary = createLibrary();
    const changedLibrary = ProfileLibrarySchema.parse({
      ...existingLibrary,
      assetProfiles: existingLibrary.assetProfiles.map((profile) => ({
        ...profile,
        name: "Different imported display name",
      })),
    });
    const json = serializeExportBundle(createBundle(changedLibrary));
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(adapter.writeProfileLibrary(existingLibrary)).toEqual({ status: "ok" });
    const beforeImport = new Map(storage.values);

    expect(inspectProfileImport(json, existingLibrary)).toMatchObject({
      status: "conflict",
      conflicts: [
        expect.objectContaining({
          kind: "assetProfile",
          id: existingLibrary.assetProfiles[0]?.id,
        }),
      ],
    });
    expect(importProfileBundle(adapter, json)).toMatchObject({ status: "conflict" });
    expect(storage.values).toEqual(beforeImport);

    expect(
      importProfileBundle(adapter, json, { conflictStrategy: "replaceExisting" }),
    ).toMatchObject({ status: "imported", counts: { assetProfiles: 1 } });
    const stored = adapter.readProfileLibrary();
    expect(stored.status).toBe("valid");
    if (stored.status !== "valid") throw new Error("Expected replaced profile library.");
    expect(stored.value.assetProfiles[0]?.name).toBe("Different imported display name");
  });

  it("keeps identical bookkeeping scoped by profile kind", () => {
    const original = createLibrary();
    const sharedId = original.baseProfiles[0]?.id;
    if (!sharedId) throw new Error("Expected base profile id.");
    const existingLibrary = ProfileLibrarySchema.parse({
      ...original,
      assetProfiles: original.assetProfiles.map((profile) => ({ ...profile, id: sharedId })),
    });
    const changedLibrary = ProfileLibrarySchema.parse({
      ...existingLibrary,
      assetProfiles: existingLibrary.assetProfiles.map((profile) => ({
        ...profile,
        name: "Changed cross-kind id profile",
      })),
    });
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(adapter.writeProfileLibrary(existingLibrary)).toEqual({ status: "ok" });

    expect(
      importProfileBundle(adapter, serializeExportBundle(createBundle(changedLibrary)), {
        conflictStrategy: "replaceExisting",
      }),
    ).toMatchObject({
      status: "imported",
      counts: { baseProfiles: 0, categoryProfiles: 0, assetProfiles: 1 },
    });
  });

  it("treats reordered JSON object keys as identical profile data", () => {
    const existingLibrary = createLibrary();
    const reorderedLibrary = ProfileLibrarySchema.parse({
      ...existingLibrary,
      assetProfiles: existingLibrary.assetProfiles.map((profile) => {
        const legacyEntries = Object.entries(profile.legacyData ?? {}).reverse();
        return { ...profile, legacyData: Object.fromEntries(legacyEntries) };
      }),
    });
    const inspection = inspectProfileImport(
      serializeExportBundle(createBundle(reorderedLibrary)),
      existingLibrary,
    );

    expect(inspection).toMatchObject({
      status: "ready",
      identicalProfiles: expect.arrayContaining([
        expect.objectContaining({ kind: "assetProfile" }),
      ]),
    });
  });

  it("uses JSON semantics for absent and explicitly undefined optional fields", () => {
    const original = createLibrary();
    const withoutLegacyData = ProfileLibrarySchema.parse({
      ...original,
      assetProfiles: original.assetProfiles.map((profile) =>
        Object.fromEntries(
          Object.entries(profile).filter(
            ([key]) => key !== "legacyData" && key !== "migratedFromVersion",
          ),
        ),
      ),
    });
    const explicitUndefined = ProfileLibrarySchema.parse({
      ...withoutLegacyData,
      assetProfiles: withoutLegacyData.assetProfiles.map((profile) => ({
        ...profile,
        legacyData: undefined,
      })),
    });

    const inspection = inspectProfileImport(
      serializeExportBundle(createBundle(withoutLegacyData)),
      explicitUndefined,
    );
    expect(inspection.status).toBe("ready");
    if (inspection.status !== "ready") throw new Error("Expected identical import.");
    expect(inspection.identicalProfiles).toHaveLength(3);
  });

  it("rolls back all profile namespaces when a bulk write fails", () => {
    const library = createLibrary();
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(adapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
    const before = new Map(storage.values);
    const changed = ProfileLibrarySchema.parse({
      ...library,
      assetProfiles: library.assetProfiles.map((profile) => ({
        ...profile,
        name: "Should be rolled back",
      })),
    });
    storage.failSetOnAttempt = {
      key: "pixelforge:v2:category-profiles",
      attempt: 2,
    };

    expect(adapter.writeProfileLibrary(changed)).toMatchObject({ status: "unavailable" });
    expect(storage.values).toEqual(before);
  });
});
