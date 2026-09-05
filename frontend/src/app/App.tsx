import { useCallback, useEffect, useRef, useState } from "react";

import { projectClient, type ProjectClient } from "../api/project-client";
import { assetClient, type AssetClient } from "../api/asset-client";
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
import { AnimationDashboard } from "../features/animations/AnimationDashboard";
import { MotionDummyEditorRoute } from "../features/dummy-editor/MotionDummyEditorRoute";
import { InventoryWorkspace } from "../features/inventory/InventoryWorkspace";
import { ProjectDashboard } from "../features/projects/ProjectDashboard";
import { navigationItems, routeBreadcrumbs, routeDetails, type WorkspaceRoute } from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

interface AppProps {
  assetsApi?: AssetClient;
  projectsApi?: ProjectClient;
  vaultApi?: VaultClient;
}

export function App({
  assetsApi = assetClient,
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
  const [editorDirty, setEditorDirty] = useState(false);
  const mainContent = useRef<HTMLElement>(null);
  const initialRoute = useRef(true);

  const handleKeyboardAction = useCallback((action: KeyboardAction) => {
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

  useEffect(
    () => () => {
      if (vault) void vaultApi.close(vault.session_id).catch(() => undefined);
    },
    [vault, vaultApi],
  );

  function navigate(nextRoute: WorkspaceRoute): void {
    if (
      route === "dummy-editor" &&
      nextRoute !== "dummy-editor" &&
      editorDirty &&
      !window.confirm("Discard the unsaved motion-template changes?")
    ) {
      setStatus("Navigation cancelled · save the motion template first");
      return;
    }
    if (nextRoute !== "dummy-editor") setEditorDirty(false);
    if (nextRoute === "projects" && !vault) {
      setRoute("welcome");
      setStatus("Choose or reopen a vault before browsing projects");
      return;
    }
    if (
      ["animations", "dummy-editor", "outfit", "characters"].includes(nextRoute) &&
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
    setRoute("areas");
    setStatus(`${project.name} opened · choose or create an area`);
  }

  function openAreaAnimations(area: AreaCard): void {
    setSelectedArea(area);
    setSelectedTemplateId(null);
    setRoute("animations");
    setStatus(`${area.name} animation library opened`);
  }

  function openAreaInventory(area: AreaCard): void {
    setSelectedArea(area);
    setSelectedTemplateId(null);
    setRoute("outfit");
    setStatus(`${area.name} PNG inventory opened`);
  }

  function openMotionTarget(target: MotionOpenTarget): void {
    setSelectedTemplateId(target.template_id);
    if (target.kind === "dummy_editor") {
      setRoute("dummy-editor");
      setStatus("Reusable dummy motion editor opened");
      return;
    }
    setRoute(target.kind === "binding_editor" ? "characters" : "outfit");
    setStatus(
      target.kind === "outfit_chooser" && target.compatible_character_ids.length > 1
        ? `Choose one of ${target.compatible_character_ids.length} compatible NPCs or start a new outfit`
        : "Outfit workflow selected · the editor arrives in P13",
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
              defaultFrameSize={selectedArea.default_frame_size_px}
              defaultGroundOrigin={selectedArea.default_ground_origin_px}
              onOpen={openMotionTarget}
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
          ) : route === "outfit" && vault && selectedArea ? (
            <InventoryWorkspace
              areaId={selectedArea.id}
              client={assetsApi}
              onStatus={setStatus}
              sessionId={vault.session_id}
            />
          ) : (
            <PlaceholderView
              details={details}
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
