import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { DashboardProfileSummary } from "../dashboard/dashboardData";
import styles from "./ProfileLibraryView.module.css";

export interface DeleteProfileDialogProps {
  readonly profile: DashboardProfileSummary;
  readonly errorMessage?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function isolateFallbackDialog(dialog: HTMLDialogElement): () => void {
  const isolatedElements: HTMLElement[] = [];
  let activeBranch: HTMLElement = dialog;
  let parent = activeBranch.parentElement;

  while (parent && parent !== document.documentElement) {
    for (const sibling of parent.children) {
      if (
        sibling !== activeBranch &&
        sibling instanceof HTMLElement &&
        !sibling.hasAttribute("inert")
      ) {
        sibling.setAttribute("inert", "");
        isolatedElements.push(sibling);
      }
    }
    activeBranch = parent;
    parent = activeBranch.parentElement;
  }

  return () => {
    for (const element of isolatedElements) element.removeAttribute("inert");
  };
}

function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== "Tab") return;

  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((control) => !control.hasAttribute("hidden"));
  const firstControl = controls[0];
  const lastControl = controls.at(-1);
  if (!firstControl || !lastControl) return;

  if (event.shiftKey && document.activeElement === firstControl) {
    event.preventDefault();
    lastControl.focus();
  } else if (!event.shiftKey && document.activeElement === lastControl) {
    event.preventDefault();
    firstControl.focus();
  }
}

export function DeleteProfileDialog({
  profile,
  errorMessage,
  onCancel,
  onConfirm,
}: DeleteProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [usesFallbackModal, setUsesFallbackModal] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    let fallbackModal = false;
    if (!dialog.open) {
      try {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else fallbackModal = true;
      } catch {
        fallbackModal = true;
      }
    }

    if (fallbackModal) {
      dialog.setAttribute("open", "");
      setUsesFallbackModal(true);
    }

    const releaseIsolation = fallbackModal ? isolateFallbackDialog(dialog) : () => undefined;
    const keepFocusInFallback = (event: FocusEvent) => {
      if (fallbackModal && event.target instanceof Node && !dialog.contains(event.target)) {
        cancelRef.current?.focus();
      }
    };
    document.addEventListener("focusin", keepFocusInFallback);
    cancelRef.current?.focus();

    return () => {
      document.removeEventListener("focusin", keepFocusInFallback);
      releaseIsolation();
      if (!dialog.open) return;
      try {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      } catch {
        dialog.removeAttribute("open");
      }
    };
  }, []);

  return (
    <Fragment>
      {usesFallbackModal ? (
        <span className={styles.dialogFallbackBackdrop} aria-hidden="true" />
      ) : null}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        data-fallback-modal={usesFallbackModal ? "true" : undefined}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault();
          onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          trapDialogFocus(event);
        }}
      >
        <span className={styles.dialogEyebrow}>Profil löschen</span>
        <h2 id={titleId}>„{profile.name}“ endgültig löschen?</h2>
        <p id={descriptionId}>
          Das Assetprofil wird aus der lokalen Bibliothek entfernt. Sein Basis- und Kategorieprofil
          bleiben unverändert erhalten.
        </p>
        {errorMessage ? (
          <p className={styles.dialogError} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className={styles.dialogActions}>
          <button
            ref={cancelRef}
            className={styles.secondaryButton}
            type="button"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button className={styles.dangerButton} type="button" onClick={onConfirm}>
            Profil endgültig löschen
          </button>
        </div>
      </dialog>
    </Fragment>
  );
}
