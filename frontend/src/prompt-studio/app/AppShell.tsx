import { useCallback } from "react";
import { ViewLink } from "../components/navigation";
import { APP_VIEW_IDS, type AppView } from "../domain/navigation";
import type { AssetCategory } from "../domain/assets";
import { VaultReviewOutputWorkspace } from "../features/review-output/VaultReviewOutputWorkspace";
import { WizardView, type WizardStorage } from "../features/wizard";
import { VaultProfileView } from "../features/profiles";
import { VaultDashboardView } from "../features/dashboard/VaultDashboardView";
import type { DashboardStorage } from "../features/dashboard/dashboardData";
import { StableIdSchema } from "../schemas";
import { useNavigation } from "../store/navigation";
import { useWizardSession } from "../store/wizard";
import { useOptionalVaultPrompt } from "../store/vault";
import { APP_VIEW_DEFINITIONS } from "./appViewConfig";
import styles from "./AppShell.module.css";

export interface PromptStudioShellProps {
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly onOpenBaseProfile?: () => void;
  readonly onOpenLegacyMigration: () => void;
  readonly storageAdapter: DashboardStorage & WizardStorage;
  readonly view: AppView;
}

export function PromptStudioNavigation() {
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
    </div>
  );
}

export function PromptStudioShell({
  createDraftId,
  now,
  onOpenBaseProfile,
  onOpenLegacyMigration,
  storageAdapter,
  view,
}: PromptStudioShellProps) {
  const { navigate } = useNavigation();
  const { requestNewAsset, requestProfile, sessionRevision } = useWizardSession();
  const vault = useOptionalVaultPrompt();
  const startNewAsset = useCallback(
    async (category: AssetCategory | null) => {
      if (!vault?.writable) throw new Error("Öffne zuerst einen schreibbaren Vault.");
      await vault.flush();
      requestNewAsset(category);
      navigate("wizard");
    },
    [navigate, requestNewAsset, vault],
  );
  const openProfile = useCallback(
    async (profileId: string) => {
      if (!vault) throw new Error("Öffne zuerst einen Vault.");
      await vault.prepareProfile(profileId);
      requestProfile(StableIdSchema.parse(profileId));
      navigate("wizard");
    },
    [navigate, requestProfile, vault],
  );

  if (view === "dashboard") {
    return <VaultDashboardView onStartNewAsset={startNewAsset} onOpenProfile={openProfile} />;
  }
  if (view === "profiles") {
    return vault ? (
      <VaultProfileView
        onOpenBaseProfile={onOpenBaseProfile ?? (() => undefined)}
        onOpenLegacyMigration={onOpenLegacyMigration}
      />
    ) : (
      <p>Öffne zuerst einen Vault.</p>
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
  if (view === "output") return <VaultReviewOutputWorkspace />;
  return <p role="alert">Diese Prompt-Seite ist nicht verfügbar.</p>;
}
