import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface ModalHostProps {
  readonly children?: ReactNode;
}

/** One portal boundary for every application-level modal. */
export function ModalHost({ children }: ModalHostProps) {
  if (!children || typeof document === "undefined") return null;
  return createPortal(
    <div data-modal-host className="modal-host">
      {children}
    </div>,
    document.body,
  );
}
