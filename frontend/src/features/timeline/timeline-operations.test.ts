import { describe, expect, it } from "vitest";

import type { MotionRevision } from "../../domain/motion";
import {
  applyConfirmedRetime,
  copyKeys,
  deleteKeys,
  keyId,
  moveKeys,
  pasteKeys,
  previewRetime,
  rangeSelection,
} from "./timeline-operations";

function motion(): MotionRevision {
  return {
    schema_version: 1,
    kind: "motion_revision",
    template_id: "11111111-1111-4111-8111-111111111111",
    revision: 1,
    profile_ref: { id: "22222222-2222-4222-8222-222222222222", revision: 1 },
    frame_size_px: [128, 128],
    ground_origin_px: [64, 108],
    frame_count: 12,
    fps: 12,
    loop_mode: "loop",
    directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"].map((direction) => ({
      direction: direction as "n",
      mode: "explicit",
    })),
    tracks: [
      {
        direction: "s",
        slot_id: "torso_upper",
        property: "offset_y_px",
        interpolation: "linear",
        keys: [
          { frame: 0, value: 0 },
          { frame: 3, value: 2 },
          { frame: 9, value: -2 },
        ],
      },
    ],
    published_at: "2026-09-05T10:00:00Z",
  };
}

describe("timeline operations", () => {
  it("copies a selected range relative to its first frame and pastes without mutation", () => {
    const source = motion();
    const selected = rangeSelection(source, 0, 2, 9);
    expect([...selected]).toEqual([
      keyId({ trackIndex: 0, frame: 3 }),
      keyId({ trackIndex: 0, frame: 9 }),
    ]);
    const copied = copyKeys(source, selected);
    expect(copied.map((item) => item.relativeFrame)).toEqual([0, 6]);
    const pasted = pasteKeys(source, copied, 1);
    expect(pasted.tracks[0].keys.map((key) => key.frame)).toEqual([0, 1, 3, 7, 9]);
    expect(source.tracks[0].keys.map((key) => key.frame)).toEqual([0, 3, 9]);
  });

  it("reports destructive retiming before it can be applied", () => {
    const source = motion();
    const preview = previewRetime(source, 6);
    expect(preview.affected.map((key) => key.frame)).toEqual([9]);
    expect(applyConfirmedRetime(source, preview, false)).toBeNull();
    expect(
      applyConfirmedRetime(source, preview, true)?.tracks[0].keys.map((key) => key.frame),
    ).toEqual([0, 3]);
  });

  it("moves and deletes selected keys without mutating or colliding", () => {
    const source = motion();
    const selected = new Set([keyId({ trackIndex: 0, frame: 3 })]);
    expect(moveKeys(source, selected, -1)?.tracks[0].keys.map((key) => key.frame)).toEqual([
      0, 2, 9,
    ]);
    expect(moveKeys(source, selected, -3)).toBeNull();
    expect(deleteKeys(source, selected).tracks[0].keys.map((key) => key.frame)).toEqual([0, 9]);
    expect(source.tracks[0].keys.map((key) => key.frame)).toEqual([0, 3, 9]);
  });

  it("can distribute keys across a changed duration", () => {
    const source = motion();
    const preview = previewRetime(source, 23);
    const distributed = applyConfirmedRetime(source, preview, false, "distribute");
    expect(distributed?.tracks[0].keys.map((key) => key.frame)).toEqual([0, 6, 18]);
    expect(distributed?.frame_count).toBe(23);
  });
});
