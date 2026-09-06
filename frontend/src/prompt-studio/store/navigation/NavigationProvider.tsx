import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PromptView } from "../../domain/navigation";
import type { PromptNavigationAdapter } from "../../services/navigationAdapter";

export interface NavigationContextValue {
  readonly activeView: PromptView;
  readonly navigate: (view: PromptView) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({
  children,
  navigationAdapter,
}: Readonly<{
  children: ReactNode;
  navigationAdapter: PromptNavigationAdapter;
}>) {
  const activeView = useSyncExternalStore(
    navigationAdapter.subscribe,
    navigationAdapter.readView,
    navigationAdapter.readView,
  );
  const navigate = useCallback(
    (view: PromptView) => navigationAdapter.navigate(view),
    [navigationAdapter],
  );
  const value = useMemo(() => ({ activeView, navigate }), [activeView, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used within NavigationProvider.");
  return context;
}
