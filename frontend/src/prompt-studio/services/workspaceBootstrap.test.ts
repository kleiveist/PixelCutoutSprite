import { describe, expect, it } from "vitest";
import autosaveFixture from "../test/fixtures/legacy-v1/autosave-directional-character.json";
import { LEGACY_V1_STORAGE_KEYS } from "./storageAdapter";
import { MemoryStorage } from "../test/memoryStorage";
import { initializeWorkspaceStorage } from "./workspaceBootstrap";

const timestamp = "2026-09-03T13:00:00.000Z";

describe("workspace storage bootstrap", () => {
  it("migrates V1 data before the returned V2 adapter is read", () => {
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify(autosaveFixture),
    });

    const bootstrap = initializeWorkspaceStorage(storage, {
      now: () => timestamp,
    });

    expect(bootstrap.migration).toMatchObject({
      status: "migrated",
      counts: { baseProfiles: 1, categoryProfiles: 1, assetProfiles: 1 },
    });
    expect(bootstrap.storageAdapter.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: {
        assetProfiles: [
          expect.objectContaining({
            category: "character",
            migratedFromVersion: 1,
          }),
        ],
      },
    });
  });

  it("keeps subsequent bootstraps idempotent", () => {
    const storage = new MemoryStorage({
      [LEGACY_V1_STORAGE_KEYS.autosave]: JSON.stringify(autosaveFixture),
    });

    initializeWorkspaceStorage(storage, { now: () => timestamp });
    const mutationCount = storage.mutations.length;
    const second = initializeWorkspaceStorage(storage, {
      now: () => "2026-09-03T13:05:00.000Z",
    });

    expect(second.migration.status).toBe("alreadyMigrated");
    expect(storage.mutations).toHaveLength(mutationCount);
  });

  it("returns an unavailable adapter without throwing when storage is blocked", () => {
    const bootstrap = initializeWorkspaceStorage(null);

    expect(bootstrap.migration).toMatchObject({
      status: "unavailable",
      profilesWritten: false,
    });
    expect(bootstrap.storageAdapter.readProfileLibrary().status).toBe("unavailable");
  });
});
