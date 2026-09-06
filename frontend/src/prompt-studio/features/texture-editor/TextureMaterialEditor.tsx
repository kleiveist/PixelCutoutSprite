import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  TEXTURE_CONDITION_IDS,
  TEXTURE_ICING_IDS,
  TEXTURE_LIGHTING_IDS,
  TEXTURE_MOISTURE_IDS,
  TEXTURE_ORIENTATION_IDS,
  TEXTURE_STRUCTURE_IDS,
  TEXTURE_SURFACE_IDS,
  TEXTURE_USAGE_IDS,
  getDefaultTextureMaterialType,
  type TextureCondition,
  type TextureIcing,
  type TextureLighting,
  type TextureMaterialType,
  type TextureMoisture,
  type TextureOrientation,
  type TextureStructure,
  type TextureSubtype,
  type TextureSurface,
  type TextureUsage,
} from "../../domain/textures";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./TextureMaterialEditor.module.css";

type TextureForm = UseFormReturn<WizardCoreFormValues>;

type TextureTextFieldName = "textureDescription" | "textureExtraDetails";

type TextureSelectFieldName =
  | "textureUsage"
  | "textureStructure"
  | "textureCondition"
  | "textureSurface"
  | "textureMoisture"
  | "textureIcing"
  | "textureLighting"
  | "textureOrientation";

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

const MATERIAL_LABELS: Readonly<Record<TextureMaterialType, string>> = {
  wood: "Holz",
  stone: "Stein",
  snow: "Schnee",
  ice: "Eis",
  earth: "Erde",
  sand: "Sand",
  grass: "Gras",
  moss: "Moos",
  metal: "Metall",
  fabric: "Stoff",
  leather: "Leder",
  brick: "Ziegel",
  paving: "Pflaster",
  clay: "Lehm",
  ceramic: "Keramik",
  customMaterial: "Eigenes Material",
};

const USAGE_LABELS: Readonly<Record<TextureUsage, string>> = {
  floor: "Boden",
  wall: "Wand",
  roof: "Dach",
  surface: "Objektoberfläche",
  clothing: "Kleidung",
  decor: "Dekor",
};

const ORIENTATION_LABELS: Readonly<Record<TextureOrientation, string>> = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  radial: "Radial",
  unordered: "Ungeordnet",
  grainAligned: "Entlang der Maserung",
};

const STRUCTURE_LABELS: Readonly<Record<TextureStructure, string>> = {
  fine: "Fein",
  medium: "Mittel",
  coarse: "Grob",
};

const CONDITION_LABELS: Readonly<Record<TextureCondition, string>> = {
  new: "Neu",
  polished: "Poliert",
  rough: "Rau",
  old: "Alt",
  wet: "Nass",
  frosted: "Frostig",
  damaged: "Beschädigt",
  dirty: "Verschmutzt",
};

const SURFACE_LABELS: Readonly<Record<TextureSurface, string>> = {
  continuous: "Durchgehende Fläche",
  planked: "Planken / Bretter",
  jointed: "Gefügt / mit Fugen",
  cracked: "Rissstruktur",
  granular: "Körnig",
  layered: "Geschichtet",
  woven: "Gewebt",
  organic: "Organisch",
};

const MOISTURE_LABELS: Readonly<Record<TextureMoisture, string>> = {
  dry: "Trocken",
  damp: "Feucht",
  wet: "Nass",
};

const ICING_LABELS: Readonly<Record<TextureIcing, string>> = {
  none: "Keine Vereisung",
  lightFrost: "Leichter Reif",
  frosted: "Vereist",
  iceCrusted: "Eiskruste",
};

const LIGHTING_LABELS: Readonly<Record<TextureLighting, string>> = {
  neutralEven: "Neutral und gleichmäßig",
  contextual: "Kontextabhängig",
  worldAligned: "Feste Weltlichtseite",
};

const MATERIAL_GUIDANCE: Readonly<Record<TextureMaterialType, string>> = {
  wood: "Holzart, Maserung, Plankenbreite, Knoten, Schnittart, Lack und Alter festlegen.",
  stone: "Gesteinsart, Fugen, Bruch, Porosität sowie optional Moos und Nässe festlegen.",
  snow: "Pulvertiefe, Kruste, Glitzern, Verwehung und saubere oder betretene Bereiche festlegen.",
  ice: "Transparenzwirkung, Brüche, eingeschlossene Strukturen und Oberflächenfrost festlegen.",
  earth: "Körnung, Verdichtung, Steineinschlüsse, Risse und Feuchtigkeit festlegen.",
  sand: "Korngröße, Verwehung, Verdichtung und kontrollierte Farbvariation festlegen.",
  grass: "Halmlänge, Dichte, Trockenheit, Bodenanteil und weiche Übergänge festlegen.",
  moss: "Polsterdichte, Feuchtigkeit, Untergrundanteil und organische Kanten festlegen.",
  metal: "Metallart, Schmiedespuren, Rost, Politur und Kantenabrieb festlegen.",
  fabric: "Webart, Faltenmaßstab, Dicke, Muster und Ausfransung festlegen.",
  leather: "Lederart, Narbung, Nähte, Falten, Glanz und Gebrauchsspuren festlegen.",
  brick: "Ziegelformat, Verband, Fugenbreite, Kantenbruch und Farbvariation festlegen.",
  paving: "Steinformat, Verlegemuster, Fugen, Abnutzung und Bewuchs festlegen.",
  clay: "Körnung, Risse, Verarbeitungsspuren, Feuchtigkeit und Brennwirkung festlegen.",
  ceramic: "Glasur, Fugen, Kanten, Haarrisse, Muster und Glanz kontrolliert festlegen.",
  customMaterial:
    "Unterart, Aufbau, typische Oberflächenelemente und gewünschte Wirkung eindeutig beschreiben.",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const USAGE_OPTIONS = optionsFromIds(TEXTURE_USAGE_IDS, USAGE_LABELS);
const ORIENTATION_OPTIONS = optionsFromIds(TEXTURE_ORIENTATION_IDS, ORIENTATION_LABELS);
const STRUCTURE_OPTIONS = optionsFromIds(TEXTURE_STRUCTURE_IDS, STRUCTURE_LABELS);
const CONDITION_OPTIONS = optionsFromIds(TEXTURE_CONDITION_IDS, CONDITION_LABELS);
const SURFACE_OPTIONS = optionsFromIds(TEXTURE_SURFACE_IDS, SURFACE_LABELS);
const MOISTURE_OPTIONS = optionsFromIds(TEXTURE_MOISTURE_IDS, MOISTURE_LABELS);
const ICING_OPTIONS = optionsFromIds(TEXTURE_ICING_IDS, ICING_LABELS);
const LIGHTING_OPTIONS = optionsFromIds(TEXTURE_LIGHTING_IDS, LIGHTING_LABELS);

function optionalTextValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalSelectValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function fieldError(form: TextureForm, field: keyof WizardCoreFormValues): string | null {
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
  form: TextureForm;
  help: string;
  label: string;
  name: TextureSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `texture-${name}`;
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
}: Readonly<{
  form: TextureForm;
  help: string;
  label: string;
  maxLength: number;
  name: TextureTextFieldName;
  notifyProgrammaticChange: () => void;
}>) {
  const id = `texture-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  const value = useWatch({ control: form.control, name });

  return (
    <GuidedTextChoice
      describedBy={describedBy}
      error={error}
      errorClassName={styles.error}
      fieldClassName={`${styles.field} ${styles.wideField}`}
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

function SeamlessField({ form }: Readonly<{ form: TextureForm }>) {
  const id = "texture-seamless";
  const error = fieldError(form, "seamless");
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell
      error={error}
      help="Wähle bewusst, ob gegenüberliegende Kanten ohne sichtbare Naht anschließen müssen."
      id={id}
      label="Nahtlos kachelbar?"
    >
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register("seamless", { setValueAs: optionalBooleanValue })}
      >
        <option value="">Nicht festgelegt</option>
        <option value="true">Ja, an allen Kanten nahtlos</option>
        <option value="false">Nein, einzelne Materialfläche</option>
      </select>
    </FieldShell>
  );
}

function MaterialTypeField({
  form,
  materialType,
}: Readonly<{
  form: TextureForm;
  materialType: TextureMaterialType;
}>) {
  const error = fieldError(form, "textureMaterialType");

  return (
    <div className={styles.field}>
      <span id="texture-material-label" className={styles.fieldLabel}>
        Materialtyp
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="texture-material-label"
        aria-describedby={`texture-material-help${error ? " texture-material-error" : ""}`}
      >
        {MATERIAL_LABELS[materialType]}
      </output>
      <p id="texture-material-help" className={styles.help}>
        Aus dem zuvor gewählten Untertyp abgeleitet. Ein Materialwechsel erfolgt im Schritt Bildart.
      </p>
      {error ? (
        <p id="texture-material-error" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TileSizeField({ tileSize }: Readonly<{ tileSize?: number }>) {
  return (
    <div className={styles.field}>
      <span id="texture-tile-size-label" className={styles.fieldLabel}>
        Wirksame Tilegröße
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="texture-tile-size-label"
        aria-describedby="texture-tile-size-help"
      >
        {tileSize === undefined
          ? "Nicht festgelegt"
          : `${String(tileSize)} × ${String(tileSize)} px`}
      </output>
      <p id="texture-tile-size-help" className={styles.help}>
        Technischer Wert aus der Basisprofil-Vererbung. Änderungen erfolgen im Basisprofil-Schritt
        und werden hier nicht dupliziert.
      </p>
    </div>
  );
}

export interface TextureMaterialEditorProps {
  readonly form: TextureForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: TextureSubtype;
}

export function TextureMaterialEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: TextureMaterialEditorProps) {
  const materialType = getDefaultTextureMaterialType(subtype);
  const tileSize = useWatch({ control: form.control, name: "tileSize" });

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="texture-context-title">
        <div>
          <p className={styles.eyebrow}>Fokussierter Material-Workflow</p>
          <h3 id="texture-context-title">
            {materialType === "customMaterial"
              ? "Eigene Materialtextur"
              : `${MATERIAL_LABELS[materialType]}textur`}
          </h3>
          <p className={styles.contextHelp}>
            Nur Material-, Oberflächen- und Kachelregeln werden erfasst. Der Editor enthält keine
            Figuren-, Kleidungs-, Bewegungs- oder Richtungsfragen.
          </p>
        </div>
        <ul className={styles.statusList} aria-label="Texturregeln">
          <li className={styles.statusBadge}>Materialfokus</li>
          <li className={styles.statusBadge}>Keine Richtungsfragen</li>
        </ul>
      </section>

      <aside
        className={materialType === "wood" ? styles.woodFocus : styles.materialFocus}
        aria-labelledby="texture-material-guidance-title"
      >
        <span className={styles.materialSwatch} aria-hidden="true" />
        <div>
          <h3 id="texture-material-guidance-title">
            {materialType === "wood" ? "Holz im Produktionsfokus" : "Materialhinweis"}
          </h3>
          <p>{MATERIAL_GUIDANCE[materialType]}</p>
        </div>
      </aside>

      <fieldset className={styles.group}>
        <legend>Material und Verwendung</legend>
        <p className={styles.groupIntro}>
          Konkretisiere Unterart und Einsatz, ohne den bereits gewählten Material-Untertyp doppelt
          zu pflegen.
        </p>
        <div className={styles.fieldGrid}>
          <MaterialTypeField form={form} materialType={materialType} />
          <SelectField
            form={form}
            name="textureUsage"
            label="Einsatzbereich"
            help="Bestimmt, ob die Materialstruktur als Boden, Wand, Dach, Oberfläche, Kleidung oder Dekor gelesen wird."
            options={USAGE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="textureDescription"
            label={
              materialType === "customMaterial"
                ? "Eigenes Material beschreiben"
                : "Unterart und gewünschte Wirkung"
            }
            help="Beschreibe Material-Unterart, typische Merkmale und die gewünschte visuelle Wirkung."
            maxLength={4000}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Kachel und Raster</legend>
        <p className={styles.groupIntro}>
          Kachelbarkeit ist eine bewusste Assetentscheidung; die Tilegröße bleibt ein zentral
          vererbter technischer Wert.
        </p>
        <div className={styles.fieldGrid}>
          <SeamlessField form={form} />
          <TileSizeField {...(tileSize === undefined ? {} : { tileSize })} />
        </div>
        <p className={styles.logicNote}>
          <strong>Nahtlose Produktion</strong>
          <span>
            Bei „Ja“ müssen alle gegenüberliegenden Kanten anschließen; Randvignetten und auffällige
            Wiederholungsmuster werden vermieden.
          </span>
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Struktur und Oberfläche</legend>
        <p className={styles.groupIntro}>
          Formuliere Struktur und Ausrichtung so, dass sie in nativer Tileauflösung klar, aber nicht
          rauschend lesbar bleiben.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="textureStructure"
            label="Strukturgrad"
            help="Steuert die Größe der sichtbaren Materialcluster."
            options={STRUCTURE_OPTIONS}
          />
          <SelectField
            form={form}
            name="textureSurface"
            label="Oberflächenaufbau"
            help="Dominantes Aufbauprinzip wie Planken, Fugen, Risse, Schichten oder Gewebe."
            options={SURFACE_OPTIONS}
          />
          <SelectField
            form={form}
            name="textureOrientation"
            label="Oberflächenrichtung"
            help="Legt die Leserichtung der Struktur oder Maserung fest."
            options={ORIENTATION_OPTIONS}
          />
          <SelectField
            form={form}
            name="textureCondition"
            label="Zustand"
            help="Beschreibt Alter, Bearbeitung und sichtbare Beanspruchung der Fläche."
            options={CONDITION_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Feuchtigkeit, Vereisung und Licht</legend>
        <p className={styles.groupIntro}>
          Wetterauflage und Beleuchtung bleiben getrennt, damit wiederverwendbare Materialien keine
          unbeabsichtigten harten Lichtflecken erhalten.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="textureMoisture"
            label="Feuchtigkeit"
            help="Trockenheit oder Nässe beeinflusst Farbe, Glanz und Kontrast."
            options={MOISTURE_OPTIONS}
          />
          <SelectField
            form={form}
            name="textureIcing"
            label="Vereisung"
            help="Frost und Eiskrusten werden als eigene Oberflächenauflage geführt."
            options={ICING_OPTIONS}
          />
          <SelectField
            form={form}
            name="textureLighting"
            label="Materialbeleuchtung"
            help="Neutrales, gleichmäßiges Licht ist für wiederverwendbare Texturen die sichere Wahl."
            options={LIGHTING_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Weitere Materialdetails</legend>
        <div className={styles.fieldGrid}>
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="textureExtraDetails"
            label="Farben, Elemente und Randregeln"
            help="Optionale Angaben zu Grundton, Variation, Akzenten, Fugen, Knoten, Rissen, Körnung und weiteren Randregeln."
            maxLength={4000}
          />
        </div>
      </fieldset>
    </div>
  );
}
