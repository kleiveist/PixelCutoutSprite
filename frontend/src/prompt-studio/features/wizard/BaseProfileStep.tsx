import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, type FieldError } from "react-hook-form";
import { z } from "zod";
import {
  createDefaultBaseProfileLocks,
  createDefaultBaseProfileValues,
  createDuplicateProfileName,
  profileValuesEqual,
  type ProfileValueKey,
} from "../../domain/profiles";
import {
  BaseProfileLocksSchema,
  BaseProfileValuesSchema,
  IconIdSchema,
  ProfileNameSchema,
  type BaseProfile,
  type BaseProfileLocks,
  type BaseProfileValues,
} from "../../schemas";
import { useProfileLibrary } from "../../store/profiles";
import type { GuidedWizardStepComponentProps } from "./GuidedWizardEngine";
import type { WizardCoreFlowContext } from "./WizardCoreStepContent";
import { resolveWizardCapabilities } from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";
import styles from "./BaseProfileStep.module.css";

const BaseProfileEditorSchema = z.strictObject({
  name: ProfileNameSchema,
  iconId: IconIdSchema,
  values: BaseProfileValuesSchema,
  locks: BaseProfileLocksSchema,
});

type BaseProfileEditorValues = z.infer<typeof BaseProfileEditorSchema>;

function baseProfileEditorSchema(
  requiresCharacterHeight: boolean,
): z.ZodType<BaseProfileEditorValues, BaseProfileEditorValues> {
  if (!requiresCharacterHeight) return BaseProfileEditorSchema;

  return BaseProfileEditorSchema.superRefine((values, context) => {
    if (values.values.characterHeight === undefined && values.locks.characterHeight === true) {
      context.addIssue({
        code: "custom",
        path: ["values", "characterHeight"],
        message: "Eine fehlende Figurenhöhe darf für diese Figurenfamilie nicht gesperrt werden.",
      });
    }
  });
}
type EditorMode = Readonly<{ kind: "new" }> | Readonly<{ kind: "duplicate"; source: BaseProfile }>;

const BASE_VALUE_KEYS = Object.freeze([
  "pixelDensity",
  "styleProfile",
  "tileSize",
  "characterHeight",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
  "outlineStyle",
  "paletteMode",
  "backgroundMode",
  "alphaPadding",
  "nearestNeighbor",
  "lightingDefaults",
] as const satisfies readonly ProfileValueKey[]);

const BASE_FIELD_LABELS = {
  pixelDensity: "Pixelstil",
  styleProfile: "Stilprofil",
  tileSize: "Tilegröße",
  characterHeight: "Figurenhöhe",
  perspectiveType: "Perspektive",
  cameraAngle: "Kamerawinkel",
  cameraDirection: "Kamerarichtung",
  projectionType: "Projektion",
  outlineStyle: "Outline",
  paletteMode: "Farbprofil",
  backgroundMode: "Hintergrund",
  alphaPadding: "Transparenter Sicherheitsrand",
  nearestNeighbor: "Nearest-Neighbor-Skalierung",
  lightingDefaults: "Lichtgrundregeln",
} as const satisfies Record<ProfileValueKey, string>;

const PIXEL_DENSITY_OPTIONS = [
  ["classicHd", "Classic-HD"],
  ["modernHd", "Modern-HD"],
  ["ultraHd", "Ultra-HD"],
] as const;

const STYLE_PROFILE_OPTIONS = [
  ["classic", "Klassische Fantasy"],
  ["dark", "Düstere Fantasy"],
  ["both", "Beide Stilprofile"],
] as const;

const PERSPECTIVE_OPTIONS = [
  ["topdown", "Draufsicht"],
  ["threeQuarter", "Schräge 3/4-Draufsicht"],
  ["isometric", "Isometrisch"],
  ["side", "Seitenansicht"],
] as const;

const CAMERA_DIRECTION_OPTIONS = [
  ["southToNorth", "Süd nach Nord"],
  ["swToNe", "Südwest nach Nordost"],
  ["seToNw", "Südost nach Nordwest"],
] as const;

const PROJECTION_OPTIONS = [
  ["orthographic", "Orthografisch"],
  ["mildPerspective", "Leichte Perspektive"],
] as const;

const OUTLINE_OPTIONS = [
  ["dark", "Dunkel"],
  ["softSelective", "Weich und selektiv"],
  ["minimal", "Minimal"],
] as const;

const PALETTE_OPTIONS = [
  ["natural", "Natürlich"],
  ["vivid", "Leuchtend"],
  ["desaturated", "Entsättigt"],
  ["byProfile", "Nach Stilprofil"],
] as const;

const BACKGROUND_OPTIONS = [
  ["transparent", "Transparent"],
  ["scene", "Szene"],
] as const;

const LIGHTING_OPTIONS = [
  ["adaptive", "Kontextabhängig"],
  ["neutralDay", "Neutrales Tageslicht"],
  ["warmInterior", "Warmes Innenlicht"],
  ["gloomyDiffuse", "Düster und diffus"],
  ["neutralNight", "Neutrales Nachtlicht"],
  ["coolNight", "Kühles Nachtlicht"],
  ["custom", "Eigene Lichtregel"],
] as const;

function optionLabel(options: readonly (readonly [string, string])[], value: string): string {
  return options.find(([candidate]) => candidate === value)?.[1] ?? value;
}

function formatProfileValue(
  key: ProfileValueKey,
  value: BaseProfileValues[ProfileValueKey] | undefined,
): string {
  if (value === undefined) return "Nicht festgelegt";

  switch (key) {
    case "pixelDensity":
      return optionLabel(PIXEL_DENSITY_OPTIONS, String(value));
    case "styleProfile":
      return optionLabel(STYLE_PROFILE_OPTIONS, String(value));
    case "tileSize":
      return `${String(value)} × ${String(value)} px`;
    case "characterHeight":
      return `${String(value)} px`;
    case "perspectiveType":
      return optionLabel(PERSPECTIVE_OPTIONS, String(value));
    case "cameraAngle":
      return `${String(value)}°`;
    case "cameraDirection":
      return optionLabel(CAMERA_DIRECTION_OPTIONS, String(value));
    case "projectionType":
      return optionLabel(PROJECTION_OPTIONS, String(value));
    case "outlineStyle":
      return optionLabel(OUTLINE_OPTIONS, String(value));
    case "paletteMode":
      return optionLabel(PALETTE_OPTIONS, String(value));
    case "backgroundMode":
      return optionLabel(BACKGROUND_OPTIONS, String(value));
    case "alphaPadding":
      return `${String(value)} px`;
    case "nearestNeighbor":
      return value ? "Aktiv" : "Deaktiviert";
    case "lightingDefaults": {
      const lighting = value as BaseProfileValues["lightingDefaults"];
      const policy = optionLabel(LIGHTING_OPTIONS, lighting.policy);
      return lighting.notes ? `${policy}: ${lighting.notes}` : policy;
    }
  }
}

function cloneValues(values: BaseProfileValues): BaseProfileValues {
  return {
    ...values,
    lightingDefaults: { ...values.lightingDefaults },
  };
}

function editorDefaults(
  mode: EditorMode,
  existingNames: readonly string[],
): BaseProfileEditorValues {
  if (mode.kind === "new") {
    return {
      name: "Neue Produktionsfamilie",
      iconId: "world-grid",
      values: createDefaultBaseProfileValues(),
      locks: createDefaultBaseProfileLocks(),
    };
  }

  return {
    name: createDuplicateProfileName(mode.source.name, existingNames),
    iconId: mode.source.iconId,
    values: cloneValues(mode.source.values),
    locks: { ...mode.source.locks },
  };
}

function fieldErrorMessage(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as FieldError).message === "string"
  ) {
    return (error as FieldError).message ?? null;
  }
  return null;
}

function numberOrUndefined(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function compactLocks(locks: BaseProfileLocks): BaseProfileLocks {
  return Object.fromEntries(
    BASE_VALUE_KEYS.filter((key) => locks[key] === true).map((key) => [key, true]),
  ) as BaseProfileLocks;
}

function MainField({
  children,
  controlId,
  error,
  label,
  locked,
  onConflict,
  source,
  value,
}: Readonly<{
  children: ReactNode;
  controlId: string;
  error: string | null;
  label: string;
  locked: boolean;
  onConflict: (trigger: HTMLButtonElement) => void;
  source: string;
  value: string;
}>) {
  const labelId = `${controlId}-label`;
  const sourceId = `${controlId}-source`;
  const errorId = `${controlId}-error`;

  return (
    <div className={styles.effectiveField}>
      <div className={styles.fieldHeading}>
        <span id={labelId} className={styles.fieldLabel}>
          {label}
        </span>
        <span
          className={locked ? styles.lockedBadge : styles.openBadge}
          aria-label={locked ? "Gesperrter Basiswert" : "Überschreibbarer Basiswert"}
        >
          {locked ? "Gesperrt" : "Überschreibbar"}
        </span>
      </div>

      {locked ? (
        <div className={styles.readonlyControl}>
          <output aria-labelledby={labelId} aria-describedby={sourceId}>
            {value}
          </output>
          <button
            type="button"
            className={styles.textButton}
            onClick={(event) => onConflict(event.currentTarget)}
          >
            Anderen Wert verwenden …
          </button>
        </div>
      ) : (
        children
      )}

      <p id={sourceId} className={styles.sourceLabel}>
        Quelle: {source}
      </p>
      {error ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditorField({
  children,
  controlId,
  error,
  label,
  lockControl,
}: Readonly<{
  children: ReactNode;
  controlId: string;
  error: string | null;
  label: string;
  lockControl?: ReactNode;
}>) {
  return (
    <div className={styles.editorField}>
      <label htmlFor={controlId}>{label}</label>
      {children}
      {lockControl}
      {error ? (
        <p id={`${controlId}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LockControl({
  label,
  registration,
}: Readonly<{
  label: string;
  registration: ReturnType<ReturnType<typeof useForm<BaseProfileEditorValues>>["register"]>;
}>) {
  return (
    <label className={styles.lockControl}>
      <input type="checkbox" {...registration} />
      <span>{label} für Kindprofile sperren</span>
    </label>
  );
}

export function BaseProfileStep({
  context,
  draft,
  form,
  notifyProgrammaticChange,
}: GuidedWizardStepComponentProps<WizardCoreFormValues, WizardCoreFlowContext>) {
  const { createBaseProfile, deleteBaseProfile, duplicateBaseProfile, libraryResult } =
    useProfileLibrary();
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [lockedConflict, setLockedConflict] = useState<ProfileValueKey | null>(null);
  const [pendingBase, setPendingBase] = useState<BaseProfile | null>(null);
  const [pendingDeleteBase, setPendingDeleteBase] = useState<BaseProfile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingCreatedBase, setPendingCreatedBase] = useState<BaseProfile | null>(null);
  const [localNotice, setLocalNotice] = useState<Readonly<{
    kind: "error" | "success";
    message: string;
  }> | null>(null);
  const chooserRef = useRef<HTMLFieldSetElement>(null);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);
  const switchHeadingRef = useRef<HTMLHeadingElement>(null);
  const deleteHeadingRef = useRef<HTMLHeadingElement>(null);
  const conflictTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const switchTriggerRef = useRef<HTMLInputElement | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const newFamilyButtonRef = useRef<HTMLButtonElement | null>(null);
  const editorNameRef = useRef<HTMLInputElement | null>(null);
  const [focusProfileId, setFocusProfileId] = useState<string | null>(null);

  const library = libraryResult.status === "valid" ? libraryResult.value : context.library;
  const baseProfiles = library?.baseProfiles ?? [];
  const existingNames = useMemo(() => baseProfiles.map((profile) => profile.name), [baseProfiles]);

  const [category, subtype] = useWatch({
    control: form.control,
    name: ["category", "subtype"],
  });
  const capabilities = resolveWizardCapabilities({ category, subtype });
  const editorSchema = useMemo(
    () => baseProfileEditorSchema(capabilities?.scaledCharacter === true),
    [capabilities?.scaledCharacter],
  );

  const editorForm = useForm<BaseProfileEditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: editorDefaults({ kind: "new" }, existingNames),
  });

  const [
    baseProfileId,
    pixelDensity,
    styleProfile,
    tileSize,
    characterHeight,
    perspectiveType,
    cameraAngle,
    cameraDirection,
    projectionType,
    outlineStyle,
    paletteMode,
    backgroundMode,
    alphaPadding,
    nearestNeighbor,
    lightingPolicy,
    lightingNotes,
  ] = useWatch({
    control: form.control,
    name: [
      "baseProfileId",
      "pixelDensity",
      "styleProfile",
      "tileSize",
      "characterHeight",
      "perspectiveType",
      "cameraAngle",
      "cameraDirection",
      "projectionType",
      "outlineStyle",
      "paletteMode",
      "backgroundMode",
      "alphaPadding",
      "nearestNeighbor",
      "lightingPolicy",
      "lightingNotes",
    ],
  });

  const selectedBase = baseProfiles.find((profile) => profile.id === baseProfileId) ?? null;
  const showWorldGeometry = capabilities?.freeComposition !== true;
  const showCharacterHeight = capabilities?.scaledCharacter === true;
  const showAlphaPadding = capabilities?.transparent === true && backgroundMode === "transparent";
  const editorBackgroundMode = useWatch({
    control: editorForm.control,
    name: "values.backgroundMode",
  });

  const currentValues = useMemo<BaseProfileValues | null>(() => {
    if (!selectedBase) return null;

    const values: BaseProfileValues = {
      pixelDensity: pixelDensity ?? selectedBase.values.pixelDensity,
      styleProfile: styleProfile ?? selectedBase.values.styleProfile,
      tileSize: tileSize ?? selectedBase.values.tileSize,
      ...((characterHeight ?? selectedBase.values.characterHeight) === undefined
        ? {}
        : {
            characterHeight: characterHeight ?? selectedBase.values.characterHeight,
          }),
      perspectiveType: perspectiveType ?? selectedBase.values.perspectiveType,
      cameraAngle: cameraAngle ?? selectedBase.values.cameraAngle,
      cameraDirection: cameraDirection ?? selectedBase.values.cameraDirection,
      projectionType: projectionType ?? selectedBase.values.projectionType,
      outlineStyle: outlineStyle ?? selectedBase.values.outlineStyle,
      paletteMode: paletteMode ?? selectedBase.values.paletteMode,
      backgroundMode: backgroundMode ?? selectedBase.values.backgroundMode,
      alphaPadding: alphaPadding ?? selectedBase.values.alphaPadding,
      nearestNeighbor: nearestNeighbor ?? selectedBase.values.nearestNeighbor,
      lightingDefaults: {
        policy: lightingPolicy ?? selectedBase.values.lightingDefaults.policy,
        notes: lightingNotes ?? selectedBase.values.lightingDefaults.notes,
      },
    };
    return values;
  }, [
    alphaPadding,
    backgroundMode,
    cameraAngle,
    cameraDirection,
    characterHeight,
    lightingNotes,
    lightingPolicy,
    nearestNeighbor,
    outlineStyle,
    paletteMode,
    perspectiveType,
    pixelDensity,
    projectionType,
    selectedBase,
    styleProfile,
    tileSize,
  ]);

  const categoryProfile =
    library && "categoryProfileId" in draft && draft.categoryProfileId
      ? (library.categoryProfiles.find(
          (profile) =>
            profile.id === draft.categoryProfileId && profile.baseProfileId === selectedBase?.id,
        ) ?? null)
      : null;

  const sourceFor = useCallback(
    (key: ProfileValueKey): string => {
      if (!selectedBase || !currentValues) return "Nicht verfügbar";
      if (selectedBase.locks[key] === true) {
        return `Basisprofil „${selectedBase.name}“`;
      }

      const currentValue = currentValues[key];
      const categoryHasOverride =
        categoryProfile !== null &&
        Object.prototype.hasOwnProperty.call(categoryProfile.overrides, key);
      const categoryValue = categoryProfile?.overrides[key];
      const baseValue = selectedBase.values[key];
      if (
        categoryHasOverride &&
        categoryValue !== undefined &&
        baseValue !== undefined &&
        !profileValuesEqual(categoryValue, baseValue)
      ) {
        return currentValue !== undefined && profileValuesEqual(currentValue, categoryValue)
          ? `Kategorieprofil „${categoryProfile.name}“`
          : "Lokaler Entwurf";
      }

      if (
        currentValue === undefined
          ? baseValue === undefined
          : baseValue !== undefined && profileValuesEqual(currentValue, baseValue)
      ) {
        return `Basisprofil „${selectedBase.name}“`;
      }

      return "Lokaler Entwurf";
    },
    [categoryProfile, currentValues, selectedBase],
  );

  const applyProfile = useCallback(
    (profile: BaseProfile) => {
      const values = profile.values;
      const setOptions = {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      } as const;

      form.setValue("pixelDensity", values.pixelDensity, setOptions);
      form.setValue("styleProfile", values.styleProfile, setOptions);
      form.setValue("tileSize", values.tileSize, setOptions);
      form.setValue("characterHeight", values.characterHeight, setOptions);
      form.setValue("perspectiveType", values.perspectiveType, setOptions);
      form.setValue("cameraAngle", values.cameraAngle, setOptions);
      form.setValue("cameraDirection", values.cameraDirection, setOptions);
      form.setValue("projectionType", values.projectionType, setOptions);
      form.setValue("outlineStyle", values.outlineStyle, setOptions);
      form.setValue("paletteMode", values.paletteMode, setOptions);
      form.setValue("backgroundMode", values.backgroundMode, setOptions);
      form.setValue("alphaPadding", values.alphaPadding, setOptions);
      form.setValue("nearestNeighbor", values.nearestNeighbor, setOptions);
      form.setValue("lightingPolicy", values.lightingDefaults.policy, setOptions);
      form.setValue("lightingNotes", values.lightingDefaults.notes, setOptions);
      form.setValue("baseProfileId", profile.id, {
        ...setOptions,
        shouldValidate: true,
      });
      notifyProgrammaticChange();
    },
    [form, notifyProgrammaticChange],
  );

  const beginEditor = useCallback(
    (mode: EditorMode, trigger?: HTMLButtonElement) => {
      editorTriggerRef.current = trigger ?? null;
      editorForm.reset(editorDefaults(mode, existingNames));
      setPendingCreatedBase(null);
      setLocalNotice(null);
      setLockedConflict(null);
      setEditorMode(mode);
    },
    [editorForm, existingNames],
  );

  const requestProfile = useCallback(
    (profile: BaseProfile, trigger?: HTMLInputElement) => {
      setLocalNotice(null);
      setLockedConflict(null);
      if (baseProfileId && baseProfileId !== profile.id) {
        switchTriggerRef.current = trigger ?? null;
        setPendingBase(profile);
        return;
      }
      applyProfile(profile);
    },
    [applyProfile, baseProfileId],
  );

  const confirmProfileSwitch = useCallback(() => {
    if (!pendingBase) return;
    applyProfile(pendingBase);
    setFocusProfileId(pendingBase.id);
    setPendingBase(null);
    setLocalNotice({
      kind: "success",
      message: `„${pendingBase.name}“ ist jetzt die Produktionsfamilie dieses Entwurfs.`,
    });
  }, [applyProfile, pendingBase]);

  const cancelProfileSwitch = useCallback(() => {
    setPendingBase(null);
    requestAnimationFrame(() => switchTriggerRef.current?.focus());
  }, []);

  const requestBaseDeletion = useCallback((profile: BaseProfile, trigger: HTMLElement) => {
    deleteTriggerRef.current = trigger;
    setEditorMode(null);
    setPendingBase(null);
    setDeleteError(null);
    setLocalNotice(null);
    setPendingDeleteBase(profile);
  }, []);

  const cancelBaseDeletion = useCallback(() => {
    setPendingDeleteBase(null);
    setDeleteError(null);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, []);

  const confirmBaseDeletion = useCallback(() => {
    if (!pendingDeleteBase) return;
    const result = deleteBaseProfile(pendingDeleteBase.id);
    if (result.status !== "ok") {
      setDeleteError(result.message);
      return;
    }

    const deletedSelectedBase = form.getValues("baseProfileId") === pendingDeleteBase.id;
    if (deletedSelectedBase) {
      form.setValue("baseProfileId", undefined, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      notifyProgrammaticChange();
    }
    setPendingDeleteBase(null);
    setDeleteError(null);
    setLocalNotice({
      kind: "success",
      message: `Produktionsfamilie „${result.profile.name}“ wurde gelöscht.`,
    });
    requestAnimationFrame(() => newFamilyButtonRef.current?.focus());
  }, [deleteBaseProfile, form, notifyProgrammaticChange, pendingDeleteBase]);

  const openConflict = useCallback((key: ProfileValueKey, trigger: HTMLButtonElement) => {
    conflictTriggerRef.current = trigger;
    setLocalNotice(null);
    setEditorMode(null);
    setLockedConflict(key);
  }, []);

  const closeConflict = useCallback(() => {
    setLockedConflict(null);
    requestAnimationFrame(() => conflictTriggerRef.current?.focus());
  }, []);

  const focusOtherProfile = useCallback(() => {
    setLockedConflict(null);
    requestAnimationFrame(() => {
      const radios = chooserRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]');
      const target = [...(radios ?? [])].find((radio) => radio.value !== baseProfileId);
      (target ?? radios?.[0])?.focus();
    });
  }, [baseProfileId]);

  const saveEditor = editorForm.handleSubmit((editorValues) => {
    if (editorMode === null) return;

    const definition = {
      name: editorValues.name,
      iconId: editorValues.iconId,
      values: editorValues.values,
      locks: compactLocks(editorValues.locks),
    } as const;
    const previousBaseProfileId = form.getValues("baseProfileId");
    const result =
      editorMode.kind === "new"
        ? createBaseProfile(definition)
        : duplicateBaseProfile(editorMode.source.id, definition);

    if (result.status !== "ok") {
      setPendingCreatedBase(null);
      setLocalNotice({ kind: "error", message: result.message });
      if (form.getValues("baseProfileId") !== previousBaseProfileId) {
        form.setValue("baseProfileId", previousBaseProfileId, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });
      }
      return;
    }

    setPendingCreatedBase(result.profile);
    setEditorMode(null);
    setLocalNotice({
      kind: "success",
      message: `Basisprofil „${result.profile.name}“ wurde angelegt. Die Auswahl wird übernommen …`,
    });
  });

  useEffect(() => {
    if (pendingCreatedBase === null) return;
    const storedProfile = baseProfiles.find(
      (profile) =>
        profile.id === pendingCreatedBase.id &&
        profile.createdAt === pendingCreatedBase.createdAt &&
        profile.name === pendingCreatedBase.name,
    );
    if (!storedProfile) return;

    applyProfile(storedProfile);
    setPendingCreatedBase(null);
    setFocusProfileId(storedProfile.id);
    setLocalNotice({
      kind: "success",
      message: `Basisprofil „${storedProfile.name}“ wurde angelegt und ausgewählt.`,
    });
  }, [applyProfile, baseProfiles, pendingCreatedBase]);

  useEffect(() => {
    if (lockedConflict !== null) conflictHeadingRef.current?.focus();
  }, [lockedConflict]);

  useEffect(() => {
    if (pendingBase !== null) switchHeadingRef.current?.focus();
  }, [pendingBase]);

  useEffect(() => {
    if (pendingDeleteBase !== null) deleteHeadingRef.current?.focus();
  }, [pendingDeleteBase]);

  useEffect(() => {
    if (editorMode !== null) editorNameRef.current?.focus();
  }, [editorMode]);

  useEffect(() => {
    if (focusProfileId === null) return;
    const radios = chooserRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const target = [...(radios ?? [])].find((radio) => radio.value === focusProfileId);
    if (target) {
      target.focus();
      setFocusProfileId(null);
    }
  }, [baseProfiles, focusProfileId]);

  const mainError = (field: keyof WizardCoreFormValues) =>
    fieldErrorMessage(form.formState.errors[field]);
  const describedBy = (controlId: string, error: string | null) =>
    `${controlId}-source${error ? ` ${controlId}-error` : ""}`;
  const baseRegistration = form.register("baseProfileId");

  if (libraryResult.status === "invalid") {
    return (
      <section className={styles.blockingState} role="alert">
        <h3>Basisprofile konnten nicht sicher gelesen werden</h3>
        <p>
          Die gespeicherte Profilbibliothek ist ungültig. Sie wurde nicht verändert; Auswahl und
          Anlage bleiben gesperrt, bis sie wiederhergestellt wurde.
        </p>
      </section>
    );
  }

  if (libraryResult.status === "unavailable") {
    return (
      <section className={styles.blockingState} role="alert">
        <h3>Lokaler Profilspeicher ist nicht verfügbar</h3>
        <p>
          Basisprofile können gerade weder zuverlässig gewählt noch angelegt werden. Der aktuelle
          Entwurf bleibt unverändert.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.step}>
      <fieldset
        ref={chooserRef}
        className={styles.chooser}
        aria-describedby={mainError("baseProfileId") ? "base-profile-choice-error" : undefined}
      >
        <legend>Produktionsfamilie auswählen</legend>
        <p className={styles.intro}>
          Das Basisprofil verankert Stil, Maßstab, Kamera und Licht. Gesperrte Regeln bleiben für
          alle Kindprofile verbindlich.
        </p>

        {baseProfiles.length > 0 ? (
          <div className={styles.choiceGrid}>
            {baseProfiles.map((profile) => {
              const selected = profile.id === baseProfileId;
              const pending = profile.id === pendingBase?.id;
              const missingCharacterHeight =
                capabilities?.scaledCharacter === true &&
                profile.values.characterHeight === undefined;
              const compatible = !missingCharacterHeight || profile.locks.characterHeight !== true;
              return (
                <div
                  key={profile.id}
                  className={styles.choiceCard}
                  data-selected={selected ? "true" : "false"}
                  data-pending={pending ? "true" : "false"}
                >
                  <label className={styles.choiceSelection}>
                    <input
                      type="radio"
                      {...baseRegistration}
                      value={profile.id}
                      checked={selected}
                      disabled={!compatible}
                      onChange={(event) => requestProfile(profile, event.currentTarget)}
                      onKeyDown={(event) => {
                        if (event.key !== "Delete") return;
                        event.preventDefault();
                        requestBaseDeletion(profile, event.currentTarget);
                      }}
                    />
                    <span>
                      <strong>{profile.name}</strong>
                      <small>
                        {formatProfileValue("pixelDensity", profile.values.pixelDensity)}
                        {showWorldGeometry ? ` · ${profile.values.tileSize} px` : ""}
                        {capabilities?.scaledCharacter &&
                        profile.values.characterHeight !== undefined
                          ? ` · Figuren ${profile.values.characterHeight} px`
                          : ""}
                      </small>
                      <span className={styles.choiceMeta}>
                        {Object.values(profile.locks).filter(Boolean).length} gesperrte Regeln
                        {selected ? " · Im Entwurf ausgewählt" : ""}
                        {missingCharacterHeight
                          ? compatible
                            ? " · Figurenhöhe im Entwurf ergänzen"
                            : " · Nicht kompatibel: gesperrte Figurenhöhe fehlt"
                          : ""}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    className={styles.deleteChoiceButton}
                    aria-label={`Produktionsfamilie „${profile.name}“ löschen`}
                    title="Löschen (auch mit Entf bei fokussierter Auswahl)"
                    onClick={(event) => requestBaseDeletion(profile, event.currentTarget)}
                  >
                    <span aria-hidden="true">×</span>
                    Löschen
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState} role="note">
            <strong>Noch keine Produktionsfamilie</strong>
            <p>Lege ein kanonisches Basisprofil an, um fortzufahren.</p>
          </div>
        )}

        {mainError("baseProfileId") ? (
          <p id="base-profile-choice-error" className={styles.fieldError}>
            {mainError("baseProfileId")}
          </p>
        ) : null}

        <div className={styles.chooserActions}>
          <button
            ref={newFamilyButtonRef}
            type="button"
            className={styles.primaryButton}
            onClick={(event) => beginEditor({ kind: "new" }, event.currentTarget)}
          >
            Neue kanonische Familie
          </button>
          {selectedBase ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={(event) =>
                beginEditor({ kind: "duplicate", source: selectedBase }, event.currentTarget)
              }
            >
              Ausgewähltes Basisprofil duplizieren
            </button>
          ) : null}
        </div>
      </fieldset>

      {pendingBase ? (
        <section
          className={styles.conflictPanel}
          role="alert"
          aria-labelledby="base-profile-switch-title"
        >
          <h3 id="base-profile-switch-title" ref={switchHeadingRef} tabIndex={-1}>
            Produktionsfamilie wechseln?
          </h3>
          <p>
            Beim Wechsel zu „{pendingBase.name}“ werden die sichtbaren technischen Werte auf dieses
            Basisprofil gesetzt. Vorhandene technische Abweichungen werden dadurch ersetzt.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={cancelProfileSwitch}>
              Abbrechen
            </button>
            <button type="button" className={styles.primaryButton} onClick={confirmProfileSwitch}>
              Zu „{pendingBase.name}“ wechseln
            </button>
          </div>
        </section>
      ) : null}

      {pendingDeleteBase ? (
        <section
          className={styles.conflictPanel}
          role="alertdialog"
          aria-labelledby="base-profile-delete-title"
          aria-describedby="base-profile-delete-description"
        >
          <h3 id="base-profile-delete-title" ref={deleteHeadingRef} tabIndex={-1}>
            Produktionsfamilie löschen?
          </h3>
          <p id="base-profile-delete-description">
            „{pendingDeleteBase.name}“ wird nur gelöscht, wenn kein Kategorie- oder Assetprofil mehr
            davon abhängt. Abhängige Profile werden nie automatisch mitgelöscht oder umgehängt.
          </p>
          {deleteError ? (
            <p className={styles.errorNotice} role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={cancelBaseDeletion}>
              Abbrechen
            </button>
            <button type="button" className={styles.dangerButton} onClick={confirmBaseDeletion}>
              Produktionsfamilie endgültig löschen
            </button>
          </div>
        </section>
      ) : null}

      {lockedConflict && selectedBase ? (
        <section
          className={styles.conflictPanel}
          role="alert"
          aria-labelledby="base-lock-conflict-title"
        >
          <h3 id="base-lock-conflict-title" ref={conflictHeadingRef} tabIndex={-1}>
            {BASE_FIELD_LABELS[lockedConflict]} ist gesperrt
          </h3>
          <p>
            „{selectedBase.name}“ vererbt diesen Wert verbindlich. Das bestehende Profil und seine
            Kinder werden hier nicht still verändert. Wähle eine andere Familie oder arbeite mit
            einer eigenständigen Kopie.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={closeConflict}>
              Abbrechen
            </button>
            <button type="button" className={styles.secondaryButton} onClick={focusOtherProfile}>
              Anderes Profil wählen
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => beginEditor({ kind: "duplicate", source: selectedBase })}
            >
              Basisprofil duplizieren
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => beginEditor({ kind: "new" })}
            >
              Neue kanonische Familie
            </button>
          </div>
        </section>
      ) : null}

      {editorMode ? (
        <section className={styles.editor} aria-labelledby="base-profile-editor-title">
          <header className={styles.editorHeader}>
            <div>
              <p className={styles.eyebrow}>
                {editorMode.kind === "duplicate" ? "Eigenständige Kopie" : "Neue Familie"}
              </p>
              <h3 id="base-profile-editor-title">
                {editorMode.kind === "duplicate"
                  ? `„${editorMode.source.name}“ duplizieren`
                  : "Kanonisches Basisprofil anlegen"}
              </h3>
            </div>
            <p>
              Werte und Sperren werden erst mit „Basisprofil anlegen“ lokal gespeichert. Der
              aktuelle Entwurf bleibt bis dahin unverändert.
            </p>
          </header>

          {localNotice?.kind === "error" ? (
            <p className={styles.errorNotice} role="alert">
              {localNotice.message}
            </p>
          ) : null}

          <div className={styles.editorGrid}>
            <EditorField
              controlId="base-editor-name"
              label="Name der Produktionsfamilie"
              error={fieldErrorMessage(editorForm.formState.errors.name)}
            >
              <input
                id="base-editor-name"
                aria-invalid={Boolean(editorForm.formState.errors.name)}
                aria-describedby={
                  editorForm.formState.errors.name ? "base-editor-name-error" : undefined
                }
                {...editorForm.register("name")}
                ref={(node) => {
                  editorForm.register("name").ref(node);
                  editorNameRef.current = node;
                }}
              />
            </EditorField>

            <EditorField
              controlId="base-editor-pixel-density"
              label="Pixelstil"
              error={fieldErrorMessage(editorForm.formState.errors.values?.pixelDensity)}
              lockControl={
                <LockControl
                  label="Pixelstil"
                  registration={editorForm.register("locks.pixelDensity")}
                />
              }
            >
              <select
                id="base-editor-pixel-density"
                {...editorForm.register("values.pixelDensity")}
              >
                {PIXEL_DENSITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </EditorField>

            <EditorField
              controlId="base-editor-style-profile"
              label="Stilprofil"
              error={fieldErrorMessage(editorForm.formState.errors.values?.styleProfile)}
              lockControl={
                <LockControl
                  label="Stilprofil"
                  registration={editorForm.register("locks.styleProfile")}
                />
              }
            >
              <select
                id="base-editor-style-profile"
                {...editorForm.register("values.styleProfile")}
              >
                {STYLE_PROFILE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </EditorField>

            {showWorldGeometry ? (
              <>
                <EditorField
                  controlId="base-editor-tile-size"
                  label="Tilegröße in Pixeln"
                  error={fieldErrorMessage(editorForm.formState.errors.values?.tileSize)}
                  lockControl={
                    <LockControl
                      label="Tilegröße"
                      registration={editorForm.register("locks.tileSize")}
                    />
                  }
                >
                  <input
                    id="base-editor-tile-size"
                    type="number"
                    min={8}
                    max={512}
                    inputMode="numeric"
                    aria-invalid={Boolean(editorForm.formState.errors.values?.tileSize)}
                    {...editorForm.register("values.tileSize", {
                      setValueAs: numberOrUndefined,
                    })}
                  />
                </EditorField>

                <EditorField
                  controlId="base-editor-perspective"
                  label="Perspektive"
                  error={fieldErrorMessage(editorForm.formState.errors.values?.perspectiveType)}
                  lockControl={
                    <LockControl
                      label="Perspektive"
                      registration={editorForm.register("locks.perspectiveType")}
                    />
                  }
                >
                  <select
                    id="base-editor-perspective"
                    {...editorForm.register("values.perspectiveType")}
                  >
                    {PERSPECTIVE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </EditorField>

                <EditorField
                  controlId="base-editor-camera-angle"
                  label="Kamerawinkel"
                  error={fieldErrorMessage(editorForm.formState.errors.values?.cameraAngle)}
                  lockControl={
                    <LockControl
                      label="Kamerawinkel"
                      registration={editorForm.register("locks.cameraAngle")}
                    />
                  }
                >
                  <select
                    id="base-editor-camera-angle"
                    {...editorForm.register("values.cameraAngle", {
                      setValueAs: Number,
                    })}
                  >
                    <option value={30}>30°</option>
                    <option value={45}>45°</option>
                    <option value={60}>60°</option>
                  </select>
                </EditorField>

                <EditorField
                  controlId="base-editor-camera-direction"
                  label="Kamerarichtung"
                  error={fieldErrorMessage(editorForm.formState.errors.values?.cameraDirection)}
                  lockControl={
                    <LockControl
                      label="Kamerarichtung"
                      registration={editorForm.register("locks.cameraDirection")}
                    />
                  }
                >
                  <select
                    id="base-editor-camera-direction"
                    {...editorForm.register("values.cameraDirection")}
                  >
                    {CAMERA_DIRECTION_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </EditorField>

                <EditorField
                  controlId="base-editor-projection"
                  label="Projektion"
                  error={fieldErrorMessage(editorForm.formState.errors.values?.projectionType)}
                  lockControl={
                    <LockControl
                      label="Projektion"
                      registration={editorForm.register("locks.projectionType")}
                    />
                  }
                >
                  <select
                    id="base-editor-projection"
                    {...editorForm.register("values.projectionType")}
                  >
                    {PROJECTION_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </EditorField>
              </>
            ) : null}

            {showCharacterHeight ? (
              <EditorField
                controlId="base-editor-character-height"
                label="Figurenhöhe in Pixeln"
                error={fieldErrorMessage(editorForm.formState.errors.values?.characterHeight)}
                lockControl={
                  <LockControl
                    label="Figurenhöhe"
                    registration={editorForm.register("locks.characterHeight")}
                  />
                }
              >
                <input
                  id="base-editor-character-height"
                  type="number"
                  min={16}
                  max={1024}
                  inputMode="numeric"
                  aria-invalid={Boolean(editorForm.formState.errors.values?.characterHeight)}
                  {...editorForm.register("values.characterHeight", {
                    setValueAs: numberOrUndefined,
                  })}
                />
              </EditorField>
            ) : null}

            <EditorField
              controlId="base-editor-outline"
              label="Outline"
              error={fieldErrorMessage(editorForm.formState.errors.values?.outlineStyle)}
              lockControl={
                <LockControl
                  label="Outline"
                  registration={editorForm.register("locks.outlineStyle")}
                />
              }
            >
              <select id="base-editor-outline" {...editorForm.register("values.outlineStyle")}>
                {OUTLINE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </EditorField>

            <EditorField
              controlId="base-editor-palette"
              label="Farbprofil"
              error={fieldErrorMessage(editorForm.formState.errors.values?.paletteMode)}
              lockControl={
                <LockControl
                  label="Farbprofil"
                  registration={editorForm.register("locks.paletteMode")}
                />
              }
            >
              <select id="base-editor-palette" {...editorForm.register("values.paletteMode")}>
                {PALETTE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </EditorField>

            <EditorField
              controlId="base-editor-background"
              label="Hintergrund"
              error={fieldErrorMessage(editorForm.formState.errors.values?.backgroundMode)}
              lockControl={
                <LockControl
                  label="Hintergrund"
                  registration={editorForm.register("locks.backgroundMode")}
                />
              }
            >
              <select id="base-editor-background" {...editorForm.register("values.backgroundMode")}>
                {BACKGROUND_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </EditorField>

            {capabilities?.transparent === true && editorBackgroundMode === "transparent" ? (
              <EditorField
                controlId="base-editor-alpha-padding"
                label="Transparenter Sicherheitsrand in Pixeln"
                error={fieldErrorMessage(editorForm.formState.errors.values?.alphaPadding)}
                lockControl={
                  <LockControl
                    label="Transparenter Sicherheitsrand"
                    registration={editorForm.register("locks.alphaPadding")}
                  />
                }
              >
                <input
                  id="base-editor-alpha-padding"
                  type="number"
                  min={0}
                  max={256}
                  inputMode="numeric"
                  aria-invalid={Boolean(editorForm.formState.errors.values?.alphaPadding)}
                  {...editorForm.register("values.alphaPadding", {
                    setValueAs: numberOrUndefined,
                  })}
                />
              </EditorField>
            ) : null}

            <EditorField
              controlId="base-editor-nearest-neighbor"
              label="Skalierung"
              error={fieldErrorMessage(editorForm.formState.errors.values?.nearestNeighbor)}
              lockControl={
                <LockControl
                  label="Nearest-Neighbor-Skalierung"
                  registration={editorForm.register("locks.nearestNeighbor")}
                />
              }
            >
              <label className={styles.booleanControl}>
                <input
                  id="base-editor-nearest-neighbor"
                  type="checkbox"
                  {...editorForm.register("values.nearestNeighbor")}
                />
                <span>Nearest Neighbor erzwingen</span>
              </label>
            </EditorField>

            <div className={styles.wideField}>
              <EditorField
                controlId="base-editor-lighting-policy"
                label="Lichtgrundregel"
                error={fieldErrorMessage(
                  editorForm.formState.errors.values?.lightingDefaults?.policy,
                )}
                lockControl={
                  <LockControl
                    label="Lichtgrundregeln"
                    registration={editorForm.register("locks.lightingDefaults")}
                  />
                }
              >
                <select
                  id="base-editor-lighting-policy"
                  {...editorForm.register("values.lightingDefaults.policy")}
                >
                  {LIGHTING_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </EditorField>
              <EditorField
                controlId="base-editor-lighting-notes"
                label="Zusätzliche Lichtnotizen"
                error={fieldErrorMessage(
                  editorForm.formState.errors.values?.lightingDefaults?.notes,
                )}
              >
                <textarea
                  id="base-editor-lighting-notes"
                  rows={4}
                  maxLength={2000}
                  {...editorForm.register("values.lightingDefaults.notes")}
                />
              </EditorField>
            </div>
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setEditorMode(null);
                setLocalNotice(null);
                requestAnimationFrame(() => {
                  const editorTrigger = editorTriggerRef.current;
                  if (editorTrigger?.isConnected) {
                    editorTrigger.focus();
                    return;
                  }
                  conflictTriggerRef.current?.focus();
                });
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void saveEditor()}
            >
              Basisprofil anlegen
            </button>
          </div>
        </section>
      ) : null}

      {localNotice && !(editorMode !== null && localNotice.kind === "error") ? (
        <p
          className={localNotice.kind === "error" ? styles.errorNotice : styles.successNotice}
          role={localNotice.kind === "error" ? "alert" : "status"}
        >
          {localNotice.message}
        </p>
      ) : null}

      {selectedBase && currentValues ? (
        <section className={styles.effectiveValues} aria-labelledby="effective-base-values-title">
          <header className={styles.valuesHeader}>
            <div>
              <p className={styles.eyebrow}>Wirksame Produktionswerte</p>
              <h3 id="effective-base-values-title">{selectedBase.name}</h3>
            </div>
            <p>
              Quelle und Sperrstatus bleiben an jedem Wert sichtbar. Änderungen an überschreibbaren
              Feldern gelten nur für diesen Entwurf.
            </p>
          </header>

          <div className={styles.effectiveGrid}>
            <MainField
              controlId="base-value-pixel-density"
              label="Pixelstil"
              locked={selectedBase.locks.pixelDensity === true}
              source={sourceFor("pixelDensity")}
              value={formatProfileValue("pixelDensity", currentValues.pixelDensity)}
              error={mainError("pixelDensity")}
              onConflict={(trigger) => openConflict("pixelDensity", trigger)}
            >
              <select
                id="base-value-pixel-density"
                aria-labelledby="base-value-pixel-density-label"
                aria-describedby={describedBy(
                  "base-value-pixel-density",
                  mainError("pixelDensity"),
                )}
                aria-invalid={Boolean(mainError("pixelDensity"))}
                {...form.register("pixelDensity")}
              >
                {PIXEL_DENSITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </MainField>

            <MainField
              controlId="base-value-style-profile"
              label="Stilprofil"
              locked={selectedBase.locks.styleProfile === true}
              source={sourceFor("styleProfile")}
              value={formatProfileValue("styleProfile", currentValues.styleProfile)}
              error={mainError("styleProfile")}
              onConflict={(trigger) => openConflict("styleProfile", trigger)}
            >
              <select
                id="base-value-style-profile"
                aria-labelledby="base-value-style-profile-label"
                aria-describedby={describedBy(
                  "base-value-style-profile",
                  mainError("styleProfile"),
                )}
                aria-invalid={Boolean(mainError("styleProfile"))}
                {...form.register("styleProfile")}
              >
                {STYLE_PROFILE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </MainField>

            {showWorldGeometry ? (
              <>
                <MainField
                  controlId="base-value-tile-size"
                  label="Tilegröße"
                  locked={selectedBase.locks.tileSize === true}
                  source={sourceFor("tileSize")}
                  value={formatProfileValue("tileSize", currentValues.tileSize)}
                  error={mainError("tileSize")}
                  onConflict={(trigger) => openConflict("tileSize", trigger)}
                >
                  <input
                    id="base-value-tile-size"
                    type="number"
                    min={8}
                    max={512}
                    inputMode="numeric"
                    aria-labelledby="base-value-tile-size-label"
                    aria-describedby={describedBy("base-value-tile-size", mainError("tileSize"))}
                    aria-invalid={Boolean(mainError("tileSize"))}
                    {...form.register("tileSize", {
                      setValueAs: numberOrUndefined,
                    })}
                  />
                </MainField>

                <MainField
                  controlId="base-value-perspective"
                  label="Perspektive"
                  locked={selectedBase.locks.perspectiveType === true}
                  source={sourceFor("perspectiveType")}
                  value={formatProfileValue("perspectiveType", currentValues.perspectiveType)}
                  error={mainError("perspectiveType")}
                  onConflict={(trigger) => openConflict("perspectiveType", trigger)}
                >
                  <select
                    id="base-value-perspective"
                    aria-labelledby="base-value-perspective-label"
                    aria-describedby={describedBy(
                      "base-value-perspective",
                      mainError("perspectiveType"),
                    )}
                    aria-invalid={Boolean(mainError("perspectiveType"))}
                    {...form.register("perspectiveType")}
                  >
                    {PERSPECTIVE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </MainField>

                <MainField
                  controlId="base-value-camera-angle"
                  label="Kamerawinkel"
                  locked={selectedBase.locks.cameraAngle === true}
                  source={sourceFor("cameraAngle")}
                  value={formatProfileValue("cameraAngle", currentValues.cameraAngle)}
                  error={mainError("cameraAngle")}
                  onConflict={(trigger) => openConflict("cameraAngle", trigger)}
                >
                  <select
                    id="base-value-camera-angle"
                    aria-labelledby="base-value-camera-angle-label"
                    aria-describedby={describedBy(
                      "base-value-camera-angle",
                      mainError("cameraAngle"),
                    )}
                    aria-invalid={Boolean(mainError("cameraAngle"))}
                    {...form.register("cameraAngle", { setValueAs: Number })}
                  >
                    <option value={30}>30°</option>
                    <option value={45}>45°</option>
                    <option value={60}>60°</option>
                  </select>
                </MainField>

                <MainField
                  controlId="base-value-camera-direction"
                  label="Kamerarichtung"
                  locked={selectedBase.locks.cameraDirection === true}
                  source={sourceFor("cameraDirection")}
                  value={formatProfileValue("cameraDirection", currentValues.cameraDirection)}
                  error={mainError("cameraDirection")}
                  onConflict={(trigger) => openConflict("cameraDirection", trigger)}
                >
                  <select
                    id="base-value-camera-direction"
                    aria-labelledby="base-value-camera-direction-label"
                    aria-describedby={describedBy(
                      "base-value-camera-direction",
                      mainError("cameraDirection"),
                    )}
                    aria-invalid={Boolean(mainError("cameraDirection"))}
                    {...form.register("cameraDirection")}
                  >
                    {CAMERA_DIRECTION_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </MainField>

                <MainField
                  controlId="base-value-projection"
                  label="Projektion"
                  locked={selectedBase.locks.projectionType === true}
                  source={sourceFor("projectionType")}
                  value={formatProfileValue("projectionType", currentValues.projectionType)}
                  error={mainError("projectionType")}
                  onConflict={(trigger) => openConflict("projectionType", trigger)}
                >
                  <select
                    id="base-value-projection"
                    aria-labelledby="base-value-projection-label"
                    aria-describedby={describedBy(
                      "base-value-projection",
                      mainError("projectionType"),
                    )}
                    aria-invalid={Boolean(mainError("projectionType"))}
                    {...form.register("projectionType")}
                  >
                    {PROJECTION_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </MainField>
              </>
            ) : null}

            {showCharacterHeight ? (
              <MainField
                controlId="base-value-character-height"
                label="Figurenhöhe"
                locked={selectedBase.locks.characterHeight === true}
                source={sourceFor("characterHeight")}
                value={formatProfileValue("characterHeight", currentValues.characterHeight)}
                error={mainError("characterHeight")}
                onConflict={(trigger) => openConflict("characterHeight", trigger)}
              >
                <input
                  id="base-value-character-height"
                  type="number"
                  min={16}
                  max={1024}
                  inputMode="numeric"
                  aria-labelledby="base-value-character-height-label"
                  aria-describedby={describedBy(
                    "base-value-character-height",
                    mainError("characterHeight"),
                  )}
                  aria-invalid={Boolean(mainError("characterHeight"))}
                  {...form.register("characterHeight", {
                    setValueAs: numberOrUndefined,
                  })}
                />
              </MainField>
            ) : null}

            <MainField
              controlId="base-value-outline"
              label="Outline"
              locked={selectedBase.locks.outlineStyle === true}
              source={sourceFor("outlineStyle")}
              value={formatProfileValue("outlineStyle", currentValues.outlineStyle)}
              error={mainError("outlineStyle")}
              onConflict={(trigger) => openConflict("outlineStyle", trigger)}
            >
              <select
                id="base-value-outline"
                aria-labelledby="base-value-outline-label"
                aria-describedby={describedBy("base-value-outline", mainError("outlineStyle"))}
                aria-invalid={Boolean(mainError("outlineStyle"))}
                {...form.register("outlineStyle")}
              >
                {OUTLINE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </MainField>

            <MainField
              controlId="base-value-palette"
              label="Farbprofil"
              locked={selectedBase.locks.paletteMode === true}
              source={sourceFor("paletteMode")}
              value={formatProfileValue("paletteMode", currentValues.paletteMode)}
              error={mainError("paletteMode")}
              onConflict={(trigger) => openConflict("paletteMode", trigger)}
            >
              <select
                id="base-value-palette"
                aria-labelledby="base-value-palette-label"
                aria-describedby={describedBy("base-value-palette", mainError("paletteMode"))}
                aria-invalid={Boolean(mainError("paletteMode"))}
                {...form.register("paletteMode")}
              >
                {PALETTE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </MainField>

            <MainField
              controlId="base-value-background"
              label="Hintergrund"
              locked={selectedBase.locks.backgroundMode === true}
              source={sourceFor("backgroundMode")}
              value={formatProfileValue("backgroundMode", currentValues.backgroundMode)}
              error={mainError("backgroundMode")}
              onConflict={(trigger) => openConflict("backgroundMode", trigger)}
            >
              <select
                id="base-value-background"
                aria-labelledby="base-value-background-label"
                aria-describedby={describedBy("base-value-background", mainError("backgroundMode"))}
                aria-invalid={Boolean(mainError("backgroundMode"))}
                {...form.register("backgroundMode")}
              >
                {BACKGROUND_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </MainField>

            {showAlphaPadding ? (
              <MainField
                controlId="base-value-alpha-padding"
                label="Transparenter Sicherheitsrand"
                locked={selectedBase.locks.alphaPadding === true}
                source={sourceFor("alphaPadding")}
                value={formatProfileValue("alphaPadding", currentValues.alphaPadding)}
                error={mainError("alphaPadding")}
                onConflict={(trigger) => openConflict("alphaPadding", trigger)}
              >
                <input
                  id="base-value-alpha-padding"
                  type="number"
                  min={0}
                  max={256}
                  inputMode="numeric"
                  aria-labelledby="base-value-alpha-padding-label"
                  aria-describedby={describedBy(
                    "base-value-alpha-padding",
                    mainError("alphaPadding"),
                  )}
                  aria-invalid={Boolean(mainError("alphaPadding"))}
                  {...form.register("alphaPadding", {
                    setValueAs: numberOrUndefined,
                  })}
                />
              </MainField>
            ) : null}

            <MainField
              controlId="base-value-nearest-neighbor"
              label="Skalierung"
              locked={selectedBase.locks.nearestNeighbor === true}
              source={sourceFor("nearestNeighbor")}
              value={formatProfileValue("nearestNeighbor", currentValues.nearestNeighbor)}
              error={mainError("nearestNeighbor")}
              onConflict={(trigger) => openConflict("nearestNeighbor", trigger)}
            >
              <label className={styles.booleanControl}>
                <input
                  id="base-value-nearest-neighbor"
                  type="checkbox"
                  aria-labelledby="base-value-nearest-neighbor-label"
                  aria-describedby={describedBy(
                    "base-value-nearest-neighbor",
                    mainError("nearestNeighbor"),
                  )}
                  aria-invalid={Boolean(mainError("nearestNeighbor"))}
                  {...form.register("nearestNeighbor")}
                />
                <span>Nearest Neighbor erzwingen</span>
              </label>
            </MainField>

            <div className={styles.wideField}>
              <MainField
                controlId="base-value-lighting-policy"
                label="Lichtgrundregel"
                locked={selectedBase.locks.lightingDefaults === true}
                source={sourceFor("lightingDefaults")}
                value={formatProfileValue("lightingDefaults", currentValues.lightingDefaults)}
                error={mainError("lightingPolicy") ?? mainError("lightingNotes")}
                onConflict={(trigger) => openConflict("lightingDefaults", trigger)}
              >
                <div className={styles.lightingControls}>
                  <select
                    id="base-value-lighting-policy"
                    aria-labelledby="base-value-lighting-policy-label"
                    aria-describedby={describedBy(
                      "base-value-lighting-policy",
                      mainError("lightingPolicy"),
                    )}
                    aria-invalid={Boolean(mainError("lightingPolicy"))}
                    {...form.register("lightingPolicy")}
                  >
                    {LIGHTING_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="base-value-lighting-notes">Zusätzliche Lichtnotizen</label>
                  <textarea
                    id="base-value-lighting-notes"
                    rows={4}
                    maxLength={2000}
                    aria-invalid={Boolean(mainError("lightingNotes"))}
                    aria-describedby={
                      mainError("lightingNotes") ? "base-value-lighting-notes-error" : undefined
                    }
                    {...form.register("lightingNotes")}
                  />
                  {mainError("lightingNotes") ? (
                    <p id="base-value-lighting-notes-error" className={styles.fieldError}>
                      {mainError("lightingNotes")}
                    </p>
                  ) : null}
                </div>
              </MainField>
            </div>
          </div>
        </section>
      ) : baseProfileId ? (
        <section className={styles.blockingState} role="alert">
          <h3>Ausgewähltes Basisprofil fehlt</h3>
          <p>
            Die gespeicherte Referenz ist nicht mehr in der Profilbibliothek vorhanden. Wähle eine
            verfügbare Familie; der fehlende Verweis wird nicht automatisch ersetzt.
          </p>
        </section>
      ) : null}
    </div>
  );
}
