import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useModalFocus } from "./useModalFocus";

export interface ModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly closeLabel?: string;
  readonly descriptionId?: string;
  readonly className?: string;
  readonly canDismiss?: boolean;
}

interface InertSnapshot {
  readonly element: HTMLElement;
  readonly inert: boolean;
  readonly ariaHidden: string | null;
}

function makeBackgroundInert(): () => void {
  const snapshots = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-background]"))
    .filter((element) => !element.closest("[data-modal-host]"))
    .map((element): InertSnapshot => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
  for (const snapshot of snapshots) {
    snapshot.element.inert = true;
    snapshot.element.setAttribute("aria-hidden", "true");
  }
  return () => {
    for (const snapshot of snapshots) {
      snapshot.element.inert = snapshot.inert;
      if (snapshot.ariaHidden === null) snapshot.element.removeAttribute("aria-hidden");
      else snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
    }
  };
}

/** Shared modal behavior: focus trap, return focus, Escape and genuine backdrop click. */
export function Modal({
  open,
  title,
  children,
  onClose,
  closeLabel = "Dialog schließen",
  descriptionId,
  className,
  canDismiss = true,
}: ModalProps) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const pointerStartedOnBackdrop = useRef(false);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLElement>({
    initialFocus: closeButton,
    onEscape: onClose,
    canDismiss,
    open,
  });

  useEffect(() => (open ? makeBackgroundInert() : undefined), [open]);

  if (!open) return null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointerStartedOnBackdrop.current = event.target === event.currentTarget;
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const dismiss =
      canDismiss && pointerStartedOnBackdrop.current && event.target === event.currentTarget;
    pointerStartedOnBackdrop.current = false;
    if (dismiss) onClose();
  };

  return (
    <div
      className="modal-backdrop dialog-backdrop"
      role="presentation"
      data-modal-backdrop
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <section
        ref={dialogRef}
        className={["modal-panel", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <header className="modal-heading dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            aria-label={closeLabel}
            disabled={!canDismiss}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
