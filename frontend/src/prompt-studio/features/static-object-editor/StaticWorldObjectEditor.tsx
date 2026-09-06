import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { resolveCapabilities } from "../../domain/assets";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  STATIC_OBJECT_BASIC_SHAPE_IDS,
  STATIC_OBJECT_CONDITION_IDS,
  STATIC_OBJECT_INTERACTION_IDS,
  STATIC_OBJECT_MATERIAL_IDS,
  STATIC_OBJECT_PROPORTION_IDS,
  STATIC_OBJECT_PURPOSE_IDS,
  STATIC_OBJECT_SHADOW_MODE_IDS,
  STATIC_OBJECT_SYMMETRY_IDS,
  getDefaultStaticObjectClass,
  type StaticObjectBasicShape,
  type StaticObjectClass,
  type StaticObjectCondition,
  type StaticObjectInteraction,
  type StaticObjectMaterial,
  type StaticObjectProportion,
  type StaticObjectPurpose,
  type StaticObjectShadowMode,
  type StaticObjectSubtype,
  type StaticObjectSymmetry,
} from "../../domain/static-objects";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./StaticWorldObjectEditor.module.css";

type StaticObjectForm = UseFormReturn<WizardCoreFormValues>;

type StaticObjectTextFieldName =
  | "staticObjectDescription"
  | "staticObjectMaterialDetails"
  | "staticObjectDetailElements"
  | "staticObjectContents"
  | "staticObjectExtraDetails";

type StaticObjectSelectFieldName =
  | "staticObjectPurpose"
  | "staticObjectBasicShape"
  | "staticObjectProportion"
  | "staticObjectSymmetry"
  | "staticObjectPrimaryMaterial"
  | "staticObjectSecondaryMaterial"
  | "staticObjectCondition"
  | "staticObjectInteraction"
  | "staticObjectShadowMode";

type StaticObjectNumberFieldName =
  | "staticObjectFootprintWidthTiles"
  | "staticObjectFootprintDepthTiles"
  | "staticObjectVariantCount";

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

const SUBTYPE_LABELS: Readonly<Record<StaticObjectSubtype, string>> = {
  furniture: "Möbel",
  container: "Behälter",
  barrel: "Fass",
  crate: "Kiste",
  chest: "Truhe",
  door: "Tür",
  well: "Brunnen",
  sign: "Schild",
  pillar: "Säule",
  altar: "Altar",
  decoration: "Dekorationsobjekt",
  workTool: "Arbeitsgerät",
  interactiveObject: "Interaktives Objekt",
};

const CLASS_LABELS: Readonly<Record<StaticObjectClass, string>> = {
  furniture: "Möbel",
  container: "Behälter",
  door: "Tür",
  well: "Brunnen",
  sign: "Schild",
  pillar: "Säule",
  altar: "Altar",
  decoration: "Dekoration",
  workTool: "Arbeitsgerät",
  interactiveObject: "Interaktives Objekt",
};

const PURPOSE_LABELS: Readonly<Record<StaticObjectPurpose, string>> = {
  decorative: "Dekorativ",
  interactive: "Interaktiv",
  walkable: "Begehbar",
  blocking: "Blockiert Bewegung",
};

const BASIC_SHAPE_LABELS: Readonly<Record<StaticObjectBasicShape, string>> = {
  boxy: "Quaderförmig",
  cylindrical: "Zylindrisch",
  round: "Rund",
  planar: "Flach / planar",
  arched: "Bogenförmig",
  stepped: "Gestuft",
  organic: "Organisch",
  irregular: "Unregelmäßig",
  custom: "Individuell",
};

const PROPORTION_LABELS: Readonly<Record<StaticObjectProportion, string>> = {
  compact: "Kompakt",
  balanced: "Ausgewogen",
  tall: "Hoch",
  wide: "Breit",
  low: "Niedrig",
  slender: "Schlank",
  massive: "Massiv",
};

const SYMMETRY_LABELS: Readonly<Record<StaticObjectSymmetry, string>> = {
  bilateral: "Bilateral",
  radial: "Radial",
  asymmetric: "Asymmetrisch",
  none: "Keine definierte Symmetrie",
};

const MATERIAL_LABELS: Readonly<Record<StaticObjectMaterial, string>> = {
  wood: "Holz",
  stone: "Stein",
  metal: "Metall",
  ceramic: "Keramik",
  glass: "Glas",
  fabric: "Stoff",
  leather: "Leder",
  rope: "Seil",
  bone: "Knochen",
  organic: "Organisches Material",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
  custom: "Eigenes Material",
};

const CONDITION_LABELS: Readonly<Record<StaticObjectCondition, string>> = {
  clean: "Sauber / gepflegt",
  used: "Gebraucht",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  overgrown: "Überwuchert",
};

const INTERACTION_LABELS: Readonly<Record<StaticObjectInteraction, string>> = {
  none: "Keine Interaktion",
  open: "Öffnen",
  tilt: "Kippen",
  glow: "Leuchten",
  break: "Zerbrechen",
};

const SHADOW_LABELS: Readonly<Record<StaticObjectShadowMode, string>> = {
  none: "Kein eigener Schatten",
  contact: "Kleiner Kontaktschatten",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const PURPOSE_OPTIONS = optionsFromIds(STATIC_OBJECT_PURPOSE_IDS, PURPOSE_LABELS);
const BASIC_SHAPE_OPTIONS = optionsFromIds(STATIC_OBJECT_BASIC_SHAPE_IDS, BASIC_SHAPE_LABELS);
const PROPORTION_OPTIONS = optionsFromIds(STATIC_OBJECT_PROPORTION_IDS, PROPORTION_LABELS);
const SYMMETRY_OPTIONS = optionsFromIds(STATIC_OBJECT_SYMMETRY_IDS, SYMMETRY_LABELS);
const MATERIAL_OPTIONS = optionsFromIds(STATIC_OBJECT_MATERIAL_IDS, MATERIAL_LABELS);
const CONDITION_OPTIONS = optionsFromIds(STATIC_OBJECT_CONDITION_IDS, CONDITION_LABELS);
const INTERACTION_OPTIONS = optionsFromIds(STATIC_OBJECT_INTERACTION_IDS, INTERACTION_LABELS);
const SHADOW_OPTIONS = optionsFromIds(STATIC_OBJECT_SHADOW_MODE_IDS, SHADOW_LABELS);

function optionalTextValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value === "" ? undefined : value;
}

function optionalSelectValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalNumberValue(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fieldError(form: StaticObjectForm, field: keyof WizardCoreFormValues): string | null {
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

function SelectField({
  form,
  help,
  label,
  name,
  options,
}: Readonly<{
  form: StaticObjectForm;
  help: string;
  label: string;
  name: StaticObjectSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `static-object-${name}`;
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

function TextField({
  form,
  help,
  label,
  maxLength,
  name,
  notifyProgrammaticChange,
  wide = false,
}: Readonly<{
  form: StaticObjectForm;
  help: string;
  label: string;
  maxLength: number;
  name: StaticObjectTextFieldName;
  notifyProgrammaticChange: () => void;
  wide?: boolean;
}>) {
  const id = `static-object-${name}`;
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

function NumberField({
  form,
  help,
  label,
  max,
  min,
  name,
}: Readonly<{
  form: StaticObjectForm;
  help: string;
  label: string;
  max: number;
  min: number;
  name: StaticObjectNumberFieldName;
}>) {
  const id = `static-object-${name}`;
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

function ObjectClassField({
  objectClass,
  subtype,
}: Readonly<{
  objectClass: StaticObjectClass;
  subtype: StaticObjectSubtype;
}>) {
  return (
    <div className={styles.field}>
      <span id="static-object-class-label" className={styles.fieldLabel}>
        Objektklasse
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="static-object-class-label"
        aria-describedby="static-object-class-help"
      >
        {CLASS_LABELS[objectClass]}
      </output>
      <p id="static-object-class-help" className={styles.help}>
        Aus dem Untertyp {SUBTYPE_LABELS[subtype]} abgeleitet. Ein Wechsel erfolgt im Schritt
        Bildart.
      </p>
    </div>
  );
}

function TileSizeField({ tileSize }: Readonly<{ tileSize?: number }>) {
  return (
    <div className={styles.field}>
      <span id="static-object-tile-size-label" className={styles.fieldLabel}>
        Wirksame Tilegröße
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="static-object-tile-size-label"
        aria-describedby="static-object-tile-size-help"
      >
        {tileSize === undefined
          ? "Nicht festgelegt"
          : `${String(tileSize)} × ${String(tileSize)} px`}
      </output>
      <p id="static-object-tile-size-help" className={styles.help}>
        Technischer Wert aus der Basisprofil-Vererbung. Er wird nicht in den Objektantworten
        dupliziert.
      </p>
    </div>
  );
}

export interface StaticWorldObjectEditorProps {
  readonly form: StaticObjectForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: StaticObjectSubtype;
}

export function StaticWorldObjectEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: StaticWorldObjectEditorProps) {
  const objectClass = getDefaultStaticObjectClass(subtype);
  const capabilities = resolveCapabilities("staticObject", subtype);
  const tileSize = useWatch({ control: form.control, name: "tileSize" });
  const footprintWidth = useWatch({
    control: form.control,
    name: "staticObjectFootprintWidthTiles",
  });
  const footprintDepth = useWatch({
    control: form.control,
    name: "staticObjectFootprintDepthTiles",
  });
  const footprintIsPartial = (footprintWidth === undefined) !== (footprintDepth === undefined);

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="static-object-context-title">
        <div className={styles.contextCopy}>
          <p className={styles.eyebrow}>Statisches Weltobjekt</p>
          <h3 id="static-object-context-title">{SUBTYPE_LABELS[subtype]} gestalten</h3>
          <p className={styles.contextHelp}>
            Form, Material und Footprint bleiben im Weltmaßstab konsistent. Interaktion und
            Animation ändern niemals die Blickrichtung.
          </p>
        </div>
        <div className={styles.objectMark} aria-hidden="true">
          <span className={styles.objectTop} />
          <span className={styles.objectFront} />
          <span className={styles.objectSide} />
          <span className={styles.objectShadow} />
        </div>
        <ul className={styles.statusList} aria-label="Objekt-Capabilities">
          <li className={styles.statusBadge}>Keine Richtungsansichten</li>
          <li className={styles.statusBadge}>
            {capabilities.animated ? "Animation separat verfügbar" : "Statisches Einzelasset"}
          </li>
        </ul>
      </section>

      <section className={styles.animationNote} aria-labelledby="static-object-animation-title">
        <h3 id="static-object-animation-title">Interaktion und Animation bleiben getrennt</h3>
        <p>
          {capabilities.animated
            ? "Die fachliche Interaktion wird hier beschrieben. Eine optionale Öffnen-, Leuchten- oder Zerbrechen-Animation wird ausschließlich im folgenden Capability-Schritt gewählt."
            : "Dieser Untertyp erhält hier keine Animationsauswahl. Interaktion beschreibt nur seine Funktion in der Welt."}
        </p>
      </section>

      <fieldset className={styles.group}>
        <legend>Funktion und Grundform</legend>
        <p className={styles.groupIntro}>
          Definiere zuerst Spielzweck, große Formmassen und Silhouette des unbewegten Weltobjekts.
        </p>
        <div className={styles.fieldGrid}>
          <ObjectClassField objectClass={objectClass} subtype={subtype} />
          <SelectField
            form={form}
            name="staticObjectPurpose"
            label="Funktion / Zweck"
            help="Bestimmt, ob das Objekt dekoriert, blockiert, begehbar oder interaktiv ist."
            options={PURPOSE_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectBasicShape"
            label="Grundform"
            help="Große geometrische Form, die auch in nativer Pixelgröße lesbar bleibt."
            options={BASIC_SHAPE_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectProportion"
            label="Proportion"
            help="Verhältnis von Höhe, Breite und visueller Masse."
            options={PROPORTION_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectSymmetry"
            label="Symmetrie"
            help="Ordnung der großen Formelemente, nicht kleinteiliges Oberflächenrauschen."
            options={SYMMETRY_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="staticObjectDescription"
            label="Kurze Objektbeschreibung"
            help="Fasse Motiv, Funktion und wichtigste Erkennungsmerkmale zusammen."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Material, Zustand und Details</legend>
        <p className={styles.groupIntro}>
          Beschreibe Materialien als klare Flächen und Cluster, damit das Objekt trotz Alterung
          gameplay-lesbar bleibt.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="staticObjectPrimaryMaterial"
            label="Hauptmaterial"
            help="Dominantes Material der Silhouette und größten sichtbaren Flächen."
            options={MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectSecondaryMaterial"
            label="Sekundärmaterial"
            help="Optionales zweites Material für Beschläge, Einfassungen oder Akzente."
            options={MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectCondition"
            label="Zustand"
            help="Sauber, gebraucht, verwittert, beschädigt oder überwuchert."
            options={CONDITION_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="staticObjectMaterialDetails"
            label="Materialaufbau und Oberfläche"
            help="Beschreibe Maserung, Fugen, Beschläge, Bruchkanten oder Materialwechsel."
            maxLength={500}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="staticObjectDetailElements"
            label="Lesbare Detail-Elemente"
            help="Nenne funktionale Griffe, Bänder, Symbole, Kanten oder andere wichtige Details."
            maxLength={500}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Inhalt, Interaktion und Schatten</legend>
        <p className={styles.groupIntro}>
          Inhalt und Interaktion definieren den Spielzustand. Animation bleibt weiterhin dem
          separaten Capability-Schritt vorbehalten.
        </p>
        <div className={styles.fieldGrid}>
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="staticObjectContents"
            label="Sichtbarer Inhalt"
            help="Optionaler Inhalt, eine Einlage oder der Zustand des geöffneten Innenraums."
            maxLength={500}
            wide
          />
          <SelectField
            form={form}
            name="staticObjectInteraction"
            label="Interaktion"
            help="Fachliche Reaktion im Spiel; keine Animations- oder Richtungsdefinition."
            options={INTERACTION_OPTIONS}
          />
          <SelectField
            form={form}
            name="staticObjectShadowMode"
            label="Schatten"
            help="Kein eigener Schatten oder ein kleiner, weltlichtkonformer Kontaktschatten."
            options={SHADOW_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Standfläche und Varianten</legend>
        <p className={styles.groupIntro}>
          Breite und Tiefe bilden gemeinsam den optionalen Footprint. Ein einzelner Wert ist
          unvollständig und muss ergänzt oder geleert werden.
        </p>
        <div className={styles.fieldGrid}>
          <NumberField
            form={form}
            name="staticObjectFootprintWidthTiles"
            label="Standfläche · Breite in Tiles"
            help="Ganzzahlig von 1 bis 64; nur gemeinsam mit der Tiefe gültig."
            min={1}
            max={64}
          />
          <NumberField
            form={form}
            name="staticObjectFootprintDepthTiles"
            label="Standfläche · Tiefe in Tiles"
            help="Ganzzahlig von 1 bis 64; nur gemeinsam mit der Breite gültig."
            min={1}
            max={64}
          />
          <NumberField
            form={form}
            name="staticObjectVariantCount"
            label="Verwandte Varianten"
            help="Ein bis zwölf zusammengehörige Objektvarianten."
            min={1}
            max={12}
          />
          <TileSizeField {...(tileSize === undefined ? {} : { tileSize })} />
        </div>
        {footprintIsPartial ? (
          <p className={styles.footprintWarning} role="status" aria-label="Footprint-Hinweis">
            Der Footprint ist unvollständig. Ergänze Breite und Tiefe gemeinsam oder leere beide
            Werte.
          </p>
        ) : null}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Weitere Objektdetails</legend>
        <div className={styles.fieldGrid}>
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="staticObjectExtraDetails"
            label="Weitere Objektdetails"
            help="Optionale Ergänzungen zu Nutzungskontext, Farbwirkung, Alterung oder Lesbarkeit."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>
    </div>
  );
}
