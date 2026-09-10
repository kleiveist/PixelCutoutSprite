import type { ReactNode } from "react";

export type StudioMode = "cutout" | "prompt" | "sprite";

export interface ModuleNavigationItem<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: (id: Id) => void;
}

export interface ModuleNavigationRowProps<Id extends string = string> {
  readonly module: StudioMode;
  readonly items?: readonly ModuleNavigationItem<Id>[];
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly navigationLabel?: string;
}

/** The single, stable navigation boundary rendered directly below the global header. */
export function ModuleNavigationRow<Id extends string = string>({
  module,
  items = [],
  actions,
  className,
  navigationLabel,
}: ModuleNavigationRowProps<Id>) {
  const classes = ["module-navigation-row", className].filter(Boolean).join(" ");
  return (
    <div className={classes} data-module-navigation={module}>
      {items.length > 0 ? (
        <nav aria-label={navigationLabel ?? `${module} module navigation`}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.current ? "page" : undefined}
                  disabled={item.disabled}
                  onClick={() => item.onSelect(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <span className="module-navigation-empty" aria-hidden="true" />
      )}
      {actions ? <div className="module-navigation-actions">{actions}</div> : null}
    </div>
  );
}
