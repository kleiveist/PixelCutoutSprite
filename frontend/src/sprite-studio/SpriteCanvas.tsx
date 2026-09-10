import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SpriteSceneEnvelope, PartId } from "../shared/image/contracts";
import {
  fitImage,
  zoomAt,
  toSource,
  type ImageViewport,
  type Point,
} from "../shared/image/viewport";
import type { LoadedSprite, SpritePixels } from "./client";
import { backToFront, layerMatrix, hitTest, sceneBounds } from "./geometry";
import styles from "./SpriteStudio.module.css";

export function SpriteCanvas({
  loaded,
  scene,
  pixels,
  textures,
  selected,
  onSelect,
  onBeginMove,
  onMove,
  onEndMove,
  onCancelMove,
  onNudge,
  onUndo,
  onRedo,
}: {
  readonly loaded: LoadedSprite;
  readonly scene: SpriteSceneEnvelope;
  readonly pixels: SpritePixels;
  readonly textures: ReadonlyMap<string, HTMLCanvasElement>;
  readonly selected: PartId | null;
  readonly onSelect: (id: PartId) => void;
  readonly onBeginMove: (id: PartId) => boolean;
  readonly onMove: (delta: Point) => void;
  readonly onEndMove: () => void;
  readonly onCancelMove: () => void;
  readonly onNudge: (delta: Point) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 640, height: 400 }),
    [dpr, setDpr] = useState(window.devicePixelRatio || 1);
  const [view, setView] = useState<ImageViewport>({ scale: 1, offset: { x: 0, y: 0 } });
  const gesture = useRef<{
    id: number;
    start: Point;
    view: ImageViewport;
    mode: "pan" | "move";
  } | null>(null);
  const cancelAction = useRef(onCancelMove);
  cancelAction.current = onCancelMove;
  const cancel = () => {
    if (gesture.current?.mode === "move") cancelAction.current();
    gesture.current = null;
  };
  const bounds = sceneBounds(scene.layers, loaded.assets);
  const frame = loaded.manifest
    ? {
        x: Math.min(0, bounds.x),
        y: Math.min(0, bounds.y),
        width:
          Math.max(loaded.manifest.source.width, bounds.x + bounds.width) - Math.min(0, bounds.x),
        height:
          Math.max(loaded.manifest.source.height, bounds.y + bounds.height) - Math.min(0, bounds.y),
      }
    : bounds;
  const fit = () => {
    const fitted = fitImage(frame, {
      width: Math.max(1, size.width - 24),
      height: Math.max(1, size.height - 24),
    });
    return {
      scale: fitted.scale,
      offset: {
        x: fitted.offset.x + 12 - frame.x * fitted.scale,
        y: fitted.offset.y + 12 - frame.y * fitted.scale,
      },
    };
  };
  const latestFit = useRef(fit);
  latestFit.current = fit;
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) setSize({ width: box.width, height: box.height });
      setDpr(window.devicePixelRatio || 1);
      if (gesture.current?.mode === "move") cancelAction.current();
      gesture.current = null;
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
    setView(latestFit.current());
    gesture.current = null;
  }, [loaded.directory, loaded.documentSha256, size]);
  useEffect(() => {
    const node = canvas.current,
      context = node?.getContext("2d");
    if (!node || !context) return;
    node.width = Math.max(1, Math.round(size.width * dpr));
    node.height = Math.max(1, Math.round(size.height * dpr));
    context.clearRect(0, 0, node.width, node.height);
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = "source-over";
    for (const layer of backToFront(scene.layers)) {
      const texture = textures.get(layer.partId);
      if (!layer.visible || !texture || !texture.width) continue;
      const [a, b, c, d, e, f] = layerMatrix(layer),
        s = view.scale * dpr;
      context.setTransform(
        a * s,
        b * s,
        c * s,
        d * s,
        (e * view.scale + view.offset.x) * dpr,
        (f * view.scale + view.offset.y) * dpr,
      );
      context.drawImage(texture, 0, 0);
    }
    context.resetTransform();
  }, [scene, textures, view, size, dpr]);
  const cssPoint = (event: ReactPointerEvent): Point => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  return (
    <section className={styles.canvasPanel} aria-label="Sprite-Ansicht">
      <div className={styles.controls}>
        <button type="button" onClick={() => setView(fit())}>
          Figur einpassen
        </button>
        <button
          type="button"
          aria-label="Sprite verkleinern"
          onClick={() => setView(zoomAt(view, { x: size.width / 2, y: size.height / 2 }, 0.5))}
        >
          −
        </button>
        <output aria-label="Sprite-Zoom">{Math.round(view.scale * 100)} %</output>
        <button
          type="button"
          aria-label="Sprite vergrößern"
          onClick={() => setView(zoomAt(view, { x: size.width / 2, y: size.height / 2 }, 2))}
        >
          +
        </button>
      </div>
      <div className={styles.canvasHost}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          role="img"
          tabIndex={0}
          aria-label="Sprite-Zusammenstellung im Quellpixelraum"
          onPointerDown={(event) => {
            if (gesture.current || (event.button !== 0 && event.button !== 1)) return;
            const point = cssPoint(event);
            canvas.current?.focus();
            canvas.current?.setPointerCapture(event.pointerId);
            if (event.button === 1 || event.shiftKey)
              gesture.current = { id: event.pointerId, start: point, view, mode: "pan" };
            else {
              const id = hitTest(toSource(point, view), scene.layers, loaded.assets, pixels);
              if (id) {
                onSelect(id);
                if (onBeginMove(id))
                  gesture.current = { id: event.pointerId, start: point, view, mode: "move" };
              }
            }
          }}
          onPointerMove={(event) => {
            const active = gesture.current;
            if (!active || active.id !== event.pointerId) return;
            const point = cssPoint(event);
            if (active.mode === "move") {
              const start = toSource(active.start, active.view),
                next = toSource(point, active.view);
              onMove({ x: next.x - start.x, y: next.y - start.y });
              return;
            }
            setView({
              ...active.view,
              offset: {
                x: active.view.offset.x + point.x - active.start.x,
                y: active.view.offset.y + point.y - active.start.y,
              },
            });
          }}
          onPointerUp={(event) => {
            if (gesture.current?.id !== event.pointerId) return;
            if (gesture.current.mode === "move") onEndMove();
            gesture.current = null;
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
              event.preventDefault();
              if (event.shiftKey) onRedo();
              else onUndo();
            }
            const distance = event.shiftKey ? 10 : 1;
            const delta: Record<string, Point> = {
              ArrowLeft: { x: -distance, y: 0 },
              ArrowRight: { x: distance, y: 0 },
              ArrowUp: { x: 0, y: -distance },
              ArrowDown: { x: 0, y: distance },
            };
            if (delta[event.key] && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              onNudge(delta[event.key]!);
            }
          }}
        />
      </div>
      <p>
        Nearest-Neighbor · Source-over · Klick wählt den vordersten sichtbaren Quellpixel. Mittlere
        Maustaste oder Umschalt+Ziehen verschiebt nur die Ansicht. Ziehen verschiebt eine entsperrte
        Ebene; Escape oder Resize verwirft den laufenden Zug. Pfeiltasten: 1 Pixel,
        Umschalt+Pfeiltaste: 10 Pixel. Strg/Cmd+Z: Rückgängig, mit Umschalt: Wiederholen.
      </p>
      <p role="status">{selected ? `Ausgewählte Ebene: ${selected}` : "Keine Ebene ausgewählt"}</p>
    </section>
  );
}
