import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  vaultClient,
  type OpenVault,
  type RecoveryStatus,
  type VaultClient,
} from "../shared/vault/vault-client";
import { AppHeader } from "../components/AppHeader";
import { DialogLayer } from "../components/DialogLayer";
import { StatusBar } from "../components/StatusBar";
import { CutoutStudio } from "../cutout-studio/CutoutStudio";
import { nativeCutoutClient, type CutoutClient } from "../cutout-studio/client";
import { PromptGeneratorRoot } from "../prompt-studio/app";
import { LegacyMigrationDialog, VaultBaseProfileDialog } from "../prompt-studio/features/profiles";
import { VaultPromptProvider, type VaultPromptProviderProps } from "../prompt-studio/store/vault";
import {
  createVaultPromptRepository,
  initializeSessionWorkspaceStorage,
  type V2StorageAdapter,
} from "../prompt-studio/services";
import {
  DataFolderProvider,
  DataFolderWorkspace,
  nativeDataFolderClient,
  type DataFolderClient,
} from "../shared/data-folder";
import { ModalHost } from "../shared/dialogs";
import { ModuleNavigationRow, type StudioMode } from "../shared/navigation";
import {
  GlobalSettingsDialog,
  GlobalSettingsProvider,
  type GlobalSettingsClient,
} from "../shared/settings";
import { classifyNativeError, observeRejectedClientCalls } from "../shared/storage/nativeErrors";
import { registerNativeCloseFlush, SaveQueue } from "../shared/storage";
import { ActiveVaultProvider, type ActiveVault, vaultDisplayName } from "../shared/vault";
import { RecoveryPanel } from "../shared/vault/RecoveryPanel";
import { SpriteStudio } from "../sprite-studio";
import { nativeSpriteClient, type SpriteClient } from "../sprite-studio/client";
import { promptNavigationItems, type PromptView } from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

export interface AppProps {
  promptStorageAdapter?: V2StorageAdapter;
  flushPromptStorage?: () => Promise<void>;
  globalSettingsApi?: GlobalSettingsClient;
  promptVaultRepositoryFactory?: VaultPromptProviderProps["repositoryFactory"];
  vaultApi?: VaultClient;
  dataFolderApi?: DataFolderClient;
  cutoutApi?: CutoutClient;
  spriteApi?: SpriteClient;
}
const noOpFlush = async () => undefined;

export function App({
  promptStorageAdapter,
  flushPromptStorage = noOpFlush,
  globalSettingsApi,
  promptVaultRepositoryFactory,
  vaultApi = vaultClient,
  dataFolderApi,
  cutoutApi,
  spriteApi,
}: AppProps = {}) {
  const [activeStudio, setActiveStudio] = useState<StudioMode>("cutout");
  const [promptView, setPromptView] = useState<PromptView>("dashboard");
  const [promptDraftDirty, setPromptDraftDirty] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseProfileOpen, setBaseProfileOpen] = useState(false);
  const [legacyMigrationOpen, setLegacyMigrationOpen] = useState(false);
  const [status, setStatus] = useState("Bereit · wähle einen Vault");
  const openBaseProfile = useCallback(() => setBaseProfileOpen(true), []);
  const openLegacyMigration = useCallback(() => setLegacyMigrationOpen(true), []);
  const [vault, setVault] = useState<ActiveVault | null>(null);
  const mainContent = useRef<HTMLElement>(null);
  const vaultRef = useRef<ActiveVault | null>(null);
  vaultRef.current = vault;
  const transitionInFlight = useRef(false);
  const fallbackGeneration = useRef(0);
  const closedSessions = useRef(new Set<string>());
  const [sessionStorage] = useState(() => initializeSessionWorkspaceStorage().storageAdapter);
  const [saveQueue] = useState(
    () =>
      new SaveQueue(() => {
        const current = vaultRef.current;
        return current
          ? { sessionId: current.session_id, generation: current.session_generation }
          : null;
      }),
  );

  const closeSession = useCallback(
    async (id: string) => {
      if (closedSessions.current.has(id)) return;
      await vaultApi.close(id);
      closedSessions.current.add(id);
    },
    [vaultApi],
  );

  const flushCurrent = useCallback(async () => {
    const current = vaultRef.current;
    await saveQueue.flush(
      current
        ? { sessionId: current.session_id, generation: current.session_generation }
        : undefined,
    );
    if (activeStudio === "prompt") await flushPromptStorage();
  }, [activeStudio, flushPromptStorage, saveQueue]);

  const observeFailure = useCallback(
    (reason: unknown, id: string | undefined) => {
      if (
        !id ||
        vaultRef.current?.session_id !== id ||
        classifyNativeError(reason).kind !== "recovery_required"
      )
        return;
      // Read-only discovery, never automatic resume/rollback. Ignore a late result from another vault.
      void vaultApi
        .listRecovery(id)
        .then((result) => {
          if (vaultRef.current?.session_id !== id) return;
          setVault((current) => (current?.session_id === id ? { ...current, ...result } : current));
          setStatus("Interrupted file operations require recovery");
        })
        .catch((failure) => {
          if (vaultRef.current?.session_id === id)
            setStatus(`Recovery discovery failed · ${classifyNativeError(failure).message}`);
        });
    },
    [vaultApi],
  );
  const observedDataFolder = useMemo(
    () =>
      observeRejectedClientCalls(dataFolderApi ?? nativeDataFolderClient, (reason) =>
        observeFailure(reason, vault?.session_id),
      ),
    [dataFolderApi, observeFailure, vault?.session_id],
  );
  const observedCutout = useMemo(
    () =>
      observeRejectedClientCalls(cutoutApi ?? nativeCutoutClient, (reason) =>
        observeFailure(reason, vault?.session_id),
      ),
    [cutoutApi, observeFailure, vault?.session_id],
  );
  const observedSprite = useMemo(
    () =>
      observeRejectedClientCalls(spriteApi ?? nativeSpriteClient, (reason) =>
        observeFailure(reason, vault?.session_id),
      ),
    [spriteApi, observeFailure, vault?.session_id],
  );
  const observedPromptFactory = useCallback<typeof createVaultPromptRepository>(
    (session, queue) =>
      observeRejectedClientCalls(
        (promptVaultRepositoryFactory ?? createVaultPromptRepository)(session, queue),
        (reason) => observeFailure(reason, session.sessionId),
      ),
    [observeFailure, promptVaultRepositoryFactory],
  );

  useEffect(() => {
    mainContent.current?.focus();
  }, [activeStudio, promptView]);

  const sessionId = vault?.session_id;
  useEffect(
    () => () => {
      if (sessionId) void closeSession(sessionId).catch(() => undefined);
    },
    [closeSession, sessionId],
  );

  const heartbeatId =
    vault && (vault.mode === "read_write" || vault.recovery_writable) ? vault.session_id : null;
  useEffect(() => {
    if (!heartbeatId) return;
    let active = true;
    const heartbeat = () =>
      void vaultApi.heartbeat(heartbeatId).catch((reason) => {
        if (active) setStatus(`Vault heartbeat failed · ${classifyNativeError(reason).message}`);
      });
    heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [heartbeatId, vaultApi]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void registerNativeCloseFlush(
      async () => {
        await flushCurrent();
        if (vaultRef.current) await closeSession(vaultRef.current.session_id);
      },
      (reason) => {
        if (active)
          setStatus(
            `App close blocked · pending data was not saved · ${classifyNativeError(reason).message}`,
          );
      },
    )
      .then((stop) => {
        if (active) unlisten = stop;
        else stop();
      })
      .catch((reason) => {
        if (active)
          setStatus(`Native close protection unavailable · ${classifyNativeError(reason).message}`);
      });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [closeSession, flushCurrent]);

  useEffect(() => {
    if (!promptDraftDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [promptDraftDirty]);

  const handleKeyboardAction = useCallback(
    (action: KeyboardAction) => {
      if (action === "help") setHelpOpen(true);
      if (action === "dismiss") setHelpOpen(false);
      if (action === "save")
        void flushCurrent().then(
          () => setStatus("Ausstehende Änderungen gespeichert"),
          (reason) =>
            setStatus(`Speichern fehlgeschlagen · ${classifyNativeError(reason).message}`),
        );
    },
    [flushCurrent],
  );
  useKeyboardActions(handleKeyboardAction);

  async function switchStudio(next: StudioMode) {
    if (next === activeStudio || transitionInFlight.current) return;
    if (vaultRef.current?.recovery.length) {
      setStatus("Workspace navigation is blocked until vault recovery is complete");
      return;
    }
    if (activeStudio === "prompt" && promptDraftDirty) {
      setStatus("Studio switch blocked · wait for prompt autosave or correct the active step");
      return;
    }
    transitionInFlight.current = true;
    try {
      await flushCurrent();
      setActiveStudio(next);
      setStatus(
        next === "cutout"
          ? "Cutout-Studio geöffnet"
          : next === "prompt"
            ? "PixelPromptStudio Generator opened"
            : "PixelSpriteStudio geöffnet",
      );
    } catch (reason) {
      setStatus(
        `Studio switch blocked · prompt data was not saved · ${classifyNativeError(reason).message}`,
      );
    } finally {
      transitionInFlight.current = false;
    }
  }

  async function beforeOpen() {
    if (transitionInFlight.current) throw new Error("Ein Wechsel läuft bereits.");
    if (promptDraftDirty)
      throw new Error("Vor dem Vault-Wechsel muss der Prompt-Entwurf gespeichert sein.");
    await flushCurrent();
  }

  async function openVault(opened: OpenVault) {
    const previous = vaultRef.current;
    if (previous?.session_id === opened.session_id) return;
    if (transitionInFlight.current) throw new Error("Ein Wechsel läuft bereits.");
    transitionInFlight.current = true;
    try {
      await flushCurrent();
      if (previous) await closeSession(previous.session_id);
      fallbackGeneration.current = Math.max(
        fallbackGeneration.current + 1,
        opened.session_generation ?? 0,
      );
      const normalized: ActiveVault = {
        ...opened,
        session_generation: opened.session_generation ?? fallbackGeneration.current,
        display_name: vaultDisplayName(opened.path),
        recovery: opened.recovery ?? [],
        recovery_writable: opened.recovery_writable ?? false,
        lock_recovery: opened.lock_recovery ?? null,
      };
      vaultRef.current = normalized;
      setVault(normalized);
      setPromptDraftDirty(false);
      setPromptView("dashboard");
      setStatus(
        normalized.notice ??
          `${normalized.mode === "read_write" ? "Writable" : "Read-only"} vault · ${normalized.display_name}`,
      );
    } finally {
      transitionInFlight.current = false;
    }
  }

  async function closeCurrentVault() {
    if (transitionInFlight.current || !vaultRef.current) return;
    if (promptDraftDirty) {
      setStatus("Vault close blocked · wait for prompt autosave or correct the active step");
      return;
    }
    transitionInFlight.current = true;
    try {
      await flushCurrent();
      await closeSession(vaultRef.current.session_id);
      vaultRef.current = null;
      setVault(null);
      setPromptDraftDirty(false);
      setStatus("Vault closed");
    } catch (reason) {
      setStatus(
        `Vault close blocked · pending data was not saved · ${classifyNativeError(reason).message}`,
      );
    } finally {
      transitionInFlight.current = false;
    }
  }

  function updateRecovery(recovery: RecoveryStatus) {
    setVault((current) => (current ? { ...current, ...recovery } : current));
    setStatus(
      recovery.recovery.length
        ? `${recovery.recovery.length} interrupted operation(s) still need recovery`
        : "Vault recovery complete",
    );
  }

  const recovering = !!vault?.recovery.length;
  return (
    <GlobalSettingsProvider client={globalSettingsApi}>
      <ActiveVaultProvider activeVault={vault} saveQueue={saveQueue}>
        <DataFolderProvider client={observedDataFolder}>
          <VaultPromptProvider repositoryFactory={observedPromptFactory}>
            <div className="app-frame" data-studio={activeStudio} data-modal-background>
              <AppHeader
                activeStudio={activeStudio}
                onOpenCutoutStudio={() => void switchStudio("cutout")}
                onOpenPromptStudio={() => void switchStudio("prompt")}
                onOpenSpriteStudio={() => void switchStudio("sprite")}
                onSettings={() => setSettingsOpen(true)}
                onHelp={() => setHelpOpen(true)}
              />
              <ModuleNavigationRow
                module={activeStudio}
                items={
                  activeStudio === "prompt" && !recovering
                    ? promptNavigationItems.map((item) => ({
                        id: item.id,
                        label: item.label,
                        current: promptView === item.id,
                        onSelect: setPromptView,
                      }))
                    : []
                }
                actions={
                  vault && !recovering ? (
                    <button type="button" onClick={() => void closeCurrentVault()}>
                      Vault schließen
                    </button>
                  ) : undefined
                }
              />
              <div
                className={`content-frame ${activeStudio === "prompt" ? "prompt-content-frame" : "image-content-frame"}`}
              >
                <main
                  ref={mainContent}
                  className={`main-content ${activeStudio === "prompt" ? "prompt-workspace" : ""}`}
                  tabIndex={-1}
                  aria-label={
                    activeStudio === "prompt"
                      ? "PixelPromptStudio Generator"
                      : activeStudio === "sprite"
                        ? "PixelSpriteStudio"
                        : "PixelCutoutSprite"
                  }
                >
                  {recovering && vault ? (
                    <RecoveryPanel
                      client={vaultApi}
                      vault={vault}
                      onCloseVault={() => void closeCurrentVault()}
                      onRecovered={updateRecovery}
                    />
                  ) : activeStudio === "cutout" ? (
                    <DataFolderWorkspace module="cutout">
                      <CutoutStudio
                        cutoutClient={observedCutout}
                        client={vaultApi}
                        beforeOpen={beforeOpen}
                        onOpened={openVault}
                      />
                    </DataFolderWorkspace>
                  ) : activeStudio === "sprite" ? (
                    <SpriteStudio
                      spriteClient={observedSprite}
                      client={vaultApi}
                      beforeOpen={beforeOpen}
                      onOpened={openVault}
                    />
                  ) : (
                    <PromptGeneratorRoot
                      view={promptView}
                      onNavigate={setPromptView}
                      onDirtyChange={setPromptDraftDirty}
                      storageAdapter={promptStorageAdapter ?? sessionStorage}
                      onOpenBaseProfile={openBaseProfile}
                      onOpenLegacyMigration={openLegacyMigration}
                    />
                  )}
                </main>
              </div>
              <StatusBar message={status} />
              <ModalHost>
                <DialogLayer open={helpOpen} onClose={() => setHelpOpen(false)} />
                <GlobalSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <VaultBaseProfileDialog
                  open={baseProfileOpen}
                  onClose={() => setBaseProfileOpen(false)}
                />
                <LegacyMigrationDialog
                  open={legacyMigrationOpen}
                  onClose={() => setLegacyMigrationOpen(false)}
                />
              </ModalHost>
            </div>
          </VaultPromptProvider>
        </DataFolderProvider>
      </ActiveVaultProvider>
    </GlobalSettingsProvider>
  );
}
