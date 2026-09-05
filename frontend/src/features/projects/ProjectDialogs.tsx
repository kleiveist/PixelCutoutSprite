import { useRef, useState, type FormEvent } from "react";

import { MultiSelectFilter } from "../../components/DropdownFilter";
import { useModalFocus } from "../../components/useModalFocus";
import type { LabelSummary, ProjectCard } from "../../domain/projects";

interface ProjectEditorDialogProps {
  busy?: boolean;
  mode: "create" | "rename" | "labels";
  project?: ProjectCard;
  labels: readonly LabelSummary[];
  onCancel: () => void;
  onSubmit: (name: string, labelIds: string[]) => void;
}

export function ProjectEditorDialog({
  busy = false,
  mode,
  project,
  labels,
  onCancel,
  onSubmit,
}: ProjectEditorDialogProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(project?.workspace_label_ids ?? []);
  const nameInput = useRef<HTMLInputElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLElement>({
    canDismiss: !busy,
    initialFocus: mode === "labels" ? undefined : nameInput,
    onEscape: onCancel,
  });
  const title =
    mode === "create" ? "Create project" : mode === "rename" ? "Rename project" : "Project labels";

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit(name.trim(), labelIds);
  }

  return (
    <div className="modal-scrim" role="presentation">
      <section
        ref={dialogRef}
        className="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onKeyDown={onDialogKeyDown}
      >
        <form onSubmit={submit}>
          <div className="dialog-heading">
            <div>
              <span className="phase-tag">WORKSPACE</span>
              <h2 id="project-dialog-title">{title}</h2>
            </div>
            <button
              type="button"
              aria-label={`Cancel ${title.toLowerCase()}`}
              disabled={busy}
              onClick={onCancel}
            >
              ×
            </button>
          </div>
          {mode !== "labels" && (
            <label className="dialog-field">
              <span>Project name</span>
              <input
                ref={nameInput}
                disabled={busy}
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
              disabled={busy}
              label="Workspace labels"
              values={labelIds}
              options={labels.map((label) => ({ value: label.id, label: label.name }))}
              onChange={setLabelIds}
            />
          )}
          <div className="dialog-actions">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || (mode !== "labels" && name.trim().length === 0)}
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
  busy?: boolean;
  labels: readonly LabelSummary[];
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (label: LabelSummary, name: string, color: string) => void;
  onRemove: (label: LabelSummary) => void;
}

export function LabelManagerDialog({
  busy = false,
  labels,
  onClose,
  onCreate,
  onUpdate,
  onRemove,
}: LabelManagerDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#e8ff68");
  const nameInput = useRef<HTMLInputElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLElement>({
    canDismiss: !busy,
    initialFocus: nameInput,
    onEscape: onClose,
  });

  return (
    <div className="modal-scrim" role="presentation">
      <section
        ref={dialogRef}
        className="workspace-dialog label-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-dialog-title"
        onKeyDown={onDialogKeyDown}
      >
        <div className="dialog-heading">
          <div>
            <span className="phase-tag">WORKSPACE LABELS</span>
            <h2 id="label-dialog-title">Manage labels</h2>
          </div>
          <button type="button" aria-label="Close label manager" disabled={busy} onClick={onClose}>
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
              ref={nameInput}
              disabled={busy}
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="color-field">
            <span>Color</span>
            <input
              type="color"
              disabled={busy}
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || name.trim().length === 0}>
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
                busy={busy}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

interface LabelEditorRowProps {
  busy: boolean;
  label: LabelSummary;
  onUpdate: (label: LabelSummary, name: string, color: string) => void;
  onRemove: (label: LabelSummary) => void;
}

function LabelEditorRow({ busy, label, onUpdate, onRemove }: LabelEditorRowProps) {
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
        disabled={busy}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Color for ${label.name}`}
        disabled={busy}
        type="color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
      />
      <button type="submit" disabled={busy || name.trim().length === 0}>
        Save
      </button>
      <button
        type="button"
        aria-label={`Remove label ${label.name}`}
        disabled={busy}
        onClick={() => onRemove(label)}
      >
        Remove
      </button>
    </form>
  );
}

interface ConfirmRemoveDialogProps {
  busy?: boolean;
  project: ProjectCard;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmRemoveDialog({
  busy = false,
  project,
  onCancel,
  onConfirm,
}: ConfirmRemoveDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLElement>({
    canDismiss: !busy,
    initialFocus: cancelButton,
    onEscape: onCancel,
  });
  return (
    <div className="modal-scrim" role="presentation">
      <section
        ref={dialogRef}
        className="workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-dialog-title"
        onKeyDown={onDialogKeyDown}
      >
        <span className="phase-tag">CONTROLLED REMOVE</span>
        <h2 id="remove-dialog-title">Remove {project.name}?</h2>
        <p>The project is moved into this vault’s trash. Its files are not permanently deleted.</p>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" disabled={busy} onClick={onCancel}>
            Keep project
          </button>
          <button className="danger-button" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "Moving…" : "Move to trash"}
          </button>
        </div>
      </section>
    </div>
  );
}
