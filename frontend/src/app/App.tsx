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
import { PlaceholderView } from "../components/PlaceholderView";
import { StatusBar } from "../components/StatusBar";
import { WorkspaceNav } from "../components/WorkspaceNav";
import type { ProjectCard } from "../domain/projects";
import type { AreaCard } from "../domain/areas";
import type { MotionOpenTarget } from "../domain/animations";
import type { RevisionRef } from "../domain/common";
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
import { navigationItems, routeBreadcrumbs, routeDetails, type WorkspaceRoute } from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

interface AppProps {
  areasApi?: AreaClient;
  assetsApi?: AssetClient;
  exportsApi?: ExportClient;
  motionsApi?: MotionClient;
  npcsApi?: NpcClient;
  outfitsApi?: OutfitClient;
  projectsApi?: ProjectClient;
  vaultApi?: VaultClient;
}

export function App({
  areasApi = areaClient,
  assetsApi = assetClient,
  exportsApi = exportClient,
  motionsApi = motionClient,
  npcsApi = npcClient,
  outfitsApi = outfitClient,
  projectsApi = projectClient,
  vaultApi = vaultClient,
}: AppProps = {}) {
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
  const [editorRecoveryCopy, setEditorRecoveryCopy] = useState<EditorRecoveryCopy | null>(null);
  const mainContent = useRef<HTMLElement>(null);
  const initialRoute = useRef(true);
  const editorController = useRef<EditorController | null>(null);
  const npcRecoveryCopy = useRef<EditorRecoveryCopy | null>(null);
  const vaultRef = useRef<OpenVault | null>(null);
  const recoveryRefreshInFlight = useRef<Promise<void> | null>(null);
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
    if (initialRoute.current) {
      initialRoute.current = false;
      return;
    }
    mainContent.current?.focus();
  }, [route]);

  const sessionId = vault?.session_id ?? null;
  const heartbeatSessionId =
    vault && (vault.mode === "read_write" || vault.recovery_writable) ? vault.session_id : null;
  useEffect(
    () => () => {
      if (sessionId) void vaultApi.close(sessionId).catch(() => undefined);
    },
    [sessionId, vaultApi],
  );

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
    if (!npcMutationInFlight && !releaseRunning && !exportRunning) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [exportRunning, npcMutationInFlight, releaseRunning]);

  function navigate(nextRoute: WorkspaceRoute): void {
    if (nextRoute !== route && (vault?.recovery?.length ?? 0) > 0) {
      setStatus("Workspace navigation is blocked until vault recovery is complete");
      return;
    }
    if (nextRoute !== route && exportRunning) {
      setStatus("Navigation blocked · cancel the active export and wait for it to finish");
      return;
    }
    if (nextRoute !== route && releaseRunning) {
      setStatus("Navigation blocked · wait for the immutable motion release to finish");
      return;
    }
    if (nextRoute !== route && route === "characters" && npcMutationInFlight) {
      setStatus("Navigation blocked · wait for the current NPC operation to finish");
      return;
    }
    const activeController = editorController.current;
    const leavingControlledEditor = nextRoute !== route && activeController !== null;
    if (leavingControlledEditor && activeController) {
      const decision = guardEditorNavigation(activeController, (message) =>
        window.confirm(message),
      );
      if (!decision.allowed && decision.reason === "mutation_in_flight") {
        setStatus(
          `Navigation blocked · wait for ${activeController.label} to finish ${decision.state.status.toLowerCase()}`,
        );
        return;
      }
      if (!decision.allowed) {
        setStatus(`Navigation cancelled · save the ${activeController.label} first`);
        return;
      }
    }
    const leavingNpcEditor = nextRoute !== route && route === "characters";
    if (leavingNpcEditor && npcEditorDirty) {
      const editorName = "NPC binding";
      if (!window.confirm(`Discard the unsaved ${editorName} changes?`)) {
        setStatus(`Navigation cancelled · save the ${editorName} first`);
        return;
      }
    }
    if (leavingNpcEditor) setNpcEditorDirty(false);
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

  function openVault(opened: OpenVault): void {
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
    <div className="app-frame">
      <AppHeader onHelp={() => setHelpOpen(true)} />
      <WorkspaceNav activeRoute={route} items={navigationItems} onNavigate={navigate} />
      <div className="content-frame">
        <Breadcrumbs items={breadcrumbs} />
        <main ref={mainContent} className="main-content" tabIndex={-1}>
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
      <StatusBar message={status} playing={playing} />
      <span className="visually-hidden" data-selected-template={selectedTemplateId ?? undefined} />
      <DialogLayer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
