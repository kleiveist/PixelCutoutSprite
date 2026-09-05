import { useEffect, useRef, useState } from "react";

import type { CreateMotionRequest } from "../../domain/animations";
import type { PixelPoint, PixelSize } from "../../domain/common";
import type { LoopMode, MotionPresetKind } from "../../domain/motion";

const presetOptions: Array<{
  kind: MotionPresetKind;
  label: string;
  frames: number;
  fps: number;
  loop: LoopMode;
  note: string;
}> = [
  { kind: "idle", label: "Idle", frames: 8, fps: 8, loop: "loop", note: "Subtle breathing" },
  { kind: "walk", label: "Walk", frames: 12, fps: 12, loop: "loop", note: "48 px/s guide" },
  { kind: "sprint", label: "Sprint", frames: 8, fps: 16, loop: "loop", note: "88 px/s guide" },
  { kind: "jump", label: "Jump", frames: 12, fps: 12, loop: "once", note: "Baked height" },
  { kind: "interact", label: "Interact", frames: 8, fps: 10, loop: "once", note: "Neutral reach" },
  { kind: "attack", label: "Attack", frames: 6, fps: 12, loop: "once", note: "Neutral strike" },
];

interface MotionCreateDialogProps {
  areaId: string;
  defaultFrameSize: PixelSize;
  defaultGroundOrigin: PixelPoint;
  open: boolean;
  onClose: () => void;
  onCreate: (request: CreateMotionRequest) => Promise<void>;
}

export function MotionCreateDialog({
  areaId,
  defaultFrameSize,
  defaultGroundOrigin,
  open,
  onClose,
  onCreate,
}: MotionCreateDialogProps) {
  const [name, setName] = useState("Walk");
  const [actionKey, setActionKey] = useState("walk");
  const [presetKind, setPresetKind] = useState<MotionPresetKind | "custom">("walk");
  const [frameCount, setFrameCount] = useState(12);
  const [fps, setFps] = useState(12);
  const [loopMode, setLoopMode] = useState<"loop" | "once">("loop");
  const [frameWidth, setFrameWidth] = useState(defaultFrameSize[0]);
  const [frameHeight, setFrameHeight] = useState(defaultFrameSize[1]);
  const [groundX, setGroundX] = useState(defaultGroundOrigin[0]);
  const [groundY, setGroundY] = useState(defaultGroundOrigin[1]);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameInput.current?.focus();
  }, [open]);
  if (!open) return null;

  const valid =
    name.trim().length > 0 &&
    /^[a-z][a-z0-9_]{0,63}$/.test(actionKey) &&
    Number.isInteger(frameCount) &&
    frameCount >= 1 &&
    frameCount <= 1024 &&
    Number.isInteger(fps) &&
    fps >= 1 &&
    fps <= 120 &&
    [frameWidth, frameHeight].every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 1024,
    ) &&
    [groundX, groundY].every((value) => Number.isInteger(value) && value >= -2048 && value <= 2048);

  return (
    <div className="motion-dialog-backdrop" role="presentation">
      <form
        className="motion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-motion-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          void onCreate({
            area_id: areaId,
            name: name.trim(),
            action_key: actionKey,
            frame_count: frameCount,
            fps,
            loop_mode: loopMode,
            frame_size_px: [frameWidth, frameHeight],
            ground_origin_px: [groundX, groundY],
            label_ids: [],
            preset_kind: presetKind === "custom" ? null : presetKind,
          }).finally(() => setBusy(false));
        }}
      >
        <header>
          <span>NEW TEMPLATE</span>
          <h2 id="new-motion-title">Create animation</h2>
          <p>Frame canvas and profile height are independent values.</p>
        </header>
        <div className="motion-dialog-grid">
          <label className="motion-preset-field">
            Starting motion
            <select
              value={presetKind}
              onChange={(event) => {
                const next = event.target.value as MotionPresetKind | "custom";
                setPresetKind(next);
                const preset = presetOptions.find((candidate) => candidate.kind === next);
                if (!preset) return;
                setName(preset.label);
                setActionKey(preset.kind);
                setFrameCount(preset.frames);
                setFps(preset.fps);
                setLoopMode(preset.loop);
              }}
            >
              {presetOptions.map((preset) => (
                <option key={preset.kind} value={preset.kind}>
                  {preset.label} · {preset.note}
                </option>
              ))}
              <option value="custom">Custom empty motion</option>
            </select>
          </label>
          <label>
            Name
            <input ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Action type
            <input
              aria-describedby="action-key-help"
              value={actionKey}
              onChange={(event) => setActionKey(event.target.value)}
            />
          </label>
          <small id="action-key-help">Lowercase identifier, for example walk or jump.</small>
          <NumberField
            label="Frames"
            min={1}
            max={1024}
            value={frameCount}
            onChange={setFrameCount}
          />
          <NumberField label="FPS" min={1} max={120} value={fps} onChange={setFps} />
          <label>
            Loop
            <select
              value={loopMode}
              onChange={(event) => setLoopMode(event.target.value as "loop" | "once")}
            >
              <option value="loop">Loop</option>
              <option value="once">Play once</option>
            </select>
          </label>
          <NumberField
            label="Frame width"
            min={1}
            max={1024}
            value={frameWidth}
            onChange={setFrameWidth}
          />
          <NumberField
            label="Frame height"
            min={1}
            max={1024}
            value={frameHeight}
            onChange={setFrameHeight}
          />
          <NumberField
            label="Ground X"
            min={-2048}
            max={2048}
            value={groundX}
            onChange={setGroundX}
          />
          <NumberField
            label="Ground Y"
            min={-2048}
            max={2048}
            value={groundY}
            onChange={setGroundY}
          />
        </div>
        {!valid && (
          <p className="motion-validation" role="alert">
            Use valid timing, canvas, anchor, name, and action values.
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={!valid || busy}>
            {busy ? "Creating…" : "Create and open dummy"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
