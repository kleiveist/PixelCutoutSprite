import { useState, type ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  CHARACTER_AGE_IDS,
  CHARACTER_BODY_BUILD_IDS,
  CHARACTER_CONDITION_IDS,
  CHARACTER_EXPRESSION_IDS,
  CHARACTER_EYE_VISIBILITY_IDS,
  CHARACTER_GENDER_PRESENTATION_IDS,
  CHARACTER_HEADWEAR_CONDITION_IDS,
  CHARACTER_PALETTE_SOURCE_IDS,
  CHARACTER_POSTURE_IDS,
  CHARACTER_RELATIVE_HEIGHT_IDS,
  CHARACTER_TEXT_PRESETS_DE,
  CHARACTER_WEALTH_IDS,
  isHumanoidCharacterSubtype,
  isNpcContextSubtype,
  type CharacterAge,
  type CharacterBodyBuild,
  type CharacterCondition,
  type CharacterExpression,
  type CharacterEyeVisibility,
  type CharacterGenderPresentation,
  type CharacterHeadwearCondition,
  type CharacterPaletteSource,
  type CharacterPosture,
  type CharacterRelativeHeight,
  type CharacterSubtype,
  type CharacterTextPresetField,
  type CharacterWealth,
} from "../../domain/characters";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import styles from "./CharacterEditor.module.css";

type CharacterForm = UseFormReturn<WizardCoreFormValues>;

type CharacterSelectFieldName =
  | "genderPresentation"
  | "age"
  | "relativeHeight"
  | "bodyBuild"
  | "posture"
  | "eyeVisibility"
  | "headwearCondition"
  | "characterPaletteSource"
  | "condition"
  | "expression"
  | "wealth";

interface TextFieldDefinition {
  readonly name: CharacterTextPresetField;
  readonly label: string;
  readonly help: string;
  readonly multiline?: boolean;
  readonly maxLength?: number;
  readonly wide?: boolean;
}

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

const CUSTOM_TEXT_PRESET_VALUE = "__custom__";

const GENDER_PRESENTATION_LABELS: Readonly<Record<CharacterGenderPresentation, string>> = {
  feminine: "Feminin",
  masculine: "Maskulin",
  androgynous: "Androgyn",
  neutral: "Neutral / nicht festgelegt",
};

const AGE_LABELS: Readonly<Record<CharacterAge, string>> = {
  young: "Jung",
  adult: "Erwachsen",
  older: "Älter",
  veryOld: "Sehr alt",
};

const RELATIVE_HEIGHT_LABELS: Readonly<Record<CharacterRelativeHeight, string>> = {
  short: "Klein",
  average: "Durchschnittlich",
  tall: "Groß",
};

const BODY_BUILD_LABELS: Readonly<Record<CharacterBodyBuild, string>> = {
  slim: "Schmal",
  average: "Normal",
  sturdy: "Kräftig",
  broad: "Breit",
};

const POSTURE_LABELS: Readonly<Record<CharacterPosture, string>> = {
  upright: "Aufrecht",
  relaxed: "Entspannt",
  hunched: "Gebeugt",
  dynamic: "Dynamisch",
};

const EYE_VISIBILITY_LABELS: Readonly<Record<CharacterEyeVisibility, string>> = {
  clear: "Klar lesbar",
  subtle: "Dezent angedeutet",
  obscured: "Verdeckt",
};

const HEADWEAR_CONDITION_LABELS: Readonly<Record<CharacterHeadwearCondition, string>> = {
  clean: "Sauber",
  used: "Gebraucht",
  weathered: "Verwittert",
  damaged: "Beschädigt",
};

const CONDITION_LABELS: Readonly<Record<CharacterCondition, string>> = {
  clean: "Sauber",
  used: "Gebraucht",
  weathered: "Verwittert",
  damaged: "Beschädigt",
};

const EXPRESSION_LABELS: Readonly<Record<CharacterExpression, string>> = {
  neutral: "Neutral",
  friendly: "Freundlich",
  serious: "Ernst",
  tired: "Müde",
  mysterious: "Geheimnisvoll",
};

const PALETTE_SOURCE_LABELS: Readonly<Record<CharacterPaletteSource, string>> = {
  profile: "Aus dem Farbprofil ableiten",
  local: "Lokale Figurenpalette",
};

const WEALTH_LABELS: Readonly<Record<CharacterWealth, string>> = {
  poor: "Arm",
  modest: "Bescheiden",
  comfortable: "Gut situiert",
  wealthy: "Wohlhabend",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const GENDER_PRESENTATION_OPTIONS = optionsFromIds(
  CHARACTER_GENDER_PRESENTATION_IDS,
  GENDER_PRESENTATION_LABELS,
);
const AGE_OPTIONS = optionsFromIds(CHARACTER_AGE_IDS, AGE_LABELS);
const RELATIVE_HEIGHT_OPTIONS = optionsFromIds(
  CHARACTER_RELATIVE_HEIGHT_IDS,
  RELATIVE_HEIGHT_LABELS,
);
const BODY_BUILD_OPTIONS = optionsFromIds(CHARACTER_BODY_BUILD_IDS, BODY_BUILD_LABELS);
const POSTURE_OPTIONS = optionsFromIds(CHARACTER_POSTURE_IDS, POSTURE_LABELS);
const EYE_VISIBILITY_OPTIONS = optionsFromIds(CHARACTER_EYE_VISIBILITY_IDS, EYE_VISIBILITY_LABELS);
const HEADWEAR_CONDITION_OPTIONS = optionsFromIds(
  CHARACTER_HEADWEAR_CONDITION_IDS,
  HEADWEAR_CONDITION_LABELS,
);
const PALETTE_SOURCE_OPTIONS = optionsFromIds(CHARACTER_PALETTE_SOURCE_IDS, PALETTE_SOURCE_LABELS);
const CONDITION_OPTIONS = optionsFromIds(CHARACTER_CONDITION_IDS, CONDITION_LABELS);
const EXPRESSION_OPTIONS = optionsFromIds(CHARACTER_EXPRESSION_IDS, EXPRESSION_LABELS);
const WEALTH_OPTIONS = optionsFromIds(CHARACTER_WEALTH_IDS, WEALTH_LABELS);

const IDENTITY_FIELDS = Object.freeze([
  {
    name: "role",
    label: "Rolle / Beruf",
    help: "Beschreibe die im Spiel sofort erkennbare Funktion der Figur.",
    maxLength: 100,
  },
  {
    name: "subjectDescription",
    label: "Kurze Figurenbeschreibung",
    help: "Fasse Motiv, Charakter und wichtigste Erkennungsmerkmale zusammen.",
    multiline: true,
    maxLength: 4000,
    wide: true,
  },
] as const satisfies readonly TextFieldDefinition[]);

const FACE_FIELDS = Object.freeze([
  {
    name: "faceShape",
    label: "Gesichtsform",
    help: "Zum Beispiel schlicht, markant, rund oder kantig.",
  },
  {
    name: "skinTone",
    label: "Hautwirkung",
    help: "Beschreibe Farbwirkung und sichtbare Hautdetails ohne Porträtzwang.",
  },
  {
    name: "hair",
    label: "Haare",
    help: "Länge, Form und Farbe der Haare oder des Fells.",
  },
  {
    name: "hairstyle",
    label: "Frisur",
    help: "Zum Beispiel kurz, Zopf, lockig, rasiert oder ungebändigt.",
  },
  {
    name: "beard",
    label: "Bart",
    help: "Bartform und -länge oder ausdrücklich kein Bart.",
  },
] as const satisfies readonly TextFieldDefinition[]);

const WARDROBE_FIELDS = Object.freeze([
  {
    name: "hat",
    label: "Kopfbedeckung",
    help: "Hut, Kapuze, Kappe, Helm oder keine Kopfbedeckung.",
    maxLength: 100,
  },
  {
    name: "scarf",
    label: "Schal / Kragen",
    help: "Schal, Kragen oder Tuch einschließlich Länge und Bedeckung.",
    maxLength: 100,
  },
  {
    name: "outerwear",
    label: "Oberbekleidung",
    help: "Hemd, Tunika, Weste, Mantel, Rüstung oder andere Oberbekleidung.",
    maxLength: 120,
  },
  {
    name: "lowerwear",
    label: "Unterbekleidung",
    help: "Hose, Rock, Robe oder Schürze einschließlich Länge.",
  },
  {
    name: "clothingLayers",
    label: "Kleidungsschichten",
    help: "Lege die sichtbare Reihenfolge und Trennung der Schichten fest.",
    maxLength: 500,
  },
  {
    name: "gloves",
    label: "Handschuhe",
    help: "Art, Material und Abdeckung der Handschuhe oder freie Hände.",
  },
  {
    name: "handPose",
    label: "Hand- / Werkzeughaltung",
    help: "Beschreibe, wie Hände oder Werkzeuge lesbar gehalten werden.",
  },
  {
    name: "shoes",
    label: "Schuhe / Stiefel",
    help: "Zum Beispiel schlicht, robust oder gepanzert.",
  },
  {
    name: "beltBags",
    label: "Gürtel / Taschen",
    help: "Position, Größe und Seite von Gürtel, Beutel und Taschen.",
    maxLength: 500,
  },
  {
    name: "backItem",
    label: "Rückenelement",
    help: "Umhang, Rucksack, Köcher oder ausdrücklich kein Rückenelement.",
  },
] as const satisfies readonly TextFieldDefinition[]);

const GEAR_FIELDS = Object.freeze([
  {
    name: "accessories",
    label: "Accessoires",
    help: "Schmuck, Anhänger und weitere kleine Elemente; wichtige Seitenlage angeben.",
    multiline: true,
  },
  {
    name: "equipment",
    label: "Ausrüstung / Werkzeug",
    help: "Werkzeug, Waffe, Stab, Buch, Laterne oder sonstige Ausrüstung.",
    multiline: true,
  },
  {
    name: "materials",
    label: "Materialmix",
    help: "Beschreibe Stoff, Leder, Metall, Holz und ihre klare visuelle Trennung.",
    multiline: true,
    wide: true,
  },
] as const satisfies readonly TextFieldDefinition[]);

const READABILITY_FIELDS = Object.freeze([
  {
    name: "silhouette",
    label: "Silhouettenmerkmal",
    help: "Nenne das Merkmal, das die Figur in ihrer geerbten Zielgröße sofort lesbar macht.",
    multiline: true,
  },
  {
    name: "pose",
    label: "Pose",
    help: "Neutraler Stand oder eine typische, klar erkennbare Handlung.",
  },
  {
    name: "extraDetails",
    label: "Weitere Figurendetails",
    help: "Optionale Ergänzungen, die keiner anderen Figurengruppe eindeutig zugeordnet sind.",
    multiline: true,
    maxLength: 4000,
    wide: true,
  },
] as const satisfies readonly TextFieldDefinition[]);

const NPC_FIELDS = Object.freeze([
  {
    name: "socialRole",
    label: "Soziale Rolle",
    help: "Stellung der Figur innerhalb ihrer Gemeinschaft.",
  },
  {
    name: "culturalFunction",
    label: "Kulturelle Funktion",
    help: "Beschreibe die Funktion nur innerhalb der eigenen Weltbeschreibung.",
    multiline: true,
  },
  {
    name: "typicalActivity",
    label: "Typische Tätigkeit",
    help: "Die Handlung, bei der dieser NPC meist angetroffen wird.",
    maxLength: 500,
  },
  {
    name: "conversationGesture",
    label: "Gesprächshaltung / Idle-Geste",
    help: "Eine zurückhaltende Geste, die Rolle und Haltung unterstützt.",
    maxLength: 500,
  },
  {
    name: "everydayTool",
    label: "Alltagswerkzeug",
    help: "Das charakteristische, regelmäßig verwendete Werkzeug.",
  },
  {
    name: "frontBackDetails",
    label: "Besondere Vorder- / Rückseitendetails",
    help: "Asymmetrische oder richtungsabhängige Details, die logisch erhalten bleiben müssen.",
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

function optionalBooleanValue(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function fieldError(form: CharacterForm, field: keyof WizardCoreFormValues): string | null {
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
  form: CharacterForm;
  notifyProgrammaticChange: () => void;
}>) {
  const { help, label, name } = definition;
  const id = `character-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;
  const presets: readonly string[] = CHARACTER_TEXT_PRESETS_DE[name];
  const watchedValue = useWatch({ control: form.control, name });
  const currentValue = typeof watchedValue === "string" ? watchedValue : "";
  const matchesPreset = presets.includes(currentValue);
  const [customRequested, setCustomRequested] = useState(
    () => currentValue !== "" && !matchesPreset,
  );
  const customActive = customRequested || (currentValue !== "" && !matchesPreset);
  const selectedValue = customActive ? CUSTOM_TEXT_PRESET_VALUE : matchesPreset ? currentValue : "";

  function updateValue(value: string | undefined): void {
    form.setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    notifyProgrammaticChange();
  }

  function choosePreset(value: string): void {
    if (value === CUSTOM_TEXT_PRESET_VALUE) {
      setCustomRequested(true);
      return;
    }

    setCustomRequested(false);
    const nextValue = optionalTextValue(value);
    if (nextValue !== currentValue) updateValue(nextValue);
  }

  return (
    <FieldShell
      error={error}
      help={help}
      id={id}
      label={label}
      {...(definition.wide === undefined ? {} : { wide: definition.wide })}
    >
      <select
        id={id}
        value={selectedValue}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        onChange={(event) => choosePreset(event.currentTarget.value)}
      >
        <option value="">Nicht festgelegt</option>
        {presets.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={CUSTOM_TEXT_PRESET_VALUE}>Eigene Eingabe</option>
      </select>
      {customActive ? (
        <div className={styles.customInput}>
          <label htmlFor={`${id}-custom`}>Eigene Eingabe für {label}</label>
          {definition.multiline ? (
            <textarea
              id={`${id}-custom`}
              rows={4}
              maxLength={definition.maxLength ?? 500}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={error ? "true" : "false"}
              {...form.register(name, { setValueAs: optionalTextValue })}
            />
          ) : (
            <input
              id={`${id}-custom`}
              type="text"
              autoComplete="off"
              maxLength={definition.maxLength ?? 200}
              aria-describedby={describedBy}
              aria-invalid={error ? "true" : "false"}
              {...form.register(name, { setValueAs: optionalTextValue })}
            />
          )}
        </div>
      ) : null}
    </FieldShell>
  );
}

function TextFields({
  fields,
  form,
  notifyProgrammaticChange,
}: Readonly<{
  fields: readonly TextFieldDefinition[];
  form: CharacterForm;
  notifyProgrammaticChange: () => void;
}>) {
  return fields.map((definition) => (
    <TextField
      key={definition.name}
      definition={definition}
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
    />
  ));
}

function SelectField({
  form,
  help,
  label,
  name,
  options,
}: Readonly<{
  form: CharacterForm;
  help: string;
  label: string;
  name: CharacterSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `character-${name}`;
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

function VariantCountField({ form }: Readonly<{ form: CharacterForm }>) {
  const id = "character-variantCount";
  const error = fieldError(form, "variantCount");
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell
      error={error}
      help="Anzahl eng zusammengehöriger Figurenvarianten von eins bis fünf."
      id={id}
      label="Figurenvarianten"
    >
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register("variantCount", { setValueAs: optionalNumberValue })}
      >
        <option value="">Nicht festgelegt</option>
        {[1, 2, 3, 4, 5].map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function ProfessionReadableField({ form }: Readonly<{ form: CharacterForm }>) {
  const id = "character-professionReadable";
  const error = fieldError(form, "professionReadable");
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell
      error={error}
      help="Lege fest, ob Kleidung, Werkzeug und Silhouette den Beruf unmittelbar zeigen sollen."
      id={id}
      label="Beruf sofort lesbar?"
    >
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register("professionReadable", {
          setValueAs: optionalBooleanValue,
        })}
      >
        <option value="">Nicht festgelegt</option>
        <option value="true">Ja</option>
        <option value="false">Nein</option>
      </select>
    </FieldShell>
  );
}

export type CharacterHeightSource = "Basisprofil" | "Kategorieprofil" | "Lokaler Entwurf";

export interface CharacterDetailsEditorProps {
  readonly form: CharacterForm;
  readonly characterHeight: number;
  readonly heightSourceName: string;
  readonly heightSource: CharacterHeightSource;
  readonly heightLocked: boolean;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: CharacterSubtype;
}

export function CharacterDetailsEditor({
  characterHeight,
  form,
  heightLocked,
  heightSource,
  heightSourceName,
  notifyProgrammaticChange,
  subtype,
}: CharacterDetailsEditorProps) {
  const showHumanoidWardrobe = isHumanoidCharacterSubtype(subtype);
  const showNpcContext = isNpcContextSubtype(subtype);

  return (
    <div className={styles.editor}>
      <section className={styles.scaleCard} aria-labelledby="character-height-title">
        <div>
          <p className={styles.eyebrow}>Vererbter Produktionsmaßstab</p>
          <h3 id="character-height-title">Figurenhöhe</h3>
          <p className={styles.scaleHelp}>
            Dieser technische Wert kommt aus der Profilkette und wird nicht als Figurenantwort
            dupliziert.
          </p>
        </div>
        <div className={styles.scaleValue}>
          <output aria-labelledby="character-height-title">{characterHeight} px</output>
          <span className={heightLocked ? styles.lockedBadge : styles.inheritedBadge}>
            {heightLocked ? "Gesperrt" : "Im Basisprofil änderbar"}
          </span>
          <small>
            Quelle: {heightSource} · {heightSourceName}
          </small>
        </div>
      </section>

      <p className={styles.logicNote} role="note">
        Deutsche Vorlagen stehen bei allen Freitextangaben an erster Stelle. Wähle „Eigene Eingabe“,
        wenn du stattdessen einen individuellen Text eintragen möchtest.
      </p>

      <fieldset className={styles.group}>
        <legend>Identität und Varianten</legend>
        <p className={styles.groupIntro}>
          Verankere Rolle und Motiv, ohne technische Profilwerte im Asset zu wiederholen.
        </p>
        <div className={styles.fieldGrid}>
          <TextFields
            fields={IDENTITY_FIELDS}
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
          />
          <VariantCountField form={form} />
          <SelectField
            form={form}
            name="genderPresentation"
            label="Geschlechtswirkung"
            help="Die sichtbare Wirkung der Figur; eine Festlegung ist optional."
            options={GENDER_PRESENTATION_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Körper, Gesicht und Ausdruck</legend>
        <p className={styles.groupIntro}>
          Halte Formen auf Gameplay-Größe eindeutig und vermeide porträthafte Übertreibung.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="age"
            label="Alterswirkung"
            help="Wie jung oder alt die Figur visuell gelesen werden soll."
            options={AGE_OPTIONS}
          />
          <SelectField
            form={form}
            name="relativeHeight"
            label="Relative Größe"
            help="Proportion relativ zu anderen Figuren; die Pixelhöhe bleibt geerbt."
            options={RELATIVE_HEIGHT_OPTIONS}
          />
          <SelectField
            form={form}
            name="bodyBuild"
            label="Körperbau"
            help="Grundform des Körpers und ihre Wirkung in der Silhouette."
            options={BODY_BUILD_OPTIONS}
          />
          <SelectField
            form={form}
            name="posture"
            label="Haltung"
            help="Grundhaltung unabhängig von einer späteren Animationsaktion."
            options={POSTURE_OPTIONS}
          />
          <TextFields
            fields={FACE_FIELDS}
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
          />
          <SelectField
            form={form}
            name="eyeVisibility"
            label="Augenlesbarkeit"
            help="Wie deutlich die Augen in der nativen Zielgröße sichtbar sind."
            options={EYE_VISIBILITY_OPTIONS}
          />
          <SelectField
            form={form}
            name="expression"
            label="Ausdruck"
            help="Zurückhaltender Ausdruck, der auch in kleiner Darstellung lesbar bleibt."
            options={EXPRESSION_OPTIONS}
          />
          <TextFields
            fields={READABILITY_FIELDS}
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
          />
        </div>
      </fieldset>

      {showHumanoidWardrobe ? (
        <fieldset className={styles.group}>
          <legend>Kopfbedeckung und Kleidung</legend>
          <p className={styles.groupIntro}>
            Trenne Kleidungsschichten und asymmetrische Details eindeutig für Vorder-, Seiten- und
            Rückansichten.
          </p>
          <div className={styles.fieldGrid}>
            <TextFields
              fields={WARDROBE_FIELDS.slice(0, 1)}
              form={form}
              notifyProgrammaticChange={notifyProgrammaticChange}
            />
            <SelectField
              form={form}
              name="headwearCondition"
              label="Zustand der Kopfbedeckung"
              help="Abnutzung und Materialwirkung der gewählten Kopfbedeckung."
              options={HEADWEAR_CONDITION_OPTIONS}
            />
            <TextFields
              fields={WARDROBE_FIELDS.slice(1)}
              form={form}
              notifyProgrammaticChange={notifyProgrammaticChange}
            />
          </div>
        </fieldset>
      ) : (
        <p className={styles.logicNote} role="note">
          Humanoide Kleidungsfragen sind für Tier und Kreatur ausgeblendet. Körper-, Material-,
          Accessoire- und Ausrüstungsdetails bleiben verfügbar.
        </p>
      )}

      <fieldset className={styles.group}>
        <legend>Accessoires, Ausrüstung und Material</legend>
        <p className={styles.groupIntro}>
          Beschreibe nur Elemente, die konsistent in allen benötigten Ansichten erhalten bleiben
          sollen.
        </p>
        <div className={styles.fieldGrid}>
          <TextFields
            fields={GEAR_FIELDS}
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
          />
          <SelectField
            form={form}
            name="condition"
            label="Gesamtzustand"
            help="Abnutzung der Kleidung, Ausrüstung und sichtbaren Materialien."
            options={CONDITION_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Figurenpalette</legend>
        <p className={styles.groupIntro}>
          Lokale Farben ergänzen das geerbte Farbprofil; sie ersetzen keine gesperrte globale
          Palettenregel.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="characterPaletteSource"
            label="Palettenquelle"
            help="Vom Basisprofil ableiten oder konkrete lokale Farben angeben."
            options={PALETTE_SOURCE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            definition={{
              name: "primaryColor",
              label: "Hauptfarbe",
              help: "Dominierende lokale Farbfamilie.",
            }}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            definition={{
              name: "secondaryColor",
              label: "Nebenfarbe",
              help: "Unterstützende zweite Farbfamilie.",
            }}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            definition={{
              name: "accentColor",
              label: "Akzentfarbe",
              help: "Sparsam eingesetzte Farbe für Fokus und Lesbarkeit.",
            }}
          />
        </div>
      </fieldset>

      {showNpcContext ? (
        <fieldset className={styles.group}>
          <legend>NPC-Kontext</legend>
          <p className={styles.groupIntro}>
            Diese optionalen Angaben verbinden Beruf, soziale Funktion und typische
            Alltagsdarstellung.
          </p>
          <div className={styles.fieldGrid}>
            <ProfessionReadableField form={form} />
            <SelectField
              form={form}
              name="wealth"
              label="Wohlstandsstufe"
              help="Sichtbarer materieller Status ohne moderne Markenmerkmale."
              options={WEALTH_OPTIONS}
            />
            <TextFields
              fields={NPC_FIELDS}
              form={form}
              notifyProgrammaticChange={notifyProgrammaticChange}
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
