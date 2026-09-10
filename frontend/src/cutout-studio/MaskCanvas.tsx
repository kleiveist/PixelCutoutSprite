import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  fitImage,
  toSource,
  zoomAt,
  type ImageViewport,
  type Point,
  type Size,
} from "../shared/image/viewport";
import { brush, lasso, rectangle, union, type MaskTool, type Runs } from "./masks";
import styles from "./CutoutEditor.module.css";

interface Props {
  readonly pixels: Uint8ClampedArray;
  readonly size: Size;
  readonly sourceKey: string;
  readonly partId: string;
  readonly runs: Runs;
  readonly confirmed: Runs;
  readonly positive: Runs;
  readonly negative: Runs;
  readonly protectedRuns: Runs;
  readonly tool: MaskTool;
  readonly radius: number;
  readonly readOnly: boolean;
  readonly onStroke: (tool: MaskTool, runs: Runs) => void;
  readonly onConfirm: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}
interface Gesture {
  readonly id: number;
  readonly tool: MaskTool;
  readonly startCss: Point;
  readonly view: ImageViewport;
  points: Point[];
  runs: Runs;
}
function drawRuns(
  context: CanvasRenderingContext2D,
  runs: Runs,
  width: number,
  color: string,
): void {
  context.fillStyle = color;
  for (const [start, length] of runs) {
    let index = start;
    const end = start + length;
    while (index < end) {
      const row = Math.floor(index / width),
        x = index % width,
        span = Math.min(end - index, width - x);
      context.fillRect(x, row, span, 1);
      index += span;
    }
  }
}

export function MaskCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null),
    overlay = useRef<HTMLCanvasElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [viewSize, setViewSize] = useState<Size>({ width: 640, height: 400 });
  const [view, setView] = useState<ImageViewport>(() => fitImage(props.size, viewSize));
  const [preview, setPreview] = useState<Runs>([]);
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  const [gestureNotice, setGestureNotice] = useState("");
  const size = props.size;
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      // The host has a border. Fit against the canvas's actual CSS content size,
      // the same rectangle used for pointer inversion, not the outer host box.
      const box = (canvas.current ?? node).getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        if (gesture.current) {
          gesture.current = null;
          setPreview([]);
          setGestureNotice(
            "Größenwechsel: laufender Strich verworfen; gespeicherte Masken bleiben unverändert.",
          );
        }
        setViewSize({ width: box.width, height: box.height });
      }
      setDpr(window.devicePixelRatio || 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const image = document.createElement("canvas");
    image.width = size.width;
    image.height = size.height;
    const context = image.getContext("2d");
    context?.putImageData(
      new ImageData(new Uint8ClampedArray(props.pixels), size.width, size.height),
      0,
      0,
    );
    source.current = image;
    return () => {
      image.width = 0;
      image.height = 0;
      source.current = null;
    };
  }, [props.pixels, size.width, size.height]);
  useEffect(() => {
    setView(fitImage(size, viewSize));
  }, [props.sourceKey, size.width, size.height, viewSize]);
  useEffect(() => {
    gesture.current = null;
    setPreview([]);
  }, [props.partId, props.tool, props.sourceKey]);
  useEffect(() => {
    const mask = document.createElement("canvas");
    mask.width = size.width;
    mask.height = size.height;
    const context = mask.getContext("2d");
    if (context) {
      drawRuns(context, props.confirmed, size.width, "rgba(50, 160, 220, .28)");
      drawRuns(context, props.runs, size.width, "rgba(155, 80, 255, .48)");
      drawRuns(context, props.positive, size.width, "rgba(55, 245, 100, .75)");
      drawRuns(context, props.protectedRuns, size.width, "rgba(255, 195, 35, .75)");
      drawRuns(context, props.negative, size.width, "rgba(255, 55, 65, .75)");
    }
    overlay.current = mask;
    return () => {
      mask.width = 0;
      mask.height = 0;
      overlay.current = null;
    };
  }, [
    props.runs,
    props.confirmed,
    props.positive,
    props.negative,
    props.protectedRuns,
    size.width,
    size.height,
  ]);
  useEffect(() => {
    const node = canvas.current,
      context = node?.getContext("2d");
    if (!node || !context) return;
    node.width = Math.max(1, Math.round(viewSize.width * dpr));
    node.height = Math.max(1, Math.round(viewSize.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewSize.width, viewSize.height);
    context.imageSmoothingEnabled = false;
    context.translate(view.offset.x, view.offset.y);
    context.scale(view.scale, view.scale);
    if (source.current) context.drawImage(source.current, 0, 0);
    if (overlay.current) context.drawImage(overlay.current, 0, 0);
    drawRuns(
      context,
      preview,
      size.width,
      props.tool === "negative" ? "rgba(255, 55, 65, .65)" : "rgba(255, 213, 65, .6)",
    );
  }, [
    view,
    viewSize,
    dpr,
    preview,
    props.runs,
    props.confirmed,
    props.positive,
    props.negative,
    props.protectedRuns,
    props.pixels,
    props.tool,
    size.width,
  ]);

  const cssPoint = (event: ReactPointerEvent): Point => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const sourcePoint = (point: Point): Point => {
    const p = toSource(point, view);
    return {
      x: Math.max(-128, Math.min(size.width + 128, p.x)),
      y: Math.max(-128, Math.min(size.height + 128, p.y)),
    };
  };
  const advance = (event: ReactPointerEvent): Runs => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return [];
    const css = cssPoint(event);
    if (active.tool === "pan") {
      setView({
        ...active.view,
        offset: {
          x: active.view.offset.x + css.x - active.startCss.x,
          y: active.view.offset.y + css.y - active.startCss.y,
        },
      });
      return [];
    }
    const point = sourcePoint(css),
      previous = active.points.at(-1)!;
    if (active.tool === "rectangle") active.runs = rectangle(active.points[0]!, point, size);
    else if (active.tool === "lasso") {
      if (
        active.points.length < 4096 &&
        Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.2
      )
        active.points.push(point);
      active.runs = lasso(active.points, size);
    } else active.runs = union(active.runs, brush([previous, point], props.radius, size));
    if (active.tool !== "lasso") active.points = [active.points[0]!, point];
    setPreview(active.runs);
    return active.runs;
  };
  const cancel = () => {
    gesture.current = null;
    setPreview([]);
    setGestureNotice("Pinselstrich verworfen.");
  };
  return (
    <div className={styles.canvasPanel}>
      <div className={styles.controls} aria-label="Bildansicht">
        <button type="button" onClick={() => setView(fitImage(size, viewSize))}>
          Einpassen
        </button>
        <button
          type="button"
          aria-label="Verkleinern"
          onClick={() =>
            setView(zoomAt(view, { x: viewSize.width / 2, y: viewSize.height / 2 }, 0.8))
          }
        >
          −
        </button>
        <output aria-label="Zoom">{Math.round(view.scale * 100)} %</output>
        <button
          type="button"
          aria-label="Vergrößern"
          onClick={() =>
            setView(zoomAt(view, { x: viewSize.width / 2, y: viewSize.height / 2 }, 1.25))
          }
        >
          +
        </button>
        <span>
          Violett: Entwurf · Blau: bestätigt · Grün/Rot: +/− Seeds · Gold: geschützte Überlappung
        </span>
      </div>
      <div ref={host} className={styles.canvasHost}>
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Maskeneditor im Quellpixelraum"
          aria-describedby="mask-canvas-help"
          className={styles.canvas}
          style={{ cursor: props.tool === "pan" ? "grab" : "crosshair" }}
          onPointerDown={(event) => {
            if (
              gesture.current ||
              (props.readOnly && event.button !== 1 && props.tool !== "pan") ||
              ![0, 1].includes(event.button)
            )
              return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            const css = cssPoint(event),
              point = sourcePoint(css),
              tool = event.button === 1 ? "pan" : props.tool;
            gesture.current = {
              id: event.pointerId,
              tool,
              startCss: css,
              view,
              points: [point],
              runs: [],
            };
            advance(event);
            setGestureNotice("Markierung läuft; Escape verwirft den Strich.");
          }}
          onPointerMove={advance}
          onPointerUp={(event) => {
            const active = gesture.current;
            if (!active || active.id !== event.pointerId) return;
            const runs = advance(event);
            gesture.current = null;
            setPreview([]);
            event.currentTarget.releasePointerCapture(event.pointerId);
            props.onStroke(active.tool, runs);
            setGestureNotice("Markierung übernommen.");
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={() => {
            if (gesture.current) cancel();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              props.onConfirm();
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
              event.preventDefault();
              if (event.shiftKey) props.onRedo();
              else props.onUndo();
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
              event.preventDefault();
              props.onRedo();
            }
          }}
        />
      </div>
      <p id="mask-canvas-help">
        Ziehen markiert; mittlere Maustaste oder „Verschieben“ bewegt die Ansicht. Enter bestätigt,
        Escape verwirft den laufenden Strich. Strg+Z / Strg+Umschalt+Z: Rückgängig / Wiederholen.
        Alternativ die Pixelkoordinaten unten verwenden.
      </p>
      <span className="visually-hidden" role="status">
        {gestureNotice}
      </span>
    </div>
  );
}
