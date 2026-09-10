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
          <dd>Ausstehende Vault-Änderungen speichern</dd>
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
