import { useEffect, useLayoutEffect, useRef } from "react";

import type { PromptView } from "../domain/navigation";
import type { IntegratedPromptNavigationAdapter, V2StorageAdapter } from "../services";
import {
  createIntegratedPromptNavigationAdapter,
  createVaultCompatibilityStorage,
} from "../services";
import { NavigationProvider, useNavigation } from "../store/navigation";
import { ProfileLibraryProvider } from "../store/profiles";
import { SettingsProvider, useSettings } from "../store/settings";
import { WizardSessionProvider, useWizardSession } from "../store/wizard";
import { useOptionalVaultPrompt } from "../store/vault";
import { useOptionalActiveVault } from "../../shared/vault";
import { PromptStudioNavigation, PromptStudioShell } from "./AppShell";
import "../styles/tokens.css";
import "../styles/prompt-studio.css";

export interface PromptGeneratorRootProps {
  readonly view: PromptView;
  readonly onNavigate: (view: PromptView) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly storageAdapter: V2StorageAdapter;
  readonly onOpenBaseProfile?: () => void;
  readonly onOpenLegacyMigration?: () => void;
  readonly now?: () => string;
  readonly createDraftId?: () => string;
  readonly createProfileId?: () => string;
  readonly createBaseProfileId?: () => string;
}

interface PromptWorkspaceProps {
  readonly storageAdapter: V2StorageAdapter;
  readonly onOpenBaseProfile?: () => void;
  readonly onOpenLegacyMigration: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly now?: () => string;
  readonly createDraftId?: () => string;
}

function PromptWorkspace({
  storageAdapter,
  onOpenBaseProfile,
  onOpenLegacyMigration = () => undefined,
  onDirtyChange,
  now,
  createDraftId,
}: PromptWorkspaceProps) {
  const { activeView } = useNavigation();
  const { settings } = useSettings();
  const { activeDraft, draftDirty, rawCoreFormValues, sessionRevision } = useWizardSession();
  const vaultPrompt = useOptionalVaultPrompt();
  const rootRef = useRef<HTMLElement>(null);
  const previousSessionRevisionRef = useRef(sessionRevision);
  const lastQueuedWizardState = useRef<string | null>(null);

  useLayoutEffect(() => {
    onDirtyChange?.(draftDirty);
    return () => onDirtyChange?.(false);
  }, [draftDirty, onDirtyChange]);

  useEffect(() => {
    const sessionChanged = previousSessionRevisionRef.current !== sessionRevision;
    previousSessionRevisionRef.current = sessionRevision;
    if (!sessionChanged || activeView !== "wizard") return;

    const focusTarget = rootRef.current?.closest<HTMLElement>("main") ?? rootRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [activeView, sessionRevision]);

  useEffect(() => {
    if (!activeDraft || !vaultPrompt) {
      lastQueuedWizardState.current = null;
      return;
    }
    const fingerprint = JSON.stringify({ draft: activeDraft, rawCoreFormValues });
    if (lastQueuedWizardState.current === fingerprint) return;
    const initialHydration = lastQueuedWizardState.current === null;
    lastQueuedWizardState.current = fingerprint;
    if (initialHydration && !draftDirty && rawCoreFormValues === null) return;
    vaultPrompt.queueWizardState(activeDraft, rawCoreFormValues);
  }, [activeDraft, draftDirty, rawCoreFormValues, vaultPrompt]);

  return (
    <section
      ref={rootRef}
      className="prompt-generator-root"
      data-prompt-view={activeView}
      {...(!vaultPrompt ? { "data-theme": settings.theme } : {})}
      aria-label="PixelPromptStudio Generator"
    >
      {vaultPrompt?.autosave.status === "error" ? (
        <div className="prompt-vault-save-error" role="alert">
          Vault-Autosave fehlgeschlagen: {vaultPrompt.autosave.message}
        </div>
      ) : null}
      {!vaultPrompt ? <PromptStudioNavigation /> : null}
      <div className="prompt-generator-scroll">
        <div className="prompt-generator-content">
          <PromptStudioShell
            storageAdapter={storageAdapter}
            view={activeView}
            {...(onOpenBaseProfile ? { onOpenBaseProfile } : {})}
            onOpenLegacyMigration={onOpenLegacyMigration}
            {...(now ? { now } : {})}
            {...(createDraftId ? { createDraftId } : {})}
          />
        </div>
      </div>
    </section>
  );
}

export function PromptGeneratorRoot({
  view,
  onNavigate,
  onDirtyChange,
  storageAdapter,
  onOpenBaseProfile,
  onOpenLegacyMigration = () => undefined,
  now,
  createDraftId,
  createProfileId,
  createBaseProfileId,
}: PromptGeneratorRootProps) {
  const vaultPrompt = useOptionalVaultPrompt();
  const activeVault = useOptionalActiveVault();
  const hydratedStorage = useRef<{
    readonly key: string;
    readonly adapter: V2StorageAdapter;
  } | null>(null);
  const session = activeVault?.session;
  const baseHash = vaultPrompt?.index?.baseProfile?.sha256 ?? "no-base";
  const hydrationKey =
    session && vaultPrompt?.index
      ? `${session.sessionId}:${session.generation}:${baseHash}`
      : "provided";
  if (hydratedStorage.current?.key !== hydrationKey) {
    hydratedStorage.current = {
      key: hydrationKey,
      adapter:
        hydrationKey === "provided" || !vaultPrompt?.index
          ? storageAdapter
          : createVaultCompatibilityStorage(vaultPrompt.index, now),
    };
  }
  const effectiveStorage = hydratedStorage.current.adapter;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const adapterRef = useRef<IntegratedPromptNavigationAdapter | null>(null);
  if (adapterRef.current === null) {
    adapterRef.current = createIntegratedPromptNavigationAdapter(view, (nextView) =>
      onNavigateRef.current(nextView),
    );
  }

  useEffect(() => {
    adapterRef.current?.setView(view);
  }, [view]);

  return (
    <SettingsProvider
      key={hydrationKey}
      storageAdapter={effectiveStorage}
      {...(now ? { now } : {})}
    >
      <ProfileLibraryProvider
        storageAdapter={effectiveStorage}
        {...(now ? { now } : {})}
        {...(createProfileId ? { createProfileId } : {})}
        {...(createBaseProfileId ? { createBaseProfileId } : {})}
      >
        <NavigationProvider navigationAdapter={adapterRef.current}>
          <WizardSessionProvider>
            <PromptWorkspace
              storageAdapter={effectiveStorage}
              {...(onOpenBaseProfile ? { onOpenBaseProfile } : {})}
              onOpenLegacyMigration={onOpenLegacyMigration}
              {...(onDirtyChange ? { onDirtyChange } : {})}
              {...(now ? { now } : {})}
              {...(createDraftId ? { createDraftId } : {})}
            />
          </WizardSessionProvider>
        </NavigationProvider>
      </ProfileLibraryProvider>
    </SettingsProvider>
  );
}
