import type { z } from "zod";
import {
  AppSettingsSchema,
  AssetProfileCollectionSchema,
  BaseProfileCollectionSchema,
  CategoryProfileCollectionSchema,
  MigrationBackupSchema,
  ProfileLibrarySchema,
  WizardDraftSchema,
  type AppSettings,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type MigrationBackup,
  type ProfileLibrary,
  type WizardDraft,
} from "../schemas";

export const V2_STORAGE_KEYS = Object.freeze({
  settings: "pixelforge:v2:settings",
  baseProfiles: "pixelforge:v2:base-profiles",
  categoryProfiles: "pixelforge:v2:category-profiles",
  assetProfiles: "pixelforge:v2:asset-profiles",
  draft: "pixelforge:v2:draft",
  migrationBackup: "pixelforge:v2:migration-backup",
} as const);

export const LEGACY_V1_STORAGE_KEYS = Object.freeze({
  autosave: "pixelart-prompt-studio:autosave:v1",
  presets: "pixelart-prompt-studio:presets:v1",
} as const);

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type StorageReadResult<Value> =
  | Readonly<{ status: "valid"; value: Value }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "invalid";
      key: string;
      reason: "invalidJson" | "schemaValidation";
      message: string;
      issues: readonly StorageValidationIssue[];
    }>
  | Readonly<{ status: "unavailable"; key: string; message: string }>;

export type StorageMutationResult =
  | Readonly<{ status: "ok" }>
  | Readonly<{
      status: "invalid";
      key: string;
      message: string;
      issues: readonly StorageValidationIssue[];
    }>
  | Readonly<{ status: "unavailable"; key: string; message: string }>;

export interface V2StorageAdapter {
  readSettings(): StorageReadResult<AppSettings>;
  writeSettings(input: unknown): StorageMutationResult;
  readBaseProfiles(): StorageReadResult<readonly BaseProfile[]>;
  readCategoryProfiles(): StorageReadResult<readonly CategoryProfile[]>;
  readAssetProfiles(): StorageReadResult<readonly AssetProfile[]>;
  readProfileLibrary(): StorageReadResult<ProfileLibrary>;
  writeProfileLibrary(input: unknown): StorageMutationResult;
  readDraft(): StorageReadResult<WizardDraft>;
  writeDraft(input: unknown): StorageMutationResult;
  removeDraft(): StorageMutationResult;
  readMigrationBackup(): StorageReadResult<MigrationBackup>;
  writeMigrationBackup(input: unknown): StorageMutationResult;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Storage operation failed.";
}

function validationIssues(error: z.ZodError): readonly StorageValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function readValidatedJson<Value>(
  storage: KeyValueStorage | null,
  key: string,
  schema: z.ZodType<Value>,
): StorageReadResult<Value> {
  if (!storage) {
    return { status: "unavailable", key, message: "Browser storage is unavailable." };
  }

  let rawValue: string | null;
  try {
    rawValue = storage.getItem(key);
  } catch (error) {
    return { status: "unavailable", key, message: errorMessage(error) };
  }

  if (rawValue === null) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue) as unknown;
  } catch (error) {
    return {
      status: "invalid",
      key,
      reason: "invalidJson",
      message: errorMessage(error),
      issues: [],
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      status: "invalid",
      key,
      reason: "schemaValidation",
      message: "Stored data does not match the V2 schema.",
      issues: validationIssues(result.error),
    };
  }

  return { status: "valid", value: result.data };
}

function writeValidatedJson<Value>(
  storage: KeyValueStorage | null,
  key: string,
  input: unknown,
  schema: z.ZodType<Value>,
): StorageMutationResult {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      status: "invalid",
      key,
      message: "Data was not written because it does not match the V2 schema.",
      issues: validationIssues(result.error),
    };
  }

  if (!storage) {
    return { status: "unavailable", key, message: "Browser storage is unavailable." };
  }

  try {
    storage.setItem(key, JSON.stringify(result.data));
    return { status: "ok" };
  } catch (error) {
    return { status: "unavailable", key, message: errorMessage(error) };
  }
}

function writeJsonEntriesAtomically(
  storage: KeyValueStorage | null,
  entries: readonly (readonly [key: string, value: unknown])[],
): StorageMutationResult {
  const firstKey = entries[0]?.[0] ?? "pixelforge:v2";
  if (!storage) {
    return { status: "unavailable", key: firstKey, message: "Browser storage is unavailable." };
  }

  const previousValues = new Map<string, string | null>();
  try {
    for (const [key] of entries) previousValues.set(key, storage.getItem(key));
  } catch (error) {
    return { status: "unavailable", key: firstKey, message: errorMessage(error) };
  }

  const writtenKeys: string[] = [];
  try {
    for (const [key, value] of entries) {
      storage.setItem(key, JSON.stringify(value));
      writtenKeys.push(key);
    }
    return { status: "ok" };
  } catch (error) {
    for (const key of writtenKeys.reverse()) {
      try {
        const previousValue = previousValues.get(key);
        if (previousValue === null || previousValue === undefined) storage.removeItem(key);
        else storage.setItem(key, previousValue);
      } catch {
        // Best-effort rollback: the caller still receives an unavailable result.
      }
    }
    return { status: "unavailable", key: firstKey, message: errorMessage(error) };
  }
}

function mapCollectionRead<Envelope, Profile>(
  result: StorageReadResult<Envelope>,
  select: (envelope: Envelope) => readonly Profile[],
): StorageReadResult<readonly Profile[]> {
  return result.status === "valid" ? { status: "valid", value: select(result.value) } : result;
}

export function createV2StorageAdapter(storage: KeyValueStorage | null): V2StorageAdapter {
  const readBaseProfiles = (): StorageReadResult<readonly BaseProfile[]> =>
    mapCollectionRead(
      readValidatedJson(storage, V2_STORAGE_KEYS.baseProfiles, BaseProfileCollectionSchema),
      (envelope) => envelope.profiles,
    );
  const readCategoryProfiles = (): StorageReadResult<readonly CategoryProfile[]> =>
    mapCollectionRead(
      readValidatedJson(storage, V2_STORAGE_KEYS.categoryProfiles, CategoryProfileCollectionSchema),
      (envelope) => envelope.profiles,
    );
  const readAssetProfiles = (): StorageReadResult<readonly AssetProfile[]> =>
    mapCollectionRead(
      readValidatedJson(storage, V2_STORAGE_KEYS.assetProfiles, AssetProfileCollectionSchema),
      (envelope) => envelope.profiles,
    );

  return {
    readSettings: () => readValidatedJson(storage, V2_STORAGE_KEYS.settings, AppSettingsSchema),
    writeSettings: (input) =>
      writeValidatedJson(storage, V2_STORAGE_KEYS.settings, input, AppSettingsSchema),
    readBaseProfiles,
    readCategoryProfiles,
    readAssetProfiles,
    readProfileLibrary: () => {
      const baseProfiles = readBaseProfiles();
      if (baseProfiles.status === "invalid" || baseProfiles.status === "unavailable") {
        return baseProfiles;
      }
      const categoryProfiles = readCategoryProfiles();
      if (categoryProfiles.status === "invalid" || categoryProfiles.status === "unavailable") {
        return categoryProfiles;
      }
      const assetProfiles = readAssetProfiles();
      if (assetProfiles.status === "invalid" || assetProfiles.status === "unavailable") {
        return assetProfiles;
      }

      const result = ProfileLibrarySchema.safeParse({
        baseProfiles: baseProfiles.status === "valid" ? baseProfiles.value : [],
        categoryProfiles: categoryProfiles.status === "valid" ? categoryProfiles.value : [],
        assetProfiles: assetProfiles.status === "valid" ? assetProfiles.value : [],
      });
      if (!result.success) {
        return {
          status: "invalid",
          key: "pixelforge:v2:profile-library",
          reason: "schemaValidation",
          message: "Stored profile namespaces do not form a valid profile library.",
          issues: validationIssues(result.error),
        };
      }
      return { status: "valid", value: result.data };
    },
    writeProfileLibrary: (input) => {
      const result = ProfileLibrarySchema.safeParse(input);
      if (!result.success) {
        return {
          status: "invalid",
          key: "pixelforge:v2:profile-library",
          message: "Profile library was not written because it is invalid.",
          issues: validationIssues(result.error),
        };
      }

      return writeJsonEntriesAtomically(storage, [
        [
          V2_STORAGE_KEYS.baseProfiles,
          { schemaVersion: 2, kind: "baseProfileCollection", profiles: result.data.baseProfiles },
        ],
        [
          V2_STORAGE_KEYS.categoryProfiles,
          {
            schemaVersion: 2,
            kind: "categoryProfileCollection",
            profiles: result.data.categoryProfiles,
          },
        ],
        [
          V2_STORAGE_KEYS.assetProfiles,
          {
            schemaVersion: 2,
            kind: "assetProfileCollection",
            profiles: result.data.assetProfiles,
          },
        ],
      ]);
    },
    readDraft: () => readValidatedJson(storage, V2_STORAGE_KEYS.draft, WizardDraftSchema),
    writeDraft: (input) =>
      writeValidatedJson(storage, V2_STORAGE_KEYS.draft, input, WizardDraftSchema),
    removeDraft: () => {
      if (!storage) {
        return {
          status: "unavailable",
          key: V2_STORAGE_KEYS.draft,
          message: "Browser storage is unavailable.",
        };
      }
      try {
        storage.removeItem(V2_STORAGE_KEYS.draft);
        return { status: "ok" };
      } catch (error) {
        return {
          status: "unavailable",
          key: V2_STORAGE_KEYS.draft,
          message: errorMessage(error),
        };
      }
    },
    readMigrationBackup: () =>
      readValidatedJson(storage, V2_STORAGE_KEYS.migrationBackup, MigrationBackupSchema),
    writeMigrationBackup: (input) =>
      writeValidatedJson(storage, V2_STORAGE_KEYS.migrationBackup, input, MigrationBackupSchema),
  };
}

export function createBrowserV2StorageAdapter(): V2StorageAdapter {
  try {
    return createV2StorageAdapter(typeof window === "undefined" ? null : window.localStorage);
  } catch {
    return createV2StorageAdapter(null);
  }
}
