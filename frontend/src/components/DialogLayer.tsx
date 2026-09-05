import { useRef } from "react";

import { useModalFocus } from "./useModalFocus";

interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
}

export function DialogLayer({ open, onClose }: DialogLayerProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLElement>({
    initialFocus: closeButton,
    onEscape: onClose,
    open,
  });

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        aria-labelledby="shortcut-title"
        aria-modal="true"
        className="shortcut-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
      >
        <div className="dialog-heading">
          <div>
            <span className="phase-tag">KEYBOARD</span>
            <h2 id="shortcut-title">Studio shortcuts</h2>
          </div>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close shortcut help"
          >
            ×
          </button>
        </div>
        <dl className="shortcut-list">
          <div>
            <dt>
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
            </dt>
            <dd>Save current work</dd>
          </div>
          <div>
            <dt>
              <kbd>Ctrl</kbd> + <kbd>Z</kbd>
            </dt>
            <dd>Undo last editor command</dd>
          </div>
          <div>
            <dt>
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
            </dt>
            <dd>Redo command</dd>
          </div>
          <div>
            <dt>
              <kbd>Space</kbd>
            </dt>
            <dd>Toggle preview playback</dd>
          </div>
          <div>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>Close the active dialog</dd>
          </div>
        </dl>
        <p className="dialog-note">Editor shortcuts stay inactive while you type in a field.</p>
      </section>
    </div>
  );
}
