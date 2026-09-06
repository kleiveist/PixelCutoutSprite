import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge, Surface } from "../../components/ui";
import { ProfileNameSchema, type ProfileLibrary, type WizardDraft } from "../../schemas";
import type { V2StorageAdapter } from "../../services";
import { useProfileLibrary } from "../../store/profiles";
import {
  PROFILE_CONVERSION_FIELD_LABELS,
  compatibleBaseProfilePlans,
  createConversionBaseDefinition,
  createConversionDefinitionPreview,
  createProfileConversionPlan,
  defaultConversionBaseName,
  formatProfileConversionValue,
  prepareProfileConversion,
  type ProfileConversionPlan,
  type ReadyProfileConversion,
} from "./profileConversionData";
import {
  formatResolutionConflict,
  formatResolutionNotice,
  type ReviewOutputPreparation,
} from "./reviewOutputData";
import styles from "./ProfileConversionWorkflow.module.css";

type ConflictPreparation = Extract<ReviewOutputPreparation, { status: "conflict" }>;
type ReadyPlan = Extract<ProfileConversionPlan, { status: "ready" }>;
type ConversionMode = "choices" | "duplicate" | "new" | "existing";
type ConversionChoice = Exclude<ConversionMode, "choices">;
type ConversionDraftStorage = Pick<V2StorageAdapter, "writeDraft">;

const ConversionNameSchema = z.strictObject({ name: ProfileNameSchema });
type ConversionNameValues = z.infer<typeof ConversionNameSchema>;

export interface ProfileConversionWorkflowProps {
  readonly preparation: ConflictPreparation;
  readonly library: ProfileLibrary;
  readonly storageAdapter: ConversionDraftStorage;
  readonly now: () => string;
  readonly onCancel: () => void;
  readonly onConverted: (draft: WizardDraft, message: string) => void;
}

function ConversionImpact({
  preparation,
  plan,
}: Readonly<{
  preparation: ReadyProfileConversion;
  plan: ReadyPlan;
}>) {
  const overrideDescription =
    plan.overrideFields.length === 0
      ? "Keine — exakte technische Übereinstimmung"
      : [
          `${plan.overrideFields.length} kontrollierte ${
            plan.overrideFields.length === 1 ? "Abweichung" : "Abweichungen"
          }`,
          plan.overrideFields.map((field) => PROFILE_CONVERSION_FIELD_LABELS[field]).join(", "),
        ].join(": ");

  return (
    <section className={styles.impact} aria-labelledby="profile-conversion-impact-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Vorschau vor dem Speichern</span>
          <h3 id="profile-conversion-impact-title">Folgen der Konvertierung</h3>
        </div>
        <Badge tone={plan.compatibilityChanged ? "accent" : "success"}>
          {plan.compatibilityChanged ? "Neue technische Gruppe" : "Gruppe bleibt gleich"}
        </Badge>
      </div>

      <dl className={styles.impactGrid}>
        <div>
          <dt>Ziel-Basisprofil</dt>
          <dd>{plan.targetBase.name}</dd>
        </div>
        <div>
          <dt>Lokale technische Abweichungen</dt>
          <dd>{overrideDescription}</dd>
        </div>
      </dl>

      <div className={styles.changeBlock}>
        <strong>Gewünschte Änderung</strong>
        <ul>
          {preparation.changes.map((change) => (
            <li key={change.field}>
              <span>{change.label}</span>
              <span>
                {formatProfileConversionValue(change.field, change.previousValue)}
                {" → "}
                {formatProfileConversionValue(change.field, change.desiredValue)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className={styles.safetyList}>
        <li>
          Das ursprüngliche Basisprofil „{preparation.sourceBase.name}“ und alle bestehenden Kinder
          bleiben unverändert.
        </li>
        {preparation.detachesCategoryProfile ? (
          <li>
            Geerbte Kategorieantworten werden in den neuen Entwurf übernommen; die alte
            Kategorieprofil-Verknüpfung wird gelöst.
          </li>
        ) : null}
        {preparation.detachesSourceAssetProfile ? (
          <li>
            Das gespeicherte Quell-Asset bleibt unverändert; der konvertierte Entwurf wird zu einem
            eigenständigen Asset.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function unavailableMessage(
  reason: Extract<ReturnType<typeof prepareProfileConversion>, { status: "unavailable" }>["reason"],
): string {
  switch (reason) {
    case "incompleteDraft":
      return "Der Entwurf enthält noch keine vollständige Profilwahl.";
    case "missingBaseProfile":
      return "Das referenzierte Basisprofil fehlt.";
    case "missingPartialProfile":
      return "Aus diesem Konflikt konnte kein sicherer technischer Ausgangsstand bestimmt werden.";
    case "unsupportedConflict":
      return "Diese Referenz- oder Klassifikationsabweichung muss im Wizard geprüft werden.";
    case "invalidDesiredValues":
      return "Die gewünschte technische Konfiguration ist nicht als gültiges V2-Profil darstellbar.";
  }
}

export function ProfileConversionWorkflow({
  preparation,
  library,
  storageAdapter,
  now,
  onCancel,
  onConverted,
}: ProfileConversionWorkflowProps) {
  const { createBaseProfile, duplicateBaseProfile } = useProfileLibrary();
  const [mode, setMode] = useState<ConversionMode>("choices");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const choiceButtonRefs = useRef<Partial<Record<ConversionChoice, HTMLButtonElement | null>>>({});
  const existingHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousModeRef = useRef<ConversionMode>(mode);
  const conversion = useMemo(
    () =>
      prepareProfileConversion({
        draft: preparation.draft,
        library,
        conflicts: preparation.conflicts,
        ...(preparation.partialProfile === undefined
          ? {}
          : { partialProfile: preparation.partialProfile }),
      }),
    [library, preparation],
  );
  const readyConversion = conversion.status === "ready" ? conversion : null;
  const existingNames = useMemo(
    () => library.baseProfiles.map((profile) => profile.name),
    [library.baseProfiles],
  );
  const compatiblePlans = useMemo(
    () =>
      readyConversion === null
        ? []
        : compatibleBaseProfilePlans(readyConversion, library.baseProfiles),
    [library.baseProfiles, readyConversion],
  );
  const selectedPlan =
    compatiblePlans.find((plan) => plan.targetBase.id === selectedTargetId) ?? null;

  const form = useForm<ConversionNameValues>({
    resolver: zodResolver(ConversionNameSchema),
    mode: "onChange",
    defaultValues: { name: "" },
  });

  useEffect(() => {
    const previousMode = previousModeRef.current;
    if (previousMode === mode) return;
    previousModeRef.current = mode;

    if (mode === "duplicate" || mode === "new") {
      form.setFocus("name", { shouldSelect: true });
      return;
    }
    if (mode === "existing") {
      existingHeadingRef.current?.focus();
      return;
    }
    if (previousMode !== "choices") {
      choiceButtonRefs.current[previousMode]?.focus();
    }
  }, [form, mode]);
  const watchedName = useWatch({ control: form.control, name: "name" });
  const familyKind = mode === "duplicate" || mode === "new" ? mode : null;
  const familyPreview = useMemo(() => {
    if (readyConversion === null || familyKind === null) return null;
    const parsedName = ProfileNameSchema.safeParse(watchedName);
    if (!parsedName.success) return null;
    try {
      const definition = createConversionBaseDefinition(
        readyConversion,
        familyKind,
        parsedName.data,
      );
      return {
        definition,
        plan: createConversionDefinitionPreview(readyConversion, definition),
      };
    } catch {
      return null;
    }
  }, [familyKind, readyConversion, watchedName]);

  const chooseMode = (nextMode: ConversionChoice) => {
    if (readyConversion === null) return;
    setLocalError(null);
    setSelectedTargetId("");
    setMode(nextMode);
    if (nextMode === "duplicate" || nextMode === "new") {
      form.reset({
        name: defaultConversionBaseName(readyConversion, nextMode, existingNames),
      });
    }
  };

  const returnToChoices = () => {
    setMode("choices");
    setSelectedTargetId("");
    setLocalError(null);
    form.reset({ name: "" });
  };

  const draftWriteError = (createdFamilyName?: string): string =>
    createdFamilyName
      ? `Das Basisprofil „${createdFamilyName}“ wurde angelegt, aber der konvertierte Entwurf konnte nicht gespeichert werden. Die neue Familie bleibt erhalten.`
      : "Der konvertierte Entwurf konnte nicht gespeichert werden. Die bisherige Konfiguration bleibt aktiv.";

  const persistPlan = (
    plan: ReadyPlan,
    successMessage: string,
    createdFamilyName?: string,
  ): void => {
    let result: ReturnType<ConversionDraftStorage["writeDraft"]>;
    try {
      result = storageAdapter.writeDraft(plan.draft);
    } catch {
      setLocalError(draftWriteError(createdFamilyName));
      return;
    }
    if (result.status !== "ok") {
      setLocalError(draftWriteError(createdFamilyName));
      return;
    }

    onConverted(plan.draft, successMessage);
  };

  const convertWithExisting = () => {
    if (readyConversion === null || selectedPlan === null) return;
    setLocalError(null);
    let savedAt: string;
    try {
      savedAt = now();
    } catch {
      setLocalError("Der Konvertierungszeitpunkt konnte nicht bestimmt werden.");
      return;
    }
    let plan: ProfileConversionPlan;
    try {
      plan = createProfileConversionPlan(readyConversion, selectedPlan.targetBase, savedAt);
    } catch {
      setLocalError(
        "Der konvertierte Entwurf konnte nicht sicher validiert werden. Die bisherige Konfiguration bleibt aktiv.",
      );
      return;
    }
    if (plan.status !== "ready") {
      setLocalError(
        "Das gewählte Basisprofil ist nicht mehr kompatibel. Bitte wähle die Produktionsfamilie erneut.",
      );
      return;
    }
    persistPlan(
      plan,
      `Der Entwurf verwendet jetzt das kompatible Basisprofil „${plan.targetBase.name}“. Die technische Änderung wurde kontrolliert übernommen.`,
    );
  };

  const createFamilyAndConvert = form.handleSubmit((values) => {
    if (readyConversion === null || familyKind === null) return;
    setLocalError(null);
    const definition = createConversionBaseDefinition(readyConversion, familyKind, values.name);
    const result =
      familyKind === "duplicate"
        ? duplicateBaseProfile(readyConversion.sourceBase.id, definition)
        : createBaseProfile(definition);
    if (result.status !== "ok") {
      setLocalError(result.message);
      return;
    }

    const plan = createProfileConversionPlan(
      readyConversion,
      result.profile,
      result.profile.updatedAt,
    );
    if (plan.status !== "ready") {
      setLocalError(
        `Das Basisprofil „${result.profile.name}“ wurde angelegt, aber der Entwurf ist wider Erwarten nicht konfliktfrei. Die neue Familie bleibt erhalten.`,
      );
      return;
    }
    persistPlan(
      plan,
      `${familyKind === "duplicate" ? "Das Basisprofil wurde dupliziert" : "Ein neues Basisprofil wurde angelegt"} und der Entwurf kontrolliert in „${result.profile.name}“ konvertiert.`,
      result.profile.name,
    );
  });

  if (conversion.status !== "ready") {
    return (
      <Surface
        as="section"
        className={styles.conflictPanel}
        tone="soft"
        role="alert"
        aria-labelledby="profile-conflict-title"
      >
        <span className={styles.eyebrow}>Konfliktprüfung</span>
        <h2 id="profile-conflict-title">Ausgabe sicher angehalten</h2>
        <p>{unavailableMessage(conversion.reason)}</p>
        <ul>
          {preparation.conflicts.map((conflict, index) => (
            <li key={`${conflict.code}-${index}`}>{formatResolutionConflict(conflict)}</li>
          ))}
        </ul>
        <button type="button" onClick={onCancel}>
          Zurück zum Dashboard
        </button>
      </Surface>
    );
  }

  const activeConversion = conversion;

  return (
    <Surface
      as="section"
      className={styles.workflow}
      tone="raised"
      aria-labelledby="profile-conflict-title"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Konfliktprüfung</span>
          <h2 id="profile-conflict-title">Technische Änderung kontrolliert konvertieren</h2>
        </div>
        <Badge tone="neutral">Ausgabe angehalten</Badge>
      </header>

      <div className={styles.conflictNotice} role="alert">
        <p className={styles.intro}>
          Mindestens ein gewünschter Wert ist im aktuellen Basisprofil gesperrt. Es wurde nichts
          verändert und kein Teilprompt erzeugt.
        </p>
        <ul className={styles.conflictList}>
          {preparation.conflicts.map((conflict, index) => (
            <li key={`${conflict.code}-${index}`}>{formatResolutionConflict(conflict)}</li>
          ))}
        </ul>
        {preparation.notices.length > 0 ? (
          <ul className={styles.noticeList}>
            {preparation.notices.map((notice, index) => (
              <li key={`${notice.code}-${index}`}>{formatResolutionNotice(notice)}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {mode === "choices" ? (
        <div className={styles.choiceGrid} role="group" aria-label="Konvertierungsoptionen">
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button
            ref={(element) => {
              choiceButtonRefs.current.duplicate = element;
            }}
            type="button"
            onClick={() => chooseMode("duplicate")}
          >
            Basisprofil duplizieren
          </button>
          <button
            ref={(element) => {
              choiceButtonRefs.current.new = element;
            }}
            type="button"
            onClick={() => chooseMode("new")}
          >
            Neues Basisprofil
          </button>
          <button
            ref={(element) => {
              choiceButtonRefs.current.existing = element;
            }}
            type="button"
            onClick={() => chooseMode("existing")}
          >
            Kompatibles Profil wählen
          </button>
        </div>
      ) : null}

      {familyKind !== null ? (
        <form className={styles.familyForm} onSubmit={createFamilyAndConvert}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>
                {familyKind === "duplicate" ? "Eigenständige Kopie" : "Neue Produktionsfamilie"}
              </span>
              <h3>
                {familyKind === "duplicate"
                  ? `„${activeConversion.sourceBase.name}“ duplizieren`
                  : "Kanonisches Basisprofil anlegen"}
              </h3>
            </div>
          </div>
          <label className={styles.nameField}>
            <span>Name der Produktionsfamilie</span>
            <input
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={form.formState.errors.name ? "conversion-name-error" : undefined}
              {...form.register("name")}
            />
          </label>
          {form.formState.errors.name ? (
            <p id="conversion-name-error" className={styles.fieldError}>
              Bitte gib einen Namen mit höchstens 120 Zeichen ein.
            </p>
          ) : null}

          {familyPreview ? (
            <ConversionImpact preparation={activeConversion} plan={familyPreview.plan} />
          ) : null}

          <div className={styles.actions}>
            <button type="button" onClick={returnToChoices}>
              Zurück zu den Optionen
            </button>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={familyPreview === null || form.formState.isSubmitting}
            >
              {familyKind === "duplicate"
                ? "Duplikat anlegen und konvertieren"
                : "Basisprofil anlegen und konvertieren"}
            </button>
          </div>
        </form>
      ) : null}

      {mode === "existing" ? (
        <section className={styles.existingProfiles} aria-labelledby="compatible-profile-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Vorhandene Familie</span>
              <h3 ref={existingHeadingRef} id="compatible-profile-title" tabIndex={-1}>
                Kompatibles Basisprofil wählen
              </h3>
            </div>
          </div>
          {compatiblePlans.length === 0 ? (
            <p className={styles.emptyState} role="note">
              Keine andere vorhandene Produktionsfamilie kann die gewünschte Konfiguration ohne
              Lock-Konflikt abbilden.
            </p>
          ) : (
            <div className={styles.profileList}>
              {compatiblePlans.map((plan) => (
                <label key={plan.targetBase.id} className={styles.profileChoice}>
                  <input
                    type="radio"
                    name="conversion-target"
                    value={plan.targetBase.id}
                    checked={selectedTargetId === plan.targetBase.id}
                    onChange={() => setSelectedTargetId(plan.targetBase.id)}
                  />
                  <span>
                    <strong>{plan.targetBase.name}</strong>
                    <small>
                      {plan.exactTechnicalMatch
                        ? "Exakte technische Übereinstimmung"
                        : `${plan.overrideFields.length} lokale technische Abweichung${plan.overrideFields.length === 1 ? "" : "en"}`}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedPlan ? (
            <ConversionImpact preparation={activeConversion} plan={selectedPlan} />
          ) : null}

          <div className={styles.actions}>
            <button type="button" onClick={returnToChoices}>
              Zurück zu den Optionen
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={selectedPlan === null}
              onClick={convertWithExisting}
            >
              Mit gewähltem Profil konvertieren
            </button>
          </div>
        </section>
      ) : null}

      {localError ? (
        <p className={styles.errorNotice} role="alert">
          {localError}
        </p>
      ) : null}
    </Surface>
  );
}
