import { useEffect, useLayoutEffect, useRef } from "react";

import type { PromptHandoff, PromptHandoffAvailability } from "../domain/handoff";
import type { PromptView } from "../domain/navigation";
import type {
  IntegratedPromptNavigationAdapter,
  LegacyV1StorageMigrationResult,
  OutputWorkspaceAdapter,
  V2StorageAdapter,
} from "../services";
import { createIntegratedPromptNavigationAdapter } from "../services";
import { NavigationProvider, useNavigation } from "../store/navigation";
import { ProfileLibraryProvider } from "../store/profiles";
import { SettingsProvider, useSettings } from "../store/settings";
import { WizardSessionProvider, useWizardSession } from "../store/wizard";
import { PromptStudioNavigation, PromptStudioShell } from "./AppShell";
import "../styles/tokens.css";
import "../styles/prompt-studio.css";

export interface PromptGeneratorRootProps {
  readonly view: PromptView;
  readonly onNavigate: (view: PromptView) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly storageAdapter: V2StorageAdapter;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly startupMigration?: LegacyV1StorageMigrationResult;
  readonly handoffAvailability?: PromptHandoffAvailability;
  readonly onHandoff?: (handoff: PromptHandoff) => Promise<void> | void;
  readonly now?: () => string;
  readonly createDraftId?: () => string;
  readonly createProfileId?: () => string;
  readonly createBaseProfileId?: () => string;
}

interface PromptWorkspaceProps {
  readonly storageAdapter: V2StorageAdapter;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly startupMigration: LegacyV1StorageMigrationResult;
  readonly handoffAvailability: PromptHandoffAvailability;
  readonly onHandoff?: (handoff: PromptHandoff) => Promise<void> | void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly now?: () => string;
  readonly createDraftId?: () => string;
}

function PromptWorkspace({
  storageAdapter,
  outputAdapter,
  startupMigration,
  handoffAvailability,
  onHandoff,
  onDirtyChange,
  now,
  createDraftId,
}: PromptWorkspaceProps) {
  const { activeView } = useNavigation();
  const { resolvedTheme, settings } = useSettings();
  const { draftDirty, sessionRevision } = useWizardSession();
  const rootRef = useRef<HTMLElement>(null);
  const previousSessionRevisionRef = useRef(sessionRevision);

  useLayoutEffect(() => {
    onDirtyChange?.(draftDirty);
    return () => onDirtyChange?.(false);
  }, [draftDirty, onDirtyChange]);

  useEffect(() => {
    const sessionChanged = previousSessionRevisionRef.current !== sessionRevision;
    previousSessionRevisionRef.current = sessionRevision;
    if (!sessionChanged || activeView !== "wizard") return;

    const focusTarget = rootRef.current?.closest<HTMLElement>("main") ?? rootRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [activeView, sessionRevision]);

  return (
    <section
      ref={rootRef}
      className="prompt-generator-root"
      data-prompt-view={activeView}
      data-theme={resolvedTheme}
      aria-label="PixelPromptStudio Generator"
    >
      <div className="prompt-generator-navigation">
        <PromptStudioNavigation />
      </div>
      <div className="prompt-generator-scroll">
        <div className="prompt-generator-content">
          <PromptStudioShell
            activeBaseProfileId={settings.activeBaseProfileId}
            outputAdapter={outputAdapter}
            startupMigration={startupMigration}
            storageAdapter={storageAdapter}
            view={activeView}
            handoffAvailability={handoffAvailability}
            {...(onHandoff ? { onHandoff } : {})}
            {...(now ? { now } : {})}
            {...(createDraftId ? { createDraftId } : {})}
          />
        </div>
      </div>
    </section>
  );
}

export function PromptGeneratorRoot({
  view,
  onNavigate,
  onDirtyChange,
  storageAdapter,
  outputAdapter,
  startupMigration = { status: "notNeeded" },
  handoffAvailability = {
    available: false,
    reason: "Öffne einen schreibbaren Cutout-Arbeitsbereich für die Übergabe.",
  },
  onHandoff,
  now,
  createDraftId,
  createProfileId,
  createBaseProfileId,
}: PromptGeneratorRootProps) {
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const adapterRef = useRef<IntegratedPromptNavigationAdapter | null>(null);
  if (adapterRef.current === null) {
    adapterRef.current = createIntegratedPromptNavigationAdapter(view, (nextView) =>
      onNavigateRef.current(nextView),
    );
  }

  useEffect(() => {
    adapterRef.current?.setView(view);
  }, [view]);

  return (
    <SettingsProvider storageAdapter={storageAdapter} {...(now ? { now } : {})}>
      <ProfileLibraryProvider
        storageAdapter={storageAdapter}
        {...(now ? { now } : {})}
        {...(createProfileId ? { createProfileId } : {})}
        {...(createBaseProfileId ? { createBaseProfileId } : {})}
      >
        <NavigationProvider navigationAdapter={adapterRef.current}>
          <WizardSessionProvider>
            <PromptWorkspace
              storageAdapter={storageAdapter}
              outputAdapter={outputAdapter}
              startupMigration={startupMigration}
              handoffAvailability={handoffAvailability}
              {...(onHandoff ? { onHandoff } : {})}
              {...(onDirtyChange ? { onDirtyChange } : {})}
              {...(now ? { now } : {})}
              {...(createDraftId ? { createDraftId } : {})}
            />
          </WizardSessionProvider>
        </NavigationProvider>
      </ProfileLibraryProvider>
    </SettingsProvider>
  );
}
