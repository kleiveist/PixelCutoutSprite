import type { AssetCategory } from "../../domain/assets";
import type { AssetProfile, BaseProfile, ProfileLibrary, StableId } from "../../schemas";
import type { StorageReadResult } from "../../services";

export interface ProfileLibraryFilters {
  readonly profileId: StableId | null;
  readonly category: AssetCategory | null;
  readonly baseProfileId: StableId | null;
  readonly favoritesOnly: boolean;
  readonly groupBy: "category" | "compatibility";
}

export type ProfileMutationOperation =
  "favorite" | "duplicate" | "save" | "delete" | "deleteBase" | "createBase" | "duplicateBase";

export type ProfileMutationNotice =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status: "saved";
      operation: ProfileMutationOperation;
      profileId: StableId;
      profileName: string;
    }>
  | Readonly<{
      status: "invalid" | "unavailable" | "notFound" | "idConflict" | "inUse";
      operation: ProfileMutationOperation;
      message: string;
    }>;

export interface ProfileLibraryState {
  readonly libraryResult: StorageReadResult<ProfileLibrary>;
  readonly filters: ProfileLibraryFilters;
  readonly mutation: ProfileMutationNotice;
}

export type ProfileLibraryAction =
  | Readonly<{ type: "profileChanged"; profileId: StableId | null }>
  | Readonly<{ type: "categoryChanged"; category: AssetCategory | null }>
  | Readonly<{ type: "baseProfileChanged"; baseProfileId: StableId | null }>
  | Readonly<{ type: "favoritesChanged"; favoritesOnly: boolean }>
  | Readonly<{
      type: "groupingChanged";
      groupBy: ProfileLibraryFilters["groupBy"];
    }>
  | Readonly<{ type: "filtersReset" }>
  | Readonly<{
      type: "mutationSucceeded";
      library: ProfileLibrary;
      operation: ProfileMutationOperation;
      profile: AssetProfile | BaseProfile;
    }>
  | Readonly<{
      type: "mutationFailed";
      mutation: Exclude<ProfileMutationNotice, Readonly<{ status: "ready" }>>;
    }>
  | Readonly<{ type: "libraryImported"; library: ProfileLibrary }>
  | Readonly<{ type: "mutationDismissed" }>;

export const DEFAULT_PROFILE_LIBRARY_FILTERS: ProfileLibraryFilters = Object.freeze({
  profileId: null,
  category: null,
  baseProfileId: null,
  favoritesOnly: false,
  groupBy: "category",
});

export function createProfileLibraryState(
  libraryResult: StorageReadResult<ProfileLibrary>,
): ProfileLibraryState {
  return {
    libraryResult,
    filters: DEFAULT_PROFILE_LIBRARY_FILTERS,
    mutation: { status: "ready" },
  };
}

export function profileLibraryReducer(
  state: ProfileLibraryState,
  action: ProfileLibraryAction,
): ProfileLibraryState {
  switch (action.type) {
    case "profileChanged":
      return {
        ...state,
        filters: { ...state.filters, profileId: action.profileId },
      };
    case "categoryChanged":
      return {
        ...state,
        filters: { ...state.filters, category: action.category },
      };
    case "baseProfileChanged":
      return {
        ...state,
        filters: { ...state.filters, baseProfileId: action.baseProfileId },
      };
    case "favoritesChanged":
      return {
        ...state,
        filters: { ...state.filters, favoritesOnly: action.favoritesOnly },
      };
    case "groupingChanged":
      return {
        ...state,
        filters: { ...state.filters, groupBy: action.groupBy },
      };
    case "filtersReset":
      return state.filters === DEFAULT_PROFILE_LIBRARY_FILTERS
        ? state
        : { ...state, filters: DEFAULT_PROFILE_LIBRARY_FILTERS };
    case "mutationSucceeded":
      return {
        ...state,
        libraryResult: { status: "valid", value: action.library },
        filters:
          action.operation === "delete" && state.filters.profileId === action.profile.id
            ? { ...state.filters, profileId: null }
            : state.filters,
        mutation: {
          status: "saved",
          operation: action.operation,
          profileId: action.profile.id,
          profileName: action.profile.name,
        },
      };
    case "mutationFailed":
      return { ...state, mutation: action.mutation };
    case "libraryImported":
      return {
        ...state,
        libraryResult: { status: "valid", value: action.library },
        filters:
          state.filters.profileId === null ||
          action.library.assetProfiles.some((profile) => profile.id === state.filters.profileId)
            ? state.filters
            : { ...state.filters, profileId: null },
        mutation: { status: "ready" },
      };
    case "mutationDismissed":
      return state.mutation.status === "ready"
        ? state
        : { ...state, mutation: { status: "ready" } };
  }
}
