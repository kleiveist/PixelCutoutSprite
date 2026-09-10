import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { resolveCapabilities } from "../../domain/assets";
import {
  createCompatibilityKey,
  resolveProfile,
  type ResolvedProfile,
} from "../../domain/profiles";
import { parseAssetSelection } from "../../domain/catalog";
import {
  parseAssetProfile,
  parseBaseProfile,
  type WizardDraft,
  type VaultBaseProfile,
  type VaultPromptDraft,
  type VaultPromptProfile,
} from "../../schemas";
import {
  createVaultPromptRepository,
  generateVaultPromptSnapshot,
  projectWizardToVault,
  hydrateWizardVaultDocument,
  VaultPromptAutosave,
  VaultPromptRegenerationQueue,
  type PromptVaultIndex,
  type RegenerationState,
  type StoredVaultDocument,
  type VaultAutosaveState,
  type VaultPromptRepository,
  type PromptVaultMigrationBundle,
  type StoredPromptGeneration,
} from "../../services";
import type { WizardRawCoreFormValues } from "../wizard";
import { useActiveVault } from "../../../shared/vault";

export interface VaultPromptContextValue {
  readonly status: "no_vault" | "loading" | "ready" | "error";
  readonly index: PromptVaultIndex | null;
  readonly error: string | null;
  readonly writable: boolean;
  readonly regeneration: RegenerationState;
  readonly autosave: VaultAutosaveState;
  reload(): Promise<void>;
  prepareProfile(profileId: string): Promise<void>;
  readGeneration(profileId: string, expectedSha256: string): Promise<StoredPromptGeneration>;
  revealPath(relativePath: string): Promise<void>;
  flush(): Promise<void>;
  saveBaseProfile(value: VaultBaseProfile): Promise<StoredVaultDocument<VaultBaseProfile>>;
  applyMigration(bundle: PromptVaultMigrationBundle): Promise<void>;
  queueWizardState(draft: WizardDraft, rawValues: WizardRawCoreFormValues | null): void;
}

const VaultPromptContext = createContext<VaultPromptContextValue | null>(null);

export interface VaultPromptProviderProps {
  readonly children: ReactNode;
  readonly repositoryFactory?: typeof createVaultPromptRepository;
  readonly now?: () => string;
}

const IDLE_REGENERATION: RegenerationState = {
  status: "idle",
  total: 0,
  completed: 0,
  failures: [],
};

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

const currentTimestamp = () => new Date().toISOString();

export function resolveStoredVaultProfile(
  profile: VaultPromptProfile,
  base: VaultBaseProfile,
): ResolvedProfile | null {
  try {
    if (profile.status !== "ready" || profile.baseProfileId !== base.id) return null;
    const baseProfile = parseBaseProfile({
      schemaVersion: 2,
      kind: "baseProfile",
      id: base.id,
      name: base.name,
      iconId: "world-grid",
      values: base.values,
      locks: base.locks,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    });
    const selection = parseAssetSelection(profile.category, profile.subtype);
    const assetProfile = parseAssetProfile({
      schemaVersion: 2,
      kind: "assetProfile",
      id: profile.id,
      name: profile.name,
      baseProfileId: base.id,
      compatibilityKey: createCompatibilityKey(base.values, selection),
      category: profile.category,
      subtype: profile.subtype,
      iconId: "asset-generic",
      badgeIconIds: [],
      capabilities: resolveCapabilities(selection.category, selection.subtype),
      overrides: {},
      answers: profile.answers,
      tags: [],
      favorite: false,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
    const resolved = resolveProfile({ baseProfile, assetProfile });
    return resolved.status === "resolved" ? resolved.profile : null;
  } catch {
    return null;
  }
}

export function VaultPromptProvider({
  children,
  repositoryFactory = createVaultPromptRepository,
  now = currentTimestamp,
}: VaultPromptProviderProps) {
  const { activeVault, saveQueue, session } = useActiveVault();
  const [status, setStatus] = useState<VaultPromptContextValue["status"]>("no_vault");
  const [index, setIndex] = useState<PromptVaultIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regeneration, setRegeneration] = useState(IDLE_REGENERATION);
  const [autosaveState, setAutosaveState] = useState<VaultAutosaveState>({ status: "idle" });
  const loadGeneration = useRef(0);
  const indexRef = useRef<PromptVaultIndex | null>(null);

  const repository = useMemo<VaultPromptRepository | null>(
    () => (session ? repositoryFactory(session, saveQueue) : null),
    [repositoryFactory, saveQueue, session],
  );
  const currentRepository = useRef(repository);
  currentRepository.current = repository;

  const publishIndex = useCallback((next: PromptVaultIndex | null): void => {
    indexRef.current = next;
    setIndex(next);
  }, []);

  const handleAutosaveStored = useCallback(
    async (
      kind: "draft" | "profile",
      stored: StoredVaultDocument<VaultPromptDraft | VaultPromptProfile>,
    ): Promise<StoredVaultDocument<VaultPromptDraft | VaultPromptProfile> | void> => {
      const current = indexRef.current;
      if (!current || currentRepository.current !== repository) return stored;
      if (kind === "draft" && stored.value && typeof stored.value === "object") {
        const draft = stored as StoredVaultDocument<VaultPromptDraft>;
        const next = {
          ...current,
          drafts: [
            ...current.drafts.filter(({ value }) => value.draftId !== draft.value.draftId),
            draft,
          ],
        };
        publishIndex(next);
        return draft;
      }
      const profile = stored as StoredVaultDocument<VaultPromptProfile>;
      const next = {
        ...current,
        profiles: [
          ...current.profiles.filter(({ value }) => value.id !== profile.value.id),
          profile,
        ],
      };
      publishIndex(next);
      const base = next.baseProfile?.value;
      if (!repository || !base || profile.value.status !== "ready") return profile;
      const resolved = resolveStoredVaultProfile(profile.value, base);
      if (!resolved) return profile;
      setRegeneration({ status: "running", total: 1, completed: 0, failures: [] });
      try {
        const snapshot = await generateVaultPromptSnapshot({
          profile: profile.value,
          resolvedProfile: resolved,
          baseRevision: base.revision,
          now,
        });
        const receipts = await repository.saveGeneration(
          snapshot.profile,
          snapshot.outputs,
          profile.sha256,
        );
        if (currentRepository.current !== repository) return profile;
        const profileReceipt = receipts.find(
          (receipt) => receipt.revision === snapshot.profile.revision,
        );
        if (!profileReceipt) throw new Error("Der Profilbeleg der Generierung fehlt.");
        const generated: StoredVaultDocument<VaultPromptProfile> = {
          relativePath: profileReceipt.relativePath,
          value: snapshot.profile,
          sha256: profileReceipt.sha256,
          revision: snapshot.profile.revision,
        };
        const latest = indexRef.current ?? next;
        const generatedIndex = {
          ...latest,
          profiles: [
            ...latest.profiles.filter(({ value }) => value.id !== generated.value.id),
            generated,
          ],
        };
        publishIndex(generatedIndex);
        setRegeneration({ status: "complete", total: 1, completed: 1, failures: [] });
        return generated;
      } catch (reason) {
        if (currentRepository.current !== repository) return profile;
        setRegeneration({
          status: "error",
          total: 1,
          completed: 1,
          failures: [
            {
              profileId: profile.value.id,
              profileName: profile.value.name,
              message: message(reason),
            },
          ],
        });
        return profile;
      }
    },
    [now, publishIndex, repository],
  );

  const autosave = useMemo(
    () =>
      repository
        ? new VaultPromptAutosave(repository, setAutosaveState, 400, handleAutosaveStored)
        : null,
    [handleAutosaveStored, repository],
  );

  useEffect(() => {
    if (!autosave) return;
    const unregister = saveQueue.registerBeforeFlush(() => autosave.commitPending());
    return () => {
      unregister();
      autosave.dispose();
    };
  }, [autosave, saveQueue]);

  const reload = useCallback(async (): Promise<void> => {
    const generation = ++loadGeneration.current;
    if (!repository) {
      setStatus("no_vault");
      publishIndex(null);
      setError(null);
      setRegeneration(IDLE_REGENERATION);
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      await repository.flush();
      const loaded = await repository.scan();
      if (loadGeneration.current !== generation) return;
      autosave?.seed(loaded.drafts, loaded.profiles);
      publishIndex(loaded);
      setStatus("ready");
    } catch (reason) {
      if (loadGeneration.current !== generation) return;
      setError(message(reason));
      setStatus("error");
    }
  }, [autosave, publishIndex, repository]);

  const flush = useCallback(async () => {
    if (!repository) throw new Error("Kein Vault ist aktiv.");
    await repository.flush();
    if (currentRepository.current !== repository)
      throw new Error("Der Vault wurde inzwischen gewechselt.");
  }, [repository]);

  const prepareProfile = useCallback(
    async (profileId: string) => {
      if (!repository) throw new Error("Kein Vault ist aktiv.");
      await flush();
      const loaded = await repository.scan();
      if (currentRepository.current !== repository)
        throw new Error("Der Vault wurde inzwischen gewechselt.");
      const matches = loaded.profiles.filter(({ value }) => value.id === profileId);
      if (matches.length !== 1)
        throw new Error("Das Profil fehlt, ist beschädigt oder seine ID ist mehrfach vorhanden.");
      // Preflight the full answer/position hydration before replacing the active wizard session.
      hydrateWizardVaultDocument(matches[0]!.value, loaded);
      autosave?.seed(loaded.drafts, loaded.profiles);
      publishIndex(loaded);
    },
    [autosave, flush, publishIndex, repository],
  );

  const readGeneration = useCallback(
    async (profileId: string, expectedSha256: string) => {
      if (!repository) throw new Error("Kein Vault ist aktiv.");
      return repository.readGeneration(profileId, expectedSha256);
    },
    [repository],
  );

  const revealPath = useCallback(
    async (relativePath: string) => {
      if (!repository) throw new Error("Kein Vault ist aktiv.");
      return repository.revealPath(relativePath);
    },
    [repository],
  );

  useEffect(() => {
    publishIndex(null);
    void reload();
    return () => {
      loadGeneration.current += 1;
    };
  }, [publishIndex, reload]);

  const saveBaseProfile = useCallback(
    async (value: VaultBaseProfile): Promise<StoredVaultDocument<VaultBaseProfile>> => {
      if (!repository || !activeVault) throw new Error("Kein Vault ist aktiv.");
      if (activeVault.mode !== "read_write") throw new Error("Der Vault ist schreibgeschützt.");
      const corruptBase = indexRef.current?.issues.find(
        (issue) =>
          issue.relativePath === ".PixelPrompt/basisprofil.json" ||
          issue.code === "duplicate_base_profile",
      );
      if (corruptBase) {
        throw new Error(
          "Die beschädigte Basisdatei muss zuerst extern gesichert und repariert werden.",
        );
      }
      const existing = indexRef.current?.baseProfile ?? null;
      if (existing && value.id !== existing.value.id) {
        throw new Error("Ein Vault darf keine zweite aktive Basisprofil-ID erhalten.");
      }
      if (existing && value.revision !== existing.value.revision + 1) {
        throw new Error("Die Basisprofil-Revision ist nicht der erwartete Nachfolger.");
      }
      if (!existing && value.revision !== 1) {
        throw new Error("Ein neues Basisprofil beginnt mit Revision 1.");
      }
      const stored = await repository.saveBaseProfile(value, existing?.sha256);
      const profiles = indexRef.current?.profiles ?? [];
      publishIndex(
        indexRef.current
          ? { ...indexRef.current, baseProfile: stored }
          : { baseProfile: stored, profiles: [], drafts: [], issues: [] },
      );
      const queue = new VaultPromptRegenerationQueue(
        repository,
        resolveStoredVaultProfile,
        setRegeneration,
        now,
      );
      void queue.regenerateAfterBaseChange(stored.value, profiles).then(
        () => void reload(),
        () => void reload(),
      );
      return stored;
    },
    [activeVault, now, publishIndex, reload, repository],
  );

  const queueWizardState = useCallback(
    (draft: WizardDraft, rawValues: WizardRawCoreFormValues | null): void => {
      const current = indexRef.current;
      if (!autosave || !current || activeVault?.mode !== "read_write") return;
      const projection = projectWizardToVault(draft, rawValues, current, now);
      if (projection.kind === "draft") {
        autosave.scheduleDraft(projection.value, projection.expectedSha256);
      } else {
        autosave.scheduleProfile(projection.value, projection.expectedSha256);
      }
    },
    [activeVault?.mode, autosave, now],
  );

  const applyMigration = useCallback(
    async (bundle: PromptVaultMigrationBundle): Promise<void> => {
      if (!repository || !activeVault) throw new Error("Kein Vault ist aktiv.");
      if (activeVault.mode !== "read_write") throw new Error("Der Vault ist schreibgeschützt.");
      await repository.applyMigration(bundle);
      await repository.flush();
      await reload();
    },
    [activeVault, reload, repository],
  );

  const value = useMemo<VaultPromptContextValue>(
    () => ({
      status,
      index,
      error,
      writable: activeVault?.mode === "read_write",
      regeneration,
      autosave: autosaveState,
      reload,
      prepareProfile,
      readGeneration,
      revealPath,
      flush,
      saveBaseProfile,
      applyMigration,
      queueWizardState,
    }),
    [
      activeVault?.mode,
      applyMigration,
      autosaveState,
      error,
      index,
      queueWizardState,
      regeneration,
      reload,
      prepareProfile,
      readGeneration,
      revealPath,
      flush,
      saveBaseProfile,
      status,
    ],
  );
  return <VaultPromptContext.Provider value={value}>{children}</VaultPromptContext.Provider>;
}

export function useVaultPrompt(): VaultPromptContextValue {
  const value = useContext(VaultPromptContext);
  if (!value) throw new Error("useVaultPrompt must be used inside VaultPromptProvider");
  return value;
}

export function useOptionalVaultPrompt(): VaultPromptContextValue | null {
  return useContext(VaultPromptContext);
}
