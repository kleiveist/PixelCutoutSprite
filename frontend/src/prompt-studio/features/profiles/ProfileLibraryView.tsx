import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ASSET_CATEGORY_IDS } from "../../domain/assets";
import type { StableId } from "../../schemas";
import { useProfileLibrary } from "../../store/profiles";
import { Surface } from "../../components/ui";
import type { DashboardProfileSummary } from "../dashboard/dashboardData";
import { DeleteProfileDialog } from "./DeleteProfileDialog";
import { ProfileLibraryCard } from "./ProfileLibraryCard";
import { categoryFilterLabel, createProfileLibraryData } from "./profileLibraryData";
import styles from "./ProfileLibraryView.module.css";

export interface ProfileLibraryViewProps {
  readonly onLoadProfile: (profileId: StableId) => void;
  readonly onProfileDeleted: (profileId: StableId) => void;
  readonly onStartNewAsset: () => void;
}

function mutationMessage(
  mutation: ReturnType<typeof useProfileLibrary>["mutation"],
): string | null {
  if (mutation.status === "ready") return null;
  if (mutation.status !== "saved") return mutation.message;

  switch (mutation.operation) {
    case "favorite":
      return `Favoritenstatus für „${mutation.profileName}“ gespeichert.`;
    case "duplicate":
      return `„${mutation.profileName}“ wurde als neues Assetprofil angelegt.`;
    case "save":
      return `„${mutation.profileName}“ wurde als Assetprofil gespeichert.`;
    case "delete":
      return `„${mutation.profileName}“ wurde gelöscht.`;
    case "deleteBase":
      return `Produktionsfamilie „${mutation.profileName}“ wurde gelöscht.`;
    case "createBase":
      return `„${mutation.profileName}“ wurde als neues Basisprofil angelegt.`;
    case "duplicateBase":
      return `„${mutation.profileName}“ wurde als neues Basisprofil dupliziert.`;
  }
}

function LibraryUnavailableState({ status }: Readonly<{ status: "invalid" | "unavailable" }>) {
  return (
    <Surface className={styles.statePanel} tone="soft" role="alert">
      <strong>
        {status === "invalid"
          ? "Profilbibliothek ist beschädigt"
          : "Lokaler Profilspeicher ist nicht verfügbar"}
      </strong>
      <p>
        {status === "invalid"
          ? "Die gespeicherten Daten bleiben unangetastet. Korrigiere oder importiere sie später über einen kontrollierten Profilworkflow."
          : "Profile können in dieser Sitzung nicht gelesen oder verändert werden."}
      </p>
    </Surface>
  );
}

export function ProfileLibraryView({
  onLoadProfile,
  onProfileDeleted,
  onStartNewAsset,
}: ProfileLibraryViewProps) {
  const {
    libraryResult,
    filters,
    mutation,
    setProfile,
    setCategory,
    setBaseProfile,
    setFavoritesOnly,
    setGrouping,
    resetFilters,
    toggleFavorite,
    duplicateProfile,
    deleteProfile,
    dismissMutation,
  } = useProfileLibrary();
  const data = useMemo(
    () => createProfileLibraryData(libraryResult, filters),
    [filters, libraryResult],
  );
  const [pendingDelete, setPendingDelete] = useState<DashboardProfileSummary | null>(null);
  const [focusResults, setFocusResults] = useState(false);
  const [restoreDeleteFocus, setRestoreDeleteFocus] = useState(false);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!focusResults) return;
    resultsHeadingRef.current?.focus();
    setFocusResults(false);
  }, [focusResults]);

  useEffect(() => {
    if (!restoreDeleteFocus || pendingDelete !== null) return;
    deleteTriggerRef.current?.focus();
    setRestoreDeleteFocus(false);
  }, [pendingDelete, restoreDeleteFocus]);

  const hasActiveFilters =
    filters.profileId !== null ||
    filters.category !== null ||
    filters.baseProfileId !== null ||
    filters.favoritesOnly ||
    filters.groupBy !== "category";
  const message = mutationMessage(mutation);
  const deleteError =
    pendingDelete &&
    mutation.status !== "ready" &&
    mutation.status !== "saved" &&
    mutation.operation === "delete"
      ? mutation.message
      : undefined;

  const preventSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const requestDelete = (profile: DashboardProfileSummary, trigger: HTMLButtonElement) => {
    dismissMutation();
    deleteTriggerRef.current = trigger;
    setPendingDelete(profile);
  };

  const cancelDelete = () => {
    dismissMutation();
    setPendingDelete(null);
    setRestoreDeleteFocus(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const result = deleteProfile(pendingDelete.id);
    if (result.status === "ok") {
      onProfileDeleted(result.profile.id);
      setPendingDelete(null);
      setFocusResults(true);
    }
  };

  return (
    <div className={styles.view}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Profilbibliothek</span>
          <h1 id="profiles-view-title">Produktionsprofile sicher organisieren.</h1>
          <p>
            Finde kompatible Assetprofile, verwalte Favoriten und starte exakt die richtige
            Konfiguration im geführten Wizard.
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={onStartNewAsset}>
          <span aria-hidden="true">+</span>
          Neues Asset
        </button>
      </header>

      <Surface
        as="section"
        className={styles.filterPanel}
        tone="raised"
        aria-labelledby="profile-filter-title"
      >
        <div className={styles.filterHeading}>
          <div>
            <span className={styles.sectionIndex}>01 · Auswahl</span>
            <h2 id="profile-filter-title">Bibliothek eingrenzen</h2>
          </div>
          <button
            className={styles.resetButton}
            type="button"
            disabled={!hasActiveFilters}
            onClick={resetFilters}
          >
            Alle Filter zurücksetzen
          </button>
        </div>

        <form className={styles.filters} role="search" onSubmit={preventSubmit}>
          <label className={styles.searchField}>
            <span>Profile durchsuchen</span>
            <select
              value={filters.profileId ?? ""}
              onChange={(event) => {
                const profile = data.profileOptions.find(
                  (candidate) => candidate.id === event.currentTarget.value,
                );
                setProfile(profile?.id ?? null);
              }}
            >
              <option value="">Alle Profile</option>
              {data.profileOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.categoryLabel} / {profile.subtypeLabel}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Kategorie</span>
            <select
              value={filters.category ?? "all"}
              onChange={(event) => {
                const category = ASSET_CATEGORY_IDS.find(
                  (candidate) => candidate === event.currentTarget.value,
                );
                setCategory(category ?? null);
              }}
            >
              <option value="all">Alle Kategorien</option>
              {ASSET_CATEGORY_IDS.map((category) => (
                <option key={category} value={category}>
                  {categoryFilterLabel(category)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Basisprofil</span>
            <select
              value={filters.baseProfileId ?? ""}
              onChange={(event) => {
                const baseProfile = data.baseOptions.find(
                  (candidate) => candidate.id === event.currentTarget.value,
                );
                setBaseProfile(baseProfile?.id ?? null);
              }}
            >
              <option value="">Alle Basisprofile</option>
              {data.baseOptions.map((baseProfile) => (
                <option key={baseProfile.id} value={baseProfile.id}>
                  {baseProfile.name} ({baseProfile.profileCount})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Gruppierung</span>
            <select
              value={filters.groupBy}
              onChange={(event) =>
                setGrouping(
                  event.currentTarget.value === "compatibility" ? "compatibility" : "category",
                )
              }
            >
              <option value="category">Nach Kategorie</option>
              <option value="compatibility">Nach technischer Kompatibilität</option>
            </select>
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={filters.favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.currentTarget.checked)}
            />
            <span>Nur Favoriten</span>
          </label>
        </form>
      </Surface>

      {message && !(deleteError && pendingDelete) ? (
        <div
          className={mutation.status === "saved" ? styles.successNotice : styles.errorNotice}
          role={mutation.status === "saved" ? "status" : "alert"}
          aria-live={mutation.status === "saved" ? "polite" : undefined}
        >
          <span>{message}</span>
          <button type="button" aria-label="Profilmeldung schließen" onClick={dismissMutation}>
            ×
          </button>
        </div>
      ) : null}

      <section className={styles.results} aria-labelledby="profile-results-title">
        <div className={styles.resultsHeading}>
          <div>
            <span className={styles.sectionIndex}>02 · Bibliothek</span>
            <h2 ref={resultsHeadingRef} id="profile-results-title" tabIndex={-1}>
              Gespeicherte Assetprofile
            </h2>
          </div>
          <p role="status" aria-live="polite" aria-atomic="true">
            {data.visibleProfileCount} von {data.totalProfileCount}{" "}
            {data.totalProfileCount === 1 ? "Profil" : "Profilen"}
          </p>
        </div>

        {data.skippedProfileCount > 0 ? (
          <p className={styles.warning} role="note">
            {data.skippedProfileCount} inkonsistente Profile wurden nicht als Arbeitsgrundlage
            angezeigt.
          </p>
        ) : null}

        {data.collectionStatus === "invalid" || data.collectionStatus === "unavailable" ? (
          <LibraryUnavailableState status={data.collectionStatus} />
        ) : data.collectionStatus === "empty" ? (
          <Surface className={styles.statePanel} tone="soft" role="note">
            <strong>Noch keine Assetprofile gespeichert</strong>
            <p>
              Starte ein neues Asset. Gespeicherte Ergebnisse erscheinen danach kategorisiert in
              dieser Bibliothek.
            </p>
            <button className={styles.primaryButton} type="button" onClick={onStartNewAsset}>
              Erstes Asset erstellen
            </button>
          </Surface>
        ) : data.groups.length === 0 ? (
          <Surface className={styles.statePanel} tone="soft" role="note">
            <strong>Keine Profile entsprechen diesen Filtern</strong>
            <p>Die Bibliothek bleibt unverändert. Passe die Auswahl an.</p>
            <button className={styles.secondaryButton} type="button" onClick={resetFilters}>
              Filter zurücksetzen
            </button>
          </Surface>
        ) : (
          <div className={styles.groupList}>
            {data.groups.map((group, groupIndex) => {
              const headingId = `profile-group-${groupIndex + 1}`;
              return (
                <section key={group.id} className={styles.group} aria-labelledby={headingId}>
                  <div className={styles.groupHeading}>
                    <h3 id={headingId}>{group.label}</h3>
                    <p>{group.description}</p>
                  </div>
                  <ul className={styles.cards}>
                    {group.profiles.map((profile) => (
                      <li key={profile.id}>
                        <ProfileLibraryCard
                          profile={profile}
                          onLoad={onLoadProfile}
                          onToggleFavorite={(selectedProfile) => {
                            const result = toggleFavorite(selectedProfile.id);
                            if (
                              result.status === "ok" &&
                              filters.favoritesOnly &&
                              !result.profile.favorite
                            ) {
                              setFocusResults(true);
                            }
                          }}
                          onDuplicate={duplicateProfile}
                          onRequestDelete={requestDelete}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {pendingDelete ? (
        <DeleteProfileDialog
          profile={pendingDelete}
          {...(deleteError ? { errorMessage: deleteError } : {})}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
