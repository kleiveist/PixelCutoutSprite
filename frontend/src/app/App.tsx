import { useCallback, useEffect, useRef, useState } from "react";

import { projectClient, type ProjectClient } from "../api/project-client";
import { vaultClient, type OpenVault, type VaultClient } from "../api/vault-client";
import { AppHeader } from "../components/AppHeader";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { DialogLayer } from "../components/DialogLayer";
import { PlaceholderView } from "../components/PlaceholderView";
import { StatusBar } from "../components/StatusBar";
import { WorkspaceNav } from "../components/WorkspaceNav";
import type { ProjectCard } from "../domain/projects";
import { ProjectDashboard } from "../features/projects/ProjectDashboard";
import { navigationItems, routeBreadcrumbs, routeDetails, type WorkspaceRoute } from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

interface AppProps {
  projectsApi?: ProjectClient;
  vaultApi?: VaultClient;
}

export function App({ projectsApi = projectClient, vaultApi = vaultClient }: AppProps = {}) {
  const [route, setRoute] = useState<WorkspaceRoute>("welcome");
  const [helpOpen, setHelpOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Ready · changes stay on this device");
  const [vault, setVault] = useState<OpenVault | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);
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
    if (nextRoute === "projects" && !vault) {
      setRoute("welcome");
      setStatus("Choose or reopen a vault before browsing projects");
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
    setRoute("areas");
    setStatus(`${project.name} opened · area setup follows in P05`);
  }

  const breadcrumbs =
    route === "areas" && selectedProject
      ? ["Workspace", "Projects", selectedProject.name, "Areas"]
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
          ) : (
            <PlaceholderView details={details} onVaultOpened={openVault} vaultClient={vaultApi} />
          )}
        </main>
      </div>
      <StatusBar message={status} playing={playing} />
      <DialogLayer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
