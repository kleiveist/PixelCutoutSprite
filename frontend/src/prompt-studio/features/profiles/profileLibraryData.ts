import { ASSET_CATEGORY_IDS, type AssetCategory } from "../../domain/assets";
import type { AssetProfile, BaseProfile, ProfileLibrary, StableId } from "../../schemas";
import type { StorageReadResult } from "../../services";
import type { ProfileLibraryFilters } from "../../store/profiles";
import {
  compareUpdatedAtThenId,
  resolveProfileSummary,
  type DashboardProfileSummary,
} from "../dashboard/dashboardData";
import { getDashboardCategory } from "../dashboard/dashboardCatalog";

export type ProfileLibraryCollectionStatus = "ready" | "empty" | "invalid" | "unavailable";

export interface ProfileLibraryBaseOption {
  readonly id: StableId;
  readonly name: string;
  readonly profileCount: number;
}

export interface ProfileLibraryProfileOption {
  readonly id: StableId;
  readonly name: string;
  readonly categoryLabel: string;
  readonly subtypeLabel: string;
}

export interface ProfileLibraryGroup {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly profiles: readonly DashboardProfileSummary[];
}

export interface ProfileLibraryData {
  readonly collectionStatus: ProfileLibraryCollectionStatus;
  readonly totalProfileCount: number;
  readonly visibleProfileCount: number;
  readonly skippedProfileCount: number;
  readonly profileOptions: readonly ProfileLibraryProfileOption[];
  readonly baseOptions: readonly ProfileLibraryBaseOption[];
  readonly groups: readonly ProfileLibraryGroup[];
}

interface ResolvedLibraryEntry {
  readonly summary: DashboardProfileSummary;
}

const MAX_COMPATIBILITY_BASE_NAMES = 2;

function compareNames(
  left: Readonly<{ name: string; id: StableId }>,
  right: Readonly<{ name: string; id: StableId }>,
): number {
  const byName = left.name.localeCompare(right.name, "de", {
    sensitivity: "base",
  });
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

function baseOptions(
  baseProfiles: readonly BaseProfile[],
  assetProfiles: readonly AssetProfile[],
): readonly ProfileLibraryBaseOption[] {
  const counts = new Map<StableId, number>();
  for (const profile of assetProfiles) {
    counts.set(profile.baseProfileId, (counts.get(profile.baseProfileId) ?? 0) + 1);
  }

  return baseProfiles
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      profileCount: counts.get(profile.id) ?? 0,
    }))
    .sort(compareNames);
}

function visibleEntries(
  entries: readonly ResolvedLibraryEntry[],
  filters: ProfileLibraryFilters,
): readonly ResolvedLibraryEntry[] {
  return entries.filter(
    (entry) =>
      (filters.profileId === null || entry.summary.id === filters.profileId) &&
      (filters.category === null || entry.summary.category === filters.category) &&
      (filters.baseProfileId === null || entry.summary.baseProfileId === filters.baseProfileId) &&
      (!filters.favoritesOnly || entry.summary.favorite),
  );
}

function profileOptions(
  entries: readonly ResolvedLibraryEntry[],
): readonly ProfileLibraryProfileOption[] {
  return entries
    .map(({ summary }) => ({
      id: summary.id,
      name: summary.name,
      categoryLabel: summary.categoryLabel,
      subtypeLabel: summary.subtypeLabel,
    }))
    .sort(compareNames);
}

function categoryGroups(entries: readonly ResolvedLibraryEntry[]): readonly ProfileLibraryGroup[] {
  return ASSET_CATEGORY_IDS.flatMap((category) => {
    const profiles = entries
      .filter((entry) => entry.summary.category === category)
      .map((entry) => entry.summary)
      .sort(compareUpdatedAtThenId);
    if (profiles.length === 0) return [];

    const definition = getDashboardCategory(category);
    return [
      {
        id: `category-${category}`,
        label: definition.label,
        description: `${profiles.length} ${profiles.length === 1 ? "Profil" : "Profile"} in dieser Asset-Kategorie.`,
        profiles,
      },
    ];
  });
}

function compatibilityGroups(
  entries: readonly ResolvedLibraryEntry[],
): readonly ProfileLibraryGroup[] {
  const byCompatibility = new Map<string, ResolvedLibraryEntry[]>();
  for (const entry of entries) {
    const group = byCompatibility.get(entry.summary.compatibilityKey) ?? [];
    group.push(entry);
    byCompatibility.set(entry.summary.compatibilityKey, group);
  }

  const sortedGroups = [...byCompatibility.entries()]
    .map(([compatibilityKey, groupEntries]) => ({
      compatibilityKey,
      entries: [...groupEntries].sort((left, right) =>
        compareUpdatedAtThenId(left.summary, right.summary),
      ),
    }))
    .sort((left, right) => {
      const newestLeft = left.entries[0]?.summary;
      const newestRight = right.entries[0]?.summary;
      if (newestLeft && newestRight) {
        const byRecency = compareUpdatedAtThenId(newestLeft, newestRight);
        if (byRecency !== 0) return byRecency;
      }
      return left.compatibilityKey.localeCompare(right.compatibilityKey);
    });

  return sortedGroups.map((group, index) => {
    const profiles = group.entries.map((entry) => entry.summary);
    const baseNames = [...new Set(profiles.map((profile) => profile.baseProfileName))].sort(
      (left, right) => left.localeCompare(right, "de", { sensitivity: "base" }),
    );
    const visibleBaseNames = baseNames.slice(0, MAX_COMPATIBILITY_BASE_NAMES);
    const remainingBaseCount = baseNames.length - visibleBaseNames.length;
    const baseDescription = `${visibleBaseNames.join(", ")}${
      remainingBaseCount > 0 ? ` + ${remainingBaseCount} weitere` : ""
    }`;
    return {
      id: group.compatibilityKey,
      label: `Kompatibilitätsgruppe ${index + 1}`,
      description: `${profiles.length} ${profiles.length === 1 ? "Profil" : "Profile"} · Basis: ${baseDescription}`,
      profiles,
    };
  });
}

function collectionStatus(
  result: StorageReadResult<ProfileLibrary>,
): ProfileLibraryCollectionStatus {
  if (result.status !== "valid") return result.status;
  return result.value.assetProfiles.length === 0 ? "empty" : "ready";
}

export function createProfileLibraryData(
  result: StorageReadResult<ProfileLibrary>,
  filters: ProfileLibraryFilters,
): ProfileLibraryData {
  if (result.status !== "valid") {
    return {
      collectionStatus: collectionStatus(result),
      totalProfileCount: 0,
      visibleProfileCount: 0,
      skippedProfileCount: 0,
      profileOptions: [],
      baseOptions: [],
      groups: [],
    };
  }

  const entries = result.value.assetProfiles
    .map((profile) => {
      const summary = resolveProfileSummary(profile, result.value);
      return summary
        ? {
            summary: { ...summary, tags: profile.tags },
          }
        : null;
    })
    .filter((entry): entry is ResolvedLibraryEntry => entry !== null);
  const filteredEntries = visibleEntries(entries, filters);

  return {
    collectionStatus: collectionStatus(result),
    totalProfileCount: result.value.assetProfiles.length,
    visibleProfileCount: filteredEntries.length,
    skippedProfileCount: result.value.assetProfiles.length - entries.length,
    profileOptions: profileOptions(entries),
    baseOptions: baseOptions(result.value.baseProfiles, result.value.assetProfiles),
    groups:
      filters.groupBy === "compatibility"
        ? compatibilityGroups(filteredEntries)
        : categoryGroups(filteredEntries),
  };
}

export function categoryFilterLabel(category: AssetCategory): string {
  return getDashboardCategory(category).label;
}
