import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { areaClient, type AreaClient } from "../api/area-client";
import { assetClient, type AssetClient } from "../api/asset-client";
import { exportClient, type ExportClient } from "../api/export-client";
import { motionClient, type MotionClient } from "../api/motion-client";
import { npcClient, type NpcClient } from "../api/npc-client";
import { outfitClient, type OutfitClient } from "../api/outfit-client";
import { projectClient, type ProjectClient } from "../api/project-client";
import {
  vaultClient,
  type OpenVault,
  type RecoveryStatus,
  type VaultClient,
} from "../api/vault-client";
import { AppHeader } from "../components/AppHeader";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { DialogLayer } from "../components/DialogLayer";
import { NativeAcceptanceProbe } from "../components/NativeAcceptanceProbe";
import { PlaceholderView } from "../components/PlaceholderView";
import { StatusBar } from "../components/StatusBar";
import { WorkspaceNav } from "../components/WorkspaceNav";
import type { ProjectCard } from "../domain/projects";
import type { AreaCard } from "../domain/areas";
import type { MotionOpenTarget } from "../domain/animations";
import type { RevisionRef } from "../domain/common";
import type { AssetImportJobView } from "../domain/inventory";
import { PromptGeneratorRoot } from "../prompt-studio/app";
import {
  createBrowserOutputWorkspaceAdapter,
  initializeBrowserWorkspaceStorage,
  type LegacyV1StorageMigrationResult,
  type OutputWorkspaceAdapter,
  type V2StorageAdapter,
} from "../prompt-studio/services";
import { AnimationDashboard } from "../features/animations/AnimationDashboard";
import { MotionDummyEditorRoute } from "../features/dummy-editor/MotionDummyEditorRoute";
import { ExportWorkspace } from "../features/export";
import { InventoryWorkspace } from "../features/inventory/InventoryWorkspace";
import { NpcWorkspace } from "../features/npcs";
import { OutfitEditor } from "../features/outfit";
import { ProjectDashboard } from "../features/projects/ProjectDashboard";
import { RecoveryPanel } from "../features/vault/RecoveryPanel";
import {
  classifyNativeError,
  guardEditorNavigation,
  observeRejectedClientCalls,
  type EditorController,
  type EditorControllerChange,
  type EditorRecoveryCopy,
} from "../features/editing";
import {
  navigationItems,
  routeBreadcrumbs,
  routeDetails,
  type PromptView,
  type StudioMode,
  type WorkspaceRoute,
} from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

export interface AppProps {
  areasApi?: AreaClient;
  assetsApi?: AssetClient;
  exportsApi?: ExportClient;
  motionsApi?: MotionClient;
  npcsApi?: NpcClient;
  outfitsApi?: OutfitClient;
  projectsApi?: ProjectClient;
  promptOutputAdapter?: OutputWorkspaceAdapter;
  promptStartupMigration?: LegacyV1StorageMigrationResult;
  promptStorageAdapter?: V2StorageAdapter;
  flushPromptStorage?: () => Promise<void>;
  vaultApi?: VaultClient;
}

async function noOpPromptStorageFlush(): Promise<void> {}

const browserPromptWorkspace = initializeBrowserWorkspaceStorage();
const browserPromptOutput = createBrowserOutputWorkspaceAdapter();

export function App({
  areasApi = areaClient,
  assetsApi = assetClient,
  exportsApi = exportClient,
  motionsApi = motionClient,
  npcsApi = npcClient,
  outfitsApi = outfitClient,
  projectsApi = projectClient,
  promptOutputAdapter = browserPromptOutput,
  promptStartupMigration = browserPromptWorkspace.migration,
  promptStorageAdapter = browserPromptWorkspace.storageAdapter,
  flushPromptStorage = noOpPromptStorageFlush,
  vaultApi = vaultClient,
}: AppProps = {}) {
  const [activeStudio, setActiveStudio] = useState<StudioMode>("cutout");
  const [promptView, setPromptView] = useState<PromptView>("dashboard");
  const [promptDraftDirty, setPromptDraftDirty] = useState(false);
  const [route, setRoute] = useState<WorkspaceRoute>("welcome");
  const [helpOpen, setHelpOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Ready · changes stay on this device");
  const [vault, setVault] = useState<OpenVault | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaCard | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateRef, setSelectedTemplateRef] = useState<RevisionRef | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [npcEditorDirty, setNpcEditorDirty] = useState(false);
  const [npcMutationInFlight, setNpcMutationInFlight] = useState(false);
  const [releaseRunning, setReleaseRunning] = useState(false);
  const [exportRunning, setExportRunning] = useState(false);
  const [assetImportJob, setAssetImportJob] = useState<AssetImportJobView | null>(null);
  const [assetImportCancelling, setAssetImportCancelling] = useState(false);
  const [editorRecoveryCopy, setEditorRecoveryCopy] = useState<EditorRecoveryCopy | null>(null);
  const mainContent = useRef<HTMLElement>(null);
  const promptContent = useRef<HTMLElement>(null);
  const initialRoute = useRef(true);
  const studioSwitchInFlight = useRef(false);
  const editorController = useRef<EditorController | null>(null);
  const npcRecoveryCopy = useRef<EditorRecoveryCopy | null>(null);
  const vaultRef = useRef<OpenVault | null>(null);
  const recoveryRefreshInFlight = useRef<Promise<void> | null>(null);
  const handledImportTerminal = useRef<string | null>(null);
  vaultRef.current = vault;

  const handleNativeRejection = useCallback(
    (reason: unknown): void => {
      const failure = classifyNativeError(reason);
      const opened = vaultRef.current;
      if (failure.kind !== "recovery_required" || !opened || recoveryRefreshInFlight.current) {
        return;
      }
      const session = opened.session_id;
      const operation = vaultApi
        .listRecovery(session)
        .then((recoveryStatus) => {
          if (vaultRef.current?.session_id !== session) return;
          if (recoveryStatus.recovery.length === 0) {
            setStatus(failure.message);
            return;
          }
          setEditorRecoveryCopy(
            editorController.current?.recoveryCopy?.() ?? npcRecoveryCopy.current,
          );
          setVault((current) =>
            current?.session_id === session
              ? {
                  ...current,
                  recovery: recoveryStatus.recovery,
                  recovery_writable: recoveryStatus.recovery_writable,
                  mode: recoveryStatus.mode,
                  indexed_objects: recoveryStatus.indexed_objects,
                }
              : current,
          );
          setStatus(
            `${recoveryStatus.recovery.length} interrupted operation(s) need explicit recovery`,
          );
        })
        .catch((refreshReason: unknown) => {
          setStatus(
            `Vault recovery state could not be loaded · ${classifyNativeError(refreshReason).message}`,
          );
        })
        .finally(() => {
          if (recoveryRefreshInFlight.current === operation) {
            recoveryRefreshInFlight.current = null;
          }
        });
      recoveryRefreshInFlight.current = operation;
    },
    [vaultApi],
  );

  const observedAreasApi = useMemo(
    () => observeRejectedClientCalls(areasApi, handleNativeRejection),
    [areasApi, handleNativeRejection],
  );
  const observedAssetsApi = useMemo(
    () => observeRejectedClientCalls(assetsApi, handleNativeRejection),
    [assetsApi, handleNativeRejection],
  );
  const observedExportsApi = useMemo(
    () => observeRejectedClientCalls(exportsApi, handleNativeRejection),
    [exportsApi, handleNativeRejection],
  );
  const observedMotionsApi = useMemo(
    () => observeRejectedClientCalls(motionsApi, handleNativeRejection),
    [handleNativeRejection, motionsApi],
  );
  const observedNpcsApi = useMemo(
    () => observeRejectedClientCalls(npcsApi, handleNativeRejection),
    [handleNativeRejection, npcsApi],
  );
  const observedOutfitsApi = useMemo(
    () => observeRejectedClientCalls(outfitsApi, handleNativeRejection),
    [handleNativeRejection, outfitsApi],
  );
  const observedProjectsApi = useMemo(
    () => observeRejectedClientCalls(projectsApi, handleNativeRejection),
    [handleNativeRejection, projectsApi],
  );

  const registerEditorController = useCallback<EditorControllerChange>((controller) => {
    editorController.current = controller;
  }, []);
  const registerNpcRecoveryCopy = useCallback((copy: EditorRecoveryCopy | null) => {
    npcRecoveryCopy.current = copy;
  }, []);

  const handleKeyboardAction = useCallback((action: KeyboardAction) => {
    const controller = editorController.current;
    if (controller && action === "toggle-playback") {
      return;
    }
    if (controller && (action === "save" || action === "undo" || action === "redo")) {
      const editorState = controller.getState();
      if (!editorState.writable) {
        setStatus(`${controller.label} is read-only`);
        return;
      }
      if (action === "save") {
        if (editorState.mutationInFlight) {
          setStatus(`Wait for ${controller.label} to finish ${editorState.status.toLowerCase()}`);
          return;
        }
        setStatus(`Saving ${controller.label}…`);
        void controller
          .save()
          .then(() => setStatus(controller.getState().status))
          .catch((reason) => {
            const failure = classifyNativeError(reason);
            setStatus(
              failure.kind === "conflict"
                ? `Save conflict in ${controller.label} · use the recovery actions in the editor`
                : `${controller.label} was not saved · ${failure.message}`,
            );
          });
        return;
      }
      if (editorState.mutationInFlight) {
        setStatus(`Wait for ${controller.label} to finish ${editorState.status.toLowerCase()}`);
        return;
      }
      if (action === "undo" && editorState.canUndo) {
        controller.undo();
        setStatus(`Undid the latest ${controller.label} change`);
      } else if (action === "redo" && editorState.canRedo) {
        controller.redo();
        setStatus(`Redid the latest ${controller.label} change`);
      } else {
        setStatus(`Nothing to ${action} in ${controller.label}`);
      }
      return;
    }
    switch (action) {
      case "help":
        setHelpOpen(true);
        break;
      case "dismiss":
        setHelpOpen(false);
        break;
      case "toggle-playback":
        setPlaying((current) => !current);
        setStatus("Preview playback toggled");
        break;
      case "save":
        setStatus("Nothing to save yet · choose a vault first");
        break;
      case "undo":
        setStatus("Nothing to undo");
        break;
      case "redo":
        setStatus("Nothing to redo");
        break;
    }
  }, []);

  useKeyboardActions(handleKeyboardAction);
  const details = routeDetails(route);

  useEffect(() => {
    if (activeStudio === "prompt") {
      promptContent.current?.focus();
      return;
    }
    if (initialRoute.current) {
      initialRoute.current = false;
      return;
    }
    mainContent.current?.focus();
  }, [activeStudio, promptView, route]);

  const sessionId = vault?.session_id ?? null;
  const heartbeatSessionId =
    vault && (vault.mode === "read_write" || vault.recovery_writable) ? vault.session_id : null;
  useEffect(
    () => () => {
      if (sessionId) void vaultApi.close(sessionId).catch(() => undefined);
    },
    [sessionId, vaultApi],
  );

  const trackAssetImport = useCallback((job: AssetImportJobView): void => {
    if (vaultRef.current?.session_id === job.session_id) setAssetImportJob(job);
  }, []);

  useEffect(() => {
    setAssetImportJob(null);
    handledImportTerminal.current = null;
    if (!sessionId || typeof observedAssetsApi.activeImportJobs !== "function") return;
    let disposed = false;
    let retryTimer = 0;
    const attach = (): void => {
      void observedAssetsApi.activeImportJobs!(sessionId)
        .then((jobs) => {
          if (disposed || vaultRef.current?.session_id !== sessionId) return;
          const attached = jobs.find(isActiveAssetImport) ?? null;
          setAssetImportJob((current) =>
            current?.session_id === sessionId && isActiveAssetImport(current) ? current : attached,
          );
        })
        .catch(() => {
          if (disposed) return;
          // Opening a vault may race native startup; keep unrelated recovery/heartbeat status
          // authoritative while the session-level import attachment retries quietly.
          retryTimer = window.setTimeout(attach, 1_000);
        });
    };
    attach();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
    };
  }, [observedAssetsApi, sessionId]);

  useEffect(() => {
    if (!sessionId || !assetImportJob || !isActiveAssetImport(assetImportJob)) return;
    let disposed = false;
    let retryTimer = 0;
    const poll = (): void => {
      retryTimer = window.setTimeout(() => {
        void observedAssetsApi
          .importJob(sessionId, assetImportJob.job_id)
          .then((job) => {
            if (!disposed && vaultRef.current?.session_id === sessionId) {
              setAssetImportJob(job);
            }
          })
          .catch((reason: unknown) => {
            if (disposed) return;
            setStatus(`Import progress temporarily unavailable; retrying · ${message(reason)}`);
            poll();
          });
      }, 250);
    };
    poll();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
    };
  }, [assetImportJob, observedAssetsApi, sessionId]);

  useEffect(() => {
    if (!assetImportJob || isActiveAssetImport(assetImportJob)) return;
    const key = `${assetImportJob.job_id}:${assetImportJob.state}`;
    if (handledImportTerminal.current === key) return;
    handledImportTerminal.current = key;
    if (assetImportJob.state === "completed") {
      const imported = assetImportJob.result?.imported_assets.length ?? 0;
      setStatus(
        assetImportJob.result?.warning
          ? `${imported} asset image(s) committed · ${assetImportJob.result.warning}`
          : `${imported} asset image(s) imported successfully`,
      );
    } else if (assetImportJob.state === "cancelled") {
      setStatus("Asset import cancelled safely");
    } else {
      setStatus(`Asset import failed · ${assetImportJob.error ?? "unknown import failure"}`);
    }
  }, [assetImportJob]);

  useEffect(() => {
    if (!heartbeatSessionId || typeof vaultApi.heartbeat !== "function") return;
    let active = true;
    const heartbeat = (): void => {
      void vaultApi.heartbeat(heartbeatSessionId).catch((reason) => {
        if (active) setStatus(`Vault heartbeat failed · ${classifyNativeError(reason).message}`);
      });
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [heartbeatSessionId, vaultApi]);

  useEffect(() => {
    if (
      !npcMutationInFlight &&
      !releaseRunning &&
      !exportRunning &&
      !promptDraftDirty &&
      !isActiveAssetImport(assetImportJob)
    )
      return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [assetImportJob, exportRunning, npcMutationInFlight, promptDraftDirty, releaseRunning]);

  function allowCutoutContextChange(blockActiveImport: boolean): boolean {
    if ((vault?.recovery?.length ?? 0) > 0) {
      setStatus("Workspace navigation is blocked until vault recovery is complete");
      return false;
    }
    if (blockActiveImport && isActiveAssetImport(assetImportJob)) {
      setStatus("Studio switch blocked · cancel the active asset import first");
      return false;
    }
    if (exportRunning) {
      setStatus("Navigation blocked · cancel the active export and wait for it to finish");
      return false;
    }
    if (releaseRunning) {
      setStatus("Navigation blocked · wait for the immutable motion release to finish");
      return false;
    }
    if (route === "characters" && npcMutationInFlight) {
      setStatus("Navigation blocked · wait for the current NPC operation to finish");
      return false;
    }
    const activeController = editorController.current;
    if (activeController) {
      const decision = guardEditorNavigation(activeController, (message) =>
        window.confirm(message),
      );
      if (!decision.allowed && decision.reason === "mutation_in_flight") {
        setStatus(
          `Navigation blocked · wait for ${activeController.label} to finish ${decision.state.status.toLowerCase()}`,
        );
        return false;
      }
      if (!decision.allowed) {
        setStatus(`Navigation cancelled · save the ${activeController.label} first`);
        return false;
      }
    }
    const leavingNpcEditor = route === "characters";
    if (leavingNpcEditor && npcEditorDirty) {
      const editorName = "NPC binding";
      if (!window.confirm(`Discard the unsaved ${editorName} changes?`)) {
        setStatus(`Navigation cancelled · save the ${editorName} first`);
        return false;
      }
    }
    if (leavingNpcEditor) setNpcEditorDirty(false);
    return true;
  }

  function navigate(nextRoute: WorkspaceRoute): void {
    if (nextRoute !== route && !allowCutoutContextChange(false)) return;
    if (nextRoute === "projects" && !vault) {
      setRoute("welcome");
      setStatus("Choose or reopen a vault before browsing projects");
      return;
    }
    if (
      ["animations", "dummy-editor", "outfit", "characters", "export"].includes(nextRoute) &&
      !selectedArea
    ) {
      setRoute("areas");
      setStatus("Open an area before entering its animation or NPC workspace");
      return;
    }
    if (nextRoute === "dummy-editor" && !selectedTemplateId) {
      setRoute("animations");
      setStatus("Choose an animation before opening its reusable dummy template");
      return;
    }
    setRoute(nextRoute);
    setStatus(`${routeDetails(nextRoute).label} selected`);
  }

  async function switchStudio(nextStudio: StudioMode): Promise<void> {
    if (nextStudio === activeStudio || studioSwitchInFlight.current) return;
    if (activeStudio === "cutout" && !allowCutoutContextChange(true)) return;
    if (activeStudio === "prompt") {
      if (promptDraftDirty) {
        setStatus("Studio switch blocked · wait for prompt autosave or correct the active step");
        return;
      }
      studioSwitchInFlight.current = true;
      try {
        await flushPromptStorage();
      } catch (reason) {
        setStatus(`Studio switch blocked · prompt data was not saved · ${message(reason)}`);
        return;
      } finally {
        studioSwitchInFlight.current = false;
      }
    }
    setActiveStudio(nextStudio);
    setStatus(
      nextStudio === "prompt"
        ? "PixelPromptStudio Generator opened"
        : `${routeDetails(route).label} restored`,
    );
  }

  async function cancelActiveAssetImport(): Promise<void> {
    if (!sessionId || !assetImportJob || !isActiveAssetImport(assetImportJob)) return;
    const jobId = assetImportJob.job_id;
    setAssetImportCancelling(true);
    try {
      const cancelled = await observedAssetsApi.cancelImport(sessionId, jobId);
      if (vaultRef.current?.session_id === sessionId) setAssetImportJob(cancelled);
    } catch (reason) {
      if (vaultRef.current?.session_id === sessionId) {
        setStatus(`Asset import could not be cancelled · ${message(reason)}`);
      }
    } finally {
      if (vaultRef.current?.session_id === sessionId) setAssetImportCancelling(false);
    }
  }

  function openVault(opened: OpenVault): void {
    if (
      vaultRef.current &&
      vaultRef.current.session_id !== opened.session_id &&
      isActiveAssetImport(assetImportJob)
    ) {
      setStatus("Vault switch blocked · cancel the active asset import first");
      return;
    }
    const normalized: OpenVault = {
      ...opened,
      recovery: opened.recovery ?? [],
      recovery_writable: opened.recovery_writable ?? opened.mode === "read_write",
      lock_recovery: opened.lock_recovery ?? null,
    };
    setVault(normalized);
    setSelectedProject(null);
    setSelectedArea(null);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setNpcEditorDirty(false);
    setNpcMutationInFlight(false);
    setReleaseRunning(false);
    setEditorRecoveryCopy(null);
    npcRecoveryCopy.current = null;
    editorController.current = null;
    setRoute("projects");
    setStatus(
      normalized.notice ??
        `${normalized.mode === "read_write" ? "Writable" : "Read-only"} vault · ${normalized.indexed_objects} indexed object${normalized.indexed_objects === 1 ? "" : "s"}`,
    );
  }

  function updateRecovery(recoveryStatus: RecoveryStatus): void {
    setVault((current) =>
      current
        ? {
            ...current,
            recovery: recoveryStatus.recovery,
            recovery_writable: recoveryStatus.recovery_writable,
            mode: recoveryStatus.mode,
            indexed_objects: recoveryStatus.indexed_objects,
          }
        : current,
    );
    if (recoveryStatus.recovery.length > 0) {
      setStatus(`${recoveryStatus.recovery.length} interrupted operation(s) still need recovery`);
      return;
    }
    setSelectedProject(null);
    setSelectedArea(null);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setNpcEditorDirty(false);
    setNpcMutationInFlight(false);
    setReleaseRunning(false);
    setEditorRecoveryCopy(null);
    npcRecoveryCopy.current = null;
    editorController.current = null;
    setRoute("projects");
    setStatus("Vault recovery complete · project index refreshed");
  }

  function closeCurrentVault(): void {
    if (isActiveAssetImport(assetImportJob)) {
      setStatus("Vault close blocked · cancel the active asset import first");
      return;
    }
    setVault(null);
    setSelectedProject(null);
    setSelectedArea(null);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setNpcEditorDirty(false);
    setNpcMutationInFlight(false);
    setReleaseRunning(false);
    setEditorRecoveryCopy(null);
    npcRecoveryCopy.current = null;
    editorController.current = null;
    setRoute("welcome");
    setStatus("Vault closed");
  }

  function openProject(project: ProjectCard): void {
    setSelectedProject(project);
    setSelectedArea(null);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setRoute("areas");
    setStatus(`${project.name} opened · choose or create an area`);
  }

  function openAreaAnimations(area: AreaCard): void {
    setSelectedArea(area);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setRoute("animations");
    setStatus(`${area.name} animation library opened`);
  }

  function openAreaInventory(area: AreaCard): void {
    setSelectedArea(area);
    setSelectedTemplateId(null);
    setSelectedTemplateRef(null);
    setSelectedNpcId(null);
    setSelectedBindingId(null);
    setRoute("outfit");
    setStatus(`${area.name} PNG inventory opened`);
  }

  function openMotionTarget(target: MotionOpenTarget): void {
    setSelectedTemplateId(target.template_id);
    if (target.kind === "dummy_editor") {
      setSelectedTemplateRef(null);
      setRoute("dummy-editor");
      setStatus("Reusable dummy motion editor opened");
      return;
    }
    if (target.kind === "outfit_chooser") {
      setSelectedBindingId(null);
      setSelectedTemplateRef({ id: target.template_id, revision: target.template_revision });
      setRoute("outfit");
    } else {
      setSelectedTemplateRef(null);
      setSelectedNpcId(target.character_id);
      setSelectedBindingId(target.binding_id);
      setRoute("characters");
    }
    setStatus(
      target.kind === "binding_editor"
        ? "NPC binding opened"
        : target.compatible_character_ids.length > 1
          ? `Choose one of ${target.compatible_character_ids.length} compatible NPCs or start a new outfit`
          : "Outfit workflow selected",
    );
  }

  const breadcrumbs = selectedProject
    ? [
        "Workspace",
        "Projects",
        selectedProject.name,
        ...(selectedArea ? [selectedArea.name] : []),
        routeDetails(route).label,
      ]
    : routeBreadcrumbs(route);

  return (
    <div className="app-frame" data-studio={activeStudio}>
      <AppHeader
        activeStudio={activeStudio}
        onOpenCutoutStudio={() => void switchStudio("cutout")}
        onOpenPromptStudio={() => void switchStudio("prompt")}
        onHelp={() => setHelpOpen(true)}
      />
      {activeStudio === "cutout" ? (
        <>
          <WorkspaceNav activeRoute={route} items={navigationItems} onNavigate={navigate} />
          {assetImportJob && isActiveAssetImport(assetImportJob) && (
            <section className="app-import-job" aria-label="Active asset import">
              <div>
                <strong>{assetImportJob.progress.message}</strong>
                <span>
                  {assetImportJob.progress.completed} / {assetImportJob.progress.total} ·{" "}
                  {assetImportJob.progress.stage}
                </span>
              </div>
              <progress
                value={assetImportJob.progress.completed}
                max={Math.max(1, assetImportJob.progress.total)}
              />
              <button
                type="button"
                disabled={assetImportCancelling}
                onClick={() => void cancelActiveAssetImport()}
              >
                {assetImportCancelling ? "Cancelling…" : "Cancel import"}
              </button>
            </section>
          )}
          <div className="content-frame">
            <Breadcrumbs items={breadcrumbs} />
            <main
              ref={mainContent}
              className="main-content"
              tabIndex={-1}
              aria-label={`${details.label} workspace`}
            >
              {vault && (vault.recovery?.length ?? 0) > 0 ? (
                <RecoveryPanel
                  client={vaultApi}
                  editorRecoveryCopy={editorRecoveryCopy}
                  vault={vault}
                  onCloseVault={closeCurrentVault}
                  onRecovered={updateRecovery}
                />
              ) : route === "projects" && vault ? (
                <ProjectDashboard
                  key={vault.session_id}
                  client={observedProjectsApi}
                  sessionId={vault.session_id}
                  onOpen={openProject}
                  onStatus={setStatus}
                />
              ) : route === "animations" && vault && selectedArea ? (
                <AnimationDashboard
                  areaId={selectedArea.id}
                  characterId={selectedNpcId}
                  client={observedMotionsApi}
                  defaultFrameSize={selectedArea.default_frame_size_px}
                  defaultGroundOrigin={selectedArea.default_ground_origin_px}
                  onOpen={openMotionTarget}
                  onOpenNpcs={() => navigate("characters")}
                  onPublishingChange={setReleaseRunning}
                  onStatus={setStatus}
                  sessionId={vault.session_id}
                />
              ) : route === "dummy-editor" && vault && selectedTemplateId ? (
                <MotionDummyEditorRoute
                  key={selectedTemplateId}
                  client={observedMotionsApi}
                  onEditorControllerChange={registerEditorController}
                  onPlaybackChange={setPlaying}
                  onStatus={setStatus}
                  sessionId={vault.session_id}
                  templateId={selectedTemplateId}
                />
              ) : route === "outfit" && vault && selectedArea && selectedTemplateRef ? (
                <OutfitEditor
                  areaId={selectedArea.id}
                  assetsClient={observedAssetsApi}
                  client={observedOutfitsApi}
                  importJob={assetImportJob}
                  onImportJobChange={trackAssetImport}
                  onEditorControllerChange={registerEditorController}
                  onOpenDummy={(templateRef) => {
                    setSelectedTemplateId(templateRef.id);
                    setSelectedTemplateRef(null);
                    setRoute("dummy-editor");
                    setStatus("Reusable dummy motion editor opened");
                  }}
                  onPlaybackChange={setPlaying}
                  onSavedNpc={(npc) => setStatus(`${npc.character.name} saved as an NPC`)}
                  onStatus={setStatus}
                  sessionId={vault.session_id}
                  templateRef={selectedTemplateRef}
                  writable={vault.mode === "read_write"}
                />
              ) : route === "outfit" && vault && selectedArea ? (
                <InventoryWorkspace
                  areaId={selectedArea.id}
                  client={observedAssetsApi}
                  importJob={assetImportJob}
                  onImportJobChange={trackAssetImport}
                  onStatus={setStatus}
                  sessionId={vault.session_id}
                />
              ) : route === "characters" && vault && selectedArea ? (
                <NpcWorkspace
                  key={selectedArea.id}
                  areaId={selectedArea.id}
                  client={observedNpcsApi}
                  initialBindingId={selectedBindingId ?? undefined}
                  initialNpcId={selectedNpcId ?? undefined}
                  onDirtyChange={setNpcEditorDirty}
                  onMutationInFlightChange={setNpcMutationInFlight}
                  onRecoveryCopyChange={registerNpcRecoveryCopy}
                  onSectionChange={(section, context) => {
                    setSelectedNpcId(context.npcId);
                    setSelectedBindingId(context.bindingId);
                    if (section === "animations") navigate("animations");
                    if (section === "export") navigate("export");
                  }}
                  onSelectionChange={(selection) => {
                    setSelectedNpcId(selection.npcId);
                    setSelectedBindingId(selection.bindingId);
                  }}
                  onStatus={setStatus}
                  readOnly={vault.mode !== "read_write"}
                  sessionId={vault.session_id}
                />
              ) : route === "export" && vault && selectedArea ? (
                <ExportWorkspace
                  key={selectedArea.id}
                  areaId={selectedArea.id}
                  client={observedExportsApi}
                  initialBindingId={selectedBindingId ?? undefined}
                  initialNpcId={selectedNpcId ?? undefined}
                  npcsClient={observedNpcsApi}
                  onRunningChange={setExportRunning}
                  onSelectionChange={(selection) => {
                    setSelectedNpcId(selection.npcId);
                    setSelectedBindingId(selection.bindingId);
                  }}
                  onStatus={setStatus}
                  readOnly={vault.mode !== "read_write"}
                  sessionId={vault.session_id}
                />
              ) : (
                <PlaceholderView
                  details={details}
                  areaClient={observedAreasApi}
                  onOpenAreaAnimations={openAreaAnimations}
                  onOpenAreaInventory={openAreaInventory}
                  onVaultOpened={openVault}
                  projectId={selectedProject?.id ?? null}
                  vault={vault}
                  vaultClient={vaultApi}
                />
              )}
            </main>
          </div>
        </>
      ) : (
        <div className="content-frame prompt-content-frame">
          <main
            ref={promptContent}
            className="main-content prompt-workspace"
            tabIndex={-1}
            aria-label="PixelPromptStudio Generator"
            data-prompt-view={promptView}
          >
            <PromptGeneratorRoot
              view={promptView}
              onNavigate={setPromptView}
              onDirtyChange={setPromptDraftDirty}
              outputAdapter={promptOutputAdapter}
              startupMigration={promptStartupMigration}
              storageAdapter={promptStorageAdapter}
            />
          </main>
        </div>
      )}
      <StatusBar message={status} playing={playing} />
      {import.meta.env.VITE_P19_ACCEPTANCE_PROBE === "1" && <NativeAcceptanceProbe />}
      <span className="visually-hidden" data-selected-template={selectedTemplateId ?? undefined} />
      <DialogLayer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function isActiveAssetImport(job: AssetImportJobView | null | undefined): boolean {
  return job?.state === "queued" || job?.state === "running";
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
