import { type NavigationItem, type WorkspaceRoute } from "../app/navigation";

interface WorkspaceNavProps {
  activeRoute: WorkspaceRoute;
  items: readonly NavigationItem[];
  onNavigate: (route: WorkspaceRoute) => void;
}

export function WorkspaceNav({ activeRoute, items, onNavigate }: WorkspaceNavProps) {
  return (
    <aside className="workspace-nav">
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Studio sections">
        {items.map((item, index) => (
          <button
            aria-label={item.label}
            className="nav-item"
            data-active={activeRoute === item.route}
            key={item.route}
            onClick={() => onNavigate(item.route)}
            type="button"
          >
            <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
            <span>{item.label}</span>
            {!item.available && <span className="nav-planned">PLANNED</span>}
          </button>
        ))}
      </nav>
      <div className="nav-footer">
        <span className="signal-dot" />
        Offline-first · no account
      </div>
    </aside>
  );
}
