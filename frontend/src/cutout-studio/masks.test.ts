import { describe, expect, it } from "vitest";
import {
  applyStroke,
  BoundedHistory,
  brush,
  contains,
  emptyMask,
  intersect,
  lasso,
  pixelCount,
  rectangle,
  subtract,
  union,
  validateRuns,
} from "./masks";
import { fitImage, flyoutPosition, toSource, toView, zoomAt } from "../shared/image/viewport";

describe("source-pixel masks", () => {
  it("P43 preserves history when another part's budget rejects undo or redo", () => {
    const history = new BoundedHistory<number>();
    history.push(1);
    const before = history.bytes;
    expect(history.undo(2, () => false)).toBeUndefined();
    expect(history.bytes).toBe(before);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1, () => false)).toBeUndefined();
    expect(history.canRedo).toBe(true);
    expect(history.redo(1)).toBe(2);
  });
  it("clips half-open asymmetric rectangles, including all four image edges", () => {
    expect(rectangle({ x: -3, y: -4 }, { x: 8, y: 5 }, { width: 7, height: 3 })).toEqual([[0, 21]]);
    expect(rectangle({ x: 5, y: 1 }, { x: 7, y: 3 }, { width: 7, height: 3 })).toEqual([
      [12, 2],
      [19, 2],
    ]);
    expect(rectangle({ x: 0, y: 0 }, { x: 0, y: 0 }, { width: 7, height: 3 })).toEqual([]);
  });
  it("uses normalized bounded runs with holes, union, subtraction and intersection", () => {
    expect(union([[5, 3]], [[0, 5]], [[12, 2]])).toEqual([
      [0, 8],
      [12, 2],
    ]);
    expect(
      subtract(
        [[0, 10]],
        [
          [2, 3],
          [7, 8],
        ],
      ),
    ).toEqual([
      [0, 2],
      [5, 2],
    ]);
    expect(
      intersect(
        [[0, 10]],
        [
          [2, 3],
          [7, 8],
        ],
      ),
    ).toEqual([
      [2, 3],
      [7, 3],
    ]);
    expect(
      validateRuns(
        [
          [0, 2],
          [3, 3],
        ],
        6,
      ),
    ).toBe(true);
    for (const runs of [
      [
        [0, 2],
        [2, 3],
      ],
      [[-1, 3]],
      [[0, 7]],
      [[0, 0]],
    ])
      expect(validateRuns(runs as [number, number][], 6)).toBe(false);
    expect(
      contains(
        [
          [0, 2],
          [5, 2],
        ],
        2,
      ),
    ).toBe(false);
    expect(
      contains(
        [
          [0, 2],
          [5, 2],
        ],
        6,
      ),
    ).toBe(true);
  });
  it("rasterizes polygon centres and continuous strokes without scaling masks", () => {
    const size = { width: 11, height: 7 };
    expect(
      lasso(
        [
          { x: 1, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 3 },
          { x: 1, y: 3 },
        ],
        size,
      ),
    ).toEqual([
      [12, 3],
      [23, 3],
    ]);
    const stroke = brush(
      [
        { x: 0.5, y: 3.5 },
        { x: 10.5, y: 3.5 },
      ],
      0.5,
      size,
    );
    expect(stroke).toEqual([[33, 11]]);
    expect(validateRuns(stroke, 77)).toBe(true);
    expect(brush([], 2, size)).toEqual([]);
  });
  it("allows overlaps between independent parts and never changes a confirmed mask while editing", () => {
    const arm = applyStroke(emptyMask(), "positive", [[10, 6]]);
    const torso = applyStroke(emptyMask(), "rectangle", [[8, 10]]);
    const confirmed = { ...arm, confirmed: arm.draft };
    const edited = applyStroke(confirmed, "negative", [[12, 2]]);
    expect(edited.confirmed).toEqual([[10, 6]]);
    expect(edited.draft).toEqual([
      [10, 2],
      [14, 2],
    ]);
    expect(torso.draft).toEqual([[8, 10]]);
    expect(applyStroke(edited, "protect", [[12, 2]]).protected).toEqual([[12, 2]]);
  });
  it("represents a 16 MP rectangular selection without a per-part bitmap", () => {
    const runs = rectangle({ x: 0, y: 0 }, { x: 4096, y: 4096 }, { width: 4096, height: 4096 });
    expect(runs).toEqual([[0, 16777216]]);
    expect(pixelCount(runs)).toBe(16777216);
  });
});

describe("bounded per-part history", () => {
  it("supports independent undo/redo, clears branches and limits bytes and steps", () => {
    const a = new BoundedHistory<number>(100, 2),
      b = new BoundedHistory<number>();
    a.push(1);
    a.push(2);
    a.push(3);
    b.push(50);
    expect(a.undo(4)).toBe(3);
    expect(a.undo(3)).toBe(2);
    expect(a.undo(2)).toBeUndefined();
    expect(a.redo(2)).toBe(3);
    expect(b.undo(51)).toBe(50);
    a.push(9);
    expect(a.canRedo).toBe(false);
    expect(a.bytes).toBeLessThanOrEqual(100);
    const large = new BoundedHistory<string>(8);
    large.push("too long for history");
    expect(large.canUndo).toBe(false);
  });
});

describe("CSS/source coordinate contract", () => {
  it("round-trips asymmetric pixels at any fit, zoom and pan independently of DPR", () => {
    const original = { x: 117.5, y: 13.5 };
    for (const dpr of [1, 1.25, 2, 3]) {
      const view = zoomAt(
        fitImage({ width: 317, height: 83 }, { width: 600, height: 400 }),
        { x: 91, y: 52 },
        3,
      );
      const css = toView(original, view);
      const backing = { x: css.x * dpr, y: css.y * dpr };
      const restored = toSource({ x: backing.x / dpr, y: backing.y / dpr }, view);
      expect(restored.x).toBeCloseTo(original.x);
      expect(restored.y).toBeCloseTo(original.y);
    }
  });
  it("anchors zoom at the cursor and clamps left-preferred flyouts into the viewport", () => {
    const view = fitImage({ width: 100, height: 200 }, { width: 400, height: 400 }),
      point = { x: 230, y: 80 };
    expect(toSource(point, zoomAt(view, point, 2))).toEqual(toSource(point, view));
    expect(
      flyoutPosition(
        { left: 400, right: 450, top: 90 } as DOMRect,
        { width: 200, height: 180 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 192, y: 90 });
    expect(
      flyoutPosition(
        { left: 4, right: 54, top: 500 } as DOMRect,
        { width: 200, height: 180 },
        { width: 320, height: 600 },
      ),
    ).toEqual({ x: 62, y: 412 });
  });
});
