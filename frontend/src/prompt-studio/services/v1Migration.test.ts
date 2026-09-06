import { describe, expect, it } from "vitest";
import autosaveFixture from "../test/fixtures/legacy-v1/autosave-directional-character.json";
import presetsFixture from "../test/fixtures/legacy-v1/presets-storage.json";
import legacyExportFixture from "../test/fixtures/legacy-v1/hero-eight-directions-export.json";
import { resolveProfile } from "../domain/profiles";
import { fingerprintLegacyText } from "../domain/migration";
import type { MigrationBackup } from "../schemas";
import { MemoryStorage } from "../test/memoryStorage";
import {
  LEGACY_V1_STORAGE_KEYS,
  V2_STORAGE_KEYS,
  createV2StorageAdapter,
  migrateLegacyV1Storage,
} from "./index";

const timestamp = "2026-09-02T12:00:00.000Z";

function expectCompletedBackup(
  value: MigrationBackup,
): asserts value is Extract<MigrationBackup, { status: "completed" }> {
  expect(value.status).toBe("completed");
  if (value.status !== "completed") throw new Error("Expected completed migration backup.");
}

describe("V1 storage migration", () => {
  it("backs up exact raw values first and migrates autosave and presets into valid profiles", () => {
    const rawAutosave = JSON.stringify(autosaveFixture, null, 2);
    const rawPresets = JSON.stringify(presetsFixture);
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: rawAutosave,
      [LEGACY_V1_STORAGE_KEYS.presets]: rawPresets,
    });

    const result = migrateLegacyV1Storage(storage, { now: () => timestamp });

    expect(result).toMatchObject({
      status: "migrated",
      counts: { baseProfiles: 2, categoryProfiles: 2, assetProfiles: 2 },
    });
    expect(storage.mutations.map((mutation) => mutation.key)).toEqual([
      V2_STORAGE_KEYS.migrationBackup,
      V2_STORAGE_KEYS.baseProfiles,
      V2_STORAGE_KEYS.categoryProfiles,
      V2_STORAGE_KEYS.assetProfiles,
      V2_STORAGE_KEYS.migrationBackup,
    ]);

    const adapter = createV2StorageAdapter(storage);
    const backup = adapter.readMigrationBackup();
    expect(backup.status).toBe("valid");
    if (backup.status !== "valid") throw new Error("Expected readable migration backup.");
    expectCompletedBackup(backup.value);
    expect(backup.value.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: LEGACY_V1_STORAGE_KEYS.autosave,
          rawValue: rawAutosave,
        }),
        expect.objectContaining({
          key: LEGACY_V1_STORAGE_KEYS.presets,
          rawValue: rawPresets,
        }),
      ]),
    );
    expect(storage.getItem(LEGACY_V1_STORAGE_KEYS.autosave)).toBe(rawAutosave);
    expect(storage.getItem(LEGACY_V1_STORAGE_KEYS.presets)).toBe(rawPresets);

    const library = adapter.readProfileLibrary();
    expect(library.status).toBe("valid");
    if (library.status !== "valid") throw new Error("Expected a valid migrated library.");
    const hero = library.value.assetProfiles.find((profile) => profile.category === "character");
    const building = library.value.assetProfiles.find((profile) => profile.category === "building");
    expect(hero).toMatchObject({ subtype: "hero", migratedFromVersion: 1 });
    if (!hero || hero.category !== "character") throw new Error("Expected migrated hero.");
    expect(hero.answers.directionCount).toBe(8);
    const heroBase = library.value.baseProfiles.find(
      (profile) => profile.id === hero.baseProfileId,
    );
    const heroCategory = library.value.categoryProfiles.find(
      (profile) => profile.id === hero.categoryProfileId,
    );
    expect(heroBase?.values.characterHeight).toBe(80);
    if (!heroBase) throw new Error("Expected hero base profile.");
    const resolvedHero = resolveProfile({
      baseProfile: heroBase,
      categoryProfile: heroCategory,
      assetProfile: hero,
    });
    expect(resolvedHero.status).toBe("resolved");

    expect(building).toMatchObject({ subtype: "house", migratedFromVersion: 1 });
    if (!building || building.category !== "building") {
      throw new Error("Expected migrated building.");
    }
    expect(building.answers.footprint).toEqual({ widthTiles: 4, depthTiles: 3 });
    expect(building.answers).not.toHaveProperty("directionCount");
    const buildingBase = library.value.baseProfiles.find(
      (profile) => profile.id === building.baseProfileId,
    );
    expect(buildingBase?.values).not.toHaveProperty("characterHeight");
    expect(building.legacyData).toMatchObject({
      normalizedState: { characterHeight: 80, sheetLayout: "4x2" },
    });
  });

  it("is idempotent and creates neither duplicate profiles nor another backup", () => {
    const rawAutosave = JSON.stringify(autosaveFixture);
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: rawAutosave,
    });

    const first = migrateLegacyV1Storage(storage, { now: () => timestamp });
    const storedAfterFirst = new Map(storage.values);
    const mutationCount = storage.mutations.length;
    const second = migrateLegacyV1Storage(storage, { now: () => "2026-09-03T00:00:00.000Z" });

    expect(first.status).toBe("migrated");
    expect(second).toMatchObject({
      status: "alreadyMigrated",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 1 },
    });
    expect(storage.mutations).toHaveLength(mutationCount);
    expect(storage.values).toEqual(storedAfterFirst);
  });

  it("aborts before profile writes when the raw backup cannot be stored", () => {
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify(autosaveFixture),
    });
    storage.failSetFor = V2_STORAGE_KEYS.migrationBackup;

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "unavailable",
      profilesWritten: false,
    });
    expect(storage.values.has(V2_STORAGE_KEYS.baseProfiles)).toBe(false);
    expect(storage.values.has(V2_STORAGE_KEYS.categoryProfiles)).toBe(false);
    expect(storage.values.has(V2_STORAGE_KEYS.assetProfiles)).toBe(false);
  });

  it("resumes a prepared backup after the final completion marker failed", () => {
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify(autosaveFixture),
    });
    storage.failSetOnAttempt = { key: V2_STORAGE_KEYS.migrationBackup, attempt: 2 };

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "unavailable",
      profilesWritten: true,
    });
    const prepared = createV2StorageAdapter(storage).readMigrationBackup();
    expect(prepared).toMatchObject({ status: "valid", value: { status: "prepared" } });

    const resumed = migrateLegacyV1Storage(storage, {
      now: () => "2026-09-03T00:00:00.000Z",
    });
    expect(resumed).toMatchObject({
      status: "migrated",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 1 },
    });
    const library = createV2StorageAdapter(storage).readProfileLibrary();
    expect(library.status).toBe("valid");
    if (library.status !== "valid") throw new Error("Expected resumed profile library.");
    expect(library.value.baseProfiles).toHaveLength(1);
    expect(library.value.categoryProfiles).toHaveLength(1);
    expect(library.value.assetProfiles).toHaveLength(1);
  });

  it("migrates a valid preset independently from corrupt autosave JSON", () => {
    const corruptAutosave = "{ definitely-not-json";
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: corruptAutosave,
      [LEGACY_V1_STORAGE_KEYS.presets]: JSON.stringify(presetsFixture),
    });

    const result = migrateLegacyV1Storage(storage, { now: () => timestamp });

    expect(result).toMatchObject({
      status: "migrated",
      counts: { assetProfiles: 1 },
      issues: [expect.objectContaining({ code: "invalidJson" })],
    });
    const library = createV2StorageAdapter(storage).readProfileLibrary();
    expect(library.status).toBe("valid");
    if (library.status !== "valid") throw new Error("Expected valid partial migration.");
    expect(library.value.assetProfiles[0]).toMatchObject({
      category: "building",
      subtype: "house",
    });
    const backup = createV2StorageAdapter(storage).readMigrationBackup();
    expect(backup.status).toBe("valid");
    if (backup.status !== "valid") throw new Error("Expected readable backup.");
    expect(backup.value.sources[0]?.rawValue).toBe(corruptAutosave);
  });

  it("keeps an exact backup and reports invalid JSON when no source can migrate", () => {
    const corruptAutosave = "not-json-at-all";
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: corruptAutosave,
    });

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "invalid",
      backupPrepared: true,
      issues: [expect.objectContaining({ code: "invalidJson" })],
    });
    expect(storage.mutations.map((mutation) => mutation.key)).toEqual([
      V2_STORAGE_KEYS.migrationBackup,
    ]);
    const backup = createV2StorageAdapter(storage).readMigrationBackup();
    expect(backup.status).toBe("valid");
    if (backup.status !== "valid") throw new Error("Expected readable backup.");
    expect(backup.value.sources[0]?.rawValue).toBe(corruptAutosave);
  });

  it("does not mark a well-formed envelope with an invalid state as completed", () => {
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify({
        savedAt: timestamp,
        state: { nonsense: true },
      }),
    });

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "invalid",
      backupPrepared: true,
      issues: [expect.objectContaining({ code: "invalidState" })],
    });
    expect(storage.values.has(V2_STORAGE_KEYS.baseProfiles)).toBe(false);
    const backup = createV2StorageAdapter(storage).readMigrationBackup();
    expect(backup).toMatchObject({ status: "valid", value: { status: "prepared" } });
  });

  it("normalizes untrusted timestamps and bounded V2 text without losing legacy source data", () => {
    const longSubject = "S".repeat(5000);
    const longLighting = "L".repeat(2500);
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify({
        ...autosaveFixture,
        savedAt: "not-an-iso-date",
        state: {
          ...autosaveFixture.state,
          subjectDescription: longSubject,
          lightingNotes: longLighting,
        },
      }),
    });

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "migrated",
      issues: [expect.objectContaining({ code: "normalizedTimestamp" })],
    });
    const library = createV2StorageAdapter(storage).readProfileLibrary();
    expect(library.status).toBe("valid");
    if (library.status !== "valid") throw new Error("Expected normalized migration.");
    const asset = library.value.assetProfiles[0];
    const base = library.value.baseProfiles[0];
    expect(asset?.answers.subjectDescription).toHaveLength(4000);
    expect(base?.values.lightingDefaults.notes).toHaveLength(2000);
    expect(asset?.createdAt).toBe(timestamp);
    expect(asset?.updatedAt).toBe(timestamp);
    expect(asset?.legacyData).toMatchObject({
      normalizedState: { subjectDescription: longSubject, lightingNotes: longLighting },
    });
  });

  it("disambiguates a V1 export envelope from an autosave wrapper", () => {
    const exportedAt = "2026-08-31T09:30:00.000Z";
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify({
        ...legacyExportFixture,
        exportedAt,
      }),
    });

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "migrated",
      counts: { assetProfiles: 1 },
    });
    const library = createV2StorageAdapter(storage).readProfileLibrary();
    expect(library.status).toBe("valid");
    if (library.status !== "valid") throw new Error("Expected imported V1 export.");
    expect(library.value.assetProfiles[0]?.legacyData).toMatchObject({
      source: { kind: "jsonImport", timestamp: exportedAt },
    });
  });

  it("treats a prepared backup fingerprint mismatch as fatal", () => {
    const rawPresets = JSON.stringify(presetsFixture);
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(
      adapter.writeMigrationBackup({
        schemaVersion: 2,
        kind: "migrationBackup",
        migrationVersion: 1,
        status: "prepared",
        startedAt: timestamp,
        sources: [
          {
            key: LEGACY_V1_STORAGE_KEYS.autosave,
            rawValue: JSON.stringify(autosaveFixture),
            fingerprint: "0000000000000000",
          },
          {
            key: LEGACY_V1_STORAGE_KEYS.presets,
            rawValue: rawPresets,
            fingerprint: fingerprintLegacyText(rawPresets),
          },
        ],
      }),
    ).toEqual({ status: "ok" });
    const mutationCount = storage.mutations.length;

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "invalid",
      backupPrepared: true,
      issues: [expect.objectContaining({ code: "backupIntegrity" })],
    });
    expect(storage.mutations).toHaveLength(mutationCount);
    expect(storage.values.has(V2_STORAGE_KEYS.baseProfiles)).toBe(false);
  });

  it("bounds completion diagnostics when many valid legacy records need fallback mapping", () => {
    const template = presetsFixture[0];
    if (!template) throw new Error("Expected preset fixture.");
    const presets = Array.from({ length: 105 }, (_, index) => ({
      ...template,
      name: `Synthetic building ${index + 1}`,
      state: { ...template.state, projectName: `Synthetic building ${index + 1}` },
    }));
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.presets]: JSON.stringify(presets),
    });

    expect(migrateLegacyV1Storage(storage, { now: () => timestamp })).toMatchObject({
      status: "migrated",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 105 },
    });
    const backup = createV2StorageAdapter(storage).readMigrationBackup();
    expect(backup.status).toBe("valid");
    if (backup.status !== "valid") throw new Error("Expected completed backup.");
    expectCompletedBackup(backup.value);
    expect(backup.value.warnings).toHaveLength(100);
    expect(backup.value.warnings[99]).toContain("additional migration warnings");
  });
});
