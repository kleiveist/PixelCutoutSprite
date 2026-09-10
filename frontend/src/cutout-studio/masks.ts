import { z } from "zod";

/** Sorted, disjoint half-open runs in the normalized source's row-major pixel grid. */
export type Runs = readonly (readonly [number, number])[];
export type Point = { readonly x: number; readonly y: number };
export type Size = { readonly width: number; readonly height: number };
const RunsSchema = z.array(z.tuple([z.number().int().nonnegative(), z.number().int().positive()]));
export const MaskSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("cutoutMask"),
  draft: RunsSchema,
  confirmed: RunsSchema,
  roi: RunsSchema,
  positive: RunsSchema,
  negative: RunsSchema,
  protected: RunsSchema,
});
export type Mask = z.infer<typeof MaskSchema>;
export const emptyMask = (): Mask => ({
  schemaVersion: 1,
  kind: "cutoutMask",
  draft: [],
  confirmed: [],
  roi: [],
  positive: [],
  negative: [],
  protected: [],
});

export function validateRuns(runs: Runs, pixels: number): boolean {
  let end = -1;
  return runs.every(([start, length]) => {
    const valid =
      Number.isSafeInteger(start) &&
      Number.isSafeInteger(length) &&
      start >= 0 &&
      length > 0 &&
      start > end &&
      start + length <= pixels;
    end = start + length;
    return valid;
  });
}

export function union(...sets: readonly Runs[]): [number, number][] {
  const sorted = sets
    .flatMap((runs) => runs.map(([a, n]): [number, number] => [a, n]))
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [start, length] of sorted) {
    const last = out.at(-1);
    if (last && start <= last[0] + last[1]) last[1] = Math.max(last[1], start + length - last[0]);
    else if (length > 0) out.push([start, length]);
  }
  return out;
}

export function subtract(base: Runs, removed: Runs): [number, number][] {
  const out: [number, number][] = [];
  let j = 0;
  for (const [start, length] of base) {
    const end = start + length;
    let cursor = start;
    while (j < removed.length && removed[j]![0] + removed[j]![1] <= cursor) j++;
    let k = j;
    while (k < removed.length && removed[k]![0] < end) {
      const [a, n] = removed[k++]!;
      if (a > cursor) out.push([cursor, Math.min(end, a) - cursor]);
      cursor = Math.max(cursor, a + n);
    }
    if (cursor < end) out.push([cursor, end - cursor]);
  }
  return out;
}

export const intersect = (a: Runs, b: Runs): [number, number][] => subtract(a, subtract(a, b));
export const pixelCount = (runs: Runs): number => runs.reduce((n, [, length]) => n + length, 0);
export function contains(runs: Runs, index: number): boolean {
  let low = 0,
    high = runs.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const [start, length] = runs[mid]!;
    if (index < start) high = mid;
    else if (index >= start + length) low = mid + 1;
    else return true;
  }
  return false;
}

export function rectangle(a: Point, b: Point, size: Size): [number, number][] {
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x)));
  const x1 = Math.min(size.width, Math.ceil(Math.max(a.x, b.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y)));
  const y1 = Math.min(size.height, Math.ceil(Math.max(a.y, b.y)));
  const runs: [number, number][] = [];
  if (x1 <= x0) return runs;
  for (let y = y0; y < y1; y++) runs.push([y * size.width + x0, x1 - x0]);
  return union(runs);
}

/** Even/odd fill at pixel centres; a self-intersection is deterministic, not a flood fill. */
export function lasso(points: readonly Point[], size: Size): [number, number][] {
  if (points.length < 3) return [];
  const runs: [number, number][] = [];
  const y0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const y1 = Math.min(size.height, Math.ceil(Math.max(...points.map((p) => p.y))));
  for (let y = y0; y < y1; y++) {
    const intersections: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!,
        b = points[(i + 1) % points.length]!,
        cy = y + 0.5;
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) {
        intersections.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(intersections[i]! - 0.5));
      const x1 = Math.min(size.width, Math.ceil(intersections[i + 1]! - 0.5));
      if (x1 > x0) runs.push([y * size.width + x0, x1 - x0]);
    }
  }
  return union(runs);
}

/** Rasterize the swept capsule, including fast pointer motion without holes. */
export function brush(points: readonly Point[], radius: number, size: Size): [number, number][] {
  if (!Number.isFinite(radius) || radius < 0.5 || radius > 128) return [];
  const runs: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]!,
      b = points[i]!;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(distance * 2));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps,
        y = a.y + ((b.y - a.y) * s) / steps;
      for (
        let row = Math.max(0, Math.ceil(y - radius - 0.5));
        row < Math.min(size.height, Math.ceil(y + radius - 0.5));
        row++
      ) {
        const half = Math.sqrt(Math.max(0, radius * radius - (row + 0.5 - y) ** 2));
        const x0 = Math.max(0, Math.ceil(x - half - 0.5));
        const x1 = Math.min(size.width, Math.floor(x + half - 0.5) + 1);
        if (x1 > x0) runs.push([row * size.width + x0, x1 - x0]);
      }
    }
  }
  return union(runs);
}

export type MaskTool = "rectangle" | "lasso" | "positive" | "negative" | "protect" | "pan";
export function applyStroke(mask: Mask, tool: MaskTool, stroke: Runs): Mask {
  if (tool === "pan" || stroke.length === 0) return mask;
  if (tool === "negative")
    return {
      ...mask,
      draft: subtract(mask.draft, stroke),
      negative: union(mask.negative, stroke),
      positive: subtract(mask.positive, stroke),
      protected: subtract(mask.protected, stroke),
    };
  const draft = union(mask.draft, stroke);
  if (tool === "rectangle" || tool === "lasso")
    return { ...mask, draft, roi: union(mask.roi, stroke) };
  return {
    ...mask,
    draft,
    negative: subtract(mask.negative, stroke),
    positive: union(mask.positive, stroke),
    protected: tool === "protect" ? union(mask.protected, stroke) : mask.protected,
  };
}

/** References are immutable; the byte estimate intentionally overcounts shared runs. */
export class BoundedHistory<T> {
  private past: { value: T; bytes: number }[] = [];
  private future: { value: T; bytes: number }[] = [];
  constructor(
    private readonly maxBytes = 8 * 1024 * 1024,
    private readonly maxSteps = 48,
  ) {}
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get bytes(): number {
    return [...this.past, ...this.future].reduce((n, entry) => n + entry.bytes, 0);
  }
  private entry(value: T) {
    return { value, bytes: JSON.stringify(value).length * 2 };
  }
  private trim(): void {
    while (this.past.length + this.future.length > this.maxSteps || this.bytes > this.maxBytes) {
      if (this.past.length) this.past.shift();
      else this.future.shift();
    }
  }
  push(value: T): void {
    this.past.push(this.entry(value));
    this.future = [];
    this.trim();
  }
  undo(current: T, accept: (value: T) => boolean = () => true): T | undefined {
    const candidate = this.past.at(-1);
    if (!candidate || !accept(candidate.value)) return undefined;
    const previous = this.past.pop();
    if (!previous) return undefined;
    this.future.push(this.entry(current));
    this.trim();
    return previous.value;
  }
  redo(current: T, accept: (value: T) => boolean = () => true): T | undefined {
    const candidate = this.future.at(-1);
    if (!candidate || !accept(candidate.value)) return undefined;
    const next = this.future.pop();
    if (!next) return undefined;
    this.past.push(this.entry(current));
    this.trim();
    return next.value;
  }
}
