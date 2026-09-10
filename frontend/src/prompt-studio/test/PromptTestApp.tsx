import { useEffect, useRef, useSyncExternalStore } from "react";

import { LegacyPromptTestRoot } from "./LegacyPromptTestRoot";
import type {
  LegacyV1StorageMigrationResult,
  OutputWorkspaceAdapter,
  V2StorageAdapter,
} from "../services";
import type { MemoryNavigation } from "./memoryNavigation";

const noOpOutputAdapter: OutputWorkspaceAdapter = {
  copyText: async () => undefined,
  downloadTextFile: async () => undefined,
};

export interface PromptTestAppProps {
  readonly navigationAdapter: MemoryNavigation;
  readonly storageAdapter: V2StorageAdapter;
  readonly outputAdapter?: OutputWorkspaceAdapter;
  readonly startupMigration?: LegacyV1StorageMigrationResult;
  readonly now?: () => string;
  readonly createDraftId?: () => string;
  readonly createProfileId?: () => string;
  readonly createBaseProfileId?: () => string;
  readonly legacySettings?: boolean;
}

/** Isolated retained V2 editors; the production Vault mount has separate P35 tests. */
export function PromptTestApp({
  navigationAdapter,
  storageAdapter,
  outputAdapter = noOpOutputAdapter,
  startupMigration,
  now,
  createDraftId,
  createProfileId,
  createBaseProfileId,
  legacySettings,
}: PromptTestAppProps) {
  const view = useSyncExternalStore(
    navigationAdapter.subscribe,
    navigationAdapter.readView,
    navigationAdapter.readView,
  );
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [view]);

  return (
    <main ref={mainRef} tabIndex={-1} aria-labelledby={`${view}-view-title`}>
      <LegacyPromptTestRoot
        view={view}
        onNavigate={navigationAdapter.pushView}
        storageAdapter={storageAdapter}
        outputAdapter={outputAdapter}
        {...(legacySettings ? { legacySettings } : {})}
        {...(startupMigration ? { startupMigration } : {})}
        {...(now ? { now } : {})}
        {...(createDraftId ? { createDraftId } : {})}
        {...(createProfileId ? { createProfileId } : {})}
        {...(createBaseProfileId ? { createBaseProfileId } : {})}
      />
    </main>
  );
}

export { PromptTestApp as App };
