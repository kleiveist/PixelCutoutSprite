import { useOptionalActiveVault } from "../../../shared/vault";
import { useOptionalVaultPrompt } from "../../store/vault";
import styles from "./VaultProfileView.module.css";

export interface VaultProfileViewProps {
  readonly onOpenBaseProfile: () => void;
  readonly onOpenLegacyMigration?: () => void;
}

const styleLabels = { classic: "Klassisch", dark: "Düster", both: "Klassisch + düster" } as const;
const densityLabels = {
  classicHd: "Classic HD",
  modernHd: "Modern HD",
  ultraHd: "Ultra HD",
} as const;
const perspectiveLabels = {
  topdown: "Top-down",
  threeQuarter: "3/4",
  isometric: "Isometrisch",
  side: "Seite",
} as const;

export function VaultProfileView({
  onOpenBaseProfile,
  onOpenLegacyMigration,
}: VaultProfileViewProps) {
  const activeVaultContext = useOptionalActiveVault();
  const promptContext = useOptionalVaultPrompt();
  const activeVault = activeVaultContext?.activeVault ?? null;
  if (!activeVault) {
    return (
      <section className={`${styles.state} ${styles.error}`} role="status">
        <h1 id="profiles-view-title">Kein Vault geöffnet</h1>
        <p>
          Öffne zuerst einen Vault. Ein Basisprofil wird niemals global oder im Browser angelegt.
        </p>
      </section>
    );
  }
  if (!promptContext) {
    return (
      <section className={`${styles.state} ${styles.error}`} role="alert">
        <h1 id="profiles-view-title">Vault-Kontext fehlt</h1>
        <p>Die dateibasierte Profilablage ist in dieser Ansicht nicht verfügbar.</p>
      </section>
    );
  }
  const { status, index, error, writable, regeneration } = promptContext;
  if (status === "loading") {
    return (
      <section className={styles.state} role="status">
        <h1 id="profiles-view-title">Vault-Profil wird gelesen…</h1>
      </section>
    );
  }
  if (status === "error") {
    return (
      <section className={`${styles.state} ${styles.error}`} role="alert">
        <h1 id="profiles-view-title">Vault-Profil nicht lesbar</h1>
        <p>{error}</p>
      </section>
    );
  }
  const corruptBase = index?.issues.find(
    (issue) =>
      issue.relativePath === ".PixelPrompt/basisprofil.json" ||
      issue.code === "duplicate_base_profile",
  );
  const base = index?.baseProfile?.value ?? null;
  return (
    <div className={styles.view}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Aktueller Vault</span>
        <h1 id="profiles-view-title">{activeVault.display_name}</h1>
        <p>
          Dieser Ordner besitzt genau ein Basisprofil. Assetprofile und Ausgaben bleiben physisch
          und logisch in diesem Vault.
        </p>
      </header>
      {corruptBase ? (
        <section className={`${styles.state} ${styles.error}`} role="alert">
          <strong>Basisprofil ist beschädigt</strong>
          <p>{corruptBase.message}</p>
          <p>Die Datei bleibt unangetastet; es werden keine Standardwerte darübergeschrieben.</p>
        </section>
      ) : (
        <button
          className={styles.baseButton}
          type="button"
          disabled={!writable}
          onClick={onOpenBaseProfile}
        >
          <span>
            <small>{base ? "VAULT-BASISPROFIL" : "NOCH KEINE VAULT-BASIS"}</small>
            <strong>{base?.name ?? "Basisprofil anlegen"}</strong>
            {base ? (
              <ul className={styles.summary} aria-label="Gespeicherte Basiswerte">
                <li>{styleLabels[base.values.styleProfile]}</li>
                <li>{densityLabels[base.values.pixelDensity]}</li>
                <li>{base.values.tileSize} px Tile</li>
                <li>{perspectiveLabels[base.values.perspectiveType]}</li>
              </ul>
            ) : (
              <small>Öffnet den vollständigen Basisprofil-Dialog.</small>
            )}
          </span>
          <span className={styles.revision}>{base ? `REV ${base.revision}` : "+"}</span>
        </button>
      )}
      {!writable ? (
        <section className={styles.state} role="status">
          <strong>Vault ist schreibgeschützt</strong>
          <p>Die gespeicherte Basis ist sichtbar, Änderungen sind in dieser Sitzung gesperrt.</p>
        </section>
      ) : null}
      {regeneration.status !== "idle" ? (
        <section className={styles.regeneration} aria-live="polite">
          <strong>
            Prompt-Aktualisierung: {regeneration.completed} / {regeneration.total}
          </strong>
          <progress value={regeneration.completed} max={Math.max(1, regeneration.total)} />
          {regeneration.failures.map((failure) => (
            <p key={failure.profileId} role="alert">
              {failure.profileName}: {failure.message}
            </p>
          ))}
        </section>
      ) : null}
      {onOpenLegacyMigration ? (
        <button
          className={styles.migrationButton}
          type="button"
          disabled={!writable}
          onClick={onOpenLegacyMigration}
        >
          Legacy-Daten prüfen und übernehmen
        </button>
      ) : null}
    </div>
  );
}
