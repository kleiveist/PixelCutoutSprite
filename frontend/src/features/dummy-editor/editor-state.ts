export interface EditorTransform {
  offsetX: number;
  offsetY: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export type EditorPose = Record<string, EditorTransform>;

export interface HistoryEntry {
  label: string;
  pose: EditorPose;
}

export interface EditorHistory {
  past: HistoryEntry[];
  present: EditorPose;
  future: HistoryEntry[];
}

export const neutralTransform = (): EditorTransform => ({
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  visible: true,
  locked: false,
});

export function createHistory(pose: EditorPose): EditorHistory {
  return { past: [], present: clonePose(pose), future: [] };
}

export function commitPose(history: EditorHistory, next: EditorPose, label: string): EditorHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return {
    past: [...history.past, { label, pose: clonePose(history.present) }],
    present: clonePose(next),
    future: [],
  };
}

export function undo(history: EditorHistory): EditorHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: clonePose(previous.pose),
    future: [{ label: previous.label, pose: clonePose(history.present) }, ...history.future],
  };
}

export function redo(history: EditorHistory): EditorHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, { label: next.label, pose: clonePose(history.present) }],
    present: clonePose(next.pose),
    future: history.future.slice(1),
  };
}

export function transformSelection(
  pose: EditorPose,
  selected: ReadonlySet<string>,
  change: Partial<EditorTransform>,
): EditorPose {
  const result = clonePose(pose);
  for (const id of selected) {
    const current = result[id] ?? neutralTransform();
    if (current.locked && change.locked === undefined) continue;
    result[id] = { ...current, ...change };
  }
  return result;
}

export function moveSelection(
  pose: EditorPose,
  selected: ReadonlySet<string>,
  deltaX: number,
  deltaY: number,
  pixelSnap: boolean,
): EditorPose {
  const result = clonePose(pose);
  for (const id of selected) {
    const current = result[id] ?? neutralTransform();
    if (current.locked) continue;
    const offsetX = current.offsetX + deltaX;
    const offsetY = current.offsetY + deltaY;
    result[id] = {
      ...current,
      offsetX: pixelSnap ? Math.round(offsetX) : offsetX,
      offsetY: pixelSnap ? Math.round(offsetY) : offsetY,
    };
  }
  return result;
}

export function snapAngle(value: number, enabled: boolean, step = 15): number {
  return enabled ? Math.round(value / step) * step : value;
}

function clonePose(pose: EditorPose): EditorPose {
  return Object.fromEntries(Object.entries(pose).map(([id, transform]) => [id, { ...transform }]));
}
