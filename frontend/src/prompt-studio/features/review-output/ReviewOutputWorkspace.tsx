import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Surface } from "../../components/ui";
import {
  PROMPT_HANDOFF_SCHEMA_VERSION,
  type PromptHandoff,
  type PromptHandoffAvailability,
} from "../../domain/handoff";
import type { PromptLanguage, PromptStyleVariant } from "../../domain/prompt-engine";
import { parseWizardDraft } from "../../schemas";
import type { OutputWorkspaceAdapter, V2StorageAdapter } from "../../services";
import { useNavigation } from "../../store/navigation";
import { useProfileLibrary } from "../../store/profiles";
import { useSettings } from "../../store/settings";
import { useWizardSession } from "../../store/wizard";
import { APP_VIEW_DEFINITIONS } from "../../app/appViewConfig";
import {
  REVIEW_OUTPUT_IDS,
  REVIEW_OUTPUT_LABELS,
  createProfileJsonFile,
  createPromptMarkdownFile,
  createReviewBundleId,
  formatResolutionNotice,
  prepareReviewOutput,
  promptPackageText,
  type ReviewOutputId,
  type ReviewOutputPreparation,
} from "./reviewOutputData";
import { ProfileConversionWorkflow } from "./ProfileConversionWorkflow";
import styles from "./ReviewOutputWorkspace.module.css";

export type ReviewOutputDraftStorage = Pick<V2StorageAdapter, "readDraft" | "writeDraft">;

export interface ReviewOutputWorkspaceProps {
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly storageAdapter: ReviewOutputDraftStorage;
  readonly now?: () => string;
  readonly handoffAvailability?: PromptHandoffAvailability;
  readonly onHandoff?: (handoff: PromptHandoff) => Promise<void> | void;
}

type ActionStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "working"; message: string }>
  | Readonly<{ kind: "success"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function WorkspaceState({
  preparation,
  onOpenWizard,
}: Readonly<{
  preparation: Extract<ReviewOutputPreparation, { status: "missingDraft" | "incompleteDraft" }>;
  onOpenWizard: () => void;
}>) {
  if (preparation.status === "missingDraft") {
    return (
      <Surface as="section" className={styles.statePanel} tone="soft">
        <strong>Noch kein Asset für die Ausgabe</strong>
        <p>
          Starte oder öffne zuerst einen Wizard-Entwurf. Danach werden hier Zusammenfassung und
          Prompt-Paket aufgebaut.
        </p>
        <button type="button" onClick={onOpenWizard}>
          Wizard öffnen
        </button>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={styles.statePanel} tone="soft" role="alert">
      <strong>Entwurf noch nicht ausgabebereit</strong>
      <ul>
        {preparation.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <button type="button" onClick={onOpenWizard}>
        Im Wizard vervollständigen
      </button>
    </Surface>
  );
}

function LibraryState({ status }: Readonly<{ status: "invalid" | "unavailable" }>) {
  return (
    <Surface as="section" className={styles.statePanel} tone="soft" role="alert">
      <strong>
        {status === "invalid"
          ? "Profilbibliothek ist ungültig"
          : "Profilspeicher ist nicht verfügbar"}
      </strong>
      <p>
        {status === "invalid"
          ? "Die gespeicherten Daten bleiben unangetastet. Ausgabe und Export sind bis zu einer gültigen Profilkette gesperrt."
          : "Ohne die lokale Profilbibliothek kann der Entwurf nicht sicher aufgelöst werden."}
      </p>
    </Surface>
  );
}

function DraftStorageState({ status }: Readonly<{ status: "invalid" | "unavailable" }>) {
  return (
    <Surface as="section" className={styles.statePanel} tone="soft" role="alert">
      <strong>
        {status === "invalid"
          ? "Gespeicherter Entwurf ist ungültig"
          : "Gespeicherter Entwurf ist nicht erreichbar"}
      </strong>
      <p>
        {status === "invalid"
          ? "Die Entwurfsdaten bleiben unangetastet. Öffne den Wizard, um kontrolliert einen neuen gültigen Stand zu erstellen."
          : "Der Ausgabebereich kann ohne aktive Sitzung nicht auf den lokalen Entwurf zugreifen."}
      </p>
    </Surface>
  );
}

function actionErrorMessage(action: "copy" | "markdown" | "json"): string {
  switch (action) {
    case "copy":
      return "Die aktive Ausgabe konnte nicht in die Zwischenablage kopiert werden.";
    case "markdown":
      return "Die Markdown-Datei konnte nicht bereitgestellt werden.";
    case "json":
      return "Das validierte Profilpaket konnte nicht als JSON exportiert werden.";
  }
}

export function ReviewOutputWorkspace({
  outputAdapter,
  storageAdapter,
  now = currentIsoTimestamp,
  handoffAvailability = {
    available: false,
    reason: "Öffne einen schreibbaren Cutout-Arbeitsbereich für die Übergabe.",
  },
  onHandoff,
}: ReviewOutputWorkspaceProps) {
  const definition = APP_VIEW_DEFINITIONS.output;
  const { navigate } = useNavigation();
  const { settings } = useSettings();
  const { libraryResult, saveAssetProfile } = useProfileLibrary();
  const { activeDraft, activateDraft, draftDirty } = useWizardSession();
  const [selectedLanguage, setSelectedLanguage] = useState<PromptLanguage>(settings.locale);
  const [selectedStyle, setSelectedStyle] = useState<PromptStyleVariant>("classic");
  const [selectedOutput, setSelectedOutput] = useState<ReviewOutputId>("combined");
  const [actionStatus, setActionStatus] = useState<ActionStatus>({
    kind: "idle",
  });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const [focusAfterConversion, setFocusAfterConversion] = useState(false);
  const [storedDraftResult] = useState(() => storageAdapter.readDraft());

  const library =
    libraryResult.status === "valid"
      ? libraryResult.value
      : libraryResult.status === "empty"
        ? { baseProfiles: [], categoryProfiles: [], assetProfiles: [] }
        : null;
  const preparation = useMemo(
    () =>
      library === null
        ? null
        : prepareReviewOutput(
            activeDraft ?? (storedDraftResult.status === "valid" ? storedDraftResult.value : null),
            library,
            ["de", "en"],
          ),
    [activeDraft, library, storedDraftResult],
  );
  const ready = preparation?.status === "ready" ? preparation : null;
  const availableLanguages = ready
    ? [...new Set(ready.packages.map((promptPackage) => promptPackage.language))]
    : [];
  const availableStyles = ready
    ? [...new Set(ready.packages.map((promptPackage) => promptPackage.styleProfile))]
    : [];
  const activePackage = ready
    ? (ready.packages.find(
        (promptPackage) =>
          promptPackage.language === selectedLanguage &&
          promptPackage.styleProfile === selectedStyle,
      ) ??
      ready.packages.find((promptPackage) => promptPackage.language === selectedLanguage) ??
      ready.packages[0])
    : undefined;

  useEffect(() => {
    if (!focusAfterConversion || ready === null) return;
    summaryHeadingRef.current?.focus();
    setFocusAfterConversion(false);
  }, [focusAfterConversion, ready]);

  const setStatusError = (action: "copy" | "markdown" | "json") => {
    setActionStatus({ kind: "error", message: actionErrorMessage(action) });
  };

  const copyActiveOutput = async () => {
    if (!ready || !activePackage) return;
    const text = promptPackageText(activePackage, selectedOutput);
    setActionStatus({ kind: "working", message: "Ausgabe wird kopiert …" });
    try {
      await outputAdapter.copyText(text);
      setActionStatus({
        kind: "success",
        message: `${REVIEW_OUTPUT_LABELS[selectedOutput]} wurde kopiert.`,
      });
    } catch {
      setStatusError("copy");
    }
  };

  const exportActiveOutput = async () => {
    if (!ready || !activePackage) return;
    try {
      await outputAdapter.downloadTextFile(
        createPromptMarkdownFile(ready.profile.name, activePackage, selectedOutput),
      );
      setActionStatus({
        kind: "success",
        message: `${REVIEW_OUTPUT_LABELS[selectedOutput]} wurde als Markdown bereitgestellt.`,
      });
    } catch {
      setStatusError("markdown");
    }
  };

  const saveProfile = () => {
    if (!ready) return;
    const result = saveAssetProfile(ready.definition);
    if (result.status !== "ok") {
      setActionStatus({ kind: "error", message: result.message });
      return;
    }

    try {
      const linkedDraft = parseWizardDraft({
        ...ready.draft,
        sourceAssetProfileId: result.profile.id,
        savedAt: result.profile.updatedAt,
      });
      const draftResult = storageAdapter.writeDraft(linkedDraft);
      activateDraft(linkedDraft, draftResult.status === "ok" ? "saved" : "edit");
      setActionStatus({
        kind: "success",
        message:
          draftResult.status === "ok"
            ? `Assetprofil „${result.profile.name}“ wurde gespeichert.`
            : `Assetprofil „${result.profile.name}“ wurde gespeichert; die Entwurfsverknüpfung gilt nur für diese Sitzung.`,
      });
    } catch {
      setActionStatus({
        kind: "success",
        message: `Assetprofil „${result.profile.name}“ wurde gespeichert.`,
      });
    }
  };

  const exportProfileJson = async () => {
    if (!ready || library === null) return;
    try {
      const exportedAt = now();
      await outputAdapter.downloadTextFile(
        createProfileJsonFile({
          draft: ready.draft,
          definition: ready.definition,
          library,
          exportedAt,
          bundleId: createReviewBundleId(ready.draft.draftId, exportedAt),
        }),
      );
      setActionStatus({
        kind: "success",
        message: "Das validierte Profilpaket wurde als JSON bereitgestellt.",
      });
    } catch {
      setStatusError("json");
    }
  };

  const handoffToCutout = async () => {
    if (!ready || !activePackage || !handoffAvailability.available || !onHandoff) {
      return;
    }
    setActionStatus({
      kind: "working",
      message: "Prompt wird an PixelCutoutSprite übergeben …",
    });
    const profileReferences: string[] = [ready.profile.baseProfileId];
    if (ready.profile.categoryProfileId !== undefined) {
      profileReferences.push(ready.profile.categoryProfileId);
    }
    profileReferences.push(ready.definition.sourceAssetProfileId ?? ready.profile.assetProfileId);
    try {
      await onHandoff({
        schemaVersion: PROMPT_HANDOFF_SCHEMA_VERSION,
        category: ready.profile.categoryData.category,
        prompt: activePackage.main,
        negativePrompt: activePackage.negative,
        technicalPrompt: activePackage.technical,
        profileReferences,
        createdAt: now(),
      });
      setActionStatus({
        kind: "success",
        message: "Prompt wurde dem aktuellen Cutout-Arbeitsbereich übergeben.",
      });
    } catch (error) {
      setActionStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Der Prompt konnte nicht an PixelCutoutSprite übergeben werden.",
      });
    }
  };

  const handleTabKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % REVIEW_OUTPUT_IDS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + REVIEW_OUTPUT_IDS.length) % REVIEW_OUTPUT_IDS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = REVIEW_OUTPUT_IDS.length - 1;
    }
    if (nextIndex === null) return;

    event.preventDefault();
    const nextOutput = REVIEW_OUTPUT_IDS[nextIndex];
    if (nextOutput === undefined) return;
    setSelectedOutput(nextOutput);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={styles.view}>
      <header className={styles.hero}>
        <div>
          <Badge tone="accent">Produktionsarbeitsfläche</Badge>
          <p className={styles.eyebrow}>{definition.eyebrow}</p>
          <h1 id="output-view-title">{definition.title}</h1>
          <p className={styles.description}>{definition.description}</p>
        </div>
      </header>

      {libraryResult.status === "invalid" || libraryResult.status === "unavailable" ? (
        <LibraryState status={libraryResult.status} />
      ) : activeDraft === null &&
        (storedDraftResult.status === "invalid" || storedDraftResult.status === "unavailable") ? (
        <DraftStorageState status={storedDraftResult.status} />
      ) : preparation?.status === "conflict" && library !== null ? (
        <ProfileConversionWorkflow
          preparation={preparation}
          library={library}
          storageAdapter={storageAdapter}
          now={now}
          onCancel={() => navigate("dashboard")}
          onConverted={(convertedDraft, message) => {
            activateDraft(convertedDraft, "saved");
            setActionStatus({ kind: "success", message });
            setFocusAfterConversion(true);
          }}
        />
      ) : preparation?.status === "missingDraft" || preparation?.status === "incompleteDraft" ? (
        <WorkspaceState preparation={preparation} onOpenWizard={() => navigate("wizard")} />
      ) : ready && activePackage ? (
        <>
          {draftDirty || ready.draft.validation.warnings.length > 0 || ready.notices.length > 0 ? (
            <Surface
              as="section"
              className={styles.warningPanel}
              tone="soft"
              role="status"
              aria-labelledby="review-warning-title"
            >
              <h2 id="review-warning-title">Hinweise vor der Ausgabe</h2>
              <ul>
                {draftDirty ? (
                  <li>
                    Es gibt ungesicherte Wizard-Eingaben. Die Ausgabe verwendet den letzten
                    vollständig validierten Entwurfsstand.
                  </li>
                ) : null}
                {ready.draft.validation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {ready.notices.map((notice, index) => (
                  <li key={`${notice.code}-${index}`}>{formatResolutionNotice(notice)}</li>
                ))}
              </ul>
            </Surface>
          ) : null}

          <div className={styles.workspace}>
            <Surface
              as="section"
              className={styles.summaryPanel}
              tone="raised"
              aria-labelledby="review-summary-title"
            >
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionIndex}>01 · Zusammenfassung</span>
                  <h2 ref={summaryHeadingRef} id="review-summary-title" tabIndex={-1}>
                    Produktionszusammenfassung
                  </h2>
                </div>
                <Badge tone="success">Konfliktfrei</Badge>
              </div>

              <dl className={styles.summaryGrid}>
                {ready.summary.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      <span>{row.value}</span>
                      {row.meta ? <small>{row.meta}</small> : null}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className={styles.capabilities}>
                <h3>Aktive Fähigkeiten</h3>
                <ul>
                  {ready.summary.capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.profileActions}>
                <button type="button" onClick={saveProfile}>
                  Profil speichern
                </button>
                <button type="button" onClick={() => void exportProfileJson()}>
                  JSON exportieren
                </button>
                <button
                  type="button"
                  disabled={!handoffAvailability.available || !onHandoff}
                  title={handoffAvailability.available ? undefined : handoffAvailability.reason}
                  onClick={() => void handoffToCutout()}
                >
                  In PixelCutoutSprite übernehmen
                </button>
              </div>
            </Surface>

            <Surface
              as="section"
              className={styles.outputPanel}
              tone="raised"
              aria-labelledby="prompt-output-title"
            >
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionIndex}>02 · Output</span>
                  <h2 id="prompt-output-title" tabIndex={-1}>
                    Prompt-Paket
                  </h2>
                </div>
                <Badge tone="accent">{activePackage.styleProfileLabel}</Badge>
              </div>

              <div className={styles.packageControls}>
                <label>
                  <span>Sprache</span>
                  <select
                    value={activePackage.language}
                    onChange={(event) =>
                      setSelectedLanguage(event.currentTarget.value as PromptLanguage)
                    }
                  >
                    {availableLanguages.map((language) => (
                      <option key={language} value={language}>
                        {language === "de" ? "Deutsch" : "English"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Stilvariante</span>
                  <select
                    value={activePackage.styleProfile}
                    onChange={(event) =>
                      setSelectedStyle(event.currentTarget.value as PromptStyleVariant)
                    }
                  >
                    {availableStyles.map((styleProfile) => {
                      const optionPackage = ready.packages.find(
                        (promptPackage) =>
                          promptPackage.styleProfile === styleProfile &&
                          promptPackage.language === activePackage.language,
                      );
                      return (
                        <option key={styleProfile} value={styleProfile}>
                          {optionPackage?.styleProfileLabel ?? styleProfile}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              <div className={styles.outputTabs} role="tablist" aria-label="Prompt-Ausgabeart">
                {REVIEW_OUTPUT_IDS.map((outputId, index) => (
                  <button
                    key={outputId}
                    ref={(element) => {
                      tabRefs.current[index] = element;
                    }}
                    id={`prompt-tab-${outputId}`}
                    type="button"
                    role="tab"
                    aria-controls={`prompt-panel-${outputId}`}
                    aria-selected={selectedOutput === outputId}
                    tabIndex={selectedOutput === outputId ? 0 : -1}
                    onClick={() => setSelectedOutput(outputId)}
                    onKeyDown={(event) => handleTabKeys(event, index)}
                  >
                    {REVIEW_OUTPUT_LABELS[outputId]}
                  </button>
                ))}
              </div>

              <div
                id={`prompt-panel-${selectedOutput}`}
                className={styles.outputContent}
                role="tabpanel"
                aria-labelledby={`prompt-tab-${selectedOutput}`}
                tabIndex={0}
              >
                <div className={styles.outputHeading}>
                  <h3>{REVIEW_OUTPUT_LABELS[selectedOutput]}</h3>
                  <span>
                    {activePackage.languageLabel} · {activePackage.styleProfileLabel}
                  </span>
                </div>
                <pre>{promptPackageText(activePackage, selectedOutput)}</pre>
              </div>

              <div className={styles.outputActions}>
                <button type="button" onClick={() => void copyActiveOutput()}>
                  Kopieren
                </button>
                <button type="button" onClick={() => void exportActiveOutput()}>
                  MD exportieren
                </button>
              </div>
            </Surface>
          </div>

          {actionStatus.kind !== "idle" ? (
            <p
              className={actionStatus.kind === "error" ? styles.actionError : styles.actionStatus}
              role={actionStatus.kind === "error" ? "alert" : "status"}
            >
              {actionStatus.message}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
