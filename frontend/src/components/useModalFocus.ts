import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface ModalFocusOptions {
  canDismiss?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  onEscape: () => void;
  open?: boolean;
}

interface ModalFocusResult<T extends HTMLElement> {
  dialogRef: RefObject<T | null>;
  onDialogKeyDown: (event: KeyboardEvent<T>) => void;
}

function focusableChildren(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
    (element) =>
      element.matches(FOCUSABLE_SELECTOR) &&
      !element.hidden &&
      !element.closest("[hidden], [inert], [aria-hidden='true']"),
  );
}

/** Gives every modal the same initial focus, focus trap, Escape, and return-focus behavior. */
export function useModalFocus<T extends HTMLElement>({
  canDismiss = true,
  initialFocus,
  onEscape,
  open = true,
}: ModalFocusOptions): ModalFocusResult<T> {
  const dialogRef = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = initialFocus?.current ?? focusableChildren(dialogRef.current)[0];
    (target ?? dialogRef.current)?.focus();

    return () => {
      const previous = previousFocus.current;
      if (!previous?.isConnected) return;
      if (previous.closest("[inert]")) {
        // Shared modals restore the background in their effect cleanup. Browsers
        // refuse focus while that background is still inert; restore it afterwards.
        queueMicrotask(() => {
          if (previous.isConnected && !previous.closest("[inert]")) previous.focus();
        });
      } else {
        previous.focus();
      }
    };
  }, [initialFocus, open]);

  function onDialogKeyDown(event: KeyboardEvent<T>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (canDismiss) onEscape();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = focusableChildren(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    const eventTarget = event.target;
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        eventTarget === first ||
        !dialogRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        eventTarget === last ||
        !dialogRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  return { dialogRef, onDialogKeyDown };
}
