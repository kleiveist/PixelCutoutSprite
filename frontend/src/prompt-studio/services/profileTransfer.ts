import { z } from "zod";
import { BRAND, EXPORT_APPLICATION_ID } from "../config";
import { jsonValuesEqual } from "../domain/json";
import {
  ExportBundleSchema,
  ProfileLibrarySchema,
  V2_SCHEMA_VERSION,
  type AppSettings,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type ExportBundle,
  type ProfileLibrary,
  type WizardDraft,
} from "../schemas";
import type { V2StorageAdapter } from "./storageAdapter";

export type ProfileTransferStorage = Pick<
  V2StorageAdapter,
  "readProfileLibrary" | "writeProfileLibrary"
>;

export interface ProfileExportSelection {
  readonly baseProfileIds?: readonly string[];
  readonly categoryProfileIds?: readonly string[];
  readonly assetProfileIds?: readonly string[];
}

export interface CreateProfileExportBundleInput {
  readonly library: unknown;
  readonly bundleId: string;
  readonly exportedAt: string;
  readonly selection?: ProfileExportSelection;
  readonly appSettings?: AppSettings;
  readonly wizardDrafts?: readonly WizardDraft[];
}

export interface ImportConflict {
  readonly kind: "baseProfile" | "categoryProfile" | "assetProfile";
  readonly id: string;
}

export interface TransferValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ParsedExportBundleJson =
  | Readonly<{ status: "valid"; bundle: ExportBundle }>
  | Readonly<{
      status: "invalid";
      reason: "invalidJson" | "schemaValidation";
      message: string;
      issues: readonly TransferValidationIssue[];
    }>;

export type InspectedProfileImport =
  | Readonly<{
      status: "ready";
      bundle: ExportBundle;
      identicalProfiles: readonly ImportConflict[];
    }>
  | Readonly<{
      status: "conflict";
      bundle: ExportBundle;
      conflicts: readonly ImportConflict[];
      identicalProfiles: readonly ImportConflict[];
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalidJson" | "schemaValidation" | "invalidExistingLibrary";
      message: string;
      issues: readonly TransferValidationIssue[];
    }>;

export type ImportProfileBundleResult =
  | Readonly<{
      status: "imported";
      counts: Readonly<{
        baseProfiles: number;
        categoryProfiles: number;
        assetProfiles: number;
      }>;
      identicalProfiles: readonly ImportConflict[];
      workspaceData: Readonly<{
        appSettings?: AppSettings;
        wizardDrafts: readonly WizardDraft[];
      }>;
    }>
  | Extract<InspectedProfileImport, { status: "conflict" | "invalid" }>
  | Readonly<{ status: "unavailable"; message: string }>;

function toIssues(error: z.ZodError): readonly TransferValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function selectByIds<Value extends { readonly id: string }>(
  values: readonly Value[],
  ids: ReadonlySet<string>,
  kind: string,
): readonly Value[] {
  const selected = values.filter((value) => ids.has(value.id));
  const foundIds = new Set(selected.map((value) => value.id));
  const missingIds = [...ids].filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new RangeError(`Unknown ${kind} ids: ${missingIds.join(", ")}.`);
  }
  return selected;
}

export function createProfileExportBundle(input: CreateProfileExportBundleInput): ExportBundle {
  const library = ProfileLibrarySchema.parse(input.library);
  let baseProfiles: readonly BaseProfile[] = library.baseProfiles;
  let categoryProfiles: readonly CategoryProfile[] = library.categoryProfiles;
  let assetProfiles: readonly AssetProfile[] = library.assetProfiles;

  if (input.selection) {
    const baseProfileIds = new Set(input.selection.baseProfileIds ?? []);
    const categoryProfileIds = new Set(input.selection.categoryProfileIds ?? []);
    const assetProfileIds = new Set(input.selection.assetProfileIds ?? []);

    assetProfiles = selectByIds(library.assetProfiles, assetProfileIds, "asset profile");
    for (const profile of assetProfiles) {
      baseProfileIds.add(profile.baseProfileId);
      if (profile.categoryProfileId) categoryProfileIds.add(profile.categoryProfileId);
    }

    categoryProfiles = selectByIds(
      library.categoryProfiles,
      categoryProfileIds,
      "category profile",
    );
    for (const profile of categoryProfiles) baseProfileIds.add(profile.baseProfileId);
    baseProfiles = selectByIds(library.baseProfiles, baseProfileIds, "base profile");
  }

  return ExportBundleSchema.parse({
    schemaVersion: 2,
    formatVersion: 2,
    kind: "exportBundle",
    application: EXPORT_APPLICATION_ID,
    bundleId: input.bundleId,
    exportedAt: input.exportedAt,
    baseProfiles,
    categoryProfiles,
    assetProfiles,
    ...(input.appSettings ? { appSettings: input.appSettings } : {}),
    wizardDrafts: input.wizardDrafts ?? [],
  });
}

export function serializeExportBundle(input: unknown): string {
  return `${JSON.stringify(ExportBundleSchema.parse(input), null, 2)}\n`;
}

export function parseExportBundleJson(json: string): ParsedExportBundleJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    return {
      status: "invalid",
      reason: "invalidJson",
      message: error instanceof Error ? error.message : "Import is not valid JSON.",
      issues: [],
    };
  }

  const result = ExportBundleSchema.safeParse(parsed);
  if (!result.success) {
    return {
      status: "invalid",
      reason: "schemaValidation",
      message: `Import does not match the ${BRAND.modules.prompt.shortLabel} V${V2_SCHEMA_VERSION} export schema.`,
      issues: toIssues(result.error),
    };
  }
  return { status: "valid", bundle: result.data };
}

function findProfileConflicts<Value extends { readonly id: string }>(
  existing: readonly Value[],
  incoming: readonly Value[],
  kind: ImportConflict["kind"],
  conflicts: ImportConflict[],
  identicalProfiles: ImportConflict[],
): void {
  const existingById = new Map(existing.map((profile) => [profile.id, profile]));
  for (const profile of incoming) {
    const current = existingById.get(profile.id);
    if (!current) continue;
    if (jsonValuesEqual(current, profile)) {
      identicalProfiles.push({ kind, id: profile.id });
    } else conflicts.push({ kind, id: profile.id });
  }
}

export function inspectProfileImport(
  json: string,
  existingLibraryInput: unknown,
): InspectedProfileImport {
  const existingLibrary = ProfileLibrarySchema.safeParse(existingLibraryInput);
  if (!existingLibrary.success) {
    return {
      status: "invalid",
      reason: "invalidExistingLibrary",
      message: "Existing profile data is invalid; import was not applied.",
      issues: toIssues(existingLibrary.error),
    };
  }

  const parsed = parseExportBundleJson(json);
  if (parsed.status === "invalid") return parsed;

  const conflicts: ImportConflict[] = [];
  const identicalProfiles: ImportConflict[] = [];
  findProfileConflicts(
    existingLibrary.data.baseProfiles,
    parsed.bundle.baseProfiles,
    "baseProfile",
    conflicts,
    identicalProfiles,
  );
  findProfileConflicts(
    existingLibrary.data.categoryProfiles,
    parsed.bundle.categoryProfiles,
    "categoryProfile",
    conflicts,
    identicalProfiles,
  );
  findProfileConflicts(
    existingLibrary.data.assetProfiles,
    parsed.bundle.assetProfiles,
    "assetProfile",
    conflicts,
    identicalProfiles,
  );

  return conflicts.length > 0
    ? { status: "conflict", bundle: parsed.bundle, conflicts, identicalProfiles }
    : { status: "ready", bundle: parsed.bundle, identicalProfiles };
}

function mergeProfileType<Value extends { readonly id: string }>(
  existing: readonly Value[],
  incoming: readonly Value[],
  replaceExisting: boolean,
): readonly Value[] {
  const incomingById = new Map(incoming.map((profile) => [profile.id, profile]));
  const merged = existing.map((profile) =>
    replaceExisting ? (incomingById.get(profile.id) ?? profile) : profile,
  );
  const existingIds = new Set(existing.map((profile) => profile.id));
  merged.push(...incoming.filter((profile) => !existingIds.has(profile.id)));
  return merged;
}

function workspaceData(bundle: ExportBundle): Readonly<{
  appSettings?: AppSettings;
  wizardDrafts: readonly WizardDraft[];
}> {
  return {
    ...(bundle.appSettings ? { appSettings: bundle.appSettings } : {}),
    wizardDrafts: bundle.wizardDrafts,
  };
}

export function importProfileBundle(
  adapter: ProfileTransferStorage,
  json: string,
  options: Readonly<{ conflictStrategy?: "replaceExisting" }> = {},
): ImportProfileBundleResult {
  const existing = adapter.readProfileLibrary();
  if (existing.status === "unavailable") {
    return { status: "unavailable", message: existing.message };
  }
  if (existing.status === "invalid") {
    return {
      status: "invalid",
      reason: "invalidExistingLibrary",
      message: existing.message,
      issues: existing.issues,
    };
  }
  const library: ProfileLibrary =
    existing.status === "valid"
      ? existing.value
      : { baseProfiles: [], categoryProfiles: [], assetProfiles: [] };
  const inspection = inspectProfileImport(json, library);
  if (inspection.status === "invalid") return inspection;
  if (inspection.status === "conflict" && !options.conflictStrategy) return inspection;

  const incomingProfileCount =
    inspection.bundle.baseProfiles.length +
    inspection.bundle.categoryProfiles.length +
    inspection.bundle.assetProfiles.length;
  if (inspection.identicalProfiles.length === incomingProfileCount) {
    return {
      status: "imported",
      counts: { baseProfiles: 0, categoryProfiles: 0, assetProfiles: 0 },
      identicalProfiles: inspection.identicalProfiles,
      workspaceData: workspaceData(inspection.bundle),
    };
  }

  const replaceExisting = options.conflictStrategy === "replaceExisting";
  const importedLibrary = ProfileLibrarySchema.safeParse({
    baseProfiles: mergeProfileType(
      library.baseProfiles,
      inspection.bundle.baseProfiles,
      replaceExisting,
    ),
    categoryProfiles: mergeProfileType(
      library.categoryProfiles,
      inspection.bundle.categoryProfiles,
      replaceExisting,
    ),
    assetProfiles: mergeProfileType(
      library.assetProfiles,
      inspection.bundle.assetProfiles,
      replaceExisting,
    ),
  });
  if (!importedLibrary.success) {
    return {
      status: "invalid",
      reason: "schemaValidation",
      message: "The prospective imported profile library is invalid.",
      issues: toIssues(importedLibrary.error),
    };
  }

  const write = adapter.writeProfileLibrary(importedLibrary.data);
  if (write.status === "unavailable") {
    return { status: "unavailable", message: write.message };
  }
  if (write.status === "invalid") {
    return {
      status: "invalid",
      reason: "schemaValidation",
      message: write.message,
      issues: write.issues,
    };
  }

  const identicalProfiles = inspection.identicalProfiles;
  const isIdentical = (kind: ImportConflict["kind"], id: string): boolean =>
    identicalProfiles.some((profile) => profile.kind === kind && profile.id === id);
  return {
    status: "imported",
    counts: {
      baseProfiles: inspection.bundle.baseProfiles.filter(
        (profile) => !isIdentical("baseProfile", profile.id),
      ).length,
      categoryProfiles: inspection.bundle.categoryProfiles.filter(
        (profile) => !isIdentical("categoryProfile", profile.id),
      ).length,
      assetProfiles: inspection.bundle.assetProfiles.filter(
        (profile) => !isIdentical("assetProfile", profile.id),
      ).length,
    },
    identicalProfiles,
    workspaceData: workspaceData(inspection.bundle),
  };
}
