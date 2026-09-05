import { invoke } from "@tauri-apps/api/core";

import type {
  LabelSummary,
  ProjectCard,
  ProjectDashboardData,
  ProjectQuery,
  ProjectViewState,
} from "../domain/projects";

export interface ProjectClient {
  dashboard(sessionId: string): Promise<ProjectDashboardData>;
  saveView(sessionId: string, query: ProjectQuery): Promise<ProjectViewState>;
  createProject(sessionId: string, name: string, labelIds: string[]): Promise<ProjectCard>;
  renameProject(
    sessionId: string,
    projectId: string,
    expectedRevision: number,
    name: string,
  ): Promise<ProjectCard>;
  duplicateProject(sessionId: string, projectId: string): Promise<ProjectCard>;
  setArchived(
    sessionId: string,
    projectId: string,
    expectedRevision: number,
    archived: boolean,
  ): Promise<ProjectCard>;
  setProjectLabels(
    sessionId: string,
    projectId: string,
    expectedRevision: number,
    labelIds: string[],
  ): Promise<ProjectCard>;
  removeProject(sessionId: string, projectId: string, expectedRevision: number): Promise<void>;
  createLabel(sessionId: string, name: string, color: string): Promise<LabelSummary>;
  updateLabel(
    sessionId: string,
    labelId: string,
    expectedRevision: number,
    name: string,
    color: string,
  ): Promise<LabelSummary>;
  removeLabel(sessionId: string, labelId: string, expectedRevision: number): Promise<void>;
}

export const projectClient: ProjectClient = {
  dashboard(sessionId) {
    return invoke<ProjectDashboardData>("get_project_dashboard", { sessionId });
  },
  saveView(sessionId, query) {
    return invoke<ProjectViewState>("save_project_view_state", { sessionId, query });
  },
  createProject(sessionId, name, labelIds) {
    return invoke<ProjectCard>("create_project", { sessionId, name, labelIds });
  },
  renameProject(sessionId, projectId, expectedRevision, name) {
    return invoke<ProjectCard>("rename_project", {
      sessionId,
      projectId,
      expectedRevision,
      name,
    });
  },
  duplicateProject(sessionId, projectId) {
    return invoke<ProjectCard>("duplicate_project", { sessionId, projectId });
  },
  setArchived(sessionId, projectId, expectedRevision, archived) {
    return invoke<ProjectCard>("set_project_archived", {
      sessionId,
      projectId,
      expectedRevision,
      archived,
    });
  },
  setProjectLabels(sessionId, projectId, expectedRevision, labelIds) {
    return invoke<ProjectCard>("set_project_labels", {
      sessionId,
      projectId,
      expectedRevision,
      labelIds,
    });
  },
  removeProject(sessionId, projectId, expectedRevision) {
    return invoke<void>("remove_project", { sessionId, projectId, expectedRevision });
  },
  createLabel(sessionId, name, color) {
    return invoke<LabelSummary>("create_label", {
      sessionId,
      scope: "workspace",
      projectId: null,
      name,
      color,
    });
  },
  updateLabel(sessionId, labelId, expectedRevision, name, color) {
    return invoke<LabelSummary>("update_label", {
      sessionId,
      input: {
        scope: "workspace",
        projectId: null,
        labelId,
        expectedRevision,
        name,
        color,
      },
    });
  },
  removeLabel(sessionId, labelId, expectedRevision) {
    return invoke<void>("remove_label", {
      sessionId,
      scope: "workspace",
      projectId: null,
      labelId,
      expectedRevision,
    });
  },
};
