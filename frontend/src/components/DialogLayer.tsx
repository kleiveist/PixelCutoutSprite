import { Modal } from "../shared/dialogs";

interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
}

export function DialogLayer({ open, onClose }: DialogLayerProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Studio shortcuts"
      closeLabel="Close shortcut help"
      className="shortcut-dialog"
    >
      <span className="phase-tag">KEYBOARD</span>
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
    </Modal>
  );
}
