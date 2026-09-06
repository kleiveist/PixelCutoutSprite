import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  ITEM_CONDITION_IDS,
  ITEM_GLOW_MODE_IDS,
  ITEM_MATERIAL_IDS,
  ITEM_PRESENTATION_IDS,
  ITEM_PURPOSE_IDS,
  ITEM_READABILITY_IDS,
  ITEM_SHADOW_MODE_IDS,
  ITEM_SIGNIFICANCE_IDS,
  ITEM_SIZE_IDS,
  ITEM_WEAR_POSITION_IDS,
  getDefaultItemClass,
  itemSubtypeSupportsWearPosition,
  type ItemClass,
  type ItemCondition,
  type ItemGlowMode,
  type ItemMaterial,
  type ItemPresentation,
  type ItemPurpose,
  type ItemReadability,
  type ItemShadowMode,
  type ItemSignificance,
  type ItemSize,
  type ItemSubtype,
  type ItemWearPosition,
} from "../../domain/items";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./ItemEquipmentEditor.module.css";

type ItemForm = UseFormReturn<WizardCoreFormValues>;
type ItemTextFieldName =
  | "itemDescription"
  | "itemMaterialDetails"
  | "itemFunctionDetails"
  | "itemMeaningDetails"
  | "itemSilhouette"
  | "itemExtraDetails";
type ItemSelectFieldName =
  | "itemPurpose"
  | "itemPresentation"
  | "itemWearPosition"
  | "itemSize"
  | "itemPrimaryMaterial"
  | "itemSecondaryMaterial"
  | "itemCondition"
  | "itemSignificance"
  | "itemReadability"
  | "itemGlowMode"
  | "itemShadowMode";
type ItemNumberFieldName = "itemIconSize" | "itemVariantCount";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

const SUBTYPE_LABELS: Readonly<Record<ItemSubtype, string>> = {
  weapon: "Waffe",
  tool: "Werkzeug",
  clothing: "Kleidung",
  armorPiece: "Rüstungsteil",
  bag: "Tasche",
  jewelry: "Schmuck",
  consumable: "Verbrauchsgegenstand",
  keyItem: "Schlüsselgegenstand",
  questItem: "Questgegenstand",
  collectible: "Sammelobjekt",
};

const CLASS_LABELS: Readonly<Record<ItemClass, string>> = {
  weapon: "Waffe",
  tool: "Werkzeug",
  clothing: "Kleidung",
  armor: "Rüstung",
  bag: "Tasche",
  jewelry: "Schmuck",
  consumable: "Verbrauchsgegenstand",
  keyItem: "Schlüsselgegenstand",
  questItem: "Questgegenstand",
  collectible: "Sammelobjekt",
};

const PURPOSE_LABELS: Readonly<Record<ItemPurpose, string>> = {
  practical: "Praktisch",
  decorative: "Dekorativ",
  wearable: "Tragbar",
  usable: "Benutzbar",
};
const PRESENTATION_LABELS: Readonly<Record<ItemPresentation, string>> = {
  icon: "Inventar-Icon",
  worldAsset: "Objekt in der Welt",
  equipped: "Ausgerüstete Darstellung",
};
const WEAR_POSITION_LABELS: Readonly<Record<ItemWearPosition, string>> = {
  head: "Kopf",
  neck: "Hals",
  hand: "Hand",
  body: "Körper",
  back: "Rücken",
  belt: "Gürtel",
};
const MATERIAL_LABELS: Readonly<Record<ItemMaterial, string>> = {
  wood: "Holz",
  metal: "Metall",
  leather: "Leder",
  fabric: "Stoff",
  glass: "Glas",
  ceramic: "Keramik",
  stone: "Stein",
  bone: "Knochen",
  organic: "Organisches Material",
  liquid: "Flüssigkeit",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
  custom: "Eigenes Material",
};
const CONDITION_LABELS: Readonly<Record<ItemCondition, string>> = {
  new: "Neu / makellos",
  used: "Gebraucht",
  worn: "Abgenutzt",
  damaged: "Beschädigt",
  ancient: "Alt / historisch",
  magicallyAltered: "Magisch verändert",
};
const SIGNIFICANCE_LABELS: Readonly<Record<ItemSignificance, string>> = {
  common: "Alltäglich",
  valuable: "Wertvoll",
  rare: "Selten",
  ceremonial: "Zeremoniell",
  magical: "Magisch",
  questCritical: "Handlungsentscheidend",
};
const SIZE_LABELS: Readonly<Record<ItemSize, string>> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  oversized: "Überdimensioniert",
};
const READABILITY_LABELS: Readonly<Record<ItemReadability, string>> = {
  silhouetteFirst: "Silhouette zuerst",
  balanced: "Ausgewogen",
  detailRich: "Detailreich",
};
const GLOW_LABELS: Readonly<Record<ItemGlowMode, string>> = {
  none: "Kein Leuchten",
  subtle: "Subtiler Leuchteffekt",
  emissive: "Deutlich emissiv",
};
const SHADOW_LABELS: Readonly<Record<ItemShadowMode, string>> = {
  none: "Kein eigener Schatten",
  contact: "Kleiner Kontaktschatten",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

function optionalTextValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalSelectValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalNumberValue(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fieldError(form: ItemForm, field: keyof WizardCoreFormValues): string | null {
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
  form: ItemForm;
  help: string;
  label: string;
  name: ItemSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `item-${name}`;
  const error = fieldError(form, name);
  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <select
        id={id}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
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
  maxLength = 500,
  name,
  notifyProgrammaticChange,
  wide = false,
}: Readonly<{
  form: ItemForm;
  help: string;
  label: string;
  maxLength?: number;
  name: ItemTextFieldName;
  notifyProgrammaticChange: () => void;
  wide?: boolean;
}>) {
  const id = `item-${name}`;
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
  form: ItemForm;
  help: string;
  label: string;
  max: number;
  min: number;
  name: ItemNumberFieldName;
}>) {
  const id = `item-${name}`;
  const error = fieldError(form, name);
  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        inputMode="numeric"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? "true" : "false"}
        {...form.register(name, { setValueAs: optionalNumberValue })}
      />
    </FieldShell>
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

const PURPOSE_OPTIONS = optionsFromIds(ITEM_PURPOSE_IDS, PURPOSE_LABELS);
const PRESENTATION_OPTIONS = optionsFromIds(ITEM_PRESENTATION_IDS, PRESENTATION_LABELS);
const WEAR_POSITION_OPTIONS = optionsFromIds(ITEM_WEAR_POSITION_IDS, WEAR_POSITION_LABELS);
const MATERIAL_OPTIONS = optionsFromIds(ITEM_MATERIAL_IDS, MATERIAL_LABELS);
const CONDITION_OPTIONS = optionsFromIds(ITEM_CONDITION_IDS, CONDITION_LABELS);
const SIGNIFICANCE_OPTIONS = optionsFromIds(ITEM_SIGNIFICANCE_IDS, SIGNIFICANCE_LABELS);
const SIZE_OPTIONS = optionsFromIds(ITEM_SIZE_IDS, SIZE_LABELS);
const READABILITY_OPTIONS = optionsFromIds(ITEM_READABILITY_IDS, READABILITY_LABELS);
const GLOW_OPTIONS = optionsFromIds(ITEM_GLOW_MODE_IDS, GLOW_LABELS);
const SHADOW_OPTIONS = optionsFromIds(ITEM_SHADOW_MODE_IDS, SHADOW_LABELS);

export interface ItemEquipmentEditorProps {
  readonly form: ItemForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: ItemSubtype;
}

export function ItemEquipmentEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: ItemEquipmentEditorProps) {
  const pixelDensity = useWatch({ control: form.control, name: "pixelDensity" });
  const tileSize = useWatch({ control: form.control, name: "tileSize" });
  const backgroundMode = useWatch({ control: form.control, name: "backgroundMode" });
  const alphaPadding = useWatch({ control: form.control, name: "alphaPadding" });
  const wearable = itemSubtypeSupportsWearPosition(subtype);
  const itemClass = getDefaultItemClass(subtype);
  const purposeOptions = wearable
    ? PURPOSE_OPTIONS
    : PURPOSE_OPTIONS.filter((option) => option.value !== "wearable");
  const presentationOptions = wearable
    ? PRESENTATION_OPTIONS
    : PRESENTATION_OPTIONS.filter((option) => option.value !== "equipped");

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="item-context-title">
        <div>
          <p className={styles.eyebrow}>Freigestelltes Produktionsasset</p>
          <h3 id="item-context-title">{SUBTYPE_LABELS[subtype]}</h3>
          <p className={styles.contextHelp}>
            Form, Material und Funktion bleiben auch in kleiner Darstellung eindeutig lesbar.
          </p>
        </div>
        <ul className={styles.statusList}>
          <li>keine Richtungsansichten</li>
          <li>keine Animation</li>
          {wearable ? <li>tragbarer Untertyp</li> : null}
        </ul>
      </section>

      <fieldset className={styles.group}>
        <legend>Itemkern und Funktion</legend>
        <p className={styles.groupIntro}>
          Lege Nutzung und Ausgabeform fest. Die Itemklasse folgt unveränderlich dem gewählten
          Untertyp.
        </p>
        <div className={styles.fieldGrid}>
          <DerivedField
            id="item-class"
            label="Itemklasse"
            value={CLASS_LABELS[itemClass]}
            help="Aus dem Untertyp abgeleitet; nicht separat überschreibbar."
          />
          <SelectField
            form={form}
            name="itemPurpose"
            label="Zweck"
            help="Praktische, dekorative, tragbare oder benutzbare Rolle."
            options={purposeOptions}
          />
          <SelectField
            form={form}
            name="itemPresentation"
            label="Darstellung"
            help="Inventar-Icon, Weltobjekt oder ausgerüstete Ansicht."
            options={presentationOptions}
          />
          {wearable ? (
            <SelectField
              form={form}
              name="itemWearPosition"
              label="Trageposition"
              help="Nur für explizit tragbare Item-Untertypen verfügbar."
              options={WEAR_POSITION_OPTIONS}
            />
          ) : null}
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemDescription"
            label="Motivbeschreibung"
            help="Konkrete Form, Bestandteile und visuelle Identität."
            maxLength={4000}
            wide
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemFunctionDetails"
            label="Funktion"
            help="Wie das Item benutzt wird und welche Merkmale diese Funktion sichtbar machen."
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Material und Zustand</legend>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="itemPrimaryMaterial"
            label="Hauptmaterial"
            help="Visuell dominantes Material."
            options={MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="itemSecondaryMaterial"
            label="Sekundärmaterial"
            help="Optionales zweites Material für Kontrast und Konstruktion."
            options={MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="itemCondition"
            label="Zustand"
            help="Alterung und Gebrauchsspuren ohne die Silhouette zu verschleiern."
            options={CONDITION_OPTIONS}
          />
          <SelectField
            form={form}
            name="itemGlowMode"
            label="Leuchteffekt"
            help="Kontrolliertes Emissionslicht; kein Ersatz für das Weltlicht."
            options={GLOW_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemMaterialDetails"
            label="Materialdetails"
            help="Oberfläche, Verarbeitung, Beschläge und Materialübergänge."
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Bedeutung und Lesbarkeit</legend>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="itemSignificance"
            label="Bedeutung"
            help="Wert, Seltenheit oder narrative Relevanz."
            options={SIGNIFICANCE_OPTIONS}
          />
          <SelectField
            form={form}
            name="itemReadability"
            label="Detaildichte"
            help="Priorität zwischen starker Silhouette und feinen Details."
            options={READABILITY_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemMeaningDetails"
            label="Symbolik und Bedeutung"
            help="Erkennbare Zeichen, Herkunft oder erzählerische Funktion."
            wide
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemSilhouette"
            label="Silhouettenmerkmale"
            help="Unverwechselbare Außenkontur und klare Negativräume."
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Größe und Ausgabe</legend>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="itemSize"
            label="Relative Größe"
            help="Größeneindruck relativ zu Figur und Inventar."
            options={SIZE_OPTIONS}
          />
          <NumberField
            form={form}
            name="itemIconSize"
            label="Icongröße (px)"
            help="Optionale Zielgröße für eine Inventardarstellung."
            min={8}
            max={512}
          />
          <NumberField
            form={form}
            name="itemVariantCount"
            label="Varianten"
            help="Anzahl klar unterscheidbarer Ausführungen."
            min={1}
            max={12}
          />
          <SelectField
            form={form}
            name="itemShadowMode"
            label="Schatten"
            help="Freigestellt ohne Schatten oder mit kleinem Kontaktschatten."
            options={SHADOW_OPTIONS}
          />
          <DerivedField
            id="item-background"
            label="Hintergrund"
            value={`${backgroundMode === "scene" ? "Szene" : "Transparent"}${alphaPadding === undefined ? "" : ` · ${String(alphaPadding)} px Alpha-Rand`}`}
            help="Wird aus dem wirksamen Basisprofil übernommen."
          />
          <DerivedField
            id="item-scale"
            label="Produktionsmaßstab"
            value={`${tileSize === undefined ? "–" : `${String(tileSize)} px Tile`} · ${pixelDensity ?? "–"}`}
            help="Technischer Maßstab aus der gewählten Produktionsfamilie."
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="itemExtraDetails"
            label="Weitere Vorgaben"
            help="Nur zusätzliche, itemspezifische Produktionshinweise."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>
    </div>
  );
}
