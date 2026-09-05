import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { Direction, PixelPoint, PixelSize } from "../../domain/common";
import "./DummyEditorPage.css";
import {
  commitPose,
  createHistory,
  moveSelection,
  neutralTransform,
  redo,
  snapAngle,
  transformSelection,
  undo,
  type EditorHistory,
  type EditorPose,
} from "./editor-state";

export interface EditorSlot {
  id: string;
  label: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pivotX?: number;
  pivotY?: number;
  optional?: boolean;
}

interface DummyEditorPageProps {
  templateName: string;
  slots: readonly EditorSlot[];
  initialPose: EditorPose;
  initialPoses?: Partial<Record<Direction, EditorPose>>;
  directionalSlots?: Partial<Record<Direction, readonly EditorSlot[]>>;
  frameSize?: PixelSize;
  groundOrigin?: PixelPoint;
  renderedFrameUrl?: string;
  readOnly?: boolean;
  onPoseChange?: (pose: EditorPose, direction: Direction) => void;
  onSave: (pose: EditorPose, direction: Direction) => Promise<void>;
}

type SaveState = "clean" | "dirty" | "saving" | "saved" | "failed";

export function DummyEditorPage({
  templateName,
  slots,
  initialPose,
  initialPoses,
  directionalSlots,
  frameSize = [128, 128],
  groundOrigin = [64, 108],
  renderedFrameUrl,
  readOnly = false,
  onPoseChange,
  onSave,
}: DummyEditorPageProps) {
  const [histories, setHistories] = useState<Record<Direction, EditorHistory>>(
    () =>
      Object.fromEntries(
        directions.map((value) => [
          value,
          createHistory(initialPoses?.[value] ?? (value === "s" ? initialPose : {})),
        ]),
      ) as Record<Direction, EditorHistory>,
  );
  const [previewPose, setPreviewPose] = useState<EditorPose | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(slots[0] ? [slots[0].id] : []),
  );
  const [direction, setDirection] = useState<Direction>("s");
  const [pixelSnap, setPixelSnap] = useState(true);
  const [angleSnap, setAngleSnap] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    pose: EditorPose;
    selection: ReadonlySet<string>;
  } | null>(null);
  const history = histories[direction];
  const activeSlots = directionalSlots?.[direction] ?? slots;
  const pose = previewPose ?? history.present;
  const selectedSlot = activeSlots.find((slot) => selected.has(slot.id));
  const selectedTransform = selectedSlot ? (pose[selectedSlot.id] ?? neutralTransform()) : null;

  useEffect(
    () => onPoseChange?.(history.present, direction),
    [direction, history.present, onPoseChange],
  );

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 2000);
    return () => window.clearTimeout(timer);
  });

  const statusText = useMemo(() => {
    if (saveState === "failed") return `Unsaved · ${saveError ?? "write failed"}`;
    if (saveState === "saving") return "Saving…";
    if (saveState === "dirty") return "Unsaved changes · autosave in 2 s";
    if (saveState === "saved") return "Saved locally";
    return "No changes";
  }, [saveError, saveState]);

  function commit(next: EditorPose, label: string): void {
    if (readOnly) return;
    setPreviewPose(null);
    setHistories((current) => ({
      ...current,
      [direction]: commitPose(current[direction], next, label),
    }));
    setSaveState("dirty");
  }

  async function save(): Promise<void> {
    setSaveState("saving");
    setSaveError(null);
    try {
      await onSave(history.present, direction);
      setSaveState("saved");
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
      setSaveState("failed");
    }
  }

  function chooseSlot(id: string, additive: boolean): void {
    setSelected((current) => {
      if (!additive) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateSelected(
    change: Partial<ReturnType<typeof neutralTransform>>,
    label: string,
  ): void {
    commit(transformSelection(history.present, selected, change), label);
  }

  function changeHistory(operation: (current: EditorHistory) => EditorHistory): void {
    if (readOnly) return;
    setHistories((current) => ({ ...current, [direction]: operation(current[direction]) }));
    setPreviewPose(null);
    setSaveState("dirty");
  }

  return (
    <section
      className="dummy-editor"
      aria-label={`Reusable motion template ${templateName}`}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
          return;
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          changeHistory(event.shiftKey ? redo : undo);
        }
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          changeHistory(redo);
        }
      }}
    >
      <header className="editor-toolbar">
        <div>
          <span>Motion template</span>
          <strong>{templateName}</strong>
        </div>
        <label>
          Direction
          <select
            value={direction}
            onChange={(event) => {
              if (saveState === "dirty") void save();
              setPreviewPose(null);
              setDirection(event.target.value as Direction);
              setSaveState("clean");
              setSaveError(null);
            }}
          >
            {directions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={pixelSnap}
            disabled={readOnly}
            onChange={(event) => setPixelSnap(event.target.checked)}
          />{" "}
          Pixel snap
        </label>
        <label>
          <input
            type="checkbox"
            checked={angleSnap}
            disabled={readOnly}
            onChange={(event) => setAngleSnap(event.target.checked)}
          />{" "}
          15° snap
        </label>
        <button
          type="button"
          disabled={readOnly || history.past.length === 0}
          onClick={() => changeHistory(undo)}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={readOnly || history.future.length === 0}
          onClick={() => changeHistory(redo)}
        >
          Redo
        </button>
        <button type="button" disabled={readOnly} onClick={() => void save()}>
          Save
        </button>
        {readOnly && <span>Read-only vault</span>}
        <output aria-live="polite">{statusText}</output>
      </header>

      <aside className="editor-parts" aria-label="Body parts and layers">
        <strong>Parts & layers</strong>
        {activeSlots.map((slot, index) => {
          const state = pose[slot.id] ?? neutralTransform();
          return (
            <button
              type="button"
              key={slot.id}
              aria-pressed={selected.has(slot.id)}
              onClick={(event) => chooseSlot(slot.id, event.ctrlKey || event.metaKey)}
            >
              <span style={{ background: slot.color }} /> {String(index + 1).padStart(2, "0")} ·{" "}
              {slot.label}
              <small>{state.visible ? (state.locked ? "Locked" : "Visible") : "Hidden"}</small>
            </button>
          );
        })}
      </aside>

      <div className="editor-viewport-shell">
        <div className="viewport-controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 1))}>
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            1:1
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.min(12, value + 1))}>
            +
          </button>
          <button
            type="button"
            aria-label="Pan left"
            onClick={() => setPan((value) => ({ ...value, x: value.x - 8 }))}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Pan right"
            onClick={() => setPan((value) => ({ ...value, x: value.x + 8 }))}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Pan up"
            onClick={() => setPan((value) => ({ ...value, y: value.y - 8 }))}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Pan down"
            onClick={() => setPan((value) => ({ ...value, y: value.y + 8 }))}
          >
            ↓
          </button>
          <span>
            {zoom}× · pan {pan.x},{pan.y}
          </span>
        </div>
        <div
          className="editor-viewport"
          style={
            {
              "--editor-zoom": zoom,
              "--pan-x": `${pan.x}px`,
              "--pan-y": `${pan.y}px`,
              "--frame-width": `${frameSize[0]}px`,
              "--frame-height": `${frameSize[1]}px`,
              "--ground-y": `${groundOrigin[1]}px`,
            } as CSSProperties
          }
        >
          <div className="frame-boundary">
            <span className="ground-line" />
            {renderedFrameUrl && (
              <img
                className="compositor-frame"
                src={renderedFrameUrl}
                alt="Reference compositor output"
              />
            )}
            <div className="editor-overlay" aria-label="Selection overlay">
              {activeSlots.map((slot) => {
                const state = pose[slot.id] ?? neutralTransform();
                const matrix = slotMatrix(slot, activeSlots, pose, groundOrigin);
                return (
                  <button
                    type="button"
                    key={slot.id}
                    className="slot-handle"
                    data-selected={selected.has(slot.id)}
                    hidden={!state.visible}
                    aria-label={`Select ${slot.label}`}
                    style={{
                      left: 0,
                      top: 0,
                      width: slot.width,
                      height: slot.height,
                      borderColor: slot.color,
                      transform: `matrix(${matrix.join(",")})`,
                    }}
                    onClick={(event) => chooseSlot(slot.id, event.ctrlKey || event.metaKey)}
                    onPointerDown={(event) => {
                      if (readOnly || state.locked) return;
                      const selection = selected.has(slot.id)
                        ? new Set(selected)
                        : new Set([slot.id]);
                      if (!selected.has(slot.id)) setSelected(selection);
                      drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        pose: history.present,
                        selection,
                      };
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!drag.current) return;
                      setPreviewPose(
                        moveSelection(
                          drag.current.pose,
                          drag.current.selection,
                          (event.clientX - drag.current.x) / zoom,
                          (event.clientY - drag.current.y) / zoom,
                          pixelSnap,
                        ),
                      );
                    }}
                    onPointerUp={() => {
                      if (!drag.current) return;
                      drag.current = null;
                      if (previewPose) commit(previewPose, `Move ${selected.size} part(s)`);
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      setPreviewPose(null);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        left: slot.pivotX ?? 0,
                        top: slot.pivotY ?? 0,
                      }}
                    />
                    <small>{slot.label}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <aside className="editor-inspector" aria-label="Transform inspector">
        <strong>Transform</strong>
        {selectedSlot && selectedTransform ? (
          <>
            <p>
              {selectedSlot.label}
              <small>Attached to {selectedSlot.parentId ?? "figure root"}</small>
            </p>
            <label>
              X offset
              <input
                aria-label="X offset"
                type="number"
                disabled={readOnly || selectedTransform.locked}
                step={pixelSnap ? 1 : 0.25}
                value={selectedTransform.offsetX}
                onChange={(event) =>
                  updateSelected({ offsetX: Number(event.target.value) }, "Set X offset")
                }
              />
            </label>
            <label>
              Y offset
              <input
                aria-label="Y offset"
                type="number"
                disabled={readOnly || selectedTransform.locked}
                step={pixelSnap ? 1 : 0.25}
                value={selectedTransform.offsetY}
                onChange={(event) =>
                  updateSelected({ offsetY: Number(event.target.value) }, "Set Y offset")
                }
              />
            </label>
            <label>
              Rotation
              <input
                aria-label="Rotation"
                type="number"
                disabled={readOnly || selectedTransform.locked}
                value={selectedTransform.rotation}
                onChange={(event) =>
                  updateSelected(
                    { rotation: snapAngle(Number(event.target.value), angleSnap) },
                    "Rotate part",
                  )
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                disabled={readOnly || selectedTransform.locked}
                checked={selectedTransform.visible}
                onChange={(event) =>
                  updateSelected({ visible: event.target.checked }, "Toggle visibility")
                }
              />{" "}
              Visible
            </label>
            <label>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={selectedTransform.locked}
                onChange={(event) =>
                  updateSelected({ locked: event.target.checked }, "Toggle lock")
                }
              />{" "}
              Locked
            </label>
          </>
        ) : (
          <p>Select a body part.</p>
        )}
      </aside>
    </section>
  );
}

const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

type Matrix = [number, number, number, number, number, number];

function slotMatrix(
  slot: EditorSlot,
  slots: readonly EditorSlot[],
  pose: EditorPose,
  groundOrigin: PixelPoint,
): Matrix {
  const byId = new Map(slots.map((item) => [item.id, item]));
  const anchors = new Map<string, Matrix>();
  const resolveAnchor = (current: EditorSlot): Matrix => {
    const cached = anchors.get(current.id);
    if (cached) return cached;
    const parent = current.parentId ? byId.get(current.parentId) : undefined;
    const parentMatrix = parent
      ? resolveAnchor(parent)
      : translation(groundOrigin[0], groundOrigin[1]);
    const state = pose[current.id] ?? neutralTransform();
    const own = multiply(
      translation(current.x + state.offsetX, current.y + state.offsetY),
      rotation(state.rotation),
    );
    const result = multiply(parentMatrix, own);
    anchors.set(current.id, result);
    return result;
  };
  return multiply(resolveAnchor(slot), translation(-(slot.pivotX ?? 0), -(slot.pivotY ?? 0)));
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
