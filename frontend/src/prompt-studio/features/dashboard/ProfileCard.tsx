import { useId } from "react";
import { Badge } from "../../components/ui";
import type { StableId } from "../../schemas";
import { CategoryIcon } from "./CategoryIcon";
import { MaterialBadge } from "./MaterialBadge";
import type { DashboardProfileSummary } from "./dashboardData";
import { formatDashboardDate } from "./dashboardData";
import styles from "./ProfileCard.module.css";

export interface ProfileCardProps {
  readonly profile: DashboardProfileSummary;
  readonly onOpen: (profileId: StableId) => void;
}

export function ProfileCard({ profile, onOpen }: ProfileCardProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <button
      className={styles.card}
      type="button"
      onClick={() => onOpen(profile.id)}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <span id={titleId} className={styles.visuallyHidden}>
        {`Profil ${profile.name} im Wizard öffnen`}
      </span>
      <span className={styles.headingRow}>
        <span className={styles.icon} aria-hidden="true">
          <CategoryIcon category={profile.category} />
        </span>
        <span className={styles.headingCopy}>
          <span className={styles.category}>{profile.categoryLabel}</span>
          <strong>{profile.name}</strong>
          <span className={styles.subtype}>{profile.subtypeLabel}</span>
        </span>
        {profile.favorite ? (
          <span className={styles.favorite} aria-hidden="true">
            ★
          </span>
        ) : null}
      </span>

      <span id={descriptionId} className={styles.description}>
        <span className={styles.metadata}>
          <span>Basis: {profile.baseProfileName}</span>
          <time dateTime={profile.updatedAt}>
            Aktualisiert {formatDashboardDate(profile.updatedAt)}
          </time>
        </span>
        {profile.favorite ? <span className={styles.visuallyHidden}>Favorit. </span> : null}

        {profile.facts.length > 0 ? (
          <span className={styles.badges}>
            <span className={styles.visuallyHidden}>Technische Merkmale: </span>
            {profile.facts.map((fact, index) => (
              <Badge key={`${fact}-${index}`}>{fact}</Badge>
            ))}
          </span>
        ) : null}

        {profile.materials.length > 0 ? (
          <span className={styles.badges}>
            <span className={styles.visuallyHidden}>Materialien: </span>
            {profile.materials.map((material) => (
              <MaterialBadge key={material} material={material} />
            ))}
          </span>
        ) : null}

        {profile.tags.length > 0 ? (
          <span className={styles.tags}>
            <span className={styles.visuallyHidden}>Schlagwörter: </span>
            {profile.tags.map((tag, index) => (
              <span key={`${tag}-${index}`}>#{tag}</span>
            ))}
          </span>
        ) : null}
      </span>

      <span className={styles.openHint} aria-hidden="true">
        Profil öffnen <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}
