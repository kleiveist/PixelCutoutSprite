import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface PixelScale {
  cssScale: number;
  deviceScale: number;
}

export function devicePixelRatio(): number {
  const value = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Maps every source pixel to an integer count of physical display pixels. */
export function dprSafePixelScale(requestedCssScale: number, dpr: number): PixelScale {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const requested = Number.isFinite(requestedCssScale)
    ? Math.max(1 / safeDpr, requestedCssScale)
    : 1;
  const deviceScale = Math.max(1, Math.round(requested * safeDpr));
  return { cssScale: deviceScale / safeDpr, deviceScale };
}

export function fittedPixelScale(
  sourceWidth: number,
  sourceHeight: number,
  availableCssWidth: number,
  availableCssHeight: number,
  dpr: number,
): PixelScale {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const physicalWidth = Math.max(0, availableCssWidth) * safeDpr;
  const physicalHeight = Math.max(0, availableCssHeight) * safeDpr;
  const deviceScale = Math.max(
    1,
    Math.floor(Math.min(physicalWidth / sourceWidth, physicalHeight / sourceHeight)),
  );
  return { cssScale: deviceScale / safeDpr, deviceScale };
}

export function snapToDevicePixel(value: number, dpr: number): number {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.round(value * safeDpr) / safeDpr;
}

export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(devicePixelRatio);
  useEffect(() => {
    const update = (): void => setDpr(devicePixelRatio());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return dpr;
}

interface PixelViewportProps {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
  height: number;
  width: number;
}

/** A fitting viewport whose rendered surface stays on the physical pixel grid at every DPI. */
export function PixelViewport({
  ariaLabel,
  className = "",
  children,
  height,
  width,
}: PixelViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const dpr = useDevicePixelRatio();
  const [available, setAvailable] = useState({ width, height });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = (): void => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setAvailable({ width: bounds.width, height: bounds.height });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = fittedPixelScale(width, height, available.width, available.height, dpr);
  return (
    <div
      ref={host}
      className={`pixel-viewport ${className}`.trim()}
      aria-label={ariaLabel}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className="pixel-viewport__surface"
        data-device-pixel-scale={scale.deviceScale}
        style={
          {
            "--pixel-surface-width": `${width * scale.cssScale}px`,
            "--pixel-surface-height": `${height * scale.cssScale}px`,
          } as CSSProperties
        }
      >
        {children}
      </div>
      <output className="visually-hidden">
        Pixel preview uses {scale.deviceScale} physical pixels per source pixel at {dpr}× display
        scale.
      </output>
    </div>
  );
}
