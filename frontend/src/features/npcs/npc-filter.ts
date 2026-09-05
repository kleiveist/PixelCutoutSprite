import type { CharacterStatus } from "../../domain";
import type { NpcCompleteness, NpcExportStatus, NpcView } from "../../api/npc-client";

export interface NpcFilter {
  query: string;
  label: string;
  completeness: "all" | NpcCompleteness;
  action: string;
  exportStatus: "all" | NpcExportStatus;
  characterStatus: "all" | CharacterStatus;
  sort: "name" | "updated" | "missing" | "export";
}

export const emptyNpcFilter = (): NpcFilter => ({
  query: "",
  label: "all",
  completeness: "all",
  action: "all",
  exportStatus: "all",
  characterStatus: "all",
  sort: "name",
});

export function filterNpcs(npcs: readonly NpcView[], filter: NpcFilter): NpcView[] {
  const query = filter.query.trim().toLocaleLowerCase();
  const visible = npcs.filter(
    (npc) =>
      (!query || npc.character.name.toLocaleLowerCase().includes(query)) &&
      (filter.label === "all" || npc.labels.some((label) => label.id === filter.label)) &&
      (filter.completeness === "all" || npc.completeness === filter.completeness) &&
      (filter.action === "all" ||
        npc.character.required_actions.includes(filter.action) ||
        npc.bindings.some((view) => view.binding.action_key === filter.action)) &&
      (filter.exportStatus === "all" || npc.export_status === filter.exportStatus) &&
      (filter.characterStatus === "all" || npc.character.status === filter.characterStatus),
  );
  return visible.sort(sorter(filter.sort));
}

function sorter(sort: NpcFilter["sort"]): (left: NpcView, right: NpcView) => number {
  return (left, right) => {
    if (sort === "updated") {
      return right.character.updated_at.localeCompare(left.character.updated_at);
    }
    if (sort === "missing") {
      return (
        right.missing_actions.length - left.missing_actions.length || compareNames(left, right)
      );
    }
    if (sort === "export") {
      return (
        exportRank(left.export_status) - exportRank(right.export_status) ||
        compareNames(left, right)
      );
    }
    return compareNames(left, right);
  };
}

function compareNames(left: NpcView, right: NpcView): number {
  return (
    left.character.name.localeCompare(right.character.name) ||
    left.character.id.localeCompare(right.character.id)
  );
}

function exportRank(status: NpcExportStatus): number {
  return { stale: 0, not_exported: 1, current: 2 }[status];
}
