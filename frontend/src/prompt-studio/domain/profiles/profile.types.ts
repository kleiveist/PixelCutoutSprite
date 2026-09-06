import type { AssetCapabilities, AssetCategory, AssetSubtype } from "../assets";
import type {
  BaseProfileOverrides,
  BaseProfileValues,
  AssetCategoryData,
  StableId,
} from "../../schemas";

export type ProfileValueKey = keyof BaseProfileValues;
export type ProfileValue = BaseProfileValues[ProfileValueKey];
export type ProfileOverrideLevel = "category" | "asset";
export type ProfileValueSource = "base" | ProfileOverrideLevel;

export type ProfileResolutionConflict =
  | Readonly<{
      code: "referenceIdMismatch";
      source: ProfileOverrideLevel;
      reference: "baseProfile" | "categoryProfile";
      profileId: StableId;
      expectedId: StableId;
      actualId: StableId;
    }>
  | Readonly<{
      code: "missingReference";
      source: "asset";
      reference: "baseProfile" | "categoryProfile";
      profileId: StableId;
      requestedId: StableId;
    }>
  | Readonly<{
      code: "unexpectedCategoryReference";
      source: "asset";
      profileId: StableId;
      providedCategoryProfileId: StableId;
    }>
  | Readonly<{
      code: "classificationMismatch";
      source: "category";
      field: "category" | "subtype";
      profileId: StableId;
      expectedValue: AssetCategory | AssetSubtype;
      actualValue: AssetCategory | AssetSubtype;
    }>
  | Readonly<{
      code: "lockedOverride";
      source: ProfileOverrideLevel;
      field: ProfileValueKey;
      profileId: StableId;
      inheritedValue: ProfileValue;
      attemptedValue: ProfileValue;
    }>
  | Readonly<{
      code: "missingRequiredValue";
      source: "base";
      field: "characterHeight";
      profileId: StableId;
      category: AssetCategory;
      subtype: AssetSubtype;
    }>;

export type ProfileResolutionNotice =
  | Readonly<{
      code: "redundantOverride";
      source: ProfileOverrideLevel;
      field: ProfileValueKey;
      profileId: StableId;
      value: ProfileValue;
    }>
  | Readonly<{
      code: "irrelevantOverride";
      source: ProfileOverrideLevel;
      field: "characterHeight";
      profileId: StableId;
      attemptedValue: number;
      category: AssetCategory;
      subtype: AssetSubtype;
    }>
  | Readonly<{
      code: "staleCompatibilityKey";
      source: "asset";
      profileId: StableId;
      storedKey: string;
      computedKey: string;
    }>;

export type ResolvedCategoryData = {
  [Category in AssetCategory]: Readonly<Extract<AssetCategoryData, { category: Category }>>;
}[AssetCategory];

export interface ResolvedProfile {
  readonly schemaVersion: 2;
  readonly baseProfileId: StableId;
  readonly categoryProfileId?: StableId;
  readonly assetProfileId: StableId;
  readonly name: string;
  readonly categoryData: ResolvedCategoryData;
  readonly capabilities: AssetCapabilities;
  readonly values: BaseProfileValues;
  readonly valueSources: Readonly<Partial<Record<ProfileValueKey, ProfileValueSource>>>;
  readonly normalizedOverrides: Readonly<{
    category: BaseProfileOverrides;
    asset: BaseProfileOverrides;
  }>;
  readonly compatibilityKey: string;
}

interface ProfileResolutionResultBase {
  readonly notices: readonly ProfileResolutionNotice[];
}

export interface SuccessfulProfileResolution extends ProfileResolutionResultBase {
  readonly status: "resolved";
  readonly profile: ResolvedProfile;
  readonly conflicts: readonly [];
}

export interface ConflictedProfileResolution extends ProfileResolutionResultBase {
  readonly status: "conflict";
  readonly conflicts: readonly [ProfileResolutionConflict, ...ProfileResolutionConflict[]];
  readonly partialProfile?: ResolvedProfile;
}

export type ProfileResolutionResult = SuccessfulProfileResolution | ConflictedProfileResolution;
