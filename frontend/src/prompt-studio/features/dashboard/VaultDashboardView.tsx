import { useState } from "react";
import type { AssetCategory } from "../../domain/assets";
import { Modal, ModalHost } from "../../../shared/dialogs";
import { useOptionalActiveVault } from "../../../shared/vault";
import { useOptionalVaultPrompt } from "../../store/vault";
import { vaultProfileStatus } from "../../services/vaultOutputStatus";
import { CategoryIcon } from "./CategoryIcon";
import { DASHBOARD_CATEGORIES, formatSubtypeLabel, getDashboardCategory } from "./dashboardCatalog";
import styles from "./VaultDashboardView.module.css";

export interface VaultDashboardViewProps {
  readonly onOpenProfile: (id: string) => Promise<void>;
  readonly onStartNewAsset: (category: AssetCategory | null) => Promise<void>;
}

export function VaultDashboardView({ onOpenProfile, onStartNewAsset }: VaultDashboardViewProps) {
  const vault = useOptionalVaultPrompt();
  const activeVault = useOptionalActiveVault()?.activeVault;
  const [category, setCategory] = useState<AssetCategory | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profiles = vault?.index?.profiles ?? [];
  const base = vault?.index?.baseProfile?.value ?? null;
  const selected = profiles
    .filter(
      ({ value }) =>
        value.category === category &&
        `${value.name} ${formatSubtypeLabel(value.subtype)}`
          .toLocaleLowerCase("de")
          .includes(search.toLocaleLowerCase("de")),
    )
    .sort((left, right) => left.value.name.localeCompare(right.value.name, "de"));
  const subtypes = [...new Set(selected.map(({ value }) => value.subtype))];
  const ready = vault?.status === "ready";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.view}>
      <div className={styles.heading}>
        <div>
          <h1 id="dashboard-view-title">Deine Assets im Vault</h1>
          <p>
            {activeVault
              ? activeVault.display_name
              : "Öffne einen Vault, um Profile anzulegen oder zu laden."}
          </p>
        </div>
        <button
          type="button"
          disabled={!activeVault || vault?.status === "loading" || busy}
          onClick={() => void run(() => vault!.reload())}
        >
          Aktualisieren
        </button>
      </div>
      <p role="status">
        {vault?.status === "loading"
          ? "Vault wird gelesen …"
          : `${profiles.length} gespeicherte Profile`}
      </p>
      {vault?.error ? <p role="alert">{vault.error}</p> : null}
      {!category && error ? <p role="alert">{error}</p> : null}
      <ul className={styles.cards} aria-label="Asset-Kategorien">
        {DASHBOARD_CATEGORIES.map((item) => {
          const entries = profiles.filter(({ value }) => value.category === item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.card}
                aria-label={`${item.label}: ${entries.length} Profile`}
                onClick={() => {
                  setCategory(item.id);
                  setSearch("");
                  setError(null);
                }}
              >
                <span className={styles.icon}>
                  <CategoryIcon category={item.id} />
                </span>
                <strong>{item.label}</strong>
                <span>{entries.length} Profile</span>
                <span className={styles.preview}>
                  {entries
                    .slice(0, 3)
                    .map(({ value }) => value.name)
                    .join(" · ") || "Noch keine Profile"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={!ready || !vault?.writable || busy}
        onClick={() => void run(() => onStartNewAsset(null))}
      >
        Neues Asset
      </button>
      {vault?.index?.issues.length ? (
        <section aria-label="Fehlerhafte Vault-Dateien">
          <h2>Dateien mit Prüfbedarf</h2>
          <ul>
            {vault.index.issues.map((issue, i) => (
              <li key={`${issue.relativePath}:${i}`}>
                <code>{issue.relativePath}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ModalHost>
        <Modal
          open={category !== null}
          title={category ? `${getDashboardCategory(category).label} – Profile` : "Profile"}
          onClose={() => setCategory(null)}
          canDismiss={!busy}
          className={styles.dialog}
        >
          <label>
            Profile suchen
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          {!ready ? <p>Öffne einen lesbaren Vault, um Profile zu laden.</p> : null}
          {ready && selected.length === 0 ? (
            <p>
              {search
                ? "Keine passenden Profile gefunden."
                : "In dieser Kategorie gibt es noch keine Profile."}
            </p>
          ) : null}
          {subtypes.map((subtype) => (
            <section key={subtype} aria-label={formatSubtypeLabel(subtype)}>
              <h3>{formatSubtypeLabel(subtype)}</h3>
              <ul className={styles.profiles}>
                {selected
                  .filter(({ value }) => value.subtype === subtype)
                  .map((stored) => {
                    const { value } = stored;
                    const duplicate =
                      profiles.filter((entry) => entry.value.id === value.id).length > 1;
                    return (
                      <li key={stored.relativePath}>
                        <strong>{value.name}</strong>
                        <time dateTime={value.updatedAt}>
                          {new Date(value.updatedAt).toLocaleString("de-DE")}
                        </time>
                        <span>
                          {duplicate
                            ? "Konflikt · doppelte Profil-ID"
                            : vaultProfileStatus(value, base)}
                        </span>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            disabled={busy || duplicate}
                            aria-label={`${value.name} laden`}
                            onClick={() => void run(() => onOpenProfile(value.id))}
                          >
                            Laden
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Profil-JSON im Dateimanager öffnen: ${value.name}`}
                            onClick={() => void run(() => vault!.revealPath(stored.relativePath))}
                          >
                            Profil-JSON im Dateimanager öffnen
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Profilordner im Dateimanager öffnen: ${value.name}`}
                            onClick={() =>
                              void run(() =>
                                vault!.revealPath(
                                  stored.relativePath.slice(
                                    0,
                                    stored.relativePath.lastIndexOf("/"),
                                  ),
                                ),
                              )
                            }
                          >
                            Ordner anzeigen
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
          <button
            type="button"
            disabled={!ready || !vault?.writable || busy}
            onClick={() => void run(() => onStartNewAsset(category))}
          >
            Neues Asset in dieser Kategorie
          </button>
        </Modal>
      </ModalHost>
    </div>
  );
}
