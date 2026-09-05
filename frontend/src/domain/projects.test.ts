import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_QUERY,
  filterProjects,
  projectQueryIsDefault,
  type ProjectCard,
} from "./projects";

const projects: ProjectCard[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    revision: 1,
    name: "My RPG",
    status: "active",
    workspace_label_ids: [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ],
    labels: [],
    created_at: "2026-09-05T09:00:00Z",
    updated_at: "2026-09-05T11:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    revision: 1,
    name: "Tiny Quest",
    status: "archived",
    workspace_label_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    labels: [],
    created_at: "2026-09-05T08:00:00Z",
    updated_at: "2026-09-05T10:00:00Z",
  },
];

describe("project filter semantics", () => {
  it("combines different fields with AND and supports any/all label matching", () => {
    const any = filterProjects(projects, {
      ...DEFAULT_PROJECT_QUERY,
      label_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      label_match: "any",
    });
    expect(any).toHaveLength(2);

    const allActive = filterProjects(projects, {
      ...DEFAULT_PROJECT_QUERY,
      search: "rpg",
      label_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      label_match: "all",
      status: "active",
    });
    expect(allActive.map((project) => project.name)).toEqual(["My RPG"]);
  });

  it("treats an empty label selection as unrestricted and sorts deterministically", () => {
    expect(
      filterProjects(projects, { ...DEFAULT_PROJECT_QUERY, sort: "name_asc" }).map(
        (project) => project.name,
      ),
    ).toEqual(["My RPG", "Tiny Quest"]);
    expect(projectQueryIsDefault(DEFAULT_PROJECT_QUERY)).toBe(true);
  });
});
