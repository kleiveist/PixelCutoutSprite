import { type NavigationItem, type WorkspaceRoute } from "../app/navigation";
import { ModuleNavigationRow } from "../shared/navigation";

interface WorkspaceNavProps {
  activeRoute: WorkspaceRoute;
  items: readonly NavigationItem[];
  onNavigate: (route: WorkspaceRoute) => void;
}

export function WorkspaceNav({ activeRoute, items, onNavigate }: WorkspaceNavProps) {
  return (
    <ModuleNavigationRow
      module="cutout"
      className="workspace-nav"
      navigationLabel="Studio sections"
      items={items.map((item) => ({
        id: item.route,
        label: item.label,
        current: activeRoute === item.route,
        disabled: !item.available,
        onSelect: onNavigate,
      }))}
      actions={
        <span className="nav-footer">
          <span className="signal-dot" />
          Offline-first
        </span>
      }
    />
  );
}
