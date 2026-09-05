import { useEffect, useRef, useState } from "react";

import type { MotionClient } from "../../api/motion-client";
import type { MotionCard, MotionCardPreviewData } from "../../domain/animations";
import { MotionCardPreview } from "./MotionCardPreview";

interface LiveMotionCardPreviewProps {
  client: MotionClient;
  sessionId: string;
  motion: MotionCard;
}

export function LiveMotionCardPreview({ client, sessionId, motion }: LiveMotionCardPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [preview, setPreview] = useState<MotionCardPreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting === true),
      { rootMargin: "120px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPreview(null);
    setFailed(false);
    if (!visible) return;
    let active = true;
    void client
      .cardPreview(sessionId, motion.id, reducedMotion)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [client, motion.id, motion.revision, motion.updated_at, reducedMotion, sessionId, visible]);

  return (
    <div className="live-motion-preview" ref={host}>
      <MotionCardPreview
        name={motion.name}
        frameUrls={preview?.frame_urls ?? []}
        fps={preview?.fps ?? 1}
        visible={visible}
        reducedMotion={reducedMotion}
      />
      {preview && (
        <small className="motion-preview-source">
          Stored {preview.direction.toUpperCase()} · frames {preview.sample_indices.join(", ")}
          {preview.clipping_count > 0 ? ` · ${preview.clipping_count} clips` : ""}
        </small>
      )}
      {failed && <small className="motion-preview-source">Preview unavailable</small>}
    </div>
  );
}
