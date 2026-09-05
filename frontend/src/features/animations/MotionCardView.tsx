import { useState, type ReactNode } from "react";

import type { MotionCard, MotionOpenTarget } from "../../domain/animations";

interface MotionCardViewProps {
  motion: MotionCard;
  disabled: boolean;
  onOpen: (target: MotionOpenTarget) => void;
  onResolveOpen: () => Promise<MotionOpenTarget>;
  onOpenDummy: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onRemove: () => void;
  preview?: ReactNode;
}

export function MotionCardView({
  motion,
  disabled,
  onOpen,
  onResolveOpen,
  onOpenDummy,
  onDuplicate,
  onPublish,
  onArchive,
  onRemove,
  preview,
}: MotionCardViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const badge = motion.status.replaceAll("_", " ");
  function resolve(): void {
    void onResolveOpen().then(onOpen);
  }
  return (
    <article
      className="motion-card"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      {preview}
      <button className="motion-card-main" type="button" onClick={resolve}>
        <span className="motion-card-copy">
          <small>{motion.action_key}</small>
          <strong>{motion.name}</strong>
          <span>
            {motion.frame_count} frames · {motion.fps} FPS · {motion.loop_mode}
          </span>
          <span>
            {motion.direction_coverage.map((direction) => direction.toUpperCase()).join(" · ") ||
              "No directions"}
          </span>
          <span className="motion-label-list" aria-label={`${motion.name} labels`}>
            {motion.label_ids.length === 0
              ? "No labels"
              : motion.label_ids.map((labelId) => (
                  <span key={labelId} title={labelId}>
                    #{labelId.slice(0, 8)}
                  </span>
                ))}
          </span>
        </span>
        <em>{badge}</em>
      </button>
      <div className="motion-card-actions" role="group" aria-label={`Actions for ${motion.name}`}>
        <button type="button" onClick={onOpenDummy} aria-label={`Edit ${motion.name} dummy`}>
          ✦ Dummy
        </button>
        <button type="button" onClick={onDuplicate} disabled={disabled}>
          Duplicate
        </button>
        {motion.status !== "released" && motion.status !== "archived" && (
          <button type="button" onClick={onPublish} disabled={disabled}>
            Release dummy
          </button>
        )}
        <button type="button" onClick={onArchive} disabled={disabled}>
          {motion.status === "archived" ? "Restore" : "Archive"}
        </button>
        <button type="button" onClick={onRemove} disabled={disabled}>
          Remove…
        </button>
      </div>
      {menuOpen && (
        <div className="motion-context-menu" role="menu" aria-label={`${motion.name} menu`}>
          <button type="button" role="menuitem" onClick={onOpenDummy}>
            Open dummy editor
          </button>
          <button type="button" role="menuitem" disabled={disabled} onClick={onDuplicate}>
            Duplicate template
          </button>
          <button type="button" role="menuitem" disabled={disabled} onClick={onArchive}>
            {motion.status === "archived" ? "Restore template" : "Archive template"}
          </button>
          <button type="button" role="menuitem" disabled={disabled} onClick={onRemove}>
            Move template to trash
          </button>
          <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>
            Close menu
          </button>
        </div>
      )}
    </article>
  );
}
