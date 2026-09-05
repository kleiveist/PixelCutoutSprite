import { describe, expect, it } from "vitest";

import type { AreaCard } from "../../domain/areas";
import { emptyAreaFilters, filterAreaCards, profileRevisionKey } from "./area-filter";

const card = (
  id: string,
  name: string,
  height: number,
  profileRevision: number,
  labels: string[],
): AreaCard => ({
  id,
  revision: 1,
  project_id: "10000000-0000-4000-8000-000000000001",
  name,
  object_type: "humanoid",
  profile_ref: { id: "30000000-0000-4000-8000-000000000001", revision: profileRevision },
  reference_height_px: height,
  direction_model: "eight_way",
  default_frame_size_px: [128, 128],
  default_ground_origin_px: [64, 108],
  label_ids: labels,
  created_at: "2026-09-05T10:00:00Z",
  updated_at: name === "Small" ? "2026-09-05T10:00:00Z" : "2026-09-05T11:00:00Z",
});

describe("area card filters", () => {
  it("combines profile revision, exact height, labels, and deterministic sorting", () => {
    const small = card("a", "Small", 64, 1, ["villager"]);
    const tall = card("b", "Tall", 96, 2, ["villager", "guard"]);
    expect(filterAreaCards([small, tall], emptyAreaFilters()).map((item) => item.name)).toEqual([
      "Tall",
      "Small",
    ]);
    expect(
      filterAreaCards([small, tall], {
        ...emptyAreaFilters(),
        profile: profileRevisionKey(tall),
        referenceHeight: "96",
        labelIds: ["villager", "guard"],
        labelMatch: "all",
      }),
    ).toEqual([tall]);
  });
});
