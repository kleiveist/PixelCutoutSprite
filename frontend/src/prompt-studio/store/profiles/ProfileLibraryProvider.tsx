import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AssetCategory } from "../../domain/assets";
import {
  createBaseProfile as createBaseProfileInLibrary,
  deleteAssetProfile,
  deleteBaseProfile as deleteBaseProfileInLibrary,
  duplicateBaseProfile as duplicateBaseProfileInLibrary,
  duplicateAssetProfile,
  saveAssetProfile as saveAssetProfileInLibrary,
  toggleAssetProfileFavorite,
  type AssetProfileSaveDefinition,
  type BaseProfileDefinition,
  type ProfileLibraryChange,
} from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  StableIdSchema,
  type AssetProfile,
  type BaseProfile,
  type ProfileLibrary,
  type StableId,
} from "../../schemas";
import {
  importProfileBundle as importProfileBundleIntoStorage,
  type ImportProfileBundleResult,
  type StorageMutationResult,
  type V2StorageAdapter,
} from "../../services";
import {
  createProfileLibraryState,
  profileLibraryReducer,
  type ProfileLibraryFilters,
  type ProfileMutationNotice,
  type ProfileMutationOperation,
} from "./profileLibraryState";

export type ProfileLibraryStorage = Pick<
  V2StorageAdapter,
  "readProfileLibrary" | "writeProfileLibrary"
>;

type ProfileEntity = AssetProfile | BaseProfile;

export type ProfileActionResult<Profile extends ProfileEntity = AssetProfile> =
  | Readonly<{ status: "ok"; profile: Profile }>
  | Readonly<{
      status: "invalid" | "unavailable" | "notFound" | "idConflict" | "inUse";
      message: string;
    }>;

type ProfileActionFailure = Exclude<ProfileActionResult<ProfileEntity>, Readonly<{ status: "ok" }>>;

export interface ProfileLibraryContextValue {
  readonly libraryResult: ReturnType<ProfileLibraryStorage["readProfileLibrary"]>;
  readonly filters: ProfileLibraryFilters;
  readonly mutation: ProfileMutationNotice;
  readonly setProfile: (profileId: StableId | null) => void;
  readonly setCategory: (category: AssetCategory | null) => void;
  readonly setBaseProfile: (baseProfileId: StableId | null) => void;
  readonly setFavoritesOnly: (favoritesOnly: boolean) => void;
  readonly setGrouping: (groupBy: ProfileLibraryFilters["groupBy"]) => void;
  readonly resetFilters: () => void;
  readonly toggleFavorite: (profileId: StableId) => ProfileActionResult;
  readonly duplicateProfile: (profileId: StableId) => ProfileActionResult;
  readonly saveAssetProfile: (definition: AssetProfileSaveDefinition) => ProfileActionResult;
  readonly deleteProfile: (profileId: StableId) => ProfileActionResult;
  readonly deleteBaseProfile: (profileId: StableId) => ProfileActionResult<BaseProfile>;
  readonly createBaseProfile: (
    definition: BaseProfileDefinition,
  ) => ProfileActionResult<BaseProfile>;
  readonly duplicateBaseProfile: (
    profileId: StableId,
    proposedDefinition?: BaseProfileDefinition,
  ) => ProfileActionResult<BaseProfile>;
  readonly importProfileBundle: (
    json: string,
    options?: Readonly<{ conflictStrategy?: "replaceExisting" }>,
  ) => ImportProfileBundleResult;
  readonly dismissMutation: () => void;
}

export interface ProfileLibraryProviderProps {
  readonly children: ReactNode;
  readonly storageAdapter: ProfileLibraryStorage;
  readonly now?: () => string;
  readonly createProfileId?: () => string;
  readonly createBaseProfileId?: () => string;
}

const ProfileLibraryContext = createContext<ProfileLibraryContextValue | null>(null);

let fallbackAssetIdSequence = 0;
let fallbackBaseIdSequence = 0;

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function randomProfileId(prefix: "asset" | "base"): string | null {
  try {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }

    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.getRandomValues === "function"
    ) {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      const randomId = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
      return `${prefix}_${randomId}`;
    }
  } catch {
    // The collision check below keeps the local fallback safe.
  }

  return null;
}

function createDefaultProfileId(): string {
  const randomId = randomProfileId("asset");
  if (randomId !== null) return randomId;

  fallbackAssetIdSequence += 1;
  return `asset_${Date.now().toString(36)}_${fallbackAssetIdSequence.toString(36)}`;
}

function createDefaultBaseProfileId(): string {
  const randomId = randomProfileId("base");
  if (randomId !== null) return randomId;

  fallbackBaseIdSequence += 1;
  return `base_${Date.now().toString(36)}_${fallbackBaseIdSequence.toString(36)}`;
}

function actionLabel(operation: ProfileMutationOperation): string {
  switch (operation) {
    case "favorite":
      return "Favoritenstatus";
    case "duplicate":
      return "Duplikat";
    case "save":
      return "Assetprofil";
    case "delete":
      return "Löschung";
    case "deleteBase":
      return "Löschung der Produktionsfamilie";
    case "createBase":
      return "Basisprofil";
    case "duplicateBase":
      return "Basisprofil-Duplikat";
  }
}

function failureNotice(
  operation: ProfileMutationOperation,
  status: Exclude<ProfileActionResult["status"], "ok">,
  message: string,
): Extract<ProfileMutationNotice, { status: Exclude<ProfileActionResult["status"], "ok"> }> {
  return { status, operation, message };
}

function storageFailure(
  operation: ProfileMutationOperation,
  result: Exclude<StorageMutationResult, Readonly<{ status: "ok" }>>,
): ProfileActionFailure {
  return {
    status: result.status,
    message:
      result.status === "invalid"
        ? `${actionLabel(operation)} wurde nicht gespeichert, weil die Profilbibliothek ungültig wäre.`
        : `${actionLabel(operation)} wurde nicht gespeichert. Der lokale Speicher ist nicht verfügbar.`,
  };
}

function findCanonicalChangedProfile<Profile extends ProfileEntity>(
  library: ProfileLibrary,
  requestedProfile: Profile,
): Profile | null {
  const canonicalProfile =
    requestedProfile.kind === "baseProfile"
      ? library.baseProfiles.find((profile) => profile.id === requestedProfile.id)
      : library.assetProfiles.find((profile) => profile.id === requestedProfile.id);

  if (!canonicalProfile || canonicalProfile.kind !== requestedProfile.kind) {
    return null;
  }
  return canonicalProfile as Profile;
}

export function ProfileLibraryProvider({
  children,
  storageAdapter,
  now = currentIsoTimestamp,
  createProfileId = createDefaultProfileId,
  createBaseProfileId = createDefaultBaseProfileId,
}: ProfileLibraryProviderProps) {
  const [initialState] = useState(() =>
    createProfileLibraryState(storageAdapter.readProfileLibrary()),
  );
  const [state, dispatch] = useReducer(profileLibraryReducer, initialState);
  const libraryRef = useRef<ProfileLibrary | null>(
    initialState.libraryResult.status === "valid"
      ? initialState.libraryResult.value
      : initialState.libraryResult.status === "empty"
        ? { baseProfiles: [], categoryProfiles: [], assetProfiles: [] }
        : null,
  );
  const initialReadStatusRef = useRef(initialState.libraryResult.status);

  const fail = useCallback(
    (
      operation: ProfileMutationOperation,
      status: Exclude<ProfileActionResult["status"], "ok">,
      message: string,
    ): ProfileActionFailure => {
      dispatch({
        type: "mutationFailed",
        mutation: failureNotice(operation, status, message),
      });
      return { status, message };
    },
    [],
  );

  const commitChange = useCallback(
    <Profile extends ProfileEntity>(
      operation: ProfileMutationOperation,
      change: ProfileLibraryChange<Profile>,
    ): ProfileActionResult<Profile> => {
      if (change.status === "notFound") {
        return fail(
          operation,
          "notFound",
          "Das Profil existiert nicht mehr und wurde nicht verändert.",
        );
      }
      if (change.status === "idConflict") {
        return fail(
          operation,
          "idConflict",
          operation === "save"
            ? "Das Assetprofil konnte wegen einer bereits verwendeten Profil-ID nicht gespeichert werden."
            : "Das Duplikat konnte wegen einer bereits verwendeten Profil-ID nicht angelegt werden.",
        );
      }

      const candidate = ProfileLibrarySchema.safeParse(change.library);
      if (!candidate.success) {
        return fail(
          operation,
          "invalid",
          `${actionLabel(operation)} wurde abgebrochen, weil die Profilkette ungültig wäre.`,
        );
      }

      // A successful delete intentionally removes its subject from the
      // candidate graph. The deleted profile already comes from the currently
      // validated library; every other mutation returns the canonical entity
      // produced by parsing the resulting graph.
      const canonicalProfile =
        operation === "delete" || operation === "deleteBase"
          ? change.profile
          : findCanonicalChangedProfile(candidate.data, change.profile);
      if (canonicalProfile === null) {
        return fail(
          operation,
          "invalid",
          `${actionLabel(operation)} wurde abgebrochen, weil das geänderte Profil im validierten Profilgraphen fehlt.`,
        );
      }

      const writeResult = storageAdapter.writeProfileLibrary(candidate.data);
      if (writeResult.status !== "ok") {
        const result = storageFailure(operation, writeResult);
        return fail(operation, result.status, result.message);
      }

      libraryRef.current = candidate.data;
      dispatch({
        type: "mutationSucceeded",
        library: candidate.data,
        operation,
        profile: canonicalProfile,
      });
      return { status: "ok", profile: canonicalProfile };
    },
    [fail, storageAdapter],
  );

  const currentLibraryOrFailure = useCallback(
    (operation: ProfileMutationOperation): ProfileLibrary | ProfileActionFailure => {
      const library = libraryRef.current;
      if (library) return library;
      if (initialReadStatusRef.current === "invalid") {
        return fail(
          operation,
          "invalid",
          "Die gespeicherte Profilbibliothek ist ungültig und wurde nicht verändert.",
        );
      }
      return fail(
        operation,
        "unavailable",
        "Die Profilbibliothek ist nicht verfügbar und wurde nicht verändert.",
      );
    },
    [fail],
  );

  const toggleFavorite = useCallback(
    (profileId: StableId): ProfileActionResult => {
      const library = currentLibraryOrFailure("favorite");
      if (!("assetProfiles" in library)) return library;
      return commitChange("favorite", toggleAssetProfileFavorite(library, profileId));
    },
    [commitChange, currentLibraryOrFailure],
  );

  const duplicateProfile = useCallback(
    (profileId: StableId): ProfileActionResult => {
      const library = currentLibraryOrFailure("duplicate");
      if (!("assetProfiles" in library)) return library;

      let candidateId: string;
      try {
        candidateId = createProfileId();
      } catch {
        return fail(
          "duplicate",
          "invalid",
          "Das Duplikat konnte nicht mit einer neuen Profil-ID angelegt werden.",
        );
      }
      const parsedId = StableIdSchema.safeParse(candidateId);
      if (!parsedId.success) {
        return fail(
          "duplicate",
          "invalid",
          "Das Duplikat konnte wegen einer ungültigen Profil-ID nicht angelegt werden.",
        );
      }

      let duplicateTimestamp: string;
      try {
        duplicateTimestamp = now();
      } catch {
        return fail(
          "duplicate",
          "invalid",
          "Das Duplikat konnte nicht mit einem gültigen Zeitstempel angelegt werden.",
        );
      }

      return commitChange(
        "duplicate",
        duplicateAssetProfile(library, profileId, parsedId.data, duplicateTimestamp),
      );
    },
    [commitChange, createProfileId, currentLibraryOrFailure, fail, now],
  );

  const deleteProfile = useCallback(
    (profileId: StableId): ProfileActionResult => {
      const library = currentLibraryOrFailure("delete");
      if (!("assetProfiles" in library)) return library;
      return commitChange("delete", deleteAssetProfile(library, profileId));
    },
    [commitChange, currentLibraryOrFailure],
  );

  const deleteBaseProfile = useCallback(
    (profileId: StableId): ProfileActionResult<BaseProfile> => {
      const library = currentLibraryOrFailure("deleteBase");
      if (!("assetProfiles" in library)) return library;
      const change = deleteBaseProfileInLibrary(library, profileId);
      if (change.status === "inUse") {
        const referencedCount = change.categoryProfileCount + change.assetProfileCount;
        return fail(
          "deleteBase",
          "inUse",
          `Die Produktionsfamilie wird noch von ${String(referencedCount)} ${
            referencedCount === 1 ? "Profil" : "Profilen"
          } verwendet und wurde nicht gelöscht.`,
        );
      }
      return commitChange("deleteBase", change);
    },
    [commitChange, currentLibraryOrFailure, fail],
  );

  const saveAssetProfile = useCallback(
    (definition: AssetProfileSaveDefinition): ProfileActionResult => {
      const library = currentLibraryOrFailure("save");
      if (!("assetProfiles" in library)) return library;

      let candidateId: string;
      try {
        candidateId = definition.sourceAssetProfileId ?? createProfileId();
      } catch {
        return fail(
          "save",
          "invalid",
          "Das Assetprofil konnte nicht mit einer gültigen Profil-ID gespeichert werden.",
        );
      }
      const parsedId = StableIdSchema.safeParse(candidateId);
      if (!parsedId.success) {
        return fail(
          "save",
          "invalid",
          "Das Assetprofil konnte wegen einer ungültigen Profil-ID nicht gespeichert werden.",
        );
      }

      let timestamp: string;
      try {
        timestamp = now();
      } catch {
        return fail(
          "save",
          "invalid",
          "Das Assetprofil konnte nicht mit einem gültigen Zeitstempel gespeichert werden.",
        );
      }

      try {
        return commitChange(
          "save",
          saveAssetProfileInLibrary(library, parsedId.data, timestamp, definition),
        );
      } catch {
        return fail(
          "save",
          "invalid",
          "Das Assetprofil konnte aus der geprüften Konfiguration nicht erstellt werden.",
        );
      }
    },
    [commitChange, createProfileId, currentLibraryOrFailure, fail, now],
  );

  const createBaseProfile = useCallback(
    (definition: BaseProfileDefinition): ProfileActionResult<BaseProfile> => {
      const library = currentLibraryOrFailure("createBase");
      if (!("baseProfiles" in library)) return library;

      let candidateId: string;
      try {
        candidateId = createBaseProfileId();
      } catch {
        return fail(
          "createBase",
          "invalid",
          "Das Basisprofil konnte nicht mit einer neuen Profil-ID angelegt werden.",
        );
      }
      const parsedId = StableIdSchema.safeParse(candidateId);
      if (!parsedId.success) {
        return fail(
          "createBase",
          "invalid",
          "Das Basisprofil konnte wegen einer ungültigen Profil-ID nicht angelegt werden.",
        );
      }

      let timestamp: string;
      try {
        timestamp = now();
      } catch {
        return fail(
          "createBase",
          "invalid",
          "Das Basisprofil konnte nicht mit einem gültigen Zeitstempel angelegt werden.",
        );
      }

      return commitChange(
        "createBase",
        createBaseProfileInLibrary(library, parsedId.data, timestamp, definition),
      );
    },
    [commitChange, createBaseProfileId, currentLibraryOrFailure, fail, now],
  );

  const duplicateBaseProfile = useCallback(
    (
      profileId: StableId,
      proposedDefinition?: BaseProfileDefinition,
    ): ProfileActionResult<BaseProfile> => {
      const library = currentLibraryOrFailure("duplicateBase");
      if (!("baseProfiles" in library)) return library;

      let candidateId: string;
      try {
        candidateId = createBaseProfileId();
      } catch {
        return fail(
          "duplicateBase",
          "invalid",
          "Das Basisprofil-Duplikat konnte nicht mit einer neuen Profil-ID angelegt werden.",
        );
      }
      const parsedId = StableIdSchema.safeParse(candidateId);
      if (!parsedId.success) {
        return fail(
          "duplicateBase",
          "invalid",
          "Das Basisprofil-Duplikat konnte wegen einer ungültigen Profil-ID nicht angelegt werden.",
        );
      }

      let timestamp: string;
      try {
        timestamp = now();
      } catch {
        return fail(
          "duplicateBase",
          "invalid",
          "Das Basisprofil-Duplikat konnte nicht mit einem gültigen Zeitstempel angelegt werden.",
        );
      }

      return commitChange(
        "duplicateBase",
        duplicateBaseProfileInLibrary(
          library,
          profileId,
          parsedId.data,
          timestamp,
          proposedDefinition,
        ),
      );
    },
    [commitChange, createBaseProfileId, currentLibraryOrFailure, fail, now],
  );

  const importProfileBundle = useCallback(
    (
      json: string,
      options: Readonly<{ conflictStrategy?: "replaceExisting" }> = {},
    ): ImportProfileBundleResult => {
      const result = importProfileBundleIntoStorage(storageAdapter, json, options);
      if (result.status !== "imported") return result;

      const refreshed = storageAdapter.readProfileLibrary();
      if (refreshed.status === "unavailable") {
        return { status: "unavailable", message: refreshed.message };
      }
      if (refreshed.status === "invalid") {
        return {
          status: "invalid",
          reason: "invalidExistingLibrary",
          message: refreshed.message,
          issues: refreshed.issues,
        };
      }

      const library: ProfileLibrary =
        refreshed.status === "valid"
          ? refreshed.value
          : { baseProfiles: [], categoryProfiles: [], assetProfiles: [] };
      libraryRef.current = library;
      dispatch({ type: "libraryImported", library });
      return result;
    },
    [storageAdapter],
  );

  const value = useMemo<ProfileLibraryContextValue>(
    () => ({
      libraryResult: state.libraryResult,
      filters: state.filters,
      mutation: state.mutation,
      setProfile: (profileId) => dispatch({ type: "profileChanged", profileId }),
      setCategory: (category) => dispatch({ type: "categoryChanged", category }),
      setBaseProfile: (baseProfileId) => dispatch({ type: "baseProfileChanged", baseProfileId }),
      setFavoritesOnly: (favoritesOnly) => dispatch({ type: "favoritesChanged", favoritesOnly }),
      setGrouping: (groupBy) => dispatch({ type: "groupingChanged", groupBy }),
      resetFilters: () => dispatch({ type: "filtersReset" }),
      toggleFavorite,
      duplicateProfile,
      saveAssetProfile,
      deleteProfile,
      deleteBaseProfile,
      createBaseProfile,
      duplicateBaseProfile,
      importProfileBundle,
      dismissMutation: () => dispatch({ type: "mutationDismissed" }),
    }),
    [
      deleteProfile,
      deleteBaseProfile,
      createBaseProfile,
      duplicateBaseProfile,
      duplicateProfile,
      importProfileBundle,
      saveAssetProfile,
      state.filters,
      state.libraryResult,
      state.mutation,
      toggleFavorite,
    ],
  );

  return <ProfileLibraryContext.Provider value={value}>{children}</ProfileLibraryContext.Provider>;
}

export function useProfileLibrary(): ProfileLibraryContextValue {
  const context = useContext(ProfileLibraryContext);
  if (!context) {
    throw new Error("useProfileLibrary must be used inside ProfileLibraryProvider.");
  }
  return context;
}
