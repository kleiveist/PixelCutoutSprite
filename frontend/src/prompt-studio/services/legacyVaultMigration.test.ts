import { describe, expect, it, vi } from "vitest";
import autosaveFixture from "../test/fixtures/legacy-v1/autosave-directional-character.json";

import { createCompatibilityKey } from "../domain/profiles";
import {
  createProfileLibraryFixture,
  PROFILE_FIXTURE_TIMESTAMP,
} from "../test/profileLibraryFixtures";
import { convertLegacyPromptSnapshot, readLegacyMigrationInventory } from "./legacyVaultMigration";
import { LEGACY_V1_STORAGE_KEYS, V2_STORAGE_KEYS, type KeyValueStorage } from "./storageAdapter";

const sourceHash = "a".repeat(64);

function oneFamily() {
  const fixture = createProfileLibraryFixture();
  const base = fixture.baseProfiles[0]!;
  const category = fixture.categoryProfiles[0]!;
  const asset = fixture.assetProfiles[0]!;
  return { baseProfiles: [base], categoryProfiles: [category], assetProfiles: [asset] };
}

describe("read-only legacy inventory and pure Vault conversion", () => {
  it("converts one compatible family repeatably without changing its source", () => {
    const profiles = oneFamily();
    const snapshot = { profiles, draft: null };
    const before = JSON.stringify(snapshot);
    const input = {
      sourceId: "native-app-data-v2",
      sourceHash,
      sourceSnapshot: snapshot,
      snapshot,
      migratedAt: PROFILE_FIXTURE_TIMESTAMP,
    } as const;
    const first = convertLegacyPromptSnapshot(input);
    const second = convertLegacyPromptSnapshot(input);
    expect(first).toEqual(second);
    expect(first.applicable).toBe(true);
    expect(first.bundle?.baseProfile?.id).toBe(profiles.baseProfiles[0]?.id);
    expect(first.bundle?.profiles[0]?.answers).toMatchObject({ role: "blacksmith" });
    expect(first.bundle?.mappings.map((entry) => entry.targetPath)).toContain(
      ".PixelPrompt/Charakter/NPC/Dorfschmied mit Lederschürze/Dorfschmied mit Lederschürze-profile.json",
    );
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("does not silently select among incompatible bases", () => {
    const fixture = createProfileLibraryFixture();
    const preview = convertLegacyPromptSnapshot({
      sourceId: "legacy",
      sourceHash,
      sourceSnapshot: fixture,
      snapshot: { profiles: fixture, draft: null },
      migratedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(preview.applicable).toBe(false);
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "multiple_incompatible_bases" })]),
    );
  });

  it("surfaces category overrides instead of flattening them invisibly", () => {
    const source = oneFamily();
    const base = source.baseProfiles[0]!;
    const category = { ...source.categoryProfiles[0]!, overrides: { tileSize: 48 } };
    const asset = {
      ...source.assetProfiles[0]!,
      compatibilityKey: createCompatibilityKey(
        { ...base.values, tileSize: 48 },
        { category: "character", subtype: "npc" },
      ),
    };
    const profiles = { baseProfiles: [base], categoryProfiles: [category], assetProfiles: [asset] };
    const preview = convertLegacyPromptSnapshot({
      sourceId: "legacy",
      sourceHash,
      sourceSnapshot: profiles,
      snapshot: { profiles, draft: null },
      migratedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(preview.applicable).toBe(false);
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "category_override" })]),
    );
  });

  it("only reads browser keys while building the inventory", async () => {
    const source = oneFamily();
    const values = new Map<string, string>([
      [
        V2_STORAGE_KEYS.baseProfiles,
        JSON.stringify({
          schemaVersion: 2,
          kind: "baseProfileCollection",
          profiles: source.baseProfiles,
        }),
      ],
      [
        V2_STORAGE_KEYS.categoryProfiles,
        JSON.stringify({
          schemaVersion: 2,
          kind: "categoryProfileCollection",
          profiles: source.categoryProfiles,
        }),
      ],
      [
        V2_STORAGE_KEYS.assetProfiles,
        JSON.stringify({
          schemaVersion: 2,
          kind: "assetProfileCollection",
          profiles: source.assetProfiles,
        }),
      ],
    ]);
    const storage: KeyValueStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const inventory = await readLegacyMigrationInventory({ browserStorage: storage });
    expect(inventory.items).toEqual([
      expect.objectContaining({ sourceKind: "browser_v2", convertible: true }),
    ]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("previews raw V1 through the pure normalizer without touching the source", async () => {
    const rawValue = JSON.stringify(autosaveFixture);
    const storage: KeyValueStorage = {
      getItem: vi.fn((key: string) => (key === LEGACY_V1_STORAGE_KEYS.autosave ? rawValue : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const inventory = await readLegacyMigrationInventory({ browserStorage: storage });

    expect(inventory.items).toEqual([
      expect.objectContaining({
        sourceId: "browser-storage-v1",
        sourceKind: "browser_v1",
        convertible: true,
        snapshot: expect.objectContaining({
          profiles: expect.objectContaining({ assetProfiles: [expect.any(Object)] }),
        }),
      }),
    ]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
