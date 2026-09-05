import { useCallback, useEffect, useRef, useState } from "react";

import { AppHeader } from "../components/AppHeader";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { DialogLayer } from "../components/DialogLayer";
import { PlaceholderView } from "../components/PlaceholderView";
import { StatusBar } from "../components/StatusBar";
import { WorkspaceNav } from "../components/WorkspaceNav";
import { navigationItems, routeBreadcrumbs, routeDetails, type WorkspaceRoute } from "./navigation";
import type { KeyboardAction } from "./shortcuts";
import { useKeyboardActions } from "./useKeyboardActions";

export function App() {
  const [route, setRoute] = useState<WorkspaceRoute>("welcome");
  const [helpOpen, setHelpOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Ready · changes stay on this device");
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

  function navigate(nextRoute: WorkspaceRoute): void {
    setRoute(nextRoute);
    setStatus(`${routeDetails(nextRoute).label} selected`);
  }

  return (
    <div className="app-frame">
      <AppHeader onHelp={() => setHelpOpen(true)} />
      <WorkspaceNav activeRoute={route} items={navigationItems} onNavigate={navigate} />
      <div className="content-frame">
        <Breadcrumbs items={routeBreadcrumbs(route)} />
        <main ref={mainContent} className="main-content" tabIndex={-1}>
          <PlaceholderView details={details} onOpenProjects={() => navigate("projects")} />
        </main>
      </div>
      <StatusBar message={status} playing={playing} />
      <DialogLayer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
