import { useEffect, useRef, useState } from "react";
import { PART_GROUPS, partDefinition } from "../shared/image/parts";
import { flyoutPosition, type Point } from "../shared/image/viewport";
import type { PartId } from "../shared/image/contracts";
import type { PartEdit } from "./client";
import styles from "./CutoutEditor.module.css";

export const statusLabel: Record<PartEdit["status"], string> = {
  unmarked: "nicht markiert",
  editing: "in Bearbeitung",
  confirmed: "bestätigt",
  not_present: "nicht vorhanden",
  disabled: "deaktiviert",
};
function GroupIcon({ id }: { id: string }) {
  const color = (group: string) => (group === id ? "currentColor" : "#8791a1");
  return (
    <svg width="28" height="32" viewBox="0 0 28 36" aria-hidden="true">
      <circle cx="14" cy="5" r="4" fill={color("body")} />
      <path d="M9 11h10v12H9z" fill={color("body")} />
      <path d="M3 11h4v15H3z" fill={color("arm_r")} />
      <path d="M21 11h4v15h-4z" fill={color("arm_l")} />
      <path d="M9 24h4v11H9z" fill={color("leg_r")} />
      <path d="M15 24h4v11h-4z" fill={color("leg_l")} />
      {id === "extras" ? (
        <path
          d="m14 0 3 8 8 1-7 5 2 8-6-4-6 4 2-8-7-5 8-1z"
          fill="currentColor"
          stroke="var(--surface, #171d29)"
        />
      ) : null}
    </svg>
  );
}
export function PartToolbar({
  parts,
  activePartId,
  onSelect,
  disabled,
}: {
  readonly parts: readonly PartEdit[];
  readonly activePartId: PartId;
  readonly onSelect: (partId: PartId) => void;
  readonly disabled: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null),
    [position, setPosition] = useState<Point>({ x: 8, y: 8 });
  const anchor = useRef<HTMLButtonElement | null>(null),
    flyout = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const positionFlyout = () => {
      if (anchor.current && flyout.current) {
        const box = flyout.current.getBoundingClientRect();
        setPosition(
          flyoutPosition(
            anchor.current.getBoundingClientRect(),
            { width: box.width, height: box.height },
            { width: innerWidth, height: innerHeight },
          ),
        );
      }
    };
    positionFlyout();
    flyout.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: globalThis.PointerEvent) => {
      if (
        !flyout.current?.contains(event.target as Node) &&
        !anchor.current?.contains(event.target as Node)
      )
        setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(null);
        anchor.current?.focus();
      }
    };
    window.addEventListener("resize", positionFlyout);
    window.addEventListener("scroll", positionFlyout, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", positionFlyout);
      window.removeEventListener("scroll", positionFlyout, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const group = PART_GROUPS.find((entry) => entry.id === open);
  return (
    <>
      <div
        className={styles.partGroups}
        role="group"
        aria-label="Körperteilgruppen · anatomische Seiten"
      >
        {PART_GROUPS.map((group) => {
          const ids = group.slots.flat(),
            complete = parts.filter(
              (part) =>
                ids.includes(part.partId) && ["confirmed", "not_present"].includes(part.status),
            ).length;
          return (
            <button
              type="button"
              key={group.id}
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open === group.id}
              aria-label={`${group.label}, ${complete} von 3 abgeschlossen`}
              data-active={ids.includes(activePartId)}
              onClick={(event) => {
                anchor.current = event.currentTarget;
                setOpen(open === group.id ? null : group.id);
              }}
            >
              <GroupIcon id={group.id} />
              <span>
                {group.label}
                <small>{complete}/3</small>
              </span>
            </button>
          );
        })}
      </div>
      {group ? (
        <div
          ref={flyout}
          className={styles.flyout}
          role="dialog"
          aria-label={`${group.label}: Teil auswählen`}
          style={{ left: position.x, top: position.y }}
        >
          {group.slots.map((slot, index) => {
            const part = parts.find((part) => slot.includes(part.partId));
            if (!part) return null;
            return (
              <button
                type="button"
                key={index}
                aria-pressed={part.partId === activePartId}
                onClick={() => {
                  onSelect(part.partId);
                  setOpen(null);
                  anchor.current?.focus();
                }}
              >
                <span>{partDefinition(part.partId).label}</span>
                <small>{statusLabel[part.status]}</small>
              </button>
            );
          })}
          <button
            type="button"
            aria-label={`${group.label}: Teilwahl schließen`}
            onClick={() => {
              setOpen(null);
              anchor.current?.focus();
            }}
          >
            <span aria-hidden="true">×</span> Schließen
          </button>
        </div>
      ) : null}
    </>
  );
}
