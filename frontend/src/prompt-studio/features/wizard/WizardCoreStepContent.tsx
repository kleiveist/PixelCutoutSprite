import { useEffect, useRef, useState } from "react";
import { useController, useWatch } from "react-hook-form";
import { ASSET_SUBTYPES, type AssetCategory, type AssetSubtype } from "../../domain/assets";
import type { ArtworkSubtype } from "../../domain/artworks";
import type { CharacterSubtype } from "../../domain/characters";
import { getDefaultBuildingType, type BuildingSubtype } from "../../domain/buildings";
import { getDefaultItemClass, type ItemSubtype } from "../../domain/items";
import { getDefaultMovingObjectClass, type MovingObjectSubtype } from "../../domain/moving-objects";
import { getDefaultTextureMaterialType, type TextureSubtype } from "../../domain/textures";
import { getDefaultNaturePlantType, type NatureSubtype } from "../../domain/nature";
import { getDefaultStaticObjectClass, type StaticObjectSubtype } from "../../domain/static-objects";
import { getDefaultTilesetType, type TilesetSubtype } from "../../domain/tilesets";
import type { ProfileLibrary } from "../../schemas";
import {
  CharacterAnimationEditor,
  CharacterDetailsEditor,
  type CharacterDetailsSection,
  type CharacterHeightSource,
} from "../character-editor";
import {
  MovingObjectAnimationEditor,
  MovingObjectDetailsEditor,
  type MovingObjectDetailsSection,
} from "../moving-object-editor";
import { TextureMaterialEditor, type TextureDetailsSection } from "../texture-editor";
import { NatureTreeEditor, type NatureDetailsSection } from "../nature-editor";
import { StaticWorldObjectEditor, type StaticObjectDetailsSection } from "../static-object-editor";
import { BuildingArchitectureEditor, type BuildingDetailsSection } from "../building-editor";
import { TilesetEditor, type TilesetDetailsSection } from "../tileset-editor";
import { ItemEquipmentEditor, type ItemDetailsSection } from "../item-editor";
import { ArtworkConceptEditor, type ArtworkDetailsSection } from "../artwork-editor";
import { CategoryIcon } from "../dashboard/CategoryIcon";
import {
  DASHBOARD_CATEGORIES,
  formatSubtypeLabel,
  getDashboardCategory,
} from "../dashboard/dashboardCatalog";
import {
  type GuidedWizardFlowDefinition,
  type GuidedWizardStepComponentProps,
  type GuidedWizardSummaryComponentProps,
} from "./GuidedWizardEngine";
import { BaseProfileStep } from "./BaseProfileStep";
import { VaultBaseProfileStep } from "./VaultBaseProfileStep";
import { WizardTechnicalSummary } from "./WizardTechnicalSummary";
import {
  resolveWizardCapabilities,
  updateWizardDraftFromCoreForm,
  wizardStepIsApplicable,
} from "./wizardCategoryRouting";
import {
  WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
  WIZARD_ARTWORK_DETAIL_FIELD_PATHS,
  WIZARD_BUILDING_DETAIL_FIELD_PATHS,
  WIZARD_ITEM_DETAIL_FIELD_PATHS,
  WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS,
  WIZARD_NATURE_DETAIL_FIELD_PATHS,
  WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS,
  WIZARD_TILESET_DETAIL_FIELD_PATHS,
  WIZARD_TEXTURE_DETAIL_FIELD_PATHS,
  WizardCoreFormSchema,
  getWizardCoreStep,
  type WizardCoreFieldPath,
  type WizardCoreFormValues,
  type WizardCoreStepId,
} from "./wizardSteps";
import { resolveWizardDraftSnapshot } from "./wizardLifecycle";
import {
  WIZARD_CATALOG_PAGES,
  WizardCatalogIdentitySchema,
  WizardCatalogReviewSchema,
  catalogPageForStep,
  isCatalogPageApplicable,
  schemaForCatalogPage,
  updateWizardDraftFromCatalogForm,
  type WizardCatalogStepId,
} from "./wizardCatalog";
import styles from "./WizardView.module.css";

export interface WizardCoreFlowContext {
  readonly categoryHint: AssetCategory | null;
  readonly library: ProfileLibrary | null;
  readonly onOpenBaseProfile?: () => void;
}

type CoreStepProps = GuidedWizardStepComponentProps<WizardCoreFormValues, WizardCoreFlowContext>;

const CAPABILITY_LABELS = {
  movable: "beweglich",
  directional: "richtungsabhängig",
  animated: "animierbar",
  tileable: "kachelbar",
  gridBound: "rastergebunden",
  transparent: "transparent",
  scaledCharacter: "Figurenmaßstab",
  footprint: "Tile-Standfläche",
  wearable: "tragbar",
  modular: "modular",
  freeComposition: "freie Komposition",
} as const;

const ANIMATION_TYPE_OPTIONS = {
  staticObject: [
    ["openClose", "Öffnen / Schließen"],
    ["glow", "Leuchten"],
    ["break", "Zerbrechen"],
    ["custom", "Individuell"],
  ],
  nature: [
    ["wind", "Windbewegung"],
    ["magic", "Magischer Loop"],
    ["custom", "Individuell"],
  ],
  building: [
    ["openClose", "Öffnen / Schließen"],
    ["custom", "Individuell"],
  ],
  tileset: [
    ["water", "Wasser"],
    ["lava", "Lava"],
    ["magic", "Magie"],
    ["custom", "Individuell"],
  ],
} as const;

const CLASSIFICATION_FIELDS = [
  "subtype",
  ...WIZARD_CHARACTER_DETAIL_FIELD_PATHS,
  ...WIZARD_MOVING_OBJECT_DETAIL_FIELD_PATHS,
  ...WIZARD_TEXTURE_DETAIL_FIELD_PATHS,
  ...WIZARD_NATURE_DETAIL_FIELD_PATHS,
  ...WIZARD_STATIC_OBJECT_DETAIL_FIELD_PATHS,
  ...WIZARD_BUILDING_DETAIL_FIELD_PATHS,
  ...WIZARD_TILESET_DETAIL_FIELD_PATHS,
  ...WIZARD_ITEM_DETAIL_FIELD_PATHS,
  ...WIZARD_ARTWORK_DETAIL_FIELD_PATHS,
  "characterAnimationFrames",
  "movingObjectAnimationFrames",
  "directionCount",
  "animationAction",
  "animationType",
] as const satisfies readonly WizardCoreFieldPath[];

function optionalSelectValue(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function fieldError(form: CoreStepProps["form"], field: WizardCoreFieldPath): string | undefined {
  const error = form.formState.errors[field];
  return typeof error?.message === "string" ? error.message : undefined;
}

function clearClassificationFields(form: CoreStepProps["form"], includeSubtype: boolean): void {
  for (const field of CLASSIFICATION_FIELDS) {
    if (!includeSubtype && field === "subtype") continue;
    form.setValue(field, undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }
}

function ProjectStep({ form }: CoreStepProps) {
  const error = fieldError(form, "projectName");
  const describedBy = error
    ? "wizard-project-name-help wizard-project-name-error"
    : "wizard-project-name-help";

  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="wizard-project-name">
        Name des Assets <span className={styles.required}>Pflichtfeld</span>
      </label>
      <input
        id="wizard-project-name"
        type="text"
        autoComplete="off"
        aria-label="Name des Assets (Projektname)"
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        maxLength={120}
        {...form.register("projectName")}
      />
      <p id="wizard-project-name-help" className={styles.fieldHelp}>
        Der Name ordnet Autosave und spätere Prompt-Pakete eindeutig zu.
      </p>
      {error ? (
        <p id="wizard-project-name-error" className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CategoryStep({ draft, form, notifyProgrammaticChange }: CoreStepProps) {
  const firstCategoryRef = useRef<HTMLInputElement>(null);
  const subtypeRef = useRef<HTMLSelectElement>(null);
  const categoryController = useController({
    control: form.control,
    name: "category",
  });
  const subtypeController = useController({
    control: form.control,
    name: "subtype",
  });
  const category = categoryController.field.value;
  const subtype = subtypeController.field.value;
  const naturePlantType = useWatch({
    control: form.control,
    name: "naturePlantType",
  });
  const staticObjectClass = useWatch({
    control: form.control,
    name: "staticObjectClass",
  });
  const buildingType = useWatch({
    control: form.control,
    name: "buildingType",
  });
  const tilesetType = useWatch({
    control: form.control,
    name: "tilesetType",
  });
  const itemClass = useWatch({
    control: form.control,
    name: "itemClass",
  });
  const [pendingCategory, setPendingCategory] = useState<AssetCategory | null>(null);
  const [pendingSubtype, setPendingSubtype] = useState<AssetSubtype | "" | null>(null);
  const categoryError = fieldError(form, "category");
  const subtypeError = fieldError(form, "subtype");
  const capabilities = resolveWizardCapabilities({ category, subtype });
  const knownNatureSubtypes: readonly string[] = ASSET_SUBTYPES.nature;
  const expectedNaturePlantType =
    category === "nature" && subtype !== undefined && knownNatureSubtypes.includes(subtype)
      ? getDefaultNaturePlantType(subtype as NatureSubtype)
      : null;
  const naturePlantTypeMismatch =
    expectedNaturePlantType !== null &&
    naturePlantType !== undefined &&
    naturePlantType !== expectedNaturePlantType;
  const knownStaticObjectSubtypes: readonly string[] = ASSET_SUBTYPES.staticObject;
  const expectedStaticObjectClass =
    category === "staticObject" &&
    subtype !== undefined &&
    knownStaticObjectSubtypes.includes(subtype)
      ? getDefaultStaticObjectClass(subtype as StaticObjectSubtype)
      : null;
  const staticObjectClassMismatch =
    expectedStaticObjectClass !== null &&
    staticObjectClass !== undefined &&
    staticObjectClass !== expectedStaticObjectClass;
  const knownBuildingSubtypes: readonly string[] = ASSET_SUBTYPES.building;
  const expectedBuildingType =
    category === "building" && subtype !== undefined && knownBuildingSubtypes.includes(subtype)
      ? getDefaultBuildingType(subtype as BuildingSubtype)
      : null;
  const buildingTypeMismatch =
    expectedBuildingType !== null &&
    buildingType !== undefined &&
    buildingType !== expectedBuildingType;
  const knownTilesetSubtypes: readonly string[] = ASSET_SUBTYPES.tileset;
  const expectedTilesetType =
    category === "tileset" && subtype !== undefined && knownTilesetSubtypes.includes(subtype)
      ? getDefaultTilesetType(subtype as TilesetSubtype)
      : null;
  const tilesetTypeMismatch =
    expectedTilesetType !== null &&
    tilesetType !== undefined &&
    tilesetType !== expectedTilesetType;
  const knownItemSubtypes: readonly string[] = ASSET_SUBTYPES.item;
  const expectedItemClass =
    category === "item" && subtype !== undefined && knownItemSubtypes.includes(subtype)
      ? getDefaultItemClass(subtype as ItemSubtype)
      : null;
  const itemClassMismatch =
    expectedItemClass !== null && itemClass !== undefined && itemClass !== expectedItemClass;

  useEffect(() => {
    if (categoryError) {
      firstCategoryRef.current?.focus();
      return;
    }
    if (subtypeError) subtypeRef.current?.focus();
  }, [categoryError, subtypeError]);

  const applyCategory = (nextCategory: AssetCategory, captureSelection = false): void => {
    const selectionSnapshot = captureSelection ? form.getValues() : undefined;
    subtypeController.field.onChange(undefined);
    clearClassificationFields(form, false);
    categoryController.field.onChange(nextCategory);
    setPendingCategory(null);
    setPendingSubtype(null);
    if (selectionSnapshot) {
      notifyProgrammaticChange({
        allowIncompleteStep: true,
        persistImmediately: true,
        selectionSnapshot,
      });
    }
  };

  const requestCategory = (nextCategory: AssetCategory): void => {
    if (nextCategory === category) return;
    setPendingSubtype(null);
    if ("category" in draft && draft.category !== nextCategory) {
      setPendingCategory(nextCategory);
      return;
    }
    applyCategory(nextCategory);
  };

  const applySubtype = (nextSubtype: AssetSubtype | "", captureSelection = false): void => {
    const selectionSnapshot = captureSelection ? form.getValues() : undefined;
    subtypeController.field.onChange(undefined);
    clearClassificationFields(form, false);
    if (nextSubtype !== "") {
      subtypeController.field.onChange(nextSubtype);
      const movingObjectSubtypes: readonly string[] = ASSET_SUBTYPES.movingObject;
      if (category === "movingObject" && movingObjectSubtypes.includes(nextSubtype)) {
        form.setValue(
          "movingObjectClass",
          getDefaultMovingObjectClass(nextSubtype as MovingObjectSubtype),
          { shouldDirty: true, shouldTouch: true, shouldValidate: true },
        );
      }
      const textureSubtypes: readonly string[] = ASSET_SUBTYPES.texture;
      if (category === "texture" && textureSubtypes.includes(nextSubtype)) {
        form.setValue(
          "textureMaterialType",
          getDefaultTextureMaterialType(nextSubtype as TextureSubtype),
          { shouldDirty: true, shouldTouch: true, shouldValidate: true },
        );
      }
      const natureSubtypes: readonly string[] = ASSET_SUBTYPES.nature;
      if (category === "nature" && natureSubtypes.includes(nextSubtype)) {
        form.setValue("naturePlantType", getDefaultNaturePlantType(nextSubtype as NatureSubtype), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      const staticObjectSubtypes: readonly string[] = ASSET_SUBTYPES.staticObject;
      if (category === "staticObject" && staticObjectSubtypes.includes(nextSubtype)) {
        form.setValue(
          "staticObjectClass",
          getDefaultStaticObjectClass(nextSubtype as StaticObjectSubtype),
          { shouldDirty: true, shouldTouch: true, shouldValidate: true },
        );
      }
      const buildingSubtypes: readonly string[] = ASSET_SUBTYPES.building;
      if (category === "building" && buildingSubtypes.includes(nextSubtype)) {
        form.setValue("buildingType", getDefaultBuildingType(nextSubtype as BuildingSubtype), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      const tilesetSubtypes: readonly string[] = ASSET_SUBTYPES.tileset;
      if (category === "tileset" && tilesetSubtypes.includes(nextSubtype)) {
        form.setValue("tilesetType", getDefaultTilesetType(nextSubtype as TilesetSubtype), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      const itemSubtypes: readonly string[] = ASSET_SUBTYPES.item;
      if (category === "item" && itemSubtypes.includes(nextSubtype)) {
        form.setValue("itemClass", getDefaultItemClass(nextSubtype as ItemSubtype), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    }
    setPendingSubtype(null);
    if (selectionSnapshot) {
      notifyProgrammaticChange({
        allowIncompleteStep: true,
        persistImmediately: true,
        selectionSnapshot,
      });
    }
  };

  const selectSubtype = (nextSubtype: AssetSubtype | ""): void => {
    if (nextSubtype === (subtype ?? "")) return;
    setPendingCategory(null);
    const discardsExistingDetails =
      "category" in draft &&
      draft.category === category &&
      (draft.sourceAssetProfileId !== undefined ||
        draft.categoryProfileId !== undefined ||
        Object.keys(draft.answers).length > 0 ||
        draft.validation.errors.length > 0 ||
        draft.validation.warnings.length > 0);
    if (discardsExistingDetails) {
      setPendingSubtype(nextSubtype);
      return;
    }
    applySubtype(nextSubtype);
  };

  const subtypeOptions = category ? ASSET_SUBTYPES[category] : [];

  return (
    <div className={styles.categoryStep}>
      <fieldset
        className={styles.categoryFieldset}
        aria-describedby={categoryError ? "wizard-category-error" : undefined}
      >
        <legend>
          Welche Art von Bild oder Asset möchtest du erstellen?{" "}
          <span className={styles.required}>Pflichtfeld</span>
        </legend>
        <div className={styles.categoryChoiceGrid}>
          {DASHBOARD_CATEGORIES.map((definition) => (
            <label
              key={definition.id}
              className={styles.categoryChoice}
              data-selected={category === definition.id ? "true" : "false"}
            >
              <input
                type="radio"
                name={categoryController.field.name}
                value={definition.id}
                checked={category === definition.id}
                ref={(node) => {
                  if (definition.id !== DASHBOARD_CATEGORIES[0]?.id) return;
                  firstCategoryRef.current = node;
                  categoryController.field.ref(node);
                }}
                onBlur={categoryController.field.onBlur}
                onChange={() => requestCategory(definition.id)}
              />
              <CategoryIcon category={definition.id} aria-hidden="true" />
              <span>
                <strong>{definition.label}</strong>
                <small>{definition.examples}</small>
              </span>
            </label>
          ))}
        </div>
        {categoryError ? (
          <p id="wizard-category-error" className={styles.fieldError}>
            {categoryError}
          </p>
        ) : null}
      </fieldset>

      {pendingCategory ? (
        <section className={styles.changeWarning} role="alert">
          <div>
            <strong>Kategorie wirklich wechseln?</strong>
            <p>
              Untertyp, Spezialantworten und die Verknüpfung zum bisherigen Assetprofil werden
              verworfen. Allgemeine Basiswerte bleiben erhalten.
            </p>
          </div>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setPendingCategory(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => applyCategory(pendingCategory, true)}
            >
              Zu {getDashboardCategory(pendingCategory).label} wechseln
            </button>
          </div>
        </section>
      ) : null}

      {category ? (
        <div className={styles.fieldGroup}>
          <label htmlFor="wizard-asset-subtype">
            Untertyp <span className={styles.required}>Pflichtfeld</span>
          </label>
          <select
            id="wizard-asset-subtype"
            name={subtypeController.field.name}
            value={subtype ?? ""}
            ref={(node) => {
              subtypeRef.current = node;
              subtypeController.field.ref(node);
            }}
            onBlur={subtypeController.field.onBlur}
            aria-describedby={
              subtypeError ? "wizard-subtype-help wizard-subtype-error" : "wizard-subtype-help"
            }
            aria-invalid={subtypeError ? "true" : "false"}
            onChange={(event) => selectSubtype(event.currentTarget.value as AssetSubtype | "")}
          >
            <option value="">Untertyp auswählen …</option>
            {subtypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatSubtypeLabel(option)}
              </option>
            ))}
          </select>
          <p id="wizard-subtype-help" className={styles.fieldHelp}>
            Erst der Untertyp aktiviert die passenden Fragen und Produktionsregeln.
          </p>
          {subtypeError ? (
            <p id="wizard-subtype-error" className={styles.fieldError}>
              {subtypeError}
            </p>
          ) : null}
          {naturePlantTypeMismatch ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  form.setValue("naturePlantType", expectedNaturePlantType, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  void form.trigger("subtype");
                  notifyProgrammaticChange();
                  subtypeRef.current?.focus();
                }}
              >
                Pflanzentyp aus Untertyp wiederherstellen
              </button>
            </div>
          ) : null}
          {staticObjectClassMismatch ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  form.setValue("staticObjectClass", expectedStaticObjectClass, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  void form.trigger("subtype");
                  notifyProgrammaticChange();
                  subtypeRef.current?.focus();
                }}
              >
                Objektklasse aus Untertyp wiederherstellen
              </button>
            </div>
          ) : null}
          {buildingTypeMismatch ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  form.setValue("buildingType", expectedBuildingType, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  void form.trigger("subtype");
                  notifyProgrammaticChange();
                  subtypeRef.current?.focus();
                }}
              >
                Gebäudetyp aus Untertyp wiederherstellen
              </button>
            </div>
          ) : null}
          {tilesetTypeMismatch ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  form.setValue("tilesetType", expectedTilesetType, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  void form.trigger("subtype");
                  notifyProgrammaticChange();
                  subtypeRef.current?.focus();
                }}
              >
                Tiletyp aus Untertyp wiederherstellen
              </button>
            </div>
          ) : null}
          {itemClassMismatch ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  form.setValue("itemClass", expectedItemClass, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  void form.trigger("subtype");
                  notifyProgrammaticChange();
                  subtypeRef.current?.focus();
                }}
              >
                Itemklasse aus Untertyp wiederherstellen
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {pendingSubtype !== null ? (
        <section className={styles.changeWarning} role="alert">
          <div>
            <strong>Untertyp wirklich wechseln?</strong>
            <p>
              Spezialantworten und die Verknüpfung zum bisherigen Assetprofil werden verworfen.
              Allgemeine Basiswerte bleiben erhalten.
            </p>
          </div>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setPendingSubtype(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => applySubtype(pendingSubtype, true)}
            >
              {pendingSubtype === ""
                ? "Untertyp leeren"
                : `Zu ${formatSubtypeLabel(pendingSubtype)} wechseln`}
            </button>
          </div>
        </section>
      ) : null}

      {capabilities ? (
        <section
          className={styles.capabilityPreview}
          aria-labelledby="wizard-capability-preview-title"
        >
          <div>
            <p className={styles.eyebrow}>Automatisch aufgelöst</p>
            <h3 id="wizard-capability-preview-title">Aktive Asset-Logik</h3>
          </div>
          <ul>
            {Object.entries(capabilities)
              .filter(([, enabled]) => enabled)
              .map(([capability]) => (
                <li key={capability}>
                  {CAPABILITY_LABELS[capability as keyof typeof CAPABILITY_LABELS]}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DirectionsStep({ form }: CoreStepProps) {
  const directionController = useController({
    control: form.control,
    name: "directionCount",
  });
  const directionCount = directionController.field.value;

  return (
    <div className={styles.capabilityQuestions}>
      <fieldset className={styles.optionFieldset}>
        <legend>Wie viele Richtungsansichten werden benötigt?</legend>
        <div className={styles.segmentedOptions}>
          <label data-selected={directionCount === undefined ? "true" : "false"}>
            <input
              type="radio"
              name={directionController.field.name}
              value=""
              aria-label="Keine Richtungen"
              checked={directionCount === undefined}
              ref={directionController.field.ref}
              onBlur={directionController.field.onBlur}
              onChange={() => directionController.field.onChange(undefined)}
            />
            <strong>Keine Richtungen</strong>
            <span>Einzelansicht</span>
          </label>
          {([4, 8] as const).map((count) => (
            <label key={count} data-selected={directionCount === count ? "true" : "false"}>
              <input
                type="radio"
                name={directionController.field.name}
                value={count}
                aria-label={`${count} Richtungen`}
                checked={directionCount === count}
                onBlur={directionController.field.onBlur}
                onChange={() => directionController.field.onChange(count)}
              />
              <strong>{count} Richtungen</strong>
              <span>{count === 8 ? "Produktionsstandard" : "kompaktes Set"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.logicNote}>
        Die Kamera bleibt fest. Nur das Motiv wird logisch neu ausgerichtet; asymmetrische Details
        werden nicht blind gespiegelt.
        {directionCount === 8 ? " Die feste Reihenfolge lautet S, SW, W, NW, N, NE, E, SE." : ""}
      </p>
    </div>
  );
}

function CharacterDetailsStep({
  context,
  draft,
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: CharacterDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const baseProfileId = useWatch({
    control: form.control,
    name: "baseProfileId",
  });
  const characterHeight = useWatch({
    control: form.control,
    name: "characterHeight",
  });
  const selection = resolveWizardCapabilities({ category, subtype });
  const baseProfile = context.library?.baseProfiles.find((profile) => profile.id === baseProfileId);

  if (
    category !== "character" ||
    subtype === undefined ||
    !selection?.scaledCharacter ||
    baseProfile === undefined ||
    characterHeight === undefined
  ) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Figurenprofil nicht verfügbar</strong>
        <p>
          Kehre zum Basisprofil zurück und wähle eine gültige Produktionsfamilie mit Figurenmaßstab.
        </p>
      </section>
    );
  }

  const resolution = context.library ? resolveWizardDraftSnapshot(draft, context.library) : null;
  const resolvedHeightSource =
    resolution?.status === "resolved" ? resolution.profile.valueSources.characterHeight : undefined;
  const categoryProfile =
    "categoryProfileId" in draft && draft.categoryProfileId !== undefined
      ? context.library?.categoryProfiles.find((profile) => profile.id === draft.categoryProfileId)
      : undefined;
  const heightSource: CharacterHeightSource =
    resolvedHeightSource === "category"
      ? "Kategorieprofil"
      : resolvedHeightSource === "asset"
        ? "Lokaler Entwurf"
        : "Basisprofil";
  const heightSourceName =
    resolvedHeightSource === "category"
      ? (categoryProfile?.name ?? "Unbekanntes Kategorieprofil")
      : resolvedHeightSource === "asset"
        ? draft.projectName || "Aktueller Entwurf"
        : baseProfile.name;

  return (
    <CharacterDetailsEditor
      characterHeight={characterHeight}
      form={form}
      heightLocked={baseProfile.locks.characterHeight === true}
      heightSource={heightSource}
      heightSourceName={heightSourceName}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as CharacterSubtype}
    />
  );
}

function MovingObjectDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: MovingObjectDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownMovingObjectSubtypes: readonly string[] = ASSET_SUBTYPES.movingObject;

  if (
    category !== "movingObject" ||
    subtype === undefined ||
    !knownMovingObjectSubtypes.includes(subtype)
  ) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Bewegungsobjekt nicht verfügbar</strong>
        <p>
          Kehre zur Bildart zurück und wähle einen gültigen Untertyp für ein bewegliches Objekt.
        </p>
      </section>
    );
  }

  return (
    <MovingObjectDetailsEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as MovingObjectSubtype}
    />
  );
}

function TextureDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: TextureDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownTextureSubtypes: readonly string[] = ASSET_SUBTYPES.texture;

  if (category !== "texture" || subtype === undefined || !knownTextureSubtypes.includes(subtype)) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Texturprofil nicht verfügbar</strong>
        <p>Kehre zur Bildart zurück und wähle einen gültigen Material-Untertyp.</p>
      </section>
    );
  }

  return (
    <TextureMaterialEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as TextureSubtype}
    />
  );
}

function NatureDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: NatureDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownNatureSubtypes: readonly string[] = ASSET_SUBTYPES.nature;

  if (category !== "nature" || subtype === undefined || !knownNatureSubtypes.includes(subtype)) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Naturprofil nicht verfügbar</strong>
        <p>Kehre zur Bildart zurück und wähle einen gültigen Pflanzen- oder Natur-Untertyp.</p>
      </section>
    );
  }

  return (
    <NatureTreeEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as NatureSubtype}
    />
  );
}

function StaticObjectDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: StaticObjectDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownStaticObjectSubtypes: readonly string[] = ASSET_SUBTYPES.staticObject;

  if (
    category !== "staticObject" ||
    subtype === undefined ||
    !knownStaticObjectSubtypes.includes(subtype)
  ) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Statisches Objektprofil nicht verfügbar</strong>
        <p>
          Kehre zur Bildart zurück und wähle einen gültigen Untertyp für ein statisches Weltobjekt.
        </p>
      </section>
    );
  }

  return (
    <StaticWorldObjectEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as StaticObjectSubtype}
    />
  );
}

function BuildingDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: BuildingDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownBuildingSubtypes: readonly string[] = ASSET_SUBTYPES.building;

  if (
    category !== "building" ||
    subtype === undefined ||
    !knownBuildingSubtypes.includes(subtype)
  ) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Gebäudeprofil nicht verfügbar</strong>
        <p>Kehre zur Bildart zurück und wähle einen gültigen Gebäude- oder Architektur-Untertyp.</p>
      </section>
    );
  }

  return (
    <BuildingArchitectureEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as BuildingSubtype}
    />
  );
}

function TilesetDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: TilesetDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownTilesetSubtypes: readonly string[] = ASSET_SUBTYPES.tileset;

  if (category !== "tileset" || subtype === undefined || !knownTilesetSubtypes.includes(subtype)) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Tileset-Profil nicht verfügbar</strong>
        <p>
          Kehre zur Bildart zurück und wähle einen gültigen Tileset- oder Kartenelement-Untertyp.
        </p>
      </section>
    );
  }

  return (
    <TilesetEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as TilesetSubtype}
    />
  );
}

function ItemDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: ItemDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownItemSubtypes: readonly string[] = ASSET_SUBTYPES.item;

  if (category !== "item" || subtype === undefined || !knownItemSubtypes.includes(subtype)) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Itemprofil nicht verfügbar</strong>
        <p>Kehre zur Bildart zurück und wähle einen gültigen Item- oder Ausrüstungs-Untertyp.</p>
      </section>
    );
  }

  return (
    <ItemEquipmentEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as ItemSubtype}
    />
  );
}

function ArtworkDetailsStep({
  form,
  notifyProgrammaticChange,
  section,
}: CoreStepProps & Readonly<{ section?: ArtworkDetailsSection }>) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const knownArtworkSubtypes: readonly string[] = ASSET_SUBTYPES.artwork;

  if (category !== "artwork" || subtype === undefined || !knownArtworkSubtypes.includes(subtype)) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Artwork-Profil nicht verfügbar</strong>
        <p>Kehre zur Bildart zurück und wähle einen gültigen Konzept- oder Artwork-Untertyp.</p>
      </section>
    );
  }

  return (
    <ArtworkConceptEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      {...(section ? { section } : {})}
      subtype={subtype as ArtworkSubtype}
    />
  );
}

function AnimationSelect({
  form,
  options,
}: Readonly<{
  form: CoreStepProps["form"];
  options: readonly (readonly [string, string])[];
}>) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="wizard-animation-type">Animationsart</label>
      <select
        id="wizard-animation-type"
        {...form.register("animationType", { setValueAs: optionalSelectValue })}
      >
        <option value="">Noch keine Animation festlegen</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AnimationStep({ form, notifyProgrammaticChange }: CoreStepProps) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const values = form.getValues();
  const capabilities = resolveWizardCapabilities(values);

  if (!category || !capabilities?.animated) return null;

  return (
    <div className={styles.capabilityQuestions}>
      <div className={styles.logicNote} role="note">
        <strong>
          {capabilities.movable
            ? "Dieses Asset kann sich bewegen."
            : "Dieses Asset bleibt am Ort und kann trotzdem animiert sein."}
        </strong>
        <span>
          {capabilities.directional
            ? "Animation und Richtungsset werden getrennt gespeichert."
            : "Dafür wird bewusst kein Richtungsset eingeblendet."}
        </span>
      </div>

      {category === "character" ? (
        <CharacterAnimationEditor form={form} notifyProgrammaticChange={notifyProgrammaticChange} />
      ) : null}

      {category === "movingObject" &&
      subtype !== undefined &&
      (ASSET_SUBTYPES.movingObject as readonly string[]).includes(subtype) ? (
        <MovingObjectAnimationEditor
          form={form}
          notifyProgrammaticChange={notifyProgrammaticChange}
          subtype={subtype as MovingObjectSubtype}
        />
      ) : null}

      {category === "staticObject" ? (
        <AnimationSelect form={form} options={ANIMATION_TYPE_OPTIONS.staticObject} />
      ) : null}
      {category === "nature" ? (
        <AnimationSelect form={form} options={ANIMATION_TYPE_OPTIONS.nature} />
      ) : null}
      {category === "tileset" ? (
        <AnimationSelect form={form} options={ANIMATION_TYPE_OPTIONS.tileset} />
      ) : null}
      {category === "building" ? (
        <AnimationSelect form={form} options={ANIMATION_TYPE_OPTIONS.building} />
      ) : null}
    </div>
  );
}

function CatalogHeader(props: CoreStepProps) {
  const baseProfileId = useWatch({ control: props.form.control, name: "baseProfileId" });
  const baseProfile = props.context.library?.baseProfiles.find(
    (candidate) => candidate.id === baseProfileId,
  );

  return (
    <section className={styles.catalogHeader} aria-label="Asset und Basiskontext">
      <ProjectStep {...props} />
      <div className={styles.baseContext}>
        <div>
          <p className={styles.eyebrow}>Schreibgeschützter Basiskontext</p>
          <strong>{baseProfile?.name ?? "Noch kein Basisprofil eingerichtet"}</strong>
        </div>
        {baseProfile ? (
          <dl>
            <div>
              <dt>Stil</dt>
              <dd>{baseProfile.values.styleProfile}</dd>
            </div>
            <div>
              <dt>Tile</dt>
              <dd>{baseProfile.values.tileSize} px</dd>
            </div>
            <div>
              <dt>Perspektive</dt>
              <dd>{baseProfile.values.perspectiveType}</dd>
            </div>
          </dl>
        ) : (
          <p>
            Die Katalogfragen bleiben erhalten. Vor dem Weitergehen ist eine Produktionsbasis
            erforderlich.
          </p>
        )}
        {props.context.onOpenBaseProfile ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={props.context.onOpenBaseProfile}
          >
            Basisprofil {baseProfile ? "anzeigen" : "einrichten"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CatalogIdentityStep(props: CoreStepProps) {
  return <CategoryStep {...props} />;
}

function CatalogPageStep(props: CoreStepProps) {
  const candidate = catalogPageForStep(props.stepId ?? "");
  if (!candidate) {
    return (
      <section className={styles.changeWarning} role="alert">
        <strong>Katalogseite nicht verfügbar</strong>
        <p>Der gespeicherte Schritt wird beim nächsten Start auf eine gültige Seite migriert.</p>
      </section>
    );
  }

  const section = candidate.sectionId.split("/")[1];
  switch (candidate.category) {
    case "character":
      return <CharacterDetailsStep {...props} section={section as CharacterDetailsSection} />;
    case "movingObject":
      return <MovingObjectDetailsStep {...props} section={section as MovingObjectDetailsSection} />;
    case "texture":
      return <TextureDetailsStep {...props} section={section as TextureDetailsSection} />;
    case "nature":
      return <NatureDetailsStep {...props} section={section as NatureDetailsSection} />;
    case "staticObject":
      return <StaticObjectDetailsStep {...props} section={section as StaticObjectDetailsSection} />;
    case "building":
      return <BuildingDetailsStep {...props} section={section as BuildingDetailsSection} />;
    case "tileset":
      return <TilesetDetailsStep {...props} section={section as TilesetDetailsSection} />;
    case "item":
      return <ItemDetailsStep {...props} section={section as ItemDetailsSection} />;
    case "artwork":
      return <ArtworkDetailsStep {...props} section={section as ArtworkDetailsSection} />;
    case "capability":
      return candidate.sectionId === "capabilities/directions" ? (
        <DirectionsStep {...props} />
      ) : (
        <AnimationStep {...props} />
      );
  }
}

function CatalogReviewStep({ context, form }: CoreStepProps) {
  const category = useWatch({ control: form.control, name: "category" });
  const subtype = useWatch({ control: form.control, name: "subtype" });
  const baseProfileId = useWatch({ control: form.control, name: "baseProfileId" });
  const baseProfile = context.library?.baseProfiles.find(
    (candidate) => candidate.id === baseProfileId,
  );

  return (
    <section className={styles.reviewCard} aria-labelledby="wizard-review-title">
      <p className={styles.eyebrow}>Abschlusskontrolle</p>
      <h3 id="wizard-review-title">Antwortkatalog vollständig geprüft</h3>
      <p>
        Prüfe die Zusammenfassung rechts. „Entwurf sichern“ bestätigt nur den Katalog; eine Ausgabe
        wird in diesem Schritt noch nicht erzeugt.
      </p>
      <dl>
        <div>
          <dt>Assetart</dt>
          <dd>{category ? getDashboardCategory(category).label : "Nicht gewählt"}</dd>
        </div>
        <div>
          <dt>Untertyp</dt>
          <dd>{subtype ? formatSubtypeLabel(subtype) : "Nicht gewählt"}</dd>
        </div>
        <div>
          <dt>Basis</dt>
          <dd>{baseProfile?.name ?? "Nicht eingerichtet"}</dd>
        </div>
      </dl>
    </section>
  );
}

function CoreSummary({
  context,
  draft,
  values,
}: GuidedWizardSummaryComponentProps<WizardCoreFormValues, WizardCoreFlowContext>) {
  return (
    <WizardTechnicalSummary
      categoryHint={context.categoryHint}
      draft={draft}
      library={context.library}
      projectName={values.projectName}
      activeCategory={values.category ?? null}
      activeSubtype={values.subtype ?? null}
      selection={getSelectionSummary(values)}
      formValues={values}
    />
  );
}

function getSelectionSummary(values: WizardCoreFormValues) {
  const capabilities = resolveWizardCapabilities(values);
  if (!values.category || !values.subtype || !capabilities) return null;
  return {
    category: values.category,
    subtype: values.subtype,
    capabilities,
  } as const;
}

function ProductiveBaseProfileStep(props: CoreStepProps) {
  return props.context.onOpenBaseProfile ? (
    <VaultBaseProfileStep {...props} />
  ) : (
    <BaseProfileStep {...props} />
  );
}

const STEP_COMPONENTS = {
  project: ProjectStep,
  category: CategoryStep,
  baseProfile: ProductiveBaseProfileStep,
  characterDetails: CharacterDetailsStep,
  movingObjectDetails: MovingObjectDetailsStep,
  textureDetails: TextureDetailsStep,
  natureDetails: NatureDetailsStep,
  staticObjectDetails: StaticObjectDetailsStep,
  buildingDetails: BuildingDetailsStep,
  tilesetDetails: TilesetDetailsStep,
  itemDetails: ItemDetailsStep,
  artworkDetails: ArtworkDetailsStep,
  directions: DirectionsStep,
  animation: AnimationStep,
} as const;

export const WIZARD_CORE_FLOW = Object.freeze({
  steps: Object.freeze([
    Object.freeze({
      ...getWizardCoreStep("project"),
      Component: STEP_COMPONENTS.project,
    }),
    Object.freeze({
      ...getWizardCoreStep("category"),
      Component: STEP_COMPONENTS.category,
    }),
    Object.freeze({
      ...getWizardCoreStep("baseProfile"),
      Component: STEP_COMPONENTS.baseProfile,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("baseProfile", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("characterDetails"),
      Component: STEP_COMPONENTS.characterDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("characterDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("movingObjectDetails"),
      Component: STEP_COMPONENTS.movingObjectDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("movingObjectDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("textureDetails"),
      Component: STEP_COMPONENTS.textureDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("textureDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("natureDetails"),
      Component: STEP_COMPONENTS.natureDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("natureDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("staticObjectDetails"),
      Component: STEP_COMPONENTS.staticObjectDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("staticObjectDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("buildingDetails"),
      Component: STEP_COMPONENTS.buildingDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("buildingDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("tilesetDetails"),
      Component: STEP_COMPONENTS.tilesetDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("tilesetDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("itemDetails"),
      Component: STEP_COMPONENTS.itemDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("itemDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("artworkDetails"),
      Component: STEP_COMPONENTS.artworkDetails,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("artworkDetails", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("directions"),
      Component: STEP_COMPONENTS.directions,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("directions", values, context.library),
    }),
    Object.freeze({
      ...getWizardCoreStep("animation"),
      Component: STEP_COMPONENTS.animation,
      isApplicable: (values: WizardCoreFormValues, context: WizardCoreFlowContext) =>
        wizardStepIsApplicable("animation", values, context.library),
    }),
  ]),
  updateDraft: updateWizardDraftFromCoreForm,
  Summary: CoreSummary,
} satisfies GuidedWizardFlowDefinition<
  WizardCoreFormValues,
  WizardCoreStepId,
  WizardCoreFlowContext
>);

const WIZARD_CATALOG_PAGE_STEPS = WIZARD_CATALOG_PAGES.map((candidate) =>
  Object.freeze({
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    fieldPaths: Object.freeze([
      "projectName",
      "baseProfileId",
      ...candidate.fieldPaths,
    ] as WizardCoreFieldPath[]),
    schema: schemaForCatalogPage(candidate),
    isApplicable: (values: WizardCoreFormValues) => isCatalogPageApplicable(candidate, values),
    Component: CatalogPageStep,
  }),
);

export const WIZARD_CATALOG_FLOW = Object.freeze({
  steps: Object.freeze([
    Object.freeze({
      id: "identity" as const,
      title: "Asset und Bildart",
      description: "Benenne das Asset und wähle Hauptkategorie sowie Untertyp.",
      fieldPaths: Object.freeze(["projectName", "category", "subtype"] as WizardCoreFieldPath[]),
      schema: WizardCatalogIdentitySchema,
      Component: CatalogIdentityStep,
    }),
    ...WIZARD_CATALOG_PAGE_STEPS,
    Object.freeze({
      id: "review" as const,
      title: "Prüfung",
      description: "Kontrolliere den vollständigen Katalog vor dem Abschluss.",
      fieldPaths: Object.freeze(Object.keys(WizardCoreFormSchema.shape) as WizardCoreFieldPath[]),
      schema: WizardCatalogReviewSchema,
      isApplicable: (values: WizardCoreFormValues) =>
        values.category !== undefined && values.subtype !== undefined,
      Component: CatalogReviewStep,
    }),
  ] as const),
  persistIncompleteChanges: true,
  updateDraft: updateWizardDraftFromCatalogForm,
  Header: CatalogHeader,
  Summary: CoreSummary,
} satisfies GuidedWizardFlowDefinition<
  WizardCoreFormValues,
  WizardCatalogStepId,
  WizardCoreFlowContext
>);
