import { z } from "zod";
import {
  fingerprintLegacyText,
  transformLegacyV1Sources,
  type LegacyV1MigrationSource,
  type LegacyV1MigrationWarning,
} from "../domain/migration";
import { jsonValuesEqual } from "../domain/json";
import {
  LegacyV1AutosaveSchema,
  LegacyV1ExportSchema,
  LegacyV1PresetSchema,
  parseLegacyV1State,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type MigrationBackup,
  type ProfileLibrary,
} from "../schemas";
import {
  LEGACY_V1_STORAGE_KEYS,
  createV2StorageAdapter,
  type KeyValueStorage,
  type StorageReadResult,
} from "./storageAdapter";

export interface MigrationIssue {
  readonly sourceKey: string;
  readonly sourceIndex?: number;
  readonly code:
    | "invalidJson"
    | "invalidEnvelope"
    | "invalidState"
    | "normalizedTimestamp"
    | "backupIntegrity"
    | "profileCollision"
    | "invalidV2Storage";
  readonly message: string;
}

export interface MigrationCounts {
  readonly baseProfiles: number;
  readonly categoryProfiles: number;
  readonly assetProfiles: number;
}

export type LegacyV1StorageMigrationResult =
  | Readonly<{ status: "notNeeded" }>
  | Readonly<{
      status: "alreadyMigrated";
      counts: MigrationCounts;
      warnings: readonly string[];
    }>
  | Readonly<{
      status: "migrated";
      counts: MigrationCounts;
      warnings: readonly LegacyV1MigrationWarning[];
      issues: readonly MigrationIssue[];
    }>
  | Readonly<{
      status: "invalid";
      backupPrepared: boolean;
      issues: readonly MigrationIssue[];
    }>
  | Readonly<{
      status: "conflict";
      issues: readonly MigrationIssue[];
    }>
  | Readonly<{
      status: "unavailable";
      message: string;
      profilesWritten: boolean;
    }>;

interface DecodedLegacySources {
  readonly sources: readonly LegacyV1MigrationSource[];
  readonly issues: readonly MigrationIssue[];
  readonly validContainers: number;
  readonly backupIntegrityFailed: boolean;
}

interface ProfileCollision {
  readonly kind: "baseProfile" | "categoryProfile" | "assetProfile";
  readonly id: string;
}

type LegacyStorageKey = (typeof LEGACY_V1_STORAGE_KEYS)[keyof typeof LEGACY_V1_STORAGE_KEYS];

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "Unknown migration error.";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeLegacyState(value: unknown): boolean {
  return (
    isRecord(value) &&
    ["schemaVersion", "assetType", "projectName", "subjectDescription"].some((key) => key in value)
  );
}

function sourceTimestamp(
  input: unknown,
  sourceKey: string,
  sourceIndex: number,
  issues: MigrationIssue[],
): string | undefined {
  if (input === undefined) return undefined;
  const parsed = z.iso.datetime().safeParse(input);
  if (parsed.success) return parsed.data;
  issues.push({
    sourceKey,
    sourceIndex,
    code: "normalizedTimestamp",
    message: "Invalid legacy timestamp was ignored; migration time is used instead.",
  });
  return undefined;
}

function decodeState(
  input: unknown,
  metadata: Omit<LegacyV1MigrationSource, "state">,
  issues: MigrationIssue[],
): LegacyV1MigrationSource | null {
  if (!looksLikeLegacyState(input)) {
    issues.push({
      sourceKey: metadata.sourceStorageKey,
      sourceIndex: metadata.sourceIndex,
      code: "invalidState",
      message: "Legacy state is missing recognizable V1 fields.",
    });
    return null;
  }

  try {
    return { ...metadata, state: parseLegacyV1State(input) };
  } catch (error) {
    issues.push({
      sourceKey: metadata.sourceStorageKey,
      sourceIndex: metadata.sourceIndex,
      code: "invalidState",
      message: errorMessage(error),
    });
    return null;
  }
}

function parseRawJson(rawValue: string, sourceKey: string, issues: MigrationIssue[]): unknown {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch (error) {
    issues.push({
      sourceKey,
      code: "invalidJson",
      message: errorMessage(error),
    });
    return undefined;
  }
}

function decodeAutosaveSource(
  rawValue: string,
  sourceKey: string,
  issues: MigrationIssue[],
): readonly LegacyV1MigrationSource[] | null {
  const parsed = parseRawJson(rawValue, sourceKey, issues);
  if (parsed === undefined) return null;

  if (isRecord(parsed) && ("application" in parsed || "formatVersion" in parsed)) {
    const exportEnvelope = LegacyV1ExportSchema.safeParse(parsed);
    if (!exportEnvelope.success) {
      issues.push({
        sourceKey,
        code: "invalidEnvelope",
        message: errorMessage(exportEnvelope.error),
      });
      return [];
    }
    const timestamp = sourceTimestamp(exportEnvelope.data.exportedAt, sourceKey, 0, issues);
    const source = decodeState(
      exportEnvelope.data.state,
      {
        sourceKind: "jsonImport",
        sourceStorageKey: sourceKey,
        sourceIndex: 0,
        ...(timestamp ? { sourceTimestamp: timestamp } : {}),
      },
      issues,
    );
    return source ? [source] : [];
  }

  const autosave = LegacyV1AutosaveSchema.safeParse(parsed);
  if (autosave.success) {
    const timestamp = sourceTimestamp(autosave.data.savedAt, sourceKey, 0, issues);
    const source = decodeState(
      autosave.data.state,
      {
        sourceKind: "autosave",
        sourceStorageKey: sourceKey,
        sourceIndex: 0,
        ...(timestamp ? { sourceTimestamp: timestamp } : {}),
      },
      issues,
    );
    return source ? [source] : [];
  }

  if (looksLikeLegacyState(parsed)) {
    const source = decodeState(
      parsed,
      {
        sourceKind: "autosave",
        sourceStorageKey: sourceKey,
        sourceIndex: 0,
      },
      issues,
    );
    return source ? [source] : [];
  }

  issues.push({
    sourceKey,
    code: "invalidEnvelope",
    message: "Legacy autosave is neither an autosave envelope, a V1 export, nor a raw V1 state.",
  });
  return [];
}

function decodePresetSources(
  rawValue: string,
  sourceKey: string,
  issues: MigrationIssue[],
): readonly LegacyV1MigrationSource[] | null {
  const parsed = parseRawJson(rawValue, sourceKey, issues);
  if (parsed === undefined) return null;
  if (!Array.isArray(parsed)) {
    issues.push({
      sourceKey,
      code: "invalidEnvelope",
      message: "Legacy preset storage must contain an array.",
    });
    return [];
  }

  const sources: LegacyV1MigrationSource[] = [];
  parsed.forEach((entry, sourceIndex) => {
    const preset = LegacyV1PresetSchema.safeParse(entry);
    if (!preset.success) {
      issues.push({
        sourceKey,
        sourceIndex,
        code: "invalidEnvelope",
        message: errorMessage(preset.error),
      });
      return;
    }
    const timestamp = sourceTimestamp(preset.data.updatedAt, sourceKey, sourceIndex, issues);
    const source = decodeState(
      preset.data.state,
      {
        sourceKind: "preset",
        sourceStorageKey: sourceKey,
        sourceIndex,
        ...(timestamp ? { sourceTimestamp: timestamp } : {}),
        displayName: preset.data.name,
      },
      issues,
    );
    if (source) sources.push(source);
  });
  return sources;
}

function decodeBackupSources(backup: MigrationBackup): DecodedLegacySources {
  const sources: LegacyV1MigrationSource[] = [];
  const issues = backupIntegrityIssues(backup);
  let validContainers = 0;

  if (issues.length > 0) {
    return { sources, issues, validContainers, backupIntegrityFailed: true };
  }

  for (const source of backup.sources) {
    const decoded =
      source.key === LEGACY_V1_STORAGE_KEYS.autosave
        ? decodeAutosaveSource(source.rawValue, source.key, issues)
        : decodePresetSources(source.rawValue, source.key, issues);
    if (decoded !== null) {
      validContainers += 1;
      sources.push(...decoded);
    }
  }

  return { sources, issues, validContainers, backupIntegrityFailed: false };
}

function backupIntegrityIssues(backup: MigrationBackup): MigrationIssue[] {
  return backup.sources.flatMap((source) =>
    fingerprintLegacyText(source.rawValue) === source.fingerprint
      ? []
      : [
          {
            sourceKey: source.key,
            code: "backupIntegrity" as const,
            message: "Migration backup fingerprint does not match its preserved raw value.",
          },
        ],
  );
}

function readLegacyRawSources(storage: KeyValueStorage):
  | Readonly<{
      status: "ok";
      sources: readonly {
        readonly key: LegacyStorageKey;
        readonly rawValue: string;
        readonly fingerprint: string;
      }[];
    }>
  | Readonly<{ status: "unavailable"; message: string }> {
  try {
    const sources = Object.values(LEGACY_V1_STORAGE_KEYS).flatMap((key) => {
      const rawValue = storage.getItem(key);
      return rawValue === null
        ? []
        : [{ key, rawValue, fingerprint: fingerprintLegacyText(rawValue) }];
    });
    return { status: "ok", sources };
  } catch (error) {
    return { status: "unavailable", message: errorMessage(error) };
  }
}

function readCollection<Value>(
  result: StorageReadResult<readonly Value[]>,
  sourceKey: string,
  issues: MigrationIssue[],
): readonly Value[] | null {
  if (result.status === "valid") return result.value;
  if (result.status === "empty") return [];
  issues.push({
    sourceKey,
    code: "invalidV2Storage",
    message: result.message,
  });
  return null;
}

function mergeProfiles<Value extends { readonly id: string }>(
  existing: readonly Value[],
  incoming: readonly Value[],
  kind: ProfileCollision["kind"],
  collisions: ProfileCollision[],
): readonly Value[] {
  const merged = [...existing];
  const byId = new Map(existing.map((profile) => [profile.id, profile]));

  for (const profile of incoming) {
    const current = byId.get(profile.id);
    if (!current) {
      merged.push(profile);
      byId.set(profile.id, profile);
    } else if (!jsonValuesEqual(current, profile)) {
      collisions.push({ kind, id: profile.id });
    }
  }
  return merged;
}

function mergeLibraries(
  existing: ProfileLibrary,
  incoming: ProfileLibrary,
): Readonly<{ library: ProfileLibrary; collisions: readonly ProfileCollision[] }> {
  const collisions: ProfileCollision[] = [];
  const baseProfiles = mergeProfiles(
    existing.baseProfiles,
    incoming.baseProfiles,
    "baseProfile",
    collisions,
  ) as readonly BaseProfile[];
  const categoryProfiles = mergeProfiles(
    existing.categoryProfiles,
    incoming.categoryProfiles,
    "categoryProfile",
    collisions,
  ) as readonly CategoryProfile[];
  const assetProfiles = mergeProfiles(
    existing.assetProfiles,
    incoming.assetProfiles,
    "assetProfile",
    collisions,
  ) as readonly AssetProfile[];

  return {
    library: { baseProfiles, categoryProfiles, assetProfiles },
    collisions,
  };
}

function countsFromBackup(
  backup: Extract<MigrationBackup, { status: "completed" }>,
): MigrationCounts {
  return {
    baseProfiles: backup.createdIds.baseProfileIds.length,
    categoryProfiles: backup.createdIds.categoryProfileIds.length,
    assetProfiles: backup.createdIds.assetProfileIds.length,
  };
}

function backupWarnings(messages: readonly string[]): readonly string[] {
  const normalized = messages.map((message) => message.slice(0, 2000));
  if (normalized.length <= 100) return normalized;
  return [
    ...normalized.slice(0, 99),
    `${normalized.length - 99} additional migration warnings were omitted.`,
  ];
}

export function migrateLegacyV1Storage(
  storage: KeyValueStorage,
  options: Readonly<{ now?: () => string }> = {},
): LegacyV1StorageMigrationResult {
  const now = options.now ?? (() => new Date().toISOString());
  const adapter = createV2StorageAdapter(storage);
  const storedBackup = adapter.readMigrationBackup();

  if (storedBackup.status === "unavailable") {
    return { status: "unavailable", message: storedBackup.message, profilesWritten: false };
  }
  if (storedBackup.status === "invalid") {
    return {
      status: "invalid",
      backupPrepared: false,
      issues: [
        {
          sourceKey: storedBackup.key,
          code: "invalidV2Storage",
          message: storedBackup.message,
        },
      ],
    };
  }
  let backup: Extract<MigrationBackup, { status: "prepared" }>;
  if (storedBackup.status === "valid") {
    if (storedBackup.value.status === "completed") {
      const integrityIssues = backupIntegrityIssues(storedBackup.value);
      if (integrityIssues.length > 0) {
        return { status: "invalid", backupPrepared: false, issues: integrityIssues };
      }
      return {
        status: "alreadyMigrated",
        counts: countsFromBackup(storedBackup.value),
        warnings: storedBackup.value.warnings,
      };
    }
    backup = storedBackup.value;
  } else {
    const rawSources = readLegacyRawSources(storage);
    if (rawSources.status === "unavailable") {
      return { status: "unavailable", message: rawSources.message, profilesWritten: false };
    }
    if (rawSources.sources.length === 0) return { status: "notNeeded" };

    backup = {
      schemaVersion: 2,
      kind: "migrationBackup",
      migrationVersion: 1,
      status: "prepared",
      startedAt: now(),
      sources: rawSources.sources,
    };
    const backupWrite = adapter.writeMigrationBackup(backup);
    if (backupWrite.status !== "ok") {
      return {
        status: "unavailable",
        message: backupWrite.message,
        profilesWritten: false,
      };
    }
  }

  const decoded = decodeBackupSources(backup);
  if (
    decoded.backupIntegrityFailed ||
    decoded.validContainers === 0 ||
    (decoded.sources.length === 0 && decoded.issues.length > 0)
  ) {
    return { status: "invalid", backupPrepared: true, issues: decoded.issues };
  }

  let transformed: ReturnType<typeof transformLegacyV1Sources>;
  try {
    transformed = transformLegacyV1Sources(decoded.sources, backup.startedAt);
  } catch (error) {
    return {
      status: "invalid",
      backupPrepared: true,
      issues: [
        ...decoded.issues,
        {
          sourceKey: "pixelforge:v2:migration-transform",
          code: "invalidState",
          message: errorMessage(error),
        },
      ],
    };
  }

  const storageIssues: MigrationIssue[] = [];
  const baseProfilesRead = adapter.readBaseProfiles();
  if (baseProfilesRead.status === "unavailable") {
    return { status: "unavailable", message: baseProfilesRead.message, profilesWritten: false };
  }
  const categoryProfilesRead = adapter.readCategoryProfiles();
  if (categoryProfilesRead.status === "unavailable") {
    return {
      status: "unavailable",
      message: categoryProfilesRead.message,
      profilesWritten: false,
    };
  }
  const assetProfilesRead = adapter.readAssetProfiles();
  if (assetProfilesRead.status === "unavailable") {
    return { status: "unavailable", message: assetProfilesRead.message, profilesWritten: false };
  }

  const baseProfiles = readCollection(
    baseProfilesRead,
    "pixelforge:v2:base-profiles",
    storageIssues,
  );
  const categoryProfiles = readCollection(
    categoryProfilesRead,
    "pixelforge:v2:category-profiles",
    storageIssues,
  );
  const assetProfiles = readCollection(
    assetProfilesRead,
    "pixelforge:v2:asset-profiles",
    storageIssues,
  );
  if (!baseProfiles || !categoryProfiles || !assetProfiles) {
    return {
      status: "invalid",
      backupPrepared: true,
      issues: [...decoded.issues, ...storageIssues],
    };
  }

  const merged = mergeLibraries(
    { baseProfiles, categoryProfiles, assetProfiles },
    transformed.library,
  );
  if (merged.collisions.length > 0) {
    return {
      status: "conflict",
      issues: merged.collisions.map((collision) => ({
        sourceKey: `pixelforge:v2:${collision.kind}`,
        code: "profileCollision",
        message: `${collision.kind} id "${collision.id}" already contains different data.`,
      })),
    };
  }

  const profileWrite = adapter.writeProfileLibrary(merged.library);
  if (profileWrite.status === "unavailable") {
    return {
      status: "unavailable",
      message: profileWrite.message,
      profilesWritten: false,
    };
  }
  if (profileWrite.status === "invalid") {
    return {
      status: "invalid",
      backupPrepared: true,
      issues: [
        ...decoded.issues,
        {
          sourceKey: profileWrite.key,
          code: "invalidV2Storage",
          message: profileWrite.message,
        },
      ],
    };
  }

  const completedAt = now();
  const completedBackup: Extract<MigrationBackup, { status: "completed" }> = {
    ...backup,
    status: "completed",
    completedAt,
    warnings: backupWarnings([
      ...decoded.issues.map((issue) => issue.message),
      ...transformed.warnings.map((warning) => warning.message),
    ]),
    createdIds: {
      baseProfileIds: transformed.library.baseProfiles.map((profile) => profile.id),
      categoryProfileIds: transformed.library.categoryProfiles.map((profile) => profile.id),
      assetProfileIds: transformed.library.assetProfiles.map((profile) => profile.id),
    },
  };
  const completionWrite = adapter.writeMigrationBackup(completedBackup);
  if (completionWrite.status === "unavailable") {
    return {
      status: "unavailable",
      message: completionWrite.message,
      profilesWritten: true,
    };
  }
  if (completionWrite.status === "invalid") {
    return {
      status: "invalid",
      backupPrepared: true,
      issues: [
        {
          sourceKey: completionWrite.key,
          code: "invalidV2Storage",
          message: completionWrite.message,
        },
      ],
    };
  }

  return {
    status: "migrated",
    counts: {
      baseProfiles: transformed.library.baseProfiles.length,
      categoryProfiles: transformed.library.categoryProfiles.length,
      assetProfiles: transformed.library.assetProfiles.length,
    },
    warnings: transformed.warnings,
    issues: decoded.issues,
  };
}
