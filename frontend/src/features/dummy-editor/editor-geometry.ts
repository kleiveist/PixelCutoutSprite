import type { PixelPoint } from "../../domain/common";
import { neutralTransform, type EditorPose } from "./editor-state";

export interface EditorSlot {
  id: string;
  label: string;
  parentId: string | null;
  x: number;
  y: number;
  baseRotation?: number;
  width: number;
  height: number;
  color: string;
  pivotX?: number;
  pivotY?: number;
  optional?: boolean;
}

type Matrix = [number, number, number, number, number, number];

export function slotMatrix(
  slot: EditorSlot,
  slots: readonly EditorSlot[],
  pose: EditorPose,
  groundOrigin: PixelPoint,
): Matrix {
  return multiply(
    resolveAnchor(slot, slots, pose, groundOrigin),
    translation(-(slot.pivotX ?? 0), -(slot.pivotY ?? 0)),
  );
}

export function movePoseSelection(
  pose: EditorPose,
  selected: ReadonlySet<string>,
  slots: readonly EditorSlot[],
  groundOrigin: PixelPoint,
  screenDeltaX: number,
  screenDeltaY: number,
  pixelSnap: boolean,
): EditorPose {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const roots = [...selected].filter((id) => !hasSelectedAncestor(id, selected, byId));
  const result = Object.fromEntries(
    Object.entries(pose).map(([id, transform]) => [id, { ...transform }]),
  );
  for (const id of roots) {
    const slot = byId.get(id);
    const current = result[id] ?? neutralTransform();
    if (!slot || current.locked) continue;
    const basis = resolveMotionBasis(slot, slots, pose, groundOrigin);
    const [deltaX, deltaY] = inverseVector(basis, screenDeltaX, screenDeltaY);
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

export function rotatePoseSelection(
  pose: EditorPose,
  selected: ReadonlySet<string>,
  slots: readonly EditorSlot[],
  deltaDegrees: number,
  snap: (value: number) => number,
): EditorPose {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const roots = [...selected].filter((id) => !hasSelectedAncestor(id, selected, byId));
  const result = Object.fromEntries(
    Object.entries(pose).map(([id, transform]) => [id, { ...transform }]),
  );
  for (const id of roots) {
    const current = result[id] ?? neutralTransform();
    if (current.locked) continue;
    result[id] = { ...current, rotation: snap(current.rotation + deltaDegrees) };
  }
  return result;
}

function resolveAnchor(
  slot: EditorSlot,
  slots: readonly EditorSlot[],
  pose: EditorPose,
  groundOrigin: PixelPoint,
): Matrix {
  const byId = new Map(slots.map((item) => [item.id, item]));
  const anchors = new Map<string, Matrix>();
  const resolve = (current: EditorSlot): Matrix => {
    const cached = anchors.get(current.id);
    if (cached) return cached;
    const parent = current.parentId ? byId.get(current.parentId) : undefined;
    const parentMatrix = parent ? resolve(parent) : translation(groundOrigin[0], groundOrigin[1]);
    const state = pose[current.id] ?? neutralTransform();
    const profile = multiply(
      translation(current.x, current.y),
      rotation(current.baseRotation ?? 0),
    );
    const motion = multiply(translation(state.offsetX, state.offsetY), rotation(state.rotation));
    const result = multiply(parentMatrix, multiply(profile, motion));
    anchors.set(current.id, result);
    return result;
  };
  return resolve(slot);
}

function resolveMotionBasis(
  slot: EditorSlot,
  slots: readonly EditorSlot[],
  pose: EditorPose,
  groundOrigin: PixelPoint,
): Matrix {
  const parent = slot.parentId ? slots.find((candidate) => candidate.id === slot.parentId) : null;
  const parentMatrix = parent
    ? resolveAnchor(parent, slots, pose, groundOrigin)
    : translation(groundOrigin[0], groundOrigin[1]);
  return multiply(parentMatrix, rotation(slot.baseRotation ?? 0));
}

function hasSelectedAncestor(
  id: string,
  selected: ReadonlySet<string>,
  byId: ReadonlyMap<string, EditorSlot>,
): boolean {
  let parentId = byId.get(id)?.parentId ?? null;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    if (selected.has(parentId)) return true;
    seen.add(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}

function inverseVector(matrix: Matrix, x: number, y: number): [number, number] {
  const [a, b, c, d] = matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < Number.EPSILON) return [0, 0];
  return [(d * x - c * y) / determinant, (-b * x + a * y) / determinant];
}

function translation(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

function rotation(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
}

function multiply(parent: Matrix, child: Matrix): Matrix {
  const [a, b, c, d, tx, ty] = parent;
  const [e, f, g, h, ux, uy] = child;
  return [
    a * e + c * f,
    b * e + d * f,
    a * g + c * h,
    b * g + d * h,
    a * ux + c * uy + tx,
    b * ux + d * uy + ty,
  ];
}
