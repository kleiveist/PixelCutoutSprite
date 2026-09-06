import type { AssetProfile, BaseProfile, ProfileLibrary, StableId } from "../../schemas";
import { parseAssetProfile } from "../../schemas/profiles.schema";

export type ProfileLibraryChange<Profile extends AssetProfile | BaseProfile> =
  | Readonly<{
      status: "changed";
      library: ProfileLibrary;
      profile: Profile;
    }>
  | Readonly<{
      status: "notFound";
      profileId: StableId;
    }>
  | Readonly<{
      status: "idConflict";
      profileId: StableId;
    }>;

export type AssetProfileLibraryChange = ProfileLibraryChange<AssetProfile>;
export type BaseProfileLibraryChange = ProfileLibraryChange<BaseProfile>;
export type BaseProfileDeletionChange =
  | BaseProfileLibraryChange
  | Readonly<{
      status: "inUse";
      profileId: StableId;
      categoryProfileCount: number;
      assetProfileCount: number;
    }>;
export type BaseProfileDefinition = Readonly<
  Pick<BaseProfile, "name" | "iconId" | "values" | "locks">
>;
type AssetProfileSaveFields =
  | "name"
  | "baseProfileId"
  | "categoryProfileId"
  | "compatibilityKey"
  | "capabilities"
  | "overrides"
  | "category"
  | "subtype"
  | "answers";
type DistributiveAssetProfileSaveDefinition<Profile> = Profile extends AssetProfile
  ? Readonly<Pick<Profile, Extract<keyof Profile, AssetProfileSaveFields>>>
  : never;
export type AssetProfileSaveDefinition = DistributiveAssetProfileSaveDefinition<AssetProfile> &
  Readonly<{ sourceAssetProfileId?: StableId }>;

const MAX_PROFILE_NAME_LENGTH = 120;
const COPY_SUFFIX_PATTERN = / \(Kopie(?: \d+)?\)$/u;

function normalizedProfileName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
}

function copyNameWithSuffix(name: string, suffix: string): string {
  const availableLength = MAX_PROFILE_NAME_LENGTH - suffix.length;
  return `${name.slice(0, availableLength).trimEnd()}${suffix}`;
}

function replaceAssetProfile(library: ProfileLibrary, profile: AssetProfile): ProfileLibrary {
  return {
    ...library,
    assetProfiles: library.assetProfiles.map((candidate) =>
      candidate.id === profile.id ? profile : candidate,
    ),
  };
}

function appendAssetProfile(library: ProfileLibrary, profile: AssetProfile): ProfileLibrary {
  return {
    ...library,
    assetProfiles: [...library.assetProfiles, profile],
  };
}

function cloneBaseProfileDefinition(definition: BaseProfileDefinition): BaseProfileDefinition {
  return {
    name: definition.name,
    iconId: definition.iconId,
    values: {
      ...definition.values,
      lightingDefaults: { ...definition.values.lightingDefaults },
    },
    locks: { ...definition.locks },
  };
}

function appendBaseProfile(
  library: ProfileLibrary,
  profile: BaseProfile,
): BaseProfileLibraryChange {
  return {
    status: "changed",
    library: {
      ...library,
      baseProfiles: [...library.baseProfiles, profile],
      categoryProfiles: library.categoryProfiles,
      assetProfiles: library.assetProfiles,
    },
    profile,
  };
}

export function createDuplicateProfileName(
  name: string,
  existingNames: readonly string[] = [],
): string {
  const strippedName = name.replace(COPY_SUFFIX_PATTERN, "").trimEnd();
  const baseName = strippedName.length > 0 ? strippedName : name.trimEnd();
  const occupiedNames = new Set(existingNames.map(normalizedProfileName));

  for (let copyNumber = 1; copyNumber <= existingNames.length + 1; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " (Kopie)" : ` (Kopie ${copyNumber})`;
    const candidate = copyNameWithSuffix(baseName, suffix);
    if (!occupiedNames.has(normalizedProfileName(candidate))) return candidate;
  }

  // There are always more generated candidates than occupied names.
  return copyNameWithSuffix(baseName, ` (Kopie ${existingNames.length + 2})`);
}

/**
 * Adds a new standalone production family without changing or re-parenting any
 * existing category or asset profile. Validation of the resulting complete
 * graph remains the responsibility of the caller's Zod boundary.
 */
export function createBaseProfile(
  library: ProfileLibrary,
  profileId: StableId,
  timestamp: string,
  definition: BaseProfileDefinition,
): BaseProfileLibraryChange {
  if (library.baseProfiles.some((profile) => profile.id === profileId)) {
    return { status: "idConflict", profileId };
  }

  const clonedDefinition = cloneBaseProfileDefinition(definition);
  const profile: BaseProfile = {
    schemaVersion: 2,
    kind: "baseProfile",
    id: profileId,
    ...clonedDefinition,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return appendBaseProfile(library, profile);
}

/**
 * Copies only the selected Base profile. Descendant profiles keep referencing
 * the source family. A complete proposed definition can be supplied so a
 * conflict workflow can retain the user's intended values without mutating the
 * source.
 */
export function duplicateBaseProfile(
  library: ProfileLibrary,
  sourceProfileId: StableId,
  duplicateProfileId: StableId,
  timestamp: string,
  proposedDefinition?: BaseProfileDefinition,
): BaseProfileLibraryChange {
  const source = library.baseProfiles.find((profile) => profile.id === sourceProfileId);
  if (!source) return { status: "notFound", profileId: sourceProfileId };
  if (library.baseProfiles.some((profile) => profile.id === duplicateProfileId)) {
    return { status: "idConflict", profileId: duplicateProfileId };
  }

  const definition = cloneBaseProfileDefinition(
    proposedDefinition ?? {
      name: createDuplicateProfileName(
        source.name,
        library.baseProfiles.map((profile) => profile.name),
      ),
      iconId: source.iconId,
      values: source.values,
      locks: source.locks,
    },
  );
  const profile: BaseProfile = {
    schemaVersion: 2,
    kind: "baseProfile",
    id: duplicateProfileId,
    ...definition,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return appendBaseProfile(library, profile);
}

/**
 * Removes only an unreferenced production family. Descendants are never
 * cascaded or re-parented implicitly because either action could silently
 * change persisted production output.
 */
export function deleteBaseProfile(
  library: ProfileLibrary,
  profileId: StableId,
): BaseProfileDeletionChange {
  const profile = library.baseProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) return { status: "notFound", profileId };

  const categoryProfileCount = library.categoryProfiles.filter(
    (candidate) => candidate.baseProfileId === profileId,
  ).length;
  const assetProfileCount = library.assetProfiles.filter(
    (candidate) => candidate.baseProfileId === profileId,
  ).length;
  if (categoryProfileCount > 0 || assetProfileCount > 0) {
    return {
      status: "inUse",
      profileId,
      categoryProfileCount,
      assetProfileCount,
    };
  }

  return {
    status: "changed",
    library: {
      ...library,
      baseProfiles: library.baseProfiles.filter((candidate) => candidate.id !== profileId),
      categoryProfiles: library.categoryProfiles,
      assetProfiles: library.assetProfiles,
    },
    profile,
  };
}

export function toggleAssetProfileFavorite(
  library: ProfileLibrary,
  profileId: StableId,
): AssetProfileLibraryChange {
  const source = library.assetProfiles.find((profile) => profile.id === profileId);
  if (!source) return { status: "notFound", profileId };

  const profile: AssetProfile = {
    ...source,
    favorite: !source.favorite,
  };

  return {
    status: "changed",
    library: replaceAssetProfile(library, profile),
    profile,
  };
}

export function duplicateAssetProfile(
  library: ProfileLibrary,
  sourceProfileId: StableId,
  duplicateProfileId: StableId,
  timestamp: string,
): AssetProfileLibraryChange {
  const source = library.assetProfiles.find((profile) => profile.id === sourceProfileId);
  if (!source) return { status: "notFound", profileId: sourceProfileId };
  if (library.assetProfiles.some((profile) => profile.id === duplicateProfileId)) {
    return { status: "idConflict", profileId: duplicateProfileId };
  }

  const {
    legacyData: sourceLegacyData,
    migratedFromVersion: sourceMigrationVersion,
    ...copyableSource
  } = source;
  void sourceLegacyData;
  void sourceMigrationVersion;

  const profile: AssetProfile = {
    ...copyableSource,
    id: duplicateProfileId,
    name: createDuplicateProfileName(
      source.name,
      library.assetProfiles.map((profile) => profile.name),
    ),
    favorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    status: "changed",
    library: {
      ...library,
      assetProfiles: [...library.assetProfiles, profile],
    },
    profile,
  };
}

/**
 * Creates a new Asset profile or updates the profile referenced as the
 * definition's source. Source metadata remains stable while the production
 * configuration is replaced by the reviewed, already resolved definition.
 */
export function saveAssetProfile(
  library: ProfileLibrary,
  newProfileId: StableId,
  timestamp: string,
  definition: AssetProfileSaveDefinition,
): AssetProfileLibraryChange {
  const source = definition.sourceAssetProfileId
    ? library.assetProfiles.find((profile) => profile.id === definition.sourceAssetProfileId)
    : undefined;

  if (definition.sourceAssetProfileId !== undefined && source === undefined) {
    return {
      status: "notFound",
      profileId: definition.sourceAssetProfileId,
    };
  }
  if (
    source === undefined &&
    library.assetProfiles.some((profile) => profile.id === newProfileId)
  ) {
    return { status: "idConflict", profileId: newProfileId };
  }

  const { sourceAssetProfileId: ignoredSourceId, ...productionValues } = definition;
  void ignoredSourceId;
  const profile = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: source?.id ?? newProfileId,
    ...productionValues,
    iconId: source?.iconId ?? "wizard-draft",
    badgeIconIds: source?.badgeIconIds ?? [],
    tags: source?.tags ?? [],
    favorite: source?.favorite ?? false,
    ...(source?.migratedFromVersion === undefined
      ? {}
      : { migratedFromVersion: source.migratedFromVersion }),
    ...(source?.legacyData === undefined ? {} : { legacyData: source.legacyData }),
    createdAt: source?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });

  return {
    status: "changed",
    library:
      source === undefined
        ? appendAssetProfile(library, profile)
        : replaceAssetProfile(library, profile),
    profile,
  };
}

export function deleteAssetProfile(
  library: ProfileLibrary,
  profileId: StableId,
): AssetProfileLibraryChange {
  const profile = library.assetProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) return { status: "notFound", profileId };

  return {
    status: "changed",
    library: {
      ...library,
      baseProfiles: library.baseProfiles,
      categoryProfiles: library.categoryProfiles,
      assetProfiles: library.assetProfiles.filter((candidate) => candidate.id !== profileId),
    },
    profile,
  };
}
