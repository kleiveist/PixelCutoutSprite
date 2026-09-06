import { resolveCapabilities, type AssetSelection } from "../assets";
import type {
  AssetProfile,
  AssetCategoryData,
  BaseProfile,
  BaseProfileOverrides,
  BaseProfileValues,
  CategoryProfile,
  CharacterAnswers,
  MovingObjectAnswers,
  StableId,
} from "../../schemas";
import { createCompatibilityKey, normalizeCompatibilityText } from "./compatibilityKey";
import type {
  ProfileOverrideLevel,
  ProfileResolutionConflict,
  ProfileResolutionNotice,
  ProfileResolutionResult,
  ProfileValue,
  ProfileValueKey,
  ProfileValueSource,
  ResolvedProfile,
} from "./profile.types";

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

type MissingProfileValueKey = Exclude<ProfileValueKey, (typeof PROFILE_VALUE_KEYS)[number]>;
const profileValueKeysAreExhaustive: MissingProfileValueKey extends never ? true : never = true;
void profileValueKeysAreExhaustive;

type MutableBaseProfileValues = {
  -readonly [Key in keyof BaseProfileValues]: BaseProfileValues[Key];
};

type MutableBaseProfileOverrides = {
  -readonly [Key in keyof BaseProfileOverrides]: BaseProfileOverrides[Key];
};

export interface ResolveProfileInput {
  readonly baseProfile?: BaseProfile | undefined;
  readonly categoryProfile?: CategoryProfile | undefined;
  readonly assetProfile: AssetProfile;
}

function createAssetSelection(profile: AssetProfile): AssetSelection {
  switch (profile.category) {
    case "character":
      return Object.freeze({ category: "character", subtype: profile.subtype });
    case "movingObject":
      return Object.freeze({ category: "movingObject", subtype: profile.subtype });
    case "staticObject":
      return Object.freeze({ category: "staticObject", subtype: profile.subtype });
    case "texture":
      return Object.freeze({ category: "texture", subtype: profile.subtype });
    case "nature":
      return Object.freeze({ category: "nature", subtype: profile.subtype });
    case "building":
      return Object.freeze({ category: "building", subtype: profile.subtype });
    case "tileset":
      return Object.freeze({ category: "tileset", subtype: profile.subtype });
    case "item":
      return Object.freeze({ category: "item", subtype: profile.subtype });
    case "artwork":
      return Object.freeze({ category: "artwork", subtype: profile.subtype });
  }
}

function cloneBaseProfileValues(values: Readonly<BaseProfileValues>): MutableBaseProfileValues {
  return {
    pixelDensity: values.pixelDensity,
    styleProfile: values.styleProfile,
    tileSize: values.tileSize,
    ...(values.characterHeight === undefined ? {} : { characterHeight: values.characterHeight }),
    perspectiveType: values.perspectiveType,
    cameraAngle: values.cameraAngle,
    cameraDirection: values.cameraDirection,
    projectionType: values.projectionType,
    outlineStyle: values.outlineStyle,
    paletteMode: values.paletteMode,
    backgroundMode: values.backgroundMode,
    alphaPadding: values.alphaPadding,
    nearestNeighbor: values.nearestNeighbor,
    lightingDefaults: {
      policy: values.lightingDefaults.policy,
      notes: values.lightingDefaults.notes,
    },
  };
}

function freezeBaseProfileValues(values: MutableBaseProfileValues): BaseProfileValues {
  return Object.freeze({
    ...values,
    lightingDefaults: Object.freeze({
      policy: values.lightingDefaults.policy,
      notes: values.lightingDefaults.notes,
    }),
  });
}

function freezeOverrides(overrides: MutableBaseProfileOverrides): BaseProfileOverrides {
  const lightingDefaults = overrides.lightingDefaults;

  return Object.freeze({
    ...overrides,
    ...(lightingDefaults === undefined
      ? {}
      : {
          lightingDefaults: Object.freeze({
            policy: lightingDefaults.policy,
            notes: lightingDefaults.notes,
          }),
        }),
  });
}

function isLightingValue(value: ProfileValue): value is BaseProfileValues["lightingDefaults"] {
  return typeof value === "object" && value !== null;
}

function cloneProfileValue(value: ProfileValue): ProfileValue {
  if (!isLightingValue(value)) return value;

  return Object.freeze({
    policy: value.policy,
    notes: value.notes,
  });
}

export function profileValuesEqual(left: ProfileValue, right: ProfileValue): boolean {
  if (isLightingValue(left) && isLightingValue(right)) {
    return (
      left.policy === right.policy &&
      normalizeCompatibilityText(left.notes) === normalizeCompatibilityText(right.notes)
    );
  }

  return left === right;
}

function setProfileValue<Key extends ProfileValueKey>(
  values: MutableBaseProfileValues,
  key: Key,
  value: BaseProfileValues[Key],
): void {
  values[key] = value;
}

function setOverrideValue<Key extends ProfileValueKey>(
  overrides: MutableBaseProfileOverrides,
  key: Key,
  value: BaseProfileValues[Key],
): void {
  overrides[key] = value;
}

function cloneAndFreezeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneAndFreezeUnknown(entry)));
  }

  if (typeof value === "object" && value !== null) {
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneAndFreezeUnknown(nestedValue);
    }
    return Object.freeze(clone);
  }

  return value;
}

function mergeAnswers<Answers extends object>(
  categoryAnswers: Answers | undefined,
  assetAnswers: Answers,
): Answers {
  const answers: Record<string, unknown> = {};

  if (categoryAnswers !== undefined) {
    for (const [key, value] of Object.entries(categoryAnswers)) {
      if (value === undefined) continue;
      answers[key] = cloneAndFreezeUnknown(value);
    }
  }

  for (const [key, value] of Object.entries(assetAnswers)) {
    if (value === undefined) continue;
    answers[key] = cloneAndFreezeUnknown(value);
  }

  // Both inputs have already crossed the Zod boundary and share one
  // category-specific answer type. The record is rebuilt solely to omit
  // explicit undefined child fields and sever mutable input references.
  return Object.freeze(answers) as Answers;
}

function copyDefinedAnswers<Answers extends object>(
  target: Record<string, unknown>,
  source: Answers,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    target[key] = cloneAndFreezeUnknown(value);
  }
}

/**
 * Treats canonical moving-object sequences and the legacy singleton pair as
 * one atomic value. A representation selected at the Asset level replaces
 * the inherited representation; canonical data wins when both occur at the
 * same level.
 */
function mergeMovingObjectAnswers(
  categoryAnswers: MovingObjectAnswers | undefined,
  assetAnswers: MovingObjectAnswers,
): MovingObjectAnswers {
  const answers: Record<string, unknown> = {};

  if (categoryAnswers !== undefined) {
    copyDefinedAnswers(answers, categoryAnswers);
    if (categoryAnswers.animationSequences !== undefined) {
      delete answers.animationType;
      delete answers.framesPerDirection;
    }
  }

  if (assetAnswers.animationSequences !== undefined) {
    delete answers.animationType;
    delete answers.framesPerDirection;
    copyDefinedAnswers(answers, assetAnswers);
    delete answers.animationType;
    delete answers.framesPerDirection;
  } else if (
    assetAnswers.animationType !== undefined ||
    assetAnswers.framesPerDirection !== undefined
  ) {
    delete answers.animationSequences;
    delete answers.animationType;
    delete answers.framesPerDirection;
    copyDefinedAnswers(answers, assetAnswers);
  } else {
    copyDefinedAnswers(answers, assetAnswers);
  }

  return Object.freeze(answers) as MovingObjectAnswers;
}

/**
 * Merges the legacy singleton and canonical list animation representations as
 * one semantic value. The higher profile level selects the representation;
 * when both occur on the same level, the canonical list wins.
 */
function mergeCharacterAnswers(
  categoryAnswers: CharacterAnswers | undefined,
  assetAnswers: CharacterAnswers,
): CharacterAnswers {
  const answers: Record<string, unknown> = {};

  if (categoryAnswers !== undefined) {
    copyDefinedAnswers(answers, categoryAnswers);

    if (categoryAnswers.animationActions !== undefined) {
      delete answers.animationAction;
      delete answers.framesPerDirection;
    }
  }

  if (assetAnswers.animationActions !== undefined) {
    delete answers.animationAction;
    delete answers.framesPerDirection;
    copyDefinedAnswers(answers, assetAnswers);
    delete answers.animationAction;
    delete answers.framesPerDirection;
  } else if (assetAnswers.animationAction !== undefined) {
    delete answers.animationActions;
    copyDefinedAnswers(answers, assetAnswers);
  } else {
    copyDefinedAnswers(answers, assetAnswers);
  }

  return Object.freeze(answers) as CharacterAnswers;
}

function mergeCategoryData(
  categoryProfile: CategoryProfile | undefined,
  assetProfile: AssetProfile,
): AssetCategoryData {
  switch (assetProfile.category) {
    case "character":
      return Object.freeze({
        category: "character",
        subtype: assetProfile.subtype,
        answers: mergeCharacterAnswers(
          categoryProfile?.category === "character" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "movingObject":
      return Object.freeze({
        category: "movingObject",
        subtype: assetProfile.subtype,
        answers: mergeMovingObjectAnswers(
          categoryProfile?.category === "movingObject" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "staticObject":
      return Object.freeze({
        category: "staticObject",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "staticObject" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "texture":
      return Object.freeze({
        category: "texture",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "texture" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "nature":
      return Object.freeze({
        category: "nature",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "nature" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "building":
      return Object.freeze({
        category: "building",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "building" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "tileset":
      return Object.freeze({
        category: "tileset",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "tileset" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "item":
      return Object.freeze({
        category: "item",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "item" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
    case "artwork":
      return Object.freeze({
        category: "artwork",
        subtype: assetProfile.subtype,
        answers: mergeAnswers(
          categoryProfile?.category === "artwork" ? categoryProfile.defaults : undefined,
          assetProfile.answers,
        ),
      });
  }
}

function validateCategoryProfileReference(
  baseProfile: BaseProfile,
  categoryProfile: CategoryProfile | undefined,
  assetProfile: AssetProfile,
  conflicts: ProfileResolutionConflict[],
): boolean {
  const requestedCategoryProfileId = assetProfile.categoryProfileId;

  if (requestedCategoryProfileId === undefined) {
    if (categoryProfile !== undefined) {
      conflicts.push({
        code: "unexpectedCategoryReference",
        source: "asset",
        profileId: assetProfile.id,
        providedCategoryProfileId: categoryProfile.id,
      });
    }
    return false;
  }

  if (categoryProfile === undefined) {
    conflicts.push({
      code: "missingReference",
      source: "asset",
      reference: "categoryProfile",
      profileId: assetProfile.id,
      requestedId: requestedCategoryProfileId,
    });
    return false;
  }

  let valid = true;

  if (categoryProfile.id !== requestedCategoryProfileId) {
    conflicts.push({
      code: "referenceIdMismatch",
      source: "asset",
      reference: "categoryProfile",
      profileId: assetProfile.id,
      expectedId: requestedCategoryProfileId,
      actualId: categoryProfile.id,
    });
    valid = false;
  }

  if (categoryProfile.baseProfileId !== baseProfile.id) {
    conflicts.push({
      code: "referenceIdMismatch",
      source: "category",
      reference: "baseProfile",
      profileId: categoryProfile.id,
      expectedId: categoryProfile.baseProfileId,
      actualId: baseProfile.id,
    });
    valid = false;
  }

  if (categoryProfile.category !== assetProfile.category) {
    conflicts.push({
      code: "classificationMismatch",
      source: "category",
      field: "category",
      profileId: categoryProfile.id,
      expectedValue: assetProfile.category,
      actualValue: categoryProfile.category,
    });
    valid = false;
  }

  if (categoryProfile.subtype !== assetProfile.subtype) {
    conflicts.push({
      code: "classificationMismatch",
      source: "category",
      field: "subtype",
      profileId: categoryProfile.id,
      expectedValue: assetProfile.subtype,
      actualValue: categoryProfile.subtype,
    });
    valid = false;
  }

  return valid;
}

interface ApplyOverridesInput {
  readonly source: ProfileOverrideLevel;
  readonly profileId: StableId;
  readonly overrides: BaseProfileOverrides;
  readonly baseProfile: BaseProfile;
  readonly selection: AssetSelection;
  readonly capabilities: ReturnType<typeof resolveCapabilities>;
  readonly values: MutableBaseProfileValues;
  readonly valueSources: Partial<Record<ProfileValueKey, ProfileValueSource>>;
  readonly normalizedOverrides: MutableBaseProfileOverrides;
  readonly conflicts: ProfileResolutionConflict[];
  readonly notices: ProfileResolutionNotice[];
}

function applyOverrides(input: ApplyOverridesInput): void {
  for (const key of PROFILE_VALUE_KEYS) {
    const attemptedValue = input.overrides[key];
    if (attemptedValue === undefined) continue;

    if (key === "characterHeight" && !input.capabilities.scaledCharacter) {
      if (typeof attemptedValue !== "number") continue;

      input.notices.push({
        code: "irrelevantOverride",
        source: input.source,
        field: "characterHeight",
        profileId: input.profileId,
        attemptedValue,
        category: input.selection.category,
        subtype: input.selection.subtype,
      });
      continue;
    }

    const inheritedValue = input.values[key];
    if (profileValuesEqual(inheritedValue, attemptedValue)) {
      input.notices.push({
        code: "redundantOverride",
        source: input.source,
        field: key,
        profileId: input.profileId,
        value: cloneProfileValue(attemptedValue),
      });
      continue;
    }

    if (input.baseProfile.locks[key] === true) {
      input.conflicts.push({
        code: "lockedOverride",
        source: input.source,
        field: key,
        profileId: input.profileId,
        inheritedValue: cloneProfileValue(input.baseProfile.values[key]),
        attemptedValue: cloneProfileValue(attemptedValue),
      });
      continue;
    }

    setProfileValue(input.values, key, attemptedValue);
    setOverrideValue(input.normalizedOverrides, key, attemptedValue);
    input.valueSources[key] = input.source;
  }
}

/**
 * Resolves one validated asset-profile chain without mutating any input.
 * Expected hierarchy and lock problems are returned as structured conflicts;
 * callers should not use a `conflict` result for production output.
 */
export function resolveProfile(input: ResolveProfileInput): ProfileResolutionResult {
  const { assetProfile, baseProfile, categoryProfile } = input;
  const conflicts: ProfileResolutionConflict[] = [];
  const notices: ProfileResolutionNotice[] = [];
  const selection = createAssetSelection(assetProfile);

  if (baseProfile === undefined) {
    const missingBaseConflict = Object.freeze({
      code: "missingReference" as const,
      source: "asset" as const,
      reference: "baseProfile" as const,
      profileId: assetProfile.id,
      requestedId: assetProfile.baseProfileId,
    });

    return Object.freeze({
      status: "conflict",
      conflicts: Object.freeze([missingBaseConflict] as const),
      notices: Object.freeze([]),
    });
  }

  const capabilities = Object.freeze({
    ...resolveCapabilities(selection.category, selection.subtype),
  });
  const values = cloneBaseProfileValues(baseProfile.values);
  const valueSources: Partial<Record<ProfileValueKey, ProfileValueSource>> = {};
  const normalizedCategoryOverrides: MutableBaseProfileOverrides = {};
  const normalizedAssetOverrides: MutableBaseProfileOverrides = {};

  for (const key of PROFILE_VALUE_KEYS) {
    if (values[key] !== undefined) valueSources[key] = "base";
  }

  if (!capabilities.scaledCharacter) {
    delete values.characterHeight;
    delete valueSources.characterHeight;
  }

  const assetReferencesBase = assetProfile.baseProfileId === baseProfile.id;
  if (!assetReferencesBase) {
    conflicts.push({
      code: "referenceIdMismatch",
      source: "asset",
      reference: "baseProfile",
      profileId: assetProfile.id,
      expectedId: assetProfile.baseProfileId,
      actualId: baseProfile.id,
    });
  }

  const categoryProfileCanApply = validateCategoryProfileReference(
    baseProfile,
    categoryProfile,
    assetProfile,
    conflicts,
  );

  const firstReferenceConflict = conflicts[0];
  if (firstReferenceConflict !== undefined) {
    const frozenReferenceConflicts: [ProfileResolutionConflict, ...ProfileResolutionConflict[]] = [
      Object.freeze(firstReferenceConflict),
      ...conflicts.slice(1).map((conflict) => Object.freeze(conflict)),
    ];

    return Object.freeze({
      status: "conflict",
      conflicts: Object.freeze(frozenReferenceConflicts),
      notices: Object.freeze([]),
    });
  }

  if (categoryProfileCanApply && categoryProfile !== undefined) {
    applyOverrides({
      source: "category",
      profileId: categoryProfile.id,
      overrides: categoryProfile.overrides,
      baseProfile,
      selection,
      capabilities,
      values,
      valueSources,
      normalizedOverrides: normalizedCategoryOverrides,
      conflicts,
      notices,
    });
  }

  if (assetReferencesBase) {
    applyOverrides({
      source: "asset",
      profileId: assetProfile.id,
      overrides: assetProfile.overrides,
      baseProfile,
      selection,
      capabilities,
      values,
      valueSources,
      normalizedOverrides: normalizedAssetOverrides,
      conflicts,
      notices,
    });
  }

  if (capabilities.scaledCharacter && values.characterHeight === undefined) {
    conflicts.push({
      code: "missingRequiredValue",
      source: "base",
      field: "characterHeight",
      profileId: baseProfile.id,
      category: selection.category,
      subtype: selection.subtype,
    });

    const firstMissingValueConflict = conflicts[0];
    if (firstMissingValueConflict === undefined) {
      throw new Error("Expected a missing character-height conflict.");
    }

    const frozenMissingValueConflicts: [ProfileResolutionConflict, ...ProfileResolutionConflict[]] =
      [
        Object.freeze(firstMissingValueConflict),
        ...conflicts.slice(1).map((conflict) => Object.freeze(conflict)),
      ];

    return Object.freeze({
      status: "conflict",
      conflicts: Object.freeze(frozenMissingValueConflicts),
      notices: Object.freeze(notices.map((notice) => Object.freeze(notice))),
    });
  }

  const resolvedValues = freezeBaseProfileValues(values);
  const compatibilityKey = createCompatibilityKey(resolvedValues, selection);

  if (assetProfile.compatibilityKey !== compatibilityKey) {
    notices.push({
      code: "staleCompatibilityKey",
      source: "asset",
      profileId: assetProfile.id,
      storedKey: assetProfile.compatibilityKey,
      computedKey: compatibilityKey,
    });
  }

  const appliedCategoryProfile =
    categoryProfileCanApply && categoryProfile !== undefined ? categoryProfile : undefined;
  const profile: ResolvedProfile = Object.freeze({
    schemaVersion: 2,
    baseProfileId: baseProfile.id,
    ...(assetProfile.categoryProfileId === undefined
      ? {}
      : { categoryProfileId: assetProfile.categoryProfileId }),
    assetProfileId: assetProfile.id,
    name: assetProfile.name,
    categoryData: mergeCategoryData(appliedCategoryProfile, assetProfile),
    capabilities,
    values: resolvedValues,
    valueSources: Object.freeze({ ...valueSources }),
    normalizedOverrides: Object.freeze({
      category: freezeOverrides(normalizedCategoryOverrides),
      asset: freezeOverrides(normalizedAssetOverrides),
    }),
    compatibilityKey,
  });

  const frozenNotices = Object.freeze(notices.map((notice) => Object.freeze(notice)));
  const firstConflict = conflicts[0];

  if (firstConflict === undefined) {
    return Object.freeze({
      status: "resolved",
      profile,
      conflicts: Object.freeze([] as const),
      notices: frozenNotices,
    });
  }

  const frozenConflicts: [ProfileResolutionConflict, ...ProfileResolutionConflict[]] = [
    Object.freeze(firstConflict),
    ...conflicts.slice(1).map((conflict) => Object.freeze(conflict)),
  ];

  return Object.freeze({
    status: "conflict",
    partialProfile: profile,
    conflicts: Object.freeze(frozenConflicts),
    notices: frozenNotices,
  });
}
