import { useCallback, useEffect, useMemo, useState } from "react";

import "../../styles/projects.css";

import { projectClient, type ProjectClient } from "../../api/project-client";
import {
  DEFAULT_PROJECT_QUERY,
  filterProjects,
  type ProjectCard,
  type ProjectDashboardData,
  type ProjectQuery,
} from "../../domain/projects";
import { ProjectCardView } from "./ProjectCardView";
import { ConfirmRemoveDialog, LabelManagerDialog, ProjectEditorDialog } from "./ProjectDialogs";
import { ProjectFilters } from "./ProjectFilters";

interface ProjectDashboardProps {
  sessionId: string;
  client?: ProjectClient;
  onOpen: (project: ProjectCard) => void;
  onStatus?: (message: string) => void;
}

type ProjectEditor = { mode: "create" } | { mode: "rename" | "labels"; project: ProjectCard };

export function ProjectDashboard({
  sessionId,
  client = projectClient,
  onOpen,
  onStatus,
}: ProjectDashboardProps) {
  const model = useProjectDashboardModel(sessionId, client, onStatus);
  if (model.loading) {
    return (
      <p className="workspace-loading" role="status">
        Loading projects…
      </p>
    );
  }
  if (!model.data) {
    return (
      <p className="workspace-error" role="alert">
        {model.error ?? "Projects could not be loaded."}
      </p>
    );
  }
  return (
    <ReadyProjectDashboard
      sessionId={sessionId}
      client={client}
      model={{ ...model, data: model.data }}
      onOpen={onOpen}
    />
  );
}

interface ReadyProjectDashboardProps {
  sessionId: string;
  client: ProjectClient;
  model: ProjectDashboardModel & { data: ProjectDashboardData };
  onOpen: (project: ProjectCard) => void;
}

function ReadyProjectDashboard({ sessionId, client, model, onOpen }: ReadyProjectDashboardProps) {
  const [editor, setEditor] = useState<ProjectEditor | null>(null);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectCard | null>(null);
  const visibleProjects = useMemo(
    () => filterProjects(model.data.projects, model.query),
    [model.data.projects, model.query],
  );
  const writable = model.data.writable && !model.busy;

  return (
    <section className="projects-view" aria-labelledby="projects-heading">
      <DashboardHeading
        projectCount={model.data.projects.length}
        writable={writable}
        onManageLabels={() => setLabelManagerOpen(true)}
        onCreate={() => setEditor({ mode: "create" })}
      />
      {!model.data.writable && (
        <p className="read-only-notice">This vault is read-only. Projects remain browsable.</p>
      )}
      {model.error && (
        <p className="workspace-error" role="alert">
          {model.error}
        </p>
      )}
      <ProjectFilters
        labels={model.data.labels}
        query={model.query}
        onChange={model.changeQuery}
        onReset={model.resetQuery}
      />
      <ProjectList
        projects={model.data.projects}
        visibleProjects={visibleProjects}
        writable={writable}
        onOpen={onOpen}
        onCreate={() => setEditor({ mode: "create" })}
        onEdit={setEditor}
        onRemove={setRemoveTarget}
        onReset={model.resetQuery}
        onDuplicate={(project) =>
          model.mutate("Project duplicated", () => client.duplicateProject(sessionId, project.id))
        }
        onArchive={(project) =>
          model.mutate(
            project.status === "archived" ? "Project restored" : "Project archived",
            () =>
              client.setArchived(
                sessionId,
                project.id,
                project.revision,
                project.status !== "archived",
              ),
          )
        }
      />
      <DashboardDialogs
        sessionId={sessionId}
        client={client}
        model={model}
        editor={editor}
        labelManagerOpen={labelManagerOpen}
        removeTarget={removeTarget}
        closeEditor={() => setEditor(null)}
        closeLabels={() => setLabelManagerOpen(false)}
        closeRemove={() => setRemoveTarget(null)}
      />
    </section>
  );
}

interface DashboardHeadingProps {
  projectCount: number;
  writable: boolean;
  onManageLabels: () => void;
  onCreate: () => void;
}

function DashboardHeading(props: DashboardHeadingProps) {
  return (
    <header className="projects-heading">
      <div>
        <span className="phase-tag">LOCAL VAULT</span>
        <p className="view-eyebrow">Organize playable worlds</p>
        <h1 id="projects-heading">Projects</h1>
        <p>
          {props.projectCount} project{props.projectCount === 1 ? "" : "s"} in this vault.
        </p>
      </div>
      <div className="projects-heading-actions">
        <button type="button" disabled={!props.writable} onClick={props.onManageLabels}>
          Manage labels
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!props.writable}
          onClick={props.onCreate}
        >
          New project <span aria-hidden="true">＋</span>
        </button>
      </div>
    </header>
  );
}

interface ProjectListProps {
  projects: readonly ProjectCard[];
  visibleProjects: readonly ProjectCard[];
  writable: boolean;
  onOpen: (project: ProjectCard) => void;
  onCreate: () => void;
  onEdit: (editor: ProjectEditor) => void;
  onRemove: (project: ProjectCard) => void;
  onReset: () => void;
  onDuplicate: (project: ProjectCard) => Promise<boolean>;
  onArchive: (project: ProjectCard) => Promise<boolean>;
}

function ProjectList(props: ProjectListProps) {
  if (props.projects.length === 0) {
    return (
      <div className="project-empty-state">
        <strong>No projects yet</strong>
        <p>Create the first filesystem-backed project in this vault.</p>
        <button type="button" disabled={!props.writable} onClick={props.onCreate}>
          Create project
        </button>
      </div>
    );
  }
  if (props.visibleProjects.length === 0) {
    return (
      <div className="project-empty-state" role="status">
        <strong>No projects match these filters</strong>
        <button type="button" onClick={props.onReset}>
          Reset filters
        </button>
      </div>
    );
  }
  return (
    <div className="project-grid" aria-label="Projects">
      {props.visibleProjects.map((project) => (
        <ProjectCardView
          key={project.id}
          project={project}
          writable={props.writable}
          onOpen={props.onOpen}
          onRename={(value) => props.onEdit({ mode: "rename", project: value })}
          onLabels={(value) => props.onEdit({ mode: "labels", project: value })}
          onDuplicate={(value) => void props.onDuplicate(value)}
          onArchive={(value) => void props.onArchive(value)}
          onRemove={props.onRemove}
        />
      ))}
    </div>
  );
}

interface DashboardDialogsProps {
  sessionId: string;
  client: ProjectClient;
  model: ProjectDashboardModel & { data: ProjectDashboardData };
  editor: ProjectEditor | null;
  labelManagerOpen: boolean;
  removeTarget: ProjectCard | null;
  closeEditor: () => void;
  closeLabels: () => void;
  closeRemove: () => void;
}

function DashboardDialogs(props: DashboardDialogsProps) {
  const { client, model, sessionId } = props;
  return (
    <>
      {props.editor && (
        <ProjectEditorDialog
          mode={props.editor.mode}
          project={"project" in props.editor ? props.editor.project : undefined}
          labels={model.data.labels}
          onCancel={props.closeEditor}
          onSubmit={(name, labelIds) =>
            void submitProjectEditor(
              props.editor!,
              name,
              labelIds,
              model,
              client,
              sessionId,
              props.closeEditor,
            )
          }
        />
      )}
      {props.labelManagerOpen && (
        <LabelManagerDialog
          labels={model.data.labels}
          onClose={props.closeLabels}
          onCreate={(name, color) =>
            void model.mutate("Label created", () => client.createLabel(sessionId, name, color))
          }
          onUpdate={(label, name, color) =>
            void model.mutate("Label updated", () =>
              client.updateLabel(sessionId, label.id, label.revision, name, color),
            )
          }
          onRemove={(label) =>
            void model.mutate("Label removed; projects retained", () =>
              client.removeLabel(sessionId, label.id, label.revision),
            )
          }
        />
      )}
      {props.removeTarget && (
        <ConfirmRemoveDialog
          project={props.removeTarget}
          onCancel={props.closeRemove}
          onConfirm={() =>
            void model.mutate(
              "Project moved to vault trash",
              () =>
                client.removeProject(
                  sessionId,
                  props.removeTarget!.id,
                  props.removeTarget!.revision,
                ),
              props.closeRemove,
            )
          }
        />
      )}
    </>
  );
}

function useProjectDashboardModel(
  sessionId: string,
  client: ProjectClient,
  onStatus?: (message: string) => void,
) {
  const [data, setData] = useState<ProjectDashboardData | null>(null);
  const [query, setQuery] = useState<ProjectQuery>(DEFAULT_PROJECT_QUERY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await client.dashboard(sessionId);
    setData(result);
    setQuery({
      search: result.view.search,
      label_ids: result.view.label_ids,
      label_match: result.view.label_match,
      status: result.view.status,
      sort: result.view.sort,
    });
  }, [client, sessionId]);

  useEffect(() => {
    let live = true;
    void reload()
      .catch((reason: unknown) => {
        if (live) setError(message(reason));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [reload]);

  const mutate = useCallback(
    async (success: string, operation: () => Promise<unknown>, after?: () => void) => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        await reload();
        after?.();
        onStatus?.(success);
        return true;
      } catch (reason) {
        setError(message(reason));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onStatus, reload],
  );

  const changeQuery = useCallback(
    (next: ProjectQuery) => {
      setQuery(next);
      if (data?.writable) {
        void client.saveView(sessionId, next).catch((reason: unknown) => setError(message(reason)));
      }
    },
    [client, data?.writable, sessionId],
  );
  const resetQuery = useCallback(() => changeQuery({ ...DEFAULT_PROJECT_QUERY }), [changeQuery]);
  return { data, query, loading, busy, error, mutate, changeQuery, resetQuery };
}

type ProjectDashboardModel = ReturnType<typeof useProjectDashboardModel>;

async function submitProjectEditor(
  editor: ProjectEditor,
  name: string,
  labelIds: string[],
  model: ReturnType<typeof useProjectDashboardModel>,
  client: ProjectClient,
  sessionId: string,
  close: () => void,
): Promise<void> {
  if (editor.mode === "create") {
    await model.mutate(
      "Project created",
      () => client.createProject(sessionId, name, labelIds),
      close,
    );
  } else if (editor.mode === "rename") {
    await model.mutate(
      "Project renamed",
      () => client.renameProject(sessionId, editor.project.id, editor.project.revision, name),
      close,
    );
  } else {
    await model.mutate(
      "Project labels updated",
      () =>
        client.setProjectLabels(sessionId, editor.project.id, editor.project.revision, labelIds),
      close,
    );
  }
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
