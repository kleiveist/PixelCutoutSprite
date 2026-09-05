import { useRef } from "react";

import { useModalFocus } from "../../components/useModalFocus";
import type { MotionCard } from "../../domain/animations";
import type { Direction } from "../../domain/common";

const allDirections: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

interface MotionReleaseDialogProps {
  motion: MotionCard;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MotionReleaseDialog({
  motion,
  busy,
  onCancel,
  onConfirm,
}: MotionReleaseDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLDivElement>({
    canDismiss: !busy,
    initialFocus: cancelButton,
    onEscape: onCancel,
  });
  const missing = allDirections.filter(
    (direction) => !motion.direction_coverage.includes(direction),
  );
  const complete = missing.length === 0;
  const semantics = motion.semantics;
  return (
    <div className="motion-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="motion-dialog motion-release-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-motion-title"
        onKeyDown={onDialogKeyDown}
      >
        <header>
          <span>RELEASE CHECK</span>
          <h2 id="release-motion-title">Release {motion.name}?</h2>
          <p>This creates a new immutable revision. Your editable draft remains available.</p>
        </header>
        <ul className="release-checklist">
          <li data-valid="true">
            Profile {motion.profile_ref.id.slice(0, 8)} pinned at r{motion.profile_ref.revision}
          </li>
          <li data-valid="true">
            {motion.frame_count} stored frames at {motion.fps} FPS · {motion.loop_mode}
          </li>
          <li data-valid={complete}>
            {complete
              ? "All eight directions resolve"
              : `Missing directions: ${missing.map((value) => value.toUpperCase()).join(", ")}`}
          </li>
          {semantics && (
            <li data-valid="true">
              {semantics.preset} preset · in-place
              {semantics.recommended_speed_px_per_second
                ? ` · ${semantics.recommended_speed_px_per_second} px/s game-speed guide`
                : ""}
              {semantics.jump_height_mode !== "not_applicable"
                ? ` · ${semantics.jump_height_mode.replaceAll("_", " ")}`
                : ""}
              {semantics.ground_shadow
                ? ` · ground shadow ${semantics.ground_shadow.enabled ? "on" : "off"}`
                : ""}
            </li>
          )}
        </ul>
        {!complete && (
          <p className="motion-validation" role="alert">
            Open the dummy editor and resolve every direction before releasing.
          </p>
        )}
        <footer>
          <button ref={cancelButton} type="button" disabled={busy} onClick={onCancel}>
            Back to draft
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy || !complete}
            onClick={onConfirm}
          >
            {busy ? "Releasing…" : "Release immutable revision"}
          </button>
        </footer>
      </div>
    </div>
  );
}
