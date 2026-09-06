import type { PromptView } from "../domain/navigation";

export interface PromptNavigationAdapter {
  readView(): PromptView;
  navigate(view: PromptView): void;
  subscribe(listener: () => void): () => void;
}

export interface IntegratedPromptNavigationAdapter extends PromptNavigationAdapter {
  setView(view: PromptView): void;
}

export function createIntegratedPromptNavigationAdapter(
  initialView: PromptView,
  onNavigate: (view: PromptView) => void,
): IntegratedPromptNavigationAdapter {
  let activeView = initialView;
  const listeners = new Set<() => void>();

  const update = (view: PromptView, notifyHost: boolean) => {
    if (view === activeView) return;
    activeView = view;
    if (notifyHost) onNavigate(view);
    listeners.forEach((listener) => listener());
  };

  return {
    readView: () => activeView,
    navigate: (view) => update(view, true),
    setView: (view) => update(view, false),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
