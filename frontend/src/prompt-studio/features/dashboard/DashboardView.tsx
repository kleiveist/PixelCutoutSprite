import { useState } from "react";
import { ForgeMarkIcon } from "../../components/icons";
import { ViewLink } from "../../components/navigation";
import { Badge, Surface } from "../../components/ui";
import { BRAND } from "../../config";
import type { AssetCategory } from "../../domain/assets";
import type { StableId, WizardDraft } from "../../schemas";
import type { StorageMutationResult } from "../../services";
import { CategoryIcon } from "./CategoryIcon";
import { MaterialBadge } from "./MaterialBadge";
import { ProfileCard } from "./ProfileCard";
import { DASHBOARD_CATEGORIES, MATERIAL_BADGE_IDS, getDashboardCategory } from "./dashboardCatalog";
import {
  formatDashboardDate,
  readDashboardData,
  type DashboardCollectionStatus,
  type DashboardStorage,
} from "./dashboardData";
import styles from "./DashboardView.module.css";

export interface DashboardViewProps {
  readonly activeBaseProfileId: StableId | null;
  readonly storageAdapter: DashboardStorage;
  readonly onStartNewAsset: (category: AssetCategory | null) => void;
  readonly onOpenProfile: (profileId: StableId) => void;
  readonly onResumeDraft: (draftId: StableId) => void;
  readonly onSelectBaseProfile: (profileId: StableId) => StorageMutationResult;
}

const collectionMessages: Record<
  Exclude<DashboardCollectionStatus, "ready">,
  Readonly<{ title: string; description: string }>
> = {
  empty: {
    title: "Noch keine Profile gespeichert",
    description:
      "Starte mit einer Asset-Kategorie. Dein erstes Profil erscheint danach an dieser Stelle.",
  },
  invalid: {
    title: "Gespeicherte Profile konnten nicht gelesen werden",
    description:
      "Die lokalen Daten bleiben unangetastet. Öffne die Profilverwaltung, um sie zu prüfen oder zu importieren.",
  },
  unavailable: {
    title: "Lokaler Speicher ist nicht verfügbar",
    description:
      "Du kannst ein Asset beginnen, gespeicherte Profile können in dieser Sitzung aber nicht angezeigt werden.",
  },
};

function ProfileCollectionState({ status }: Readonly<{ status: DashboardCollectionStatus }>) {
  if (status === "ready") return null;
  const message = collectionMessages[status];
  return (
    <Surface className={styles.emptyState} tone="soft" role="note">
      <strong>{message.title}</strong>
      <p>{message.description}</p>
      <ViewLink view="profiles">Profilverwaltung öffnen</ViewLink>
    </Surface>
  );
}

function NoResolvedProfilesState() {
  return (
    <Surface className={styles.emptyState} tone="soft" role="note">
      <strong>Keine kompatiblen Profile für den Schnellzugriff</strong>
      <p>
        Vorhandene inkonsistente Profile bleiben gespeichert und können in der Profilverwaltung
        geprüft werden.
      </p>
      <ViewLink view="profiles">Profile prüfen</ViewLink>
    </Surface>
  );
}

function DraftSummary({ draft }: Readonly<{ draft: WizardDraft }>) {
  const category = "category" in draft ? getDashboardCategory(draft.category) : null;
  return (
    <>
      <span className={styles.draftMarker} aria-hidden="true">
        ↗
      </span>
      <span className={styles.draftCopy}>
        <span className={styles.eyebrow}>Letzter Entwurf</span>
        <strong>{draft.projectName || "Unbenanntes Projekt"}</strong>
        <span>
          {category ? `${category.label} · ` : ""}
          Schritt {draft.currentStep}
        </span>
        <time dateTime={draft.savedAt}>Gesichert {formatDashboardDate(draft.savedAt)}</time>
      </span>
    </>
  );
}

export function DashboardView({
  activeBaseProfileId,
  storageAdapter,
  onStartNewAsset,
  onOpenProfile,
  onResumeDraft,
  onSelectBaseProfile,
}: DashboardViewProps) {
  const [baseSelectionStatus, setBaseSelectionStatus] = useState<
    "saved" | "session" | "invalid" | null
  >(null);
  const data = readDashboardData(storageAdapter, activeBaseProfileId);

  const selectBaseProfile = (profileId: StableId) => {
    const result = onSelectBaseProfile(profileId);
    setBaseSelectionStatus(
      result.status === "ok" ? "saved" : result.status === "unavailable" ? "session" : "invalid",
    );
  };

  return (
    <div className={styles.dashboard}>
      <Surface
        as="section"
        className={styles.hero}
        tone="raised"
        aria-labelledby="dashboard-view-title"
      >
        <div className={styles.heroCopy}>
          <Badge tone="accent">Produktionszentrale · {BRAND.versionLabel}</Badge>
          <p className={styles.eyebrow}>Asset zuerst. Prompt danach.</p>
          <h1 id="dashboard-view-title">
            Pixelart-Produktion beginnt mit der richtigen Asset-Art.
          </h1>
          <p className={styles.intro}>
            {BRAND.tagline}. Wähle zuerst, was du bauen möchtest – das Studio öffnet anschließend
            nur die passenden Regeln und Fragen.
          </p>
          <div className={styles.heroActions}>
            <button
              className={styles.primaryAction}
              type="button"
              onClick={() => onStartNewAsset(null)}
            >
              <span aria-hidden="true">+</span>
              Neues Asset
            </button>
            <ViewLink className={styles.secondaryAction} view="profiles">
              Profil laden
            </ViewLink>
          </div>
          <dl className={styles.heroFacts} aria-label="Studio-Leistungsumfang">
            <div>
              <dt>9</dt>
              <dd>Asset-Kategorien</dd>
            </div>
            <div>
              <dt>4</dt>
              <dd>Prompt-Ausgaben</dd>
            </div>
            <div>
              <dt>Lokal</dt>
              <dd>Profile &amp; Entwürfe</dd>
            </div>
          </dl>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <span className={styles.heroGrid} />
          <span className={styles.heroMark}>
            <ForgeMarkIcon />
          </span>
          <span className={styles.heroLabel}>CHOOSE · SHAPE · FORGE</span>
        </div>
      </Surface>

      {data.draftStatus === "ready" && data.draft ? (
        <button
          className={styles.draftButton}
          type="button"
          onClick={() => onResumeDraft(data.draft!.draftId)}
        >
          <DraftSummary draft={data.draft} />
          <span className={styles.draftAction}>Entwurf fortsetzen →</span>
        </button>
      ) : data.draftStatus === "invalid" || data.draftStatus === "unavailable" ? (
        <p className={styles.storageNotice} role="note">
          {data.draftStatus === "invalid"
            ? "Der lokale Entwurf ist beschädigt und wurde nicht automatisch geöffnet."
            : "Ein lokaler Entwurf kann derzeit nicht gelesen werden."}
        </p>
      ) : null}

      <section className={styles.section} aria-labelledby="asset-categories-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Neues Asset</p>
            <h2 id="asset-categories-title">Was möchtest du erschaffen?</h2>
            <p>
              Jede Auswahl startet den Wizard direkt mit der passenden Kategorie – ohne fachfremde
              Formularfelder.
            </p>
          </div>
        </div>

        <ul className={styles.categoryGrid}>
          {DASHBOARD_CATEGORIES.map((category) => (
            <li key={category.id}>
              <button
                className={styles.categoryCard}
                data-accent={category.accent}
                type="button"
                onClick={() => onStartNewAsset(category.id)}
                aria-labelledby={`dashboard-category-${category.id}-title`}
                aria-describedby={`dashboard-category-${category.id}-description dashboard-category-${category.id}-meta`}
              >
                <span
                  className={styles.visuallyHidden}
                  id={`dashboard-category-${category.id}-title`}
                >
                  {`${category.label} als neues Asset erstellen`}
                </span>
                <span className={styles.categoryIcon}>
                  <CategoryIcon category={category.id} />
                </span>
                <span className={styles.categoryCopy}>
                  <strong>{category.label}</strong>
                  <span id={`dashboard-category-${category.id}-description`}>
                    {category.shortDescription}
                  </span>
                </span>
                <span className={styles.categoryMeta} id={`dashboard-category-${category.id}-meta`}>
                  <span>{category.examples}</span>
                  <Badge>{category.capabilityLabel}</Badge>
                </span>
                <span className={styles.categoryArrow} aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Surface
        as="section"
        className={styles.materialStrip}
        tone="soft"
        aria-labelledby="materials-title"
      >
        <div>
          <p className={styles.eyebrow}>Materialsprache</p>
          <h2 id="materials-title">Vom Werkstoff zum präzisen Preset</h2>
          <p>
            Materialangaben werden im passenden Textur- oder Asset-Editor konkretisiert und bleiben
            auf Profilkarten sofort erkennbar.
          </p>
        </div>
        <div className={styles.materialBadges} role="group" aria-label="Unterstützte Materialien">
          {MATERIAL_BADGE_IDS.map((material) => (
            <MaterialBadge key={material} material={material} />
          ))}
        </div>
      </Surface>

      <section className={styles.section} aria-labelledby="recent-profiles-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Direkt weiterarbeiten</p>
            <h2 id="recent-profiles-title">Letzte Profile</h2>
            <p>Zuletzt geänderte, kompatibel aufgelöste Assetprofile.</p>
          </div>
          <ViewLink className={styles.textLink} view="profiles">
            Profile durchsuchen &amp; filtern →
          </ViewLink>
        </div>

        {data.recentProfiles.length > 0 ? (
          <ul className={styles.profileGrid}>
            {data.recentProfiles.map((profile) => (
              <li key={profile.id}>
                <ProfileCard profile={profile} onOpen={onOpenProfile} />
              </li>
            ))}
          </ul>
        ) : data.collectionStatus === "ready" ? (
          <NoResolvedProfilesState />
        ) : (
          <ProfileCollectionState status={data.collectionStatus} />
        )}
        {data.skippedProfileCount > 0 ? (
          <p className={styles.storageNotice} role="note">
            {data.skippedProfileCount} inkonsistente Profile wurden aus der Schnellansicht
            ausgeblendet und nicht verändert.
          </p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="favorite-profiles-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Schnellzugriff</p>
            <h2 id="favorite-profiles-title">Favoriten</h2>
            <p>Deine markierten Profile für den direkten Wiedereinstieg.</p>
          </div>
        </div>

        {data.favoriteProfiles.length > 0 ? (
          <ul className={styles.profileGrid}>
            {data.favoriteProfiles.map((profile) => (
              <li key={profile.id}>
                <ProfileCard profile={profile} onOpen={onOpenProfile} />
              </li>
            ))}
          </ul>
        ) : data.collectionStatus === "invalid" || data.collectionStatus === "unavailable" ? (
          <ProfileCollectionState status={data.collectionStatus} />
        ) : (
          <Surface className={styles.emptyState} tone="soft" role="note">
            <strong>Noch keine Favoriten</strong>
            <p>
              Favorisierte Profile erscheinen hier, sobald sie in der Profilbibliothek markiert
              wurden.
            </p>
            <ViewLink view="profiles">Zur Profilbibliothek</ViewLink>
          </Surface>
        )}
      </section>

      <section className={styles.section} aria-labelledby="base-profiles-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Vererbte Produktionsregeln</p>
            <h2 id="base-profiles-title">Basisprofile im Überblick</h2>
            <p>
              Wähle hier das aktive Produktionsfundament. Bearbeitung und neue Profile bleiben in
              der Profilverwaltung gebündelt.
            </p>
          </div>
          <ViewLink className={styles.textLink} view="profiles">
            Basisprofile verwalten →
          </ViewLink>
        </div>

        {data.baseProfiles.length > 0 ? (
          <ul className={styles.baseGrid}>
            {data.baseProfiles.map((profile) => (
              <li key={profile.id}>
                <button
                  className={styles.baseCard}
                  type="button"
                  aria-labelledby={`dashboard-base-${profile.id}-title`}
                  aria-describedby={`dashboard-base-${profile.id}-description`}
                  aria-pressed={profile.active}
                  disabled={profile.active}
                  onClick={() => selectBaseProfile(profile.id)}
                >
                  <span className={styles.visuallyHidden} id={`dashboard-base-${profile.id}-title`}>
                    {profile.active
                      ? `${profile.name}, aktives Basisprofil`
                      : `${profile.name} als Basisprofil verwenden`}
                  </span>
                  <span className={styles.baseTopline}>
                    <span className={styles.baseMonogram} aria-hidden="true">
                      BP
                    </span>
                    {profile.active ? <Badge tone="success">Aktiv</Badge> : null}
                  </span>
                  <strong>{profile.name}</strong>
                  <span
                    className={styles.baseDescription}
                    id={`dashboard-base-${profile.id}-description`}
                  >
                    <span className={styles.baseFacts}>{profile.facts.join(" · ")}</span>
                    <time dateTime={profile.updatedAt}>
                      Aktualisiert {formatDashboardDate(profile.updatedAt)}
                    </time>
                  </span>
                  <span className={styles.baseAction} aria-hidden="true">
                    {profile.active ? "Aktives Profil" : "Als Basis verwenden →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : data.collectionStatus === "invalid" || data.collectionStatus === "unavailable" ? (
          <ProfileCollectionState status={data.collectionStatus} />
        ) : (
          <Surface className={styles.emptyState} tone="soft" role="note">
            <strong>Kein Basisprofil verfügbar</strong>
            <p>
              Lege in der Profilverwaltung ein technisches Fundament für Tile, Perspektive und
              Pixelstil an.
            </p>
            <ViewLink view="profiles">Basisprofil anlegen</ViewLink>
          </Surface>
        )}
        {baseSelectionStatus ? (
          <p className={styles.storageNotice} role="status">
            {baseSelectionStatus === "saved"
              ? "Basisprofil aktiviert und lokal gespeichert."
              : baseSelectionStatus === "session"
                ? "Basisprofil ist für diese Sitzung aktiv; lokales Speichern ist nicht verfügbar."
                : "Basisprofil konnte wegen ungültiger Einstellungen nicht aktiviert werden."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
