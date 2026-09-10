import { useEffect, useState } from "react";
import { useOptionalVaultPrompt } from "../../store/vault";
import { useWizardSession } from "../../store/wizard";
import { vaultOutputsAreCurrent } from "../../services/vaultOutputStatus";
import type { StoredPromptGeneration } from "../../services";
import { REVIEW_OUTPUT_IDS, REVIEW_OUTPUT_LABELS, type ReviewOutputId } from "./reviewOutputData";
import styles from "./ReviewOutputWorkspace.module.css";

export function VaultReviewOutputWorkspace() {
  const vault = useOptionalVaultPrompt();
  const { activeDraft } = useWizardSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [style, setStyle] = useState("classic");
  const [language, setLanguage] = useState("de");
  const [part, setPart] = useState<ReviewOutputId>("combined");
  const [loaded, setLoaded] = useState<StoredPromptGeneration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const profiles = vault?.index?.profiles ?? [];
  const draftProfileId =
    activeDraft && "sourceAssetProfileId" in activeDraft ? activeDraft.sourceAssetProfileId : null;
  const profileId = selectedId ?? draftProfileId ?? activeDraft?.draftId ?? profiles[0]?.value.id;
  const stored = profiles.find(({ value }) => value.id === profileId);
  const expectedHash = stored?.sha256;
  const readGeneration = vault?.readGeneration;
  const vaultStatus = vault?.status;

  useEffect(() => {
    let current = true;
    setLoaded(null);
    setError(null);
    if (!profileId || !expectedHash || !readGeneration || vaultStatus !== "ready") return;
    void readGeneration(profileId, expectedHash).then(
      (result) => {
        if (current) setLoaded(result);
      },
      (reason) => {
        if (current) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      current = false;
    };
  }, [expectedHash, profileId, readGeneration, vaultStatus, vault?.index]);

  const snapshot =
    loaded && loaded.profile.sha256 === expectedHash && loaded.profile.value.id === profileId
      ? loaded
      : null;
  const files = snapshot?.profile.value.outputs.files ?? [];
  const stylesAvailable = [...new Set(files.map((file) => file.style))];
  const activeStyle = stylesAvailable.find((value) => value === style) ?? stylesAvailable[0];
  const languages = [
    ...new Set(files.filter((file) => file.style === activeStyle).map((file) => file.language)),
  ];
  const activeLanguage = languages.find((value) => value === language) ?? languages[0];
  const file = files.find(
    (entry) =>
      entry.style === activeStyle && entry.language === activeLanguage && entry.part === part,
  );
  const contents = file
    ? snapshot?.outputs.find((output) => output.relativePath === file.relativePath)?.contents
    : undefined;
  const pending =
    vault?.autosave.status === "scheduled" ||
    vault?.autosave.status === "saving" ||
    vault?.regeneration.status === "running";
  const failed =
    vaultStatus === "error" ||
    vault?.autosave.status === "error" ||
    vault?.regeneration.failures.some((failure) => failure.profileId === profileId);
  const fresh =
    !!snapshot?.fresh &&
    vaultStatus === "ready" &&
    !pending &&
    !failed &&
    vaultOutputsAreCurrent(snapshot.profile.value, vault?.index?.baseProfile?.value ?? null);

  async function reveal(path: string) {
    setActionError(null);
    try {
      await vault!.revealPath(path);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <div className={styles.view}>
      <div className={styles.hero}>
        <div>
          <h1 id="output-view-title">Gespeicherte Prompt-Ausgaben</h1>
          <p className={styles.description}>
            Alle Stil- und Sprachvarianten werden automatisch im Vault gespeichert.
          </p>
        </div>
      </div>
      {!stored ? (
        <p role="status">Öffne oder vervollständige zuerst ein Asset im Wizard.</p>
      ) : (
        <section className={styles.outputPanel} aria-label="Vault-Ausgabe">
          <div className={styles.packageControls}>
            <label>
              Profil
              <select
                value={stored.value.id}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {profiles.map((entry) => (
                  <option key={entry.relativePath} value={entry.value.id}>
                    {entry.value.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stil
              <select
                value={activeStyle ?? ""}
                onChange={(event) => setStyle(event.target.value)}
                disabled={!files.length}
              >
                {stylesAvailable.map((value) => (
                  <option key={value} value={value}>
                    {value === "classic" ? "Classic" : "Dark"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sprache
              <select
                value={activeLanguage ?? ""}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={!files.length}
              >
                {languages.map((value) => (
                  <option key={value} value={value}>
                    {value === "de" ? "Deutsch" : value === "en" ? "Englisch" : value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ausgabeteil
              <select
                value={part}
                onChange={(event) => setPart(event.target.value as ReviewOutputId)}
              >
                {REVIEW_OUTPUT_IDS.map((value) => (
                  <option key={value} value={value}>
                    {REVIEW_OUTPUT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status">
            {error || failed
              ? "Ausgabefehler – kein aktueller Ausgabestand bestätigt."
              : pending
                ? "Ausgabe wird aktualisiert …"
                : !snapshot
                  ? "Gespeicherte Ausgabe wird geprüft …"
                  : fresh
                    ? "Gespeichert · Ausgaben aktuell"
                    : files.length
                      ? "Ausgaben veraltet · letzter gespeicherter Stand"
                      : "Noch keine Ausgaben · Entwurf vervollständigen"}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          {vault?.error ? <p role="alert">{vault.error}</p> : null}
          {actionError ? <p role="alert">{actionError}</p> : null}
          {file && contents !== undefined ? (
            <>
              <code className={styles.fileReference}>{file.relativePath}</code>
              <pre
                className={styles.outputContent}
                tabIndex={0}
                aria-label={REVIEW_OUTPUT_LABELS[part]}
              >
                {contents}
              </pre>
            </>
          ) : null}
          <div className={styles.outputActions}>
            <button
              type="button"
              disabled={!file}
              onClick={() => file && void reveal(file.relativePath)}
            >
              MD im Dateimanager öffnen
            </button>
            <button type="button" onClick={() => void reveal(stored.relativePath)}>
              Profil-JSON im Dateimanager öffnen
            </button>
            <button
              type="button"
              onClick={() =>
                void reveal(stored.relativePath.slice(0, stored.relativePath.lastIndexOf("/")))
              }
            >
              Profilordner im Dateimanager öffnen
            </button>
            <button
              type="button"
              disabled={pending || vault?.status === "loading"}
              onClick={() => void vault?.reload()}
            >
              Aktualisieren
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
