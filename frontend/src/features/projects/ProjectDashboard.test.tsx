import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProjectClient } from "../../api/project-client";
import type { ProjectDashboardData, ProjectQuery } from "../../domain/projects";
import { ProjectDashboard } from "./ProjectDashboard";

const data: ProjectDashboardData = {
  writable: true,
  labels: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "RPG", color: "#7ac7ff", revision: 1 },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Prototype",
      color: "#ffcc66",
      revision: 1,
    },
  ],
  projects: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      name: "My RPG",
      status: "active",
      workspace_label_ids: [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ],
      labels: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "RPG", color: "#7ac7ff", revision: 1 },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Prototype",
          color: "#ffcc66",
          revision: 1,
        },
      ],
      created_at: "2026-09-05T09:00:00Z",
      updated_at: "2026-09-05T11:00:00Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      revision: 1,
      name: "Tiny Quest",
      status: "archived",
      workspace_label_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      labels: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "RPG", color: "#7ac7ff", revision: 1 },
      ],
      created_at: "2026-09-05T08:00:00Z",
      updated_at: "2026-09-05T10:00:00Z",
    },
  ],
  view: {
    schema_version: 1,
    kind: "project_view",
    revision: 1,
    search: "",
    label_ids: [],
    label_match: "any",
    status: "any",
    sort: "updated_desc",
    updated_at: "2026-09-05T11:00:00Z",
  },
};

function mockClient(overrides: Partial<ProjectClient> = {}): ProjectClient {
  return {
    dashboard: vi.fn(async () => data),
    saveView: vi.fn(async (_sessionId: string, query: ProjectQuery) => ({
      ...data.view,
      ...query,
      revision: data.view.revision + 1,
    })),
    createProject: vi.fn(async () => data.projects[0]),
    renameProject: vi.fn(async () => data.projects[0]),
    duplicateProject: vi.fn(async () => data.projects[1]),
    setArchived: vi.fn(async () => data.projects[0]),
    setProjectLabels: vi.fn(async () => data.projects[0]),
    removeProject: vi.fn(async () => undefined),
    createLabel: vi.fn(async () => data.labels[0]),
    updateLabel: vi.fn(async () => data.labels[0]),
    removeLabel: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("ProjectDashboard", () => {
  it("loads cards and exposes every structured condition as a dropdown", async () => {
    const client = mockClient();
    render(<ProjectDashboard sessionId="session" client={client} onOpen={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My RPG/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Label match" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort" })).toBeInTheDocument();

    const labels = screen.getByRole("button", { name: /Labels Any/ });
    fireEvent.click(labels);
    const rpg = screen.getByRole("checkbox", { name: "RPG" });
    expect(rpg).toHaveFocus();
    fireEvent.click(screen.getByRole("checkbox", { name: "Prototype" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Label match" }), {
      target: { value: "all" },
    });
    expect(screen.getByRole("button", { name: /My RPG/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tiny Quest/ })).not.toBeInTheDocument();
    await waitFor(() => expect(client.saveView).toHaveBeenCalled());

    fireEvent.keyDown(rpg, { key: "Escape" });
    expect(labels).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("button", { name: /Tiny Quest/ })).toBeInTheDocument();
  });

  it("creates, opens, renames, duplicates, archives and safely removes through the client", async () => {
    const client = mockClient();
    const onOpen = vi.fn();
    render(<ProjectDashboard sessionId="session" client={client} onOpen={onOpen} />);
    await screen.findByRole("heading", { name: "Projects" });
    fireEvent.click(screen.getByRole("button", { name: /My RPG/ }));
    expect(onOpen).toHaveBeenCalledWith(data.projects[0]);

    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    const name = screen.getByRole("textbox", { name: "Project name" });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "New World" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(client.createProject).toHaveBeenCalledWith("session", "New World", []),
    );

    const actions = screen.getByRole("group", { name: "Actions for My RPG" });
    fireEvent.click(within(actions).getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(client.renameProject).toHaveBeenCalledWith(
        "session",
        data.projects[0].id,
        1,
        "Renamed",
      ),
    );

    fireEvent.click(within(actions).getByRole("button", { name: "Duplicate" }));
    await waitFor(() =>
      expect(client.duplicateProject).toHaveBeenCalledWith("session", data.projects[0].id),
    );
    fireEvent.click(within(actions).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.setArchived).toHaveBeenCalled());
    fireEvent.click(within(actions).getByRole("button", { name: "Remove…" }));
    expect(screen.getByRole("dialog", { name: /Remove My RPG/ })).toHaveTextContent(
      "not permanently deleted",
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to trash" }));
    await waitFor(() =>
      expect(client.removeProject).toHaveBeenCalledWith("session", data.projects[0].id, 1),
    );
  });

  it("manages workspace labels without deleting project cards", async () => {
    const client = mockClient();
    render(<ProjectDashboard sessionId="session" client={client} onOpen={vi.fn()} />);
    await screen.findByRole("heading", { name: "Projects" });
    fireEvent.click(screen.getByRole("button", { name: "Manage labels" }));
    const newName = screen.getByRole("textbox", { name: "New label name" });
    fireEvent.change(newName, { target: { value: "Characters" } });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    await waitFor(() =>
      expect(client.createLabel).toHaveBeenCalledWith("session", "Characters", "#e8ff68"),
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Name for RPG" }), {
      target: { value: "Role-playing" },
    });
    fireEvent.click(
      within(screen.getByRole("textbox", { name: "Name for RPG" }).closest("form")!).getByRole(
        "button",
        { name: "Save" },
      ),
    );
    await waitFor(() => expect(client.updateLabel).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Remove label Prototype" }));
    await waitFor(() => expect(client.removeLabel).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /My RPG/ })).toBeInTheDocument();
  });

  it("keeps a read-only dashboard browsable and disables mutations", async () => {
    const client = mockClient({ dashboard: vi.fn(async () => ({ ...data, writable: false })) });
    render(<ProjectDashboard sessionId="session" client={client} onOpen={vi.fn()} />);
    expect(await screen.findByText(/vault is read-only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New project/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /My RPG/ })).toBeEnabled();
  });

  it("keeps project mutation dialogs locked until their native operations settle", async () => {
    const create = deferred<(typeof data.projects)[number]>();
    const createLabel = deferred<(typeof data.labels)[number]>();
    const remove = deferred<void>();
    const client = mockClient({
      createProject: vi.fn(() => create.promise),
      createLabel: vi.fn(() => createLabel.promise),
      removeProject: vi.fn(() => remove.promise),
    });
    render(<ProjectDashboard sessionId="session" client={client} onOpen={vi.fn()} />);
    await screen.findByRole("heading", { name: "Projects" });

    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "Locked create" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    const createDialog = screen.getByRole("dialog", { name: "Create project" });
    fireEvent.keyDown(createDialog, { key: "Escape" });
    expect(createDialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel create project" })).toBeDisabled();
    await act(async () => create.resolve(data.projects[0]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Create project" })).toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage labels" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New label name" }), {
      target: { value: "Locked label" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    const labelsDialog = screen.getByRole("dialog", { name: "Manage labels" });
    fireEvent.keyDown(labelsDialog, { key: "Escape" });
    expect(labelsDialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    await act(async () => createLabel.resolve(data.labels[0]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
    fireEvent.keyDown(labelsDialog, { key: "Escape" });

    const actions = screen.getByRole("group", { name: "Actions for My RPG" });
    fireEvent.click(within(actions).getByRole("button", { name: "Remove…" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to trash" }));
    const removeDialog = screen.getByRole("dialog", { name: /Remove My RPG/ });
    fireEvent.keyDown(removeDialog, { key: "Escape" });
    expect(removeDialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
    await act(async () => remove.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Remove My RPG/ })).toBeNull());
  });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
