import { useEffect, useRef } from "react";

import type { OutfitEditorContext, OutfitPreviewFrame } from "../../api/outfit-client";
import type { Direction } from "../../domain";
import { directions, missingRequiredSlots } from "./outfit-state";

interface OutfitPreviewProps {
  context: OutfitEditorContext;
  preview: OutfitPreviewFrame | null;
  previewError: string | null;
  direction: Direction;
  frame: number;
  playing: boolean;
  outlineOpacity: number;
  selectedSlot: string;
  missing: ReturnType<typeof missingRequiredSlots>;
  onDirection: (value: Direction) => void;
  onFrame: (value: number) => void;
  onTogglePlaying: () => void;
  onOutlineOpacity: (value: number) => void;
}

export function OutfitPreview({
  context,
  preview,
  previewError,
  direction,
  frame,
  playing,
  outlineOpacity,
  selectedSlot,
  missing,
  onDirection,
  onFrame,
  onTogglePlaying,
  onOutlineOpacity,
}: OutfitPreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!preview || !canvas.current) return;
    const drawing = canvas.current.getContext("2d");
    if (!drawing) return;
    canvas.current.width = preview.width;
    canvas.current.height = preview.height;
    const image = drawing.createImageData(preview.width, preview.height);
    image.data.set(preview.rgba);
    drawing.putImageData(image, 0, 0);
  }, [preview]);
  const [width, height] = context.motion.frame_size_px;
  const selectedGuide = preview?.guides.find((guide) => guide.slot_id === selectedSlot);
  return (
    <aside className="outfit-preview-panel" aria-labelledby="outfit-preview-title">
      <div className="outfit-panel-heading">
        <div>
          <span>Composed output</span>
          <h2 id="outfit-preview-title">Live preview</h2>
        </div>
        <select
          aria-label="Preview direction"
          value={direction}
          onChange={(event) => onDirection(event.target.value as Direction)}
        >
          {directions.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="outfit-canvas" style={{ aspectRatio: `${width} / ${height}` }}>
        <canvas ref={canvas} aria-label="Composed NPC frame" />
        <svg
          className="outfit-dummy-guide"
          data-exported="false"
          aria-label="Dummy outline (preview only)"
          viewBox={`0 0 ${width} ${height}`}
          style={{ opacity: outlineOpacity }}
        >
          {preview?.guides.map((guide) => (
            <g key={guide.slot_id} transform={svgMatrix(guide.dummy_transform)}>
              <rect
                x={-guide.slot_pivot_px[0]}
                y={-guide.slot_pivot_px[1]}
                width={guide.slot_size_px[0]}
                height={guide.slot_size_px[1]}
              />
            </g>
          ))}
          {selectedGuide && (
            <g
              className="outfit-local-guides"
              data-exported="false"
              aria-label="Local axes and pivot (preview only)"
              transform={svgMatrix(selectedGuide.image_transform)}
            >
              <line className="outfit-local-axis-x" x1="0" y1="0" x2="3" y2="0" />
              <line className="outfit-local-axis-y" x1="0" y1="0" x2="0" y2="3" />
              <circle cx="0" cy="0" r="0.75" />
            </g>
          )}
        </svg>
        {selectedGuide && (
          <span
            className="outfit-selection-handle"
            data-exported="false"
            aria-label="Selection handle (preview only)"
            style={{
              left: `${(selectedGuide.image_transform[4] / width) * 100}%`,
              top: `${(selectedGuide.image_transform[5] / height) * 100}%`,
            }}
          />
        )}
      </div>
      {previewError && <p role="alert">Preview: {previewError}</p>}
      {preview?.guides_included && (
        <p role="alert">Preview service incorrectly included editor guides.</p>
      )}
      <div className="outfit-playback">
        <button
          type="button"
          aria-label="Previous frame"
          onClick={() =>
            onFrame((frame - 1 + context.motion.frame_count) % context.motion.frame_count)
          }
        >
          ◀
        </button>
        <button type="button" onClick={onTogglePlaying}>
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          aria-label="Next frame"
          onClick={() => onFrame((frame + 1) % context.motion.frame_count)}
        >
          ▶
        </button>
        <output>
          Frame {frame + 1} / {context.motion.frame_count}
        </output>
      </div>
      <label className="outfit-outline-slider">
        Dummy outline
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={outlineOpacity}
          onChange={(event) => onOutlineOpacity(Number(event.target.value))}
        />
        <output>{Math.round(outlineOpacity * 100)}%</output>
      </label>
      <p className="outfit-guide-note">
        Outline, local axes, pivots, and selection handles are preview-only and excluded from RGBA
        output.
      </p>
      {missing.length > 0 && (
        <p>{missing.length} required slot group(s) still use neutral placeholders.</p>
      )}
      {preview && preview.clipping.length > 0 && (
        <p>{preview.clipping.length} visible part(s) clip the frame boundary.</p>
      )}
    </aside>
  );
}

function svgMatrix(matrix: [number, number, number, number, number, number]): string {
  return `matrix(${matrix.join(" ")})`;
}
