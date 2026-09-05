import { useEffect, useRef, useState } from "react";

const SAMPLE_COUNT = 120;

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) throw new Error("percentile requires at least one value");
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new Error("percentile quantile must be between zero and one");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index];
}

interface ProbeResult {
  maximum: number;
  p50: number;
  p95: number;
  samples: number;
}

function formatResult(result: ProbeResult): string {
  return [
    `P19_FRAME_PROBE samples=${result.samples}`,
    `viewport=${window.innerWidth}x${window.innerHeight}`,
    `dpr=${window.devicePixelRatio}`,
    `p50=${result.p50.toFixed(2)}ms`,
    `p95=${result.p95.toFixed(2)}ms`,
    `max=${result.maximum.toFixed(2)}ms`,
  ].join(" ");
}

/** Opt-in native WebView evidence collector; never mounted in the default build. */
export function NativeAcceptanceProbe() {
  const [run, setRun] = useState(0);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("P19_FRAME_PROBE idle · load the target view, then start");
  const originalTitle = useRef(document.title);

  useEffect(() => {
    if (run === 0) return;
    let frameRequest = 0;
    let previous: number | null = null;
    const intervals: number[] = [];

    const sample = (timestamp: number): void => {
      if (previous !== null) intervals.push(timestamp - previous);
      previous = timestamp;
      if (intervals.length >= SAMPLE_COUNT) {
        const result = {
          maximum: Math.max(...intervals),
          p50: percentile(intervals, 0.5),
          p95: percentile(intervals, 0.95),
          samples: intervals.length,
        };
        const formatted = formatResult(result);
        setText(formatted);
        setRunning(false);
        document.title = `${originalTitle.current} · ${formatted}`;
        return;
      }
      frameRequest = window.requestAnimationFrame(sample);
    };

    frameRequest = window.requestAnimationFrame(sample);
    return () => {
      window.cancelAnimationFrame(frameRequest);
      document.title = originalTitle.current;
    };
  }, [run]);

  return (
    <aside className="native-frame-probe" aria-label="Native frame timing probe">
      <button
        type="button"
        disabled={running}
        onClick={() => {
          setText(`P19_FRAME_PROBE measuring ${SAMPLE_COUNT} intervals…`);
          setRunning(true);
          setRun((current) => current + 1);
        }}
      >
        {running ? "Measuring frame timing…" : "Start frame probe on this view"}
      </button>
      <output data-testid="native-frame-probe" aria-live="polite">
        {text}
      </output>
    </aside>
  );
}
