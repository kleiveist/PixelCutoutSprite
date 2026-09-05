import { describe, expect, it } from "vitest";

import { emptyMotionFilters, filterMotionCards, type MotionCard } from "./animations";

const card = (
  name: string,
  status: MotionCard["status"],
  directions: MotionCard["direction_coverage"],
): MotionCard => ({
  id:
    name === "Walk"
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222",
  revision: 1,
  area_id: "33333333-3333-4333-8333-333333333333",
  name,
  action_key: name.toLowerCase(),
  status,
  label_ids: name === "Walk" ? ["outdoor"] : ["outdoor", "hero"],
  profile_ref: {
    id: "44444444-4444-4444-8444-444444444444",
    revision: name === "Walk" ? 1 : 2,
  },
  frame_count: 8,
  fps: 12,
  loop_mode: "loop",
  direction_coverage: directions,
  released_revisions: status === "new" ? [] : [1],
  latest_release: status === "new" ? null : 1,
  updated_at: name === "Walk" ? "2026-09-05T10:00:00Z" : "2026-09-05T11:00:00Z",
});

describe("motion filters", () => {
  it("combines text, status, direction, profile, and deterministic sorting", () => {
    const cards = [card("Walk", "released", ["s"]), card("Jump", "new", ["n", "s"])];
    expect(filterMotionCards(cards, emptyMotionFilters()).map((item) => item.name)).toEqual([
      "Jump",
      "Walk",
    ]);
    expect(
      filterMotionCards(cards, { ...emptyMotionFilters(), direction: "n" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Jump"]);
    expect(
      filterMotionCards(cards, { ...emptyMotionFilters(), status: "released" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Walk"]);
    expect(
      filterMotionCards(cards, { ...emptyMotionFilters(), search: "jump" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Jump"]);
    expect(
      filterMotionCards(cards, {
        ...emptyMotionFilters(),
        action: "jump",
        directionCoverage: "partial",
        profile: "44444444-4444-4444-8444-444444444444@2",
        labelIds: ["outdoor", "hero"],
        labelMatch: "all",
      }).map((item) => item.name),
    ).toEqual(["Jump"]);
  });
});
