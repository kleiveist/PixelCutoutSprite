import { useEffect, useRef, useState, type FormEvent } from "react";

import { MultiSelectFilter } from "../../components/DropdownFilter";
import type { LabelSummary, ProjectCard } from "../../domain/projects";

interface ProjectEditorDialogProps {
  mode: "create" | "rename" | "labels";
  project?: ProjectCard;
  labels: readonly LabelSummary[];
  onCancel: () => void;
  onSubmit: (name: string, labelIds: string[]) => void;
}

export function ProjectEditorDialog({
  mode,
  project,
  labels,
  onCancel,
  onSubmit,
}: ProjectEditorDialogProps) {
  useRestoreFocus();
  const [name, setName] = useState(project?.name ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(project?.workspace_label_ids ?? []);
  const title =
    mode === "create" ? "Create project" : mode === "rename" ? "Rename project" : "Project labels";

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit(name.trim(), labelIds);
  }

  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <form onSubmit={submit}>
          <div className="dialog-heading">
            <div>
              <span className="phase-tag">WORKSPACE</span>
              <h2 id="project-dialog-title">{title}</h2>
            </div>
            <button type="button" aria-label={`Cancel ${title.toLowerCase()}`} onClick={onCancel}>
              ×
            </button>
          </div>
          {mode !== "labels" && (
            <label className="dialog-field">
              <span>Project name</span>
              <input
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          {mode !== "rename" && (
            <MultiSelectFilter
              autoFocus={mode === "labels"}
              label="Workspace labels"
              values={labelIds}
              options={labels.map((label) => ({ value: label.id, label: label.name }))}
              onChange={setLabelIds}
            />
          )}
          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={mode !== "labels" && name.trim().length === 0}
            >
              {mode === "create" ? "Create project" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface LabelManagerDialogProps {
  labels: readonly LabelSummary[];
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (label: LabelSummary, name: string, color: string) => void;
  onRemove: (label: LabelSummary) => void;
}

export function LabelManagerDialog({
  labels,
  onClose,
  onCreate,
  onUpdate,
  onRemove,
}: LabelManagerDialogProps) {
  useRestoreFocus();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#e8ff68");

  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="workspace-dialog label-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="phase-tag">WORKSPACE LABELS</span>
            <h2 id="label-dialog-title">Manage labels</h2>
          </div>
          <button type="button" aria-label="Close label manager" onClick={onClose}>
            ×
          </button>
        </div>
        <form
          className="new-label-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(name.trim(), color);
            setName("");
          }}
        >
          <label className="dialog-field">
            <span>New label name</span>
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="color-field">
            <span>Color</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
          <button type="submit" disabled={name.trim().length === 0}>
            Add label
          </button>
        </form>
        <div className="label-editor-list">
          {labels.length === 0 ? (
            <p className="muted-copy">No workspace labels yet.</p>
          ) : (
            labels.map((label) => (
              <LabelEditorRow
                key={label.id}
                label={label}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

interface LabelEditorRowProps {
  label: LabelSummary;
  onUpdate: (label: LabelSummary, name: string, color: string) => void;
  onRemove: (label: LabelSummary) => void;
}

function LabelEditorRow({ label, onUpdate, onRemove }: LabelEditorRowProps) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  return (
    <form
      className="label-editor-row"
      onSubmit={(event) => {
        event.preventDefault();
        onUpdate(label, name.trim(), color);
      }}
    >
      <input
        aria-label={`Name for ${label.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Color for ${label.name}`}
        type="color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
      />
      <button type="submit" disabled={name.trim().length === 0}>
        Save
      </button>
      <button
        type="button"
        aria-label={`Remove label ${label.name}`}
        onClick={() => onRemove(label)}
      >
        Remove
      </button>
    </form>
  );
}

interface ConfirmRemoveDialogProps {
  project: ProjectCard;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmRemoveDialog({ project, onCancel, onConfirm }: ConfirmRemoveDialogProps) {
  useRestoreFocus();
  return (
    <div className="modal-scrim" role="presentation">
      <section
        className="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <span className="phase-tag">CONTROLLED REMOVE</span>
        <h2 id="remove-dialog-title">Remove {project.name}?</h2>
        <p>The project is moved into this vault’s trash. Its files are not permanently deleted.</p>
        <div className="dialog-actions">
          <button autoFocus type="button" onClick={onCancel}>
            Keep project
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            Move to trash
          </button>
        </div>
      </section>
    </div>
  );
}

function useRestoreFocus(): void {
  const previous = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(
    () => () => {
      previous.current?.focus();
    },
    [],
  );
}
