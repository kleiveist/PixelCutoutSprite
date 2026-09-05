import { useEffect, useState } from "react";

import "./MotionCardPreview.css";
import { shouldAnimatePreview } from "./preview-policy";

interface MotionCardPreviewProps {
  name: string;
  frameUrls: readonly string[];
  fps: number;
  visible: boolean;
  activated?: boolean;
  reducedMotion?: boolean;
}

export function MotionCardPreview({
  name,
  frameUrls,
  fps,
  visible,
  activated = false,
  reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
}: MotionCardPreviewProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [frame, setFrame] = useState(0);
  const animate = shouldAnimatePreview({
    visible,
    hovered,
    focused,
    activated,
    reducedMotion,
  });

  useEffect(() => {
    if (!animate || frameUrls.length < 2) return;
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % frameUrls.length),
      1000 / Math.max(1, fps),
    );
    return () => window.clearInterval(timer);
  }, [animate, fps, frameUrls.length]);

  useEffect(() => {
    if (!visible || reducedMotion) setFrame(0);
  }, [reducedMotion, visible]);

  return (
    <figure
      className="motion-card-preview"
      tabIndex={0}
      aria-label={`${name} stored motion preview`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {frameUrls.length > 0 ? (
        <img
          src={frameUrls[frame] ?? frameUrls[0]}
          alt={`${name} preview frame ${frame + 1}`}
          draggable={false}
        />
      ) : (
        <span>No rendered preview</span>
      )}
      <figcaption>{animate ? "Playing stored frames" : "Stored frame"}</figcaption>
    </figure>
  );
}
