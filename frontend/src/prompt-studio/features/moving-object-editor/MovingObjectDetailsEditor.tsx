import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { resolveCapabilities } from "../../domain/assets";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  MOVING_OBJECT_ANCHOR_MODE_IDS,
  MOVING_OBJECT_CONDITION_IDS,
  MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS,
  MOVING_OBJECT_MATERIAL_IDS,
  MOVING_OBJECT_MECHANISM_IDS,
  MOVING_OBJECT_MOVEMENT_TYPE_IDS,
  MOVING_OBJECT_SHADOW_MODE_IDS,
  getDefaultMovingObjectClass,
  type MovingObjectAnchorMode,
  type MovingObjectClass,
  type MovingObjectCondition,
  type MovingObjectLightingBehavior,
  type MovingObjectMaterial,
  type MovingObjectMechanism,
  type MovingObjectMovementType,
  type MovingObjectShadowMode,
  type MovingObjectSubtype,
} from "../../domain/moving-objects";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./MovingObjectEditor.module.css";

type MovingObjectForm = UseFormReturn<WizardCoreFormValues>;

type MovingObjectTextFieldName =
  | "movingObjectPurpose"
  | "movingObjectBasicShape"
  | "movingObjectDescription"
  | "movingObjectMaterialDetails"
  | "movingObjectExtraDetails";

type MovingObjectSelectFieldName =
  | "movingObjectAnchorMode"
  | "movementType"
  | "movingObjectMechanism"
  | "movingObjectMaterial"
  | "movingObjectCondition"
  | "movingObjectLightingBehavior"
  | "movingObjectShadowMode";

type MovingObjectNumberFieldName =
  | "movingObjectFootprintWidthTiles"
  | "movingObjectFootprintDepthTiles"
  | "movingObjectHeightPixels";

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

interface TextFieldDefinition {
  readonly name: MovingObjectTextFieldName;
  readonly label: string;
  readonly help: string;
  readonly maxLength: number;
  readonly multiline?: boolean;
  readonly wide?: boolean;
}

const SUBTYPE_LABELS: Readonly<Record<MovingObjectSubtype, string>> = {
  cart: "Karren / Wagen",
  rollingObject: "Rollendes Objekt",
  floatingObject: "Schwebendes Objekt",
  floatingCrystal: "Schwebender Kristall",
  slidingObject: "Gleitendes Objekt",
  mechanicalConstruct: "Mechanische Konstruktion",
  boat: "Boot",
  platform: "Plattform",
  magicObject: "Magisches Objekt",
  nonHumanoidUnit: "Nicht-humanoide Einheit",
};

const CLASS_LABELS: Readonly<Record<MovingObjectClass, string>> = {
  cart: "Karren / Wagen",
  rollingObject: "Rollendes Objekt",
  floatingObject: "Schwebendes Objekt",
  slidingObject: "Gleitendes Objekt",
  mechanicalConstruct: "Mechanische Konstruktion",
  boat: "Boot",
  platform: "Plattform",
  magicObject: "Magisches Objekt",
  nonHumanoidUnit: "Nicht-humanoide Einheit",
};

const MOVEMENT_LABELS: Readonly<Record<MovingObjectMovementType, string>> = {
  roll: "Rollen",
  slide: "Gleiten",
  hover: "Schweben",
  walk: "Laufen",
  crawl: "Kriechen",
  fly: "Fliegen",
  rotate: "Rotieren",
};

const ANCHOR_LABELS: Readonly<Record<MovingObjectAnchorMode, string>> = {
  automatic: "Automatisch nach Objektklasse",
  bottomCenter: "Unten mittig",
  footprintCenter: "Mitte der Standfläche",
  canvasCenter: "Exakte Canvas-Mitte",
};

const MECHANISM_LABELS: Readonly<Record<MovingObjectMechanism, string>> = {
  none: "Kein sichtbarer Antrieb",
  wheels: "Räder",
  joints: "Gelenke",
  wings: "Flügel",
  rails: "Schienen",
  magicDrive: "Magischer Antrieb",
  mixed: "Gemischte Mechanik",
};

const MATERIAL_LABELS: Readonly<Record<MovingObjectMaterial, string>> = {
  wood: "Holz",
  metal: "Metall",
  fabric: "Stoff",
  stone: "Stein",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
};

const CONDITION_LABELS: Readonly<Record<MovingObjectCondition, string>> = {
  new: "Neu",
  used: "Gebraucht",
  damaged: "Beschädigt",
  improvised: "Provisorisch",
};

const LIGHTING_LABELS: Readonly<Record<MovingObjectLightingBehavior, string>> = {
  neutral: "Neutral",
  emissive: "Emissiv",
  warm: "Warm",
  cool: "Kühl",
  diffuse: "Diffus",
};

const SHADOW_LABELS: Readonly<Record<MovingObjectShadowMode, string>> = {
  none: "Keiner",
  contact: "Kleiner Kontaktschatten",
  motionAdjusted: "Kleine bewegungsabhängige Anpassung",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const MOVEMENT_OPTIONS = optionsFromIds(MOVING_OBJECT_MOVEMENT_TYPE_IDS, MOVEMENT_LABELS);
const ANCHOR_OPTIONS = optionsFromIds(MOVING_OBJECT_ANCHOR_MODE_IDS, ANCHOR_LABELS);
const MECHANISM_OPTIONS = optionsFromIds(MOVING_OBJECT_MECHANISM_IDS, MECHANISM_LABELS);
const MATERIAL_OPTIONS = optionsFromIds(MOVING_OBJECT_MATERIAL_IDS, MATERIAL_LABELS);
const CONDITION_OPTIONS = optionsFromIds(MOVING_OBJECT_CONDITION_IDS, CONDITION_LABELS);
const LIGHTING_OPTIONS = optionsFromIds(MOVING_OBJECT_LIGHTING_BEHAVIOR_IDS, LIGHTING_LABELS);
const SHADOW_OPTIONS = optionsFromIds(MOVING_OBJECT_SHADOW_MODE_IDS, SHADOW_LABELS);

const OBJECT_CORE_FIELDS = Object.freeze([
  {
    name: "movingObjectPurpose",
    label: "Zweck / Funktion",
    help: "Beschreibe, wofür das Objekt in der Spielwelt eingesetzt wird.",
    maxLength: 200,
  },
  {
    name: "movingObjectBasicShape",
    label: "Grundform",
    help: "Nenne die großen, auch in nativer Größe lesbaren Formmassen.",
    maxLength: 200,
  },
  {
    name: "movingObjectDescription",
    label: "Kurze Objektbeschreibung",
    help: "Fasse Motiv, Konstruktion und wichtigste Erkennungsmerkmale zusammen.",
    maxLength: 4000,
    multiline: true,
    wide: true,
  },
] as const satisfies readonly TextFieldDefinition[]);

function optionalTextValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalSelectValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalNumberValue(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fieldError(form: MovingObjectForm, field: keyof WizardCoreFormValues): string | null {
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
    <div className={wide ? `${styles.field} ${styles.wideField}` : styles.field}>
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

function TextField({
  definition,
  form,
  notifyProgrammaticChange,
}: Readonly<{
  definition: TextFieldDefinition;
  form: MovingObjectForm;
  notifyProgrammaticChange: () => void;
}>) {
  const { help, label, maxLength, name } = definition;
  const id = `moving-object-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  const registration = form.register(name, { setValueAs: optionalTextValue });
  const value = useWatch({ control: form.control, name });

  return (
    <GuidedTextChoice
      describedBy={describedBy}
      error={error}
      errorClassName={styles.error}
      fieldClassName={definition.wide ? `${styles.field} ${styles.wideField}` : styles.field}
      help={help}
      helpClassName={styles.help}
      id={id}
      label={label}
      maxLength={maxLength}
      {...(definition.multiline === undefined ? {} : { multiline: definition.multiline })}
      onChoose={(nextValue) => {
        form.setValue(name, nextValue, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        notifyProgrammaticChange();
      }}
      presets={GUIDED_TEXT_PRESETS_DE[name]}
      registration={registration}
      value={value}
    />
  );
}

function SelectField({
  form,
  help,
  label,
  name,
  options,
}: Readonly<{
  form: MovingObjectForm;
  help: string;
  label: string;
  name: MovingObjectSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `moving-object-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register(name, { setValueAs: optionalSelectValue })}
      >
        <option value="">Nicht festgelegt</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function NumberField({
  form,
  help,
  label,
  max,
  min,
  name,
}: Readonly<{
  form: MovingObjectForm;
  help: string;
  label: string;
  max: number;
  min: number;
  name: MovingObjectNumberFieldName;
}>) {
  const id = `moving-object-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        inputMode="numeric"
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register(name, { setValueAs: optionalNumberValue })}
      />
    </FieldShell>
  );
}

function DerivedObjectClass({
  defaultClass,
  form,
  subtype,
}: Readonly<{
  defaultClass: MovingObjectClass;
  form: MovingObjectForm;
  subtype: MovingObjectSubtype;
}>) {
  return (
    <div className={styles.field}>
      <span id="moving-object-class-label" className={styles.fieldLabel}>
        Objektklasse
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="moving-object-class-label"
        aria-describedby="moving-object-class-help"
      >
        {CLASS_LABELS[defaultClass]}
      </output>
      <input type="hidden" {...form.register("movingObjectClass")} />
      <p id="moving-object-class-help" className={styles.help}>
        Aus dem Untertyp {SUBTYPE_LABELS[subtype]} eindeutig abgeleitet.
      </p>
    </div>
  );
}

export interface MovingObjectDetailsEditorProps {
  readonly form: MovingObjectForm;
  readonly notifyProgrammaticChange: () => void;
  readonly section?: MovingObjectDetailsSection;
  readonly subtype: MovingObjectSubtype;
}

export type MovingObjectDetailsSection =
  "core" | "scale" | "motion" | "material" | "lighting" | "details";

export function MovingObjectDetailsEditor({
  form,
  notifyProgrammaticChange,
  section,
  subtype,
}: MovingObjectDetailsEditorProps) {
  const capabilities = resolveCapabilities("movingObject", subtype);
  const defaultClass = getDefaultMovingObjectClass(subtype);

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="moving-object-context-title">
        <div>
          <p className={styles.eyebrow}>Capability aus dem Untertyp</p>
          <h3 id="moving-object-context-title">Objektlogik</h3>
          <p className={styles.contextHelp}>
            {SUBTYPE_LABELS[subtype]} bestimmt die technische Richtungslogik. Die Objektklasse
            beschreibt das Motiv und ändert diese Capability nicht.
          </p>
        </div>
        <ul className={styles.statusList} aria-label="Objekt-Capabilities">
          <li className={styles.statusBadge}>
            {capabilities.directional ? "Richtungsset verfügbar" : "Keine Richtungsansichten"}
          </li>
          <li className={styles.statusBadge}>Animation verfügbar</li>
        </ul>
      </section>

      {section === undefined || section === "core" ? (
        <fieldset className={styles.group}>
          <legend>Objektkern</legend>
          <p className={styles.groupIntro}>
            Definiere Funktion und große Formmassen, bevor Mechanik und Material ergänzt werden.
          </p>
          <div className={styles.fieldGrid}>
            <DerivedObjectClass defaultClass={defaultClass} form={form} subtype={subtype} />
            {OBJECT_CORE_FIELDS.map((definition) => (
              <TextField
                key={definition.name}
                definition={definition}
                form={form}
                notifyProgrammaticChange={notifyProgrammaticChange}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {section === undefined || section === "scale" ? (
        <fieldset className={styles.group}>
          <legend>Maßstab und Anker</legend>
          <p className={styles.groupIntro}>
            Die Standfläche verwendet das geerbte Tile-Raster. Breite und Tiefe bilden gemeinsam
            einen optionalen Footprint.
          </p>
          <div className={styles.fieldGrid}>
            <NumberField
              form={form}
              name="movingObjectFootprintWidthTiles"
              label="Standfläche · Breite in Tiles"
              help="Ganzzahlig von 1 bis 64; zusammen mit der Tiefe angeben."
              min={1}
              max={64}
            />
            <NumberField
              form={form}
              name="movingObjectFootprintDepthTiles"
              label="Standfläche · Tiefe in Tiles"
              help="Ganzzahlig von 1 bis 64; zusammen mit der Breite angeben."
              min={1}
              max={64}
            />
            <NumberField
              form={form}
              name="movingObjectHeightPixels"
              label="Objekthöhe in Pixel"
              help="Asset-spezifische Höhe von 16 bis 2048 px; kein Figurenmaßstab."
              min={16}
              max={2048}
            />
            <SelectField
              form={form}
              name="movingObjectAnchorMode"
              label="Ausrichtungsanker"
              help="Die Mitte der Standfläche ist der empfohlene Ausgangspunkt für bewegliche Objekte."
              options={ANCHOR_OPTIONS}
            />
          </div>
        </fieldset>
      ) : null}

      {section === undefined || section === "motion" ? (
        <fieldset className={styles.group}>
          <legend>Bewegung und Mechanik</legend>
          <p className={styles.groupIntro}>
            Bewegungsart und sichtbarer Antrieb müssen in jeder Ansicht konstruktiv zusammenpassen.
          </p>
          <div className={styles.fieldGrid}>
            <SelectField
              form={form}
              name="movementType"
              label="Bewegungsart"
              help="Die Fortbewegungslogik ist unabhängig von einer zeitlichen Animation."
              options={MOVEMENT_OPTIONS}
            />
            <SelectField
              form={form}
              name="movingObjectMechanism"
              label="Mechanik / Antrieb"
              help="Wähle das sichtbar tragende Bewegungsprinzip."
              options={MECHANISM_OPTIONS}
            />
          </div>
        </fieldset>
      ) : null}

      {section === undefined || section === "material" ? (
        <fieldset className={styles.group}>
          <legend>Material und Zustand</legend>
          <p className={styles.groupIntro}>
            Lege Materialgruppen und Abnutzung so fest, dass sie über alle Frames konsistent
            bleiben.
          </p>
          <div className={styles.fieldGrid}>
            <SelectField
              form={form}
              name="movingObjectMaterial"
              label="Hauptmaterial"
              help="Dominantes Material oder klar getrennte Mischung."
              options={MATERIAL_OPTIONS}
            />
            <SelectField
              form={form}
              name="movingObjectCondition"
              label="Zustand"
              help="Gesamtwirkung von Konstruktion, Material und Reparaturen."
              options={CONDITION_OPTIONS}
            />
            <TextField
              form={form}
              notifyProgrammaticChange={notifyProgrammaticChange}
              definition={{
                name: "movingObjectMaterialDetails",
                label: "Materialdetails",
                help: "Beschreibe Materialaufteilung, Oberflächen und wichtige Übergänge.",
                maxLength: 500,
                multiline: true,
                wide: true,
              }}
            />
          </div>
        </fieldset>
      ) : null}

      {section === undefined || section === "lighting" ? (
        <fieldset className={styles.group}>
          <legend>Licht und Bodenkontakt</legend>
          <p className={styles.groupIntro}>
            Lokales Leuchtverhalten ergänzt die geerbte Weltbeleuchtung, ohne die feste Lichtseite
            zu ersetzen.
          </p>
          <div className={styles.fieldGrid}>
            <SelectField
              form={form}
              name="movingObjectLightingBehavior"
              label="Lichtverhalten"
              help="Emissive Akzente bleiben begrenzt und ändern nicht die Weltlichtseite."
              options={LIGHTING_OPTIONS}
            />
            <SelectField
              form={form}
              name="movingObjectShadowMode"
              label="Bodenschatten"
              help="Eine bewegungsabhängige Anpassung bleibt klein und am Anker gebunden."
              options={SHADOW_OPTIONS}
            />
          </div>
        </fieldset>
      ) : null}

      {section === undefined || section === "details" ? (
        <fieldset className={styles.group}>
          <legend>Weitere Produktionsdetails</legend>
          <div className={styles.fieldGrid}>
            <TextField
              form={form}
              notifyProgrammaticChange={notifyProgrammaticChange}
              definition={{
                name: "movingObjectExtraDetails",
                label: "Weitere Objektdetails",
                help: "Optionale Ergänzungen, die keiner anderen Gruppe eindeutig zugeordnet sind.",
                maxLength: 4000,
                multiline: true,
                wide: true,
              }}
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
