import { invoke, isTauri } from "@tauri-apps/api/core";

import { canonicalizeJson } from "../domain/json";
import {
  parseAssetSelection,
  profileDocumentPath,
  reserveProfileFolderName,
} from "../domain/catalog";
import {
  ProfileLibrarySchema,
  VaultBaseProfileSchema,
  VaultPromptDraftSchema,
  VaultPromptProfileEnvelopeSchema,
  WizardDraftSchema,
  type ProfileLibrary,
  type VaultBaseProfile,
  type VaultPromptDraft,
  type VaultPromptProfile,
  type WizardDraft,
} from "../schemas";
import {
  createV2StorageAdapter,
  LEGACY_V1_STORAGE_KEYS,
  V2_STORAGE_KEYS,
  type KeyValueStorage,
} from "./storageAdapter";
import { previewLegacyV1RawSources } from "./v1Migration";
import type { PromptVaultIndex } from "./vaultPromptRepository";

export interface LegacyPromptSnapshot {
  readonly profiles: ProfileLibrary | null;
  readonly draft: WizardDraft | null;
}

export interface LegacyInventoryItem {
  readonly sourceId: string;
  readonly sourceKind: "native_v2" | "browser_v2" | "browser_v1";
  readonly sourceHash: string;
  readonly sourceSnapshot: unknown;
  readonly convertible: boolean;
  readonly snapshot: LegacyPromptSnapshot | null;
}

export interface LegacyInventoryIssue {
  readonly sourceId: string;
  readonly code: "unreadable" | "invalid";
  readonly message: string;
}

export interface LegacyMigrationInventory {
  readonly items: readonly LegacyInventoryItem[];
  readonly issues: readonly LegacyInventoryIssue[];
}

export interface LegacyMigrationConflict {
  readonly code:
    | "invalid_source"
    | "multiple_incompatible_bases"
    | "missing_base"
    | "category_override"
    | "asset_override"
    | "duplicate_id"
    | "target_base_conflict"
    | "target_profile_conflict";
  readonly sourceId?: string;
  readonly message: string;
}

export interface LegacyMigrationWarning {
  readonly code: "name_reserved" | "legacy_draft_only";
  readonly message: string;
}

export interface LegacySourceMapping {
  readonly sourceKind: "baseProfile" | "categoryProfile" | "assetProfile" | "wizardDraft";
  readonly sourceId: string;
  readonly targetId: string;
  readonly targetPath: string;
}

export interface PromptVaultMigrationBundle {
  readonly schemaVersion: 1;
  readonly kind: "promptVaultMigration";
  readonly migrationId: string;
  readonly sourceId: string;
  readonly sourceHash: string;
  readonly sourceSnapshot: unknown;
  readonly mappings: readonly LegacySourceMapping[];
  readonly baseProfile: VaultBaseProfile | null;
  readonly profiles: readonly VaultPromptProfile[];
  readonly draft: VaultPromptDraft | null;
  readonly createdAt: string;
}

export interface LegacyMigrationPreview {
  readonly applicable: boolean;
  readonly conflicts: readonly LegacyMigrationConflict[];
  readonly warnings: readonly LegacyMigrationWarning[];
  readonly bundle: PromptVaultMigrationBundle | null;
}

interface NativeLegacySnapshot {
  readonly profiles?: unknown;
  readonly draft?: unknown;
}

export interface ReadLegacyInventoryOptions {
  readonly nativeReader?: () => Promise<unknown>;
  readonly browserStorage?: KeyValueStorage | null;
}

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeJson(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseSnapshot(input: NativeLegacySnapshot): LegacyPromptSnapshot {
  const profiles =
    input.profiles === null || input.profiles === undefined
      ? null
      : ProfileLibrarySchema.parse(input.profiles);
  const draft =
    input.draft === null || input.draft === undefined ? null : WizardDraftSchema.parse(input.draft);
  return { profiles, draft };
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export async function readLegacyMigrationInventory(
  options: ReadLegacyInventoryOptions = {},
): Promise<LegacyMigrationInventory> {
  const items: LegacyInventoryItem[] = [];
  const issues: LegacyInventoryIssue[] = [];
  const nativeReader =
    options.nativeReader ??
    (isTauri() ? () => invoke<unknown>("read_legacy_prompt_workspace") : null);
  if (nativeReader) {
    try {
      const sourceSnapshot = await nativeReader();
      const snapshot = parseSnapshot(sourceSnapshot as NativeLegacySnapshot);
      if (snapshot.profiles || snapshot.draft) {
        items.push({
          sourceId: "native-app-data-v2",
          sourceKind: "native_v2",
          sourceHash: await sha256CanonicalJson(sourceSnapshot),
          sourceSnapshot: cloneJson(sourceSnapshot),
          convertible: true,
          snapshot,
        });
      }
    } catch (reason) {
      issues.push({
        sourceId: "native-app-data-v2",
        code: "unreadable",
        message: errorMessage(reason),
      });
    }
  }

  const browserStorage =
    options.browserStorage === undefined
      ? typeof window === "undefined"
        ? null
        : window.localStorage
      : options.browserStorage;
  if (!browserStorage) return { items, issues };
  try {
    const v2Present = Object.values(V2_STORAGE_KEYS).some(
      (key) => key !== V2_STORAGE_KEYS.migrationBackup && browserStorage.getItem(key) !== null,
    );
    if (v2Present) {
      const adapter = createV2StorageAdapter(browserStorage);
      const profiles = adapter.readProfileLibrary();
      const draft = adapter.readDraft();
      if (
        (profiles.status !== "valid" && profiles.status !== "empty") ||
        (draft.status !== "valid" && draft.status !== "empty")
      ) {
        issues.push({
          sourceId: "browser-storage-v2",
          code: "invalid",
          message: "Die erreichbaren V2-Browserdaten sind nicht vollständig schema-gültig.",
        });
      } else {
        const snapshot: LegacyPromptSnapshot = {
          profiles: profiles.status === "valid" ? profiles.value : null,
          draft: draft.status === "valid" ? draft.value : null,
        };
        const sourceSnapshot = Object.fromEntries(
          Object.values(V2_STORAGE_KEYS).flatMap((key) => {
            const value = browserStorage.getItem(key);
            return value === null ? [] : [[key, value]];
          }),
        );
        items.push({
          sourceId: "browser-storage-v2",
          sourceKind: "browser_v2",
          sourceHash: await sha256CanonicalJson(sourceSnapshot),
          sourceSnapshot,
          convertible: true,
          snapshot,
        });
      }
    }
    const rawV1Sources: Array<{
      readonly key: (typeof LEGACY_V1_STORAGE_KEYS)[keyof typeof LEGACY_V1_STORAGE_KEYS];
      readonly rawValue: string;
    }> = [];
    for (const key of Object.values(LEGACY_V1_STORAGE_KEYS)) {
      const rawValue = browserStorage.getItem(key);
      if (rawValue === null) continue;
      rawV1Sources.push({ key, rawValue });
    }
    if (rawV1Sources.length > 0) {
      const sourceSnapshot = { sources: rawV1Sources };
      const preview = previewLegacyV1RawSources(rawV1Sources, new Date().toISOString());
      items.push({
        sourceId: "browser-storage-v1",
        sourceKind: "browser_v1",
        sourceHash: await sha256CanonicalJson(sourceSnapshot),
        sourceSnapshot,
        convertible: preview.status === "valid",
        snapshot: preview.status === "valid" ? { profiles: preview.library, draft: null } : null,
      });
      for (const issue of preview.issues) {
        issues.push({
          sourceId: "browser-storage-v1",
          code: "invalid",
          message: `${issue.sourceKey}: ${issue.message}`,
        });
      }
    }
  } catch (reason) {
    issues.push({ sourceId: "browser-storage", code: "unreadable", message: errorMessage(reason) });
  }
  return { items, issues };
}

function profileTargetPath(profile: VaultPromptProfile): string {
  return profileDocumentPath(profile.category, profile.subtype, profile.folderName);
}

function sourceStyles(base: VaultBaseProfile): readonly ("classic" | "dark")[] {
  return base.values.styleProfile === "both" ? ["classic", "dark"] : [base.values.styleProfile];
}

function v3Draft(source: WizardDraft): VaultPromptDraft {
  const selected = "category" in source;
  return VaultPromptDraftSchema.parse({
    schemaVersion: 3,
    kind: "vaultPromptDraft",
    draftId: source.draftId,
    profileId: selected ? (source.sourceAssetProfileId ?? null) : null,
    revision: 1,
    identity: {
      name: source.projectName,
      category: selected ? source.category : null,
      subtype: selected ? source.subtype : null,
    },
    rawValues: { legacyV2Draft: cloneJson(source) },
    wizard: { currentStepId: source.currentStep, completedStepIds: [] },
    createdAt: source.savedAt,
    updatedAt: source.savedAt,
  });
}

function addConflictOnce(
  conflicts: LegacyMigrationConflict[],
  conflict: LegacyMigrationConflict,
): void {
  if (
    !conflicts.some((entry) => entry.code === conflict.code && entry.sourceId === conflict.sourceId)
  ) {
    conflicts.push(conflict);
  }
}

export interface ConvertLegacySnapshotOptions {
  readonly sourceId: string;
  readonly sourceHash: string;
  readonly sourceSnapshot: unknown;
  readonly snapshot: LegacyPromptSnapshot;
  readonly migratedAt: string;
  readonly target?: PromptVaultIndex | null;
}

/** Pure, repeatable V2 -> Vault-V3 conversion. It never writes or mutates its source. */
export function convertLegacyPromptSnapshot({
  sourceId,
  sourceHash,
  sourceSnapshot,
  snapshot,
  migratedAt,
  target = null,
}: ConvertLegacySnapshotOptions): LegacyMigrationPreview {
  const conflicts: LegacyMigrationConflict[] = [];
  const warnings: LegacyMigrationWarning[] = [];
  const parsedLibrary = ProfileLibrarySchema.safeParse(
    snapshot.profiles ?? { baseProfiles: [], categoryProfiles: [], assetProfiles: [] },
  );
  if (!parsedLibrary.success) {
    return {
      applicable: false,
      conflicts: [
        {
          code: "invalid_source",
          message: parsedLibrary.error.issues[0]?.message ?? "Ungültiger V2-Profilbestand.",
        },
      ],
      warnings,
      bundle: null,
    };
  }
  const library = parsedLibrary.data;
  const baseSignatures = new Map<string, typeof library.baseProfiles>();
  for (const base of library.baseProfiles) {
    const signature = canonicalizeJson({ values: base.values, locks: base.locks });
    baseSignatures.set(signature, [...(baseSignatures.get(signature) ?? []), base]);
  }
  if (baseSignatures.size > 1) {
    conflicts.push({
      code: "multiple_incompatible_bases",
      message: `${baseSignatures.size} technisch unterschiedliche Basisprofile benötigen eine ausdrückliche Auflösung.`,
    });
  }
  const chosenBase =
    [...baseSignatures.values()][0]?.slice().sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
  if (
    !chosenBase &&
    (library.categoryProfiles.length > 0 ||
      library.assetProfiles.length > 0 ||
      snapshot.draft !== null)
  ) {
    conflicts.push({
      code: "missing_base",
      message: "Für Profile oder Entwürfe fehlt ein eindeutiges Basisprofil.",
    });
  }
  const baseProfile = chosenBase
    ? VaultBaseProfileSchema.parse({
        schemaVersion: 3,
        kind: "vaultBaseProfile",
        id: chosenBase.id,
        revision: 1,
        name: chosenBase.name,
        values: cloneJson(chosenBase.values),
        locks: cloneJson(chosenBase.locks),
        createdAt: chosenBase.createdAt,
        updatedAt: migratedAt,
      })
    : null;
  if (
    target?.baseProfile &&
    baseProfile &&
    (target.baseProfile.value.id !== baseProfile.id ||
      canonicalizeJson({
        values: target.baseProfile.value.values,
        locks: target.baseProfile.value.locks,
      }) !== canonicalizeJson({ values: baseProfile.values, locks: baseProfile.locks }))
  ) {
    conflicts.push({
      code: "target_base_conflict",
      message: "Der Ziel-Vault besitzt bereits eine abweichende aktive Basis.",
    });
  }

  const categories = new Map(library.categoryProfiles.map((profile) => [profile.id, profile]));
  const occupied = target?.profiles.map((profile) => profile.value.folderName) ?? [];
  const reserved: string[] = [...occupied];
  const profiles: VaultPromptProfile[] = [];
  const seenIds = new Set<string>();
  for (const source of library.assetProfiles) {
    if (seenIds.has(source.id)) {
      addConflictOnce(conflicts, {
        code: "duplicate_id",
        sourceId: source.id,
        message: `Profil-ID ${source.id} kommt mehrfach vor.`,
      });
      continue;
    }
    seenIds.add(source.id);
    const category = source.categoryProfileId
      ? categories.get(source.categoryProfileId)
      : undefined;
    if (category && Object.keys(category.overrides).length > 0) {
      addConflictOnce(conflicts, {
        code: "category_override",
        sourceId: category.id,
        message: `Kategorieprofil ${category.name} enthält technische Overrides.`,
      });
    }
    if (Object.keys(source.overrides).length > 0) {
      addConflictOnce(conflicts, {
        code: "asset_override",
        sourceId: source.id,
        message: `Assetprofil ${source.name} enthält technische Overrides.`,
      });
    }
    parseAssetSelection(source.category, source.subtype);
    const folderName = reserveProfileFolderName(source.name, source.id, reserved);
    if (folderName !== source.name.trim()) {
      warnings.push({
        code: "name_reserved",
        message: `${source.name} wird als ${folderName} reserviert.`,
      });
    }
    reserved.push(folderName);
    const existing = target?.profiles.find((profile) => profile.value.id === source.id);
    if (existing) {
      addConflictOnce(conflicts, {
        code: "target_profile_conflict",
        sourceId: source.id,
        message: `Profil-ID ${source.id} existiert bereits im Ziel-Vault.`,
      });
    }
    const profile = VaultPromptProfileEnvelopeSchema.parse({
      schemaVersion: 3,
      kind: "vaultPromptProfile",
      id: source.id,
      revision: 1,
      draftRevision: 1,
      name: source.name,
      folderName,
      category: source.category,
      subtype: source.subtype,
      baseProfileId: baseProfile?.id ?? null,
      catalogVersion: "v3.0",
      status: baseProfile ? "ready" : "incomplete",
      answers: { ...(category?.defaults ?? {}), ...cloneJson(source.answers) },
      wizard: { currentStepId: "review", completedStepIds: ["identity"] },
      outputSelection: {
        styles: baseProfile ? sourceStyles(baseProfile) : ["classic"],
        languages: ["de"],
      },
      outputs: { status: "none", generatedFrom: null, files: [] },
      createdAt: source.createdAt,
      updatedAt: migratedAt,
    });
    profiles.push(profile);
  }
  const draft = snapshot.draft ? v3Draft(snapshot.draft) : null;
  if (draft)
    warnings.push({
      code: "legacy_draft_only",
      message: "Der letzte rohe V2-Entwurf wird separat übernommen.",
    });
  const mappings: LegacySourceMapping[] = [];
  if (baseProfile && chosenBase) {
    for (const source of library.baseProfiles) {
      if (
        canonicalizeJson({ values: source.values, locks: source.locks }) ===
        canonicalizeJson({ values: chosenBase.values, locks: chosenBase.locks })
      ) {
        mappings.push({
          sourceKind: "baseProfile",
          sourceId: source.id,
          targetId: baseProfile.id,
          targetPath: ".PixelPrompt/basisprofil.json",
        });
      }
    }
  }
  for (const profile of profiles)
    mappings.push({
      sourceKind: "assetProfile",
      sourceId: profile.id,
      targetId: profile.id,
      targetPath: profileTargetPath(profile),
    });
  if (baseProfile) {
    for (const category of library.categoryProfiles)
      mappings.push({
        sourceKind: "categoryProfile",
        sourceId: category.id,
        targetId: baseProfile.id,
        targetPath: ".PixelPrompt/basisprofil.json",
      });
  }
  if (draft)
    mappings.push({
      sourceKind: "wizardDraft",
      sourceId: draft.draftId,
      targetId: draft.draftId,
      targetPath: `.PixelPrompt/.drafts/${draft.draftId}.json`,
    });
  const bundle: PromptVaultMigrationBundle = {
    schemaVersion: 1,
    kind: "promptVaultMigration",
    migrationId: `migration-${sourceHash}`,
    sourceId,
    sourceHash,
    sourceSnapshot: cloneJson(sourceSnapshot),
    mappings,
    baseProfile,
    profiles,
    draft,
    createdAt: migratedAt,
  };
  return { applicable: conflicts.length === 0, conflicts, warnings, bundle };
}
