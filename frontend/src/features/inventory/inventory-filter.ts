import type { AssetKind } from "../../domain/assets";
import type { Direction } from "../../domain/common";

export interface InventoryItem {
  id: string;
  revision: number;
  thumbnailRevision: number;
  name: string;
  slotId: string;
  direction: Direction;
  kind: AssetKind;
  profile: string;
  labels: string[];
  usageCount: number;
  usageDescriptions: string[];
  thumbnailUrl?: string;
  archived: boolean;
}

export interface InventoryFilter {
  query: string;
  slot: string;
  direction: "all" | Direction;
  kind: "all" | AssetKind;
  profile: string;
  label: string;
  usage: "all" | "used" | "unused";
  sort: "name_asc" | "name_desc" | "updated_newest" | "updated_oldest";
}

export const emptyInventoryFilter = (): InventoryFilter => ({
  query: "",
  slot: "all",
  direction: "all",
  kind: "all",
  profile: "all",
  label: "all",
  usage: "all",
  sort: "name_asc",
});

export function filterInventory(
  items: readonly InventoryItem[],
  filter: InventoryFilter,
): InventoryItem[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (!query || item.name.toLocaleLowerCase().includes(query)) &&
      (filter.slot === "all" || item.slotId === filter.slot) &&
      (filter.direction === "all" || item.direction === filter.direction) &&
      (filter.kind === "all" || item.kind === filter.kind) &&
      (filter.profile === "all" || item.profile === filter.profile) &&
      (filter.label === "all" || item.labels.includes(filter.label)) &&
      (filter.usage === "all" ||
        (filter.usage === "used" ? item.usageCount > 0 : item.usageCount === 0)),
  );
}
