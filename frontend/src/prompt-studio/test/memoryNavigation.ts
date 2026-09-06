import type { PromptView } from "../domain/navigation";

export interface MemoryPromptRoute {
  readonly status: "valid";
  readonly view: PromptView;
}

/** Host-state navigation double used only by ported Prompt UI tests. */
export class MemoryNavigation {
  readonly pushedViews: PromptView[] = [];
  readonly replacedViews: PromptView[] = [];
  private readonly listeners = new Set<() => void>();
  private view: PromptView;

  constructor(initialRoute: MemoryPromptRoute = { status: "valid", view: "dashboard" }) {
    this.view = initialRoute.view;
  }

  readonly readView = (): PromptView => this.view;

  readonly pushView = (view: PromptView): void => {
    if (view === this.view) return;
    this.pushedViews.push(view);
    this.view = view;
    this.notify();
  };

  readonly replaceView = (view: PromptView): void => {
    if (view === this.view) return;
    this.replacedViews.push(view);
    this.view = view;
    this.notify();
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  emitRoute(route: MemoryPromptRoute): void {
    this.view = route.view;
    this.notify();
  }

  activeListenerCount(): number {
    return this.listeners.size;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
