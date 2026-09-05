import { useCallback, useEffect, useRef, useState } from "react";

import { areaClient, type AreaClient } from "../api/area-client";
import { assetClient, type AssetClient } from "../api/asset-client";
import { exportClient, type ExportClient } from "../api/export-client";
import { motionClient, type MotionClient } from "../api/motion-client";
import { npcClient, type NpcClient } from "../api/npc-client";
import { outfitClient, type OutfitClient } from "../api/outfit-client";
import { projectClient, type ProjectClient } from "../api/project-client";
import { vaultClient, type OpenVault, type VaultClient } from "../api/vault-client";
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
  const [editorDirty, setEditorDirty] = useState(false);
  const [exportRunning, setExportRunning] = useState(false);
  const mainContent = useRef<HTMLElement>(null);
  const initialRoute = useRef(true);

  const handleKeyboardAction = useCallback(
    (action: KeyboardAction) => {
      if (
        (route === "dummy-editor" || (route === "outfit" && selectedTemplateRef !== null)) &&
        ["save", "undo", "redo", "toggle-playback"].includes(action)
      ) {
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
    },
    [route, selectedTemplateRef],
  );

  useKeyboardActions(handleKeyboardAction);
  const details = routeDetails(route);

  useEffect(() => {
    if (initialRoute.current) {
      initialRoute.current = false;
      return;
    }
    mainContent.current?.focus();
  }, [route]);

  useEffect(
    () => () => {
      if (vault) void vaultApi.close(vault.session_id).catch(() => undefined);
    },
    [vault, vaultApi],
  );

  function navigate(nextRoute: WorkspaceRoute): void {
    if (nextRoute !== route && exportRunning) {
      setStatus("Navigation blocked · cancel the active export and wait for it to finish");
      return;
    }
    const leavingEditor =
      nextRoute !== route &&
      (route === "dummy-editor" ||
        route === "characters" ||
        (route === "outfit" && selectedTemplateRef !== null));
    if (leavingEditor && editorDirty) {
      const editorName =
        route === "dummy-editor"
          ? "motion template"
          : route === "characters"
            ? "NPC binding"
            : "outfit draft";
      if (!window.confirm(`Discard the unsaved ${editorName} changes?`)) {
        setStatus(`Navigation cancelled · save the ${editorName} first`);
        return;
      }
    }
    if (leavingEditor) setEditorDirty(false);
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
    setVault(opened);
    setRoute("projects");
    setStatus(
      opened.notice ??
        `${opened.mode === "read_write" ? "Writable" : "Read-only"} vault · ${opened.indexed_objects} indexed object${opened.indexed_objects === 1 ? "" : "s"}`,
    );
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
          {route === "projects" && vault ? (
            <ProjectDashboard
              client={projectsApi}
              sessionId={vault.session_id}
              onOpen={openProject}
              onStatus={setStatus}
            />
          ) : route === "animations" && vault && selectedArea ? (
            <AnimationDashboard
              areaId={selectedArea.id}
              characterId={selectedNpcId}
              client={motionsApi}
              defaultFrameSize={selectedArea.default_frame_size_px}
              defaultGroundOrigin={selectedArea.default_ground_origin_px}
              onOpen={openMotionTarget}
              onOpenNpcs={() => navigate("characters")}
              onStatus={setStatus}
              sessionId={vault.session_id}
            />
          ) : route === "dummy-editor" && vault && selectedTemplateId ? (
            <MotionDummyEditorRoute
              key={selectedTemplateId}
              onDirtyChange={setEditorDirty}
              onPlaybackChange={setPlaying}
              onStatus={setStatus}
              sessionId={vault.session_id}
              templateId={selectedTemplateId}
            />
          ) : route === "outfit" && vault && selectedArea && selectedTemplateRef ? (
            <OutfitEditor
              areaId={selectedArea.id}
              assetsClient={assetsApi}
              client={outfitsApi}
              onDirtyChange={setEditorDirty}
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
              client={assetsApi}
              onStatus={setStatus}
              sessionId={vault.session_id}
            />
          ) : route === "characters" && vault && selectedArea ? (
            <NpcWorkspace
              key={selectedArea.id}
              areaId={selectedArea.id}
              client={npcsApi}
              initialBindingId={selectedBindingId ?? undefined}
              initialNpcId={selectedNpcId ?? undefined}
              onDirtyChange={setEditorDirty}
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
              client={exportsApi}
              initialBindingId={selectedBindingId ?? undefined}
              initialNpcId={selectedNpcId ?? undefined}
              npcsClient={npcsApi}
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
              areaClient={areasApi}
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
