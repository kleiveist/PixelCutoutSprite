import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { Direction, PixelPoint, PixelSize } from "../../domain/common";
import "./DummyEditorPage.css";
import {
  movePoseSelection,
  rotatePoseSelection,
  slotMatrix,
  type EditorSlot,
} from "./editor-geometry";
import {
  commitPose,
  createHistory,
  neutralTransform,
  redo,
  snapAngle,
  transformSelection,
  undo,
  type EditorHistory,
  type EditorPose,
} from "./editor-state";

export type { EditorSlot } from "./editor-geometry";

interface DummyEditorPageProps {
  templateName: string;
  slots: readonly EditorSlot[];
  initialPose: EditorPose;
  initialPoses?: Partial<Record<Direction, EditorPose>>;
  directionalSlots?: Partial<Record<Direction, readonly EditorSlot[]>>;
  frameSize?: PixelSize;
  groundOrigin?: PixelPoint;
  renderedFrameUrl?: string;
  neighborFrameUrls?: { previous?: string; next?: string };
  readOnly?: boolean;
  pose?: EditorPose;
  direction?: Direction;
  frameIndex?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  saveStatusText?: string;
  onPoseChange?: (pose: EditorPose, direction: Direction) => void;
  onPoseCommit?: (pose: EditorPose, direction: Direction, label: string) => void;
  onDirectionChange?: (direction: Direction) => void;
  onSelectionChange?: (slotIds: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
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
  neighborFrameUrls,
  readOnly = false,
  pose: controlledPose,
  direction: controlledDirection,
  frameIndex,
  canUndo,
  canRedo,
  saveStatusText,
  onPoseChange,
  onPoseCommit,
  onDirectionChange,
  onSelectionChange,
  onUndo,
  onRedo,
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
  const [internalDirection, setInternalDirection] = useState<Direction>("s");
  const [pixelSnap, setPixelSnap] = useState(true);
  const [angleSnap, setAngleSnap] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);
  const editVersion = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    pose: EditorPose;
    selection: ReadonlySet<string>;
    mode: "move" | "rotate";
  } | null>(null);
  const panDrag = useRef<{ x: number; y: number } | null>(null);
  const direction = controlledDirection ?? internalDirection;
  const history = histories[direction];
  const activeSlots = directionalSlots?.[direction] ?? slots;
  const pose = previewPose ?? controlledPose ?? history.present;
  const selectedSlot = activeSlots.find((slot) => selected.has(slot.id));
  const selectedTransform = selectedSlot ? (pose[selectedSlot.id] ?? neutralTransform()) : null;

  useEffect(() => {
    if (controlledPose === undefined) onPoseChange?.(history.present, direction);
  }, [controlledPose, direction, history.present, onPoseChange]);

  useEffect(() => onSelectionChange?.([...selected]), [onSelectionChange, selected]);

  useEffect(() => {
    if (controlledPose !== undefined || saveState !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 2000);
    return () => window.clearTimeout(timer);
  });

  const internalStatusText = useMemo(() => {
    if (saveState === "failed") return `Unsaved · ${saveError ?? "write failed"}`;
    if (saveState === "saving") return "Saving…";
    if (saveState === "dirty") return "Unsaved changes · autosave in 2 s";
    if (saveState === "saved") return "Saved locally";
    return "No changes";
  }, [saveError, saveState]);
  const statusText = saveStatusText ?? internalStatusText;

  function commit(next: EditorPose, label: string): void {
    if (readOnly) return;
    setPreviewPose(null);
    editVersion.current += 1;
    if (controlledPose !== undefined) {
      onPoseCommit?.(next, direction, label);
      return;
    }
    setHistories((current) => ({
      ...current,
      [direction]: commitPose(current[direction], next, label),
    }));
    setSaveState("dirty");
  }

  async function save(): Promise<void> {
    const version = editVersion.current;
    if (saveStatusText === undefined) {
      setSaveState("saving");
      setSaveError(null);
    }
    try {
      await onSave(pose, direction);
      if (saveStatusText === undefined) {
        setSaveState(editVersion.current === version ? "saved" : "dirty");
      }
    } catch (reason) {
      if (saveStatusText === undefined) {
        setSaveError(reason instanceof Error ? reason.message : String(reason));
        setSaveState("failed");
      }
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
    commit(transformSelection(pose, selected, change), label);
  }

  function changeHistory(operation: (current: EditorHistory) => EditorHistory): void {
    if (readOnly) return;
    editVersion.current += 1;
    setHistories((current) => ({ ...current, [direction]: operation(current[direction]) }));
    setPreviewPose(null);
    setSaveState("dirty");
  }

  function undoCurrent(): void {
    if (controlledPose !== undefined) onUndo?.();
    else changeHistory(undo);
  }

  function redoCurrent(): void {
    if (controlledPose !== undefined) onRedo?.();
    else changeHistory(redo);
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
          event.nativeEvent.stopImmediatePropagation();
          if (event.shiftKey) redoCurrent();
          else undoCurrent();
        }
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          event.nativeEvent.stopImmediatePropagation();
          redoCurrent();
        }
        if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          event.nativeEvent.stopImmediatePropagation();
          void save();
        }
      }}
    >
      <header className="editor-toolbar">
        <div>
          <span>Motion template</span>
          <strong>{templateName}</strong>
          {frameIndex !== undefined && <small>Frame {frameIndex + 1}</small>}
        </div>
        <label>
          Direction
          <select
            value={direction}
            onChange={(event) => {
              setPreviewPose(null);
              const next = event.target.value as Direction;
              if (controlledDirection !== undefined) onDirectionChange?.(next);
              else {
                if (saveState === "dirty" || saveState === "failed") void save();
                setInternalDirection(next);
              }
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
          disabled={readOnly || !(controlledPose !== undefined ? canUndo : history.past.length > 0)}
          onClick={undoCurrent}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={
            readOnly || !(controlledPose !== undefined ? canRedo : history.future.length > 0)
          }
          onClick={redoCurrent}
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
          onWheel={(event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            setZoom((value) => Math.max(1, Math.min(12, value + (event.deltaY < 0 ? 1 : -1))));
          }}
          onPointerDown={(event) => {
            if (event.button !== 1) return;
            panDrag.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            if (!panDrag.current) return;
            const deltaX = event.clientX - panDrag.current.x;
            const deltaY = event.clientY - panDrag.current.y;
            panDrag.current = { x: event.clientX, y: event.clientY };
            setPan((value) => ({ x: value.x + deltaX, y: value.y + deltaY }));
          }}
          onPointerUp={(event) => {
            if (event.button === 1) panDrag.current = null;
          }}
          onPointerCancel={() => {
            panDrag.current = null;
          }}
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
            {neighborFrameUrls?.previous && (
              <img
                className="compositor-frame neighbor-pose previous-pose"
                src={neighborFrameUrls.previous}
                alt="Previous sampled pose"
              />
            )}
            {neighborFrameUrls?.next && (
              <img
                className="compositor-frame neighbor-pose next-pose"
                src={neighborFrameUrls.next}
                alt="Next sampled pose"
              />
            )}
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
                      if (event.button !== 0 || readOnly || state.locked) return;
                      const selection = selected.has(slot.id)
                        ? new Set(selected)
                        : new Set([slot.id]);
                      if (!selected.has(slot.id)) setSelected(selection);
                      drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        pose,
                        selection,
                        mode:
                          event.altKey ||
                          (event.target instanceof HTMLElement &&
                            event.target.classList.contains("rotation-handle"))
                            ? "rotate"
                            : "move",
                      };
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!drag.current) return;
                      const deltaX = (event.clientX - drag.current.x) / zoom;
                      const deltaY = (event.clientY - drag.current.y) / zoom;
                      setPreviewPose(
                        drag.current.mode === "rotate"
                          ? rotatePoseSelection(
                              drag.current.pose,
                              drag.current.selection,
                              activeSlots,
                              deltaX,
                              (value) => snapAngle(value, angleSnap),
                            )
                          : movePoseSelection(
                              drag.current.pose,
                              drag.current.selection,
                              activeSlots,
                              groundOrigin,
                              deltaX,
                              deltaY,
                              pixelSnap,
                            ),
                      );
                    }}
                    onPointerUp={() => {
                      if (!drag.current) return;
                      const completed = drag.current;
                      drag.current = null;
                      if (previewPose) {
                        commit(
                          previewPose,
                          `${completed.mode === "rotate" ? "Rotate" : "Move"} ${selected.size} part(s)`,
                        );
                      }
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
                    <i className="rotation-handle" title="Drag to rotate; Alt-drag also rotates" />
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
                onChange={(event) => {
                  const value = Number(event.target.value);
                  updateSelected(
                    { offsetX: pixelSnap ? Math.round(value) : value },
                    "Set X offset",
                  );
                }}
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
                onChange={(event) => {
                  const value = Number(event.target.value);
                  updateSelected(
                    { offsetY: pixelSnap ? Math.round(value) : value },
                    "Set Y offset",
                  );
                }}
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
