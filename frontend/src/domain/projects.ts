import type { UUID, UtcTimestamp } from "./common";

export interface LabelSummary {
  id: UUID;
  name: string;
  color: string;
  revision: number;
}

export interface ProjectCard {
  id: UUID;
  revision: number;
  name: string;
  status: "active" | "archived";
  labels: LabelSummary[];
  workspace_label_ids: UUID[];
  created_at: UtcTimestamp;
  updated_at: UtcTimestamp;
}

export type LabelMatch = "any" | "all";
export type ProjectStatusFilter = "any" | "active" | "archived";
export type ProjectSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

export interface ProjectQuery {
  search: string;
  label_ids: UUID[];
  label_match: LabelMatch;
  status: ProjectStatusFilter;
  sort: ProjectSort;
}

export interface ProjectViewState extends ProjectQuery {
  schema_version: 1;
  kind: "project_view";
  revision: number;
  updated_at: UtcTimestamp;
}

export interface ProjectDashboardData {
  projects: ProjectCard[];
  labels: LabelSummary[];
  view: ProjectViewState;
  writable: boolean;
}

export const DEFAULT_PROJECT_QUERY: ProjectQuery = {
  search: "",
  label_ids: [],
  label_match: "any",
  status: "any",
  sort: "updated_desc",
};

function normalized(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase();
}

export function filterProjects(
  projects: readonly ProjectCard[],
  query: ProjectQuery,
): ProjectCard[] {
  const search = normalized(query.search.trim());
  const filtered = projects.filter((project) => {
    const matchesSearch = search.length === 0 || normalized(project.name).includes(search);
    const matchesStatus = query.status === "any" || project.status === query.status;
    const matchesLabels =
      query.label_ids.length === 0 ||
      (query.label_match === "all"
        ? query.label_ids.every((id) => project.workspace_label_ids.includes(id))
        : query.label_ids.some((id) => project.workspace_label_ids.includes(id)));
    return matchesSearch && matchesStatus && matchesLabels;
  });

  return [...filtered].sort((left, right) => {
    if (query.sort === "name_asc" || query.sort === "name_desc") {
      const order = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      return query.sort === "name_asc" ? order : -order;
    }
    const order = left.updated_at.localeCompare(right.updated_at);
    return query.sort === "updated_asc" ? order : -order;
  });
}

export function projectQueryIsDefault(query: ProjectQuery): boolean {
  return (
    query.search === "" &&
    query.label_ids.length === 0 &&
    query.label_match === "any" &&
    query.status === "any" &&
    query.sort === "updated_desc"
  );
}
