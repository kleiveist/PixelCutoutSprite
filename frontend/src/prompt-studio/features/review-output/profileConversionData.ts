import {
  resolveCapabilities,
  type AssetCapabilities,
  type AssetSelection,
} from "../../domain/assets";
import {
  createCompatibilityKey,
  createDefaultBaseProfileLocks,
  createDefaultBaseProfileValues,
  createDuplicateProfileName,
  profileValuesEqual,
  resolveProfile,
  type BaseProfileDefinition,
  type ProfileResolutionConflict,
  type ProfileValue,
  type ProfileValueKey,
  type ResolvedProfile,
} from "../../domain/profiles";
import {
  BaseProfileOverridesSchema,
  BaseProfileValuesSchema,
  parseAssetProfile,
  parseBaseProfile,
  parseWizardDraft,
  type BaseProfile,
  type BaseProfileLocks,
  type BaseProfileOverrides,
  type BaseProfileValues,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;
type MutableProfileValues = {
  -readonly [Key in keyof BaseProfileValues]: BaseProfileValues[Key];
};
type MutableProfileOverrides = {
  -readonly [Key in keyof BaseProfileOverrides]: BaseProfileOverrides[Key];
};

const PROFILE_VALUE_KEYS = Object.freeze([
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

const WORLD_GEOMETRY_KEYS = new Set<ProfileValueKey>([
  "tileSize",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
]);

export const PROFILE_CONVERSION_FIELD_LABELS = Object.freeze({
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
} as const satisfies Record<ProfileValueKey, string>);

export interface ProfileConversionChange {
  readonly field: ProfileValueKey;
  readonly label: string;
  readonly previousValue: ProfileValue;
  readonly desiredValue: ProfileValue;
}

export type ProfileConversionPreparation =
  | Readonly<{
      status: "unavailable";
      reason:
        | "incompleteDraft"
        | "missingBaseProfile"
        | "missingPartialProfile"
        | "unsupportedConflict"
        | "invalidDesiredValues";
    }>
  | Readonly<{
      status: "ready";
      draft: SelectedWizardDraft;
      sourceBase: BaseProfile;
      partialProfile: ResolvedProfile;
      desiredValues: BaseProfileValues;
      changes: readonly ProfileConversionChange[];
      currentCompatibilityKey: string;
      desiredCompatibilityKey: string;
      compatibilityChanged: boolean;
      relevantKeys: readonly ProfileValueKey[];
      detachesCategoryProfile: boolean;
      detachesSourceAssetProfile: boolean;
    }>;

export type ReadyProfileConversion = Extract<ProfileConversionPreparation, { status: "ready" }>;

export type ProfileConversionPlan =
  | Readonly<{
      status: "incompatible";
      targetBase: BaseProfile;
      lockedFields: readonly ProfileValueKey[];
    }>
  | Readonly<{
      status: "ready";
      targetBase: BaseProfile;
      draft: SelectedWizardDraft;
      compatibilityKey: string;
      compatibilityChanged: boolean;
      overrideFields: readonly ProfileValueKey[];
      exactTechnicalMatch: boolean;
    }>;

function selectedDraftSelection(draft: SelectedWizardDraft): AssetSelection {
  switch (draft.category) {
    case "character":
      return { category: "character", subtype: draft.subtype };
    case "movingObject":
      return { category: "movingObject", subtype: draft.subtype };
    case "staticObject":
      return { category: "staticObject", subtype: draft.subtype };
    case "texture":
      return { category: "texture", subtype: draft.subtype };
    case "nature":
      return { category: "nature", subtype: draft.subtype };
    case "building":
      return { category: "building", subtype: draft.subtype };
    case "tileset":
      return { category: "tileset", subtype: draft.subtype };
    case "item":
      return { category: "item", subtype: draft.subtype };
    case "artwork":
      return { category: "artwork", subtype: draft.subtype };
  }
}

function profileKeyIsRelevant(key: ProfileValueKey, capabilities: AssetCapabilities): boolean {
  if (key === "characterHeight") return capabilities.scaledCharacter;
  if (capabilities.freeComposition && WORLD_GEOMETRY_KEYS.has(key)) {
    return false;
  }
  return true;
}

function setProfileValue<Key extends ProfileValueKey>(
  values: MutableProfileValues,
  key: Key,
  value: BaseProfileValues[Key],
): void {
  values[key] = value;
}

function setProfileOverride<Key extends ProfileValueKey>(
  overrides: MutableProfileOverrides,
  key: Key,
  value: Exclude<BaseProfileOverrides[Key], undefined>,
): void {
  overrides[key] = value;
}

function cloneProfileValues(values: BaseProfileValues): MutableProfileValues {
  return {
    ...values,
    lightingDefaults: { ...values.lightingDefaults },
  };
}

function applyProfileValue(
  values: BaseProfileValues,
  field: ProfileValueKey,
  value: ProfileValue,
): BaseProfileValues | null {
  const parsed = BaseProfileValuesSchema.safeParse({
    ...values,
    lightingDefaults: { ...values.lightingDefaults },
    [field]: value,
  });
  return parsed.success ? parsed.data : null;
}

function uniqueConflictFields(
  conflicts: readonly Extract<ProfileResolutionConflict, { code: "lockedOverride" }>[],
): readonly ProfileValueKey[] {
  return Object.freeze([...new Set(conflicts.map((conflict) => conflict.field))]);
}

/**
 * Reconstructs an intended technical snapshot only from resolver-proven
 * locked overrides. Reference and classification failures stay fail-closed.
 */
export function prepareProfileConversion(
  input: Readonly<{
    draft: WizardDraft;
    library: ProfileLibrary;
    partialProfile?: ResolvedProfile;
    conflicts: readonly ProfileResolutionConflict[];
  }>,
): ProfileConversionPreparation {
  const draft = input.draft;
  if (!("category" in draft) || draft.baseProfileId === undefined) {
    return Object.freeze({ status: "unavailable", reason: "incompleteDraft" });
  }
  const sourceBase = input.library.baseProfiles.find(
    (profile) => profile.id === draft.baseProfileId,
  );
  if (sourceBase === undefined) {
    return Object.freeze({
      status: "unavailable",
      reason: "missingBaseProfile",
    });
  }
  if (input.partialProfile === undefined) {
    return Object.freeze({
      status: "unavailable",
      reason: "missingPartialProfile",
    });
  }
  const lockedConflicts = input.conflicts.filter(
    (conflict): conflict is Extract<ProfileResolutionConflict, { code: "lockedOverride" }> =>
      conflict.code === "lockedOverride",
  );
  if (lockedConflicts.length === 0 || lockedConflicts.length !== input.conflicts.length) {
    return Object.freeze({
      status: "unavailable",
      reason: "unsupportedConflict",
    });
  }

  let desiredValues = input.partialProfile.values;
  for (const conflict of lockedConflicts) {
    const nextValues = applyProfileValue(desiredValues, conflict.field, conflict.attemptedValue);
    if (nextValues === null) {
      return Object.freeze({
        status: "unavailable",
        reason: "invalidDesiredValues",
      });
    }
    desiredValues = nextValues;
  }

  const selection = selectedDraftSelection(draft);
  const capabilities = resolveCapabilities(selection.category, selection.subtype);
  const relevantKeys = Object.freeze(
    PROFILE_VALUE_KEYS.filter((key) => profileKeyIsRelevant(key, capabilities)),
  );
  let desiredCompatibilityKey: string;
  try {
    desiredCompatibilityKey = createCompatibilityKey(desiredValues, selection);
  } catch {
    return Object.freeze({
      status: "unavailable",
      reason: "invalidDesiredValues",
    });
  }

  const changes = uniqueConflictFields(lockedConflicts).flatMap(
    (field): readonly ProfileConversionChange[] => {
      const previousValue = input.partialProfile?.values[field];
      const desiredValue = desiredValues[field];
      if (
        previousValue === undefined ||
        desiredValue === undefined ||
        profileValuesEqual(previousValue, desiredValue)
      ) {
        return [];
      }
      return [
        Object.freeze({
          field,
          label: PROFILE_CONVERSION_FIELD_LABELS[field],
          previousValue,
          desiredValue,
        }),
      ];
    },
  );

  return Object.freeze({
    status: "ready",
    draft,
    sourceBase,
    partialProfile: input.partialProfile,
    desiredValues,
    changes: Object.freeze(changes),
    currentCompatibilityKey: input.partialProfile.compatibilityKey,
    desiredCompatibilityKey,
    compatibilityChanged: input.partialProfile.compatibilityKey !== desiredCompatibilityKey,
    relevantKeys,
    detachesCategoryProfile: draft.categoryProfileId !== undefined,
    detachesSourceAssetProfile: draft.sourceAssetProfileId !== undefined,
  });
}

function conversionOverrides(
  preparation: ReadyProfileConversion,
  targetBase: BaseProfile,
): Readonly<{
  overrides: BaseProfileOverrides;
  lockedFields: readonly ProfileValueKey[];
}> {
  const overrides: MutableProfileOverrides = {};
  const lockedFields: ProfileValueKey[] = [];

  for (const key of preparation.relevantKeys) {
    const desiredValue = preparation.desiredValues[key];
    const targetValue = targetBase.values[key];
    if (
      desiredValue === undefined ||
      (targetValue !== undefined && profileValuesEqual(targetValue, desiredValue))
    ) {
      continue;
    }
    if (targetBase.locks[key] === true) {
      lockedFields.push(key);
      continue;
    }
    setProfileOverride(overrides, key, desiredValue);
  }

  return Object.freeze({
    overrides: BaseProfileOverridesSchema.parse(overrides),
    lockedFields: Object.freeze(lockedFields),
  });
}

function convertedDraft(
  preparation: ReadyProfileConversion,
  targetBase: BaseProfile,
  overrides: BaseProfileOverrides,
  savedAt: string,
): SelectedWizardDraft {
  const {
    categoryProfileId: ignoredCategoryProfileId,
    sourceAssetProfileId: ignoredSourceAssetProfileId,
    overrides: ignoredOverrides,
    ...detachedDraft
  } = preparation.draft;
  void ignoredCategoryProfileId;
  void ignoredSourceAssetProfileId;
  void ignoredOverrides;

  const parsed = parseWizardDraft({
    ...detachedDraft,
    route: "wizard/profile",
    currentStep: "baseProfile",
    baseProfileId: targetBase.id,
    ...(Object.keys(overrides).length === 0 ? {} : { overrides }),
    answers: preparation.partialProfile.categoryData.answers,
    validation: {
      errors: [],
      warnings: preparation.draft.validation.warnings,
    },
    savedAt,
  });
  if (!("category" in parsed)) {
    throw new Error("A converted profile Draft must retain its classification.");
  }
  return parsed;
}

/**
 * Projects the desired effective snapshot onto one target Base without
 * mutating the source graph, then verifies the detached Draft through the
 * regular profile resolver and Zod boundaries.
 */
export function createProfileConversionPlan(
  preparation: ReadyProfileConversion,
  targetBase: BaseProfile,
  savedAt: string,
): ProfileConversionPlan {
  const candidateOverrides = conversionOverrides(preparation, targetBase);
  if (candidateOverrides.lockedFields.length > 0) {
    return Object.freeze({
      status: "incompatible",
      targetBase,
      lockedFields: candidateOverrides.lockedFields,
    });
  }

  const selection = selectedDraftSelection(preparation.draft);
  const assetProfile = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: preparation.draft.draftId,
    name: preparation.draft.projectName,
    baseProfileId: targetBase.id,
    compatibilityKey: preparation.desiredCompatibilityKey,
    category: selection.category,
    subtype: selection.subtype,
    iconId: "profile-conversion",
    badgeIconIds: [],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: candidateOverrides.overrides,
    answers: preparation.partialProfile.categoryData.answers,
    tags: [],
    favorite: false,
    createdAt: savedAt,
    updatedAt: savedAt,
  });
  const resolution = resolveProfile({ assetProfile, baseProfile: targetBase });
  if (resolution.status === "conflict") {
    return Object.freeze({
      status: "incompatible",
      targetBase,
      lockedFields: Object.freeze(
        resolution.conflicts.flatMap((conflict) =>
          conflict.code === "lockedOverride" ? [conflict.field] : [],
        ),
      ),
    });
  }

  const draft = convertedDraft(
    preparation,
    targetBase,
    resolution.profile.normalizedOverrides.asset,
    savedAt,
  );
  const overrideFields = Object.freeze(
    preparation.relevantKeys.filter(
      (key) => resolution.profile.normalizedOverrides.asset[key] !== undefined,
    ),
  );

  return Object.freeze({
    status: "ready",
    targetBase,
    draft,
    compatibilityKey: resolution.profile.compatibilityKey,
    compatibilityChanged:
      resolution.profile.compatibilityKey !== preparation.currentCompatibilityKey,
    overrideFields,
    exactTechnicalMatch: overrideFields.length === 0,
  });
}

/** Returns write-free candidate plans, ranking exact technical matches first. */
export function compatibleBaseProfilePlans(
  preparation: ReadyProfileConversion,
  baseProfiles: readonly BaseProfile[],
): readonly Extract<ProfileConversionPlan, { status: "ready" }>[] {
  return Object.freeze(
    baseProfiles
      .filter((profile) => profile.id !== preparation.sourceBase.id)
      .map((profile) =>
        createProfileConversionPlan(preparation, profile, preparation.draft.savedAt),
      )
      .filter(
        (plan): plan is Extract<ProfileConversionPlan, { status: "ready" }> =>
          plan.status === "ready",
      )
      .sort((left, right) => {
        if (left.exactTechnicalMatch !== right.exactTechnicalMatch) {
          return left.exactTechnicalMatch ? -1 : 1;
        }
        if (left.overrideFields.length !== right.overrideFields.length) {
          return left.overrideFields.length - right.overrideFields.length;
        }
        return left.targetBase.name.localeCompare(right.targetBase.name, "de");
      }),
  );
}

function valuesForNewFamily(preparation: ReadyProfileConversion): BaseProfileValues {
  const values = cloneProfileValues(createDefaultBaseProfileValues());
  for (const key of preparation.relevantKeys) {
    const desiredValue = preparation.desiredValues[key];
    if (desiredValue !== undefined) {
      setProfileValue(values, key, desiredValue);
    }
  }
  return BaseProfileValuesSchema.parse(values);
}

function valuesForDuplicateFamily(preparation: ReadyProfileConversion): BaseProfileValues {
  const values = cloneProfileValues(preparation.sourceBase.values);
  for (const change of preparation.changes) {
    setProfileValue(values, change.field, change.desiredValue);
  }
  return BaseProfileValuesSchema.parse(values);
}

export function createConversionBaseDefinition(
  preparation: ReadyProfileConversion,
  kind: "duplicate" | "new",
  name: string,
): BaseProfileDefinition {
  return Object.freeze({
    name,
    iconId: kind === "duplicate" ? preparation.sourceBase.iconId : "world-grid",
    values:
      kind === "duplicate"
        ? valuesForDuplicateFamily(preparation)
        : valuesForNewFamily(preparation),
    locks:
      kind === "duplicate"
        ? ({ ...preparation.sourceBase.locks } satisfies BaseProfileLocks)
        : createDefaultBaseProfileLocks(),
  });
}

export function createConversionDefinitionPreview(
  preparation: ReadyProfileConversion,
  definition: BaseProfileDefinition,
): Extract<ProfileConversionPlan, { status: "ready" }> {
  const previewBase = parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_conversion_preview",
    ...definition,
    createdAt: preparation.draft.savedAt,
    updatedAt: preparation.draft.savedAt,
  });
  const plan = createProfileConversionPlan(preparation, previewBase, preparation.draft.savedAt);
  if (plan.status !== "ready") {
    throw new Error("A generated conversion Base definition must be compatible.");
  }
  return plan;
}

export function defaultConversionBaseName(
  preparation: ReadyProfileConversion,
  kind: "duplicate" | "new",
  existingNames: readonly string[],
): string {
  if (kind === "duplicate") {
    return createDuplicateProfileName(preparation.sourceBase.name, existingNames);
  }
  const suffix = " · Produktionsfamilie";
  const projectName = preparation.draft.projectName.trim();
  return `${projectName.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
}

const VALUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  classicHd: "Classic-HD",
  modernHd: "Modern-HD",
  ultraHd: "Ultra-HD",
  classic: "Klassische Fantasy",
  dark: "Düstere Fantasy",
  both: "Beide Stilprofile",
  topdown: "Draufsicht",
  threeQuarter: "Schräge 3/4-Draufsicht",
  isometric: "Isometrisch",
  side: "Seitenansicht",
  southToNorth: "Süd nach Nord",
  swToNe: "Südwest nach Nordost",
  seToNw: "Südost nach Nordwest",
  orthographic: "Orthografisch",
  mildPerspective: "Leichte Perspektive",
  softSelective: "Weich und selektiv",
  minimal: "Minimale Outline",
  natural: "Natürlich",
  vivid: "Lebhaft",
  desaturated: "Entsättigt",
  byProfile: "Nach Stilprofil",
  transparent: "Transparent",
  scene: "Szene",
  adaptive: "Kontextabhängig",
  neutralDay: "Neutrales Tageslicht",
  warmInterior: "Warmes Innenlicht",
  gloomyDiffuse: "Düster und diffus",
  neutralNight: "Neutrales Nachtlicht",
  coolNight: "Kühles Nachtlicht",
  custom: "Eigene Lichtregel",
});

export function formatProfileConversionValue(field: ProfileValueKey, value: ProfileValue): string {
  if (field === "tileSize") return `${String(value)} × ${String(value)} px`;
  if (field === "characterHeight" || field === "alphaPadding") {
    return `${String(value)} px`;
  }
  if (field === "cameraAngle") return `${String(value)}°`;
  if (field === "nearestNeighbor") return value ? "Aktiv" : "Deaktiviert";
  if (field === "outlineStyle" && value === "dark") {
    return "Dunkle Outline";
  }
  if (field === "lightingDefaults" && typeof value === "object") {
    const policy = VALUE_LABELS[value.policy] ?? value.policy;
    return value.notes ? `${policy}: ${value.notes}` : policy;
  }
  return VALUE_LABELS[String(value)] ?? String(value);
}
