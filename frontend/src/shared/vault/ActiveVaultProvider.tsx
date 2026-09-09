import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { OpenVault } from "../../api/vault-client";
import type { SaveQueue, SessionIdentity } from "../storage";

export interface ActiveVault extends OpenVault {
  readonly session_generation: number;
  readonly display_name: string;
}

export interface ActiveVaultContextValue {
  readonly activeVault: ActiveVault | null;
  readonly saveQueue: SaveQueue;
  readonly session: SessionIdentity | null;
  isCurrent(session: SessionIdentity): boolean;
}

const ActiveVaultContext = createContext<ActiveVaultContextValue | null>(null);

export interface ActiveVaultProviderProps {
  readonly activeVault: ActiveVault | null;
  readonly saveQueue: SaveQueue;
  readonly children: ReactNode;
}

export function ActiveVaultProvider({
  activeVault,
  saveQueue,
  children,
}: ActiveVaultProviderProps) {
  const value = useMemo<ActiveVaultContextValue>(() => {
    const session = activeVault
      ? {
          sessionId: activeVault.session_id,
          generation: activeVault.session_generation,
        }
      : null;
    return {
      activeVault,
      saveQueue,
      session,
      isCurrent: (candidate) =>
        session?.sessionId === candidate.sessionId && session.generation === candidate.generation,
    };
  }, [activeVault, saveQueue]);
  return <ActiveVaultContext.Provider value={value}>{children}</ActiveVaultContext.Provider>;
}

export function useActiveVault(): ActiveVaultContextValue {
  const value = useContext(ActiveVaultContext);
  if (!value) throw new Error("useActiveVault must be used inside ActiveVaultProvider");
  return value;
}

export function useOptionalActiveVault(): ActiveVaultContextValue | null {
  return useContext(ActiveVaultContext);
}

export function vaultDisplayName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
