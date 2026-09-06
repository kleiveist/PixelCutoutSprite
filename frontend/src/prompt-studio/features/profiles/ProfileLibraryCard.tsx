import { useId } from "react";
import { Badge } from "../../components/ui";
import type { StableId } from "../../schemas";
import { CategoryIcon } from "../dashboard/CategoryIcon";
import { MaterialBadge } from "../dashboard/MaterialBadge";
import { formatDashboardDate, type DashboardProfileSummary } from "../dashboard/dashboardData";
import styles from "./ProfileLibraryCard.module.css";

export interface ProfileLibraryCardProps {
  readonly profile: DashboardProfileSummary;
  readonly onLoad: (profileId: StableId) => void;
  readonly onToggleFavorite: (profile: DashboardProfileSummary) => void;
  readonly onDuplicate: (profileId: StableId) => void;
  readonly onRequestDelete: (profile: DashboardProfileSummary, trigger: HTMLButtonElement) => void;
}

export function ProfileLibraryCard({
  profile,
  onLoad,
  onToggleFavorite,
  onDuplicate,
  onRequestDelete,
}: ProfileLibraryCardProps) {
  const titleId = useId();

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <CategoryIcon category={profile.category} />
        </span>
        <span className={styles.headingCopy}>
          <span className={styles.category}>{profile.categoryLabel}</span>
          <h4 id={titleId}>{profile.name}</h4>
          <span className={styles.subtype}>{profile.subtypeLabel}</span>
        </span>
        {profile.favorite ? (
          <span className={styles.favorite} title="Favorit" aria-hidden="true">
            ★
          </span>
        ) : null}
      </header>

      <div className={styles.metadata}>
        <span>Basis: {profile.baseProfileName}</span>
        <time dateTime={profile.updatedAt}>
          Aktualisiert {formatDashboardDate(profile.updatedAt)}
        </time>
      </div>

      {profile.facts.length > 0 ? (
        <div className={styles.badges} role="group" aria-label="Technische Merkmale">
          {profile.facts.map((fact, index) => (
            <Badge key={`${fact}-${index}`}>{fact}</Badge>
          ))}
        </div>
      ) : null}

      {profile.materials.length > 0 ? (
        <div className={styles.badges} role="group" aria-label="Materialien">
          {profile.materials.map((material) => (
            <MaterialBadge key={material} material={material} />
          ))}
        </div>
      ) : null}

      {profile.tags.length > 0 ? (
        <div className={styles.tags} role="group" aria-label="Schlagwörter">
          {profile.tags.map((tag, index) => (
            <span key={`${tag}-${index}`}>#{tag}</span>
          ))}
        </div>
      ) : null}

      <div className={styles.actions} role="group" aria-label={`Aktionen für ${profile.name}`}>
        <button
          className={styles.loadAction}
          type="button"
          aria-label={`Profil „${profile.name}“ im Wizard laden`}
          onClick={() => onLoad(profile.id)}
        >
          Profil laden
          <span aria-hidden="true">→</span>
        </button>
        <button
          className={styles.action}
          type="button"
          aria-pressed={profile.favorite}
          aria-label={
            profile.favorite
              ? `Profil „${profile.name}“ aus Favoriten entfernen`
              : `Profil „${profile.name}“ als Favorit markieren`
          }
          onClick={() => onToggleFavorite(profile)}
        >
          <span aria-hidden="true">{profile.favorite ? "★" : "☆"}</span>
          Favorit
        </button>
        <button
          className={styles.action}
          type="button"
          aria-label={`Profil „${profile.name}“ duplizieren`}
          onClick={() => onDuplicate(profile.id)}
        >
          Duplizieren
        </button>
        <button
          className={styles.deleteAction}
          type="button"
          aria-label={`Profil „${profile.name}“ löschen`}
          onClick={(event) => onRequestDelete(profile, event.currentTarget)}
        >
          <span aria-hidden="true">×</span>
          Löschen
        </button>
      </div>
    </article>
  );
}
