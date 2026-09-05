import type { AreaCard } from "../../domain/areas";

export type AreaSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

export interface AreaFilters {
  objectType: "any" | AreaCard["object_type"];
  profile: string;
  referenceHeight: string;
  labelIds: string[];
  labelMatch: "any" | "all";
  sort: AreaSort;
}

export const emptyAreaFilters = (): AreaFilters => ({
  objectType: "any",
  profile: "any",
  referenceHeight: "any",
  labelIds: [],
  labelMatch: "any",
  sort: "updated_desc",
});

export function profileRevisionKey(card: Pick<AreaCard, "profile_ref">): string {
  return `${card.profile_ref.id}@${card.profile_ref.revision}`;
}

export function filterAreaCards(cards: readonly AreaCard[], filters: AreaFilters): AreaCard[] {
  const result = cards.filter((card) => {
    const labelsMatch =
      filters.labelIds.length === 0 ||
      (filters.labelMatch === "all"
        ? filters.labelIds.every((id) => card.label_ids.includes(id))
        : filters.labelIds.some((id) => card.label_ids.includes(id)));
    return (
      (filters.objectType === "any" || card.object_type === filters.objectType) &&
      (filters.profile === "any" || profileRevisionKey(card) === filters.profile) &&
      (filters.referenceHeight === "any" ||
        card.reference_height_px === Number(filters.referenceHeight)) &&
      labelsMatch
    );
  });
  result.sort((left, right) => {
    switch (filters.sort) {
      case "updated_asc":
        return left.updated_at.localeCompare(right.updated_at) || left.id.localeCompare(right.id);
      case "name_asc":
        return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      case "name_desc":
        return right.name.localeCompare(left.name) || left.id.localeCompare(right.id);
      default:
        return right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id);
    }
  });
  return result;
}
