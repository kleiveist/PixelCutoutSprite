import { describe, expect, it } from "vitest";

import type { MotionDraft } from "../../domain/animations";
import { neutralTransform } from "./editor-state";
import { poseFromDraft, tracksWithPose } from "./motion-pose";

const draft: MotionDraft = {
  schema_version: 1,
  kind: "motion_draft",
  template_id: "11111111-1111-4111-8111-111111111111",
  revision: 3,
  released_from_draft_revision: null,
  profile_ref: { id: "22222222-2222-4222-8222-222222222222", revision: 1 },
  frame_size_px: [128, 128],
  ground_origin_px: [64, 108],
  frame_count: 12,
  fps: 12,
  loop_mode: "loop",
  directions: [
    { direction: "s", mode: "explicit", source: null },
    { direction: "n", mode: "explicit", source: null },
  ],
  tracks: [
    {
      direction: "s",
      slot_id: "hand_l",
      property: "offset_x_px",
      interpolation: "linear",
      keys: [
        { frame: 0, value: 4 },
        { frame: 6, value: 9 },
      ],
    },
    {
      direction: "n",
      slot_id: "hand_l",
      property: "rotation_deg",
      interpolation: "linear",
      keys: [{ frame: 0, value: -15 }],
    },
  ],
  updated_at: "2026-09-05T10:00:00Z",
};

describe("motion pose persistence", () => {
  it("loads only the selected direction into a neutral slot pose", () => {
    const pose = poseFromDraft(draft, "s", ["torso", "hand_l"]);
    expect(pose.torso).toEqual(neutralTransform());
    expect(pose.hand_l.offsetX).toBe(4);
    expect(pose.hand_l.rotation).toBe(0);
  });

  it("replaces one direction while preserving unrelated tracks", () => {
    const pose = {
      torso: neutralTransform(),
      hand_l: { ...neutralTransform(), offsetY: 3, rotation: 30, visible: false },
    };
    const tracks = tracksWithPose(draft, "s", pose, ["torso", "hand_l"]);
    expect(tracks).toContainEqual(draft.tracks[1]);
    expect(tracks).not.toContainEqual(draft.tracks[0]);
    expect(tracks).toContainEqual({
      ...draft.tracks[0],
      keys: [
        { frame: 0, value: 0 },
        { frame: 6, value: 9 },
      ],
    });
    expect(poseFromDraft({ ...draft, tracks }, "s", ["torso", "hand_l"]).hand_l).toMatchObject({
      offsetX: 0,
      offsetY: 3,
      rotation: 30,
      visible: false,
    });
  });
});
