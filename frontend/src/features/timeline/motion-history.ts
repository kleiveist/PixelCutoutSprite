import type { MotionDraft } from "../../domain/animations";

export interface MotionHistoryEntry {
  label: string;
  draft: MotionDraft;
}

export interface MotionHistory {
  past: MotionHistoryEntry[];
  present: MotionDraft;
  future: MotionHistoryEntry[];
}

export function createMotionHistory(draft: MotionDraft): MotionHistory {
  return { past: [], present: cloneDraft(draft), future: [] };
}

export function commitMotion(
  history: MotionHistory,
  draft: MotionDraft,
  label: string,
): MotionHistory {
  if (draftContent(history.present) === draftContent(draft)) return history;
  return {
    past: [...history.past, { label, draft: cloneDraft(history.present) }],
    present: cloneDraft(draft),
    future: [],
  };
}

export function undoMotion(history: MotionHistory): MotionHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneDraft(previous.draft),
    future: [{ label: previous.label, draft: cloneDraft(history.present) }, ...history.future],
  };
}

export function redoMotion(history: MotionHistory): MotionHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, { label: next.label, draft: cloneDraft(history.present) }],
    present: cloneDraft(next.draft),
    future: history.future.slice(1),
  };
}

export function replacePresent(history: MotionHistory, draft: MotionDraft): MotionHistory {
  return { ...history, present: cloneDraft(draft) };
}

export function draftContent(draft: MotionDraft): string {
  return JSON.stringify({
    frame_size_px: draft.frame_size_px,
    ground_origin_px: draft.ground_origin_px,
    frame_count: draft.frame_count,
    fps: draft.fps,
    loop_mode: draft.loop_mode,
    directions: draft.directions,
    tracks: draft.tracks,
  });
}

function cloneDraft(draft: MotionDraft): MotionDraft {
  return structuredClone(draft);
}
