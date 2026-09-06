import { useCallback } from "react";
import { ViewLink } from "../components/navigation";
import { APP_VIEW_IDS, type AppView } from "../domain/navigation";
import type { AssetCategory } from "../domain/assets";
import { ReviewOutputWorkspace } from "../features/review-output";
import { SettingsView } from "../features/settings";
import { WizardView, type WizardStorage } from "../features/wizard";
import { ProfileLibraryView } from "../features/profiles";
import { DashboardView, type DashboardViewProps } from "../features/dashboard/DashboardView";
import type { DashboardStorage } from "../features/dashboard/dashboardData";
import type { StableId } from "../schemas";
import type { LegacyV1StorageMigrationResult, OutputWorkspaceAdapter } from "../services";
import { useNavigation } from "../store/navigation";
import { useSettings } from "../store/settings";
import { useWizardSession } from "../store/wizard";
import { APP_VIEW_DEFINITIONS } from "./appViewConfig";
import styles from "./AppShell.module.css";

interface ActiveViewProps {
  readonly activeBaseProfileId: StableId | null;
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly onOpenProfile: (profileId: StableId) => void;
  readonly onProfileDeleted: (profileId: StableId) => void;
  readonly onResumeDraft: (draftId: StableId) => void;
  readonly onSelectBaseProfile: DashboardViewProps["onSelectBaseProfile"];
  readonly onStartNewAsset: (category: AssetCategory | null) => void;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly sessionRevision: number;
  readonly startupMigration: LegacyV1StorageMigrationResult;
  readonly storageAdapter: DashboardStorage & WizardStorage;
  readonly view: AppView;
}

function ActiveView({
  activeBaseProfileId,
  createDraftId,
  now,
  onOpenProfile,
  onProfileDeleted,
  onResumeDraft,
  onSelectBaseProfile,
  onStartNewAsset,
  outputAdapter,
  sessionRevision,
  startupMigration,
  storageAdapter,
  view,
}: ActiveViewProps) {
  if (view === "dashboard") {
    return (
      <DashboardView
        activeBaseProfileId={activeBaseProfileId}
        storageAdapter={storageAdapter}
        onStartNewAsset={onStartNewAsset}
        onOpenProfile={onOpenProfile}
        onResumeDraft={onResumeDraft}
        onSelectBaseProfile={onSelectBaseProfile}
      />
    );
  }

  if (view === "profiles") {
    return (
      <ProfileLibraryView
        onLoadProfile={onOpenProfile}
        onProfileDeleted={onProfileDeleted}
        onStartNewAsset={() => onStartNewAsset(null)}
      />
    );
  }

  if (view === "wizard") {
    return (
      <WizardView
        key={`wizard-session-${sessionRevision}`}
        storageAdapter={storageAdapter}
        {...(now ? { now } : {})}
        {...(createDraftId ? { createDraftId } : {})}
      />
    );
  }

  if (view === "output") {
    return (
      <ReviewOutputWorkspace
        outputAdapter={outputAdapter}
        storageAdapter={storageAdapter}
        {...(now ? { now } : {})}
      />
    );
  }

  return (
    <SettingsView
      outputAdapter={outputAdapter}
      startupMigration={startupMigration}
      storageAdapter={storageAdapter}
      {...(now ? { now } : {})}
    />
  );
}

export interface PromptStudioShellProps {
  readonly activeBaseProfileId: StableId | null;
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly startupMigration: LegacyV1StorageMigrationResult;
  readonly storageAdapter: DashboardStorage & WizardStorage;
  readonly view: AppView;
}

export function PromptStudioNavigation() {
  const { requestNewAsset } = useWizardSession();

  return (
    <div className={styles.navigationRow} data-module-navigation="prompt">
      <nav className={styles.primaryNavigation} aria-label="Hauptnavigation">
        <ul className={styles.navigationList}>
          {APP_VIEW_IDS.map((view) => (
            <li key={view}>
              <ViewLink className={styles.navigationLink} indicateCurrent view={view}>
                {APP_VIEW_DEFINITIONS[view].label}
              </ViewLink>
            </li>
          ))}
        </ul>
      </nav>

      <nav className={styles.quickNavigation} aria-label="Schnellaktionen">
        <ViewLink className={styles.secondaryAction} view="profiles">
          Profile öffnen
        </ViewLink>
        <ViewLink
          className={styles.primaryAction}
          view="wizard"
          onNavigate={() => requestNewAsset(null)}
        >
          <span aria-hidden="true">+</span>
          Neues Asset
        </ViewLink>
      </nav>
    </div>
  );
}

export function PromptStudioShell({
  activeBaseProfileId,
  createDraftId,
  now,
  outputAdapter,
  startupMigration,
  storageAdapter,
  view,
}: PromptStudioShellProps) {
  const { navigate } = useNavigation();
  const { requestNewAsset, requestProfile, requestResume, clearProfileRequest, sessionRevision } =
    useWizardSession();
  const { setActiveBaseProfile } = useSettings();

  const startNewAsset = useCallback(
    (category: AssetCategory | null) => {
      requestNewAsset(category);
      navigate("wizard");
    },
    [navigate, requestNewAsset],
  );

  const openProfile = useCallback(
    (profileId: StableId) => {
      requestProfile(profileId);
      navigate("wizard");
    },
    [navigate, requestProfile],
  );

  const resumeDraft = useCallback(
    (draftId: StableId) => {
      requestResume(draftId);
      navigate("wizard");
    },
    [navigate, requestResume],
  );

  return (
    <ActiveView
      activeBaseProfileId={activeBaseProfileId}
      {...(createDraftId ? { createDraftId } : {})}
      {...(now ? { now } : {})}
      onOpenProfile={openProfile}
      onProfileDeleted={clearProfileRequest}
      onResumeDraft={resumeDraft}
      onSelectBaseProfile={setActiveBaseProfile}
      onStartNewAsset={startNewAsset}
      outputAdapter={outputAdapter}
      sessionRevision={sessionRevision}
      startupMigration={startupMigration}
      storageAdapter={storageAdapter}
      view={view}
    />
  );
}
