import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import "./TimelinePanel.css";

import {
  isInteractiveKeyboardTarget,
  isTextEditingKeyboardTarget,
  ownsNativeSpaceKey,
} from "../../components/keyboard";
import { useModalFocus } from "../../components/useModalFocus";
import type { Direction } from "../../domain/common";
import type {
  Interpolation,
  JumpHeightMode,
  MotionSemantics,
  MotionTrack,
} from "../../domain/motion";
import {
  applyConfirmedRetime,
  copyKeys,
  deleteKeys,
  keyId,
  moveKeys,
  pasteKeys,
  previewRetime,
  rangeSelection,
  setTrackInterpolation,
  type ClipboardKey,
  type RetimeMode,
  type TimelineMotion,
} from "./timeline-operations";

type PlayableMotion = TimelineMotion & {
  fps: number;
  loop_mode: "loop" | "once";
  semantics?: MotionSemantics | null;
};

interface TimelinePanelProps<T extends PlayableMotion> {
  motion: T;
  direction?: Direction;
  frame: number;
  playing: boolean;
  autoKey?: boolean;
  onionSkin?: boolean;
  readOnly?: boolean;
  helperReadOnly?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onFrameChange: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onMotionChange: (motion: T, label: string) => void;
  onAutoKeyChange?: (enabled: boolean) => void;
  onOnionSkinChange?: (enabled: boolean) => void;
  onAddPoseKey?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onBakeHelper?: (helperIndex: number) => void;
}

export function TimelinePanel<T extends PlayableMotion>({
  motion,
  direction = "s",
  frame,
  playing,
  autoKey: controlledAutoKey,
  onionSkin: controlledOnionSkin,
  readOnly = false,
  helperReadOnly = readOnly,
  canUndo = false,
  canRedo = false,
  onFrameChange,
  onPlayingChange,
  onMotionChange,
  onAutoKeyChange,
  onOnionSkinChange,
  onAddPoseKey,
  onUndo,
  onRedo,
  onSave,
  onBakeHelper,
}: TimelinePanelProps<T>) {
  const [localAutoKey, setLocalAutoKey] = useState(false);
  const [localOnionSkin, setLocalOnionSkin] = useState(true);
  const [previewRate, setPreviewRate] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardKey[]>([]);
  const [retimeValue, setRetimeValue] = useState<number | null>(null);
  const [retimeMode, setRetimeMode] = useState<RetimeMode>("trim");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const selectionAnchor = useRef<{ trackIndex: number; frame: number } | null>(null);
  const autoKey = controlledAutoKey ?? localAutoKey;
  const onionSkin = controlledOnionSkin ?? localOnionSkin;
  const frameWidth = Math.round(42 * timelineZoom);

  usePlayback(motion, frame, playing, previewRate, onFrameChange, onPlayingChange);
  const retime = useMemo(
    () => (retimeValue === null ? null : previewRetime(motion, retimeValue)),
    [motion, retimeValue],
  );
  const visibleTracks = motion.tracks
    .map((track, trackIndex) => ({ track, trackIndex }))
    .filter(({ track }) => track.direction === direction);

  function selectKey(
    trackIndex: number,
    keyFrame: number,
    extend: boolean,
    additive: boolean,
  ): void {
    const selection = { trackIndex, frame: keyFrame };
    if (extend && selectionAnchor.current?.trackIndex === trackIndex) {
      setSelected(rangeSelection(motion, trackIndex, selectionAnchor.current.frame, keyFrame));
    } else if (additive) {
      setSelected((current) => toggle(current, keyId(selection)));
      selectionAnchor.current = selection;
    } else {
      setSelected(new Set([keyId(selection)]));
      selectionAnchor.current = selection;
    }
    onFrameChange(keyFrame);
  }

  function commitRetime(confirmed: boolean): void {
    if (!retime) return;
    const changed = applyConfirmedRetime(motion, retime, confirmed, retimeMode);
    if (!changed) return;
    onMotionChange(
      changed,
      `${retimeMode === "distribute" ? "Distribute" : "Retime"} to ${retime.newFrameCount} frames`,
    );
    onFrameChange(Math.min(frame, changed.frame_count - 1));
    setRetimeValue(null);
    setSelected(new Set());
  }

  function moveSelection(delta: number): void {
    const changed = moveKeys(motion, selected, delta);
    if (!changed) return;
    onMotionChange(changed, `Move keyframes ${delta > 0 ? "right" : "left"}`);
    setSelected(
      new Set(
        [...selected].map((id) => {
          const [trackIndex, keyFrame] = id.split(":").map(Number);
          return keyId({ trackIndex, frame: keyFrame + delta });
        }),
      ),
    );
  }

  function handleKeys(event: ReactKeyboardEvent<HTMLElement>): void {
    const command = event.ctrlKey || event.metaKey;
    if (command && isTextEditingKeyboardTarget(event.target)) return;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      if (!readOnly) {
        if (event.shiftKey) onRedo?.();
        else onUndo?.();
      }
    } else if (command && event.key.toLowerCase() === "y") {
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      if (!readOnly) onRedo?.();
    } else if (command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      onSave?.();
    } else if (event.key === " ") {
      if (ownsNativeSpaceKey(event.target)) return;
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      onPlayingChange(!playing);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (isInteractiveKeyboardTarget(event.target) && !isTimelineGridCell(event.target)) return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      onFrameChange(Math.max(0, Math.min(motion.frame_count - 1, frame + delta)));
    } else if (
      !readOnly &&
      (event.key === "Delete" || event.key === "Backspace") &&
      selected.size > 0
    ) {
      if (isInteractiveKeyboardTarget(event.target) && !isTimelineGridCell(event.target)) return;
      event.preventDefault();
      onMotionChange(deleteKeys(motion, selected), "Delete keyframes");
      setSelected(new Set());
    }
  }

  return (
    <section
      className="timeline-panel"
      aria-label="Animation timeline"
      onKeyDown={handleKeys}
      style={{ "--timeline-frame-width": `${Math.round(42 * timelineZoom)}px` } as CSSProperties}
    >
      <TimelineTransport
        motion={motion}
        frame={frame}
        playing={playing}
        previewRate={previewRate}
        timelineZoom={timelineZoom}
        autoKey={autoKey}
        onionSkin={onionSkin}
        readOnly={readOnly}
        onFrameChange={onFrameChange}
        onPlayingChange={onPlayingChange}
        onPreviewRateChange={setPreviewRate}
        onTimelineZoomChange={setTimelineZoom}
        onAutoKeyChange={(value) => {
          setLocalAutoKey(value);
          onAutoKeyChange?.(value);
        }}
        onOnionSkinChange={(value) => {
          setLocalOnionSkin(value);
          onOnionSkinChange?.(value);
        }}
        onMotionChange={onMotionChange}
      />
      <MotionHelpers
        motion={motion}
        readOnly={helperReadOnly}
        onMotionChange={onMotionChange}
        onBakeHelper={onBakeHelper}
      />
      <div className="timeline-commands">
        <button type="button" disabled={readOnly || !onAddPoseKey} onClick={onAddPoseKey}>
          Add/update pose key
        </button>
        <button type="button" disabled={readOnly || !canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" disabled={readOnly || !canRedo} onClick={onRedo}>
          Redo
        </button>
        <button
          type="button"
          disabled={readOnly || selected.size === 0}
          onClick={() => setClipboard(copyKeys(motion, selected))}
        >
          Copy
        </button>
        <button
          type="button"
          disabled={readOnly || clipboard.length === 0}
          onClick={() => onMotionChange(pasteKeys(motion, clipboard, frame), "Paste keyframes")}
        >
          Paste
        </button>
        <button
          type="button"
          disabled={readOnly || selected.size === 0}
          onClick={() =>
            onMotionChange(
              pasteKeys(
                motion,
                copyKeys(motion, selected),
                Math.min(frame + 1, motion.frame_count - 1),
              ),
              "Duplicate keyframes",
            )
          }
        >
          Duplicate
        </button>
        <button
          type="button"
          aria-label="Move selected keys left"
          disabled={readOnly || selected.size === 0}
          onClick={() => moveSelection(-1)}
        >
          −1
        </button>
        <button
          type="button"
          aria-label="Move selected keys right"
          disabled={readOnly || selected.size === 0}
          onClick={() => moveSelection(1)}
        >
          +1
        </button>
        <button
          type="button"
          disabled={readOnly || selected.size === 0}
          onClick={() => {
            onMotionChange(deleteKeys(motion, selected), "Delete keyframes");
            setSelected(new Set());
          }}
        >
          Delete
        </button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setRetimeValue(motion.frame_count)}
        >
          Change length…
        </button>
        <button type="button" disabled={readOnly || !onSave} onClick={onSave}>
          Save
        </button>
        <span>
          {autoKey ? "Edits create keys" : "Only existing keys change"} ·{" "}
          {onionSkin ? "neighbors visible" : "neighbors hidden"} · {motion.loop_mode}
        </span>
      </div>
      <TimelineRows
        motion={motion}
        frame={frame}
        frameWidth={frameWidth}
        visibleTracks={visibleTracks}
        selected={selected}
        collapsed={collapsed}
        readOnly={readOnly}
        onFrameChange={onFrameChange}
        onSelectKey={selectKey}
        onToggleCollapsed={(trackIndex) =>
          setCollapsed((current) => toggleNumber(current, trackIndex))
        }
        onInterpolationChange={(trackIndex, interpolation) =>
          onMotionChange(
            setTrackInterpolation(motion, trackIndex, interpolation),
            "Change interpolation",
          )
        }
      />
      {retime && (
        <RetimeDialog
          preview={retime}
          mode={retimeMode}
          onModeChange={setRetimeMode}
          onFrameCountChange={setRetimeValue}
          onApply={() => commitRetime(retimeMode === "distribute" || retime.affected.length > 0)}
          onCancel={() => setRetimeValue(null)}
        />
      )}
    </section>
  );
}

function MotionHelpers<T extends PlayableMotion>({
  motion,
  readOnly,
  onMotionChange,
  onBakeHelper,
}: {
  motion: T;
  readOnly: boolean;
  onMotionChange: (motion: T, label: string) => void;
  onBakeHelper?: (helperIndex: number) => void;
}) {
  const semantics = motion.semantics;
  if (!semantics) return <span className="timeline-helper-spacer" aria-hidden="true" />;

  function setJumpHeightMode(mode: JumpHeightMode): void {
    const helpers = semantics!.helpers.map((helper) =>
      helper.kind === "jump_height" ? { ...helper, enabled: mode === "baked_into_frames" } : helper,
    );
    onMotionChange(
      {
        ...motion,
        semantics: { ...semantics!, jump_height_mode: mode, helpers },
      },
      mode === "external_game_motion"
        ? "Use external game jump height"
        : "Bake jump height into frames",
    );
  }

  return (
    <section className="motion-helpers" aria-label="Motion helpers">
      <div className="motion-helper-summary">
        <strong>{label(semantics.preset)} preset</strong>
        <span>In-place root motion</span>
        {semantics.recommended_speed_px_per_second && (
          <span>{semantics.recommended_speed_px_per_second} px/s recommended game speed</span>
        )}
        {semantics.jump_height_mode !== "not_applicable" && (
          <label>
            Jump height
            <select
              aria-label="Jump height handling"
              disabled={readOnly}
              value={semantics.jump_height_mode}
              onChange={(event) => setJumpHeightMode(event.target.value as JumpHeightMode)}
            >
              <option value="baked_into_frames">Baked into frames</option>
              <option value="external_game_motion">External game motion</option>
            </select>
          </label>
        )}
        {semantics.ground_shadow && (
          <label>
            <input
              type="checkbox"
              checked={semantics.ground_shadow.enabled}
              disabled={readOnly}
              onChange={(event) =>
                onMotionChange(
                  {
                    ...motion,
                    semantics: {
                      ...semantics,
                      ground_shadow: {
                        ...semantics.ground_shadow!,
                        enabled: event.target.checked,
                      },
                    },
                  },
                  `${event.target.checked ? "Show" : "Hide"} ground shadow`,
                )
              }
            />
            Ground shadow
          </label>
        )}
      </div>
      {semantics.helpers.length === 0 ? (
        <span className="motion-helper-empty">
          No procedural helpers; every pose is a normal key.
        </span>
      ) : (
        semantics.helpers.map((helper, index) => (
          <div className="motion-helper-channel" key={`${helper.kind}-${helper.slot_id}-${index}`}>
            <label>
              <input
                type="checkbox"
                checked={helper.enabled}
                disabled={readOnly}
                onChange={(event) => {
                  const helpers = semantics.helpers.map((candidate, candidateIndex) =>
                    candidateIndex === index
                      ? { ...candidate, enabled: event.target.checked }
                      : candidate,
                  );
                  onMotionChange(
                    { ...motion, semantics: { ...semantics, helpers } },
                    `${event.target.checked ? "Enable" : "Disable"} ${label(helper.kind)} helper`,
                  );
                }}
              />
              {label(helper.kind)}
            </label>
            <span>
              {helper.slot_id} · {label(helper.property)} · {helper.amplitude}px/deg
            </span>
            <button
              type="button"
              disabled={readOnly || !helper.enabled || !onBakeHelper}
              onClick={() => onBakeHelper?.(index)}
            >
              Convert to keys
            </button>
          </div>
        ))
      )}
    </section>
  );
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

interface TransportProps<T extends PlayableMotion> {
  motion: T;
  frame: number;
  playing: boolean;
  previewRate: number;
  timelineZoom: number;
  autoKey: boolean;
  onionSkin: boolean;
  readOnly: boolean;
  onFrameChange: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onPreviewRateChange: (value: number) => void;
  onTimelineZoomChange: (value: number) => void;
  onAutoKeyChange: (value: boolean) => void;
  onOnionSkinChange: (value: boolean) => void;
  onMotionChange: (motion: T, label: string) => void;
}

function TimelineTransport<T extends PlayableMotion>({
  motion,
  frame,
  playing,
  previewRate,
  timelineZoom,
  autoKey,
  onionSkin,
  readOnly,
  onFrameChange,
  onPlayingChange,
  onPreviewRateChange,
  onTimelineZoomChange,
  onAutoKeyChange,
  onOnionSkinChange,
  onMotionChange,
}: TransportProps<T>) {
  return (
    <div className="timeline-transport">
      <button
        type="button"
        aria-label="Previous frame"
        onClick={() => onFrameChange(Math.max(0, frame - 1))}
      >
        ←
      </button>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => onPlayingChange(!playing)}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <button
        type="button"
        aria-label="Next frame"
        onClick={() => onFrameChange(Math.min(motion.frame_count - 1, frame + 1))}
      >
        →
      </button>
      <output aria-label="Current frame">
        {frame + 1} / {motion.frame_count}
      </output>
      <label>
        Scrub{" "}
        <input
          aria-label="Scrub timeline"
          type="range"
          min={0}
          max={motion.frame_count - 1}
          value={frame}
          onChange={(event) => onFrameChange(Number(event.target.value))}
        />
      </label>
      <label>
        FPS{" "}
        <input
          aria-label="Stored FPS"
          type="number"
          min={1}
          max={120}
          disabled={readOnly}
          value={motion.fps}
          onChange={(event) => {
            const fps = Number(event.target.value);
            if (fps >= 1 && fps <= 120) onMotionChange({ ...motion, fps }, `Set FPS to ${fps}`);
          }}
        />
      </label>
      <label>
        Preview speed{" "}
        <select
          value={previewRate}
          onChange={(event) => onPreviewRateChange(Number(event.target.value))}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </label>
      <label>
        Timeline zoom{" "}
        <input
          type="range"
          min={0.75}
          max={2}
          step={0.25}
          value={timelineZoom}
          onChange={(event) => onTimelineZoomChange(Number(event.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={autoKey}
          disabled={readOnly}
          onChange={(event) => onAutoKeyChange(event.target.checked)}
        />{" "}
        Auto-key
      </label>
      <label>
        <input
          type="checkbox"
          checked={onionSkin}
          onChange={(event) => onOnionSkinChange(event.target.checked)}
        />{" "}
        Neighbor poses
      </label>
    </div>
  );
}

interface RowsProps<T extends PlayableMotion> {
  motion: T;
  frame: number;
  frameWidth: number;
  visibleTracks: Array<{ track: MotionTrack; trackIndex: number }>;
  selected: ReadonlySet<string>;
  collapsed: ReadonlySet<number>;
  readOnly: boolean;
  onFrameChange: (frame: number) => void;
  onSelectKey: (trackIndex: number, frame: number, extend: boolean, additive: boolean) => void;
  onToggleCollapsed: (trackIndex: number) => void;
  onInterpolationChange: (trackIndex: number, interpolation: Interpolation) => void;
}

function TimelineRows<T extends PlayableMotion>({
  motion,
  frame,
  frameWidth,
  visibleTracks,
  selected,
  collapsed,
  readOnly,
  onFrameChange,
  onSelectKey,
  onToggleCollapsed,
  onInterpolationChange,
}: RowsProps<T>) {
  const width = 190 + motion.frame_count * frameWidth;
  return (
    <div className="timeline-scroll" role="grid" aria-label="Tracks and keyframes">
      <div
        className="timeline-ruler"
        style={{
          minWidth: width,
          gridTemplateColumns: `190px repeat(${motion.frame_count}, ${frameWidth}px)`,
        }}
      >
        <i />
        {Array.from({ length: motion.frame_count }, (_, index) => (
          <button
            type="button"
            aria-label={`Scrub to frame ${index}`}
            data-active={frame === index}
            key={index}
            onClick={() => onFrameChange(index)}
          >
            {index}
          </button>
        ))}
      </div>
      {visibleTracks.length === 0 && (
        <p className="timeline-empty">
          No keys for this direction. Enable Auto-key and edit a part, or add the selected pose.
        </p>
      )}
      {visibleTracks.map(({ track, trackIndex }) => {
        const discrete = ["visible", "sprite_variant", "layer_delta"].includes(track.property);
        const isCollapsed = collapsed.has(trackIndex);
        return (
          <div
            className="timeline-track"
            role="row"
            key={`${track.direction}-${track.slot_id}-${track.property}`}
            style={{ minWidth: width }}
          >
            <div className="timeline-track-heading" role="rowheader">
              <button
                type="button"
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${track.slot_id} ${track.property}`}
                onClick={() => onToggleCollapsed(trackIndex)}
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
              <span>
                {track.slot_id} · {track.property}
              </span>
              <select
                aria-label={`${track.slot_id} ${track.property} interpolation`}
                disabled={readOnly || discrete}
                value={track.interpolation}
                onChange={(event) =>
                  onInterpolationChange(trackIndex, event.target.value as Interpolation)
                }
              >
                <option value="linear">Linear</option>
                <option value="hold">Hold</option>
                <option value="ease_in_out">Ease in/out</option>
              </select>
            </div>
            {!isCollapsed && (
              <div
                className="timeline-lane"
                style={{ backgroundSize: `calc(100% / ${motion.frame_count}) 100%` }}
              >
                {track.keys.map((key) => {
                  const id = keyId({ trackIndex, frame: key.frame });
                  return (
                    <button
                      type="button"
                      role="gridcell"
                      className="timeline-key"
                      aria-label={`${track.slot_id} ${track.property} key at frame ${key.frame}`}
                      aria-selected={selected.has(id)}
                      style={{ left: `${((key.frame + 0.5) / motion.frame_count) * 100}%` }}
                      key={id}
                      onClick={(event) =>
                        onSelectKey(
                          trackIndex,
                          key.frame,
                          event.shiftKey,
                          event.ctrlKey || event.metaKey,
                        )
                      }
                    />
                  );
                })}
                <span
                  className="timeline-playhead"
                  style={{ left: `${((frame + 0.5) / motion.frame_count) * 100}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface RetimeDialogProps {
  preview: ReturnType<typeof previewRetime>;
  mode: RetimeMode;
  onModeChange: (mode: RetimeMode) => void;
  onFrameCountChange: (frames: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

function RetimeDialog({
  preview,
  mode,
  onModeChange,
  onFrameCountChange,
  onApply,
  onCancel,
}: RetimeDialogProps) {
  const framesInput = useRef<HTMLInputElement>(null);
  const { dialogRef, onDialogKeyDown } = useModalFocus<HTMLDivElement>({
    initialFocus: framesInput,
    onEscape: onCancel,
  });
  return (
    <div
      ref={dialogRef}
      className="timeline-retime"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retime-title"
      onKeyDown={onDialogKeyDown}
    >
      <strong id="retime-title">Change animation length</strong>
      <label>
        Frames{" "}
        <input
          ref={framesInput}
          type="number"
          min={1}
          max={1024}
          value={preview.newFrameCount}
          onChange={(event) => onFrameCountChange(Number(event.target.value))}
        />
      </label>
      <label>
        Method{" "}
        <select
          aria-label="Retime method"
          value={mode}
          onChange={(event) => onModeChange(event.target.value as RetimeMode)}
        >
          <option value="trim">Add/remove frames at end</option>
          <option value="distribute">Distribute keys in time</option>
        </select>
      </label>
      <p>
        {mode === "distribute"
          ? `${preview.moved} keyframe(s) will move proportionally; collisions keep the later key.`
          : preview.affected.length === 0
            ? "No keyframes will be removed."
            : `${preview.affected.length} keyframe(s) will be removed. This requires confirmation.`}
      </p>
      <button type="button" onClick={onApply}>
        {mode === "trim" && preview.affected.length > 0 ? "Confirm truncation" : "Apply"}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function usePlayback(
  motion: PlayableMotion,
  frame: number,
  playing: boolean,
  previewRate: number,
  onFrameChange: (frame: number) => void,
  onPlayingChange: (playing: boolean) => void,
): void {
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(
      () => {
        const next = frame + 1;
        if (next < motion.frame_count) onFrameChange(next);
        else if (motion.loop_mode === "loop") onFrameChange(0);
        else onPlayingChange(false);
      },
      1000 / (motion.fps * previewRate),
    );
    return () => window.clearInterval(interval);
  }, [
    frame,
    motion.fps,
    motion.frame_count,
    motion.loop_mode,
    onFrameChange,
    onPlayingChange,
    playing,
    previewRate,
  ]);
}

function toggle(values: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
function toggleNumber(values: ReadonlySet<number>, value: number): Set<number> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function isTimelineGridCell(target: EventTarget): boolean {
  return target instanceof Element && target.closest("[role='gridcell']") !== null;
}
