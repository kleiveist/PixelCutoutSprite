import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui";
import type { AssetCategory } from "../../domain/assets";
import { jsonValuesEqual } from "../../domain/json";
import {
  IsoDateTimeSchema,
  StableIdSchema,
  WizardDraftSchema,
  type ProfileLibrary,
  type StableId,
  type WizardDraft,
} from "../../schemas";
import type { V2StorageAdapter } from "../../services";
import { useProfileLibrary } from "../../store/profiles";
import {
  useWizardSession,
  type WizardDraftActivationMode,
  type WizardStartIntent,
} from "../../store/wizard";
import { getDashboardCategory } from "../dashboard/dashboardCatalog";
import {
  createBlankWizardDraft,
  createWizardDraftFromAssetProfile,
  validateWizardResume,
  type WizardResumeRecoveryIssue,
} from "./wizardLifecycle";
import { WizardEngine } from "./WizardEngine";
import styles from "./WizardView.module.css";

export type WizardStorage = Pick<V2StorageAdapter, "readDraft" | "writeDraft">;

type RecoveryReason =
  | "draftMissing"
  | "draftInvalid"
  | "storageUnavailable"
  | "profileLibraryUnavailable"
  | "profileMissing"
  | "profileConflict"
  | "invalidFactory"
  | "resumeRejected";

interface WizardRecoveryState {
  readonly status: "recovery";
  readonly reason: RecoveryReason;
  readonly title: string;
  readonly message: string;
  readonly details: readonly string[];
}

interface WizardReadyState {
  readonly status: "ready";
  readonly draft: WizardDraft;
  readonly baselineDraft: WizardDraft;
  readonly draftPersisted: boolean;
  readonly activationMode: WizardDraftActivationMode | null;
  readonly categoryHint: AssetCategory | null;
  readonly notices: readonly string[];
  readonly sessionLabel: string;
}

type WizardInitializationState = WizardRecoveryState | WizardReadyState;

export interface WizardViewProps {
  readonly createDraftId?: () => string;
  readonly now?: () => string;
  readonly storageAdapter: WizardStorage;
  readonly onOpenBaseProfile?: () => void;
}

let fallbackDraftSequence = 0;

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function createDefaultDraftId(): string {
  try {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return `draft_${globalThis.crypto.randomUUID()}`;
    }
  } catch {
    // The schema check below still protects the local fallback.
  }

  fallbackDraftSequence += 1;
  return `draft_${Date.now().toString(36)}_${fallbackDraftSequence.toString(36)}`;
}

function recovery(
  reason: RecoveryReason,
  title: string,
  message: string,
  details: readonly string[] = [],
): WizardRecoveryState {
  return { status: "recovery", reason, title, message, details };
}

function emptyProfileLibrary(): ProfileLibrary {
  return { baseProfiles: [], categoryProfiles: [], assetProfiles: [] };
}

function createDraftIdentity(
  createDraftId: () => string,
  now: () => string,
): Readonly<{ draftId: StableId; savedAt: string }> | null {
  try {
    const draftId = StableIdSchema.safeParse(createDraftId());
    const savedAt = IsoDateTimeSchema.safeParse(now());
    if (!draftId.success || !savedAt.success) return null;
    return { draftId: draftId.data, savedAt: savedAt.data };
  } catch {
    return null;
  }
}

function recoveryIssueText(issue: WizardResumeRecoveryIssue): string {
  switch (issue.code) {
    case "invalidDraft":
      return "Der gespeicherte Inhalt entspricht nicht dem V2-Draft-Schema.";
    case "draftIdMismatch":
      return "Der gespeicherte Entwurf gehört nicht zur angeforderten Draft-ID.";
    case "missingBaseProfile":
      return "Das referenzierte Basisprofil fehlt.";
    case "missingCategoryProfile":
      return "Das referenzierte Kategorieprofil fehlt.";
    case "categoryProfileMismatch":
      return "Das Kategorieprofil passt nicht mehr zur gespeicherten Asset-Klassifikation.";
    case "profileResolutionConflict":
      return issue.conflict.code === "lockedOverride"
        ? "Ein gespeicherter Override widerspricht einer aktuell gesperrten Basisprofil-Regel."
        : "Der gespeicherte Profil-Snapshot widerspricht der aktuellen Profilkette.";
  }
}

interface InitializeWizardInput {
  readonly activeDraft: WizardDraft | null;
  readonly baselineDraft: WizardDraft | null;
  readonly createDraftId: () => string;
  readonly draftPersisted: boolean;
  readonly libraryResult: ReturnType<typeof useProfileLibrary>["libraryResult"];
  readonly now: () => string;
  readonly startIntent: WizardStartIntent | null;
  readonly storageAdapter: WizardStorage;
}

function resumeDraft(
  input: InitializeWizardInput,
  requestedDraftId: string,
  draft: unknown,
  activationMode: WizardDraftActivationMode | null,
  sessionLabel: string,
): WizardInitializationState {
  const selectedDraft = typeof draft === "object" && draft !== null && "category" in draft;
  const selectedDraftNeedsProfileLibrary =
    selectedDraft &&
    (("baseProfileId" in draft && draft.baseProfileId !== undefined) ||
      ("categoryProfileId" in draft && draft.categoryProfileId !== undefined));
  if (selectedDraftNeedsProfileLibrary && input.libraryResult.status !== "valid") {
    return recovery(
      "profileLibraryUnavailable",
      "Profilreferenzen können nicht geprüft werden",
      "Der Entwurf bleibt unangetastet. Öffne ihn erst, wenn die lokale Profilbibliothek wieder gültig und verfügbar ist.",
    );
  }

  const result = validateWizardResume({
    requestedDraftId,
    draft,
    profileLibrary:
      input.libraryResult.status === "valid" ? input.libraryResult.value : emptyProfileLibrary(),
  });
  if (result.status === "recovery") {
    return recovery(
      "resumeRejected",
      "Entwurf kann nicht sicher fortgesetzt werden",
      "Die gespeicherten Daten wurden nicht verändert oder entfernt.",
      result.issues.map(recoveryIssueText),
    );
  }

  const parsedStoredBaseline = WizardDraftSchema.safeParse(draft);
  const baseline =
    input.baselineDraft ??
    (parsedStoredBaseline.success ? parsedStoredBaseline.data : result.draft);
  const draftPersisted = activationMode === "hydrate-persisted" ? true : input.draftPersisted;
  return {
    status: "ready",
    draft: result.draft,
    baselineDraft: baseline,
    draftPersisted,
    activationMode,
    categoryHint: input.startIntent?.kind === "newAsset" ? input.startIntent.category : null,
    notices: result.notices.map(
      () =>
        "Der gespeicherte Schritt war in dieser Wizard-Version nicht verfügbar. Der Entwurf wurde nur in der Sitzung auf einen sicheren Schritt gesetzt.",
    ),
    sessionLabel,
  };
}

function initializeWizard(input: InitializeWizardInput): WizardInitializationState {
  if (input.activeDraft) {
    return resumeDraft(input, input.activeDraft.draftId, input.activeDraft, null, "Aktive Sitzung");
  }

  if (input.startIntent?.kind === "newAsset") {
    const identity = createDraftIdentity(input.createDraftId, input.now);
    if (!identity) {
      return recovery(
        "invalidFactory",
        "Neuer Entwurf konnte nicht vorbereitet werden",
        "Draft-ID oder Zeitstempel sind ungültig. Es wurde nichts lokal gespeichert.",
      );
    }
    try {
      const draft = createBlankWizardDraft(identity);
      return {
        status: "ready",
        draft,
        baselineDraft: draft,
        draftPersisted: false,
        activationMode: "hydrate-transient",
        categoryHint: input.startIntent.category,
        notices: [],
        sessionLabel: input.startIntent.category
          ? `Neues Asset · ${getDashboardCategory(input.startIntent.category).label}`
          : "Neues Asset",
      };
    } catch {
      return recovery(
        "invalidFactory",
        "Neuer Entwurf konnte nicht vorbereitet werden",
        "Draft-ID oder Zeitstempel sind ungültig. Es wurde nichts lokal gespeichert.",
      );
    }
  }

  if (input.startIntent?.kind === "profile") {
    const profileIntent = input.startIntent;
    if (input.libraryResult.status !== "valid") {
      return recovery(
        "profileLibraryUnavailable",
        "Profilbibliothek ist nicht verfügbar",
        "Das angeforderte Profil wurde nicht verändert und es wurde kein Entwurf geschrieben.",
      );
    }
    const assetProfile = input.libraryResult.value.assetProfiles.find(
      (profile) => profile.id === profileIntent.assetProfileId,
    );
    if (!assetProfile) {
      return recovery(
        "profileMissing",
        "Profil wurde nicht gefunden",
        "Das angeforderte Assetprofil existiert nicht mehr. Es wurde kein Ersatzprofil angenommen.",
      );
    }

    const identity = createDraftIdentity(input.createDraftId, input.now);
    if (!identity) {
      return recovery(
        "invalidFactory",
        "Profilstart konnte nicht vorbereitet werden",
        "Draft-ID oder Zeitstempel sind ungültig. Es wurde nichts lokal gespeichert.",
      );
    }
    const baseProfile = input.libraryResult.value.baseProfiles.find(
      (profile) => profile.id === assetProfile.baseProfileId,
    );
    const categoryProfile = assetProfile.categoryProfileId
      ? input.libraryResult.value.categoryProfiles.find(
          (profile) => profile.id === assetProfile.categoryProfileId,
        )
      : undefined;
    const result = createWizardDraftFromAssetProfile({
      ...identity,
      assetProfile,
      ...(baseProfile ? { baseProfile } : {}),
      ...(categoryProfile ? { categoryProfile } : {}),
    });
    if (result.status === "conflict") {
      return recovery(
        "profileConflict",
        "Profilkette ist nicht produktionsbereit",
        "Locks oder Referenzen der Profilkette stehen im Konflikt. Das Profil und ein vorhandener Entwurf bleiben unverändert.",
        [
          `${result.conflicts.length} Profilregel${result.conflicts.length === 1 ? " konnte" : "n konnten"} nicht sicher aufgelöst werden.`,
        ],
      );
    }

    return {
      status: "ready",
      draft: result.draft,
      baselineDraft: result.draft,
      draftPersisted: false,
      activationMode: "hydrate-transient",
      categoryHint: assetProfile.category,
      notices:
        result.notices.length > 0
          ? [
              "Das Profil wurde vollständig übernommen; nicht blockierende Auflösungshinweise bleiben für die spätere Prüfung erhalten.",
            ]
          : [],
      sessionLabel: `Profil · ${assetProfile.name}`,
    };
  }

  const storedDraft = input.storageAdapter.readDraft();
  if (storedDraft.status === "unavailable") {
    return recovery(
      "storageUnavailable",
      "Lokaler Entwurfsspeicher ist nicht verfügbar",
      "Es wurde nichts überschrieben. Du kannst einen neuen, zunächst flüchtigen Entwurf beginnen.",
    );
  }
  if (storedDraft.status === "invalid") {
    return recovery(
      "draftInvalid",
      "Gespeicherter Entwurf ist beschädigt",
      "Die ungültigen Daten wurden nicht verändert oder gelöscht.",
    );
  }
  if (storedDraft.status === "empty") {
    if (input.startIntent?.kind === "resume") {
      return recovery(
        "draftMissing",
        "Entwurf wurde nicht gefunden",
        "Für die angeforderte Draft-ID ist kein lokaler Entwurf vorhanden.",
      );
    }
    const identity = createDraftIdentity(input.createDraftId, input.now);
    if (!identity) {
      return recovery(
        "invalidFactory",
        "Wizard konnte nicht vorbereitet werden",
        "Draft-ID oder Zeitstempel sind ungültig. Es wurde nichts lokal gespeichert.",
      );
    }
    try {
      const draft = createBlankWizardDraft(identity);
      return {
        status: "ready",
        draft,
        baselineDraft: draft,
        draftPersisted: false,
        activationMode: "hydrate-transient",
        categoryHint: null,
        notices: [],
        sessionLabel: "Neues Asset",
      };
    } catch {
      return recovery(
        "invalidFactory",
        "Wizard konnte nicht vorbereitet werden",
        "Draft-ID oder Zeitstempel sind ungültig. Es wurde nichts lokal gespeichert.",
      );
    }
  }

  const requestedDraftId =
    input.startIntent?.kind === "resume" ? input.startIntent.draftId : storedDraft.value.draftId;
  return resumeDraft(
    input,
    requestedDraftId,
    storedDraft.value,
    "hydrate-persisted",
    "Fortgesetzter Entwurf",
  );
}

export function WizardView({
  createDraftId = createDefaultDraftId,
  now = currentIsoTimestamp,
  storageAdapter,
  onOpenBaseProfile,
}: WizardViewProps) {
  const {
    activeDraft,
    activateDraft,
    baselineDraft,
    captureRawCoreFormValues,
    draftDirty,
    draftPersisted,
    rawCoreFormValues,
    requestNewAsset,
    startIntent,
  } = useWizardSession();
  const { libraryResult } = useProfileLibrary();
  const [initialization] = useState(() =>
    initializeWizard({
      activeDraft,
      baselineDraft,
      createDraftId,
      draftPersisted,
      libraryResult,
      now,
      startIntent,
      storageAdapter,
    }),
  );

  useEffect(() => {
    if (initialization.status === "ready" && initialization.activationMode !== null) {
      if (!jsonValuesEqual(initialization.draft, initialization.baselineDraft)) {
        activateDraft(
          initialization.baselineDraft,
          initialization.draftPersisted ? "hydrate-persisted" : "hydrate-transient",
        );
        activateDraft(initialization.draft, "edit");
        return;
      }
      activateDraft(initialization.draft, initialization.activationMode);
    }
  }, [activateDraft, initialization]);

  const activateEditedDraft = useCallback(
    (draft: WizardDraft) => activateDraft(draft, "edit"),
    [activateDraft],
  );
  const activateSavedDraft = useCallback(
    (draft: WizardDraft) => activateDraft(draft, "saved"),
    [activateDraft],
  );

  return (
    <div className={styles.wizard}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Geführter Abfragekatalog</p>
          <h1 id="wizard-view-title">Neue Assets geführt aufsetzen.</h1>
          <p className={styles.heroDescription}>
            Ein wiederaufnehmbarer Arbeitsfluss führt von der Projektbasis zur passenden
            Asset-Logik. Gespeichert wird lokal und nur nach einer gültigen Änderung oder bewussten
            Navigation.
          </p>
        </div>
        {initialization.status === "ready" ? (
          <div className={styles.sessionBadge}>
            <Badge tone="accent">Wizard-Sitzung</Badge>
            <strong>{initialization.sessionLabel}</strong>
            <span>
              {(activeDraft ? draftPersisted : initialization.draftPersisted)
                ? "Lokal gespeichert"
                : "Noch nicht lokal gespeichert"}
            </span>
          </div>
        ) : null}
      </header>

      {initialization.status === "recovery" ? (
        <section
          className={styles.recovery}
          aria-labelledby="wizard-recovery-title"
          data-recovery-reason={initialization.reason}
        >
          <p className={styles.eyebrow}>Sichere Wiederherstellung</p>
          <h2 id="wizard-recovery-title">{initialization.title}</h2>
          <p>{initialization.message}</p>
          {initialization.details.length > 0 ? (
            <ul className={styles.recoveryDetails}>
              {initialization.details.map((detail, index) => (
                <li key={`${index}-${detail}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
          <button
            className={styles.recoveryButton}
            type="button"
            onClick={() => requestNewAsset(null)}
          >
            Neuen flüchtigen Entwurf beginnen
          </button>
        </section>
      ) : (
        <>
          {initialization.notices.map((notice) => (
            <div key={notice} className={styles.notice} role="note">
              <span aria-hidden="true">i</span>
              <div>
                <strong>Entwurf sicher eingeordnet</strong>
                <span>{notice}</span>
              </div>
            </div>
          ))}
          <WizardEngine
            baselineDraft={initialization.baselineDraft}
            categoryHint={initialization.categoryHint}
            draft={initialization.draft}
            draftPersisted={initialization.draftPersisted}
            initialDirty={
              draftDirty || !jsonValuesEqual(initialization.draft, initialization.baselineDraft)
            }
            {...(rawCoreFormValues ? { initialFormValues: rawCoreFormValues } : {})}
            library={libraryResult.status === "valid" ? libraryResult.value : null}
            now={now}
            storageAdapter={storageAdapter}
            onDraftEdited={activateEditedDraft}
            onDraftSaved={activateSavedDraft}
            {...(onOpenBaseProfile ? { onOpenBaseProfile } : {})}
            onRawCoreFormValuesChanged={captureRawCoreFormValues}
          />
        </>
      )}
    </div>
  );
}
