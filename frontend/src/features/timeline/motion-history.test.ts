import { describe, expect, it } from "vitest";

import type { MotionDraft } from "../../domain/animations";
import {
  commitMotion,
  createMotionHistory,
  draftContent,
  redoMotion,
  undoMotion,
} from "./motion-history";

const draft = {
  schema_version: 1,
  kind: "motion_draft",
  template_id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  released_from_draft_revision: null,
  profile_ref: { id: "22222222-2222-4222-8222-222222222222", revision: 1 },
  frame_size_px: [128, 128],
  ground_origin_px: [64, 108],
  frame_count: 12,
  fps: 12,
  loop_mode: "loop",
  directions: [],
  tracks: [],
  updated_at: "2026-09-05T10:00:00Z",
} as MotionDraft;

describe("motion history", () => {
  it("undoes and redoes complete timeline data without treating save metadata as content", () => {
    const changed = { ...draft, fps: 18 };
    const committed = commitMotion(createMotionHistory(draft), changed, "Change FPS");
    expect(committed.past).toHaveLength(1);
    expect(undoMotion(committed).present.fps).toBe(12);
    expect(redoMotion(undoMotion(committed)).present.fps).toBe(18);
    expect(draftContent({ ...changed, revision: 9 })).toBe(draftContent(changed));
  });
});
