import { useCallback } from "react";
import { ViewLink } from "../components/navigation";
import { APP_VIEW_IDS, type AppView } from "../domain/navigation";
import type { AssetCategory } from "../domain/assets";
import type { PromptHandoff, PromptHandoffAvailability } from "../domain/handoff";
import { ReviewOutputWorkspace } from "../features/review-output";
import { WizardView, type WizardStorage } from "../features/wizard";
import { ProfileLibraryView, VaultProfileView } from "../features/profiles";
import { SettingsView } from "../features/settings";
import { DashboardView, type DashboardViewProps } from "../features/dashboard/DashboardView";
import type { DashboardStorage } from "../features/dashboard/dashboardData";
import type { StableId } from "../schemas";
import type { LegacyV1StorageMigrationResult, OutputWorkspaceAdapter } from "../services";
import { useNavigation } from "../store/navigation";
import { useSettings } from "../store/settings";
import { useWizardSession } from "../store/wizard";
import { useOptionalVaultPrompt } from "../store/vault";
import { APP_VIEW_DEFINITIONS } from "./appViewConfig";
import styles from "./AppShell.module.css";

interface ActiveViewProps {
  readonly activeBaseProfileId: StableId | null;
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly handoffAvailability?: PromptHandoffAvailability;
  readonly onHandoff?: (handoff: PromptHandoff) => Promise<void> | void;
  readonly onOpenProfile: (profileId: StableId) => void;
  readonly onOpenBaseProfile?: () => void;
  readonly onOpenLegacyMigration: () => void;
  readonly onProfileDeleted: (profileId: StableId) => void;
  readonly onResumeDraft: (draftId: StableId) => void;
  readonly onSelectBaseProfile: DashboardViewProps["onSelectBaseProfile"];
  readonly onStartNewAsset: (category: AssetCategory | null) => void;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly sessionRevision: number;
  readonly storageAdapter: DashboardStorage & WizardStorage;
  readonly startupMigration: LegacyV1StorageMigrationResult;
  readonly view: AppView;
}

function ProfilesRoute({
  onOpenBaseProfile,
  onOpenLegacyMigration,
  onOpenProfile,
  onProfileDeleted,
  onStartNewAsset,
}: Readonly<{
  onOpenBaseProfile: () => void;
  onOpenLegacyMigration: () => void;
  onOpenProfile: (profileId: StableId) => void;
  onProfileDeleted: (profileId: StableId) => void;
  onStartNewAsset: () => void;
}>) {
  const vaultPrompt = useOptionalVaultPrompt();
  return vaultPrompt ? (
    <VaultProfileView
      onOpenBaseProfile={onOpenBaseProfile}
      onOpenLegacyMigration={onOpenLegacyMigration}
    />
  ) : (
    <ProfileLibraryView
      onLoadProfile={onOpenProfile}
      onProfileDeleted={onProfileDeleted}
      onStartNewAsset={onStartNewAsset}
    />
  );
}

function SettingsRoute({
  now,
  outputAdapter,
  startupMigration,
  storageAdapter,
}: Readonly<{
  now?: () => string;
  outputAdapter: OutputWorkspaceAdapter;
  startupMigration: LegacyV1StorageMigrationResult;
  storageAdapter: DashboardStorage & WizardStorage;
}>) {
  const vaultPrompt = useOptionalVaultPrompt();
  if (vaultPrompt) {
    return (
      <section role="status">
        <h1 id="settings-view-title">Einstellungen wurden verschoben</h1>
        <p>Globale Darstellungseinstellungen erreichst du über das Zahnrad im App-Header.</p>
      </section>
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

function ActiveView({
  activeBaseProfileId,
  createDraftId,
  now,
  handoffAvailability,
  onHandoff,
  onOpenProfile,
  onOpenBaseProfile,
  onOpenLegacyMigration,
  onProfileDeleted,
  onResumeDraft,
  onSelectBaseProfile,
  onStartNewAsset,
  outputAdapter,
  sessionRevision,
  storageAdapter,
  startupMigration,
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
      <ProfilesRoute
        onOpenBaseProfile={onOpenBaseProfile ?? (() => undefined)}
        onOpenLegacyMigration={onOpenLegacyMigration}
        onOpenProfile={onOpenProfile}
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
        {...(onOpenBaseProfile ? { onOpenBaseProfile } : {})}
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
        {...(handoffAvailability ? { handoffAvailability } : {})}
        {...(onHandoff ? { onHandoff } : {})}
        {...(now ? { now } : {})}
      />
    );
  }

  return (
    <SettingsRoute
      {...(now ? { now } : {})}
      outputAdapter={outputAdapter}
      startupMigration={startupMigration}
      storageAdapter={storageAdapter}
    />
  );
}

export interface PromptStudioShellProps {
  readonly activeBaseProfileId: StableId | null;
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly handoffAvailability?: PromptHandoffAvailability;
  readonly onHandoff?: (handoff: PromptHandoff) => Promise<void> | void;
  readonly onOpenBaseProfile?: () => void;
  readonly onOpenLegacyMigration: () => void;
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
  handoffAvailability,
  onHandoff,
  onOpenBaseProfile,
  onOpenLegacyMigration,
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
      {...(onOpenBaseProfile ? { onOpenBaseProfile } : {})}
      onOpenLegacyMigration={onOpenLegacyMigration}
      onProfileDeleted={clearProfileRequest}
      onResumeDraft={resumeDraft}
      onSelectBaseProfile={setActiveBaseProfile}
      onStartNewAsset={startNewAsset}
      outputAdapter={outputAdapter}
      {...(handoffAvailability ? { handoffAvailability } : {})}
      {...(onHandoff ? { onHandoff } : {})}
      sessionRevision={sessionRevision}
      storageAdapter={storageAdapter}
      startupMigration={startupMigration}
      view={view}
    />
  );
}
