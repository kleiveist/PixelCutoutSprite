import { resolveCapabilities } from "../domain/assets";
import { createCompatibilityKey, resolveProfile, type ResolvedProfile } from "../domain/profiles";
import {
  parseAssetSelection,
  profileDirectory,
  reserveProfileFolderName,
  V3_CATALOG_VERSION,
} from "../domain/catalog";
import {
  WIZARD_CORE_STEPS,
  WizardCoreFormSchema,
  createWizardCoreFormValues,
  wizardStepIsApplicable,
  type WizardCoreFormValues,
} from "../features/wizard";
import {
  ProfileLibrarySchema,
  VaultPromptDraftSchema,
  VaultPromptProfileEnvelopeSchema,
  parseAssetProfile,
  parseBaseProfile,
  parseWizardDraft,
  type ProfileLibrary,
  type VaultPromptDraft,
  type VaultPromptProfile,
  type WizardDraft,
} from "../schemas";
import type { WizardRawCoreFormValues } from "../store/wizard";
import { initializeSessionWorkspaceStorage } from "./workspaceBootstrap";
import type { PromptVaultIndex, StoredVaultDocument } from "./vaultPromptRepository";
import type { V2StorageAdapter } from "./storageAdapter";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type WizardVaultProjection =
  | Readonly<{
      kind: "draft";
      value: VaultPromptDraft;
      expectedSha256?: string;
    }>
  | Readonly<{
      kind: "profile";
      value: VaultPromptProfile;
      expectedSha256?: string;
    }>;

function jsonObject(value: object): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>;
}

function compatibilityLibrary(index: PromptVaultIndex): ProfileLibrary {
  const base = index.baseProfile?.value;
  const baseProfiles = base
    ? [
        parseBaseProfile({
          schemaVersion: 2,
          kind: "baseProfile",
          id: base.id,
          name: base.name,
          iconId: "world-grid",
          values: base.values,
          locks: base.locks,
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
        }),
      ]
    : [];
  const assetProfiles = index.profiles.flatMap(({ value }) => {
    if (!base || value.baseProfileId !== base.id) return [];
    try {
      const selection = parseAssetSelection(value.category, value.subtype);
      return [
        parseAssetProfile({
          schemaVersion: 2,
          kind: "assetProfile",
          id: value.id,
          name: value.name,
          baseProfileId: base.id,
          compatibilityKey: createCompatibilityKey(base.values, selection),
          category: value.category,
          subtype: value.subtype,
          iconId: "asset-generic",
          badgeIconIds: [],
          capabilities: resolveCapabilities(selection.category, selection.subtype),
          overrides: {},
          answers: value.answers,
          tags: [],
          favorite: false,
          createdAt: value.createdAt,
          updatedAt: value.updatedAt,
        }),
      ];
    } catch {
      return [];
    }
  });
  return ProfileLibrarySchema.parse({
    baseProfiles,
    categoryProfiles: [],
    assetProfiles,
  });
}

function embeddedDraft(document: {
  readonly rawValues?: Readonly<Record<string, unknown>>;
}): WizardDraft | null {
  try {
    return parseWizardDraft(document.rawValues?.legacyV2Draft);
  } catch {
    return null;
  }
}

function latestEmbeddedDraft(index: PromptVaultIndex): WizardDraft | null {
  const documents = [
    ...index.drafts.map((stored) => stored.value),
    ...index.profiles.map((stored) => stored.value),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const document of documents) {
    const draft = embeddedDraft(document);
    if (draft) return draft;
  }
  return null;
}

/**
 * Hydrates the retained synchronous wizard shell from V3 files. The adapter is
 * session-memory only: every durable mutation still goes through the native
 * VaultPromptRepository.
 */
export function createVaultCompatibilityStorage(
  index: PromptVaultIndex,
  now: () => string = () => new Date().toISOString(),
): V2StorageAdapter {
  const adapter = initializeSessionWorkspaceStorage().storageAdapter;
  const library = compatibilityLibrary(index);
  adapter.writeSettings({
    schemaVersion: 2,
    kind: "appSettings",
    theme: "system",
    locale: "de",
    startView: "dashboard",
    activeBaseProfileId: index.baseProfile?.value.id ?? null,
    updatedAt: now(),
  });
  adapter.writeProfileLibrary(library);
  const draft = latestEmbeddedDraft(index);
  if (draft) adapter.writeDraft(draft);
  return adapter;
}

function wizardPosition(
  draft: WizardDraft,
  values: WizardCoreFormValues | null,
  library: ProfileLibrary,
) {
  const applicable = values
    ? WIZARD_CORE_STEPS.filter((step) => wizardStepIsApplicable(step.id, values, library))
    : [];
  const current = applicable.findIndex((step) => step.id === draft.currentStep);
  return {
    currentStepId: draft.currentStep,
    completedStepIds: applicable.slice(0, Math.max(0, current)).map((step) => step.id),
  };
}

function readyAtLastApplicableStep(
  draft: WizardDraft,
  values: WizardCoreFormValues,
  library: ProfileLibrary,
): boolean {
  const applicable = WIZARD_CORE_STEPS.filter((step) =>
    wizardStepIsApplicable(step.id, values, library),
  );
  const last = applicable.at(-1);
  return (
    last?.id === draft.currentStep &&
    applicable.every((step) => step.schema.safeParse(values).success)
  );
}

function findStoredProfile(
  draft: WizardDraft,
  index: PromptVaultIndex,
): StoredVaultDocument<VaultPromptProfile> | undefined {
  const sourceId = "sourceAssetProfileId" in draft ? draft.sourceAssetProfileId : undefined;
  return index.profiles.find(({ value }) => value.id === (sourceId ?? draft.draftId));
}

/** Pure projection: incomplete/invalid identity becomes a raw draft journal. */
export function projectWizardToVault(
  draft: WizardDraft,
  rawValues: WizardRawCoreFormValues | null,
  index: PromptVaultIndex,
  now: () => string = () => new Date().toISOString(),
): WizardVaultProjection {
  const timestamp = now();
  const base = index.baseProfile?.value ?? null;
  const library = compatibilityLibrary(index);
  const fallbackValues = createWizardCoreFormValues(draft, null, library);
  const rawCandidate = rawValues ?? fallbackValues;
  const coreResult = WizardCoreFormSchema.safeParse(rawCandidate);
  const coreValues = coreResult.success ? coreResult.data : null;
  const storedProfile = findStoredProfile(draft, index);
  const profileId = storedProfile?.value.id ?? draft.draftId;
  const selection = coreValues
    ? (() => {
        try {
          return coreValues.category && coreValues.subtype
            ? parseAssetSelection(coreValues.category, coreValues.subtype)
            : null;
        } catch {
          return null;
        }
      })()
    : null;
  const requestedName = coreValues?.projectName.trim() ?? "";
  const hasCanonicalIdentity =
    selection !== null &&
    base !== null &&
    coreValues?.baseProfileId === base.id &&
    requestedName.length > 0;

  if (hasCanonicalIdentity) {
    try {
      const occupied = index.profiles
        .filter(({ value }) => value.id !== profileId)
        .map(({ value }) => value.folderName);
      const sameIdentity =
        storedProfile?.value.name === requestedName &&
        storedProfile.value.category === selection.category &&
        storedProfile.value.subtype === selection.subtype;
      const caseOnlyFolderName =
        storedProfile !== undefined &&
        storedProfile.value.category === selection.category &&
        storedProfile.value.subtype === selection.subtype &&
        storedProfile.value.folderName.toLocaleLowerCase("en-US") ===
          requestedName.toLocaleLowerCase("en-US");
      const folderName =
        sameIdentity || caseOnlyFolderName
          ? storedProfile.value.folderName
          : reserveProfileFolderName(requestedName, profileId, occupied);
      const isReady = coreValues !== null && readyAtLastApplicableStep(draft, coreValues, library);
      const previousOutputs = storedProfile?.value.outputs;
      const locationChanged =
        storedProfile !== undefined &&
        (storedProfile.value.category !== selection.category ||
          storedProfile.value.subtype !== selection.subtype ||
          storedProfile.value.folderName !== folderName);
      const relocatedFiles =
        previousOutputs && locationChanged
          ? previousOutputs.files.map((file) => ({
              ...file,
              relativePath: `${profileDirectory(selection.category, selection.subtype, folderName)}/${folderName}-${file.style}-${file.language}-${file.part}.md`,
            }))
          : previousOutputs?.files;
      const value = VaultPromptProfileEnvelopeSchema.parse({
        schemaVersion: 3,
        kind: "vaultPromptProfile",
        id: profileId,
        revision: storedProfile ? storedProfile.revision + 1 : 1,
        draftRevision: storedProfile ? storedProfile.value.draftRevision + 1 : 1,
        name: requestedName,
        folderName,
        category: selection.category,
        subtype: selection.subtype,
        baseProfileId: base.id,
        catalogVersion: V3_CATALOG_VERSION,
        status: isReady ? "ready" : "incomplete",
        answers: "answers" in draft ? draft.answers : {},
        rawValues: jsonObject({ ...rawCandidate, legacyV2Draft: draft }),
        wizard: wizardPosition(draft, coreValues, library),
        outputSelection: {
          styles:
            base.values.styleProfile === "both" ? ["classic", "dark"] : [base.values.styleProfile],
          languages: ["en", "de"],
        },
        outputs: previousOutputs
          ? {
              ...previousOutputs,
              status: previousOutputs.files.length > 0 ? "stale" : "none",
              files: relocatedFiles,
            }
          : { status: "none", generatedFrom: null, files: [] },
        createdAt: storedProfile?.value.createdAt ?? draft.savedAt,
        updatedAt: timestamp,
      });
      return {
        kind: "profile",
        value,
        ...(storedProfile ? { expectedSha256: storedProfile.sha256 } : {}),
      };
    } catch {
      // An invalid portable folder name must never displace the last profile.
    }
  }

  const storedDraft = index.drafts.find(({ value }) => value.draftId === draft.draftId);
  const value = VaultPromptDraftSchema.parse({
    schemaVersion: 3,
    kind: "vaultPromptDraft",
    draftId: draft.draftId,
    profileId: storedProfile?.value.id ?? null,
    revision: storedDraft ? storedDraft.revision + 1 : 1,
    identity: {
      name: String(rawCandidate.projectName ?? draft.projectName),
      category: coreValues?.category ?? ("category" in draft ? draft.category : null),
      subtype: coreValues?.subtype ?? ("subtype" in draft ? draft.subtype : null),
    },
    rawValues: jsonObject({ ...rawCandidate, legacyV2Draft: draft }),
    wizard: wizardPosition(draft, coreValues, library),
    createdAt: storedDraft?.value.createdAt ?? draft.savedAt,
    updatedAt: timestamp,
  });
  return {
    kind: "draft",
    value,
    ...(storedDraft ? { expectedSha256: storedDraft.sha256 } : {}),
  };
}

export function resolveWizardVaultProfile(
  profile: VaultPromptProfile,
  index: PromptVaultIndex,
): ResolvedProfile | null {
  const base = index.baseProfile?.value;
  if (!base) return null;
  const library = compatibilityLibrary(index);
  const asset = library.assetProfiles.find((candidate) => candidate.id === profile.id);
  const compatibleBase = library.baseProfiles[0];
  if (!asset || !compatibleBase) return null;
  try {
    const selection = parseAssetSelection(profile.category, profile.subtype);
    if (asset.compatibilityKey !== createCompatibilityKey(base.values, selection)) return null;
    const resolution = resolveProfile({ baseProfile: compatibleBase, assetProfile: asset });
    return resolution.status === "resolved" ? resolution.profile : null;
  } catch {
    return null;
  }
}
