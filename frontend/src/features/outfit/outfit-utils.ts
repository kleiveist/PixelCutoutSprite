import type { SlotRef, Transform2D } from "../../domain";

export type EditorMode = "inventory" | "dress" | "fine_tune";
export type EditScope = "appearance" | "binding";

export function identityTransform(): Transform2D {
  return { offset_px: [0, 0], rotation_deg: 0 };
}

export function assetKey(asset: SlotRef): string {
  return `${asset.asset_id}:${asset.revision}:${asset.slot_id}`;
}

export function toggleSet(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function saveStateLabel(state: string): string {
  return (
    (
      {
        dirty: "Unsaved",
        saving: "Saving",
        saved: "Saved",
        failed: "Save failed",
        conflict: "Save conflict",
      } as Record<string, string>
    )[state] ?? state
  );
}

export function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function isTextEditing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}
