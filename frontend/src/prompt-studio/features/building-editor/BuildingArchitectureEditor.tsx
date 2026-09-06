import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { resolveCapabilities } from "../../domain/assets";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  BUILDING_COLLISION_MODE_IDS,
  BUILDING_CONDITION_IDS,
  BUILDING_DOOR_STATE_IDS,
  BUILDING_DOOR_TYPE_IDS,
  BUILDING_ENVIRONMENT_IDS,
  BUILDING_FACADE_STYLE_IDS,
  BUILDING_LIGHTING_IDS,
  BUILDING_MAPPING_MODE_IDS,
  BUILDING_MATERIAL_IDS,
  BUILDING_OCCUPANCY_IDS,
  BUILDING_PLAN_SHAPE_IDS,
  BUILDING_ROOF_CONDITION_IDS,
  BUILDING_ROOF_MATERIAL_IDS,
  BUILDING_ROOF_PITCH_IDS,
  BUILDING_ROOF_SHAPE_IDS,
  BUILDING_SIZE_IDS,
  BUILDING_WINDOW_LIGHTING_IDS,
  BUILDING_WINDOW_SHAPE_IDS,
  getDefaultBuildingType,
  type BuildingCollisionMode,
  type BuildingCondition,
  type BuildingDoorState,
  type BuildingDoorType,
  type BuildingEnvironment,
  type BuildingFacadeStyle,
  type BuildingLighting,
  type BuildingMappingMode,
  type BuildingMaterial,
  type BuildingOccupancy,
  type BuildingPlanShape,
  type BuildingRoofCondition,
  type BuildingRoofMaterial,
  type BuildingRoofPitch,
  type BuildingRoofShape,
  type BuildingSize,
  type BuildingSubtype,
  type BuildingType,
  type BuildingWindowLighting,
  type BuildingWindowShape,
} from "../../domain/buildings";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./BuildingArchitectureEditor.module.css";

type BuildingForm = UseFormReturn<WizardCoreFormValues>;

type BuildingTextFieldName =
  | "buildingPurpose"
  | "buildingDescription"
  | "buildingMaterialDetails"
  | "buildingRoofDetails"
  | "buildingFacadeDetails"
  | "buildingDoorPosition"
  | "buildingWindowDetails"
  | "buildingLightSourceDetails"
  | "buildingExtraDetails";

type BuildingSelectFieldName =
  | "buildingPlanShape"
  | "buildingSize"
  | "buildingPrimaryMaterial"
  | "buildingSecondaryMaterial"
  | "buildingRoofShape"
  | "buildingRoofPitch"
  | "buildingRoofMaterial"
  | "buildingRoofCondition"
  | "buildingFacadeStyle"
  | "buildingDoorType"
  | "buildingDoorState"
  | "buildingWindowShape"
  | "buildingWindowLighting"
  | "buildingCondition"
  | "buildingOccupancy"
  | "buildingEnvironment"
  | "buildingMappingMode"
  | "buildingCollisionMode"
  | "buildingLighting";

type BuildingNumberFieldName =
  | "buildingFootprintWidthTiles"
  | "buildingFootprintDepthTiles"
  | "buildingHeightPixels"
  | "buildingFloors"
  | "buildingDoorCount"
  | "buildingWindowCount";

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

const SUBTYPE_LABELS: Readonly<Record<BuildingSubtype, string>> = {
  house: "Wohnhaus",
  hut: "Hütte",
  shop: "Geschäft",
  workshop: "Werkstatt",
  inn: "Gasthaus",
  tower: "Turm",
  gate: "Tor",
  temple: "Tempel",
  ruin: "Ruine",
  fortification: "Befestigung",
  dungeonModule: "Dungeon-Bauteil",
};

const TYPE_LABELS: Readonly<Record<BuildingType, string>> = {
  residential: "Wohngebäude",
  commercial: "Geschäftsgebäude",
  workshop: "Werkstattgebäude",
  hospitality: "Beherbergung / Gasthaus",
  tower: "Turmbau",
  gate: "Torbau",
  sacred: "Sakralbau",
  ruin: "Ruinenbau",
  fortification: "Befestigungsbau",
  dungeonModule: "Dungeon-Modul",
};

const SIZE_LABELS: Readonly<Record<BuildingSize, string>> = {
  compact: "Kompakt",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  monumental: "Monumental",
};

const PLAN_SHAPE_LABELS: Readonly<Record<BuildingPlanShape, string>> = {
  rectangular: "Rechteckig",
  lShaped: "L-förmig",
  round: "Rund",
  courtyard: "Mit Innenhof",
  modular: "Modular aufgebaut",
  asymmetric: "Asymmetrisch",
  irregular: "Unregelmäßig",
  custom: "Individuell",
};

const MATERIAL_LABELS: Readonly<Record<BuildingMaterial, string>> = {
  wood: "Holz",
  stone: "Stein",
  clay: "Lehm",
  brick: "Ziegel",
  plaster: "Putz",
  metal: "Metall",
  timberFrame: "Fachwerk",
  mixed: "Mischbau",
  custom: "Eigenes Material",
};

const ROOF_SHAPE_LABELS: Readonly<Record<BuildingRoofShape, string>> = {
  gable: "Satteldach",
  hipped: "Walmdach",
  flat: "Flachdach",
  shed: "Pultdach",
  conical: "Kegeldach",
  domed: "Kuppeldach",
  collapsed: "Eingestürzt",
  none: "Kein Dach",
  custom: "Individuell",
};

const ROOF_PITCH_LABELS: Readonly<Record<BuildingRoofPitch, string>> = {
  low: "Flach",
  medium: "Mittel",
  steep: "Steil",
  variable: "Wechselnd",
};

const ROOF_MATERIAL_LABELS: Readonly<Record<BuildingRoofMaterial, string>> = {
  thatch: "Reet / Stroh",
  woodShingle: "Holzschindeln",
  slate: "Schiefer",
  tile: "Dachziegel",
  metal: "Metall",
  stone: "Stein",
  earth: "Erde / Grassoden",
  mixed: "Mischmaterial",
  none: "Kein Dachmaterial",
  custom: "Eigenes Material",
};

const ROOF_CONDITION_LABELS: Readonly<Record<BuildingRoofCondition, string>> = {
  intact: "Intakt",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  collapsed: "Eingestürzt",
  overgrown: "Überwuchert",
};

const FACADE_LABELS: Readonly<Record<BuildingFacadeStyle, string>> = {
  timberFrame: "Fachwerk",
  plastered: "Verputzt",
  masonry: "Sichtmauerwerk",
  brick: "Ziegelfassade",
  fortified: "Befestigt",
  carved: "Verziert / gemeißelt",
  ruined: "Aufgebrochen / ruinös",
  mixed: "Gemischt",
  custom: "Individuell",
};

const DOOR_TYPE_LABELS: Readonly<Record<BuildingDoorType, string>> = {
  single: "Einflügelige Tür",
  double: "Doppeltür",
  arched: "Bogentür",
  reinforced: "Verstärktes Tor",
  portcullis: "Fallgatter",
  openPassage: "Offener Durchgang",
  custom: "Individuell",
};

const DOOR_STATE_LABELS: Readonly<Record<BuildingDoorState, string>> = {
  open: "Offen",
  closed: "Geschlossen",
  ajar: "Angelehnt",
  blocked: "Blockiert",
  broken: "Beschädigt",
};

const WINDOW_SHAPE_LABELS: Readonly<Record<BuildingWindowShape, string>> = {
  square: "Quadratisch",
  rectangular: "Rechteckig",
  arched: "Bogenfenster",
  round: "Rund",
  narrowSlit: "Schmale Schießscharte",
  irregular: "Unregelmäßig",
  none: "Keine Fenster",
};

const WINDOW_LIGHTING_LABELS: Readonly<Record<BuildingWindowLighting, string>> = {
  dark: "Dunkel",
  neutral: "Neutral",
  warmLit: "Warm beleuchtet",
  coolLit: "Kühl beleuchtet",
  mixed: "Gemischte Lichtzustände",
  boarded: "Vernagelt / verdeckt",
};

const CONDITION_LABELS: Readonly<Record<BuildingCondition, string>> = {
  maintained: "Gepflegt",
  used: "Genutzt",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  abandoned: "Verlassen",
  overgrown: "Überwuchert",
};

const OCCUPANCY_LABELS: Readonly<Record<BuildingOccupancy, string>> = {
  inhabited: "Bewohnt",
  active: "Aktiv genutzt",
  vacant: "Leerstehend",
  abandoned: "Verlassen",
};

const ENVIRONMENT_LABELS: Readonly<Record<BuildingEnvironment, string>> = {
  village: "Dorf",
  city: "Stadt",
  forest: "Wald",
  snow: "Schneegebiet",
  swamp: "Sumpf",
  ruin: "Ruinenumgebung",
  dungeon: "Dungeon",
  neutral: "Neutraler Studiokontext",
};

const MAPPING_LABELS: Readonly<Record<BuildingMappingMode, string>> = {
  freestanding: "Freistehendes Gebäude",
  mapIntegrated: "In Karte integriert",
  tileAligned: "Strikt am Tile-Raster ausgerichtet",
  modularSet: "Modularer Bauteilsatz",
};

const COLLISION_LABELS: Readonly<Record<BuildingCollisionMode, string>> = {
  fullyBlocking: "Vollständig blockierend",
  walkableEntrance: "Begehbarer Eingang",
  walkableInterior: "Begehbarer Innenraum",
  mixed: "Gemischte begehbare und blockierende Zonen",
};

const LIGHTING_LABELS: Readonly<Record<BuildingLighting, string>> = {
  worldAligned: "Nur geerbtes Weltlicht",
  warmInterior: "Warmes Innenlicht",
  darkInterior: "Dunkler Innenraum",
  neutralInterior: "Neutrales Innenlicht",
  visibleSources: "Sichtbare lokale Lichtquellen",
  emissive: "Kontrolliert emissiv",
  custom: "Individuell",
};

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const SIZE_OPTIONS = optionsFromIds(BUILDING_SIZE_IDS, SIZE_LABELS);
const PLAN_SHAPE_OPTIONS = optionsFromIds(BUILDING_PLAN_SHAPE_IDS, PLAN_SHAPE_LABELS);
const MATERIAL_OPTIONS = optionsFromIds(BUILDING_MATERIAL_IDS, MATERIAL_LABELS);
const ROOF_SHAPE_OPTIONS = optionsFromIds(BUILDING_ROOF_SHAPE_IDS, ROOF_SHAPE_LABELS);
const ROOF_PITCH_OPTIONS = optionsFromIds(BUILDING_ROOF_PITCH_IDS, ROOF_PITCH_LABELS);
const ROOF_MATERIAL_OPTIONS = optionsFromIds(BUILDING_ROOF_MATERIAL_IDS, ROOF_MATERIAL_LABELS);
const ROOF_CONDITION_OPTIONS = optionsFromIds(BUILDING_ROOF_CONDITION_IDS, ROOF_CONDITION_LABELS);
const FACADE_OPTIONS = optionsFromIds(BUILDING_FACADE_STYLE_IDS, FACADE_LABELS);
const DOOR_TYPE_OPTIONS = optionsFromIds(BUILDING_DOOR_TYPE_IDS, DOOR_TYPE_LABELS);
const DOOR_STATE_OPTIONS = optionsFromIds(BUILDING_DOOR_STATE_IDS, DOOR_STATE_LABELS);
const WINDOW_SHAPE_OPTIONS = optionsFromIds(BUILDING_WINDOW_SHAPE_IDS, WINDOW_SHAPE_LABELS);
const WINDOW_LIGHTING_OPTIONS = optionsFromIds(
  BUILDING_WINDOW_LIGHTING_IDS,
  WINDOW_LIGHTING_LABELS,
);
const CONDITION_OPTIONS = optionsFromIds(BUILDING_CONDITION_IDS, CONDITION_LABELS);
const OCCUPANCY_OPTIONS = optionsFromIds(BUILDING_OCCUPANCY_IDS, OCCUPANCY_LABELS);
const ENVIRONMENT_OPTIONS = optionsFromIds(BUILDING_ENVIRONMENT_IDS, ENVIRONMENT_LABELS);
const MAPPING_OPTIONS = optionsFromIds(BUILDING_MAPPING_MODE_IDS, MAPPING_LABELS);
const COLLISION_OPTIONS = optionsFromIds(BUILDING_COLLISION_MODE_IDS, COLLISION_LABELS);
const LIGHTING_OPTIONS = optionsFromIds(BUILDING_LIGHTING_IDS, LIGHTING_LABELS);

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

function optionalBooleanValue(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function fieldError(form: BuildingForm, field: keyof WizardCoreFormValues): string | null {
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
  form: BuildingForm;
  help: string;
  label: string;
  name: BuildingSelectFieldName;
  options: readonly SelectOption[];
}>) {
  const id = `building-${name}`;
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
  form: BuildingForm;
  help: string;
  label: string;
  maxLength: number;
  name: BuildingTextFieldName;
  notifyProgrammaticChange: () => void;
  wide?: boolean;
}>) {
  const id = `building-${name}`;
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
  form: BuildingForm;
  help: string;
  label: string;
  max: number;
  min: number;
  name: BuildingNumberFieldName;
}>) {
  const id = `building-${name}`;
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

function BuildingTypeField({
  buildingType,
  subtype,
}: Readonly<{
  buildingType: BuildingType;
  subtype: BuildingSubtype;
}>) {
  return (
    <div className={styles.field}>
      <span id="building-type-label" className={styles.fieldLabel}>
        Gebäudetyp
      </span>
      <output
        className={styles.derivedValue}
        aria-labelledby="building-type-label"
        aria-describedby="building-type-help"
      >
        {TYPE_LABELS[buildingType]}
      </output>
      <p id="building-type-help" className={styles.help}>
        Aus dem Untertyp {SUBTYPE_LABELS[subtype]} abgeleitet. Ein Wechsel erfolgt im Schritt
        Bildart.
      </p>
    </div>
  );
}

function TechnicalGeometryFields({
  cameraAngle,
  perspectiveType,
  projectionType,
  tileSize,
}: Readonly<{
  cameraAngle?: WizardCoreFormValues["cameraAngle"];
  perspectiveType?: WizardCoreFormValues["perspectiveType"];
  projectionType?: WizardCoreFormValues["projectionType"];
  tileSize?: number;
}>) {
  const perspectiveLabels = {
    topdown: "Top-down",
    threeQuarter: "3/4-RPG",
    isometric: "Isometrisch",
    side: "Seitenansicht",
  } as const;
  const projectionLabels = {
    orthographic: "Orthografisch",
    mildPerspective: "Leichte Perspektive",
  } as const;
  const geometry = [
    perspectiveType === undefined ? null : perspectiveLabels[perspectiveType],
    cameraAngle === undefined ? null : `${String(cameraAngle)}°`,
    projectionType === undefined ? null : projectionLabels[projectionType],
  ].filter((value): value is string => value !== null);

  return (
    <>
      <div className={styles.field}>
        <span id="building-tile-size-label" className={styles.fieldLabel}>
          Wirksame Tilegröße
        </span>
        <output
          className={styles.derivedValue}
          aria-labelledby="building-tile-size-label"
          aria-describedby="building-tile-size-help"
        >
          {tileSize === undefined
            ? "Nicht festgelegt"
            : `${String(tileSize)} × ${String(tileSize)} px`}
        </output>
        <p id="building-tile-size-help" className={styles.help}>
          Technischer Wert aus der Profilvererbung; keine Building-Antwort.
        </p>
      </div>
      <div className={styles.field}>
        <span id="building-world-geometry-label" className={styles.fieldLabel}>
          Wirksame Weltgeometrie
        </span>
        <output
          className={styles.derivedValue}
          aria-labelledby="building-world-geometry-label"
          aria-describedby="building-world-geometry-help"
        >
          {geometry.length === 0 ? "Nicht festgelegt" : geometry.join(" · ")}
        </output>
        <p id="building-world-geometry-help" className={styles.help}>
          Perspektive, Kamerawinkel und Projektion werden aus dem Basisprofil geerbt und nicht im
          Gebäude dupliziert.
        </p>
      </div>
    </>
  );
}

export interface BuildingArchitectureEditorProps {
  readonly form: BuildingForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: BuildingSubtype;
}

export function BuildingArchitectureEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: BuildingArchitectureEditorProps) {
  const buildingType = getDefaultBuildingType(subtype);
  const capabilities = resolveCapabilities("building", subtype);
  const tileSize = useWatch({ control: form.control, name: "tileSize" });
  const perspectiveType = useWatch({
    control: form.control,
    name: "perspectiveType",
  });
  const cameraAngle = useWatch({ control: form.control, name: "cameraAngle" });
  const projectionType = useWatch({
    control: form.control,
    name: "projectionType",
  });
  const footprintWidth = useWatch({
    control: form.control,
    name: "buildingFootprintWidthTiles",
  });
  const footprintDepth = useWatch({
    control: form.control,
    name: "buildingFootprintDepthTiles",
  });
  const footprintIsPartial = (footprintWidth === undefined) !== (footprintDepth === undefined);
  const mappingOptions = capabilities.modular
    ? MAPPING_OPTIONS
    : MAPPING_OPTIONS.filter((option) => option.value !== "modularSet");
  const planShapeOptions = capabilities.modular
    ? PLAN_SHAPE_OPTIONS
    : PLAN_SHAPE_OPTIONS.filter((option) => option.value !== "modular");
  const modularError = fieldError(form, "buildingModular");

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="building-context-title">
        <div className={styles.contextCopy}>
          <p className={styles.eyebrow}>Gebäude / Architektur</p>
          <h3 id="building-context-title">{SUBTYPE_LABELS[subtype]} gestalten</h3>
          <p className={styles.contextHelp}>
            Baukörper, Fassade und Öffnungen folgen demselben Tile-Raster und derselben Weltkamera
            wie die übrigen Kartenassets.
          </p>
        </div>
        <div className={styles.buildingMark} aria-hidden="true">
          <span className={styles.roofMark} />
          <span className={styles.wallMark} />
          <span className={styles.doorMark} />
          <span className={styles.windowMark} />
          <span className={styles.shadowMark} />
        </div>
        <ul className={styles.statusList} aria-label="Gebäude-Capabilities">
          <li className={styles.statusBadge}>Keine Richtungsansichten</li>
          <li className={styles.statusBadge}>Tile-Footprint</li>
          <li className={styles.statusBadge}>
            {capabilities.modular ? "Modularität verfügbar" : "Komplettbau"}
          </li>
          {capabilities.animated ? (
            <li className={styles.statusBadge}>Animation separat verfügbar</li>
          ) : null}
        </ul>
      </section>

      <section className={styles.logicNote} aria-labelledby="building-logic-title">
        <h3 id="building-logic-title">Weltkamera und Lichtseite bleiben stabil</h3>
        <p>
          Gebäude erhalten kein 4/8-Richtungsset. Eine optionale Toranimation beschreibt Zeitphasen
          am festen Footprint und wird im separaten Capability-Schritt gewählt.
        </p>
      </section>

      <fieldset className={styles.group}>
        <legend>Nutzung und Baukörper</legend>
        <p className={styles.groupIntro}>
          Lege Funktion, große Grundform und vertikale Staffelung fest, bevor kleinteilige
          Fassadendetails hinzukommen.
        </p>
        <div className={styles.fieldGrid}>
          <BuildingTypeField buildingType={buildingType} subtype={subtype} />
          <SelectField
            form={form}
            name="buildingPlanShape"
            label="Bauform / Grundriss"
            help="Große Grundrissform, die im orthografischen Tile-Raster lesbar bleibt."
            options={planShapeOptions}
          />
          <SelectField
            form={form}
            name="buildingSize"
            label="Größenklasse"
            help="Visuelle Gesamtgröße relativ zu den übrigen Weltassets."
            options={SIZE_OPTIONS}
          />
          <NumberField
            form={form}
            name="buildingFloors"
            label="Stockwerke"
            help="Ganzzahlig von 1 bis 20."
            min={1}
            max={20}
          />
          <NumberField
            form={form}
            name="buildingHeightPixels"
            label="Gesamthöhe in Pixeln"
            help="Optionaler Produktionswert von 16 bis 8192 px."
            min={16}
            max={8192}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingPurpose"
            label="Nutzung und Bewohnerrolle"
            help="Zum Beispiel Wohnhaus einer Handwerkerfamilie, Laden oder Wachposten."
            maxLength={200}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingDescription"
            label="Kurze Gebäudebeschreibung"
            help="Fasse Funktion, Silhouette und wichtigste Erkennungsmerkmale zusammen."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Footprint und Mapping-Kompatibilität</legend>
        <p className={styles.groupIntro}>
          Breite und Tiefe bilden gemeinsam den Footprint. Eingang und blockierende Flächen müssen
          auf der Karte eindeutig bleiben.
        </p>
        <div className={styles.fieldGrid}>
          <NumberField
            form={form}
            name="buildingFootprintWidthTiles"
            label="Footprint · Breite in Tiles"
            help="Ganzzahlig von 1 bis 64; nur gemeinsam mit der Tiefe gültig."
            min={1}
            max={64}
          />
          <NumberField
            form={form}
            name="buildingFootprintDepthTiles"
            label="Footprint · Tiefe in Tiles"
            help="Ganzzahlig von 1 bis 64; nur gemeinsam mit der Breite gültig."
            min={1}
            max={64}
          />
          <SelectField
            form={form}
            name="buildingMappingMode"
            label="Mapping-Modus"
            help="Legt fest, wie das Gebäude in Tile-Karten und Bauteilsätze integriert wird."
            options={mappingOptions}
          />
          <SelectField
            form={form}
            name="buildingCollisionMode"
            label="Kollisionslesbarkeit"
            help="Kennzeichnet blockierende Flächen, Eingänge und gegebenenfalls Innenräume."
            options={COLLISION_OPTIONS}
          />
          {capabilities.modular ? (
            <FieldShell
              error={modularError}
              help="Speichert die bewusste Entscheidung für oder gegen kombinierbare Bauteile."
              id="building-buildingModular"
              label="Modularer Ausgabesatz"
            >
              <select
                id="building-buildingModular"
                aria-describedby={`building-buildingModular-help${
                  modularError ? " building-buildingModular-error" : ""
                }`}
                aria-invalid={modularError ? "true" : "false"}
                {...form.register("buildingModular", {
                  setValueAs: optionalBooleanValue,
                })}
              >
                <option value="">Nicht festgelegt</option>
                <option value="true">Ja, kombinierbare Bauteile</option>
                <option value="false">Nein, komplettes Gebäude</option>
              </select>
            </FieldShell>
          ) : null}
          <TechnicalGeometryFields
            {...(tileSize === undefined ? {} : { tileSize })}
            {...(perspectiveType === undefined ? {} : { perspectiveType })}
            {...(cameraAngle === undefined ? {} : { cameraAngle })}
            {...(projectionType === undefined ? {} : { projectionType })}
          />
        </div>
        {footprintIsPartial ? (
          <p
            className={styles.footprintWarning}
            role="status"
            aria-label="Gebäude-Footprint-Hinweis"
          >
            Der Gebäude-Footprint ist unvollständig. Ergänze Breite und Tiefe gemeinsam oder leere
            beide Werte.
          </p>
        ) : null}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Material, Dach und Fassade</legend>
        <p className={styles.groupIntro}>
          Materialwechsel und Konstruktion sollen als große, pixelklare Flächen lesbar sein und zum
          Zustand des Gebäudes passen.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="buildingPrimaryMaterial"
            label="Hauptmaterial"
            help="Dominantes Material von Tragwerk und großen Fassadenflächen."
            options={MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingSecondaryMaterial"
            label="Sekundärmaterial"
            help="Optionales Material für Sockel, Rahmen, Stützen oder Beschläge."
            options={MATERIAL_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingMaterialDetails"
            label="Material- und Konstruktionsdetails"
            help="Beschreibe Balken, Mauerfugen, Putz, Stützen und Materialwechsel."
            maxLength={500}
            wide
          />
          <SelectField
            form={form}
            name="buildingRoofShape"
            label="Dachform"
            help="Große Dachsilhouette einschließlich fehlendem oder eingestürztem Dach."
            options={ROOF_SHAPE_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingRoofPitch"
            label="Dachneigung"
            help="Steilheit der sichtbaren Dachflächen in der geerbten Kamera."
            options={ROOF_PITCH_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingRoofMaterial"
            label="Dachmaterial"
            help="Material der größten sichtbaren Dachfläche."
            options={ROOF_MATERIAL_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingRoofCondition"
            label="Dachzustand"
            help="Intakt, verwittert, beschädigt, eingestürzt oder überwuchert."
            options={ROOF_CONDITION_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingRoofDetails"
            label="Dachdetails"
            help="Zum Beispiel Gauben, Schornsteine, First, Lücken oder Bewuchs."
            maxLength={500}
          />
          <SelectField
            form={form}
            name="buildingFacadeStyle"
            label="Fassadenaufbau"
            help="Tragwerk und sichtbare Gliederung der Außenwände."
            options={FACADE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingFacadeDetails"
            label="Fassadendetails"
            help="Balken, Steine, Schilder, Stützen, Ornamente oder Bruchstellen."
            maxLength={500}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Türen und Fenster</legend>
        <p className={styles.groupIntro}>
          Öffnungen strukturieren die Fassade und müssen trotz nativer Pixelgröße, Beleuchtung und
          Zustand eindeutig erkennbar bleiben.
        </p>
        <div className={styles.fieldGrid}>
          <NumberField
            form={form}
            name="buildingDoorCount"
            label="Anzahl Türen / Tore"
            help="Ganzzahlig von 0 bis 64."
            min={0}
            max={64}
          />
          <SelectField
            form={form}
            name="buildingDoorType"
            label="Tür- oder Tortyp"
            help="Dominante Öffnung der sichtbaren Fassade."
            options={DOOR_TYPE_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingDoorState"
            label="Türzustand"
            help="Offen, geschlossen, angelehnt, blockiert oder beschädigt."
            options={DOOR_STATE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingDoorPosition"
            label="Türposition und Eingangsausrichtung"
            help="Position relativ zum Footprint und zu begehbaren Tile-Kanten."
            maxLength={500}
          />
          <NumberField
            form={form}
            name="buildingWindowCount"
            label="Anzahl Fenster"
            help="Ganzzahlig von 0 bis 256."
            min={0}
            max={256}
          />
          <SelectField
            form={form}
            name="buildingWindowShape"
            label="Fensterform"
            help="Dominante Form oder bewusster Verzicht auf Fenster."
            options={WINDOW_SHAPE_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingWindowLighting"
            label="Fensterlicht"
            help="Sichtbarer Lichtzustand, der zur lokalen Innenbeleuchtung passt."
            options={WINDOW_LIGHTING_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingWindowDetails"
            label="Fensterdetails"
            help="Rahmen, Läden, Verglasung, Gitter oder beschädigte Öffnungen."
            maxLength={500}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Zustand, Belegung und Licht</legend>
        <p className={styles.groupIntro}>
          Gebäudenutzung und lokales Licht ergänzen die geerbte Weltbeleuchtung, ohne deren Richtung
          still zu verändern.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="buildingCondition"
            label="Gebäudezustand"
            help="Pflege, Abnutzung, Beschädigung, Verlassenheit oder Bewuchs."
            options={CONDITION_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingOccupancy"
            label="Bewohnt / verlassen"
            help="Bewohnt, aktiv genutzt, leerstehend oder verlassen."
            options={OCCUPANCY_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingEnvironment"
            label="Umgebungskontext"
            help="Kartenkontext für Anschlussflächen, Wetterung und Dekoration."
            options={ENVIRONMENT_OPTIONS}
          />
          <SelectField
            form={form}
            name="buildingLighting"
            label="Lokale Gebäudebeleuchtung"
            help="Ergänzt das geerbte Weltlicht durch kontrolliertes Innen- oder Quellenlicht."
            options={LIGHTING_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingLightSourceDetails"
            label="Sichtbare Lichtquellen"
            help="Zum Beispiel Fensterlicht, Laternen oder ein schwacher magischer Akzent."
            maxLength={500}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Weitere Architekturdetails</legend>
        <div className={styles.fieldGrid}>
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="buildingExtraDetails"
            label="Weitere Architekturdetails"
            help="Optionale Ergänzungen zu Umgebung, Schildern, Lesbarkeit oder modularen Anschlüssen."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>
    </div>
  );
}
