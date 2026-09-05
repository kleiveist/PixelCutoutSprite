import type { CSSProperties } from "react";

import type { ProjectCard } from "../../domain/projects";

interface ProjectCardViewProps {
  project: ProjectCard;
  writable: boolean;
  onOpen: (project: ProjectCard) => void;
  onRename: (project: ProjectCard) => void;
  onLabels: (project: ProjectCard) => void;
  onDuplicate: (project: ProjectCard) => void;
  onArchive: (project: ProjectCard) => void;
  onRemove: (project: ProjectCard) => void;
}

function changedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

export function ProjectCardView({
  project,
  writable,
  onOpen,
  onRename,
  onLabels,
  onDuplicate,
  onArchive,
  onRemove,
}: ProjectCardViewProps) {
  return (
    <article className="project-card" data-status={project.status}>
      <button className="project-card-open" type="button" onClick={() => onOpen(project)}>
        <span className="project-card-status">{project.status}</span>
        <strong>{project.name}</strong>
        <span className="project-card-date">Changed {changedAt(project.updated_at)}</span>
        <span className="project-card-labels" aria-label="Labels">
          {project.labels.length === 0 ? (
            <span className="label-empty">No labels</span>
          ) : (
            project.labels.map((label) => (
              <span
                className="label-chip"
                key={label.id}
                style={{ "--label-color": label.color } as CSSProperties}
              >
                {label.name}
              </span>
            ))
          )}
        </span>
      </button>
      <div className="project-card-actions" role="group" aria-label={`Actions for ${project.name}`}>
        <button type="button" disabled={!writable} onClick={() => onRename(project)}>
          Rename
        </button>
        <button type="button" disabled={!writable} onClick={() => onLabels(project)}>
          Labels
        </button>
        <button type="button" disabled={!writable} onClick={() => onDuplicate(project)}>
          Duplicate
        </button>
        <button type="button" disabled={!writable} onClick={() => onArchive(project)}>
          {project.status === "archived" ? "Restore" : "Archive"}
        </button>
        <button type="button" disabled={!writable} onClick={() => onRemove(project)}>
          Remove…
        </button>
      </div>
    </article>
  );
}
