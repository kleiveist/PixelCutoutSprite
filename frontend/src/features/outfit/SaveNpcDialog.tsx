import { useRef, useState, type FormEvent } from "react";

import type { OutfitEditorContext, SaveNpcRequest } from "../../api/outfit-client";
import { useModalFocus } from "../../components/useModalFocus";
import { messageOf, toggleSet } from "./outfit-utils";

interface SaveNpcDialogProps {
  labels: OutfitEditorContext["available_labels"];
  busy: boolean;
  onCancel: () => void;
  onSave: (request: SaveNpcRequest) => Promise<void>;
}

export function SaveNpcDialog({ labels, busy, onCancel, onSave }: SaveNpcDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locked = busy || submitting;
  const nameInput = useRef<HTMLInputElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLFormElement>({
    canDismiss: !locked,
    initialFocus: nameInput,
    onEscape: onCancel,
  });

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSave({ name, description, label_ids: [...selectedLabels] });
    } catch (reason) {
      setError(messageOf(reason));
      setSubmitting(false);
    }
  }

  return (
    <div className="outfit-dialog-backdrop">
      <form
        ref={dialogRef}
        className="outfit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-npc-title"
        onKeyDown={onDialogKeyDown}
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="save-npc-title">Save outfit as NPC</h2>
        <label>
          Name
          <input
            ref={nameInput}
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Project labels</legend>
          {labels.length === 0 ? (
            <p>No project labels available.</p>
          ) : (
            labels.map((label) => (
              <label key={label.id}>
                <input
                  type="checkbox"
                  checked={selectedLabels.has(label.id)}
                  onChange={() => setSelectedLabels(toggleSet(selectedLabels, label.id))}
                />
                <span className="outfit-label-color" style={{ background: label.color }} />
                {label.name}
              </label>
            ))
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div>
          <button type="button" disabled={locked} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={locked || name.trim() !== name || !name}
          >
            Create NPC
          </button>
        </div>
      </form>
    </div>
  );
}
