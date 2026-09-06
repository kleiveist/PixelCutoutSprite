import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  ARTWORK_BACKGROUND_IDS,
  ARTWORK_COMPOSITION_IDS,
  ARTWORK_DETAIL_LEVEL_IDS,
  ARTWORK_FOCUS_IDS,
  ARTWORK_FORMAT_IDS,
  ARTWORK_LIGHTING_DRAMA_IDS,
  ARTWORK_MOTIF_IDS,
  ARTWORK_PURPOSE_IDS,
  getDefaultArtworkType,
  type ArtworkBackground,
  type ArtworkComposition,
  type ArtworkDetailLevel,
  type ArtworkFocus,
  type ArtworkFormat,
  type ArtworkLightingDrama,
  type ArtworkMotif,
  type ArtworkPurpose,
  type ArtworkSubtype,
  type ArtworkType,
} from "../../domain/artworks";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./ArtworkConceptEditor.module.css";

type ArtworkForm = UseFormReturn<WizardCoreFormValues>;
type ArtworkTextFieldName =
  | "artworkDescription"
  | "artworkSceneDescription"
  | "artworkCompositionDetails"
  | "artworkBackgroundDetails"
  | "artworkLightingDetails"
  | "artworkExtraDetails";
type ArtworkSelectFieldName =
  | "artworkPurpose"
  | "artworkMotif"
  | "artworkComposition"
  | "artworkFormat"
  | "artworkBackground"
  | "artworkFocus"
  | "artworkLightingDrama"
  | "artworkDetailLevel";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

const TYPE_LABELS: Readonly<Record<ArtworkType, string>> = {
  characterConcept: "Charakterkonzept",
  environmentConcept: "Umgebungskonzept",
  buildingConcept: "Gebäudeentwurf",
  materialStudy: "Materialstudie",
  scene: "Szene",
  promoArtwork: "Promo-Artwork",
  moodPainting: "Stimmungsbild",
};
const PURPOSE_LABELS: Readonly<Record<ArtworkPurpose, string>> = {
  concept: "Konzept",
  presentation: "Präsentation",
  productionReference: "Produktionsreferenz",
};
const MOTIF_LABELS: Readonly<Record<ArtworkMotif, string>> = {
  figure: "Figur",
  object: "Objekt",
  environment: "Umgebung",
  scene: "Szene",
};
const COMPOSITION_LABELS: Readonly<Record<ArtworkComposition, string>> = {
  singleSubject: "Einzelmotiv",
  group: "Gruppe",
  scene: "Gestaffelte Szene",
};
const FORMAT_LABELS: Readonly<Record<ArtworkFormat, string>> = {
  square: "Quadratisch",
  portrait: "Hochformat",
  landscape: "Querformat",
  free: "Freies Format",
};
const BACKGROUND_LABELS: Readonly<Record<ArtworkBackground, string>> = {
  transparent: "Transparent",
  simple: "Einfach",
  complete: "Vollständig ausgearbeitet",
};
const FOCUS_LABELS: Readonly<Record<ArtworkFocus, string>> = {
  form: "Form",
  material: "Material",
  mood: "Stimmung",
  story: "Geschichte",
  scale: "Maßstab",
};
const LIGHTING_LABELS: Readonly<Record<ArtworkLightingDrama, string>> = {
  neutral: "Neutral",
  warm: "Warm",
  gloomy: "Düster",
  night: "Nacht",
  custom: "Benutzerdefiniert",
};
const DETAIL_LABELS: Readonly<Record<ArtworkDetailLevel, string>> = {
  overview: "Übersicht",
  productionConcept: "Produktionskonzept",
  showcase: "Showcase",
};
const PIXEL_DENSITY_LABELS = {
  classicHd: "Classic-HD",
  modernHd: "Modern-HD",
  ultraHd: "Ultra-HD",
} as const;
const STYLE_PROFILE_LABELS = {
  classic: "Stil A",
  dark: "Stil B",
  both: "Stil A + B",
} as const;
const OUTLINE_LABELS = {
  dark: "dunkle Outline",
  softSelective: "selektive Outline",
  minimal: "minimale Outline",
} as const;

function optionsFromIds<Id extends string>(
  ids: readonly Id[],
  labels: Readonly<Record<Id, string>>,
): readonly SelectOption[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

function optionalTextValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalSelectValue(value: unknown): string | undefined {
  return value === "" ? undefined : String(value);
}

function fieldError(form: ArtworkForm, field: keyof WizardCoreFormValues): string | null {
  const error = form.formState.errors[field];
  return typeof error?.message === "string" ? error.message : null;
}

function FieldShell({
  children,
  error,
  help,
  id,
  label,
  wide = false,
}: Readonly<{
  children: ReactNode;
  error: string | null;
  help: string;
  id: string;
  label: string;
  wide?: boolean;
}>) {
  return (
    <div className={`${styles.field}${wide ? ` ${styles.wideField}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <p id={`${id}-help`} className={styles.help}>
        {help}
      </p>
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  form,
  help,
  label,
  name,
  options,
}: Readonly<{
  form: ArtworkForm;
  help: string;
  label: string;
  name: ArtworkSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `artwork-${name}`;
  const error = fieldError(form, name);
  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <select
        id={id}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? "true" : "false"}
        {...form.register(name, { setValueAs: optionalSelectValue })}
      >
        <option value="">Noch nicht festgelegt</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function TextField({
  form,
  help,
  label,
  maxLength = 1000,
  name,
  notifyProgrammaticChange,
  wide = false,
}: Readonly<{
  form: ArtworkForm;
  help: string;
  label: string;
  maxLength?: number;
  name: ArtworkTextFieldName;
  notifyProgrammaticChange: () => void;
  wide?: boolean;
}>) {
  const id = `artwork-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  const value = useWatch({ control: form.control, name });
  return (
    <GuidedTextChoice
      describedBy={describedBy}
      error={error}
      errorClassName={styles.error}
      fieldClassName={wide ? `${styles.field} ${styles.wideField}` : styles.field}
      help={help}
      helpClassName={styles.help}
      id={id}
      label={label}
      maxLength={maxLength}
      multiline
      onChoose={(nextValue) => {
        form.setValue(name, nextValue, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        notifyProgrammaticChange();
      }}
      presets={GUIDED_TEXT_PRESETS_DE[name]}
      registration={form.register(name, { setValueAs: optionalTextValue })}
      value={value}
    />
  );
}

function DerivedField({
  help,
  id,
  label,
  value,
}: Readonly<{
  help: string;
  id: string;
  label: string;
  value: string;
}>) {
  return (
    <div className={styles.field}>
      <span id={`${id}-label`} className={styles.fieldLabel}>
        {label}
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
      >
        {value}
      </output>
      <p id={`${id}-help`} className={styles.help}>
        {help}
      </p>
    </div>
  );
}

const PURPOSE_OPTIONS = optionsFromIds(ARTWORK_PURPOSE_IDS, PURPOSE_LABELS);
const MOTIF_OPTIONS = optionsFromIds(ARTWORK_MOTIF_IDS, MOTIF_LABELS);
const COMPOSITION_OPTIONS = optionsFromIds(ARTWORK_COMPOSITION_IDS, COMPOSITION_LABELS);
const FORMAT_OPTIONS = optionsFromIds(ARTWORK_FORMAT_IDS, FORMAT_LABELS);
const BACKGROUND_OPTIONS = optionsFromIds(ARTWORK_BACKGROUND_IDS, BACKGROUND_LABELS);
const FOCUS_OPTIONS = optionsFromIds(ARTWORK_FOCUS_IDS, FOCUS_LABELS);
const LIGHTING_OPTIONS = optionsFromIds(ARTWORK_LIGHTING_DRAMA_IDS, LIGHTING_LABELS);
const DETAIL_OPTIONS = optionsFromIds(ARTWORK_DETAIL_LEVEL_IDS, DETAIL_LABELS);

export interface ArtworkConceptEditorProps {
  readonly form: ArtworkForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: ArtworkSubtype;
}

export function ArtworkConceptEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: ArtworkConceptEditorProps) {
  const pixelDensity = useWatch({ control: form.control, name: "pixelDensity" });
  const styleProfile = useWatch({ control: form.control, name: "styleProfile" });
  const outlineStyle = useWatch({ control: form.control, name: "outlineStyle" });
  const artDirection =
    [
      ...(pixelDensity === undefined ? [] : [PIXEL_DENSITY_LABELS[pixelDensity]]),
      ...(styleProfile === undefined ? [] : [STYLE_PROFILE_LABELS[styleProfile]]),
      ...(outlineStyle === undefined ? [] : [OUTLINE_LABELS[outlineStyle]]),
    ].join(" · ") || "Nach Basisprofil";

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="artwork-context-title">
        <div>
          <p className={styles.eyebrow}>Freie Bildkomposition</p>
          <h3 id="artwork-context-title">{TYPE_LABELS[getDefaultArtworkType(subtype)]}</h3>
          <p className={styles.contextHelp}>
            Komposition und Bilddramaturgie folgen dem Konzeptziel statt einem Gameplay-Raster.
          </p>
        </div>
        <ul className={styles.statusList}>
          <li>kein Tile-/Sprite-Raster</li>
          <li>keine Richtungsansichten</li>
          <li>keine Animation</li>
        </ul>
      </section>

      <fieldset className={styles.group}>
        <legend>Artwork-Ziel und Motiv</legend>
        <p className={styles.groupIntro}>
          Der Artworktyp folgt dem gewählten Untertyp; Zweck und Motiv bleiben frei beschreibbar.
        </p>
        <div className={styles.fieldGrid}>
          <DerivedField
            id="artwork-type"
            label="Artworktyp"
            value={TYPE_LABELS[getDefaultArtworkType(subtype)]}
            help="Aus dem Untertyp abgeleitet und nicht separat überschreibbar."
          />
          <SelectField
            form={form}
            name="artworkPurpose"
            label="Zweck"
            help="Konzept, Präsentation oder belastbare Produktionsreferenz."
            options={PURPOSE_OPTIONS}
          />
          <SelectField
            form={form}
            name="artworkMotif"
            label="Motivart"
            help="Legt die zentrale Bildidee fest, ohne ein Asset-Raster zu erzwingen."
            options={MOTIF_OPTIONS}
          />
          <DerivedField
            id="artwork-direction"
            label="Geerbte Art Direction"
            value={artDirection}
            help="Stilwerte stammen aus dem Basisprofil; Weltkamera und Tilegröße gelten hier nicht."
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkDescription"
            label="Motivbeschreibung"
            help="Konkretes Hauptmotiv, Formensprache und erzählerische Identität."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Szene und Komposition</legend>
        <p className={styles.groupIntro}>
          Beschreibe Bildraum und Blickführung unabhängig von Sprite- oder Richtungslayouts.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="artworkComposition"
            label="Komposition"
            help="Einzelmotiv, Gruppe oder gestaffelte Szene."
            options={COMPOSITION_OPTIONS}
          />
          <SelectField
            form={form}
            name="artworkFocus"
            label="Fokus"
            help="Form, Material, Stimmung, Geschichte oder Maßstab als Hauptaussage."
            options={FOCUS_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkSceneDescription"
            label="Szene"
            help="Ort, Handlung, Figurenbezüge und räumlicher Kontext."
            wide
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkCompositionDetails"
            label="Kompositionsdetails"
            help="Blickführung, Gewichtung sowie Vorder-, Mittel- und Hintergrund."
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Format und Hintergrund</legend>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="artworkFormat"
            label="Format"
            help="Quadratisch, Hochformat, Querformat oder bewusst frei."
            options={FORMAT_OPTIONS}
          />
          <SelectField
            form={form}
            name="artworkBackground"
            label="Artwork-Hintergrund"
            help="Transparent, einfach gehalten oder vollständig ausgearbeitet."
            options={BACKGROUND_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkBackgroundDetails"
            label="Hintergrunddetails"
            help="Umgebungsebenen, Tiefe und gewünschte Ausarbeitung."
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Lichtdramaturgie und Detailgrad</legend>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="artworkLightingDrama"
            label="Lichtdramaturgie"
            help="Die emotionale Lichtwirkung der gesamten Komposition."
            options={LIGHTING_OPTIONS}
          />
          <SelectField
            form={form}
            name="artworkDetailLevel"
            label="Detailgrad"
            help="Von der Übersicht über das Produktionskonzept bis zum Showcase."
            options={DETAIL_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkLightingDetails"
            label="Lichtdetails"
            help="Lichtquellen, Temperatur, Kontrast und dramatische Akzente."
            wide
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="artworkExtraDetails"
            label="Zusatzdetails"
            help="Weitere freie Produktionshinweise; eingebrannte Schrift ist standardmäßig nicht vorgesehen."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>
    </div>
  );
}
