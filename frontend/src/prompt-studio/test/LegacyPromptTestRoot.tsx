import { useEffect, useRef } from "react";
import type { PromptGeneratorRootProps } from "../app/PromptGeneratorRoot";
import {
  createIntegratedPromptNavigationAdapter,
  type OutputWorkspaceAdapter,
  type LegacyV1StorageMigrationResult,
} from "../services";
import { NavigationProvider, useNavigation } from "../store/navigation";
import { SettingsProvider, useSettings } from "../store/settings";
import { ProfileLibraryProvider } from "../store/profiles";
import { WizardSessionProvider, useWizardSession } from "../store/wizard";
import { DashboardView } from "../features/dashboard/DashboardView";
import { ProfileLibraryView } from "../features/profiles";
import { ReviewOutputWorkspace } from "../features/review-output";
import { SettingsView } from "../features/settings";
import { WizardView } from "../features/wizard";
import { ViewLink } from "../components/navigation";
import { PromptStudioNavigation } from "../app/AppShell";
import type { AssetCategory } from "../domain/assets";
import type { StableId } from "../schemas";

interface LegacyProps extends PromptGeneratorRootProps {
  readonly legacySettings?: boolean;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly startupMigration?: LegacyV1StorageMigrationResult;
}

function LegacyViews(props: LegacyProps) {
  const { activeView, navigate } = useNavigation();
  const { settings, setActiveBaseProfile } = useSettings();
  const { requestNewAsset, requestProfile, requestResume, clearProfileRequest, sessionRevision } =
    useWizardSession();
  const root = useRef<HTMLElement>(null);
  const previousSession = useRef(sessionRevision);
  useEffect(() => {
    if (previousSession.current !== sessionRevision && activeView === "wizard") {
      root.current?.closest<HTMLElement>("main")?.focus({ preventScroll: true });
    }
    previousSession.current = sessionRevision;
  }, [activeView, sessionRevision]);
  const start = (category: AssetCategory | null) => {
    requestNewAsset(category);
    navigate("wizard");
  };
  const load = (id: StableId) => {
    requestProfile(id);
    navigate("wizard");
  };
  const resume = (id: StableId) => {
    requestResume(id);
    navigate("wizard");
  };
  const { storageAdapter, outputAdapter, now, createDraftId } = props;

  return (
    <section
      ref={root}
      className="prompt-generator-root"
      aria-label="PixelPromptStudio Generator"
      data-theme={settings.theme}
    >
      <PromptStudioNavigation />
      <ViewLink view="profiles">Profile öffnen</ViewLink>
      <ViewLink view="wizard" onNavigate={() => requestNewAsset(null)}>
        Neues Asset
      </ViewLink>
      {props.legacySettings && activeView === "dashboard" ? (
        <SettingsView
          storageAdapter={storageAdapter}
          outputAdapter={outputAdapter}
          startupMigration={props.startupMigration ?? { status: "notNeeded" }}
          {...(now ? { now } : {})}
        />
      ) : activeView === "dashboard" ? (
        <DashboardView
          storageAdapter={storageAdapter}
          activeBaseProfileId={settings.activeBaseProfileId}
          onStartNewAsset={start}
          onOpenProfile={load}
          onResumeDraft={resume}
          onSelectBaseProfile={setActiveBaseProfile}
        />
      ) : activeView === "profiles" ? (
        <ProfileLibraryView
          onLoadProfile={load}
          onProfileDeleted={clearProfileRequest}
          onStartNewAsset={() => start(null)}
        />
      ) : activeView === "wizard" ? (
        <WizardView
          key={sessionRevision}
          storageAdapter={storageAdapter}
          {...(now ? { now } : {})}
          {...(createDraftId ? { createDraftId } : {})}
        />
      ) : (
        <ReviewOutputWorkspace
          storageAdapter={storageAdapter}
          outputAdapter={outputAdapter}
          {...(now ? { now } : {})}
        />
      )}
    </section>
  );
}

/**
 * Isolated V2 component harness. These compatibility tests exercise the retained
 * editors/converters; production P35 routing is covered by P35VaultWorkflow.
 * This module is imported only from tests, never from the application.
 */
export function LegacyPromptTestRoot(props: LegacyProps) {
  const navigate = useRef(props.onNavigate);
  navigate.current = props.onNavigate;
  const adapter = useRef<ReturnType<typeof createIntegratedPromptNavigationAdapter> | null>(null);
  adapter.current ??= createIntegratedPromptNavigationAdapter(props.view, (view) =>
    navigate.current(view),
  );
  useEffect(() => {
    adapter.current?.setView(props.view);
  }, [props.view]);
  return (
    <SettingsProvider
      storageAdapter={props.storageAdapter}
      {...(props.now ? { now: props.now } : {})}
    >
      <ProfileLibraryProvider
        storageAdapter={props.storageAdapter}
        {...(props.now ? { now: props.now } : {})}
        {...(props.createProfileId ? { createProfileId: props.createProfileId } : {})}
        {...(props.createBaseProfileId ? { createBaseProfileId: props.createBaseProfileId } : {})}
      >
        <NavigationProvider navigationAdapter={adapter.current}>
          <WizardSessionProvider>
            <LegacyViews {...props} />
          </WizardSessionProvider>
        </NavigationProvider>
      </ProfileLibraryProvider>
    </SettingsProvider>
  );
}
