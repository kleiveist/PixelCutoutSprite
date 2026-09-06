import type { ReactNode } from "react";
import { useController, useWatch, type UseFormReturn } from "react-hook-form";
import { GUIDED_TEXT_PRESETS_DE } from "../../domain/guided-answers";
import {
  TILESET_ATLAS_LAYOUT_IDS,
  TILESET_CORNER_SET_IDS,
  TILESET_EDGE_SET_IDS,
  TILESET_REPEAT_MODE_IDS,
  TILESET_SEAM_MODE_IDS,
  TILESET_TILEABLE_AXES_IDS,
  TILESET_TRANSITION_MODE_IDS,
  TILESET_USAGE_IDS,
  TILESET_VARIANT_KIND_IDS,
  createTilesetTechnicalSpecification,
  getDefaultTilesetType,
  tilesetSubtypeSupportsCorners,
  tilesetSubtypeSupportsEdges,
  tilesetSubtypeSupportsTransitions,
  type TilesetAtlasLayout,
  type TilesetCornerSet,
  type TilesetEdgeSet,
  type TilesetRepeatMode,
  type TilesetSeamMode,
  type TilesetSubtype,
  type TilesetTechnicalSpecification,
  type TilesetTileableAxes,
  type TilesetTransitionMode,
  type TilesetType,
  type TilesetUsage,
  type TilesetVariantKind,
} from "../../domain/tilesets";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { GuidedTextChoice } from "../wizard/GuidedTextChoice";
import styles from "./TilesetEditor.module.css";

type TilesetForm = UseFormReturn<WizardCoreFormValues>;

type TilesetTextFieldName =
  | "tilesetDescription"
  | "tilesetEdgeDetails"
  | "tilesetSourceMaterial"
  | "tilesetTargetMaterial"
  | "tilesetSeamDetails"
  | "tilesetExtraDetails";

type TilesetSelectFieldName =
  | "tilesetUsage"
  | "tilesetEdgeSet"
  | "tilesetCornerSet"
  | "tilesetTransitionMode"
  | "tilesetSeamMode"
  | "tileableAxes"
  | "tilesetRepeatMode"
  | "tilesetAtlasLayout";

type TilesetNumberFieldName =
  | "tilesetVariantCount"
  | "tilesetAtlasTileCount"
  | "tilesetAtlasColumns"
  | "tilesetAtlasGutterPixels"
  | "tilesetAtlasMarginPixels";

interface SelectOption<Value extends string = string> {
  readonly value: Value;
  readonly label: string;
}

const SUBTYPE_LABELS: Readonly<Record<TilesetSubtype, string>> = {
  groundTile: "Bodentile",
  wallTile: "Wandtile",
  roofPart: "Dachteil",
  transition: "Übergang",
  corner: "Ecke",
  edge: "Kante",
  autotile: "Autotile",
  decal: "Dekal",
  animatedTile: "Animiertes Tile",
};

const TYPE_LABELS: Readonly<Record<TilesetType, string>> = {
  ground: "Boden",
  wall: "Wand",
  roof: "Dach",
  transition: "Materialübergang",
  corner: "Eckverbindung",
  edge: "Kantenverbindung",
  autotile: "Regelbasiertes Autotile",
  decal: "Tile-Dekal",
  animated: "Animiertes Tile",
};

const USAGE_LABELS: Readonly<Record<TilesetUsage, string>> = {
  floor: "Bodenfläche",
  wall: "Wandfläche",
  roof: "Dachfläche",
  transition: "Übergang / Anschluss",
  decor: "Dekoration",
};

const EDGE_SET_LABELS: Readonly<Record<TilesetEdgeSet, string>> = {
  none: "Keine eigenen Kanten",
  cardinal: "Vier Kardinalkanten",
  cardinalAndDiagonal: "Kardinal- und Diagonalkanten",
  custom: "Individuelles Kantenset",
};

const CORNER_SET_LABELS: Readonly<Record<TilesetCornerSet, string>> = {
  none: "Keine Eckvarianten",
  outer: "Nur Außenecken",
  inner: "Nur Innenecken",
  innerAndOuter: "Innen- und Außenecken",
  custom: "Individuelles Eckset",
};

const TRANSITION_MODE_LABELS: Readonly<Record<TilesetTransitionMode, string>> = {
  none: "Kein Materialübergang",
  oneWay: "Einseitiger Übergang",
  bidirectional: "Beidseitiger Übergang",
  multiMaterial: "Mehrere Nachbarmaterialien",
  custom: "Individuelle Übergangslogik",
};

const SEAM_MODE_LABELS: Readonly<Record<TilesetSeamMode, string>> = {
  seamless: "Vollständig nahtlos",
  matchedEdges: "Explizit passende Randpixel",
  intentionalBoundary: "Bewusste sichtbare Grenze",
  overlap: "Überlappender Rand / Bleed",
  custom: "Individuelle Seam-Regel",
};

const TILEABLE_AXES_LABELS: Readonly<Record<TilesetTileableAxes, string>> = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  both: "Horizontal und vertikal",
  none: "Keine Achsenwiederholung",
};

const REPEAT_MODE_LABELS: Readonly<Record<TilesetRepeatMode, string>> = {
  strict: "Strikte regelmäßige Wiederholung",
  staggered: "Versetzte Wiederholung",
  randomized: "Kontrolliert variierte Wiederholung",
  nonRepeating: "Nicht wiederholend",
};

const VARIANT_KIND_LABELS: Readonly<Record<TilesetVariantKind, string>> = {
  clean: "Saubere Basisvariante",
  damaged: "Beschädigte Variante",
  decorated: "Dekorierte Variante",
  decal: "Dekalvariante",
  seasonal: "Saisonale Variante",
  randomized: "Zufallsvariante",
};

const ATLAS_LAYOUT_LABELS: Readonly<Record<TilesetAtlasLayout, string>> = {
  automatic: "Automatisch kompakt",
  singleRow: "Eine Zeile",
  singleColumn: "Eine Spalte",
  fixedColumns: "Feste Spaltenzahl",
};

const PIXEL_DENSITY_LABELS = {
  classicHd: "Classic-HD",
  modernHd: "Modern-HD",
  ultraHd: "Ultra-HD",
} as const;

function optionsFromIds<Value extends string>(
  ids: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): readonly SelectOption<Value>[] {
  return ids.map((value) => ({ value, label: labels[value] }));
}

const USAGE_OPTIONS = optionsFromIds(TILESET_USAGE_IDS, USAGE_LABELS);
const EDGE_SET_OPTIONS = optionsFromIds(TILESET_EDGE_SET_IDS, EDGE_SET_LABELS);
const CORNER_SET_OPTIONS = optionsFromIds(TILESET_CORNER_SET_IDS, CORNER_SET_LABELS);
const TRANSITION_MODE_OPTIONS = optionsFromIds(TILESET_TRANSITION_MODE_IDS, TRANSITION_MODE_LABELS);
const SEAM_MODE_OPTIONS = optionsFromIds(TILESET_SEAM_MODE_IDS, SEAM_MODE_LABELS);
const TILEABLE_AXES_OPTIONS = optionsFromIds(TILESET_TILEABLE_AXES_IDS, TILEABLE_AXES_LABELS);
const REPEAT_MODE_OPTIONS = optionsFromIds(TILESET_REPEAT_MODE_IDS, REPEAT_MODE_LABELS);
const ATLAS_LAYOUT_OPTIONS = optionsFromIds(TILESET_ATLAS_LAYOUT_IDS, ATLAS_LAYOUT_LABELS);

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

function fieldError(form: TilesetForm, field: keyof WizardCoreFormValues): string | null {
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
  onValueChange,
  options,
}: Readonly<{
  form: TilesetForm;
  help: string;
  label: string;
  name: TilesetSelectFieldName;
  onValueChange?: (value: string | undefined) => void;
  options: readonly SelectOption[];
}>) {
  const id = `tileset-${name}`;
  const error = fieldError(form, name);
  const describedBy = `${id}-help${error ? ` ${id}-error` : ""}`;

  return (
    <FieldShell error={error} help={help} id={id} label={label}>
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        {...form.register(name, {
          setValueAs: optionalSelectValue,
          onChange: (event) => {
            onValueChange?.(optionalSelectValue(event.currentTarget.value));
          },
        })}
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
  form: TilesetForm;
  help: string;
  label: string;
  maxLength: number;
  name: TilesetTextFieldName;
  notifyProgrammaticChange: () => void;
  wide?: boolean;
}>) {
  const id = `tileset-${name}`;
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
  form: TilesetForm;
  help: string;
  label: string;
  max: number;
  min: number;
  name: TilesetNumberFieldName;
}>) {
  const id = `tileset-${name}`;
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

function VariantKindsField({ form }: Readonly<{ form: TilesetForm }>) {
  const controller = useController({
    control: form.control,
    name: "tilesetVariantKinds",
  });
  const selected = new Set(controller.field.value ?? []);
  const error = fieldError(form, "tilesetVariantKinds");
  const describedBy = `tileset-variant-kinds-help${error ? " tileset-variant-kinds-error" : ""}`;

  const updateVariant = (variant: TilesetVariantKind, checked: boolean): void => {
    if (checked) selected.add(variant);
    else selected.delete(variant);
    const next = TILESET_VARIANT_KIND_IDS.filter((entry) => selected.has(entry));
    controller.field.onChange(next.length === 0 ? undefined : next);
  };

  return (
    <fieldset
      className={`${styles.field} ${styles.wideField} ${styles.choiceField}`}
      aria-describedby={describedBy}
      aria-invalid={error ? "true" : "false"}
    >
      <legend>Variantenarten</legend>
      <div className={styles.choiceGrid}>
        {TILESET_VARIANT_KIND_IDS.map((variant) => (
          <label key={variant} className={styles.choice}>
            <input
              type="checkbox"
              name={controller.field.name}
              value={variant}
              checked={selected.has(variant)}
              onBlur={controller.field.onBlur}
              onChange={(event) => updateVariant(variant, event.currentTarget.checked)}
              ref={variant === TILESET_VARIANT_KIND_IDS[0] ? controller.field.ref : undefined}
            />
            <span>{VARIANT_KIND_LABELS[variant]}</span>
          </label>
        ))}
      </div>
      <p id="tileset-variant-kinds-help" className={styles.help}>
        Wähle nur Varianten, die als eigenständige Atlas-Slots produziert werden.
      </p>
      {error ? (
        <p id="tileset-variant-kinds-error" className={styles.error}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function validInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): value is number {
  return value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function resolveTechnicalSpecification(
  tileSize: number | undefined,
  tileCount: number | undefined,
  layout: TilesetAtlasLayout | undefined,
  columns: number | undefined,
  gutterPixels: number | undefined,
  marginPixels: number | undefined,
): TilesetTechnicalSpecification | null {
  if (
    !validInteger(tileSize, 1, 8192) ||
    !validInteger(tileCount, 1, 256) ||
    (layout === "fixedColumns" && !validInteger(columns, 1, 64)) ||
    (layout !== undefined && layout !== "fixedColumns" && columns !== undefined) ||
    (gutterPixels !== undefined && !validInteger(gutterPixels, 0, 64)) ||
    (marginPixels !== undefined && !validInteger(marginPixels, 0, 64))
  ) {
    return null;
  }

  try {
    return createTilesetTechnicalSpecification({
      tileSizePixels: tileSize,
      tileCount,
      ...(layout === undefined ? {} : { layout }),
      ...(columns === undefined ? {} : { fixedColumns: columns }),
      ...(gutterPixels === undefined ? {} : { gutterPixels }),
      ...(marginPixels === undefined ? {} : { marginPixels }),
    });
  } catch {
    return null;
  }
}

function TechnicalSpecificationCard({
  specification,
}: Readonly<{ specification: TilesetTechnicalSpecification | null }>) {
  if (specification === null) {
    return (
      <section className={styles.specificationCard} aria-live="polite">
        <h4>Technische Atlas-Spezifikation</h4>
        <p>
          Trage eine gültige Atlas-Tilezahl ein. Beim festen Layout wird zusätzlich die Spaltenzahl
          benötigt.
        </p>
      </section>
    );
  }

  const { metrics } = specification;
  return (
    <section
      className={styles.specificationCard}
      aria-labelledby="tileset-specification-title"
      aria-live="polite"
    >
      <h4 id="tileset-specification-title">Technische Atlas-Spezifikation</h4>
      <dl className={styles.metricGrid}>
        <div>
          <dt>Tile-Zelle</dt>
          <dd>
            {metrics.tileSizePixels} × {metrics.tileSizePixels} px
          </dd>
        </div>
        <div>
          <dt>Atlas-Raster</dt>
          <dd>
            {metrics.columns} × {metrics.rows} Zellen
          </dd>
        </div>
        <div>
          <dt>Canvas</dt>
          <dd>
            {metrics.atlasWidthPixels} × {metrics.atlasHeightPixels} px
          </dd>
        </div>
        <div>
          <dt>Belegung</dt>
          <dd>
            {metrics.tileCount} von {metrics.capacity} Slots
          </dd>
        </div>
        <div>
          <dt>Zwischenraum</dt>
          <dd>{metrics.gutterPixels} px</dd>
        </div>
        <div>
          <dt>Außenrand</dt>
          <dd>{metrics.marginPixels} px</dd>
        </div>
      </dl>
      {metrics.unusedCells > 0 ? (
        <p className={styles.capacityNote}>
          {metrics.unusedCells === 1
            ? "1 Atlas-Slot bleibt frei."
            : `${String(metrics.unusedCells)} Atlas-Slots bleiben frei.`}
        </p>
      ) : null}
    </section>
  );
}

export interface TilesetEditorProps {
  readonly form: TilesetForm;
  readonly notifyProgrammaticChange: () => void;
  readonly subtype: TilesetSubtype;
}

export function TilesetEditor({ form, notifyProgrammaticChange, subtype }: TilesetEditorProps) {
  const tilesetType = getDefaultTilesetType(subtype);
  const supportsEdges = tilesetSubtypeSupportsEdges(subtype);
  const supportsCorners = tilesetSubtypeSupportsCorners(subtype);
  const supportsTransitions = tilesetSubtypeSupportsTransitions(subtype);
  const tileSize = useWatch({ control: form.control, name: "tileSize" });
  const pixelDensity = useWatch({
    control: form.control,
    name: "pixelDensity",
  });
  const atlasLayout = useWatch({
    control: form.control,
    name: "tilesetAtlasLayout",
  });
  const atlasTileCount = useWatch({
    control: form.control,
    name: "tilesetAtlasTileCount",
  });
  const atlasColumns = useWatch({
    control: form.control,
    name: "tilesetAtlasColumns",
  });
  const atlasGutterPixels = useWatch({
    control: form.control,
    name: "tilesetAtlasGutterPixels",
  });
  const atlasMarginPixels = useWatch({
    control: form.control,
    name: "tilesetAtlasMarginPixels",
  });
  const specification = resolveTechnicalSpecification(
    tileSize,
    atlasTileCount,
    atlasLayout,
    atlasColumns,
    atlasGutterPixels,
    atlasMarginPixels,
  );

  return (
    <div className={styles.editor}>
      <section className={styles.contextCard} aria-labelledby="tileset-context-title">
        <div className={styles.contextCopy}>
          <p className={styles.eyebrow}>Tileset / Kartenelement</p>
          <h3 id="tileset-context-title">{SUBTYPE_LABELS[subtype]} strukturieren</h3>
          <p className={styles.contextHelp}>
            Jede Zelle bleibt am geerbten Pixelraster ausgerichtet. Verbindungen, Varianten und
            Atlas-Slots werden als Mappingregeln statt als Richtungsansichten beschrieben.
          </p>
        </div>
        <div className={styles.tileMark} aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} data-accent={index === 4 ? "true" : "false"} />
          ))}
        </div>
        <ul className={styles.statusList} aria-label="Tileset-Capabilities">
          <li className={styles.statusBadge}>Gridgebunden</li>
          <li className={styles.statusBadge}>Kachelbar</li>
          <li className={styles.statusBadge}>Keine Richtungsansichten</li>
          {supportsEdges ? <li className={styles.statusBadge}>Verbindungsset</li> : null}
          {subtype === "animatedTile" ? (
            <li className={styles.statusBadge}>Animation separat</li>
          ) : null}
        </ul>
      </section>

      <section className={styles.logicNote} aria-labelledby="tileset-logic-title">
        <h3 id="tileset-logic-title">Ein Grid, deterministische Anschlüsse</h3>
        <p>
          Gegenüberliegende Kanten müssen pixelgenau zusammenpassen. Innen- und Außenecken
          erscheinen nur bei passenden Untertypen; Animation bleibt ein eigener Capability-Schritt
          ohne 4/8-Richtungsset.
        </p>
      </section>

      <fieldset className={styles.group}>
        <legend>Grid und Tiletyp</legend>
        <p className={styles.groupIntro}>
          Tilegröße und Pixelmaßstab stammen aus der technischen Profilkette und werden nicht als
          Tileset-Antwort dupliziert.
        </p>
        <div className={styles.fieldGrid}>
          <DerivedField
            id="tileset-type"
            label="Tiletyp"
            value={TYPE_LABELS[tilesetType]}
            help={`Aus dem Untertyp ${SUBTYPE_LABELS[subtype]} abgeleitet.`}
          />
          <DerivedField
            id="tileset-grid"
            label="Wirksames Tile-Grid"
            value={
              tileSize === undefined
                ? "Nicht festgelegt"
                : `${String(tileSize)} × ${String(tileSize)} px`
            }
            help="Sperrbarer technischer Wert aus Base→Category→Asset."
          />
          <DerivedField
            id="tileset-pixel-density"
            label="Pixelmaßstab"
            value={
              pixelDensity === undefined ? "Nicht festgelegt" : PIXEL_DENSITY_LABELS[pixelDensity]
            }
            help="Die geerbte Pixeldichte gilt für jede Atlas-Zelle."
          />
          <SelectField
            form={form}
            name="tilesetUsage"
            label="Einsatz im Mapping"
            help="Fläche oder Anschlussrolle, für die das Set produziert wird."
            options={USAGE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="tilesetDescription"
            label="Tileset-Beschreibung"
            help="Material, Lesbarkeit und charakteristische Flächendetails."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Kanten, Übergänge und Ecken</legend>
        <p className={styles.groupIntro}>
          Nur Verbindungen erfassen, die der gewählte Untertyp tatsächlich als eigene Atlas-Slots
          benötigt.
        </p>
        {supportsEdges || supportsCorners || supportsTransitions ? (
          <div className={styles.fieldGrid}>
            {supportsEdges ? (
              <>
                <SelectField
                  form={form}
                  name="tilesetEdgeSet"
                  label="Kantenset"
                  help="Kardinale und gegebenenfalls diagonale Anschlusszustände."
                  options={EDGE_SET_OPTIONS}
                />
                <TextField
                  form={form}
                  notifyProgrammaticChange={notifyProgrammaticChange}
                  name="tilesetEdgeDetails"
                  label="Kantenregeln"
                  help="Reihenfolge, Nachbarschaftsmasken und pixelgenaue Randlogik."
                  maxLength={500}
                />
              </>
            ) : null}
            {supportsCorners ? (
              <SelectField
                form={form}
                name="tilesetCornerSet"
                label="Innen-/Außenecken"
                help="Legt fest, welche konkaven und konvexen Eckzustände enthalten sind."
                options={CORNER_SET_OPTIONS}
              />
            ) : null}
            {supportsTransitions ? (
              <>
                <SelectField
                  form={form}
                  name="tilesetTransitionMode"
                  label="Übergangslogik"
                  help="Richtung und Umfang der Materialübergänge."
                  options={TRANSITION_MODE_OPTIONS}
                />
                <TextField
                  form={form}
                  notifyProgrammaticChange={notifyProgrammaticChange}
                  name="tilesetSourceMaterial"
                  label="Ausgangsmaterial"
                  help="Material auf der primären Seite des Übergangs."
                  maxLength={200}
                />
                <TextField
                  form={form}
                  notifyProgrammaticChange={notifyProgrammaticChange}
                  name="tilesetTargetMaterial"
                  label="Nachbarmaterial"
                  help="Material, das an der gegenüberliegenden Seite anschließt."
                  maxLength={200}
                />
              </>
            ) : null}
          </div>
        ) : (
          <p className={styles.emptyGroupNote} role="note">
            Dieser Untertyp benötigt kein separates Kanten-, Eck- oder Übergangsset. Seine Seam- und
            Wiederholungsregeln bleiben relevant.
          </p>
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Seam-Regeln und Wiederholung</legend>
        <p className={styles.groupIntro}>
          Beschreibe sowohl die erlaubten Wiederholungsachsen als auch die sichtbare Behandlung der
          Randpixel.
        </p>
        <div className={styles.fieldGrid}>
          <SelectField
            form={form}
            name="tileableAxes"
            label="Kachelbare Achsen"
            help="Horizontale, vertikale, beidseitige oder keine Wiederholung."
            options={TILEABLE_AXES_OPTIONS}
          />
          <SelectField
            form={form}
            name="tilesetSeamMode"
            label="Seam-Regel"
            help="Nahtlosigkeit, passende Kanten oder eine bewusste Materialgrenze."
            options={SEAM_MODE_OPTIONS}
          />
          <SelectField
            form={form}
            name="tilesetRepeatMode"
            label="Wiederholungsmuster"
            help="Steuert erkennbare Periodizität und den Einsatz von Varianten."
            options={REPEAT_MODE_OPTIONS}
          />
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="tilesetSeamDetails"
            label="Seam- und Wiederholungsdetails"
            help="Zum Beispiel identische Randzeilen, versetzte Motive oder kontrollierter Bleed."
            maxLength={500}
            wide
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Varianten</legend>
        <p className={styles.groupIntro}>
          Varianten reduzieren sichtbare Wiederholung, ohne Anschlussregeln oder die
          Materialidentität zu verändern.
        </p>
        <div className={styles.fieldGrid}>
          <NumberField
            form={form}
            name="tilesetVariantCount"
            label="Varianten pro Zustand"
            help="Ganzzahlig von 1 bis 64."
            min={1}
            max={64}
          />
          <VariantKindsField form={form} />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Atlaslayout und Tilemetriken</legend>
        <p className={styles.groupIntro}>
          Die Zeilenzahl und exakte Canvasgröße werden aus Slotzahl, Layout, Tilegröße, Zwischenraum
          und Außenrand berechnet.
        </p>
        <div className={styles.fieldGrid}>
          <NumberField
            form={form}
            name="tilesetAtlasTileCount"
            label="Atlas-Tiles insgesamt"
            help="Belegte Atlas-Slots von 1 bis 256, einschließlich Verbindungen und Varianten."
            min={1}
            max={256}
          />
          <SelectField
            form={form}
            name="tilesetAtlasLayout"
            label="Atlaslayout"
            help="Ohne Auswahl wird für die Vorschau ein kompaktes automatisches Raster verwendet."
            options={ATLAS_LAYOUT_OPTIONS}
            onValueChange={(value) => {
              if (value === "fixedColumns") return;
              form.setValue("tilesetAtlasColumns", undefined, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
          />
          {atlasLayout === "fixedColumns" ? (
            <NumberField
              form={form}
              name="tilesetAtlasColumns"
              label="Feste Spaltenzahl"
              help="Ganzzahlig von 1 bis 64; die benötigten Zeilen werden automatisch berechnet."
              min={1}
              max={64}
            />
          ) : null}
          <NumberField
            form={form}
            name="tilesetAtlasGutterPixels"
            label="Zwischenraum in Pixeln"
            help="Optionaler Abstand von 0 bis 64 px zwischen Atlas-Zellen."
            min={0}
            max={64}
          />
          <NumberField
            form={form}
            name="tilesetAtlasMarginPixels"
            label="Außenrand in Pixeln"
            help="Optionaler Rand von 0 bis 64 px auf jeder Canvas-Seite."
            min={0}
            max={64}
          />
        </div>
        <TechnicalSpecificationCard specification={specification} />
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Weitere Tileset-Details</legend>
        <div className={styles.fieldGrid}>
          <TextField
            form={form}
            notifyProgrammaticChange={notifyProgrammaticChange}
            name="tilesetExtraDetails"
            label="Weitere Produktionshinweise"
            help="Optionale Ergänzungen zu Slotreihenfolge, Export oder Mappingkonventionen."
            maxLength={4000}
            wide
          />
        </div>
      </fieldset>
    </div>
  );
}
